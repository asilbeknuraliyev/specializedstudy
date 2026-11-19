create table study_private.content_job_actions (
  namespace text not null,
  school_id text not null,
  job_id text not null,
  actor_id text not null,
  action text not null check(action in ('pause','resume','retry')),
  happened_at timestamptz not null default now(),
  foreign key(namespace,school_id,job_id) references study_private.content_jobs(namespace,school_id,id)
);
alter table study_private.content_job_actions enable row level security;
revoke all on study_private.content_job_actions from public,anon,authenticated;

create function public.study_content_job_list(p_namespace text,p_school text,p_year text)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (
    select j.id,j.status,j.attempts,j.error_code,s.payload->>'subject' subject,s.payload->>'title' topic
    from study_private.content_jobs j join study_private.curriculum_source_rows s
      on s.namespace=j.namespace and s.school_id=j.school_id and s.academic_year=j.academic_year and s.source_id=j.source_id
    where j.namespace=p_namespace and j.school_id=p_school and j.academic_year=p_year
    order by j.updated_at desc,j.id
    limit 25
  ) x;
$$;

create function public.study_content_job_action(p_namespace text,p_school text,p_year text,p_id text,p_action text,p_actor text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare next_status text;
begin
  if p_namespace !~ '^_specialized_preview_[a-z0-9_]{1,40}$' or p_action not in ('pause','resume','retry') then
    raise exception 'INVALID_ACTION';
  end if;
  update study_private.content_jobs
  set status=case when p_action='pause' then 'paused' else 'pending' end,
    error_code=case when p_action='retry' then null else error_code end,updated_at=now()
  where namespace=p_namespace and school_id=p_school and academic_year=p_year and id=p_id
   and ((p_action='pause' and status='pending') or
        (p_action='resume' and status='paused' and attempts<3) or
        (p_action='retry' and status='failed' and attempts<3))
  returning status into next_status;
  if next_status is null then return jsonb_build_object('updated',false); end if;
  insert into study_private.content_job_actions(namespace,school_id,job_id,actor_id,action)
   values(p_namespace,p_school,p_id,p_actor,p_action);
  return jsonb_build_object('updated',true,'status',next_status);
end;
$$;
revoke all on function public.study_content_job_list(text,text,text),public.study_content_job_action(text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.study_content_job_list(text,text,text),public.study_content_job_action(text,text,text,text,text,text) to service_role;
