import React, { useMemo } from 'react';
import { Award, Bell, CheckCircle2, Flame, Layers, Shield, Sparkles } from 'lucide-react';
import { useLearnOS } from '../context/LearnOSContext';
import {
  GAMIFICATION_LEVELS,
  buildStudentLearningJourney,
  createInitialGamificationProfile,
  createInitialStreakRecord,
} from '../utils/gamificationEngine';
import { parseOfficialClassCode } from '../constants/curriculum';
import {
  AVATAR_ICON_OPTIONS,
  GamificationBadgeSvg,
  LevelCrestSvg,
  StudentAvatarSvg,
} from './GamificationIcons';

export const StudentProfile2: React.FC = () => {
  const {
    currentUser,
    classes,
    subjects,
    lessons,
    attempts,
    studentGamificationProfiles,
    gamificationBadges,
    studentBadges,
    streakRecords,
    xpLedger,
    studentLessonCompletions,
    updateStudentProfilePreferences,
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
      createInitialStreakRecord(studentId, 1)
    );
  }, [streakRecords, studentId]);

  const myCompletions = useMemo(
    () => studentLessonCompletions.filter((c) => c.studentId === studentId),
    [studentLessonCompletions, studentId]
  );

  const milestones = useMemo(
    () =>
      buildStudentLearningJourney({
        studentId,
        profile,
        completions: myCompletions,
        submissions: attempts as any,
        lessons,
      }),
    [studentId, profile, myCompletions, attempts, lessons]
  );

  const earnedBadgesMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of studentBadges) {
      if (b.studentId === studentId) {
        map.set(b.badgeCode, b.earnedAt);
      }
    }
    return map;
  }, [studentBadges, studentId]);

  const myLedger = useMemo(
    () => xpLedger.filter((l) => l.studentId === studentId).slice(0, 12),
    [xpLedger, studentId]
  );

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <StudentAvatarSvg iconKey={profile.avatarIcon} size={68} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-blue-600 text-white text-xs font-bold uppercase">
                  {classCode} sinf
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                  {parsedClass.grade}-sinf • {parsedClass.track === 'A' ? 'Aniq fanlar' : 'Tabiiy fanlar'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {currentUser.displayName}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {currentUser.email} {currentUser.studentCode ? `• ID: ${currentUser.studentCode}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60 flex items-center gap-3">
              <LevelCrestSvg level={profile.currentLevel} size={40} />
              <div>
                <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  {profile.currentLevel}-daraja • {profile.currentLevelTitle}
                </div>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {profile.totalXp} XP
                </div>
              </div>
            </div>

            <div className="px-4 py-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 flex items-center gap-3">
              <Flame className="w-7 h-7 text-amber-500" />
              <div>
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Izchillik (Streak)
                </div>
                <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {streak.currentStreakDays} kun
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Avatar Icon Picker & Preferences */}
        <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
              Profil belgisini tanlang (Akademik ramzlar)
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {AVATAR_ICON_OPTIONS.map((opt) => {
                const active = profile.avatarIcon === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => updateStudentProfilePreferences({ avatarIcon: opt.key })}
                    className={`p-1.5 rounded-2xl border transition flex items-center gap-1.5 pr-2.5 ${
                      active
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-blue-300'
                    }`}
                  >
                    <StudentAvatarSvg iconKey={opt.key} size={32} />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.streakRemindersEnabled}
                onChange={(e) =>
                  updateStudentProfilePreferences({ streakRemindersEnabled: e.target.checked })
                }
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <Bell className="w-3.5 h-3.5 text-blue-600" />
              <span>Kunlik o'quv eslatmalari</span>
            </label>
          </div>
        </div>
      </div>

      {/* 7-Level Progression Scale */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span>Akademik Darajalar Tizimi (Level 1 — Level 7)</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {GAMIFICATION_LEVELS.map((lvl) => {
            const reached = profile.currentLevel >= lvl.level;
            const isCurrent = profile.currentLevel === lvl.level;
            return (
              <div
                key={lvl.level}
                className={`p-3 rounded-xl border text-center transition ${
                  isCurrent
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20'
                    : reached
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 opacity-70'
                }`}
              >
                <div className="flex justify-center mb-1.5">
                  <LevelCrestSvg level={lvl.level} size={32} />
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {lvl.level}. {lvl.title}
                </div>
                <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                  {lvl.minXp}+ XP
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Earned Badges & Learning Journey */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-600" />
            <span>Barcha Yutuq Nishonlari ({earnedBadgesMap.size} / {gamificationBadges.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {gamificationBadges.map((b) => {
              const earnedAt = earnedBadgesMap.get(b.code);
              const isEarned = Boolean(earnedAt);
              return (
                <div
                  key={b.id}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                    isEarned
                      ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                      : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 opacity-75'
                  }`}
                >
                  <GamificationBadgeSvg code={b.code} earned={isEarned} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {b.title}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {b.description}
                    </p>
                    <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 mt-1">
                      {isEarned
                        ? `Qo'lga kiritilgan: ${String(earnedAt).slice(0, 10)}`
                        : `Talab: ${b.thresholdValue} ta tasdiqlangan faoliyat`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Permanent XP Ledger History */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Tasdiqlangan XP Tarixi (XP Ledger)</span>
          </h2>
          {myLedger.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {myLedger.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {entry.reason}
                    </div>
                    <div className="text-[11px] text-slate-400">{entry.dateKey}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold shrink-0">
                    +{entry.xpDelta} XP
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Kunlik maqsadni belgilash, darslarni yakunlash va testlarni ishlash orqali XP ballarini to'plang.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
