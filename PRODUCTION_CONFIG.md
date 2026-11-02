# LearnOS — Production Configuration & Deployment Guide

This document details all production configuration, security rules, environment variables, and Cloud Run deployment steps for the multi-tenant **LearnOS (Learning Intelligence Operating System)** SaaS platform.

---

## 1. Firebase Project & Firestore Database

- **Firebase Project ID**: `ivory-receiver-slxdt`
- **Firestore Database ID**: `ai-studio-ff65cdf0-7948-4790-b5ab-b03b482aba86`
- **Configuration File**: `firebase-applet-config.json` (committed at workspace root and imported by `src/firebase.ts`).

### Primary Collections (`firebase-blueprint.json` & `firestore.rules`)
- `institutions/{institutionId}` — Multi-tenant school/educational center metadata (`name`, `code`, `region`, `district`, `academicYear`, `status`).
- `users/{userId}` — Authenticated user profiles with role (`platform_owner`, `admin`, `teacher`, `student`, `parent`), `institutionId`, `classId`, and `linkedChildIds`.
- `classes/{classId}` — Institution classes with assigned `teacherId` and `studentCount`.
- `invitations/{invitationId}` — Single-use cryptographic invitations storing `tokenHash` (SHA-256), `role`, `institutionId`, `classId`, `status`, and `expiresAt`.
- `subjects/{subjectId}` & `topics/{topicId}` — Curriculum taxonomy (8-sinf Matematika standard topics).
- `questions/{questionId}` — Teacher-authored and teacher-approved diagnostic questions.
- `assessments/{assessmentId}` — Assessments with immutable `questionSnapshot` upon publication.
- `assignments/{assignmentId}` — Class-level assessment assignments and due dates.
- `attempts/{attemptId}` — Server-scored student assessment attempts with topic breakdown and Gemini AI diagnostic summaries.
- `mastery_records/{recordId}` — Per-student, per-topic Knowledge Map accuracy and mastery status.
- `learning_paths/{pathId}` — 5-step personalized remediation paths generated from real attempt evidence.
- `teacher_notes/{noteId}` — Teacher pedagogical notes and overrides per student.
- `notifications/{notificationId}` — Real-time in-app notifications.
- `audit_logs/{logId}` — Append-only security and governance audit trail.

---

## 2. Authentication Providers

1. **Email & Password Authentication (`/api/auth/bootstrap`, `/api/auth/login`, `/api/auth/register-with-invite`)**:
   - Passwords are salted and hashed server-side using `crypto.scryptSync`.
   - Sessions use HMAC-SHA256 signed bearer tokens (`Authorization: Bearer <token>`).
   - **Initial Administrator Bootstrap**: Enabled only when zero administrator accounts exist in the environment (`GET /api/auth/bootstrap-status`). Automatically and permanently locked once the first administrator is created.
   - **Cryptographic Invitations**: Public registration requires a valid, unrevoked, non-expired single-use `inviteToken`. Raw tokens are shown only once at creation time; only the SHA-256 `tokenHash` is stored in the database.
2. **Firebase Google OAuth (`signInWithPopup`)**:
   - Enabled in Firebase Console -> Authentication -> Sign-in method -> Google.
   - Synchronized with the backend session via `POST /api/auth/firebase-sync`.

---

## 3. Environment Variables & Secrets

Define the following environment variables in Cloud Run / `.env`:

| Variable | Purpose | Required |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Server-side Google Gemini API key (`@google/genai`) for `/api/ai/analyze-attempt` and `/api/ai/draft-question`. Never exposed to client bundle. | Yes |
| `LEARNOS_TOKEN_SECRET` | 256-bit secret key used to sign HMAC-SHA256 session tokens. | Recommended in Prod |
| `APP_URL` | Public HTTPS URL of the deployed Cloud Run service. | Yes |
| `PORT` | HTTP server port (defaults to `3000`). | Yes (`3000`) |

---

## 4. Authorized Domains & Custom Domain Setup

1. Open **Firebase Console -> Authentication -> Settings -> Authorized domains**.
2. Add your Cloud Run `*.run.app` domain and your production custom domain (e.g., `app.learnos.uz`).
3. In **Google Cloud Console -> Cloud Run -> Manage Custom Domains**, map your domain to the `learnos` service and verify DNS records (`A` / `AAAA` / `CNAME`).

---

## 5. Firestore Security Rules Deployment

Before deploying to production or after modifying `firestore.rules`:

```bash
# 1. Lint security rules locally
npx eslint firestore.rules

# 2. Deploy rules to Firebase project ivory-receiver-slxdt
firebase deploy --only firestore:rules
```

---

## 6. Cloud Run Build & Deployment

```bash
# 1. Install dependencies
npm ci

# 2. Run unit, RBAC security, and E2E verification tests
npx tsx --test src/utils/scoring.test.ts src/utils/e2e_workflow.test.ts

# 3. Build production frontend bundle
npm run build

# 4. Start production Express + static asset server on port 3000
npm run start
```
