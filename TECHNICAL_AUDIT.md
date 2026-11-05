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
