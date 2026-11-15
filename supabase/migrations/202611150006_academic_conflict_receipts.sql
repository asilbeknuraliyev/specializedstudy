-- Expected CAS/history conflicts are typed receipts. No partial mutation is committed.
create or replace function public.study_academic_activate(p_namespace text,p_school text,p_year text,p_batch text,p_previous text,p_actor text,p_previous_revision integer default 0)
returns jsonb language plpgsql security definer set search_path=pg_catalog,study_private as $$
declare b study_private.academic_batches%rowtype;previous text;actual integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_namespace||p_school||p_year,0));
 select batch_id into previous from study_private.academic_heads where namespace=p_namespace and school_id=p_school and academic_year=p_year;
 if previous=p_batch then return jsonb_build_object('active',true,'duplicate',true);end if;
 if previous is distinct from p_previous then return jsonb_build_object('_studyError','HEAD_CONFLICT');end if;
 if previous is not null and (select mutation_revision from study_private.academic_batches where namespace=p_namespace and id=previous)<>p_previous_revision then return jsonb_build_object('_studyError','PREVIEW_OUTDATED');end if;
 select * into b from study_private.academic_batches where namespace=p_namespace and id=p_batch and school_id=p_school for update;
 select count(*) into actual from study_private.academic_occurrences where namespace=p_namespace and batch_id=p_batch;
 if b.id is null or b.academic_year<>p_year or b.status<>'draft' or b.expected_count<>actual then return jsonb_build_object('_studyError','INCOMPLETE_BATCH');end if;
 if previous is not null and exists(select 1 from study_private.academic_occurrences old where old.namespace=p_namespace and old.batch_id=previous and old.data->>'state'='taught' and not exists(select 1 from study_private.academic_occurrences fresh where fresh.namespace=p_namespace and fresh.batch_id=p_batch and fresh.id=old.id and fresh.data-'batchId'=old.data-'batchId')) then return jsonb_build_object('_studyError','TAUGHT_HISTORY_PROTECTED');end if;
 update study_private.academic_batches set status='archived' where namespace=p_namespace and id=previous;
 update study_private.academic_batches set status='active' where namespace=p_namespace and id=p_batch;
 insert into study_private.academic_heads values(p_namespace,p_school,p_year,p_batch) on conflict(namespace,school_id,academic_year) do update set batch_id=excluded.batch_id;
 return jsonb_build_object('active',true,'batchId',p_batch,'rows',actual);
end $$;
create or replace function public.study_academic_transition(p_namespace text,p_school text,p_year text,p_id text,p_revision integer,p_operation text,p_actor text,p_patch jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,study_private as $$
declare old study_private.academic_occurrences%rowtype;e study_private.academic_events%rowtype;d text;updated jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_namespace||p_operation,1));
 d=md5(jsonb_build_array(p_school,p_year,p_id,p_revision,p_actor,p_patch)::text);
 select * into e from study_private.academic_events where namespace=p_namespace and id=p_operation;
 if found then if e.digest<>d then return jsonb_build_object('_studyError','OPERATION_REUSED');end if;return e.result;end if;
 perform 1 from study_private.academic_heads where namespace=p_namespace and school_id=p_school and academic_year=p_year for share;
 if exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('state','actualTopic','homework','note','materials','taughtAt','taughtBy','changeReason')) then return jsonb_build_object('_studyError','INVALID_PATCH');end if;
 select r.* into old from study_private.academic_occurrences r join study_private.academic_heads h on h.namespace=r.namespace and h.school_id=r.school_id and h.batch_id=r.batch_id and h.academic_year=p_year where r.namespace=p_namespace and r.school_id=p_school and r.id=p_id for update of r;
 if not found then return jsonb_build_object('_studyError','NOT_FOUND');end if;if old.revision<>p_revision then return jsonb_build_object('_studyError','REVISION_CONFLICT');end if;
 if old.data->>'state' in ('taught','cancelled','replaced') then return jsonb_build_object('_studyError','HISTORY_PROTECTED');end if;
 updated=old.data||p_patch||jsonb_build_object('revision',old.revision+1);
 update study_private.academic_occurrences set data=updated,revision=old.revision+1 where namespace=p_namespace and batch_id=old.batch_id and id=p_id;
 update study_private.academic_batches set mutation_revision=mutation_revision+1 where namespace=p_namespace and id=old.batch_id;
 insert into study_private.academic_events(namespace,id,school_id,actor_id,digest,result) values(p_namespace,p_operation,p_school,p_actor,d,jsonb_build_object('row',updated,'before',old.data));return jsonb_build_object('row',updated,'before',old.data);
end $$;
create or replace function public.study_academic_replan(p_namespace text,p_school text,p_year text,p_operation text,p_actor text,p_reason text,p_changes jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,study_private as $$
declare e study_private.academic_events%rowtype;d text;b text;c jsonb;s jsonb;t jsonb;originals jsonb='{}';patches jsonb='{}';item record;result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_namespace||p_operation,1));
 d=md5(jsonb_build_array(p_school,p_year,p_actor,p_reason,p_changes)::text);select * into e from study_private.academic_events where namespace=p_namespace and id=p_operation;
 if found then if e.digest<>d then return jsonb_build_object('_studyError','OPERATION_REUSED');end if;return e.result;end if;
 if length(p_reason)<12 or jsonb_array_length(p_changes) not between 1 and 300 then return jsonb_build_object('_studyError','INVALID_REPLAN');end if;
 select batch_id into b from study_private.academic_heads where namespace=p_namespace and school_id=p_school and academic_year=p_year for update;
 if b is null then return jsonb_build_object('_studyError','NOT_FOUND');end if;
 for item in select r.id,r.data from study_private.academic_occurrences r where r.namespace=p_namespace and r.school_id=p_school and r.batch_id=b and exists(select 1 from jsonb_array_elements(p_changes) v where r.id in(v->>'fromId',v->>'toId')) order by r.id for update loop
  originals=originals||jsonb_build_object(item.id,item.data);
 end loop;
 for c in select * from jsonb_array_elements(p_changes) loop
  s=originals->(c->>'fromId');t=originals->(c->>'toId');
  if s is null or t is null or s->>'state' in('taught','cancelled','replaced') or t->>'state' in('taught','cancelled','replaced') then return jsonb_build_object('_studyError','HISTORY_PROTECTED');end if;
  if (s->>'revision')::integer<>(c->>'revision')::integer or (t->>'revision')::integer<>(c->>'targetRevision')::integer then return jsonb_build_object('_studyError','REVISION_CONFLICT');end if;
  if s->>'classId'<>t->>'classId' or s->>'subject'<>t->>'subject' or s->>'quarter'<>t->>'quarter' or s->>'groupId' is distinct from t->>'groupId' or s->>'curriculumArea' is distinct from t->>'curriculumArea' then return jsonb_build_object('_studyError','SCOPE_CONFLICT');end if;
  if patches ? (c->>'toId') then return jsonb_build_object('_studyError','DUPLICATE_TARGET');end if;
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
revoke all on function public.study_academic_activate(text,text,text,text,text,text,integer),public.study_academic_transition(text,text,text,text,integer,text,text,jsonb),public.study_academic_replan(text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.study_academic_activate(text,text,text,text,text,text,integer),public.study_academic_transition(text,text,text,text,integer,text,text,jsonb),public.study_academic_replan(text,text,text,text,text,text,jsonb) to service_role;
