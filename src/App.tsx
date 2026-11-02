import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LearnOSProvider, useLearnOS } from './context/LearnOSContext';
import { AppShell, ToastContainer } from './components/AppShell';
import {
  LandingPage,
  AboutPage,
  PrivacyPage,
  TermsPage,
} from './pages/PublicPages';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import {
  StudentDashboardPage,
  StudentLessonsPage,
  StudentAssessmentsPage,
  AssessmentRunnerPage,
  AssessmentResultPage,
  KnowledgeMapPage,
  LearningPathPage,
  StudentProgressPage,
  StudentProfilePage,
} from './pages/StudentPages';
import {
  AdminDashboardPage,
  AdminInstitutionPage,
  AdminUsersDirectoryPage,
  AdminStudentsPage,
  AdminClassesPage,
  AdminInvitationsPage,
  AdminSubjectsPage,
  AdminWorkPlansPage,
  AdminCurriculumMapPage,
  AdminAssessmentsPage,
  AdminResultsPage,
  AdminAIIntelligencePage,
  AdminAnalyticsPage,
  AdminReportsPage,
  AdminNotificationsPage,
  AdminAuditLogsPage,
  AdminSettingsPage,
  AdminHelpDocsPage,
} from './pages/ParentAndAdminPages';
import { UserRole } from './types';
import { isAuthorizedAdminEmail } from './utils/security';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';

const ProtectedRoute: React.FC<{
  allowedRole: UserRole;
  children: React.ReactNode;
}> = ({ allowedRole, children }) => {
  const { currentUser, isPlatformOwner, authReady, logout } = useLearnOS();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-3 text-sm font-medium">
          <div className="w-5 h-5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          <span>Specialized Study yuklanmoqda...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Exclusive Authorized Platform Access on /admin/*
  if (allowedRole === 'admin') {
    const isAdminAllowed =
      isPlatformOwner ||
      (isAuthorizedAdminEmail(currentUser.email) &&
        currentUser.emailVerified !== false &&
        (currentUser.role === 'admin' || currentUser.role === 'platform_owner'));

    if (!isAdminAllowed) {
      const fallbackWorkspace =
        currentUser.role === 'student' ? '/student/dashboard' : '/';

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-8 shadow-sm text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <span className="inline-block px-2.5 py-1 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-bold uppercase tracking-wider">
                403 — Kirish cheklangan
              </span>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Ushbu bo‘limga kirish ruxsati yo‘q
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Ushbu bo‘limga faqat vakolatli platforma boshqaruvchilari kira oladi. Sizning joriy hisobingiz:{' '}
                <strong className="text-slate-900 dark:text-slate-200">{currentUser.email}</strong>.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href={fallbackWorkspace}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                O‘z ishchi oynangizga qaytish
              </a>
              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Hisobdan chiqish
              </button>
            </div>
          </div>
        </div>
      );
    }

    return <AppShell>{children}</AppShell>;
  }

  const isRoleMatch = currentUser.role === allowedRole || isPlatformOwner;

  if (!isRoleMatch) {
    const redirectPath = isPlatformOwner
      ? '/admin/dashboard'
      : currentUser.role === 'student'
      ? '/student/dashboard'
      : '/login';
    return <Navigate to={redirectPath} replace />;
  }

  return <AppShell>{children}</AppShell>;
};

export default function App() {
  return (
    <LearnOSProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          {/* Student Routes (6 Primary Workspace Items) */}
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/lessons"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentLessonsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/assessments"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentAssessmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/assessments/:id"
            element={
              <ProtectedRoute allowedRole="student">
                <AssessmentRunnerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/knowledge-map"
            element={
              <ProtectedRoute allowedRole="student">
                <KnowledgeMapPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/results"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentProgressPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/results/:id"
            element={
              <ProtectedRoute allowedRole="student">
                <AssessmentResultPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/progress"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentProgressPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/learning-path"
            element={
              <ProtectedRoute allowedRole="student">
                <LearningPathPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/profile"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Legacy Teacher & Parent Routes Safely Redirected */}
          <Route path="/teacher/*" element={<Navigate to="/login" replace />} />
          <Route path="/parent/*" element={<Navigate to="/login" replace />} />

          {/* Specialized Study Admin Control Center Routes (/admin/*) */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/overview"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/classes"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminClassesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/academic"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminClassesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/students"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminStudentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/subjects"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminSubjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/work-plans"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminWorkPlansPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/lessons"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminCurriculumMapPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/curriculum-map"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminCurriculumMapPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/assessments"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminAssessmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/results"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminResultsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminSettingsPage />
              </ProtectedRoute>
            }
          />

          {/* Supporting Admin Routes */}
          <Route
            path="/admin/institution"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminInstitutionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/institutions"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminInstitutionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminUsersDirectoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/invitations"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminInvitationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ai-intelligence"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminAIIntelligencePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminAnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/notifications"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminNotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminAuditLogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/help"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminHelpDocsPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </LearnOSProvider>
  );
}
