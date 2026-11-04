import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  Calendar,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Activity,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
  ArrowUpRight,
  Check,
  X,
  Target,
  Plus,
} from 'lucide-react';
import { useLearnOS } from '../context/LearnOSContext';
import {
  UserProfile,
  AttendanceRecord,
  AttendanceSummaryStats,
  StudentAssignment,
  AssignmentSubmission,
  StudentSupportPlan,
  StudentAcademicMetrics,
  TopicEvidenceRecord,
  LearningEvidenceLevel,
} from '../types';
import { calculateAttendanceStats } from '../utils/studentMonitoringEngine';

export type StudentIntelligenceTab =
  | 'overview'
  | 'attendance'
  | 'results'
  | 'assessments'
  | 'curriculum'
  | 'assignments'
  | 'activity'
  | 'support_plans';

interface StudentIntelligenceViewProps {
  studentId: string;
  onClose?: () => void;
  isModal?: boolean;
}

export const StudentIntelligenceView: React.FC<StudentIntelligenceViewProps> = ({
  studentId,
  onClose,
  isModal = false,
}) => {
  const {
    users,
    classes,
    attempts,
    assessments,
    topics,
    lessons,
    attendanceRecords,
    studentAssignments,
    assignmentSubmissions,
    studentSupportPlans,
    learningActivityEvents,
    fetchStudentIntelligence,
    createSupportPlan,
    updateSupportPlan,
  } = useLearnOS();

  const [activeTab, setActiveTab] = useState<StudentIntelligenceTab>('overview');
  const [metrics, setMetrics] = useState<StudentAcademicMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showNewPlanModal, setShowNewPlanModal] = useState<boolean>(false);

  // New Support Plan Form state
  const [planSubject, setPlanSubject] = useState('Matematika');
  const [planTopic, setPlanTopic] = useState('');
  const [planObservedNeed, setPlanObservedNeed] = useState('');
  const [planGoal, setPlanGoal] = useState('');
  const [planActivity, setPlanActivity] = useState('');
  const [planReviewDate, setPlanReviewDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  );

  const student = useMemo(
    () => users.find((u) => u.uid === studentId),
    [users, studentId]
  );

  const studentClass = useMemo(
    () => classes.find((c) => c.id === student?.classId || c.code === student?.classCode),
    [classes, student]
  );

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchStudentIntelligence(studentId)
      .then((data) => {
        if (isMounted) setMetrics(data);
      })
      .catch(() => {
        // Fallback gracefully to empty metrics
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [studentId, fetchStudentIntelligence]);

  // Attendance for this student
  const studentAttRecords = useMemo(
    () => attendanceRecords.filter((r) => r.studentId === studentId),
    [attendanceRecords, studentId]
  );

  const attStats: AttendanceSummaryStats = useMemo(
    () => calculateAttendanceStats(studentAttRecords),
    [studentAttRecords]
  );

  // Assessment attempts for this student
  const studentAttempts = useMemo(
    () =>
      attempts
        .filter((a) => a.studentId === studentId)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
    [attempts, studentId]
  );

  // Submissions & assignments for this student
  const studentSubs = useMemo(
    () => assignmentSubmissions.filter((s) => s.studentId === studentId),
    [assignmentSubmissions, studentId]
  );

  // Support plans for this student
  const supportPlans = useMemo(
    () => studentSupportPlans.filter((p) => p.studentId === studentId),
    [studentSupportPlans, studentId]
  );

  // Activity events for this student
  const studentEvents = useMemo(
    () =>
      learningActivityEvents
        .filter((e) => e.studentId === studentId)
        .sort((a, b) => new Date(b.timestamp || b.occurredAt).getTime() - new Date(a.timestamp || a.occurredAt).getTime()),
    [learningActivityEvents, studentId]
  );

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planObservedNeed.trim() || !planGoal.trim() || !planActivity.trim()) return;
    await createSupportPlan({
      studentId,
      subject: planSubject,
      topic: planTopic || 'Umumiy mavzular',
      observedNeed: planObservedNeed.trim(),
      goal: planGoal.trim(),
      recommendedActivity: planActivity.trim(),
      reviewDate: planReviewDate,
    });
    setShowNewPlanModal(false);
    setPlanObservedNeed('');
    setPlanGoal('');
    setPlanActivity('');
  };

  const getEvidenceBadge = (level?: LearningEvidenceLevel) => {
    switch (level) {
      case 'Yaxshi o\'zlashtirilgan':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Yaxshi o‘zlashtirilgan
          </span>
        );
      case 'Mustahkamlanmoqda':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <TrendingUp className="w-3 h-3 text-blue-600" />
            Mustahkamlanmoqda
          </span>
        );
      case 'O\'rganilmoqda':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3 text-amber-600" />
            O‘rganilmoqda
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            Ma’lumot yetarli emas
          </span>
        );
    }
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col ${
        isModal ? 'max-h-[92vh] overflow-hidden w-full max-w-5xl' : 'w-full'
      }`}
    >
      {/* Header Profile Bar */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg font-bold shrink-0">
            {student?.displayName ? student.displayName.charAt(0).toUpperCase() : 'S'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                {student?.displayName || 'Noma‘lum o‘quvchi'}
              </h2>
              <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-mono font-bold">
                {student?.classCode?.toUpperCase() || studentClass?.code?.toUpperCase() || 'Sinf belgilanmagan'}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono">
                {student?.studentCode || 'STD-000'}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {student?.email} · {studentClass?.trackLabel || 'Aniq fanlar'} yo‘nalishi
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            title="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 8 Compact Navigation Tabs */}
      <div className="flex items-center overflow-x-auto border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 bg-white dark:bg-slate-900 no-scrollbar">
        {[
          { id: 'overview', label: 'Umumiy' },
          { id: 'attendance', label: 'Davomat' },
          { id: 'results', label: 'Natijalar' },
          { id: 'assessments', label: 'Testlar' },
          { id: 'curriculum', label: 'O‘quv xaritasi' },
          { id: 'assignments', label: 'Vazifalar' },
          { id: 'activity', label: 'Faollik tarixi' },
          { id: 'support_plans', label: 'Yordam rejalari' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as StudentIntelligenceTab)}
            className={`px-3.5 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick KPI stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">Davomat ko‘rsatkichi</span>
                <p className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                  {attStats.attendancePercentage ?? attStats.attendancePercent ?? 100}%
                </p>
                <span className="text-[10px] text-slate-400">
                  {attStats.presentDays + (attStats.lateArrivals ?? attStats.lateDays ?? 0)}/{attStats.totalRecordedDays} dars qatnashgan
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">O‘rtacha natija</span>
                <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
                  {metrics?.overallAverageScore ?? 0}%
                </p>
                <span className="text-[10px] text-slate-400">
                  {studentAttempts.length} ta topshirilgan test
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">Vazifalar ijrosi</span>
                <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {studentSubs.filter((s) => s.status === 'Topshirildi').length}/{studentAssignments.length || 0}
                </p>
                <span className="text-[10px] text-slate-400">
                  {studentSubs.filter((s) => s.status === "Muddati o'tgan").length} ta kechikkan
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">Faol yordam rejalari</span>
                <p className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                  {supportPlans.filter((p) => p.status !== 'Yakunlandi').length}
                </p>
                <span className="text-[10px] text-slate-400">Pedagogik monitoring</span>
              </div>
            </div>

            {/* Subject Summary Cards */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Fanlar bo‘yicha o‘zlashtirish va dalillar darajasi
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(metrics?.subjectAverages || {}).map(([subj, data]) => (
                  <div
                    key={subj}
                    className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {subj}
                        </span>
                        {getEvidenceBadge(data.evidenceLevel)}
                      </div>
                      <p className="text-xs text-slate-500">
                        {data.assessmentsCompleted} ta sinov · {data.masteredTopicsCount} ta o‘zlashtirilgan mavzu
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
                        {data.averageScore}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500">Kiritilgan darslar</span>
                <p className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {attStats.totalRecordedDays}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Keldi</span>
                <p className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
                  {attStats.presentDays}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <span className="text-amber-700 dark:text-amber-300 font-semibold">Kechikdi</span>
                <p className="text-lg font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">
                  {attStats.lateArrivals ?? attStats.lateDays ?? 0}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <span className="text-blue-700 dark:text-blue-300 font-semibold">Sababli</span>
                <p className="text-lg font-bold font-mono text-blue-700 dark:text-blue-300 mt-1">
                  {attStats.excusedAbsences ?? attStats.excusedDays ?? 0}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                <span className="text-rose-700 dark:text-rose-300 font-semibold">Kelmagan</span>
                <p className="text-lg font-bold font-mono text-rose-700 dark:text-rose-300 mt-1">
                  {attStats.absentDays}
                </p>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Sana</th>
                    <th className="py-2.5 px-3">Sinf</th>
                    <th className="py-2.5 px-3">Holati</th>
                    <th className="py-2.5 px-3">Sabab / Izoh</th>
                    <th className="py-2.5 px-3">Qayd etgan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {studentAttRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        Hozircha ushbu o‘quvchi uchun davomat yozuvi kiritilmagan.
                      </td>
                    </tr>
                  ) : (
                    studentAttRecords.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2.5 px-3 font-mono font-medium">{r.date}</td>
                        <td className="py-2.5 px-3 font-mono text-blue-600 uppercase">{r.classCode}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                              r.status === 'PRESENT'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                : r.status === 'LATE'
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                : r.status === 'EXCUSED_ABSENCE'
                                ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                                : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                            }`}
                          >
                            {r.status === 'PRESENT'
                              ? 'Keldi'
                              : r.status === 'LATE'
                              ? 'Kechikdi'
                              : r.status === 'EXCUSED_ABSENCE'
                              ? 'Sababli'
                              : 'Kelmagan'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {r.notes || r.reasonCategory || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{r.recordedByName || 'Administrator'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: ACADEMIC RESULTS */}
        {activeTab === 'results' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Davrlar bo‘yicha solishtirma (Taqqoslash)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Joriy oy:</span>
                  <p className="text-base font-bold font-mono text-slate-900 dark:text-white">
                    {metrics?.comparisonPeriods.currentMonthScore ?? 0}%
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">O‘tgan oy:</span>
                  <p className="text-base font-bold font-mono text-slate-700 dark:text-slate-300">
                    {metrics?.comparisonPeriods.previousMonthScore ?? 0}%
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Joriy chorak:</span>
                  <p className="text-base font-bold font-mono text-slate-900 dark:text-white">
                    {metrics?.comparisonPeriods.currentQuarterScore ?? 0}%
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">O‘tgan chorak:</span>
                  <p className="text-base font-bold font-mono text-slate-700 dark:text-slate-300">
                    {metrics?.comparisonPeriods.previousQuarterScore ?? 0}%
                  </p>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Mavzu</th>
                    <th className="py-2.5 px-3">Fan</th>
                    <th className="py-2.5 px-3">Aniqlik</th>
                    <th className="py-2.5 px-3">Sinovlar soni</th>
                    <th className="py-2.5 px-3">Dalillar darajasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {metrics?.topicsEvidence.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        Mavzular bo‘yicha tahlil ma’lumotlari topilmadi.
                      </td>
                    </tr>
                  ) : (
                    metrics?.topicsEvidence.map((t) => (
                      <tr key={t.topicId}>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                          {t.topicName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{t.subject}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                          {t.accuracy}%
                        </td>
                        <td className="py-2.5 px-3 font-mono">{t.assessmentsCount}</td>
                        <td className="py-2.5 px-3">{getEvidenceBadge(t.evidenceLevel)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: ASSESSMENTS */}
        {activeTab === 'assessments' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Topshirilgan nazorat va diagnostika testlari
            </h4>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Test nomi</th>
                    <th className="py-2.5 px-3">Natija</th>
                    <th className="py-2.5 px-3">To‘g‘ri javoblar</th>
                    <th className="py-2.5 px-3">Topshirilgan sana</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {studentAttempts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        Hali test natijalari mavjud emas.
                      </td>
                    </tr>
                  ) : (
                    studentAttempts.map((att) => (
                      <tr key={att.id}>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                          {att.assessmentTitle || 'Diagnostik test'}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                          {att.scorePercent}%
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {att.correctCount}/{att.totalQuestions}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {new Date(att.submittedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: LEARNING MAP */}
        {activeTab === 'curriculum' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500">O‘quv rejasi o‘zlashtirilishi</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {metrics?.completedLessonsCount || 0} ta dars yakunlangan · {metrics?.pendingLessonsCount || 0} ta kutilmoqda
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Ushbu bo‘limda o‘quvchining sinf dars jadvali va o‘zlashtirilgan o‘quv mavzulari xaritasi ifodalanadi.
            </p>
          </div>
        )}

        {/* TAB 6: ASSIGNMENTS */}
        {activeTab === 'assignments' && (
          <div className="space-y-4">
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Topshiriq nomi</th>
                    <th className="py-2.5 px-3">Muddati</th>
                    <th className="py-2.5 px-3">Holati</th>
                    <th className="py-2.5 px-3">Ball</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {studentSubs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        Topshiriqlar mavjud emas.
                      </td>
                    </tr>
                  ) : (
                    studentSubs.map((sub) => (
                      <tr key={sub.id}>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                          {sub.assignmentTitle}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{sub.dueDate}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              sub.status === 'Topshirildi'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                : sub.status === "Muddati o'tgan"
                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                                : sub.status === 'Jarayonda'
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold">
                          {sub.score !== undefined ? `${sub.score}/${sub.maxScore}` : `— / ${sub.maxScore}`}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: ACTIVITY HISTORY */}
        {activeTab === 'activity' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              O‘quvchining tizimdagi amallari va test topshirish xronologiyasi
            </h4>
            <div className="space-y-2">
              {studentEvents.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Hali faollik yozuvlari kiritilmagan.
                </p>
              ) : (
                studentEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {evt.title || evt.activityType}
                      </p>
                      <p className="text-slate-500 text-[11px]">{evt.description || 'Amal muvaffaqiyatli bajarildi'}</p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(evt.timestamp || evt.occurredAt).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 8: SUPPORT PLANS */}
        {activeTab === 'support_plans' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Yakka tartibdagi o‘quv yordam rejalari (Maxfiy)
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Faqat administrator ko‘ra oladi, o‘quvchiga ko‘rinmaydi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewPlanModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Reja tuzish
              </button>
            </div>

            <div className="space-y-3">
              {supportPlans.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  Ushbu o‘quvchi uchun hozircha alohida yordam rejasi tuzilmagan.
                </p>
              ) : (
                supportPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {plan.subject} · {plan.topic}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            plan.status === 'Yakunlandi'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : plan.status === 'Jarayonda'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          {plan.status}
                        </span>
                      </div>
                      <span className="font-mono text-slate-400 text-[11px]">
                        Ko‘rib chiqish: {plan.reviewDate}
                      </span>
                    </div>

                    <div className="space-y-1 text-slate-600 dark:text-slate-300">
                      <p>
                        <strong>Kuzatilgan ehtiyoj:</strong> {plan.observedNeed}
                      </p>
                      <p>
                        <strong>Maqsad:</strong> {plan.goal}
                      </p>
                      <p>
                        <strong>Tavsiya etilgan faoliyat:</strong> {plan.recommendedActivity}
                      </p>
                      {plan.progressNotes && (
                        <p className="text-slate-500 italic">
                          <strong>Bajarilish qaydlari:</strong> {plan.progressNotes}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                      {plan.status !== 'Yakunlandi' && (
                        <button
                          type="button"
                          onClick={() => updateSupportPlan(plan.id, { status: 'Yakunlandi' })}
                          className="px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]"
                        >
                          Yakunlash
                        </button>
                      )}
                      {plan.status === 'Yangi' && (
                        <button
                          type="button"
                          onClick={() => updateSupportPlan(plan.id, { status: 'Jarayonda' })}
                          className="px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-semibold text-[11px]"
                        >
                          Jarayonga o‘tkazish
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Support Plan Modal */}
      {showNewPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Yangi yakka tartibdagi yordam rejasi
              </h3>
              <button
                type="button"
                onClick={() => setShowNewPlanModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Fan</label>
                <input
                  type="text"
                  value={planSubject}
                  onChange={(e) => setPlanSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Mavzu</label>
                <input
                  type="text"
                  value={planTopic}
                  onChange={(e) => setPlanTopic(e.target.value)}
                  placeholder="Masalan: Chiziqli tenglamalar"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Kuzatilgan ta’limiy ehtiyoj
                </label>
                <textarea
                  rows={2}
                  value={planObservedNeed}
                  onChange={(e) => setPlanObservedNeed(e.target.value)}
                  placeholder="Masalan: Testlarda qavslarni ochishda xatoliklar aniqlandi"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Maqsad</label>
                <textarea
                  rows={2}
                  value={planGoal}
                  onChange={(e) => setPlanGoal(e.target.value)}
                  placeholder="Masalan: 85% dan yuqori aniqlik bilan mustaqil yechish"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Tavsiya etilgan amaliy mashg‘ulot
                </label>
                <textarea
                  rows={2}
                  value={planActivity}
                  onChange={(e) => setPlanActivity(e.target.value)}
                  placeholder="Masalan: 10 ta amaliy misol va qo‘shimcha diagnostika testi"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">
                  Ko‘rib chiqish sanasi
                </label>
                <input
                  type="date"
                  value={planReviewDate}
                  onChange={(e) => setPlanReviewDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPlanModal(false)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
