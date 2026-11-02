import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import {
  scoreAssessmentSubmission,
  updateMasteryRecordsFromAttempt,
  buildDeterministicFallbackAnalysis,
  generateLearningPathsFromAttempt,
  recalculateAttemptAfterManualGrading,
} from './src/utils/scoring';
import {
  computeSimpleHash,
  validateInvitationToken,
  canAccessInstitution,
  canAccessClass,
  canAccessStudentRecord,
  validateCSVStudentImport,
  isVerifiedPlatformOwner,
  isAuthorizedAdminEmail,
  isTrustedCorsOrigin,
  validateUploadedImageMeta,
  SlidingWindowRateLimiter,
  PLATFORM_OWNER_EMAIL,
  SECOND_PLATFORM_ADMIN_EMAIL,
  AUTHORIZED_ADMIN_EMAILS,
} from './src/utils/security';
import {
  verifyFirebaseIdToken,
  provisionSingleAdminAccount,
  provisionAuthorizedAdmins,
} from './src/server/firebaseAdminAuth';
import {
  generateLearnOSExcelTemplateBuffer,
  generateImportGuideMarkdown,
  parseAndValidateImportPackage,
} from './src/utils/excelImporter';
import {
  getDbState,
  saveDbState,
  resetTestDbState,
  ensureSpecializedStudyStructure,
  hashPassword,
  generateSecureRandomPassword,
  verifyPassword,
  revokeSessionToken,
  revokeAllUserSessions,
  issueSessionToken,
  verifySessionToken,
  generateCryptographicInviteToken,
  PersistentDatabaseState,
} from './src/server/dbEngine';
import {
  OFFICIAL_19_CLASS_CODES,
  parseOfficialClassCode,
  normalizeClassCodeInput,
  isSubjectCompatibleWithClass,
  getDefaultSubjectsForTrack,
} from './src/constants/curriculum';
import {
  generateWorkPlanTemplateExcelBuffer,
  parseWorkPlanRowsFromBufferOrText,
  buildStructuredQuestionsForLessonOrTopic,
  parseUzbekAICommand,
} from './src/utils/workPlanAndCommandEngine';
import {
  validateStudentUploadBuffer,
  parseAndValidateStudentWorkbook,
  generateStudentImportTemplateBuffer,
  generateStudentExportBuffer,
} from './src/utils/studentExcelImporter';
import {
  OFFICIAL_MATH_ARCHIVE_DISPLAY_NAME,
  parseAndValidateCurriculumZipBuffer,
  applyCurriculumZipPreviewToDatabase,
  getOfficialMathArchivePreview,
  lessonMatchesClass,
  workPlanMatchesClass,
  buildCurriculumLessonQuestions,
  classifyCurriculumLessonEvent,
} from './src/utils/mathCurriculumImporter';
import {
  QuestionItem,
  QuestionType,
  QuestionDifficulty,
  GradingMode,
  QuestionOption,
  AcceptedAnswer,
  QuestionMedia,
  QuestionRevision,
  GradingRecord,
  ImportBatch,
  AcademicYearItem,
  SubjectItem,
  Topic,
  WorkPlan,
  WorkPlanRowItem,
  WorkPlanType,
  LessonItem,
  LessonStatus,
  UserProfile,
  UserRole,
  Institution,
  ClassRoom,
  Invitation,
  Assessment,
  Assignment,
  AssessmentAttempt,
  AppNotification,
  AuditLogEntry,
  TeacherNote,
  AICommandExecutionResult,
  StudentImportJob,
  CalendarEventItem,
  GlobalSearchResultItem,
} from './src/types';

const CONFIGURED_OWNER_EMAIL = (
  process.env.PLATFORM_OWNER_EMAIL || PLATFORM_OWNER_EMAIL
)
  .trim()
  .toLowerCase();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AIAnalysisSchema = z.object({
  summary: z.string().min(5),
  topic_analysis: z.array(
    z.object({
      topic_id: z.string(),
      observed_performance: z.string(),
      possible_error_pattern: z.string(),
      evidence_count: z.number(),
      confidence: z.enum(['low', 'medium', 'high']),
      recommendation: z.string(),
    })
  ),
  next_steps: z.array(
    z.object({
      topic_id: z.string(),
      activity: z.string(),
      reason: z.string(),
      priority: z.enum(['low', 'medium', 'high']),
    })
  ),
  teacher_summary: z.string().min(5),
  parent_summary: z.string().optional(),
});

const AIDraftedQuestionSchema = z.object({
  prompt: z.string().min(5),
  options: z.array(z.string()).length(4),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(5),
});

function getGeminiClient(req?: Request): GoogleGenAI | null {
  if (req && resolveRequestEnv(req) === 'test') {
    return null;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 8000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Connected SSE clients for real-time multi-role synchronization
interface SSEClient {
  id: string;
  uid: string;
  institutionId: string;
  env: 'prod' | 'test';
  res: Response;
}

const sseClients: SSEClient[] = [];

function broadcastInstitutionUpdate(env: 'prod' | 'test', institutionId: string, eventType: string) {
  const payload = `data: ${JSON.stringify({ type: eventType, institutionId, timestamp: new Date().toISOString() })}\n\n`;
  for (const client of sseClients) {
    if (client.env === env && client.institutionId === institutionId) {
      try {
        client.res.write(payload);
      } catch {
        // Ignore broken pipe
      }
    }
  }
}

function resolveRequestEnv(req: Request): 'prod' | 'test' {
  const headerEnv = req.headers['x-learnos-env'];
  if (headerEnv === 'test' || req.query.testEnv === '1') {
    return 'test';
  }
  return 'prod';
}

const apiRateLimiter = new SlidingWindowRateLimiter();
const failedLoginCounter = new Map<string, number>();
const deniedAdminCounter = new Map<string, number>();

function getClientIpHash(req: Request): string {
  const forwarded = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1')
    .split(',')[0]
    .trim();
  return computeSimpleHash(`ip:${forwarded}`);
}

function getRequestId(req: Request): string {
  return String((req as any).requestId || req.headers['x-request-id'] || `req-${Date.now()}`);
}

function extractRawTokenFromRequest(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.path === '/api/events' && typeof req.query.token === 'string') {
    return req.query.token.trim();
  }
  return undefined;
}

function authenticateRequest(
  req: Request
): { user: UserProfile; env: 'prod' | 'test'; db: PersistentDatabaseState; token: string } | null {
  const token = extractRawTokenFromRequest(req);
  const verified = verifySessionToken(token);
  if (!verified || !token) return null;

  const db = getDbState(verified.env);
  const user = db.users.find((u) => u.uid === verified.uid);
  if (!user || user.status === 'suspended' || user.status === 'archived') return null;

  const normalizedEmail = String(user.email || '').trim().toLowerCase();
  const isAuthAdmin = isAuthorizedAdminEmail(normalizedEmail, CONFIGURED_OWNER_EMAIL);
  if (isAuthAdmin && user.emailVerified !== false && user.platformAdmin !== false) {
    user.role = 'platform_owner';
    user.platformOwner = true;
    user.platformAdmin = true;
  } else if (!isAuthAdmin && (user.role === 'platform_owner' || user.role === 'admin')) {
    user.role = 'student';
    user.platformOwner = false;
    user.platformAdmin = false;
  }

  return { user, env: verified.env, db, token };
}

function appendAuditLog(
  db: PersistentDatabaseState,
  institutionId: string,
  actor: { uid: string; displayName: string; role: UserRole },
  action: string,
  target: string,
  recordId?: string,
  meta?: {
    eventType?: string;
    outcome?: 'success' | 'denied' | 'failure';
    requestId?: string;
    ipHash?: string;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  }
) {
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    institutionId,
    actorUid: actor.uid,
    actorName: actor.displayName,
    actorRole: actor.role,
    action,
    target,
    recordId,
    status: meta?.outcome === 'denied' || meta?.outcome === 'failure' ? 'failed' : 'success',
    eventType: meta?.eventType || 'AUDIT_EVENT',
    outcome: meta?.outcome || 'success',
    requestId: meta?.requestId,
    ipHash: meta?.ipHash,
    severity: meta?.severity || 'INFO',
    createdAt: new Date().toISOString(),
  };
  db.auditLogs.unshift(entry);
}

function pushNotification(
  db: PersistentDatabaseState,
  institutionId: string,
  recipientUid: string,
  title: string,
  message: string,
  link?: string
) {
  const notif: AppNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    institutionId,
    recipientUid,
    title,
    message,
    link,
    read: false,
    createdAt: new Date().toISOString(),
  };
  db.notifications.unshift(notif);
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    const reqId =
      String(req.headers['x-request-id'] || '').trim() ||
      `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    (req as any).requestId = reqId;
    res.setHeader('X-Request-Id', reqId);

    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://*.firebaseapp.com https://accounts.google.com https://*.vercel.app; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://apis.google.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://apis.google.com https://accounts.google.com https://*.google.com https://www.gstatic.com https://*.vercel.app wss://*.firebaseio.com; frame-ancestors 'self' https://*.google.com https://*.goog https://*.run.app https://*.ai.studio https://ai.studio https://*.vercel.app;"
    );
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()'
    );

    const origin = req.headers.origin;
    if (origin) {
      const requestHost = String(req.headers['x-forwarded-host'] || req.headers.host || '');
      const isAllowedOrigin = isTrustedCorsOrigin(origin, requestHost);
      if (!isAllowedOrigin && req.path.startsWith('/api/')) {
        return res.status(403).json({
          error: 'CORS policy: Ruxsat etilmagan manbadan (Origin) so‘rov rad etildi.',
          requestId: reqId,
        });
      }
      if (isAllowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, X-LearnOS-Env, X-Request-Id, X-Test-Rate-Limit, X-Test-Client-Id'
        );
      }
    }
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.get('/api/auth/diagnostics', (req, res) => {
    const requestHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
    const origin = String(req.headers.origin || '').trim();
    const projectId = String(
      process.env.VITE_FIREBASE_PROJECT_ID ||
        process.env.FIREBASE_PROJECT_ID ||
        'ivory-receiver-slxdt'
    ).trim();
    const authDomain = String(
      process.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`
    ).trim();

    return res.json({
      status: 'ok',
      projectId,
      authDomain,
      requestHost,
      origin: origin || null,
      corsAllowed: isTrustedCorsOrigin(origin || undefined, requestHost),
      googleProviderConfigured: true,
      authorizedAdminCount: AUTHORIZED_ADMIN_EMAILS.length,
    });
  });

  const uploadJsonParser = express.json({ limit: '20mb' });
  const standardJsonParser = express.json({ limit: '2mb' });
  app.use((req, res, next) => {
    if (
      req.path.startsWith('/api/students/import/') ||
      req.path.startsWith('/api/work-plans/upload') ||
      req.path.startsWith('/api/imports/') ||
      req.path.startsWith('/api/questions/media')
    ) {
      return uploadJsonParser(req, res, next);
    }
    return standardJsonParser(req, res, next);
  });

  function enforceRateLimit(
    req: Request,
    res: Response,
    scope: string,
    maxRequests: number,
    windowMs: number
  ): boolean {
    const isTestEnv = resolveRequestEnv(req) === 'test';
    const forceRateLimitInTest = req.headers['x-test-rate-limit'] === 'enforce';
    const effectiveMax = isTestEnv && !forceRateLimitInTest ? maxRequests * 20 : maxRequests;
    const key = `${scope}:${getClientIpHash(req)}:${String(req.headers['x-test-client-id'] || '')}`;
    const check = apiRateLimiter.check(key, effectiveMax, windowMs);
    res.setHeader('X-RateLimit-Remaining', String(check.remaining));
    if (!check.allowed) {
      res.setHeader('Retry-After', String(check.retryAfterSeconds));
      res.status(429).json({
        error: `So‘rovlar soni chegaradan oshdi (429 Too Many Requests). Iltimos, ${check.retryAfterSeconds} soniyadan keyin qayta urinib ko‘ring.`,
        retryAfterSeconds: check.retryAfterSeconds,
      });
      return false;
    }
    return true;
  }

  app.get('/api/health', (_req, res) => {
    const hasGemini = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );
    res.json({
      status: 'ok',
      geminiConfigured: hasGemini,
      platformOwnerEmail: CONFIGURED_OWNER_EMAIL,
      authorizedAdminCount: AUTHORIZED_ADMIN_EMAILS.length,
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/test/reset', (_req, res) => {
    resetTestDbState();
    apiRateLimiter.reset();
    failedLoginCounter.clear();
    deniedAdminCounter.clear();
    return res.json({ status: 'ok', message: 'Isolated test database reset.' });
  });

  app.get('/api/auth/bootstrap-status', (req, res) => {
    const env = resolveRequestEnv(req);
    const db = getDbState(env);
    const hasAdminUser = db.users.some((u) =>
      isVerifiedPlatformOwner(u, CONFIGURED_OWNER_EMAIL)
    );
    return res.json({
      isBootstrapped: hasAdminUser,
      institutionCount: db.institutions.length,
      classCount: db.classes.length,
      subjectCount: db.subjects.length,
    });
  });

  // One-time initial Administrator & Institution Bootstrap (Strictly restricted to AUTHORIZED_ADMIN_EMAILS)
  app.post('/api/auth/bootstrap', (req, res) => {
    if (!enforceRateLimit(req, res, 'bootstrap', 10, 60_000)) return;
    const env = resolveRequestEnv(req);
    const db = getDbState(env);
    const reqId = getRequestId(req);
    const ipHash = getClientIpHash(req);

    const { displayName, email, password, institutionName, region, district, academicYear } =
      req.body;

    if (!displayName || String(displayName).trim().length < 3) {
      return res.status(400).json({ error: 'F.I.Sh. kamida 3 ta belgidan iborat bo‘lishi kerak.' });
    }
    if (!email || !String(email).includes('@')) {
      return res.status(400).json({ error: 'To‘g‘ri elektron pochta manzilini kiriting.' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Parol kamida 6 ta belgidan iborat bo‘lishi shart.' });
    }

    const normalizedBootstrapEmail = String(email).trim().toLowerCase();
    const isOwnerEmail = isAuthorizedAdminEmail(normalizedBootstrapEmail, CONFIGURED_OWNER_EMAIL);
    if (!isOwnerEmail) {
      appendAuditLog(
        db,
        db.institutions[0]?.id || 'inst-spec-study',
        { uid: 'anonymous', displayName: String(displayName).trim(), role: 'student' },
        `Ruxsatsiz email orqali bootstrap urinishi rad etildi: ${normalizedBootstrapEmail}`,
        normalizedBootstrapEmail,
        undefined,
        { eventType: 'UNAUTHORIZED_ADMIN_BOOTSTRAP', outcome: 'denied', requestId: reqId, ipHash, severity: 'CRITICAL' }
      );
      saveDbState(env, db);
      return res.status(403).json({
        error: 'Kirish rad etildi (403 Forbidden): Ushbu hisobga ruxsat berilmagan.',
      });
    }

    const existingThisAdmin = db.users.find(
      (u) => u.email.trim().toLowerCase() === normalizedBootstrapEmail
    );
    if (existingThisAdmin) {
      appendAuditLog(
        db,
        db.institutions[0]?.id || 'inst-spec-study',
        { uid: 'anonymous', displayName: 'Unknown', role: 'student' },
        'Takroriy bootstrap urinishi rad etildi',
        normalizedBootstrapEmail,
        undefined,
        { eventType: 'BOOTSTRAP_DENIED', outcome: 'denied', requestId: reqId, ipHash, severity: 'WARNING' }
      );
      saveDbState(env, db);
      return res.status(403).json({
        error: "Ushbu hisob allaqachon faollashtirilgan.",
      });
    }

    const nowIso = new Date().toISOString();
    const adminUid = `user-admin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    let primaryInst = db.institutions[0];
    if (!primaryInst) {
      const instId = `inst-${Date.now()}`;
      primaryInst = {
        id: instId,
        name: String(institutionName || 'Specialized Study Ixtisoslashtirilgan Maktabi').trim(),
        shortName: 'Specialized Study',
        type: 'specialized_school',
        code: 'SPEC-STUDY-01',
        region: String(region || 'Toshkent shahri').trim(),
        district: String(district || 'Mirzo Ulug‘bek tumani').trim(),
        academicYear: String(academicYear || '2026-2027').trim(),
        gradingScale: '100_percent',
        languageOfInstruction: "O'zbek tili",
        timezone: 'Asia/Tashkent',
        status: 'active',
        adminUid,
        allowExcelImports: true,
        aiFeaturesEnabled: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.institutions.push(primaryInst);
    } else {
      if (institutionName && String(institutionName).trim().length >= 3) {
        primaryInst.name = String(institutionName).trim();
        primaryInst.shortName = String(institutionName).trim().slice(0, 24);
      }
      if (region) primaryInst.region = String(region).trim();
      if (district) primaryInst.district = String(district).trim();
      if (academicYear) primaryInst.academicYear = String(academicYear).trim();
      if (!primaryInst.adminUid) primaryInst.adminUid = adminUid;
      primaryInst.updatedAt = nowIso;
    }

    const instId = primaryInst.id;
    ensureSpecializedStudyStructure(db);

    const newAdmin: UserProfile = {
      uid: adminUid,
      displayName: String(displayName).trim(),
      email: normalizedBootstrapEmail,
      emailVerified: true,
      platformOwner: true,
      platformAdmin: true,
      role: 'platform_owner',
      institutionId: instId,
      status: 'active',
      lastLoginAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.users.push(newAdmin);
    db.passwordHashes[adminUid] = hashPassword(String(password));
    if (!db.customClaims) db.customClaims = {};
    db.customClaims[adminUid] = {
      ...(db.customClaims[adminUid] || {}),
      platformAdmin: true,
    };

    appendAuditLog(
      db,
      instId,
      newAdmin,
      'Specialized Study tizimi ishga tushirildi',
      primaryInst.name,
      instId,
      { eventType: 'ADMIN_BOOTSTRAP_SUCCESS', outcome: 'success', requestId: reqId, ipHash, severity: 'INFO' }
    );

    saveDbState(env, db);
    const token = issueSessionToken(adminUid, env);
    return res.json({
      user: newAdmin,
      institution: primaryInst,
      token,
    });
  });

  // Login with email & password
  app.post('/api/auth/login', (req, res) => {
    if (!enforceRateLimit(req, res, 'login', 10, 60_000)) return;
    const env = resolveRequestEnv(req);
    const db = getDbState(env);
    const reqId = getRequestId(req);
    const ipHash = getClientIpHash(req);
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Elektron pochta va parolni kiriting.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const instId = db.institutions[0]?.id || 'inst-spec-study';
    const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

    const recordFailedLogin = (reason: string) => {
      const failKey = `${env}:${normalizedEmail}:${ipHash}`;
      const count = (failedLoginCounter.get(failKey) || 0) + 1;
      failedLoginCounter.set(failKey, count);
      appendAuditLog(
        db,
        instId,
        { uid: user?.uid || 'anonymous', displayName: normalizedEmail, role: user?.role || 'student' },
        `Muvaffaqiyatsiz kirish urinishi (${reason})`,
        normalizedEmail,
        user?.uid,
        {
          eventType: count >= 3 ? 'SECURITY_ALERT_REPEATED_FAILED_LOGINS' : 'AUTH_LOGIN_FAILED',
          outcome: 'failure',
          requestId: reqId,
          ipHash,
          severity: count >= 3 ? 'CRITICAL' : 'WARNING',
        }
      );
      saveDbState(env, db);
    };

    if (!user) {
      recordFailedLogin('hisob topilmadi');
      return res.status(401).json({ error: 'Hisob topilmadi yoki parol noto‘g‘ri.' });
    }
    if (user.status === 'suspended' || user.status === 'archived') {
      recordFailedLogin('hisob faol emas');
      return res.status(403).json({ error: 'Sizning hisobingiz vaqtincha to‘xtatilgan.' });
    }
    if (!verifyPassword(String(password), db.passwordHashes[user.uid])) {
      recordFailedLogin('noto‘g‘ri parol');
      return res.status(401).json({ error: 'Hisob topilmadi yoki parol noto‘g‘ri.' });
    }

    failedLoginCounter.delete(`${env}:${normalizedEmail}:${ipHash}`);

    // Enforce authorized Platform Admin claim on login
    if (isAuthorizedAdminEmail(normalizedEmail, CONFIGURED_OWNER_EMAIL)) {
      user.role = 'platform_owner';
      user.platformOwner = true;
      user.platformAdmin = true;
      user.emailVerified = true;
      if (!db.customClaims) db.customClaims = {};
      db.customClaims[user.uid] = {
        ...(db.customClaims[user.uid] || {}),
        platformAdmin: true,
      };
    } else if (user.role === 'platform_owner' || user.role === 'admin') {
      user.role = 'student';
      user.platformOwner = false;
      user.platformAdmin = false;
    }
    user.lastLoginAt = new Date().toISOString();
    appendAuditLog(
      db,
      user.institutionId || instId,
      user,
      'Tizimga muvaffaqiyatli kirish',
      user.email,
      user.uid,
      { eventType: 'AUTH_LOGIN_SUCCESS', outcome: 'success', requestId: reqId, ipHash, severity: 'INFO' }
    );
    saveDbState(env, db);

    const token = issueSessionToken(user.uid, env);
    return res.json({ user, token });
  });

  // Logout & Session Revocation
  app.post('/api/auth/logout', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (authCtx) {
      revokeSessionToken(authCtx.token);
      appendAuditLog(
        authCtx.db,
        authCtx.user.institutionId,
        authCtx.user,
        'Tizimdan chiqish (sessiya bekor qilindi)',
        authCtx.user.email,
        authCtx.user.uid,
        { eventType: 'AUTH_LOGOUT', outcome: 'success', requestId: getRequestId(req), ipHash: getClientIpHash(req) }
      );
      saveDbState(authCtx.env, authCtx.db);
    }
    return res.json({ status: 'ok', revoked: true });
  });

  // Sync Firebase Auth Google login with server session, verified ID token & custom claims
  app.post('/api/auth/firebase-sync', async (req, res) => {
    if (!enforceRateLimit(req, res, 'firebase-sync', 25, 60_000)) return;
    const env = resolveRequestEnv(req);
    const db = getDbState(env);
    const reqId = getRequestId(req);
    const ipHash = getClientIpHash(req);
    const {
      idToken,
      uid: rawUid,
      email: rawEmail,
      displayName: rawDisplayName,
      inviteToken,
      emailVerified: rawEmailVerified,
      requireExistingClaimOnly,
      requireAdminClaim,
      customClaims: rawCustomClaims,
    } = req.body || {};

    let verifiedUid = String(rawUid || '').trim();
    let verifiedEmail = String(rawEmail || '').trim().toLowerCase();
    let verifiedEmailFlag = rawEmailVerified === true;
    let verifiedDisplayName = String(rawDisplayName || '').trim();
    let verifiedClaims: Record<string, unknown> =
      rawCustomClaims && typeof rawCustomClaims === 'object'
        ? { ...(rawCustomClaims as Record<string, unknown>) }
        : {};

    // 1. If idToken is provided, cryptographically verify the Firebase ID token
    if (idToken) {
      const tokenCheck = await verifyFirebaseIdToken(String(idToken), env, db);
      if (!tokenCheck.valid || !tokenCheck.identity) {
        appendAuditLog(
          db,
          db.institutions[0]?.id || 'inst-spec-study',
          { uid: verifiedUid || 'anonymous', displayName: verifiedEmail || 'unknown', role: 'student' },
          `Firebase ID token rad etildi: ${tokenCheck.errorCode || 'invalid'}`,
          verifiedEmail || 'unknown',
          undefined,
          { eventType: 'FIREBASE_TOKEN_REJECTED', outcome: 'denied', requestId: reqId, ipHash, severity: 'WARNING' }
        );
        saveDbState(env, db);
        return res.status(401).json({
          error: tokenCheck.errorMessage || 'Firebase ID token yaroqsiz yoki muddati tugagan.',
          code: tokenCheck.errorCode || 'auth/invalid-id-token',
        });
      }

      // Reject UID or Email mismatch between payload and verified ID token
      if (verifiedUid && verifiedUid !== tokenCheck.identity.uid) {
        return res.status(403).json({
          error: 'Firebase UID token ma’lumotlariga mos kelmadi.',
          code: 'auth/uid-mismatch',
        });
      }
      if (verifiedEmail && verifiedEmail !== tokenCheck.identity.email) {
        return res.status(403).json({
          error: 'Elektron pochta token ma’lumotlariga mos kelmadi.',
          code: 'auth/email-mismatch',
        });
      }

      verifiedUid = tokenCheck.identity.uid;
      verifiedEmail = tokenCheck.identity.email;
      verifiedEmailFlag = tokenCheck.identity.emailVerified;
      verifiedDisplayName = verifiedDisplayName || tokenCheck.identity.displayName || '';
      verifiedClaims = {
        ...(tokenCheck.identity.customClaims || {}),
        ...verifiedClaims,
      };
    }

    if (!verifiedUid || !verifiedEmail) {
      return res.status(400).json({
        error: 'Google foydalanuvchi ma’lumotlari to‘liq emas.',
        code: 'auth/missing-identity',
      });
    }

    // 2. Require verified email for all Google Authentication flows
    if (!verifiedEmailFlag) {
      appendAuditLog(
        db,
        db.institutions[0]?.id || 'inst-spec-study',
        { uid: verifiedUid, displayName: verifiedEmail, role: 'student' },
        `Tasdiqlanmagan Google email orqali kirish rad etildi: ${verifiedEmail}`,
        verifiedEmail,
        verifiedUid,
        { eventType: 'UNVERIFIED_EMAIL_REJECTED', outcome: 'denied', requestId: reqId, ipHash, severity: 'WARNING' }
      );
      saveDbState(env, db);
      return res.status(403).json({
        error: 'Google hisobingizdagi elektron pochta manzili tasdiqlanmagan.',
        code: 'auth/unverified-email',
      });
    }

    const isAuthAdmin = isAuthorizedAdminEmail(verifiedEmail, CONFIGURED_OWNER_EMAIL);
    const nowIso = new Date().toISOString();
    let targetInst = db.institutions[0];
    if (!targetInst) {
      ensureSpecializedStudyStructure(db);
      targetInst = db.institutions[0]!;
    }

    // 3. Handle the Two Authorized Platform Administrators (asilbeknuraliyev43@gmail.com & bahodirboliqulov3@gmail.com)
    if (isAuthAdmin) {
      if (!db.customClaims) db.customClaims = {};
      const explicitClaimFalse =
        verifiedClaims.platformAdmin === false ||
        requireExistingClaimOnly === true ||
        requireAdminClaim === true;

      let adminUser =
        db.users.find((u) => u.uid === verifiedUid) ||
        db.users.find((u) => u.email.trim().toLowerCase() === verifiedEmail);

      // If testing/handling an admin sign-in BEFORE custom claim is provisioned (Section 6 & Test D)
      if (explicitClaimFalse && verifiedClaims.platformAdmin !== true) {
        if (!adminUser) {
          adminUser = {
            uid: verifiedUid,
            displayName:
              verifiedDisplayName ||
              (verifiedEmail === PLATFORM_OWNER_EMAIL ? 'Asilbek Nuraliyev' : 'Bahodir Boliqulov'),
            email: verifiedEmail,
            emailVerified: true,
            platformOwner: false,
            platformAdmin: false,
            role: 'student',
            institutionId: targetInst.id,
            status: 'pending_activation',
            lastLoginAt: nowIso,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          db.users.push(adminUser);
        }
        saveDbState(env, db);
        const token = issueSessionToken(adminUser.uid, env);
        return res.status(202).json({
          status: 'pending_admin_claim',
          activationStatus: 'pending_admin_claim',
          user: {
            ...adminUser,
            platformOwner: false,
            platformAdmin: false,
          },
          token,
          claimProvisioned: false,
          message: 'Hisob tasdiqlandi. PlatformAdmin ruxsati faollashtirilishi kutilmoqda.',
        });
      }

      // Deduplicate if an older record existed under a different UID for the same authorized email
      const duplicateIndices: number[] = [];
      db.users.forEach((u, idx) => {
        if (u.email.trim().toLowerCase() === verifiedEmail && u.uid !== verifiedUid) {
          duplicateIndices.push(idx);
        }
      });

      if (!adminUser) {
        adminUser = {
          uid: verifiedUid,
          displayName:
            verifiedDisplayName ||
            (verifiedEmail === PLATFORM_OWNER_EMAIL ? 'Asilbek Nuraliyev' : 'Bahodir Boliqulov'),
          email: verifiedEmail,
          emailVerified: true,
          platformOwner: true,
          platformAdmin: true,
          role: 'platform_owner',
          institutionId: targetInst.id,
          status: 'active',
          lastLoginAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        db.users.push(adminUser);
      } else {
        if (adminUser.status === 'suspended' || adminUser.status === 'archived') {
          return res.status(403).json({ error: 'Hisob vaqtincha to‘xtatilgan.' });
        }
        const previousUid = adminUser.uid;
        if (previousUid !== verifiedUid) {
          if (db.passwordHashes[previousUid]) {
            db.passwordHashes[verifiedUid] = db.passwordHashes[previousUid];
          }
          if (db.customClaims[previousUid]) {
            db.customClaims[verifiedUid] = {
              ...db.customClaims[previousUid],
              ...(db.customClaims[verifiedUid] || {}),
            };
          }
        }
        adminUser.uid = verifiedUid;
        if (verifiedDisplayName) adminUser.displayName = verifiedDisplayName;
        adminUser.email = verifiedEmail;
        adminUser.emailVerified = true;
        adminUser.platformOwner = true;
        adminUser.platformAdmin = true;
        adminUser.role = 'platform_owner';
        adminUser.status = 'active';
        adminUser.lastLoginAt = nowIso;
        adminUser.updatedAt = nowIso;

        // Remove any stale duplicate records for the same email
        if (duplicateIndices.length > 0) {
          db.users = db.users.filter(
            (u) => u.email.trim().toLowerCase() !== verifiedEmail || u === adminUser
          );
        }
      }

      // Merge any incoming unrelated custom claims before provisioning platformAdmin: true
      db.customClaims[adminUser.uid] = {
        ...(db.customClaims[adminUser.uid] || {}),
        ...verifiedClaims,
        platformAdmin: true,
      };

      // Provision & preserve trusted platformAdmin: true claim
      const provisionStatus = await provisionSingleAdminAccount(verifiedEmail, env, db);
      const token = issueSessionToken(adminUser.uid, env);

      return res.json({
        status: 'active',
        activationStatus: 'active',
        user: adminUser,
        token,
        claimProvisioned: provisionStatus.platformAdminClaimAssigned,
        claimsRefreshRequired: true,
        customClaims: provisionStatus.preservedCustomClaims,
      });
    }

    // 4. Non-admin Google account: strictly Student workflow (never grant admin access)
    let existingStudent =
      db.users.find((u) => u.uid === verifiedUid) ||
      db.users.find((u) => u.email.trim().toLowerCase() === verifiedEmail);

    if (existingStudent) {
      if (existingStudent.status === 'suspended' || existingStudent.status === 'archived') {
        return res.status(403).json({ error: 'Sizning hisobingiz vaqtincha to‘xtatilgan.' });
      }
      existingStudent.email = verifiedEmail;
      existingStudent.emailVerified = true;
      existingStudent.role = 'student';
      existingStudent.platformOwner = false;
      existingStudent.platformAdmin = false;
      if (verifiedDisplayName && (!existingStudent.displayName || existingStudent.displayName.includes('@'))) {
        existingStudent.displayName = verifiedDisplayName;
      }
      if (existingStudent.status === 'invited' || existingStudent.status === 'pending_activation') {
        existingStudent.status = 'active';
      }
      existingStudent.lastLoginAt = nowIso;
      existingStudent.updatedAt = nowIso;

      // Ensure no duplicate student records for the same email
      db.users = db.users.filter(
        (u) => u.email.trim().toLowerCase() !== verifiedEmail || u === existingStudent
      );

      appendAuditLog(
        db,
        existingStudent.institutionId || targetInst.id,
        existingStudent,
        'O‘quvchi Google orqali tizimga kirdi',
        existingStudent.email,
        existingStudent.uid,
        { eventType: 'STUDENT_GOOGLE_LOGIN', outcome: 'success', requestId: reqId, ipHash, severity: 'INFO' }
      );
      saveDbState(env, db);
      const token = issueSessionToken(existingStudent.uid, env);
      return res.json({
        status: 'active',
        user: existingStudent,
        token,
        claimProvisioned: false,
      });
    }

    // If inviteToken is provided, validate and bind to the invited class
    let resolvedClass: ClassRoom | undefined;
    if (inviteToken && String(inviteToken).trim()) {
      const rawTok = String(inviteToken).trim().toUpperCase();
      const tokenHash = computeSimpleHash(rawTok);
      const invitation = db.invitations.find((inv) => inv.tokenHash === tokenHash);
      if (invitation) {
        const validation = validateInvitationToken(rawTok, invitation, nowIso);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error || 'Taklif kodi yaroqsiz.' });
        }
        invitation.status = 'accepted';
        invitation.acceptedAt = nowIso;
        invitation.acceptedByUid = verifiedUid;
        resolvedClass = db.classes.find(
          (c) =>
            c.id === invitation.classId ||
            (invitation.classCode && c.code.toLowerCase() === invitation.classCode.toLowerCase())
        );
      } else {
        resolvedClass = db.classes.find(
          (c) => c.inviteCode.toUpperCase() === rawTok && c.status !== 'archived'
        );
        if (!resolvedClass) {
          return res.status(400).json({ error: 'Taklif kodi topilmadi yoki muddati tugagan.' });
        }
      }
    }

    const newStudent: UserProfile = {
      uid: verifiedUid,
      displayName: verifiedDisplayName || verifiedEmail.split('@')[0] || 'O‘quvchi',
      email: verifiedEmail,
      emailVerified: true,
      role: 'student',
      platformOwner: false,
      platformAdmin: false,
      institutionId: resolvedClass?.institutionId || targetInst.id,
      classId: resolvedClass?.id,
      classCode: resolvedClass?.code,
      grade: resolvedClass?.grade,
      track: resolvedClass?.track,
      studentCode: `STD-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'active',
      enrolledAt: nowIso,
      lastLoginAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.users.push(newStudent);
    ensureSpecializedStudyStructure(db);
    appendAuditLog(
      db,
      newStudent.institutionId,
      newStudent,
      'Yangi o‘quvchi Google orqali ro‘yxatdan o‘tdi',
      newStudent.email,
      newStudent.uid,
      { eventType: 'STUDENT_GOOGLE_REGISTERED', outcome: 'success', requestId: reqId, ipHash, severity: 'INFO' }
    );
    saveDbState(env, db);

    const token = issueSessionToken(newStudent.uid, env);
    return res.json({
      user: newStudent,
      token,
      claimProvisioned: false,
    });
  });

  // Trusted Server-Side Admin Claim Provisioning Endpoint (Section 6)
  app.post('/api/admin/provision-claims', async (req, res) => {
    const env = resolveRequestEnv(req);
    const db = getDbState(env);
    const authCtx = authenticateRequest(req);
    const isInternalTestProvision =
      env === 'test' && req.headers['x-internal-admin-provision'] === 'trusted-server-procedure';

    if (!isInternalTestProvision) {
      if (!authCtx || !isVerifiedPlatformOwner(authCtx.user, CONFIGURED_OWNER_EMAIL)) {
        return res.status(403).json({
          error: 'Kirish taqiqlangan (403 Forbidden): Faqat tasdiqlangan platforma egasi ushbu amalni bajara oladi.',
        });
      }
    }

    const result = await provisionAuthorizedAdmins(env, db);
    return res.json(result);
  });

  // Preview invitation details by token before accepting
  app.get('/api/invitations/preview/:token', (req, res) => {
    const env = resolveRequestEnv(req);
    const db = getDbState(env);
    const rawToken = String(req.params.token || '').trim().toUpperCase();

    // Also allow class inviteCode for student registration if institution allows it
    const tokenHash = computeSimpleHash(rawToken);
    const invitation = db.invitations.find((inv) => inv.tokenHash === tokenHash);

    if (invitation) {
      const check = validateInvitationToken(rawToken, invitation);
      if (!check.valid) {
        return res.status(400).json({ error: check.error });
      }
      return res.json({
        type: 'invitation',
        institutionName: invitation.institutionName,
        inviteeName: invitation.inviteeName,
        email: invitation.email,
        role: invitation.role,
        className: invitation.className,
        subject: invitation.subject,
      });
    }

    // Check if it matches an active ClassRoom inviteCode for students
    const cls = db.classes.find(
      (c) => c.inviteCode.toUpperCase() === rawToken && c.status !== 'archived'
    );
    if (cls) {
      const inst = db.institutions.find((i) => i.id === cls.institutionId);
      return res.json({
        type: 'class_code',
        institutionName: inst?.name || 'Maktab',
        role: 'student',
        className: cls.name,
        subject: cls.subject,
      });
    }

    return res.status(404).json({ error: 'Taklif kodi topilmadi yoki muddati tugagan.' });
  });

  // Register account using a verified single-use Invitation Token (or Class Invite Code)
  app.post('/api/auth/register-with-invite', (req, res) => {
    const env = resolveRequestEnv(req);
    const db = getDbState(env);
    const { displayName, email, password, inviteToken } = req.body;

    if (!displayName || String(displayName).trim().length < 3) {
      return res.status(400).json({ error: 'Ism va familiya kamida 3 ta belgidan iborat bo‘lishi kerak.' });
    }
    if (!email || !String(email).includes('@')) {
      return res.status(400).json({ error: 'To‘g‘ri elektron pochta manzilini kiriting.' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Parol kamida 6 ta belgidan iborat bo‘lishi shart.' });
    }
    if (!inviteToken || !String(inviteToken).trim()) {
      return res.status(400).json({ error: 'Taklif kodini kiritish majburiy.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      return res.status(400).json({ error: 'Ushbu elektron pochta manzili allaqachon ro‘yxatdan o‘tgan.' });
    }

    const rawToken = String(inviteToken).trim().toUpperCase();
    const tokenHash = computeSimpleHash(rawToken);
    const invitation = db.invitations.find((inv) => inv.tokenHash === tokenHash);

    const nowIso = new Date().toISOString();
    const newUid = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    if (invitation) {
      const validation = validateInvitationToken(rawToken, invitation, nowIso);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const assignedClassIds =
        invitation.role === 'teacher' && invitation.classId ? [invitation.classId] : [];

      const matchedCls = invitation.classId
        ? db.classes.find(
            (c) =>
              c.id === invitation.classId ||
              c.code.toLowerCase() === String(invitation.classId).toLowerCase()
          )
        : undefined;

      const newUser: UserProfile = {
        uid: newUid,
        displayName: String(displayName).trim(),
        email: normalizedEmail,
        role: invitation.role,
        institutionId: invitation.institutionId,
        classId: invitation.role === 'student' ? matchedCls?.id || invitation.classId : undefined,
        classCode: invitation.role === 'student' ? matchedCls?.code || invitation.classCode : undefined,
        grade: invitation.role === 'student' ? matchedCls?.grade || invitation.grade : undefined,
        track: invitation.role === 'student' ? matchedCls?.track || invitation.track : undefined,
        assignedClassIds,
        subject: invitation.subject || (invitation.role === 'teacher' ? 'Matematika' : undefined),
        linkedChildIds:
          invitation.role === 'parent' && invitation.linkedStudentId
            ? [invitation.linkedStudentId]
            : [],
        studentCode:
          invitation.role === 'student'
            ? `STD-${Math.floor(1000 + Math.random() * 9000)}`
            : undefined,
        status: 'active',
        enrolledAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // Mark invitation accepted (single-use)
      invitation.status = 'accepted';
      invitation.acceptedAt = nowIso;
      invitation.acceptedByUid = newUid;

      db.users.push(newUser);
      db.passwordHashes[newUid] = hashPassword(String(password));

      if (invitation.role === 'student' && newUser.classId) {
        const cls = db.classes.find((c) => c.id === newUser.classId);
        if (cls) {
          cls.studentCount += 1;
        }
        db.classMemberships.push({
          id: `cm-${Date.now()}`,
          institutionId: invitation.institutionId,
          classId: newUser.classId,
          userId: newUid,
          memberRole: 'student',
          createdAt: nowIso,
        });
        db.studentEnrollments.push({
          id: `enr-${Date.now()}`,
          institutionId: invitation.institutionId,
          studentId: newUid,
          classId: newUser.classId,
          classCode: newUser.classCode,
          grade: newUser.grade,
          track: newUser.track,
          status: 'active',
          enrolledAt: nowIso,
        });
      }

      if (invitation.role === 'teacher' && invitation.classId) {
        const cls = db.classes.find((c) => c.id === invitation.classId);
        if (cls) {
          cls.teacherId = newUid;
          cls.teacherName = newUser.displayName;
        }
        db.teacherAssignments.push({
          id: `ta-${Date.now()}`,
          institutionId: invitation.institutionId,
          teacherId: newUid,
          classId: invitation.classId,
          subject: newUser.subject || 'Matematika',
          createdAt: nowIso,
        });
      }

      if (invitation.role === 'parent' && invitation.linkedStudentId) {
        db.parentLinks.push({
          id: `pl-${Date.now()}`,
          institutionId: invitation.institutionId,
          parentId: newUid,
          studentId: invitation.linkedStudentId,
          verifiedBy: 'invitation',
          createdAt: nowIso,
        });
      }

      pushNotification(
        db,
        invitation.institutionId,
        invitation.createdByUid,
        'Taklifnoma qabul qilindi',
        `${newUser.displayName} (${newUser.role}) taklifnomani qabul qilib tizimga qo'shildi.`
      );

      appendAuditLog(
        db,
        invitation.institutionId,
        newUser,
        `Taklifnoma orqali yangi ${newUser.role} hisobi faollashtirildi`,
        newUser.displayName,
        newUid
      );

      ensureSpecializedStudyStructure(db);
      saveDbState(env, db);
      broadcastInstitutionUpdate(env, invitation.institutionId, 'USER_JOINED');

      const token = issueSessionToken(newUid, env);
      return res.json({ user: newUser, token });
    }

    // Check if rawToken is a valid ClassRoom inviteCode for a student
    const cls = db.classes.find(
      (c) => c.inviteCode.toUpperCase() === rawToken && c.status !== 'archived'
    );
    if (cls) {
      const newUser: UserProfile = {
        uid: newUid,
        displayName: String(displayName).trim(),
        email: normalizedEmail,
        role: 'student',
        institutionId: cls.institutionId,
        classId: cls.id,
        classCode: cls.code,
        grade: cls.grade,
        track: cls.track,
        studentCode: `STD-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'active',
        enrolledAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      cls.studentCount += 1;
      db.users.push(newUser);
      db.passwordHashes[newUid] = hashPassword(String(password));
      db.studentEnrollments.push({
        id: `enr-${Date.now()}`,
        institutionId: cls.institutionId,
        studentId: newUid,
        classId: cls.id,
        classCode: cls.code,
        grade: cls.grade,
        track: cls.track,
        status: 'active',
        enrolledAt: nowIso,
      });

      if (cls.teacherId) {
        pushNotification(
          db,
          cls.institutionId,
          cls.teacherId,
          "Yangi o'quvchi sinfga qo'shildi",
          `${newUser.displayName} ${cls.name} sinfiga ulandi.`
        );
      }

      appendAuditLog(
        db,
        cls.institutionId,
        newUser,
        `O'quvchi sinf kodi orqali ro'yxatdan o'tdi (${cls.name})`,
        newUser.displayName,
        newUid
      );

      ensureSpecializedStudyStructure(db);
      saveDbState(env, db);
      broadcastInstitutionUpdate(env, cls.institutionId, 'STUDENT_ENROLLED');

      const token = issueSessionToken(newUid, env);
      return res.json({ user: newUser, token });
    }

    // Check if rawToken is a studentCode for a parent
    const matchedStudent = db.users.find(
      (u) => u.role === 'student' && u.studentCode?.toUpperCase() === rawToken
    );
    if (matchedStudent) {
      const newUser: UserProfile = {
        uid: newUid,
        displayName: String(displayName).trim(),
        email: normalizedEmail,
        role: 'parent',
        institutionId: matchedStudent.institutionId,
        linkedChildIds: [matchedStudent.uid],
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.users.push(newUser);
      db.passwordHashes[newUid] = hashPassword(String(password));
      db.parentLinks.push({
        id: `pl-${Date.now()}`,
        institutionId: matchedStudent.institutionId,
        parentId: newUid,
        studentId: matchedStudent.uid,
        verifiedBy: 'student_code',
        createdAt: nowIso,
      });
      appendAuditLog(
        db,
        matchedStudent.institutionId,
        newUser,
        `Ota-ona hisobi farzand kodi orqali ulandi`,
        matchedStudent.displayName,
        newUid
      );
      saveDbState(env, db);
      broadcastInstitutionUpdate(env, matchedStudent.institutionId, 'PARENT_LINKED');

      const token = issueSessionToken(newUid, env);
      return res.json({ user: newUser, token });
    }

    return res.status(400).json({
      error: "Taklif kodi topilmadi yoki muddati tugagan. Administrator yoki o'qituvchidan yangi taklif kodi oling.",
    });
  });

  // Real-Time Server-Sent Events (SSE) Endpoint
  app.get('/api/events', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) {
      return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const clientId = `sse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const client: SSEClient = {
      id: clientId,
      uid: authCtx.user.uid,
      institutionId: authCtx.user.institutionId,
      env: authCtx.env,
      res,
    };
    sseClients.push(client);

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

    req.on('close', () => {
      const idx = sseClients.findIndex((c) => c.id === clientId);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // Get Authorized Multi-Tenant State for Current User
  app.get('/api/state', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) {
      return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    }

    const { user, db } = authCtx;
    ensureSpecializedStudyStructure(db);
    const instId = user.institutionId;

    const institution =
      db.institutions.find((i) => i.id === instId) ||
      db.institutions[0] || {
        id: instId,
        name: 'Specialized Study Ixtisoslashtirilgan Maktabi',
        region: 'Toshkent shahri',
        district: 'Mirzo Ulug‘bek tumani',
        academicYear: '2026-2027',
        adminUid: user.uid,
        createdAt: new Date().toISOString(),
      };

    const instTopics = db.topics.filter(
      (t) => !t.institutionId || t.institutionId === 'global' || t.institutionId === instId
    );
    const instSubjects = db.subjects.filter(
      (s) => s.institutionId === 'global' || s.institutionId === instId
    );
    const myNotifications = db.notifications.filter(
      (n) => n.institutionId === instId && n.recipientUid === user.uid
    );

    const isOwner = isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL);

    if (isOwner) {
      return res.json({
        user,
        institution,
        institutions: db.institutions,
        academicYears: db.academicYears || [],
        subjects: db.subjects,
        topics: db.topics,
        workPlans: db.workPlans || [],
        lessons: db.lessons || [],
        users: db.users,
        classes: db.classes,
        invitations: db.invitations.map(({ tokenHash, ...rest }) => ({
          ...rest,
          tokenHash: '***',
        })),
        questions: db.questions,
        questionRevisions: db.questionRevisions || [],
        questionMedia: db.questionMedia || [],
        assessments: db.assessments,
        assignments: db.assignments,
        attempts: db.attempts,
        gradingRecords: db.gradingRecords || [],
        importBatches: db.importBatches || [],
        studentImportJobs: db.studentImportJobs || [],
        curriculumImportJobs: db.curriculumImportJobs || [],
        masteryRecords: db.masteryRecords,
        learningPaths: db.learningPaths,
        teacherNotes: db.teacherNotes,
        notifications: db.notifications.filter(
          (n) => n.recipientUid === user.uid || n.institutionId === instId
        ),
        auditLogs: db.auditLogs,
      });
    }

    if (user.role === 'teacher') {
      const myClasses = db.classes.filter(
        (c) =>
          c.institutionId === instId &&
          (c.teacherId === user.uid || user.assignedClassIds?.includes(c.id))
      );
      const myClassIds = new Set(myClasses.map((c) => c.id));
      const authorizedStudents = db.users.filter(
        (u) =>
          u.institutionId === instId &&
          (u.uid === user.uid || (u.role === 'student' && u.classId && myClassIds.has(u.classId)))
      );
      const authorizedStudentIds = new Set(authorizedStudents.map((s) => s.uid));

      return res.json({
        user,
        institution,
        institutions: [institution],
        academicYears: db.academicYears || [],
        subjects: instSubjects,
        topics: instTopics,
        workPlans: (db.workPlans || []).filter((wp) => myClassIds.has(wp.classId)),
        lessons: (db.lessons || []).filter((l) => myClassIds.has(l.classId)),
        users: authorizedStudents,
        classes: myClasses,
        invitations: db.invitations
          .filter((inv) => inv.institutionId === instId && inv.createdByUid === user.uid)
          .map(({ tokenHash, ...rest }) => ({ ...rest, tokenHash: '***' })),
        questions: db.questions.filter((q) => q.institutionId === instId),
        questionRevisions: (db.questionRevisions || []).filter((r) => r.institutionId === instId),
        questionMedia: (db.questionMedia || []).filter((m) => m.institutionId === instId),
        assessments: db.assessments.filter(
          (a) =>
            a.institutionId === instId &&
            (a.teacherId === user.uid || myClassIds.has(a.classId))
        ),
        assignments: db.assignments.filter(
          (a) =>
            a.institutionId === instId &&
            (a.teacherId === user.uid || myClassIds.has(a.classId))
        ),
        attempts: db.attempts.filter(
          (a) =>
            a.institutionId === instId &&
            (myClassIds.has(a.classId) || authorizedStudentIds.has(a.studentId))
        ),
        gradingRecords: (db.gradingRecords || []).filter((g) => g.institutionId === instId),
        importBatches: (db.importBatches || []).filter(
          (b) => b.institutionId === instId && b.importedByUid === user.uid
        ),
        masteryRecords: db.masteryRecords.filter(
          (m) => m.institutionId === instId && authorizedStudentIds.has(m.studentId)
        ),
        learningPaths: db.learningPaths.filter((lp) => authorizedStudentIds.has(lp.studentId)),
        teacherNotes: db.teacherNotes.filter(
          (n) => n.institutionId === instId && authorizedStudentIds.has(n.studentId)
        ),
        notifications: myNotifications,
        auditLogs: [],
      });
    }

    if (user.role === 'student') {
      const myClass = db.classes.find(
        (c) =>
          c.id === user.classId ||
          (user.classCode && c.code.toLowerCase() === user.classCode.toLowerCase())
      );

      // Sync student's class metadata if needed
      if (myClass) {
        user.classId = myClass.id;
        user.classCode = myClass.code;
        user.grade = myClass.grade;
        user.track = myClass.track;
      }

      const myLessons = myClass
        ? (db.lessons || []).filter(
            (l) =>
              lessonMatchesClass(l, myClass.code) &&
              (!l.additionalCurriculumAssignment || l.tTrackVisibilityApproved === true) &&
              (l.status === 'published' || l.status === 'in_progress' || l.status === 'completed')
          )
        : [];

      const hasApprovedTTrackMath =
        myClass?.track === 'T' &&
        (db.workPlans || []).some(
          (wp) =>
            workPlanMatchesClass(wp, myClass.code) &&
            wp.additionalCurriculumAssignment &&
            wp.tTrackVisibilityApproved === true
        );

      const mySubjects = myClass
        ? db.subjects.filter(
            (s) =>
              isSubjectCompatibleWithClass(s.name, myClass, db.subjects).compatible ||
              (hasApprovedTTrackMath && s.name.toLowerCase() === 'matematika')
          )
        : instSubjects;

      const myAssessments = db.assessments.filter(
        (a) =>
          a.status === 'published' &&
          (!a.classId ||
            a.classId === user.classId ||
            (myClass && a.classCode?.toLowerCase() === myClass.code.toLowerCase()) ||
            (myClass && a.assignedClassIds?.includes(myClass.id)) ||
            (myClass &&
              a.assignedClassCodes?.some((c) => c.toLowerCase() === myClass.code.toLowerCase()))) &&
          (!a.eligibleStudentIds ||
            a.eligibleStudentIds.length === 0 ||
            a.eligibleStudentIds.includes(user.uid))
      );
      const myAssignments = db.assignments.filter(
        (a) =>
          a.status === 'published' &&
          (a.classId === user.classId ||
            (myClass && a.classCode?.toLowerCase() === myClass.code.toLowerCase()))
      );

      // Protect answer keys: strip correctAnswer, correctAnswers, acceptedAnswers, rubricText, explanation, and structuredOptions.isCorrect
      const sanitizeQuestionForStudent = (q: QuestionItem): QuestionItem => ({
        ...q,
        correctAnswer: '',
        correctAnswers: undefined,
        acceptedAnswers: undefined,
        rubricText: undefined,
        explanation: '',
        structuredOptions: q.structuredOptions?.map((opt) => ({
          ...opt,
          isCorrect: false,
        })),
      });

      const neededQuestionIds = new Set(myAssessments.flatMap((a) => a.questionIds));
      const sanitizedQuestions = db.questions
        .filter((q) => neededQuestionIds.has(q.id))
        .map(sanitizeQuestionForStudent);

      const sanitizedAssessments = myAssessments.map((a) => ({
        ...a,
        questionSnapshot: a.questionSnapshot?.map(sanitizeQuestionForStudent),
      }));

      return res.json({
        user,
        institution,
        institutions: [institution],
        academicYears: db.academicYears || [],
        subjects: mySubjects,
        topics: instTopics,
        workPlans: [],
        lessons: myLessons,
        users: [user],
        classes: myClass ? [myClass] : [],
        invitations: [],
        questions: sanitizedQuestions,
        questionRevisions: [],
        questionMedia: (db.questionMedia || []).filter((m) => m.institutionId === instId),
        assessments: sanitizedAssessments,
        assignments: myAssignments,
        attempts: db.attempts.filter((a) => a.studentId === user.uid),
        gradingRecords: (db.gradingRecords || []).filter((g) =>
          db.attempts.some((att) => att.id === g.attemptId && att.studentId === user.uid)
        ),
        importBatches: [],
        masteryRecords: db.masteryRecords.filter((m) => m.studentId === user.uid),
        learningPaths: db.learningPaths.filter((lp) => lp.studentId === user.uid),
        teacherNotes: db.teacherNotes.filter((n) => n.studentId === user.uid),
        notifications: myNotifications,
        auditLogs: [],
      });
    }

    // Parent role
    const linkedIds = new Set(user.linkedChildIds || []);
    const linkedChildren = db.users.filter(
      (u) => u.institutionId === instId && u.role === 'student' && linkedIds.has(u.uid)
    );
    const childClassIds = new Set(linkedChildren.map((c) => c.classId).filter(Boolean));

    return res.json({
      user,
      institution,
      subjects: instSubjects,
      topics: instTopics,
      users: [user, ...linkedChildren],
      classes: db.classes.filter((c) => c.institutionId === instId && childClassIds.has(c.id)),
      invitations: [],
      questions: [],
      assessments: [],
      assignments: [],
      attempts: db.attempts.filter(
        (a) => a.institutionId === instId && linkedIds.has(a.studentId)
      ),
      masteryRecords: db.masteryRecords.filter(
        (m) => m.institutionId === instId && linkedIds.has(m.studentId)
      ),
      learningPaths: db.learningPaths.filter((lp) => linkedIds.has(lp.studentId)),
      teacherNotes: db.teacherNotes.filter(
        (n) => n.institutionId === instId && linkedIds.has(n.studentId)
      ),
      notifications: myNotifications,
      auditLogs: [],
    });
  });

  // =========================================================================
  // EXPLICIT RBAC & MULTI-TENANT SECURITY ENFORCEMENT ENDPOINTS (TEST F)
  // =========================================================================

  app.get('/api/security/students/:studentId', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Unauthorized' });
    const { user, db } = authCtx;

    if (user.role === 'student' && user.uid !== req.params.studentId) {
      return res.status(403).json({
        error: "Ruxsat rad etildi: Siz boshqa o'quvchining shaxsiy ma'lumotlariga kirish huquqiga ega emassiz.",
      });
    }

    const targetStudent = db.users.find((u) => u.uid === req.params.studentId);
    if (!targetStudent) return res.status(404).json({ error: 'Student not found' });

    const teacherClassIds = db.classes
      .filter((c) => c.institutionId === user.institutionId && c.teacherId === user.uid)
      .map((c) => c.id);

    if (!canAccessStudentRecord(user, targetStudent, teacherClassIds)) {
      return res.status(403).json({
        error: "Ruxsat rad etildi: Siz ushbu o'quvchining shaxsiy ma'lumotlariga kirish huquqiga ega emassiz.",
      });
    }

    return res.json({
      student: targetStudent,
      attempts: db.attempts.filter((a) => a.studentId === targetStudent.uid),
      masteryRecords: db.masteryRecords.filter((m) => m.studentId === targetStudent.uid),
    });
  });

  app.get('/api/security/classes/:classId', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Unauthorized' });
    const { user, db } = authCtx;

    if (user.role === 'student' && user.classId !== req.params.classId) {
      return res.status(403).json({
        error: "Ruxsat rad etildi: Ushbu sinf sizga biriktirilmagan.",
      });
    }

    const targetClass = db.classes.find((c) => c.id === req.params.classId);
    if (!targetClass) return res.status(404).json({ error: 'Class not found' });

    if (!canAccessClass(user, targetClass)) {
      return res.status(403).json({
        error: "Ruxsat rad etildi: Ushbu sinf sizga biriktirilmagan.",
      });
    }

    return res.json({ classRoom: targetClass });
  });

  app.get('/api/security/institutions/:institutionId', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Unauthorized' });
    const { user, db } = authCtx;

    if (!canAccessInstitution(user, req.params.institutionId)) {
      return res.status(403).json({
        error: "Ruxsat rad etildi: Boshqa ta'lim muassasasi ma'lumotlariga kirish taqiqlangan.",
      });
    }

    const inst = db.institutions.find((i) => i.id === req.params.institutionId);
    if (!inst) return res.status(404).json({ error: 'Institution not found' });
    return res.json({ institution: inst });
  });

  // =========================================================================
  // EXCLUSIVE PLATFORM OWNER ADMIN CONTROL CENTER APIs (/api/admin/*)
  // =========================================================================

  function requirePlatformOwner(req: Request, res: Response) {
    const authCtx = authenticateRequest(req);
    if (!authCtx) {
      res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
      return null;
    }
    if (!isVerifiedPlatformOwner(authCtx.user, CONFIGURED_OWNER_EMAIL)) {
      const reqId = getRequestId(req);
      const ipHash = getClientIpHash(req);
      const denyKey = `${authCtx.env}:${authCtx.user.uid}`;
      const count = (deniedAdminCounter.get(denyKey) || 0) + 1;
      deniedAdminCounter.set(denyKey, count);
      appendAuditLog(
        authCtx.db,
        authCtx.user.institutionId,
        authCtx.user,
        `Ruxsatsiz Admin API so‘rovi rad etildi: ${req.method} ${req.path}`,
        req.path,
        authCtx.user.uid,
        {
          eventType: count >= 3 ? 'SECURITY_ALERT_REPEATED_ADMIN_DENIAL' : 'ADMIN_ACCESS_DENIED',
          outcome: 'denied',
          requestId: reqId,
          ipHash,
          severity: count >= 3 ? 'CRITICAL' : 'WARNING',
        }
      );
      saveDbState(authCtx.env, authCtx.db);
      res.status(403).json({
        error: `Kirish taqiqlangan (403 Forbidden): Faqat tasdiqlangan Platforma Egasi (${CONFIGURED_OWNER_EMAIL}) Admin Boshqaruv Markaziga kirish huquqiga ega.`,
      });
      return null;
    }
    return authCtx;
  }

  app.get('/api/admin/overview', (req, res) => {
    const ctx = requirePlatformOwner(req, res);
    if (!ctx) return;
    const { db } = ctx;

    const totalInstitutions = db.institutions.length;
    const activeInstitutions = db.institutions.filter((i) => i.status !== 'suspended' && i.status !== 'archived').length;
    const suspendedInstitutions = db.institutions.filter((i) => i.status === 'suspended').length;
    const archivedInstitutions = db.institutions.filter((i) => i.status === 'archived').length;

    const totalTeachers = db.users.filter((u) => u.role === 'teacher').length;
    const totalStudents = db.users.filter((u) => u.role === 'student').length;
    const totalParents = db.users.filter((u) => u.role === 'parent').length;
    const totalClasses = db.classes.length;
    const totalAssessments = db.assessments.length;
    const publishedAssessments = db.assessments.filter((a) => a.status === 'published').length;
    const totalQuestions = db.questions.length;
    const totalSubmissions = db.attempts.length;
    const pendingInvitations = db.invitations.filter((i) => i.status === 'pending').length;
    const aiAnalysesGenerated = db.attempts.filter((a) => Boolean(a.aiAnalysis)).length;

    return res.json({
      metrics: {
        totalInstitutions,
        activeInstitutions,
        suspendedInstitutions,
        archivedInstitutions,
        totalUsers: db.users.length,
        totalTeachers,
        totalStudents,
        totalParents,
        totalClasses,
        totalAssessments,
        publishedAssessments,
        totalQuestions,
        totalSubmissions,
        pendingInvitations,
        aiAnalysesGenerated,
      },
      institutions: db.institutions,
    });
  });

  app.get('/api/admin/institutions', (req, res) => {
    const ctx = requirePlatformOwner(req, res);
    if (!ctx) return;
    const { db } = ctx;

    const enriched = db.institutions.map((inst) => ({
      ...inst,
      teacherCount: db.users.filter((u) => u.institutionId === inst.id && u.role === 'teacher').length,
      studentCount: db.users.filter((u) => u.institutionId === inst.id && u.role === 'student').length,
      parentCount: db.users.filter((u) => u.institutionId === inst.id && u.role === 'parent').length,
      classCount: db.classes.filter((c) => c.institutionId === inst.id).length,
      assessmentCount: db.assessments.filter((a) => a.institutionId === inst.id).length,
      questionCount: db.questions.filter((q) => q.institutionId === inst.id).length,
      attemptCount: db.attempts.filter((a) => a.institutionId === inst.id).length,
    }));

    return res.json({ institutions: enriched });
  });

  app.post('/api/admin/institutions', (req, res) => {
    const ctx = requirePlatformOwner(req, res);
    if (!ctx) return;
    const { user, env, db } = ctx;

    const {
      name,
      shortName,
      type,
      code,
      region,
      district,
      city,
      address,
      phone,
      email,
      website,
      directorName,
      contactPerson,
      contactRole,
      primarySubjectFocus,
      academicYear,
      gradingScale,
      languageOfInstruction,
      timezone,
      logoUrl,
      status,
      allowTeacherStudentInvites,
      allowTeacherAssessments,
      allowExcelImports,
      aiFeaturesEnabled,
      initialClasses,
    } = req.body;

    if (!name || String(name).trim().length < 3) {
      return res.status(400).json({ error: 'Muassasa to‘liq nomini kiriting (kamida 3 ta belgi).' });
    }

    const cleanCode = code
      ? String(code).trim().toUpperCase()
      : `INST-${Math.floor(1000 + Math.random() * 9000)}`;

    if (db.institutions.some((i) => i.code && i.code.toUpperCase() === cleanCode)) {
      return res.status(400).json({ error: `Ushbu muassasa kodi (${cleanCode}) allaqachon mavjud.` });
    }

    const nowIso = new Date().toISOString();
    const instId = `inst-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

    const newInst: Institution = {
      id: instId,
      name: String(name).trim(),
      shortName: shortName ? String(shortName).trim() : String(name).trim().slice(0, 24),
      type: type || 'public_school',
      code: cleanCode,
      region: String(region || 'Toshkent shahri').trim(),
      district: String(district || 'Markaziy tuman').trim(),
      city: city ? String(city).trim() : undefined,
      address: address ? String(address).trim() : undefined,
      phone: phone ? String(phone).trim() : undefined,
      email: email ? String(email).trim().toLowerCase() : undefined,
      website: website ? String(website).trim() : undefined,
      directorName: directorName ? String(directorName).trim() : undefined,
      contactPerson: contactPerson ? String(contactPerson).trim() : undefined,
      contactRole: contactRole ? String(contactRole).trim() : undefined,
      primarySubjectFocus: primarySubjectFocus ? String(primarySubjectFocus).trim() : 'Matematika va STEM',
      academicYear: String(academicYear || '2026-2027').trim(),
      gradingScale: gradingScale || '100_percent',
      languageOfInstruction: String(languageOfInstruction || "O'zbek tili").trim(),
      timezone: String(timezone || 'Asia/Tashkent').trim(),
      status: status || 'active',
      logoUrl: logoUrl ? String(logoUrl) : undefined,
      adminUid: user.uid,
      allowTeacherStudentInvites: allowTeacherStudentInvites !== false,
      allowTeacherAssessments: allowTeacherAssessments !== false,
      allowExcelImports: allowExcelImports !== false,
      aiFeaturesEnabled: aiFeaturesEnabled !== false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.institutions.push(newInst);

    // Optional initial classes setup during multi-step wizard
    if (Array.isArray(initialClasses)) {
      for (const ic of initialClasses) {
        if (ic && ic.name && String(ic.name).trim()) {
          const classId = `class-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          db.classes.push({
            id: classId,
            name: String(ic.name).trim(),
            grade: Number(ic.grade) || 8,
            subject: String(ic.subject || 'Matematika').trim(),
            academicYear: newInst.academicYear,
            teacherId: user.uid,
            teacherName: user.displayName,
            institutionId: instId,
            inviteCode: `MAT${Number(ic.grade) || 8}-${Math.floor(1000 + Math.random() * 9000)}`,
            studentCount: 0,
            status: 'active',
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        }
      }
    }

    appendAuditLog(
      db,
      instId,
      user,
      'Yangi ta’lim muassasasi yaratildi',
      `${newInst.name} (${newInst.code})`,
      instId
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, instId, 'INSTITUTION_CREATED');
    return res.json({ institution: newInst });
  });

  app.put('/api/admin/institutions/:id', (req, res) => {
    const ctx = requirePlatformOwner(req, res);
    if (!ctx) return;
    const { user, env, db } = ctx;

    const inst = db.institutions.find((i) => i.id === req.params.id);
    if (!inst) return res.status(404).json({ error: 'Muassasa topilmadi.' });

    const {
      name,
      shortName,
      type,
      code,
      region,
      district,
      city,
      address,
      phone,
      email,
      website,
      directorName,
      contactPerson,
      contactRole,
      primarySubjectFocus,
      academicYear,
      gradingScale,
      languageOfInstruction,
      timezone,
      logoUrl,
      status,
      allowTeacherStudentInvites,
      allowTeacherAssessments,
      allowExcelImports,
      aiFeaturesEnabled,
    } = req.body;

    if (code && String(code).trim().toUpperCase() !== inst.code?.toUpperCase()) {
      const candidateCode = String(code).trim().toUpperCase();
      if (db.institutions.some((other) => other.id !== inst.id && other.code?.toUpperCase() === candidateCode)) {
        return res.status(400).json({ error: `Ushbu muassasa kodi (${candidateCode}) boshqa muassasaga biriktirilgan.` });
      }
      inst.code = candidateCode;
    }

    if (name && String(name).trim().length >= 2) inst.name = String(name).trim();
    if (typeof shortName === 'string') inst.shortName = shortName.trim();
    if (type) inst.type = type;
    if (region && String(region).trim().length >= 2) inst.region = String(region).trim();
    if (district && String(district).trim().length >= 2) inst.district = String(district).trim();
    if (typeof city === 'string') inst.city = city.trim();
    if (typeof address === 'string') inst.address = address.trim();
    if (typeof phone === 'string') inst.phone = phone.trim();
    if (typeof email === 'string') inst.email = email.trim().toLowerCase();
    if (typeof website === 'string') inst.website = website.trim();
    if (typeof directorName === 'string') inst.directorName = directorName.trim();
    if (typeof contactPerson === 'string') inst.contactPerson = contactPerson.trim();
    if (typeof contactRole === 'string') inst.contactRole = contactRole.trim();
    if (typeof primarySubjectFocus === 'string') inst.primarySubjectFocus = primarySubjectFocus.trim();
    if (academicYear) inst.academicYear = String(academicYear).trim();
    if (gradingScale) inst.gradingScale = gradingScale;
    if (typeof languageOfInstruction === 'string') inst.languageOfInstruction = languageOfInstruction.trim();
    if (typeof timezone === 'string') inst.timezone = timezone.trim();
    if (typeof logoUrl === 'string') inst.logoUrl = logoUrl || undefined;
    if (status && (status === 'active' || status === 'suspended' || status === 'archived' || status === 'onboarding')) {
      inst.status = status;
    }
    if (typeof allowTeacherStudentInvites === 'boolean') {
      inst.allowTeacherStudentInvites = allowTeacherStudentInvites;
    }
    if (typeof allowTeacherAssessments === 'boolean') {
      inst.allowTeacherAssessments = allowTeacherAssessments;
    }
    if (typeof allowExcelImports === 'boolean') {
      inst.allowExcelImports = allowExcelImports;
    }
    if (typeof aiFeaturesEnabled === 'boolean') {
      inst.aiFeaturesEnabled = aiFeaturesEnabled;
    }
    inst.updatedAt = new Date().toISOString();

    appendAuditLog(
      db,
      inst.id,
      user,
      'Muassasa ma’lumotlari va sozlamalari tahrirlandi',
      `${inst.name} (${inst.id})`,
      inst.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, inst.id, 'INSTITUTION_UPDATED');
    return res.json({ institution: inst });
  });

  app.post('/api/admin/institutions/:id/status', (req, res) => {
    const ctx = requirePlatformOwner(req, res);
    if (!ctx) return;
    const { user, env, db } = ctx;

    const inst = db.institutions.find((i) => i.id === req.params.id);
    if (!inst) return res.status(404).json({ error: 'Muassasa topilmadi.' });

    const { status, reason } = req.body;
    if (!status || !['active', 'suspended', 'archived', 'onboarding'].includes(status)) {
      return res.status(400).json({ error: 'Yaroqsiz holat (status).' });
    }

    const previousStatus = inst.status || 'active';
    inst.status = status;
    inst.updatedAt = new Date().toISOString();

    appendAuditLog(
      db,
      inst.id,
      user,
      `Muassasa holati o'zgartirildi: ${previousStatus} -> ${status}${reason ? ` (${reason})` : ''}`,
      inst.name,
      inst.id
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, inst.id, 'INSTITUTION_STATUS_CHANGED');
    return res.json({ institution: inst });
  });

  app.post('/api/admin/switch-institution', (req, res) => {
    const ctx = requirePlatformOwner(req, res);
    if (!ctx) return;
    const { user, env, db } = ctx;

    const { institutionId } = req.body;
    const targetInst = db.institutions.find((i) => i.id === institutionId);
    if (!targetInst) {
      return res.status(404).json({ error: 'Tanlangan muassasa topilmadi.' });
    }

    user.institutionId = targetInst.id;
    user.updatedAt = new Date().toISOString();
    saveDbState(env, db);
    return res.json({ user, institution: targetInst });
  });

  app.post('/api/admin/academic-years', (req, res) => {
    const ctx = requirePlatformOwner(req, res);
    if (!ctx) return;
    const { user, env, db } = ctx;

    const { name, startDate, endDate, status, isCurrent } = req.body;
    if (!name || String(name).trim().length < 4) {
      return res.status(400).json({ error: "O'quv yili nomini kiriting (masalan, 2026-2027)." });
    }

    if (isCurrent) {
      for (const y of db.academicYears) {
        y.isCurrent = false;
      }
    }

    const newYear: AcademicYearItem = {
      id: `ay-${Date.now()}`,
      institutionId: 'global',
      name: String(name).trim(),
      startDate: String(startDate || '2026-09-02'),
      endDate: String(endDate || '2027-05-25'),
      status: status || 'active',
      isCurrent: Boolean(isCurrent),
      createdAt: new Date().toISOString(),
    };
    db.academicYears.unshift(newYear);
    appendAuditLog(db, user.institutionId, user, "Yangi o'quv yili qo'shildi", newYear.name, newYear.id);
    saveDbState(env, db);
    return res.json({ academicYear: newYear });
  });

  // =========================================================================
  // INSTITUTION, CLASS & INVITATION WORKFLOWS
  // =========================================================================

  app.put('/api/institutions/:id', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Faqat maktab administratori sozlamalarni o‘zgartira oladi.' });
    }
    if (!canAccessInstitution(user, req.params.id)) {
      return res.status(403).json({ error: 'Boshqa muassasa ma’lumotlarini o‘zgartirish taqiqlangan.' });
    }

    const inst = db.institutions.find((i) => i.id === req.params.id);
    if (!inst) return res.status(404).json({ error: 'Muassasa topilmadi.' });

    const {
      name,
      shortName,
      type,
      code,
      region,
      district,
      city,
      address,
      phone,
      email,
      website,
      directorName,
      contactPerson,
      contactRole,
      primarySubjectFocus,
      academicYear,
      gradingScale,
      languageOfInstruction,
      timezone,
      logoUrl,
      status,
      allowTeacherStudentInvites,
      allowTeacherAssessments,
      allowExcelImports,
      aiFeaturesEnabled,
    } = req.body;

    if (name && String(name).trim().length >= 2) inst.name = String(name).trim();
    if (typeof shortName === 'string') inst.shortName = shortName.trim();
    if (type) inst.type = type;
    if (code) inst.code = String(code).trim().toUpperCase();
    if (region && String(region).trim().length >= 2) inst.region = String(region).trim();
    if (district && String(district).trim().length >= 2) inst.district = String(district).trim();
    if (typeof city === 'string') inst.city = city.trim();
    if (typeof address === 'string') inst.address = address.trim();
    if (typeof phone === 'string') inst.phone = phone.trim();
    if (typeof email === 'string') inst.email = email.trim().toLowerCase();
    if (typeof website === 'string') inst.website = website.trim();
    if (typeof directorName === 'string') inst.directorName = directorName.trim();
    if (typeof contactPerson === 'string') inst.contactPerson = contactPerson.trim();
    if (typeof contactRole === 'string') inst.contactRole = contactRole.trim();
    if (typeof primarySubjectFocus === 'string') inst.primarySubjectFocus = primarySubjectFocus.trim();
    if (academicYear) inst.academicYear = String(academicYear).trim();
    if (gradingScale) inst.gradingScale = gradingScale;
    if (typeof languageOfInstruction === 'string') inst.languageOfInstruction = languageOfInstruction.trim();
    if (typeof timezone === 'string') inst.timezone = timezone.trim();
    if (typeof logoUrl === 'string') inst.logoUrl = logoUrl || undefined;
    if (status && ['active', 'suspended', 'archived', 'onboarding'].includes(status)) {
      inst.status = status;
    }
    if (typeof allowTeacherStudentInvites === 'boolean') {
      inst.allowTeacherStudentInvites = allowTeacherStudentInvites;
    }
    if (typeof allowTeacherAssessments === 'boolean') {
      inst.allowTeacherAssessments = allowTeacherAssessments;
    }
    if (typeof allowExcelImports === 'boolean') {
      inst.allowExcelImports = allowExcelImports;
    }
    if (typeof aiFeaturesEnabled === 'boolean') {
      inst.aiFeaturesEnabled = aiFeaturesEnabled;
    }
    inst.updatedAt = new Date().toISOString();

    appendAuditLog(db, inst.id, user, 'Muassasa sozlamalari yangilandi', inst.name, inst.id);
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, inst.id, 'INSTITUTION_UPDATED');
    return res.json({ institution: inst });
  });

  app.get('/api/classes', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, db } = authCtx;
    ensureSpecializedStudyStructure(db);

    if (user.role === 'student') {
      const myClass = db.classes.find(
        (c) =>
          c.id === user.classId ||
          (user.classCode && c.code.toLowerCase() === user.classCode.toLowerCase())
      );
      return res.json({ classes: myClass ? [myClass] : [] });
    }

    const gradeFilter = req.query.grade ? Number(req.query.grade) : undefined;
    const trackFilter = req.query.track ? String(req.query.track).toUpperCase() : undefined;

    let result = [...db.classes];
    if (gradeFilter) {
      result = result.filter((c) => c.grade === gradeFilter);
    }
    if (trackFilter === 'A' || trackFilter === 'T') {
      result = result.filter((c) => c.track === trackFilter);
    }

    return res.json({
      classes: result,
      totalCount: result.length,
    });
  });

  app.post('/api/classes', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Sinf yaratish faqat administrator uchun ruxsat etilgan.' });
    }

    const { name, code, grade, subject, teacherId } = req.body;
    const rawCode = String(code || name || '').trim().toLowerCase();
    if (!rawCode) {
      return res.status(400).json({ error: 'Sinf kodini kiriting (masalan: 7a1 yoki 9t).' });
    }

    if (rawCode === '5t' || rawCode === '6t') {
      return res.status(400).json({
        error: `${rawCode} sinfi rasmiy 19 ta sinf tuzilmasida mavjud emas. T-yo‘nalishi faqat 7t, 8t, 9t, 10t, 11t sinflaridan iborat.`,
      });
    }

    const parsedMeta = parseOfficialClassCode(rawCode);
    const existingOfficial = db.classes.find(
      (c) => (c.code || c.name).toLowerCase() === rawCode
    );
    if (existingOfficial) {
      return res.status(400).json({
        error: `${rawCode} sinfi allaqachon mavjud. Takroriy sinf yaratish mumkin emas.`,
        classRoom: existingOfficial,
      });
    }

    const nowIso = new Date().toISOString();
    const resolvedTrack = parsedMeta ? parsedMeta.track : 'A';
    const resolvedGrade = parsedMeta ? parsedMeta.grade : Number(grade) || 8;
    const { subjectIds, subjectNames } = getDefaultSubjectsForTrack(resolvedTrack);
    const classId = parsedMeta
      ? `class-${parsedMeta.code}`
      : `class-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

    const newClass: ClassRoom = {
      id: classId,
      code: parsedMeta ? parsedMeta.code : rawCode,
      name: parsedMeta ? parsedMeta.code : String(name || rawCode).trim(),
      grade: resolvedGrade,
      track: resolvedTrack,
      trackLabel: resolvedTrack === 'A' ? 'Aniq fanlar' : 'Tabiiy fanlar',
      section: parsedMeta ? parsedMeta.section : '1',
      academicYear: '2026-2027',
      subject: String(subject || (resolvedTrack === 'A' ? 'Matematika' : 'Biologiya')).trim(),
      subjectIds,
      subjectNames,
      teacherId: String(teacherId || user.uid),
      teacherName: user.displayName,
      institutionId: user.institutionId,
      inviteCode: `SS-${rawCode.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      studentCount: 0,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.classes.push(newClass);
    appendAuditLog(
      db,
      user.institutionId,
      user,
      'Sinf yaratildi',
      `${newClass.code} (${newClass.trackLabel})`,
      classId
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'CLASS_CREATED');
    return res.json({ classRoom: newClass });
  });

  app.put('/api/classes/:id', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Ushbu sinfni tahrirlash faqat administrator uchun.' });
    }

    const cls = db.classes.find(
      (c) => c.id === req.params.id || c.code.toLowerCase() === req.params.id.toLowerCase()
    );
    if (!cls) {
      return res.status(404).json({ error: 'Sinf topilmadi.' });
    }

    const { subject, subjectIds, subjectNames, academicYear, status } = req.body;
    if (subject) cls.subject = String(subject).trim();
    if (Array.isArray(subjectIds)) cls.subjectIds = subjectIds.map(String);
    if (Array.isArray(subjectNames)) cls.subjectNames = subjectNames.map(String);
    if (academicYear) cls.academicYear = String(academicYear).trim();
    if (status && (status === 'active' || status === 'archived')) {
      cls.status = status;
    }

    cls.updatedAt = new Date().toISOString();
    appendAuditLog(db, user.institutionId, user, 'Sinf sozlamalari yangilandi', cls.code, cls.id);
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'CLASS_UPDATED');
    return res.json({ classRoom: cls });
  });

  // Remove student from class
  app.delete('/api/classes/:classId/students/:studentId', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Faqat administrator o‘quvchini sinfdan chiqara oladi.' });
    }

    const cls = db.classes.find(
      (c) => c.id === req.params.classId || c.code.toLowerCase() === req.params.classId.toLowerCase()
    );
    const student = db.users.find((u) => u.uid === req.params.studentId);
    if (!cls || !student) {
      return res.status(404).json({ error: 'Sinf yoki o‘quvchi topilmadi.' });
    }

    student.classId = undefined;
    student.classCode = undefined;
    ensureSpecializedStudyStructure(db);
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `O'quvchi ${cls.code} sinfidan chiqarildi`,
      student.displayName,
      student.uid
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'STUDENT_UPDATED');
    return res.json({ status: 'ok' });
  });

  // Create cryptographic single-use student invitation
  app.post('/api/invitations', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Taklifnoma yaratish faqat administrator uchun ruxsat etilgan.' });
    }

    const { inviteeName, email, role, classId, classCode, subject } = req.body;
    const resolvedInviteeName =
      inviteeName && String(inviteeName).trim().length >= 2
        ? String(inviteeName).trim()
        : 'Taklif etilgan o‘quvchi';
    const resolvedEmail =
      email && String(email).includes('@')
        ? String(email).trim().toLowerCase()
        : `student.${Date.now()}@specializedstudy.uz`;

    const targetRole: UserRole = 'student';
    const inst = db.institutions.find((i) => i.id === user.institutionId) || db.institutions[0];
    const lookupClassKey = String(classId || classCode || '').trim().toLowerCase();
    const cls = lookupClassKey
      ? db.classes.find(
          (c) =>
            c.id.toLowerCase() === lookupClassKey ||
            c.code.toLowerCase() === lookupClassKey ||
            c.name.toLowerCase() === lookupClassKey
        )
      : undefined;

    const { rawToken, tokenHash } = generateCryptographicInviteToken(targetRole);
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(); // 14 days

    const newInvite: Invitation = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      institutionId: user.institutionId,
      institutionName: inst?.name || 'Specialized Study',
      email: resolvedEmail,
      inviteeName: resolvedInviteeName,
      role: targetRole,
      classId: cls?.id,
      classCode: cls?.code,
      className: cls?.name,
      grade: cls?.grade,
      track: cls?.track,
      subject: subject ? String(subject).trim() : cls?.subject,
      tokenHash,
      codePrefix: rawToken.slice(0, 10),
      status: 'pending',
      createdByUid: user.uid,
      createdByName: user.displayName,
      createdAt: nowIso,
      expiresAt: expiresIso,
    };

    db.invitations.unshift(newInvite);
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `O‘quvchi taklifnomasi yaratildi (${cls?.code || 'umumiy'})`,
      `${newInvite.inviteeName} (${newInvite.email})`,
      newInvite.id
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'INVITATION_CREATED');

    return res.json({
      invitation: {
        ...newInvite,
        tokenHash: '***',
        inviteToken: rawToken,
      },
      rawToken,
    });
  });

  // Bulk CSV student invitation import
  app.post('/api/invitations/bulk-csv', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'CSV import faqat administrator uchun ruxsat etilgan.' });
    }

    const { csvText, rows, defaultClassId } = req.body;
    const existingEmails = [
      ...db.users.map((u) => u.email),
      ...db.invitations.filter((i) => i.status === 'pending').map((i) => i.email),
    ];

    const validation = Array.isArray(rows)
      ? {
          validRows: rows
            .filter((r: any) => r && r.displayName && String(r.displayName).trim().length >= 2)
            .map((r: any) => ({
              displayName: String(r.displayName).trim(),
              email:
                r.email && String(r.email).includes('@')
                  ? String(r.email).trim().toLowerCase()
                  : `student.${Date.now()}.${Math.random().toString(36).slice(2, 5)}@specializedstudy.uz`,
              className: r.className ? String(r.className).trim() : '',
            })),
          invalidRows: [],
        }
      : validateCSVStudentImport(String(csvText || ''), existingEmails);

    if (validation.validRows.length === 0) {
      return res.status(400).json({
        error: 'Yaroqli qatorlar topilmadi.',
        details: validation,
      });
    }

    const inst = db.institutions.find((i) => i.id === user.institutionId) || db.institutions[0];
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

    const createdInvites: Array<{ inviteeName: string; email: string; rawToken: string }> = [];

    for (const row of validation.validRows) {
      const matchedClass =
        db.classes.find(
          (c) =>
            c.code.toLowerCase() === row.className?.toLowerCase() ||
            c.name.toLowerCase() === row.className?.toLowerCase() ||
            c.id === defaultClassId
        ) || db.classes[0];

      const { rawToken, tokenHash } = generateCryptographicInviteToken('STU');
      const inv: Invitation = {
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        institutionId: user.institutionId,
        institutionName: inst?.name || 'Specialized Study',
        email: row.email,
        inviteeName: row.displayName,
        role: 'student',
        classId: matchedClass?.id,
        classCode: matchedClass?.code,
        className: matchedClass?.name,
        grade: matchedClass?.grade,
        track: matchedClass?.track,
        tokenHash,
        codePrefix: rawToken.slice(0, 10),
        status: 'pending',
        createdByUid: user.uid,
        createdByName: user.displayName,
        createdAt: nowIso,
        expiresAt: expiresIso,
      };
      db.invitations.unshift(inv);
      createdInvites.push({
        inviteeName: row.displayName,
        email: row.email,
        rawToken,
      });
    }

    appendAuditLog(
      db,
      user.institutionId,
      user,
      `CSV orqali ${createdInvites.length} ta o'quvchi taklifnomasi yuklandi`,
      `${createdInvites.length} ta yozuv`
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'CSV_IMPORTED');

    return res.json({
      createdCount: createdInvites.length,
      createdInvites,
      validation,
    });
  });

  // Revoke invitation
  app.post('/api/invitations/:id/revoke', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    const inv = db.invitations.find((i) => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Taklifnoma topilmadi.' });

    if (user.role !== 'admin' && user.role !== 'platform_owner' && inv.createdByUid !== user.uid) {
      return res.status(403).json({ error: 'Ruxsat yo‘q.' });
    }

    inv.status = 'revoked';
    appendAuditLog(
      db,
      user.institutionId,
      user,
      'Taklifnoma bekor qilindi',
      `${inv.inviteeName} (${inv.email})`,
      inv.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'INVITATION_REVOKED');
    return res.json({ status: 'ok' });
  });

  // Admin directly creates a verified Student account and assigns them to one of the 19 classes
  app.post(['/api/users', '/api/admin/students'], (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Faqat administrator yangi o‘quvchi qo‘sha oladi.' });
    }

    const { displayName, email, password, role, classId, classCode, studentCode } = req.body;
    if (!displayName || String(displayName).trim().length < 2) {
      return res.status(400).json({ error: 'O‘quvchi F.I.Sh.ni kiriting.' });
    }
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ error: 'To‘g‘ri elektron pochta manzilini kiriting.' });
    }
    if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return res.status(400).json({ error: 'Ushbu elektron pochta allaqachon mavjud.' });
    }

    const lookupClass = String(classId || classCode || '7a1').trim().toLowerCase();
    const matchedCls =
      db.classes.find(
        (c) =>
          c.id.toLowerCase() === lookupClass ||
          c.code.toLowerCase() === lookupClass ||
          c.name.toLowerCase() === lookupClass
      ) || db.classes[0];

    const nowIso = new Date().toISOString();
    const newUid = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const targetRole: UserRole = 'student';
    const hasCustomPassword = typeof password === 'string' && password.trim().length >= 6;

    const newUser: UserProfile = {
      uid: newUid,
      displayName: String(displayName).trim(),
      email: cleanEmail,
      role: targetRole,
      institutionId: user.institutionId,
      classId: matchedCls?.id,
      classCode: matchedCls?.code,
      grade: matchedCls?.grade,
      track: matchedCls?.track,
      studentCode: String(
        studentCode || `STD-${Math.floor(1000 + Math.random() * 9000)}`
      ).trim(),
      status: hasCustomPassword ? 'active' : 'pending_activation',
      enrolledAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.users.push(newUser);
    db.passwordHashes[newUid] = hashPassword(
      hasCustomPassword ? String(password).trim() : generateSecureRandomPassword()
    );

    if (targetRole === 'student' && matchedCls) {
      db.studentEnrollments.push({
        id: `enr-${Date.now()}`,
        institutionId: user.institutionId,
        studentId: newUid,
        classId: matchedCls.id,
        classCode: matchedCls.code,
        grade: matchedCls.grade,
        track: matchedCls.track,
        status: 'active',
        enrolledAt: nowIso,
      });
    }

    ensureSpecializedStudyStructure(db);
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Yangi o‘quvchi qo‘shildi (${matchedCls?.code || ''})`,
      `${newUser.displayName} (${newUser.email})`,
      newUid
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'USER_CREATED');
    return res.json({ user: newUser, student: newUser });
  });

  // Update student status or move student to another class (Admin only; students cannot change their own class/grade/track)
  app.put('/api/users/:uid', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({
        error: 'Ruxsat rad etildi (403): O‘quvchi o‘z sinfi, yo‘nalishi yoki ruxsatlarini o‘zgartira olmaydi.',
      });
    }

    const target = db.users.find((u) => u.uid === req.params.uid);
    if (!target) return res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });

    const {
      displayName,
      firstName,
      lastName,
      patronymic,
      email,
      studentCode,
      status,
      classId,
      classCode,
    } = req.body;
    if (displayName && String(displayName).trim().length >= 2) {
      target.displayName = String(displayName).trim();
    }
    if (typeof firstName === 'string') target.firstName = firstName.trim();
    if (typeof lastName === 'string') target.lastName = lastName.trim();
    if (typeof patronymic === 'string') target.patronymic = patronymic.trim();
    if (typeof email === 'string' && email.includes('@')) {
      target.email = email.trim().toLowerCase();
    }
    if (typeof studentCode === 'string' && studentCode.trim()) {
      target.studentCode = studentCode.trim();
    }
    if (
      status &&
      (status === 'active' ||
        status === 'pending_activation' ||
        status === 'suspended' ||
        status === 'archived')
    ) {
      target.status = status;
    }

    const nextClassKey = String(classId ?? classCode ?? '').trim().toLowerCase();
    if (nextClassKey) {
      const normalizedKey = normalizeClassCodeInput(nextClassKey) || nextClassKey;
      const nextCls = db.classes.find(
        (c) =>
          c.id.toLowerCase() === normalizedKey ||
          c.code.toLowerCase() === normalizedKey ||
          c.name.toLowerCase() === normalizedKey
      );
      if (!nextCls) {
        return res.status(400).json({ error: 'Tanlangan sinf 19 ta rasmiy sinf ro‘yxatida topilmadi.' });
      }
      target.classId = nextCls.id;
      target.classCode = nextCls.code;
      target.grade = nextCls.grade;
      target.track = nextCls.track;
    }

    target.updatedAt = new Date().toISOString();
    ensureSpecializedStudyStructure(db);

    appendAuditLog(
      db,
      user.institutionId,
      user,
      `O‘quvchi ma’lumotlari yangilandi (${target.classCode || ''})`,
      target.displayName,
      target.uid
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'USER_UPDATED');
    return res.json({ user: target });
  });

  // =========================================================================
  // 9-STEP EXCEL STUDENT IMPORT, TEMPLATE, EXPORT, BULK ACTIONS & ROLLBACK
  // =========================================================================

  // Official Excel Template Generator (Specialized_Study_Students.xlsx)
  app.get('/api/students/import/template.xlsx', (_req, res) => {
    const buffer = generateStudentImportTemplateBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Specialized_Study_Students.xlsx"'
    );
    return res.send(Buffer.from(buffer));
  });

  // Export students (all, filtered by classCode, or selected uids) to .xlsx
  app.get('/api/students/export.xlsx', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, db } = authCtx;
    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Eksport faqat administrator uchun ruxsat etilgan.' });
    }

    let students = db.users.filter((u) => u.role === 'student' && u.status !== 'archived');
    if (req.query.classCode) {
      const codeFilter = String(req.query.classCode).trim().toLowerCase();
      students = students.filter(
        (s) =>
          s.classCode?.toLowerCase() === codeFilter ||
          s.classId?.toLowerCase() === `class-${codeFilter}`
      );
    }
    if (req.query.uids) {
      const uidSet = new Set(String(req.query.uids).split(',').map((x) => x.trim()));
      students = students.filter((s) => uidSet.has(s.uid));
    }

    const buffer = generateStudentExportBuffer(students);
    const filename = req.query.classCode
      ? `Specialized_Study_${String(req.query.classCode).toUpperCase()}_Students.xlsx`
      : 'Specialized_Study_Students_Export.xlsx';

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(Buffer.from(buffer));
  });

  // Step 1 - 7: Upload & Preview Student Excel/CSV Workbook
  app.post('/api/students/import/preview', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: "O'quvchilarni yuklash faqat administrator uchun." });
    }

    const {
      fileName = 'students.xlsx',
      base64Data,
      csvText,
      selectedSheet,
      selectedHeaderRowIndex,
      columnMappingOverride,
      rowClassOverrides,
      rowFieldOverrides,
    } = req.body;

    let buffer: Buffer;
    if (base64Data && typeof base64Data === 'string') {
      const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      buffer = Buffer.from(cleanBase64, 'base64');
    } else if (csvText && typeof csvText === 'string') {
      buffer = Buffer.from(csvText, 'utf-8');
    } else {
      return res.status(400).json({ error: 'Yuklash uchun Excel (.xlsx) yoki CSV fayl yuboring.' });
    }

    const fileCheck = validateStudentUploadBuffer(buffer, String(fileName));
    if (!fileCheck.valid) {
      return res.status(400).json({ error: fileCheck.error });
    }

    try {
      const preview = parseAndValidateStudentWorkbook(
        buffer,
        String(fileName),
        {
          selectedSheet,
          selectedHeaderRowIndex,
          columnMappingOverride,
          rowClassOverrides,
          rowFieldOverrides,
        },
        db.users
      );
      return res.json(preview);
    } catch (err: any) {
      return res.status(400).json({
        error: err?.message || "Excel faylni o'qishda xatolik yuz berdi.",
      });
    }
  });

  // Step 8 - 9: Idempotent Student Import Confirmation
  app.post('/api/students/import/confirm', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: "O'quvchilarni saqlash faqat administrator uchun." });
    }

    const {
      jobId,
      fileName = 'students.xlsx',
      duplicatePolicy = 'skip_existing',
      rows,
      base64Data,
      csvText,
      selectedSheet,
      selectedHeaderRowIndex,
      columnMappingOverride,
      rowClassOverrides,
      rowFieldOverrides,
    } = req.body;

    const resolvedJobId = String(jobId || `stu-job-${Date.now()}`).trim();

    // Idempotency guard: if this jobId was already processed and completed, return existing job
    const existingJob = (db.studentImportJobs || []).find(
      (j) => j.jobId === resolvedJobId && j.status === 'completed'
    );
    if (existingJob) {
      return res.json({
        idempotentReplay: true,
        job: existingJob,
        importedCount: existingJob.importedCount,
        updatedCount: existingJob.updatedCount,
        skippedCount: existingJob.skippedCount,
        errorCount: existingJob.errorCount,
      });
    }

    // Either use verified rows from preview or re-parse buffer server-side
    let parsedRows = Array.isArray(rows) ? rows : [];
    if (parsedRows.length === 0 && (base64Data || csvText)) {
      const buffer = base64Data
        ? Buffer.from(
            String(base64Data).includes(',') ? String(base64Data).split(',')[1] : String(base64Data),
            'base64'
          )
        : Buffer.from(String(csvText), 'utf-8');
      const preview = parseAndValidateStudentWorkbook(
        buffer,
        String(fileName),
        {
          selectedSheet,
          selectedHeaderRowIndex,
          columnMappingOverride,
          rowClassOverrides,
          rowFieldOverrides,
        },
        db.users
      );
      parsedRows = preview.rows;
    }

    if (parsedRows.length === 0) {
      return res.status(400).json({ error: "Saqlash uchun o'quvchilar qatorlari topilmadi." });
    }

    const nowIso = new Date().toISOString();
    const createdStudentUids: string[] = [];
    const updatedStudentUids: string[] = [];
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Sort incoming rows by canonical 19-class order then surname/fullName alphabetically
    const classOrderIndex = new Map<string, number>(
      OFFICIAL_19_CLASS_CODES.map((code, idx) => [code, idx])
    );

    const sortedRows = [...parsedRows].sort((a: any, b: any) => {
      const codeA = normalizeClassCodeInput(a.normalizedClassCode || a.rawClassCode);
      const codeB = normalizeClassCodeInput(b.normalizedClassCode || b.rawClassCode);
      const idxA = codeA ? (classOrderIndex.get(codeA) ?? 999) : 999;
      const idxB = codeB ? (classOrderIndex.get(codeB) ?? 999) : 999;
      if (idxA !== idxB) return idxA - idxB;
      return String(a.lastName || a.fullName || '').localeCompare(
        String(b.lastName || b.fullName || ''),
        'uz'
      );
    });

    for (let i = 0; i < sortedRows.length; i++) {
      const r = sortedRows[i];
      const fullName = String(r.fullName || r.rawFullName || '')
        .replace(/\s+/g, ' ')
        .trim();
      const firstName = String(r.firstName || r.rawFirstName || '').trim();
      const lastName = String(r.lastName || r.rawLastName || '').trim();
      const patronymic = String(r.patronymic || r.rawPatronymic || '').trim();
      const normClass = normalizeClassCodeInput(r.normalizedClassCode || r.rawClassCode);
      const rawEmail = String(r.email || r.rawEmail || '').trim().toLowerCase();
      const rawStudentId = String(r.studentId || r.rawStudentId || '').trim();

      if (!fullName || !normClass) {
        errorCount += 1;
        continue;
      }

      if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
        errorCount += 1;
        continue;
      }

      const cls = db.classes.find((c) => c.code.toLowerCase() === normClass.toLowerCase());
      if (!cls) {
        errorCount += 1;
        continue;
      }

      // Check existing student by studentCode, email, or (fullName + classCode)
      const existingStu = db.users.find((u) => {
        if (u.role !== 'student' || u.status === 'archived') return false;
        if (rawStudentId && u.studentCode && u.studentCode.toLowerCase() === rawStudentId.toLowerCase()) {
          return true;
        }
        if (
          rawEmail &&
          !u.email.endsWith('@student.specialized.local') &&
          u.email.toLowerCase() === rawEmail
        ) {
          return true;
        }
        const uClass = normalizeClassCodeInput(u.classCode || u.classId?.replace(/^class-/, ''));
        const uName = String(u.displayName || '').trim().toLowerCase().replace(/\s+/g, ' ');
        return uName === fullName.toLowerCase() && uClass === normClass;
      });

      if (existingStu) {
        if (duplicatePolicy === 'update_existing') {
          existingStu.displayName = fullName;
          if (firstName) existingStu.firstName = firstName;
          if (lastName) existingStu.lastName = lastName;
          if (patronymic) existingStu.patronymic = patronymic;
          existingStu.classId = cls.id;
          existingStu.classCode = cls.code;
          existingStu.grade = cls.grade;
          existingStu.track = cls.track;
          if (rawEmail) existingStu.email = rawEmail;
          if (rawStudentId) existingStu.studentCode = rawStudentId;
          existingStu.updatedAt = nowIso;
          updatedCount += 1;
          updatedStudentUids.push(existingStu.uid);
        } else {
          skippedCount += 1;
        }
        continue;
      }

      const newUid = `user-imp-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
      const generatedCode =
        rawStudentId ||
        `SS-${cls.code.toUpperCase()}-${String(db.users.length + importedCount + 1).padStart(3, '0')}`;
      const assignedEmail =
        rawEmail || `${generatedCode.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.specialized.local`;

      // Never import plaintext passwords from Excel! Create student profile with pending_activation
      const newStudent: UserProfile = {
        uid: newUid,
        displayName: fullName,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        patronymic: patronymic || undefined,
        email: assignedEmail,
        role: 'student',
        institutionId: user.institutionId,
        classId: cls.id,
        classCode: cls.code,
        grade: cls.grade,
        track: cls.track,
        studentCode: generatedCode,
        importJobId: resolvedJobId,
        status: 'pending_activation',
        enrolledAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      db.users.push(newStudent);
      db.studentEnrollments.push({
        id: `enr-imp-${Date.now()}-${i}`,
        institutionId: user.institutionId,
        studentId: newUid,
        classId: cls.id,
        classCode: cls.code,
        grade: cls.grade,
        track: cls.track,
        status: 'active',
        enrolledAt: nowIso,
      });

      createdStudentUids.push(newUid);
      importedCount += 1;
    }

    ensureSpecializedStudyStructure(db);

    const jobRecord: StudentImportJob = {
      id: `sij-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      jobId: resolvedJobId,
      institutionId: user.institutionId,
      fileName: String(fileName),
      duplicatePolicy: duplicatePolicy === 'update_existing' ? 'update_existing' : 'skip_existing',
      totalRows: parsedRows.length,
      importedCount,
      updatedCount,
      skippedCount,
      errorCount,
      createdStudentUids,
      updatedStudentUids,
      status: 'completed',
      initiatedByUid: user.uid,
      initiatedByName: user.displayName,
      createdAt: nowIso,
    };

    db.studentImportJobs.unshift(jobRecord);

    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Excel orqali o'quvchilar yuklandi (${importedCount} ta yangi, ${skippedCount} ta o'tkazib yuborildi)`,
      String(fileName),
      jobRecord.id
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'STUDENTS_IMPORTED');

    return res.json({
      job: jobRecord,
      importedCount,
      updatedCount,
      skippedCount,
      errorCount,
      createdStudentUids,
    });
  });

  // Import History List
  app.get('/api/students/import/history', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, db } = authCtx;
    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Ruxsat yo‘q.' });
    }
    return res.json({ jobs: db.studentImportJobs || [] });
  });

  // Safe Import Rollback (removes or archives only records from that import jobId)
  app.post('/api/students/import/:jobId/rollback', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Importni bekor qilish faqat administrator uchun.' });
    }

    const targetJobId = String(req.params.jobId).trim();
    const job = (db.studentImportJobs || []).find(
      (j) => j.id === targetJobId || j.jobId === targetJobId
    );
    if (!job) {
      return res.status(404).json({ error: 'Import amaliyoti topilmadi.' });
    }
    if (job.status === 'rolled_back') {
      return res.status(400).json({ error: 'Ushbu import allaqachon bekor qilingan.' });
    }

    const uidsToRollback = new Set(job.createdStudentUids || []);
    let removedCount = 0;
    let archivedCount = 0;

    db.users = db.users.filter((u) => {
      if (!uidsToRollback.has(u.uid) && u.importJobId !== job.jobId) {
        return true;
      }
      // If student already has assessment attempts, archive instead of deleting
      const hasActivity = db.attempts.some((att) => att.studentId === u.uid);
      if (hasActivity) {
        u.status = 'archived';
        u.updatedAt = new Date().toISOString();
        archivedCount += 1;
        return true;
      }
      removedCount += 1;
      return false;
    });

    db.studentEnrollments = db.studentEnrollments.filter(
      (enr) => !uidsToRollback.has(enr.studentId)
    );

    job.status = 'rolled_back';
    job.rolledBackAt = new Date().toISOString();
    job.rolledBackByUid = user.uid;

    ensureSpecializedStudyStructure(db);
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Excel import bekor qilindi (o'chirildi: ${removedCount}, arxivlandi: ${archivedCount})`,
      job.fileName,
      job.id
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'IMPORT_ROLLED_BACK');

    return res.json({
      job,
      removedCount,
      archivedCount,
    });
  });

  // Bulk Student Operations (change_class, send_invite, archive, suspend, activate)
  app.post('/api/students/bulk-action', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Ommaviy amallar faqat administrator uchun.' });
    }

    const { action, studentUids, targetClassCode } = req.body;
    if (!Array.isArray(studentUids) || studentUids.length === 0) {
      return res.status(400).json({ error: "Kamida 1 ta o'quvchini tanlang." });
    }

    const uidSet = new Set(studentUids.map(String));
    const matchedStudents = db.users.filter((u) => u.role === 'student' && uidSet.has(u.uid));
    if (matchedStudents.length === 0) {
      return res.status(404).json({ error: "Tanlangan o'quvchilar topilmadi." });
    }

    const nowIso = new Date().toISOString();

    if (action === 'change_class') {
      const normClass = normalizeClassCodeInput(targetClassCode);
      const cls = normClass
        ? db.classes.find((c) => c.code.toLowerCase() === normClass.toLowerCase())
        : undefined;
      if (!cls) {
        return res.status(400).json({ error: '19 ta rasmiy sinfdan birini tanlang.' });
      }
      for (const s of matchedStudents) {
        s.classId = cls.id;
        s.classCode = cls.code;
        s.grade = cls.grade;
        s.track = cls.track;
        s.updatedAt = nowIso;
      }
      ensureSpecializedStudyStructure(db);
      appendAuditLog(
        db,
        user.institutionId,
        user,
        `${matchedStudents.length} ta o'quvchi ${cls.code} sinfiga o'tkazildi`,
        cls.code
      );
      saveDbState(env, db);
      broadcastInstitutionUpdate(env, user.institutionId, 'STUDENTS_BULK_UPDATED');
      return res.json({ updatedCount: matchedStudents.length, classCode: cls.code });
    }

    if (action === 'archive' || action === 'suspend' || action === 'activate') {
      const nextStatus =
        action === 'archive' ? 'archived' : action === 'suspend' ? 'suspended' : 'active';
      for (const s of matchedStudents) {
        s.status = nextStatus;
        s.updatedAt = nowIso;
      }
      ensureSpecializedStudyStructure(db);
      appendAuditLog(
        db,
        user.institutionId,
        user,
        `${matchedStudents.length} ta o'quvchi holati o'zgartirildi -> ${nextStatus}`,
        `${matchedStudents.length} ta o'quvchi`
      );
      saveDbState(env, db);
      broadcastInstitutionUpdate(env, user.institutionId, 'STUDENTS_BULK_UPDATED');
      return res.json({ updatedCount: matchedStudents.length, status: nextStatus });
    }

    if (action === 'send_invite') {
      const inst = db.institutions.find((i) => i.id === user.institutionId) || db.institutions[0];
      const expiresIso = new Date(Date.now() + 14 * 86400000).toISOString();
      const createdTokens: Array<{ uid: string; displayName: string; rawToken: string }> = [];

      for (const s of matchedStudents) {
        const cls = db.classes.find(
          (c) => c.id === s.classId || c.code.toLowerCase() === (s.classCode || '').toLowerCase()
        );
        const { rawToken, tokenHash } = generateCryptographicInviteToken('STU');
        const inv: Invitation = {
          id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          institutionId: user.institutionId,
          institutionName: inst?.name || 'Specialized Study',
          email: s.email,
          inviteeName: s.displayName,
          role: 'student',
          classId: cls?.id,
          classCode: cls?.code,
          className: cls?.name,
          grade: cls?.grade,
          track: cls?.track,
          tokenHash,
          codePrefix: rawToken.slice(0, 10),
          status: 'pending',
          createdByUid: user.uid,
          createdByName: user.displayName,
          createdAt: nowIso,
          expiresAt: expiresIso,
        };
        db.invitations.unshift(inv);
        createdTokens.push({ uid: s.uid, displayName: s.displayName, rawToken });
      }
      saveDbState(env, db);
      broadcastInstitutionUpdate(env, user.institutionId, 'INVITATION_CREATED');
      return res.json({ invitedCount: createdTokens.length, createdTokens });
    }

    return res.status(400).json({ error: "Noma'lum ommaviy amal." });
  });

  // =========================================================================
  // GLOBAL SEARCH & ACADEMIC CALENDAR ENDPOINTS (SECTION 09, 11, 12)
  // =========================================================================

  app.get('/api/search', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, db } = authCtx;

    const q = String(req.query.q || '').trim().toLowerCase();
    const results: GlobalSearchResultItem[] = [];
    const isAdmin = user.role === 'admin' || user.role === 'platform_owner';

    if (!q) {
      return res.json({ results: [] });
    }

    if (isAdmin) {
      // 1. Classes
      for (const cls of db.classes) {
        if (
          cls.code.toLowerCase().includes(q) ||
          `${cls.code} sinfi`.toLowerCase().includes(q) ||
          cls.trackLabel.toLowerCase().includes(q)
        ) {
          results.push({
            id: `srch-cls-${cls.id}`,
            category: 'class',
            title: `${cls.code.toUpperCase()} sinfi`,
            subtitle: `${cls.grade}-sinf • ${cls.trackLabel} • ${cls.studentCount} o'quvchi`,
            badge: cls.track,
            route: `/admin/classes?class=${cls.code}`,
            recordId: cls.id,
            classCode: cls.code,
          });
        }
      }

      // 2. Students
      for (const s of db.users) {
        if (s.role !== 'student' || s.status === 'archived') continue;
        if (
          s.displayName.toLowerCase().includes(q) ||
          (s.studentCode && s.studentCode.toLowerCase().includes(q)) ||
          (s.classCode && s.classCode.toLowerCase().includes(q)) ||
          s.email.toLowerCase().includes(q)
        ) {
          results.push({
            id: `srch-stu-${s.uid}`,
            category: 'student',
            title: s.displayName,
            subtitle: `${(s.classCode || '').toUpperCase()} • ID: ${s.studentCode || s.uid.slice(0, 8)}`,
            badge: s.classCode?.toUpperCase(),
            route: `/admin/students?student=${s.uid}`,
            recordId: s.uid,
            classCode: s.classCode,
          });
        }
      }

      // 3. Subjects
      for (const subj of db.subjects) {
        if (subj.name.toLowerCase().includes(q) || (subj.code && subj.code.toLowerCase().includes(q))) {
          results.push({
            id: `srch-subj-${subj.id}`,
            category: 'subject',
            title: subj.name,
            subtitle: `Yo'nalish: ${subj.trackTypes.join(', ')}`,
            badge: subj.code,
            route: `/admin/subjects`,
            recordId: subj.id,
          });
        }
      }

      // 4. Work plans
      for (const wp of db.workPlans || []) {
        if (
          wp.title.toLowerCase().includes(q) ||
          wp.classCode.toLowerCase().includes(q) ||
          wp.subjectName.toLowerCase().includes(q)
        ) {
          results.push({
            id: `srch-wp-${wp.id}`,
            category: 'work_plan',
            title: wp.title,
            subtitle: `${wp.classCode.toUpperCase()} • ${wp.subjectName} • ${wp.quarter}-chorak`,
            badge: `${wp.rows.length} dars`,
            route: `/admin/work-plans`,
            recordId: wp.id,
            classCode: wp.classCode,
          });
        }
      }
    }

    // 5. Lessons (filtered by student's class if student)
    const allowedLessons = isAdmin
      ? db.lessons || []
      : (db.lessons || []).filter(
          (l) =>
            lessonMatchesClass(l, user.classCode || user.classId) &&
            (!l.additionalCurriculumAssignment || l.tTrackVisibilityApproved === true) &&
            l.status !== 'planned' &&
            l.status !== 'archived'
        );

    for (const l of allowedLessons) {
      if (
        l.title.toLowerCase().includes(q) ||
        l.topicName.toLowerCase().includes(q) ||
        l.subjectName.toLowerCase().includes(q) ||
        l.classCode.toLowerCase().includes(q)
      ) {
        results.push({
          id: `srch-les-${l.id}`,
          category: 'lesson',
          title: `${l.lessonNumber}-dars: ${l.title}`,
          subtitle: `${l.classCode.toUpperCase()} • ${l.subjectName} • ${l.quarter}-chorak`,
          badge: l.classCode.toUpperCase(),
          route: isAdmin ? `/admin/lessons` : `/student/lessons`,
          recordId: l.id,
          classCode: l.classCode,
        });
      }
    }

    // 6. Assessments
    const allowedAssessments = isAdmin
      ? db.assessments
      : db.assessments.filter(
          (a) =>
            a.status === 'published' &&
            (a.classId === user.classId ||
              a.classCode?.toLowerCase() === (user.classCode || '').toLowerCase())
        );

    for (const a of allowedAssessments) {
      if (
        a.title.toLowerCase().includes(q) ||
        a.subject.toLowerCase().includes(q) ||
        (a.classCode && a.classCode.toLowerCase().includes(q))
      ) {
        results.push({
          id: `srch-ass-${a.id}`,
          category: 'assessment',
          title: a.title,
          subtitle: `${(a.classCode || '').toUpperCase()} • ${a.subject} • ${a.questionIds.length} savol`,
          badge: a.status === 'published' ? 'Nashr etilgan' : 'Qoralama',
          route: isAdmin ? `/admin/assessments` : `/student/assessments`,
          recordId: a.id,
          classCode: a.classCode,
        });
      }
    }

    return res.json({ results: results.slice(0, 25) });
  });

  app.get('/api/calendar', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, db } = authCtx;
    const isAdmin = user.role === 'admin' || user.role === 'platform_owner';

    const classFilter = req.query.classCode ? String(req.query.classCode).toLowerCase() : '';
    const subjectFilter = req.query.subject ? String(req.query.subject).toLowerCase() : '';
    const typeFilter = req.query.type ? String(req.query.type).toLowerCase() : '';

    const events: CalendarEventItem[] = [];

    // 1. Lessons with real scheduledDate (or createdAt date if scheduledDate is set)
    const lessonsPool = isAdmin
      ? db.lessons || []
      : (db.lessons || []).filter(
          (l) =>
            lessonMatchesClass(l, user.classCode || user.classId) &&
            (!l.additionalCurriculumAssignment || l.tTrackVisibilityApproved === true) &&
            l.status !== 'planned' &&
            l.status !== 'archived'
        );

    for (const l of lessonsPool) {
      if (!l.scheduledDate) continue;
      if (classFilter && !lessonMatchesClass(l, classFilter)) continue;
      if (subjectFilter && l.subjectName.toLowerCase() !== subjectFilter) continue;
      if (typeFilter && typeFilter !== 'lesson') continue;

      events.push({
        id: `cal-lesson-${l.id}`,
        title: `${l.classCode.toUpperCase()} • ${l.subjectName}: ${l.lessonNumber}-dars (${l.title})`,
        type: 'lesson',
        date: l.scheduledDate.slice(0, 10),
        classId: l.classId,
        classCode: l.classCode,
        subject: l.subjectName,
        quarter: l.quarter,
        status: l.status,
        targetRoute: isAdmin ? `/admin/lessons` : `/student/lessons`,
        recordId: l.id,
      });
    }

    // 2. Assessments (availableFrom & dueDate)
    const assessmentsPool = isAdmin
      ? db.assessments
      : db.assessments.filter(
          (a) =>
            a.status === 'published' &&
            (a.classId === user.classId ||
              a.classCode?.toLowerCase() === (user.classCode || '').toLowerCase())
        );

    for (const a of assessmentsPool) {
      const aClass = a.classCode || db.classes.find((c) => c.id === a.classId)?.code || '';
      if (classFilter && aClass.toLowerCase() !== classFilter) continue;
      if (subjectFilter && a.subject.toLowerCase() !== subjectFilter) continue;

      if (a.availableFrom && (!typeFilter || typeFilter === 'assessment')) {
        events.push({
          id: `cal-ass-start-${a.id}`,
          title: `Test: ${a.title}`,
          type: 'assessment',
          date: a.availableFrom.slice(0, 10),
          classId: a.classId,
          classCode: aClass,
          subject: a.subject,
          quarter: a.quarter,
          status: a.status,
          targetRoute: isAdmin ? `/admin/assessments` : `/student/assessments`,
          recordId: a.id,
        });
      }

      if (a.dueDate && (!typeFilter || typeFilter === 'deadline')) {
        events.push({
          id: `cal-ass-due-${a.id}`,
          title: `Muddat: ${a.title}`,
          type: 'deadline',
          date: a.dueDate.slice(0, 10),
          classId: a.classId,
          classCode: aClass,
          subject: a.subject,
          quarter: a.quarter,
          status: a.status,
          targetRoute: isAdmin ? `/admin/assessments` : `/student/assessments`,
          recordId: a.id,
        });
      }
    }

    // 3. Work Plan confirmation milestones
    if (isAdmin && (!typeFilter || typeFilter === 'milestone')) {
      for (const wp of db.workPlans || []) {
        const milestoneDate = wp.confirmedAt || wp.createdAt;
        if (!milestoneDate) continue;
        if (classFilter && wp.classCode.toLowerCase() !== classFilter) continue;
        if (subjectFilter && wp.subjectName.toLowerCase() !== subjectFilter) continue;

        events.push({
          id: `cal-wp-${wp.id}`,
          title: `Ish reja: ${wp.title}`,
          type: 'milestone',
          date: milestoneDate.slice(0, 10),
          classId: wp.classId,
          classCode: wp.classCode,
          subject: wp.subjectName,
          quarter: wp.quarter,
          status: wp.status,
          targetRoute: `/admin/work-plans`,
          recordId: wp.id,
        });
      }
    }

    events.sort((a, b) => a.date.localeCompare(b.date));
    return res.json({ events });
  });

  // Create or update Subject
  app.post('/api/subjects', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Fan qo‘shish faqat administrator uchun.' });
    }

    const { name, code, grade, description, trackTypes, applicableGrades, applicableClassCodes } =
      req.body;
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: 'Fan nomini kiriting.' });
    }

    const resolvedTracks = Array.isArray(trackTypes) && trackTypes.length > 0 ? trackTypes : ['A', 'T'];
    const resolvedGrades =
      Array.isArray(applicableGrades) && applicableGrades.length > 0
        ? applicableGrades.map(Number)
        : [5, 6, 7, 8, 9, 10, 11];
    const resolvedClassCodes =
      Array.isArray(applicableClassCodes) && applicableClassCodes.length > 0
        ? applicableClassCodes.map((c: string) => String(c).toLowerCase())
        : db.classes
            .filter((c) => resolvedTracks.includes(c.track) && resolvedGrades.includes(c.grade))
            .map((c) => c.code);

    const newSubject: SubjectItem = {
      id: `subj-${Date.now()}`,
      institutionId: user.institutionId,
      name: String(name).trim(),
      code: String(code || String(name).trim().slice(0, 3)).toUpperCase(),
      grade: Number(grade) || 8,
      applicableGrades: resolvedGrades,
      trackTypes: resolvedTracks,
      applicableClassCodes: resolvedClassCodes,
      description: String(description || '').trim(),
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    db.subjects.push(newSubject);
    appendAuditLog(db, user.institutionId, user, 'Yangi fan qo‘shildi', newSubject.name, newSubject.id);
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'SUBJECT_CREATED');
    return res.json({ subject: newSubject });
  });

  app.put('/api/subjects/:id', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Fanni tahrirlash faqat administrator uchun.' });
    }

    const subj = db.subjects.find((s) => s.id === req.params.id);
    if (!subj) return res.status(404).json({ error: 'Fan topilmadi.' });

    const { name, code, description, trackTypes, applicableGrades, applicableClassCodes, status } =
      req.body;
    if (name && String(name).trim().length >= 2) subj.name = String(name).trim();
    if (code) subj.code = String(code).trim().toUpperCase();
    if (typeof description === 'string') subj.description = description.trim();
    if (Array.isArray(trackTypes) && trackTypes.length > 0) subj.trackTypes = trackTypes;
    if (Array.isArray(applicableGrades) && applicableGrades.length > 0) {
      subj.applicableGrades = applicableGrades.map(Number);
    }
    if (Array.isArray(applicableClassCodes)) {
      subj.applicableClassCodes = applicableClassCodes.map((c: string) => String(c).toLowerCase());
    }
    if (status && (status === 'active' || status === 'archived')) {
      subj.status = status;
    }
    subj.updatedAt = new Date().toISOString();

    appendAuditLog(db, user.institutionId, user, 'Fan sozlamalari yangilandi', subj.name, subj.id);
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'SUBJECT_UPDATED');
    return res.json({ subject: subj });
  });

  app.post('/api/topics', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'teacher' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Ruxsat yo‘q.' });
    }

    const { name, subject, grade, description, quarter, unitTitle, classCode } = req.body;
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: 'Mavzu nomini kiriting.' });
    }

    const newTopic: Topic = {
      id: `topic-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      institutionId: user.institutionId,
      name: String(name).trim(),
      subject: String(subject || 'Matematika').trim(),
      grade: Number(grade) || 8,
      quarter: quarter ? (Number(quarter) as 1 | 2 | 3 | 4) : undefined,
      unitTitle: unitTitle ? String(unitTitle).trim() : undefined,
      classCode: classCode ? String(classCode).toLowerCase() : undefined,
      description: String(description || '').trim(),
      orderIndex: db.topics.length + 1,
    };
    db.topics.push(newTopic);
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'TOPIC_CREATED');
    return res.json({ topic: newTopic });
  });

  // =========================================================================
  // WORK PLAN IMPORT (ISH REJALARI) — 6-STEP WORKFLOW ENDPOINTS
  // =========================================================================

  app.get('/api/work-plans/template.xlsx', (req, res) => {
    const classCode = String(req.query.classCode || '7a1');
    const subjectName = String(req.query.subject || 'Matematika');
    const buffer = generateWorkPlanTemplateExcelBuffer(classCode, subjectName, '2026-2027');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Specialized_Study_Ish_Reja_${classCode}_${subjectName}.xlsx"`
    );
    return res.send(Buffer.from(buffer));
  });

  app.get('/api/work-plans', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, db } = authCtx;
    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Ish rejalari faqat administrator uchun.' });
    }
    return res.json({ workPlans: db.workPlans || [] });
  });

  // Step 1-5: Upload & Analyze Work Plan File -> Interactive Editable Preview
  app.post('/api/work-plans/analyze', async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Ish reja yuklash faqat administrator uchun ruxsat etilgan.' });
    }

    const {
      fileName = 'ish_reja.xlsx',
      fileMimeType,
      base64Data,
      rawText,
      rows: explicitRows,
      classId,
      classCode,
      subject,
      subjectId,
      subjectName,
      academicYear = '2026-2027',
      quarter = 1,
      planType = 'quarterly',
    } = req.body;

    const lookupClass = String(classCode || classId || '7a1').trim().toLowerCase();
    const cls = db.classes.find(
      (c) =>
        c.id.toLowerCase() === lookupClass ||
        c.code.toLowerCase() === lookupClass ||
        c.name.toLowerCase() === lookupClass
    );
    if (!cls) {
      return res.status(400).json({ error: 'Tanlangan sinf 19 ta rasmiy sinf ro‘yxatida topilmadi.' });
    }

    const lookupSubj = String(subject || subjectName || subjectId || cls.subject || 'Matematika').trim();
    const subj =
      db.subjects.find(
        (s) =>
          s.id.toLowerCase() === lookupSubj.toLowerCase() ||
          s.name.toLowerCase() === lookupSubj.toLowerCase()
      ) || db.subjects[0];

    const compat = isSubjectCompatibleWithClass(subj.name, cls, db.subjects);
    if (!compat.compatible) {
      return res.status(400).json({
        error: compat.reason || `${subj.name} fani ${cls.code} sinfiga mos emas.`,
      });
    }

    let buffer: Uint8Array | null = null;
    if (base64Data && typeof base64Data === 'string') {
      const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      buffer = new Uint8Array(Buffer.from(cleanBase64, 'base64'));
    }

    const parsedQuarter = ([1, 2, 3, 4].includes(Number(quarter)) ? Number(quarter) : 1) as
      | 1
      | 2
      | 3
      | 4;

    let { rows, warnings } = parseWorkPlanRowsFromBufferOrText(
      String(fileName),
      buffer,
      rawText ? String(rawText) : undefined,
      Array.isArray(explicitRows) ? explicitRows : undefined,
      subj.name,
      parsedQuarter
    );

    // If rows could not be extracted deterministically (e.g. PDF/image/DOCX binary) and Gemini is available, use Gemini
    const ai = getGeminiClient(req);
    if (rows.length === 0 && ai) {
      try {
        const parts: any[] = [];
        if (buffer && fileMimeType && /^(application\/pdf|image\/)/i.test(fileMimeType)) {
          parts.push({
            inlineData: {
              mimeType: fileMimeType,
              data: Buffer.from(buffer).toString('base64'),
            },
          });
        }
        parts.push({
          text: `Ushbu o'quv ish reja faylidan (${fileName}) ${cls.code} sinfi ${subj.name} fani (${academicYear}, ${parsedQuarter}-chorak) uchun darslar ro'yxatini ajratib bering. Har bir dars uchun lessonNumber, quarter, unitTitle, topicName, lessonTitle, learningObjectives, scheduledDate va hours maydonlarini JSON massivida qaytaring.`,
        });

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: parts,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                rows: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      lessonNumber: { type: Type.NUMBER },
                      quarter: { type: Type.NUMBER },
                      unitTitle: { type: Type.STRING },
                      topicName: { type: Type.STRING },
                      lessonTitle: { type: Type.STRING },
                      learningObjectives: { type: Type.STRING },
                      scheduledDate: { type: Type.STRING },
                      hours: { type: Type.NUMBER },
                    },
                    required: ['lessonNumber', 'unitTitle', 'topicName', 'lessonTitle', 'learningObjectives'],
                  },
                },
              },
              required: ['rows'],
            },
          },
        });

        const parsedAi = JSON.parse((response.text ?? '{}').trim());
        if (Array.isArray(parsedAi.rows) && parsedAi.rows.length > 0) {
          rows = parsedAi.rows.map((r: any, idx: number) => ({
            rowId: `wprow-ai-${Date.now()}-${idx + 1}`,
            lessonNumber: Number(r.lessonNumber) || idx + 1,
            quarter: ([1, 2, 3, 4].includes(Number(r.quarter)) ? Number(r.quarter) : parsedQuarter) as
              | 1
              | 2
              | 3
              | 4,
            weekNumber: Math.ceil((Number(r.lessonNumber) || idx + 1) / 3),
            unitTitle: String(r.unitTitle || `${parsedQuarter}-chorak bo‘limi`),
            topicName: String(r.topicName || r.lessonTitle),
            lessonTitle: String(r.lessonTitle),
            learningObjectives: String(r.learningObjectives),
            scheduledDate: r.scheduledDate ? String(r.scheduledDate) : undefined,
            hours: Number(r.hours) || 1,
          }));
        }
      } catch (aiErr) {
        console.warn('Gemini WorkPlan extraction fallback:', aiErr);
      }
    }

    // If still empty (e.g., binary PDF/image uploaded in environment without GEMINI_API_KEY), generate structured draft rows from file title so Admin can edit them in the preview table
    if (rows.length === 0) {
      const subjectTopics = db.topics.filter(
        (t) => t.subject.toLowerCase() === subj.name.toLowerCase()
      );
      const baseTopics =
        subjectTopics.length > 0
          ? subjectTopics
          : [
              { name: `${subj.name}: Kirish va asosiy tushunchalar`, learningObjectives: 'Asosiy qoidalarni o‘rganish' },
              { name: `${subj.name}: Amaliy masalalar yechish`, learningObjectives: 'Namunaviy masalalar ishlash' },
              { name: `${subj.name}: Mustahkamlash va tahlil`, learningObjectives: 'Mustaqil topshiriqlarni bajarish' },
            ];
      rows = baseTopics.map((bt, idx) => ({
        rowId: `wprow-doc-${Date.now()}-${idx + 1}`,
        lessonNumber: idx + 1,
        quarter: parsedQuarter,
        weekNumber: idx + 1,
        unitTitle: `${parsedQuarter}-chorak. ${subj.name} bo‘limi`,
        topicName: bt.name,
        lessonTitle: `${idx + 1}-dars. ${bt.name}`,
        learningObjectives: bt.learningObjectives || 'Mavzu bo‘yicha amaliy ko‘nikmalarni shakllantirish.',
        hours: 1,
      }));
      warnings.push(
        'Fayldan darslar jadvali dastlabki qoralama sifatida ajratildi. Saqlashdan oldin jadval qatorlarini ko‘rib chiqing.'
      );
    }

    const nowIso = new Date().toISOString();
    const draftPlan: WorkPlan = {
      id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      institutionId: user.institutionId,
      title: `${cls.code.toUpperCase()} — ${subj.name} (${parsedQuarter}-chorak ish rejasi)`,
      fileName: String(fileName),
      fileMimeType: fileMimeType ? String(fileMimeType) : undefined,
      classId: cls.id,
      classCode: cls.code,
      grade: cls.grade,
      track: cls.track,
      subjectId: subj.id,
      subjectName: subj.name,
      academicYear: String(academicYear),
      quarter: parsedQuarter,
      planType: (planType as WorkPlanType) || 'quarterly',
      status: 'draft_preview',
      rows,
      warnings,
      createdByUid: user.uid,
      createdByName: user.displayName,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.workPlans.unshift(draftPlan);
    saveDbState(env, db);

    return res.json({
      workPlan: draftPlan,
      rows,
      warnings,
    });
  });

  // Step 6: Admin Confirms Preview -> Creates WorkPlan, Topics, Lessons & Builds Curriculum Map
  app.post('/api/work-plans/confirm', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Ish rejani tasdiqlash faqat administrator uchun.' });
    }

    const {
      workPlanId,
      title,
      fileName,
      classId,
      classCode,
      subject,
      subjectId,
      subjectName,
      academicYear = '2026-2027',
      quarter = 1,
      planType = 'quarterly',
      rows,
      publishLessons = false,
    } = req.body;

    const lookupClass = String(classCode || classId || '7a1').trim().toLowerCase();
    const cls = db.classes.find(
      (c) =>
        c.id.toLowerCase() === lookupClass ||
        c.code.toLowerCase() === lookupClass ||
        c.name.toLowerCase() === lookupClass
    );
    if (!cls) {
      return res.status(400).json({ error: 'Sinf topilmadi.' });
    }

    const lookupSubj = String(
      subject || subjectName || subjectId || cls.subject
    ).trim();
    const subj =
      db.subjects.find(
        (s) =>
          s.id.toLowerCase() === lookupSubj.toLowerCase() ||
          s.name.toLowerCase() === lookupSubj.toLowerCase()
      ) || db.subjects[0];

    const compat = isSubjectCompatibleWithClass(subj.name, cls, db.subjects);
    if (!compat.compatible) {
      return res.status(400).json({
        error: compat.reason || `${subj.name} fani ${cls.code} sinfiga mos emas.`,
      });
    }

    const existingPlan = workPlanId
      ? db.workPlans.find((wp) => wp.id === workPlanId)
      : db.workPlans.find(
          (wp) =>
            wp.status === 'draft_preview' &&
            wp.classId === cls.id &&
            wp.subjectId === subj.id &&
            wp.quarter === Number(quarter || 1)
        );

    const finalRows: WorkPlanRowItem[] = Array.isArray(rows) && rows.length > 0
      ? rows
      : existingPlan?.rows || [];

    if (finalRows.length === 0) {
      return res.status(400).json({ error: 'Tasdiqlash uchun kamida 1 ta dars qatori bo‘lishi shart.' });
    }

    const nowIso = new Date().toISOString();
    const parsedQuarter = ([1, 2, 3, 4].includes(Number(quarter))
      ? Number(quarter)
      : existingPlan?.quarter || 1) as 1 | 2 | 3 | 4;

    let confirmedPlan: WorkPlan;
    if (existingPlan) {
      existingPlan.title = title ? String(title).trim() : existingPlan.title;
      existingPlan.rows = finalRows;
      existingPlan.status = 'confirmed';
      existingPlan.confirmedAt = nowIso;
      existingPlan.updatedAt = nowIso;
      confirmedPlan = existingPlan;
    } else {
      confirmedPlan = {
        id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        institutionId: user.institutionId,
        title:
          title
            ? String(title).trim()
            : `${cls.code.toUpperCase()} — ${subj.name} (${parsedQuarter}-chorak ish rejasi)`,
        fileName: String(fileName || 'ish_reja.xlsx'),
        classId: cls.id,
        classCode: cls.code,
        grade: cls.grade,
        track: cls.track,
        subjectId: subj.id,
        subjectName: subj.name,
        academicYear: String(academicYear),
        quarter: parsedQuarter,
        planType: (planType as WorkPlanType) || 'quarterly',
        status: 'confirmed',
        rows: finalRows,
        warnings: [],
        createdByUid: user.uid,
        createdByName: user.displayName,
        createdAt: nowIso,
        confirmedAt: nowIso,
        updatedAt: nowIso,
      };
      db.workPlans.unshift(confirmedPlan);
    }

    const createdLessons: LessonItem[] = [];
    const createdTopics: Topic[] = [];

    for (const row of finalRows) {
      const cleanTopicName = String(row.topicName || row.lessonTitle).trim();
      let topicRecord = db.topics.find(
        (t) =>
          t.subject.toLowerCase() === subj.name.toLowerCase() &&
          t.grade === cls.grade &&
          t.name.toLowerCase() === cleanTopicName.toLowerCase()
      );

      if (!topicRecord) {
        topicRecord = {
          id: `topic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          code: `TOP-${subj.code}-${cls.grade}-${db.topics.length + 1}`,
          institutionId: user.institutionId,
          subjectId: subj.id,
          subjectCode: subj.code,
          unitTitle: row.unitTitle,
          quarter: row.quarter || parsedQuarter,
          classCode: cls.code,
          track: cls.track,
          name: cleanTopicName,
          subject: subj.name,
          grade: cls.grade,
          description: row.learningObjectives || cleanTopicName,
          learningObjectives: row.learningObjectives,
          status: 'active',
          orderIndex: db.topics.length + 1,
        };
        db.topics.push(topicRecord);
        createdTopics.push(topicRecord);
      }

      // Check if lesson with same class, subject, quarter, and lessonNumber already exists
      const existingLesson = db.lessons.find(
        (l) =>
          l.classCode.toLowerCase() === cls.code.toLowerCase() &&
          l.subjectName.toLowerCase() === subj.name.toLowerCase() &&
          l.quarter === (row.quarter || parsedQuarter) &&
          l.lessonNumber === Number(row.lessonNumber)
      );

      if (existingLesson) {
        existingLesson.workPlanId = confirmedPlan.id;
        existingLesson.unitTitle = String(row.unitTitle || existingLesson.unitTitle);
        existingLesson.topicId = topicRecord.id;
        existingLesson.topicName = topicRecord.name;
        existingLesson.title = String(row.lessonTitle || existingLesson.title);
        existingLesson.learningObjectives = String(
          row.learningObjectives || existingLesson.learningObjectives
        );
        existingLesson.scheduledDate = row.scheduledDate || existingLesson.scheduledDate;
        existingLesson.homework = row.homework || existingLesson.homework;
        if (publishLessons) {
          existingLesson.status = 'published';
        }
        existingLesson.updatedAt = nowIso;
        createdLessons.push(existingLesson);
      } else {
        const newLesson: LessonItem = {
          id: `lesson-${cls.code}-${subj.code.toLowerCase()}-${Date.now()}-${row.lessonNumber}`,
          institutionId: user.institutionId,
          workPlanId: confirmedPlan.id,
          classId: cls.id,
          classCode: cls.code,
          grade: cls.grade,
          track: cls.track,
          subjectId: subj.id,
          subjectName: subj.name,
          academicYear: confirmedPlan.academicYear,
          quarter: (row.quarter || parsedQuarter) as 1 | 2 | 3 | 4,
          weekNumber: row.weekNumber || Math.ceil(Number(row.lessonNumber) / 3),
          lessonNumber: Number(row.lessonNumber),
          unitTitle: String(row.unitTitle || `${parsedQuarter}-chorak bo‘limi`),
          topicId: topicRecord.id,
          topicName: topicRecord.name,
          title: String(row.lessonTitle || cleanTopicName),
          learningObjectives: String(
            row.learningObjectives || 'Mavzu bo‘yicha bilim va ko‘nikmalarni shakllantirish.'
          ),
          content: `${row.lessonTitle || cleanTopicName}. O‘quv maqsadi: ${row.learningObjectives || ''}`,
          homework: row.homework,
          scheduledDate: row.scheduledDate,
          hours: Number(row.hours) || 1,
          materials: [],
          relatedAssessmentIds: [],
          status: publishLessons ? 'published' : 'planned',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        db.lessons.push(newLesson);
        createdLessons.push(newLesson);
      }
    }

    // Sort lessons by classCode, quarter, lessonNumber
    db.lessons.sort((a, b) => {
      if (a.classCode !== b.classCode) return a.classCode.localeCompare(b.classCode);
      if (a.quarter !== b.quarter) return a.quarter - b.quarter;
      return a.lessonNumber - b.lessonNumber;
    });

    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Ish reja tasdiqlandi va O‘quv xaritasi yaratildi (${cls.code}, ${subj.name}, ${createdLessons.length} ta dars)`,
      confirmedPlan.title,
      confirmedPlan.id
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'WORK_PLAN_CONFIRMED');

    return res.json({
      workPlan: confirmedPlan,
      lessonsCreatedCount: createdLessons.length,
      topicsCreatedCount: createdTopics.length,
      lessons: createdLessons,
    });
  });

  app.delete('/api/work-plans/:id', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;
    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Ruxsat yo‘q.' });
    }
    const idx = db.workPlans.findIndex((wp) => wp.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Ish reja topilmadi.' });
    db.workPlans.splice(idx, 1);
    saveDbState(env, db);
    return res.json({ status: 'ok' });
  });

  // =========================================================================
  // OFFICIAL MATHEMATICS CURRICULUM ZIP IMPORT ENGINE (SECTIONS 1-8)
  // =========================================================================

  app.get('/api/curriculum-zip/official-preview', async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user } = authCtx;
    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'O‘quv reja importi faqat administrator uchun.' });
    }
    const preview = await getOfficialMathArchivePreview();
    if (!preview) {
      return res.status(404).json({ error: 'Rasmiy Matematika ZIP arxivi topilmadi.' });
    }
    return res.json({ preview });
  });

  app.post('/api/curriculum-zip/preview', async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user } = authCtx;
    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'O‘quv reja importi faqat administrator uchun.' });
    }

    try {
      const { useOfficialAttachedArchive, base64Data, fileName } = req.body || {};
      if (useOfficialAttachedArchive || !base64Data) {
        const preview = await getOfficialMathArchivePreview();
        if (!preview) {
          return res.status(404).json({ error: 'Rasmiy Matematika ZIP arxivi topilmadi.' });
        }
        return res.json({ preview });
      }

      const cleanBase64 = String(base64Data).includes(',')
        ? String(base64Data).split(',')[1]
        : String(base64Data);
      const buf = Buffer.from(cleanBase64, 'base64');
      const preview = await parseAndValidateCurriculumZipBuffer(
        buf,
        String(fileName || OFFICIAL_MATH_ARCHIVE_DISPLAY_NAME)
      );
      return res.json({ preview });
    } catch (err: any) {
      return res.status(400).json({
        error: err?.message || 'ZIP o‘quv rejasini tekshirishda xatolik yuz berdi.',
      });
    }
  });

  app.post('/api/curriculum-zip/confirm', async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;
    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'O‘quv reja importini tasdiqlash faqat administrator uchun.' });
    }

    try {
      const {
        jobId,
        useOfficialAttachedArchive,
        base64Data,
        fileName,
        tTrackVisibilityApproved = false,
        publishImmediately = false,
        duplicatePolicy = 'update_existing',
      } = req.body || {};

      let preview;
      if (useOfficialAttachedArchive || !base64Data) {
        preview = await getOfficialMathArchivePreview();
        if (!preview) {
          return res.status(404).json({ error: 'Rasmiy Matematika ZIP arxivi topilmadi.' });
        }
      } else {
        const cleanBase64 = String(base64Data).includes(',')
          ? String(base64Data).split(',')[1]
          : String(base64Data);
        const buf = Buffer.from(cleanBase64, 'base64');
        preview = await parseAndValidateCurriculumZipBuffer(
          buf,
          String(fileName || OFFICIAL_MATH_ARCHIVE_DISPLAY_NAME)
        );
      }

      if (!Array.isArray(db.curriculumImportJobs)) {
        db.curriculumImportJobs = [];
      }

      const inst = db.institutions.find((i) => i.id === user.institutionId) || db.institutions[0];
      const result = applyCurriculumZipPreviewToDatabase(
        preview,
        db.workPlans,
        db.lessons,
        db.topics,
        db.curriculumImportJobs,
        {
          institutionId: user.institutionId,
          academicYear: inst?.academicYear || '2026-2027',
          actorUid: user.uid,
          actorName: user.displayName,
          jobId: jobId ? String(jobId) : undefined,
          tTrackVisibilityApproved: Boolean(tTrackVisibilityApproved),
          publishImmediately: Boolean(publishImmediately),
          duplicatePolicy: duplicatePolicy === 'skip_existing' ? 'skip_existing' : 'update_existing',
        }
      );

      appendAuditLog(
        db,
        user.institutionId,
        user,
        `Matematika rasmiy ZIP o‘quv rejasi import qilindi (${preview.totalWorkbooks} ta fayl, ${result.importedLessonsCount} yangi / ${result.updatedLessonsCount} yangilangan dars)`,
        preview.archiveName,
        result.job.id
      );

      saveDbState(env, db);
      broadcastInstitutionUpdate(env, user.institutionId, 'CURRICULUM_ZIP_IMPORTED');

      return res.json({
        ...result,
        workPlansCount: db.workPlans.length,
        lessonsCount: db.lessons.length,
        totalWorkbooks: preview.totalWorkbooks,
        totalLessonRecords: preview.totalLessonRecords,
        quarterDistribution: preview.quarterDistribution,
      });
    } catch (err: any) {
      return res.status(400).json({
        error: err?.message || 'ZIP o‘quv rejasini saqlashda xatolik yuz berdi.',
      });
    }
  });

  app.put('/api/curriculum-zip/t-track-visibility', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;
    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Ruxsat yo‘q.' });
    }

    const approved = Boolean(req.body.tTrackVisibilityApproved ?? req.body.approved);
    const publishLessons = req.body.publishLessons !== undefined ? Boolean(req.body.publishLessons) : undefined;
    let updatedPlans = 0;
    let updatedLessons = 0;
    const nowIso = new Date().toISOString();

    for (const wp of db.workPlans || []) {
      if (wp.additionalCurriculumAssignment || wp.track === 'T') {
        wp.tTrackVisibilityApproved = approved;
        wp.updatedAt = nowIso;
        updatedPlans++;
      }
    }

    for (const l of db.lessons || []) {
      if (l.additionalCurriculumAssignment || (l.track === 'T' && l.subjectName === 'Matematika')) {
        l.tTrackVisibilityApproved = approved;
        if (publishLessons !== undefined) {
          l.status = publishLessons ? 'published' : 'planned';
          l.publicationStatus = publishLessons ? 'PUBLISHED' : 'DRAFT_IMPORTED';
        }
        l.updatedAt = nowIso;
        updatedLessons++;
      }
    }

    appendAuditLog(
      db,
      user.institutionId,
      user,
      `T-yo‘nalish qo‘shimcha Matematika o‘quv rejasi ko‘rinishi yangilandi: ${approved ? 'Tasdiqlandi' : 'Yashirildi'}`,
      `7t, 8t, 9t, 10t, 11t (${updatedLessons} dars)`
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'T_TRACK_MATH_VISIBILITY_UPDATED');
    return res.json({
      tTrackVisibilityApproved: approved,
      updatedPlans,
      updatedLessons,
    });
  });

  app.post('/api/lessons/bulk-status', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;
    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Ruxsat yo‘q.' });
    }

    const { lessonIds, workPlanId, classCode, quarter, curriculumArea, status } = req.body || {};
    if (!status || !['planned', 'published', 'in_progress', 'completed', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'To‘g‘ri holat (status) tanlang.' });
    }

    const idSet = Array.isArray(lessonIds) && lessonIds.length > 0 ? new Set(lessonIds.map(String)) : null;
    const nowIso = new Date().toISOString();
    let updatedCount = 0;

    for (const l of db.lessons || []) {
      if (idSet && !idSet.has(l.id)) continue;
      if (workPlanId && l.workPlanId !== String(workPlanId)) continue;
      if (classCode && !lessonMatchesClass(l, String(classCode))) continue;
      if (quarter && l.quarter !== Number(quarter)) continue;
      if (curriculumArea && (l.curriculumArea || 'Matematika').toLowerCase() !== String(curriculumArea).toLowerCase()) {
        continue;
      }

      l.status = status as LessonStatus;
      l.publicationStatus =
        status === 'published' || status === 'in_progress' || status === 'completed'
          ? 'PUBLISHED'
          : status === 'archived'
          ? 'ARCHIVED'
          : 'DRAFT_IMPORTED';
      l.updatedAt = nowIso;
      updatedCount++;
    }

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'LESSONS_BULK_STATUS_UPDATED');
    return res.json({ updatedCount, status });
  });

  // =========================================================================
  // CURRICULUM MAP (O‘QUV XARITASI) & LESSON MANAGEMENT (DARSLAR) ENDPOINTS
  // =========================================================================

  app.get('/api/lessons', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, db } = authCtx;

    const queryClass = req.query.classCode || req.query.classId;

    if (user.role === 'student') {
      const myClass = db.classes.find(
        (c) =>
          c.id === user.classId ||
          (user.classCode && c.code.toLowerCase() === user.classCode.toLowerCase())
      );
      if (
        queryClass &&
        myClass &&
        String(queryClass).toLowerCase() !== myClass.code.toLowerCase() &&
        String(queryClass).toLowerCase() !== myClass.id.toLowerCase()
      ) {
        return res.status(403).json({
          error: 'Ruxsat rad etildi (403): Boshqa sinf darslariga kirish taqiqlangan.',
        });
      }
      const studentLessons = myClass
        ? (db.lessons || []).filter(
            (l) =>
              lessonMatchesClass(l, myClass.code) &&
              (!l.additionalCurriculumAssignment || l.tTrackVisibilityApproved === true) &&
              (l.status === 'published' || l.status === 'in_progress' || l.status === 'completed')
          )
        : [];
      return res.json({ lessons: studentLessons });
    }

    let result = [...(db.lessons || [])];
    if (queryClass) {
      result = result.filter((l) => lessonMatchesClass(l, String(queryClass)));
    }
    if (req.query.grade) {
      result = result.filter((l) => l.grade === Number(req.query.grade));
    }
    if (req.query.track) {
      result = result.filter((l) => l.track.toUpperCase() === String(req.query.track).toUpperCase());
    }
    if (req.query.subject) {
      const sLower = String(req.query.subject).toLowerCase();
      result = result.filter(
        (l) => l.subjectName.toLowerCase() === sLower || l.subjectId.toLowerCase() === sLower
      );
    }
    if (req.query.curriculumArea) {
      const areaLower = String(req.query.curriculumArea).toLowerCase();
      result = result.filter(
        (l) => (l.curriculumArea || l.subjectName).toLowerCase() === areaLower
      );
    }
    if (req.query.quarter) {
      result = result.filter((l) => l.quarter === Number(req.query.quarter));
    }
    if (req.query.eventCategory) {
      result = result.filter((l) => l.eventCategory === String(req.query.eventCategory));
    }
    if (req.query.lessonType) {
      result = result.filter(
        (l) => (l.lessonType || '').toLowerCase() === String(req.query.lessonType).toLowerCase()
      );
    }
    if (req.query.status) {
      result = result.filter((l) => l.status === req.query.status);
    }
    if (req.query.q) {
      const qLower = String(req.query.q).trim().toLowerCase();
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(qLower) ||
          (l.topicTitle && l.topicTitle.toLowerCase().includes(qLower)) ||
          (l.classwork && l.classwork.toLowerCase().includes(qLower)) ||
          (l.homework && l.homework.toLowerCase().includes(qLower))
      );
    }
    return res.json({ lessons: result });
  });

  app.post('/api/lessons', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Dars qo‘shish faqat administrator uchun.' });
    }

    const {
      classId,
      classCode,
      subjectId,
      subjectName,
      quarter = 1,
      lessonNumber,
      unitTitle,
      topicName,
      title,
      learningObjectives,
      content,
      homework,
      scheduledDate,
      status = 'planned',
    } = req.body;

    if (!title || String(title).trim().length < 2) {
      return res.status(400).json({ error: 'Dars mavzusini kiriting.' });
    }

    const lookupClass = String(classCode || classId || '7a1').trim().toLowerCase();
    const cls = db.classes.find(
      (c) => c.id.toLowerCase() === lookupClass || c.code.toLowerCase() === lookupClass
    );
    if (!cls) {
      return res.status(400).json({ error: 'Tanlangan sinf topilmadi.' });
    }

    const lookupSubj = String(subjectName || subjectId || cls.subject).trim();
    const subj =
      db.subjects.find(
        (s) =>
          s.id.toLowerCase() === lookupSubj.toLowerCase() ||
          s.name.toLowerCase() === lookupSubj.toLowerCase()
      ) || db.subjects[0];

    const compat = isSubjectCompatibleWithClass(subj.name, cls, db.subjects);
    if (!compat.compatible) {
      return res.status(400).json({ error: compat.reason });
    }

    const cleanTopicName = String(topicName || title).trim();
    let topicRecord = db.topics.find(
      (t) =>
        t.subject.toLowerCase() === subj.name.toLowerCase() &&
        t.name.toLowerCase() === cleanTopicName.toLowerCase()
    );
    if (!topicRecord) {
      topicRecord = {
        id: `topic-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        institutionId: user.institutionId,
        subjectId: subj.id,
        subjectCode: subj.code,
        classCode: cls.code,
        track: cls.track,
        name: cleanTopicName,
        subject: subj.name,
        grade: cls.grade,
        description: String(learningObjectives || cleanTopicName),
        orderIndex: db.topics.length + 1,
      };
      db.topics.push(topicRecord);
    }

    const existingClassSubjLessons = db.lessons.filter(
      (l) =>
        l.classCode.toLowerCase() === cls.code.toLowerCase() &&
        l.subjectName.toLowerCase() === subj.name.toLowerCase()
    );
    const nextNum = Number(lessonNumber) || existingClassSubjLessons.length + 1;
    const nowIso = new Date().toISOString();

    const newLesson: LessonItem = {
      id: `lesson-${cls.code}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      institutionId: user.institutionId,
      classId: cls.id,
      classCode: cls.code,
      grade: cls.grade,
      track: cls.track,
      subjectId: subj.id,
      subjectName: subj.name,
      academicYear: cls.academicYear || '2026-2027',
      quarter: ([1, 2, 3, 4].includes(Number(quarter)) ? Number(quarter) : 1) as 1 | 2 | 3 | 4,
      weekNumber: Math.ceil(nextNum / 3),
      lessonNumber: nextNum,
      unitTitle: String(unitTitle || `${quarter}-chorak bo‘limi`).trim(),
      topicId: topicRecord.id,
      topicName: topicRecord.name,
      title: String(title).trim(),
      learningObjectives: String(learningObjectives || '').trim(),
      content: String(content || '').trim(),
      homework: homework ? String(homework).trim() : undefined,
      scheduledDate: scheduledDate ? String(scheduledDate).trim() : undefined,
      hours: 1,
      materials: [],
      relatedAssessmentIds: [],
      status: (status as LessonStatus) || 'planned',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.lessons.push(newLesson);
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Yangi dars qo‘shildi (${cls.code}, ${subj.name})`,
      newLesson.title,
      newLesson.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'LESSON_CREATED');
    return res.json({ lesson: newLesson });
  });

  app.put('/api/lessons/:id', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Darsni tahrirlash faqat administrator uchun.' });
    }

    const lesson = db.lessons.find((l) => l.id === req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Dars topilmadi.' });

    const {
      title,
      topicTitle,
      unitTitle,
      topicName,
      lessonType,
      classwork,
      learningObjectives,
      content,
      homework,
      notes,
      hours,
      scheduledDate,
      lessonNumber,
      quarter,
      materials,
      relatedAssessmentIds,
      status,
    } = req.body;

    const nowIso = new Date().toISOString();
    const changedFields: string[] = [];
    const prevTopicTitle = lesson.topicTitle || lesson.title;
    const prevClasswork = lesson.classwork;
    const prevHomework = lesson.homework;
    const prevStatus = lesson.status;

    const nextTitle = topicTitle !== undefined ? String(topicTitle).trim() : title !== undefined ? String(title).trim() : undefined;
    if (nextTitle && nextTitle !== lesson.title) {
      changedFields.push('topicTitle');
      lesson.title = nextTitle;
      lesson.topicTitle = nextTitle;
      lesson.topicName = topicName ? String(topicName).trim() : nextTitle;
    } else if (topicName && String(topicName).trim() !== lesson.topicName) {
      changedFields.push('topicName');
      lesson.topicName = String(topicName).trim();
    }

    if (unitTitle && String(unitTitle).trim() !== lesson.unitTitle) {
      changedFields.push('unitTitle');
      lesson.unitTitle = String(unitTitle).trim();
    }
    if (typeof lessonType === 'string' && lessonType.trim() !== lesson.lessonType) {
      changedFields.push('lessonType');
      lesson.lessonType = lessonType.trim();
      const reclassified = classifyCurriculumLessonEvent(lesson.lessonType, lesson.title);
      lesson.eventCategory = reclassified.eventCategory;
      lesson.milestoneType = reclassified.milestoneType;
      lesson.milestoneCode = reclassified.milestoneCode;
      if (reclassified.maxPoints !== undefined) lesson.maxPoints = reclassified.maxPoints;
    }
    if (typeof classwork === 'string' && classwork.trim() !== (lesson.classwork || '')) {
      changedFields.push('classwork');
      lesson.classwork = classwork.trim();
    }
    if (typeof learningObjectives === 'string' && learningObjectives.trim() !== lesson.learningObjectives) {
      changedFields.push('learningObjectives');
      lesson.learningObjectives = learningObjectives.trim();
    }
    if (typeof content === 'string' && content.trim() !== lesson.content) {
      changedFields.push('content');
      lesson.content = content.trim();
    }
    if (typeof homework === 'string' && homework.trim() !== (lesson.homework || '')) {
      changedFields.push('homework');
      lesson.homework = homework.trim();
    }
    if (typeof notes === 'string' && notes.trim() !== (lesson.notes || '')) {
      changedFields.push('notes');
      lesson.notes = notes.trim();
    }
    if (hours !== undefined && Number(hours) > 0 && Number(hours) !== lesson.hours) {
      changedFields.push('hours');
      lesson.hours = Number(hours);
    }
    if (typeof scheduledDate === 'string') {
      changedFields.push('scheduledDate');
      lesson.scheduledDate = scheduledDate.trim() || undefined;
    }
    if (lessonNumber !== undefined && Number(lessonNumber) !== lesson.lessonNumber) {
      changedFields.push('lessonOrder');
      lesson.lessonNumber = Number(lessonNumber);
      lesson.lessonOrder = Number(lessonNumber);
    }
    if (quarter !== undefined && [1, 2, 3, 4].includes(Number(quarter)) && Number(quarter) !== lesson.quarter) {
      changedFields.push('quarter');
      lesson.quarter = Number(quarter) as 1 | 2 | 3 | 4;
      lesson.quarterLabel = `${lesson.quarter}-chorak`;
    }
    if (Array.isArray(materials)) {
      changedFields.push('materials');
      lesson.materials = materials;
    }
    if (Array.isArray(relatedAssessmentIds)) {
      lesson.relatedAssessmentIds = relatedAssessmentIds.map(String);
    }
    if (
      status &&
      ['planned', 'draft', 'published', 'in_progress', 'completed', 'archived'].includes(status) &&
      status !== lesson.status
    ) {
      changedFields.push('status');
      lesson.status = (status === 'draft' ? 'planned' : status) as LessonStatus;
      lesson.publicationStatus =
        status === 'published' || status === 'in_progress' || status === 'completed'
          ? 'PUBLISHED'
          : status === 'archived'
          ? 'ARCHIVED'
          : 'DRAFT_IMPORTED';
    }

    if (changedFields.length > 0) {
      if (!Array.isArray(lesson.modificationHistory)) {
        lesson.modificationHistory = [];
      }
      lesson.modificationHistory.unshift({
        id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        editedAt: nowIso,
        editedByUid: user.uid,
        editedByName: user.displayName,
        modifiedAt: nowIso,
        modifiedBy: user.displayName,
        changedFields,
        previousTopicTitle: prevTopicTitle,
        previousClasswork: prevClasswork,
        previousHomework: prevHomework,
        previousStatus: prevStatus,
      });
    }

    lesson.updatedAt = nowIso;
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Dars yangilandi (${lesson.classCode} — ${lesson.status})`,
      lesson.title,
      lesson.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'LESSON_UPDATED');
    return res.json({ lesson });
  });

  // Single-Lesson or BSB/CHSB Milestone AI Test Generation (Sections 10 & 11)
  app.post('/api/lessons/:id/generate-test', async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;
    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Dars asosida test yaratish faqat administrator uchun.' });
    }

    const lesson = db.lessons.find((l) => l.id === req.params.id);
    if (!lesson) {
      return res.status(404).json({ error: 'Dars topilmadi.' });
    }

    const {
      questionCount = 10,
      difficulty = 'medium',
      questionTypes = ['single_choice', 'multiple_choice', 'numeric', 'short_text'],
      maxPoints,
      durationMinutes = 30,
      referenceText,
      title,
      publishImmediately = false,
    } = req.body || {};

    // If this lesson is a BSB or CHSB milestone, gather all preceding lessons in the same quarter
    let precedingLessons: LessonItem[] = [];
    if (
      Array.isArray(lesson.precedingLessonIds) &&
      lesson.precedingLessonIds.length > 0
    ) {
      const idSet = new Set(lesson.precedingLessonIds);
      precedingLessons = db.lessons.filter((l) => idSet.has(l.id));
    }

    const resolvedMaxPoints =
      maxPoints !== undefined && Number(maxPoints) > 0
        ? Number(maxPoints)
        : lesson.maxPoints;

    const generatedQuestions = buildCurriculumLessonQuestions({
      institutionId: user.institutionId,
      authorId: user.uid,
      lesson,
      precedingLessons,
      questionCount: Number(questionCount) || 10,
      difficulty: (difficulty as QuestionDifficulty) || 'medium',
      questionTypes:
        Array.isArray(questionTypes) && questionTypes.length > 0
          ? (questionTypes as QuestionType[])
          : ['single_choice', 'multiple_choice', 'numeric', 'short_text'],
      maxPoints: resolvedMaxPoints,
      referenceText: referenceText ? String(referenceText) : undefined,
    });

    for (const q of generatedQuestions) {
      db.questions.unshift(q);
    }

    const nowIso = new Date().toISOString();
    const totalPoints = generatedQuestions.reduce((acc, q) => acc + (q.points || 1), 0);
    const area = lesson.curriculumArea || lesson.subjectName || 'Matematika';
    const classCodesLabel =
      Array.isArray(lesson.classCodes) && lesson.classCodes.length > 0
        ? lesson.classCodes.map((c) => c.toUpperCase()).join('/')
        : lesson.classCode.toUpperCase();

    const defaultTitle =
      lesson.eventCategory === 'WRITTEN_ASSESSMENT' || lesson.eventCategory === 'QUARTERLY_ASSESSMENT'
        ? `${classCodesLabel} — ${area}: ${lesson.title} (${lesson.quarter}-chorak nazorat testi)`
        : `${classCodesLabel} — ${area}: ${lesson.lessonNumber}-dars (${lesson.title}) testi`;

    const isPublished = Boolean(publishImmediately);

    const draftAssessment: Assessment = {
      id: `assess-les-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `CUR-${lesson.classCode.toUpperCase()}-L${lesson.lessonNumber}-${Date.now().toString().slice(-3)}`,
      title: title && String(title).trim() ? String(title).trim() : defaultTitle,
      description:
        precedingLessons.length > 0
          ? `${lesson.title} (${lesson.quarter}-chorak, ${precedingLessons.length} ta oldingi dars mavzulari qamrab olingan) asosida yaratilgan test.`
          : `${lesson.lessonNumber}-dars ("${lesson.title}") sinf ishi (${lesson.classwork || '-'}) va uyga vazifa (${lesson.homework || '-'}) asosida yaratilgan test.`,
      subject: lesson.subjectName || 'Matematika',
      subjectId: lesson.subjectId || 'subj-matematika',
      subjectCode: 'MAT',
      curriculumArea: lesson.curriculumArea,
      grade: lesson.grade,
      track: lesson.track,
      quarter: lesson.quarter,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      blueprintLessonIds:
        precedingLessons.length > 0 ? precedingLessons.map((l) => l.id) : [lesson.id],
      milestoneCode: lesson.milestoneCode,
      maxPoints: resolvedMaxPoints || totalPoints,
      topicIds: Array.from(
        new Set([lesson.topicId, ...precedingLessons.map((l) => l.topicId)].filter(Boolean))
      ),
      questionIds: generatedQuestions.map((q) => q.id),
      questionSnapshot: isPublished ? generatedQuestions.map((q) => ({ ...q })) : undefined,
      durationMinutes: Number(durationMinutes) || 30,
      passingScorePercent: 60,
      totalPoints,
      availableFrom: nowIso.slice(0, 10),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      classId: lesson.classId,
      classCode: lesson.classCode,
      assignedClassIds: lesson.classIds || [lesson.classId],
      assignedClassCodes: lesson.classCodes || [lesson.classCode as any],
      teacherId: user.uid,
      institutionId: user.institutionId,
      source: 'ai_generated',
      status: isPublished ? 'published' : 'draft',
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.assessments.unshift(draftAssessment);

    lesson.relatedAssessmentIds = Array.from(
      new Set([...(lesson.relatedAssessmentIds || []), draftAssessment.id])
    );
    lesson.linkedAssessmentIds = Array.from(
      new Set([...(lesson.linkedAssessmentIds || []), draftAssessment.id])
    );

    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Dars asosida test yaratildi (${classCodesLabel}, ${area}, ${generatedQuestions.length} ta savol, ${totalPoints} ball)`,
      draftAssessment.title,
      draftAssessment.id
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'LESSON_TEST_GENERATED');

    return res.json({
      assessment: draftAssessment,
      questions: generatedQuestions,
      blueprintLessonsCount: precedingLessons.length > 0 ? precedingLessons.length : 1,
    });
  });

  // Batch Lesson Test Generation (Section 12: Multi-Lesson Batch Test Generation)
  app.post('/api/lessons/batch-generate-tests', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;
    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Ommaviy test yaratish faqat administrator uchun.' });
    }

    const {
      lessonIds,
      title,
      questionCount = 10,
      difficulty = 'medium',
      questionTypes = ['single_choice', 'multiple_choice', 'numeric', 'short_text'],
      durationMinutes = 25,
      maxPoints,
      referenceText,
      publishImmediately = false,
    } = req.body || {};

    if (!Array.isArray(lessonIds) || lessonIds.length === 0) {
      return res.status(400).json({ error: 'Kamida 1 ta darsni tanlang.' });
    }

    const targetLessons = lessonIds
      .map((lid) => db.lessons.find((l) => l.id === String(lid)))
      .filter((l): l is LessonItem => Boolean(l));

    if (targetLessons.length === 0) {
      return res.status(404).json({ error: 'Tanlangan darslar topilmadi.' });
    }

    const primaryLesson = targetLessons[0];
    const nowIso = new Date().toISOString();
    const isPublished = Boolean(publishImmediately);

    const generatedQuestions = buildCurriculumLessonQuestions({
      institutionId: user.institutionId,
      authorId: user.uid,
      lesson: primaryLesson,
      precedingLessons: targetLessons,
      questionCount: Number(questionCount) || 10,
      difficulty: (difficulty as QuestionDifficulty) || 'medium',
      questionTypes:
        Array.isArray(questionTypes) && questionTypes.length > 0
          ? (questionTypes as QuestionType[])
          : ['single_choice', 'multiple_choice', 'numeric', 'short_text'],
      maxPoints: maxPoints ? Number(maxPoints) : primaryLesson.maxPoints,
      referenceText: referenceText ? String(referenceText) : undefined,
    });

    for (const q of generatedQuestions) {
      db.questions.unshift(q);
    }

    const totalPoints = generatedQuestions.reduce((acc, q) => acc + (q.points || 1), 0);
    const area = primaryLesson.curriculumArea || primaryLesson.subjectName || 'Matematika';
    const classCodesLabel =
      Array.isArray(primaryLesson.classCodes) && primaryLesson.classCodes.length > 0
        ? primaryLesson.classCodes.map((c) => c.toUpperCase()).join('/')
        : primaryLesson.classCode.toUpperCase();

    const defaultBatchTitle =
      title && String(title).trim()
        ? String(title).trim()
        : `${classCodesLabel} — ${area}: Tanlangan ${targetLessons.length} ta dars umumlashgan testi`;

    const combinedAssessment: Assessment = {
      id: `assess-batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `BATCH-${primaryLesson.classCode.toUpperCase()}-${targetLessons.length}L`,
      title: defaultBatchTitle,
      description: `Tanlangan ${targetLessons.length} ta dars (${targetLessons.map((l) => `${l.lessonNumber}-dars`).join(', ')}) mavzulari asosida yaratilgan umumlashgan test.`,
      subject: primaryLesson.subjectName || 'Matematika',
      subjectId: primaryLesson.subjectId || 'subj-matematika',
      subjectCode: 'MAT',
      curriculumArea: primaryLesson.curriculumArea,
      grade: primaryLesson.grade,
      track: primaryLesson.track,
      quarter: primaryLesson.quarter,
      lessonId: primaryLesson.id,
      lessonTitle: primaryLesson.title,
      blueprintLessonIds: targetLessons.map((l) => l.id),
      milestoneCode: primaryLesson.milestoneCode,
      maxPoints: maxPoints ? Number(maxPoints) : totalPoints,
      topicIds: Array.from(new Set(targetLessons.map((l) => l.topicId).filter(Boolean))),
      questionIds: generatedQuestions.map((q) => q.id),
      questionSnapshot: isPublished ? generatedQuestions.map((q) => ({ ...q })) : undefined,
      durationMinutes: Number(durationMinutes) || 25,
      passingScorePercent: 60,
      totalPoints,
      availableFrom: nowIso.slice(0, 10),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      classId: primaryLesson.classId,
      classCode: primaryLesson.classCode,
      assignedClassIds: primaryLesson.classIds || [primaryLesson.classId],
      assignedClassCodes: primaryLesson.classCodes || [primaryLesson.classCode as any],
      teacherId: user.uid,
      institutionId: user.institutionId,
      source: 'ai_generated',
      status: isPublished ? 'published' : 'draft',
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.assessments.unshift(combinedAssessment);

    for (const lesson of targetLessons) {
      lesson.relatedAssessmentIds = Array.from(
        new Set([...(lesson.relatedAssessmentIds || []), combinedAssessment.id])
      );
      lesson.linkedAssessmentIds = Array.from(
        new Set([...(lesson.linkedAssessmentIds || []), combinedAssessment.id])
      );
    }

    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Tanlangan ${targetLessons.length} ta dars uchun umumlashgan test yaratildi`,
      combinedAssessment.title,
      combinedAssessment.id
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'BATCH_LESSON_TESTS_GENERATED');

    return res.json({
      createdCount: 1,
      assessment: combinedAssessment,
      questions: generatedQuestions,
      assessments: [combinedAssessment],
    });
  });

  app.delete('/api/lessons/:id', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;
    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Ruxsat yo‘q.' });
    }
    const idx = db.lessons.findIndex((l) => l.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Dars topilmadi.' });
    db.lessons.splice(idx, 1);
    saveDbState(env, db);
    return res.json({ status: 'ok' });
  });

  // =========================================================================
  // AI COMMAND CENTER & AI TEST GENERATOR ENDPOINTS
  // =========================================================================

  app.post('/api/ai/generate-test', async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'AI test generatori faqat administrator uchun.' });
    }

    const {
      classId,
      classCode,
      subjectName,
      subjectId,
      lessonId,
      topicId,
      quarter,
      questionCount = 10,
      difficulty = 'medium',
      questionTypes = ['single_choice', 'multiple_choice', 'numeric', 'short_text'],
      durationMinutes = 30,
      title,
    } = req.body;

    const lookupClass = String(classCode || classId || '7a1').trim().toLowerCase();
    const cls =
      db.classes.find(
        (c) => c.id.toLowerCase() === lookupClass || c.code.toLowerCase() === lookupClass
      ) || db.classes[0];

    const lookupSubj = String(subjectName || subjectId || cls.subject).trim();
    const subj =
      db.subjects.find(
        (s) =>
          s.id.toLowerCase() === lookupSubj.toLowerCase() ||
          s.name.toLowerCase() === lookupSubj.toLowerCase()
      ) || db.subjects[0];

    const compat = isSubjectCompatibleWithClass(subj.name, cls, db.subjects);
    if (!compat.compatible) {
      return res.status(400).json({ error: compat.reason });
    }

    const matchedLesson = lessonId
      ? db.lessons.find((l) => l.id === lessonId)
      : db.lessons.find(
          (l) =>
            l.classCode.toLowerCase() === cls.code.toLowerCase() &&
            l.subjectName.toLowerCase() === subj.name.toLowerCase()
        );

    let matchedTopic = topicId
      ? db.topics.find((t) => t.id === topicId)
      : matchedLesson
      ? db.topics.find((t) => t.id === matchedLesson.topicId)
      : db.topics.find((t) => t.subject.toLowerCase() === subj.name.toLowerCase());

    if (!matchedTopic) {
      matchedTopic = {
        id: `topic-${Date.now()}`,
        institutionId: user.institutionId,
        subjectId: subj.id,
        subjectCode: subj.code,
        name: matchedLesson?.topicName || `${subj.name} asosiy mavzusi`,
        subject: subj.name,
        grade: cls.grade,
        description: subj.description,
        orderIndex: db.topics.length + 1,
      };
      db.topics.push(matchedTopic);
    }

    const generatedQuestions = buildStructuredQuestionsForLessonOrTopic({
      institutionId: user.institutionId,
      authorId: user.uid,
      classCode: cls.code,
      grade: cls.grade,
      subjectName: subj.name,
      subjectCode: subj.code,
      lesson: matchedLesson,
      topic: matchedTopic,
      count: Number(questionCount) || 10,
      difficulty: (difficulty as QuestionDifficulty) || 'medium',
      questionTypes: Array.isArray(questionTypes) && questionTypes.length > 0
        ? (questionTypes as QuestionType[])
        : ['single_choice', 'multiple_choice', 'numeric', 'short_text'],
    });

    for (const q of generatedQuestions) {
      db.questions.unshift(q);
    }

    const nowIso = new Date().toISOString();
    const totalPoints = generatedQuestions.reduce((acc, q) => acc + (q.points || 1), 0);
    const assessmentTitle =
      title && String(title).trim()
        ? String(title).trim()
        : matchedLesson
        ? `${cls.code.toUpperCase()} — ${subj.name}: ${matchedLesson.lessonNumber}-dars (${matchedLesson.title}) testi`
        : `${cls.code.toUpperCase()} — ${subj.name}: ${matchedTopic.name} diagnostik testi`;

    const draftAssessment: Assessment = {
      id: `assess-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `AI-${cls.code.toUpperCase()}-${Date.now().toString().slice(-4)}`,
      title: assessmentTitle,
      description: `AI yordamida yaratilgan ${generatedQuestions.length} ta savolli qoralama test.`,
      subject: subj.name,
      subjectId: subj.id,
      subjectCode: subj.code,
      grade: cls.grade,
      track: cls.track,
      quarter: quarter ? (Number(quarter) as 1 | 2 | 3 | 4) : matchedLesson?.quarter,
      lessonId: matchedLesson?.id,
      lessonTitle: matchedLesson?.title,
      topicIds: [matchedTopic.id],
      questionIds: generatedQuestions.map((q) => q.id),
      durationMinutes: Number(durationMinutes) || 30,
      passingScorePercent: 60,
      totalPoints,
      availableFrom: nowIso.slice(0, 10),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      classId: cls.id,
      classCode: cls.code,
      teacherId: user.uid,
      institutionId: user.institutionId,
      source: 'ai_generated',
      status: 'draft', // Always saved as draft until Admin reviews and publishes
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.assessments.unshift(draftAssessment);
    if (matchedLesson) {
      matchedLesson.relatedAssessmentIds = Array.from(
        new Set([...(matchedLesson.relatedAssessmentIds || []), draftAssessment.id])
      );
    }

    appendAuditLog(
      db,
      user.institutionId,
      user,
      `AI test qoralamasi yaratildi (${cls.code}, ${subj.name}, ${generatedQuestions.length} ta savol)`,
      draftAssessment.title,
      draftAssessment.id
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'ASSESSMENT_DRAFTED');

    return res.json({
      assessment: draftAssessment,
      questions: generatedQuestions,
    });
  });

  app.post('/api/ai/command', async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'AI Buyruqlar Markazi faqat administrator uchun.' });
    }

    const commandText = String(req.body.command || req.body.prompt || '').trim();
    if (!commandText) {
      return res.status(400).json({ error: 'Buyruq matnini kiriting.' });
    }

    const parsed = parseUzbekAICommand(
      commandText,
      db.classes,
      db.subjects,
      db.lessons || [],
      db.workPlans || []
    );

    const nowIso = new Date().toISOString();
    const cls = parsed.matchedClass || db.classes[0];
    const subj = parsed.matchedSubject || db.subjects[0];

    if (parsed.intent === 'show_class_students' || parsed.intent === 'sort_class_students') {
      const classStudents = db.users
        .filter(
          (u) =>
            u.role === 'student' &&
            u.status !== 'archived' &&
            (u.classId === cls.id ||
              (u.classCode && u.classCode.toLowerCase() === cls.code.toLowerCase()))
        )
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'uz'));

      const execResult: AICommandExecutionResult = {
        id: `cmd-${Date.now()}`,
        commandText,
        intent: parsed.intent,
        matchedClass: cls,
        matchedSubject: subj,
        matchedStudents: classStudents,
        warnings: parsed.warnings,
        message:
          classStudents.length > 0
            ? `${cls.code.toUpperCase()} sinfidagi ${classStudents.length} nafar o'quvchi alifbo tartibida saralandi.`
            : `${cls.code.toUpperCase()} sinfida hozircha o'quvchilar ro'yxatga olinmagan.`,
        createdAt: nowIso,
      };
      return res.json({
        ...execResult,
        students: classStudents,
        parsedIntent: {
          intent: parsed.intent,
          classCode: cls.code,
          grade: cls.grade,
          track: cls.track,
          subject: subj.name,
        },
      });
    }

    if (parsed.intent === 'show_upcoming_lessons') {
      const upcoming = (db.lessons || [])
        .filter(
          (l) =>
            l.classCode.toLowerCase() === cls.code.toLowerCase() &&
            (!parsed.quarter || l.quarter === parsed.quarter) &&
            l.status !== 'completed' &&
            l.status !== 'archived'
        )
        .slice(0, parsed.questionCount || 10);

      const execResult: AICommandExecutionResult = {
        id: `cmd-${Date.now()}`,
        commandText,
        intent: 'show_upcoming_lessons',
        matchedClass: cls,
        matchedSubject: subj,
        upcomingLessons: upcoming,
        warnings: parsed.warnings,
        message:
          upcoming.length > 0
            ? `${cls.code.toUpperCase()} sinfining keyingi ${upcoming.length} ta darsi topildi.`
            : `${cls.code.toUpperCase()} sinfi uchun rejalashtirilgan darslar hali kiritilmagan.`,
        createdAt: nowIso,
      };
      return res.json(execResult);
    }

    if (parsed.intent === 'convert_work_plan_to_map') {
      const targetPlan =
        parsed.matchedWorkPlan ||
        db.workPlans.find((wp) => wp.classCode.toLowerCase() === cls.code.toLowerCase());

      if (!targetPlan) {
        return res.json({
          id: `cmd-${Date.now()}`,
          commandText,
          intent: 'convert_work_plan_to_map',
          matchedClass: cls,
          matchedSubject: subj,
          warnings: [
            `${cls.code.toUpperCase()} sinfi uchun yuklangan ish reja topilmadi. Avval "Ish rejalari" bo‘limida fayl yuklang.`,
          ],
          message: `${cls.code.toUpperCase()} sinfi uchun ish reja topilmadi.`,
          createdAt: nowIso,
        } satisfies AICommandExecutionResult);
      }

      targetPlan.status = 'confirmed';
      targetPlan.confirmedAt = nowIso;
      const builtLessons: LessonItem[] = [];

      for (const row of targetPlan.rows) {
        let topicRec = db.topics.find(
          (t) =>
            t.subject.toLowerCase() === targetPlan.subjectName.toLowerCase() &&
            t.name.toLowerCase() === row.topicName.toLowerCase()
        );
        if (!topicRec) {
          topicRec = {
            id: `topic-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            institutionId: user.institutionId,
            subjectId: targetPlan.subjectId,
            name: row.topicName,
            subject: targetPlan.subjectName,
            grade: targetPlan.grade,
            classCode: targetPlan.classCode,
            track: targetPlan.track,
            description: row.learningObjectives,
            orderIndex: db.topics.length + 1,
          };
          db.topics.push(topicRec);
        }

        const existingLesson = db.lessons.find(
          (l) =>
            l.classCode.toLowerCase() === targetPlan.classCode.toLowerCase() &&
            l.subjectName.toLowerCase() === targetPlan.subjectName.toLowerCase() &&
            l.lessonNumber === row.lessonNumber
        );
        if (!existingLesson) {
          const lessonItem: LessonItem = {
            id: `lesson-${targetPlan.classCode}-${Date.now()}-${row.lessonNumber}`,
            institutionId: user.institutionId,
            workPlanId: targetPlan.id,
            classId: targetPlan.classId,
            classCode: targetPlan.classCode,
            grade: targetPlan.grade,
            track: targetPlan.track,
            subjectId: targetPlan.subjectId,
            subjectName: targetPlan.subjectName,
            academicYear: targetPlan.academicYear,
            quarter: row.quarter || 1,
            weekNumber: row.weekNumber || Math.ceil(row.lessonNumber / 3),
            lessonNumber: row.lessonNumber,
            unitTitle: row.unitTitle,
            topicId: topicRec.id,
            topicName: topicRec.name,
            title: row.lessonTitle,
            learningObjectives: row.learningObjectives,
            content: `${row.lessonTitle} — ${row.learningObjectives}`,
            scheduledDate: row.scheduledDate,
            hours: row.hours || 1,
            materials: [],
            relatedAssessmentIds: [],
            status: 'planned',
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          db.lessons.push(lessonItem);
          builtLessons.push(lessonItem);
        }
      }

      saveDbState(env, db);
      return res.json({
        id: `cmd-${Date.now()}`,
        commandText,
        intent: 'convert_work_plan_to_map',
        matchedClass: cls,
        matchedSubject: subj,
        convertedWorkPlan: targetPlan,
        upcomingLessons: builtLessons,
        warnings: parsed.warnings,
        message: `${targetPlan.classCode.toUpperCase()} sinfi ish rejasi asosida o‘quv xaritasi yangilandi (${builtLessons.length} ta yangi dars).`,
        createdAt: nowIso,
      } satisfies AICommandExecutionResult);
    }

    // Generate lesson test / quarter review test / today's questions (saved as draft!)
    const lessonObj = parsed.matchedLesson;
    let topicObj = lessonObj
      ? db.topics.find((t) => t.id === lessonObj.topicId)
      : db.topics.find((t) => t.subject.toLowerCase() === subj.name.toLowerCase());

    if (!topicObj) {
      topicObj = {
        id: `topic-${Date.now()}`,
        institutionId: user.institutionId,
        subjectId: subj.id,
        subjectCode: subj.code,
        name: lessonObj?.topicName || `${subj.name} (${parsed.quarter || 1}-chorak mavzulari)`,
        subject: subj.name,
        grade: cls.grade,
        description: subj.description,
        orderIndex: db.topics.length + 1,
      };
      db.topics.push(topicObj);
    }

    const generatedQuestions = buildStructuredQuestionsForLessonOrTopic({
      institutionId: user.institutionId,
      authorId: user.uid,
      classCode: cls.code,
      grade: cls.grade,
      subjectName: subj.name,
      subjectCode: subj.code,
      lesson: lessonObj,
      topic: topicObj,
      count: parsed.questionCount,
      difficulty: parsed.difficulty,
    });

    for (const q of generatedQuestions) {
      db.questions.unshift(q);
    }

    const totalPoints = generatedQuestions.reduce((acc, q) => acc + (q.points || 1), 0);
    const titleLabel =
      parsed.intent === 'generate_quarter_review_test'
        ? `${cls.code.toUpperCase()} — ${subj.name}: ${parsed.quarter || 2}-chorak takrorlash testi`
        : lessonObj
        ? `${cls.code.toUpperCase()} — ${subj.name}: ${lessonObj.lessonNumber}-dars (${lessonObj.title}) testi`
        : parsed.lessonNumber
        ? `${cls.code.toUpperCase()} — ${subj.name}: ${parsed.lessonNumber}-dars bo‘yicha test`
        : `${cls.code.toUpperCase()} — ${subj.name}: Bugungi dars testi`;

    const draftAssessment: Assessment = {
      id: `assess-cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `CMD-${cls.code.toUpperCase()}-${Date.now().toString().slice(-4)}`,
      title: titleLabel,
      description: `Buyruq asosida tuzilgan qoralama test: "${commandText}"`,
      subject: subj.name,
      subjectId: subj.id,
      subjectCode: subj.code,
      grade: cls.grade,
      track: cls.track,
      quarter: parsed.quarter || lessonObj?.quarter || 1,
      lessonId: lessonObj?.id,
      lessonTitle: lessonObj?.title,
      topicIds: [topicObj.id],
      questionIds: generatedQuestions.map((q) => q.id),
      durationMinutes: Math.max(15, parsed.questionCount * 2),
      passingScorePercent: 60,
      totalPoints,
      availableFrom: nowIso.slice(0, 10),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      classId: cls.id,
      classCode: cls.code,
      teacherId: user.uid,
      institutionId: user.institutionId,
      source: 'ai_generated',
      status: 'draft', // Never auto-published without Admin review
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.assessments.unshift(draftAssessment);
    if (lessonObj) {
      lessonObj.relatedAssessmentIds = Array.from(
        new Set([...(lessonObj.relatedAssessmentIds || []), draftAssessment.id])
      );
    }

    appendAuditLog(
      db,
      user.institutionId,
      user,
      `AI buyruq bajarildi: ${draftAssessment.title} (qoralama)`,
      commandText,
      draftAssessment.id
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'AI_COMMAND_EXECUTED');

    const resultPayload: AICommandExecutionResult = {
      id: `cmd-${Date.now()}`,
      commandText,
      intent: parsed.intent,
      matchedClass: cls,
      matchedSubject: subj,
      matchedLesson: lessonObj,
      questionCount: generatedQuestions.length,
      difficulty: parsed.difficulty,
      quarter: parsed.quarter,
      generatedAssessment: draftAssessment,
      generatedQuestions,
      warnings: parsed.warnings,
      message: `${cls.code.toUpperCase()} sinfi uchun ${subj.name} fanidan ${generatedQuestions.length} ta savolli qoralama test tayyorlandi. Ko‘rib chiqib, "Nashr qilish" tugmasini bosing.`,
      createdAt: nowIso,
    };

    return res.json({
      ...resultPayload,
      parsedIntent: {
        classCode: cls.code,
        grade: cls.grade,
        track: cls.track,
        subject: subj.name,
        questionCount: generatedQuestions.length,
      },
      assessment: draftAssessment,
      questions: generatedQuestions,
    });
  });

  // =========================================================================
  // QUESTION BANK (5 TYPES + IMAGES + REVISIONS), MEDIA & EXCEL/ZIP IMPORTER
  // =========================================================================

  // Upload Question / Institution Media with magic-byte validation & tenant isolation
  app.post('/api/media/upload', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'teacher' && user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Rasm yuklash faqat o‘qituvchi va administrator uchun.' });
    }

    const { fileName, base64Data, dataUrl, institutionId, assessmentId, questionId, width, height } = req.body;
    const targetInstId =
      isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL) && institutionId
        ? String(institutionId)
        : user.institutionId;

    if (!canAccessInstitution(user, targetInstId)) {
      return res.status(403).json({ error: 'Boshqa muassasaga rasm yuklash taqiqlangan.' });
    }

    let rawBase64 = String(base64Data || '');
    if (!rawBase64 && typeof dataUrl === 'string' && dataUrl.includes(',')) {
      rawBase64 = dataUrl.split(',')[1];
    }
    if (!rawBase64) {
      return res.status(400).json({ error: 'Rasm ma’lumotlari topilmadi.' });
    }

    const bytes = new Uint8Array(Buffer.from(rawBase64, 'base64'));
    const check = validateUploadedImageMeta(String(fileName || 'image.png'), bytes.byteLength, bytes);
    if (!check.valid || !check.mimeType) {
      return res.status(400).json({ error: check.error || 'Yaroqsiz rasm fayli.' });
    }

    const safeFileName = String(fileName || 'image.png').replace(/[^a-zA-Z0-9._-]/g, '_');
    const mediaId = `media-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const storagePath = `institutions/${targetInstId}/assessments/${assessmentId || 'bank'}/questions/${questionId || mediaId}/${safeFileName}`;
    const resolvedDataUrl = `data:${check.mimeType};base64,${rawBase64}`;

    const mediaRecord: QuestionMedia = {
      id: mediaId,
      institutionId: targetInstId,
      questionId: questionId ? String(questionId) : undefined,
      fileName: safeFileName,
      mimeType: check.mimeType,
      sizeBytes: bytes.byteLength,
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
      storagePath,
      dataUrl: resolvedDataUrl,
      uploadedByUid: user.uid,
      createdAt: new Date().toISOString(),
    };

    db.questionMedia.unshift(mediaRecord);
    appendAuditLog(
      db,
      targetInstId,
      user,
      'Savol/muassasa media fayli yuklandi',
      `${safeFileName} (${Math.round(bytes.byteLength / 1024)} KB)`,
      mediaId
    );
    saveDbState(env, db);
    return res.json({ media: mediaRecord });
  });

  // Get Media by ID with strict Multi-Tenant Storage Access Control (TEST 12)
  app.get('/api/media/:id', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, db } = authCtx;

    const media = db.questionMedia.find((m) => m.id === req.params.id);
    if (!media) return res.status(404).json({ error: 'Media fayli topilmadi.' });

    if (
      !isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL) &&
      !canAccessInstitution(user, media.institutionId)
    ) {
      return res.status(403).json({
        error: "Ruxsat rad etildi (403 Forbidden): Boshqa muassasaning media fayllariga kirish taqiqlangan.",
      });
    }

    return res.json({ media });
  });

  app.post('/api/questions', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'teacher' && user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Savol yaratish faqat o‘qituvchi va administrator uchun.' });
    }

    const {
      institutionId,
      code,
      title,
      instructions,
      subject,
      grade,
      topicId,
      difficulty,
      type,
      points,
      prompt,
      options,
      structuredOptions,
      correctAnswer,
      correctAnswers,
      numericTolerance,
      acceptedAnswers,
      gradingMode,
      rubricText,
      explanation,
      imageUrl,
      mediaId,
      explanationImageUrl,
      explanationMediaId,
      status,
    } = req.body;

    if (!prompt || String(prompt).trim().length < 3) {
      return res.status(400).json({ error: 'Savol matni kamida 3 ta belgidan iborat bo‘lishi kerak.' });
    }

    const qType: QuestionType = (type as QuestionType) || 'multiple_choice';
    const resolvedCorrectAnswer = String(correctAnswer ?? '').trim();

    if (qType !== 'long_text' && !resolvedCorrectAnswer && (!Array.isArray(correctAnswers) || correctAnswers.length === 0)) {
      return res.status(400).json({ error: 'To‘g‘ri javobni kiriting.' });
    }

    const targetInstId =
      isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL) && institutionId
        ? String(institutionId)
        : user.institutionId;

    const nowIso = new Date().toISOString();
    const newQ: QuestionItem = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: code ? String(code).trim().toUpperCase() : `Q-${Math.floor(1000 + Math.random() * 9000)}`,
      title: title ? String(title).trim() : undefined,
      instructions: instructions ? String(instructions).trim() : undefined,
      institutionId: targetInstId,
      authorId: user.uid,
      subject: String(subject || 'Matematika').trim(),
      grade: Number(grade) || 8,
      topicId: String(topicId || 'topic-fractions'),
      difficulty: difficulty || 'medium',
      type: qType,
      points: Number(points) > 0 ? Number(points) : 1,
      prompt: String(prompt).trim(),
      options: Array.isArray(options) ? options.map(String) : undefined,
      structuredOptions: Array.isArray(structuredOptions) ? structuredOptions : undefined,
      correctAnswer:
        resolvedCorrectAnswer ||
        (Array.isArray(correctAnswers) ? correctAnswers.join('|') : ''),
      correctAnswers: Array.isArray(correctAnswers) ? correctAnswers.map(String) : undefined,
      numericTolerance:
        numericTolerance !== undefined && numericTolerance !== null && numericTolerance !== ''
          ? Number(numericTolerance)
          : undefined,
      acceptedAnswers: Array.isArray(acceptedAnswers) ? acceptedAnswers : undefined,
      gradingMode:
        (gradingMode as GradingMode) ||
        (qType === 'long_text' ? 'manual_rubric' : 'auto'),
      rubricText: rubricText ? String(rubricText).trim() : undefined,
      explanation: String(explanation || 'Yechim qadamlari asosida hisoblandi.').trim(),
      imageUrl: imageUrl ? String(imageUrl) : undefined,
      mediaId: mediaId ? String(mediaId) : undefined,
      explanationImageUrl: explanationImageUrl ? String(explanationImageUrl) : undefined,
      explanationMediaId: explanationMediaId ? String(explanationMediaId) : undefined,
      version: 1,
      status: status === 'draft' ? 'draft' : 'approved',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.questions.unshift(newQ);
    appendAuditLog(
      db,
      targetInstId,
      user,
      `Yangi savol yaratildi (${newQ.type})`,
      `${newQ.code}: ${newQ.prompt.slice(0, 50)}`,
      newQ.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, targetInstId, 'QUESTION_CREATED');
    return res.json({ question: newQ });
  });

  app.put('/api/questions/:id', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    const isOwner = isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL);
    const q = db.questions.find(
      (item) =>
        item.id === req.params.id &&
        (isOwner || item.institutionId === user.institutionId)
    );
    if (!q) return res.status(404).json({ error: 'Savol topilmadi.' });
    if (user.role !== 'admin' && user.role !== 'teacher' && !isOwner) {
      return res.status(403).json({ error: 'Ruxsat yo‘q.' });
    }

    const nowIso = new Date().toISOString();
    // Save immutable QuestionRevision before modifying
    const revision: QuestionRevision = {
      id: `qrev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      questionId: q.id,
      institutionId: q.institutionId,
      version: q.version || 1,
      snapshot: JSON.parse(JSON.stringify(q)),
      editedByUid: user.uid,
      editedByName: user.displayName,
      reason: req.body.revisionReason ? String(req.body.revisionReason) : 'Savol tahrirlandi',
      createdAt: nowIso,
    };
    db.questionRevisions.unshift(revision);

    const {
      code,
      title,
      instructions,
      prompt,
      type,
      points,
      options,
      structuredOptions,
      correctAnswer,
      correctAnswers,
      numericTolerance,
      acceptedAnswers,
      gradingMode,
      rubricText,
      explanation,
      difficulty,
      topicId,
      status,
      subject,
      grade,
      imageUrl,
      mediaId,
      explanationImageUrl,
      explanationMediaId,
    } = req.body;

    if (code) q.code = String(code).trim().toUpperCase();
    if (typeof title === 'string') q.title = title.trim() || undefined;
    if (typeof instructions === 'string') q.instructions = instructions.trim() || undefined;
    if (prompt) q.prompt = String(prompt).trim();
    if (type) q.type = type as QuestionType;
    if (points !== undefined && Number(points) > 0) q.points = Number(points);
    if (Array.isArray(options)) q.options = options.map(String);
    if (Array.isArray(structuredOptions)) q.structuredOptions = structuredOptions;
    if (typeof correctAnswer === 'string') q.correctAnswer = correctAnswer.trim();
    if (Array.isArray(correctAnswers)) q.correctAnswers = correctAnswers.map(String);
    if (numericTolerance !== undefined) {
      q.numericTolerance = numericTolerance === null || numericTolerance === '' ? undefined : Number(numericTolerance);
    }
    if (Array.isArray(acceptedAnswers)) q.acceptedAnswers = acceptedAnswers;
    if (gradingMode) q.gradingMode = gradingMode as GradingMode;
    if (typeof rubricText === 'string') q.rubricText = rubricText.trim() || undefined;
    if (explanation) q.explanation = String(explanation).trim();
    if (difficulty) q.difficulty = difficulty;
    if (topicId) q.topicId = String(topicId);
    if (status) q.status = status;
    if (subject) q.subject = String(subject).trim();
    if (grade) q.grade = Number(grade);
    if (typeof imageUrl === 'string') q.imageUrl = imageUrl || undefined;
    if (typeof mediaId === 'string') q.mediaId = mediaId || undefined;
    if (typeof explanationImageUrl === 'string') q.explanationImageUrl = explanationImageUrl || undefined;
    if (typeof explanationMediaId === 'string') q.explanationMediaId = explanationMediaId || undefined;
    q.version = (q.version || 1) + 1;
    q.updatedAt = nowIso;

    appendAuditLog(
      db,
      q.institutionId,
      user,
      `Savol yangilandi (v${q.version})`,
      `${q.code || q.id}: ${q.prompt.slice(0, 50)}`,
      q.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, q.institutionId, 'QUESTION_UPDATED');
    return res.json({ question: q, revision });
  });

  app.delete('/api/questions/:id', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    const isOwner = isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL);
    const idx = db.questions.findIndex(
      (item) =>
        item.id === req.params.id &&
        (isOwner || item.institutionId === user.institutionId)
    );
    if (idx === -1) return res.status(404).json({ error: 'Savol topilmadi.' });
    if (user.role !== 'admin' && user.role !== 'teacher' && !isOwner) {
      return res.status(403).json({ error: 'Ruxsat yo‘q.' });
    }

    const removed = db.questions[idx];
    db.questions.splice(idx, 1);
    appendAuditLog(
      db,
      removed.institutionId,
      user,
      'Savol arxivlandi/o‘chirildi',
      removed.prompt.slice(0, 50),
      removed.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, removed.institutionId, 'QUESTION_DELETED');
    return res.json({ status: 'ok' });
  });

  // =========================================================================
  // EXCEL (.XLSX) & .ZIP ASSESSMENT IMPORT ENGINE ENDPOINTS
  // =========================================================================

  app.get('/api/import/template.xlsx', (_req, res) => {
    try {
      const buffer = generateLearnOSExcelTemplateBuffer(getDbState('prod').topics);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="LearnOS_Assessment_Import_Template.xlsx"'
      );
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error('Template generation error:', err);
      return res.status(500).json({ error: 'Excel shablonini yaratishda xatolik yuz berdi.' });
    }
  });

  app.get('/api/import/guide.md', (_req, res) => {
    const md = generateImportGuideMarkdown(getDbState('prod').topics);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="LearnOS_Import_Guide.md"'
    );
    return res.send(md);
  });

  app.post('/api/import/validate', async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, db } = authCtx;

    if (user.role !== 'teacher' && user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Excel/ZIP import faqat o‘qituvchi va administrator uchun.' });
    }

    try {
      const { fileName, base64Data, institutionId } = req.body;
      if (!fileName || !base64Data) {
        return res.status(400).json({ error: 'Fayl nomi va base64 ma’lumotlari talab qilinadi.' });
      }

      const targetInstId =
        isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL) && institutionId
          ? String(institutionId)
          : user.institutionId;

      if (!canAccessInstitution(user, targetInstId)) {
        return res.status(403).json({ error: 'Boshqa muassasaga import qilish taqiqlangan.' });
      }

      const cleanBase64 = String(base64Data).includes(',')
        ? String(base64Data).split(',')[1]
        : String(base64Data);
      const buffer = Buffer.from(cleanBase64, 'base64');

      const existingInstQuestions = db.questions.filter(
        (q) => q.institutionId === targetInstId
      );

      const validation = await parseAndValidateImportPackage(
        new Uint8Array(buffer),
        String(fileName),
        db.topics,
        existingInstQuestions
      );

      return res.json(validation);
    } catch (err: any) {
      console.error('Import validation error:', err);
      return res.status(500).json({
        error: `Import faylini tekshirishda xatolik: ${err?.message || 'Noma’lum xatolik'}`,
      });
    }
  });

  app.post('/api/import/confirm', async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'teacher' && user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Importni tasdiqlash uchun ruxsat yo‘q.' });
    }

    try {
      const {
        fileName,
        base64Data,
        institutionId,
        classId,
        importMode = 'draft_assessment',
        duplicatePolicy = 'update_existing',
      } = req.body;

      if (!fileName || !base64Data) {
        return res.status(400).json({ error: 'Fayl ma’lumotlari yetarli emas.' });
      }

      const targetInstId =
        isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL) && institutionId
          ? String(institutionId)
          : user.institutionId;

      if (!canAccessInstitution(user, targetInstId)) {
        return res.status(403).json({ error: 'Boshqa muassasaga import qilish taqiqlangan.' });
      }

      const cleanBase64 = String(base64Data).includes(',')
        ? String(base64Data).split(',')[1]
        : String(base64Data);
      const buffer = Buffer.from(cleanBase64, 'base64');

      const existingInstQuestions = db.questions.filter(
        (q) => q.institutionId === targetInstId
      );

      const parsed = await parseAndValidateImportPackage(
        new Uint8Array(buffer),
        String(fileName),
        db.topics,
        existingInstQuestions
      );

      if (!parsed.valid) {
        return res.status(400).json({
          error: 'Import faylida xatoliklar mavjud. Iltimos, avval xatoliklarni tuzating.',
          validation: parsed,
        });
      }

      const nowIso = new Date().toISOString();
      const batchId = `imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // 1. Persist extracted media records
      for (const media of parsed.mediaFiles) {
        const mediaRecord: QuestionMedia = {
          id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          institutionId: targetInstId,
          uploadedByUid: user.uid,
          fileName: media.fileName,
          mimeType: media.mimeType,
          sizeBytes: media.sizeBytes,
          dataUrl: media.dataUrl,
          createdAt: nowIso,
        };
        db.questionMedia.unshift(mediaRecord);
      }

      // 2. Process questions with duplicatePolicy ('skip_existing' | 'import_new_only' | 'update_existing')
      const finalQuestionIds: string[] = [];
      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const incomingQ of parsed.questions) {
        const existingQ = db.questions.find(
          (q) =>
            q.institutionId === targetInstId &&
            q.code &&
            incomingQ.code &&
            q.code.toUpperCase() === incomingQ.code.toUpperCase()
        );

        if (existingQ) {
          if (duplicatePolicy === 'skip_existing' || duplicatePolicy === 'import_new_only') {
            skippedCount += 1;
            finalQuestionIds.push(existingQ.id);
            continue;
          }
          // 'update_existing': create a QuestionRevision snapshot first, then update
          const rev: QuestionRevision = {
            id: `qrev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            questionId: existingQ.id,
            institutionId: targetInstId,
            version: existingQ.version || 1,
            snapshot: JSON.parse(JSON.stringify(existingQ)),
            editedByUid: user.uid,
            editedByName: user.displayName,
            reason: `Excel/ZIP import orqali yangilandi (${fileName})`,
            createdAt: nowIso,
          };
          db.questionRevisions.unshift(rev);

          Object.assign(existingQ, {
            code: incomingQ.code,
            subject: incomingQ.subject,
            subjectCode: incomingQ.subjectCode,
            grade: incomingQ.grade,
            topicId: incomingQ.topicId,
            topicCode: incomingQ.topicCode,
            type: incomingQ.type,
            difficulty: incomingQ.difficulty,
            prompt: incomingQ.prompt,
            imageUrl: incomingQ.imageUrl,
            explanationImageUrl: incomingQ.explanationImageUrl,
            options: incomingQ.options,
            optionItems: incomingQ.structuredOptions,
            structuredOptions: incomingQ.structuredOptions,
            correctAnswer: incomingQ.correctAnswer,
            correctAnswers: incomingQ.correctAnswers,
            acceptedAnswers: incomingQ.acceptedAnswers,
            numericTolerance: incomingQ.numericTolerance,
            gradingMode: incomingQ.gradingMode,
            rubricText: incomingQ.rubricText,
            explanation: incomingQ.explanation,
            points: incomingQ.points,
            version: (existingQ.version || 1) + 1,
            importBatchId: batchId,
            updatedAt: nowIso,
          });
          updatedCount += 1;
          finalQuestionIds.push(existingQ.id);
        } else {
          const newQ: QuestionItem = {
            id: `q-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            code: incomingQ.code,
            institutionId: targetInstId,
            authorId: user.uid,
            subject: incomingQ.subject,
            subjectCode: incomingQ.subjectCode,
            grade: incomingQ.grade,
            topicId: incomingQ.topicId,
            topicCode: incomingQ.topicCode,
            type: incomingQ.type,
            difficulty: incomingQ.difficulty,
            prompt: incomingQ.prompt,
            imageUrl: incomingQ.imageUrl,
            explanationImageUrl: incomingQ.explanationImageUrl,
            options: incomingQ.options,
            optionItems: incomingQ.structuredOptions,
            structuredOptions: incomingQ.structuredOptions,
            correctAnswer: incomingQ.correctAnswer,
            correctAnswers: incomingQ.correctAnswers,
            acceptedAnswers: incomingQ.acceptedAnswers,
            numericTolerance: incomingQ.numericTolerance,
            gradingMode: incomingQ.gradingMode,
            rubricText: incomingQ.rubricText,
            explanation: incomingQ.explanation,
            points: incomingQ.points,
            status: 'approved',
            version: 1,
            importBatchId: batchId,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          db.questions.unshift(newQ);
          importedCount += 1;
          finalQuestionIds.push(newQ.id);
        }
      }

      // 3. Create Draft Assessment unless importMode === 'question_bank_only'
      let createdAssessment: Assessment | undefined;
      const meta = parsed.assessmentMeta;
      if (importMode !== 'question_bank_only' && finalQuestionIds.length > 0) {
        const assessId = `assess-imp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        const topicIds = Array.from(new Set(parsed.questions.map((q) => q.topicId)));
        createdAssessment = {
          id: assessId,
          code: meta?.code || `ASM-${Date.now()}`,
          title: meta?.title || `Import qilingan test (${fileName})`,
          description: meta?.description || '',
          instructions: meta?.instructions || '',
          subject: meta?.subject || 'Matematika',
          grade: meta?.grade || 8,
          topicIds,
          questionIds: finalQuestionIds,
          durationMinutes: meta?.durationMinutes || 30,
          passingScorePercent: meta?.passingScorePercent || 60,
          shuffleQuestions: meta?.shuffleQuestions ?? false,
          attemptLimit: meta?.attemptLimit || 1,
          availableFrom: meta?.availabilityStart || nowIso.slice(0, 10),
          dueDate:
            meta?.availabilityEnd ||
            new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          classId: classId ? String(classId) : '',
          teacherId: user.uid,
          institutionId: targetInstId,
          status: 'draft', // Always defaults to draft until reviewed & published!
          version: 1,
          importBatchId: batchId,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        db.assessments.unshift(createdAssessment);
      }

      const batchRecord: ImportBatch = {
        id: batchId,
        institutionId: targetInstId,
        importedByUid: user.uid,
        importedByName: user.displayName,
        fileName: String(fileName),
        packageType: String(fileName).toLowerCase().endsWith('.zip') ? 'zip' : 'xlsx',
        assessmentId: createdAssessment?.id,
        assessmentTitle:
          createdAssessment?.title || meta?.title || 'Savollar bazasi importi',
        questionsCount: importedCount + updatedCount,
        optionsCount: parsed.summary.totalOptions,
        mediaCount: parsed.mediaFiles.length,
        errorsCount: 0,
        warningsCount: parsed.warnings.length,
        status: 'imported',
        duplicatePolicy,
        createdAt: nowIso,
      };
      db.importBatches.unshift(batchRecord);

      appendAuditLog(
        db,
        targetInstId,
        user,
        `Excel/ZIP paket import qilindi (${importedCount} yangi, ${updatedCount} yangilangan savol)`,
        `${batchRecord.fileName} -> ${batchRecord.assessmentTitle}`,
        batchId
      );

      saveDbState(env, db);
      broadcastInstitutionUpdate(env, targetInstId, 'PACKAGE_IMPORTED');

      return res.json({
        batch: batchRecord,
        assessment: createdAssessment,
        importedCount,
        updatedCount,
        skippedCount,
        mediaCount: parsed.mediaFiles.length,
      });
    } catch (err: any) {
      console.error('Import confirm error:', err);
      return res.status(500).json({
        error: `Importni saqlashda xatolik yuz berdi: ${err?.message || 'Noma’lum xatolik'}`,
      });
    }
  });

  app.post('/api/assessments', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'teacher' && user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Test yaratish uchun ruxsat yo‘q.' });
    }

    const {
      title,
      description,
      subject,
      grade,
      topicIds,
      questionIds,
      durationMinutes,
      availableFrom,
      dueDate,
      classId,
      classCode,
      lessonId,
      quarter,
      eligibleStudentIds,
      status,
    } = req.body;

    if (!title || String(title).trim().length < 3) {
      return res.status(400).json({ error: 'Test sarlavhasini kiriting.' });
    }
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ error: 'Kamida 1 ta savol tanlang.' });
    }

    const cls = db.classes.find(
      (c) =>
        c.institutionId === user.institutionId &&
        ((classId && c.id === String(classId)) ||
          (classCode &&
            (c.name.toLowerCase() === String(classCode).toLowerCase() ||
              c.code?.toLowerCase() === String(classCode).toLowerCase())))
    );
    if (user.role === 'teacher' && cls && !canAccessClass(user, cls)) {
      return res.status(403).json({ error: 'Ushbu sinf sizga biriktirilmagan.' });
    }

    const cleanSubj = String(subject || 'Matematika').trim();
    if (cls && !isSubjectCompatibleWithClass(cleanSubj, cls.name)) {
      return res.status(400).json({
        error: `"${cleanSubj}" fani ${cls.name} (${cls.track} yo‘nalishi) sinfi o‘quv rejasiga mos kelmaydi.`,
      });
    }

    const chosenQuestions = db.questions.filter(
      (q) => q.institutionId === user.institutionId && questionIds.includes(q.id)
    );
    const computedTopicIds =
      Array.isArray(topicIds) && topicIds.length > 0
        ? topicIds.map(String)
        : Array.from(new Set(chosenQuestions.map((q) => q.topicId)));

    const nowIso = new Date().toISOString();
    const assessId = `assess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const isPublished = status === 'published';

    const newAssessment: Assessment = {
      id: assessId,
      title: String(title).trim(),
      description: description ? String(description).trim() : undefined,
      subject: cleanSubj,
      grade: cls?.grade || Number(grade) || 8,
      quarter: quarter ? (Number(quarter) as 1 | 2 | 3 | 4) : undefined,
      lessonId: lessonId ? String(lessonId) : undefined,
      topicIds: computedTopicIds,
      questionIds: questionIds.map(String),
      // Immutable snapshot of questions at publish time so later edits don't corrupt attempts
      questionSnapshot: isPublished ? chosenQuestions.map((q) => ({ ...q })) : undefined,
      durationMinutes: Number(durationMinutes) || 25,
      availableFrom: availableFrom ? String(availableFrom) : nowIso.slice(0, 10),
      dueDate: String(dueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)),
      classId: cls ? cls.id : String(classId || ''),
      classCode: cls ? cls.name : classCode ? (String(classCode).toLowerCase() as OfficialClassCode) : undefined,
      eligibleStudentIds: Array.isArray(eligibleStudentIds)
        ? eligibleStudentIds.map(String)
        : undefined,
      teacherId: user.uid,
      institutionId: user.institutionId,
      status: isPublished ? 'published' : 'draft',
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.assessments.unshift(newAssessment);

    if (lessonId) {
      const linkedLesson = db.lessons.find((l) => l.id === String(lessonId));
      if (linkedLesson) {
        const setIds = new Set(linkedLesson.linkedAssessmentIds || []);
        setIds.add(newAssessment.id);
        linkedLesson.linkedAssessmentIds = Array.from(setIds);
      }
    }

    if (isPublished && cls) {
      const assignment: Assignment = {
        id: `assign-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        institutionId: user.institutionId,
        assessmentId: newAssessment.id,
        assessmentTitle: newAssessment.title,
        classId: cls.id,
        className: cls.name,
        teacherId: user.uid,
        startDate: newAssessment.availableFrom || nowIso.slice(0, 10),
        dueDate: newAssessment.dueDate,
        status: 'published',
        eligibleStudentIds: newAssessment.eligibleStudentIds,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.assignments.unshift(assignment);

      // Notify enrolled students in that class
      const classStudents = db.users.filter(
        (u) =>
          u.institutionId === user.institutionId &&
          u.role === 'student' &&
          (u.classId === cls.id || u.classCode === cls.name)
      );
      for (const stu of classStudents) {
        pushNotification(
          db,
          user.institutionId,
          stu.uid,
          'Yangi diagnostik test biriktirildi',
          `"${newAssessment.title}" testi chop etildi. Topshirish muddati: ${newAssessment.dueDate}.`,
          `/student/assessments/${newAssessment.id}`
        );
      }

      appendAuditLog(
        db,
        user.institutionId,
        user,
        `Test chop etildi va ${cls.name} sinfiga biriktirildi`,
        newAssessment.title,
        newAssessment.id
      );
    }

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'ASSESSMENT_PUBLISHED');
    return res.json({ assessment: newAssessment });
  });

  app.put('/api/assessments/:id', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    const assess = db.assessments.find(
      (a) => a.id === req.params.id && a.institutionId === user.institutionId
    );
    if (!assess) return res.status(404).json({ error: 'Test topilmadi.' });
    if (user.role !== 'admin' && user.role !== 'platform_owner' && assess.teacherId !== user.uid) {
      return res.status(403).json({ error: 'Ruxsat yo‘q.' });
    }

    const { title, description, durationMinutes, dueDate, status, classId, classCode, questionIds } = req.body;
    const wasDraft = assess.status === 'draft';

    if (title) assess.title = String(title).trim();
    if (typeof description === 'string') assess.description = description.trim();
    if (durationMinutes) assess.durationMinutes = Number(durationMinutes);
    if (dueDate) assess.dueDate = String(dueDate);
    if (classId || classCode) {
      const targetCls = db.classes.find(
        (c) =>
          c.institutionId === user.institutionId &&
          ((classId && c.id === String(classId)) ||
            (classCode &&
              (c.name.toLowerCase() === String(classCode).toLowerCase() ||
                c.code?.toLowerCase() === String(classCode).toLowerCase())))
      );
      if (targetCls) {
        assess.classId = targetCls.id;
        assess.classCode = targetCls.name;
        assess.grade = targetCls.grade;
      } else if (classId) {
        assess.classId = String(classId);
      }
    }
    if (Array.isArray(questionIds) && questionIds.length > 0 && wasDraft) {
      assess.questionIds = questionIds.map(String);
    }

    if (status && (status === 'draft' || status === 'published' || status === 'archived')) {
      assess.status = status;
      assess.version = (assess.version || 1) + 1;
      if (status === 'published' && (!assess.questionSnapshot || assess.questionSnapshot.length === 0)) {
        const chosen = db.questions.filter(
          (q) => q.institutionId === user.institutionId && assess.questionIds.includes(q.id)
        );
        assess.questionSnapshot = chosen.map((q) => ({ ...q }));

        const cls = db.classes.find(
          (c) => c.id === assess.classId || (assess.classCode && c.name === assess.classCode)
        );
        if (cls) {
          assess.classId = cls.id;
          assess.classCode = cls.name;
          db.assignments.unshift({
            id: `assign-${Date.now()}`,
            institutionId: user.institutionId,
            assessmentId: assess.id,
            assessmentTitle: assess.title,
            classId: cls.id,
            className: cls.name,
            teacherId: user.uid,
            startDate: new Date().toISOString().slice(0, 10),
            dueDate: assess.dueDate,
            status: 'published',
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    assess.updatedAt = new Date().toISOString();
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'ASSESSMENT_UPDATED');
    return res.json({ assessment: assess });
  });

  // Create Assignment linking an Assessment to a Class
  app.post('/api/assignments', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'teacher' && user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Ruxsat yo‘q.' });
    }

    const { assessmentId, classId, dueDate } = req.body;
    const assess = db.assessments.find(
      (a) => a.id === assessmentId && a.institutionId === user.institutionId
    );
    const cls = db.classes.find(
      (c) => c.id === classId && c.institutionId === user.institutionId
    );
    if (!assess || !cls) {
      return res.status(404).json({ error: 'Test yoki sinf topilmadi.' });
    }

    const nowIso = new Date().toISOString();
    assess.status = 'published';
    assess.classId = cls.id;
    assess.classCode = cls.name;
    if (dueDate) assess.dueDate = String(dueDate);
    if (!assess.questionSnapshot || assess.questionSnapshot.length === 0) {
      const chosen = db.questions.filter(
        (q) => q.institutionId === user.institutionId && assess.questionIds.includes(q.id)
      );
      assess.questionSnapshot = chosen.map((q) => ({ ...q }));
    }

    const assignment: Assignment = {
      id: `assign-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      institutionId: user.institutionId,
      assessmentId: assess.id,
      assessmentTitle: assess.title,
      classId: cls.id,
      className: cls.name,
      teacherId: user.uid,
      startDate: nowIso.slice(0, 10),
      dueDate: String(dueDate || assess.dueDate),
      status: 'published',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    db.assignments.unshift(assignment);

    const classStudents = db.users.filter(
      (u) =>
        u.institutionId === user.institutionId &&
        u.role === 'student' &&
        (u.classId === cls.id || u.classCode === cls.name)
    );
    for (const stu of classStudents) {
      pushNotification(
        db,
        user.institutionId,
        stu.uid,
        'Yangi diagnostik test biriktirildi',
        `"${assess.title}" testi chop etildi. Topshirish muddati: ${assignment.dueDate}.`,
        `/student/assessments/${assess.id}`
      );
    }

    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Topshiriq ${cls.name} sinfiga biriktirildi`,
      assess.title,
      assignment.id
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'ASSIGNMENT_CREATED');
    return res.json({ assignment });
  });

  // Update Assignment status (publish / close)
  app.put('/api/assignments/:id/status', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    const assign = db.assignments.find(
      (a) => a.id === req.params.id && a.institutionId === user.institutionId
    );
    if (!assign) return res.status(404).json({ error: 'Topshiriq topilmadi.' });
    if (user.role !== 'admin' && assign.teacherId !== user.uid) {
      return res.status(403).json({ error: 'Ruxsat yo‘q.' });
    }

    const { status, dueDate } = req.body;
    if (status === 'published' || status === 'closed') {
      assign.status = status;
    }
    if (dueDate) assign.dueDate = String(dueDate);
    assign.updatedAt = new Date().toISOString();

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'ASSIGNMENT_UPDATED');
    return res.json({ assignment: assign });
  });

  // =========================================================================
  // SERVER-SIDE ASSESSMENT SUBMISSION, SCORING & KNOWLEDGE MAP ENGINE
  // =========================================================================

  app.post('/api/assessments/submit', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'student') {
      return res.status(403).json({ error: 'Faqat o‘quvchilar test topshira oladi.' });
    }

    const { assessmentId } = req.body as {
      assessmentId: string;
    };
    const submittedMap: Record<string, string> =
      req.body.submittedMap || req.body.answersMap || {};

    const assessment = db.assessments.find(
      (a) => a.id === assessmentId && a.institutionId === user.institutionId
    );
    if (!assessment || assessment.status !== 'published') {
      return res.status(404).json({ error: 'Test topilmadi yoki faol emas.' });
    }

    // Verify class authorization (including shared parallel classes in assignedClassIds / assignedClassCodes)
    const userClassId = (user.classId || '').toLowerCase();
    const userClassCode = (user.classCode || '').toLowerCase();
    const matchesAssignedIds =
      Array.isArray(assessment.assignedClassIds) &&
      assessment.assignedClassIds.some((id) => id.toLowerCase() === userClassId);
    const matchesAssignedCodes =
      Array.isArray(assessment.assignedClassCodes) &&
      assessment.assignedClassCodes.some((c) => c.toLowerCase() === userClassCode);

    const classIdMismatch = Boolean(
      assessment.classId &&
        userClassId &&
        assessment.classId.toLowerCase() !== userClassId &&
        !matchesAssignedIds
    );
    const classCodeMismatch = Boolean(
      assessment.classCode &&
        userClassCode &&
        assessment.classCode.toLowerCase() !== userClassCode &&
        !matchesAssignedCodes
    );
    if (classIdMismatch || classCodeMismatch) {
      return res.status(403).json({ error: 'Ushbu test sizning sinfingizga biriktirilmagan.' });
    }

    // Prevent accidental rapid duplicate submissions within 10 seconds
    const recentAttempt = db.attempts.find(
      (att) =>
        att.studentId === user.uid &&
        att.assessmentId === assessment.id &&
        Date.now() - new Date(att.submittedAt).getTime() < 10000
    );
    if (recentAttempt) {
      return res.json({
        attempt: recentAttempt,
        masteryRecords: db.masteryRecords.filter((r) => r.studentId === user.uid),
        learningPaths: db.learningPaths.filter((lp) => lp.studentId === user.uid),
      });
    }

    // Retrieve authoritative question bank items with real answer keys from server DB or snapshot
    const authoritativeQuestions =
      assessment.questionSnapshot && assessment.questionSnapshot.length > 0
        ? assessment.questionSnapshot
        : db.questions.filter(
            (q) =>
              q.institutionId === user.institutionId &&
              assessment.questionIds.includes(q.id)
          );

    const topicsMap: Record<string, Topic> = {};
    for (const t of db.topics) {
      topicsMap[t.id] = t;
    }

    const scoredOutput = scoreAssessmentSubmission(
      authoritativeQuestions,
      submittedMap || {},
      topicsMap
    );

    const nowIso = new Date().toISOString();
    const attemptId = `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const fallbackAnalysis = buildDeterministicFallbackAnalysis(
      assessment.title,
      scoredOutput.scorePercent,
      scoredOutput.topicBreakdown,
      scoredOutput.answers
    );

    const newAttempt: AssessmentAttempt = {
      id: attemptId,
      assessmentId: assessment.id,
      assessmentTitle: assessment.title,
      assessmentVersion: assessment.version || 1,
      studentId: user.uid,
      studentName: user.displayName,
      classId: user.classId || assessment.classId,
      institutionId: user.institutionId,
      scorePercent: scoredOutput.scorePercent,
      earnedPoints: scoredOutput.earnedPoints,
      totalPoints: scoredOutput.totalPoints,
      correctCount: scoredOutput.correctCount,
      totalQuestions: scoredOutput.totalQuestions,
      pendingManualCount: scoredOutput.pendingManualCount,
      status: scoredOutput.pendingManualCount > 0 ? 'pending_manual_review' : 'completed',
      submittedAt: nowIso,
      answers: scoredOutput.answers,
      topicBreakdown: scoredOutput.topicBreakdown,
      aiAnalysis: fallbackAnalysis,
    };

    db.attempts.unshift(newAttempt);

    // Update student's Knowledge Map Mastery Records
    const existingStudentMastery = db.masteryRecords.filter((r) => r.studentId === user.uid);
    const otherMastery = db.masteryRecords.filter((r) => r.studentId !== user.uid);
    const updatedStudentMastery = updateMasteryRecordsFromAttempt(
      existingStudentMastery,
      user.uid,
      user.institutionId,
      scoredOutput.topicBreakdown,
      db.topics,
      nowIso
    );
    db.masteryRecords = [...otherMastery, ...updatedStudentMastery];

    // Generate / update 5-step Personalized Learning Paths based on evidence
    const otherPaths = db.learningPaths.filter((lp) => lp.studentId !== user.uid);
    const updatedStudentPaths = generateLearningPathsFromAttempt(
      user.uid,
      user.institutionId,
      scoredOutput.topicBreakdown,
      db.learningPaths
    );
    db.learningPaths = [...otherPaths, ...updatedStudentPaths];

    // Notify Teacher & Linked Parents
    if (assessment.teacherId) {
      pushNotification(
        db,
        user.institutionId,
        assessment.teacherId,
        "O'quvchi testni topshirdi",
        `${user.displayName} "${assessment.title}" testini ${scoredOutput.scorePercent}% (${scoredOutput.correctCount}/${scoredOutput.totalQuestions}) natija bilan yakunladi.`,
        `/teacher/students/${user.uid}`
      );
    }

    const linkedParents = db.users.filter(
      (u) =>
        u.institutionId === user.institutionId &&
        u.role === 'parent' &&
        u.linkedChildIds?.includes(user.uid)
    );
    for (const parent of linkedParents) {
      pushNotification(
        db,
        user.institutionId,
        parent.uid,
        'Farzandingiz test natijasi tayyor',
        `${user.displayName} "${assessment.title}" sinovini ${scoredOutput.scorePercent}% natija bilan topshirdi.`,
        `/parent/children/${user.uid}`
      );
    }

    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Test topshirildi (${scoredOutput.scorePercent}%)`,
      assessment.title,
      attemptId
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'ATTEMPT_SUBMITTED');

    return res.json({
      attempt: newAttempt,
      masteryRecords: updatedStudentMastery,
      learningPaths: updatedStudentPaths,
    });
  });

  // Update Learning Path Step status
  app.put('/api/learning-paths/:id/steps', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    const pathItem = db.learningPaths.find(
      (lp) => lp.id === req.params.id && lp.studentId === user.uid
    );
    if (!pathItem) return res.status(404).json({ error: 'O‘quv yo‘li topilmadi.' });

    const { stepNumber, status } = req.body;
    pathItem.steps = pathItem.steps.map((s) =>
      s.stepNumber === Number(stepNumber) ? { ...s, status } : s
    );

    saveDbState(env, db);
    return res.json({ learningPath: pathItem });
  });

  // Add Teacher Note
  app.post('/api/teacher-notes', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'teacher' && user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Ruxsat yo‘q.' });
    }

    const { studentId, content } = req.body;
    if (!studentId || !content || String(content).trim().length < 2) {
      return res.status(400).json({ error: 'Qayd matnini kiriting.' });
    }

    const note: TeacherNote = {
      id: `note-${Date.now()}`,
      studentId: String(studentId),
      teacherId: user.uid,
      teacherName: user.displayName,
      institutionId: user.institutionId,
      content: String(content).trim(),
      createdAt: new Date().toISOString(),
    };
    db.teacherNotes.unshift(note);
    pushNotification(
      db,
      user.institutionId,
      String(studentId),
      "O'qituvchidan yangi tavsiya",
      `${user.displayName} sizning o'quv ko'rsatkichingiz bo'yicha yangi qayd qoldirdi.`
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'NOTE_ADDED');
    return res.json({ note });
  });

  // Parent Link Child by Verified Student Code
  app.post('/api/parent/link-child', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'parent') {
      return res.status(403).json({ error: 'Faqat ota-ona hisobi farzand kodini ulashi mumkin.' });
    }

    const cleanCode = String(req.body.studentCode || '')
      .trim()
      .toUpperCase();
    const matchedStudent = db.users.find(
      (u) =>
        u.institutionId === user.institutionId &&
        u.role === 'student' &&
        u.studentCode?.toUpperCase() === cleanCode
    );

    if (!matchedStudent) {
      return res.status(404).json({ error: 'Bunday shaxsiy kodli o‘quvchi topilmadi.' });
    }

    const existing = new Set(user.linkedChildIds || []);
    existing.add(matchedStudent.uid);
    user.linkedChildIds = Array.from(existing);

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, 'PARENT_LINKED');
    return res.json({ user, student: matchedStudent });
  });

  // Mark notification read
  app.put('/api/notifications/:id/read', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    const notif = db.notifications.find(
      (n) => n.id === req.params.id && n.recipientUid === user.uid
    );
    if (notif) {
      notif.read = true;
      saveDbState(env, db);
    }
    return res.json({ status: 'ok' });
  });

  // Pure deterministic scoring endpoint (also usable standalone)
  app.post('/api/assessments/score', (req, res) => {
    try {
      const { questions, submittedMap, topicsMap } = req.body as {
        questions: QuestionItem[];
        submittedMap: Record<string, string>;
        topicsMap: Record<string, Topic>;
      };

      if (!Array.isArray(questions) || !submittedMap || !topicsMap) {
        return res.status(400).json({
          error: 'Savollar yoki javoblar ma’lumotlari to‘liq emas.',
        });
      }

      const scored = scoreAssessmentSubmission(questions, submittedMap, topicsMap);
      return res.json(scored);
    } catch (error) {
      console.error('Scoring error:', error);
      return res.status(500).json({
        error: 'Test natijasini hisoblashda xatolik yuz berdi.',
      });
    }
  });

  // Gemini AI diagnostic analysis endpoint (anonymized payload — never sends student name/email)
  app.post('/api/ai/analyze-attempt', async (req, res) => {
    try {
      const { attemptId, assessmentTitle, scorePercent, topicBreakdown, answers } = req.body;

      if (!assessmentTitle || !Array.isArray(topicBreakdown) || !Array.isArray(answers)) {
        return res.status(400).json({
          error: 'Tahlil uchun diagnostika ma’lumotlari yetarli emas.',
        });
      }

      const ai = getGeminiClient(req);
      if (!ai) {
        const fallback = buildDeterministicFallbackAnalysis(
          assessmentTitle,
          Number(scorePercent) || 0,
          topicBreakdown,
          answers
        );
        fallback.aiUnavailableReason =
          "Gemini API kaliti sozlanmaganligi sababli deterministik diagnostika xulosasi ko'rsatilmoqda.";
        return res.json(fallback);
      }

      // Strictly pseudonymous educational evidence — zero student PII
      const anonymizedAnswers = answers.map((a: any) => ({
        topicId: a.topicId,
        prompt: a.prompt,
        selectedAnswer: a.selectedAnswer || '(bo‘sh)',
        correctAnswer: a.correctAnswer,
        isCorrect: a.isCorrect,
      }));

      const promptText = `
Siz Specialized Study ta'lim intellekti tizimining diagnostik tahlilchisisiz.
Quyidagi anonimlashtirilgan test natijalarini tahlil qiling va o'zbek tilida (lotin alifbosida) javob qaytaring.

QOIDALAR:
1. Bitta savolga qarab o'quvchi bilimi haqida qat'iy hukm chiqarmang.
2. Kuzatilgan xatolarni va ularning ehtimoliy matematik sabablarini farqlang.
3. O'quvchining xulq-atvori yoki psixologiyasi haqida hech narsa to'qimang.
4. O'quvchini boshqalar bilan solishtirmang va kamsitmang.

Test nomi: ${assessmentTitle}
Umumiy natija: ${scorePercent}%
Mavzular kesimi: ${JSON.stringify(topicBreakdown)}
Savollar va javoblar: ${JSON.stringify(anonymizedAnswers)}
`;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: promptText,
          config: {
            systemInstruction:
              "Siz matematika o'quvchilarining diagnostik test natijalarini tahlil qiluvchi pedagogik AI ekspertisiz. Faqat so'ralgan JSON sxemasida, aniq va tushunarli o'zbek tilida javob bering.",
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description: "O'quvchi uchun tushunarli umumiy xulosa (o'zbek tilida).",
                },
                topic_analysis: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      topic_id: { type: Type.STRING },
                      observed_performance: { type: Type.STRING },
                      possible_error_pattern: { type: Type.STRING },
                      evidence_count: { type: Type.NUMBER },
                      confidence: { type: Type.STRING },
                      recommendation: { type: Type.STRING },
                    },
                    required: [
                      'topic_id',
                      'observed_performance',
                      'possible_error_pattern',
                      'evidence_count',
                      'confidence',
                      'recommendation',
                    ],
                  },
                },
                next_steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      topic_id: { type: Type.STRING },
                      activity: { type: Type.STRING },
                      reason: { type: Type.STRING },
                      priority: { type: Type.STRING },
                    },
                    required: ['topic_id', 'activity', 'reason', 'priority'],
                  },
                },
                teacher_summary: {
                  type: Type.STRING,
                  description: "O'qituvchi uchun qisqa metodik xulosa.",
                },
                parent_summary: {
                  type: Type.STRING,
                  description: 'Ota-ona uchun oddiy va tushunarli xulosa.',
                },
              },
              required: ['summary', 'topic_analysis', 'next_steps', 'teacher_summary'],
            },
          },
        });

        const rawJson = JSON.parse((response.text ?? '{}').trim());
        const validated = AIAnalysisSchema.parse(rawJson);
        const finalResult = {
          ...validated,
          generatedAt: new Date().toISOString(),
          isFallback: false,
        };

        // Persist AI analysis to the attempt if attemptId provided
        const authCtx = authenticateRequest(req);
        if (authCtx && attemptId) {
          const att = authCtx.db.attempts.find((a) => a.id === attemptId);
          if (att) {
            att.aiAnalysis = finalResult;
            saveDbState(authCtx.env, authCtx.db);
          }
        }

        return res.json(finalResult);
      } catch (aiErr) {
        console.warn('Gemini AI analysis fallback triggered:', aiErr);
        const fallback = buildDeterministicFallbackAnalysis(
          assessmentTitle,
          Number(scorePercent) || 0,
          topicBreakdown,
          answers
        );
        fallback.aiUnavailableReason =
          "AI xizmati vaqtincha javob bermadi; deterministik tahlil ko'rsatildi.";
        return res.json(fallback);
      }
    } catch (error) {
      console.error('Analyze endpoint error:', error);
      return res.status(500).json({
        error: 'AI tahlilini yaratishda tizim xatoligi yuz berdi.',
      });
    }
  });

  // AI-assisted question drafting for teachers (always saved as draft until approved)
  app.post('/api/ai/draft-question', async (req, res) => {
    try {
      const { topicName, difficulty, grade = 8, subject = 'Matematika' } = req.body;

      const ai = getGeminiClient(req);
      if (!ai) {
        return res.json({
          prompt: `${grade}-sinf ${subject} (${topicName}): Agar 3(2x - 5) = 21 bo‘lsa, x ning qiymatini toping.`,
          options: ['6', '4', '8', '5'],
          correctAnswer: '6',
          explanation: 'Qavsni ochamiz: 6x - 15 = 21 => 6x = 36 => x = 6.',
          isFallback: true,
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${grade}-sinf ${subject} fani "${topicName}" mavzusi bo'yicha "${difficulty}" qiyinlikdagi 1 ta multiple-choice (4 ta variantli) diagnostik test savolini o'zbek lotin alifbosida tuzing. To'g'ri javob aniq 4 ta variantdan biri bo'lsin va tushuntirishi bo'lsin.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prompt: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ['prompt', 'options', 'correctAnswer', 'explanation'],
          },
        },
      });

      const parsed = AIDraftedQuestionSchema.parse(JSON.parse((response.text ?? '{}').trim()));
      if (!parsed.options.includes(parsed.correctAnswer)) {
        parsed.options[0] = parsed.correctAnswer;
      }
      return res.json({ ...parsed, isFallback: false });
    } catch (error) {
      console.warn('AI question draft fallback triggered:', error);
      return res.json({
        prompt: `8-sinf Matematika: (4x + 8) / 3 = 12 tenglamadan x ning qiymatini toping.`,
        options: ['7', '6', '8', '9'],
        correctAnswer: '7',
        explanation: '4x + 8 = 36 => 4x = 28 => x = 7.',
        isFallback: true,
      });
    }
  });

  // =========================================================================
  // WRITTEN ANSWER GRADING & AI RUBRIC SUGGESTION WORKFLOW (TEST 9)
  // =========================================================================

  // AI-assisted rubric grading suggestion (NEVER finalizes the score automatically)
  app.post('/api/ai/suggest-written-grade', async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user } = authCtx;

    if (user.role !== 'teacher' && user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Ruxsat yo‘q.' });
    }

    const { prompt, rubricText, studentAnswer, maxPoints = 2 } = req.body;
    const numericMax = Math.max(1, Number(maxPoints) || 2);
    const cleanStudentAnswer = String(studentAnswer || '').trim();

    if (!cleanStudentAnswer) {
      return res.json({
        suggestedPoints: 0,
        maxPoints: numericMax,
        confidence: 'high',
        feedback: "O'quvchi yozma javob qoldirmagan (bo'sh javob).",
        isAiSuggestion: true,
        finalized: false,
      });
    }

    const ai = getGeminiClient(req);
    if (!ai) {
      // Deterministic rubric keyword & length heuristic fallback
      const hasEquationsOrSteps =
        cleanStudentAnswer.length >= 25 &&
        (/[=+\-*/0-9]/.test(cleanStudentAnswer) || cleanStudentAnswer.split(/\s+/).length >= 5);
      const suggestedPoints = hasEquationsOrSteps ? numericMax : Math.max(0.5, Math.round(numericMax / 2));
      return res.json({
        suggestedPoints,
        maxPoints: numericMax,
        confidence: 'medium',
        feedback: hasEquationsOrSteps
          ? "Yechim bosqichlari va yakuniy xulosa mezonlarga mos keladi. O'qituvchi tasdig'i talab etiladi."
          : "Javob qisman yozilgan, lekin barcha isbot qadamlari to'liq ko'rsatilmagan.",
        isAiSuggestion: true,
        finalized: false,
      });
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Savol: ${prompt}\nBaholash mezoni (Rubrika): ${rubricText || "To'liq yechim va asoslash"}\nMaksimal ball: ${numericMax}\nO'quvchi javobi (anonim): ${cleanStudentAnswer}\n\nUshbu javobni mezon asosida tahlil qilib, tavsiya etilgan ball (0 dan ${numericMax} gacha) va qisqa izohni JSON shaklida qaytaring.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedPoints: { type: Type.NUMBER },
              confidence: { type: Type.STRING },
              feedback: { type: Type.STRING },
            },
            required: ['suggestedPoints', 'confidence', 'feedback'],
          },
        },
      });
      const parsed = JSON.parse((response.text ?? '{}').trim());
      const bounded = Math.max(0, Math.min(numericMax, Number(parsed.suggestedPoints) || 0));
      return res.json({
        suggestedPoints: bounded,
        maxPoints: numericMax,
        confidence: parsed.confidence || 'medium',
        feedback: String(parsed.feedback || "AI tavsiyasi tayyor. Yakuniy bahoni o'qituvchi tasdiqlaydi."),
        isAiSuggestion: true,
        finalized: false,
      });
    } catch {
      return res.json({
        suggestedPoints: Math.round(numericMax * 0.75 * 10) / 10,
        maxPoints: numericMax,
        confidence: 'medium',
        feedback: "Mezon bo'yicha dastlabki baholash tavsiyasi. O'qituvchi tomonidan tasdiqlanishi zarur.",
        isAiSuggestion: true,
        finalized: false,
      });
    }
  });

  // Teacher / Platform Owner explicitly confirms final score & feedback for a written answer
  app.post('/api/attempts/:attemptId/grade-answer', (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi.' });
    const { user, env, db } = authCtx;

    if (user.role !== 'teacher' && user.role !== 'admin' && user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Yozma javobni baholash faqat o‘qituvchi va administrator uchun.' });
    }

    const isOwner = isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL);
    const attempt = db.attempts.find(
      (a) =>
        a.id === req.params.attemptId &&
        (isOwner || a.institutionId === user.institutionId)
    );
    if (!attempt) return res.status(404).json({ error: 'Urinish (attempt) topilmadi.' });

    const { questionId, awardedPoints, feedback, aiSuggestedPoints, aiSuggestedFeedback } = req.body;
    if (!questionId || awardedPoints === undefined || awardedPoints === null) {
      return res.status(400).json({ error: 'Savol ID va berilgan ballni kiriting.' });
    }

    const answerTarget = attempt.answers.find((ans) => ans.questionId === questionId);
    if (!answerTarget) {
      return res.status(404).json({ error: 'Ushbu urinishda ko‘rsatilgan savol topilmadi.' });
    }

    const nowIso = new Date().toISOString();
    const maxPts = answerTarget.maxPoints || 1;
    const boundedPts = Math.max(0, Math.min(maxPts, Number(awardedPoints)));

    const topicsMap: Record<string, Topic> = {};
    for (const t of db.topics) {
      topicsMap[t.id] = t;
    }

    const updatedAttempt = recalculateAttemptAfterManualGrading(
      attempt,
      String(questionId),
      boundedPts,
      String(feedback || '').trim(),
      user.uid,
      topicsMap,
      nowIso
    );

    const idx = db.attempts.findIndex((a) => a.id === attempt.id);
    if (idx !== -1) {
      db.attempts[idx] = updatedAttempt;
    }

    const gradingRecord: GradingRecord = {
      id: `grade-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      institutionId: attempt.institutionId,
      attemptId: attempt.id,
      questionId: String(questionId),
      gradedByUid: user.uid,
      gradedByName: user.displayName,
      awardedPoints: boundedPts,
      maxPoints: maxPts,
      feedback: String(feedback || '').trim(),
      aiSuggestedPoints: aiSuggestedPoints !== undefined ? Number(aiSuggestedPoints) : undefined,
      aiSuggestedFeedback: aiSuggestedFeedback ? String(aiSuggestedFeedback) : undefined,
      createdAt: nowIso,
    };
    db.gradingRecords.unshift(gradingRecord);

    // Refresh student's Topic Mastery Records and Learning Paths with updated score
    const existingStudentMastery = db.masteryRecords.filter((r) => r.studentId === attempt.studentId);
    const otherMastery = db.masteryRecords.filter((r) => r.studentId !== attempt.studentId);
    const updatedStudentMastery = updateMasteryRecordsFromAttempt(
      existingStudentMastery,
      attempt.studentId,
      attempt.institutionId,
      updatedAttempt.topicBreakdown,
      db.topics,
      nowIso
    );
    db.masteryRecords = [...otherMastery, ...updatedStudentMastery];

    pushNotification(
      db,
      attempt.institutionId,
      attempt.studentId,
      'Yozma javobingiz baholandi',
      `"${attempt.assessmentTitle}" testidagi yozma javobingiz o'qituvchi ${user.displayName} tomonidan baholandi (${boundedPts}/${maxPts} ball). Umumiy natija: ${updatedAttempt.scorePercent}%.`,
      `/student/results/${attempt.id}`
    );

    appendAuditLog(
      db,
      attempt.institutionId,
      user,
      `Yozma javob baholandi (${boundedPts}/${maxPts} ball)`,
      `${attempt.studentName} — ${attempt.assessmentTitle}`,
      gradingRecord.id
    );

    saveDbState(env, db);
    broadcastInstitutionUpdate(env, attempt.institutionId, 'ATTEMPT_GRADED');

    return res.json({
      attempt: updatedAttempt,
      gradingRecord,
      masteryRecords: updatedStudentMastery,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Ensure the official 21-workbook Mathematics curriculum archive is imported into the prod database on startup
  try {
    const prodDb = getDbState('prod');
    if (!Array.isArray(prodDb.curriculumImportJobs)) {
      prodDb.curriculumImportJobs = [];
    }
    const hasOfficialMathImport = prodDb.workPlans.some((wp) =>
      wp.id.startsWith('wp-math-wb-')
    );
    if (!hasOfficialMathImport) {
      const officialPreview = await getOfficialMathArchivePreview();
      if (officialPreview && officialPreview.totalWorkbooks === 21) {
        const inst = prodDb.institutions[0];
        applyCurriculumZipPreviewToDatabase(
          officialPreview,
          prodDb.workPlans,
          prodDb.lessons,
          prodDb.topics,
          prodDb.curriculumImportJobs,
          {
            institutionId: inst?.id || 'inst-specialized-study',
            academicYear: inst?.academicYear || '2026-2027',
            actorUid: 'admin-owner',
            actorName: 'Asilbek Nuraliyev',
            tTrackVisibilityApproved: false,
            publishImmediately: false,
            duplicatePolicy: 'update_existing',
          }
        );
        saveDbState('prod', prodDb);
      }
    }
  } catch (seedErr) {
    console.warn('Official math curriculum startup check:', seedErr);
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LearnOS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
