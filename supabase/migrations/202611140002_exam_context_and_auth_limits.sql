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
 return jsonb_build_object('state',result,'revision',revision,'readOnly',true);
end $$;
revoke all on function public.study_read_exam_context(text,text,text) from public,anon,authenticated;
grant execute on function public.study_read_exam_context(text,text,text) to service_role;

create table study_private.auth_rate_buckets(namespace text not null,bucket_key text not null check(length(bucket_key)=64),window_start timestamptz not null,count integer not null,primary key(namespace,bucket_key));
alter table study_private.auth_rate_buckets enable row level security;
grant select,insert,update,delete on study_private.auth_rate_buckets to service_role;
create or replace function public.study_auth_rate_limit(p_namespace text,p_key text,p_limit integer,p_window_ms integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare current_count integer; stamp timestamptz:=clock_timestamp();
begin
 if p_limit not between 1 and 1000 or p_window_ms not between 1000 and 3600000 then raise exception 'Invalid rate limit'; end if;
 insert into study_private.auth_rate_buckets(namespace,bucket_key,window_start,count) values(p_namespace,p_key,stamp,1)
 on conflict(namespace,bucket_key) do update set
 count=case when auth_rate_buckets.window_start <= stamp-p_window_ms*interval '1 millisecond' then 1 else auth_rate_buckets.count+1 end,
 window_start=case when auth_rate_buckets.window_start <= stamp-p_window_ms*interval '1 millisecond' then stamp else auth_rate_buckets.window_start end
 returning count into current_count;
 return current_count<=p_limit;
end $$;
revoke all on function public.study_auth_rate_limit(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.study_auth_rate_limit(text,text,integer,integer) to service_role;
