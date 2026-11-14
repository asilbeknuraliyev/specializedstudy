-- Application data is accessible only to the trusted backend. No browser role may read keys or grades directly.
create schema if not exists study_private;
revoke all on schema study_private from public, anon, authenticated;
grant usage on schema study_private to service_role;

create table study_private.runtime_namespaces (
 namespace text primary key check (namespace = '_specialized_runtime' or namespace ~ '^_specialized_preview_[a-z0-9_]{1,40}$'),
 revision uuid not null default gen_random_uuid(),
 layout jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create table study_private.runtime_records (
 namespace text not null references study_private.runtime_namespaces(namespace),
 collection text not null check (collection ~ '^[a-zA-Z][a-zA-Z0-9_]{0,79}$'),
 record_key text not null check (length(record_key) between 1 and 256),
 position integer not null default 0,
 data jsonb not null,
 institution_id text generated always as (coalesce(data->>'institutionId',data->>'schoolId')) stored,
 student_id text generated always as (data->>'studentId') stored,
 primary key(namespace,collection,record_key)
);
create index runtime_records_school on study_private.runtime_records(namespace,collection,institution_id);
create index runtime_records_student on study_private.runtime_records(namespace,collection,student_id);
create table study_private.exam_sessions (
 namespace text not null references study_private.runtime_namespaces(namespace),
 session_key text not null check (session_key ~ '^[a-f0-9]{64}$'),
 version bigint not null default 1,
 data jsonb not null,
 school_id text generated always as (data->>'institutionId') stored,
 exam_id text generated always as (data->>'assessmentId') stored,
 student_id text generated always as (data->>'studentId') stored,
 updated_at timestamptz not null default now(),
 primary key(namespace,session_key),
 unique(namespace,school_id,exam_id,student_id)
);
create index exam_sessions_exam on study_private.exam_sessions(namespace,school_id,exam_id,session_key);
create table study_private.media (
 namespace text not null references study_private.runtime_namespaces(namespace),
 id text not null check (id ~ '^[a-f0-9]{64}$'),
 school_id text not null,
 mime text not null check(mime in ('image/png','image/jpeg','image/webp')),
 object_path text not null,
 size_bytes integer not null check(size_bytes between 1 and 25000000),
 primary key(namespace,id)
);
alter table study_private.runtime_namespaces enable row level security;
alter table study_private.runtime_records enable row level security;
alter table study_private.exam_sessions enable row level security;
alter table study_private.media enable row level security;
grant select,insert,update,delete on all tables in schema study_private to service_role;

create or replace function public.study_read_state(p_namespace text, p_collections text[] default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n study_private.runtime_namespaces; item record; value jsonb; result jsonb := '{}'::jsonb;
begin
 select * into n from study_private.runtime_namespaces where namespace=p_namespace;
 if not found then raise exception using errcode='P0002',message='Runtime namespace not initialized'; end if;
 for item in select e.key,e.value from jsonb_each_text(n.layout) e loop
  if p_collections is not null and not(item.key=any(p_collections)) then continue; end if;
  if item.value='array' then
   select coalesce(jsonb_agg(r.data order by r.position,r.record_key),'[]'::jsonb) into value from study_private.runtime_records r where r.namespace=p_namespace and r.collection=item.key;
  elsif item.value='object' then
   select coalesce(jsonb_object_agg(r.record_key,r.data),'{}'::jsonb) into value from study_private.runtime_records r where r.namespace=p_namespace and r.collection=item.key;
  else
   select r.data into value from study_private.runtime_records r where r.namespace=p_namespace and r.collection=item.key and r.record_key='$';
  end if;
  result:=result||jsonb_build_object(item.key,value);
 end loop;
 return jsonb_build_object('state',result,'revision',n.revision);
end $$;

create or replace function public.study_state_version(p_namespace text)
returns uuid language sql stable security definer set search_path = '' as $$
 select revision from study_private.runtime_namespaces where namespace=p_namespace;
$$;

create or replace function public.study_write_state(p_namespace text,p_expected_revision uuid,p_layout jsonb,p_changes jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_revision uuid; next_revision uuid := gen_random_uuid(); item jsonb;
begin
 if p_namespace <> '_specialized_runtime' and p_namespace !~ '^_specialized_preview_[a-z0-9_]{1,40}$' then raise exception 'Invalid namespace'; end if;
 if jsonb_typeof(p_layout)<>'object' or jsonb_typeof(p_changes)<>'array' or jsonb_array_length(p_changes)>20000 then raise exception 'Invalid write'; end if;
 -- Namespace lock protects multi-record invariants. Exam autosaves use a separate per-learner CAS below.
 perform pg_advisory_xact_lock(hashtextextended(p_namespace,0));
 select revision into current_revision from study_private.runtime_namespaces where namespace=p_namespace for update;
 if current_revision is distinct from p_expected_revision then raise exception using errcode='40001',message='PERSISTENCE_CONFLICT'; end if;
 if current_revision is null then insert into study_private.runtime_namespaces(namespace,revision,layout) values(p_namespace,next_revision,p_layout); end if;
 for item in select value from jsonb_array_elements(p_changes) loop
  if coalesce((item->>'deleted')::boolean,false) then
   delete from study_private.runtime_records where namespace=p_namespace and collection=item->>'collection' and record_key=item->>'key';
  else
   insert into study_private.runtime_records(namespace,collection,record_key,position,data)
   values(p_namespace,item->>'collection',item->>'key',coalesce((item->>'position')::integer,0),item->'data')
   on conflict(namespace,collection,record_key) do update set data=excluded.data,position=excluded.position;
  end if;
 end loop;
 update study_private.runtime_namespaces set revision=next_revision,layout=p_layout,updated_at=now() where namespace=p_namespace;
 return next_revision;
end $$;

create or replace function public.study_read_exam(p_namespace text,p_key text)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('session',data,'version',version) from study_private.exam_sessions where namespace=p_namespace and session_key=p_key;
$$;
create or replace function public.study_write_exam(p_namespace text,p_key text,p_expected_version bigint,p_session jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare current_version bigint; next_version bigint;
begin
 if octet_length(p_session::text)>8500000 then raise exception 'Exam exceeds safe bound'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_namespace||':'||p_key,0));
 select version into current_version from study_private.exam_sessions where namespace=p_namespace and session_key=p_key for update;
 if coalesce(current_version,0)<>p_expected_version then raise exception using errcode='40001',message='EXAM_CONFLICT'; end if;
 next_version:=coalesce(current_version,0)+1;
 insert into study_private.exam_sessions(namespace,session_key,data,version) values(p_namespace,p_key,p_session,next_version)
 on conflict(namespace,session_key) do update set data=excluded.data,version=excluded.version,updated_at=now();
 return next_version;
end $$;
create or replace function public.study_list_exams(p_namespace text,p_school text,p_exam text,p_after text default '')
returns jsonb language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object('key',session_key,'session',data) order by session_key),'[]'::jsonb)
 from (select session_key,data from study_private.exam_sessions where namespace=p_namespace and school_id=p_school and exam_id=p_exam and session_key>p_after order by session_key limit 50) s;
$$;
create or replace function public.study_delete_exam_fixture(p_namespace text,p_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if p_namespace !~ '^_specialized_preview_[a-z0-9_]{1,40}$' then raise exception 'Preview fixture cleanup only'; end if;
 delete from study_private.exam_sessions where namespace=p_namespace and session_key=p_key;
end $$;
create or replace function public.study_media_index(p_namespace text,p_id text,p_data jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 if p_data is not null then
  insert into study_private.media(namespace,id,school_id,mime,object_path,size_bytes) values(p_namespace,p_id,p_data->>'schoolId',p_data->>'mime',p_data->>'path',(p_data->>'size')::integer)
  on conflict(namespace,id) do nothing;
 end if;
 select jsonb_build_object('institutionId',school_id,'mime',mime,'path',object_path,'size',size_bytes) into result from study_private.media where namespace=p_namespace and id=p_id;
 return result;
end $$;

-- PostgreSQL grants EXECUTE to PUBLIC by default: revoke it explicitly on every application RPC.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'study\_%' escape '\' loop
  execute format('revoke all on function %s from public, anon, authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('study-private','study-private',false,25000000,array['image/png','image/jpeg','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do nothing;
