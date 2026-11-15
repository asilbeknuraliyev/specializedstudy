# School import and security release — 2026-11-15

This release is prepared on `codex/production-stability-school-import`. It must remain a preview until the owner approves production deployment and real school data import. No actual student/staff accounts are provisioned by the local dry-run.

## Data review

The supplied workbooks contain 426 students in 19 official classes and 51 staff rows (50 complete names). One staff identity is incomplete, five rows lack a subject, and no staff row supplies class assignments. Six positions need a role review. Position does not confer authorization. A/B/E source class suffixes map to A1/A2/T without replacing existing class IDs.

The supplied archive contains 14 primary subject folders, 115 XLSX files and 127 worksheets. Six empty sheets are ignored; 121 nonempty sheets contain 9,493 topic rows, including nine missing-topic rows. Ninety-two sheets require mapping review. Copied worksheets, ambiguous tracks and the ART abbreviation must be confirmed by the administrator. No ambiguous mapping is published automatically.

The password-free account proposal and original row data remain local under ignored `.data/`. The review reports outside the repository omit personal names. Never commit roster data, credential packets, export keys or private test configuration.

## Security boundaries

- Health returns only `{"status":"ok"}`; diagnostics require the verified owner.
- Login, provider callback/sync, refresh and invite redemption necessarily have public ingress; private APIs authenticate before loading cloud state. Public ingress has origin, bounded-body and shared rate-limit checks.
- Native passwords require 8–128 characters with upper/lowercase Latin letters and a digit. Staff account creation retains its stronger minimum. Scrypt uses asynchronous bounded concurrency for bulk accounts.
- Invitations use 192 bits of randomness, SHA-256 digests, one use and at most seven days. Legacy predictable enrollment codes cannot activate accounts.
- Access sessions expire after 15 minutes. Refresh cookies are HttpOnly, Secure in production, SameSite=Strict, host-only, and expire after seven days. The database holds their hashes and durable family revocation. Password resets revoke sessions; a revoked family cannot renew access. OAuth uses PKCE and a dedicated callback; its temporary verifier is session-scoped and provider tokens are memory-only.
- School, class and explicit teacher subject/class assignments are enforced on the server. An unassigned learner receives no default class access. Draft and foreign-school lessons are excluded from search, calendar and lesson completion.
- Leadership is a private school-scoped grant, not a name/email rule or automatic superadmin role. Grant/recovery requires an owner's fresh Google proof, explicit identity verification and an audit reason. TOTP secrets are encrypted; recovery codes are hashed and one-use. Leadership APIs require a fresh MFA-verified session family.
- Existing Firebase client rules default-deny sensitive data. Supabase private tables have RLS with no browser policies and service-only RPC grants. Media and encrypted imports use a private bucket. Server secrets never enter the frontend configuration.
- CSP permits scripts only from the same origin: no `unsafe-eval` or inline scripts. Inline styles remain for existing React/motion components; removing them requires a separate style migration. Security headers also set HSTS, nosniff, frame protection, referrer and permission restrictions.
- HTML revalidates; API responses are no-store; production source maps are disabled. Canonical HTML redirects use 301 and API redirects use 308 to preserve methods. Frontend APIs use relative same-origin URLs. Public static files explicitly restrict CORS to the canonical origin, overriding the hosting default wildcard; private API origin checks remain independent.

## Import operation and credentials

1. The worker reads bounded XLSX/ZIP files locally. It checks nested expansion, unsafe paths, macros, embeddings and external links, and never evaluates formulas. This is not an antivirus engine. Production malware scanning remains an optional isolated scanning service, not an unverified claim.
2. Preview validates normalized cells on the server and stages an AES-256-GCM payload in private object storage. Runtime state contains small manifests, not a whole workbook. Row provenance and exceptions are paginated.
3. An owner explicitly selects rows, confirms class/subject mappings and accepts importing only the valid part. Existing matching identities preserve their UID, login, password and results. Missing identity fields are never invented. Staff without assignments remain pending activation.
4. Commit creates collision-safe logins and independent random passwords. Repeated commit of the same job is idempotent. The shared state revision fence rejects competing stale mutations rather than silently overwriting another writer.
5. Plans default to draft and carry academic year, source hash and worksheet/row references. Publication checks school/class scope and existing published lesson collisions. Additional subjects require explicit approval. Old lessons are preserved.
6. Initial credentials are encrypted at rest and can be claimed once, within 24 hours, by the importing owner after fresh Google verification. They are never added to a normal CSV/PDF or audit log. Browser export is independently encrypted with AES-256-GCM and a PBKDF2-SHA256 key derived with 310,000 iterations. The separate export key is not sent to the server; deliver it through an independently verified channel. Close/clear the credential view after delivery. Later access uses password reset, not password retrieval.
7. Undo archives new unused accounts/plans/lessons only. It preserves prior academic records and blocks after use. It removes only subject assignments introduced by that import and no longer needed by another active lesson.

## Permissions matrix

| Capability | Owner | Director | Academic deputy | Teacher | Student |
|---|---|---|---|---|---|
| Create school accounts / credential claim | Yes | No | No | No | No |
| Grant leadership / identity recovery | Yes + fresh Google | No | No | No | No |
| School roster, attendance and result summaries | Yes | Yes + MFA | Yes + MFA | Assigned scope | Own scope |
| Curriculum / timetable import | Yes | No | Yes + MFA | Assigned content only | No |
| Global platform administration | Yes | No | No | No | No |
| Formal exam answer keys | Authorized exam author/grader only; never learner payload | No broad grant | No broad grant | Assigned exam scope | Never |

The director/deputy identities in the source file are review candidates only. This release does not grant them access until the owner separately verifies ownership of their accounts.

## Release, restore and operational limits

The preview uses `_specialized_preview_school_20261115`, synthetic test accounts and a separate signing secret. Current live production still uses Firebase, while this preview uses Supabase. The previously staged production copy and preview occupy separate namespaces in one free Supabase project; they are not permanently isolated database projects. Before a future Supabase production cutover, approve either a dedicated staging project or a documented shared-project isolation decision.

Production cutover must: verify a current backup; activate the tested write fence; export the latest Firebase revision; copy and compare counts/content/media hashes into the production namespace; validate environment secrets; deploy the approved SHA; verify login/role/exam flows; and then reopen writes. Preserve the previous deployment and original data. If writes occurred after cutover, reconcile them before rollback; never simply point to a stale database.

`SESSION_SECRET` currently also derives purpose-bound encryption keys for MFA/import envelopes. Preserve its protected backup. A signing-secret rotation requires explicit envelope decryption/re-encryption first, or it will make those records unreadable. Do not rotate it casually.

Free plans have CPU, memory, request-size, storage, egress and quota limits. This release does not guarantee 1,000 concurrent users. The 115-file source payload fits the current request limit; larger batches must be split. Synthetic functional testing is not production capacity certification. Retention/pruning, restore drills, ongoing monitoring and cost thresholds remain operational work requiring a chosen policy; the mere existence of backups is not proof of restore readiness.

The reported duplicate login/error screenshot was not reproducible in fresh mobile/desktop production contexts. Observed production had one React root, one login form and no runtime errors. Route-level error isolation and HTML revalidation are preventive changes; no unproven root cause is asserted. Vercel production remains independent of a local editor or terminal.

## Dependency audit follow-up

The final runtime dependency audit reports zero known vulnerabilities. Compatible ESLint/config-array updates reduce development findings from seven to five. The remaining five are one transitive minimatch denial-of-service advisory and its dependent TypeScript-ESLint tool packages. The official registry currently returns 8.72.2 as the latest TypeScript-ESLint release, which still depends on the affected range. No forced minimatch major override was applied. These packages run in development rule validation, not the production request handler; lint only trusted repository paths until upstream releases a compatible fix. Both deny-all Firebase rules validate with the updated ESLint, and runtime package versions are unchanged.
