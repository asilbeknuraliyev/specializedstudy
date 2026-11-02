import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Flag,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Download,
  BookOpen,
  FileText,
  ExternalLink,
  X,
  CheckSquare,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import { useLearnOS } from '../context/LearnOSContext';
import { LearningPathStepStatus, LessonItem } from '../types';
import { APP_NAME, isSubjectCompatibleWithClass } from '../constants/curriculum';

export const StudentDashboardPage: React.FC = () => {
  const {
    currentUser,
    classes,
    subjects,
    lessons,
    assessments,
    attempts,
    masteryRecords,
    learningPaths,
  } = useLearnOS();

  const studentId = currentUser?.uid || '';
  const studentClass = classes.find(
    (c) => c.id === currentUser?.classId || c.name === currentUser?.classCode
  );
  const classCode = studentClass?.name || currentUser?.classCode || '7a1';
  const grade = studentClass?.grade || currentUser?.grade || 7;
  const track = studentClass?.track || currentUser?.track || 'A';

  const mySubjects = subjects.filter((s) => isSubjectCompatibleWithClass(s.name, classCode).compatible);
  const myLessons = lessons.filter((l) => {
    const matchesClass =
      l.classId === studentClass?.id ||
      l.classCode?.toLowerCase() === classCode.toLowerCase() ||
      (Array.isArray(l.classIds) && studentClass?.id && l.classIds.includes(studentClass.id)) ||
      (Array.isArray(l.classCodes) &&
        l.classCodes.some((c) => c.toLowerCase() === classCode.toLowerCase()));
    if (!matchesClass) return false;
    if (l.additionalCurriculumAssignment && l.tTrackVisibilityApproved !== true) return false;
    return l.status === 'published' || l.status === 'completed';
  });
  const myAttempts = attempts.filter((a) => a.studentId === studentId);
  const completedIds = new Set(myAttempts.map((a) => a.assessmentId));
  const publishedAssessments = assessments.filter((a) => {
    if (a.status !== 'published') return false;
    if (!a.classId && !a.classCode && (!a.assignedClassCodes || a.assignedClassCodes.length === 0)) {
      return true;
    }
    return (
      a.classId === studentClass?.id ||
      a.classCode?.toLowerCase() === classCode.toLowerCase() ||
      (Array.isArray(a.assignedClassCodes) &&
        a.assignedClassCodes.some((c) => c.toLowerCase() === classCode.toLowerCase()))
    );
  });
  const pendingAssessments = publishedAssessments.filter((a) => !completedIds.has(a.id));
  const myMastery = masteryRecords.filter((r) => r.studentId === studentId);
  const myPaths = learningPaths.filter((lp) => lp.studentId === studentId);

  const avgAccuracy =
    myMastery.length > 0
      ? Math.round(myMastery.reduce((acc, r) => acc + r.accuracy, 0) / myMastery.length)
      : 0;

  const progressChartData = myAttempts
    .slice()
    .reverse()
    .map((att, idx) => ({
      date:
        new Date(att.submittedAt).toLocaleDateString('uz-UZ', {
          day: '2-digit',
          month: 'short',
        }) || `${idx + 1}-urinish`,
      score: att.scorePercent,
    }));

  return (
    <div className="space-y-8">
      {/* Greeting & Student Class/Track Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="px-2.5 py-0.5 rounded-md bg-blue-600 text-white font-mono">
              {classCode} sinfi
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {grade}-sinf
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-md ${
                track === 'T'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
              }`}
            >
              {track === 'T' ? 'T — Tabiiy fanlar yo‘nalishi' : 'A — Aniq fanlar yo‘nalishi'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Xush kelibsiz, {currentUser?.displayName || 'O‘quvchi'}
          </h1>
          <p className="text-xs text-slate-500">
            Fanlaringiz: {mySubjects.map((s) => s.name).join(' • ')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/student/lessons"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Darslar ({myLessons.length})</span>
          </Link>
          <Link
            to="/student/assessments"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors whitespace-nowrap"
          >
            <span>Testlarni ko‘rish</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Overview KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">Nashr qilingan darslar</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
            {myLessons.length}
          </p>
          <p className="text-xs text-slate-500">{classCode} o‘quv xaritasi bo‘yicha</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">Kutilayotgan testlar</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {pendingAssessments.length}
          </p>
          <p className="text-xs text-slate-500">Topshirilgan: {myAttempts.length} ta</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">Baholangan mavzular</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {myMastery.length}
          </p>
          <p className="text-xs text-slate-500">O‘quv xaritam ko‘rsatkichi</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">O‘rtacha o‘zlashtirish</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {avgAccuracy}%
          </p>
          <p className="text-xs text-slate-500">Oxirgi natija: {myAttempts[0]?.scorePercent ?? 0}%</p>
        </div>
      </div>

      {/* Upcoming Lessons & Assigned Tests */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Sinfingiz uchun joriy darslar ({classCode})
              </h2>
              <p className="text-xs text-slate-500">
                O‘quv xaritasi bo‘yicha nashr qilingan darslar va uyga vazifalar
              </p>
            </div>
            <Link
              to="/student/lessons"
              className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap"
            >
              Barcha darslar
            </Link>
          </div>

          {myLessons.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">
                Hozircha {classCode} sinfi uchun nashr qilingan darslar yo‘q.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myLessons.slice(0, 4).map((les) => (
                <div
                  key={les.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold">
                        {les.subject}
                      </span>
                      <span className="font-mono text-slate-500">
                        {les.quarter}-chorak · {les.lessonNumber}-dars
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {les.topicTitle}
                    </p>
                    {les.homework && (
                      <p className="text-xs text-slate-500 truncate">
                        Uyga vazifa: {les.homework}
                      </p>
                    )}
                  </div>
                  <Link
                    to="/student/lessons"
                    className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shrink-0"
                  >
                    Ochish
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Topic Mastery Summary */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                O‘quv xaritam holati
              </h2>
              <p className="text-xs text-slate-500">Mavzular kesimida joriy ko‘rsatkich</p>
            </div>
            <Link
              to="/student/knowledge-map"
              className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap"
            >
              Xaritani ochish
            </Link>
          </div>

          {myMastery.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4">
              <p className="text-xs font-medium text-slate-500">
                Birinchi testni topshirganingizdan so‘ng shaxsiy o‘quv xaritangiz yangilanadi.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {myMastery.slice(0, 5).map((m) => (
                <div key={m.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {m.topicName}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums shrink-0">
                      {m.statusLabel} · {m.accuracy}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        m.accuracy >= 80
                          ? 'bg-emerald-600'
                          : m.accuracy >= 50
                          ? 'bg-blue-600'
                          : 'bg-rose-600'
                      }`}
                      style={{ width: `${m.accuracy}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Grid: Assigned Tests & Progress Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Biriktirilgan testlar va so‘nggi natijalar
            </h2>
            <Link
              to="/student/assessments"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Barchasi
            </Link>
          </div>

          {publishedAssessments.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-200 dark:border-slate-800 text-center">
              <p className="text-xs text-slate-500">
                Hozircha sizga biriktirilgan testlar yo‘q.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {publishedAssessments.slice(0, 4).map((assess) => {
                const attempt = myAttempts.find((a) => a.assessmentId === assess.id);
                return (
                  <div
                    key={assess.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {assess.title}
                      </p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {assess.subject} · {assess.questionIds.length} ta savol · {assess.durationMinutes} daq
                      </p>
                    </div>
                    {attempt ? (
                      <Link
                        to={`/student/results/${attempt.id}`}
                        className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg whitespace-nowrap shrink-0"
                      >
                        Natija: {attempt.scorePercent}%
                      </Link>
                    ) : (
                      <Link
                        to={`/student/assessments/${assess.id}`}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap shrink-0"
                      >
                        Testni boshlash
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                O‘zlashtirish dinamikasi
              </h2>
              <p className="text-xs text-slate-500">Test urinishlari bo‘yicha natijalar</p>
            </div>
            <Link
              to="/student/results"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Natijalar tarixi
            </Link>
          </div>

          {progressChartData.length === 0 ? (
            <div className="h-52 flex items-center justify-center bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">Hozircha test natijalari mavjud emas.</p>
            </div>
          ) : (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="Natija (%)"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const StudentLessonsPage: React.FC = () => {
  const { currentUser, classes, subjects, lessons, assessments } = useLearnOS();

  const studentClass = classes.find(
    (c) => c.id === currentUser?.classId || c.name === currentUser?.classCode
  );
  const classCode = studentClass?.name || currentUser?.classCode || '7a1';
  const mySubjects = subjects.filter((s) => isSubjectCompatibleWithClass(s.name, classCode).compatible);

  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [quarterFilter, setQuarterFilter] = useState<string>('ALL');
  const [selectedLesson, setSelectedLesson] = useState<LessonItem | null>(null);

  const classMatchingLessons = lessons.filter((l) => {
    const matchesClass =
      l.classId === studentClass?.id ||
      l.classCode?.toLowerCase() === classCode.toLowerCase() ||
      (Array.isArray(l.classIds) && studentClass?.id && l.classIds.includes(studentClass.id)) ||
      (Array.isArray(l.classCodes) &&
        l.classCodes.some((c) => c.toLowerCase() === classCode.toLowerCase()));
    if (!matchesClass) return false;
    if (l.additionalCurriculumAssignment && l.tTrackVisibilityApproved !== true) return false;
    return l.status === 'published' || l.status === 'completed';
  });

  const availableCurriculumAreas = Array.from(
    new Set(
      classMatchingLessons
        .map((l) => l.curriculumArea || l.subjectName || l.subject)
        .filter(Boolean)
    )
  );

  const visibleLessons = classMatchingLessons
    .filter((l) =>
      subjectFilter === 'ALL'
        ? true
        : (l.curriculumArea || l.subjectName || l.subject) === subjectFilter ||
          l.subject === subjectFilter
    )
    .filter((l) => (quarterFilter === 'ALL' ? true : String(l.quarter) === quarterFilter))
    .sort((a, b) => a.quarter - b.quarter || a.lessonNumber - b.lessonNumber);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            {classCode} sinfi · O‘quv darslari va materiallar ({visibleLessons.length} ta dars)
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Darslar</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Fanni tanlash"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
          >
            <option value="ALL">Barcha fanlar va bo‘limlar</option>
            {Array.from(
              new Set([...mySubjects.map((s) => s.name), ...availableCurriculumAreas])
            ).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            aria-label="Chorakni tanlash"
            value={quarterFilter}
            onChange={(e) => setQuarterFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold"
          >
            <option value="ALL">Barcha choraklar</option>
            <option value="1">1-chorak</option>
            <option value="2">2-chorak</option>
            <option value="3">3-chorak</option>
            <option value="4">4-chorak</option>
          </select>
        </div>
      </div>

      {visibleLessons.length === 0 ? (
        <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-2">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Hozircha ushbu filtr bo‘yicha nashr qilingan darslar topilmadi.
          </p>
          <p className="text-xs text-slate-500">
            O‘quv xaritasidagi darslar nashr qilinganda ular shu yerda ko‘rinadi.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {visibleLessons.slice(0, 60).map((lesson) => {
            const linkedTest = assessments.find(
              (a) =>
                a.status === 'published' &&
                (a.lessonId === lesson.id || lesson.linkedAssessmentIds?.includes(a.id))
            );
            return (
              <div
                key={lesson.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {lesson.curriculumArea || lesson.subject} · {lesson.quarterLabel || `${lesson.quarter}-chorak`}
                    </span>
                    <span className="font-mono text-slate-500">
                      {lesson.lessonNumber}-dars ({lesson.hours} soat)
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">
                    {lesson.lessonType || lesson.unit}
                  </p>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {lesson.topicTitle || lesson.title}
                  </h2>
                  {lesson.classwork && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      <strong>Sinf ishi:</strong> {lesson.classwork}
                    </p>
                  )}
                  {lesson.homework && (
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-xs">
                      <strong className="text-slate-800 dark:text-slate-200">Uyga vazifa:</strong>{' '}
                      <span className="text-slate-600 dark:text-slate-400">{lesson.homework}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedLesson(lesson)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    Dars tafsilotlari
                  </button>

                  {linkedTest && (
                    <Link
                      to={`/student/assessments/${linkedTest.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                    >
                      <span>Testni boshlash</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lesson Detail Modal */}
      {selectedLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <p className="text-xs font-semibold text-blue-600">
                  {selectedLesson.classCode} • {selectedLesson.subject} • {selectedLesson.quarter}-chorak •{' '}
                  {selectedLesson.lessonNumber}-dars
                </p>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {selectedLesson.topicTitle}
                </h3>
                <p className="text-xs text-slate-500">Bo‘lim: {selectedLesson.unit}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLesson(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedLesson.learningObjectives &&
              (Array.isArray(selectedLesson.learningObjectives)
                ? selectedLesson.learningObjectives.length > 0
                : String(selectedLesson.learningObjectives).trim().length > 0) && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    O‘quv maqsadlari va sinf ishi
                  </h4>
                  <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                    {(Array.isArray(selectedLesson.learningObjectives)
                      ? selectedLesson.learningObjectives
                      : [selectedLesson.learningObjectives]
                    ).map((obj, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {(selectedLesson.explanationContent || selectedLesson.description) && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Dars mazmuni va tushuntirish
                </h4>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {selectedLesson.explanationContent || selectedLesson.description}
                </div>
              </div>
            )}

            {selectedLesson.homework && (
              <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-1">
                <p className="text-xs font-bold text-amber-900 dark:text-amber-300">
                  Uyga vazifa (Homework)
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {selectedLesson.homework}
                </p>
              </div>
            )}

            {selectedLesson.materials && selectedLesson.materials.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Biriktirilgan materiallar
                </h4>
                <div className="space-y-2">
                  {selectedLesson.materials.map((mat) => (
                    <div
                      key={mat.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold">{mat.title}</span>
                      </div>
                      {mat.url && (
                        <a
                          href={mat.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 font-semibold hover:underline"
                        >
                          <span>Ochish</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedLesson(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
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

export const StudentAssessmentsPage: React.FC = () => {
  const { currentUser, classes, assessments, attempts } = useLearnOS();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const studentId = currentUser?.uid || '';
  const studentClass = classes.find(
    (c) => c.id === currentUser?.classId || c.name === currentUser?.classCode
  );
  const classCode = studentClass?.name || currentUser?.classCode || '';

  const myAttempts = attempts.filter((a) => a.studentId === studentId);
  const published = assessments.filter((a) => {
    if (a.status !== 'published') return false;
    if (!a.classId && !a.classCode && (!a.assignedClassCodes || a.assignedClassCodes.length === 0)) {
      return true;
    }
    return (
      a.classId === studentClass?.id ||
      a.classCode?.toLowerCase() === classCode.toLowerCase() ||
      (Array.isArray(a.assignedClassCodes) &&
        a.assignedClassCodes.some((c) => c.toLowerCase() === classCode.toLowerCase()))
    );
  });

  const filtered = published.filter((a) => {
    const isDone = myAttempts.some((att) => att.assessmentId === a.id);
    if (filter === 'pending') return !isDone;
    if (filter === 'completed') return isDone;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Testlar</h1>
          <p className="text-sm text-slate-500">
            {classCode ? `${classCode} sinfi uchun biriktirilgan` : 'Biriktirilgan'} sinovlarni topshiring va AI tahlilini oling
          </p>
        </div>

        {/* Interactive Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
          {[
            { id: 'all', label: 'Barcha testlar' },
            { id: 'pending', label: 'Kutilayotgan' },
            { id: 'completed', label: 'Topshirilgan' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-2">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Hozircha sizga biriktirilgan testlar yo‘q.
          </p>
          <p className="text-xs text-slate-500">
            Sinfingizga yangi diagnostik test nashr qilinganda u shu yerda ko‘rinadi.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((assess) => {
            const latestAttempt = myAttempts.find((att) => att.assessmentId === assess.id);
            return (
              <div
                key={assess.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5"
              >
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 font-mono tabular-nums">
                    {assess.subject} · {assess.classCode || `${assess.grade}-sinf`} ·{' '}
                    {assess.durationMinutes} daqiqa · Muddat: {assess.dueDate}
                  </p>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {assess.title}
                  </h2>
                  {assess.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {assess.description}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    Jami: {assess.questionIds.length} ta savol
                  </span>

                  <div className="flex items-center gap-2">
                    {latestAttempt && (
                      <Link
                        to={`/student/results/${latestAttempt.id}`}
                        className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg whitespace-nowrap"
                      >
                        Natijani ko‘rish ({latestAttempt.scorePercent}%)
                      </Link>
                    )}
                    <Link
                      to={`/student/assessments/${assess.id}`}
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap"
                    >
                      {latestAttempt ? 'Qayta topshirish' : 'Testni boshlash'}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const AssessmentRunnerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { assessments, questions, submitAssessmentAttempt, addToast } = useLearnOS();

  const assessment = assessments.find((a) => a.id === id) || assessments[0];
  const assessmentQuestions =
    assessment?.questionSnapshot && assessment.questionSnapshot.length > 0
      ? assessment.questionSnapshot
      : questions.filter((q) => assessment?.questionIds.includes(q.id));

  const storageKey = `specialized_study_autosave_${assessment?.id}`;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answersMap, setAnswersMap] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  });
  const [flaggedIds, setFlaggedIds] = useState<Record<string, boolean>>({});
  const [secondsLeft, setSecondsLeft] = useState((assessment?.durationMinutes || 20) * 60);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (assessment?.id) {
      localStorage.setItem(storageKey, JSON.stringify(answersMap));
    }
  }, [answersMap, assessment?.id, storageKey]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!assessment || assessmentQuestions.length === 0) {
    return (
      <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-4">
        <p className="text-sm text-slate-600">Test topilmadi yoki savollar biriktirilmagan.</p>
        <Link
          to="/student/assessments"
          className="inline-block px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg"
        >
          Testlar ro‘yxatiga qaytish
        </Link>
      </div>
    );
  }

  const currentQuestion = assessmentQuestions[currentIndex];
  const answeredCount = Object.keys(answersMap).filter((k) => answersMap[k]?.trim()).length;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSelectAnswer = (val: string) => {
    setAnswersMap((prev) => ({ ...prev, [currentQuestion.id]: val }));
  };

  const isMultiChoiceQuestion =
    currentQuestion.type === 'multi_select' ||
    (currentQuestion.type === 'multiple_choice' &&
      (currentQuestion.correctAnswer.includes('|') ||
        (currentQuestion.optionItems?.filter((o) => o.isCorrect).length || 0) > 1));

  const handleToggleMultiAnswer = (val: string) => {
    const currentRaw = answersMap[currentQuestion.id] || '';
    const parts = currentRaw
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    const next = parts.includes(val) ? parts.filter((p) => p !== val) : [...parts, val];
    setAnswersMap((prev) => ({ ...prev, [currentQuestion.id]: next.join('|') }));
  };

  const toggleFlag = (qId: string) => {
    setFlaggedIds((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleFinalSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const attempt = await submitAssessmentAttempt(assessment.id, answersMap);
      localStorage.removeItem(storageKey);
      navigate(`/student/results/${attempt.id}`);
    } catch (err) {
      console.error(err);
      addToast('error', 'Testni yuborishda xatolik yuz berdi');
      setIsSubmitting(false);
    }
  };

  const questionTypeLabel: Record<string, string> = {
    single_choice: 'Bitta to‘g‘ri javobni tanlang',
    multiple_choice: isMultiChoiceQuestion
      ? 'Bir nechta to‘g‘ri javoblarni belgilang'
      : 'To‘g‘ri javob variantini tanlang',
    multi_select: 'Bir nechta to‘g‘ri javoblarni belgilang',
    numeric: 'Sonli javob kiriting',
    short_text: 'Qisqa yozma javob kiriting',
    written_open: 'Batafsil yozma yechim va izoh yozing',
    long_text: 'Batafsil yozma yechim va izoh yozing',
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Title, Autosave Status & Timer */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">
            Avtomatik saqlash yoqilgan · Javob berildi: {answeredCount} / {assessmentQuestions.length}
          </p>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {assessment.title}
          </h1>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-mono tabular-nums font-semibold">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>{formatTime(secondsLeft)}</span>
          </div>
          <button
            type="button"
            onClick={() => setConfirmModalOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
          >
            Testni yakunlash
          </button>
        </div>
      </div>

      {/* Question Navigator Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-2">
        {assessmentQuestions.map((q, idx) => {
          const isAnswered = Boolean(answersMap[q.id]?.trim());
          const isFlagged = Boolean(flaggedIds[q.id]);
          const isCurrent = idx === currentIndex;
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              aria-label={`${idx + 1}-savol`}
              className={`w-9 h-9 rounded-lg text-xs font-mono font-semibold border transition-colors ${
                isCurrent
                  ? 'bg-blue-600 text-white border-blue-600'
                  : isFlagged
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 border-amber-400'
                  : isAnswered
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
              }`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Current Question Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500">
            <span>
              Savol {currentIndex + 1} / {assessmentQuestions.length}
            </span>
            <span>·</span>
            <span className="font-semibold text-blue-600">
              {currentQuestion.points ?? 1} ball
            </span>
            <span>·</span>
            <span className="text-slate-600 dark:text-slate-400 font-sans">
              {questionTypeLabel[currentQuestion.type] || 'Savol'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => toggleFlag(currentQuestion.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              flaggedIds[currentQuestion.id]
                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 border-amber-300'
                : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>
              {flaggedIds[currentQuestion.id]
                ? 'Ko‘rib chiqishga belgilangan'
                : 'Qayta ko‘rish uchun belgilash'}
            </span>
          </button>
        </div>

        <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
          {currentQuestion.prompt}
        </p>

        {currentQuestion.imageUrl && (
          <div className="space-y-1.5">
            <img
              src={currentQuestion.imageUrl}
              alt="Savol tasviri"
              onClick={() => setZoomImageUrl(currentQuestion.imageUrl || null)}
              className="max-h-72 rounded-xl border border-slate-200 dark:border-slate-800 object-contain cursor-zoom-in bg-white p-2"
            />
          </div>
        )}

        {/* Choice Questions */}
        {(currentQuestion.type === 'single_choice' ||
          currentQuestion.type === 'multiple_choice' ||
          currentQuestion.type === 'multi_select') && (
          <div className="space-y-3" role="group" aria-label="Javob variantlari">
            {currentQuestion.optionItems && currentQuestion.optionItems.length > 0
              ? currentQuestion.optionItems.map((optItem) => {
                  const rawAns = answersMap[currentQuestion.id] || '';
                  const selectedParts = rawAns
                    .split('|')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const optKey = optItem.key || optItem.code || '';
                  const valueToUse = optItem.text || optKey;
                  const selected = isMultiChoiceQuestion
                    ? selectedParts.includes(optKey) || selectedParts.includes(valueToUse)
                    : rawAns === valueToUse || rawAns === optKey;

                  return (
                    <div
                      key={optKey || valueToUse}
                      onClick={() =>
                        isMultiChoiceQuestion
                          ? handleToggleMultiAnswer(optKey)
                          : handleSelectAnswer(valueToUse)
                      }
                      className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition-colors cursor-pointer flex items-center justify-between gap-4 ${
                        selected
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-600 text-blue-900 dark:text-blue-200'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                            {optItem.key}
                          </span>
                          <span>{optItem.text}</span>
                        </div>
                        {optItem.imageUrl && (
                          <img
                            src={optItem.imageUrl}
                            alt={`Variant ${optItem.key}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setZoomImageUrl(optItem.imageUrl || null);
                            }}
                            className="max-h-32 rounded-lg border border-slate-200 dark:border-slate-800 object-contain bg-white p-1"
                          />
                        )}
                      </div>
                      {selected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                    </div>
                  );
                })
              : (currentQuestion.options || []).map((opt) => {
                  const rawAns = answersMap[currentQuestion.id] || '';
                  const selectedParts = rawAns
                    .split('|')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const selected = isMultiChoiceQuestion
                    ? selectedParts.includes(opt)
                    : rawAns === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        isMultiChoiceQuestion
                          ? handleToggleMultiAnswer(opt)
                          : handleSelectAnswer(opt)
                      }
                      className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition-colors flex items-center justify-between ${
                        selected
                          ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-600 text-blue-900 dark:text-blue-200'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <span>{opt}</span>
                      {selected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
          </div>
        )}

        {/* Numeric Answer Question */}
        {currentQuestion.type === 'numeric' && (
          <div className="space-y-2 max-w-md">
            <label
              htmlFor="numeric-answer-input"
              className="block text-xs font-semibold text-slate-600 dark:text-slate-400"
            >
              Sonli javobni kiriting:
            </label>
            <input
              id="numeric-answer-input"
              type="text"
              value={answersMap[currentQuestion.id] || ''}
              onChange={(e) => handleSelectAnswer(e.target.value)}
              placeholder="Masalan: 12 yoki 3.5"
              className="w-full px-4 py-3 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-600"
            />
          </div>
        )}

        {/* Short Text Written Question */}
        {currentQuestion.type === 'short_text' && (
          <div className="space-y-2 max-w-xl">
            <label
              htmlFor="short-text-answer-input"
              className="block text-xs font-semibold text-slate-600 dark:text-slate-400"
            >
              Qisqa yozma javobingizni kiriting:
            </label>
            <input
              id="short-text-answer-input"
              type="text"
              value={answersMap[currentQuestion.id] || ''}
              onChange={(e) => handleSelectAnswer(e.target.value)}
              placeholder="Javobni qisqa va aniq yozing..."
              className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-600"
            />
          </div>
        )}

        {/* Written Open / Long Text Question */}
        {(currentQuestion.type === 'long_text' || currentQuestion.type === 'written_open') && (
          <div className="space-y-2">
            <label
              htmlFor="long-text-answer-input"
              className="block text-xs font-semibold text-slate-600 dark:text-slate-400"
            >
              Kengaytirilgan yozma yechim va asoslashni kiriting:
            </label>
            <textarea
              id="long-text-answer-input"
              rows={5}
              value={answersMap[currentQuestion.id] || ''}
              onChange={(e) => handleSelectAnswer(e.target.value)}
              placeholder="Masalaning yechilish bosqichlari, formulalar va xulosani batafsil yozing..."
              className="w-full p-4 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-600"
            />
          </div>
        )}

        {/* Prev / Next Controls */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Oldingi savol</span>
          </button>

          {currentIndex < assessmentQuestions.length - 1 ? (
            <button
              type="button"
              onClick={() =>
                setCurrentIndex((i) => Math.min(assessmentQuestions.length - 1, i + 1))
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              <span>Keyingi savol</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
            >
              <span>Javoblarni topshirish</span>
            </button>
          )}
        </div>
      </div>

      {/* Image Zoom Lightbox */}
      {zoomImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
          onClick={() => setZoomImageUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 p-4 rounded-2xl space-y-3">
            <img
              src={zoomImageUrl}
              alt="Kattalashtirilgan tasvir"
              className="max-h-[75vh] w-auto mx-auto object-contain rounded-lg"
            />
            <div className="text-right">
              <button
                type="button"
                onClick={() => setZoomImageUrl(null)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-confirm-title"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2
              id="submit-confirm-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              Testni yakunlashni tasdiqlaysizmi?
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Siz jami <strong>{assessmentQuestions.length}</strong> ta savoldan{' '}
              <strong>{answeredCount}</strong> tasiga javob belgiladingiz.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg"
              >
                Qaytish va tekshirish
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {isSubmitting ? 'Hisoblanmoqda...' : 'Tasdiqlash va yakunlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const AssessmentResultPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { attempts, generateAttemptAIAnalysis } = useLearnOS();
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const attempt = attempts.find((a) => a.id === id) || attempts[0];

  if (!attempt) {
    return (
      <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
        <p className="text-sm text-slate-500">Test natijalari hozircha mavjud emas.</p>
      </div>
    );
  }

  const handleRefreshAI = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      await generateAttemptAIAnalysis(attempt.id);
    } catch (e) {
      setAiError(
        e instanceof Error ? e.message : 'AI tahlilini olishda xatolik yuz berdi'
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <p className="text-xs text-slate-500">
            Deterministik server hisobi · Topshirilgan vaqt:{' '}
            {new Date(attempt.submittedAt).toLocaleDateString('uz-UZ')}
            {(attempt.status === 'pending_manual_review' ||
              attempt.gradingStatus === 'pending_manual_review') && (
              <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                Yozma javoblar tekshiruvda
              </span>
            )}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {attempt.assessmentTitle} — Natijalar tahlili
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/student/knowledge-map"
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            O‘quv xaritamni ko‘rish
          </Link>
        </div>
      </div>

      {/* Score Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500">Umumiy natija</p>
          <p className="text-3xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {attempt.scorePercent}%
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500">To‘g‘ri javoblar</p>
          <p className="text-3xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
            {attempt.correctCount} / {attempt.totalQuestions}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500">To‘plangan ballar</p>
          <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {attempt.earnedPoints ?? attempt.correctCount} /{' '}
            {attempt.totalPoints ?? attempt.totalQuestions}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <p className="text-xs text-slate-500">Xato yoki javobsiz</p>
          <p className="text-3xl font-bold font-mono tabular-nums text-rose-600 mt-1">
            {attempt.totalQuestions - attempt.correctCount}
          </p>
        </div>
      </div>

      {/* Topic Breakdown Bar Chart */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Mavzular bo‘yicha ko‘rsatkichlar
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {attempt.topicBreakdown.map((tb) => (
            <div
              key={tb.topicId}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {tb.topicName}
                </span>
                <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  {tb.correct}/{tb.total} ({tb.accuracy}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    tb.accuracy >= 80
                      ? 'bg-emerald-600'
                      : tb.accuracy >= 50
                      ? 'bg-blue-600'
                      : 'bg-rose-600'
                  }`}
                  style={{ width: `${tb.accuracy}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gemini AI Diagnostic Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                AI yordamida diagnostik tahlil va tavsiyalar
              </h2>
              <p className="text-xs text-slate-500">
                Kuzatilgan xatolar va o‘zlashtirish bo‘yicha individual tavsiyalar
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={aiLoading}
            onClick={handleRefreshAI}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 self-start"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
            <span>{aiLoading ? 'Tahlil qilinmoqda...' : 'AI tahlilini yangilash'}</span>
          </button>
        </div>

        {aiError && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
            <span>{aiError}</span>
          </div>
        )}

        {attempt.aiAnalysis && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                Umumiy xulosa
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {attempt.aiAnalysis.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attempt.aiAnalysis.topic_analysis.map((ta) => (
                <div
                  key={ta.topic_id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {ta.observed_performance}
                    </span>
                    <span className="text-slate-500 font-mono">
                      Dalil: {ta.evidence_count} ta
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    <strong>Ehtimoliy xato namunasi:</strong> {ta.possible_error_pattern}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    <strong>Tavsiya:</strong> {ta.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Question-by-Question Review */}
      {attempt.answers.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Savollar bo‘yicha batafsil tahlil va yechimlar
          </h2>
          <div className="space-y-4">
            {attempt.answers.map((ans, idx) => (
              <div
                key={ans.questionId}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-semibold text-slate-500">
                    {idx + 1}-savol ({ans.questionType || 'multiple_choice'}) · Ball:{' '}
                    {ans.earnedPoints ?? (ans.isCorrect ? 1 : 0)} / {ans.maxPoints ?? 1}
                  </span>
                  <span
                    className={`font-semibold ${
                      ans.gradingStatus === 'pending_manual'
                        ? 'text-amber-600'
                        : ans.isCorrect
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {ans.gradingStatus === 'pending_manual'
                      ? 'Tekshiruvda'
                      : ans.isCorrect
                      ? 'To‘g‘ri javob'
                      : 'Xato javob'}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {ans.prompt}
                </p>
                <div className="flex flex-wrap gap-6 text-xs">
                  <span>
                    Yuborilgan javob:{' '}
                    <strong className={ans.isCorrect ? 'text-emerald-600' : 'text-rose-600'}>
                      {ans.selectedAnswer || '(belgilanmagan)'}
                    </strong>
                  </span>
                  <span>
                    To‘g‘ri javob / mezon:{' '}
                    <strong className="text-emerald-600">{ans.correctAnswer}</strong>
                  </span>
                </div>
                {ans.teacherFeedback && (
                  <p className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-lg border border-blue-200 dark:border-blue-800">
                    <strong>Izoh:</strong> {ans.teacherFeedback}
                  </p>
                )}
                <p className="text-xs text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                  <strong>Yechim izohi:</strong> {ans.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const KnowledgeMapPage: React.FC = () => {
  const { currentUser, classes, masteryRecords, topics } = useLearnOS();
  const studentId = currentUser?.uid || '';
  const studentClass = classes.find(
    (c) => c.id === currentUser?.classId || c.name === currentUser?.classCode
  );
  const classCode = studentClass?.name || currentUser?.classCode || '7a1';

  const myRecords = masteryRecords.filter((r) => r.studentId === studentId);
  const classTopics = topics.filter(
    (t) =>
      (!t.classCode || t.classCode === classCode) &&
      isSubjectCompatibleWithClass(t.subject, classCode)
  );

  // Merge topics with student mastery records so unattempted topics also show "Boshlanmagan"
  const mergedItems = classTopics.map((t) => {
    const rec = myRecords.find((r) => r.topicId === t.id);
    return (
      rec || {
        id: `unstarted-${t.id}`,
        studentId,
        institutionId: currentUser?.institutionId || '',
        topicId: t.id,
        topicName: t.name,
        subject: t.subject,
        grade: t.grade,
        accuracy: 0,
        assessedQuestions: 0,
        correctAnswers: 0,
        statusLabel: 'Boshlanmagan' as const,
        lastAssessedAt: '',
      }
    );
  });

  // Also include any mastery records whose topic wasn't in classTopics
  for (const r of myRecords) {
    if (!mergedItems.some((m) => m.topicId === r.topicId)) {
      mergedItems.unshift(r);
    }
  }

  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    mergedItems[0]?.topicId || ''
  );

  const selectedRecord =
    mergedItems.find((r) => r.topicId === selectedTopicId) || mergedItems[0];

  const strongTopics = myRecords.filter(
    (r) => r.statusLabel === 'Yaxshi o‘zlashtirilgan'
  );
  const weakTopics = myRecords.filter(
    (r) => r.statusLabel === 'O‘rganilmoqda' || r.statusLabel === 'Mustahkamlanmoqda'
  );

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5 space-y-1">
        <p className="text-xs text-slate-500">
          {classCode} sinfi • O‘zlashtirish statuslari: Boshlanmagan (0) · Ma’lumot yetarli emas (1–2) · O‘rganilmoqda (&lt;50%) · Mustahkamlanmoqda (50–79%) · Yaxshi o‘zlashtirilgan (&ge;80%)
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          O‘quv xaritam (Individual Knowledge Map)
        </h1>
      </div>

      {/* Strong vs Weak Topics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            Kuchli mavzular (Yaxshi o‘zlashtirilgan: {strongTopics.length})
          </p>
          {strongTopics.length === 0 ? (
            <p className="text-xs text-slate-500">
              Kamida 3 ta savol yechib 80%+ natija ko‘rsatgan mavzularingiz shu yerda chiqadi.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {strongTopics.map((st) => (
                <span
                  key={st.id}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold"
                >
                  {st.topicName} ({st.accuracy}%)
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-600">
            Takrorlash tavsiya etiladigan mavzular ({weakTopics.length})
          </p>
          {weakTopics.length === 0 ? (
            <p className="text-xs text-slate-500">
              Qo‘shimcha mashq talab qilinadigan mavzular hozircha aniqlanmagan.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {weakTopics.map((wt) => (
                <span
                  key={wt.id}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-semibold"
                >
                  {wt.topicName} ({wt.accuracy}% — {wt.statusLabel})
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {mergedItems.length === 0 ? (
        <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-2">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Hozircha ma’lumot mavjud emas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-3">
            {mergedItems.map((rec) => {
              const isSelected = rec.topicId === selectedRecord?.topicId;
              return (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => setSelectedTopicId(rec.topicId)}
                  className={`w-full text-left p-5 rounded-xl border transition-colors space-y-3 ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 border-blue-600 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-500">
                        {rec.subject} · {rec.grade}-sinf
                      </p>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        {rec.topicName}
                      </h2>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {rec.accuracy}%
                      </p>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          rec.statusLabel === 'Yaxshi o‘zlashtirilgan'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : rec.statusLabel === 'Mustahkamlanmoqda'
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            : rec.statusLabel === 'O‘rganilmoqda'
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {rec.statusLabel}
                      </span>
                    </div>
                  </div>

                  <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        rec.accuracy >= 80
                          ? 'bg-emerald-600'
                          : rec.accuracy >= 50
                          ? 'bg-blue-600'
                          : 'bg-rose-600'
                      }`}
                      style={{ width: `${rec.accuracy}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
                    <span>
                      Dalillar: {rec.correctAnswers} / {rec.assessedQuestions} ta savol
                    </span>
                    <span>
                      {rec.lastAssessedAt
                        ? `Yangilangan: ${new Date(rec.lastAssessedAt).toLocaleDateString('uz-UZ')}`
                        : 'Hali test topshirilmagan'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedRecord && (
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5 h-fit">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4 space-y-1">
                <p className="text-xs font-semibold text-blue-600">
                  Mavzu tafsilotlari va o‘zlashtirish holati
                </p>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedRecord.topicName}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500">Joriy holat</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedRecord.statusLabel}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-500">Aniqlik ko‘rsatkichi</p>
                  <p className="text-sm font-bold font-mono text-blue-600 mt-0.5">
                    {selectedRecord.accuracy}%
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                <p className="font-semibold text-slate-900 dark:text-white">
                  Hisoblash asoslari:
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Ushbu mavzu bo‘yicha jami{' '}
                  <strong>{selectedRecord.assessedQuestions}</strong> ta savol tekshirilgan bo‘lib, shundan{' '}
                  <strong>{selectedRecord.correctAnswers}</strong> tasiga to‘g‘ri javob berilgan.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <Link
                  to="/student/lessons"
                  className="w-full py-2.5 px-4 text-center text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
                >
                  Dars materiallarini ko‘rish
                </Link>
                <Link
                  to="/student/assessments"
                  className="w-full py-2.5 px-4 text-center text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Diagnostik test topshirish
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const LearningPathPage: React.FC = () => {
  const { currentUser, learningPaths, updateLearningPathStepStatus } = useLearnOS();
  const studentId = currentUser?.uid || '';
  const myPaths = learningPaths.filter((lp) => lp.studentId === studentId);

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5 space-y-1">
        <p className="text-xs text-slate-500">
          Diagnostik dalillarga asoslangan 5 bosqichli individual o‘zlashtirish dasturi
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Shaxsiy o‘quv yo‘li
        </h1>
      </div>

      {myPaths.length === 0 ? (
        <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-2">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Hozircha ma’lumot mavjud emas.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {myPaths.map((path) => {
            const completedSteps = path.steps.filter((s) => s.status === 'completed').length;
            return (
              <div
                key={path.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-blue-600">
                      Mavzu: {path.topicName} · Kuzatilgan aniqlik: {path.accuracy}%
                    </p>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {path.observedIndicator}
                    </h2>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    Bajarildi: {completedSteps} / {path.steps.length} bosqich
                  </span>
                </div>

                <div className="space-y-4">
                  {path.steps.map((step) => (
                    <div
                      key={step.stepNumber}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 max-w-3xl">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {step.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {step.description}
                        </p>
                        <p className="text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200/70 dark:border-slate-800 font-mono">
                          {step.content}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {(
                          [
                            { id: 'not_started', label: 'Boshlanmagan' },
                            { id: 'in_progress', label: 'Jarayonda' },
                            { id: 'completed', label: 'Yakunlash' },
                          ] as { id: LearningPathStepStatus; label: string }[]
                        ).map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() =>
                              updateLearningPathStepStatus(path.id, step.stepNumber, st.id)
                            }
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                              step.status === st.id
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-500'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const StudentProgressPage: React.FC = () => {
  const { currentUser, masteryRecords, attempts } = useLearnOS();
  const studentId = currentUser?.uid || '';
  const myMastery = masteryRecords.filter((r) => r.studentId === studentId);
  const myAttempts = attempts.filter((a) => a.studentId === studentId);

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Natijalar va o‘quv rivojlanishi
        </h1>
        <p className="text-sm text-slate-500">
          Mavzular bo‘yicha aniqlik taqqoslanishi va topshirilgan test urinishlari tarixi
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Mavzular bo‘yicha aniqlik taqqoslanishi
          </h2>
          {myMastery.length === 0 ? (
            <div className="h-64 flex items-center justify-center bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">Hozircha ma’lumot mavjud emas.</p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={myMastery}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="topicName" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="accuracy" name="Aniqlik (%)" fill="#2563EB" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Barcha test urinishlari tarixi ({myAttempts.length})
          </h2>
          {myAttempts.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">Test natijalari hozircha mavjud emas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myAttempts.map((att) => (
                <div
                  key={att.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {att.assessmentTitle}
                    </p>
                    <p className="text-xs text-slate-500 font-mono tabular-nums">
                      Sana: {new Date(att.submittedAt).toLocaleDateString('uz-UZ')} · To‘g‘ri:{' '}
                      {att.correctCount}/{att.totalQuestions}
                    </p>
                  </div>
                  <Link
                    to={`/student/results/${att.id}`}
                    className="px-3.5 py-2 text-xs font-semibold text-blue-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg whitespace-nowrap"
                  >
                    {att.scorePercent}% · Batafsil
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const StudentProfilePage: React.FC = () => {
  const { currentUser, institution, classes, subjects, attempts, masteryRecords, addToast } =
    useLearnOS();

  const studentClass = classes.find(
    (c) => c.id === currentUser?.classId || c.name === currentUser?.classCode
  );
  const classCode = studentClass?.name || currentUser?.classCode || '7a1';
  const grade = studentClass?.grade || currentUser?.grade || 7;
  const track = studentClass?.track || currentUser?.track || 'A';
  const mySubjects = subjects.filter((s) => isSubjectCompatibleWithClass(s.name, classCode).compatible);

  const handleExportMyData = () => {
    const payload = {
      platform: APP_NAME,
      profile: currentUser,
      institution: institution.name,
      attempts: attempts.filter((a) => a.studentId === currentUser?.uid),
      masteryRecords: masteryRecords.filter((m) => m.studentId === currentUser?.uid),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `specialized-study-student-${currentUser?.uid || 'student'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Shaxsiy o‘quv ma’lumotlari JSON formatida yuklab olindi');
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          O‘quvchi profili
        </h1>
        <p className="text-sm text-slate-500">
          {APP_NAME} tizimidagi tasdiqlangan o‘quvchi ma’lumotlari
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Ism va familiya</p>
            <p className="font-bold text-slate-900 dark:text-white">
              {currentUser?.displayName}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Elektron pochta</p>
            <p className="font-bold text-slate-900 dark:text-white">{currentUser?.email}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Biriktirilgan sinf (Read-only)</p>
            <p className="font-mono font-bold text-blue-600">{classCode}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Sinf darajasi va yo‘nalishi (Read-only)</p>
            <p className="font-bold text-slate-900 dark:text-white">
              {grade}-sinf · {track === 'T' ? 'T — Tabiiy fanlar' : 'A — Aniq fanlar'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">O‘quvchi identifikatsiya kodi</p>
            <p className="font-mono font-bold text-slate-700 dark:text-slate-300">
              {currentUser?.studentCode || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">O‘quv fanlari</p>
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              {mySubjects.map((s) => s.name).join(', ')}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Shaxsiy o‘quv ma’lumotlarini yuklab olish
        </h2>
        <button
          type="button"
          onClick={handleExportMyData}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Ma’lumotlarimni yuklab olish (JSON)</span>
        </button>
      </div>
    </div>
  );
};
