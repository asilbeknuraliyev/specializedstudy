import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import {
  issueSessionToken,
  verifySessionToken,
} from '../server/dbEngine';
import {
  createIsolatedTestFirebaseIdToken,
  verifyFirebaseIdToken,
} from '../server/firebaseAdminAuth';
import {
  isAuthorizedAdminEmail,
  isAuthorizedAdmin,
  canAccessPlatformAdminConsole,
  sanitizeFormulaInjection,
  escapeExcelExportCell,
  isSafeArchivePath,
  validateUploadedImageMeta,
} from './security';
import {
  mapFirebaseAuthError,
  sanitizeTechnicalAuthMessage,
  isMobileOrTouchRedirectPreferred,
} from './firebaseAuthErrors';
import {
  validateStudentUploadBuffer,
  parseAndValidateStudentWorkbook,
} from './studentExcelImporter';
import { parseAndValidateImportPackage } from './excelImporter';
import { OFFICIAL_19_CLASS_CODES } from '../constants/curriculum';

const BASE_URL = 'http://localhost:3000';

async function apiRequest(
  endpoint: string,
  method: string = 'GET',
  body?: unknown,
  token?: string,
  extraHeaders: Record<string, string> = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-LearnOS-Env': 'test',
    ...extraHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

describe('SPECIALIZED STUDY — GOOGLE AUTHENTICATION REPAIR, MULTI-ADMIN & SECURITY SUITE', () => {
  it('SCENARIO A & B: Authentication, Session Lifecycle, Authorized Platform Admins, and Anti-Escalation', async () => {
    const resetRes = await apiRequest('/api/test/reset', 'POST');
    assert.equal(resetRes.status, 200);

    // 1. Unauthenticated stranger attempting initial bootstrap when DB is empty MUST be rejected (403)
    const rogueBootstrap = await apiRequest('/api/auth/bootstrap', 'POST', {
      displayName: 'Rogue Attacker',
      email: 'attacker@evil.org',
      password: 'Password123!',
      institutionName: 'Hacked School',
    });
    assert.equal(
      rogueBootstrap.status,
      403,
      'Stranger email must NOT be allowed to bootstrap initial admin account even when database is empty'
    );

    // 2. Authorized Platform Admin 1 (asilbeknuraliyev43@gmail.com) bootstraps successfully
    const ownerBootstrap = await apiRequest('/api/auth/bootstrap', 'POST', {
      displayName: 'Asilbek Nuraliyev',
      email: 'asilbeknuraliyev43@gmail.com',
      password: 'OwnerStrongPassword2026!',
      institutionName: 'Specialized Study Ixtisoslashtirilgan Maktabi',
    });
    assert.equal(ownerBootstrap.status, 200);
    assert.equal(ownerBootstrap.data.user.role, 'platform_owner');
    assert.equal(ownerBootstrap.data.user.platformOwner, true);
    assert.equal(ownerBootstrap.data.user.platformAdmin, true);
    const ownerToken = ownerBootstrap.data.token as string;
    assert.ok(ownerToken);

    // 3. Expired token is rejected
    const expiredToken = issueSessionToken(ownerBootstrap.data.user.uid, 'test', -5000);
    assert.equal(verifySessionToken(expiredToken), null, 'Expired token must fail verification');
    const expiredApiRes = await apiRequest('/api/state', 'GET', undefined, expiredToken);
    assert.equal(expiredApiRes.status, 401, 'Expired token must be rejected by API with 401');

    // 4. Tampered token signature is rejected via timing-safe HMAC check
    const tamperedToken = `${ownerToken.split('.')[0]}.invalidsignature12345`;
    assert.equal(verifySessionToken(tamperedToken), null, 'Tampered token must fail verification');
    const tamperedApiRes = await apiRequest('/api/state', 'GET', undefined, tamperedToken);
    assert.equal(tamperedApiRes.status, 401, 'Tampered token must be rejected by API with 401');

    // 5. Query-string token on standard API endpoints is rejected (only Bearer header accepted)
    const queryTokenRes = await fetch(`${BASE_URL}/api/state?token=${encodeURIComponent(ownerToken)}`, {
      headers: { 'X-LearnOS-Env': 'test' },
    });
    assert.equal(
      queryTokenRes.status,
      401,
      'Query string token must not be accepted on standard JSON API endpoints'
    );

    // 6. Session revocation on logout invalidates token immediately
    const tempLogin = await apiRequest('/api/auth/login', 'POST', {
      email: 'asilbeknuraliyev43@gmail.com',
      password: 'OwnerStrongPassword2026!',
    });
    assert.equal(tempLogin.status, 200);
    const disposableToken = tempLogin.data.token as string;
    const logoutRes = await apiRequest('/api/auth/logout', 'POST', {}, disposableToken);
    assert.equal(logoutRes.status, 200);
    const afterLogoutRes = await apiRequest('/api/state', 'GET', undefined, disposableToken);
    assert.equal(afterLogoutRes.status, 401, 'Revoked session token must be rejected after logout');

    // 7. Role escalation via POST /api/users with role="admin" is blocked & no hardcoded shared password is used
    const createStuRes = await apiRequest(
      '/api/users',
      'POST',
      {
        displayName: 'Escalation Test User',
        email: 'student.noescalate@school.uz',
        role: 'admin',
        classCode: '7a1',
      },
      ownerToken
    );
    assert.equal(createStuRes.status, 200);
    assert.equal(
      createStuRes.data.user.role,
      'student',
      'Created school user must strictly receive student role, never admin'
    );
    assert.equal(
      createStuRes.data.user.status,
      'pending_activation',
      'Student created without custom password must be pending_activation'
    );

    const defaultPwdAttempt = await apiRequest('/api/auth/login', 'POST', {
      email: 'student.noescalate@school.uz',
      password: 'LearnOS2026!',
    });
    assert.equal(
      defaultPwdAttempt.status,
      401,
      'Hardcoded fallback password must never authenticate any student account'
    );
  });

  it('GOOGLE AUTH TEST A, B, C, D, E, F: Multi-Admin Google Sign-In, Claims, Student Flow, Error Handling & Persistence', async () => {
    // --- TEST A: Primary Admin Login (asilbeknuraliyev43@gmail.com) ---
    const admin1IdToken = createIsolatedTestFirebaseIdToken({
      uid: 'google-uid-asilbek-1',
      email: 'asilbeknuraliyev43@gmail.com',
      emailVerified: true,
      name: 'Asilbek Nuraliyev',
      signInProvider: 'google.com',
      platformAdmin: true,
    });

    const syncAdmin1 = await apiRequest('/api/auth/firebase-sync', 'POST', {
      idToken: admin1IdToken,
      uid: 'google-uid-asilbek-1',
      email: 'asilbeknuraliyev43@gmail.com',
      displayName: 'Asilbek Nuraliyev',
      emailVerified: true,
      customClaims: { platformAdmin: true, customPref: 'preserved_1' },
    });
    assert.equal(syncAdmin1.status, 200, 'Primary admin Google login must succeed');
    assert.equal(syncAdmin1.data.status, 'active');
    assert.equal(syncAdmin1.data.user.email, 'asilbeknuraliyev43@gmail.com');
    assert.equal(syncAdmin1.data.user.emailVerified, true);
    assert.equal(syncAdmin1.data.user.platformAdmin, true);
    assert.equal(syncAdmin1.data.customClaims.platformAdmin, true);
    assert.equal(
      syncAdmin1.data.customClaims.customPref,
      'preserved_1',
      'Existing unrelated custom claims must be preserved when setting platformAdmin: true'
    );
    const admin1Token = syncAdmin1.data.token as string;
    assert.ok(admin1Token);

    // Verify Admin 1 can access full admin workspace
    const admin1Overview = await apiRequest('/api/admin/overview', 'GET', undefined, admin1Token);
    assert.equal(admin1Overview.status, 200, 'Admin 1 must access /api/admin/overview');

    // --- TEST B: Second Admin Login (bahodirboliqulov3@gmail.com) with Equal Permissions ---
    const admin2IdToken = createIsolatedTestFirebaseIdToken({
      uid: 'google-uid-bahodir-2',
      email: 'bahodirboliqulov3@gmail.com',
      emailVerified: true,
      name: 'Bahodir Boliqulov',
      signInProvider: 'google.com',
      platformAdmin: true,
    });

    const syncAdmin2 = await apiRequest('/api/auth/firebase-sync', 'POST', {
      idToken: admin2IdToken,
      uid: 'google-uid-bahodir-2',
      email: 'bahodirboliqulov3@gmail.com',
      displayName: 'Bahodir Boliqulov',
      emailVerified: true,
      customClaims: { platformAdmin: true },
    });
    assert.equal(syncAdmin2.status, 200, 'Second admin Google login must succeed');
    assert.equal(syncAdmin2.data.status, 'active');
    assert.equal(syncAdmin2.data.user.email, 'bahodirboliqulov3@gmail.com');
    assert.equal(syncAdmin2.data.user.emailVerified, true);
    assert.equal(syncAdmin2.data.user.platformAdmin, true);
    assert.equal(syncAdmin2.data.user.platformOwner, true);
    assert.equal(syncAdmin2.data.customClaims.platformAdmin, true);
    const admin2Token = syncAdmin2.data.token as string;
    assert.ok(admin2Token);

    // Verify Admin 2 has equal full permissions across admin routes
    const admin2Overview = await apiRequest('/api/admin/overview', 'GET', undefined, admin2Token);
    assert.equal(admin2Overview.status, 200, 'Second admin must access /api/admin/overview');

    // Admin 2 performs admin actions (TEST F: Admin Actions Persist)
    // 1. Create a student via Admin 2
    const stuCreatedByAdmin2 = await apiRequest(
      '/api/users',
      'POST',
      {
        displayName: 'Otabek Tursunov',
        email: 'otabek.9a1@gmail.com',
        password: 'StudentPassword2026!',
        classCode: '9a1',
      },
      admin2Token
    );
    assert.equal(stuCreatedByAdmin2.status, 200, 'Admin 2 must be able to create students');
    assert.equal(stuCreatedByAdmin2.data.user.classCode, '9a1');

    // 2. Create an assessment via Admin 2 AI Command
    const testCreatedByAdmin2 = await apiRequest(
      '/api/ai/command',
      'POST',
      {
        command: '9a1 sinf uchun Matematika fanidan 5 talik test yarat',
      },
      admin2Token
    );
    assert.equal(testCreatedByAdmin2.status, 200, 'Admin 2 must be able to create AI assessments');

    // 3. Provision custom claims endpoint works for both Admin 1 and Admin 2
    const provisionRes = await apiRequest(
      '/api/admin/provision-claims',
      'POST',
      { email: 'bahodirboliqulov3@gmail.com' },
      admin1Token
    );
    assert.equal(provisionRes.status, 200);
    assert.ok(Array.isArray(provisionRes.data.admins));
    assert.equal(provisionRes.data.admins.length, 2);
    assert.equal(provisionRes.data.admins[0].email, 'asilbeknuraliyev43@gmail.com');
    assert.equal(provisionRes.data.admins[1].email, 'bahodirboliqulov3@gmail.com');
    assert.equal(provisionRes.data.admins[1].platformAdminClaimAssigned, true);

    // --- TEST C: Unauthorized User Login (Unrelated Google Account) ---
    // C1: Existing student (`otabek.9a1@gmail.com`) signs in with Google -> routed to student flow, no duplicate account created, denied admin access
    const stuGoogleToken = createIsolatedTestFirebaseIdToken({
      uid: 'google-uid-otabek',
      email: 'otabek.9a1@gmail.com',
      emailVerified: true,
      name: 'Otabek Tursunov',
      signInProvider: 'google.com',
      platformAdmin: false,
    });
    const syncExistingStudent = await apiRequest('/api/auth/firebase-sync', 'POST', {
      idToken: stuGoogleToken,
      uid: 'google-uid-otabek',
      email: 'otabek.9a1@gmail.com',
      displayName: 'Otabek Tursunov',
      emailVerified: true,
    });
    assert.equal(syncExistingStudent.status, 200, 'Existing student Google login must succeed');
    assert.equal(syncExistingStudent.data.user.role, 'student');
    assert.equal(syncExistingStudent.data.user.platformAdmin, false);
    assert.equal(
      syncExistingStudent.data.user.uid,
      stuCreatedByAdmin2.data.user.uid,
      'Must match existing student record by email without creating duplicate account'
    );
    const stuSessionToken = syncExistingStudent.data.token as string;

    // Verify student is denied admin access (403)
    const stuAdminAttempt = await apiRequest('/api/admin/overview', 'GET', undefined, stuSessionToken);
    assert.equal(stuAdminAttempt.status, 403, 'Student Google user must be denied admin access with 403');
    const stuProvisionAttempt = await apiRequest('/api/admin/provision-claims', 'POST', {}, stuSessionToken);
    assert.equal(stuProvisionAttempt.status, 403, 'Student must be denied claim provisioning');

    // C2: Unrelated Google account (not an admin) -> routed to student onboarding (role='student', platformAdmin=false) and strictly denied admin access with 403
    const strangerGoogleToken = createIsolatedTestFirebaseIdToken({
      uid: 'google-uid-stranger',
      email: 'random.stranger99@gmail.com',
      emailVerified: true,
      displayName: 'Random Stranger',
    });
    const syncStranger = await apiRequest('/api/auth/firebase-sync', 'POST', {
      idToken: strangerGoogleToken,
      uid: 'google-uid-stranger',
      email: 'random.stranger99@gmail.com',
      displayName: 'Random Stranger',
      emailVerified: true,
    });
    assert.equal(syncStranger.status, 200);
    assert.equal(syncStranger.data.user.role, 'student', 'Unrelated Google account must only receive student role');
    assert.equal(syncStranger.data.user.platformAdmin, false);
    assert.equal(syncStranger.data.user.platformOwner, false);

    const strangerAdminTry = await apiRequest(
      '/api/admin/overview',
      'GET',
      undefined,
      syncStranger.data.token
    );
    assert.equal(
      strangerAdminTry.status,
      403,
      'Unrelated Google account must be denied admin access with 403'
    );

    // --- TEST D: Invalid / Expired Tokens, Missing Claims, Unverified Email, & Error Mapping ---
    // D1: Expired Firebase ID token
    const expiredFbToken = createIsolatedTestFirebaseIdToken({
      uid: 'google-uid-asilbek-1',
      email: 'asilbeknuraliyev43@gmail.com',
      emailVerified: true,
      expiresInSeconds: -120,
    });
    const verifiedExpired = await verifyFirebaseIdToken(expiredFbToken, 'test', {
      customClaims: {},
    } as any);
    assert.equal(verifiedExpired.valid, false, 'Expired Firebase ID token must fail verification');
    const syncExpired = await apiRequest('/api/auth/firebase-sync', 'POST', {
      idToken: expiredFbToken,
    });
    assert.equal(syncExpired.status, 401, 'Expired Firebase ID token must return 401');

    // D2: Unverified email on admin address -> rejected with 403
    const unverifiedAdminToken = createIsolatedTestFirebaseIdToken({
      uid: 'google-uid-unverified',
      email: 'bahodirboliqulov3@gmail.com',
      emailVerified: false,
    });
    const syncUnverified = await apiRequest('/api/auth/firebase-sync', 'POST', {
      idToken: unverifiedAdminToken,
      email: 'bahodirboliqulov3@gmail.com',
      emailVerified: false,
    });
    assert.equal(syncUnverified.status, 403, 'Unverified admin email must be rejected with 403');

    // D3: Admin email with explicit missing custom claim (`requireAdminClaim: true` & `platformAdmin: false`) -> returns 202 pending_admin_claim
    const missingClaimToken = createIsolatedTestFirebaseIdToken({
      uid: 'google-uid-noclaim',
      email: 'bahodirboliqulov3@gmail.com',
      emailVerified: true,
      platformAdmin: false,
    });
    const syncMissingClaim = await apiRequest('/api/auth/firebase-sync', 'POST', {
      idToken: missingClaimToken,
      uid: 'google-uid-noclaim',
      email: 'bahodirboliqulov3@gmail.com',
      emailVerified: true,
      requireAdminClaim: true,
      customClaims: { platformAdmin: false },
    });
    assert.equal(
      syncMissingClaim.status,
      202,
      'Admin account with missing custom claim when requireAdminClaim=true must return 202 pending_admin_claim'
    );
    assert.equal(syncMissingClaim.data.status, 'pending_admin_claim');

    // D4: Verify all 11 Firebase Auth Error codes map cleanly with sanitized technical logs
    const requiredErrorCodes = [
      'auth/unauthorized-domain',
      'auth/operation-not-allowed',
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/network-request-failed',
      'auth/account-exists-with-different-credential',
      'auth/invalid-api-key',
      'auth/invalid-credential',
      'auth/too-many-requests',
      'auth/user-disabled',
    ];
    for (const code of requiredErrorCodes) {
      const mapped = mapFirebaseAuthError({ code, message: `Firebase: Error (${code}).` });
      assert.equal(mapped.code, code);
      assert.ok(mapped.userMessage.length > 10, `User message must exist for ${code}`);
      assert.ok(mapped.recoveryAction.length > 10, `Recovery action must exist for ${code}`);
    }
    assert.equal(mapFirebaseAuthError({ code: 'auth/popup-blocked' }).shouldOfferRedirectFallback, true);
    assert.equal(
      isMobileOrTouchRedirectPreferred('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'),
      true
    );
    assert.equal(
      isMobileOrTouchRedirectPreferred('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/122.0.0.0'),
      false
    );
    // Token redaction in technical logs
    const redacted = sanitizeTechnicalAuthMessage(
      'Failed token eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    );
    assert.ok(redacted.includes('[REDACTED]'), 'JWT tokens must never be logged in plaintext');

    // --- TEST E: Concurrent Sessions & Multiple Login/Logout Cycles for Both Admins ---
    // Both Admin 1 and Admin 2 are simultaneously active from separate sessions and both can read persisted state
    const [stateAdmin1, stateAdmin2] = await Promise.all([
      apiRequest('/api/state', 'GET', undefined, admin1Token),
      apiRequest('/api/state', 'GET', undefined, admin2Token),
    ]);
    assert.equal(stateAdmin1.status, 200);
    assert.equal(stateAdmin2.status, 200);
    // Verify student created by Admin 2 is visible to Admin 1 (TEST F persistence)
    assert.ok(
      stateAdmin1.data.users.some((u: any) => u.email === 'otabek.9a1@gmail.com'),
      'Student created by Admin 2 must persist and be visible to Admin 1'
    );

    // Security helper unit assertions for both admins
    assert.equal(isAuthorizedAdminEmail('asilbeknuraliyev43@gmail.com'), true);
    assert.equal(isAuthorizedAdminEmail('bahodirboliqulov3@gmail.com'), true);
    assert.equal(isAuthorizedAdminEmail('other@gmail.com'), false);
    assert.equal(
      isAuthorizedAdmin({
        email: 'bahodirboliqulov3@gmail.com',
        emailVerified: true,
        role: 'platform_owner',
        platformAdmin: true,
      }),
      true
    );
    assert.equal(
      canAccessPlatformAdminConsole({
        email: 'bahodirboliqulov3@gmail.com',
        emailVerified: true,
        role: 'platform_owner',
        platformAdmin: true,
      }),
      true
    );
  });

  it('SCENARIO C: Strict Student Class Isolation, Self-Tampering Prevention, and Answer Key Protection', async () => {
    const loginOwner = await apiRequest('/api/auth/login', 'POST', {
      email: 'asilbeknuraliyev43@gmail.com',
      password: 'OwnerStrongPassword2026!',
    });
    const ownerToken = loginOwner.data.token as string;

    // Create Student A in 7a1 and Student B in 7t
    const stuARes = await apiRequest(
      '/api/users',
      'POST',
      {
        displayName: 'Student Alpha 7A1',
        email: 'alpha.7a1@school.uz',
        password: 'AlphaPassword2026!',
        classCode: '7a1',
      },
      ownerToken
    );
    assert.equal(stuARes.status, 200);
    const stuAUid = stuARes.data.user.uid;

    const stuBRes = await apiRequest(
      '/api/users',
      'POST',
      {
        displayName: 'Student Beta 7T',
        email: 'beta.7t@school.uz',
        password: 'BetaPassword2026!',
        classCode: '7t',
      },
      ownerToken
    );
    assert.equal(stuBRes.status, 200);
    const stuBUid = stuBRes.data.user.uid;

    // Login as Student A (7a1)
    const stuALogin = await apiRequest('/api/auth/login', 'POST', {
      email: 'alpha.7a1@school.uz',
      password: 'AlphaPassword2026!',
    });
    assert.equal(stuALogin.status, 200);
    const stuAToken = stuALogin.data.token as string;

    // 1. Student A cannot access /api/admin/overview
    const stuAdminTry = await apiRequest('/api/admin/overview', 'GET', undefined, stuAToken);
    assert.equal(stuAdminTry.status, 403);

    // 2. Student A cannot read Student B's profile/results
    const crossStudentTry = await apiRequest(
      `/api/security/students/${stuBUid}`,
      'GET',
      undefined,
      stuAToken
    );
    assert.equal(crossStudentTry.status, 403, 'Student A must not read Student B record');

    // 3. Student A (7a1) cannot read class 7t lessons or class record
    const crossClassLessons = await apiRequest(
      '/api/lessons?classCode=7t',
      'GET',
      undefined,
      stuAToken
    );
    assert.equal(crossClassLessons.status, 403, 'Student in 7a1 must not read 7t lessons');

    const crossClassDetail = await apiRequest(
      '/api/security/classes/class-7t',
      'GET',
      undefined,
      stuAToken
    );
    assert.equal(crossClassDetail.status, 403, 'Student in 7a1 must not read class-7t details');

    // 4. Student A cannot modify their own class or role via PUT /api/users/:uid
    const selfModifyTry = await apiRequest(
      `/api/users/${stuAUid}`,
      'PUT',
      { classCode: '11a1', role: 'admin' },
      stuAToken
    );
    assert.equal(selfModifyTry.status, 403, 'Student must not modify their own class or role');

    // 5. Answer Key Protection: Create a published assessment for 7a1 and 7t, verify Student A cannot see answer keys or submit to 7t
    const aiCmd7a1 = await apiRequest(
      '/api/ai/command',
      'POST',
      {
        command: '7a1 sinf uchun Fizika fanidan 5 talik test yarat',
      },
      ownerToken
    );
    assert.equal(aiCmd7a1.status, 200);
    const pub7a1 = await apiRequest(
      `/api/assessments/${aiCmd7a1.data.assessment.id}`,
      'PUT',
      { status: 'published', classId: 'class-7a1' },
      ownerToken
    );
    assert.equal(pub7a1.status, 200);

    const aiCmd7t = await apiRequest(
      '/api/ai/command',
      'POST',
      {
        command: '7t sinf uchun Biologiya fanidan 5 talik test yarat',
      },
      ownerToken
    );
    assert.equal(aiCmd7t.status, 200);
    const assessment7tId = aiCmd7t.data.assessment.id;
    const pub7t = await apiRequest(
      `/api/assessments/${assessment7tId}`,
      'PUT',
      { status: 'published', classId: 'class-7t' },
      ownerToken
    );
    assert.equal(pub7t.status, 200);

    // Student A (7a1) tries to submit answers to 7t assessment -> 403 Forbidden
    const crossSubmitTry = await apiRequest(
      '/api/assessments/submit',
      'POST',
      {
        assessmentId: assessment7tId,
        submittedMap: {},
      },
      stuAToken
    );
    assert.equal(
      crossSubmitTry.status,
      403,
      'Student in 7a1 must be blocked from submitting an assessment assigned to 7t'
    );

    // Student A fetches /api/state -> verify all questions have stripped answer keys
    const stuState = await apiRequest('/api/state', 'GET', undefined, stuAToken);
    assert.equal(stuState.status, 200);
    assert.ok(stuState.data.questions.length > 0);
    for (const q of stuState.data.questions) {
      assert.equal(q.correctAnswer, '', 'Question correctAnswer must be stripped for students');
      assert.equal(q.explanation, '', 'Question explanation must be stripped before submission');
      assert.equal(q.acceptedAnswers, undefined, 'AcceptedAnswers must be stripped for students');
    }
  });

  it('SCENARIO D: Firestore & Cloud Storage Security Rules Verification for Two Admins', () => {
    const firestoreRulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const storageRulesPath = path.resolve(process.cwd(), 'storage.rules');
    assert.ok(fs.existsSync(firestoreRulesPath), 'firestore.rules must exist');
    assert.ok(fs.existsSync(storageRulesPath), 'storage.rules must exist');

    const firestoreRules = fs.readFileSync(firestoreRulesPath, 'utf-8');
    const storageRules = fs.readFileSync(storageRulesPath, 'utf-8');

    // Verify both authorized admin emails in both rulesets
    assert.ok(
      firestoreRules.includes("'asilbeknuraliyev43@gmail.com'") &&
        firestoreRules.includes("'bahodirboliqulov3@gmail.com'"),
      'firestore.rules must authorize both asilbeknuraliyev43@gmail.com and bahodirboliqulov3@gmail.com'
    );
    assert.ok(
      storageRules.includes("'asilbeknuraliyev43@gmail.com'") &&
        storageRules.includes("'bahodirboliqulov3@gmail.com'"),
      'storage.rules must authorize both asilbeknuraliyev43@gmail.com and bahodirboliqulov3@gmail.com'
    );

    // Verify questions answer key collection is restricted to isPlatformOwner()
    assert.match(
      firestoreRules,
      /match \/questions\/\{questionId\}\s*\{\s*allow get, list: if isPlatformOwner\(\);/
    );

    // Verify student class isolation helper is enforced on lessons and assessments
    assert.ok(
      firestoreRules.includes('isCallerAssignedToClass(existing().classId, existing().classCode)'),
      'firestore.rules must enforce class isolation on lessons and assessments'
    );

    // Verify default deny-all fallback in both files
    assert.ok(firestoreRules.includes('allow read, write: if false;'));
    assert.ok(storageRules.includes('allow read, write: if false;'));
  });

  it('SCENARIO E: File Upload Security (Formula Injection, Spoofed Magic Bytes, Path Traversal, ZIP Bomb & Sheet Limits)', async () => {
    assert.equal(sanitizeFormulaInjection("=CMD|' /C calc'!A0"), "CMD|' /C calc'!A0");
    assert.equal(sanitizeFormulaInjection('+SUM(A1:A10)'), 'SUM(A1:A10)');
    assert.equal(sanitizeFormulaInjection('@HYPERLINK("http://evil.com")'), 'HYPERLINK("http://evil.com")');
    assert.equal(escapeExcelExportCell('=1+1'), "'=1+1");

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['F.I.Sh.', 'Sinf', 'Email'],
      ['=HYPERLINK("http://evil.com","Karimov Jasur")', '7a1', 'jasur.safe@school.uz'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const preview = parseAndValidateStudentWorkbook(buf, 'formula_test.xlsx', {}, []);
    assert.equal(preview.rows.length, 1);
    assert.ok(
      !preview.rows[0].fullName.startsWith('='),
      'Leading = formula trigger must be stripped during student workbook parsing'
    );

    const fakeXlsx = Buffer.from('MZ-not-a-valid-zip-or-xlsx-header', 'utf-8');
    const fakeCheck = validateStudentUploadBuffer(fakeXlsx, 'students.xlsx');
    assert.equal(fakeCheck.valid, false, 'Non-PK magic bytes masquerading as .xlsx must be rejected');

    const macroCheck = validateStudentUploadBuffer(buf, 'macro_payload.xlsm');
    assert.equal(macroCheck.valid, false, 'Macro-enabled .xlsm must be rejected');

    assert.equal(isSafeArchivePath('../../etc/passwd'), false);
    assert.equal(isSafeArchivePath('media/shell.php'), false);
    assert.equal(isSafeArchivePath('media/xss.svg'), false);
    assert.equal(isSafeArchivePath('media/diagram.png'), true);

    const fakeImageCheck = validateUploadedImageMeta(
      'media/fake.png',
      'image/png',
      128,
      new Uint8Array([0x4d, 0x5a, 0x90, 0x00])
    );
    assert.equal(fakeImageCheck.valid, false, 'EXE magic bytes masquerading as PNG must be rejected');

    const oversizedBuf = new Uint8Array(15 * 1024 * 1024 + 10);
    const oversizedResult = await parseAndValidateImportPackage(
      oversizedBuf,
      'oversized.zip',
      [],
      []
    );
    assert.equal(oversizedResult.valid, false);
    assert.ok(oversizedResult.errors.some((e) => e.problem.includes('15 MB')));
  });

  it('SCENARIO F: API Security Headers (including Google Auth Popup & Frame Headers), CORS Origin Protection, Rate Limiting & Security Alerts', async () => {
    const healthRes = await apiRequest('/api/health', 'GET');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(healthRes.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(
      healthRes.headers.get('cross-origin-opener-policy'),
      'same-origin-allow-popups',
      'COOP must be same-origin-allow-popups so Firebase signInWithPopup can communicate with Google popup'
    );
    const csp = healthRes.headers.get('content-security-policy') || '';
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(
      csp.includes('https://*.firebaseapp.com') && csp.includes('https://accounts.google.com'),
      'CSP frame-src/script-src must allow firebaseapp.com and accounts.google.com for Google Sign-In'
    );
    assert.ok(healthRes.headers.get('strict-transport-security')?.includes('max-age=31536000'));
    assert.ok(healthRes.headers.get('x-request-id'));

    const allowedOrigins = [
      'https://ais-dev-jkf63rrqhvm52n6mwpcddy-953702242203.asia-southeast1.run.app',
      'https://ais-pre-jkf63rrqhvm52n6mwpcddy-953702242203.asia-southeast1.run.app',
      'https://ais-mob-jkf63rrqhvm52n6mwpcddy-953702242203.asia-southeast1.run.app',
      'https://specializedstudy-1062217928830.asia-southeast1.run.app',
      'https://specializedstudy.ai.studio',
      'https://ivory-receiver-slxdt.firebaseapp.com',
      'https://specialized-study.vercel.app',
      'https://specialized-study-git-main-asilbek.vercel.app',
    ];
    assert.equal(
      mapFirebaseAuthError({ code: 'auth/unauthorized-domain' }).userMessage,
      "Bu domen orqali kirishga ruxsat yo'q."
    );
    assert.equal(
      mapFirebaseAuthError({ code: 'auth/operation-not-allowed' }).userMessage,
      'Google orqali kirish sozlanmagan.'
    );
    assert.equal(
      mapFirebaseAuthError({ code: 'auth/popup-closed-by-user' }).userMessage,
      "Kirish oynasi yopildi. Qaytadan urinib ko'ring."
    );
    assert.equal(
      mapFirebaseAuthError({ code: 'auth/network-request-failed' }).userMessage,
      'Internet aloqasini tekshiring.'
    );
    const originTestToken = createIsolatedTestFirebaseIdToken({
      uid: 'google-uid-asilbek-1',
      email: 'asilbeknuraliyev43@gmail.com',
      emailVerified: true,
      displayName: 'Asilbek Nuraliyev',
    });
    for (const allowedOrigin of allowedOrigins) {
      const originRes = await apiRequest(
        '/api/auth/firebase-sync',
        'POST',
        {
          idToken: originTestToken,
          uid: 'google-uid-asilbek-1',
          email: 'asilbeknuraliyev43@gmail.com',
          emailVerified: true,
        },
        undefined,
        { Origin: allowedOrigin }
      );
      assert.equal(
        originRes.status,
        200,
        `Google sign-in sync from authorized Origin ${allowedOrigin} must succeed (got ${originRes.status})`
      );
      assert.equal(originRes.headers.get('access-control-allow-origin'), allowedOrigin);
    }

    const diagRes = await apiRequest('/api/auth/diagnostics', 'GET', undefined, undefined, {
      Origin: 'https://specialized-study.vercel.app',
    });
    assert.equal(diagRes.status, 200);
    assert.equal(diagRes.data.projectId, 'ivory-receiver-slxdt');
    assert.equal(diagRes.data.corsAllowed, true);
    assert.equal(diagRes.data.authorizedAdminCount, 2);

    const evilCorsRes = await apiRequest('/api/health', 'GET', undefined, undefined, {
      Origin: 'https://malicious-phishing-site.example.com',
    });
    assert.equal(
      evilCorsRes.status,
      403,
      'Cross-origin API request from untrusted domain must be rejected with 403'
    );

    let hit429 = false;
    for (let i = 0; i < 12; i++) {
      const attempt = await apiRequest(
        '/api/auth/login',
        'POST',
        { email: 'alpha.7a1@school.uz', password: `WrongPassword_${i}` },
        undefined,
        {
          'X-Test-Rate-Limit': 'enforce',
          'X-Test-Client-Id': 'bruteforce-client-1',
        }
      );
      if (attempt.status === 429) {
        hit429 = true;
        assert.ok(attempt.headers.get('retry-after'));
        break;
      }
    }
    assert.equal(hit429, true, 'Repeated brute-force login requests must be rate-limited with 429');

    const ownerLogin = await apiRequest('/api/auth/login', 'POST', {
      email: 'asilbeknuraliyev43@gmail.com',
      password: 'OwnerStrongPassword2026!',
    });
    const ownerState = await apiRequest('/api/state', 'GET', undefined, ownerLogin.data.token);
    const hasFailedLoginAlert = ownerState.data.auditLogs.some(
      (log: any) =>
        log.eventType === 'SECURITY_ALERT_REPEATED_FAILED_LOGINS' && log.severity === 'CRITICAL'
    );
    assert.equal(
      hasFailedLoginAlert,
      true,
      'Repeated failed logins must generate a CRITICAL SECURITY_ALERT_REPEATED_FAILED_LOGINS audit entry'
    );
  });

  it('SCENARIO G & H: Functional Regression (19 Official Classes) & Concurrent Load Performance', async () => {
    const ownerLogin = await apiRequest('/api/auth/login', 'POST', {
      email: 'asilbeknuraliyev43@gmail.com',
      password: 'OwnerStrongPassword2026!',
    });
    const ownerToken = ownerLogin.data.token as string;

    const classesRes = await apiRequest('/api/classes', 'GET', undefined, ownerToken);
    assert.equal(classesRes.status, 200);
    const codes = classesRes.data.classes.map((c: any) => c.code);
    assert.equal(codes.length, 19);
    assert.deepEqual(codes, [...OFFICIAL_19_CLASS_CODES]);
    assert.ok(!codes.includes('5t') && !codes.includes('6t'));

    const startMs = Date.now();
    const concurrentPromises = Array.from({ length: 30 }, () =>
      apiRequest('/api/classes', 'GET', undefined, ownerToken)
    );
    const results = await Promise.all(concurrentPromises);
    const elapsedMs = Date.now() - startMs;

    assert.ok(results.every((r) => r.status === 200), 'All 30 concurrent requests must succeed');
    assert.ok(elapsedMs < 3000, `30 concurrent requests completed in ${elapsedMs}ms (< 3000ms)`);
  });
});
