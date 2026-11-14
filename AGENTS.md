# Specialized Study — development instructions

## Architecture
React 19 + TypeScript + Vite + Tailwind frontend. React Router routes are in src/App.tsx. LearnOSContext owns authentication, API calls and shared state. Express routes are in server.ts; api/index.js is the generated Vercel entry. Supabase mode uses private PostgreSQL domain records, independent exam CAS rows, Supabase Google OAuth and a private Storage bucket. Native credentials retain salted scrypt hashes and server-issued HttpOnly sessions. Firebase modules remain for controlled migration/rollback. Local JSON is only for development and isolated tests; hosted persistence fails closed without a request context.

## Product constraints
Platform Admin, Student and assigned-class Teacher are active roles (teacher role explicitly authorized by user). Preserve exactly 19 official classes and track defaults in src/constants/curriculum.ts. No demo students, invented metrics or curriculum topics. T-track mathematics requires explicit assignment. Curriculum publication is not evidence of mastery. Subjective grading requires human review. Only recorded attendance sessions count.

## Security
Never authorize using frontend email matching. Supabase Google admin login requires verified identity, server-only app_metadata grants and existing application profile/private claims. user_metadata is never an authority. Native admin login requires previously granted server privileges. API handlers independently check ownership and class scope. Service-role SDK bypasses RLS: never expose its key. Legacy Firebase browser rules deny all access. No production test mode, fixed signing secrets or fallback local identities. Never put server, service-role or AI secrets in VITE_* variables. Public provider configuration is identification, not an admin credential.

## Workflow
Preserve existing functionality and data; make bounded, testable changes. Review TECHNICAL_AUDIT.md before production deployment. Do not reset production data. Keep Uzbek Latin UI copy concise, responsive and accessible. Do not add nonfunctional controls or claim unfinished modules work.

Run npm ci, npm run lint, npm run build and npm run test:unit. Integration tests in src/utils require an isolated server with NODE_ENV=test and the same random SESSION_SECRET in server/test processes. Never run them against production. Rules require Firebase Emulator tests before deployment. npm lockfile is generated for reproducibility; do not mix package managers within a change.

## Hosted persistence
When PERSISTENCE_DRIVER=firestore, API requests load an isolated snapshot from the named Enterprise database. The compatibility bridge compresses and hashes state into immutable chunks and publishes a version pointer with an optimistic Firestore transaction. Responses wait for durable commit; conflicting edits return 409. Realtime notices follow commit. Existing public/domain collections are preserved. Session revocations are part of the durable state. This bridge preserves the current services; long-term domain-by-domain queries and snapshot retention/garbage collection remain necessary as data grows.

Server-only setup: FIREBASE_ADMIN_SERVICE_ACCOUNT is encrypted in Vercel, SESSION_SECRET signs sessions, and PERSISTENCE_DRIVER=firestore enables cloud storage. The runtime service account is limited to Firebase Auth Admin and Datastore User. Never commit .data, backups, credentials, or logs. Scripts/checkSnapshotAccess.ts verifies anonymous denial. scripts/migrateCloudState.ts only initializes a missing cloud pointer and refuses to replace an existing migrated state.

## Vercel runtime build
api/index.js is a generated, committed deployment entry built by scripts/buildServer.mjs from src/server/vercelEntry.ts and server.ts. All relative backend imports are bundled because native Vercel ESM cannot resolve the old extensionless imports. npm run build regenerates it; do not edit it by hand. Run npm run test:server to test the actual generated handler with native Node. Vercel includes the Firebase web config and official source ZIP explicitly. Never bundle secrets or .data.

## BSB / CHSB exams
Exam lifecycle routes live in src/server/examRoutes.ts. Imported PDF/DOCX screenshots are private content-addressed Firestore documents under _specialized_exam_media and are delivered only through authenticated class-scoped API routes. Original files are parsed in the browser; do not send them to an AI provider. Anonymous rules remain denied. Draft imports require admin points/rubric or choice-key review before publication. Unknown source points stay zero in drafts and prevent publication. Only drafts are editable/deletable. Preserve old assessment routes but do not allow them to publish/reassign managed exams.
Exam sessions use server deadlines, persistent autosave revisions and one attempt per student; The third tab-hidden event stops the session, preserving saved answers without changing grading criteria. If the browser is offline/closed, expiry blocks later edits; submission finalizes when the student reconnects. BSB subjective responses stay pending until human grading. Never fabricate student attempts for production verification.

## Graphify preference
Use the installed Graphify skill for codebase work. If graphify-out/graph.json exists, query it before broad source exploration. Update the local code-only graph after edits with `uv tool run --from graphifyy graphify update . --no-cluster`. Graph outputs are local and ignored; do not include .data, credentials or student data, or send code to semantic providers. If no graph exists, follow the skill's targeted-lookup fast path.
