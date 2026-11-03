# LearnOS — Production Configuration & Deployment Guide

This document details all production configuration, security rules, environment variables, and Cloud Run deployment steps for the multi-tenant **LearnOS (Learning Intelligence Operating System)** SaaS platform.

---

## 1. Firebase Project & Firestore Database

- **Firebase Project ID**: `specialized-study`
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

## 2. Authentication Providers & Multi-Admin Governance

1. **Firebase Google OAuth (`signInWithPopup` with mobile `signInWithRedirect` fallback)**:
   - Firebase Project ID: `specialized-study` (`authDomain: specialized-study.firebaseapp.com`).
   - Enabled in **Firebase Console → Authentication → Sign-in method → Google**.
   - Synchronized with the backend session via `POST /api/auth/firebase-sync`.
   - **Authorized Platform Administrators (Equal Full Access)**:
     - `asilbeknuraliyev43@gmail.com`
     - `bahodirboliqulov3@gmail.com`
   - All other authenticated Google accounts are strictly assigned the `student` role (`platformAdmin: false`).
2. **Email & Password Authentication (`/api/auth/bootstrap`, `/api/auth/login`, `/api/auth/register-with-invite`)**:
   - Passwords are salted and hashed server-side using `crypto.scryptSync`.
   - Sessions use HMAC-SHA256 signed bearer tokens (`Authorization: Bearer <token>`).

---

## 3. Environment Variables (Vercel & Cloud Run)

Define the following environment variables in **Vercel Project Settings → Environment Variables** (or Cloud Run):

| Variable | Purpose | Required |
| :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Firebase Web API key (falls back to `firebase-applet-config.json` if omitted). | Optional override |
| `VITE_FIREBASE_AUTH_DOMAIN` | `specialized-study.firebaseapp.com` | Optional override |
| `VITE_FIREBASE_PROJECT_ID` | `specialized-study` | Optional override |
| `VITE_FIREBASE_APP_ID` | `1:848511288912:web:df85c4a28ff91cb3887355` | Optional override |
| `GEMINI_API_KEY` | Server-side Google Gemini API key (`@google/genai`). Never exposed to client bundle. | Yes (for AI features) |
| `SESSION_SECRET` | 256-bit secret key used to sign HMAC-SHA256 session tokens (`LEARNOS_TOKEN_SECRET`). | Recommended in Prod |
| `APP_URL` | Public HTTPS URL of your production deployment (e.g., `https://specialized-study.vercel.app`). | Recommended |

---

## 4. Fixing `"Bu domen orqali kirishga ruxsat yo'q."` (`auth/unauthorized-domain`) on Vercel

Firebase Authentication blocks Google Sign-In popups and redirects from any hostname not explicitly listed in the Firebase project's **Authorized domains**.

### Step-by-Step Firebase Console Fix:
1. Open [Firebase Console](https://console.firebase.google.com/project/specialized-study/authentication/settings) and select project **`specialized-study`**.
2. Navigate to **Authentication → Settings → Authorized domains** (`Authentication -> Sozlamalar -> Ruxsat berilgan domenlar`).
3. Click **Add domain** and add:
   - Your production Vercel domain (e.g., `specialized-study.vercel.app` or your exact `<project-name>.vercel.app` hostname shown in the login error box).
   - Your custom domain if configured (e.g., `specializedstudy.uz`).
   - Note: `localhost`, `specialized-study.firebaseapp.com`, and `specialized-study.web.app` are authorized by default.
4. **Vercel Preview Deployment URLs (`*-git-*.vercel.app`)**:
   - Vercel generates a new random subdomain for every branch/commit preview deployment (e.g., `specialized-study-git-main-user.vercel.app`).
   - Because Firebase does not support wildcard `*.vercel.app` entries in Authorized domains, either test Google Sign-In on your primary production Vercel domain or add the specific preview hostname to Firebase Authorized domains.
5. **Google Cloud Console OAuth 2.0 Client Check (Optional Custom Domain)**:
   - In [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=specialized-study), under **OAuth 2.0 Client IDs (Web client auto-created by Google Service)**:
     - **Authorized JavaScript origins**: Ensure `https://<your-vercel-domain>.vercel.app` and `https://specialized-study.firebaseapp.com` are listed.
     - **Authorized redirect URIs**: Ensure `https://specialized-study.firebaseapp.com/__/auth/handler` is present.

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
