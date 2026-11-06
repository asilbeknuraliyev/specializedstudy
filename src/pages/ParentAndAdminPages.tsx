import { ExamCenter } from '../components/ExamCenter';
import { WorkPlanCenter } from '../components/WorkPlanCenter';
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  UserPlus,
  Copy,
  Plus,
  Upload,
  KeyRound,
  Download,
  Layers,
  BookOpen,
  FileCheck2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  FileSpreadsheet,
  Trash2,
  X,
  Calendar as CalendarIcon,
  RotateCcw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Archive,
  ArrowUpDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLearnOS } from '../context/LearnOSContext';
import {
  Assessment,
  CalendarEventItem,
  ClassRoom,
  CurriculumAreaName,
  CurriculumWorkbookPreview,
  CurriculumZipImportPreview,
  LessonItem,
  LessonStatus,
  NormalizedLessonEventType,
  OfficialClassCode,
  QuestionItem,
  QuestionType,
  StudentAccountStatus,
  StudentImportColumnMapping,
  StudentImportPreviewResult,
  StudentImportRowPreview,
  UserProfile,
  WorkPlan,
  WorkPlanRowItem,
  WorkPlanType,
} from '../types';
import {
  ExcelImportCenterPanel,
  AdvancedQuestionEditorModal,
  WrittenGradingPanel,
} from '../components/AssessmentCenterWidgets';
import {
  APP_NAME,
  OFFICIAL_19_CLASS_CODES,
  OFFICIAL_A_TRACK_CLASSES,
  OFFICIAL_T_TRACK_CLASSES,
  isSubjectCompatibleWithClass,
} from '../constants/curriculum';
import { Roadmap2View } from '../components/Roadmap2View';
import { AdminGamificationPanel } from '../components/AdminGamificationPanel';
import { StudentIntelligenceView } from '../components/StudentIntelligenceView';
import { AdminAttendancePanel } from '../components/AdminAttendancePanel';
import { AdminAssignmentsPanel } from '../components/AdminAssignmentsPanel';
import { AdminAlertCenterPanel } from '../components/AdminAlertCenterPanel';
import { AdminSupportPlansPanel } from '../components/AdminSupportPlansPanel';
import { AdminReportsPanel } from '../components/AdminReportsPanel';
import { AdminTimetablePanel } from '../components/AdminTimetablePanel';
import { AdminAnnouncementsPanel } from '../components/AdminAnnouncementsPanel';
import { AdminMaterialsLibraryPanel } from '../components/AdminMaterialsLibraryPanel';
import { AdminSmartGradingPanel } from '../components/AdminSmartGradingPanel';
import { AdminAcademicCalendarPanel } from '../components/AdminAcademicCalendarPanel';

/* ==========================================================================
   1. BOSH SAHIFA — MINIMALIST OVERVIEW (SECTION 01, 02, 14)
   ========================================================================== */

export const AdminDashboardPage: React.FC = () => {
  const {
    institution,
    users,
    classes,
    workPlans,
    lessons,
    assessments,
    attempts,
    auditLogs,
  } = useLearnOS();

  const activeStudents = users.filter((u) => u.role === 'student' && u.status !== 'archived');
  const publishedAssessments = assessments.filter((a) => a.status === 'published');
  const upcomingLessons = lessons
    .filter((l) => l.status !== 'completed' && l.status !== 'archived')
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>O‘quv yili: <strong className="text-slate-800 dark:text-slate-200 font-mono">{institution.academicYear || '2026-2027'}</strong></span>
          <span>•</span>
          <span>19 ta sinf (14 A + 5 T)</span>
        </div>

        {/* 4 Essential Quick Actions (Section 06) */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/students?action=add"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>O‘quvchi qo‘shish</span>
          </Link>
          <Link
            to="/admin/students?action=import"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>Excel yuklash</span>
          </Link>
          <Link
            to="/admin/work-plans"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ish rejasi yuklash</span>
          </Link>
          <Link
            to="/admin/assessments?action=create"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Test yaratish</span>
          </Link>
        </div>
      </div>

      {/* 4 Live Real KPIs (Section 06) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/admin/students"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 rounded-lg p-4 transition-colors"
        >
          <p className="text-xs text-slate-500">O‘quvchilar</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {activeStudents.length}
          </p>
        </Link>

        <Link
          to="/admin/classes"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 rounded-lg p-4 transition-colors"
        >
          <p className="text-xs text-slate-500">Sinflar</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {classes.length}
          </p>
        </Link>

        <Link
          to="/admin/work-plans"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 rounded-lg p-4 transition-colors"
        >
          <p className="text-xs text-slate-500">Faol ish rejalari</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {workPlans.length}
          </p>
        </Link>

        <Link
          to="/admin/assessments"
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 rounded-lg p-4 transition-colors"
        >
          <p className="text-xs text-slate-500">Nashr qilingan testlar</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">
            {publishedAssessments.length}
          </p>
        </Link>
      </div>

      {/* 19 Official Classes Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Sinflar (19)
          </h2>
          <Link to="/admin/classes" className="text-xs font-medium text-blue-600 hover:underline">
            Barchasi →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                A yo‘nalishi (14)
              </span>
              <span className="text-[11px] text-slate-500">Matematika · Ingliz tili · Fizika</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {OFFICIAL_A_TRACK_CLASSES.map((code) => {
                const clsObj = classes.find((c) => c.code === code || c.name === code);
                const cnt = activeStudents.filter(
                  (s) => s.classCode === code || (clsObj && s.classId === clsObj.id)
                ).length;
                return (
                  <Link
                    key={code}
                    to={`/admin/classes?class=${code}`}
                    className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 text-xs font-mono font-semibold flex items-center gap-1 transition-colors"
                  >
                    <span className="text-slate-800 dark:text-slate-200">{code}</span>
                    <span className="text-[10px] text-slate-400 tabular-nums">{cnt}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                T yo‘nalishi (5)
              </span>
              <span className="text-[11px] text-slate-500">Ingliz tili · Biologiya · Kimyo</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {OFFICIAL_T_TRACK_CLASSES.map((code) => {
                const clsObj = classes.find((c) => c.code === code || c.name === code);
                const cnt = activeStudents.filter(
                  (s) => s.classCode === code || (clsObj && s.classId === clsObj.id)
                ).length;
                return (
                  <Link
                    key={code}
                    to={`/admin/classes?class=${code}`}
                    className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-xs font-mono font-semibold flex items-center gap-1 transition-colors"
                  >
                    <span className="text-slate-800 dark:text-slate-200">{code}</span>
                    <span className="text-[10px] text-slate-400 tabular-nums">{cnt}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Bottom Section: Upcoming Tasks, Work Plans, Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upcoming lessons & tests */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Navbatdagi darslar va testlar
            </h3>
            <Link to="/admin/lessons" className="text-xs text-blue-600 hover:underline">
              Darslar
            </Link>
          </div>
          {upcomingLessons.length === 0 && publishedAssessments.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">Rejalashtirilgan darslar yoki testlar yo‘q.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {upcomingLessons.slice(0, 3).map((l) => (
                <div key={l.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="font-mono font-semibold text-blue-600 mr-1.5">{l.classCode}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {l.title || l.topicName}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">{l.subjectName}</span>
                </div>
              ))}
              {publishedAssessments.slice(0, 3).map((a) => (
                <div key={a.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="font-mono font-semibold text-emerald-600 mr-1.5">
                      {a.classCode || `${a.grade}-sinf`}
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{a.title}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">{a.dueDate}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Updated Work Plans */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Ish rejalari
            </h3>
            <Link to="/admin/work-plans" className="text-xs text-blue-600 hover:underline">
              Yuklash
            </Link>
          </div>
          {workPlans.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">Ish rejalari hali yuklanmagan.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {workPlans.slice(0, 5).map((wp) => (
                <div key={wp.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="font-mono font-semibold text-blue-600 mr-1.5">{wp.classCode}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{wp.subjectName}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {wp.rows.length} dars
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              So‘nggi faollik
            </h3>
            <span className="text-[11px] font-mono text-slate-400">{attempts.length} natija</span>
          </div>
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">Faollik qayd etilmagan.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="py-2 flex items-center justify-between gap-2">
                  <span className="truncate text-slate-700 dark:text-slate-300">{log.action}</span>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {new Date(log.createdAt).toLocaleTimeString('uz-UZ', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   2. SINFLAR — EXACT 19 OFFICIAL CLASSES ORDERED BY GRADE (SECTION 03 & 10)
   ========================================================================== */

export const AdminClassesPage: React.FC = () => {
  const {
    classes,
    users,
    subjects,
    workPlans,
    lessons,
    assessments,
    attempts,
    addUserByAdmin,
    removeStudentFromClass,
    updateClassRoom,
  } = useLearnOS();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [trackFilter, setTrackFilter] = useState<'ALL' | 'A' | 'T'>('ALL');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [selectedClassCode, setSelectedClassCode] = useState<string | null>(
    searchParams.get('class')
  );
  const [detailTab, setDetailTab] = useState<
    'students' | 'subjects' | 'workplans' | 'lessons' | 'tests' | 'results'
  >('students');

  const [newStuName, setNewStuName] = useState('');
  const [newStuEmail, setNewStuEmail] = useState('');
  const [newStuPassword, setNewStuPassword] = useState('Student123!');
  const [addingStu, setAddingStu] = useState(false);

  // Edit Class Modal State
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [editTrackLabel, setEditTrackLabel] = useState('');
  const [editAcademicYear, setEditAcademicYear] = useState('');
  const [savingClass, setSavingClass] = useState(false);

  useEffect(() => {
    const qClass = searchParams.get('class');
    if (qClass) setSelectedClassCode(qClass.toLowerCase());
  }, [searchParams]);

  const students = users.filter((u) => u.role === 'student' && u.status !== 'archived');

  // Canonical order by grade: 5a1, 5a2, 6a1, 6a2, 7a1, 7a2, 7t, ..., 11t
  const orderedClasses = [...classes].sort((a, b) => {
    const idxA = OFFICIAL_19_CLASS_CODES.indexOf((a.code || a.name) as OfficialClassCode);
    const idxB = OFFICIAL_19_CLASS_CODES.indexOf((b.code || b.name) as OfficialClassCode);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });

  const filteredClasses = orderedClasses.filter((cls) => {
    if (trackFilter !== 'ALL' && cls.track !== trackFilter) return false;
    if (gradeFilter !== 'ALL' && String(cls.grade) !== gradeFilter) return false;
    return true;
  });

  const activeClass: ClassRoom | undefined = orderedClasses.find(
    (c) =>
      (c.code || c.name).toLowerCase() === selectedClassCode?.toLowerCase() ||
      c.id === selectedClassCode
  );

  const handleQuickAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClass || !newStuName.trim() || !newStuEmail.trim()) return;
    setAddingStu(true);
    try {
      await addUserByAdmin(
        newStuName.trim(),
        newStuEmail.trim(),
        'student',
        activeClass.id,
        newStuPassword,
        activeClass.code || activeClass.name
      );
      setNewStuName('');
      setNewStuEmail('');
    } finally {
      setAddingStu(false);
    }
  };

  const handleSaveClassEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;
    setSavingClass(true);
    try {
      await updateClassRoom(editingClass.id, {
        trackLabel: editTrackLabel.trim() || editingClass.trackLabel,
        academicYear: editAcademicYear.trim() || editingClass.academicYear,
      });
      setEditingClass(null);
    } finally {
      setSavingClass(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
          {[
            { id: 'ALL', label: `Barchasi (${orderedClasses.length})` },
            {
              id: 'A',
              label: `A yo‘nalishi (${orderedClasses.filter((c) => c.track === 'A').length})`,
            },
            {
              id: 'T',
              label: `T yo‘nalishi (${orderedClasses.filter((c) => c.track === 'T').length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTrackFilter(tab.id as any)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                trackFilter === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Sinf darajasi"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            <option value="ALL">5–11-sinflar</option>
            {[5, 6, 7, 8, 9, 10, 11].map((g) => (
              <option key={g} value={String(g)}>
                {g}-sinf
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected Class Detail View (Section 10) */}
      {activeClass && (
        <div className="bg-white dark:bg-slate-900 border border-blue-500/80 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-md bg-blue-600 text-white font-mono text-sm font-bold">
                {activeClass.code || activeClass.name}
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {activeClass.grade}-sinf • {activeClass.trackLabel}
                </h2>
                <p className="text-xs text-slate-500">
                  Fanlar: {(activeClass.subjectNames || []).join(', ')}
                </p>
              </div>
            </div>

            {/* Class Actions (Section 02 & 10) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setEditingClass(activeClass);
                  setEditTrackLabel(activeClass.trackLabel || '');
                  setEditAcademicYear(activeClass.academicYear || '2026-2027');
                }}
                className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-medium cursor-pointer"
              >
                Sinfni tahrirlash
              </button>
              <button
                type="button"
                onClick={() => navigate(`/admin/students?class=${activeClass.code}`)}
                className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-medium cursor-pointer"
              >
                O‘quvchilarni ko‘rish
              </button>
              <button
                type="button"
                onClick={() => navigate(`/admin/curriculum-map?class=${activeClass.code}`)}
                className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-medium cursor-pointer"
              >
                O‘quv xaritasi
              </button>
              <button
                type="button"
                onClick={() => navigate(`/admin/students?action=import&class=${activeClass.code}`)}
                className="px-2.5 py-1.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-semibold cursor-pointer"
              >
                Excel yuklash
              </button>
              <a
                href={`/api/students/export.xlsx?classCode=${encodeURIComponent(activeClass.code)}`}
                download
                className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-medium"
              >
                Eksport
              </a>
              <button
                type="button"
                onClick={() => navigate(`/admin/lessons?class=${activeClass.code}`)}
                className="px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-medium cursor-pointer"
              >
                Darslar
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedClassCode(null);
                  setSearchParams({});
                }}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Detail Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-slate-100 dark:border-slate-800 pb-2">
            {[
              { id: 'students', label: "O'quvchilar" },
              { id: 'subjects', label: 'Fanlar' },
              { id: 'workplans', label: 'Ish rejalari' },
              { id: 'lessons', label: 'Darslar' },
              { id: 'tests', label: 'Testlar' },
              { id: 'results', label: 'Natijalar' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setDetailTab(t.id as any)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  detailTab === t.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {(() => {
            const clsCode = (activeClass.code || activeClass.name).toLowerCase();
            const clsStudents = students
              .filter(
                (s) =>
                  s.classId === activeClass.id ||
                  (s.classCode && s.classCode.toLowerCase() === clsCode)
              )
              .sort((a, b) => a.displayName.localeCompare(b.displayName, 'uz'));
            const clsSubjects = subjects.filter(
              (s) => isSubjectCompatibleWithClass(s.name, activeClass, subjects).compatible
            );
            const clsWorkPlans = workPlans.filter(
              (wp) => wp.classId === activeClass.id || wp.classCode.toLowerCase() === clsCode
            );
            const clsLessons = lessons.filter(
              (l) => l.classId === activeClass.id || l.classCode.toLowerCase() === clsCode
            );
            const clsAssessments = assessments.filter(
              (a) => a.classId === activeClass.id || a.classCode?.toLowerCase() === clsCode
            );
            const clsAttempts = attempts.filter(
              (att) =>
                att.classId === activeClass.id ||
                clsStudents.some((s) => s.uid === att.studentId)
            );

            if (detailTab === 'students') {
              return (
                <div className="space-y-3">
                  <form
                    onSubmit={handleQuickAddStudent}
                    className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  >
                    <input
                      type="text"
                      value={newStuName}
                      onChange={(e) => setNewStuName(e.target.value)}
                      placeholder="F.I.Sh."
                      className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                    />
                    <input
                      type="email"
                      value={newStuEmail}
                      onChange={(e) => setNewStuEmail(e.target.value)}
                      placeholder="Email"
                      className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                    />
                    <input
                      type="text"
                      value={newStuPassword}
                      onChange={(e) => setNewStuPassword(e.target.value)}
                      placeholder="Parol"
                      className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono"
                    />
                    <button
                      type="submit"
                      disabled={addingStu}
                      className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      {addingStu ? 'Qo‘shilmoqda...' : "+ O'quvchi qo'shish"}
                    </button>
                  </form>

                  {clsStudents.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3">
                      Ushbu sinfda hozircha o‘quvchilar yo‘q.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                      {clsStudents.map((stu, i) => (
                        <div
                          key={stu.uid}
                          className="px-3 py-2 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-slate-400 w-5">{i + 1}.</span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {stu.displayName}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">
                              {stu.studentCode}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeStudentFromClass(activeClass.id, stu.uid)}
                            className="text-rose-600 hover:underline text-[11px] font-medium cursor-pointer"
                          >
                            Chiqarish
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            if (detailTab === 'subjects') {
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {clsSubjects.map((s) => (
                    <div
                      key={s.id}
                      className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                    >
                      <span className="text-[10px] font-mono font-bold text-blue-600">{s.code}</span>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                        {s.name}
                      </p>
                    </div>
                  ))}
                </div>
              );
            }

            if (detailTab === 'workplans') {
              return (
                <div className="space-y-2">
                  {clsWorkPlans.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">Ish rejalari yuklanmagan.</p>
                  ) : (
                    clsWorkPlans.map((wp) => (
                      <div
                        key={wp.id}
                        className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold">{wp.title}</span>
                          <span className="text-slate-400 ml-2">({wp.rows.length} dars)</span>
                        </div>
                        <Link
                          to={`/admin/lessons?class=${activeClass.code}`}
                          className="text-blue-600 font-medium hover:underline"
                        >
                          Darslar →
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              );
            }

            if (detailTab === 'lessons') {
              return (
                <div className="space-y-1.5">
                  {clsLessons.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">Darslar mavjud emas.</p>
                  ) : (
                    clsLessons.slice(0, 10).map((l) => (
                      <div
                        key={l.id}
                        className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-mono text-slate-400 mr-2">{l.lessonNumber}.</span>
                          <span className="font-medium">{l.title || l.topicName}</span>
                          <span className="text-slate-400 ml-2">({l.subjectName})</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">{l.status}</span>
                      </div>
                    ))
                  )}
                </div>
              );
            }

            if (detailTab === 'tests') {
              return (
                <div className="space-y-1.5">
                  {clsAssessments.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">Testlar mavjud emas.</p>
                  ) : (
                    clsAssessments.map((a) => (
                      <div
                        key={a.id}
                        className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <span className="font-medium">{a.title}</span>
                        <span className="font-mono text-slate-500">{a.questionIds.length} savol</span>
                      </div>
                    ))
                  )}
                </div>
              );
            }

            return (
              <div className="space-y-1.5">
                {clsAttempts.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">Natijalar yo‘q.</p>
                ) : (
                  clsAttempts.map((att) => (
                    <div
                      key={att.id}
                      className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <span>{att.studentName} — {att.assessmentTitle}</span>
                      <span className="font-mono font-bold text-blue-600">{att.scorePercent}%</span>
                    </div>
                  ))
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Compact Grid of 19 Official Classes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {filteredClasses.map((cls) => {
          const code = cls.code || cls.name;
          const realStuCount = students.filter(
            (s) => s.classId === cls.id || (s.classCode && s.classCode.toLowerCase() === code.toLowerCase())
          ).length;
          const clsWorkPlansCount = workPlans.filter(
            (wp) => wp.classId === cls.id || wp.classCode.toLowerCase() === code.toLowerCase()
          ).length;
          const clsTestsCount = assessments.filter(
            (a) => a.classId === cls.id || a.classCode?.toLowerCase() === code.toLowerCase()
          ).length;

          return (
            <div
              key={cls.id}
              onClick={() => {
                setSelectedClassCode(code);
                setSearchParams({ class: code });
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-lg p-4 flex flex-col justify-between space-y-3 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                  {code}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    cls.track === 'T'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {cls.track} yo‘nalishi
                </span>
              </div>

              <div className="text-[11px] text-slate-500 truncate">
                {(cls.subjectNames || []).join(' · ')}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                <span>{realStuCount} o‘quvchi</span>
                <span>{clsWorkPlansCount} reja</span>
                <span>{clsTestsCount} test</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Class Modal */}
      {editingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 ss-modal-enter">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Sinfni tahrirlash ({editingClass.code || editingClass.name})
              </h3>
              <button
                type="button"
                onClick={() => setEditingClass(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveClassEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Yo‘nalish tavsifi</label>
                <input
                  type="text"
                  required
                  value={editTrackLabel}
                  onChange={(e) => setEditTrackLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">O‘quv yili</label>
                <input
                  type="text"
                  required
                  value={editAcademicYear}
                  onChange={(e) => setEditAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={savingClass}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                >
                  {savingClass ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ==========================================================================
   3. O‘QUVCHILAR — SMART STUDENT MANAGEMENT & 9-STEP EXCEL IMPORT (SECTIONS 04–08, 13, 15)
   ========================================================================== */

export const AdminStudentsPage: React.FC = () => {
  const {
    users,
    classes,
    subjects,
    lessons,
    attempts,
    masteryRecords,
    studentImportJobs,
    addUserByAdmin,
    updateUserAdmin,
    createInvitation,
    previewStudentExcelImport,
    confirmStudentExcelImport,
    rollbackStudentImportJob,
    executeBulkStudentAction,
    addToast,
  } = useLearnOS();

  const [searchParams, setSearchParams] = useSearchParams();

  // View Tab: directory vs import wizard vs import history
  const [pageTab, setPageTab] = useState<'directory' | 'import' | 'history'>('directory');

  // Directory Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string>(searchParams.get('class') || 'ALL');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [trackFilter, setTrackFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'class' | 'name'>('class');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Bulk Selection State
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [bulkTargetClass, setBulkTargetClass] = useState<string>('7a1');
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Student Detail Drawer State (Section 04)
  const [detailStudentUid, setDetailStudentUid] = useState<string | null>(
    searchParams.get('student')
  );
  const [intelligenceStudentUid, setIntelligenceStudentUid] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<
    'profile' | 'learning' | 'activity' | 'progress' | 'actions'
  >('profile');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPatronymic, setEditPatronymic] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editStudentCode, setEditStudentCode] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editClassCode, setEditClassCode] = useState('7a1');

  // Direct Add Student Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [stuName, setStuName] = useState('');
  const [stuEmail, setStuEmail] = useState('');
  const [stuPassword, setStuPassword] = useState('Student123!');
  const [stuClassCode, setStuClassCode] = useState<string>('7a1');

  // Invite Token Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invName, setInvName] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invClassCode, setInvClassCode] = useState<string>('7a1');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  // 9-Step Excel Student Import State
  const [importFileName, setImportFileName] = useState('');
  const [importBase64, setImportBase64] = useState('');
  const [importPreview, setImportPreview] = useState<StudentImportPreviewResult | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [selectedHeaderIdx, setSelectedHeaderIdx] = useState<number | undefined>(undefined);
  const [mappingOverride, setMappingOverride] = useState<StudentImportColumnMapping>({});
  const [rowClassOverrides, setRowClassOverrides] = useState<Record<number, string>>({});
  const [rowFieldOverrides, setRowFieldOverrides] = useState<
    Record<number, Record<string, string>>
  >({});
  const [previewCategoryTab, setPreviewCategoryTab] = useState<
    'ALL' | 'VALID' | 'DUPLICATE' | 'ERROR' | 'WARNING'
  >('ALL');
  const [previewClassChip, setPreviewClassChip] = useState<string>('ALL');
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip_existing' | 'update_existing'>(
    'skip_existing'
  );
  const [activeJobId, setActiveJobId] = useState<string>(`stu-job-${Date.now()}`);
  const [importFinishedResult, setImportFinishedResult] = useState<{
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
    errorCount: number;
  } | null>(null);

  useEffect(() => {
    const action = searchParams.get('action');
    const qClass = searchParams.get('class');
    const qStu = searchParams.get('student');
    if (qClass) setClassFilter(qClass.toLowerCase());
    if (qStu) setDetailStudentUid(qStu);
    if (action === 'import') setPageTab('import');
    if (action === 'add') setShowAddModal(true);
  }, [searchParams]);

  const allStudents = useMemo(
    () => users.filter((u) => u.role === 'student'),
    [users]
  );

  const classOrderMap = useMemo(
    () => new Map(OFFICIAL_19_CLASS_CODES.map((c, i) => [c, i])),
    []
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = allStudents.filter((s) => {
      if (statusFilter === 'ALL') {
        if (s.status === 'archived') return false;
      } else if ((s.status || 'active') !== statusFilter) {
        return false;
      }

      const cls = classes.find((c) => c.id === s.classId || c.code === s.classCode);
      const code = (cls?.code || cls?.name || s.classCode || '').toLowerCase();
      const grade = cls?.grade || s.grade || 7;
      const track = cls?.track || s.track || 'A';

      if (classFilter !== 'ALL' && code !== classFilter.toLowerCase()) return false;
      if (gradeFilter !== 'ALL' && String(grade) !== gradeFilter) return false;
      if (trackFilter !== 'ALL' && track !== trackFilter) return false;

      if (q) {
        const matchName = s.displayName.toLowerCase().includes(q);
        const matchId = (s.studentCode || s.uid).toLowerCase().includes(q);
        const matchEmail = s.email.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchEmail) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'class') {
        const codeA = (a.classCode || '').toLowerCase() as OfficialClassCode;
        const codeB = (b.classCode || '').toLowerCase() as OfficialClassCode;
        const idxA = classOrderMap.get(codeA) ?? 999;
        const idxB = classOrderMap.get(codeB) ?? 999;
        if (idxA !== idxB) return idxA - idxB;
      }
      return a.displayName.localeCompare(b.displayName, 'uz');
    });

    return list;
  }, [allStudents, classes, classFilter, gradeFilter, trackFilter, statusFilter, searchQuery, sortBy, classOrderMap]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Sync student detail drawer fields when opened
  const activeDetailStudent: UserProfile | undefined = useMemo(
    () => allStudents.find((s) => s.uid === detailStudentUid),
    [allStudents, detailStudentUid]
  );

  useEffect(() => {
    if (activeDetailStudent) {
      setEditDisplayName(activeDetailStudent.displayName || '');
      setEditFirstName(activeDetailStudent.firstName || '');
      setEditLastName(activeDetailStudent.lastName || '');
      setEditPatronymic(activeDetailStudent.patronymic || '');
      setEditStudentCode(activeDetailStudent.studentCode || '');
      setEditEmail(
        activeDetailStudent.email?.endsWith('@student.specialized.local')
          ? ''
          : activeDetailStudent.email || ''
      );
      setEditClassCode(activeDetailStudent.classCode || '7a1');
    }
  }, [activeDetailStudent]);

  // Trigger preview re-calculation when sheet, header row, mapping, or row overrides change
  const runExcelPreview = async (
    b64: string,
    fName: string,
    sheet?: string,
    headerIdx?: number,
    mapOvr?: StudentImportColumnMapping,
    clsOvr?: Record<number, string>,
    fldOvr?: Record<number, Record<string, string>>
  ) => {
    if (!b64) return;
    setImportLoading(true);
    try {
      const res = await previewStudentExcelImport({
        fileName: fName,
        base64Data: b64,
        selectedSheet: sheet || undefined,
        selectedHeaderRowIndex: headerIdx,
        columnMappingOverride: mapOvr && Object.keys(mapOvr).length > 0 ? mapOvr : undefined,
        rowClassOverrides: clsOvr,
        rowFieldOverrides: fldOvr,
      });
      setImportPreview(res);
      if (!sheet) setSelectedSheet(res.selectedSheet);
      if (headerIdx === undefined) setSelectedHeaderIdx(res.selectedHeaderRowIndex);
      if (!mapOvr || Object.keys(mapOvr).length === 0) setMappingOverride(res.detectedMapping);
    } catch {
      // Toast handled by context
    } finally {
      setImportLoading(false);
    }
  };

  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportFinishedResult(null);
    setRowClassOverrides({});
    setRowFieldOverrides({});
    setMappingOverride({});
    setSelectedSheet('');
    setSelectedHeaderIdx(undefined);
    setActiveJobId(`stu-job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = String(reader.result || '');
      setImportBase64(b64);
      runExcelPreview(b64, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmExcelImport = async () => {
    if (!importPreview) return;
    setImportLoading(true);
    try {
      const res = await confirmStudentExcelImport({
        jobId: activeJobId,
        fileName: importFileName,
        duplicatePolicy,
        rows: importPreview.rows,
      });
      setImportFinishedResult({
        importedCount: res.importedCount,
        updatedCount: res.updatedCount,
        skippedCount: res.skippedCount,
        errorCount: res.errorCount,
      });
    } finally {
      setImportLoading(false);
    }
  };

  const handleDownloadPreviewReport = (mode: 'all' | 'invalid' | 'imported') => {
    if (!importPreview) return;
    const targetRows =
      mode === 'invalid'
        ? importPreview.rows.filter((r) => r.status === 'error' || r.status === 'warning')
        : mode === 'imported'
          ? importPreview.rows.filter((r) => r.status === 'valid' || r.status === 'warning')
          : importPreview.rows;

    const aoa: (string | number)[][] = [
      ['Qator', 'F.I.Sh.', 'Familiya', 'Ism', 'Sinf', 'ID', 'Email', 'Holat', 'Izoh'],
      ...targetRows.map((r) => [
        r.rowNumber,
        r.fullName,
        r.lastName,
        r.firstName,
        r.normalizedClassCode || r.rawClassCode,
        r.studentId,
        r.email,
        r.status,
        r.issues.map((i) => i.message).join('; ') || r.duplicateReason || '',
      ]),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `Specialized_Study_${mode}_report.xlsx`);
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stuName.trim() || !stuEmail.trim()) return;
    const targetCls = classes.find((c) => c.code === stuClassCode || c.name === stuClassCode);
    await addUserByAdmin(
      stuName.trim(),
      stuEmail.trim(),
      'student',
      targetCls?.id,
      stuPassword,
      stuClassCode
    );
    setStuName('');
    setStuEmail('');
    setShowAddModal(false);
  };

  const handleCreateStudentInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCls = classes.find((c) => c.code === invClassCode || c.name === invClassCode);
    const res = await createInvitation({
      inviteeName: invName.trim() || "O'quvchi",
      email: invEmail.trim() || undefined,
      role: 'student',
      classId: targetCls?.id,
    });
    setGeneratedToken(res.rawToken);
  };

  const handleSaveStudentDetail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDetailStudent) return;
    await updateUserAdmin(activeDetailStudent.uid, {
      displayName: editDisplayName.trim(),
      firstName: editFirstName.trim(),
      lastName: editLastName.trim(),
      patronymic: editPatronymic.trim(),
      studentCode: editStudentCode.trim(),
      email: editEmail.trim() || undefined,
      classCode: editClassCode,
    });
  };

  const handleBulkAction = async (
    action: 'change_class' | 'send_invite' | 'archive' | 'suspend' | 'activate'
  ) => {
    if (selectedUids.length === 0) return;
    setBulkProcessing(true);
    try {
      await executeBulkStudentAction({
        action,
        studentUids: selectedUids,
        targetClassCode: action === 'change_class' ? bulkTargetClass : undefined,
      });
      setSelectedUids([]);
    } finally {
      setBulkProcessing(false);
    }
  };

  const statusBadge = (status?: StudentAccountStatus) => {
    if (status === 'pending_activation') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
          Kutilmoqda
        </span>
      );
    }
    if (status === 'suspended') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60">
          To‘xtatilgan
        </span>
      );
    }
    if (status === 'archived') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          Arxivlangan
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
        Faol
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setPageTab('directory')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              pageTab === 'directory'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Ro‘yxat ({allStudents.filter((s) => s.status !== 'archived').length})
          </button>
          <button
            type="button"
            onClick={() => setPageTab('import')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              pageTab === 'import'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            O‘quvchilarni yuklash (Excel)
          </button>
          <button
            type="button"
            onClick={() => setPageTab('history')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              pageTab === 'history'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Import tarixi ({studentImportJobs.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/students/import/template.xlsx"
            download="Specialized_Study_Students.xlsx"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel shablon</span>
          </a>

          <button
            type="button"
            onClick={() => setPageTab('import')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>O‘quvchilarni yuklash</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 text-blue-600" />
            <span>Qo‘shish</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setGeneratedToken(null);
              setShowInviteModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
            <span>Taklif kodi</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
         TAB 1: STUDENT DIRECTORY (SECTION 04 & 13)
         ==================================================================== */}
      {pageTab === 'directory' && (
        <div className="space-y-4">
          {/* Compact Class Chips Filter: Barchasi | 5a1 | 5a2 | ... | 11t */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => {
                setClassFilter('ALL');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                classFilter === 'ALL'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
              }`}
            >
              Barchasi
            </button>
            {OFFICIAL_19_CLASS_CODES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  setClassFilter(code);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold shrink-0 transition-colors cursor-pointer ${
                  classFilter.toLowerCase() === code
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          {/* Search & Secondary Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="F.I.Sh., ID yoki email orqali qidirish..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
            </div>

            <select
              aria-label="Sinf darajasi"
              value={gradeFilter}
              onChange={(e) => {
                setGradeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
            >
              <option value="ALL">5–11-sinflar</option>
              {[5, 6, 7, 8, 9, 10, 11].map((g) => (
                <option key={g} value={String(g)}>
                  {g}-sinf
                </option>
              ))}
            </select>

            <select
              aria-label="Yo‘nalish"
              value={trackFilter}
              onChange={(e) => {
                setTrackFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
            >
              <option value="ALL">A va T yo‘nalish</option>
              <option value="A">A yo‘nalishi</option>
              <option value="T">T yo‘nalishi</option>
            </select>

            <select
              aria-label="Holat"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
            >
              <option value="ALL">Faol va kutilayotgan</option>
              <option value="active">Faol</option>
              <option value="pending_activation">Kutilmoqda</option>
              <option value="suspended">To‘xtatilgan</option>
              <option value="archived">Arxivlangan</option>
            </select>

            <button
              type="button"
              onClick={() => setSortBy((prev) => (prev === 'class' ? 'name' : 'class'))}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <span>{sortBy === 'class' ? 'Sinf + Alifbo' : 'Alifbo (A–Z)'}</span>
            </button>

            <a
              href={`/api/students/export.xlsx${
                classFilter !== 'ALL' ? `?classCode=${encodeURIComponent(classFilter)}` : ''
              }`}
              download
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Eksport</span>
            </a>
          </div>

          {/* Bulk Operations Bar (Section 13) */}
          {selectedUids.length > 0 && (
            <div className="p-3 rounded-lg bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="font-semibold text-blue-900 dark:text-blue-200">
                Tanlandi: {selectedUids.length} ta o‘quvchi
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <select
                    aria-label="Ommaviy sinfni tanlash"
                    value={bulkTargetClass}
                    onChange={(e) => setBulkTargetClass(e.target.value)}
                    className="px-2 py-1 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 font-mono font-bold"
                  >
                    {OFFICIAL_19_CLASS_CODES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={bulkProcessing}
                    onClick={() => handleBulkAction('change_class')}
                    className="px-2.5 py-1 rounded bg-blue-600 text-white font-semibold cursor-pointer"
                  >
                    Sinfni o‘zgartirish
                  </button>
                </div>

                <button
                  type="button"
                  disabled={bulkProcessing}
                  onClick={() => handleBulkAction('send_invite')}
                  className="px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium cursor-pointer"
                >
                  Taklifnoma yuborish
                </button>

                <a
                  href={`/api/students/export.xlsx?uids=${encodeURIComponent(selectedUids.join(','))}`}
                  download
                  className="px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium"
                >
                  Excel eksport
                </a>

                <button
                  type="button"
                  disabled={bulkProcessing}
                  onClick={() => handleBulkAction('archive')}
                  className="px-2.5 py-1 rounded bg-rose-600 text-white font-medium cursor-pointer"
                >
                  Arxivlash
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedUids([])}
                  className="text-slate-500 hover:underline px-1 cursor-pointer"
                >
                  Bekor qilish
                </button>
              </div>
            </div>
          )}

          {/* High-Density Student Table (Columns: F.I.Sh., ID, Sinf, Holat, Amallar) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {filteredStudents.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  O‘quvchilar topilmadi
                </p>
                <p className="text-xs text-slate-500">
                  Excel fayl orqali ro‘yxatni yuklang yoki yangi o‘quvchi qo‘shing.
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Student Card List (<768px) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedStudents.map((stu) => {
                    const cls = classes.find(
                      (c) => c.id === stu.classId || c.code === stu.classCode
                    );
                    const classCode = (cls?.code || cls?.name || stu.classCode || '7a1') as OfficialClassCode;
                    const checked = selectedUids.includes(stu.uid);

                    return (
                      <div key={stu.uid} className="p-3.5 space-y-2.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              aria-label={`${stu.displayName} tanlash`}
                              checked={checked}
                              onChange={() =>
                                setSelectedUids((prev) =>
                                  checked ? prev.filter((id) => id !== stu.uid) : [...prev, stu.uid]
                                )
                              }
                              className="mt-1 shrink-0"
                            />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setDetailStudentUid(stu.uid)}
                                className="font-semibold text-sm text-slate-900 dark:text-white hover:text-blue-600 text-left break-words cursor-pointer"
                              >
                                {stu.displayName}
                              </button>
                              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                ID: {stu.studentCode || stu.uid.slice(0, 8)}
                              </div>
                              {!stu.email.endsWith('@student.specialized.local') && (
                                <div className="text-[11px] text-slate-400 truncate">{stu.email}</div>
                              )}
                            </div>
                          </div>
                          {statusBadge(stu.status)}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <select
                            aria-label={`${stu.displayName} sinfi`}
                            value={classCode}
                            onChange={(e) =>
                              updateUserAdmin(stu.uid, { classCode: e.target.value })
                            }
                            className="min-h-[38px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-semibold text-blue-600 dark:text-blue-400"
                          >
                            {OFFICIAL_19_CLASS_CODES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setIntelligenceStudentUid(stu.uid)}
                              className="min-h-[38px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Tahlil</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDetailStudentUid(stu.uid)}
                              className="min-h-[38px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-blue-600 font-semibold cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Profil</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop High-Density Table (>=768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 text-slate-500 font-semibold">
                        <th className="py-2.5 px-3 w-8">
                          <input
                            type="checkbox"
                            aria-label="Barchasini belgilash"
                            checked={
                              paginatedStudents.length > 0 &&
                              paginatedStudents.every((s) => selectedUids.includes(s.uid))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUids(
                                  Array.from(
                                    new Set([...selectedUids, ...paginatedStudents.map((s) => s.uid)])
                                  )
                                );
                              } else {
                                const pageSet = new Set(paginatedStudents.map((s) => s.uid));
                                setSelectedUids(selectedUids.filter((id) => !pageSet.has(id)));
                              }
                            }}
                          />
                        </th>
                        <th className="py-2.5 px-3">F.I.Sh.</th>
                        <th className="py-2.5 px-3">ID</th>
                        <th className="py-2.5 px-3">Sinf</th>
                        <th className="py-2.5 px-3">Holat</th>
                        <th className="py-2.5 px-3 text-right">Amallar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {paginatedStudents.map((stu) => {
                        const cls = classes.find(
                          (c) => c.id === stu.classId || c.code === stu.classCode
                        );
                        const classCode = (cls?.code || cls?.name || stu.classCode || '7a1') as OfficialClassCode;
                        const checked = selectedUids.includes(stu.uid);

                        return (
                          <tr
                            key={stu.uid}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-2.5 px-3">
                              <input
                                type="checkbox"
                                aria-label={`${stu.displayName} tanlash`}
                                checked={checked}
                                onChange={() =>
                                  setSelectedUids((prev) =>
                                    checked ? prev.filter((id) => id !== stu.uid) : [...prev, stu.uid]
                                  )
                                }
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <button
                                type="button"
                                onClick={() => setDetailStudentUid(stu.uid)}
                                className="font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-left cursor-pointer"
                              >
                                {stu.displayName}
                              </button>
                              {!stu.email.endsWith('@student.specialized.local') && (
                                <div className="text-[11px] text-slate-400">{stu.email}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500">
                              {stu.studentCode || stu.uid.slice(0, 8)}
                            </td>
                            <td className="py-2.5 px-3">
                              <select
                                aria-label={`${stu.displayName} sinfi`}
                                value={classCode}
                                onChange={(e) =>
                                  updateUserAdmin(stu.uid, { classCode: e.target.value })
                                }
                                className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-semibold text-blue-600 dark:text-blue-400"
                              >
                                {OFFICIAL_19_CLASS_CODES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2.5 px-3">{statusBadge(stu.status)}</td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setIntelligenceStudentUid(stu.uid)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold text-xs cursor-pointer transition-colors"
                                  title="8 ta bo'limdan iborat tahliliy profil"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Tahlil</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDetailStudentUid(stu.uid)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium cursor-pointer"
                                  title="Ma'lumotlarni tahrirlash"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Tahrir</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Pagination Footer */}
            {filteredStudents.length > pageSize && (
              <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Jami {filteredStudents.length} tadan {(currentPage - 1) * pageSize + 1}–
                  {Math.min(currentPage * pageSize, filteredStudents.length)} ko‘rsatilmoqda
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
         TAB 2: 9-STEP EXCEL STUDENT IMPORT (SECTIONS 05, 06, 07, 08, 15)
         ==================================================================== */}
      {pageTab === 'import' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                O‘quvchilarni yuklash (.xlsx / .csv)
              </h2>
              <p className="text-xs text-slate-500">
                Avtomatik ustun aniqlash, 19 ta sinfga guruhlash va alifbo tartibida saralash
              </p>
            </div>
            <a
              href="/api/students/import/template.xlsx"
              download="Specialized_Study_Students.xlsx"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold self-start"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel shablon (Specialized_Study_Students.xlsx)</span>
            </a>
          </div>

          {/* Step 1: File Upload */}
          <div className="p-5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                1-bosqich: Excel (.xlsx) yoki CSV (.csv) faylni tanlang (maks. 10 MB)
              </p>
              <p className="text-[11px] text-slate-500">
                O‘zbek, rus va ingliz tilidagi ustun nomlari avtomatik tanib olinadi (F.I.Sh., Familiya, Ism, Sinf, ID, Email).
              </p>
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>{importFileName ? 'Boshqa fayl tanlash' : 'Fayl tanlash'}</span>
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={handleExcelFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {importLoading && (
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-xs text-blue-700 dark:text-blue-300 font-medium">
              Excel fayl tahlil qilinmoqda...
            </div>
          )}

          {/* Step 2 & 3: Worksheet, Header Row & Smart Column Mapping */}
          {importPreview && (
            <div className="space-y-5">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    2–3-bosqich: Sahifa va ustunlarni moslashtirish ({importPreview.fileName})
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    {importPreview.sheets.length > 1 && (
                      <select
                        aria-label="Excel sahifasini tanlash"
                        value={selectedSheet}
                        onChange={(e) => {
                          const nextSheet = e.target.value;
                          setSelectedSheet(nextSheet);
                          runExcelPreview(
                            importBase64,
                            importFileName,
                            nextSheet,
                            undefined,
                            mappingOverride,
                            rowClassOverrides,
                            rowFieldOverrides
                          );
                        }}
                        className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium"
                      >
                        {importPreview.sheets.map((sh) => (
                          <option key={sh.name} value={sh.name}>
                            Sahifa: {sh.name} ({sh.rowCount} qator)
                          </option>
                        ))}
                      </select>
                    )}

                    <label className="flex items-center gap-1 text-slate-500">
                      <span>Sarlavha qatori:</span>
                      <input
                        type="number"
                        min={1}
                        max={15}
                        value={(selectedHeaderIdx ?? 0) + 1}
                        onChange={(e) => {
                          const idx = Math.max(0, Number(e.target.value) - 1);
                          setSelectedHeaderIdx(idx);
                          runExcelPreview(
                            importBase64,
                            importFileName,
                            selectedSheet,
                            idx,
                            mappingOverride,
                            rowClassOverrides,
                            rowFieldOverrides
                          );
                        }}
                        className="w-14 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-center"
                      />
                    </label>
                  </div>
                </div>

                {/* Column Mapping Selectors */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
                  {[
                    { key: 'fullNameCol', label: 'To‘liq F.I.Sh.' },
                    { key: 'lastNameCol', label: 'Familiya' },
                    { key: 'firstNameCol', label: 'Ism' },
                    { key: 'patronymicCol', label: 'Sharif' },
                    { key: 'classCodeCol', label: 'Sinf (Majburiy)' },
                    { key: 'studentIdCol', label: 'O‘quvchi ID' },
                    { key: 'emailCol', label: 'Email' },
                  ].map((col) => (
                    <div key={col.key}>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">
                        {col.label}
                      </label>
                      <select
                        value={(mappingOverride as any)[col.key] || ''}
                        onChange={(e) => {
                          const nextMap = {
                            ...mappingOverride,
                            [col.key]: e.target.value || undefined,
                          };
                          setMappingOverride(nextMap);
                          runExcelPreview(
                            importBase64,
                            importFileName,
                            selectedSheet,
                            selectedHeaderIdx,
                            nextMap,
                            rowClassOverrides,
                            rowFieldOverrides
                          );
                        }}
                        className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      >
                        <option value="">— Tanlanmagan —</option>
                        {importPreview.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 4, 5, 6 & 7: Summary Counters, Grouped Class Chips & Validation Preview */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block">Jami qatorlar</span>
                  <span className="text-lg font-bold font-mono tabular-nums">
                    {importPreview.totalRows}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block">
                    Yangi o‘quvchilar
                  </span>
                  <span className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                    {importPreview.newStudentsCount}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                  <span className="text-[11px] text-amber-700 dark:text-amber-300 block">
                    Takroriylar
                  </span>
                  <span className="text-lg font-bold font-mono tabular-nums text-amber-700 dark:text-amber-300">
                    {importPreview.duplicatesCount}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60">
                  <span className="text-[11px] text-rose-700 dark:text-rose-300 block">
                    Xatolar (ERROR)
                  </span>
                  <span className="text-lg font-bold font-mono tabular-nums text-rose-700 dark:text-rose-300">
                    {importPreview.errorsCount}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60">
                  <span className="text-[11px] text-blue-700 dark:text-blue-300 block">
                    Ogohlantirishlar
                  </span>
                  <span className="text-lg font-bold font-mono tabular-nums text-blue-700 dark:text-blue-300">
                    {importPreview.warningsCount}
                  </span>
                </div>
              </div>

              {/* Automatic Class Grouping Summary (Step 5) */}
              {importPreview.classGroups.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Sinflar bo‘yicha avtomatik guruhlash:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewClassChip('ALL')}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                        previewClassChip === 'ALL'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Barchasi ({importPreview.totalRows})
                    </button>
                    {importPreview.classGroups.map((grp) => (
                      <button
                        key={grp.classCode}
                        type="button"
                        onClick={() => setPreviewClassChip(grp.classCode)}
                        className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold cursor-pointer ${
                          previewClassChip === grp.classCode
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {grp.classCode} ({grp.totalCount})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Filter Tabs & Duplicate Policy & Confirm Action */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { id: 'ALL', label: `Barchasi (${importPreview.totalRows})` },
                    { id: 'VALID', label: `Yangi (${importPreview.newStudentsCount})` },
                    { id: 'DUPLICATE', label: `Takroriylar (${importPreview.duplicatesCount})` },
                    { id: 'ERROR', label: `Xatolar (${importPreview.errorsCount})` },
                    { id: 'WARNING', label: `Ogohlantirishlar (${importPreview.warningsCount})` },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPreviewCategoryTab(t.id as any)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                        previewCategoryTab === t.id
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    aria-label="Takroriy yozuvlar siyosati"
                    value={duplicatePolicy}
                    onChange={(e) => setDuplicatePolicy(e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                  >
                    <option value="skip_existing">Takroriylarni o‘tkazib yuborish</option>
                    <option value="update_existing">Takroriylarni yangilash</option>
                  </select>

                  <button
                    type="button"
                    disabled={importLoading || importPreview.totalRows === 0}
                    onClick={handleConfirmExcelImport}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Tasdiqlash va saqlash</span>
                  </button>
                </div>
              </div>

              {/* Step 9: Import Results Banner & Downloadable Reports */}
              {importFinishedResult && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="font-bold text-emerald-900 dark:text-emerald-200">
                      Import muvaffaqiyatli yakunlandi!
                    </div>
                    <div className="text-emerald-800 dark:text-emerald-300 font-mono">
                      Muvaffaqiyatli: {importFinishedResult.importedCount} ta · Yangilandi:{' '}
                      {importFinishedResult.updatedCount} ta · O‘tkazib yuborildi:{' '}
                      {importFinishedResult.skippedCount} ta · Xatolar:{' '}
                      {importFinishedResult.errorCount} ta
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadPreviewReport('all')}
                      className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-emerald-300 text-emerald-700 font-semibold cursor-pointer"
                    >
                      Import hisoboti (.xlsx)
                    </button>
                    {importPreview.errorsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleDownloadPreviewReport('invalid')}
                        className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-rose-300 text-rose-700 font-semibold cursor-pointer"
                      >
                        Xato qatorlar (.xlsx)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPageTab('directory')}
                      className="px-3 py-1.5 rounded bg-emerald-600 text-white font-semibold cursor-pointer"
                    >
                      Ro‘yxatga o‘tish →
                    </button>
                  </div>
                </div>
              )}

              {/* Preview Rows Table with Inline Class & Name Fixing */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-2 px-3 w-12">№</th>
                      <th className="py-2 px-3">F.I.Sh. (Alifbo tartibida)</th>
                      <th className="py-2 px-3 w-36">Sinf (19 rasmiy)</th>
                      <th className="py-2 px-3 w-28">ID</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3">Holat / Tekshiruv</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {importPreview.rows
                      .filter((r) => {
                        if (previewClassChip !== 'ALL' && r.normalizedClassCode !== previewClassChip) {
                          return false;
                        }
                        if (previewCategoryTab === 'VALID') {
                          return r.status === 'valid' || r.status === 'warning';
                        }
                        if (previewCategoryTab === 'DUPLICATE') return r.status === 'duplicate';
                        if (previewCategoryTab === 'ERROR') return r.status === 'error';
                        if (previewCategoryTab === 'WARNING') {
                          return r.issues.some((i) => i.severity === 'WARNING');
                        }
                        return true;
                      })
                      .map((row) => (
                        <tr key={row.rowNumber} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-mono text-slate-400">{row.rowNumber}</td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.fullName}
                              onChange={(e) => {
                                const nextFld = {
                                  ...rowFieldOverrides,
                                  [row.rowNumber]: {
                                    ...(rowFieldOverrides[row.rowNumber] || {}),
                                    fullName: e.target.value,
                                  },
                                };
                                setRowFieldOverrides(nextFld);
                                runExcelPreview(
                                  importBase64,
                                  importFileName,
                                  selectedSheet,
                                  selectedHeaderIdx,
                                  mappingOverride,
                                  rowClassOverrides,
                                  nextFld
                                );
                              }}
                              className="w-full px-2 py-1 rounded border border-transparent hover:border-slate-200 focus:border-blue-500 bg-transparent font-medium"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              aria-label={`${row.fullName} sinfini tanlash`}
                              value={row.normalizedClassCode || ''}
                              onChange={(e) => {
                                const nextCls = {
                                  ...rowClassOverrides,
                                  [row.rowNumber]: e.target.value,
                                };
                                setRowClassOverrides(nextCls);
                                runExcelPreview(
                                  importBase64,
                                  importFileName,
                                  selectedSheet,
                                  selectedHeaderIdx,
                                  mappingOverride,
                                  nextCls,
                                  rowFieldOverrides
                                );
                              }}
                              className={`px-2 py-1 rounded border font-mono font-bold text-xs ${
                                row.normalizedClassCode
                                  ? 'border-slate-200 dark:border-slate-700 text-blue-600 bg-white dark:bg-slate-900'
                                  : 'border-rose-400 bg-rose-50 text-rose-700'
                              }`}
                            >
                              <option value="">Noto‘g‘ri sinf ({row.rawClassCode || '—'})</option>
                              {OFFICIAL_19_CLASS_CODES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-500">
                            {row.studentId || 'Avto'}
                          </td>
                          <td className="py-2 px-3 text-slate-500">{row.email || '—'}</td>
                          <td className="py-2 px-3">
                            {row.status === 'error' ? (
                              <span className="text-rose-600 font-medium">
                                {row.issues.filter((i) => i.severity === 'ERROR').map((i) => i.message).join(' ')}
                              </span>
                            ) : row.status === 'duplicate' ? (
                              <span className="text-amber-600 font-medium">
                                Takroriy: {row.duplicateReason}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-medium">Tayyor</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
         TAB 3: IMPORT HISTORY & SAFE ROLLBACK (SECTION 08)
         ==================================================================== */}
      {pageTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {studentImportJobs.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              Hozircha Excel import amaliyotlari tarixi mavjud emas.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                  <th className="py-2.5 px-4">Fayl nomi</th>
                  <th className="py-2.5 px-4">Sana</th>
                  <th className="py-2.5 px-4">Yuklandi</th>
                  <th className="py-2.5 px-4">O‘tkazildi</th>
                  <th className="py-2.5 px-4">Xatolar</th>
                  <th className="py-2.5 px-4">Holat</th>
                  <th className="py-2.5 px-4 text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {studentImportJobs.map((job) => (
                  <tr key={job.id}>
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {job.fileName}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">
                      {new Date(job.createdAt).toLocaleString('uz-UZ')}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-emerald-600">
                      {job.importedCount}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-amber-600">{job.skippedCount}</td>
                    <td className="py-2.5 px-4 font-mono text-rose-600">{job.errorCount}</td>
                    <td className="py-2.5 px-4">
                      {job.status === 'rolled_back' ? (
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-medium">
                          Bekor qilingan
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium">
                          Yakunlangan
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {job.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() => rollbackStudentImportJob(job.jobId)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 font-semibold cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Bekor qilish (Rollback)</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ====================================================================
         STUDENT DETAIL VIEW SLIDE-OVER / MODAL (SECTION 04)
         ==================================================================== */}
      {activeDetailStudent && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full max-w-lg h-full flex flex-col justify-between overflow-y-auto p-6 shadow-2xl">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-mono text-xs font-bold">
                      {activeDetailStudent.classCode || '7a1'}
                    </span>
                    {statusBadge(activeDetailStudent.status)}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                    {activeDetailStudent.displayName}
                  </h3>
                  <p className="text-xs font-mono text-slate-400">
                    ID: {activeDetailStudent.studentCode || activeDetailStudent.uid}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDetailStudentUid(null);
                    setSearchParams({});
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 5 Student Detail Sections: PROFILE, LEARNING, ACTIVITY, PROGRESS, ACTIONS */}
              <div className="flex flex-wrap gap-1 border-b border-slate-100 dark:border-slate-800 pb-2">
                {[
                  { id: 'profile', label: 'Profil' },
                  { id: 'learning', label: 'O‘quv dasturi' },
                  { id: 'activity', label: 'Faollik' },
                  { id: 'progress', label: 'O‘zlashtirish' },
                  { id: 'actions', label: 'Amallar' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDetailTab(t.id as any)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      detailTab === t.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {detailTab === 'profile' && (
                <form onSubmit={handleSaveStudentDetail} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      To‘liq F.I.Sh.
                    </label>
                    <input
                      type="text"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Familiya
                      </label>
                      <input
                        type="text"
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Ism
                      </label>
                      <input
                        type="text"
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Sharif
                      </label>
                      <input
                        type="text"
                        value={editPatronymic}
                        onChange={(e) => setEditPatronymic(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Sinf
                      </label>
                      <select
                        value={editClassCode}
                        onChange={(e) => setEditClassCode(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-blue-600"
                      >
                        {OFFICIAL_19_CLASS_CODES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        O‘quvchi ID
                      </label>
                      <input
                        type="text"
                        value={editStudentCode}
                        onChange={(e) => setEditStudentCode(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="Ixtiyoriy"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                  >
                    Saqlash
                  </button>
                </form>
              )}

              {detailTab === 'learning' && (
                <div className="space-y-3 text-xs">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    Biriktirilgan fanlar ({activeDetailStudent.classCode || '7a1'}):
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {subjects
                      .filter(
                        (s) =>
                          isSubjectCompatibleWithClass(
                            s.name,
                            activeDetailStudent.classCode || '7a1',
                            subjects
                          ).compatible
                      )
                      .map((subj) => {
                        const subjLessons = lessons.filter(
                          (l) =>
                            l.classCode.toLowerCase() ===
                              (activeDetailStudent.classCode || '7a1').toLowerCase() &&
                            l.subjectName.toLowerCase() === subj.name.toLowerCase()
                        );
                        return (
                          <div
                            key={subj.id}
                            className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                          >
                            <span className="font-semibold">{subj.name}</span>
                            <span className="font-mono text-slate-500">
                              {subjLessons.length} ta dars
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {detailTab === 'activity' && (
                <div className="space-y-2 text-xs">
                  {attempts
                    .filter((a) => a.studentId === activeDetailStudent.uid)
                    .map((att) => (
                      <div
                        key={att.id}
                        className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold">{att.assessmentTitle}</div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(att.submittedAt).toLocaleDateString('uz-UZ')}
                          </div>
                        </div>
                        <span className="font-mono font-bold text-blue-600">
                          {att.scorePercent}%
                        </span>
                      </div>
                    ))}
                  {attempts.filter((a) => a.studentId === activeDetailStudent.uid).length === 0 && (
                    <p className="text-slate-400 py-4">Hozircha yechilgan testlar yo‘q.</p>
                  )}
                </div>
              )}

              {detailTab === 'progress' && (
                <div className="space-y-2 text-xs">
                  {masteryRecords
                    .filter((m) => m.studentId === activeDetailStudent.uid)
                    .map((m) => (
                      <div
                        key={m.id}
                        className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold">{m.topicName}</div>
                          <div className="text-[11px] text-slate-400">{m.statusLabel}</div>
                        </div>
                        <span className="font-mono font-bold text-emerald-600">{m.accuracy}%</span>
                      </div>
                    ))}
                  {masteryRecords.filter((m) => m.studentId === activeDetailStudent.uid).length ===
                    0 && (
                    <p className="text-slate-400 py-4">
                      O‘zlashtirish ko‘rsatkichlari birinchi testdan so‘ng shakllanadi.
                    </p>
                  )}
                </div>
              )}

              {detailTab === 'actions' && (
                <div className="space-y-2.5 text-xs">
                  <button
                    type="button"
                    onClick={async () => {
                      const cls = classes.find(
                        (c) =>
                          c.id === activeDetailStudent.classId ||
                          c.code === activeDetailStudent.classCode
                      );
                      const res = await createInvitation({
                        inviteeName: activeDetailStudent.displayName,
                        email: activeDetailStudent.email,
                        role: 'student',
                        classId: cls?.id,
                      });
                      setGeneratedToken(res.rawToken);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold text-left cursor-pointer"
                  >
                    Bir martalik taklif kodi yaratish
                  </button>

                  {generatedToken && (
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 font-mono font-bold flex items-center justify-between">
                      <span>{generatedToken}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedToken);
                          addToast('info', 'Nusxalandi');
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <a
                    href={`/api/students/export.xlsx?uids=${encodeURIComponent(activeDetailStudent.uid)}`}
                    download
                    className="block w-full py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold"
                  >
                    Excel formatda eksport qilish (.xlsx)
                  </a>

                  <button
                    type="button"
                    onClick={() =>
                      updateUserAdmin(activeDetailStudent.uid, {
                        status:
                          activeDetailStudent.status === 'suspended' ? 'active' : 'suspended',
                      })
                    }
                    className="w-full py-2 px-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold text-left cursor-pointer"
                  >
                    {activeDetailStudent.status === 'suspended'
                      ? 'Hisobni faollashtirish'
                      : 'Hisobni vaqtincha to‘xtatish'}
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await updateUserAdmin(activeDetailStudent.uid, { status: 'archived' });
                      setDetailStudentUid(null);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 font-semibold text-left flex items-center gap-1.5 cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Arxivlash</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Direct Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                O‘quvchi qo‘shish
              </h3>
              <button type="button" onClick={() => setShowAddModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateStudent} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">F.I.Sh.</label>
                <input
                  type="text"
                  required
                  value={stuName}
                  onChange={(e) => setStuName(e.target.value)}
                  placeholder="Masalan: Sardor Aliyev"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={stuEmail}
                  onChange={(e) => setStuEmail(e.target.value)}
                  placeholder="sardor@specialized.uz"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Sinf</label>
                  <select
                    value={stuClassCode}
                    onChange={(e) => setStuClassCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                  >
                    {OFFICIAL_19_CLASS_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Parol</label>
                  <input
                    type="text"
                    value={stuPassword}
                    onChange={(e) => setStuPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Student Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Taklif kodi yaratish
              </h3>
              <button type="button" onClick={() => setShowInviteModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateStudentInvite} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">F.I.Sh.</label>
                <input
                  type="text"
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
                  placeholder="Masalan: Madina Karimova"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Sinf</label>
                <select
                  value={invClassCode}
                  onChange={(e) => setInvClassCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                >
                  {OFFICIAL_19_CLASS_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Yaratish
              </button>
            </form>

            {generatedToken && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded border border-emerald-200 font-mono font-bold">
                  <span>{generatedToken}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedToken);
                      addToast('info', 'Nusxalandi');
                    }}
                  >
                    <Copy className="w-3.5 h-3.5 text-blue-600" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Student Intelligence View Modal (8 Compact Tabs) */}
      {intelligenceStudentUid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setIntelligenceStudentUid(null)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer z-10"
              aria-label="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
            <StudentIntelligenceView
              studentId={intelligenceStudentUid}
              onClose={() => setIntelligenceStudentUid(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/* ==========================================================================
   4. FANLAR — SUBJECTS PAGE
   ========================================================================== */

export const AdminSubjectsPage: React.FC = () => {
  const { subjects, topics, lessons, questions, assessments, createSubject } = useLearnOS();

  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [track, setTrack] = useState<'A' | 'T' | 'BOTH'>('BOTH');
  const [description, setDescription] = useState('');

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createSubject({
      name: name.trim(),
      code: code.trim() || undefined,
      track,
      description: description.trim(),
    });
    setName('');
    setCode('');
    setDescription('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <span className="text-xs text-slate-500">Jami fanlar: {subjects.length} ta</span>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Fan qo‘shish</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map((subj) => {
          const subjTopics = topics.filter(
            (t) => t.subject.toLowerCase() === subj.name.toLowerCase()
          );
          const subjLessons = lessons.filter(
            (l) => l.subjectName.toLowerCase() === subj.name.toLowerCase()
          );
          const subjQuestions = questions.filter(
            (q) => q.subject.toLowerCase() === subj.name.toLowerCase()
          );
          const subjTests = assessments.filter(
            (a) => a.subject.toLowerCase() === subj.name.toLowerCase()
          );

          return (
            <div
              key={subj.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono text-xs font-bold">
                    {subj.code || subj.name.slice(0, 3).toUpperCase()}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {(subj.trackTypes || []).join(' va ')} yo‘nalishi
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">{subj.name}</h2>
                <p className="text-xs text-slate-500">{subj.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-4 gap-2 text-center text-xs font-mono tabular-nums">
                <div>
                  <span className="block text-[10px] font-sans text-slate-400">Mavzu</span>
                  <span className="font-bold">{subjTopics.length}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-slate-400">Dars</span>
                  <span className="font-bold">{subjLessons.length}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-slate-400">Savol</span>
                  <span className="font-bold">{subjQuestions.length}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-sans text-slate-400">Test</span>
                  <span className="font-bold">{subjTests.length}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Fan qo‘shish</h3>
              <button type="button" onClick={() => setShowAddModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddSubject} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nomi</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Kod</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Yo‘nalish</label>
                  <select
                    value={track}
                    onChange={(e) => setTrack(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="BOTH">A va T</option>
                    <option value="A">A yo‘nalishi</option>
                    <option value="T">T yo‘nalishi</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
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

/* ==========================================================================
   5. ISH REJALARI — OFFICIAL CURRICULUM ZIP & WORK PLAN IMPORT ENGINE
   ========================================================================== */

const EVENT_CATEGORY_LABELS: Record<NormalizedLessonEventType, string> = {
  REGULAR_LESSON: 'Oddiy dars',
  WRITTEN_ASSESSMENT: 'BSB / Yozma ish',
  QUARTERLY_ASSESSMENT: 'CHSB / Choraklik baholash',
  PROJECT_WORK: 'Loyiha ishi',
  REVIEW_AND_ANALYSIS: 'Tahlil va takrorlash',
  OTHER: 'Boshqa',
};

const LegacyWorkPlansPage: React.FC = () => {
  const {
    subjects,
    workPlans,
    lessons,
    curriculumImportJobs,
    analyzeWorkPlan,
    confirmWorkPlan,
    deleteWorkPlan,
    previewCurriculumZipArchive,
    confirmCurriculumZipArchive,
    updateTTrackMathVisibility,
    addToast,
  } = useLearnOS();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Official ZIP Archive Import State
  const [zipSource, setZipSource] = useState<{ useOfficialAttachedArchive?: boolean; fileName?: string; base64Data?: string }>({ useOfficialAttachedArchive: true });
  const [zipLoading, setZipLoading] = useState(false);
  const [zipConfirming, setZipConfirming] = useState(false);
  const [zipPreview, setZipPreview] = useState<CurriculumZipImportPreview | null>(null);
  const [zipPublishImmediately, setZipPublishImmediately] = useState(true);
  const [zipTTrackVisible, setZipTTrackVisible] = useState(false);
  const [inspectedWorkbook, setInspectedWorkbook] = useState<CurriculumWorkbookPreview | null>(null);
  const [inspectedWorkPlan, setInspectedWorkPlan] = useState<WorkPlan | null>(null);

  // Filter for confirmed work plans
  const [trackFilter, setTrackFilter] = useState<'ALL' | 'A' | 'T'>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [showSingleUpload, setShowSingleUpload] = useState(false);

  // Single WorkPlan Import State
  const initialClass = searchParams.get('class') || '7a1';
  const [classCode, setClassCode] = useState<string>(initialClass);
  const compatibleSubjects = subjects.filter(
    (s) => isSubjectCompatibleWithClass(s.name, classCode, subjects).compatible
  );
  const [subject, setSubject] = useState<string>(compatibleSubjects[0]?.name || 'Matematika');
  const [academicYear, setAcademicYear] = useState<string>('2026-2027');
  const [quarter, setQuarter] = useState<number>(1);
  const [planType, setPlanType] = useState<WorkPlanType>('quarterly');

  const [fileName, setFileName] = useState<string>('');
  const [base64Data, setBase64Data] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');

  const [analyzing, setAnalyzing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [previewRows, setPreviewRows] = useState<WorkPlanRowItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [publishImmediately, setPublishImmediately] = useState(true);

  useEffect(() => {
    const compat = subjects.filter(
      (s) => isSubjectCompatibleWithClass(s.name, classCode, subjects).compatible
    );
    if (compat.length > 0 && !compat.some((s) => s.name === subject)) {
      setSubject(compat[0].name);
    }
  }, [classCode, subjects]);

  const tTrackWorkPlans = workPlans.filter((w) => w.track === 'T' || w.additionalCurriculumAssignment);
  const isTTrackCurrentlyApproved = tTrackWorkPlans.some((w) => w.tTrackVisibilityApproved === true);

  const handleLoadOfficialZipPreview = async () => {
    setZipLoading(true);
    try {
      const preview = await previewCurriculumZipArchive({ useOfficialAttachedArchive: true });
      setZipSource({ useOfficialAttachedArchive: true });
      setZipPreview(preview);
      setZipTTrackVisible(Boolean(preview.tTrackVisibilityApproved));
    } finally {
      setZipLoading(false);
    }
  };

  const handleZipFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setZipLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const b64 = String(reader.result || '');
        const preview = await previewCurriculumZipArchive({
          fileName: file.name,
          base64Data: b64,
        });
        setZipSource({ fileName: file.name, base64Data: b64 });
        setZipSource({ fileName: file.name, base64Data: b64 });
        setZipPreview(preview);
      } finally {
        setZipLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmZipImport = async () => {
    if (!zipPreview) return;
    setZipConfirming(true);
    try {
      await confirmCurriculumZipArchive({
        ...zipSource,
        academicYear,
        publishImmediately: zipPublishImmediately,
        tTrackVisibilityApproved: zipTTrackVisible,
      });
      setZipPreview(null);
    } finally {
      setZipConfirming(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setBase64Data(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await analyzeWorkPlan({
        fileName: fileName || `${classCode}_${subject}_ish_reja.xlsx`,
        base64Data: base64Data || undefined,
        rawText: rawText.trim() || undefined,
        classCode,
        subject,
        academicYear,
        quarter,
        planType,
      });
      setPreviewRows(res.rows);
      setWarnings(res.warnings || []);
      addToast('success', `${res.rows.length} ta dars ajratib olindi`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (previewRows.length === 0) return;
    setConfirming(true);
    try {
      await confirmWorkPlan({
        title: `${classCode.toUpperCase()} — ${subject} (${quarter}-chorak)`,
        fileName: fileName || `${classCode}_${subject}_ish_reja.xlsx`,
        classCode,
        subject,
        academicYear,
        quarter,
        planType,
        rows: previewRows,
        publishImmediately,
      });
      setPreviewRows([]);
      navigate(`/admin/lessons?class=${classCode}`);
    } finally {
      setConfirming(false);
    }
  };

  const filteredWorkPlans = workPlans.filter((wp) => {
    if (trackFilter !== 'ALL' && wp.track !== trackFilter) return false;
    if (
      areaFilter !== 'ALL' &&
      (wp.curriculumArea || wp.subjectName || wp.subject) !== areaFilter
    ) {
      return false;
    }
    return true;
  });

  const totalImportedLessons = workPlans.reduce(
    (acc, wp) => acc + (wp.totalLessons || wp.rows?.length || 0),
    0
  );
  const totalImportedHours = workPlans.reduce(
    (acc, wp) => acc + (wp.totalHours || wp.rows?.reduce((s, r) => s + (r.hours || 1), 0) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Summary & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Ish rejalari
          </h2>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            Tasdiqlangan ish rejalari: {workPlans.length} ta fayl · Jami darslar: {totalImportedLessons} ta ({totalImportedHours} soat) · O‘quv xaritasi yozuvlari: {lessons.length} ta
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={zipLoading}
            onClick={handleLoadOfficialZipPreview}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>
              {zipLoading
                ? 'ZIP arxiv tahlil qilinmoqda...'
                : 'Rasmiy Matematika ZIP arxivini ko‘rib chiqish (21 fayl)'}
            </span>
          </button>

          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>ZIP arxiv yuklash (.zip)</span>
            <input
              type="file"
              accept=".zip"
              onChange={handleZipFileUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => setShowSingleUpload((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Alohida Excel yuklash</span>
          </button>

          <a
            href="/api/work-plans/template.xlsx"
            download
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Shablon</span>
          </a>
        </div>
      </div>

      {/* T-Track Additional Mathematics Curriculum Policy Control */}
      {tTrackWorkPlans.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              T yo‘nalishi (7t, 8t, 9t, 10t, 11t) qo‘shimcha Matematika / Algebra / Geometriya ish rejalari ({tTrackWorkPlans.length} ta fayl · {tTrackWorkPlans.reduce((total, p) => total + (p.totalHours || 0), 0)} soat)
            </p>
            <p className="text-xs text-slate-500">
              T yo‘nalishi asosiy ixtisoslik fanlari (Ingliz tili, Biologiya, Kimyo) o‘zgarishsiz qoladi. Qo‘shimcha matematika o‘quv rejasini o‘quvchi kabinetida ko‘rsatish admin tasdig‘i orqali boshqariladi.
            </p>
          </div>

          <button
            type="button"
            onClick={() => updateTTrackMathVisibility(!isTTrackCurrentlyApproved)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
              isTTrackCurrentlyApproved
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200'
            }`}
          >
            {isTTrackCurrentlyApproved
              ? 'T-sinf o‘quvchilariga ko‘rsatilmoqda (Yashirish)'
              : 'T-sinf o‘quvchilariga ko‘rsatishni yoqish'}
          </button>
        </div>
      )}

      {/* Official ZIP Import Preview Dashboard */}
      {zipPreview && (
        <div className="bg-white dark:bg-slate-900 border-2 border-blue-600 rounded-xl p-5 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-blue-600">
                Importni tekshirish
              </p>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {zipPreview.archiveName} — {zipPreview.totalFiles} ta ish reja ({zipPreview.totalLessons} ta dars · {zipPreview.totalHours} soat)
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={zipPublishImmediately}
                  onChange={(e) => setZipPublishImmediately(e.target.checked)}
                />
                <span>Darhol nashr qilish</span>
              </label>

              <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={zipTTrackVisible}
                  onChange={(e) => setZipTTrackVisible(e.target.checked)}
                />
                <span>T-sinf (7t–11t) o‘quvchilariga ham ko‘rsatish</span>
              </label>

              <button
                type="button"
                onClick={() => setZipPreview(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Bekor qilish
              </button>

              <button
                type="button"
                disabled={zipConfirming}
                onClick={handleConfirmZipImport}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{zipConfirming ? 'Saqlanmoqda...' : 'Tasdiqlash'}</span>
              </button>
            </div>
          </div>

          {/* Summary KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500">Jami fayllar</p>
              <p className="text-base font-bold font-mono tabular-nums mt-0.5">{zipPreview.totalFiles}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500">Aniq fanlar (A)</p>
              <p className="text-base font-bold font-mono tabular-nums text-blue-600 mt-0.5">
                {zipPreview.aTrackFiles} ta (1,666)
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500">Tabiiy fanlar (T)</p>
              <p className="text-base font-bold font-mono tabular-nums text-emerald-600 mt-0.5">
                {zipPreview.tTrackFiles} ta (850)
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500">Jami dars / soat</p>
              <p className="text-base font-bold font-mono tabular-nums mt-0.5">
                {zipPreview.totalLessons} / {zipPreview.totalHours}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500">1-chorak</p>
              <p className="text-base font-bold font-mono tabular-nums mt-0.5">
                {zipPreview.quarterBreakdown[1]} ta
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500">2-chorak</p>
              <p className="text-base font-bold font-mono tabular-nums mt-0.5">
                {zipPreview.quarterBreakdown[2]} ta
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500">3-chorak</p>
              <p className="text-base font-bold font-mono tabular-nums mt-0.5">
                {zipPreview.quarterBreakdown[3]} ta
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500">4-chorak</p>
              <p className="text-base font-bold font-mono tabular-nums mt-0.5">
                {zipPreview.quarterBreakdown[4]} ta
              </p>
            </div>
          </div>

          {/* Lesson Type & Event Category Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Asl dars turlari (Excel „Dars turi“ ustuni):
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600 dark:text-slate-400 font-mono">
                {Object.entries(zipPreview.lessonTypeBreakdown).map(([lt, count]) => (
                  <span key={lt}>
                    {lt}: <strong>{count}</strong>
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Tizimli tasniflangan o‘quv tadbirlari:
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600 dark:text-slate-400 font-mono">
                {Object.entries(zipPreview.eventCategoryBreakdown)
                  .filter(([, c]) => c > 0)
                  .map(([cat, count]) => (
                    <span key={cat}>
                      {EVENT_CATEGORY_LABELS[cat as NormalizedLessonEventType] || cat}:{' '}
                      <strong>{count}</strong>
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {/* 21 Workbooks Table */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">Fayl nomi</th>
                  <th className="py-2.5 px-3">Yo‘nalish</th>
                  <th className="py-2.5 px-3">Sinflar</th>
                  <th className="py-2.5 px-3">O‘quv bo‘limi</th>
                  <th className="py-2.5 px-3">Dars / Soat</th>
                  <th className="py-2.5 px-3">Choraklar (1/2/3/4)</th>
                  <th className="py-2.5 px-3 text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {zipPreview.workbooks.map((wb) => (
                  <tr key={wb.workbookId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                      {wb.fileName}
                    </td>
                    <td className="py-2 px-3">
                      {wb.track === 'A' ? 'Aniq fanlar (A)' : 'Tabiiy fanlar (T · Qo‘shimcha)'}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-blue-600">
                      {wb.assignedClassCodes.join(', ')}
                    </td>
                    <td className="py-2 px-3 font-semibold">{wb.curriculumArea}</td>
                    <td className="py-2 px-3 font-mono tabular-nums">
                      {wb.totalLessons} dars ({wb.totalHours} s)
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-slate-500">
                      {wb.quarterBreakdown[1]} / {wb.quarterBreakdown[2]} / {wb.quarterBreakdown[3]} /{' '}
                      {wb.quarterBreakdown[4]}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setInspectedWorkbook(wb)}
                        className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-semibold cursor-pointer"
                      >
                        Ko‘rib chiqish
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Optional Single Workbook Upload Box */}
      {showSingleUpload && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Alohida sinf uchun ish rejasi yuklash</h3>
            <button
              type="button"
              onClick={() => setShowSingleUpload(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Yopish
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Sinf
              </label>
              <select
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold text-blue-600"
              >
                {OFFICIAL_19_CLASS_CODES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Fan
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-semibold"
              >
                {compatibleSubjects.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Chorak
              </label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-semibold"
              >
                <option value={1}>1-chorak</option>
                <option value={2}>2-chorak</option>
                <option value={3}>3-chorak</option>
                <option value={4}>4-chorak</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                O‘quv yili
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 space-y-2">
              <label className="block font-semibold">Fayl yuklash (.xlsx, .csv, .pdf, .docx)</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.doc,.docx"
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-600 file:text-white file:font-semibold"
              />
            </div>
            <div>
              <textarea
                rows={3}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Yoki mavzularni har bir qatorda kiriting..."
                className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={analyzing}
              onClick={handleAnalyze}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{analyzing ? 'Tahlil qilinmoqda...' : 'Darslar jadvalini ko‘rish'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Single WorkPlan Preview Table */}
      {previewRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-blue-500 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold">
              {classCode.toUpperCase()} · {subject} ({previewRows.length} ta dars)
            </h3>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={publishImmediately}
                  onChange={(e) => setPublishImmediately(e.target.checked)}
                />
                <span>Nashr qilish</span>
              </label>
              <button
                type="button"
                disabled={confirming}
                onClick={handleConfirmImport}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{confirming ? 'Saqlanmoqda...' : 'Tasdiqlash'}</span>
              </button>
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-200">
              {warnings.map((w, i) => (
                <p key={i}>• {w}</p>
              ))}
            </div>
          )}

          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 px-3 w-14">Dars tartibi</th>
                  <th className="py-2 px-3">Mavzu nomi</th>
                  <th className="py-2 px-3">Dars turi</th>
                  <th className="py-2 px-3">Sinf ishi</th>
                  <th className="py-2 px-3">Uyga vazifa</th>
                  <th className="py-2 px-3">O‘quv davri</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {previewRows.map((row, idx) => (
                  <tr key={row.rowId || idx}>
                    <td className="py-1.5 px-3 font-mono">{row.lessonNumber}</td>
                    <td className="py-1.5 px-3 font-medium">
                      {row.lessonTitle || row.topicName}
                    </td>
                    <td className="py-1.5 px-3 text-slate-500">{row.lessonType || 'Oddiy dars-31'}</td>
                    <td className="py-1.5 px-3 text-slate-500">{row.classwork || '—'}</td>
                    <td className="py-1.5 px-3 text-slate-500">{row.homework || '—'}</td>
                    <td className="py-1.5 px-3 font-mono text-slate-500">
                      {row.quarterLabel || `${row.quarter || quarter}-chorak`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filter Bar for Confirmed Work Plans */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {[
            { id: 'ALL', label: `Barchasi (${workPlans.length})` },
            {
              id: 'A',
              label: `Aniq fanlar — A (${workPlans.filter((w) => w.track === 'A').length})`,
            },
            {
              id: 'T',
              label: `Tabiiy fanlar — T (${workPlans.filter((w) => w.track === 'T').length})`,
            },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTrackFilter(t.id as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                trackFilter === t.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {['ALL', 'Matematika', 'Algebra', 'Geometriya'].map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => setAreaFilter(area)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                areaFilter === area
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {area === 'ALL' ? 'Barcha bo‘limlar' : area}
            </button>
          ))}
        </div>
      </div>

      {/* Confirmed Work Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWorkPlans.map((wp) => {
          const assignedCodes =
            wp.classCodes && wp.classCodes.length > 0 ? wp.classCodes : [wp.classCode];
          const areaLabel = wp.curriculumArea || wp.subjectName || wp.subject || '';
          return (
            <div
              key={wp.id}
              className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 text-xs"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {assignedCodes.join(', ')}
                  </span>
                  <span className="text-slate-500 font-mono">
                    {wp.grade}-sinf · {wp.track}-yo‘nalish
                  </span>
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {wp.title || wp.fileName}
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    Bo‘lim: <strong className="text-slate-700 dark:text-slate-300">{areaLabel || 'Umumiy'}</strong> ·{' '}
                    {wp.totalLessons || wp.rows.length} ta dars ({wp.totalHours || wp.rows.length} soat)
                  </p>
                </div>

                {wp.quarterBreakdown && (
                  <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                    Choraklar: 1-ch ({wp.quarterBreakdown[1]}) · 2-ch ({wp.quarterBreakdown[2]}) · 3-ch ({wp.quarterBreakdown[3]}) · 4-ch ({wp.quarterBreakdown[4]})
                  </p>
                )}

                {wp.additionalCurriculumAssignment && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    Qo‘shimcha o‘quv reja · O‘quvchilarga:{' '}
                    {wp.tTrackVisibilityApproved ? 'Ko‘rsatilgan' : 'Yashirilgan'}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInspectedWorkPlan(wp)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-semibold cursor-pointer"
                  >
                    Ko‘rib chiqish
                  </button>
                  <Link
                    to={`/admin/lessons?class=${assignedCodes[0]}&area=${encodeURIComponent(
                      areaLabel
                    )}`}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold"
                  >
                    O‘quv xaritasi
                  </Link>
                </div>
                <button
                  type="button"
                  aria-label={`${wp.title} ish rejasini o‘chirish`}
                  onClick={() => deleteWorkPlan(wp.id)}
                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Workbook / WorkPlan Row Inspection Modal */}
      {(inspectedWorkbook || inspectedWorkPlan) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-5xl w-full p-5 space-y-4 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <p className="text-xs text-blue-600 font-semibold">
                  {inspectedWorkbook
                    ? `${inspectedWorkbook.assignedClassCodes.join(', ')} · ${inspectedWorkbook.curriculumArea}`
                    : `${(inspectedWorkPlan?.classCodes || [inspectedWorkPlan?.classCode]).join(', ')} · ${
                        inspectedWorkPlan?.curriculumArea || inspectedWorkPlan?.subjectName
                      }`}
                </p>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {inspectedWorkbook?.fileName || inspectedWorkPlan?.title} (
                  {(inspectedWorkbook?.rows || inspectedWorkPlan?.rows || []).length} ta dars)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInspectedWorkbook(null);
                  setInspectedWorkPlan(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 sticky top-0">
                  <tr>
                    <th className="py-2 px-3 w-16">Dars №</th>
                    <th className="py-2 px-3">Mavzu nomi</th>
                    <th className="py-2 px-3">Dars turi</th>
                    <th className="py-2 px-3">Sinf ishi</th>
                    <th className="py-2 px-3">Uyga vazifa</th>
                    <th className="py-2 px-3 w-14">Soat</th>
                    <th className="py-2 px-3 w-24">O‘quv davri</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(inspectedWorkbook?.rows || inspectedWorkPlan?.rows || []).map((r, i) => (
                    <tr key={r.rowId || i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-mono font-bold">{r.lessonNumber}</td>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                        {r.lessonTitle || r.topicName}
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                        {r.lessonType}
                      </td>
                      <td className="py-2 px-3 text-slate-500">{r.classwork || '—'}</td>
                      <td className="py-2 px-3 text-slate-500">{r.homework || '—'}</td>
                      <td className="py-2 px-3 font-mono">{r.hours ?? 1}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">
                        {r.quarterLabel || `${r.quarter}-chorak`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setInspectedWorkbook(null);
                  setInspectedWorkPlan(null);
                }}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ==========================================================================
   6. DARSLAR & O'QUV XARITASI — INTELLIGENT CURRICULUM ROADMAP ENGINE
   ========================================================================== */

export const AdminCurriculumMapPage: React.FC = () => {
  const {
    subjects,
    lessons,
    createLesson,
    updateLesson,
    deleteLesson,
    bulkUpdateLessonsStatus,
    generateLessonAssessment,
    batchGenerateLessonAssessments,
    fetchCalendarEvents,
  } = useLearnOS();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [viewMode, setViewMode] = useState<'roadmap2' | 'lessons' | 'calendar'>(
    location.pathname.includes('/admin/lessons') ? 'lessons' : 'roadmap2'
  );
  const [calendarSubView, setCalendarSubView] = useState<'month' | 'week' | 'agenda'>('agenda');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);

  useEffect(() => {
    if (location.pathname.includes('/admin/lessons')) {
      setViewMode('lessons');
    } else if (location.pathname.includes('/admin/curriculum-map')) {
      setViewMode('roadmap2');
    }
  }, [location.pathname]);

  // Multi-Dimensional Curriculum Filters
  const [gradeFilter, setGradeFilter] = useState<string>(searchParams.get('grade') || 'ALL');
  const [classFilter, setClassFilter] = useState<string>(searchParams.get('class') || 'ALL');
  const [trackFilter, setTrackFilter] = useState<string>(searchParams.get('track') || 'ALL');
  const [areaFilter, setAreaFilter] = useState<string>(searchParams.get('area') || 'ALL');
  const [quarterFilter, setQuarterFilter] = useState<string>(searchParams.get('quarter') || 'ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const PAGE_SIZE = 50;

  // Multi-selection for Batch AI Test Generation
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);

  // Modals: Add Lesson, Lesson Detail/Edit, Single/Milestone Test Gen, Batch Test Gen
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonItem | null>(null);
  const [testTargetLesson, setTestTargetLesson] = useState<LessonItem | null>(null);
  const [showBatchTestModal, setShowBatchTestModal] = useState(false);

  // Add Lesson Form State
  const [newLessonClass, setNewLessonClass] = useState<string>(
    searchParams.get('class') || '7a1'
  );
  const [newLessonSubject, setNewLessonSubject] = useState<string>('Matematika');
  const [newLessonArea, setNewLessonArea] = useState<string>('Algebra');
  const [newLessonQuarter, setNewLessonQuarter] = useState<number>(1);
  const [newLessonNumber, setNewLessonNumber] = useState<number>(1);
  const [newLessonTopic, setNewLessonTopic] = useState<string>('');
  const [newLessonType, setNewLessonType] = useState<string>('Oddiy dars-31');
  const [newLessonClasswork, setNewLessonClasswork] = useState<string>('');
  const [newLessonHomework, setNewLessonHomework] = useState<string>('');
  const [newLessonNotes, setNewLessonNotes] = useState<string>('');
  const [newLessonDate, setNewLessonDate] = useState<string>('');
  const [newLessonStatus, setNewLessonStatus] = useState<LessonStatus>('published');

  // AI Test Generation Config State
  const [testQuestionCount, setTestQuestionCount] = useState<number>(5);
  const [testDifficulty, setTestDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');
  const [testQuestionTypes, setTestQuestionTypes] = useState<QuestionType[]>([
    'single_choice',
    'multiple_choice',
    'numeric',
    'short_text',
    'written_open',
  ]);
  const [testDurationMinutes, setTestDurationMinutes] = useState<number>(30);
  const [testMaxPoints, setTestMaxPoints] = useState<number>(25);
  const [testReferenceText, setTestReferenceText] = useState<string>('');
  const [testPublishImmediately, setTestPublishImmediately] = useState<boolean>(true);
  const [batchTestTitle, setBatchTestTitle] = useState<string>('');
  const [generatingTest, setGeneratingTest] = useState<boolean>(false);

  useEffect(() => {
    setPage(1);
  }, [gradeFilter, classFilter, trackFilter, areaFilter, quarterFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    if (viewMode === 'calendar') {
      fetchCalendarEvents({
        classCode: classFilter !== 'ALL' ? classFilter : undefined,
        subject: areaFilter !== 'ALL' ? areaFilter : undefined,
        type: eventTypeFilter !== 'ALL' ? eventTypeFilter : undefined,
      }).then(setCalendarEvents);
    }
  }, [viewMode, classFilter, areaFilter, eventTypeFilter, fetchCalendarEvents, lessons]);

  const filteredLessons = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    return lessons
      .filter((l) => {
        if (gradeFilter !== 'ALL' && String(l.grade) !== gradeFilter) return false;
        if (classFilter !== 'ALL') {
          const target = classFilter.toLowerCase();
          const matchesPrimary = l.classCode?.toLowerCase() === target;
          const matchesShared =
            Array.isArray(l.classCodes) &&
            l.classCodes.some((c) => c.toLowerCase() === target);
          if (!matchesPrimary && !matchesShared) return false;
        }
        if (trackFilter !== 'ALL' && l.track !== trackFilter) return false;
        if (areaFilter !== 'ALL') {
          const area = (l.curriculumArea || l.subjectName || l.subject || '').toLowerCase();
          if (area !== areaFilter.toLowerCase()) return false;
        }
        if (quarterFilter !== 'ALL' && String(l.quarter) !== quarterFilter) return false;
        if (categoryFilter !== 'ALL' && (l.eventCategory || 'REGULAR_LESSON') !== categoryFilter) {
          return false;
        }
        if (qLower) {
          const hay = `${l.lessonNumber} ${l.topicTitle || l.title || ''} ${l.classwork || ''} ${
            l.homework || ''
          } ${l.lessonType || ''} ${l.notes || ''}`.toLowerCase();
          if (!hay.includes(qLower)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          (a.grade || 5) - (b.grade || 5) ||
          String(a.curriculumArea || a.subjectName).localeCompare(
            String(b.curriculumArea || b.subjectName)
          ) ||
          a.lessonNumber - b.lessonNumber
      );
  }, [
    lessons,
    gradeFilter,
    classFilter,
    trackFilter,
    areaFilter,
    quarterFilter,
    categoryFilter,
    searchQuery,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredLessons.length / PAGE_SIZE));
  const paginatedLessons = filteredLessons.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    let totalHours = 0;
    let bsbCount = 0;
    let chsbCount = 0;
    let projectCount = 0;
    let reviewCount = 0;
    for (const l of filteredLessons) {
      totalHours += Number(l.hours || 1);
      if (l.eventCategory === 'WRITTEN_ASSESSMENT') bsbCount += 1;
      else if (l.eventCategory === 'QUARTERLY_ASSESSMENT') chsbCount += 1;
      else if (l.eventCategory === 'PROJECT_WORK') projectCount += 1;
      else if (l.eventCategory === 'REVIEW_AND_ANALYSIS') reviewCount += 1;
    }
    return { totalHours, bsbCount, chsbCount, projectCount, reviewCount };
  }, [filteredLessons]);

  const toggleSelectLesson = (id: string) => {
    setSelectedLessonIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectVisiblePage = () => {
    const pageIds = paginatedLessons.map((l) => l.id);
    const allSelected = pageIds.every((id) => selectedLessonIds.includes(id));
    if (allSelected) {
      setSelectedLessonIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedLessonIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const openSingleLessonTestModal = (lesson: LessonItem) => {
    setTestTargetLesson(lesson);
    const isMilestone =
      lesson.eventCategory === 'WRITTEN_ASSESSMENT' ||
      lesson.eventCategory === 'QUARTERLY_ASSESSMENT';
    setTestQuestionCount(isMilestone ? 8 : 5);
    setTestMaxPoints(lesson.maxPoints || (lesson.eventCategory === 'QUARTERLY_ASSESSMENT' ? 40 : 25));
    setTestDurationMinutes(lesson.eventCategory === 'QUARTERLY_ASSESSMENT' ? 45 : 30);
    setTestReferenceText('');
  };

  const handleConfirmSingleLessonTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTargetLesson) return;
    setGeneratingTest(true);
    try {
      await generateLessonAssessment(testTargetLesson.id, {
        questionCount: testQuestionCount,
        difficulty: testDifficulty,
        questionTypes: testQuestionTypes,
        durationMinutes: testDurationMinutes,
        maxPoints: testMaxPoints,
        referenceText: testReferenceText.trim() || undefined,
        publishImmediately: testPublishImmediately,
      });
      setTestTargetLesson(null);
      navigate('/admin/assessments');
    } finally {
      setGeneratingTest(false);
    }
  };

  const handleConfirmBatchTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLessonIds.length === 0) return;
    setGeneratingTest(true);
    try {
      await batchGenerateLessonAssessments({
        lessonIds: selectedLessonIds,
        title: batchTestTitle.trim() || undefined,
        questionCount: testQuestionCount,
        difficulty: testDifficulty,
        questionTypes: testQuestionTypes,
        durationMinutes: testDurationMinutes,
        maxPoints: testMaxPoints,
        referenceText: testReferenceText.trim() || undefined,
        publishImmediately: testPublishImmediately,
      });
      setShowBatchTestModal(false);
      setSelectedLessonIds([]);
      navigate('/admin/assessments');
    } finally {
      setGeneratingTest(false);
    }
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLessonTopic.trim()) return;
    await createLesson({
      classCode: newLessonClass as OfficialClassCode,
      subjectName: newLessonSubject,
      curriculumArea: newLessonArea as CurriculumAreaName,
      quarter: newLessonQuarter as 1 | 2 | 3 | 4,
      quarterLabel: `${newLessonQuarter}-chorak`,
      lessonNumber: newLessonNumber,
      title: newLessonTopic.trim(),
      topicName: newLessonTopic.trim(),
      topicTitle: newLessonTopic.trim(),
      lessonType: newLessonType,
      classwork: newLessonClasswork.trim(),
      homework: newLessonHomework.trim(),
      notes: newLessonNotes.trim(),
      scheduledDate: newLessonDate || undefined,
      status: newLessonStatus,
    });
    setNewLessonTopic('');
    setNewLessonClasswork('');
    setNewLessonHomework('');
    setNewLessonNotes('');
    setShowAddLesson(false);
  };

  const handleSaveEditedLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson) return;
    await updateLesson(editingLesson.id, {
      topicTitle: editingLesson.topicTitle || editingLesson.title,
      title: editingLesson.topicTitle || editingLesson.title,
      topicName: editingLesson.topicTitle || editingLesson.title,
      lessonType: editingLesson.lessonType,
      classwork: editingLesson.classwork,
      homework: editingLesson.homework,
      hours: editingLesson.hours,
      notes: editingLesson.notes,
      quarter: editingLesson.quarter,
      quarterLabel: `${editingLesson.quarter}-chorak`,
      scheduledDate: editingLesson.scheduledDate,
      status: editingLesson.status,
    });
    setEditingLesson(null);
  };

  const toggleQuestionType = (qt: QuestionType) => {
    setTestQuestionTypes((prev) =>
      prev.includes(qt)
        ? prev.length > 1
          ? prev.filter((item) => item !== qt)
          : prev
        : [...prev, qt]
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Mode Switcher & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('roadmap2')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
              viewMode === 'roadmap2'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            O‘quv xaritasi (Choraklar bo‘yicha)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('lessons')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
              viewMode === 'lessons'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Darslar ro‘yxati ({filteredLessons.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
              viewMode === 'calendar'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Taqvim</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedLessonIds.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => {
                  setTestQuestionCount(Math.min(20, Math.max(5, selectedLessonIds.length * 2)));
                  setTestMaxPoints(25);
                  setShowBatchTestModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tanlangan darslar uchun test yarat ({selectedLessonIds.length})</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await bulkUpdateLessonsStatus(selectedLessonIds, 'published');
                  setSelectedLessonIds([]);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                Nashr qilish
              </button>

              <button
                type="button"
                onClick={() => setSelectedLessonIds([])}
                className="px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Tanlovni tozalash
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowAddLesson(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Dars qo‘shish</span>
          </button>
        </div>
      </div>

      {/* Curriculum Roadmap KPI Summary Strip */}
      {viewMode === 'lessons' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-slate-500">Filtrdagi darslar</p>
            <p className="text-base font-bold font-mono tabular-nums mt-0.5">
              {filteredLessons.length} ta ({stats.totalHours} soat)
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-slate-500">BSB (Yozma ish-41)</p>
            <p className="text-base font-bold font-mono tabular-nums text-blue-600 mt-0.5">
              {stats.bsbCount} ta
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-slate-500">CHSB (Choraklik-39)</p>
            <p className="text-base font-bold font-mono tabular-nums text-emerald-600 mt-0.5">
              {stats.chsbCount} ta
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-slate-500">Loyiha ishi-35</p>
            <p className="text-base font-bold font-mono tabular-nums text-amber-600 mt-0.5">
              {stats.projectCount} ta
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-slate-500">BSB/CHSB tahlili</p>
            <p className="text-base font-bold font-mono tabular-nums mt-0.5">
              {stats.reviewCount} ta
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-slate-500">Sahifa</p>
            <p className="text-base font-bold font-mono tabular-nums mt-0.5">
              {page} / {totalPages}
            </p>
          </div>
        </div>
      )}

      {/* Roadmap 2.0 Interactive Quarter Journey */}
      {viewMode === 'roadmap2' && <Roadmap2View mode="admin" />}

      {/* Multi-Dimensional Filter Controls */}
      {viewMode !== 'roadmap2' && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
        <select
          aria-label="Sinf darajasi"
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
        >
          <option value="ALL">5–11-sinflar</option>
          {[5, 6, 7, 8, 9, 10, 11].map((g) => (
            <option key={g} value={String(g)}>
              {g}-sinf
            </option>
          ))}
        </select>

        <select
          aria-label="Sinf"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-blue-600"
        >
          <option value="ALL">Barcha 19 sinf</option>
          {OFFICIAL_19_CLASS_CODES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          aria-label="Yo‘nalish"
          value={trackFilter}
          onChange={(e) => setTrackFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
        >
          <option value="ALL">Barcha yo‘nalishlar</option>
          <option value="A">A — Aniq fanlar</option>
          <option value="T">T — Tabiiy fanlar</option>
        </select>

        <select
          aria-label="O‘quv bo‘limi / Fan"
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
        >
          <option value="ALL">Barcha bo‘limlar (Mat/Alg/Geo)</option>
          <option value="Matematika">Matematika</option>
          <option value="Algebra">Algebra</option>
          <option value="Geometriya">Geometriya</option>
          {subjects
            .filter((s) => s.name !== 'Matematika')
            .map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
        </select>

        {viewMode === 'lessons' ? (
          <>
            <select
              aria-label="Chorak"
              value={quarterFilter}
              onChange={(e) => setQuarterFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
            >
              <option value="ALL">1–4-choraklar</option>
              <option value="1">1-chorak</option>
              <option value="2">2-chorak</option>
              <option value="3">3-chorak</option>
              <option value="4">4-chorak</option>
            </select>

            <select
              aria-label="Dars turi toifasi"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
            >
              <option value="ALL">Barcha dars turlari</option>
              <option value="REGULAR_LESSON">Oddiy dars</option>
              <option value="WRITTEN_ASSESSMENT">BSB / Yozma ish</option>
              <option value="QUARTERLY_ASSESSMENT">CHSB / Choraklik baholash</option>
              <option value="PROJECT_WORK">Loyiha ishi</option>
              <option value="REVIEW_AND_ANALYSIS">BSB/CHSB tahlili</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                aria-label="Mavzu qidirish"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Mavzu, uyga vazifa..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
          </>
        ) : (
          <select
            aria-label="Tadbir turi"
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            <option value="ALL">Barcha turlar</option>
            <option value="lesson">Darslar</option>
            <option value="assessment">Testlar</option>
            <option value="deadline">Muddatlar</option>
            <option value="milestone">Ish rejalari</option>
          </select>
        )}
      </div>
      )}

      {/* View 1: Interactive Curriculum Roadmap Table & Cards */}
      {viewMode === 'lessons' && (
        <div className="space-y-3">
          {/* Page & Selection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={
                  paginatedLessons.length > 0 &&
                  paginatedLessons.every((l) => selectedLessonIds.includes(l.id))
                }
                onChange={toggleSelectVisiblePage}
              />
              <span>Sahifadagi darslarni belgilash ({paginatedLessons.length} ta)</span>
            </label>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-40 cursor-pointer"
                >
                  Oldingi
                </button>
                <span className="font-mono">
                  Sahifa {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 disabled:opacity-40 cursor-pointer"
                >
                  Keyingi
                </button>
              </div>
            )}
          </div>

          {paginatedLessons.length === 0 ? (
            <div className="p-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-500">
              Tanlangan filtrlar bo‘yicha darslar topilmadi.
            </div>
          ) : (
            <div className="space-y-2.5">
              {paginatedLessons.map((les) => {
                const sharedCodes =
                  les.classCodes && les.classCodes.length > 0
                    ? les.classCodes.join(', ')
                    : les.classCode;
                const areaName = les.curriculumArea || les.subjectName || les.subject;
                const cat = les.eventCategory || 'REGULAR_LESSON';
                const isSelected = selectedLessonIds.includes(les.id);

                return (
                  <div
                    key={les.id}
                    className={`bg-white dark:bg-slate-900 border rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/20 dark:bg-blue-950/20'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        aria-label={`${les.lessonNumber}-darsni tanlash`}
                        checked={isSelected}
                        onChange={() => toggleSelectLesson(les.id)}
                        className="mt-1 shrink-0 cursor-pointer"
                      />

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {sharedCodes}
                          </span>
                          <span>·</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {areaName}
                          </span>
                          <span>·</span>
                          <span className="font-mono">
                            {les.quarterLabel || `${les.quarter}-chorak`} · {les.lessonNumber}-dars ({les.hours || 1} soat)
                          </span>
                          <span>·</span>
                          <span
                            className={`font-semibold ${
                              cat === 'WRITTEN_ASSESSMENT'
                                ? 'text-blue-600'
                                : cat === 'QUARTERLY_ASSESSMENT'
                                ? 'text-emerald-600'
                                : cat === 'PROJECT_WORK'
                                ? 'text-amber-600'
                                : cat === 'REVIEW_AND_ANALYSIS'
                                ? 'text-purple-600'
                                : 'text-slate-500'
                            }`}
                          >
                            {EVENT_CATEGORY_LABELS[cat]} ({les.lessonType || 'Oddiy dars-31'})
                          </span>
                          {les.maxPoints && (
                            <>
                              <span>·</span>
                              <span className="font-mono font-bold text-emerald-600">
                                {les.maxPoints} ball
                              </span>
                            </>
                          )}
                          {les.precedingLessonIds && les.precedingLessonIds.length > 0 && (
                            <>
                              <span>·</span>
                              <span className="font-mono text-slate-500">
                                Qamrov: {les.precedingLessonIds.length} ta dars
                              </span>
                            </>
                          )}
                        </div>

                        <h3
                          onClick={() => setEditingLesson({ ...les })}
                          className="text-sm font-bold text-slate-900 dark:text-white hover:text-blue-600 cursor-pointer"
                        >
                          {les.topicTitle || les.title || les.topicName}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          {les.classwork && (
                            <span>
                              <strong className="text-slate-700 dark:text-slate-300">Sinf ishi:</strong>{' '}
                              {les.classwork}
                            </span>
                          )}
                          {les.homework && (
                            <span>
                              <strong className="text-slate-700 dark:text-slate-300">Uyga vazifa:</strong>{' '}
                              {les.homework}
                            </span>
                          )}
                          {les.notes && (
                            <span>
                              <strong className="text-slate-700 dark:text-slate-300">Izoh:</strong>{' '}
                              {les.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <select
                        aria-label="Dars holati"
                        value={les.status}
                        onChange={(e) =>
                          updateLesson(les.id, { status: e.target.value as LessonStatus })
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
                      >
                        <option value="draft">Qoralama</option>
                        <option value="planned">Rejalashtirilgan</option>
                        <option value="published">Nashr qilingan</option>
                        <option value="in_progress">Jarayonda</option>
                        <option value="completed">Tugallangan</option>
                        <option value="archived">Arxivlangan</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => setEditingLesson({ ...les })}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
                      >
                        Tahrirlash
                      </button>

                      <button
                        type="button"
                        onClick={() => openSingleLessonTestModal(les)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Test yarat</span>
                      </button>

                      <button
                        type="button"
                        aria-label={`${les.topicTitle || les.title} darsini o‘chirish`}
                        onClick={() => deleteLesson(les.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* View 2: Academic Calendar */}
      {viewMode === 'calendar' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          {calendarEvents.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Sana biriktirilgan darslar yoki test muddatlari topilmadi.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {calendarEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => navigate(ev.targetRoute)}
                  className="py-3 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between gap-4 rounded cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300 w-24 shrink-0">
                      {ev.date}
                    </span>
                    <span className="font-semibold text-blue-600 shrink-0">
                      {ev.type === 'lesson'
                        ? 'Dars'
                        : ev.type === 'deadline'
                        ? 'Muddat'
                        : ev.type === 'assessment'
                        ? 'Test'
                        : 'Reja'}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white truncate">
                      {ev.title}
                    </span>
                  </div>
                  {ev.classCode && (
                    <span className="font-mono font-semibold text-blue-600 shrink-0">
                      {ev.classCode.toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lesson Detail & Edit Modal (with Original Snapshot & Modification History) */}
      {editingLesson && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <p className="text-xs font-mono font-semibold text-blue-600">
                  {(editingLesson.classCodes || [editingLesson.classCode]).join(', ')} ·{' '}
                  {editingLesson.curriculumArea || editingLesson.subjectName} ·{' '}
                  {editingLesson.lessonNumber}-dars
                </p>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Dars tafsilotlari va tahrirlash
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingLesson(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedLesson} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Mavzu nomi</label>
                <input
                  type="text"
                  required
                  value={editingLesson.topicTitle || editingLesson.title || ''}
                  onChange={(e) =>
                    setEditingLesson({
                      ...editingLesson,
                      topicTitle: e.target.value,
                      title: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Dars turi</label>
                  <input
                    type="text"
                    value={editingLesson.lessonType || 'Oddiy dars-31'}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, lessonType: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">O‘quv davri (Chorak)</label>
                  <select
                    value={editingLesson.quarter}
                    onChange={(e) =>
                      setEditingLesson({
                        ...editingLesson,
                        quarter: Number(e.target.value) as 1 | 2 | 3 | 4,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value={1}>1-chorak</option>
                    <option value={2}>2-chorak</option>
                    <option value={3}>3-chorak</option>
                    <option value={4}>4-chorak</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Soat</label>
                  <input
                    type="number"
                    min={1}
                    value={editingLesson.hours || 1}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, hours: Number(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Sinf ishi</label>
                  <input
                    type="text"
                    value={editingLesson.classwork || ''}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, classwork: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Uyga vazifa</label>
                  <input
                    type="text"
                    value={editingLesson.homework || ''}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, homework: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Izoh</label>
                  <input
                    type="text"
                    value={editingLesson.notes || ''}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Nashr holati</label>
                  <select
                    value={editingLesson.status}
                    onChange={(e) =>
                      setEditingLesson({
                        ...editingLesson,
                        status: e.target.value as LessonStatus,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="draft">Qoralama</option>
                    <option value="published">Nashr qilingan</option>
                    <option value="completed">Tugallangan</option>
                    <option value="archived">Arxivlangan</option>
                  </select>
                </div>
              </div>

              {/* Original Imported Source Record Snapshot */}
              {editingLesson.originalSourceSnapshot && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    Asl Excel manba ma’lumoti ({editingLesson.sourceFileName} · qator #{editingLesson.sourceRowNumber}):
                  </p>
                  <p className="text-slate-500 font-mono text-[11px]">
                    Mavzu: {editingLesson.originalSourceSnapshot.topicTitle} | Dars turi:{' '}
                    {editingLesson.originalSourceSnapshot.lessonType} | Uyga vazifa:{' '}
                    {editingLesson.originalSourceSnapshot.homework || '—'} | Chorak:{' '}
                    {editingLesson.originalSourceSnapshot.quarterLabel}
                  </p>
                </div>
              )}

              {/* Modification History */}
              {editingLesson.modificationHistory &&
                editingLesson.modificationHistory.length > 0 && (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      O‘zgarishlar tarixi ({editingLesson.modificationHistory.length}):
                    </p>
                    <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] font-mono text-slate-500">
                      {editingLesson.modificationHistory.map((mh) => (
                        <p key={mh.id}>
                          {new Date(mh.modifiedAt).toLocaleString('uz-UZ')} ({mh.modifiedBy}) —{' '}
                          {mh.changedFields.join(', ')}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const target = editingLesson;
                    setEditingLesson(null);
                    openSingleLessonTestModal(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ushbu darsdan test yaratish</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingLesson(null)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold cursor-pointer"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer"
                  >
                    Saqlash
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Lesson / Milestone (BSB / CHSB) AI Test Generator Modal */}
      {testTargetLesson && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <p className="text-xs font-mono font-bold text-blue-600">
                  {(testTargetLesson.classCodes || [testTargetLesson.classCode]).join(', ')} ·{' '}
                  {testTargetLesson.curriculumArea || testTargetLesson.subjectName} ·{' '}
                  {testTargetLesson.quarter}-chorak
                </p>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  AI Test Yaratish: {testTargetLesson.topicTitle || testTargetLesson.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTestTargetLesson(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(testTargetLesson.eventCategory === 'WRITTEN_ASSESSMENT' ||
              testTargetLesson.eventCategory === 'QUARTERLY_ASSESSMENT') && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs space-y-1">
                <p className="font-bold text-blue-900 dark:text-blue-200">
                  {testTargetLesson.eventCategory === 'QUARTERLY_ASSESSMENT'
                    ? 'CHSB (Choraklik summativ baholash) Blueprint rejimi'
                    : 'BSB (Bob bo‘yicha summativ baholash) Blueprint rejimi'}
                </p>
                <p className="text-blue-800 dark:text-blue-300">
                  Ushbu nazorat ishi oldingi{' '}
                  <strong>{testTargetLesson.precedingLessonIds?.length || 1}</strong> ta dars
                  mavzulari asosida kompleks savollar to‘plamini shakllantiradi.
                </p>
              </div>
            )}

            <form onSubmit={handleConfirmSingleLessonTest} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Savollar soni</label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={testQuestionCount}
                    onChange={(e) => setTestQuestionCount(Number(e.target.value) || 5)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Maksimal ball</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={testMaxPoints}
                    onChange={(e) => setTestMaxPoints(Number(e.target.value) || 25)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Vaqt (daqiqa)</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={testDurationMinutes}
                    onChange={(e) => setTestDurationMinutes(Number(e.target.value) || 30)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Qiyinlik darajasi</label>
                <select
                  value={testDifficulty}
                  onChange={(e) => setTestDifficulty(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="mixed">Aralash (Tavsiya etiladi)</option>
                  <option value="easy">Oson</option>
                  <option value="medium">O‘rtacha</option>
                  <option value="hard">Murakkab (Ixtisoslik)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Savol turlari</label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'single_choice', label: 'Bitta tanlov' },
                      { id: 'multiple_choice', label: 'Ko‘p tanlov' },
                      { id: 'numeric', label: 'Sonli javob' },
                      { id: 'short_text', label: 'Qisqa yozma' },
                      { id: 'written_open', label: 'Yozma yechim' },
                    ] as { id: QuestionType; label: string }[]
                  ).map((qt) => (
                    <label
                      key={qt.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={testQuestionTypes.includes(qt.id)}
                        onChange={() => toggleQuestionType(qt.id)}
                      />
                      <span>{qt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Qo‘shimcha ko‘rsatma yoki tayanch matn (ixtiyoriy)
                </label>
                <textarea
                  rows={2}
                  value={testReferenceText}
                  onChange={(e) => setTestReferenceText(e.target.value)}
                  placeholder="Masalan: tenglamalar tuzish va matnli masalalarga urg‘u berilsin..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testPublishImmediately}
                  onChange={(e) => setTestPublishImmediately(e.target.checked)}
                />
                <span>Testni o‘quvchilarga darhol nashr qilish</span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setTestTargetLesson(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={generatingTest}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{generatingTest ? 'Yaratilmoqda...' : 'Test yaratish'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Multi-Lesson Batch AI Test Generator Modal */}
      {showBatchTestModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <p className="text-xs font-semibold text-emerald-600">
                  Tanlangan darslar soni: {selectedLessonIds.length} ta
                </p>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Tanlangan darslar uchun umumlashgan test yaratish
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchTestModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmBatchTest} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Test sarlavhasi (ixtiyoriy)</label>
                <input
                  type="text"
                  value={batchTestTitle}
                  onChange={(e) => setBatchTestTitle(e.target.value)}
                  placeholder="Bo‘sh qoldirilsa avtomatik nomlanadi..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Savollar soni</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={testQuestionCount}
                    onChange={(e) => setTestQuestionCount(Number(e.target.value) || 10)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Maksimal ball</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={testMaxPoints}
                    onChange={(e) => setTestMaxPoints(Number(e.target.value) || 25)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Vaqt (daqiqa)</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={testDurationMinutes}
                    onChange={(e) => setTestDurationMinutes(Number(e.target.value) || 35)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBatchTestModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={generatingTest}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{generatingTest ? 'Yaratilmoqda...' : 'Test yaratish'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Lesson Modal */}
      {showAddLesson && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Dars qo‘shish</h3>
              <button type="button" onClick={() => setShowAddLesson(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateLesson} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Sinf</label>
                  <select
                    value={newLessonClass}
                    onChange={(e) => setNewLessonClass(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                  >
                    {OFFICIAL_19_CLASS_CODES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Fan</label>
                  <select
                    value={newLessonSubject}
                    onChange={(e) => setNewLessonSubject(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">O‘quv bo‘limi</label>
                  <select
                    value={newLessonArea}
                    onChange={(e) => setNewLessonArea(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="Matematika">Matematika</option>
                    <option value="Algebra">Algebra</option>
                    <option value="Geometriya">Geometriya</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Chorak</label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={newLessonQuarter}
                    onChange={(e) => setNewLessonQuarter(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Dars №</label>
                  <input
                    type="number"
                    min={1}
                    value={newLessonNumber}
                    onChange={(e) => setNewLessonNumber(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Sana</label>
                  <input
                    type="date"
                    value={newLessonDate}
                    onChange={(e) => setNewLessonDate(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Mavzu nomi</label>
                <input
                  type="text"
                  required
                  value={newLessonTopic}
                  onChange={(e) => setNewLessonTopic(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Dars turi</label>
                  <input
                    type="text"
                    value={newLessonType}
                    onChange={(e) => setNewLessonType(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Holat</label>
                  <select
                    value={newLessonStatus}
                    onChange={(e) => setNewLessonStatus(e.target.value as LessonStatus)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="published">Nashr qilish</option>
                    <option value="draft">Qoralama</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Sinf ishi</label>
                  <input
                    type="text"
                    value={newLessonClasswork}
                    onChange={(e) => setNewLessonClasswork(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Uyga vazifa</label>
                  <input
                    type="text"
                    value={newLessonHomework}
                    onChange={(e) => setNewLessonHomework(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddLesson(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
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

/* ==========================================================================
   7. TESTLAR — ASSESSMENTS PAGE
   ========================================================================== */

const LegacyAssessmentsPage: React.FC = () => {
  const {
    institution,
    classes,
    subjects,
    topics,
    questions,
    assessments,
    attempts,
    importBatches,
    createQuestion,
    updateQuestion,
    createAssessment,
    updateAssessment,
    generateAITest,
    validateImportPackage,
    confirmImportPackage,
    uploadMediaFile,
    suggestWrittenGrade,
    confirmWrittenGrade,
    refreshState,
  } = useLearnOS();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<
    'list' | 'ai_generator' | 'import' | 'question_bank' | 'grading'
  >('list');

  const [aiClassCode, setAiClassCode] = useState<string>(searchParams.get('class') || '8a1');
  const compatAiSubjects = subjects.filter(
    (s) => isSubjectCompatibleWithClass(s.name, aiClassCode, subjects).compatible
  );
  const [aiSubject, setAiSubject] = useState<string>(compatAiSubjects[0]?.name || 'Matematika');
  const [aiTopicName, setAiTopicName] = useState<string>('Kvadrat tenglamalar');
  const [aiQuestionCount, setAiQuestionCount] = useState<number>(5);
  const [aiDifficulty, setAiDifficulty] = useState<string>('medium');
  const [aiGenerating, setAiGenerating] = useState<boolean>(false);

  const [showManualModal, setShowManualModal] = useState(false);
  const [manTitle, setManTitle] = useState('');
  const [manClassCode, setManClassCode] = useState('8a1');
  const [manSubject, setManSubject] = useState('Matematika');
  const [manSelectedQIds, setManSelectedQIds] = useState<string[]>([]);

  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);

  // Assessment Preview & Edit Modals
  const [previewAssessment, setPreviewAssessment] = useState<Assessment | null>(null);
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [editAssessTitle, setEditAssessTitle] = useState('');
  const [editAssessDuration, setEditAssessDuration] = useState(25);
  const [editAssessDueDate, setEditAssessDueDate] = useState('');

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setShowManualModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const compat = subjects.filter(
      (s) => isSubjectCompatibleWithClass(s.name, aiClassCode, subjects).compatible
    );
    if (compat.length > 0 && !compat.some((s) => s.name === aiSubject)) {
      setAiSubject(compat[0].name);
    }
  }, [aiClassCode, subjects]);

  const handleRunAIGenerator = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiGenerating(true);
    try {
      await generateAITest({
        classCode: aiClassCode,
        subject: aiSubject,
        topicName: aiTopicName.trim() || `${aiSubject} testi`,
        questionCount: aiQuestionCount,
        difficulty: aiDifficulty,
      });
      setActiveTab('list');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCreateManualAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manTitle.trim() || manSelectedQIds.length === 0) return;
    const cls = classes.find((c) => c.code === manClassCode || c.name === manClassCode);
    await createAssessment({
      title: manTitle.trim(),
      subject: manSubject,
      grade: cls?.grade || 8,
      classId: cls?.id || '',
      classCode: manClassCode as OfficialClassCode,
      topicIds: [],
      questionIds: manSelectedQIds,
      durationMinutes: 25,
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      status: 'draft',
    });
    setManTitle('');
    setManSelectedQIds([]);
    setShowManualModal(false);
  };

  const handleSaveEditedAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssessment) return;
    await updateAssessment(editingAssessment.id, {
      title: editAssessTitle.trim() || editingAssessment.title,
      durationMinutes: Number(editAssessDuration) || editingAssessment.durationMinutes,
      dueDate: editAssessDueDate || editingAssessment.dueDate,
    });
    setEditingAssessment(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {[
            { id: 'list', label: `Testlar (${assessments.length})` },
            { id: 'ai_generator', label: 'AI Test' },
            { id: 'import', label: 'Excel / ZIP Import' },
            { id: 'question_bank', label: `Savollar (${questions.length})` },
            { id: 'grading', label: 'Yozma baholash' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManualModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Test yaratish</span>
          </button>
          <a
            href="/api/import/template.xlsx"
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Shablon</span>
          </a>
        </div>
      </div>

      {activeTab === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assessments.map((assess) => {
            const subCount = attempts.filter((a) => a.assessmentId === assess.id).length;
            return (
              <div
                key={assess.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-mono font-bold">
                        {assess.classCode || `${assess.grade}-sinf`}
                      </span>
                      <span className="font-semibold text-blue-600">{assess.subject}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        assess.status === 'published'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}
                    >
                      {assess.status === 'published' ? 'Nashr etilgan' : 'Qoralama'}
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {assess.title}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">
                    {assess.questionIds.length} savol · {assess.durationMinutes} daq · {subCount} urinish
                  </p>
                </div>

                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label="Test sinfi"
                      value={assess.classCode || ''}
                      onChange={(e) =>
                        updateAssessment(assess.id, {
                          classCode: e.target.value as OfficialClassCode,
                        })
                      }
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold"
                    >
                      <option value="">Sinf</option>
                      {OFFICIAL_19_CLASS_CODES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setPreviewAssessment(assess)}
                      className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-medium cursor-pointer"
                    >
                      Ko‘rib chiqish
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingAssessment(assess);
                        setEditAssessTitle(assess.title);
                        setEditAssessDuration(assess.durationMinutes || 25);
                        setEditAssessDueDate(assess.dueDate || '');
                      }}
                      className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-medium cursor-pointer"
                    >
                      Tahrirlash
                    </button>

                    <Link
                      to={`/admin/results?assessmentId=${encodeURIComponent(assess.id)}`}
                      className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-medium"
                    >
                      Natijalar
                    </Link>
                  </div>

                  {assess.status !== 'published' ? (
                    <button
                      type="button"
                      onClick={() => updateAssessment(assess.id, { status: 'published' })}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Nashr qilish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => updateAssessment(assess.id, { status: 'draft' })}
                      className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold cursor-pointer"
                    >
                      Qoralama
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'ai_generator' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-xl space-y-4">
          <form onSubmit={handleRunAIGenerator} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Sinf</label>
                <select
                  value={aiClassCode}
                  onChange={(e) => setAiClassCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                >
                  {OFFICIAL_19_CLASS_CODES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Fan</label>
                <select
                  value={aiSubject}
                  onChange={(e) => setAiSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-semibold"
                >
                  {compatAiSubjects.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">Mavzu</label>
              <input
                type="text"
                required
                value={aiTopicName}
                onChange={(e) => setAiTopicName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Savollar soni</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={aiQuestionCount}
                  onChange={(e) => setAiQuestionCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Qiyinlik</label>
                <select
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                >
                  <option value="easy">Oson</option>
                  <option value="medium">O‘rtacha</option>
                  <option value="hard">Qiyin</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={aiGenerating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{aiGenerating ? 'Yaratilmoqda...' : 'Yaratish'}</span>
            </button>
          </form>
        </div>
      )}

      {activeTab === 'import' && (
        <ExcelImportCenterPanel
          targetInstitutionId={institution.id}
          onImportSuccess={() => refreshState()}
        />
      )}

      {activeTab === 'question_bank' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setEditingQuestion(null);
                setShowQuestionEditor(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer"
            >
              + Savol qo‘shish
            </button>
          </div>
          {questions.slice(0, 20).map((q) => (
            <div
              key={q.id}
              className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
            >
              <div>
                <span className="text-slate-400 font-mono">{q.subject} · {q.type}</span>
                <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{q.prompt}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingQuestion(q);
                  setShowQuestionEditor(true);
                }}
                className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 font-medium shrink-0 cursor-pointer"
              >
                Tahrirlash
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'grading' && (
        <WrittenGradingPanel attempts={attempts} />
      )}

      {/* Preview Assessment Modal */}
      {previewAssessment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto ss-modal-enter">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-blue-600">
                  {previewAssessment.classCode || `${previewAssessment.grade}-sinf`} · {previewAssessment.subject}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {previewAssessment.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAssessment(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              {previewAssessment.questionIds.map((qId, idx) => {
                const q = questions.find((item) => item.id === qId);
                if (!q) return null;
                return (
                  <div
                    key={q.id}
                    className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span>Savol #{idx + 1}</span>
                      <span>{q.points || 1} ball · {q.type}</span>
                    </div>
                    <p className="font-semibold text-slate-900 dark:text-white">{q.prompt}</p>
                    {Array.isArray(q.options) && q.options.length > 0 && (
                      <ul className="space-y-1 pl-3 text-slate-600 dark:text-slate-300">
                        {q.options.map((opt, oIdx) => (
                          <li
                            key={oIdx}
                            className={
                              opt === q.correctAnswer ||
                              (Array.isArray(q.correctAnswers) && q.correctAnswers.includes(opt))
                                ? 'font-bold text-emerald-600 dark:text-emerald-400'
                                : ''
                            }
                          >
                            {String.fromCharCode(65 + oIdx)}) {opt}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Edit Assessment Modal */}
      {editingAssessment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 ss-modal-enter">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Testni tahrirlash</h3>
              <button
                type="button"
                onClick={() => setEditingAssessment(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditedAssessment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Test nomi</label>
                <input
                  type="text"
                  required
                  value={editAssessTitle}
                  onChange={(e) => setEditAssessTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Vaqt (daqiqa)</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={editAssessDuration}
                    onChange={(e) => setEditAssessDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Muddat</label>
                  <input
                    type="date"
                    value={editAssessDueDate}
                    onChange={(e) => setEditAssessDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAssessment(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 ss-modal-enter">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Test yaratish</h3>
              <button type="button" onClick={() => setShowManualModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateManualAssessment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nomi</label>
                <input
                  type="text"
                  required
                  value={manTitle}
                  onChange={(e) => setManTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Sinf</label>
                  <select
                    value={manClassCode}
                    onChange={(e) => setManClassCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                  >
                    {OFFICIAL_19_CLASS_CODES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Fan</label>
                  <select
                    value={manSubject}
                    onChange={(e) => setManSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  >
                    {subjects
                      .filter(
                        (s) =>
                          isSubjectCompatibleWithClass(s.name, manClassCode, subjects).compatible
                      )
                      .map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
                {questions.map((q) => {
                  const checked = manSelectedQIds.includes(q.id);
                  return (
                    <label key={q.id} className="p-2 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setManSelectedQIds((prev) =>
                            checked ? prev.filter((id) => id !== q.id) : [...prev, q.id]
                          )
                        }
                      />
                      <span className="truncate">{q.prompt}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showQuestionEditor && (
        <AdvancedQuestionEditorModal
          initialQuestion={editingQuestion}
          onClose={() => setShowQuestionEditor(false)}
          onSaved={() => setShowQuestionEditor(false)}
        />
      )}
    </div>
  );
};

/* ==========================================================================
   8. NATIJALAR — RESULTS PAGE
   ========================================================================== */

export const AdminResultsPage: React.FC = () => {
  const { classes, users, attempts, masteryRecords } = useLearnOS();
  const [searchParams, setSearchParams] = useSearchParams();
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const assessmentFilter = searchParams.get('assessmentId') || '';

  const students = users.filter((u) => u.role === 'student');
  const filteredAttempts = attempts.filter((att) => {
    if (assessmentFilter && att.assessmentId !== assessmentFilter) return false;
    if (classFilter === 'ALL') return true;
    const cls = classes.find((c) => c.id === att.classId);
    const stu = students.find((s) => s.uid === att.studentId);
    return (
      cls?.code?.toLowerCase() === classFilter.toLowerCase() ||
      stu?.classCode?.toLowerCase() === classFilter.toLowerCase()
    );
  });

  const handleExportResultsXlsx = () => {
    const rows = [
      ['O\'quvchi', 'Sinf', 'Test', 'Natija (%)', 'To\'g\'ri javoblar', 'Jami savollar', 'Sana'],
      ...filteredAttempts.map((att) => {
        const stu = students.find((s) => s.uid === att.studentId);
        const cls = classes.find((c) => c.id === att.classId);
        return [
          att.studentName,
          cls?.code || stu?.classCode || '',
          att.assessmentTitle,
          att.scorePercent,
          att.correctCount,
          att.totalQuestions,
          new Date(att.submittedAt).toLocaleDateString('uz-UZ'),
        ];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Natijalar');
    XLSX.writeFile(wb, `specialized_study_natijalar_${classFilter.toLowerCase()}.xlsx`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Jami urinishlar: {filteredAttempts.length} ta</span>
          {assessmentFilter && (
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 font-semibold cursor-pointer"
            >
              Test filtrini tozalash ×
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Sinf"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            <option value="ALL">Barcha 19 sinf</option>
            {OFFICIAL_19_CLASS_CODES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExportResultsXlsx}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Eksport (.xlsx)</span>
          </button>
        </div>
      </div>

      {filteredAttempts.length === 0 ? (
        <div className="p-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-500">
          Topshirilgan natijalar yo‘q.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {/* Mobile Results Card List (<768px) */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {filteredAttempts.map((att) => {
              const stu = students.find((s) => s.uid === att.studentId);
              const cls = classes.find((c) => c.id === att.classId);
              return (
                <div key={att.id} className="p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {att.studentName}
                    </span>
                    <span className="font-mono font-bold text-emerald-600 text-sm">
                      {att.scorePercent}%
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 font-medium">
                    {att.assessmentTitle}
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="text-blue-600 font-bold">
                      {cls?.code || stu?.classCode || '—'} · {att.correctCount}/{att.totalQuestions}
                    </span>
                    <span>{new Date(att.submittedAt).toLocaleDateString('uz-UZ')}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Results Table (>=768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-500">
                  <th className="py-2.5 px-4">O‘quvchi</th>
                  <th className="py-2.5 px-4">Sinf</th>
                  <th className="py-2.5 px-4">Test</th>
                  <th className="py-2.5 px-4">Natija</th>
                  <th className="py-2.5 px-4">To‘g‘ri / Jami</th>
                  <th className="py-2.5 px-4">Sana</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAttempts.map((att) => {
                  const stu = students.find((s) => s.uid === att.studentId);
                  const cls = classes.find((c) => c.id === att.classId);
                  return (
                    <tr key={att.id}>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                        {att.studentName}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-blue-600">
                        {cls?.code || stu?.classCode || '—'}
                      </td>
                      <td className="py-2.5 px-4">{att.assessmentTitle}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-600">
                        {att.scorePercent}%
                      </td>
                      <td className="py-2.5 px-4 font-mono">
                        {att.correctCount} / {att.totalQuestions}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-400">
                        {new Date(att.submittedAt).toLocaleDateString('uz-UZ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {masteryRecords.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {masteryRecords.slice(0, 9).map((m) => (
            <div
              key={m.id}
              className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <div className="font-semibold text-slate-900 dark:text-white">{m.topicName}</div>
              <div className="text-slate-500 mt-0.5">
                {m.subject} · <strong className="font-mono">{m.accuracy}%</strong> ({m.statusLabel})
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ==========================================================================
   9. SOZLAMALAR — SETTINGS PAGE
   ========================================================================== */

export const AdminSettingsPage: React.FC = () => {
  const { institution, classes, subjects, updateInstitutionSettings } = useLearnOS();
  const [name, setName] = useState(institution.name || APP_NAME);
  const [region, setRegion] = useState(institution.region || 'Toshkent shahri');
  const [district, setDistrict] = useState(institution.district || 'Mirzo Ulug‘bek tumani');
  const [academicYear, setAcademicYear] = useState(institution.academicYear || '2026-2027');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateInstitutionSettings(name, region, district, academicYear, false);
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSave}
        className="max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 text-xs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block font-semibold mb-1">Muassasa nomi</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">O‘quv yili</label>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Hudud</label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Tuman</label>
            <input
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
            />
          </div>
        </div>

        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
        >
          Saqlash
        </button>
      </form>

      <div className="max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2 text-xs text-slate-600 dark:text-slate-400">
        <div>
          Sinflar: <strong className="text-slate-900 dark:text-white">{classes.length} ta</strong> (14 A + 5 T)
        </div>
        <div>
          Fanlar: <strong className="text-slate-900 dark:text-white">{subjects.map((s) => s.name).join(', ')}</strong>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <AdminGamificationPanel />
      </div>
    </div>
  );
};

export const AdminAttendancePage: React.FC = () => {
  return <AdminAttendancePanel />;
};

export const AdminAssignmentsPage: React.FC = () => {
  return <AdminAssignmentsPanel />;
};

export const AdminAlertsPage: React.FC = () => {
  return <AdminAlertCenterPanel />;
};

export const AdminSupportPlansPage: React.FC = () => {
  return <AdminSupportPlansPanel />;
};

export const AdminReportsPage: React.FC = () => {
  return <AdminReportsPanel />;
};

export const AdminTimetablePage: React.FC = () => {
  return <AdminTimetablePanel />;
};

export const AdminAnnouncementsPage: React.FC = () => {
  return <AdminAnnouncementsPanel />;
};

export const AdminMaterialsLibraryPage: React.FC = () => {
  return <AdminMaterialsLibraryPanel />;
};

export const AdminSmartGradingPage: React.FC = () => {
  return <AdminSmartGradingPanel />;
};

export const AdminAcademicCalendarPage: React.FC = () => {
  return <AdminAcademicCalendarPanel />;
};

// Legacy exports aliased cleanly for backward compatibility
export const ParentDashboardPage = AdminDashboardPage;
export const ParentChildrenPage = AdminStudentsPage;
export const ParentChildDetailPage = AdminStudentsPage;
export const ParentProgressPage = AdminResultsPage;
export const AdminInstitutionPage = AdminSettingsPage;
export const AdminUsersDirectoryPage = AdminStudentsPage;
export const AdminTeachersPage = AdminStudentsPage;
export const AdminInvitationsPage = AdminStudentsPage;
export const AdminAIIntelligencePage = AdminAssessmentsPage;
export const AdminAnalyticsPage = AdminResultsPage;
export const AdminNotificationsPage = AdminDashboardPage;
export const AdminAuditLogsPage = AdminSettingsPage;
export const AdminHelpDocsPage = AdminSettingsPage;

export const AdminWorkPlansPage: React.FC = () => <WorkPlanCenter advanced={LegacyWorkPlansPage}/>;

export function AdminAssessmentsPage(){ return <ExamCenter legacy={LegacyAssessmentsPage}/>; }
