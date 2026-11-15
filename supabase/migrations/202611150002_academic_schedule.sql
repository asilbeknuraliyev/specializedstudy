create table if not exists study_private.academic_batches (
 namespace text not null, id text not null, school_id text not null, academic_year text not null,
 digest text not null, expected_count integer not null check(expected_count between 0 and 60000),
 status text not null default 'draft' check(status in ('draft','active','archived')),
 mutation_revision integer not null default 0, created_by text not null, created_at timestamptz not null default now(), primary key(namespace,id)
);
create table if not exists study_private.academic_heads (
 namespace text not null, school_id text not null, academic_year text not null, batch_id text not null,
 primary key(namespace,school_id,academic_year)
);
create table if not exists study_private.academic_occurrences (
 namespace text not null, batch_id text not null, id text not null, school_id text not null,
 class_id text not null, teacher_id text, group_id text, lesson_date date not null,
 revision integer not null default 1, data jsonb not null,
 primary key(namespace,batch_id,id), foreign key(namespace,batch_id) references study_private.academic_batches(namespace,id)
);
create index if not exists academic_by_class_day on study_private.academic_occurrences(namespace,school_id,class_id,lesson_date,id);
create index if not exists academic_by_teacher_day on study_private.academic_occurrences(namespace,school_id,teacher_id,lesson_date,id);
create index if not exists academic_by_batch_day on study_private.academic_occurrences(namespace,batch_id,lesson_date,id);
create table if not exists study_private.academic_events (
 namespace text not null,id text not null,school_id text not null,actor_id text not null,
 digest text not null,result jsonb not null,created_at timestamptz not null default now(),primary key(namespace,id)
);
alter table study_private.academic_batches enable row level security;
alter table study_private.academic_heads enable row level security;
alter table study_private.academic_occurrences enable row level security;
alter table study_private.academic_events enable row level security;
revoke all on study_private.academic_batches,study_private.academic_heads,study_private.academic_occurrences,study_private.academic_events from public,anon,authenticated;

create or replace function public.study_academic_stage(p_namespace text,p_school text,p_year text,p_id text,p_digest text,p_count integer,p_actor text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,study_private as $$
declare b study_private.academic_batches%rowtype;
begin
 insert into study_private.academic_batches(namespace,id,school_id,academic_year,digest,expected_count,created_by)
 values(p_namespace,p_id,p_school,p_year,p_digest,p_count,p_actor) on conflict do nothing;
 select * into b from study_private.academic_batches where namespace=p_namespace and id=p_id;
 if b.school_id<>p_school or b.digest<>p_digest or b.expected_count<>p_count then raise exception 'BATCH_CONFLICT' using errcode='40001';end if;
 return jsonb_build_object('id',b.id,'status',b.status);
end $$;
create or replace function public.study_academic_write(p_namespace text,p_school text,p_batch text,p_rows jsonb)
returns integer language plpgsql security definer set search_path=pg_catalog,study_private as $$
declare b study_private.academic_batches%rowtype;r jsonb;old jsonb;n integer=0;
begin
 select * into b from study_private.academic_batches where namespace=p_namespace and id=p_batch and school_id=p_school for update;
 if not found or b.status<>'draft' or jsonb_array_length(p_rows)>500 then raise exception 'INVALID_BATCH';end if;
 for r in select * from jsonb_array_elements(p_rows) loop
  if r->>'schoolId'<>p_school or r->>'batchId'<>p_batch or length(r->>'id')>512 or coalesce(r->>'classId','')='' then raise exception 'INVALID_SCOPE';end if;
  select data into old from study_private.academic_occurrences where namespace=p_namespace and batch_id=p_batch and id=r->>'id';
  if found and old<>r then raise exception 'ROW_CONFLICT' using errcode='40001';end if;
  insert into study_private.academic_occurrences(namespace,batch_id,id,school_id,class_id,teacher_id,group_id,lesson_date,revision,data)
   values(p_namespace,p_batch,r->>'id',p_school,r->>'classId',nullif(r->>'teacherId',''),nullif(r->>'groupId',''),(r->>'date')::date,coalesce((r->>'revision')::integer,1),r) on conflict do nothing;
  n=n+1;
 end loop;return n;
end $$;
create or replace function public.study_academic_activate(p_namespace text,p_school text,p_year text,p_batch text,p_previous text,p_actor text,p_previous_revision integer default 0)
returns jsonb language plpgsql security definer set search_path=pg_catalog,study_private as $$
declare b study_private.academic_batches%rowtype;previous text;actual integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_namespace||p_school||p_year,0));
 select batch_id into previous from study_private.academic_heads where namespace=p_namespace and school_id=p_school and academic_year=p_year;
 if previous=p_batch then return jsonb_build_object('active',true,'duplicate',true);end if;
 if previous is distinct from p_previous then raise exception 'HEAD_CONFLICT' using errcode='40001';end if;
 if previous is not null and (select mutation_revision from study_private.academic_batches where namespace=p_namespace and id=previous)<>p_previous_revision then raise exception 'PREVIEW_OUTDATED' using errcode='40001';end if;
 select * into b from study_private.academic_batches where namespace=p_namespace and id=p_batch and school_id=p_school for update;
 select count(*) into actual from study_private.academic_occurrences where namespace=p_namespace and batch_id=p_batch;
 if b.id is null or b.academic_year<>p_year or b.status<>'draft' or b.expected_count<>actual then raise exception 'INCOMPLETE_BATCH';end if;
 if previous is not null and exists(select 1 from study_private.academic_occurrences old where old.namespace=p_namespace and old.batch_id=previous and old.data->>'state'='taught' and not exists(select 1 from study_private.academic_occurrences fresh where fresh.namespace=p_namespace and fresh.batch_id=p_batch and fresh.id=old.id and fresh.data-'batchId'=old.data-'batchId')) then raise exception 'TAUGHT_HISTORY_PROTECTED';end if;
 update study_private.academic_batches set status='archived' where namespace=p_namespace and id=previous;
 update study_private.academic_batches set status='active' where namespace=p_namespace and id=p_batch;
 insert into study_private.academic_heads values(p_namespace,p_school,p_year,p_batch) on conflict(namespace,school_id,academic_year) do update set batch_id=excluded.batch_id;
 return jsonb_build_object('active',true,'batchId',p_batch,'rows',actual);
end $$;
create or replace function public.study_academic_list(p_namespace text,p_school text,p_year text,p_from date,p_to date,p_classes text[],p_teacher text,p_groups text[],p_after text default '',p_limit integer default 100)
returns jsonb language sql stable security definer set search_path=pg_catalog,study_private as $$
 with scoped as (
 select r.*,r.lesson_date::text||'T'||coalesce(r.data->>'startTime','')||'|'||r.id cursor_key
 from study_private.academic_occurrences r join study_private.academic_heads h on h.namespace=r.namespace and h.school_id=r.school_id and h.batch_id=r.batch_id and h.academic_year=p_year
 where r.namespace=p_namespace and r.school_id=p_school and r.lesson_date between p_from and p_to and p_to-p_from between 0 and 370
 and (p_classes is null or r.class_id=any(p_classes)) and (p_teacher is null or r.teacher_id=p_teacher)
 and (p_groups is null or r.group_id is null or r.group_id=any(p_groups))
 ), page as(select * from scoped where cursor_key>coalesce(p_after,'') order by cursor_key limit least(greatest(p_limit,1),500))
 select jsonb_build_object('batchId',(select batch_id from study_private.academic_heads where namespace=p_namespace and school_id=p_school and academic_year=p_year),'mutationRevision',coalesce((select b.mutation_revision from study_private.academic_batches b join study_private.academic_heads h on h.namespace=b.namespace and h.batch_id=b.id where b.namespace=p_namespace and h.school_id=p_school and h.academic_year=p_year),0),'total',(select count(*) from scoped),'rows',coalesce((select jsonb_agg(data order by cursor_key) from page),'[]'::jsonb),'next',(select max(cursor_key) from page))
$$;
create or replace function public.study_academic_get(p_namespace text,p_school text,p_year text,p_id text)
returns jsonb language sql stable security definer set search_path=pg_catalog,study_private as $$
 select r.data from study_private.academic_occurrences r join study_private.academic_heads h on h.namespace=r.namespace and h.school_id=r.school_id and h.batch_id=r.batch_id and h.academic_year=p_year where r.namespace=p_namespace and r.school_id=p_school and r.id=p_id
$$;
create or replace function public.study_academic_transition(p_namespace text,p_school text,p_year text,p_id text,p_revision integer,p_operation text,p_actor text,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,study_private as $$
declare old study_private.academic_occurrences%rowtype;e study_private.academic_events%rowtype;d text;updated jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_namespace||p_operation,1));
 d=md5(jsonb_build_array(p_school,p_year,p_id,p_revision,p_actor,p_patch)::text);
 select * into e from study_private.academic_events where namespace=p_namespace and id=p_operation;
 if found then if e.digest<>d then raise exception 'OPERATION_REUSED' using errcode='40001';end if;return e.result;end if;
 perform 1 from study_private.academic_heads where namespace=p_namespace and school_id=p_school and academic_year=p_year for share;
 if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('state','actualTopic','homework','note','materials','taughtAt','taughtBy','changeReason')) then raise exception 'INVALID_PATCH';end if;
 select r.* into old from study_private.academic_occurrences r join study_private.academic_heads h on h.namespace=r.namespace and h.school_id=r.school_id and h.batch_id=r.batch_id and h.academic_year=p_year where r.namespace=p_namespace and r.school_id=p_school and r.id=p_id for update of r;
 if not found then raise exception 'NOT_FOUND';end if;if old.revision<>p_revision then raise exception 'REVISION_CONFLICT' using errcode='40001';end if;
 if old.data->>'state' in ('taught','cancelled','replaced') then raise exception 'HISTORY_PROTECTED';end if;
 updated=old.data||p_patch||jsonb_build_object('revision',old.revision+1);
 update study_private.academic_occurrences set data=updated,revision=old.revision+1 where namespace=p_namespace and batch_id=old.batch_id and id=p_id;
 update study_private.academic_batches set mutation_revision=mutation_revision+1 where namespace=p_namespace and id=old.batch_id;
 insert into study_private.academic_events(namespace,id,school_id,actor_id,digest,result) values(p_namespace,p_operation,p_school,p_actor,d,jsonb_build_object('row',updated,'before',old.data));return jsonb_build_object('row',updated,'before',old.data);
end $$;

revoke all on function public.study_academic_stage(text,text,text,text,text,integer,text),public.study_academic_write(text,text,text,jsonb),public.study_academic_activate(text,text,text,text,text,text,integer),public.study_academic_list(text,text,text,date,date,text[],text,text[],text,integer),public.study_academic_get(text,text,text,text),public.study_academic_transition(text,text,text,text,integer,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.study_academic_stage(text,text,text,text,text,integer,text),public.study_academic_write(text,text,text,jsonb),public.study_academic_activate(text,text,text,text,text,text,integer),public.study_academic_list(text,text,text,date,date,text[],text,text[],text,integer),public.study_academic_get(text,text,text,text),public.study_academic_transition(text,text,text,text,integer,text,text,jsonb) to service_role;

create or replace function public.study_academic_progress(p_namespace text,p_school text,p_year text,p_classes text[],p_teacher text,p_groups text[])
returns jsonb language sql stable security definer set search_path=pg_catalog,study_private as $$
 select coalesce(jsonb_agg(x),'[]'::jsonb) from (
 select r.class_id "classId",r.data->>'classCode' "classCode",r.data->>'subject' subject,r.data->>'curriculumArea' "curriculumArea",r.group_id "groupId",
 count(*) slots,sum(coalesce((r.data->>'allocatedHours')::numeric,0)) "scheduledHours",
 sum(case when r.data->>'state'='taught' then coalesce((r.data->>'allocatedHours')::numeric,0) else 0 end) "taughtHours",
 count(*) filter(where r.data->>'state'='postponed') "postponed",count(*) filter(where r.data->>'state'='needs_review') "needsReview",
 min(r.lesson_date) filter(where r.data->>'state'<>'taught' and r.data->>'topicId' is not null) "nextDate",max(r.lesson_date) filter(where r.data->>'topicId' is not null) "expectedCompletion"
 from study_private.academic_occurrences r join study_private.academic_heads h on h.namespace=r.namespace and h.school_id=r.school_id and h.batch_id=r.batch_id and h.academic_year=p_year
 where r.namespace=p_namespace and r.school_id=p_school and (p_classes is null or r.class_id=any(p_classes)) and (p_teacher is null or r.teacher_id=p_teacher) and (p_groups is null or r.group_id is null or r.group_id=any(p_groups))
 group by r.class_id,r.data->>'classCode',r.data->>'subject',r.data->>'curriculumArea',r.group_id
 )x
$$;
create or replace function public.study_academic_replan(p_namespace text,p_school text,p_year text,p_operation text,p_actor text,p_reason text,p_changes jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,study_private as $$
declare e study_private.academic_events%rowtype;d text;b text;c jsonb;s jsonb;t jsonb;originals jsonb='{}';patches jsonb='{}';item record;result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_namespace||p_operation,1));
 d=md5(jsonb_build_array(p_school,p_year,p_actor,p_reason,p_changes)::text);select * into e from study_private.academic_events where namespace=p_namespace and id=p_operation;
 if found then if e.digest<>d then raise exception 'OPERATION_REUSED' using errcode='40001';end if;return e.result;end if;
 if length(p_reason)<12 or jsonb_array_length(p_changes) not between 1 and 300 then raise exception 'INVALID_REPLAN';end if;
 select batch_id into b from study_private.academic_heads where namespace=p_namespace and school_id=p_school and academic_year=p_year for update;
 if b is null then raise exception 'NOT_FOUND';end if;
 for item in select r.id,r.data from study_private.academic_occurrences r where r.namespace=p_namespace and r.school_id=p_school and r.batch_id=b and exists(select 1 from jsonb_array_elements(p_changes) v where r.id in(v->>'fromId',v->>'toId')) order by r.id for update loop
  originals=originals||jsonb_build_object(item.id,item.data);
 end loop;
 for c in select * from jsonb_array_elements(p_changes) loop
  s=originals->(c->>'fromId');t=originals->(c->>'toId');
  if s is null or t is null or s->>'state' in('taught','cancelled','replaced') or t->>'state' in('taught','cancelled','replaced') then raise exception 'HISTORY_PROTECTED';end if;
  if (s->>'revision')::integer<>(c->>'revision')::integer or (t->>'revision')::integer<>(c->>'targetRevision')::integer then raise exception 'REVISION_CONFLICT' using errcode='40001';end if;
  if s->>'classId'<>t->>'classId' or s->>'subject'<>t->>'subject' or s->>'quarter'<>t->>'quarter' or s->>'groupId' is distinct from t->>'groupId' or s->>'curriculumArea' is distinct from t->>'curriculumArea' then raise exception 'SCOPE_CONFLICT';end if;
  if patches ? (c->>'toId') then raise exception 'DUPLICATE_TARGET';end if;
  patches=patches||jsonb_build_object(c->>'toId',t||jsonb_build_object('topicId',s->'topicId','topicTitle',s->'topicTitle','topicPart',s->'topicPart','topicHours',s->'topicHours','allocatedHours',s->'allocatedHours','homework',s->'homework','allocations',s->'allocations','source',s->'source','originalDate',s->'originalDate','state','planned','revision',(t->>'revision')::integer+1));
 end loop;
 for c in select * from jsonb_array_elements(p_changes) loop
  if not patches ? (c->>'fromId') then s=originals->(c->>'fromId');patches=patches||jsonb_build_object(c->>'fromId',(s-'topicId'-'topicTitle'-'topicPart'-'topicHours'-'allocations'-'homework')||jsonb_build_object('allocatedHours',0,'state','postponed','revision',(s->>'revision')::integer+1));end if;
 end loop;
 for item in select key,value from jsonb_each(patches) loop update study_private.academic_occurrences set data=item.value,revision=(item.value->>'revision')::integer where namespace=p_namespace and batch_id=b and id=item.key;end loop;
 result=jsonb_build_object('changed',(select count(*) from jsonb_object_keys(patches)),'historyPreserved',true,'reason',p_reason,'before',originals,'after',patches);
 update study_private.academic_batches set mutation_revision=mutation_revision+1 where namespace=p_namespace and id=b;
 insert into study_private.academic_events(namespace,id,school_id,actor_id,digest,result)values(p_namespace,p_operation,p_school,p_actor,d,result);return result;
end $$;
revoke all on function public.study_academic_progress(text,text,text,text[],text,text[]),public.study_academic_replan(text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.study_academic_progress(text,text,text,text[],text,text[]),public.study_academic_replan(text,text,text,text,text,text,jsonb) to service_role;

create or replace function public.study_academic_preview(p_namespace text,p_school text,p_batch text,p_page integer,p_query text)
returns jsonb language sql stable security definer set search_path=pg_catalog,study_private as $$
 with matches as(select * from study_private.academic_occurrences r where r.namespace=p_namespace and r.school_id=p_school and r.batch_id=p_batch and (p_query='' or concat_ws(' ',r.data->>'classCode',r.data->>'subject',r.data->>'topicTitle',r.lesson_date::text) ilike '%'||left(p_query,100)||'%')),
 page as(select * from matches order by lesson_date,data->>'startTime',id limit 50 offset least(greatest(p_page,0),1200)*50)
 select jsonb_build_object('total',(select count(*) from matches),'rows',coalesce((select jsonb_agg(data order by lesson_date,data->>'startTime',id) from page),'[]'::jsonb))
$$;
create or replace function public.study_academic_receipt(p_namespace text,p_school text,p_actor text,p_operation text)
returns jsonb language sql stable security definer set search_path=pg_catalog,study_private as $$
 select result from study_private.academic_events where namespace=p_namespace and school_id=p_school and actor_id=p_actor and id=p_operation
$$;
revoke all on function public.study_academic_preview(text,text,text,integer,text),public.study_academic_receipt(text,text,text,text) from public,anon,authenticated;
grant execute on function public.study_academic_preview(text,text,text,integer,text),public.study_academic_receipt(text,text,text,text) to service_role;
