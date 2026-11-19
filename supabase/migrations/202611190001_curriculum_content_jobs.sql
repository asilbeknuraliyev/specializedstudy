create table study_private.curriculum_source_rows (
  namespace text not null references study_private.runtime_namespaces(namespace),
  school_id text not null,
  academic_year text not null,
  source_id text not null check (source_id ~ '^[a-f0-9]{64}$'),
  topic_id text not null check (topic_id ~ '^[a-f0-9]{64}$'),
  archive_hash text not null check (archive_hash ~ '^[a-f0-9]{64}$'),
  eligible boolean not null,
  subject_id text,
  class_ids text[] not null default '{}',
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  primary key (namespace, school_id, academic_year, source_id)
);
create index curriculum_source_topics on study_private.curriculum_source_rows(namespace, school_id, academic_year, topic_id);

create table study_private.content_jobs (
  namespace text not null references study_private.runtime_namespaces(namespace),
  school_id text not null,
  academic_year text not null,
  id text not null,
  source_id text not null,
  lesson_id text not null,
  status text not null default 'pending' check (status in ('pending','validating','review','needs_source','failed','paused')),
  payload jsonb,
  question_ids text[] not null default '{}',
  attempts integer not null default 0 check (attempts between 0 and 3),
  cost_cents integer not null default 0 check (cost_cents = 0),
  error_code text,
  updated_at timestamptz not null default now(),
  primary key (namespace, school_id, id),
  foreign key (namespace, school_id, academic_year, source_id)
    references study_private.curriculum_source_rows(namespace, school_id, academic_year, source_id)
);
create index content_jobs_pending on study_private.content_jobs(namespace, updated_at, id) where status = 'pending';
alter table study_private.curriculum_source_rows enable row level security;
alter table study_private.content_jobs enable row level security;
revoke all on study_private.curriculum_source_rows,study_private.content_jobs from public, anon, authenticated;

create function public.study_content_summary(p_namespace text,p_school text,p_year text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'sources',coalesce((select jsonb_agg(to_jsonb(x) order by subject,grade) from (
      select payload->>'subject' subject,payload->>'grade' grade,
        count(*) rows,count(distinct topic_id) filter(where eligible) candidates,
        count(*) filter(where cardinality(class_ids)=0 or subject_id is null) unresolved
      from study_private.curriculum_source_rows
      where namespace=p_namespace and school_id=p_school and academic_year=p_year
      group by 1,2
    ) x),'[]'::jsonb),
    'jobs',coalesce((select jsonb_agg(to_jsonb(x) order by status) from (
      select j.status,count(*) jobs,
       count(*) filter(where cardinality(j.question_ids)=10) delivered,
       sum(cardinality(j.question_ids)) questions,
       sum(j.cost_cents) cost_cents,
       sum((select count(*) from study_private.runtime_records r where r.namespace=j.namespace and r.institution_id=j.school_id
         and r.collection='topicQuestions' and r.record_key=any(j.question_ids)
         and r.data#>>'{approval,revision}'=r.data->>'revision')) approved,
       sum((select count(*) from study_private.runtime_records r where r.namespace=j.namespace and r.institution_id=j.school_id
         and r.collection='topicQuestions' and r.record_key=any(j.question_ids) and r.data->>'status'='published')) published
      from study_private.content_jobs j where j.namespace=p_namespace and j.school_id=p_school and j.academic_year=p_year
      group by 1
    ) x),'[]'::jsonb)
  );
$$;
revoke all on function public.study_content_summary(text,text,text) from public,anon,authenticated;
grant execute on function public.study_content_summary(text,text,text) to service_role;

create function study_private.run_editorial_content(p_namespace text,p_limit integer default 2)
returns integer language plpgsql set search_path='' as $$
declare
  item study_private.content_jobs%rowtype;
  source study_private.curriculum_source_rows%rowtype;
  question jsonb;
  saved jsonb;
  question_id text;
  ids text[];
  finished integer := 0;
begin
  if p_limit not between 1 and 5 or p_namespace !~ '^_specialized_preview_[a-z0-9_]{1,40}$' then
    raise exception 'INVALID_WORKER_SCOPE';
  end if;
  for item in select * from study_private.content_jobs
    where namespace=p_namespace and status='pending' and attempts<3
    order by updated_at,id limit p_limit for update skip locked loop
    update study_private.content_jobs set status='validating',attempts=attempts+1,updated_at=now()
      where namespace=item.namespace and school_id=item.school_id and id=item.id;
    begin
      select * into strict source from study_private.curriculum_source_rows
        where namespace=item.namespace and school_id=item.school_id and academic_year=item.academic_year and source_id=item.source_id;
      if not source.eligible or item.payload is null then
        update study_private.content_jobs set status='needs_source',error_code='EDITORIAL_SOURCE_REQUIRED',updated_at=now()
          where namespace=item.namespace and school_id=item.school_id and id=item.id;
        continue;
      end if;
      if jsonb_typeof(item.payload)<>'array' or jsonb_array_length(item.payload)<>10 or
        (select count(distinct regexp_replace(lower(btrim(value->>'prompt')),'[[:space:]]+',' ','g')) from jsonb_array_elements(item.payload))<>10 then
        raise exception 'INVALID_QUESTION_SET';
      end if;
      perform 1 from study_private.runtime_namespaces where namespace=item.namespace for update;
      if not exists (select 1 from study_private.runtime_records where namespace=item.namespace and collection='lessons'
        and record_key=item.lesson_id and institution_id=item.school_id and data->>'academicYear'=item.academic_year
        and data->>'subjectName'=source.payload->>'subject' and data->>'grade'=source.payload->>'grade'
        and data->>'sourceRow'=source.payload->>'sourceRow' and data->>'sourceFileName'=source.payload->>'sourceFile') then
        raise exception 'LESSON_MAPPING_REQUIRED';
      end if;
      ids := '{}';
      for question in select value from jsonb_array_elements(item.payload) loop
        if question#>>'{editorialSource,topicId}' is distinct from item.source_id or
          coalesce(length(question->>'key'),0)=0 or coalesce(length(question->>'explanation'),0)<15 or
          coalesce(length(question->>'hint'),0)<5 or question->>'id' !~ '^pilot4-question-[a-f0-9]{64}$' then
          raise exception 'INVALID_DRAFT';
        end if;
        select r.record_key into question_id from study_private.runtime_records r where r.namespace=item.namespace and r.institution_id=item.school_id
          and r.collection='topicQuestions' and r.data->>'lessonId'=item.lesson_id
          and lower(btrim(r.data->>'prompt'))=lower(btrim(question->>'prompt')) and r.data->>'status'<>'archived'
          order by r.record_key limit 1;
        if question_id is null then
          question_id:=question->>'id';
          saved:=question || jsonb_build_object('lessonId',item.lesson_id,'institutionId',item.school_id,'schoolId',item.school_id,'status','draft','revision',1);
          insert into study_private.runtime_records(namespace,collection,record_key,data)
            values(item.namespace,'topicQuestions',question_id,saved),
            (item.namespace,'topicQuestionVersions',question_id||':1',
              jsonb_build_object('id',question_id||':1','schoolId',item.school_id,'questionId',question_id,'revision',1,'question',saved,'createdAt',now()));
        end if;
        ids:=array_append(ids,question_id);
      end loop;
      update study_private.runtime_namespaces set revision=gen_random_uuid(),updated_at=now(),
        layout=layout||'{"topicQuestions":"array","topicQuestionVersions":"array"}'
        where namespace=item.namespace;
      update study_private.content_jobs set status='review',question_ids=ids,error_code=null,updated_at=now()
        where namespace=item.namespace and school_id=item.school_id and id=item.id;
      finished:=finished+1;
    exception when others then
      update study_private.content_jobs set status='failed',error_code=case when sqlstate='P0001' then sqlerrm else sqlstate end,updated_at=now()
        where namespace=item.namespace and school_id=item.school_id and id=item.id;
    end;
  end loop;
  return finished;
end $$;
revoke all on function study_private.run_editorial_content(text,integer) from public,anon,authenticated;

create function public.study_content_unresolved(p_namespace text,p_school text,p_year text,p_offset integer,p_subject text)
returns jsonb language sql stable security definer set search_path='' as $$
 with missing as (
  select payload from study_private.curriculum_source_rows
  where namespace=p_namespace and school_id=p_school and academic_year=p_year
    and (cardinality(class_ids)=0 or subject_id is null)
    and (p_subject='' or payload->>'subject'=p_subject)
 ) select jsonb_build_object(
   'total',(select count(*) from missing),
   'rows',coalesce((select jsonb_agg(row) from (
     select jsonb_build_object('id',payload->'id','title',payload->'title','subject',payload->'subject',
        'grade',payload->'grade','file',payload->'sourceFile','sheet',payload->'sourceSheet','row',payload->'sourceRow','issues',payload->'issues') row
     from missing order by payload->>'sourceFile',payload->>'sourceSheet',(payload->>'sourceRow')::integer
     limit 25 offset greatest(0,least(p_offset,10000))
   ) m),'[]'::jsonb));
$$;
revoke all on function public.study_content_unresolved(text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.study_content_unresolved(text,text,text,integer,text) to service_role;
