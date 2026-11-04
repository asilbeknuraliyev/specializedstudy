import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Network,
  BarChart3,
  ShieldCheck,
  BookOpen,
  FileSpreadsheet,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useLearnOS } from '../context/LearnOSContext';
import {
  APP_NAME,
  APP_TAGLINE,
  OFFICIAL_A_TRACK_CLASSES,
  OFFICIAL_T_TRACK_CLASSES,
  DEFAULT_SUBJECTS,
} from '../constants/curriculum';

export const PublicHeader: React.FC = () => {
  const { currentUser } = useLearnOS();
  const dashboardPath =
    currentUser?.role === 'student' ? '/student/dashboard' : '/admin/dashboard';

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-8 px-4 sm:px-6 py-3 sm:py-4">
        <Link
          to="/"
          className="flex items-center gap-2 sm:gap-2.5 text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white min-w-0"
        >
          <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-extrabold shrink-0">
            SS
          </span>
          <div className="min-w-0">
            <span className="block leading-none truncate">{APP_NAME}</span>
            <span className="hidden sm:block text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {APP_TAGLINE}
            </span>
          </div>
        </Link>

        <nav
          aria-label="Ommaviy navigatsiya"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          <a
            href="#tizim"
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Platforma
          </a>
          <a
            href="#sinflar"
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            19 ta Sinf (A va T)
          </a>
          <a
            href="#fanlar"
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Fanlar
          </a>
          <Link
            to="/about"
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Biz haqimizda
          </Link>
          <Link
            to="/login"
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Kirish
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {currentUser ? (
            <Link
              to={dashboardPath}
              className="min-h-[40px] inline-flex items-center px-3.5 sm:px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Kabinetga o‘tish
            </Link>
          ) : (
            <Link
              to="/login"
              className="min-h-[40px] inline-flex items-center px-3.5 sm:px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Tizimga kirish
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export const PublicFooter: React.FC = () => {
  return (
    <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 py-10 sm:py-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-3">
          <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            {APP_NAME}
          </p>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            {APP_TAGLINE}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Ixtisoslashtirilgan maktab o‘quv rejalari, 19 ta rasmiy sinf (14 ta A va 5 ta T yo‘nalishi), darslar xaritasi va AI diagnostik testlar platformasi.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-900 dark:text-white mb-3">
            O‘quv modullari
          </h3>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li>
              <a href="#tizim" className="hover:text-blue-600">
                Ish rejalari importi
              </a>
            </li>
            <li>
              <a href="#tizim" className="hover:text-blue-600">
                O‘quv xaritasi
              </a>
            </li>
            <li>
              <a href="#tizim" className="hover:text-blue-600">
                AI Buyruqlar va Test Generatori
              </a>
            </li>
            <li>
              <a href="#tizim" className="hover:text-blue-600">
                Shaxsiy Bilim Xaritasi
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-900 dark:text-white mb-3">
            Platforma bo‘limlari
          </h3>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li>
              <Link to="/login" className="hover:text-blue-600">
                Tizimga kirish
              </Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-blue-600">
                O‘quvchi kabineti (5–11-sinflar)
              </Link>
            </li>
            <li>
              <Link to="/register" className="hover:text-blue-600">
                Taklif kodi orqali ulanish
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-900 dark:text-white mb-3">
            Huquqiy ma’lumotlar
          </h3>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li>
              <Link to="/about" className="hover:text-blue-600">
                Biz haqimizda
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-blue-600">
                Maxfiylik siyosati
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-blue-600">
                Foydalanish shartlari
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-slate-100 dark:border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left text-xs text-slate-500">
        <p>© 2026 {APP_NAME} — {APP_TAGLINE}</p>
        <p>19 ta ixtisoslashtirilgan sinf (5a1–11a2 va 7t–11t) standarti asosida.</p>
      </div>
    </footer>
  );
};

export const LandingPage: React.FC = () => {
  const { isBootstrapped } = useLearnOS();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-10 sm:py-20 lg:py-24 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-6 space-y-5 sm:space-y-6">
              <div className="inline-flex flex-wrap items-center gap-1.5 px-3 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] sm:text-xs font-bold uppercase tracking-wider">
                <span>{APP_NAME}</span>
                <span>•</span>
                <span>{APP_TAGLINE}</span>
              </div>
              <h1
                className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight"
                style={{ textWrap: 'balance' }}
              >
                Ixtisoslashtirilgan maktab uchun yagona intellektual o‘quv tizimi.
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                <strong>{APP_NAME}</strong> — Aniq fanlar (<strong>A yo‘nalishi: 14 ta sinf</strong>) va Tabiiy fanlar (<strong>T yo‘nalishi: 5 ta sinf</strong>) uchun ish rejalarini darslar xaritasiga aylantirish, AI yordamida mavzulashtirilgan testlar yaratish va har bir o‘quvchining o‘zlashtirish ko‘rsatkichini o‘lchash platformasi.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-2">
                <Link
                  to="/login"
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors whitespace-nowrap"
                >
                  <span>Tizimga kirish</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </Link>
                <Link
                  to="/register"
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap"
                >
                  <span>Taklif kodi bilan ulanish</span>
                </Link>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 sm:gap-4 text-xs">
                <div>
                  <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white font-mono">19</p>
                  <p className="text-[11px] sm:text-xs text-slate-500">Rasmiy sinflar (14 A + 5 T)</p>
                </div>
                <div>
                  <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white font-mono">5</p>
                  <p className="text-[11px] sm:text-xs text-slate-500">Ixtisoslashgan fanlar</p>
                </div>
                <div>
                  <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white font-mono">4</p>
                  <p className="text-[11px] sm:text-xs text-slate-500">O‘quv choragi monitoringi</p>
                </div>
              </div>
            </div>

            {/* Hero Visual: Official 19-Class & Curriculum Architecture Preview */}
            <div className="lg:col-span-6">
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {APP_NAME} • Akademik Arxitektura
                    </p>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      19 ta Rasmiy Sinf va Yo‘nalishlar Kesimi
                    </h2>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    2026-2027 o‘quv yili
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                        A YO‘NALISHI — ANIQ FANLAR (14 ta sinf)
                      </span>
                      <span className="text-[11px] text-slate-500">Matematika • Fizika • Ingliz tili</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {OFFICIAL_A_TRACK_CLASSES.map((code) => (
                        <span
                          key={code}
                          className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono text-xs font-bold"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        T YO‘NALISHI — TABIIY FANLAR (5 ta sinf)
                      </span>
                      <span className="text-[11px] text-slate-500">Biologiya • Kimyo • Ingliz tili</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {OFFICIAL_T_TRACK_CLASSES.map((code) => (
                        <span
                          key={code}
                          className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono text-xs font-bold"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                    <p className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                      Ish rejalari → O‘quv xaritasi
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Excel, PDF, Word yoki matn ko‘rinishidagi yillik/choraklik ish rejalarini darslar ketma-ketligiga aylantiring.
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">
                      AI Buyruqlar va Diagnostika
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Tabiiy o‘zbek tilidagi buyruqlar orqali soniyalar ichida darsga mos qoralama testlar yarating.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Official 19 Classes & 5 Subjects Section */}
        <section id="sinflar" className="py-16 px-6 max-w-7xl mx-auto space-y-10">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              Sinflar va fanlar tuzilmasi
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              5 ta asosiy fan va yo‘nalishlar bo‘yicha aniq bog‘lanish
            </h2>
          </div>

          <div id="fanlar" className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {DEFAULT_SUBJECTS.map((subj) => (
              <div
                key={subj.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-mono font-bold">
                      {subj.code}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {subj.track === 'BOTH' || (subj.allowedTracks && subj.allowedTracks.length > 1)
                        ? 'A va T (19 sinf)'
                        : `${subj.track || subj.allowedTracks?.[0] || 'A'} yo‘nalishi`}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {subj.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {subj.description}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-mono text-slate-500">
                  Sinflar: {subj.applicableClassCodes?.length || subj.allowedClassCodes?.length || 0} ta
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Core Modules */}
        <section id="tizim" className="py-16 px-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto space-y-10">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                Structured Learning. Measurable Progress.
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                Ish rejasidan individual o‘zlashtirish xaritasigacha
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  1. Ish rejalari importi
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  6 bosqichli yuklash va tekshirish jarayoni orqali yillik hamda choraklik ish rejalarini darslarga aylantirish.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                <Layers className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  2. O‘quv xaritasi va Darslar
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Har bir sinf (`5a1`–`11t`) va chorak kesimida darslar, uyga vazifalar hamda o‘quv materiallarini boshqarish.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  3. AI Buyruqlar va Testlar
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Mavzu yoki dars asosida avto-tekshiriladigan va yozma (rubrikali) savollardan iborat testlarni yaratish.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-3">
                <Network className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  4. Shaxsiy Bilim Xaritasi
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Har bir o‘quvchi uchun mavzular bo‘yicha 5 darajali o‘zlashtirish statuslari va kuchli/zaif tomonlar tahlili.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};

export const AboutPage: React.FC = () => (
  <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
    <PublicHeader />
    <main className="flex-1 max-w-4xl mx-auto py-16 px-6 space-y-8">
      <div className="space-y-3">
        <p className="text-xs font-semibold text-blue-600">{APP_NAME} haqida</p>
        <h1 className="text-3xl font-bold">{APP_TAGLINE}</h1>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        <p>
          <strong>{APP_NAME}</strong> — ixtisoslashtirilgan maktabning Aniq fanlar (A yo‘nalishi: 5a1–11a2, 14 ta sinf) va Tabiiy fanlar (T yo‘nalishi: 7t–11t, 5 ta sinf) o‘quv jarayonini boshqarish hamda o‘quvchilar bilimini diagnostika qilish platformasidir.
        </p>
        <p>
          Tizim ish rejalarini darslar xaritasiga aylantirish, har bir darsga o‘quv materiallari va diagnostik testlarni biriktirish hamda o‘quvchining mavzular kesimidagi shaxsiy bilim xaritasini shakllantirishga xizmat qiladi.
        </p>
      </div>
    </main>
    <PublicFooter />
  </div>
);

export const PrivacyPage: React.FC = () => (
  <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
    <PublicHeader />
    <main className="flex-1 max-w-4xl mx-auto py-16 px-6 space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-blue-600 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>Maxfiylik va ma’lumotlar xavfsizligi</span>
        </div>
        <h1 className="text-3xl font-bold">Maxfiylik siyosati</h1>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          1. Sinf va rolga asoslangan qat’iy izolyatsiya
        </h2>
        <p>
          {APP_NAME} platformasida har bir o‘quvchi faqat o‘z sinfi (masalan, 7a1 yoki 9t) uchun nashr qilingan darslar va testlarni hamda faqat o‘zining shaxsiy natijalarini ko‘ra oladi.
        </p>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          2. Sun’iy intellekt maxfiyligi
        </h2>
        <p>
          Test natijalarini AI orqali tahlil qilishda o‘quvchining shaxsiy ma’lumotlari uzatilmaydi; faqat anonim savol va mavzu ko‘rsatkichlari tahlil qilinadi.
        </p>
      </div>
    </main>
    <PublicFooter />
  </div>
);

export const TermsPage: React.FC = () => (
  <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
    <PublicHeader />
    <main className="flex-1 max-w-4xl mx-auto py-16 px-6 space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-blue-600">Qoidalar va majburiyatlar</p>
        <h1 className="text-3xl font-bold">Foydalanish shartlari</h1>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        <p>
          1. {APP_NAME} platformasidagi barcha o‘quv rejalari, darslar va AI yordamida yaratilgan test qoralamalari tekshiruvdan so‘ng o‘quvchilarga nashr etiladi.
        </p>
        <p>
          2. O‘quvchilar tizimga faqat biriktirilgan sinf va taklif kodi yoki tasdiqlangan hisob orqali kiradilar.
        </p>
      </div>
    </main>
    <PublicFooter />
  </div>
);
