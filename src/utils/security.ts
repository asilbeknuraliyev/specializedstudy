import { UserProfile, ClassRoom, Invitation } from '../types';
import {
  PLATFORM_OWNER_EMAIL,
  SECOND_PLATFORM_ADMIN_EMAIL,
  AUTHORIZED_ADMIN_EMAILS,
} from '../constants/curriculum';

export { PLATFORM_OWNER_EMAIL, SECOND_PLATFORM_ADMIN_EMAIL, AUTHORIZED_ADMIN_EMAILS };

export function isAuthorizedAdminEmail(
  email: string | null | undefined,
  configuredOwnerEmail?: string
): boolean {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;
  if (
    configuredOwnerEmail &&
    configuredOwnerEmail.trim().toLowerCase() !== PLATFORM_OWNER_EMAIL.toLowerCase()
  ) {
    return (
      normalized === configuredOwnerEmail.trim().toLowerCase() ||
      AUTHORIZED_ADMIN_EMAILS.includes(normalized)
    );
  }
  return AUTHORIZED_ADMIN_EMAILS.includes(normalized);
}

export function hasTrustedPlatformAdminClaim(params: {
  email?: string | null;
  emailVerified?: boolean;
  uid?: string | null;
  authenticatedUid?: string | null;
  claims?: Record<string, unknown> | null;
}): boolean {
  const normalizedEmail = String(params.email || '').trim().toLowerCase();
  if (!normalizedEmail || !isAuthorizedAdminEmail(normalizedEmail)) {
    return false;
  }
  if (params.emailVerified !== true) {
    return false;
  }
  if (
    params.uid &&
    params.authenticatedUid &&
    String(params.uid).trim() !== String(params.authenticatedUid).trim()
  ) {
    return false;
  }
  const claims = params.claims || {};
  return claims.platformAdmin === true || claims.platformOwner === true;
}

export function isVerifiedPlatformOwner(
  actor: UserProfile | null | undefined,
  configuredOwnerEmail: string = PLATFORM_OWNER_EMAIL
): boolean {
  if (!actor || actor.status === 'suspended' || actor.status === 'archived') return false;
  const normalizedActorEmail = String(actor.email || '').trim().toLowerCase();
  if (!isAuthorizedAdminEmail(normalizedActorEmail, configuredOwnerEmail)) {
    return false;
  }
  if (actor.emailVerified === false) {
    return false;
  }
  return (
    actor.platformAdmin === true ||
    actor.platformOwner === true ||
    actor.role === 'platform_owner' ||
    actor.role === 'admin'
  );
}

export function isAuthorizedAdmin(
  actor: UserProfile | null | undefined,
  configuredOwnerEmail: string = PLATFORM_OWNER_EMAIL
): boolean {
  return isVerifiedPlatformOwner(actor, configuredOwnerEmail);
}

export function canAccessPlatformAdminConsole(
  actor: UserProfile | null | undefined,
  configuredOwnerEmail: string = PLATFORM_OWNER_EMAIL
): boolean {
  return isVerifiedPlatformOwner(actor, configuredOwnerEmail);
}

export function computeSimpleHash(input: string): string {
  // Deterministic SHA-like hash suitable for isomorphic validation (browser + Node)
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0, ch; i < input.length; i++) {
    ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
}

export function validateInvitationToken(
  rawToken: string,
  invitation: Invitation | undefined,
  nowIso: string = new Date().toISOString()
): { valid: boolean; error?: string } {
  if (!invitation) {
    return { valid: false, error: 'Taklif kodi topilmadi.' };
  }
  if (invitation.status === 'accepted') {
    return { valid: false, error: 'Ushbu taklif kodi allaqachon ishlatilgan (bir martalik).' };
  }
  if (invitation.status === 'revoked') {
    return { valid: false, error: 'Ushbu taklif kodi administrator tomonidan bekor qilingan.' };
  }
  if (
    invitation.status === 'expired' ||
    new Date(invitation.expiresAt).getTime() < new Date(nowIso).getTime()
  ) {
    return { valid: false, error: 'Taklif kodining amal qilish muddati tugagan.' };
  }
  const hashed = computeSimpleHash(rawToken.trim().toUpperCase());
  if (hashed !== invitation.tokenHash) {
    return { valid: false, error: 'Taklif kodi xato yoki haqiqiy emas.' };
  }
  return { valid: true };
}

export function canAccessInstitution(actor: UserProfile | null, targetInstitutionId: string): boolean {
  if (!actor || actor.status === 'suspended') return false;
  if (isVerifiedPlatformOwner(actor)) return true;
  return actor.institutionId === targetInstitutionId;
}

export function canAccessClass(actor: UserProfile | null, targetClass: ClassRoom): boolean {
  if (!actor || actor.status === 'suspended' || actor.status === 'archived') return false;
  if (isVerifiedPlatformOwner(actor)) return true;
  if (actor.institutionId !== targetClass.institutionId) return false;

  if (actor.role === 'student') {
    return (
      actor.classId === targetClass.id ||
      Boolean(
        actor.classCode &&
          targetClass.code &&
          actor.classCode.trim().toLowerCase() === targetClass.code.trim().toLowerCase()
      )
    );
  }
  return false;
}

export function canAccessStudentRecord(
  actor: UserProfile | null,
  targetStudent: UserProfile,
  _authorizedTeacherClassIds: string[] = []
): boolean {
  if (!actor || actor.status === 'suspended' || actor.status === 'archived') return false;
  if (isVerifiedPlatformOwner(actor)) return true;
  if (actor.institutionId !== targetStudent.institutionId) return false;

  if (actor.role === 'student') {
    return actor.uid === targetStudent.uid;
  }
  return false;
}

export function sanitizeFormulaInjection(raw: unknown): string {
  const str = String(raw ?? '').trim();
  if (!str) return '';
  if (/^[=+\-@\t\r]/.test(str) && !/^[+-]?\d+(\.\d+)?$/.test(str)) {
    return str.replace(/^[=+\-@\t\r]+/, '').trim();
  }
  return str;
}

export function escapeExcelExportCell(value: string | number | undefined | null): string | number {
  if (typeof value === 'number') return value;
  const str = String(value ?? '');
  if (!str) return '';
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export function isSafeArchivePath(entryName: string): boolean {
  if (!entryName || typeof entryName !== 'string') return false;
  if (entryName.includes('\0')) return false;
  const normalized = entryName.replace(/\\/g, '/').trim();
  if (
    normalized.startsWith('/') ||
    normalized.includes('../') ||
    normalized.includes('/..') ||
    normalized === '..' ||
    /^[a-zA-Z]:/.test(normalized)
  ) {
    return false;
  }
  const lower = normalized.toLowerCase();
  const forbiddenExts = [
    '.exe',
    '.bat',
    '.cmd',
    '.sh',
    '.js',
    '.mjs',
    '.cjs',
    '.ts',
    '.php',
    '.py',
    '.dll',
    '.so',
    '.xlsm',
    '.xlsb',
    '.vbs',
    '.ps1',
    '.html',
    '.htm',
    '.svg',
  ];
  if (forbiddenExts.some((ext) => lower.endsWith(ext))) {
    return false;
  }
  return true;
}

export function detectImageMimeFromBytes(bytes: Uint8Array): string | null {
  if (!bytes || bytes.length < 3) return null;
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export function detectPdfFromBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

export class SlidingWindowRateLimiter {
  private buckets = new Map<string, number[]>();

  public check(key: string, maxRequests: number, windowMs: number, nowMs: number = Date.now()): {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
  } {
    const cutoff = nowMs - windowMs;
    const existing = (this.buckets.get(key) || []).filter((ts) => ts > cutoff);
    if (existing.length >= maxRequests) {
      const oldest = existing[0] || nowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
      this.buckets.set(key, existing);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
      };
    }
    existing.push(nowMs);
    this.buckets.set(key, existing);
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - existing.length),
      retryAfterSeconds: 0,
    };
  }

  public reset(key?: string): void {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
    }
  }
}

export function validateUploadedImageMeta(
  fileName: string,
  mimeTypeOrSize: string | number,
  sizeOrHeaderBytes?: number | Uint8Array,
  headerBytesArg?: Uint8Array,
  maxBytes: number = 5 * 1024 * 1024
): { valid: boolean; error?: string; verifiedMime?: string; mimeType?: string } {
  let mimeType = '';
  let sizeBytes = 0;
  let headerBytes: Uint8Array | undefined;

  if (typeof mimeTypeOrSize === 'number') {
    sizeBytes = mimeTypeOrSize;
    headerBytes = sizeOrHeaderBytes instanceof Uint8Array ? sizeOrHeaderBytes : headerBytesArg;
  } else {
    mimeType = String(mimeTypeOrSize || '');
    sizeBytes = typeof sizeOrHeaderBytes === 'number' ? sizeOrHeaderBytes : 0;
    headerBytes = headerBytesArg;
  }

  if (!fileName || !isSafeArchivePath(fileName)) {
    return { valid: false, error: 'Xavfsiz bo‘lmagan fayl nomi yoki yo‘li.' };
  }
  const lower = fileName.toLowerCase();
  const extMatch = lower.match(/\.[a-z0-9]+$/);
  const ext = extMatch ? extMatch[0] : '';
  if (!ALLOWED_IMAGE_EXTS.has(ext)) {
    return {
      valid: false,
      error: `Ruxsat etilmagan rasm formati (${ext || 'noma’lum'}). Faqat JPEG, PNG va WebP ruxsat etiladi.`,
    };
  }
  if (sizeBytes <= 0) {
    return { valid: false, error: 'Fayl bo‘sh.' };
  }
  if (sizeBytes > maxBytes) {
    return {
      valid: false,
      error: `Rasm hajmi ruxsat etilgan chegaradan (${Math.round(maxBytes / (1024 * 1024))} MB) oshib ketdi.`,
    };
  }

  if (headerBytes && headerBytes.length > 0) {
    const detected = detectImageMimeFromBytes(headerBytes);
    if (!detected || !ALLOWED_IMAGE_MIMES.has(detected)) {
      return {
        valid: false,
        error: 'Faylning haqiqiy binar tarkibi ruxsat etilgan rasm formatiga (JPEG/PNG/WebP) mos emas.',
      };
    }
    return { valid: true, verifiedMime: detected, mimeType: detected };
  }

  const cleanMime = String(mimeType || '').toLowerCase();
  if (cleanMime && !ALLOWED_IMAGE_MIMES.has(cleanMime)) {
    return {
      valid: false,
      error: `Ruxsat etilmagan MIME turi (${cleanMime}). Faqat JPEG, PNG va WebP ruxsat etiladi.`,
    };
  }

  const resolvedMime =
    cleanMime || (ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg');
  return {
    valid: true,
    verifiedMime: resolvedMime,
    mimeType: resolvedMime,
  };
}

export interface CSVStudentRow {
  displayName: string;
  email: string;
  className?: string;
}

export interface CSVValidationResult {
  validRows: CSVStudentRow[];
  errors: string[];
  duplicates: string[];
}

export function validateCSVStudentImport(
  csvText: string,
  existingEmails: string[] = []
): CSVValidationResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      validRows: [],
      errors: ["CSV fayl bo'sh."],
      duplicates: [],
    };
  }

  if (lines.length > 5001) {
    return {
      validRows: [],
      errors: ["CSV fayl qatorlar soni maksimal chegaradan (5000 qator) oshib ketdi."],
      duplicates: [],
    };
  }

  const headerLine = lines[0].toLowerCase();
  const hasHeader =
    headerLine.includes('ism') ||
    headerLine.includes('name') ||
    headerLine.includes('email') ||
    headerLine.includes('pochta');

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const existingSet = new Set(existingEmails.map((e) => e.trim().toLowerCase()));
  const seenInCsv = new Set<string>();

  const validRows: CSVStudentRow[] = [];
  const errors: string[] = [];
  const duplicates: string[] = [];

  dataLines.forEach((line, idx) => {
    const rowNum = hasHeader ? idx + 2 : idx + 1;
    const cols = line
      .split(',')
      .map((c) => sanitizeFormulaInjection(c.trim().replace(/^"|"$/g, '')));
    if (cols.length < 2) {
      errors.push(`${rowNum}-qator: Ism va elektron pochta ustunlari to'liq emas.`);
      return;
    }

    const [displayName, email, className] = cols;
    if (!displayName || displayName.length < 3) {
      errors.push(`${rowNum}-qator: O'quvchi ismi kamida 3 ta belgidan iborat bo'lishi shart.`);
      return;
    }
    const normalizedEmail = (email || '').toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
      errors.push(`${rowNum}-qator: Noto'g'ri elektron pochta manzili (${email}).`);
      return;
    }

    if (existingSet.has(normalizedEmail) || seenInCsv.has(normalizedEmail)) {
      duplicates.push(`${rowNum}-qator: Takroriy elektron pochta (${email}).`);
      return;
    }

    seenInCsv.add(normalizedEmail);
    validRows.push({
      displayName,
      email: normalizedEmail,
      className: className || undefined,
    });
  });

  return { validRows, errors, duplicates };
}

export function isTrustedCorsOrigin(
  origin: string | undefined,
  requestHost?: string
): boolean {
  if (!origin || !origin.trim() || origin.trim().toLowerCase() === 'null') {
    return true;
  }
  try {
    const parsed = new URL(origin.trim());
    const hostname = parsed.hostname.toLowerCase();
    const hostWithPort = parsed.host.toLowerCase();

    if (requestHost && requestHost.trim()) {
      const candidateHosts = requestHost
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
      for (const normalizedReqHost of candidateHosts) {
        if (hostWithPort === normalizedReqHost || hostname === normalizedReqHost.split(':')[0]) {
          return true;
        }
      }
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    }

    if (parsed.protocol !== 'https:') {
      return false;
    }

    // Check configured APP_URL / VERCEL_URL environment variables when running on server
    if (typeof process !== 'undefined' && process.env) {
      const configuredUrls = [
        process.env.APP_URL,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
        process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : undefined,
        process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : undefined,
      ].filter(Boolean) as string[];

      for (const rawUrl of configuredUrls) {
        try {
          const envParsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
          if (envParsed.hostname.toLowerCase() === hostname) {
            return true;
          }
        } catch {
          // Ignore malformed env URL
        }
      }
    }

    return (
      hostname.endsWith('.vercel.app') ||
      hostname === 'vercel.app' ||
      hostname.endsWith('.run.app') ||
      hostname === 'ai.studio' ||
      hostname.endsWith('.ai.studio') ||
      hostname.endsWith('.firebaseapp.com') ||
      hostname.endsWith('.web.app') ||
      hostname === 'google.com' ||
      hostname.endsWith('.google.com') ||
      hostname.endsWith('.googleusercontent.com') ||
      hostname.endsWith('.goog') ||
      hostname.endsWith('.cloudworkstations.dev') ||
      hostname.endsWith('.idx.dev') ||
      hostname.endsWith('.appspot.com')
    );
  } catch {
    return false;
  }
}

