import React, { useState, useMemo } from 'react';
import { useLearnOS } from '../context/LearnOSContext';
import { OFFICIAL_19_CLASS_CODES } from '../constants/curriculum';
import {
  AssignmentCriterionScore,
  AssignmentSubmission,
  GradingRubric,
} from '../types';
import { calculateRubricTotalScore } from '../utils/academicOsEngine';
import {
  CheckSquare,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  History,
  FileText,
  Plus,
  BookOpen,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';

export const AdminSmartGradingPanel: React.FC = () => {
  const {
    studentAssignments,
    assignmentSubmissions,
    submissionRevisions,
    gradingRubrics,
    feedbackComments,
    gradingHistory,
    lessons,
    gradeAssignment,
    requestAiAssignmentEvaluation,
    createGradingRubric,
  } = useLearnOS();

  // Filters
  const [classFilter, setClassFilter] = useState('ALL');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [assignmentFilter, setAssignmentFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'submissionDate' | 'dueDate'>('submissionDate');

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>('');
  const [selectedRubricId, setSelectedRubricId] = useState<string>(
    gradingRubrics[0]?.id || 'rubric_math_standard'
  );
  const [criterionScores, setCriterionScores] = useState<Record<string, number>>({});
  const [manualScore, setManualScore] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [recommendedLessonId, setRecommendedLessonId] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showNewRubricModal, setShowNewRubricModal] = useState(false);

  // New rubric modal state
  const [newRubricTitle, setNewRubricTitle] = useState('');
  const [newRubricSubject, setNewRubricSubject] = useState('Matematika');
  const [newRubricDesc, setNewRubricDesc] = useState('');

  const assignmentMap = useMemo(() => {
    const m = new Map<string, (typeof studentAssignments)[0]>();
    studentAssignments.forEach((a) => m.set(a.id, a));
    return m;
  }, [studentAssignments]);

  const filteredQueue = useMemo(() => {
    const list = assignmentSubmissions.filter((sub) => {
      const asg = assignmentMap.get(sub.assignmentId);
      if (classFilter !== 'ALL' && sub.classCode.toLowerCase() !== classFilter.toLowerCase()) {
        return false;
      }
      if (subjectFilter !== 'ALL' && asg?.subject !== subjectFilter) {
        return false;
      }
      if (assignmentFilter !== 'ALL' && sub.assignmentId !== assignmentFilter) {
        return false;
      }
      if (statusFilter !== 'ALL' && sub.status !== statusFilter) {
        return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'dueDate') {
        return a.dueDate.localeCompare(b.dueDate);
      }
      return (b.submissionDate || b.updatedAt).localeCompare(a.submissionDate || a.updatedAt);
    });
  }, [assignmentSubmissions, assignmentMap, classFilter, subjectFilter, assignmentFilter, statusFilter, sortBy]);

  const activeSubmission: AssignmentSubmission | null = useMemo(() => {
    if (selectedSubmissionId) {
      return filteredQueue.find((s) => s.id === selectedSubmissionId) || filteredQueue[0] || null;
    }
    return filteredQueue[0] || null;
  }, [filteredQueue, selectedSubmissionId]);

  const activeRubric: GradingRubric = useMemo(() => {
    return (
      gradingRubrics.find((r) => r.id === selectedRubricId) ||
      gradingRubrics[0]
    );
  }, [gradingRubrics, selectedRubricId]);

  const selectSubmissionForReview = (sub: AssignmentSubmission) => {
    setSelectedSubmissionId(sub.id);
    setManualScore(sub.score ?? sub.aiSuggestion?.suggestedTotalPoints ?? sub.maxScore);
    setFeedbackText(sub.feedback || sub.aiSuggestion?.suggestedFeedback || '');
    setRecommendedLessonId(sub.recommendedLessonId || '');
    const initCrit: Record<string, number> = {};
    if (sub.criterionScores?.length) {
      sub.criterionScores.forEach((cs) => {
        initCrit[cs.criterionId] = cs.awardedPoints;
      });
    } else if (sub.aiSuggestion?.criterionBreakdown?.length) {
      sub.aiSuggestion.criterionBreakdown.forEach((cs) => {
        initCrit[cs.criterionId] = cs.awardedPoints;
      });
    } else if (activeRubric) {
      activeRubric.criteria.forEach((c) => {
        initCrit[c.id] = c.maxPoints;
      });
    }
    setCriterionScores(initCrit);
  };

  const handleCriterionChange = (critId: string, val: number) => {
    const next = { ...criterionScores, [critId]: val };
    setCriterionScores(next);
    if (activeRubric && activeSubmission) {
      const list: AssignmentCriterionScore[] = activeRubric.criteria.map((c) => ({
        criterionId: c.id,
        criterionTitle: c.title,
        awardedPoints: next[c.id] ?? 0,
        maxPoints: c.maxPoints,
      }));
      const calc = calculateRubricTotalScore(activeRubric, list);
      const scale = calc.totalMax > 0 ? activeSubmission.maxScore / calc.totalMax : 1;
      setManualScore(Math.round(calc.totalAwarded * scale * 2) / 2);
    }
  };

  const handleAiSuggest = async () => {
    if (!activeSubmission) return;
    setIsAiLoading(true);
    try {
      const res = await requestAiAssignmentEvaluation({
        submissionId: activeSubmission.id,
        rubricId: activeRubric?.id,
      });
      if (res.aiSuggestion) {
        setManualScore(res.aiSuggestion.suggestedTotalPoints);
        setFeedbackText(
          `${res.aiSuggestion.suggestedFeedback}\n\nXatolar tahlili: ${res.aiSuggestion.mistakeExplanation}`
        );
        const nextCrit: Record<string, number> = {};
        res.aiSuggestion.criterionBreakdown.forEach((c) => {
          nextCrit[c.criterionId] = c.awardedPoints;
        });
        setCriterionScores(nextCrit);
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleConfirmGrade = async (status: 'Tekshirildi' | 'Qaytarildi') => {
    if (!activeSubmission) return;
    setIsSaving(true);
    try {
      const critArray: AssignmentCriterionScore[] | undefined = activeRubric
        ? activeRubric.criteria.map((c) => ({
            criterionId: c.id,
            criterionTitle: c.title,
            awardedPoints: criterionScores[c.id] ?? c.maxPoints,
            maxPoints: c.maxPoints,
          }))
        : undefined;
      const linkedLesson = lessons.find((l) => l.id === recommendedLessonId);

      await gradeAssignment({
        submissionId: activeSubmission.id,
        score: manualScore,
        feedback: feedbackText.trim(),
        status,
        rubricId: activeRubric?.id,
        criterionScores: critArray,
        recommendedLessonId: recommendedLessonId || undefined,
        recommendedLessonTitle: linkedLesson?.topicTitle || undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateDefaultRubric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRubricTitle.trim()) return;
    await createGradingRubric({
      title: newRubricTitle.trim(),
      subject: newRubricSubject,
      description: newRubricDesc.trim() || '5 mezonli standart baholash rubrikasi',
      criteria: [
        { title: "To'g'ri yechim", description: 'Formula va usul tanlovi', maxPoints: 3, partialCreditRules: 'Qisman usul uchun 1.5 ball' },
        { title: 'Mantiqiy fikrlash', description: 'Qadamlar izchilligi', maxPoints: 2, partialCreditRules: '1 ball' },
        { title: 'Hisoblash aniqligi', description: 'Xatosiz hisob-kitob', maxPoints: 2, partialCreditRules: '1 ball' },
        { title: 'Tushuntirish', description: 'Izoh va chizmalar', maxPoints: 1, partialCreditRules: '0.5 ball' },
        { title: 'Yakuniy javob', description: "To'g'ri yakuniy natija va birliklar", maxPoints: 2, partialCreditRules: '1 ball' },
      ],
    });
    setNewRubricTitle('');
    setShowNewRubricModal(false);
  };

  const activeRevisions = useMemo(() => {
    if (!activeSubmission) return [];
    return submissionRevisions.filter((r) => r.submissionId === activeSubmission.id);
  }, [submissionRevisions, activeSubmission]);

  const activeHistory = useMemo(() => {
    if (!activeSubmission) return [];
    return gradingHistory.filter((h) => h.targetId === activeSubmission.id);
  }, [gradingHistory, activeSubmission]);

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Aqlli Tekshiruv va Baholash Markazi (Smart Grading Engine)
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rubrika mezonlari, AI dastlabki tahlili (Administrator tasdig‘i bilan) va qayta ishlash izohlari
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowNewRubricModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Yangi rubrika yaratish
          </button>
        </div>

        {/* Sort & Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            aria-label="Sinf bo'yicha filtr"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">Sinf: Barchasi</option>
            {OFFICIAL_19_CLASS_CODES.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()}
              </option>
            ))}
          </select>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            aria-label="Fan bo'yicha filtr"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">Fan: Barchasi</option>
            <option value="Matematika">Matematika</option>
            <option value="Ingliz tili">Ingliz tili</option>
            <option value="Fizika">Fizika</option>
            <option value="Biologiya">Biologiya</option>
            <option value="Kimyo">Kimyo</option>
          </select>

          <select
            value={assignmentFilter}
            onChange={(e) => setAssignmentFilter(e.target.value)}
            aria-label="Topshiriq bo'yicha filtr"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">Topshiriq: Barchasi</option>
            {studentAssignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Tekshiruv holati bo'yicha filtr"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">Holati: Barchasi ({assignmentSubmissions.length})</option>
            <option value="Topshirildi">Topshirildi (Tekshiruv kutmoqda)</option>
            <option value="Tekshirilmoqda">Tekshirilmoqda (AI ko‘rib chiqilgan)</option>
            <option value="Tekshirildi">Tekshirildi (Rasmiy baholangan)</option>
            <option value="Qaytarildi">Qaytarildi (Tuzatishga)</option>
            <option value="Jarayonda">Jarayonda (Qoralama)</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'submissionDate' | 'dueDate')}
            aria-label="Saralash tartibi"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="submissionDate">Saralash: Topshirilgan vaqti</option>
            <option value="dueDate">Saralash: Topshirish muddati</option>
          </select>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Queue */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 max-h-[750px] overflow-y-auto">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Topshirilgan ishlar navbati ({filteredQueue.length})
            </h2>
          </div>

          {filteredQueue.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Tanlangan filtr bo‘yicha tekshiriladigan topshiriqlar topilmadi.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredQueue.map((sub) => {
                const isSelected = activeSubmission?.id === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => selectSubmissionForReview(sub)}
                    className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600'
                        : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {sub.studentName} ({sub.classCode.toUpperCase()})
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sub.status === 'Tekshirildi'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : sub.status === 'Topshirildi' || sub.status === 'Tekshirilmoqda'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            : sub.status === 'Qaytarildi'
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-1">
                      {sub.assignmentTitle}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                      <span>Urinish: {sub.attemptCount}-marta</span>
                      <span>
                        {sub.score !== undefined ? `${sub.score} / ${sub.maxScore} ball` : `Maks: ${sub.maxScore} ball`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Review & Rubric Grader */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5">
          {!activeSubmission ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Chap ro‘yxatdan o‘quvchi javobini tanlab ko‘rib chiqing va baholang.
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                      {activeSubmission.classCode.toUpperCase()}
                    </span>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {activeSubmission.studentName} — {activeSubmission.assignmentTitle}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    Topshirilgan vaqt: {activeSubmission.submissionDate?.slice(0, 16).replace('T', ' ') || 'Hali topshirilmagan'} • Muddat: {activeSubmission.dueDate}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAiSuggest}
                  disabled={isAiLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {isAiLoading ? 'AI tahlil qilmoqda...' : 'Gemini AI tavsiyasini olish'}
                </button>
              </div>

              {activeSubmission.aiSuggestion&&<p className="text-xs leading-6 text-slate-500">Tavsiya manbasi: {activeSubmission.aiSuggestion.source==='gemini'?'AI modeli: '+activeSubmission.aiSuggestion.model:activeSubmission.aiSuggestion.source==='local_rules'?'Mahalliy mezonli tavsiya':'Eski tavsiya: manba qayd etilmagan'} · {new Date(activeSubmission.aiSuggestion.generatedAt).toLocaleString('uz-UZ')} · dastlabki tavsiya, inson tekshiruvi shart.</p>}
              {/* Guardrail Notice */}
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <span className="font-bold">Rasmiy baholash qoidasi:</span> AI tavsiyasi hech qachon avtomatik ravishda rasmiy bahoga aylanmaydi. Administrator rubrika ballari va izohni tekshirib, <b>"Rasmiy bahoni tasdiqlash"</b> tugmasini bosishi shart.
                </div>
              </div>

              {/* Student Submitted Work */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  O‘quvchining yuborgan javobi ({activeSubmission.attemptCount}-urinish)
                </div>
                <div className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap font-medium">
                  {activeSubmission.content || activeSubmission.draftContent || 'Matnli javob kiritilmagan.'}
                </div>
                {activeSubmission.attachmentUrl && (
                  <div className="pt-2">
                    <a
                      href={activeSubmission.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Biriktirilgan faylni ochish ({activeSubmission.attachmentName || 'Fayl'})
                    </a>
                  </div>
                )}
              </div>

              {/* Rubric Criteria Grader */}
              {activeRubric && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Baholash rubrikasi:
                    </label>
                    <select
                      value={selectedRubricId}
                      onChange={(e) => setSelectedRubricId(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      {gradingRubrics.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title} ({r.totalMaxPoints} ball)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeRubric.criteria.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            {c.title}
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-1">
                            {c.description}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            step="0.5"
                            min={0}
                            max={c.maxPoints}
                            value={criterionScores[c.id] ?? c.maxPoints}
                            onChange={(e) => handleCriterionChange(c.id, Number(e.target.value))}
                            className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-center text-slate-900 dark:text-white tabular-nums"
                          />
                          <span className="text-xs text-slate-400 tabular-nums">/ {c.maxPoints}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Final Official Score & Feedback */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Yakuniy rasmiy ball (Maks: {activeSubmission.maxScore})
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={activeSubmission.maxScore}
                    value={manualScore}
                    onChange={(e) => setManualScore(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white tabular-nums"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Takrorlash uchun dars tavsiya etish (ixtiyoriy)
                  </label>
                  <select
                    value={recommendedLessonId}
                    onChange={(e) => setRecommendedLessonId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="">— Mavzuni tanlang —</option>
                    {lessons
                      .filter((l) => l.classCode?.toLowerCase() === activeSubmission.classCode.toLowerCase())
                      .slice(0, 50)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.quarter}-chorak, {l.lessonNumber}-dars: {l.topicTitle}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Reusable Quick Feedback Chips */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                  Tezkor izoh shablonlari:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {feedbackComments.map((fc) => (
                    <button
                      key={fc.id}
                      type="button"
                      onClick={() =>
                        setFeedbackText((prev) => (prev ? `${prev} ${fc.text}` : fc.text))
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-[11px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      + {fc.text}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="O'quvchiga yechim bo'yicha batafsil izoh va xatolar tushuntirishini yozing..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleConfirmGrade('Qaytarildi')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Qayta ishlash uchun qaytarish (Qaytarildi)
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleConfirmGrade('Tekshirildi')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Rasmiy bahoni tasdiqlash ({manualScore} / {activeSubmission.maxScore})
                </button>
              </div>

              {/* Prior Revisions & Grading History */}
              {(activeRevisions.length > 0 || activeHistory.length > 0) && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Topshirish va baholash tarixi ({activeRevisions.length + activeHistory.length})
                  </div>
                  {activeRevisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-300"
                    >
                      <span className="font-bold">{rev.revisionNumber}-urinish (Arxivlangan):</span>{' '}
                      {rev.content} ({rev.submittedAt.slice(0, 16).replace('T', ' ')})
                    </div>
                  ))}
                  {activeHistory.map((h) => (
                    <div
                      key={h.id}
                      className="p-2.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 text-xs text-slate-700 dark:text-slate-300"
                    >
                      <span className="font-bold">{h.confirmedByName}:</span> {h.newScore}/{h.maxScore} ball — "{h.feedback}" ({h.confirmedAt.slice(0, 16).replace('T', ' ')})
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* New Rubric Modal */}
      {showNewRubricModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Yangi qayta ishlatiluvchi rubrika yaratish
            </h3>
            <form onSubmit={handleCreateDefaultRubric} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Rubrika nomi
                </label>
                <input
                  type="text"
                  required
                  value={newRubricTitle}
                  onChange={(e) => setNewRubricTitle(e.target.value)}
                  placeholder="Masalan: 9-sinf Geometriya isbot masalalari rubrikasi"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Fan
                </label>
                <select
                  value={newRubricSubject}
                  onChange={(e) => setNewRubricSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                >
                  <option value="Matematika">Matematika</option>
                  <option value="Fizika">Fizika</option>
                  <option value="Ingliz tili">Ingliz tili</option>
                  <option value="Biologiya">Biologiya</option>
                  <option value="Kimyo">Kimyo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Tavsif
                </label>
                <textarea
                  rows={2}
                  value={newRubricDesc}
                  onChange={(e) => setNewRubricDesc(e.target.value)}
                  placeholder="To'g'ri yechim (3), Mantiqiy fikrlash (2), Hisoblash aniqligi (2), Tushuntirish (1), Yakuniy javob (2)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewRubricModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
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
