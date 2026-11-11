import {PanelNavigation,ProfileMenu} from './PanelNavigation';
import {useRouteScroll} from '../utils/useRouteScroll';
import React, {Suspense, useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  BarChart3,
  Users,
  Bell,
  Sun,
  Moon,
  LogOut,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Info,
  X,
  Settings,
  Layers,
  Menu,
  Compass,
  FileSpreadsheet,
  Search,
  Sparkles,
  ArrowRight,
  Plus,
  Upload,
  User as UserIcon,
  CalendarCheck,
  FileText,
  AlertTriangle,
  HeartHandshake,
  Calendar,
  Megaphone,
  Library,
  Award,
} from 'lucide-react';
import { useLearnOS } from '../context/LearnOSContext';
import { AICommandExecutionResult, GlobalSearchResultItem } from '../types';
import { OFFICIAL_19_CLASS_CODES } from '../constants/curriculum';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentUser,
    theme,
    toggleTheme,
    logout,
    notifications,
    markNotificationRead,
    toasts,
    removeToast,
    searchGlobal,
    executeAICommand,
  } = useLearnOS();

  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResultItem[]>([]);
  const [searchError,setSearchError]=useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [aiResult, setAiResult] = useState<AICommandExecutionResult | null>(null);
  const [isExecutingAI, setIsExecutingAI] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const viewportRef=useRef<HTMLElement|null>(null);
  useRouteScroll(viewportRef,`${currentUser?.uid}:${location.pathname}`);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Ctrl+K / Cmd+K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      } else if (e.key === 'Escape' && commandOpen) {
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandOpen]);

  useEffect(() => {
    if (commandOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 40);
    } else {
      setCommandQuery('');
      setSearchResults([]);
      setAiResult(null);
    }
  }, [commandOpen]);

  // Debounced global search
  useEffect(() => {
    if (!commandOpen) return;
    const trimmed = commandQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setSearchError('');
    setIsSearching(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await searchGlobal(trimmed);
        if (!cancelled) setSearchResults(res);
      } catch {if(!cancelled){setSearchResults([]);setSearchError('Qidiruv bajarilmadi. Qayta urinib ko‘ring.');}} finally {
        setIsSearching(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [commandQuery, commandOpen, searchGlobal]);

  if (!currentUser) {
    return <>{children}</>;
  }

  const myNotifications = notifications.filter((n) => n.recipientUid === currentUser.uid);
  const unreadCount = myNotifications.filter((n) => !n.read).length;

  const isAdminAccount =
    currentUser.role === 'admin' || currentUser.role === 'platform_owner';

  const isActiveTestRunner = /^\/student\/assessments\/[^/]+$/.test(location.pathname);

  const navItems = isAdminAccount
    ? [
        { to: '/admin/dashboard', label: 'Bosh sahifa', icon: LayoutDashboard, end: true },
        {to:'/admin/demo',label:'DEMO sinf',icon:GraduationCap},
        { to: '/admin/content', label: 'Kontent markazi', icon: FileSpreadsheet },
        {to:'/admin/accounts',label:'Hisoblar',icon:Users},
        { to: '/admin/classes', label: 'Sinflar', icon: Users },
        { to: '/admin/teachers', label: 'O‘qituvchilar', icon: Users },
        { to: '/admin/students', label: "O'quvchilar", icon: GraduationCap },
        { to: '/admin/timetable', label: 'Jadval', icon: Calendar },
        { to: '/admin/assignments', label: 'Topshiriqlar', icon: FileText },
        { to: '/admin/announcements', label: "E'lonlar", icon: Megaphone },
        { to: '/admin/materials', label: 'Materiallar', icon: Library },
        { to: '/admin/grading', label: 'Tekshiruv', icon: Award },
        { to: '/admin/calendar', label: 'Kalendar', icon: CalendarCheck },
        { to: '/admin/attendance', label: 'Davomat', icon: CalendarCheck },
        { to: '/admin/subjects', label: 'Fanlar', icon: Layers },
        { to: '/admin/work-plans', label: 'Ish rejalari', icon: FileSpreadsheet },
        { to: '/admin/lessons', label: 'Darslar', icon: BookOpen },
        { to: '/admin/curriculum-map', label: "O'quv xaritasi", icon: Compass },
        {to:'/admin/learning-demo',label:'O‘quv tsikli DEMO',icon:ClipboardCheck},{to:'/admin/topic-bank',label:'Mavzu testlari',icon:ClipboardCheck},{to:'/admin/topic-review',label:'Mavzu yozma tekshiruv',icon:FileText},
        { to: '/admin/assessments', label: 'Testlar', icon: ClipboardCheck },
        { to: '/admin/results', label: 'Natijalar', icon: BarChart3 },
        { to: '/admin/reports', label: 'Hisobotlar', icon: FileSpreadsheet },
        { to: '/admin/alerts', label: 'Ogohlantirishlar', icon: AlertTriangle },
        { to: '/admin/support-plans', label: 'Yordam rejalari', icon: HeartHandshake },
        { to: '/admin/settings', label: 'Sozlamalar', icon: Settings },
      ]
    : currentUser.role==='teacher'?[{to:'/teacher/dashboard',label:'Mening sinflarim',icon:Users,end:true},{to:'/teacher/topic-bank',label:'Mavzu testlari',icon:ClipboardCheck},{to:'/teacher/topic-review',label:'Yozma tekshiruv',icon:FileText},{to:'/teacher/demo',label:'DEMO tekshiruv',icon:ClipboardCheck}]:[
        {to:'/student/dashboard',label:'Bosh sahifa',icon:LayoutDashboard,end:true},
        {to:'/student/lessons',label:'Fanlar',icon:BookOpen},
        {to:'/student/timetable',label:'Jadval',icon:Calendar},
        {to:'/student/tasks',label:'Vazifalar',icon:ClipboardCheck},
        {to:'/student/knowledge-map',label:'Ko‘proq',icon:UserIcon},
      ];
  const studentMobileBottomItems=navItems;

  // Mobile drawer items (for Students includes secondary actions like Natijalar & Profil)
  const mobileDrawerItems = (isAdminAccount || currentUser.role==='teacher')
    ? navItems
    : [
        ...navItems,
      ];

  // Clean section title for header
  const resolveSectionTitle = (): string => {
    const p = location.pathname;
    if (p === '/admin' || p === '/admin/dashboard' || p === '/student' || p === '/student/dashboard') {
      return 'Bosh sahifa';
    }
    if (p.startsWith('/admin/content')) return 'Kontent markazi';
    if (p.startsWith('/student/tasks')) return 'Vazifalar';
    if (p.startsWith('/admin/classes')) return 'Sinflar';
      if (p.startsWith('/admin/teachers')) return 'O‘qituvchilar';
      if (p.startsWith('/teacher/')) return 'O‘qituvchi kabineti';
    if (p.startsWith('/admin/students')) return "O'quvchilar";
    if (p.startsWith('/admin/subjects')) return 'Fanlar';
    if (p.startsWith('/admin/work-plans')) return 'Ish rejalari';
    if (p.startsWith('/admin/curriculum-map')) return "O'quv xaritasi";
    if (p.startsWith('/admin/lessons')) return 'Darslar';
    if (p.startsWith('/admin/assessments') || p.startsWith('/admin/questions') || p.startsWith('/admin/import')) return 'Testlar';
    if (p.startsWith('/admin/results') || p.startsWith('/admin/analytics')) return 'Natijalar';
    if (p.startsWith('/admin/settings') || p.startsWith('/admin/ai-commands')) return 'Sozlamalar';
    if (p.startsWith('/student/learning-path')) return "O'quv xaritasi";
    if (p.startsWith('/student/lessons')) return 'Darslar';
    if (p.startsWith('/student/assessments')) return 'Testlar';
    if (p.startsWith('/student/knowledge-map') || p.startsWith('/student/map')) return "O'quv xaritasi";
    if (p.startsWith('/student/results') || p.startsWith('/student/progress')) return 'Natijalar';
    if (p.startsWith('/admin/timetable') || p.startsWith('/student/timetable')) return 'Jadval';
    if (p.startsWith('/admin/assignments') || p.startsWith('/student/assignments')) return 'Topshiriqlar';
    if (p.startsWith('/admin/announcements') || p.startsWith('/student/announcements')) return "E'lonlar";
    if (p.startsWith('/admin/materials') || p.startsWith('/student/materials')) return 'Materiallar';
    if (p.startsWith('/admin/grading')) return 'Tekshiruv (Smart Grading)';
    if (p.startsWith('/admin/calendar') || p.startsWith('/student/calendar')) return 'Akademik Kalendar';
    if (p.startsWith('/admin/reports')) return 'Hisobotlar';
    if (p.startsWith('/admin/attendance')) return 'Davomat';
    if (p.startsWith('/admin/alerts')) return 'Ogohlantirishlar';
    if (p.startsWith('/admin/support-plans')) return 'Yordam rejalari';
    if (p.startsWith('/student/profile')) return 'Profil';
    return 'Bosh sahifa';
  };

  const quickActions = isAdminAccount
    ? [
        {
          id: 'qa-add-student',
          label: "O'quvchi qo'shish",
          hint: "O'quvchilar",
          icon: Plus,
          onSelect: () => {
            setCommandOpen(false);
            navigate('/admin/students?action=add');
          },
        },
        {
          id: 'qa-import-excel',
          label: 'Excel yuklash',
          hint: "O'quvchilar ro'yxatini yuklash",
          icon: Upload,
          onSelect: () => {
            setCommandOpen(false);
            navigate('/admin/students?action=import');
          },
        },
        {
          id: 'qa-upload-workplan',
          label: 'Ish rejasi yuklash',
          hint: 'Ish rejalari',
          icon: FileSpreadsheet,
          onSelect: () => {
            setCommandOpen(false);
            navigate('/admin/work-plans');
          },
        },
        {
          id: 'qa-create-test',
          label: 'Test yaratish',
          hint: 'Testlar',
          icon: ClipboardCheck,
          onSelect: () => {
            setCommandOpen(false);
            navigate('/admin/assessments?action=create');
          },
        },
      ]
    : [];

  const handleRunAICommand = async (cmdText?: string) => {
    const textToRun = (cmdText || commandQuery).trim();
    if (!textToRun || !isAdminAccount) return;
    setIsExecutingAI(true);
    try {
      const res = await executeAICommand(textToRun);
      setAiResult(res);
    } finally {
      setIsExecutingAI(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 transition-colors overflow-x-clip">
      {/* Desktop Sidebar — Clean Linear/Notion style */}
      <aside data-shell-sidebar className="w-60 shrink-0 border-r border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0F1623] hidden lg:flex flex-col sticky top-0 h-dvh self-start">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="h-14 shrink-0 px-5 flex items-center gap-2.5 border-b border-slate-200/70 dark:border-slate-800/70">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-xs tracking-tight shadow-xs">
              SS
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
              SPECIALIZED STUDY
            </span>
          </div>

          <nav className="min-h-0 overflow-y-auto p-2.5 space-y-0.5">
            <PanelNavigation items={navItems} grouped={currentUser.role!=='student'}/>
          </nav>
        </div>

      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside data-shell-sidebar className="relative w-72 max-w-[84vw] bg-white dark:bg-[#0F1623] h-full flex flex-col justify-between z-10 shadow-xl">
            <div>
              <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                    SS
                  </div>
                  <span className="font-bold text-sm tracking-tight truncate">
                    SPECIALIZED STUDY
                  </span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Menyuni yopish"
                  className="w-9 h-9 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="p-2.5 space-y-1 overflow-y-auto max-h-[calc(100dvh-56px)]">
                <PanelNavigation items={mobileDrawerItems} grouped={currentUser.role!=='student'}/>
              </nav>
            </div>

          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Minimalist Top Header — Displays ONLY current section + Quick Command Search */}
        <header data-shell-header className="h-14 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#0F1623]/95 backdrop-blur-md px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Menyuni ochish"
              className="lg:hidden w-11 h-11 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h1 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white tracking-tight truncate">
              {resolveSectionTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Admin Mobile Quick Action Button (+) */}
            {isAdminAccount && (
              <button
                onClick={() => setCommandOpen(true)}
                aria-label="Tezkor amal qo'shish"
                className="sm:hidden w-11 h-11 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}

            {/* Quick Command Palette Trigger (Ctrl+K / Cmd+K) */}
            <button
              onClick={() => setCommandOpen(true)}
              aria-label="Qidiruv"
              className="min-h-[44px] flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs transition-colors cursor-pointer"
              title="Tezkor qidiruv va buyruqlar (Ctrl+K)"
            >
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="hidden sm:inline">Qidiruv...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-500">
                Ctrl+K
              </kbd>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label="Bildirishnomalar"
                className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 relative cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg p-3 z-50">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-xs">Bildirishnomalar</span>
                    <span className="text-[11px] text-slate-400">{myNotifications.length} ta</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1.5">
                    {myNotifications.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">
                        Bildirishnomalar yo‘q
                      </p>
                    ) : (
                      myNotifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markNotificationRead(n.id)}
                          className={`p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                            n.read
                              ? 'border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20 text-slate-500'
                              : 'border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="font-semibold">{n.title}</div>
                          <div className="text-[11px] opacity-80 mt-0.5">{n.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <ProfileMenu/>
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-11 h-11 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Rang rejimini almashtirish"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Page Viewport */}
        <main ref={viewportRef}
          className={`flex-1 p-3.5 sm:p-5 lg:p-6 max-w-7xl w-full mx-auto min-w-0 ss-page-enter ${
            currentUser.role==='student' && !isActiveTestRunner ? 'pb-24 lg:pb-6' : 'pb-8 lg:pb-6'
          }`}
        >
          <Suspense fallback={<div role="status" className="ss-surface p-6 animate-pulse">Sahifa yuklanmoqda…</div>}>{children}</Suspense>
        </main>

        {/* Student Mobile Bottom Navigation Bar (< 1024px) */}
        {currentUser.role==='student' && !isActiveTestRunner && (
          <nav
            aria-label="O'quvchi mobil navigatsiyasi"
            className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0F1623]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800/90 pb-safe"
          >
            <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1">
              {studentMobileBottomItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex flex-col items-center justify-center gap-1 min-h-[48px] px-1 rounded-lg transition-colors ${
                        isActive
                          ? 'text-blue-600 dark:text-blue-400 font-semibold'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="text-[11px] leading-none truncate max-w-full">
                      {item.label}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </nav>
        )}
      </div>

      {/* Universal Command Palette (Ctrl+K / Cmd+K) — Section 09 & 11 */}
      {commandOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setCommandOpen(false)}
          />
          <div className="relative w-full max-w-xl rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-10">
            {/* Input Bar */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={commandQuery}
                onChange={(e) => {
                  setCommandQuery(e.target.value);
                  setAiResult(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && commandQuery.trim().length > 8 && isAdminAccount) {
                    handleRunAICommand();
                  }
                }}
                placeholder="Sinf (7a1), o'quvchi, fan, dars yoki buyruq yozing..."
                className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
              />
              {commandQuery && (
                <button
                  onClick={() => {
                    setCommandQuery('');
                    setAiResult(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setCommandOpen(false)}
                className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ESC
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-2 space-y-3">
              {/* Natural Language AI Command Runner (Admin) */}
              {isAdminAccount && commandQuery.trim().length >= 4 && (
                <div className="px-2 pt-1">
                  <button
                    onClick={() => handleRunAICommand()}
                    disabled={isExecutingAI}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-900/60 text-left hover:bg-blue-100/70 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <div className="truncate">
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                          Buyruqni bajarish:{' '}
                        </span>
                        <span className="text-xs text-slate-700 dark:text-slate-300">
                          "{commandQuery.trim()}"
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 shrink-0">
                      {isExecutingAI ? 'Bajarilmoqda...' : 'Enter ↵'}
                    </span>
                  </button>
                </div>
              )}

              {/* AI Command Result Box */}
              {aiResult && (
                <div className="mx-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {aiResult.message}
                    </span>
                    {aiResult.matchedClass && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                        {aiResult.matchedClass.code.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {aiResult.generatedAssessment && (
                    <button
                      onClick={() => {
                        setCommandOpen(false);
                        navigate('/admin/assessments');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      <span>Yaratilgan test qoralamasini ochish</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {(aiResult.intent === 'show_class_students' ||
                    aiResult.intent === 'sort_class_students') &&
                    aiResult.matchedClass && (
                      <button
                        onClick={() => {
                          const code = aiResult.matchedClass!.code;
                          setCommandOpen(false);
                          navigate(`/admin/students?class=${code}`);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                      >
                        <span>
                          {aiResult.matchedClass.code.toUpperCase()} o'quvchilar ro'yxatiga o'tish
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  {aiResult.intent === 'show_upcoming_lessons' && aiResult.matchedClass && (
                    <button
                      onClick={() => {
                        const code = aiResult.matchedClass!.code;
                        setCommandOpen(false);
                        navigate(`/admin/lessons?class=${code}`);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      <span>{aiResult.matchedClass.code.toUpperCase()} darslariga o'tish</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Search Results */}
              {commandQuery.trim().length > 0 && (
                <div className="px-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1">
                    {searchError|| (isSearching ? 'Qidirilmoqda...' : `Natijalar (${searchResults.length})`)}
                  </div>
                  {searchResults.length === 0 && !isSearching ? (
                    <p className="text-xs text-slate-400 px-2 py-3">
                      Mos yozuv topilmadi. Yuqoridagi tugma orqali buyruq sifatida ishga tushirishingiz mumkin.
                    </p>
                  ) : (
                    <div className="space-y-0.5">
                      {searchResults.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setCommandOpen(false);
                            navigate(item.route);
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {item.subtitle}
                            </div>
                          </div>
                          {item.badge && (
                            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Default Quick Actions & Navigation when query is empty */}
              {commandQuery.trim().length === 0 && (
                <>
                  {quickActions.length > 0 && (
                    <div className="px-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1">
                        Tezkor amallar
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {quickActions.map((qa) => {
                          const Icon = qa.icon;
                          return (
                            <button
                              key={qa.id}
                              onClick={qa.onSelect}
                              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors cursor-pointer"
                            >
                              <div className="w-7 h-7 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {qa.label}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate">{qa.hint}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {isAdminAccount && (
                    <div className="px-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                        19 ta sinfga tezkor o'tish
                      </div>
                      <div className="flex flex-wrap gap-1 px-2">
                        {OFFICIAL_19_CLASS_CODES.map((code) => (
                          <button
                            key={code}
                            onClick={() => {
                              setCommandOpen(false);
                              navigate(`/admin/students?class=${code}`);
                            }}
                            className="px-2 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                          >
                            {code}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="px-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-1">
                      Bo'limlar
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                      {navItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.to}
                            onClick={() => {
                              setCommandOpen(false);
                              navigate(item.to);
                            }}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            <Icon className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useLearnOS();
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 right-3 left-3 sm:left-auto sm:right-4 z-50 flex flex-col gap-2 sm:max-w-sm sm:w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-lg border shadow-md backdrop-blur-md transition-all ${
            t.type === 'success'
              ? 'bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
              : t.type === 'error'
                ? 'bg-rose-50/95 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100'
                : 'bg-blue-50/95 dark:bg-blue-950/90 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100'
          }`}
        >
          {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
          {t.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
          {t.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
          <div className="flex-1 text-xs">
            <div className="font-semibold">{t.title}</div>
            {t.description && <div className="opacity-85 mt-0.5">{t.description}</div>}
          </div>
          <button
            onClick={() => removeToast(t.id)}
            aria-label="Yopish"
            className="opacity-60 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

