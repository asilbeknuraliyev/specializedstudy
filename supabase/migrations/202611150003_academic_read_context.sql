-- Bounded daily authorization context: no lesson/year curriculum or student roster download.
create or replace function public.study_read_academic_context(p_namespace text,p_user text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor jsonb;result jsonb='{}';value jsonb;revision uuid;wanted text;
begin
 select r.data into actor from study_private.runtime_records r where r.namespace=p_namespace and r.collection='users' and r.record_key=p_user;
 if actor is null then return null;end if;
 select n.revision into revision from study_private.runtime_namespaces n where n.namespace=p_namespace;
 select coalesce(jsonb_agg(r.data order by r.position),'[]'::jsonb) into value from study_private.runtime_records r where r.namespace=p_namespace and r.collection='users' and (r.record_key=p_user or r.institution_id=actor->>'institutionId' and r.data->>'role'='teacher');
 result=jsonb_build_object('users',value);
 foreach wanted in array array['classes','teacherAssignments','academicCalendars','academicTimetables','academicSchedules','academicGroups','subjectAliasReviews','leadershipGrants','mfaVerifiedSessions'] loop
  select coalesce(jsonb_agg(r.data order by r.position),'[]'::jsonb) into value from study_private.runtime_records r where r.namespace=p_namespace and r.collection=wanted and r.institution_id=actor->>'institutionId';
  result=result||jsonb_build_object(wanted,value);
 end loop;
 foreach wanted in array array['customClaims','revokedBeforeByUser'] loop
  select coalesce(jsonb_object_agg(r.record_key,r.data),'{}'::jsonb) into value from study_private.runtime_records r where r.namespace=p_namespace and r.collection=wanted and r.record_key=p_user;
  result=result||jsonb_build_object(wanted,value);
 end loop;
 select coalesce(jsonb_object_agg(r.record_key,r.data),'{}'::jsonb) into value from study_private.runtime_records r where r.namespace=p_namespace and r.collection='revokedSessionHashes';
 result=result||jsonb_build_object('revokedSessionHashes',value);
 return jsonb_build_object('state',result,'revision',revision,'readOnly',true);
end $$;
revoke all on function public.study_read_academic_context(text,text) from public,anon,authenticated;
grant execute on function public.study_read_academic_context(text,text) to service_role;
