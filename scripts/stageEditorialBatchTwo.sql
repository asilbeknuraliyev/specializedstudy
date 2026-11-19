-- Reserve one bounded batch from verified staging mappings.
-- Source IDs stay attached while editorial material and generation configuration are reviewed.
with mapped as (
  select distinct on (s.school_id, s.topic_id)
    s.namespace, s.school_id, s.academic_year, s.source_id, s.topic_id,
    s.payload->>'subject' as subject
  from study_private.curriculum_source_rows s
  where s.namespace = '_specialized_preview_ss2_sprint1'
    and s.academic_year = '2026-2027'
    and s.eligible and s.subject_id is not null and cardinality(s.class_ids) > 0
    and not exists (
      select 1
      from study_private.content_jobs j
      join study_private.curriculum_source_rows used
        using (namespace, school_id, academic_year, source_id)
      where j.namespace = s.namespace and j.school_id = s.school_id
        and j.academic_year = s.academic_year and used.topic_id = s.topic_id
        and j.id not like 'editorial-batch-2-%'
    )
  order by s.school_id, s.topic_id, s.source_id
), ranked as (
  select mapped.*, row_number() over (
    partition by school_id, subject order by topic_id
  ) as subject_position
  from mapped
), selected as (
  select * from ranked order by subject_position, subject, topic_id limit 100
), inserted as (
  insert into study_private.content_jobs (
    namespace, school_id, academic_year, id, source_id, lesson_id, status, error_code
  )
  select namespace, school_id, academic_year, 'editorial-batch-2-' || topic_id,
    source_id, 'pilot30-lesson-' || source_id, 'needs_source', 'GENERATOR_NOT_CONFIGURED'
  from selected
  where not exists (
    select 1 from study_private.content_jobs existing
    where existing.namespace = selected.namespace and existing.school_id = selected.school_id
      and existing.id like 'editorial-batch-2-%'
  )
  on conflict (namespace, school_id, id) do nothing
  returning id
)
select count(*) as queued_for_source_review from inserted;
