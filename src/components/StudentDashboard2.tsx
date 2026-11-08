import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Compass,
  Flame,
  Layers,
  Play,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  CalendarCheck,
  FileText,
  Send,
  Clock,
  ExternalLink,
  FileCheck2,
  X,
} from 'lucide-react';
import { useLearnOS } from '../context/LearnOSContext';
import {
  GAMIFICATION_LEVELS,
  buildSmartNextSteps,
  buildStudentLearningJourney,
  buildWeeklyLearningRecap,
  createInitialGamificationProfile,
  createInitialStreakRecord,
  getTashkentDateString,
} from '../utils/gamificationEngine';
import { parseOfficialClassCode } from '../constants/curriculum';
import {
  GamificationBadgeSvg,
  LevelCrestSvg,
  StudentAvatarSvg,
} from './GamificationIcons';
import { calculateAttendanceStats } from '../utils/studentMonitoringEngine';
import { StudentAssignment } from '../types';

interface StudentDashboard2Props {
  onNavigate?: (page: string) => void;
  onStartAssessment?: (assessmentId: string) => void;
}

export const StudentDashboard2: React.FC<StudentDashboard2Props> = ({
  onNavigate: propOnNavigate,
  onStartAssessment: propOnStartAssessment,
}) => {
  const routerNavigate = useNavigate();

  const onNavigate = (page: string) => {
    if (propOnNavigate) {
      propOnNavigate(page);
      return;
    }
    const routeMap: Record<string, string> = {
      'learning-path': '/student/learning-path',
      lessons: '/student/lessons',
      assessments: '/student/assessments',
      profile: '/student/profile',
      progress: '/student/progress',
    };
    routerNavigate(routeMap[page] || `/student/${page}`);
  };

  const onStartAssessment = (assessmentId: string) => {
    if (propOnStartAssessment) {
      propOnStartAssessment(assessmentId);
      return;
    }
    routerNavigate(`/student/assessments/${assessmentId}`);
  };

  const {
    currentUser,
    classes,
    subjects,
    lessons,
    assessments,
    attempts,
    masteryRecords,
    studentGamificationProfiles,
    learningCheckins,
    studentGoals,
    learningActivityEvents,
    gamificationBadges,
    studentBadges,
    streakRecords,
    weeklyRecaps,
    classChallenges,
    gamificationConfig,
    studentLessonCompletions,
    studentAssignments,
    assignmentSubmissions,
    submissionRevisions,
    attendanceRecords,
    timetables,
    timetableEntries,
    announcements,
    announcementReads,
    announcementAcknowledgements,
    learningMaterials,
    submitDailyCheckin,
    completeStudentLesson,
    createStudentGoal,
    updateStudentGoal,
    saveAssignmentDraft,
    submitAssignment,
    markAnnouncementRead,
    acknowledgeAnnouncement,
  } = useLearnOS();

  const studentId = currentUser?.uid || '';
  const myClass = useMemo(() => {
    if (!currentUser) return undefined;
    return classes.find(
      (c) =>
        c.id === currentUser.classId ||
        (currentUser.classCode && c.code.toLowerCase() === currentUser.classCode.toLowerCase())
    );
  }, [currentUser, classes]);

  const classCode = (myClass?.code || currentUser?.classCode || '7a1').toLowerCase();
  const parsedClass = useMemo(
    () =>
      parseOfficialClassCode(classCode) || {
        code: '7a1' as any,
        grade: 7,
        track: 'A' as const,
        trackLabel: 'Aniq fanlar',
        section: 1,
      },
    [classCode]
  );

  const profile = useMemo(() => {
    return (
      studentGamificationProfiles.find((p) => p.studentId === studentId) ||
      createInitialGamificationProfile(studentId)
    );
  }, [studentGamificationProfiles, studentId]);

  const streak = useMemo(() => {
    return (
      streakRecords.find((s) => s.studentId === studentId) ||
      createInitialStreakRecord(studentId, gamificationConfig.streakGraceDays)
    );
  }, [streakRecords, studentId, gamificationConfig.streakGraceDays]);

  const applicableSubjects = useMemo(() => {
    if (subjects.length > 0) {
      return subjects.map((s) => s.name);
    }
    return parsedClass.track === 'A'
      ? ['Matematika', 'Fizika', 'Ingliz tili']
      : ['Biologiya', 'Kimyo', 'Ingliz tili'];
  }, [subjects, parsedClass.track]);

  const todayDateKey = useMemo(() => getTashkentDateString(), []);
  const todayCheckin = useMemo(
    () => learningCheckins.find((c) => c.studentId === studentId && c.date === todayDateKey),
    [learningCheckins, studentId, todayDateKey]
  );

  // Daily Check-in state ("Bugungi maqsading")
  const [checkinSubject, setCheckinSubject] = useState<string>(
    todayCheckin?.selectedSubject || applicableSubjects[0] || 'Matematika'
  );
  const [checkinGoal, setCheckinGoal] = useState<string>(
    todayCheckin?.selectedGoal ||
      gamificationConfig.goalTemplates?.[0] ||
      "1 ta darsni o'rganish"
  );
  const [customGoalText, setCustomGoalText] = useState<string>('');
  const [isSubmittingCheckin, setIsSubmittingCheckin] = useState(false);

  // Weekly personal goal form state
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("Haftada 3 ta darsni o'zlashtirish");
  const [newGoalSubject, setNewGoalSubject] = useState(applicableSubjects[0] || 'Matematika');
  const [newGoalTarget, setNewGoalTarget] = useState(3);
  const [busyLessonId, setBusyLessonId] = useState<string | null>(null);

  // Assignment submission modal state
  const [submissionModalAssignment, setSubmissionModalAssignment] = useState<StudentAssignment | null>(null);
  const [submissionContent, setSubmissionContent] = useState('');
  const [submissionAttachmentUrl, setSubmissionAttachmentUrl] = useState('');
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);

  // Filter assignments for student's class
  const myAssignments = useMemo(() => {
    return studentAssignments.filter((a) => {
      if (a.status !== 'published') return false;
      const targetCodes = a.targetClassCodes || (a.classCode ? [a.classCode] : []);
      if (targetCodes.length > 0 && !targetCodes.some((c) => c.toLowerCase() === classCode.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [studentAssignments, classCode]);

  // Submissions map
  const mySubmissionsMap = useMemo(() => {
    const map = new Map<string, any>();
    assignmentSubmissions
      .filter((s) => s.studentId === studentId)
      .forEach((s) => map.set(s.assignmentId, s));
    return map;
  }, [assignmentSubmissions, studentId]);

  // Attendance stats for current student
  const myAttendanceStats = useMemo(() => {
    const myRecords = attendanceRecords.filter((r) => r.studentId === studentId);
    return calculateAttendanceStats(myRecords);
  }, [attendanceRecords, studentId]);

  // Student's Active Timetable & Today's Schedule
  const myActiveTimetable = useMemo(() => {
    return timetables.find(
      (t) => t.classCode.toLowerCase() === classCode.toLowerCase() && t.status === 'active'
    );
  }, [timetables, classCode]);

  const myTimetableEntries = useMemo(() => {
    if (!myActiveTimetable) return [];
    return timetableEntries
      .filter((e) => e.timetableId === myActiveTimetable.id)
      .sort((a, b) => a.lessonNumber - b.lessonNumber);
  }, [myActiveTimetable, timetableEntries]);

  const todayWeekday = useMemo(() => {
    const jsDay = new Date(`${getTashkentDateString()}T12:00:00Z`).getUTCDay();
    const map: Record<number, string> = {
      1: 'Dushanba',
      2: 'Seshanba',
      3: 'Chorshanba',
      4: 'Payshanba',
      5: 'Juma',
      6: 'Shanba',
      0: 'Yakshanba',
    };
    return map[jsDay] || 'Dushanba';
  }, []);

  const todaysTimetableLessons = useMemo(
    () => myTimetableEntries.filter((e) => e.weekday === todayWeekday),
    [myTimetableEntries, todayWeekday]
  );

  // Relevant Announcements for Student's Class
  const myAnnouncements = useMemo(() => {
    const now = Date.now();
    return announcements.filter((a) => {
      if (a.expirationDate && new Date(a.expirationDate).getTime() < now) return false;
      if (a.audienceType === 'entire_school') return true;
      return (a.targetClassCodes || []).some((c) => c.toLowerCase() === classCode.toLowerCase());
    });
  }, [announcements, classCode]);

  // Authorized Learning Materials for Student's Class
  const myMaterials = useMemo(() => {
    return learningMaterials.filter(
      (m) =>
        m.status === 'published' &&
        (!m.classCode ||
          (m.classCode as string) === 'All' ||
          m.classCode.toLowerCase() === classCode.toLowerCase())
    );
  }, [learningMaterials, classCode]);

  const handleSaveDraftForm = async () => {
    if (!submissionModalAssignment || !submissionContent.trim()) return;
    setIsSubmittingAssignment(true);
    try {
      await saveAssignmentDraft({
        assignmentId: submissionModalAssignment.id,
        draftContent: submissionContent.trim(),
        draftAttachmentUrl: submissionAttachmentUrl.trim() || undefined,
      });
      setSubmissionModalAssignment(null);
      setSubmissionContent('');
      setSubmissionAttachmentUrl('');
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  const handleSubmitAssignmentForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionModalAssignment) return;
    setIsSubmittingAssignment(true);
    try {
      await submitAssignment({
        assignmentId: submissionModalAssignment.id,
        content: submissionContent.trim(),
        attachmentUrl: submissionAttachmentUrl.trim() || undefined,
      });
      setSubmissionModalAssignment(null);
      setSubmissionContent('');
      setSubmissionAttachmentUrl('');
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  const myCompletions = useMemo(
    () => studentLessonCompletions.filter((c) => c.studentId === studentId),
    [studentLessonCompletions, studentId]
  );

  const completedLessonIds = useMemo(
    () => new Set(myCompletions.filter((c) => c.status === 'completed').map((c) => c.lessonId)),
    [myCompletions]
  );

  const myClassLessons = useMemo(() => {
    return lessons
      .filter(
        (l) =>
          l.status !== 'archived' &&
          (l.classCode?.toLowerCase() === classCode ||
            l.classCodes?.some((c) => c.toLowerCase() === classCode) ||
            l.classId === `class-${classCode}`)
      )
      .sort(
        (a, b) =>
          (a.quarter || 1) - (b.quarter || 1) ||
          (a.lessonNumber || a.orderIndex || 0) - (b.lessonNumber || b.orderIndex || 0)
      );
  }, [lessons, classCode]);

  // Next lesson for Section 2 ("Davom ettirish")
  const nextContinueLesson = useMemo(() => {
    return (
      myClassLessons.find((l) => l.status === 'published' && !completedLessonIds.has(l.id)) ||
      myClassLessons.find((l) => !completedLessonIds.has(l.id)) ||
      null
    );
  }, [myClassLessons, completedLessonIds]);

  // Subject cards data for Section 4
  const subjectCardsData = useMemo(() => {
    return applicableSubjects.map((subjName) => {
      const subjLessons = myClassLessons.filter(
        (l) => (l.subjectName || l.subject || '').toLowerCase() === subjName.toLowerCase()
      );
      const completedCount = subjLessons.filter((l) => completedLessonIds.has(l.id)).length;
      const nextSubjLesson = subjLessons.find((l) => !completedLessonIds.has(l.id));
      const pct =
        subjLessons.length > 0 ? Math.round((completedCount / subjLessons.length) * 100) : 0;

      return {
        name: subjName,
        totalLessons: subjLessons.length,
        completedLessons: completedCount,
        progressPercent: pct,
        nextLesson: nextSubjLesson,
      };
    });
  }, [applicableSubjects, myClassLessons, completedLessonIds]);

  // Learning Journey Milestones
  const journeyMilestones = useMemo(
    () =>
      buildStudentLearningJourney({
        studentId,
        profile,
        completions: myCompletions,
        submissions: attempts as any,
        lessons: myClassLessons,
      }),
    [studentId, profile, myCompletions, attempts, myClassLessons]
  );

  // Smart Next Steps ("Keyingi qadam")
  const smartRecommendations = useMemo(
    () =>
      buildSmartNextSteps({
        studentId,
        classCode,
        lessons: myClassLessons,
        assessments,
        completions: myCompletions,
        submissions: attempts as any,
      }),
    [studentId, classCode, myClassLessons, assessments, myCompletions, attempts]
  );

  // Weekly Learning Recap ("Haftalik natijang")
  const weeklyRecap = useMemo(() => {
    const existing = weeklyRecaps.find((r) => r.studentId === studentId);
    if (existing) return existing;
    return buildWeeklyLearningRecap({
      studentId,
      events: learningActivityEvents.filter((e) => e.studentId === studentId),
      studentBadges: studentBadges.filter((b) => b.studentId === studentId),
      lessons: myClassLessons,
      classCode,
      completions: myCompletions,
    });
  }, [
    weeklyRecaps,
    studentId,
    learningActivityEvents,
    studentBadges,
    myClassLessons,
    classCode,
    myCompletions,
  ]);

  const earnedBadgeCodes = useMemo(
    () => new Set(studentBadges.filter((b) => b.studentId === studentId).map((b) => b.badgeCode)),
    [studentBadges, studentId]
  );

  const activeClassChallenges = useMemo(
    () =>
      classChallenges.filter(
        (ch) => ch.isActive && ch.classCode.toLowerCase() === classCode
      ),
    [classChallenges, classCode]
  );

  const openAssessments = useMemo(() => {
    const submittedIds = new Set(
      attempts.filter((a) => a.studentId === studentId).map((a) => a.assessmentId)
    );
    return assessments.filter((a) => a.status === 'published' && !submittedIds.has(a.id));
  }, [assessments, attempts, studentId]);

  const handleCheckinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingCheckin(true);
    try {
      const finalGoal = customGoalText.trim() || checkinGoal;
      await submitDailyCheckin({
        selectedSubject: checkinSubject,
        selectedGoal: finalGoal,
        completionState: 'active',
      });
      setCustomGoalText('');
    } finally {
      setIsSubmittingCheckin(false);
    }
  };

  const handleAddWeeklyGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;
    await createStudentGoal({
      period: 'weekly',
      subject: newGoalSubject,
      title: newGoalTitle.trim(),
      targetCount: Number(newGoalTarget) || 3,
    });
    setShowGoalForm(false);
  };

  const firstName = (currentUser?.firstName || currentUser?.displayName || "O'quvchi").split(' ')[0];

  return (
    <div className="space-y-6">
      {/* =====================================================================
          SECTION 1 — PERSONAL WELCOME & COMPACT LEARNING JOURNEY HEADER
         ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <StudentAvatarSvg iconKey={profile.avatarIcon} size={56} />
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <span>{classCode.toUpperCase()} sinf</span>
                <span>•</span>
                <span>{parsedClass.track === 'A' ? 'Aniq fanlar' : 'Tabiiy fanlar'}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                Salom, {firstName}!
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                Bugun nimani o'rganamiz?
              </p>
            </div>
          </div>

          {/* Level, XP & Healthy Streak Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto lg:min-w-[420px]">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 flex items-center gap-3">
              <LevelCrestSvg level={profile.currentLevel} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {profile.currentLevel}-daraja: {profile.currentLevelTitle}
                  </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {profile.totalXp} XP
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${profile.levelProgressPercent}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {profile.nextLevelXp
                    ? `Keyingi darajagacha: ${Math.max(0, profile.nextLevelXp - profile.totalXp)} XP`
                    : 'Maksimal Ekspert darajasi!'}
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Izchillik: {streak.currentStreakDays} kun
                  </span>
                  <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    Rekord: {streak.longestStreakDays} kun
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                  {streak.statusMessage}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SECTION 2 & 3 — CONTINUE LEARNING ("DAVOM ETTIRISH") + DAILY CHECK-IN ("BUGUNGI MAQSADING")
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Section 2: Continue Learning */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                <Compass className="w-4 h-4" />
                <span>Davom ettirish</span>
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Yakunlangan darslar: {completedLessonIds.size} / {myClassLessons.length}
              </span>
            </div>

            {nextContinueLesson ? (
              <div className="mt-3 p-4 rounded-2xl bg-gradient-to-br from-blue-50/90 to-indigo-50/60 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-200/70 dark:border-blue-800/60 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-600 text-white text-xs font-bold">
                    {nextContinueLesson.quarter || 1}-chorak • {nextContinueLesson.lessonNumber}-dars
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700">
                    {nextContinueLesson.subjectName || nextContinueLesson.subject}
                    {nextContinueLesson.curriculumArea ? ` (${nextContinueLesson.curriculumArea})` : ''}
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {nextContinueLesson.topicTitle || nextContinueLesson.title}
                </h2>

                {(nextContinueLesson.classwork || nextContinueLesson.homework) && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {nextContinueLesson.classwork
                      ? `Sinf ishi: ${nextContinueLesson.classwork}`
                      : `Uyga vazifa: ${nextContinueLesson.homework}`}
                  </p>
                )}

                <div className="pt-1 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onNavigate('learning-path')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>O'quv xaritasida ochish</span>
                  </button>

                  <button
                    type="button"
                    disabled={busyLessonId === nextContinueLesson.id}
                    onClick={async () => {
                      setBusyLessonId(nextContinueLesson.id);
                      try {
                        await completeStudentLesson(nextContinueLesson.id);
                      } finally {
                        setBusyLessonId(null);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Darsni yakunlash (+10 XP)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700 text-center">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Hozircha faol dars tanlanmagan
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  O'quv xaritasi (Roadmap 2.0) bo'limiga o'tib, chorak darslarini ko'rib chiqing.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('learning-path')}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
                >
                  <span>O'quv xaritasini ochish</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Upcoming Assessments & Today's Focus */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              <span>Bugungi diqqat markazida (Faol testlar)</span>
              <span>{openAssessments.length} ta ochiq test</span>
            </div>
            {openAssessments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {openAssessments.slice(0, 2).map((assess) => (
                  <div
                    key={assess.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {assess.title}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {assess.subject} • {assess.durationMinutes} daqiqa
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onStartAssessment(assess.id)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0"
                    >
                      Boshlash
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Barcha joriy test topshiriqlari bajarilgan. Navbatdagi darslarni o'zlashtirishda davom eting!
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Daily Check-in Card ("Bugungi maqsading") */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                <Target className="w-4 h-4" />
                <span>Bugungi maqsading</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-bold">
                +{gamificationConfig.xpRewards.daily_checkin} XP
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              Bugun nimani o'rganmoqchisan?
            </h3>

            {todayCheckin ? (
              <div className="mt-3 p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Bugungi maqsading belgilandi!</span>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {todayCheckin.selectedSubject}: {todayCheckin.selectedGoal}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Holat: {todayCheckin.completionState === 'completed' ? 'Bajarildi' : 'Faol'}
                  </span>
                  {todayCheckin.completionState !== 'completed' && (
                    <button
                      type="button"
                      onClick={() =>
                        submitDailyCheckin({
                          selectedSubject: todayCheckin.selectedSubject,
                          selectedGoal: todayCheckin.selectedGoal,
                          completionState: 'completed',
                        })
                      }
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
                    >
                      Bajarildi deb belgilash
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleCheckinSubmit} className="mt-3 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Fanni tanlang
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {applicableSubjects.map((subj) => (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => setCheckinSubject(subj)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                          checkinSubject === subj
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {subj}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Bugungi kichik maqsad
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {(
                      gamificationConfig.goalTemplates || [
                        "1 ta darsni o'rganish",
                        '10 ta mashq bajarish',
                        '1 ta test ishlash',
                        'Oldingi mavzuni takrorlash',
                      ]
                    ).map((tpl) => (
                      <button
                        key={tpl}
                        type="button"
                        onClick={() => {
                          setCheckinGoal(tpl);
                          setCustomGoalText('');
                        }}
                        className={`text-left px-3 py-2 rounded-xl text-xs font-medium border transition ${
                          checkinGoal === tpl && !customGoalText
                            ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-semibold'
                            : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700'
                        }`}
                      >
                        {tpl}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="text"
                  value={customGoalText}
                  onChange={(e) => setCustomGoalText(e.target.value)}
                  placeholder="Yoki shaxsiy maqsadingizni yozing..."
                  className="w-full h-9 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />

                <button
                  type="submit"
                  disabled={isSubmittingCheckin}
                  className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
                >
                  {isSubmittingCheckin ? 'Saqlanmoqda...' : 'Maqsadni belgilash (+5 XP)'}
                </button>
              </form>
            )}
          </div>

          {/* Weekly Personal Goals ("Shaxsiy haftalik maqsadlar") */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Haftalik shaxsiy maqsad (+20 XP)
              </span>
              <button
                type="button"
                onClick={() => setShowGoalForm(!showGoalForm)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yangi maqsad</span>
              </button>
            </div>

            {showGoalForm && (
              <form onSubmit={handleAddWeeklyGoal} className="mb-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <input
                  type="text"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  placeholder="Haftalik maqsad..."
                />
                <div className="flex items-center gap-2">
                  <select
                    value={newGoalSubject}
                    onChange={(e) => setNewGoalSubject(e.target.value)}
                    className="h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    {applicableSubjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newGoalTarget}
                    onChange={(e) => setNewGoalTarget(Number(e.target.value))}
                    className="w-16 h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                  />
                  <button
                    type="submit"
                    className="ml-auto px-3 h-8 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                  >
                    Saqlash
                  </button>
                </div>
              </form>
            )}

            {studentGoals.length > 0 ? (
              <div className="space-y-1.5">
                {studentGoals.slice(0, 2).map((goal) => (
                  <div
                    key={goal.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {goal.title}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {goal.subject} • {goal.currentCount} / {goal.targetCount}
                      </div>
                    </div>
                    {goal.status === 'completed' ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px] font-semibold">
                        Bajarildi
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          updateStudentGoal(goal.id, {
                            currentCount: goal.currentCount + 1,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold hover:bg-blue-100"
                      >
                        +1 qadam
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Shaxsiy haftalik o'quv maqsadingizni belgilab, +20 XP va "Mashg'ulot ustasi" nishoniga ega bo'ling.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Cooperative Class Challenge (if active for student's class) */}
      {activeClassChallenges.length > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 sm:p-5 text-white shadow-xs">
          {activeClassChallenges.map((ch) => {
            const pct = Math.min(100, Math.round((ch.currentCount / Math.max(1, ch.targetCount)) * 100));
            return (
              <div key={ch.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-100">
                    <Users className="w-4 h-4" />
                    <span>{classCode.toUpperCase()} sinf jamoaviy marrasi</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold">{ch.title}</h3>
                  <p className="text-xs text-blue-100">{ch.description}</p>
                </div>
                <div className="sm:w-64 shrink-0 bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span>Sinf natijasi: {ch.currentCount} / {ch.targetCount}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-blue-950/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =====================================================================
          ACADEMIC OS 2.0: TODAY'S TIMETABLE & ANNOUNCEMENTS
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Today's Class Timetable */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>Bugungi dars jadvali ({todayWeekday})</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {classCode.toUpperCase()} sinfi uchun tasdiqlangan rasmiy jadval
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('timetable')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                To'liq jadval →
              </button>
            </div>

            {!myActiveTimetable ? (
              <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-center">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Sinfingiz uchun dars jadvali hali kiritilmagan
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Ma'muriyat tomonidan rasmiy jadval tasdiqlangach shu yerda ko'rinadi.
                </p>
              </div>
            ) : todaysTimetableLessons.length === 0 ? (
              <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center text-xs text-slate-500">
                Bugun ({todayWeekday}) uchun jadvalda darslar belgilanmagan.
              </div>
            ) : (
              <div className="space-y-2">
                {todaysTimetableLessons.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                      idx === 0
                        ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/70'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">
                        {entry.lessonNumber}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {entry.subject}
                          {idx === 0 && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px]">
                              Keyingi dars
                            </span>
                          )}
                        </div>
                        {entry.roadmapTopic && (
                          <div className="text-[11px] text-slate-500 truncate">
                            Mavzu: {entry.roadmapTopic}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      <div>
                        {entry.startTime} – {entry.endTime}
                      </div>
                      {entry.room && <div className="text-[10px] text-slate-400">Xona: {entry.room}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* School & Class Announcements */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Maktab va Sinf E'lonlari</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Muhim xabarlar, imtihon sanalari va jadval o'zgarishlari
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('announcements')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Barchasi ({myAnnouncements.length}) →
              </button>
            </div>

            {myAnnouncements.length === 0 ? (
              <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500">
                Sinfingiz uchun yangi e'lonlar mavjud emas.
              </div>
            ) : (
              <div className="space-y-2.5">
                {myAnnouncements.slice(0, 3).map((ann) => {
                  const isRead = announcementReads.some(
                    (r) => r.announcementId === ann.id && r.studentId === studentId
                  );
                  const isAck = announcementAcknowledgements.some(
                    (a) => a.announcementId === ann.id && a.studentId === studentId
                  );

                  return (
                    <div
                      key={ann.id}
                      className={`p-3 rounded-xl border text-xs space-y-2 ${
                        ann.priority === 'urgent' || ann.priority === 'high'
                          ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{ann.title}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(ann.publicationDate || ann.createdAt).toLocaleDateString('uz-UZ')}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 line-clamp-2">
                        {ann.shortContent || ann.content}
                      </p>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        {!isRead ? (
                          <button
                            type="button"
                            onClick={() => markAnnouncementRead(ann.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-medium"
                          >
                            O'qidim
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            ✓ O'qilgan
                          </span>
                        )}

                        {(ann.requiresAcknowledgment || ann.requiresAcknowledgement) &&
                          (!isAck ? (
                            <button
                              type="button"
                              onClick={() => acknowledgeAnnouncement(ann.id)}
                              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold"
                            >
                              Tanishdim va tasdiqlayman
                            </button>
                          ) : (
                            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                              ✓ Tasdiqlangan
                            </span>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {myMaterials.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300">
                O'quv materiallari kutubxonasi: <strong>{myMaterials.length} ta resurs</strong>
              </span>
              <button
                type="button"
                onClick={() => onNavigate('materials')}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Kutubxonani ochish →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          ACADEMIC MONITORING: ASSIGNMENTS & OFFICIAL ATTENDANCE SUMMARY
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Assignments widget */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Mening vazifalarim
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sinfingiz uchun berilgan amaliy va mustaqil topshiriqlar
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {myAssignments.length} ta vazifa
              </span>
            </div>

            {myAssignments.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700">
                <FileCheck2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Hozirda yangi topshiriqlar yo‘q
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Ustoz tomonidan yangi vazifalar berilganda shu yerda ko‘rinadi.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myAssignments.slice(0, 4).map((assign) => {
                  const submission = mySubmissionsMap.get(assign.id);
                  const isGraded = submission?.status === 'graded';
                  const isSubmitted = submission?.status === 'submitted' || isGraded;
                  const isLate = !isSubmitted && new Date(assign.dueDate) < new Date();

                  return (
                    <div
                      key={assign.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                            {assign.subject || assign.subjectName}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {assign.title}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px] mt-1 line-clamp-1">
                          {assign.description}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Muddati: {new Date(assign.dueDate).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' })}
                          </span>
                          <span>Maks. ball: {assign.maxScore}</span>
                          {submission?.score !== undefined && (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              Natija: {submission.score} / {assign.maxScore}
                            </span>
                          )}
                        </div>
                        {submission?.feedback && (
                          <div className="mt-1.5 p-2 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-[11px] text-emerald-900 dark:text-emerald-200">
                            <span className="font-semibold">O‘qituvchi fikri:</span> {submission.feedback}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isGraded ? (
                          <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-semibold text-[11px]">
                            Baholandi
                          </span>
                        ) : isSubmitted ? (
                          <span className="px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 font-semibold text-[11px]">
                            Topshirildi
                          </span>
                        ) : isLate ? (
                          <span className="px-2.5 py-1 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 font-semibold text-[11px]">
                            Muddati o‘tgan
                          </span>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => {
                            setSubmissionModalAssignment(assign);
                            setSubmissionContent(submission?.content || '');
                            setSubmissionAttachmentUrl(submission?.attachmentUrl || '');
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                            isSubmitted
                              ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                          }`}
                        >
                          {isSubmitted ? 'Qayta yuborish' : 'Topshirish'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Attendance widget */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Mening davomatim
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Jurnalga qayd etilgan rasmiy darslar ko‘rsatkichi
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {(myAttendanceStats.totalSessions||0)>0?`${myAttendanceStats.attendanceRate}%`:'Qayd yo‘q'}
                </span>
                <span className="block text-[10px] text-slate-400 font-medium">davomat</span>
              </div>
            </div>

            {/* 4 Attendance Status Counts */}
            <div className="grid grid-cols-4 gap-2 mt-4 text-center">
              <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60">
                <div className="text-base font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                  {myAttendanceStats.presentCount}
                </div>
                <div className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-200">
                  Keldi
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60">
                <div className="text-base font-bold text-amber-700 dark:text-amber-300 font-mono">
                  {myAttendanceStats.lateCount}
                </div>
                <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                  Kechikdi
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60">
                <div className="text-base font-bold text-blue-700 dark:text-blue-300 font-mono">
                  {myAttendanceStats.excusedCount}
                </div>
                <div className="text-[10px] font-semibold text-blue-800 dark:text-blue-200">
                  Sababli
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/60">
                <div className="text-base font-bold text-rose-700 dark:text-rose-300 font-mono">
                  {myAttendanceStats.absentCount}
                </div>
                <div className="text-[10px] font-semibold text-rose-800 dark:text-rose-200">
                  Kelmagan
                </div>
              </div>
            </div>

            {/* Explanatory Note */}
            <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 text-[11px] text-slate-500 leading-relaxed">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">
                Rasmiy qayd: {myAttendanceStats.totalSessions} ta dars sessiyasi
              </span>
              Davomat faqat haqiqatda dars o‘tilgan va jurnalga qayd etilgan rasmiy kunlar bo‘yicha hisoblanadi. Ta'tillar hisobga olinmaydi.
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SECTION 4 — SUBJECTS ("SINF FANLARI")
         ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Sinf fanlari va o'quv yo'nalishlari
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {classCode.toUpperCase()} sinfi uchun biriktirilgan fanlar va shaxsiy o'zlashtirish ko'rsatkichi
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('learning-path')}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            <span>To'liq xarita</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {subjectCardsData.map((card) => (
            <div
              key={card.name}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{card.name}</h3>
                  <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {card.totalLessons} ta dars
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500 dark:text-slate-400">Shaxsiy progress</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {card.completedLessons} / {card.totalLessons} ({card.progressPercent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: `${card.progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">
                    Navbatdagi dars
                  </div>
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-200 mt-0.5 line-clamp-1">
                    {card.nextLesson
                      ? `${card.nextLesson.lessonNumber}-dars: ${card.nextLesson.topicTitle || card.nextLesson.title}`
                      : "O'quv xaritasi bo'yicha tanlang"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('learning-path')}
                className="w-full py-2 rounded-xl bg-white hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-blue-600 dark:text-blue-400 transition"
              >
                Fan xaritasini ochish
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* =====================================================================
          SECTION 5 — LEARNING ACHIEVEMENTS & WEEKLY LEARNING RECAP ("HAFTALIK NATIJANG")
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Achievements & Badges */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-600" />
                <span>O'quv yutuqlari va nishonlar</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Haqiqiy o'zlashtirilgan darslar va testlar asosida beriladigan nishonlar
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-bold">
              {earnedBadgeCodes.size} / {gamificationBadges.length} nishon
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {gamificationBadges.map((badge) => {
              const isEarned = earnedBadgeCodes.has(badge.code);
              return (
                <div
                  key={badge.id}
                  className={`p-3 rounded-xl border flex items-center gap-3 transition ${
                    isEarned
                      ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/70'
                      : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 opacity-75'
                  }`}
                >
                  <GamificationBadgeSvg code={badge.code} earned={isEarned} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {badge.title}
                      </span>
                      {isEarned && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Olingan
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {badge.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Learning Recap ("Haftalik natijang") */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                <Calendar className="w-4 h-4" />
                <span>Haftalik natijang</span>
              </div>
              <span className="text-[11px] text-slate-400">
                {weeklyRecap.weekStartDate} — {weeklyRecap.weekEndDate}
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              O'z o'sish dinamikangiz
            </h3>

            <div className="mt-3 grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {weeklyRecap.completedLessonsCount}
                </div>
                <div className="text-[11px] text-slate-500">Darslar</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {weeklyRecap.completedTestsCount}
                </div>
                <div className="text-[11px] text-slate-500">Testlar</div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/50 text-center">
                <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                  +{weeklyRecap.xpEarned}
                </div>
                <div className="text-[11px] text-blue-600 dark:text-blue-400">Haftalik XP</div>
              </div>
            </div>

            <div className="mt-3.5 space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700">
                <span className="font-semibold text-slate-500 dark:text-slate-400 block">
                  O'rganilgan fanlar:
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {weeklyRecap.subjectsStudied.length > 0
                    ? weeklyRecap.subjectsStudied.join(', ')
                    : "Bu hafta faoliyatni boshlash uchun dars tanlang"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/50">
                <span className="font-semibold text-blue-700 dark:text-blue-300 block">
                  Tavsiya etilgan keyingi e'tibor:
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {weeklyRecap.recommendedNextFocus}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className="mt-4 w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
          >
            Shaxsiy profil va barcha yutuqlarni ko'rish
          </button>
        </div>
      </div>

      {/* =====================================================================
          SECTION 6 — PERSONAL PROGRESS, LEARNING JOURNEY & SMART RECOMMENDATIONS ("KEYINGI QADAM")
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Learning Journey Visualization */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Shaxsiy O'quv Sayohati (Learning Journey)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
            Sizning haqiqiy o'quv ko'rsatkichlaringiz asosida erishilgan marralar
          </p>

          <div className="relative pl-5 space-y-3 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {journeyMilestones.map((ms) => (
              <div
                key={ms.id}
                className={`relative p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  ms.reached
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-700'
                }`}
              >
                <div
                  className={`absolute -left-[19px] w-3 h-3 rounded-full border-2 ${
                    ms.reached
                      ? 'bg-emerald-500 border-emerald-200'
                      : 'bg-slate-300 dark:bg-slate-700 border-white dark:border-slate-900'
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {ms.title}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {ms.subtitle}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold shrink-0 ${
                    ms.reached
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {ms.progressText}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Learning Recommendations ("Keyingi qadam") */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Keyingi qadam (Aqlli tavsiyalar)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
              O'quv rejasi ketma-ketligi va shaxsiy natijalaringiz asosida keyingi amallar
            </p>

            <div className="space-y-3">
              {smartRecommendations.length > 0 ? (
                smartRecommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase">
                        {rec.subject}
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                        {rec.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Sabab: {rec.reason}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (rec.assessmentId) {
                          onStartAssessment(rec.assessmentId);
                        } else {
                          onNavigate(rec.targetRoute);
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 transition"
                    >
                      {rec.actionLabel}
                    </button>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500">
                  O'quv xaritasi bo'limidan birinchi mavzuni tanlab o'rganishni boshlang.
                </div>
              )}
            </div>
          </div>

          {/* Topic Mastery Quick Summary */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              O'zlashtirilgan mavzular tahlili: <span className="font-bold">{masteryRecords.length} ta mavzu</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('knowledge-map')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Bilimlar xaritasi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Assignment Submission Modal */}
      {submissionModalAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {submissionModalAssignment.subject || submissionModalAssignment.subjectName}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {submissionModalAssignment.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSubmissionModalAssignment(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Yopish"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAssignmentForm} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Javob matni yoki izoh
                </label>
                <textarea
                  rows={4}
                  required
                  value={submissionContent}
                  onChange={(e) => setSubmissionContent(e.target.value)}
                  placeholder="Vazifa bo‘yicha yozma javobingizni yoki hisobotingizni yozing..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 resize-none text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Fayl yoki havola (Google Drive, Docs, GitHub va h.k.)
                </label>
                <input
                  type="url"
                  value={submissionAttachmentUrl}
                  onChange={(e) => setSubmissionAttachmentUrl(e.target.value)}
                  placeholder="https://docs.google.com/..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSubmissionModalAssignment(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold cursor-pointer text-slate-700 dark:text-slate-300"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  disabled={isSubmittingAssignment || !submissionContent.trim()}
                  onClick={handleSaveDraftForm}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-semibold cursor-pointer disabled:opacity-50"
                >
                  Qoralama saqlash
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAssignment || !submissionContent.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingAssignment ? 'Yuborilmoqda...' : 'Tasdiqlab yuborish'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
