import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LearnOSProvider, useLearnOS } from './context/LearnOSContext';
import { AppShell, ToastContainer } from './components/AppShell';
const LandingPage = lazy(() => import('./pages/PublicPages').then(module => ({ default: module.LandingPage })));
const AboutPage = lazy(() => import('./pages/PublicPages').then(module => ({ default: module.AboutPage })));
const PrivacyPage = lazy(() => import('./pages/PublicPages').then(module => ({ default: module.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/PublicPages').then(module => ({ default: module.TermsPage })));
const LoginPage = lazy(() => import('./pages/AuthPages').then(module => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./pages/AuthPages').then(module => ({ default: module.RegisterPage })));
const TopicAnalysisCenter=lazy(()=>import('./components/TopicAnalysisCenter').then(m=>({default:m.TopicAnalysisCenter})));
const StudentDashboardPage = lazy(() => import('./components/StudentHome').then(module => ({ default: module.StudentHome })));
const StudentLessonsPage = lazy(() => import('./pages/StudentPages').then(module => ({ default: module.StudentLessonsPage })));
const StudentAssessmentsPage = lazy(() => import('./pages/StudentPages').then(module => ({ default: module.StudentAssessmentsPage })));
const AssessmentRunnerPage = lazy(() => import('./pages/StudentPages').then(module => ({ default: module.AssessmentRunnerPage })));
const AssessmentResultPage = lazy(() => import('./pages/StudentPages').then(module => ({ default: module.AssessmentResultPage })));
const KnowledgeMapPage = lazy(() => import('./pages/StudentPages').then(module => ({ default: module.KnowledgeMapPage })));
const LearningPathPage = lazy(() => import('./pages/StudentPages').then(module => ({ default: module.LearningPathPage })));
const StudentProgressPage = lazy(() => import('./pages/StudentPages').then(module => ({ default: module.StudentProgressPage })));
const StudentProfilePage = lazy(() => import('./pages/StudentPages').then(module => ({ default: module.StudentProfilePage })));
const AdminTimetablePage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminTimetablePage })));
const AdminAssignmentsPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminAssignmentsPage })));
const AdminMaterialsLibraryPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminMaterialsLibraryPage })));
const AdminAnnouncementsPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminAnnouncementsPage })));
const AdminAcademicCalendarPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminAcademicCalendarPage })));
const AdminDashboardPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminDashboardPage })));
const AdminClassesPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminClassesPage })));
const AdminStudentsPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminStudentsPage })));
const AdminSmartGradingPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminSmartGradingPage })));
const AdminAttendancePage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminAttendancePage })));
const AdminAlertsPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminAlertsPage })));
const AdminSupportPlansPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminSupportPlansPage })));
const AdminSubjectsPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminSubjectsPage })));
const AdminWorkPlansPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminWorkPlansPage })));
const AdminCurriculumMapPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminCurriculumMapPage })));
const AdminAssessmentsPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminAssessmentsPage })));
const AdminResultsPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminResultsPage })));
const AdminSettingsPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminSettingsPage })));
const AdminInstitutionPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminInstitutionPage })));
const AdminUsersDirectoryPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminUsersDirectoryPage })));
const AdminInvitationsPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminInvitationsPage })));
const AdminAIIntelligencePage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminAIIntelligencePage })));
const AdminAnalyticsPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminAnalyticsPage })));
const AdminReportsPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminReportsPage })));
const AdminNotificationsPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminNotificationsPage })));
const AdminAuditLogsPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminAuditLogsPage })));
const AdminHelpDocsPage = lazy(() => import('./pages/ParentAndAdminPages').then(module => ({ default: module.AdminHelpDocsPage })));

const DemoPanel=lazy(()=>import('./components/DemoPanel').then(m=>({default:m.DemoPanel})));
const ContentCenter=lazy(()=>import('./components/ContentCenter').then(m=>({default:m.ContentCenter})));
const StudentTaskHub=lazy(()=>import('./components/StudentHome').then(m=>({default:m.StudentTaskHub})));
const AccountsCenter=lazy(()=>import('./components/AccountsCenter').then(m=>({default:m.AccountsCenter})));
const AccountSecurity=lazy(()=>import('./components/AccountsCenter').then(m=>({default:m.AccountSecurity})));
const LearningDemoCenter=lazy(()=>import('./components/LearningDemoCenter').then(m=>({default:m.LearningDemoCenter})));
const TopicGradingCenter=lazy(()=>import('./components/TopicGradingCenter').then(m=>({default:m.TopicGradingCenter})));
const TopicBankCenter=lazy(()=>import('./components/TopicBankCenter').then(m=>({default:m.TopicBankCenter})));
const TopicTestsPage=lazy(()=>import('./components/TopicStudyPages').then(m=>({default:m.TopicTestsPage})));
const TopicSessionPage=lazy(()=>import('./components/TopicStudyPages').then(m=>({default:m.TopicSessionPage})));
const ReviewDashboard=lazy(()=>import('./components/SpacedReviewPages').then(m=>({default:m.ReviewDashboard})));
const MistakeNotebook=lazy(()=>import('./components/SpacedReviewPages').then(m=>({default:m.MistakeNotebook})));
const TopicProgressMap=lazy(()=>import('./components/SpacedReviewPages').then(m=>({default:m.TopicProgressMap})));
const ReviewSessionPage=lazy(()=>import('./components/SpacedReviewPages').then(m=>({default:m.ReviewSessionPage})));
const HelpPage=lazy(()=>import('./components/HelpPages').then(m=>({default:m.HelpPage})));
const MissingPage=lazy(()=>import('./components/HelpPages').then(m=>({default:m.MissingPage})));
const TeachingPanel = lazy(() => import('./components/TeachingPanel').then(m=>({default:m.TeachingPanel})));
// Navigation guard only. Every API endpoint must independently authorize requests.
const ProtectedRoute: React.FC<{ allowedRole: 'admin' | 'student' | 'teacher'; children: React.ReactNode }> = ({ allowedRole, children }) => {
  const { currentUser, authReady, isPlatformOwner } = useLearnOS();
  if (!authReady) return <main className="min-h-screen grid place-items-center bg-slate-50 text-slate-600" role="status" aria-live="polite">Hisob tekshirilmoqda…</main>;
  if (!currentUser) return <Navigate to="/login" replace />;
  if(currentUser.mustChangePassword)return <Navigate to="/account/security" replace/>;
  if (currentUser.status !== 'active') return <Navigate to="/login" replace />;
  if (allowedRole === 'admin' && !isPlatformOwner) return <Navigate to={currentUser.role === 'student' ? '/student/dashboard' : '/login'} replace />;
  if (allowedRole === 'student' && currentUser.role !== 'student') return <Navigate to={isPlatformOwner ? '/admin/dashboard' : '/login'} replace />;
  if (allowedRole==='teacher'&&currentUser.role!=='teacher')return <Navigate to="/login" replace/>;
  return <AppShell>{children}</AppShell>;
};

function SecurityRoute(){const {currentUser,authReady}=useLearnOS();if(!authReady)return <p role="status">Hisob tekshirilmoqda…</p>;return currentUser?<AppShell><AccountSecurity/></AppShell>:<Navigate to="/login" replace/>;}
export default function App() {
  return (
    <LearnOSProvider>
      <BrowserRouter>
        <Suspense fallback={<main className="min-h-[60vh] grid place-items-center text-slate-500" role="status">Sahifa yuklanmoqda…</main>}>
        <Routes>
          <Route path="/account/security" element={<SecurityRoute/>}/><Route path="/admin/accounts" element={<ProtectedRoute allowedRole="admin"><AccountsCenter/></ProtectedRoute>}/><Route path="/help" element={<HelpPage/>}/>{/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          <Route path="/admin/learning-demo" element={<ProtectedRoute allowedRole="admin"><LearningDemoCenter/></ProtectedRoute>}/><Route path="/admin/topic-review" element={<ProtectedRoute allowedRole="admin"><TopicGradingCenter/></ProtectedRoute>}/><Route path="/teacher/topic-review" element={<ProtectedRoute allowedRole="teacher"><TopicGradingCenter/></ProtectedRoute>}/><Route path="/teacher/topic-bank" element={<ProtectedRoute allowedRole="teacher"><TopicBankCenter/></ProtectedRoute>}/><Route path="/admin/topic-bank" element={<ProtectedRoute allowedRole="admin"><TopicBankCenter/></ProtectedRoute>}/><Route path="/student/topic-tests" element={<ProtectedRoute allowedRole="student"><TopicTestsPage/></ProtectedRoute>}/><Route path="/student/topic-session/:id" element={<ProtectedRoute allowedRole="student"><TopicSessionPage/></ProtectedRoute>}/><Route path="/student/review" element={<ProtectedRoute allowedRole="student"><ReviewDashboard/></ProtectedRoute>}/><Route path="/student/mistakes" element={<ProtectedRoute allowedRole="student"><MistakeNotebook/></ProtectedRoute>}/><Route path="/student/topic-progress" element={<ProtectedRoute allowedRole="student"><TopicProgressMap/></ProtectedRoute>}/><Route path="/student/review-session/:id" element={<ProtectedRoute allowedRole="student"><ReviewSessionPage/></ProtectedRoute>}/><Route path="/teacher/topic-analysis" element={<ProtectedRoute allowedRole="teacher"><TopicAnalysisCenter/></ProtectedRoute>}/><Route path="/admin/topic-analysis" element={<ProtectedRoute allowedRole="admin"><TopicAnalysisCenter/></ProtectedRoute>}/>{/* Student Routes */}
          <Route path="/admin/demo" element={<ProtectedRoute allowedRole="admin"><DemoPanel/></ProtectedRoute>}/>
          <Route path="/teacher/demo" element={<ProtectedRoute allowedRole="teacher"><DemoPanel/></ProtectedRoute>}/>
          <Route path="/student/demo" element={<ProtectedRoute allowedRole="student"><DemoPanel/></ProtectedRoute>}/>
          <Route path="/student/tasks" element={<ProtectedRoute allowedRole="student"><StudentTaskHub/></ProtectedRoute>}/>
          <Route path="/admin/content" element={<ProtectedRoute allowedRole="admin"><ContentCenter/></ProtectedRoute>}/>
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute allowedRole="student">
                <StudentDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/timetable"
            element={
              <ProtectedRoute allowedRole="student">
                <AdminTimetablePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/assignments"
            element={
              <ProtectedRoute allowedRole="student">
                <AdminAssignmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/materials"
            element={
              <ProtectedRoute allowedRole="student">
                <AdminMaterialsLibraryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/announcements"
            element={
              <ProtectedRoute allowedRole="student">
                <AdminAnnouncementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/calendar"
            element={
              <ProtectedRoute allowedRole="student">
                <AdminAcademicCalendarPage />
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
          <Route path="/teacher/*" element={<ProtectedRoute allowedRole="teacher"><TeachingPanel/></ProtectedRoute>} />
          <Route path="/admin/teachers" element={<ProtectedRoute allowedRole="admin"><TeachingPanel admin/></ProtectedRoute>} />
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
            path="/admin/timetable"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminTimetablePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/assignments"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminAssignmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/announcements"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminAnnouncementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/materials"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminMaterialsLibraryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/grading"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminSmartGradingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/calendar"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminAcademicCalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/attendance"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminAttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/alerts"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminAlertsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/support-plans"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminSupportPlansPage />
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
          <Route path="*" element={<MissingPage/>}/>
        </Routes>
        </Suspense>
        <ToastContainer />
      </BrowserRouter>
    </LearnOSProvider>
  );
}
