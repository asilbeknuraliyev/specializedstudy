import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  User,
  X,
  Target,
  Layers,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { useLearnOS } from '../context/LearnOSContext';
import { StudentSupportPlan, SupportPlanStatus, OfficialClassCode } from '../types';
import { OFFICIAL_19_CLASS_CODES } from '../constants/curriculum';

export const AdminSupportPlansPanel: React.FC<{
  onInspectStudent?: (studentId: string) => void;
}> = ({ onInspectStudent }) => {
  const {
    studentSupportPlans,
    users,
    createSupportPlan,
    updateSupportPlan,
    addToast,
  } = useLearnOS();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [subject, setSubject] = useState('Matematika');
  const [topic, setTopic] = useState('');
  const [observedNeed, setObservedNeed] = useState('');
  const [goal, setGoal] = useState('');
  const [recommendedActivity, setRecommendedActivity] = useState('');
  const [reviewDate, setReviewDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  );
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Editing notes modal state
  const [editingPlan, setEditingPlan] = useState<StudentSupportPlan | null>(null);
  const [notesInput, setNotesInput] = useState('');
  const [statusInput, setStatusInput] = useState<SupportPlanStatus>('Jarayonda');

  const students = useMemo(
    () => users.filter((u) => u.role === 'student' && u.status !== 'archived'),
    [users]
  );

  const filteredPlans = useMemo(() => {
    return studentSupportPlans.filter((p) => {
      const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
      const matchClass =
        classFilter === 'ALL' || p.classCode.toLowerCase() === classFilter.toLowerCase();
      const matchSearch =
        !searchQuery.trim() ||
        p.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.subject.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchClass && matchSearch;
    });
  }, [studentSupportPlans, statusFilter, classFilter, searchQuery]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !topic.trim() || !observedNeed.trim() || !goal.trim()) {
      addToast('error', 'Iltimos, barcha majburiy maydonlarni to‘ldiring.');
      return;
    }

    setSubmitting(true);
    try {
      await createSupportPlan({
        studentId: selectedStudentId,
        subject,
        topic: topic.trim(),
        observedNeed: observedNeed.trim(),
        goal: goal.trim(),
        recommendedActivity: recommendedActivity.trim() || 'Qo‘shimcha amaliy mashqlar',
        reviewDate,
      });
      setShowCreateModal(false);
      setTopic('');
      setObservedNeed('');
      setGoal('');
      setRecommendedActivity('');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Reja yaratishda xatolik');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (plan: StudentSupportPlan) => {
    setEditingPlan(plan);
    setNotesInput(plan.progressNotes || '');
    setStatusInput(plan.status);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    try {
      await updateSupportPlan(editingPlan.id, {
        progressNotes: notesInput.trim(),
        status: statusInput,
      });
      setEditingPlan(null);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Yangilashda xatolik');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Yakka tartibdagi o‘quv yordam rejalari
            </h1>
            <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
              Maxfiy (Admin Only)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Qo‘shimcha ta’limiy yordamga muhtoj o‘quvchilar uchun individual maqsadlar va kuzatuv qaydlari.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (students.length > 0 && !selectedStudentId) {
              setSelectedStudentId(students[0].uid);
            }
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Yangi yordam rejasi tuzish</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="O‘quvchi yoki mavzu bo‘yicha qidirish..."
            className="w-full text-xs bg-transparent border-none focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
          >
            <option value="ALL">Barcha holatlar</option>
            <option value="Yangi">Yangi</option>
            <option value="Jarayonda">Jarayonda</option>
            <option value="Yakunlandi">Yakunlandi</option>
          </select>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
          >
            <option value="ALL">Barcha sinflar</option>
            {OFFICIAL_19_CLASS_CODES.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()} sinf
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Support Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPlans.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <Target className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Yordam rejalari topilmadi
            </p>
            <p className="text-xs text-slate-500 mt-1">
              O‘quvchilar uchun individual pedagogik yordam rejasini yaratish uchun yuqoridagi tugmani bosing.
            </p>
          </div>
        ) : (
          filteredPlans.map((plan) => (
            <div
              key={plan.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 shadow-xs"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase">
                      {plan.classCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => onInspectStudent?.(plan.studentId)}
                      className="font-bold text-sm text-slate-900 dark:text-white hover:text-blue-600 underline-offset-2 hover:underline cursor-pointer"
                    >
                      {plan.studentName}
                    </button>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
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

                <div className="space-y-1.5 text-xs">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {plan.subject} · {plan.topic}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    <strong>Kuzatilgan ehtiyoj:</strong> {plan.observedNeed}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    <strong>Maqsad:</strong> {plan.goal}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    <strong>Tavsiya etilgan amaliyot:</strong> {plan.recommendedActivity}
                  </p>
                  {plan.progressNotes && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                      <strong>Bajarilish qaydlari:</strong> {plan.progressNotes}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="font-mono text-slate-400 text-[11px]">
                  Ko‘rib chiqish: <strong>{plan.reviewDate}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(plan)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
                >
                  Tahrirlash / Qayd qo‘shish
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="font-bold text-base text-slate-900 dark:text-white">
                Yakka tartibdagi o‘quv yordam rejasi tuzish
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  O‘quvchini tanlang:
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                  required
                >
                  {students.map((stu) => (
                    <option key={stu.uid} value={stu.uid}>
                      {stu.displayName} ({stu.classCode?.toUpperCase() || 'Sinf belgilanmagan'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Fan</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Mavzu</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Masalan: Kasrlar ustida amallar"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Kuzatilgan ta’limiy ehtiyoj
                </label>
                <textarea
                  rows={2}
                  value={observedNeed}
                  onChange={(e) => setObservedNeed(e.target.value)}
                  placeholder="Muammo yoki bo‘shliq mohiyati..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Maqsad</label>
                <textarea
                  rows={2}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Kutilayotgan ta’limiy natija..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Tavsiya etilgan amaliy mashg‘ulot
                </label>
                <textarea
                  rows={2}
                  value={recommendedActivity}
                  onChange={(e) => setRecommendedActivity(e.target.value)}
                  placeholder="Masalan: Har kuni 5 ta misol yechish va haftalik diagnostika..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Ko‘rib chiqish sanasi (Review date)
                </label>
                <input
                  type="date"
                  value={reviewDate}
                  onChange={(e) => setReviewDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                >
                  {submitting ? 'Saqlanmoqda...' : 'Rejani saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Notes & Status Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Rejani yangilash — {editingPlan.studentName}
              </h3>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Holat:</label>
                <select
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value as SupportPlanStatus)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                >
                  <option value="Yangi">Yangi</option>
                  <option value="Jarayonda">Jarayonda</option>
                  <option value="Yakunlandi">Yakunlandi</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Bajarilish qaydlari va xulosalar:
                </label>
                <textarea
                  rows={3}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Kuzatilgan ijobiy o‘zgarishlar yoki yakuniy xulosalar..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
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
