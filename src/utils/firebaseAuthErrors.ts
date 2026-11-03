export interface SanitizedFirebaseAuthError {
  code: string;
  userMessage: string;
  recoveryAction: string;
  sanitizedLog: string;
  shouldOfferRedirectFallback: boolean;
  detectedHostname?: string;
  detectedOrigin?: string;
  firebaseProjectId?: string;
  isVercelPreviewDomain?: boolean;
}

const SENSITIVE_PATTERNS = [
  /AIza[0-9A-Za-z_-]{30,}/g,
  /eyJ[0-9A-Za-z_-]+\.[0-9A-Za-z_-]+\.[0-9A-Za-z_-]+/g,
  /Bearer\s+[0-9A-Za-z._-]+/gi,
  /access_token=[^&\s]+/gi,
  /id_token=[^&\s]+/gi,
];

export function sanitizeTechnicalAuthMessage(raw: string): string {
  let cleaned = String(raw || '').trim();
  for (const pattern of SENSITIVE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[REDACTED]');
  }
  return cleaned.slice(0, 240);
}

export function extractFirebaseErrorCode(error: unknown): string {
  if (!error) return 'auth/unknown';
  if (typeof error === 'object' && error !== null) {
    const maybeCode = (error as { code?: unknown }).code;
    if (typeof maybeCode === 'string' && maybeCode.startsWith('auth/')) {
      return maybeCode.trim().toLowerCase();
    }
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string') {
      const match = maybeMessage.match(/\b(auth\/[a-z0-9-]+)\b/i);
      if (match) {
        return match[1].toLowerCase();
      }
    }
  }
  if (typeof error === 'string') {
    const match = error.match(/\b(auth\/[a-z0-9-]+)\b/i);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  return 'auth/unknown';
}

export interface AuthErrorContext {
  hostname?: string;
  origin?: string;
  projectId?: string;
}

export function mapFirebaseAuthError(
  error: unknown,
  context?: AuthErrorContext
): SanitizedFirebaseAuthError {
  const code = extractFirebaseErrorCode(error);
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : JSON.stringify(error || {});

  const detectedHostname = (
    context?.hostname ||
    (typeof window !== 'undefined' && window.location ? window.location.hostname : '') ||
    ''
  )
    .trim()
    .toLowerCase();
  const detectedOrigin = (
    context?.origin ||
    (typeof window !== 'undefined' && window.location ? window.location.origin : '') ||
    ''
  ).trim();
  const firebaseProjectId = (context?.projectId || 'specialized-study').trim();
  const isVercelDomain = detectedHostname.endsWith('.vercel.app');
  const vercelSubdomain = isVercelDomain ? detectedHostname.replace(/\.vercel\.app$/, '') : '';
  const isVercelPreviewDomain =
    isVercelDomain &&
    (vercelSubdomain.includes('-git-') ||
      /-[a-z0-9]{9}-[a-z0-9-]+$/i.test(vercelSubdomain) ||
      vercelSubdomain.split('-').length >= 4);

  const sanitizedLog = `[FirebaseAuth] code=${code} host=${detectedHostname || 'unknown'} project=${firebaseProjectId} detail=${sanitizeTechnicalAuthMessage(rawMessage)}`;

  switch (code) {
    case 'auth/unauthorized-domain': {
      const domainLabel = detectedHostname ? `"${detectedHostname}"` : 'Joriy domen';
      const previewWarning = isVercelPreviewDomain
        ? " Eslatma: Siz vaqtinchalik Vercel Preview URL orqali kirdingiz — asosiy Production domeningizdan foydalaning yoki ushbu preview domenni ham Firebase ro'yxatiga qo'shing."
        : '';
      return {
        code,
        userMessage: "Bu domen orqali kirishga ruxsat yo'q.",
        recoveryAction: `${domainLabel} domeni Firebase Console (${firebaseProjectId}) → Authentication → Settings → Authorized domains ro'yxatiga kiritilishi shart.${previewWarning}`,
        sanitizedLog,
        shouldOfferRedirectFallback: false,
        detectedHostname: detectedHostname || undefined,
        detectedOrigin: detectedOrigin || undefined,
        firebaseProjectId,
        isVercelPreviewDomain,
      };
    }

    case 'auth/operation-not-allowed':
      return {
        code,
        userMessage: 'Google orqali kirish sozlanmagan.',
        recoveryAction:
          `Firebase Console (${firebaseProjectId}) → Authentication → Sign-in method bo'limida Google provayderini faollashtiring.`,
        sanitizedLog,
        shouldOfferRedirectFallback: false,
        detectedHostname: detectedHostname || undefined,
        firebaseProjectId,
      };

    case 'auth/popup-blocked':
      return {
        code,
        userMessage:
          "Brauzer qalqib chiquvchi oynani blokladi. Yo'naltirish orqali kirishni sinab ko'ring.",
        recoveryAction:
          "Brauzerda pop-up oynalarga ruxsat bering yoki quyidagi «Yo'naltirish orqali kirish» tugmasidan foydalaning.",
        sanitizedLog,
        shouldOfferRedirectFallback: true,
        detectedHostname: detectedHostname || undefined,
        firebaseProjectId,
      };

    case 'auth/popup-closed-by-user':
      return {
        code,
        userMessage: "Kirish oynasi yopildi. Qaytadan urinib ko'ring.",
        recoveryAction:
          "«Google bilan kirish» tugmasini bosing va Google hisobingizni tanlash jarayonini yakunlang.",
        sanitizedLog,
        shouldOfferRedirectFallback: false,
        detectedHostname: detectedHostname || undefined,
        firebaseProjectId,
      };

    case 'auth/cancelled-popup-request':
      return {
        code,
        userMessage: "Avvalgi kirish so'rovi bekor qilindi.",
        recoveryAction:
          'Tugmani faqat bir marta bosing va Google hisob tanlash oynasi ochilishini kuting.',
        sanitizedLog,
        shouldOfferRedirectFallback: false,
        detectedHostname: detectedHostname || undefined,
        firebaseProjectId,
      };

    case 'auth/network-request-failed':
      return {
        code,
        userMessage: 'Internet aloqasini tekshiring.',
        recoveryAction:
          "Tarmoq ulanishi yoki xavfsizlik devori (firewall) Google xizmatlariga ruxsat berayotganini tekshirib, qayta urinib ko'ring.",
        sanitizedLog,
        shouldOfferRedirectFallback: false,
        detectedHostname: detectedHostname || undefined,
        firebaseProjectId,
      };

    case 'auth/account-exists-with-different-credential':
      return {
        code,
        userMessage: "Ushbu elektron pochta boshqa kirish usuli bilan ro'yxatdan o'tgan.",
        recoveryAction:
          "Avval ro'yxatdan o'tgan kirish usulingizdan foydalaning yoki tasdiqlangan Google hisobingizni tanlang.",
        sanitizedLog,
        shouldOfferRedirectFallback: false,
        detectedHostname: detectedHostname || undefined,
        firebaseProjectId,
      };

    case 'auth/invalid-api-key':
      return {
        code,
        userMessage: "Avtorizatsiya xizmati kaliti yaroqsiz yoki noto'g'ri sozlangan.",
        recoveryAction:
          `Firebase loyiha konfiguratsiyasidagi (${firebaseProjectId}) apiKey va projectId mosligini tekshiring.`,
        sanitizedLog,
        shouldOfferRedirectFallback: false,
        detectedHostname: detectedHostname || undefined,
        firebaseProjectId,
      };

    case 'auth/invalid-credential':
      return {
        code,
        userMessage: "Google tasdiqlash ma'lumotlari eskirgan yoki yaroqsiz.",
        recoveryAction: "Sahifani yangilab, Google hisobingiz orqali qayta kirib ko'ring.",
        sanitizedLog,
        shouldOfferRedirectFallback: false,
        detectedHostname: detectedHostname || undefined,
        firebaseProjectId,
      };

    case 'auth/too-many-requests':
      return {
        code,
        userMessage: "Juda ko'p urinish amalga oshirildi. Biroz kutib, qayta urinib ko'ring.",
        recoveryAction: "Xavfsizlik cheklovi sababli 1–2 daqiqa kuting va qayta urinib ko'ring.",
        sanitizedLog,
        shouldOfferRedirectFallback: false,
        detectedHostname: detectedHostname || undefined,
        firebaseProjectId,
      };

    case 'auth/user-disabled':
      return {
        code,
        userMessage: "Ushbu foydalanuvchi hisobi vaqtincha to'xtatilgan.",
        recoveryAction: "Hisob holatini tekshirish uchun platforma mas'uliga murojaat qiling.",
        sanitizedLog,
        shouldOfferRedirectFallback: false,
        detectedHostname: detectedHostname || undefined,
        firebaseProjectId,
      };

    case 'auth/operation-not-supported-in-this-environment':
      return {
        code,
        userMessage: "Ushbu brauzer muhitida qalqib chiquvchi oyna qo'llab-quvvatlanmaydi.",
        recoveryAction: "Avtomatik yo'naltirish (redirect) orqali kirish rejimi ishga tushiriladi.",
        sanitizedLog,
        shouldOfferRedirectFallback: true,
        detectedHostname: detectedHostname || undefined,
        firebaseProjectId,
      };

    default:
      return {
        code,
        userMessage: "Google orqali kirishda xatolik yuz berdi. Qayta urinib ko'ring.",
        recoveryAction:
          "Hisobingizni qaytadan tanlang yoki internet aloqasini tekshirib ko'ring.",
        sanitizedLog,
        shouldOfferRedirectFallback: false,
        detectedHostname: detectedHostname || undefined,
        firebaseProjectId,
      };
  }
}

export function isMobileOrTouchRedirectPreferred(userAgent?: string): boolean {
  const ua =
    userAgent !== undefined
      ? userAgent
      : typeof navigator !== 'undefined'
      ? navigator.userAgent
      : '';
  if (!ua) return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
}

const POST_LOGIN_DESTINATION_KEY = 'specialized_study_post_login_dest';

export function savePostLoginDestination(destinationPath: string): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const clean = String(destinationPath || '').trim();
    if (clean && clean.startsWith('/') && !clean.startsWith('//') && clean !== '/login') {
      window.sessionStorage.setItem(POST_LOGIN_DESTINATION_KEY, clean);
    }
  } catch {
    // Ignore sessionStorage restrictions
  }
}

export function consumePostLoginDestination(): string | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const saved = window.sessionStorage.getItem(POST_LOGIN_DESTINATION_KEY);
    if (saved) {
      window.sessionStorage.removeItem(POST_LOGIN_DESTINATION_KEY);
      if (saved.startsWith('/') && !saved.startsWith('//') && saved !== '/login') {
        return saved;
      }
    }
  } catch {
    // Ignore sessionStorage restrictions
  }
  return null;
}
