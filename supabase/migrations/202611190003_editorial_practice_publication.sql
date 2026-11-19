-- Editorial practice uses the existing private lesson, question and test records.
-- The operator explicitly selects verified jobs. Browser roles cannot release a set.
alter table study_private.content_jobs drop constraint content_jobs_status_check;
alter table study_private.content_jobs add constraint content_jobs_status_check
  check (status in ('pending','validating','review','needs_source','failed','paused','published'));

create function study_private.practice_prompt_tokens(body text)
returns text[] language sql immutable set search_path='' as $$
  select coalesce(array_agg(distinct token order by token),'{}')
  from regexp_split_to_table(regexp_replace(lower(body),'[0-9]+([.,][0-9]+)?',' NUM ','g'),
    '[^[:alnum:]_]+') token where length(token)>0
$$;

create function study_private.publish_editorial_practice(
  p_namespace text, p_school text, p_ids text[], p_publish boolean default false
) returns table(job_id text, subject text, outcome text, question_count integer, test_id text)
language plpgsql set search_path='' as $$
declare
  j study_private.content_jobs%rowtype;
  source study_private.curriculum_source_rows%rowtype;
  lesson jsonb;
  draft_set jsonb;
  released_set jsonb;
  t jsonb;
  class_codes text[];
  class_scope text[];
  reference_year text;
  release_at timestamptz := now();
  names text[] := array['Matematika','Biologiya','Kimyo','Fizika','Ingliz tili'];
begin
  if p_namespace is null or p_namespace !~ '^_specialized_preview_[a-z0-9_]{1,40}$'
     or nullif(p_school,'') is null or coalesce(cardinality(p_ids),0) not between 1 and 15 then
    raise exception 'INVALID_PRACTICE_RELEASE_SCOPE';
  end if;
  -- Content workers and runtime writers serialize on the same state revision.
  if p_publish then
    perform 1 from study_private.runtime_namespaces where namespace=p_namespace for update;
  end if;
  select r.data->>'academicYear' into reference_year
    from study_private.runtime_records r
    where r.namespace=p_namespace and r.collection='institutions' and r.record_key=p_school;
  for job_id in select distinct id from unnest(p_ids) id order by id loop
    subject := null; question_count := 0; test_id := null;
    select * into j from study_private.content_jobs x
      where x.namespace=p_namespace and x.school_id=p_school and x.id=job_id;
    if not found or (job_id not like 'editorial-batch-2-%' and job_id not like 'editorial-confirmed-%') then
      outcome := 'JOB_OUT_OF_SCOPE'; return next; continue;
    end if;
    select * into source from study_private.curriculum_source_rows s
      where s.namespace=j.namespace and s.school_id=j.school_id and s.academic_year=j.academic_year
      and s.source_id=j.source_id;
    subject := source.payload->>'subject';
    test_id := 'editorial-practice-' || source.topic_id;
    if j.status='published' then
      outcome := 'ALREADY_PUBLISHED'; question_count := cardinality(j.question_ids); return next; continue;
    end if;
    if j.status<>'review' or cardinality(j.question_ids)<>10 or jsonb_typeof(j.payload) is distinct from 'array' then
      outcome := 'DRAFT_SET_REQUIRED'; return next; continue;
    end if;
    if not source.eligible or not coalesce(subject=any(names),false) or source.payload->>'kind' is distinct from 'lesson'
       or j.academic_year is distinct from reference_year or source.subject_id is null
       or cardinality(source.class_ids)=0 or source.payload->'issues' is distinct from '[]'::jsonb
       or coalesce(source.payload->>'sourceHash','') !~ '^[a-f0-9]{64}$' then
      outcome := 'CURRICULUM_REVIEW_REQUIRED'; return next; continue;
    end if;
    select r.data into lesson from study_private.runtime_records r
      where r.namespace=j.namespace and r.collection='lessons' and r.record_key=j.lesson_id
      and r.institution_id=j.school_id;
    if lesson is null or j.lesson_id is distinct from 'pilot30-lesson-'||source.source_id
       or lesson->>'status' is distinct from 'draft'
       or lesson->>'academicYear' is distinct from j.academic_year
       or lesson->>'subjectName' is distinct from subject
       or lesson->>'subjectId' is distinct from source.subject_id
       or lesson->>'grade' is distinct from source.payload->>'grade'
       or lesson->>'sourceFileName' is distinct from source.payload->>'sourceFile'
       or lesson->>'sourceWorksheet' is distinct from source.payload->>'sourceSheet'
       or lesson->>'sourceRow' is distinct from source.payload->>'sourceRow'
       or lesson->>'sourceHash' is distinct from source.payload->>'sourceHash'
       or not (coalesce(lesson->'classIds','[]') @> to_jsonb(source.class_ids)
          and to_jsonb(source.class_ids) @> coalesce(lesson->'classIds','[]')) then
      outcome := 'LESSON_MAPPING_REVIEW_REQUIRED'; return next; continue;
    end if;
    select array_agg(c.record_key order by c.record_key), array_agg(c.data->>'code' order by c.record_key)
    into class_scope,class_codes
    from study_private.runtime_records c
    where c.namespace=j.namespace and c.collection='classes' and c.institution_id=j.school_id
      and c.record_key=any(source.class_ids) and c.data->>'grade'=source.payload->>'grade'
      and c.data->>'status'='active' and nullif(c.data->>'code','') is not null;
    if cardinality(class_scope) is distinct from cardinality(source.class_ids) then
      outcome := 'CLASS_REVIEW_REQUIRED'; return next; continue;
    end if;
    if (subject='Matematika' and exists(select 1 from unnest(class_codes) code where lower(code) ~ 't$')
        or lesson->>'additionalCurriculumAssignment'='true')
      and lesson->>'tTrackVisibilityApproved' is distinct from 'true' then
      outcome := 'CLASS_APPROVAL_REQUIRED'; return next; continue;
    end if;
    if exists(select 1 from study_private.runtime_records r
      where r.namespace=j.namespace and r.collection='topicTests'
      and (r.record_key=test_id or (r.institution_id=j.school_id and r.data->>'lessonId'=j.lesson_id))) then
      outcome := 'EXISTING_TEST_REVIEW_REQUIRED'; return next; continue;
    end if;

    select jsonb_agg(r.data order by ids.idx) into draft_set
      from unnest(j.question_ids) with ordinality ids(id,idx)
      join study_private.runtime_records r on r.namespace=j.namespace and r.collection='topicQuestions'
        and r.record_key=ids.id and r.institution_id=j.school_id and r.data->>'schoolId'=j.school_id
        and r.data->>'lessonId'=j.lesson_id and r.data->>'status'='draft';
    if jsonb_array_length(draft_set) is distinct from 10 or jsonb_array_length(j.payload)<>10
       or (select count(distinct value->>'id') from jsonb_array_elements(draft_set))<>10
       or (select count(distinct value->>'difficulty') from jsonb_array_elements(draft_set))<>3
       or (select count(distinct lower(trim(value#>>'{editorialSource,cognitiveSkill}'))) from jsonb_array_elements(draft_set))<>10
       or exists (
         select 1 from jsonb_array_elements(draft_set) q
         where not exists(select 1 from jsonb_array_elements(j.payload) stamped where q @> stamped)
           or coalesce(q->>'kind','') not in ('single','short')
           or coalesce(q->>'difficulty','') not in ('easy','medium','hard')
           or coalesce(q->>'revision','') !~ '^[1-9][0-9]{0,8}$'
           or coalesce(length(trim(q->>'prompt')),0)<14 or coalesce(length(trim(q->>'key')),0)<1
           or coalesce(length(trim(q->>'explanation')),0)<15 or coalesce(length(trim(q->>'hint')),0)<10
           or jsonb_typeof(q->'steps') is distinct from 'array'
           or case when jsonb_typeof(q->'steps')='array' then jsonb_array_length(q->'steps')<2 or
             exists(select 1 from jsonb_array_elements_text(q->'steps') step where length(trim(step))<5) else true end
           or q#>>'{editorialSource,topicId}' is distinct from source.source_id
           or q#>>'{editorialSource,sourceHash}' is distinct from source.payload->>'sourceHash'
           or q#>>'{editorialSource,subject}' is distinct from subject
           or q#>>'{editorialSource,grade}' is distinct from source.payload->>'grade'
           or q#>>'{editorialSource,trace,file}' is distinct from source.payload->>'sourceFile'
           or q#>>'{editorialSource,trace,sheet}' is distinct from source.payload->>'sourceSheet'
           or q#>>'{editorialSource,trace,row}' is distinct from source.payload->>'sourceRow'
           or q#>>'{editorialSource,trace,kind}' is distinct from 'lesson'
           or (q->>'kind'='single' and case when jsonb_typeof(q->'options')='array' then
             jsonb_array_length(q->'options') not between 3 and 6 or not ((q->'options') ? (q->>'key'))
             or (select count(distinct lower(trim(option))) from jsonb_array_elements_text(q->'options') option) <> jsonb_array_length(q->'options')
             else true end)
       ) then
      outcome := 'QUESTION_QUALITY_REVIEW_REQUIRED'; return next; continue;
    end if;
    if exists (
      select 1 from jsonb_array_elements(draft_set) with ordinality a(q,n)
      join jsonb_array_elements(draft_set) with ordinality b(q,n) on a.n<b.n
      cross join lateral (
        select study_private.practice_prompt_tokens(a.q->>'prompt') as a_terms,
          study_private.practice_prompt_tokens(b.q->>'prompt') as b_terms
      ) tokens
      cross join lateral (select count(*)::numeric overlap from unnest(tokens.a_terms) term
        where term=any(tokens.b_terms)) n
      where lower(trim(a.q->>'prompt'))=lower(trim(b.q->>'prompt'))
        or n.overlap / nullif(cardinality(tokens.a_terms)+cardinality(tokens.b_terms)-n.overlap,0)>=0.87
    ) then
      outcome := 'DUPLICATE_REVIEW_REQUIRED'; return next; continue;
    end if;
    question_count := 10;
    if not p_publish then outcome := 'READY'; return next; continue; end if;

    select jsonb_agg(value || jsonb_build_object(
      'revision',(value->>'revision')::integer+1,'status','published',
      'practiceQuality',jsonb_build_object('policy','curriculum-practice-v1',
        'revision',(value->>'revision')::integer+1,'checkedAt',release_at)
    ) order by ordinal) into released_set from jsonb_array_elements(draft_set) with ordinality q(value,ordinal);

    update study_private.runtime_records r set data=q.value
      from jsonb_array_elements(released_set) q(value)
      where r.namespace=j.namespace and r.collection='topicQuestions' and r.record_key=q.value->>'id';
    insert into study_private.runtime_records(namespace,collection,record_key,data)
      select j.namespace,'topicQuestionVersions', (q->>'id')||':'||(q->>'revision'),jsonb_build_object(
        'id',(q->>'id')||':'||(q->>'revision'),'schoolId',j.school_id,'questionId',q->>'id',
        'revision',q->'revision','question',q,'createdAt',release_at)
      from jsonb_array_elements(released_set) q;

    t := jsonb_build_object(
      'id',test_id,'institutionId',j.school_id,'schoolId',j.school_id,'lessonId',j.lesson_id,'classIds',class_scope,
      'title',left(source.payload->>'title',180),'status','published','version',1,'questionIds',j.question_ids,
      'snapshot',released_set,'count',10,'durationMinutes',0,'maxAttempts',10,'passPercent',0,
      'release','immediate','trackExits',false,'confidenceEnabled',false,'shuffle',false,
      'createdBy','curriculum-practice-v1','updatedAt',release_at,'hintsAfterSubmission',true
    );
    insert into study_private.runtime_records(namespace,collection,record_key,data) values
      (j.namespace,'topicTests',test_id,t),
      (j.namespace,'topicTestVersions',test_id||':1',jsonb_build_object('id',test_id||':1','schoolId',j.school_id,
        'testId',test_id,'version',1,'test',t,'createdAt',release_at)),
      (j.namespace,'auditLogs','editorial-release:'||test_id,jsonb_build_object(
        'id','editorial-release:'||test_id,'institutionId',j.school_id,'actorUid','curriculum-practice-v1',
        'actorName','Avtomatik sifat tekshiruvi','actorRole','system','action','Mavzuli mashq avtomatik nashr qilindi',
        'target','Mavzu testi','recordId',test_id,'createdAt',release_at));
    update study_private.runtime_records r set data=lesson||jsonb_build_object(
      'status','published','classIds',class_scope,'classCodes',class_codes,'classCode',class_codes[1],'classId',class_scope[1])
      where r.namespace=j.namespace and r.collection='lessons' and r.record_key=j.lesson_id;
    update study_private.content_jobs x set status='published', error_code=null, updated_at=release_at
      where x.namespace=j.namespace and x.school_id=j.school_id and x.id=j.id;
    update study_private.runtime_namespaces r set revision=gen_random_uuid(),updated_at=release_at,
      layout=layout||'{"lessons":"array","topicTests":"array","topicTestVersions":"array","topicQuestions":"array","topicQuestionVersions":"array","auditLogs":"array"}'
      where r.namespace=j.namespace;
    outcome := 'PUBLISHED'; return next;
  end loop;
end
$$;

revoke all on function study_private.practice_prompt_tokens(text),
  study_private.publish_editorial_practice(text,text,text[],boolean) from public,anon,authenticated;
