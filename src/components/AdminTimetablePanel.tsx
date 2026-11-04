import React, { useState, useMemo } from 'react';
import { useLearnOS } from '../context/LearnOSContext';
import { OFFICIAL_19_CLASS_CODES } from '../constants/curriculum';
import {
  TIMETABLE_WEEKDAYS,
  DEFAULT_PERIOD_TIMES,
  getAllowedSubjectsForClass,
  validateTimetableEntry,
  resolveStudentTimetableView,
} from '../utils/academicOsEngine';
import { OfficialClassCode, TimetableEntry, TimetableWeekday } from '../types';
import {
  Calendar,
  Clock,
  Plus,
  Copy,
  Archive,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  MapPin,
  Layers,
} from 'lucide-react';

export const AdminTimetablePanel: React.FC = () => {
  const {
    currentUser,
    isPlatformOwner,
    timetables,
    timetableEntries,
    lessons,
    createTimetable,
    duplicateTimetable,
    archiveTimetable,
    createTimetableEntry,
    updateTimetableEntry,
    deleteTimetableEntry,
  } = useLearnOS();

  const isAdmin = isPlatformOwner || currentUser?.role === 'admin' || currentUser?.role === 'platform_owner';
  const defaultClass = (currentUser?.classCode || '9a1') as OfficialClassCode;

  const [selectedClassCode, setSelectedClassCode] = useState<OfficialClassCode>(defaultClass);
  const [selectedDay, setSelectedDay] = useState<TimetableWeekday>('Dushanba');
  const [selectedTimetableId, setSelectedTimetableId] = useState<string>('');
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);

  // Entry form state
  const [weekday, setWeekday] = useState<TimetableWeekday>('Dushanba');
  const [lessonNumber, setLessonNumber] = useState<number>(1);
  const [subject, setSubject] = useState<string>('Matematika');
  const [startTime, setStartTime] = useState<string>('08:30');
  const [endTime, setEndTime] = useState<string>('09:15');
  const [room, setRoom] = useState<string>('201');
  const [relatedLessonId, setRelatedLessonId] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [duplicateTargetClass, setDuplicateTargetClass] = useState<OfficialClassCode>('9a2');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveClassCode: OfficialClassCode = isAdmin ? selectedClassCode : defaultClass;

  const classTimetables = useMemo(() => {
    return timetables
      .filter((t) => t.classCode.toLowerCase() === effectiveClassCode.toLowerCase())
      .sort((a, b) => b.version - a.version);
  }, [timetables, effectiveClassCode]);

  const activeTimetable = useMemo(() => {
    if (selectedTimetableId) {
      const found = classTimetables.find((t) => t.id === selectedTimetableId);
      if (found) return found;
    }
    return classTimetables.find((t) => t.status === 'active') || classTimetables[0] || null;
  }, [classTimetables, selectedTimetableId]);

  const activeEntries = useMemo(() => {
    if (!activeTimetable) return [];
    return timetableEntries
      .filter((e) => e.timetableId === activeTimetable.id)
      .sort((a, b) => a.weekdayIndex - b.weekdayIndex || a.lessonNumber - b.lessonNumber);
  }, [timetableEntries, activeTimetable]);

  const studentScheduleSummary = useMemo(() => {
    return resolveStudentTimetableView({
      classCode: effectiveClassCode,
      timetables,
      entries: timetableEntries,
    });
  }, [effectiveClassCode, timetables, timetableEntries]);

  const allowedSubjects = useMemo(
    () => getAllowedSubjectsForClass(effectiveClassCode),
    [effectiveClassCode]
  );

  const classLessons = useMemo(() => {
    return lessons.filter(
      (l) =>
        l.classCode?.toLowerCase() === effectiveClassCode.toLowerCase() &&
        (!subject || (l.subject || l.subjectName || '').toLowerCase().includes(subject.toLowerCase()))
    );
  }, [lessons, effectiveClassCode, subject]);

  const liveValidationIssues = useMemo(() => {
    if (!showEntryModal) return [];
    const dayIdx = TIMETABLE_WEEKDAYS.find((d) => d.label === weekday)?.index || 1;
    return validateTimetableEntry(
      {
        id: editingEntry?.id,
        institutionId: activeTimetable?.institutionId || 'inst-1',
        timetableId: activeTimetable?.id || 'temp',
        classCode: effectiveClassCode,
        classId: `class-${effectiveClassCode}`,
        weekday,
        weekdayIndex: dayIdx,
        lessonNumber,
        subject,
        startTime,
        endTime,
        room,
      },
      activeEntries
    );
  }, [
    showEntryModal,
    editingEntry,
    activeTimetable,
    effectiveClassCode,
    weekday,
    lessonNumber,
    subject,
    startTime,
    endTime,
    room,
    activeEntries,
  ]);

  const openAddEntryModal = (day: TimetableWeekday = 'Dushanba', period = 1) => {
    setEditingEntry(null);
    setWeekday(day);
    setLessonNumber(period);
    const defaultSubj = allowedSubjects[0] || 'Matematika';
    setSubject(defaultSubj);
    const times = DEFAULT_PERIOD_TIMES[period] || { startTime: '08:30', endTime: '09:15' };
    setStartTime(times.startTime);
    setEndTime(times.endTime);
    setRoom('');
    setRelatedLessonId('');
    setFormError(null);
    setShowEntryModal(true);
  };

  const openEditEntryModal = (entry: TimetableEntry) => {
    setEditingEntry(entry);
    setWeekday(entry.weekday);
    setLessonNumber(entry.lessonNumber);
    setSubject(entry.subject);
    setStartTime(entry.startTime);
    setEndTime(entry.endTime);
    setRoom(entry.room || '');
    setRelatedLessonId(entry.relatedLessonId || '');
    setFormError(null);
    setShowEntryModal(true);
  };

  const handlePeriodNumberChange = (num: number) => {
    setLessonNumber(num);
    if (!editingEntry && DEFAULT_PERIOD_TIMES[num]) {
      setStartTime(DEFAULT_PERIOD_TIMES[num].startTime);
      setEndTime(DEFAULT_PERIOD_TIMES[num].endTime);
    }
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      const matchedLesson = classLessons.find((l) => l.id === relatedLessonId);
      if (editingEntry) {
        await updateTimetableEntry(editingEntry.id, {
          weekday,
          lessonNumber,
          subject,
          startTime,
          endTime,
          room: room || undefined,
          relatedLessonId: relatedLessonId || undefined,
          relatedLessonTitle: matchedLesson?.topicTitle || undefined,
        });
      } else {
        await createTimetableEntry({
          timetableId: activeTimetable?.id,
          classCode: effectiveClassCode,
          weekday,
          lessonNumber,
          subject,
          startTime,
          endTime,
          room: room || undefined,
          relatedLessonId: relatedLessonId || undefined,
          relatedLessonTitle: matchedLesson?.topicTitle || undefined,
        });
      }
      setShowEntryModal(false);
    } catch (err: any) {
      setFormError(err?.message || 'Saqlashda xatolik yuz berdi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewVersion = async () => {
    setIsSubmitting(true);
    try {
      const created = await createTimetable({
        classCode: effectiveClassCode,
        effectiveFrom,
        archivePrevious: true,
      });
      setSelectedTimetableId(created.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicateTimetable = async () => {
    if (!activeTimetable) return;
    setIsSubmitting(true);
    try {
      await duplicateTimetable(activeTimetable.id, {
        targetClassCode: duplicateTargetClass,
        effectiveFrom,
        activateImmediately: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const periods = [1, 2, 3, 4, 5, 6];

  return (
    <div className="space-y-6">
      {/* Header & Class Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Aqlli Dars Jadvali ({effectiveClassCode.toUpperCase()})
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Dushanbadan Shanbagacha haftalik dars soatlari, xonalar va o‘quv xaritasi bog‘lanishi
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isAdmin && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Sinf:</label>
                <select
                  value={selectedClassCode}
                  onChange={(e) => {
                    setSelectedClassCode(e.target.value as OfficialClassCode);
                    setSelectedTimetableId('');
                  }}
                  aria-label="Sinfni tanlang"
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-white"
                >
                  {OFFICIAL_19_CLASS_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code.toUpperCase()} ({code.endsWith('t') ? 'T-yo‘nalish' : 'A-yo‘nalish'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {classTimetables.length > 1 && (
              <select
                value={activeTimetable?.id || ''}
                onChange={(e) => setSelectedTimetableId(e.target.value)}
                aria-label="Jadval versiyasi"
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                {classTimetables.map((tt) => (
                  <option key={tt.id} value={tt.id}>
                    v{tt.version} — {tt.effectiveFrom} ({tt.status === 'active' ? 'Faol' : 'Arxiv'})
                  </option>
                ))}
              </select>
            )}

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => openAddEntryModal(selectedDay, 1)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Dars qo‘shish
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewVersion}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Yangi versiya
                </button>
              </>
            )}
          </div>
        </div>

        {/* Today & Next Lesson Banner */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Bugungi kun ({studentScheduleSummary.todayWeekdayLabel})
            </div>
            <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white tabular-nums">
              {studentScheduleSummary.todaysLessons.length > 0
                ? `${studentScheduleSummary.todaysLessons.length} soat dars rejalashtirilgan`
                : 'Bugun uchun dars kiritilmagan'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/50">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Navbatdagi dars
            </div>
            <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
              {studentScheduleSummary.nextLesson
                ? `${studentScheduleSummary.nextLesson.weekday} • ${studentScheduleSummary.nextLesson.lessonNumber}-soat: ${studentScheduleSummary.nextLesson.subject} (${studentScheduleSummary.nextLesson.startTime}–${studentScheduleSummary.nextLesson.endTime})`
                : 'Jadval hali kiritilmagan'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Yo‘nalish fanlari ({effectiveClassCode.toUpperCase()})
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {allowedSubjects.join(' • ')}
              </div>
            </div>
            {isAdmin && activeTimetable && (
              <div className="flex items-center gap-1.5">
                <select
                  value={duplicateTargetClass}
                  onChange={(e) => setDuplicateTargetClass(e.target.value as OfficialClassCode)}
                  aria-label="Nusxa ko'chirish sinfi"
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  {OFFICIAL_19_CLASS_CODES.map((c) => (
                    <option key={c} value={c}>
                      {c.toUpperCase()} ga
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleDuplicateTimetable}
                  title="Jadvaldan boshqa sinfga nusxa olish"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Nusxa
                </button>
                <button
                  type="button"
                  onClick={() =>
                    archiveTimetable(
                      activeTimetable.id,
                      activeTimetable.status === 'archived' ? 'active' : 'archived'
                    )
                  }
                  title="Jadvalni arxivlash"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Empty State if no timetable configured */}
      {activeEntries.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {effectiveClassCode.toUpperCase()} sinfi uchun dars jadvali hali kiritilmagan
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            Maktab ma’muriyati ushbu sinfning haftalik dars jadvalini tasdiqlaganidan so‘ng dars soatlari va xonalar shu yerda aks etadi.
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={() => openAddEntryModal('Dushanba', 1)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Birinchi dars soatini kiritish
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile Day Selector & Daily Schedule Cards */}
          <div className="lg:hidden space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {TIMETABLE_WEEKDAYS.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setSelectedDay(d.label)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedDay === d.label
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <div className="space-y-2.5">
              {activeEntries
                .filter((e) => e.weekday === selectedDay)
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold tabular-nums">
                          {entry.lessonNumber}-soat
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {entry.startTime} – {entry.endTime}
                        </span>
                        {entry.room && (
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {entry.room}-xona
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">
                        {entry.subject}
                      </div>
                      {entry.relatedLessonTitle && (
                        <div className="mt-1 text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          Mavzu: {entry.relatedLessonTitle}
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditEntryModal(entry)}
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTimetableEntry(entry.id)}
                          className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Desktop Weekly Timetable Grid */}
          <div className="hidden lg:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                    <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-28">
                      Soat / Vaqt
                    </th>
                    {TIMETABLE_WEEKDAYS.map((day) => {
                      const isToday = studentScheduleSummary.todayWeekdayLabel === day.label;
                      return (
                        <th
                          key={day.label}
                          className={`py-3 px-3.5 text-xs font-bold uppercase tracking-wider border-l border-slate-200 dark:border-slate-800 ${
                            isToday
                              ? 'bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{day.label}</span>
                            {isToday && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px]">
                                Bugun
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {periods.map((period) => {
                    const defaultTimes = DEFAULT_PERIOD_TIMES[period];
                    return (
                      <tr key={period} className="group">
                        <td className="py-3.5 px-4 align-top bg-slate-50/40 dark:bg-slate-900">
                          <div className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                            {period}-soat
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                            {defaultTimes.startTime} – {defaultTimes.endTime}
                          </div>
                        </td>
                        {TIMETABLE_WEEKDAYS.map((day) => {
                          const cellEntry = activeEntries.find(
                            (e) => e.weekday === day.label && e.lessonNumber === period
                          );
                          return (
                            <td
                              key={`${day.label}_${period}`}
                              className="p-2.5 align-top border-l border-slate-200 dark:border-slate-800 min-w-[165px]"
                            >
                              {cellEntry ? (
                                <div className="p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/60 hover:border-indigo-400 transition">
                                  <div className="flex items-start justify-between gap-1">
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                      {cellEntry.subject}
                                    </span>
                                    {isAdmin && (
                                      <div className="flex items-center gap-1 opacity-80 hover:opacity-100">
                                        <button
                                          type="button"
                                          onClick={() => openEditEntryModal(cellEntry)}
                                          className="p-1 rounded hover:bg-white dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                                          title="Tahrirlash"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => deleteTimetableEntry(cellEntry.id)}
                                          className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-500 cursor-pointer"
                                          title="O‘chirish"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                    <span>
                                      {cellEntry.startTime}–{cellEntry.endTime}
                                    </span>
                                    {cellEntry.room && <span>• {cellEntry.room}-xona</span>}
                                  </div>
                                  {cellEntry.relatedLessonTitle && (
                                    <div className="mt-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 line-clamp-1 font-medium">
                                      {cellEntry.relatedLessonTitle}
                                    </div>
                                  )}
                                </div>
                              ) : isAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => openAddEntryModal(day.label, period)}
                                  className="w-full h-16 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 hover:bg-indigo-50/20 flex items-center justify-center text-xs text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                                >
                                  + Qo‘shish
                                </button>
                              ) : (
                                <div className="h-16 flex items-center justify-center text-[11px] text-slate-300 dark:text-slate-700">
                                  —
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal for Creating / Editing Timetable Entry */}
      {showEntryModal && isAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingEntry ? 'Dars soatini tahrirlash' : `${effectiveClassCode.toUpperCase()} — Yangi dars soati`}
              </h3>
              <button
                type="button"
                onClick={() => setShowEntryModal(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Yopish
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Hafta kuni
                  </label>
                  <select
                    value={weekday}
                    onChange={(e) => setWeekday(e.target.value as TimetableWeekday)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  >
                    {TIMETABLE_WEEKDAYS.map((d) => (
                      <option key={d.label} value={d.label}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Dars soati (1–7)
                  </label>
                  <select
                    value={lessonNumber}
                    onChange={(e) => handlePeriodNumberChange(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white tabular-nums"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {n}-soat
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Fan ({effectiveClassCode.toUpperCase()})
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  >
                    {allowedSubjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Xona raqami (ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="Masalan: 204"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Boshlanish vaqti
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Tugash vaqti
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  O‘quv xaritasi mavzusiga bog‘lash (ixtiyoriy)
                </label>
                <select
                  value={relatedLessonId}
                  onChange={(e) => setRelatedLessonId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">— Mavzuni tanlang —</option>
                  {classLessons.slice(0, 60).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.quarter}-chorak, {l.lessonNumber}-dars: {l.topicTitle}
                    </option>
                  ))}
                </select>
              </div>

              {liveValidationIssues.length > 0 && (
                <div className="space-y-1.5">
                  {liveValidationIssues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                        issue.severity === 'error'
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-medium">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting || liveValidationIssues.some((i) => i.severity === 'error')
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {editingEntry ? 'Yangilash' : 'Jadvalga saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
