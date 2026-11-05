# Specialized Study — development instructions

## Architecture
React 19 + TypeScript + Vite + Tailwind frontend. React Router routes are in src/App.tsx. LearnOSContext currently owns authentication, API calls and shared state. Express routes are in server.ts; api/index.ts exposes the app for Vercel. Firebase Authentication, Firestore and Storage are configured, but backend academic records currently persist in local JSON via src/server/dbEngine.ts. This is not yet a safe serverless persistence design.

## Product constraints
Only Platform Admin and Student are active product roles. Preserve exactly 19 official classes and track defaults in src/constants/curriculum.ts. No demo students, invented metrics or curriculum topics. T-track mathematics requires explicit assignment. Curriculum publication is not evidence of mastery. Subjective grading requires human review. Only recorded attendance sessions count.

## Security
Never authorize using frontend email matching. Require verified Firebase identity and server-issued platformAdmin custom claims. API handlers must independently check resource ownership and class scope. Admin SDK bypasses rules. Never weaken rules to make login work. No production test mode, fixed session signing secrets, or fallback local identities. Use server-only credentials; never put Admin SDK or AI secrets in VITE_* variables. Firebase web app configuration is public identification, not an admin credential.

## Workflow
Preserve existing functionality and data; make bounded, testable changes. Review TECHNICAL_AUDIT.md before production deployment. Do not reset production data. Keep Uzbek Latin UI copy concise, responsive and accessible. Do not add nonfunctional controls or claim unfinished modules work.

Run npm ci, npm run lint, npm run build and npm run test:unit. Integration tests in src/utils require an isolated server with NODE_ENV=test and the same random SESSION_SECRET in server/test processes. Never run them against production. Rules require Firebase Emulator tests before deployment. npm lockfile is generated for reproducibility; do not mix package managers within a change.
