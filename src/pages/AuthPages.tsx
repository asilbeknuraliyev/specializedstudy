import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  Mail,
  Lock,
  UserCheck,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useLearnOS } from '../context/LearnOSContext';
import { UserRole } from '../types';
import { APP_NAME, APP_TAGLINE } from '../constants/curriculum';
import { PublicHeader, PublicFooter } from './PublicPages';

export const LoginPage: React.FC = () => {
  const {
    currentUser,
    authReady,
    loginWithPassword,
    loginWithGoogle,
    isGoogleSigningIn,
    authError,
    clearAuthError,
    activationPendingMessage,
    addToast,
  } = useLearnOS();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const navigateForRole = (role: UserRole) => {
    const path = role === 'student' ? '/student/dashboard' : '/admin/dashboard';
    navigate(path, { replace: true });
  };

  useEffect(() => {
    if (authReady && currentUser) {
      navigateForRole(currentUser.role);
    }
  }, [authReady, currentUser]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    clearAuthError();

    if (resetMode) {
      if (!email.trim() || !email.includes('@')) {
        setErrorMsg("Iltimos, to'g'ri elektron pochta manzilini kiriting.");
        return;
      }
      setResetSent(true);
      addToast('info', 'Parolni tiklash havolasi yuborildi');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg("Iltimos, to'g'ri elektron pochta manzilini kiriting.");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg("Parol kamida 6 ta belgidan iborat bo'lishi kerak.");
      return;
    }

    setSubmitting(true);
    try {
      const user = await loginWithPassword(email, password);
      navigateForRole(user.role);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Kirishda xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async (forceRedirect = false) => {
    setErrorMsg('');
    clearAuthError();
    const profile = await loginWithGoogle({ forceRedirect });
    if (profile) {
      navigateForRole(profile.role);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center py-12 px-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-6 shadow-xs">
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              {APP_NAME} • {APP_TAGLINE}
            </p>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {resetMode ? 'Parolni tiklash' : 'Tizimga kirish'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {resetMode
                ? 'Tiklash ko‘rsatmalarini olish uchun elektron pochtangizni kiriting.'
                : 'Google hisobingiz yoki elektron pochta orqali davom eting.'}
            </p>
          </div>

          {activationPendingMessage && (
            <div
              role="status"
              className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-800 dark:text-amber-200 space-y-1"
            >
              <p className="font-semibold">Huquqlar faollashtirilishi kutilmoqda</p>
              <p>{activationPendingMessage}</p>
            </div>
          )}

          {authError && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 space-y-2.5 text-xs"
            >
              <div className="flex items-start gap-2 text-rose-700 dark:text-rose-300 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError.userMessage}</span>
              </div>
              <p className="text-rose-600/90 dark:text-rose-300/90 leading-relaxed">
                {authError.recoveryAction}
              </p>
              {authError.shouldOfferRedirectFallback && (
                <button
                  type="button"
                  onClick={() => handleGoogleLogin(true)}
                  disabled={isGoogleSigningIn}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Yo‘naltirish orqali kirish</span>
                </button>
              )}
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300"
            >
              {errorMsg}
            </div>
          )}

          {!resetMode && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => handleGoogleLogin(false)}
                disabled={isGoogleSigningIn || submitting}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 rounded-xl transition-colors disabled:opacity-60 shadow-2xs"
              >
                {isGoogleSigningIn ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                    <span>Google hisobi tekshirilmoqda...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z"
                      />
                    </svg>
                    <span>Google bilan kirish</span>
                  </>
                )}
              </button>

              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-slate-200 dark:border-slate-800" />
                <span className="shrink mx-3 text-xs text-slate-400">yoki elektron pochta</span>
                <div className="grow border-t border-slate-200 dark:border-slate-800" />
              </div>
            </div>
          )}

          {resetSent && resetMode ? (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-3">
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                Parolni tiklash bo‘yicha ko‘rsatma <strong>{email}</strong> manziliga yuborildi.
              </p>
              <button
                type="button"
                onClick={() => {
                  setResetMode(false);
                  setResetSent(false);
                }}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Kirish oynasiga qaytish
              </button>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Elektron pochta
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="foydalanuvchi@specialized.uz"
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {!resetMode && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Parol
                    </label>
                    <button
                      type="button"
                      onClick={() => setResetMode(true)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Parolni unutdingizmi?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || isGoogleSigningIn}
                className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
              >
                {submitting
                  ? 'Tekshirilmoqda...'
                  : resetMode
                  ? 'Tiklash havolasini yuborish'
                  : 'Kirish'}
              </button>

              {resetMode && (
                <button
                  type="button"
                  onClick={() => setResetMode(false)}
                  className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Bekor qilish
                </button>
              )}
            </form>
          )}

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              {APP_NAME} tizimida hisob xavfsizligi tasdiqlangan seans orqali himoyalangan.
            </span>
          </div>

          <p className="text-xs text-slate-500 text-center pt-1">
            O‘quvchi taklif kodingiz bormi?{' '}
            <Link to="/register" className="font-semibold text-blue-600 hover:underline">
              Taklif kodi bilan ulanish
            </Link>
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
};

export const RegisterPage: React.FC = () => {
  const { registerWithInvitation, previewInvitationToken } = useLearnOS();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [inviteToken, setInviteToken] = useState(searchParams.get('invite') || '');
  const [invitePreview, setInvitePreview] = useState<{
    role: UserRole;
    institutionName: string;
    className: string | null;
    email?: string;
    subject?: string;
  } | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const trimmed = inviteToken.trim();
    if (!trimmed || trimmed.length < 6) {
      setInvitePreview(null);
      return;
    }
    previewInvitationToken(trimmed).then((res) => {
      if (active) {
        setInvitePreview(res);
        if (res?.email && !email) {
          setEmail(res.email);
        }
      }
    });
    return () => {
      active = false;
    };
  }, [inviteToken]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!inviteToken.trim()) {
      setErrorMsg('Bir martalik taklif kodini kiriting.');
      return;
    }
    if (displayName.trim().length < 3) {
      setErrorMsg("Iltimos, to'liq ism va familiyangizni kiriting (kamida 3 ta belgi).");
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg("Iltimos, to'g'ri elektron pochta manzilini kiriting.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Parol kamida 6 ta belgidan iborat bo'lishi shart.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await registerWithInvitation({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        inviteToken: inviteToken.trim(),
      });
      const target =
        created.role === 'student' ? '/student/dashboard' : '/admin/dashboard';
      navigate(target);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Ro'yxatdan o'tishda xatolik");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center py-12 px-6">
        <div className="max-w-xl w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
              <KeyRound className="w-4 h-4" />
              <span>O‘quvchi taklifnomasi asosida ro‘yxatdan o‘tish</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {APP_NAME} platformasiga ulanish
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sinfga biriktirilgan taklif kodini (Invite Token) kiriting.
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300"
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleInviteSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label
                htmlFor="reg-invite-token"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Taklifnoma kodi (Invite Token)
              </label>
              <input
                id="reg-invite-token"
                type="text"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="Masalan: INV-A1B2C3D4E5F6"
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-600"
              />
            </div>

            {invitePreview && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tasdiqlangan o‘quvchi taklifnomasi topildi</span>
                </div>
                <p className="text-emerald-700 dark:text-emerald-300">
                  Platforma: <strong>{invitePreview.institutionName}</strong> · Yo‘nalish:{' '}
                  <strong>O‘quvchi</strong>
                  {invitePreview.className ? ` · Sinf: ${invitePreview.className}` : ''}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="reg-name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Ism va familiya
              </label>
              <input
                id="reg-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Masalan: Jasur Karimov"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="reg-email"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Elektron pochta
                </label>
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="oquvchi@specialized.uz"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="reg-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Parol
                </label>
                <input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kamida 6 ta belgi"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              <span>
                {submitting ? 'Faollashtirilmoqda...' : 'O‘quvchi hisobini faollashtirish'}
              </span>
            </button>
          </form>

          <p className="text-xs text-slate-500 text-center">
            Allaqachon hisobingiz bormi?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:underline">
              Tizimga kirish
            </Link>
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
};
