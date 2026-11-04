import React, { useState, useMemo } from 'react';
import { useLearnOS } from '../context/LearnOSContext';
import { OFFICIAL_19_CLASS_CODES } from '../constants/curriculum';
import { Announcement, OfficialClassCode } from '../types';
import {
  Megaphone,
  Plus,
  CheckCircle2,
  Eye,
  AlertCircle,
  Calendar,
  Users,
  BookOpen,
  ShieldAlert,
} from 'lucide-react';

const ANNOUNCEMENT_TYPE_LABELS: Record<Announcement['type'], string> = {
  school: "Maktab e'loni",
  academic: "O'quv e'loni",
  examination: 'Imtihon / BSB-CHSB',
  schedule_change: "Dars jadvali o'zgarishi",
  important_notice: 'Muhim xabarnoma',
};

export const AdminAnnouncementsPanel: React.FC = () => {
  const {
    currentUser,
    isPlatformOwner,
    announcements,
    announcementReads,
    announcementAcknowledgements,
    createAnnouncement,
    markAnnouncementRead,
    acknowledgeAnnouncement,
  } = useLearnOS();

  const isAdmin = isPlatformOwner || currentUser?.role === 'admin' || currentUser?.role === 'platform_owner';

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [shortContent, setShortContent] = useState('');
  const [type, setType] = useState<Announcement['type']>('school');
  const [audienceType, setAudienceType] = useState<Announcement['audienceType']>('entire_school');
  const [selectedClasses, setSelectedClasses] = useState<OfficialClassCode[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [priority, setPriority] = useState<Announcement['priority']>('normal');
  const [requiresAcknowledgment, setRequiresAcknowledgment] = useState(false);
  const [publicationDate, setPublicationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expirationDate, setExpirationDate] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      if (typeFilter !== 'ALL' && a.type !== typeFilter) return false;
      return true;
    });
  }, [announcements, typeFilter]);

  const toggleClass = (code: OfficialClassCode) => {
    setSelectedClasses((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const selectTrackGroup = (track: 'A' | 'T') => {
    const group = OFFICIAL_19_CLASS_CODES.filter((c) =>
      track === 'T' ? c.endsWith('t') : !c.endsWith('t')
    );
    setSelectedClasses(group);
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !shortContent.trim()) return;
    setIsSubmitting(true);
    try {
      await createAnnouncement({
        title: title.trim(),
        shortContent: shortContent.trim(),
        type,
        audienceType,
        targetClassCodes:
          audienceType === 'entire_school' ? [] : selectedClasses,
        targetSubjects: audienceType === 'subjects' ? selectedSubjects : [],
        priority,
        requiresAcknowledgment: requiresAcknowledgment || type === 'important_notice',
        publicationDate,
        expirationDate: expirationDate || undefined,
        attachmentUrl: attachmentUrl.trim() || undefined,
      });
      setTitle('');
      setShortContent('');
      setSelectedClasses([]);
      setShowCreateModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              E’lonlar Markazi (Announcement Center)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Maktab, sinflar va fanlar kesimidagi rasmiy xabarnomalar va tanishganlik tasdig‘i
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="E'lon turi bo'yicha filtr"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">Barcha turlar ({announcements.length})</option>
            {Object.entries(ANNOUNCEMENT_TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              E’lon chop etish
            </button>
          )}
        </div>
      </div>

      {filteredAnnouncements.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <Megaphone className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Hozircha faol e’lonlar mavjud emas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Yangi o‘quv e’lonlari, imtihon xabarlari yoki dars jadvali o‘zgarishlari shu yerda ko‘rinadi.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAnnouncements.map((ann) => {
            const readCount = announcementReads.filter((r) => r.announcementId === ann.id).length;
            const ackCount = announcementAcknowledgements.filter((a) => a.announcementId === ann.id).length;
            const myRead = announcementReads.some(
              (r) => r.announcementId === ann.id && r.studentId === currentUser?.uid
            );
            const myAck = announcementAcknowledgements.some(
              (a) => a.announcementId === ann.id && a.studentId === currentUser?.uid
            );
            const isUrgent = ann.priority === 'urgent' || ann.type === 'important_notice';

            return (
              <div
                key={ann.id}
                className={`rounded-2xl p-5 border transition ${
                  isUrgent
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/70'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                          isUrgent
                            ? 'bg-amber-600 text-white'
                            : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                        }`}
                      >
                        {ANNOUNCEMENT_TYPE_LABELS[ann.type] || ann.type}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 tabular-nums">
                        <Calendar className="w-3.5 h-3.5" />
                        {ann.publicationDate}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {ann.audienceType === 'entire_school'
                          ? 'Butun maktab'
                          : ann.targetClassCodes.map((c) => c.toUpperCase()).join(', ')}
                      </span>
                      {ann.targetSubjects?.length > 0 && (
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          {ann.targetSubjects.join(', ')}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {ann.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {ann.shortContent}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isAdmin ? (
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 tabular-nums">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-indigo-500" />
                          O‘qildi: {readCount}
                        </span>
                        {ann.requiresAcknowledgment && (
                          <span className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            Tasdiqlandi: {ackCount}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {!myRead ? (
                          <button
                            type="button"
                            onClick={() => markAnnouncementRead(ann.id)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                          >
                            O‘qidim deb belgilash
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            O‘qilgan
                          </span>
                        )}

                        {ann.requiresAcknowledgment && (
                          <button
                            type="button"
                            disabled={myAck}
                            onClick={() => acknowledgeAnnouncement(ann.id)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                              myAck
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-600 hover:bg-amber-700 text-white'
                            }`}
                          >
                            {myAck ? 'Tasdiqlangan' : 'Tanishganlikni tasdiqlash'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Announcement Modal */}
      {showCreateModal && isAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Yangi maktab e’lonini chop etish
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Yopish
              </button>
            </div>

            <form onSubmit={handlePublish} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  E’lon sarlavhasi
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Masalan: 1-chorak yakuniy CHSB imtihon jadvali"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Qisqa matn
                </label>
                <textarea
                  required
                  rows={3}
                  value={shortContent}
                  onChange={(e) => setShortContent(e.target.value)}
                  placeholder="E'lon mazmunini aniq va tushunarli bayon qiling..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    E’lon turi
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as Announcement['type'])}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  >
                    {Object.entries(ANNOUNCEMENT_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Muhimlik darajasi
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Announcement['priority'])}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="normal">Oddiy</option>
                    <option value="high">Yuqori e’tibor</option>
                    <option value="urgent">Muhim / Shoshilinch</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Auditoriya (Kimga mo‘ljallangan)
                </label>
                <select
                  value={audienceType}
                  onChange={(e) => setAudienceType(e.target.value as Announcement['audienceType'])}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                >
                  <option value="entire_school">Butun maktab (19 ta sinf)</option>
                  <option value="specific_classes">Tanlangan sinflar</option>
                  <option value="class_group">Yo‘nalish guruhi (A yoki T sinflar)</option>
                  <option value="subjects">Tegishli fanlar bo‘yicha</option>
                </select>
              </div>

              {audienceType !== 'entire_school' && (
                <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Sinflarni tanlang ({selectedClasses.length}):
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => selectTrackGroup('A')}
                        className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold cursor-pointer"
                      >
                        A-yo‘nalish (14)
                      </button>
                      <button
                        type="button"
                        onClick={() => selectTrackGroup('T')}
                        className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold cursor-pointer"
                      >
                        T-yo‘nalish (5)
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {OFFICIAL_19_CLASS_CODES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleClass(c)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          selectedClasses.includes(c)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {c.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    E’lon sanasi
                  </label>
                  <input
                    type="date"
                    value={publicationDate}
                    onChange={(e) => setPublicationDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Amal qilish muddati (ixtiyoriy)
                  </label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresAcknowledgment}
                  onChange={(e) => setRequiresAcknowledgment(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                O‘quvchilardan rasmiy "Tanishganlikni tasdiqlash" tugmasini bosishni talab qilish
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Chop etish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
