# Specialized Study — enterprise release

Release date: 2026-11-13. Requested primary address: https://specializedschool.vercel.app. Repository: asilbeknuraliyev/specializedstudy, branch codex/enterprise-school-release. Previous A/B/C learning-cycle changes are included. No Graphify or Strix was used for this release.

## Delivered behavior

- Teacher workspace: assigned classes and subject, today's schedule, per-lesson attendance, work plans and searchable/paged lessons, materials, assignments, draft/submission/revision, human grading with reusable feedback, learner 360 overview, progress, support plans, announcements, scoped monthly Excel reports and own BSB/CHSB controls. Account creation, class assignment and password reset remain administrator actions.
- Discipline: configurable neutral categories; school policy approval; periods and archive; draft/review/approval/cancellation; immutable audit and corrections; deduplicated threshold cases; human conversation/contact records; learner comments and appeals; human-approved warning letters and PDF/Excel export. Positive support stays separate. Reaching a threshold opens a human review; it never automatically expels or punishes a learner. The production policy starts unapproved; release authorization is not school policy approval.
- Admin: real school counters, account/profile/class assignment, content import and coverage, timetable conflicts, assessments, written-work queue, pilot evidence, retention/deletion review, audit/JSON export and runtime status. Existing bulk content dry-run, numbered error rows, valid-only commit, undo and Excel templates are retained.
- Student: mobile dashboard, subjects/roadmap, school-delivered progress separate from demonstrated mastery, assignments, attendance, personal teacher feedback, fullscreen formal assessments, topic tests, mistakes and spaced repetition, finite practice/flashcards, scoped notifications, respectful discipline/appeals and optional learning consent.
- Formal results: submit, duplicate/replay and state responses use a student allowlist. BSB/CHSB keys, explanations, rubrics and AI suggestions are withheld. Teacher grading produces a human result; ordinary topic/practice feedback remains available. AI routes authenticate and authorize authoritative stored attempts; anonymous and foreign-student access is rejected. Learning answers are not sent to an external model by the student fallback route.
- Persistence: existing private Firestore runtime store, compressed immutable chunks, compare-and-swap revisions and bounded request/error monitoring. Preview namespace is separate from production. Double-clicks/retries use operation IDs; stale edits get an explicit conflict and preserve the user's form.
- Notifications cover assignments/deadlines, exam start/schedule, grading, announcements, support and discipline/appeals. Scheduled deadline notices are delivered when the user next loads/polls the site; these are not OS push messages or email.
- Optional pilot: immutable test version, non-overlapping pre/post windows, distinct groups of at least five, consent and explicit school permission, first paired attempt in each window, n<5 suppression, audited aggregate export. Observed differences do not establish causal effects.
- Deletion: learner request → admin dry-run → exact typed confirmation. Only optional learning history is removed, derived cohorts are rebuilt, small groups are suppressed, and official grades/attendance/discipline stay intact.

## Verification and evidence

TypeScript lint and production build passed. The full unit suite passed 132 tests; the later targeted new-domain redirect test passed one additional test, and two native bundled-server/JWKS smoke tests passed. Meaningful tests cover scoped roles/classes/schools, duplicate writes, stale grading, discipline thresholds/appeals/audit, privacy allowlists and AI access, pilot consent/pairing, deletion/cohort recomputation, notification timing/cancellation, lesson pagination beyond 100 and safe DEMO cleanup.

Isolated preview browser records and actual screenshots/downloads are in `outputs/enterprise` outside the repository: `browser.json`, `final-browser.json`, `pilot-browser.json`. They exercise native login and secure cookies, 375px/1440px screens, offline retry and double-click, actual two-page PDF BSB import with name/date/class headers excluded, student submission and human grading, hidden-key results, instrumented third-exit stop, flashcards, consent, pilot form/export and deletion dry-run/confirmation. API exit events are explicitly instrumented; they are not a claim that a headless browser prevents operating-system switching or another device.

The 558 extracted source lines remain in `requirements.json`, with group evidence and explicit adaptations. Group review does not mean 558 separately passing tests. Required school decisions are not fabricated.

## Practical limits

- No system is guaranteed unhackable. No external pentest was run: the user explicitly cancelled Strix. Dependency audit has no high/critical production finding but retains four moderate transitive findings under firebase-admin/google-gax. No risky forced major upgrade was applied.
- Import retains the source image and requires human review of variants, answer keys and written rubrics before publication. An unmeasured universal “2% error” promise is not made. Scanned or unusual source layouts still need administrator review.
- Initial JS is about 494KB / 145KB gzip, down from roughly 953KB / 285KB. Observed first teacher navigation was 3808ms; warm workspace/admin APIs were 325/405ms. These measurements are not a cold-start SLA or a whole-school load test.
- Lists and exports have explicit bounds. Lesson search pages through the whole authorized catalog; the learner map uses a bounded snapshot. Runtime counters reset with the server instance and are not Firebase daily quota or billing figures.
- Practice modes named Topic Battle/Class Quiz reuse personal bank-backed practice; no real-time multiplayer competition or public ranking. Optional weekly unattended delivery and offline installable PWA were evaluated and not selected. Responsive mobile web, on-demand/monthly exports and safe network retry are available.
- Admin JSON export excludes passwords/secrets and is a management-data export, not a self-service full database restore. Full operator backup is private; restoration requires an explicit maintenance operation.
- A structured keyboard/mobile review was performed; full WCAG certification, every browser/device and nationwide scale have not been certified.

## Release and rollback

The production store was read-only backed up before release. Snapshot SHA-256: `85b77c3b87714811b48c70b3a8fd15fc7d9158dae3e7358351d8913a09957baf`. Sensitive backup stays ignored locally and is never committed. Existing production SESSION_SECRET and Firebase service account are preserved. No DEMO snapshot is promoted or copied.

New production must be a fresh production-environment build, with `_specialized_runtime`; preview uses `_specialized_preview_enterprise`. A runtime guard rejects environment/namespace mismatch. Firebase authorizedDomains adds only `specializedschool.vercel.app`, preserving previous entries. New-domain Google sign-in uses Firebase's popup flow with its registered firebaseapp.com auth handler; it does not assume a newly registered OAuth redirect URI.

The old domain redirects to the requested new primary domain at the Vercel edge. The server's canonical API origin uses the same new domain, with a targeted no-loop/path/query test. Reference: [Vercel conditional redirects](https://vercel.com/docs/project-configuration/vercel-json), [Firebase external-hosting popup guidance](https://firebase.google.com/docs/auth/web/redirect-best-practices).

Rollback code target: `dpl_4ZWW8gTA3JwZPRaUGxFtdixDb42V` (previous production). Rollback changes serving code; it must not overwrite live school data with preview fixtures or an old snapshot. Deployment IDs, final anonymous checks and data-preservation result are recorded in the release evidence when the build is ready.
