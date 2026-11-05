import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, cert, App as AdminApp } from 'firebase-admin/app';
import { getAuth, Auth as AdminAuth } from 'firebase-admin/auth';
import {
  AUTHORIZED_ADMIN_EMAILS,
  PLATFORM_OWNER_EMAIL,
  SECOND_PLATFORM_ADMIN_EMAIL,
} from '../constants/curriculum';
import { isAuthorizedAdminEmail } from '../utils/security';
import { PersistentDatabaseState, saveDbState } from './dbEngine';

export interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  oAuthClientId?: string;
}

const CONFIG_PATH = path.resolve(process.cwd(), 'firebase-applet-config.json');
const TEST_ID_TOKEN_SECRET = 'specialized-study-isolated-test-jwt-secret-2026';

export function loadFirebaseAppletConfig(): FirebaseAppletConfig {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw) as FirebaseAppletConfig;
}

let cachedAdminApp: AdminApp | null = null;

export function getFirebaseAdminAuth(): AdminAuth {
  if (!cachedAdminApp) {
    const cfg = loadFirebaseAppletConfig();
    const existing = getApps();
    cachedAdminApp =
      existing.length > 0
        ? existing[0]!
        : initializeApp({
            projectId: cfg.projectId,
            ...(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT
              ? { credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT)) }
              : {}),
          });
  }
  return getAuth(cachedAdminApp);
}

export interface VerifiedFirebaseIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
  customClaims: Record<string, unknown>;
  issuedAtSeconds: number;
  expiresAtSeconds: number;
  verificationSource: 'firebase_admin_jwt' | 'identity_toolkit_lookup' | 'isolated_test_token';
}

export function createIsolatedTestFirebaseIdToken(payload: {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  customClaims?: Record<string, unknown>;
  expiresInSeconds?: number;
}): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + (payload.expiresInSeconds ?? 3600);
  const body = {
    uid: payload.uid,
    sub: payload.uid,
    email: String(payload.email || '').trim().toLowerCase(),
    email_verified: payload.emailVerified === true,
    name: payload.displayName || payload.email,
    claims: payload.customClaims || {},
    iat: nowSec,
    exp: expSec,
    iss: `https://securetoken.google.com/${loadFirebaseAppletConfig().projectId}`,
    aud: loadFirebaseAppletConfig().projectId,
  };
  const encoded = Buffer.from(JSON.stringify(body), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', TEST_ID_TOKEN_SECRET)
    .update(`test-fb-jwt.${encoded}`)
    .digest('base64url');
  return `test-fb-jwt.${encoded}.${sig}`;
}

export async function verifyFirebaseIdToken(
  idToken: string | undefined,
  env: 'prod' | 'test',
  db: PersistentDatabaseState
): Promise<{
  valid: boolean;
  identity?: VerifiedFirebaseIdentity;
  errorCode?: string;
  errorMessage?: string;
}> {
  if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
    return {
      valid: false,
      errorCode: 'auth/missing-id-token',
      errorMessage: 'Firebase ID token topilmadi.',
    };
  }

  const trimmed = idToken.trim();

  // 1. In isolated test mode, support deterministic signed test tokens for E2E verification (Tests A-F)
  if (env === 'test' && trimmed.startsWith('test-fb-jwt.')) {
    const parts = trimmed.split('.');
    if (parts.length !== 3) {
      return {
        valid: false,
        errorCode: 'auth/invalid-id-token',
        errorMessage: 'Noto‘g‘ri token formati.',
      };
    }
    const [, encoded, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', TEST_ID_TOKEN_SECRET)
      .update(`test-fb-jwt.${encoded}`)
      .digest('base64url');

    const sigBuf = Buffer.from(sig, 'utf-8');
    const expBuf = Buffer.from(expectedSig, 'utf-8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return {
        valid: false,
        errorCode: 'auth/invalid-credential',
        errorMessage: 'Token imzosi haqiqiy emas.',
      };
    }

    try {
      const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
      const nowSec = Math.floor(Date.now() / 1000);
      if (typeof decoded.exp !== 'number' || decoded.exp <= nowSec) {
        return {
          valid: false,
          errorCode: 'auth/id-token-expired',
          errorMessage: 'Firebase ID token muddati tugagan. Qaytadan tizimga kiring.',
        };
      }
      const uid = String(decoded.uid || decoded.sub || '').trim();
      const email = String(decoded.email || '').trim().toLowerCase();
      if (!uid || !email) {
        return {
          valid: false,
          errorCode: 'auth/invalid-id-token',
          errorMessage: 'Token tarkibida foydalanuvchi identifikatori (UID/Email) mavjud emas.',
        };
      }
      const storedClaims = (db.customClaims && db.customClaims[uid]) || {};
      const mergedClaims = {
        ...storedClaims,
        ...(decoded.claims || {}),
      };
      return {
        valid: true,
        identity: {
          uid,
          email,
          emailVerified: decoded.email_verified === true,
          displayName: decoded.name ? String(decoded.name) : undefined,
          customClaims: mergedClaims,
          issuedAtSeconds: Number(decoded.iat || nowSec),
          expiresAtSeconds: Number(decoded.exp),
          verificationSource: 'isolated_test_token',
        },
      };
    } catch {
      return {
        valid: false,
        errorCode: 'auth/invalid-id-token',
        errorMessage: 'Token ma’lumotlarini o‘qib bo‘lmadi.',
      };
    }
  }

  // 2. Verify real Firebase ID token using Firebase Admin SDK (RS256 public key verification)
  try {
    const adminAuth = getFirebaseAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(trimmed, true);
    const uid = String(decodedToken.uid || decodedToken.sub || '').trim();
    const email = String(decodedToken.email || '').trim().toLowerCase();

    if (!uid || !email) {
      return {
        valid: false,
        errorCode: 'auth/invalid-id-token',
        errorMessage: 'Tasdiqlangan Google hisobida email manzili mavjud emas.',
      };
    }

    // Authorization comes exclusively from the verified Firebase token.
    const customClaims: Record<string, unknown> = {
      platformAdmin: decodedToken.platformAdmin === true,
    };

    return {
      valid: true,
      identity: {
        uid,
        email,
        emailVerified: decodedToken.email_verified === true,
        displayName: decodedToken.name ? String(decodedToken.name) : undefined,
        photoURL: decodedToken.picture ? String(decodedToken.picture) : undefined,
        customClaims,
        issuedAtSeconds: decodedToken.iat,
        expiresAtSeconds: decodedToken.exp,
        verificationSource: 'firebase_admin_jwt',
      },
    };
  } catch (adminErr: any) {
    const code = String(adminErr?.code || '');
    if (code === 'auth/id-token-expired') {
      return {
        valid: false,
        errorCode: code,
        errorMessage: 'Sessiya muddati tugagan. Iltimos, Google orqali qayta kiring.',
      };
    }

    // Fail closed: never revive revoked tokens or local cached privileges.
    return {
      valid: false,
      errorCode: 'auth/invalid-credential',
      errorMessage: 'Firebase hisobini tekshirib bo‘lmadi. Qayta kiring yoki administratorga murojaat qiling.',
    };
  }
}

export interface AdminAccountProvisionStatus {
  email: string;
  existsInFirebaseOrDb: boolean;
  uid: string | null;
  emailVerified: boolean;
  platformAdminClaimAssigned: boolean;
  preservedCustomClaims: Record<string, unknown>;
  firebaseAdminSdkClaimSynced: boolean;
  status: 'active_admin' | 'awaiting_email_verification' | 'awaiting_first_google_login';
  message: string;
}

export async function provisionSingleAdminAccount(
  targetEmail: string,
  env: 'prod' | 'test',
  db: PersistentDatabaseState
): Promise<AdminAccountProvisionStatus> {
  const normalizedEmail = String(targetEmail || '').trim().toLowerCase();
  if (!isAuthorizedAdminEmail(normalizedEmail)) {
    throw new Error(`Unauthorized administrator email: ${normalizedEmail}`);
  }

  if (!db.customClaims) {
    db.customClaims = {};
  }

  let fbUserRecord: {
    uid: string;
    email: string;
    emailVerified: boolean;
    displayName?: string;
    customClaims?: Record<string, unknown>;
  } | null = null;
  let firebaseAdminSdkClaimSynced = false;

  // Try looking up the user in Firebase Auth via Firebase Admin SDK first
  if (env === 'prod') {
    try {
      const adminAuth = getFirebaseAdminAuth();
      const userRec = await adminAuth.getUserByEmail(normalizedEmail);
      fbUserRecord = {
        uid: userRec.uid,
        email: (userRec.email || normalizedEmail).toLowerCase(),
        emailVerified: userRec.emailVerified,
        displayName: userRec.displayName || undefined,
        customClaims: (userRec.customClaims as Record<string, unknown>) || {},
      };
    } catch {
      // Service account IAM may not be attached in preview container; fall back to verified DB user record
    }
  }

  const dbUser = db.users.find((u) => u.email.trim().toLowerCase() === normalizedEmail);
  const resolvedUid = fbUserRecord?.uid || dbUser?.uid || null;

  if (!resolvedUid) {
    return {
      email: normalizedEmail,
      existsInFirebaseOrDb: false,
      uid: null,
      emailVerified: false,
      platformAdminClaimAssigned: false,
      preservedCustomClaims: {},
      firebaseAdminSdkClaimSynced: false,
      status: 'awaiting_first_google_login',
      message: `${normalizedEmail} hali Google orqali tizimga kirmagan. Haqiqiy Firebase UID yaratilishi uchun foydalanuvchi avval «Google bilan kirish» tugmasi orqali autentifikatsiyadan o‘tishi shart.`,
    };
  }

  const isEmailVerified =
    fbUserRecord !== null ? fbUserRecord.emailVerified : dbUser?.emailVerified === true;

  if (!isEmailVerified) {
    return {
      email: normalizedEmail,
      existsInFirebaseOrDb: true,
      uid: resolvedUid,
      emailVerified: false,
      platformAdminClaimAssigned: false,
      preservedCustomClaims: db.customClaims[resolvedUid] || {},
      firebaseAdminSdkClaimSynced: false,
      status: 'awaiting_email_verification',
      message: `${normalizedEmail} hisobi mavjud (UID: ${resolvedUid}), biroq elektron pochta tasdiqlanmagan (emailVerified=false).`,
    };
  }

  // Preserve existing unrelated custom claims and assign platformAdmin: true
  const existingClaims: Record<string, unknown> = {
    ...(db.customClaims[resolvedUid] || {}),
    ...(fbUserRecord?.customClaims || {}),
  };
  const updatedClaims: Record<string, unknown> = {
    ...existingClaims,
    platformAdmin: true,
  };
  db.customClaims[resolvedUid] = updatedClaims;

  // Attempt to set custom claims in Firebase Auth via Admin SDK if IAM permits
  if (env === 'prod') {
    try {
      const adminAuth = getFirebaseAdminAuth();
      await adminAuth.setCustomUserClaims(resolvedUid, updatedClaims);
      const verifiedRec = await adminAuth.getUser(resolvedUid);
      firebaseAdminSdkClaimSynced = verifiedRec.customClaims?.platformAdmin === true;
    } catch {
      firebaseAdminSdkClaimSynced = false;
    }
  }

  const nowIso = new Date().toISOString();
  const instId = db.institutions[0]?.id || 'inst-specialized-study';

  if (dbUser) {
    dbUser.uid = resolvedUid;
    dbUser.role = 'platform_owner';
    dbUser.platformOwner = true;
    dbUser.platformAdmin = true;
    dbUser.emailVerified = true;
    dbUser.status = 'active';
    dbUser.updatedAt = nowIso;
  } else if (fbUserRecord) {
    db.users.push({
      uid: resolvedUid,
      displayName:
        fbUserRecord.displayName ||
        (normalizedEmail === PLATFORM_OWNER_EMAIL ? 'Asilbek Nuraliyev' : 'Bahodir Boliqulov'),
      email: normalizedEmail,
      emailVerified: true,
      platformOwner: true,
      platformAdmin: true,
      role: 'platform_owner',
      institutionId: instId,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  db.auditLogs.unshift({
    id: `audit-prov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    institutionId: instId,
    actorUid: resolvedUid,
    actorName: normalizedEmail,
    actorRole: 'platform_owner',
    action: `Platform Admin custom claim (platformAdmin: true) tasdiqlandi: ${normalizedEmail}`,
    target: normalizedEmail,
    recordId: resolvedUid,
    status: 'success',
    eventType: 'ADMIN_CLAIM_PROVISIONED',
    outcome: 'success',
    severity: 'INFO',
    createdAt: nowIso,
  });

  saveDbState(env, db);

  return {
    email: normalizedEmail,
    existsInFirebaseOrDb: true,
    uid: resolvedUid,
    emailVerified: true,
    platformAdminClaimAssigned: updatedClaims.platformAdmin === true,
    preservedCustomClaims: updatedClaims,
    firebaseAdminSdkClaimSynced,
    status: 'active_admin',
    message: `${normalizedEmail} uchun platformAdmin: true ruxsati muvaffaqiyatli biriktirildi (UID: ${resolvedUid}).`,
  };
}

export async function provisionAuthorizedAdmins(
  env: 'prod' | 'test',
  db: PersistentDatabaseState
): Promise<{
  admins: AdminAccountProvisionStatus[];
  allowlist: readonly string[];
  timestamp: string;
}> {
  const results: AdminAccountProvisionStatus[] = [];
  for (const adminEmail of AUTHORIZED_ADMIN_EMAILS) {
    const res = await provisionSingleAdminAccount(adminEmail, env, db);
    results.push(res);
  }
  return {
    admins: results,
    allowlist: AUTHORIZED_ADMIN_EMAILS,
    timestamp: new Date().toISOString(),
  };
}

export { AUTHORIZED_ADMIN_EMAILS, PLATFORM_OWNER_EMAIL, SECOND_PLATFORM_ADMIN_EMAIL };
