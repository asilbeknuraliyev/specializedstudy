import React, { useState, useMemo } from 'react';
import { useLearnOS } from '../context/LearnOSContext';
import {
  ClipboardList,
  Plus,
  Clock,
  FileText,
  Send,
  Award,
  Search,
  RotateCcw,
  Upload,
  Paperclip,
  History
} from 'lucide-react';
import { AssignmentSubmissionType, OfficialClassCode } from '../types';

const CLASS_CODES = [
  '5a1', '5a2', '6a1', '6a2', '7a1', '7a2', '7t',
  '8a1', '8a2', '8t', '9a1', '9a2', '9t1', '9t2',
  '10a1', '10a2', '10t', '11a1', '11a2', '11t'
];

const SUBJECTS = ['Matematika', 'Ingliz tili', 'Fizika', 'Biologiya', 'Kimyo'];

export const AdminAssignmentsPanel: React.FC = () => {
  const {
    currentUser,
    studentAssignments,
    assignmentSubmissions,
    submissionRevisions,
    lessons,
    topics,
    assessments,
    createStudentAssignment,
    saveAssignmentDraft,
    submitAssignment,
    gradeAssignment,
  } = useLearnOS();

  const isAdmin =
    currentUser?.role === 'platform_owner' ||
    currentUser?.role === 'admin' ||
    currentUser?.role === 'teacher';

  const [classCodeFilter, setClassCodeFilter] = useState<string>(
    isAdmin ? 'All' : currentUser?.classCode || '7a1'
  );
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  // Create Assignment Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Matematika');
  const [classCode, setClassCode] = useState('7a1');
  const [sourceType, setSourceType] = useState<'lesson' | 'topic' | 'assessment' | 'custom'>('lesson');
  const [relatedLessonId, setRelatedLessonId] = useState('');
  const [topic, setTopic] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  );
  const [maxPoints, setMaxPoints] = useState(100);
  const [submissionType, setSubmissionType] = useState<AssignmentSubmissionType>('written_text');
  const [allowResubmission, setAllowResubmission] = useState(true);
  const [publishStatus, setPublishStatus] = useState<'published' | 'draft'>('published');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  // Selected Assignment & Submission Modal State
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [studentAnswerText, setStudentAnswerText] = useState('');
  const [studentAttachmentName, setStudentAttachmentName] = useState('');
  const [studentAttachmentUrl, setStudentAttachmentUrl] = useState('');

  // Admin Grading State
  const [gradingSubmissionId, setGradingSubmissionId] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState<number>(90);
  const [feedbackInput, setFeedbackInput] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);

  const availableLessons = useMemo(
    () =>
      lessons.filter(
        (l) =>
          l.classCode.toLowerCase() === classCode.toLowerCase() &&
          (l.subject || l.subjectName) === subject
      ),
    [lessons, classCode, subject]
  );

  const availableTopics = useMemo(
    () => topics.filter((t) => t.subject === subject),
    [topics, subject]
  );

  const filteredAssignments = useMemo(() => {
    return studentAssignments.filter((a) => {
      if (!isAdmin && a.status === 'draft') return false;
      const targetCodes = a.targetClassCodes || (a.classCode ? [a.classCode] : []);
      const matchesClass =
        classCodeFilter === 'All' ||
        targetCodes.some((c) => c.toLowerCase() === classCodeFilter.toLowerCase());
      const matchesSubject = subjectFilter === 'All' || a.subject === subjectFilter;
      const matchesSearch =
        !searchQuery ||
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.relatedTopicName || a.topic || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.subject.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesClass && matchesSubject && matchesSearch;
    });
  }, [studentAssignments, isAdmin, classCodeFilter, subjectFilter, searchQuery]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsBusy(true);
    try {
      const foundLesson = availableLessons.find((l) => l.id === relatedLessonId);
      await createStudentAssignment({
        title: title.trim(),
        subject,
        targetClassCodes: [classCode as OfficialClassCode],
        sourceType,
        relatedLessonId: relatedLessonId || undefined,
        relatedLessonTitle: foundLesson ? foundLesson.title || foundLesson.topicName : undefined,
        relatedTopicName: topic.trim() || title.trim(),
        relatedAssessmentId: assessmentId || undefined,
        description: description.trim() || instructions.trim(),
        instructions: instructions.trim() || description.trim(),
        dueDate: dueDate.slice(0, 10),
        maxScore: Number(maxPoints) || 100,
        submissionType,
        allowResubmission,
        status: publishStatus,
        attachmentUrls: attachmentUrl.trim() ? [attachmentUrl.trim()] : [],
      });
      setTitle('');
      setTopic('');
      setDescription('');
      setInstructions('');
      setAttachmentUrl('');
      setShowCreateModal(false);
      setNotice(
        publishStatus === 'published'
          ? 'Topshiriq muvaffaqiyatli nashr qilindi.'
          : 'Topshiriq qoralama sifatida saqlangan.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleStudentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStudentAttachmentName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setStudentAttachmentUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveDraft = async (assignmentId: string) => {
    if (!studentAnswerText.trim() && !studentAttachmentUrl.trim()) return;
    setIsBusy(true);
    try {
      await saveAssignmentDraft({
        assignmentId,
        draftContent: studentAnswerText.trim(),
        draftAttachmentUrl: studentAttachmentUrl || undefined,
      });
      setNotice('Javob qoralama sifatida saqlandi (Holat: Jarayonda).');
    } finally {
      setIsBusy(false);
    }
  };

  const handleStudentSubmit = async (assignmentId: string) => {
    if (!studentAnswerText.trim() && !studentAttachmentUrl.trim()) return;
    setIsBusy(true);
    try {
      await submitAssignment({
        assignmentId,
        content: studentAnswerText.trim(),
        attachmentUrl: studentAttachmentUrl || undefined,
        attachmentName: studentAttachmentName || undefined,
      });
      setStudentAnswerText('');
      setStudentAttachmentName('');
      setStudentAttachmentUrl('');
      setSelectedAssignmentId(null);
      setNotice('Topshiriq tasdiqlanib topshirildi (Holat: Topshirildi).');
    } finally {
      setIsBusy(false);
    }
  };

  const handleGrade = async (submissionId: string, returnForImprovement = false) => {
    setIsBusy(true);
    try {
      await gradeAssignment({
        submissionId,
        score: Number(scoreInput),
        feedback: feedbackInput.trim(),
        status: returnForImprovement ? 'Qaytarildi' : 'Tekshirildi',
      });
      setGradingSubmissionId(null);
      setFeedbackInput('');
      setNotice(
        returnForImprovement
          ? 'Topshiriq qayta ishlash uchun qaytarildi (Qaytarildi).'
          : 'Topshiriq baholandi (Tekshirildi).'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const getStudentAssignmentStatus = (assignment: (typeof studentAssignments)[0]) => {
    const mySub = assignmentSubmissions.find(
      (s) => s.assignmentId === assignment.id && s.studentId === currentUser?.uid
    );
    if (mySub) return mySub.status;
    const isOverdue = new Date(assignment.dueDate).getTime() < Date.now();
    return isOverdue ? "Muddati o'tgan" : 'Yangi';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <ClipboardList className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">Uyga Vazifalar va Topshiriqlar Markazi</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Dars, o'quv reja mavzusi yoki baholash asosida topshiriqlar yaratish, qoralama saqlash, fayl yuklash va qayta topshirish tarixi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Topshiriq qidirish..."
              className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {isAdmin && (
            <select
              value={classCodeFilter}
              onChange={(e) => setClassCodeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
            >
              <option value="All">Barcha sinflar</option>
              {CLASS_CODES.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
          )}

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
          >
            <option value="All">Barcha fanlar</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Yangi topshiriq
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3.5 flex items-center justify-between text-xs text-indigo-300">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Assignments List */}
      {filteredAssignments.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
          <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">Topshiriqlar topilmadi</h3>
          <p className="text-sm text-slate-400 mt-1">
            Tanlangan filtrlar bo'yicha hozircha uyga vazifa yoki amaliy topshiriqlar mavjud emas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAssignments.map((assignment) => {
            const subs = assignmentSubmissions.filter((s) => s.assignmentId === assignment.id);
            const mySub = subs.find((s) => s.studentId === currentUser?.uid);
            const myRevs = mySub
              ? submissionRevisions.filter((r) => r.submissionId === mySub.id)
              : [];
            const studentStatus = getStudentAssignmentStatus(assignment);
            const primaryClass =
              assignment.classCode || assignment.targetClassCodes?.[0] || '7a1';
            const maxPts = assignment.maxScore || assignment.maxPoints || 100;
            const topicText =
              assignment.relatedTopicName || assignment.relatedLessonTitle || assignment.topic;
            const firstAttachment =
              assignment.attachmentUrl || assignment.attachmentUrls?.[0];

            return (
              <div
                key={assignment.id}
                className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {primaryClass.toUpperCase()} • {assignment.subject}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300">
                        Format: {assignment.submissionType || 'written_text'}
                      </span>
                      {assignment.status === 'draft' && (
                        <span className="px-2 py-0.5 rounded text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Qoralama
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Muddat: {new Date(assignment.dueDate).toLocaleDateString('uz-UZ')}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white">{assignment.title}</h3>
                  {topicText && (
                    <p className="text-xs text-indigo-400 mt-0.5">Mavzu: {topicText}</p>
                  )}
                  <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">
                    {assignment.instructions || assignment.description}
                  </p>

                  {firstAttachment && (
                    <div className="mt-2">
                      <a
                        href={firstAttachment}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {assignment.attachmentName || "Ilova faylni ko'rish"}
                      </a>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-emerald-400" />
                      Maks. ball: <strong className="text-white">{maxPts}</strong>
                    </span>
                    {isAdmin && (
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-sky-400" />
                        Javoblar: <strong className="text-white">{subs.length} ta</strong>
                      </span>
                    )}
                    {!isAdmin && (
                      <span
                        className={`px-2 py-0.5 rounded font-semibold ${
                          studentStatus === 'Tekshirildi'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : studentStatus === 'Qaytarildi' || studentStatus === "Muddati o'tgan"
                            ? 'bg-rose-500/20 text-rose-300'
                            : studentStatus === 'Topshirildi'
                            ? 'bg-sky-500/20 text-sky-300'
                            : studentStatus === 'Jarayonda'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        Holat: {studentStatus}
                      </span>
                    )}
                  </div>

                  {isAdmin ? (
                    <button
                      onClick={() =>
                        setSelectedAssignmentId(
                          selectedAssignmentId === assignment.id ? null : assignment.id
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition-colors"
                    >
                      {selectedAssignmentId === assignment.id
                        ? 'Yopish'
                        : `Javoblarni ko'rish (${subs.length})`}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      {mySub && mySub.status === 'Tekshirildi' && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                          Ball: {mySub.score}/{maxPts}
                        </span>
                      )}
                      {(!mySub ||
                        mySub.status === 'Jarayonda' ||
                        mySub.status === 'Qaytarildi' ||
                        assignment.allowResubmission) && (
                        <button
                          onClick={() => {
                            if (selectedAssignmentId === assignment.id) {
                              setSelectedAssignmentId(null);
                            } else {
                              setSelectedAssignmentId(assignment.id);
                              setStudentAnswerText(
                                mySub?.content || mySub?.draftContent || mySub?.answerText || ''
                              );
                              setStudentAttachmentName(mySub?.attachmentName || '');
                              setStudentAttachmentUrl(
                                mySub?.attachmentUrl || mySub?.draftAttachmentUrl || ''
                              );
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors"
                        >
                          {mySub && mySub.status !== 'Jarayonda'
                            ? 'Qayta topshirish'
                            : mySub?.status === 'Jarayonda'
                            ? 'Davom ettirish'
                            : 'Bajarish'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Student Feedback & History Display */}
                {!isAdmin && mySub && (mySub.feedback || myRevs.length > 0) && (
                  <div className="mt-2 pt-3 border-t border-slate-800/60 space-y-2 text-xs">
                    {mySub.feedback && (
                      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-slate-300">
                        <span className="font-semibold text-indigo-400">Ustoz izohi: </span>
                        {mySub.feedback}
                      </div>
                    )}
                    {myRevs.length > 0 && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-slate-500" />
                        Topshirish urinishlari soni: {myRevs.length} ta (asl nusxalar saqlangan)
                      </div>
                    )}
                  </div>
                )}

                {/* Student Submission Form */}
                {!isAdmin && selectedAssignmentId === assignment.id && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-3 bg-slate-950/60 p-3.5 rounded-xl">
                    <div className="text-xs text-slate-400 flex items-center justify-between">
                      <span>
                        Talab qilingan format:{' '}
                        <strong>{assignment.submissionType || 'written_text'}</strong>
                      </span>
                      <span>Topshiriqni ochish uni avtomatik bajarildi deb belgilamaydi</span>
                    </div>
                    <textarea
                      value={studentAnswerText}
                      onChange={(e) => setStudentAnswerText(e.target.value)}
                      placeholder="Yechim yoki javobingizni batafsil yozing..."
                      rows={4}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-indigo-400" />
                        <span>
                          {studentAttachmentName || 'Fayl biriktirish (PDF, DOCX, XLSX, Rasm)'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
                          onChange={handleStudentFileSelect}
                          className="hidden"
                        />
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveDraft(assignment.id)}
                          disabled={isBusy}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                        >
                          Qoralama saqlash
                        </button>
                        <button
                          onClick={() => handleStudentSubmit(assignment.id)}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Tasdiqlab yuborish
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Admin Submissions List */}
                {isAdmin && selectedAssignmentId === assignment.id && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-2.5">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Topshirilgan javoblar ({subs.length})
                    </h4>
                    {subs.length === 0 ? (
                      <p className="text-xs text-slate-500">Hali hech kim javob yubormagan.</p>
                    ) : (
                      subs.map((sub) => {
                        const revs = submissionRevisions.filter((r) => r.submissionId === sub.id);
                        const subDate = sub.submissionDate || sub.submittedAt || sub.updatedAt;
                        return (
                          <div
                            key={sub.id}
                            className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-semibold text-white">
                                  {sub.studentName}
                                </span>
                                <span className="text-xs text-slate-500 ml-2">
                                  {subDate ? new Date(subDate).toLocaleString('uz-UZ') : ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {revs.length > 0 && (
                                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                                    Reviziyalar: {revs.length}
                                  </span>
                                )}
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                    sub.status === 'Tekshirildi'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : sub.status === 'Qaytarildi'
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : 'bg-amber-500/20 text-amber-300'
                                  }`}
                                >
                                  {sub.status}{' '}
                                  {sub.score !== undefined ? `(${sub.score}/${maxPts})` : ''}
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-slate-300 bg-slate-900 p-2.5 rounded-lg whitespace-pre-wrap">
                              {sub.content ||
                                sub.answerText ||
                                sub.draftContent ||
                                '(Matn kiritilmagan)'}
                            </p>

                            {sub.attachmentUrl && (
                              <div>
                                <a
                                  href={sub.attachmentUrl}
                                  download={sub.attachmentName || 'topshiriq-fayl'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300"
                                >
                                  <Paperclip className="w-3.5 h-3.5" />
                                  Yuklangan fayl: {sub.attachmentName || 'Faylni ochish'}
                                </a>
                              </div>
                            )}

                            {revs.length > 1 && (
                              <details className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg">
                                <summary className="cursor-pointer font-medium text-slate-300">
                                  Avvalgi topshirish urinishlari tarixi ({revs.length} ta)
                                </summary>
                                <div className="mt-2 space-y-1.5 pl-2 border-l border-slate-700">
                                  {revs.map((rev) => (
                                    <div key={rev.id}>
                                      <span className="text-indigo-300 font-semibold">
                                        #{rev.revisionNumber}-urinish (
                                        {new Date(rev.submittedAt).toLocaleString('uz-UZ')}):
                                      </span>{' '}
                                      <span>{rev.content || rev.answerText}</span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}

                            {gradingSubmissionId === sub.id ? (
                              <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-slate-400">Ball:</label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={maxPts}
                                    value={scoreInput}
                                    onChange={(e) => setScoreInput(Number(e.target.value))}
                                    className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                                  />
                                  <input
                                    type="text"
                                    value={feedbackInput}
                                    onChange={(e) => setFeedbackInput(e.target.value)}
                                    placeholder="Izoh yoki tavsiya..."
                                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                                  />
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleGrade(sub.id, true)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-medium"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    Qayta ishlashga qaytarish
                                  </button>
                                  <button
                                    onClick={() => handleGrade(sub.id, false)}
                                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                                  >
                                    Bahoni tasdiqlash
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-xs text-slate-400">
                                  {sub.feedback ? `Izoh: ${sub.feedback}` : ''}
                                </span>
                                <button
                                  onClick={() => {
                                    setGradingSubmissionId(sub.id);
                                    setScoreInput(sub.score ?? maxPts);
                                    setFeedbackInput(sub.feedback ?? '');
                                  }}
                                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                                >
                                  {sub.status === 'Tekshirildi'
                                    ? 'Qayta baholash'
                                    : "Ko'rib chiqish va baholash"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Assignment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Yangi Topshiriq Yaratish</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                Yopish
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Sinf</label>
                  <select
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    {CLASS_CODES.map((c) => (
                      <option key={c} value={c}>
                        {c.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Fan</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Manba turi</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="lesson">Dars asosida</option>
                    <option value="topic">O'quv reja mavzusi</option>
                    <option value="assessment">Baholash (Test) asosida</option>
                    <option value="custom">Maxsus ko'rsatma</option>
                  </select>
                </div>
              </div>

              {sourceType === 'lesson' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Bog'langan dars</label>
                  <select
                    value={relatedLessonId}
                    onChange={(e) => {
                      setRelatedLessonId(e.target.value);
                      const found = availableLessons.find((l) => l.id === e.target.value);
                      if (found) {
                        setTopic(found.topicName || found.title || '');
                        if (!title) setTitle(`${found.title || found.topicName} — Uyga vazifa`);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="">Darsni tanlang (ixtiyoriy)</option>
                    {availableLessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title || l.topicName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {sourceType === 'topic' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">O'quv reja mavzusi</label>
                  <select
                    value={topic}
                    onChange={(e) => {
                      setTopic(e.target.value);
                      if (!title && e.target.value) setTitle(`${e.target.value} — Mustaqil ish`);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="">Mavzuni tanlang</option>
                    {availableTopics.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {sourceType === 'assessment' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nashr etilgan baholash</label>
                  <select
                    value={assessmentId}
                    onChange={(e) => setAssessmentId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="">Baholashni tanlang</option>
                    {assessments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title} ({a.subject})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Topshiriq sarlavhasi</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Masalan: Kvadrat tenglamalar tahlili"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Mavzu nomi</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Masalan: Diskriminant va ildizlar"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Topshiriq ko'rsatmalari va shartlari
                </label>
                <textarea
                  rows={3}
                  value={instructions}
                  onChange={(e) => {
                    setInstructions(e.target.value);
                    setDescription(e.target.value);
                  }}
                  placeholder="O'quvchilar bajarishi kerak bo'lgan vazifalar va baholash mezonlari..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Topshirish muddati</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Maksimal ball</label>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    value={maxPoints}
                    onChange={(e) => setMaxPoints(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Topshirish formati</label>
                  <select
                    value={submissionType}
                    onChange={(e) => setSubmissionType(e.target.value as AssignmentSubmissionType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="written_text">Yozma javob (Matn)</option>
                    <option value="pdf">PDF hujjat</option>
                    <option value="docx">DOCX hujjat</option>
                    <option value="xlsx">XLSX jadval</option>
                    <option value="image">Rasm (JPEG/PNG/WebP)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowResubmission}
                    onChange={(e) => setAllowResubmission(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-600"
                  />
                  Qayta topshirishga ruxsat berish (tarix saqlanadi)
                </label>

                <div className="flex items-center justify-end gap-2">
                  <label className="text-xs text-slate-400">Nashr holati:</label>
                  <select
                    value={publishStatus}
                    onChange={(e) => setPublishStatus(e.target.value as 'published' | 'draft')}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white"
                  >
                    <option value="published">Nashr qilish</option>
                    <option value="draft">Qoralama sifatida saqlash</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
                >
                  {publishStatus === 'published' ? 'Yaratish va Nashr qilish' : 'Qoralama saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
