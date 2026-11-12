# Enterprise release audit

Baseline: codex/learning-cycle-a 7ccf3fb; new branch codex/enterprise-school-release. Production baseline 4122490939d3bb6be21ad2dfa414a3dd7de20668 (dpl_4ZWW8gTA3JwZPRaUGxFtdixDb42V).

Latest user authorization covers all attached requirements, earlier unfinished work and production release. Graphify is explicitly disabled. Stage reports continue without requesting repeated approvals. School discipline policy remains an explicit human approval, distinct from deployment.

Existing: native/Google login, secure cookie sessions, account bulk creation, content import dry-run/undo, timetable, topic bank/tests/feedback, mistakes/review/progress, teacher item analysis, preview DEMO. Existing attendance/assignments/materials/support/report modules are legacy admin-oriented and require scoped teacher/student integration. Missing: discipline lifecycle, school approval configuration, pilot/evaluation/retention foundation, complete teacher workspace. Legacy attendance GET does not sufficiently scope school/class and POST is admin-only; replace with scoped compatibility routes and meaningful tests.

All new data uses schoolId/institutionId and the existing cloud persistence contract; lists paginate. Production data is backed up before release. DEMO stays in a separate preview namespace and is cleaned. Security tools: Strix exact plugin search returned no available plugin; no Strix scan will be claimed. Local/preview checks continue.

Requirement-by-requirement status is in requirements.json. Pending entries are not described as complete.
