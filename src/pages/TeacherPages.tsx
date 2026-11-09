import {usePageState} from '../utils/usePageState';
import {ResponsiveTable} from '../components/ResponsiveTable';
import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Sparkles,
  Download,
  Trash2,
  Edit3,
  Check,
  Copy,
  KeyRound,
  Eye,
  Bell,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useLearnOS } from '../context/LearnOSContext';
import { QuestionDifficulty, QuestionItem, QuestionType } from '../types';
import {
  ExcelImportCenterPanel,
  AdvancedQuestionEditorModal,
  WrittenGradingPanel,
} from '../components/AssessmentCenterWidgets';

export const TeacherDashboardPage: React.FC = () => {
  const {
    users,
    classes,
    assessments,
    attempts,
    masteryRecords,
    topics,
  } = useLearnOS();

  const students = users.filter((u) => u.role === 'student');
  const publishedAssessments = assessments.filter((a) => a.status === 'published');

  const shortLabels: Record<string, string> = {
    'topic-fractions': 'Kasrlar',
    'topic-percentages': 'Foizlar',
    'topic-equations': 'Tenglamalar',
    'topic-geometry': 'Geometriya',
    'topic-algebra': 'Algebra',
  };
  const topicAverages = topics.map((t) => {
    const records = masteryRecords.filter((m) => m.topicId === t.id);
    const avg =
      records.length > 0
        ? Math.round(records.reduce((s, r) => s + r.accuracy, 0) / records.length)
        : 0;
    return {
      topicId: t.id,
      topicName: shortLabels[t.id] || t.name,
      fullTopicName: t.name,
      avgAccuracy: avg,
      evidenceCount: records.length,
    };
  });

  const attentionTopics = topicAverages.filter(
    (t) => t.evidenceCount > 0 && t.avgAccuracy < 65
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <p className="text-xs text-slate-500">O'qituvchi analitika va boshqaruv markazi</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            O'qituvchi boshqaruv paneli
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/teacher/question-bank"
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl whitespace-nowrap"
          >
            Savollar bazasi
          </Link>
          <Link
            to="/teacher/assessments/create"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Yangi test yaratish</span>
          </Link>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Jami o'quvchilar</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {students.length}
          </p>
          <p className="text-xs text-slate-500">Sinflarga biriktirilgan</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Biriktirilgan sinflar</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {classes.length}
          </p>
          <p className="text-xs text-slate-500">Faol o'quv guruhlari</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
          <p className="text-xs text-slate-500">Chop etilgan testlar</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-blue-600">
            {publishedAssessments.length}
          </p>
          <p className="text-xs text-slate-500">Jami urinishlar: {attempts.length} ta</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-1">
          <p className="text-xs text-slate-500">E'tibor talab qiluvchi mavzular</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-rose-600">
            {attentionTopics.length}
          </p>
          <p className="text-xs text-slate-500">O'rtacha aniqlik &lt; 65%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Topic Accuracy Chart */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Mavzular kesimida o'rtacha o'zlashtirish
              </h2>
              <p className="text-xs text-slate-500">
                Sinf bo'yicha qaysi mavzularda tushunmovchilik ko'proq ekanini aniqlash
              </p>
            </div>
            <Link
              to="/teacher/analytics"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Chuqur tahlil
            </Link>
          </div>

          {masteryRecords.length === 0 ? (
            <div className="h-64 flex items-center justify-center bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center">
              <p className="text-xs text-slate-500">
                Test natijalari hozircha mavjud emas.
              </p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topicAverages}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="topicName" interval={0} tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar
                    dataKey="avgAccuracy"
                    name="O'rtacha aniqlik (%)"
                    fill="#2563EB"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Recent Student Submissions */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            So'nggi topshirilgan test natijalari
          </h2>
          {attempts.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-500">Test natijalari hozircha mavjud emas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attempts.slice(0, 5).map((att) => (
                <div
                  key={att.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/teacher/students/${att.studentId}`}
                      className="text-sm font-bold text-slate-900 dark:text-white hover:text-blue-600 truncate block"
                    >
                      {att.studentName}
                    </Link>
                    <p className="text-xs text-slate-500 truncate">{att.assessmentTitle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold font-mono tabular-nums text-blue-600">
                      {att.scorePercent}%
                    </p>
                    <p className="text-xs text-slate-400 font-mono">
                      {att.correctCount}/{att.totalQuestions}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const TeacherClassesPage: React.FC = () => {
  const { classes, createClassRoom, createInvitation, addToast } = useLearnOS();
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(8);
  const [subject, setSubject] = useState('Matematika');
  const [showModal, setShowModal] = useState(false);
  const [generatedTokens, setGeneratedTokens] = useState<Record<string, string>>({});

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      addToast('error', 'Sinf nomini kiriting (kamida 2 ta belgi)');
      return;
    }
    await createClassRoom(name, grade, subject);
    setName('');
    setShowModal(false);
  };

  const handleGenerateStudentInvite = async (classId: string) => {
    try {
      const res = await createInvitation({ role: 'student', classId, expiresInHours: 72 });
      setGeneratedTokens((prev) => ({ ...prev, [classId]: res.rawToken }));
      navigator.clipboard?.writeText(res.rawToken);
    } catch {
      // handled by context
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Mening sinflarim ({classes.length})
          </h1>
          <p className="text-sm text-slate-500">
            Sinflar yarating va o'quvchilar uchun bir martalik taklif tokenlarini shakllantiring
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Yangi sinf ochish</span>
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-2">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Hozircha ma'lumot mavjud emas.
          </p>
          <p className="text-xs text-slate-500">
            Yangi sinf ochish tugmasi orqali birinchi sinfingizni yarating.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  {cls.grade}-sinf · {cls.subject} · {cls.academicYear || '2026-2027'}
                </p>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {cls.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleGenerateStudentInvite(cls.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>O'quvchi taklif tokeni yaratish</span>
                  </button>
                </div>

                {generatedTokens[cls.id] && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="text-slate-500 block">Bir martalik taklif tokeni:</span>
                      <code className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                        {generatedTokens[cls.id]}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(generatedTokens[cls.id]);
                        addToast('info', 'Token nusxalandi');
                      }}
                      className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500">
                  O'quvchilar: {cls.studentCount} nafar
                </span>
                <Link
                  to={`/teacher/classes/${cls.id}`}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Sinfni ochish
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Yangi sinf yaratish
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Sinf nomi
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Masalan: 8-A sinf"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sinf darajasi
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={11}
                    value={grade}
                    onChange={(e) => setGrade(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Fan
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg"
                >
                  Yaratish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const TeacherClassDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { classes, users, attempts, updateClassRoom } = useLearnOS();
  const [editing, setEditing] = useState(false);

  const cls = classes.find((c) => c.id === id) || classes[0];
  const [editName, setEditName] = useState(cls?.name || '');

  if (!cls) {
    return (
      <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
        <p className="text-sm text-slate-500">Hozircha ma'lumot mavjud emas.</p>
      </div>
    );
  }

  const enrolledStudents = users.filter(
    (u) => u.role === 'student' && (u.classId === cls.id || u.classIds?.includes(cls.id))
  );

  const handleSaveName = async () => {
    if (cls && editName.trim()) {
      await updateClassRoom(cls.id, { name: editName, grade: cls.grade, subject: cls.subject });
      setEditing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <p className="text-xs text-slate-500">
            Sinf kodi: <strong className="font-mono text-blue-600">{cls.inviteCode}</strong>
          </p>
          {editing ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 rounded-lg"
              />
              <button
                type="button"
                onClick={handleSaveName}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg"
              >
                Saqlash
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {cls.name}
              </h1>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Sinf nomini tahrirlash"
                className="p-1.5 text-slate-400 hover:text-slate-700"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <Link
          to="/teacher/assessments/create"
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl self-start"
        >
          Sinfga test biriktirish
        </Link>
      </div>

      {/* Students Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Sinf o'quvchilari ro'yxati ({enrolledStudents.length})
          </h2>
        </div>

        {enrolledStudents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Hozircha ma'lumot mavjud emas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <ResponsiveTable className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 bg-slate-50 dark:bg-slate-950">
                  <th className="py-3 px-6 font-semibold">O'quvchi F.I.Sh.</th>
                  <th className="py-3 px-6 font-semibold">Ota-ona kodi</th>
                  <th className="py-3 px-6 font-semibold text-right">Topshirilgan testlar</th>
                  <th className="py-3 px-6 font-semibold text-right">Oxirgi natija</th>
                  <th className="py-3 px-6 font-semibold text-right">Harakat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {enrolledStudents.map((stu) => {
                  const stuAttempts = attempts.filter((a) => a.studentId === stu.uid);
                  const latest = stuAttempts[0];
                  return (
                    <tr
                      key={stu.uid}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-white">
                        {stu.displayName}
                      </td>
                      <td className="py-3.5 px-6 font-mono text-xs text-slate-500">
                        {stu.studentCode || '—'}
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono tabular-nums">
                        {stuAttempts.length}
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono tabular-nums font-semibold text-blue-600">
                        {latest ? `${latest.scorePercent}%` : '—'}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <Link
                          to={`/teacher/students/${stu.uid}`}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          Batafsil tahlil
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </ResponsiveTable>
          </div>
        )}
      </div>
    </div>
  );
};

export const TeacherStudentsPage: React.FC = () => {
  const { users, classes, attempts, masteryRecords } = useLearnOS();
  const [search, setSearch] = usePageState('TeacherPages:search','');

  const students = users
    .filter((u) => u.role === 'student')
    .filter(
      (s) =>
        s.displayName.toLowerCase().includes(search.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Mening o'quvchilarim ({students.length})
          </h1>
          <p className="text-sm text-slate-500">
            Sinflaringizga biriktirilgan barcha o'quvchilarning o'zlashtirish ko'rsatkichlari
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="O'quvchini qidirish..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
          />
        </div>
      </div>

      {students.length === 0 ? (
        <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
          <p className="text-sm text-slate-500">Hozircha ma'lumot mavjud emas.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <ResponsiveTable className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 bg-slate-50 dark:bg-slate-950">
                  <th className="py-3 px-6 font-semibold">O'quvchi F.I.Sh.</th>
                  <th className="py-3 px-6 font-semibold">Sinf</th>
                  <th className="py-3 px-6 font-semibold text-right">Testlar soni</th>
                  <th className="py-3 px-6 font-semibold text-right">O'rtacha aniqlik</th>
                  <th className="py-3 px-6 font-semibold text-right">Profil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {students.map((stu) => {
                  const cls = classes.find((c) => c.id === stu.classId);
                  const stuAttempts = attempts.filter((a) => a.studentId === stu.uid);
                  const stuMastery = masteryRecords.filter((m) => m.studentId === stu.uid);
                  const avg =
                    stuMastery.length > 0
                      ? Math.round(
                          stuMastery.reduce((s, r) => s + r.accuracy, 0) / stuMastery.length
                        )
                      : 0;
                  return (
                    <tr key={stu.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-white">
                        {stu.displayName}
                      </td>
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-300">
                        {cls?.name || '—'}
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono tabular-nums">
                        {stuAttempts.length}
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono tabular-nums font-bold text-blue-600">
                        {avg}%
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <Link
                          to={`/teacher/students/${stu.uid}`}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          Diagnostika kartasi
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </ResponsiveTable>
          </div>
        </div>
      )}
    </div>
  );
};

export const TeacherStudentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    users,
    attempts,
    masteryRecords,
    teacherNotes,
    addTeacherNote,
  } = useLearnOS();
  const [noteText, setNoteText] = useState('');

  const student =
    users.find((u) => u.uid === id) ||
    users.find((u) => u.role === 'student');

  if (!student) {
    return (
      <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
        <p className="text-sm text-slate-500">Hozircha ma'lumot mavjud emas.</p>
      </div>
    );
  }

  const stuAttempts = attempts.filter((a) => a.studentId === student.uid);
  const stuMastery = masteryRecords.filter((m) => m.studentId === student.uid);
  const stuNotes = teacherNotes.filter((n) => n.studentId === student.uid);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    await addTeacherNote(student.uid, noteText);
    setNoteText('');
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <p className="text-xs text-slate-500">
          O'quvchi individual diagnostika kartasi · Kod: {student.studentCode || '—'}
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {student.displayName}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Knowledge Map for Student */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            O'quvchining Bilim xaritasi
          </h2>
          {stuMastery.length === 0 ? (
            <p className="text-xs text-slate-500">
              Hozircha ushbu o'quvchi bo'yicha mavzular dalillari shakllanmagan.
            </p>
          ) : (
            <div className="space-y-3.5">
              {stuMastery.map((m) => (
                <div key={m.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {m.topicName}
                    </span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {m.statusLabel} · {m.accuracy}% ({m.correctAnswers}/{m.assessedQuestions})
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        m.accuracy >= 80
                          ? 'bg-emerald-600'
                          : m.accuracy >= 60
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

          {stuAttempts[0]?.aiAnalysis?.teacher_summary && (
            <div className="mt-6 p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-1">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                AI metodik xulosasi (O'qituvchi ko'rib chiqishi uchun):
              </p>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {stuAttempts[0].aiAnalysis.teacher_summary}
              </p>
            </div>
          )}
        </div>

        {/* Teacher Pedagogical Notes & Override */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            O'qituvchi qaydlari va individual tavsiyalar
          </h2>
          <form onSubmit={handleAddNote} className="space-y-3">
            <textarea
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="O'quvchi bo'yicha kuzatuv yoki AI tavsiyasiga tuzatish kiriting..."
              className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-600"
            />
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Qaydni saqlash
            </button>
          </form>

          <div className="space-y-3 pt-2">
            {stuNotes.map((n) => (
              <div
                key={n.id}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {n.teacherName}
                  </span>
                  <span className="font-mono">
                    {new Date(n.createdAt).toLocaleDateString('uz-UZ')}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {n.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Written Answers Grading for this Student */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Yozma javoblarni baholash ({student.displayName})
          </h2>
          <p className="text-xs text-slate-500">
            Qisqa va kengaytirilgan yozma javoblar uchun AI rubrika tavsiyasi va yakuniy o'qituvchi bahosi
          </p>
        </div>
        <WrittenGradingPanel attempts={stuAttempts} />
      </div>
    </div>
  );
};

export const TeacherAssessmentsPage: React.FC = () => {
  const { assessments, classes, attempts, updateAssessment } = useLearnOS();
  const [activeTab, setActiveTab] = useState<'list' | 'import' | 'grading'>('list');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Diagnostik testlar boshqaruvi ({assessments.length})
          </h1>
          <p className="text-sm text-slate-500">
            Sinflarga biriktirilgan testlar, Excel/ZIP import va yozma javoblarni baholash
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                activeTab === 'list'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Testlar ({assessments.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                activeTab === 'import'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Excel / ZIP Import
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('grading')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                activeTab === 'grading'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Yozma baholash
            </button>
          </div>
          <Link
            to="/teacher/assessments/create"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
          >
            <Plus className="w-4 h-4" />
            <span>Yangi test tuzish</span>
          </Link>
        </div>
      </div>

      {activeTab === 'import' && <ExcelImportCenterPanel />}

      {activeTab === 'grading' && <WrittenGradingPanel attempts={attempts} />}

      {activeTab === 'list' && (
        <>
          {assessments.length === 0 ? (
            <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-2">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Hozircha ma'lumot mavjud emas.
              </p>
              <p className="text-xs text-slate-500">
                Yangi test tuzish yoki Excel/ZIP import orqali birinchi testni yarating.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {assessments.map((assess) => {
                const cls = classes.find((c) => c.id === assess.classId);
                const count = attempts.filter((a) => a.assessmentId === assess.id).length;
                return (
                  <div
                    key={assess.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500 font-mono">
                        {cls?.name || assess.classId || 'Umumiy'} · {assess.questionIds.length} ta savol ·{' '}
                        {assess.durationMinutes} daqiqa · Holat:{' '}
                        <strong
                          className={
                            assess.status === 'published' ? 'text-emerald-600' : 'text-amber-600'
                          }
                        >
                          {assess.status === 'published' ? 'Chop etilgan' : 'Qoralama'}
                        </strong>
                      </p>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        {assess.title}
                      </h2>
                      {assess.description && (
                        <p className="text-xs text-slate-500">{assess.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Topshirganlar</p>
                        <p className="text-sm font-bold font-mono tabular-nums text-blue-600">
                          {count} nafar o'quvchi
                        </p>
                      </div>
                      {assess.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => updateAssessment(assess.id, { status: 'published' })}
                          className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                        >
                          Chop etish
                        </button>
                      )}
                      <Link
                        to="/teacher/reports"
                        className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg"
                      >
                        Hisobot
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const TeacherCreateAssessmentPage: React.FC = () => {
  const { topics, questions, classes, createAssessment, addToast } = useLearnOS();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('Matematika');
  const [grade, setGrade] = useState(8);
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [passingScore, setPassingScore] = useState(60);
  const [dueDate, setDueDate] = useState('2026-11-25');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(
    questions.map((q) => q.id)
  );
  const [topicFilter, setTopicFilter] = useState<string>('all');

  const toggleQuestion = (qId: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const filteredQuestions = questions.filter(
    (q) => topicFilter === 'all' || q.topicId === topicFilter
  );

  const handleSave = async (status: 'draft' | 'published') => {
    if (title.trim().length < 3) {
      addToast('error', 'Test sarlavhasini kiriting (kamida 3 ta belgi)');
      return;
    }
    if (selectedQuestionIds.length === 0) {
      addToast('error', 'Kamida 1 ta savol tanlang');
      return;
    }

    const chosenQuestions = questions.filter((q) =>
      selectedQuestionIds.includes(q.id)
    );
    const topicIds = Array.from(new Set(chosenQuestions.map((q) => q.topicId)));

    await createAssessment({
      title: title.trim(),
      description: description.trim(),
      subject,
      grade,
      topicIds,
      questionIds: selectedQuestionIds,
      durationMinutes,
      passingScore,
      dueDate,
      classId: classId || classes[0]?.id || '',
      status,
    });
    navigate('/teacher/assessments');
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <p className="text-xs font-semibold text-blue-600">
          7 bosqichli test konstruktori (Immutable Snapshot)
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Yangi diagnostik test yaratish
        </h1>
        <p className="text-sm text-slate-500">
          Mavzular va savollarni tanlab, sinfga biriktiring
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4 h-fit">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              1. Test nomi
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: 8-sinf Chiziqli tenglamalar nazorati"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Tavsif
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Test maqsadi va qamrab olingan tushunchalar..."
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                2. Fan
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Sinf darajasi
              </label>
              <input
                type="number"
                min={5}
                max={11}
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                5. Davomiyligi (daqiqa)
              </label>
              <input
                type="number"
                min={5}
                max={120}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                O'tish bali (%)
              </label>
              <input
                type="number"
                min={30}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                6. Biriktiriladigan sinf
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                {classes.length === 0 && <option value="">Sinf tanlanmagan</option>}
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Topshirish muddati
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Tanlangan savollar:</span>
            <strong className="font-mono text-blue-600">{selectedQuestionIds.length} ta</strong>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleSave('draft')}
              className="flex-1 py-2.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl"
            >
              7. Qoralama saqlash
            </button>
            <button
              type="button"
              onClick={() => handleSave('published')}
              className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
            >
              7. Chop etish
            </button>
          </div>
        </div>

        {/* Question Selector */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              3–4. Mavzu va savollar bazasidan tanlash
            </h2>
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
            >
              <option value="all">Barcha mavzular</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {filteredQuestions.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <p className="text-xs text-slate-500">
                Savollar bazasida hozircha savollar yo'q.
              </p>
              <Link
                to="/teacher/question-bank"
                className="inline-block px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg"
              >
                Savollar bazasiga o'tish
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredQuestions.map((q) => {
                const checked = selectedQuestionIds.includes(q.id);
                return (
                  <div
                    key={q.id}
                    onClick={() => toggleQuestion(q.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                      checked
                        ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-600'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {q.prompt}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        Javob: {q.correctAnswer} · Qiyinlik: {q.difficulty}
                      </p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 ${
                        checked
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {checked && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const TeacherAssignmentsPage: React.FC = () => {
  const { assignments, assessments, classes, createAssignment } = useLearnOS();
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(assessments[0]?.id || '');
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [dueDate, setDueDate] = useState('2026-12-01');

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssessmentId || !selectedClassId) return;
    await createAssignment({
      assessmentId: selectedAssessmentId,
      classId: selectedClassId,
      dueDate,
    });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Sinflarga biriktirilgan topshiriqlar ({assignments.length})
        </h1>
        <p className="text-sm text-slate-500">
          Chop etilgan diagnostik testlarni sinflarga biriktirish va muddatlarni boshqarish
        </p>
      </div>

      <form
        onSubmit={handleAssign}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-end gap-3"
      >
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
            Test
          </label>
          <select
            value={selectedAssessmentId}
            onChange={(e) => setSelectedAssessmentId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          >
            <option value="">Testni tanlang</option>
            {assessments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 flex-1 min-w-[180px]">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
            Sinf
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          >
            <option value="">Sinfni tanlang</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
            Muddat
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          Biriktirish
        </button>
      </form>

      {assignments.length === 0 ? (
        <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
          <p className="text-sm text-slate-500">Hozircha ma'lumot mavjud emas.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <ResponsiveTable className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 bg-slate-50 dark:bg-slate-950">
                <th className="py-3 px-6 font-semibold">Test nomi</th>
                <th className="py-3 px-6 font-semibold">Sinf</th>
                <th className="py-3 px-6 font-semibold">Topshirish muddati</th>
                <th className="py-3 px-6 font-semibold text-right">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {assignments.map((asg) => {
                const assess = assessments.find((a) => a.id === asg.assessmentId);
                const cls = classes.find((c) => c.id === asg.classId);
                return (
                  <tr key={asg.id}>
                    <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-white">
                      {assess?.title || asg.assessmentId}
                    </td>
                    <td className="py-3.5 px-6 text-slate-600 dark:text-slate-300">
                      {cls?.name || asg.classId}
                    </td>
                    <td className="py-3.5 px-6 font-mono text-xs text-slate-500">
                      {asg.dueDate}
                    </td>
                    <td className="py-3.5 px-6 text-right text-xs font-semibold text-emerald-600">
                      Faol ({asg.status})
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </ResponsiveTable>
        </div>
      )}
    </div>
  );
};

export const QuestionBankPage: React.FC = () => {
  const {
    questions,
    topics,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    addToast,
  } = useLearnOS();

  const [searchQuery, setSearchQuery] = usePageState('TeacherPages:searchQuery','');
  const [topicFilter, setTopicFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showImportPanel, setShowImportPanel] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<QuestionItem | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [aiDrafting, setAiDrafting] = useState(false);

  const filtered = questions.filter((q) => {
    const matchesSearch =
      q.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.explanation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.code || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTopic = topicFilter === 'all' || q.topicId === topicFilter;
    const matchesDiff =
      difficultyFilter === 'all' || q.difficulty === difficultyFilter;
    const matchesType = typeFilter === 'all' || q.type === typeFilter;
    return matchesSearch && matchesTopic && matchesDiff && matchesType;
  });

  const handleOpenEdit = (q: QuestionItem) => {
    setEditingQuestion(q);
    setShowCreateModal(true);
  };

  const handleAIDraft = async () => {
    setAiDrafting(true);
    try {
      const topicObj = topics.find((t) => t.id === (topicFilter !== 'all' ? topicFilter : topics[0]?.id));
      const res = await fetch('/api/ai/draft-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicName: topicObj?.name || 'Chiziqli tenglamalar',
          difficulty: difficultyFilter !== 'all' ? difficultyFilter : 'medium',
          grade: 8,
          subject: 'Matematika',
        }),
      });
      const data = await res.json();
      await createQuestion({
        subject: 'Matematika',
        grade: 8,
        topicId: topicObj?.id || topics[0]?.id || 'topic-equations',
        difficulty: (difficultyFilter !== 'all' ? difficultyFilter : 'medium') as QuestionDifficulty,
        type: 'single_choice',
        prompt: data.prompt || 'Yangi diagnostik savol',
        options: Array.isArray(data.options) ? data.options : ['A', 'B', 'C', 'D'],
        correctAnswer: data.correctAnswer || (Array.isArray(data.options) ? data.options[0] : 'A'),
        explanation: data.explanation || 'Yechim izohi',
        status: 'draft',
      });
      addToast(
        'info',
        'AI savol qoralamasi tayyorlandi',
        "O'qituvchi ko'rib chiqib tasdiqlamaguncha 'Qoralama' holatida saqlanadi."
      );
    } catch {
      addToast('error', 'AI savol loyihalashda xatolik yuz berdi');
    } finally {
      setAiDrafting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Savollar bazasi ({questions.length} ta savol)
          </h1>
          <p className="text-sm text-slate-500">
            5 xil savol turi (bitta/ko'p tanlovli, sonli, qisqa va kengaytirilgan yozma), rasmlar va Excel/ZIP import
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowImportPanel((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>{showImportPanel ? 'Import oynasini yopish' : 'Excel / ZIP Import'}</span>
          </button>

          <button
            type="button"
            disabled={aiDrafting}
            onClick={handleAIDraft}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl"
          >
            <Sparkles className="w-4 h-4" />
            <span>{aiDrafting ? 'AI tuzmoqda...' : 'AI yordamida qoralama tuzish'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingQuestion(null);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
          >
            <Plus className="w-4 h-4" />
            <span>Savol qo'shish</span>
          </button>
        </div>
      </div>

      {showImportPanel && <ExcelImportCenterPanel />}

      {/* Search & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Savol kodi, matni yoki izohi bo'yicha qidirish..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
          />
        </div>

        <select
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          aria-label="Mavzu bo'yicha saralash"
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="all">Barcha mavzular ({topics.length})</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Savol turi"
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="all">Barcha savol turlari (5)</option>
          <option value="single_choice">Bitta tanlovli (Single)</option>
          <option value="multiple_choice">Ko'p tanlovli (Multi)</option>
          <option value="numeric">Sonli (Numeric)</option>
          <option value="short_text">Qisqa yozma (Short text)</option>
          <option value="long_text">Kengaytirilgan yozma (Long text)</option>
        </select>

        <select
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value)}
          aria-label="Qiyinlik darajasi"
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
        >
          <option value="all">Barcha qiyinliklar</option>
          <option value="easy">Oson</option>
          <option value="medium">O'rtacha</option>
          <option value="hard">Qiyin</option>
        </select>
      </div>

      {/* Questions List */}
      {filtered.length === 0 ? (
        <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-2">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Hozircha ma'lumot mavjud emas.
          </p>
          <p className="text-xs text-slate-500">
            Yangi diagnostik savol qo'shing yoki Excel/ZIP shablon orqali yuklang.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => {
            const topic = topics.find((t) => t.id === q.topicId);
            return (
              <div
                key={q.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500 font-medium">
                    <code className="font-mono font-bold text-blue-600 mr-1.5">
                      {q.code || q.id}
                    </code>
                    {topic?.name || q.topicId} · Tur: <strong>{q.type}</strong> · Ball:{' '}
                    <strong>{q.points ?? 1}</strong> · Qiyinlik:{' '}
                    {q.difficulty === 'easy'
                      ? 'Oson'
                      : q.difficulty === 'medium'
                      ? "O'rtacha"
                      : 'Qiyin'}{' '}
                    · v{q.version || 1} · Holat:{' '}
                    <strong
                      className={
                        q.status === 'approved' ? 'text-emerald-600' : 'text-amber-600'
                      }
                    >
                      {q.status === 'approved' ? 'Tasdiqlangan' : 'Qoralama'}
                    </strong>
                  </span>

                  <div className="flex items-center gap-2">
                    {q.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => updateQuestion(q.id, { status: 'approved' })}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 rounded-md"
                      >
                        Tasdiqlash
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPreviewQuestion(q)}
                      aria-label="Savolni ko'rish"
                      className="p-1.5 text-slate-400 hover:text-blue-600"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(q)}
                      aria-label="Savolni tahrirlash"
                      className="p-1.5 text-slate-400 hover:text-blue-600"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTargetId(q.id)}
                      aria-label="Savolni o'chirish"
                      className="p-1.5 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {q.prompt}
                </p>

                {q.imageUrl && (
                  <img
                    src={q.imageUrl}
                    alt="Savol rasmi"
                    className="max-h-40 rounded-lg border border-slate-200 dark:border-slate-800 object-contain"
                  />
                )}

                {q.optionItems && q.optionItems.length > 0 ? (
                  <div className="flex flex-wrap gap-2 text-xs font-mono">
                    {q.optionItems.map((opt) => (
                      <span
                        key={opt.key}
                        className={`px-2.5 py-1 rounded border flex items-center gap-1.5 ${
                          opt.isCorrect
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 text-emerald-700 dark:text-emerald-300 font-bold'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span>
                          {opt.key}) {opt.text}
                        </span>
                        {opt.imageUrl && (
                          <img
                            src={opt.imageUrl}
                            alt={opt.key}
                            className="h-6 w-6 object-contain rounded"
                          />
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  q.options && (
                    <div className="flex flex-wrap gap-2 text-xs font-mono">
                      {q.options.map((opt) => (
                        <span
                          key={opt}
                          className={`px-2.5 py-1 rounded border ${
                            opt === q.correctAnswer
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 text-emerald-700 dark:text-emerald-300 font-bold'
                              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  )
                )}

                <p className="text-xs text-slate-600 dark:text-slate-400">
                  <strong>To'g'ri javob:</strong> {q.correctAnswer} ·{' '}
                  <strong>Izoh:</strong> {q.explanation}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Question Preview Modal */}
      {previewQuestion && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              O'quvchi ko'rinishida oldindan ko'rish ({previewQuestion.type})
            </h2>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {previewQuestion.prompt}
            </p>
            {previewQuestion.imageUrl && (
              <img
                src={previewQuestion.imageUrl}
                alt="Savol rasmi"
                className="max-h-56 rounded-xl border border-slate-200 dark:border-slate-800 object-contain"
              />
            )}
            {previewQuestion.options && (
              <div className="space-y-2">
                {previewQuestion.options.map((opt) => (
                  <div
                    key={opt}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    {opt}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewQuestion(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Savolni o'chirishni tasdiqlaysizmi?
            </h2>
            <p className="text-xs text-slate-500">
              Ushbu savol savollar bazasidan o'chiriladi. Chop etilgan testlardagi nusxalar saqlanib qoladi.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteQuestion(deleteTargetId);
                  setDeleteTargetId(null);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg"
              >
                O'chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Create / Edit Modal */}
      {showCreateModal && (
        <AdvancedQuestionEditorModal
          editingQuestion={editingQuestion}
          onClose={() => {
            setShowCreateModal(false);
            setEditingQuestion(null);
          }}
        />
      )}
    </div>
  );
};

export const TeacherAnalyticsPage: React.FC = () => {
  const { attempts, topics, masteryRecords } = useLearnOS();

  const scoreDistribution = [
    { range: '0–39% (Qayta ishlash)', count: attempts.filter((a) => a.scorePercent < 40).length },
    {
      range: '40–59% (Rivojlanmoqda)',
      count: attempts.filter((a) => a.scorePercent >= 40 && a.scorePercent < 60).length,
    },
    {
      range: '60–79% (Yaxshi)',
      count: attempts.filter((a) => a.scorePercent >= 60 && a.scorePercent < 80).length,
    },
    {
      range: '80–100% (Mustahkam)',
      count: attempts.filter((a) => a.scorePercent >= 80).length,
    },
  ];

  const topicBreakdownStats = topics.map((t) => {
    const recs = masteryRecords.filter((m) => m.topicId === t.id);
    const avg =
      recs.length > 0
        ? Math.round(recs.reduce((s, r) => s + r.accuracy, 0) / recs.length)
        : 0;
    return {
      name: t.name,
      accuracy: avg,
    };
  });

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Sinf bilim tahlili (Class Knowledge Analytics)
        </h1>
        <p className="text-sm text-slate-500">
          O'quvchilar natijalari taqsimoti va eng ko'p xato qilinadigan mavzular
        </p>
      </div>

      {attempts.length === 0 ? (
        <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
          <p className="text-sm text-slate-500">Test natijalari hozircha mavjud emas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Natijalar taqsimoti
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="O'quvchilar soni" fill="#1D4ED8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Mavzular bo'yicha o'zlashtirish ko'rsatkichi
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topicBreakdownStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="accuracy" name="Aniqlik (%)" fill="#16A34A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const TeacherReportsPage: React.FC = () => {
  const { attempts, addToast } = useLearnOS();

  const handleExportCSV = () => {
    const headers = [
      'Attempt_ID',
      'Oquvchi_Ismi',
      'Test_Nomi',
      'Sinf_ID',
      'Togri_Javoblar',
      'Jami_Savollar',
      'Natija_Foizda',
      'Topshirilgan_Vaqt',
    ];
    const rows = attempts.map((a) => [
      a.id,
      `"${a.studentName.replace(/"/g, '""')}"`,
      `"${a.assessmentTitle.replace(/"/g, '""')}"`,
      a.classId,
      a.correctCount,
      a.totalQuestions,
      `${a.scorePercent}%`,
      a.submittedAt,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `learnos-assessment-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addToast('success', 'CSV hisobot muvaffaqiyatli yuklab olindi');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Hisobotlar va CSV eksport
          </h1>
          <p className="text-sm text-slate-500">
            Rasmiy maktab hisobotlari uchun natijalarni jadval shaklida yuklab oling
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl self-start"
        >
          <Download className="w-4 h-4" />
          <span>CSV formatda yuklab olish</span>
        </button>
      </div>

      {attempts.length === 0 ? (
        <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
          <p className="text-sm text-slate-500">Test natijalari hozircha mavjud emas.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <ResponsiveTable className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 bg-slate-50 dark:bg-slate-950">
                  <th className="py-3 px-6 font-semibold">O'quvchi</th>
                  <th className="py-3 px-6 font-semibold">Test nomi</th>
                  <th className="py-3 px-6 font-semibold text-right">To'g'ri / Jami</th>
                  <th className="py-3 px-6 font-semibold text-right">Natija (%)</th>
                  <th className="py-3 px-6 font-semibold text-right">Sana</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {attempts.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-white">
                      {a.studentName}
                    </td>
                    <td className="py-3.5 px-6 text-slate-600 dark:text-slate-300">
                      {a.assessmentTitle}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono tabular-nums">
                      {a.correctCount} / {a.totalQuestions}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono tabular-nums font-bold text-blue-600">
                      {a.scorePercent}%
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-xs text-slate-500">
                      {new Date(a.submittedAt).toLocaleDateString('uz-UZ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </ResponsiveTable>
          </div>
        </div>
      )}
    </div>
  );
};

export const TeacherNotificationsPage: React.FC = () => {
  const { notifications, markNotificationRead } = useLearnOS();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Bildirishnomalar ({notifications.length})
        </h1>
        <p className="text-sm text-slate-500">
          O'quvchilar topshirgan testlar va tizim xabarlari
        </p>
      </div>

      {notifications.length === 0 ? (
        <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
          <Bell className="w-6 h-6 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Hozircha ma'lumot mavjud emas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
                n.read
                  ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  : 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
              }`}
            >
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{n.title}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">{n.message}</p>
                <p className="text-[11px] font-mono text-slate-400">
                  {new Date(n.createdAt).toLocaleString('uz-UZ')}
                </p>
              </div>
              {!n.read && (
                <button
                  type="button"
                  onClick={() => markNotificationRead(n.id)}
                  className="px-3 py-1 text-xs font-semibold text-blue-600 bg-white dark:bg-slate-900 border border-blue-200 rounded-lg shrink-0"
                >
                  O'qildi
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const TeacherProfilePage: React.FC = () => {
  const { currentUser, institution, classes } = useLearnOS();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          O'qituvchi profili
        </h1>
        <p className="text-sm text-slate-500">
          Shaxsiy hisob ma'lumotlari va biriktirilgan o'quv guruhlari
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-slate-500">F.I.Sh.</p>
          <p className="font-bold text-slate-900 dark:text-white">
            {currentUser?.displayName}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Elektron pochta</p>
          <p className="font-mono text-slate-900 dark:text-white">
            {currentUser?.email || '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Muassasa</p>
          <p className="font-bold text-slate-900 dark:text-white">{institution.name}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Fan yo'nalishi</p>
          <p className="font-bold text-slate-900 dark:text-white">
            {currentUser?.subject || 'Matematika'}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-slate-500">Biriktirilgan sinflar ({classes.length})</p>
          <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
            {classes.map((c) => c.name).join(', ') || "Hozircha sinf biriktirilmagan"}
          </p>
        </div>
      </div>
    </div>
  );
};
