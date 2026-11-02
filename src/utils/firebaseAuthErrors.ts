export interface SanitizedFirebaseAuthError {
  code: string;
  userMessage: string;
  recoveryAction: string;
  sanitizedLog: string;
  shouldOfferRedirectFallback: boolean;
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
      return maybeCode.trim();
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

export function mapFirebaseAuthError(error: unknown): SanitizedFirebaseAuthError {
  const code = extractFirebaseErrorCode(error);
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : JSON.stringify(error || {});
  const sanitizedLog = `[FirebaseAuth] code=${code} detail=${sanitizeTechnicalAuthMessage(rawMessage)}`;

  switch (code) {
    case 'auth/unauthorized-domain':
      return {
        code,
        userMessage: 'Bu domen orqali kirishga ruxsat berilmagan.',
        recoveryAction:
          "Joriy domen Firebase Console → Authentication → Settings → Authorized domains ro'yxatiga kiritilganligini tekshiring.",
        sanitizedLog,
        shouldOfferRedirectFallback: false,
      };

    case 'auth/operation-not-allowed':
      return {
        code,
        userMessage: 'Google orqali kirish hali sozlanmagan.',
        recoveryAction:
          'Firebase Console → Authentication → Sign-in method bo‘limida Google provayderini faollashtiring.',
        sanitizedLog,
        shouldOfferRedirectFallback: false,
      };

    case 'auth/popup-blocked':
      return {
        code,
        userMessage: "Kirish oynasi bloklandi. Qayta urinib ko'ring.",
        recoveryAction:
          "Brauzerda qalqib chiquvchi oynalarga (pop-up) ruxsat bering yoki sahifa orqali yo'naltirish (redirect) rejimidan foydalaning.",
        sanitizedLog,
        shouldOfferRedirectFallback: true,
      };

    case 'auth/popup-closed-by-user':
      return {
        code,
        userMessage: 'Kirish oynasi yopildi. Tizimga kirish uchun Google hisobingizni tanlang.',
        recoveryAction:
          '«Google bilan kirish» tugmasini qayta bosing va hisob tanlash jarayonini yakunlang.',
        sanitizedLog,
        shouldOfferRedirectFallback: false,
      };

    case 'auth/cancelled-popup-request':
      return {
        code,
        userMessage: 'Avvalgi kirish oynasi yangi so‘rov sababli bekor qilindi.',
        recoveryAction:
          'Tugmani faqat bir marta bosing va Google hisob tanlash oynasi ochilishini kuting.',
        sanitizedLog,
        shouldOfferRedirectFallback: false,
      };

    case 'auth/network-request-failed':
      return {
        code,
        userMessage: "Internet aloqasini tekshirib, qayta urinib ko'ring.",
        recoveryAction:
          "Tarmoq ulanishi yoki xavfsizlik devori (firewall) Google xizmatlariga ruxsat berayotganini tekshiring.",
        sanitizedLog,
        shouldOfferRedirectFallback: false,
      };

    case 'auth/account-exists-with-different-credential':
      return {
        code,
        userMessage: 'Ushbu elektron pochta boshqa kirish usuli bilan ro‘yxatdan o‘tgan.',
        recoveryAction:
          "Avval ro'yxatdan o'tgan kirish usulingizdan foydalaning yoki tasdiqlangan Google hisobingizni tanlang.",
        sanitizedLog,
        shouldOfferRedirectFallback: false,
      };

    case 'auth/invalid-api-key':
      return {
        code,
        userMessage: 'Avtorizatsiya xizmati kaliti yaroqsiz yoki noto‘g‘ri sozlangan.',
        recoveryAction:
          'Firebase loyiha konfiguratsiyasidagi apiKey va projectId mosligini tekshiring.',
        sanitizedLog,
        shouldOfferRedirectFallback: false,
      };

    case 'auth/invalid-credential':
      return {
        code,
        userMessage: "Google tasdiqlash ma'lumotlari eskirgan yoki yaroqsiz.",
        recoveryAction: "Sahifani yangilab, Google hisobingiz orqali qayta kirib ko'ring.",
        sanitizedLog,
        shouldOfferRedirectFallback: false,
      };

    case 'auth/too-many-requests':
      return {
        code,
        userMessage: "Juda ko'p urinish amalga oshirildi. Biroz kutib, qayta urinib ko'ring.",
        recoveryAction: "Xavfsizlik cheklovi sababli 1–2 daqiqa kuting va qayta urinib ko'ring.",
        sanitizedLog,
        shouldOfferRedirectFallback: false,
      };

    case 'auth/user-disabled':
      return {
        code,
        userMessage: "Ushbu foydalanuvchi hisobi vaqtincha to'xtatilgan.",
        recoveryAction: "Hisob holatini tekshirish uchun platforma mas'uliga murojaat qiling.",
        sanitizedLog,
        shouldOfferRedirectFallback: false,
      };

    case 'auth/operation-not-supported-in-this-environment':
      return {
        code,
        userMessage: "Ushbu brauzer muhitida qalqib chiquvchi oyna qo'llab-quvvatlanmaydi.",
        recoveryAction: "Avtomatik yo'naltirish (redirect) orqali kirish rejimi ishga tushiriladi.",
        sanitizedLog,
        shouldOfferRedirectFallback: true,
      };

    default:
      return {
        code,
        userMessage: "Google orqali kirishda xatolik yuz berdi. Qayta urinib ko'ring.",
        recoveryAction:
          "Hisobingizni qaytadan tanlang yoki internet aloqasini tekshirib ko'ring.",
        sanitizedLog,
        shouldOfferRedirectFallback: false,
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
