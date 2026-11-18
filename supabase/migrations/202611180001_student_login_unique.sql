-- Existing non-SPS legacy identifiers are reconciled by the approved account import.
create unique index if not exists runtime_school_student_login_unique
on study_private.runtime_records (namespace, lower(data->>'login'))
where collection = 'users' and lower(data->>'login') ~ '^sps[0-9]{7}$';
