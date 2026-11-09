# Technical audit — 2026-11-05

## Baseline
Existing substantial React/TypeScript/Vite application, Express API, Firebase SDKs, Tailwind, custom HMAC sessions, Gemini integration and spreadsheet import utilities. Admin/student pages, curriculum, assessment, attendance, assignments, materials and reporting have implementations. Presence of code is not proof of operational readiness; authenticated end-to-end flows remain unverified.

## Confirmed blockers and first changes
- App.tsx contained JSX inside a truncated import and no valid route guard. Restored imports and a guard with authentication loading and account-status checks.
- Frontend could fabricate an admin profile and fb-direct token when backend sync failed. Removed this fallback; backend failure now fails closed.
- Firestore allowed authorized emails without a platformAdmin claim; Storage omitted the claim. Both now require it.
- ID-token verification inherited local database claims and fell back after Admin SDK failure. Real tokens now require Admin SDK verification including revocation; local claims no longer supplement real tokens.
- Admin Firebase sync now treats missing claims as pending instead of automatically granting access. Explicit trusted provisioning remains necessary.
- Request headers could select test mode; reset route was public. Test mode/reset now require NODE_ENV=test; test sessions are rejected outside test mode.
- Public hard-coded session signing secret replaced with a production configuration requirement and ephemeral development secret.
- Vite 8 and directly declared esbuild 0.25 had an npm peer conflict. Updated esbuild to its required compatible range.
- Simplified landing copy, increased headline hierarchy, corrected cross-page section links and added keyboard focus styling.

## Remaining work before release
1. Backend JSON state (.data, with /tmp fallback) is not durable across Vercel instances. Migrate through a versioned repository layer to Firestore transactions after backup/export and reconciliation. Do not swap storage without preserving real data.
2. Legacy password/bootstrap/admin provisioning and profile-derived authorization still require a full migration to trusted Firebase sessions. Existing custom sessions do not continuously check revoked Firebase claims. Provisioning must fail if Firebase claim assignment fails.
3. Broad CORS allowlists, localStorage sessions, process-local revocation/rate limiting and Storage resource scope need dedicated review.
4. Large files (server.ts, LearnOSContext, ParentAndAdminPages) need staged domain extraction. Several routes are aliases to unrelated pages, not separate implemented modules.
5. Import coverage for PDF/DOCX, AI draft review, concurrency, attempt deadlines, grading and student isolation require behavior tests with real-format sanitized fixtures.
6. School seed metadata refers to a different location; reconcile actual institution metadata rather than overwriting existing data.
7. Firebase Emulator rules tests, authenticated desktop/mobile UI checks and integration suites are not yet verified. Do not describe the app as production-ready.

## Configuration
Set a cryptographically random SESSION_SECRET (at least 32 characters), APP_URL and server-only GEMINI_API_KEY. Firebase Admin requires Application Default Credentials with correct project/IAM permissions; local development may use GOOGLE_APPLICATION_CREDENTIALS pointing outside the repository. Never commit credential JSON. Deploy new rules only after provisioning the two verified administrators and running emulator tests; old email-only access will intentionally stop working.

Reference: https://firebase.google.com/docs/auth/admin/custom-claims

## Verification of this change
- npm run lint: passed (TypeScript noEmit).
- npm run build: passed; output JavaScript approximately 2.37 MB before gzip; code splitting remains necessary.
- npm run test:unit: 31 passed, 0 failed, including 3 new mocked Firebase verification regressions. These do not replace live Firebase or emulator testing.
- npm audit: 16 findings (11 moderate, 5 high); Firebase/grpc dependency chain and xlsx are among high findings. No forced major downgrade was applied. The report counts affected packages, not necessarily distinct vulnerabilities.
- Browser preview server started, but in-app browser timed out. Visual/mobile verification remains incomplete.
- No deployment, remote push, database changes or Firebase rules deployment performed.
## Curriculum interface update
- Replaced the default work-plan screen with a compact upload/preview/publish center. Legacy single-file tools remain available under additional actions.
- Uploaded archive bytes are carried from preview into confirmation; the former official-archive substitution bug was corrected in both interfaces.
- New student lesson reader scopes published lessons by assigned class, academic year and approved T-track visibility, with subjects, quarters, search, source references and separate classwork/homework.
- Administrator lesson view respects the class URL and academic year.
- Removed runtime generation of fabricated official curriculum and automatic startup publication.
- Imported the user-provided real archive into local JSON state after backups: 21 workbooks, 2,516 published lessons, 850 approved T-track lessons. Stale imported records outside the current source were archived, preserving history.
- TypeScript and production build passed; 32 unit tests passed, including real archive source provenance and repeat import checks.
- These are local changes. Live Firebase/Vercel publication and authenticated visual/mobile verification remain outstanding.

## Cloud migration and release progress
The named Enterprise database was inspected and reused. Existing Firestore user profiles were copied into a new private runtime namespace without overwriting existing domain collections. 21 real work plans and 2,516 published source lessons (850 T-track lessons) were migrated and read back successfully. Anonymous SDK access to the runtime namespace was denied.

The compatibility repository now stores compressed immutable snapshots with integrity checks and a transactional revision pointer. Request-local state prevents cross-request memory sharing. Response success waits for the cloud write; concurrent writes fail with 409, and storage failures return 503. Realtime notices are deferred until commit. Durable session revocations survive separate instances. Previous manifest revisions are retained for recovery; garbage collection and domain-level repository extraction remain follow-up scalability work.

A dedicated runtime service account and its two roles were created only after explicit user approval. Its key is encrypted in Vercel. The existing verified Asilbek Firebase Auth account was provisioned after explicit approval. Bahodir must first sign in with Google because no Firebase Auth user exists yet; the approved server allowlist can provision his claim after independently verifying the Firebase identity.

Missing ID tokens and client-supplied role/claim values are no longer accepted by firebase-sync. Backend claims originate from verified tokens or successful Admin SDK assignment only. Deployment and live API verification follow this migration; this entry does not assert full end-to-end student test coverage.

## Google login runtime repair
Production API calls returned FUNCTION_INVOCATION_FAILED because the TypeScript entry emitted an unresolved extensionless ESM import of /var/task/server. The frontend mislabeled this 500 response as a Google network failure. The backend is now bundled into api/index.js with esbuild, external npm dependencies retained, and runtime config/source assets explicitly included. A native Node smoke test loads this exact artifact without tsx and checks the health route. Server outages now use a distinct authentication error message. Production rollout and live verification follow this repair.

Production also exposed jwks-rsa 4 requiring ESM-only jose 6 through CommonJS in Vercel's runtime loader. The error was reproduced using native Node with require(ESM) disabled. The jwks-rsa subtree now pins the compatible jose 5.10.0; the lockfile records the override. The deployment smoke suite checks health under that loader mode and verifies RSA signatures through the actual JWKS dependency. Revisit this scoped override when upstream runtime compatibility is fixed.

## BSB / CHSB exam center — 2026-11-06
Added distinct BSB and CHSB draft/import/lifecycle screens, PDF canvas crops, DOCX rendering, editable questions/points/rubrics/choice keys, grade-compatible class assignments and per-quarter slot conflict checks. Numbered internal lists/decimal subquestions stay inside their parent question; roman variants are separated. User samples produce 5 natural-science, 5 chemistry, 5 Uzbek questions and two 10-question history variants. The Russian project is preserved as one source assignment rather than invented rubric questions.
Images are private Firestore media documents rather than snapshot payload duplication. Runtime media access checks institution, published state and student class. Student keys are stripped including optionItems.isCorrect. Legacy mutation routes cannot bypass exam review. No Firestore rules changes are included.
Student runner requests fullscreen on a gesture, logs exits/tab hiding, autosaves with server revision checks, restores sessions without resetting time, respects server pauses/closing and offers typed fields and optional drawings. Subjective results remain pending human review. Fullscreen cannot prevent external devices or all copying. Scanned image-only PDF OCR is not implemented; text-bearing PDF/DOCX are supported. Blank locations are heuristic and must be reviewed. Source image payload limit is 3.2 MB, max 20 pages and 60 questions. Offline/closed-browser sessions are finalized on reconnection, while the server rejects edits after the deadline. No production students or results were fabricated.
45 unit/isolated API tests and two native server smoke tests passed; final lint/build and authenticated browser/deployment verification are recorded in the release report. Existing dependency audit findings and frontend chunk-size warnings remain.

## Paper identity header import fix
Import now detects paper identity/variant header bands and subtracts them from source images, question text, options, answer fields and common reading context. Same-page variant mastheads and header-only spillover onto the next variant page are handled; dark-ink checks omit empty image strips while retaining diagram continuation pages. Ordinary task blanks and shared reading passages remain. New drafts carry sourceLayoutVersion 2 so an earlier import is not silently replayed by source-hash deduplication. Existing saved images are immutable; legacy drafts must be reimported/reviewed rather than silently modifying published assessments or student work.
Graphify skill installed from the user archive with references. Code-only local graph created (no semantic provider calls); .data remains excluded. Graph outputs are ignored, while persistent user/project instructions record the requested Graphify workflow.

## Teacher / quarter / practice release — 2026-11-07
User explicitly authorized Teacher as an active role. Admin can create teacher logins with a minimum 12-character password, assigned subject and real class IDs, suspend/reactivate and reset passwords. Passwords use existing salted scrypt, are never returned or logged, and session revocation follows suspension/reset. Teacher APIs are allowlisted; state includes only assigned-class student summaries and subject-matched lessons. Teacher delivery is scoped by class IDs so shared plan rows do not change another teacher's classes. Admins retain verified server claim requirements. Failed password-login throttles persist in the request database across instances.
Third tab-hidden event persistently stops an exam session; repeated event UUIDs are idempotent. Stopped sessions reject new saves and submission uses saved answers. Fullscreen exit is recorded separately, avoiding double counting one tab switch. Browser event reporting cannot establish a tamper-proof proctoring boundary; no such claim is made.
666 actual current-year quarter-one lessons were marked school-delivered in Firestore at the user's explicit instruction; recorded student completion count remained one before and after. Student curriculum and roadmap show school delivery separately and open quarter two when applicable.
Topic-based written reflection practice is generated on demand from the real lesson title and saved as ungraded responses. This is NOT an automatically validated subject-matter multiple-choice bank. Exact textbook-based tests require source material/review; no fabricated correct answers or grades are created.
PDF/DOCX import retains review gates and now detects BSB/CHSB and slot from filenames. General import error <=2% has NOT been established; an annotated representative benchmark and further OCR/format coverage remain necessary.
Replaced vulnerable xlsx 0.18.5 with the official vendored SheetJS 0.20.3 tarball and pinned @grpc/grpc-js 1.14.5 per upstream advisory. npm audit reports 11 moderate findings and zero high after this update; this is not a penetration-test certificate. Re-run real archive regression and native handler smoke tests after dependency changes.

## Presentation QA — 2026-11-08
- Live production alias matched 5f0cf06 at baseline. Firebase authorized domains includes specializedstudy.vercel.app; encrypted server credential/session secret and Firestore driver are configured.
- Read-only Firestore inspection found 19 classes, 21 work plans, 2,516 published / 2,552 total lessons, one teacher, two students, three assessments and one exam session before disposable QA setup. Existing records were preserved.
- Vercel logs confirmed /api/events timed out at 300 seconds. Replaced browser SSE with visible/online-only, non-overlapping 30-second authenticated polling; Vercel legacy SSE requests close immediately. No session tokens in new event query URLs.
- Firestore mode now rejects persistence outside request context, preventing accidental ephemeral local JSON fallback. Development/test local storage remains available.
- Corrected invalid 9t1/9t2 assignment/report options to the shared official 19-class constant; pending manual results show Tekshiruvda in admin cards/table/export.
- Teacher password reset inputs are per-account; delivery can be undone only for the teacher's own classes, including per-class exceptions to a global quarter mark. Other classes retain delivery state. Added scope and fail-closed regressions.
- Lesson reflection drafts now autosave in the current user's browser and restore on reopening; explicit final submission remains durable on the server. This is ungraded practice, not AI generated subject tests.
- Repaired package-lock override drift; npm ci completed with 554 packages. Typecheck/build, 54 tests and two native handler smoke tests passed. Existing frontend chunks remain large.
- Detailed production evidence, cleanup, timing measurements, UI coverage limitations and presentation checklist are delivered in outputs/qa-readiness-2026-11-08.md outside this repository. Passing tests does not certify every UI control, other browser engines, or 25 simultaneous exam writers.

Additional live-browser findings: deploy changes could leave an open tab referencing a removed lazy page module; a bounded one-minute chunk recovery guard now reloads once and retains the error screen on repeated failure. Student dashboard maps Sunday to Yakshanba in Asia/Tashkent, shows Qayd yo‘q when no attendance sessions exist, and lesson recommendations avoid undefined fields. Final suite: 55 unit/isolated tests and two native server smoke tests. Lighthouse baseline public mobile run: performance 69, accessibility 92, FCP 2.5s, LCP 5.7s, CLS 0; performance and contrast remain improvement work, not a passing schoolwide capacity claim.
Live disposable exam was completed through the student UI: 1/1 correct, 2/2 total, 100%. Its question detail exposed an old earnedPoints/awardedPoints display mismatch and pending_review label mismatch; both are corrected without changing real grades. Missing topic titles use the question subject, and a perfect result no longer invents a weakest topic. Statistical result commentary is labeled as such rather than claiming Gemini generated it. Final regression suite: 56 tests plus two native smoke tests.
A fresh Google login exposed a client Firestore free-write quota error: the server had already issued a verified durable session, but a redundant awaited setDoc(users/uid) kept the UI pending under SDK backoff. Removed all three duplicate browser mirrors for profiles/classes/assessment attempts; successful server responses remain the authoritative persistence boundary. Existing Firestore records/rules were not deleted or changed. 56 tests and two handler tests passed after this correction. A concurrent QA logout also returned 409, confirming the documented snapshot-CAS contention limitation rather than silently losing a write.

## Global persistence phase — 2026-11-09
User explicitly requested no Graphify for this task. Only targeted source reads were used. Backup of the current cloud state is stored privately in .data/global-before-2026-11-09.json. Schema-1-compatible concatenated gzip members partition state by domain and ordered 64-record slices; unchanged content hashes are not rewritten. A bounded immutable chunk cache reuses unchanged data across revisions. Head pointer remains transactional and concurrent writes still return 409; this does not claim a fully queryable per-domain repository.
Practice drafts now persist via class-scoped authenticated PUT, with revisions preventing stale overwrites and immutable submitted answers. Old local drafts are backed up before migration and deleted only after successful server save. Teacher review/grades are not added without phase-3 approval.
Current-state dry-run: legacy compressed state 666,515 bytes; partitioned total 715,016 bytes, 109 pieces; a simulated throttle update changed one 138-byte piece, excluding manifest overhead. This is a byte measurement, not a guaranteed latency target. 58 unit/isolated tests and two native handler tests passed before the bounded batch-size adjustment; final checks follow.
