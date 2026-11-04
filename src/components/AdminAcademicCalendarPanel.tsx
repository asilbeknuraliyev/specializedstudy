import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLearnOS } from '../context/LearnOSContext';
import { OFFICIAL_19_CLASS_CODES } from '../constants/curriculum';
import {
  buildUnifiedAcademicCalendarEvents,
  computeFourAcademicStatesForLesson,
} from '../utils/academicOsEngine';
import {
  AcademicCalendarEventCategory,
  LessonDeliveryStatus,
  OfficialClassCode,
} from '../types';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  ExternalLink,
  ClipboardCheck,
  History,
  ListFilter,
} from 'lucide-react';

const CATEGORY_LABELS: Record<AcademicCalendarEventCategory, string> = {
  timetable: 'Dars jadvali',
  published_lesson: "E'lon qilingan / O'tilgan dars",
  assignment: 'Uyga vazifa muddati',
  assessment: 'Nazorat ishi',
  bsb: 'BSB (Bob yakuni)',
  chsb: 'CHSB (Chorak yakuni)',
  project_work: 'Loyiha ishi',
  announcement: "Maktab e'loni",
  academic_date: 'Akademik sana',
};

export const AdminAcademicCalendarPanel: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    isPlatformOwner,
    institution,
    timetables,
    timetableEntries,
    lessons,
    lessonDeliveryRecords,
    studentAssignments,
    assessments,
    announcements,
    academicEvents,
    studentLessonCompletions,
    masteryRecords,
    updateLessonDeliveryStatus,
    createAcademicCalendarEvent,
  } = useLearnOS();

  const isAdmin = isPlatformOwner || currentUser?.role === 'admin' || currentUser?.role === 'platform_owner';
  const defaultClass = (currentUser?.classCode || '9a1') as OfficialClassCode;

  const [activeTab, setActiveTab] = useState<'calendar' | 'delivery'>('calendar');
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'agenda'>('agenda');
  const [classFilter, setClassFilter] = useState<string>(isAdmin ? 'ALL' : defaultClass);
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [deliveryQuarter, setDeliveryQuarter] = useState<number>(1);
  const [deliveryClass, setDeliveryClass] = useState<OfficialClassCode>(defaultClass);

  // Add Academic Date modal
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newCategory, setNewCategory] = useState<AcademicCalendarEventCategory>('academic_date');
  const [newClassCode, setNewClassCode] = useState<string>('ALL');
  const [newDesc, setNewDesc] = useState('');

  // Delivery modal state
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<LessonDeliveryStatus>("O'tildi");
  const [actualDate, setActualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [completionNote, setCompletionNote] = useState('');

  // Calculate reference Monday of current week in Asia/Tashkent
  const referenceMonday = useMemo(() => {
    const now = new Date();
    const day = now.getDay() || 7;
    const monday = new Date(now.getTime() - (day - 1) * 86400000);
    return monday.toISOString().slice(0, 10);
  }, []);

  const allUnifiedEvents = useMemo(() => {
    return buildUnifiedAcademicCalendarEvents({
      institutionId: institution.id,
      timetableEntries,
      timetables,
      lessons,
      deliveryRecords: lessonDeliveryRecords,
      assignments: studentAssignments,
      assessments,
      announcements,
      customEvents: academicEvents,
      referenceWeekMondayDate: referenceMonday,
    });
  }, [
    institution.id,
    timetableEntries,
    timetables,
    lessons,
    lessonDeliveryRecords,
    studentAssignments,
    assessments,
    announcements,
    academicEvents,
    referenceMonday,
  ]);

  const filteredEvents = useMemo(() => {
    const targetCls = isAdmin ? (classFilter !== 'ALL' ? classFilter.toLowerCase() : '') : defaultClass.toLowerCase();
    return allUnifiedEvents.filter((ev) => {
      if (targetCls) {
        const matchSingle = ev.classCode?.toLowerCase() === targetCls;
        const matchMulti = ev.targetClassCodes?.some((c) => c.toLowerCase() === targetCls);
        const isGlobalAnn = ev.category === 'announcement' && (!ev.targetClassCodes || ev.targetClassCodes.length === 0);
        if (!matchSingle && !matchMulti && !isGlobalAnn) return false;
      }
      if (subjectFilter !== 'ALL' && ev.subject && ev.subject !== subjectFilter) return false;
      if (categoryFilter !== 'ALL' && ev.category !== categoryFilter) return false;
      return true;
    });
  }, [allUnifiedEvents, isAdmin, classFilter, defaultClass, subjectFilter, categoryFilter]);

  const deliveryLessons = useMemo(() => {
    return lessons
      .filter(
        (l) =>
          l.classCode?.toLowerCase() === deliveryClass.toLowerCase() &&
          l.quarter === deliveryQuarter &&
          (subjectFilter === 'ALL' || l.subject === subjectFilter)
      )
      .sort((a, b) => a.lessonNumber - b.lessonNumber);
  }, [lessons, deliveryClass, deliveryQuarter, subjectFilter]);

  const deliverySummaryStats = useMemo(() => {
    let delivered = 0;
    let rescheduled = 0;
    let cancelled = 0;
    deliveryLessons.forEach((l) => {
      const rec = lessonDeliveryRecords.find(
        (r) => r.lessonId === l.id && r.classCode.toLowerCase() === deliveryClass.toLowerCase()
      );
      if (rec?.deliveryStatus === "O'tildi") delivered++;
      else if (rec?.deliveryStatus === "Ko'chirildi") rescheduled++;
      else if (rec?.deliveryStatus === 'Bekor qilindi') cancelled++;
    });
    return {
      totalPlanned: deliveryLessons.length,
      delivered,
      rescheduled,
      cancelled,
      remaining: Math.max(0, deliveryLessons.length - delivered - cancelled),
    };
  }, [deliveryLessons, lessonDeliveryRecords, deliveryClass]);

  const handleSaveDeliveryStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLessonId) return;
    await updateLessonDeliveryStatus({
      lessonId: editingLessonId,
      classCode: deliveryClass,
      deliveryStatus,
      actualDeliveryDate: actualDate,
      completionNote: completionNote.trim() || undefined,
    });
    setEditingLessonId(null);
    setCompletionNote('');
  };

  const handleCreateCustomEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate) return;
    await createAcademicCalendarEvent({
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      category: newCategory,
      date: newDate,
      classCode: newClassCode as OfficialClassCode | 'ALL',
    });
    setNewTitle('');
    setNewDesc('');
    setShowAddEventModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Mode Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Akademik Kalendar 2.0 va Dars O‘tilishi Nazorati
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Haqiqiy sanalardagi darslar, vazifalar, BSB/CHSB va reja hamda amalda o‘tilgan darslar hisobi
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'calendar'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Akademik Kalendar ({filteredEvents.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('delivery')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  activeTab === 'delivery'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Dars O‘tilishi (Lesson Delivery Tracker)
              </button>
            </div>

            {isAdmin && activeTab === 'calendar' && (
              <button
                type="button"
                onClick={() => setShowAddEventModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Akademik sana qo‘shish
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {activeTab === 'calendar' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            {isAdmin && (
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                aria-label="Sinf filtri"
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">Sinf: Barchasi (19 sinf)</option>
                {OFFICIAL_19_CLASS_CODES.map((c) => (
                  <option key={c} value={c}>
                    {c.toUpperCase()}
                  </option>
                ))}
              </select>
            )}

            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              aria-label="Fan filtri"
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
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Kategoriya filtri"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">Toifa: Barchasi</option>
              {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {(['agenda', 'week', 'month'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCalendarView(v)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                    calendarView === v
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-500'
                  }`}
                >
                  {v === 'agenda' ? 'Kun tartibi' : v === 'week' ? 'Hafta' : 'Oy'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <select
              value={deliveryClass}
              onChange={(e) => setDeliveryClass(e.target.value as OfficialClassCode)}
              disabled={!isAdmin}
              aria-label="Dars o'tilishi sinfi"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
            >
              {OFFICIAL_19_CLASS_CODES.map((c) => (
                <option key={c} value={c}>
                  Sinf: {c.toUpperCase()}
                </option>
              ))}
            </select>

            <select
              value={deliveryQuarter}
              onChange={(e) => setDeliveryQuarter(Number(e.target.value))}
              aria-label="Chorak"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
            >
              <option value={1}>1-chorak</option>
              <option value={2}>2-chorak</option>
              <option value={3}>3-chorak</option>
              <option value={4}>4-chorak</option>
            </select>

            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              aria-label="Fan"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white"
            >
              <option value="ALL">Barcha fanlar</option>
              <option value="Matematika">Matematika</option>
              <option value="Ingliz tili">Ingliz tili</option>
              <option value="Fizika">Fizika</option>
              <option value="Biologiya">Biologiya</option>
              <option value="Kimyo">Kimyo</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: ACADEMIC CALENDAR 2.0 */}
      {activeTab === 'calendar' && (
        <div className="space-y-3">
          {filteredEvents.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
              <CalendarIcon className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Tanlangan mezonlar bo‘yicha tasdiqlangan sanalar topilmadi
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Kalendar faqat haqiqiy kiritilgan dars jadvallari, topshiriq muddatlari va BSB/CHSB sanalarini ko‘rsatadi.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => navigate(ev.targetRoute)}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-3 ${
                    ev.hasConflictWarning
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase">
                        {CATEGORY_LABELS[ev.category] || ev.category}
                      </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                        {ev.date}
                        {ev.startTime ? ` • ${ev.startTime}` : ''}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {ev.title}
                    </h3>

                    {ev.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {ev.description}
                      </p>
                    )}

                    {ev.hasConflictWarning && (
                      <div className="p-2 rounded-lg bg-amber-100/70 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[11px] font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{ev.conflictMessage}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>
                      {ev.classCode ? ev.classCode.toUpperCase() : 'Maktab'}
                      {ev.subject ? ` • ${ev.subject}` : ''}
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1">
                      Yozuvni ochish <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LESSON DELIVERY TRACKER (4-State Separation) */}
      {activeTab === 'delivery' && (
        <div className="space-y-5">
          {/* Planned vs Delivered Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold uppercase text-slate-400">Rejalashtirilgan</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
                {deliverySummaryStats.totalPlanned} soat
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold uppercase text-emerald-600">Amalda O‘tildi</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
                {deliverySummaryStats.delivered} soat
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold uppercase text-amber-600">Ko‘chirildi</div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">
                {deliverySummaryStats.rescheduled} soat
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold uppercase text-rose-600">Bekor qilindi</div>
              <div className="text-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums mt-1">
                {deliverySummaryStats.cancelled} soat
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold uppercase text-indigo-600">Bajarilish ulushi</div>
              <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums mt-1">
                {deliverySummaryStats.totalPlanned > 0
                  ? Math.round((deliverySummaryStats.delivered / deliverySummaryStats.totalPlanned) * 100)
                  : 0}
                %
              </div>
            </div>
          </div>

          {/* 4-State Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Mavzu va Fan</th>
                    <th className="py-3 px-4">1. Dars E’lon Qilingan</th>
                    <th className="py-3 px-4">2. Maktabda O‘tilganlik (Delivery)</th>
                    <th className="py-3 px-4">3. O‘quvchi Tugatgan</th>
                    <th className="py-3 px-4">4. Mavzu O‘zlashtirilgan</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Boshqaruv</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {deliveryLessons.slice(0, 80).map((lesson) => {
                    const states = computeFourAcademicStatesForLesson({
                      lesson,
                      classCode: deliveryClass,
                      deliveryRecords: lessonDeliveryRecords,
                      studentCompletions: studentLessonCompletions,
                      masteryRecords,
                      studentId: !isAdmin ? currentUser?.uid : undefined,
                    });
                    return (
                      <tr key={lesson.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold tabular-nums text-slate-500">
                          {lesson.lessonNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {lesson.topicTitle}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {lesson.subject} • {lesson.quarter}-chorak
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              states.isLessonPublished
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            {states.isLessonPublished ? 'E’lon qilingan' : 'Qoralama'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded font-bold ${
                              states.deliveryStatus === "O'tildi"
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : states.deliveryStatus === "Ko'chirildi"
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                : states.deliveryStatus === 'Bekor qilindi'
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {states.deliveryStatus}
                            {states.actualDeliveryDate ? ` (${states.actualDeliveryDate})` : ''}
                          </span>
                        </td>
                        <td className="py-3 px-4 tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                          {isAdmin
                            ? `${states.classCompletionCount} nafar o‘quvchi`
                            : states.isStudentLessonCompleted
                            ? 'Bajarilgan'
                            : 'Bajarilmagan'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                          {states.isStudentTopicMastered ? 'Mustahkam (≥80%)' : 'Jarayonda'}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLessonId(lesson.id);
                                setDeliveryStatus(states.deliveryStatus === 'Rejalashtirilgan' ? "O'tildi" : states.deliveryStatus);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-semibold cursor-pointer"
                            >
                              Holatni belgilash
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Update Lesson Delivery Status */}
      {editingLessonId && isAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Rasmiy dars o‘tilganlik holatini yangilash ({deliveryClass.toUpperCase()})
            </h3>
            <form onSubmit={handleSaveDeliveryStatus} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Dars holati
                </label>
                <select
                  value={deliveryStatus}
                  onChange={(e) => setDeliveryStatus(e.target.value as LessonDeliveryStatus)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
                >
                  <option value="Rejalashtirilgan">Rejalashtirilgan</option>
                  <option value="O'tildi">O‘tildi (Rasman o‘tilgan)</option>
                  <option value="Ko'chirildi">Ko‘chirildi</option>
                  <option value="Bekor qilindi">Bekor qilindi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Amalda o‘tilgan sana
                </label>
                <input
                  type="date"
                  value={actualDate}
                  onChange={(e) => setActualDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Izoh (ixtiyoriy)
                </label>
                <textarea
                  rows={2}
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  placeholder="Masalan: Amaliy mashqlar to'liq yechildi..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingLessonId(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Tasdiqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Custom Academic Date */}
      {showAddEventModal && isAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Yangi akademik sana qo‘shish
            </h3>
            <form onSubmit={handleCreateCustomEvent} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Tadbir nomi
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Masalan: 1-chorak Matematika Olimpiadasi"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Sana
                  </label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Sinf
                  </label>
                  <select
                    value={newClassCode}
                    onChange={(e) => setNewClassCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="ALL">Butun maktab</option>
                    {OFFICIAL_19_CLASS_CODES.map((c) => (
                      <option key={c} value={c}>
                        {c.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddEventModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Qo‘shish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
