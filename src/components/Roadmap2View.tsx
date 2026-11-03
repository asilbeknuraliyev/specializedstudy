import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  FileText,
  Filter,
  FolderGit2,
  HelpCircle,
  Layers,
  Link2,
  Lock,
  Play,
  Plus,
  Search,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Archive,
  Eye,
  EyeOff,
  Check,
  Award,
} from 'lucide-react';
import { useLearnOS } from '../context/LearnOSContext';
import { LessonItem, Roadmap2LessonBadgeLabel } from '../types';
import {
  classifyRoadmap2LessonBadge,
  computeRoadmapPlanOverview,
  getStudentLessonRoadmapState,
} from '../utils/gamificationEngine';
import { OFFICIAL_19_CLASS_CODES, parseOfficialClassCode } from '../constants/curriculum';

interface Roadmap2ViewProps {
  mode: 'student' | 'admin';
  onStartAssessment?: (assessmentId: string) => void;
  initialLessonId?: string;
}

const BADGE_STYLES: Record<Roadmap2LessonBadgeLabel, string> = {
  'Oddiy dars': 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  'Yozma ish': 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
  BSB: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60',
  CHSB: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/60',
  'BSB tahlili': 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60',
  'CHSB tahlili': 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/60',
  'Loyiha ishi': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
  Takrorlash: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60',
};

export const Roadmap2View: React.FC<Roadmap2ViewProps> = ({
  mode,
  onStartAssessment,
  initialLessonId,
}) => {
  const {
    currentUser,
    institution,
    classes,
    workPlans,
    lessons,
    assessments,
    studentLessonCompletions,
    completeStudentLesson,
    completeStudentLessonPractice,
    updateLesson,
    createLesson,
    reorderLesson,
    bulkUpdateLessonsStatus,
    generateLessonAssessment,
    updateTTrackMathVisibility,
    confirmCurriculumZipArchive,
  } = useLearnOS();
  const navigate = useNavigate();

  const academicYearOptions = useMemo(
    () => Array.from(new Set([institution?.academicYear || '2026-2027', '2026-2027', '2025-2026'])),
    [institution?.academicYear]
  );

  const studentClassCode = useMemo(() => {
    if (mode === 'student' && currentUser) {
      if (currentUser.classCode) return currentUser.classCode.toLowerCase();
      const cls = classes.find((c) => c.id === currentUser.classId);
      if (cls?.code || cls?.name) return (cls.code || cls.name).toLowerCase();
    }
    return '7a1';
  }, [mode, currentUser, classes]);

  const [selectedClassCode, setSelectedClassCode] = useState<string>(studentClassCode);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(
    academicYearOptions[0] || '2026-2027'
  );
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [badgeFilter, setBadgeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'NOT_STARTED' | 'HAS_TEST'>('ALL');
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(initialLessonId || null);

  // Admin editing state
  const [editingLesson, setEditingLesson] = useState<LessonItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editClasswork, setEditClasswork] = useState('');
  const [editHomework, setEditHomework] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editObjectives, setEditObjectives] = useState('');
  const [editHours, setEditHours] = useState(1);
  const [editMaterialTitle, setEditMaterialTitle] = useState('');
  const [editMaterialUrl, setEditMaterialUrl] = useState('');
  const [reorderConfirmId, setReorderConfirmId] = useState<{ id: string; dir: 'up' | 'down' } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  const activeClassCode = mode === 'student' ? studentClassCode : selectedClassCode;
  const parsedClass = useMemo(
    () => parseOfficialClassCode(activeClassCode) || { code: '7a1' as any, grade: 7, track: 'A' as const, trackLabel: 'Aniq fanlar', section: 1 },
    [activeClassCode]
  );

  // Determine available Subject / Curriculum Area options for the selected class
  const subjectAreaOptions = useMemo(() => {
    const opts: Array<{ key: string; label: string; subject: string; area?: string }> = [];
    if (parsedClass.grade <= 6) {
      opts.push({ key: 'Matematika', label: 'Matematika', subject: 'Matematika' });
    } else {
      opts.push({
        key: 'Matematika::Algebra',
        label: 'Matematika — Algebra',
        subject: 'Matematika',
        area: 'Algebra',
      });
      opts.push({
        key: 'Matematika::Geometriya',
        label: 'Matematika — Geometriya',
        subject: 'Matematika',
        area: 'Geometriya',
      });
    }

    if (parsedClass.track === 'A') {
      opts.push({ key: 'Fizika', label: 'Fizika', subject: 'Fizika' });
      opts.push({ key: 'Ingliz tili', label: 'Ingliz tili', subject: 'Ingliz tili' });
    } else {
      opts.push({ key: 'Biologiya', label: 'Biologiya', subject: 'Biologiya' });
      opts.push({ key: 'Kimyo', label: 'Kimyo', subject: 'Kimyo' });
      opts.push({ key: 'Ingliz tili', label: 'Ingliz tili', subject: 'Ingliz tili' });
    }
    return opts;
  }, [parsedClass.grade, parsedClass.track]);

  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string>('');

  const activeSubjectOption = useMemo(() => {
    const found = subjectAreaOptions.find((o) => o.key === selectedSubjectKey);
    return found || subjectAreaOptions[0];
  }, [subjectAreaOptions, selectedSubjectKey]);

  // Filter lessons belonging to the selected class and subject/curriculumArea
  const planLessons = useMemo(() => {
    return lessons
      .filter((l) => {
        if (l.status === 'archived') return false;
        const matchesClass =
          l.classCode?.toLowerCase() === activeClassCode ||
          l.classCodes?.some((c) => c.toLowerCase() === activeClassCode) ||
          l.classId === `class-${activeClassCode}`;
        if (!matchesClass) return false;

        const lSubj = (l.subjectName || l.subject || '').toLowerCase();
        if (lSubj !== activeSubjectOption.subject.toLowerCase()) return false;

        if (activeSubjectOption.area) {
          return (l.curriculumArea || '').toLowerCase() === activeSubjectOption.area.toLowerCase();
        }
        return true;
      })
      .sort(
        (a, b) =>
          (a.quarter || 1) - (b.quarter || 1) ||
          (a.lessonNumber || a.orderIndex || 0) - (b.lessonNumber || b.orderIndex || 0)
      );
  }, [lessons, activeClassCode, activeSubjectOption]);

  // Overview stats across all 4 quarters of the selected academic plan
  const planOverview = useMemo(
    () => computeRoadmapPlanOverview(planLessons, studentLessonCompletions, currentUser?.uid),
    [planLessons, studentLessonCompletions, currentUser?.uid]
  );

  // Quarter counts & progress indicators
  const quarterStats = useMemo(() => {
    const stats: Record<1 | 2 | 3 | 4, { total: number; completed: number; published: number }> = {
      1: { total: 0, completed: 0, published: 0 },
      2: { total: 0, completed: 0, published: 0 },
      3: { total: 0, completed: 0, published: 0 },
      4: { total: 0, completed: 0, published: 0 },
    };
    for (const l of planLessons) {
      const q = (l.quarter || 1) as 1 | 2 | 3 | 4;
      if (!stats[q]) continue;
      stats[q].total += 1;
      if (l.status === 'published') stats[q].published += 1;
      const st = getStudentLessonRoadmapState(l, studentLessonCompletions, currentUser?.uid);
      if (st === 'Completed') stats[q].completed += 1;
    }
    return stats;
  }, [planLessons, studentLessonCompletions, currentUser?.uid]);

  // Filtered lessons for the active quarter tab
  const quarterLessons = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    return planLessons
      .filter((l) => (l.quarter || 1) === selectedQuarter)
      .filter((l) => {
        if (!qLower) return true;
        const numStr = String(l.lessonNumber || l.orderIndex || '');
        const titleStr = (l.topicTitle || l.title || '').toLowerCase();
        const cwStr = (l.classwork || '').toLowerCase();
        return numStr.includes(qLower) || titleStr.includes(qLower) || cwStr.includes(qLower);
      })
      .filter((l) => {
        if (badgeFilter === 'ALL') return true;
        return classifyRoadmap2LessonBadge(l) === badgeFilter;
      })
      .filter((l) => {
        if (statusFilter === 'ALL') return true;
        const st = getStudentLessonRoadmapState(l, studentLessonCompletions, currentUser?.uid);
        if (statusFilter === 'COMPLETED') return st === 'Completed';
        if (statusFilter === 'NOT_STARTED') return st !== 'Completed';
        if (statusFilter === 'HAS_TEST') {
          const hasLinked =
            (l.linkedAssessmentIds && l.linkedAssessmentIds.length > 0) ||
            assessments.some((a) => a.lessonId === l.id && a.status === 'published');
          return Boolean(hasLinked);
        }
        return true;
      });
  }, [
    planLessons,
    selectedQuarter,
    searchQuery,
    badgeFilter,
    statusFilter,
    studentLessonCompletions,
    currentUser?.uid,
    assessments,
  ]);

  const tTrackApproved = useMemo(() => {
    return workPlans.some(
      (wp) => wp.additionalCurriculumAssignment && wp.tTrackVisibilityApproved === true
    );
  }, [workPlans]);

  const openEditModal = (lesson: LessonItem) => {
    setEditingLesson(lesson);
    setEditTitle(lesson.topicTitle || lesson.title || '');
    setEditClasswork(lesson.classwork || '');
    setEditHomework(lesson.homework || '');
    setEditNotes(lesson.notes || '');
    setEditObjectives(
      Array.isArray(lesson.learningObjectives)
        ? lesson.learningObjectives.join('\n')
        : String(lesson.learningObjectives || '')
    );
    setEditHours(lesson.hours || 1);
    setEditMaterialTitle('');
    setEditMaterialUrl('');
  };

  const handleSaveLessonEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson) return;
    setBusyActionId(editingLesson.id);
    try {
      const updatedMaterials = [...(editingLesson.materials || [])];
      if (editMaterialTitle.trim() && editMaterialUrl.trim()) {
        updatedMaterials.push({
          id: `mat_${Date.now()}`,
          title: editMaterialTitle.trim(),
          type: 'link',
          url: editMaterialUrl.trim(),
        });
      }
      await updateLesson(editingLesson.id, {
        title: editTitle.trim(),
        topicTitle: editTitle.trim(),
        classwork: editClasswork.trim(),
        homework: editHomework.trim(),
        notes: editNotes.trim(),
        hours: Number(editHours) || 1,
        learningObjectives: editObjectives
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        materials: updatedMaterials,
      });
      setEditingLesson(null);
    } finally {
      setBusyActionId(null);
    }
  };

  const handleCreateNewLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    setBusyActionId('create_lesson');
    try {
      const nextNum =
        planLessons.filter((l) => l.quarter === selectedQuarter).length + 1;
      await createLesson({
        classCode: activeClassCode as any,
        classId: `class-${activeClassCode}`,
        subject: activeSubjectOption.subject,
        subjectName: activeSubjectOption.subject,
        curriculumArea: activeSubjectOption.area as any,
        academicYear: selectedAcademicYear,
        quarter: selectedQuarter,
        lessonNumber: nextNum,
        orderIndex: nextNum,
        title: editTitle.trim(),
        topicTitle: editTitle.trim(),
        classwork: editClasswork.trim(),
        homework: editHomework.trim(),
        notes: editNotes.trim(),
        hours: Number(editHours) || 1,
        status: 'published',
      });
      setShowCreateModal(false);
      setEditTitle('');
      setEditClasswork('');
      setEditHomework('');
      setEditNotes('');
    } finally {
      setBusyActionId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Compact Bar: Selectors & Title */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              <Layers className="w-3.5 h-3.5" />
              <span>Roadmap 2.0 • O'quv xaritasi</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {mode === 'student'
                ? `${activeClassCode.toUpperCase()} sinf o'quv yo'li`
                : "Akademik O'quv Rejalar va Darslar Xaritasi"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {parsedClass.grade}-sinf • {parsedClass.track === 'A' ? 'Aniq fanlar' : 'Tabiiy fanlar'} yo'nalishi •{' '}
              {activeSubjectOption.label}
            </p>
          </div>

          {/* 3 Compact Top Selectors: Sinf, Fan, O'quv yili */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full lg:w-auto">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Sinf
              </label>
              {mode === 'student' ? (
                <div className="h-10 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-200">
                  <span>{activeClassCode.toUpperCase()} sinf</span>
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                </div>
              ) : (
                <select
                  aria-label="Sinf"
                  value={selectedClassCode}
                  onChange={(e) => setSelectedClassCode(e.target.value)}
                  className="h-10 w-full px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {OFFICIAL_19_CLASS_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code.toUpperCase()} sinf
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                Fan / Yo'nalish
              </label>
              <select
                aria-label="Fan"
                value={activeSubjectOption.key}
                onChange={(e) => setSelectedSubjectKey(e.target.value)}
                className="h-10 w-full px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {subjectAreaOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                O'quv yili
              </label>
              <select
                aria-label="O'quv yili"
                value={selectedAcademicYear}
                onChange={(e) => setSelectedAcademicYear(e.target.value)}
                className="h-10 w-full px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {academicYearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Visual Overview of the Selected Academic Plan */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Jami darslar</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {planOverview.totalLessons} ta{' '}
              <span className="text-xs font-normal text-slate-500">({planOverview.totalHours} soat)</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Oddiy darslar</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {planOverview.ordinaryLessons} ta
            </div>
          </div>
          <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/50">
            <div className="text-[11px] font-medium text-blue-700 dark:text-blue-300">Nazorat marralari</div>
            <div className="text-lg font-bold text-blue-900 dark:text-blue-200 mt-0.5">
              {planOverview.assessmentMilestones} ta
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50">
            <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Loyiha ishlari</div>
            <div className="text-lg font-bold text-emerald-900 dark:text-emerald-200 mt-0.5">
              {planOverview.projectActivities} ta
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/50">
            <div className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
              {mode === 'student' ? "O'zlashtirilgan" : 'Nashr etilgan'}
            </div>
            <div className="text-lg font-bold text-indigo-900 dark:text-indigo-200 mt-0.5">
              {mode === 'student'
                ? `${planOverview.completedLessons} / ${planOverview.totalLessons}`
                : `${planOverview.publishedLessons} / ${planOverview.totalLessons}`}
            </div>
          </div>
        </div>

        {/* Admin Quick Toolbar */}
        {mode === 'admin' && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditTitle('');
                  setEditClasswork('');
                  setEditHomework('');
                  setEditNotes('');
                  setEditHours(1);
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yangi dars qo'shish</span>
              </button>

              {planLessons.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    bulkUpdateLessonsStatus(
                      planLessons.filter((l) => l.quarter === selectedQuarter).map((l) => l.id),
                      'published'
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{selectedQuarter}-chorakni nashr etish</span>
                </button>
              )}

              {parsedClass.track === 'T' && (
                <button
                  type="button"
                  onClick={() =>
                    updateTTrackMathVisibility({
                      tTrackVisibilityApproved: !tTrackApproved,
                      publishLessons: true,
                    })
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                    tTrackApproved
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                  }`}
                >
                  <span>
                    T-yo'nalish Matematika: {tTrackApproved ? "O'quvchilarga ochiq" : 'Yopiq (Tasdiqlash)'}
                  </span>
                </button>
              )}
            </div>

            {lessons.length === 0 && (
              <button
                type="button"
                onClick={() =>
                  confirmCurriculumZipArchive({
                    useOfficialAttachedArchive: true,
                    academicYear: selectedAcademicYear,
                    publishImmediately: true,
                    tTrackVisibilityApproved: false,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition"
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>Rasmiy 21 ta Matematika ish rejasini yuklash</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4 Quarter Tabs — Never render all 4 quarters simultaneously */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" role="tablist" aria-label="Choraklar">
        {([1, 2, 3, 4] as const).map((q) => {
          const isSelected = selectedQuarter === q;
          const qStat = quarterStats[q];
          const pct =
            qStat.total > 0
              ? Math.round(
                  ((mode === 'student' ? qStat.completed : qStat.published) / qStat.total) * 100
                )
              : 0;
          return (
            <button
              key={q}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelectedQuarter(q)}
              className={`text-left p-3.5 rounded-2xl border transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{q}-chorak</span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                    isSelected
                      ? 'bg-blue-700 text-blue-100'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {qStat.total} dars
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[11px] opacity-90">
                <span>
                  {mode === 'student'
                    ? `${qStat.completed} yakunlangan`
                    : `${qStat.published} nashr etilgan`}
                </span>
                <span>{pct}%</span>
              </div>
              <div
                className={`mt-1 h-1.5 w-full rounded-full overflow-hidden ${
                  isSelected ? 'bg-blue-800/60' : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                <div
                  className={`h-full rounded-full transition-all ${
                    isSelected ? 'bg-white' : 'bg-blue-600'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Mavzu nomi yoki dars raqami bo'yicha qidirish..."
            className="w-full h-10 pl-9 pr-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              aria-label="Dars turi"
              value={badgeFilter}
              onChange={(e) => setBadgeFilter(e.target.value)}
              className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">Barcha dars turlari</option>
              <option value="Oddiy dars">Oddiy dars</option>
              <option value="Yozma ish">Yozma ish</option>
              <option value="BSB">BSB</option>
              <option value="CHSB">CHSB</option>
              <option value="BSB tahlili">BSB tahlili</option>
              <option value="CHSB tahlili">CHSB tahlili</option>
              <option value="Loyiha ishi">Loyiha ishi</option>
              <option value="Takrorlash">Takrorlash</option>
            </select>
          </div>

          <select
            aria-label="Holat filtri"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">Barcha holatlar</option>
            <option value="COMPLETED">Yakunlangan (Completed)</option>
            <option value="NOT_STARTED">Boshlanmagan</option>
            <option value="HAS_TEST">Test mavjud</option>
          </select>
        </div>
      </div>

      {/* Vertical Learning Journey List */}
      {quarterLessons.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-8 text-center">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {selectedQuarter}-chorak uchun darslar topilmadi
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {parsedClass.track === 'T' && activeSubjectOption.subject === 'Matematika' && !tTrackApproved
              ? "Tabiiy fanlar (T-track) sinflari uchun qo'shimcha Matematika o'quv rejasi administrator tomonidan faollashtirilganda ko'rinadi."
              : "Tanlangan fan yoki qidiruv filtri bo'yicha hozircha dars qaydlari mavjud emas."}
          </p>
        </div>
      ) : (
        <div className="relative pl-4 sm:pl-6 space-y-2.5 before:content-[''] before:absolute before:left-1.5 sm:before:left-2.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {quarterLessons.map((lesson, idx) => {
            const badge = classifyRoadmap2LessonBadge(lesson);
            const learningState = getStudentLessonRoadmapState(
              lesson,
              studentLessonCompletions,
              currentUser?.uid
            );
            const completionObj = studentLessonCompletions.find(
              (c) => c.studentId === currentUser?.uid && c.lessonId === lesson.id
            );
            const isExpanded = expandedLessonId === lesson.id;

            const linkedTests = assessments.filter(
              (a) =>
                (mode === 'admin' || a.status === 'published') &&
                (a.lessonId === lesson.id || lesson.linkedAssessmentIds?.includes(a.id))
            );

            return (
              <div
                key={lesson.id}
                className={`relative bg-white dark:bg-slate-900 border rounded-2xl transition-all ${
                  learningState === 'Completed'
                    ? 'border-emerald-200/90 dark:border-emerald-800/60'
                    : isExpanded
                    ? 'border-blue-400 dark:border-blue-600 shadow-xs'
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Journey Node Indicator */}
                <div
                  className={`absolute -left-[19px] sm:-left-[23px] top-5 w-3.5 h-3.5 rounded-full border-2 ${
                    learningState === 'Completed'
                      ? 'bg-emerald-500 border-emerald-200 dark:border-emerald-900'
                      : learningState === 'Published'
                      ? 'bg-blue-600 border-blue-200 dark:border-blue-900'
                      : 'bg-slate-300 dark:bg-slate-700 border-white dark:border-slate-900'
                  }`}
                />

                {/* Compact Lesson Row Header */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedLessonId(isExpanded ? null : lesson.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandedLessonId(isExpanded ? null : lesson.id);
                    }
                  }}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                      {lesson.lessonNumber || idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${BADGE_STYLES[badge]}`}
                        >
                          {badge}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          <Clock className="w-3 h-3" />
                          {lesson.hours || 1} soat
                        </span>
                        {linkedTests.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                            <Sparkles className="w-3 h-3" />
                            Test mavjud ({linkedTests.length})
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white mt-1 break-words">
                        {lesson.topicTitle || lesson.title}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    {/* Accurate Learning Status Pill */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        learningState === 'Completed'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : learningState === 'Published'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {learningState === 'Completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>
                        {learningState === 'Completed'
                          ? 'Completed (Yakunlangan)'
                          : learningState === 'Published'
                          ? 'Published (Faol)'
                          : 'Planned (Rejada)'}
                      </span>
                    </span>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Lesson Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3.5 bg-slate-50/50 dark:bg-slate-900/40 rounded-b-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Sinf ishi (Classwork)
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 mt-1">
                          {lesson.classwork || "Darslik bo'yicha amaliy misol va masalalar yechish"}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Uyga vazifa (Homework)
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 mt-1">
                          {lesson.homework || "Mavzuni mustahkamlash uchun mustaqil mashqlar"}
                        </p>
                      </div>
                    </div>

                    {(lesson.notes || (lesson.learningObjectives && lesson.learningObjectives.length > 0)) && (
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          O'quv maqsadlari va izoh
                        </div>
                        {lesson.notes && (
                          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                            {lesson.notes}
                          </p>
                        )}
                        {lesson.learningObjectives &&
                          (Array.isArray(lesson.learningObjectives)
                            ? lesson.learningObjectives.length > 0
                            : String(lesson.learningObjectives).trim().length > 0) && (
                            <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                              {(Array.isArray(lesson.learningObjectives)
                                ? lesson.learningObjectives
                                : [lesson.learningObjectives]
                              ).map((obj, i) => (
                                <li key={i}>{obj}</li>
                              ))}
                            </ul>
                          )}
                      </div>
                    )}

                    {/* Attached Materials */}
                    {lesson.materials && lesson.materials.length > 0 && (
                      <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                          Biriktirilgan o'quv materiallari
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {lesson.materials.map((att) => (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-xs font-medium hover:underline"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              <span>{att.title}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Related Assessments */}
                    {linkedTests.length > 0 && (
                      <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/50">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-2">
                          Mavzuga oid test sinovlari
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {linkedTests.map((testItem) => (
                            <div
                              key={testItem.id}
                              className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-blue-200/70 dark:border-slate-700 text-xs"
                            >
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {testItem.title}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {testItem.questionIds.length} savol • {testItem.durationMinutes} daqiqa
                                </div>
                              </div>
                              {mode === 'student' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onStartAssessment
                                      ? onStartAssessment(testItem.id)
                                      : navigate(`/student/assessments/${testItem.id}`)
                                  }
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>Ishlash (+15 XP)</span>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Student Learning Actions */}
                    {mode === 'student' && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={learningState === 'Completed' || busyActionId === lesson.id}
                            onClick={async () => {
                              setBusyActionId(lesson.id);
                              try {
                                await completeStudentLesson(lesson.id);
                              } finally {
                                setBusyActionId(null);
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                              learningState === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 cursor-default'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {learningState === 'Completed'
                                ? 'Dars yakunlangan (+10 XP)'
                                : 'Darsni yakunlash (+10 XP)'}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={Boolean(completionObj?.practiceCompleted) || busyActionId === `prac_${lesson.id}`}
                            onClick={async () => {
                              setBusyActionId(`prac_${lesson.id}`);
                              try {
                                await completeStudentLessonPractice(lesson.id);
                              } finally {
                                setBusyActionId(null);
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${
                              completionObj?.practiceCompleted
                                ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 cursor-default'
                                : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <Award className="w-4 h-4 text-blue-600" />
                            <span>
                              {completionObj?.practiceCompleted
                                ? 'Uyga vazifa va mashq bajarilgan (+5 XP)'
                                : 'Mashqni bajardim (+5 XP)'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Admin Roadmap Editor Controls */}
                    {mode === 'admin' && (
                      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(lesson)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Tahrirlash va material biriktirish</span>
                          </button>

                          <button
                            type="button"
                            disabled={busyActionId === `gen_${lesson.id}`}
                            onClick={async () => {
                              setBusyActionId(`gen_${lesson.id}`);
                              try {
                                await generateLessonAssessment(lesson.id, {
                                  questionCount: 5,
                                  difficulty: 'medium',
                                  publishImmediately: true,
                                });
                              } finally {
                                setBusyActionId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>AI Test yaratish</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateLesson(lesson.id, {
                                status: lesson.status === 'published' ? 'draft' : 'published',
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                          >
                            {lesson.status === 'published' ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Qoralama qilish</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>Nashr etish</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => updateLesson(lesson.id, { status: 'archived' })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs font-semibold text-rose-700 dark:text-rose-300"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>Arxivlash</span>
                          </button>
                        </div>

                        {/* Reorder Controls with Confirmation */}
                        <div className="flex items-center gap-1.5">
                          {reorderConfirmId?.id === lesson.id ? (
                            <button
                              type="button"
                              onClick={async () => {
                                const dir = reorderConfirmId.dir;
                                setReorderConfirmId(null);
                                await reorderLesson({ lessonId: lesson.id, direction: dir });
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Siljitishni tasdiqlash</span>
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                title="Yuqoriga siljitish"
                                onClick={() => setReorderConfirmId({ id: lesson.id, dir: 'up' })}
                                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Pastga siljitish"
                                onClick={() => setReorderConfirmId({ id: lesson.id, dir: 'down' })}
                                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Admin Source Metadata Inspector */}
                    {mode === 'admin' && (lesson.sourceFileName || lesson.sourceFile) && (
                      <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-3 pt-1">
                        <span>Manba fayl: {lesson.sourceFileName || lesson.sourceFile}</span>
                        {lesson.sourceWorksheet && <span>Varoq: {lesson.sourceWorksheet}</span>}
                        {(lesson.sourceRowNumber || lesson.sourceRow) && (
                          <span>Qator: #{lesson.sourceRowNumber || lesson.sourceRow}</span>
                        )}
                        {lesson.modificationHistory && lesson.modificationHistory.length > 0 && (
                          <span>Tahrirlar soni: {lesson.modificationHistory.length}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Edit Lesson Modal */}
      {editingLesson && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingLesson.lessonNumber}-darsni tahrirlash
              </h3>
              <button
                type="button"
                onClick={() => setEditingLesson(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Yopish
              </button>
            </div>
            <form onSubmit={handleSaveLessonEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Dars mavzusi
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Sinf ishi
                  </label>
                  <input
                    type="text"
                    value={editClasswork}
                    onChange={(e) => setEditClasswork(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Uyga vazifa
                  </label>
                  <input
                    type="text"
                    value={editHomework}
                    onChange={(e) => setEditHomework(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  O'quv maqsadlari (har bir qatorda bittadan)
                </label>
                <textarea
                  rows={2}
                  value={editObjectives}
                  onChange={(e) => setEditObjectives(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Yangi material nomi (ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    placeholder="Masalan: Video dars"
                    value={editMaterialTitle}
                    onChange={(e) => setEditMaterialTitle(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Material havolasi (URL)
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={editMaterialUrl}
                    onChange={(e) => setEditMaterialUrl(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLesson(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Create Lesson Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {activeClassCode.toUpperCase()} sinf • {selectedQuarter}-chorakka yangi dars qo'shish
            </h3>
            <form onSubmit={handleCreateNewLesson} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Dars mavzusi
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Mavzu nomini kiriting"
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Sinf ishi
                  </label>
                  <input
                    type="text"
                    value={editClasswork}
                    onChange={(e) => setEditClasswork(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Uyga vazifa
                  </label>
                  <input
                    type="text"
                    value={editHomework}
                    onChange={(e) => setEditHomework(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  Qo'shish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
