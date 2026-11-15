-- Keep target slot provenance while moving only curriculum provenance.
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
  patches=patches||jsonb_build_object(c->>'toId',t||jsonb_build_object('topicId',s->'topicId','topicTitle',s->'topicTitle','topicPart',s->'topicPart','topicHours',s->'topicHours','allocatedHours',s->'allocatedHours','homework',s->'homework','allocations',s->'allocations','source',coalesce(t->'source','{}'::jsonb)||jsonb_build_object('planId',s->'source'->'planId','topicRow',s->'source'->'topicRow'),'originalDate',s->'originalDate','state','planned','revision',(t->>'revision')::integer+1));
 end loop;
 for c in select * from jsonb_array_elements(p_changes) loop
  if not patches ? (c->>'fromId') then s=originals->(c->>'fromId');patches=patches||jsonb_build_object(c->>'fromId',(s-'topicId'-'topicTitle'-'topicPart'-'topicHours'-'allocations'-'homework')||jsonb_build_object('allocatedHours',0,'state','postponed','revision',(s->>'revision')::integer+1));end if;
 end loop;
 for item in select key,value from jsonb_each(patches) loop update study_private.academic_occurrences set data=item.value,revision=(item.value->>'revision')::integer where namespace=p_namespace and batch_id=b and id=item.key;end loop;
 result=jsonb_build_object('changed',(select count(*) from jsonb_object_keys(patches)),'historyPreserved',true,'reason',p_reason,'before',originals,'after',patches);
 update study_private.academic_batches set mutation_revision=mutation_revision+1 where namespace=p_namespace and id=b;
 insert into study_private.academic_events(namespace,id,school_id,actor_id,digest,result)values(p_namespace,p_operation,p_school,p_actor,d,result);return result;
end $$;
revoke all on function public.study_academic_replan(text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.study_academic_replan(text,text,text,text,text,text,jsonb) to service_role;
