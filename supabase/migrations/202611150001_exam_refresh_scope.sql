-- Include only this learner's session families for durable revocation checks.
-- Small, read-only authorization context for frequent exam autosaves. No curriculum snapshot is downloaded.
create or replace function public.study_read_exam_context(p_namespace text,p_user text,p_exam text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor jsonb; assessment jsonb; result jsonb; revision uuid; value jsonb;
begin
 select r.data into actor from study_private.runtime_records r where r.namespace=p_namespace and r.collection='users' and r.record_key=p_user;
 if actor is null or actor->>'role'<>'student' then return null; end if;
 select n.revision into revision from study_private.runtime_namespaces n where n.namespace=p_namespace;
 select r.data into assessment from study_private.runtime_records r where r.namespace=p_namespace and r.collection='assessments' and r.record_key=p_exam and r.institution_id=actor->>'institutionId';
 result:=jsonb_build_object('users',jsonb_build_array(actor),'assessments',case when assessment is null then '[]'::jsonb else jsonb_build_array(assessment) end,'passwordHashes','{}'::jsonb,'examSessions','[]'::jsonb);
 select coalesce(jsonb_agg(r.data order by r.position),'[]'::jsonb) into value from study_private.runtime_records r where r.namespace=p_namespace and r.collection='classes' and r.institution_id=actor->>'institutionId';
 result:=result||jsonb_build_object('classes',value);
 select coalesce(jsonb_agg(r.data order by r.position),'[]'::jsonb) into value from study_private.runtime_records r where r.namespace=p_namespace and r.collection='institutions' and r.record_key=actor->>'institutionId';
 result:=result||jsonb_build_object('institutions',value);
 select coalesce(jsonb_agg(r.data order by r.position),'[]'::jsonb) into value from study_private.runtime_records r where r.namespace=p_namespace and r.collection='questions' and r.record_key in (select jsonb_array_elements_text(coalesce(assessment->'questionIds','[]'::jsonb)));
 result:=result||jsonb_build_object('questions',value);
 select coalesce(jsonb_object_agg(r.record_key,r.data),'{}'::jsonb) into value from study_private.runtime_records r where r.namespace=p_namespace and r.collection='customClaims' and r.record_key=p_user;
 result:=result||jsonb_build_object('customClaims',value);
 select coalesce(jsonb_object_agg(r.record_key,r.data),'{}'::jsonb) into value from study_private.runtime_records r where r.namespace=p_namespace and r.collection='revokedBeforeByUser' and r.record_key=p_user;
 result:=result||jsonb_build_object('revokedBeforeByUser',value);
 select coalesce(jsonb_object_agg(r.record_key,r.data),'{}'::jsonb) into value from study_private.runtime_records r where r.namespace=p_namespace and r.collection='revokedSessionHashes';
 result:=result||jsonb_build_object('revokedSessionHashes',value);
 select coalesce(jsonb_agg(r.data order by r.position),'[]'::jsonb) into value from study_private.runtime_records r where r.namespace=p_namespace and r.collection='refreshSessions' and r.data->>'userId'=p_user;
 result:=result||jsonb_build_object('refreshSessions',value);
 return jsonb_build_object('state',result,'revision',revision,'readOnly',true);
end $$;
revoke all on function public.study_read_exam_context(text,text,text) from public,anon,authenticated;
grant execute on function public.study_read_exam_context(text,text,text) to service_role;


-- Encrypted import rows and one-time provisioning packets are server-only objects.
update storage.buckets set allowed_mime_types=array['image/png','image/jpeg','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream'] where id='study-private' and public=false;
