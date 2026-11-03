import React, { useState } from 'react';
import { Award, Plus, Save, Settings2, ShieldCheck, Sparkles, Target, Users } from 'lucide-react';
import { useLearnOS } from '../context/LearnOSContext';
import { OFFICIAL_19_CLASS_CODES } from '../constants/curriculum';
import { GamificationBadgeSvg } from './GamificationIcons';

export const AdminGamificationPanel: React.FC = () => {
  const {
    gamificationConfig,
    gamificationBadges,
    classChallenges,
    updateGamificationConfig,
    createClassChallenge,
    updateClassChallenge,
  } = useLearnOS();

  const [xpRewards, setXpRewards] = useState({ ...gamificationConfig.xpRewards });
  const [dailyXpCap, setDailyXpCap] = useState(gamificationConfig.dailyXpCap || 150);
  const [streakGraceDays, setStreakGraceDays] = useState(gamificationConfig.streakGraceDays ?? 1);
  const [enableDailyCheckin, setEnableDailyCheckin] = useState(gamificationConfig.enableDailyCheckin);
  const [enableBadges, setEnableBadges] = useState(gamificationConfig.enableBadges);
  const [enableStreaks, setEnableStreaks] = useState(gamificationConfig.enableStreaks);
  const [enableClassChallenges, setEnableClassChallenges] = useState(gamificationConfig.enableClassChallenges);
  const [enableWeeklyRecap, setEnableWeeklyRecap] = useState(gamificationConfig.enableWeeklyRecap);

  // New cooperative class challenge form
  const [challengeClass, setChallengeClass] = useState('7a1');
  const [challengeTitle, setChallengeTitle] = useState("Bu hafta sinf bo'lib 30 ta darsni yakunlaymiz");
  const [challengeTarget, setChallengeTarget] = useState(30);
  const [challengeType, setChallengeType] = useState<'lessons' | 'assessments' | 'checkins' | 'activities'>('lessons');

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateGamificationConfig({
      xpRewards,
      dailyXpCap: Number(dailyXpCap) || 150,
      streakGraceDays: Number(streakGraceDays) || 0,
      enableDailyCheckin,
      enableBadges,
      enableStreaks,
      enableClassChallenges,
      enableWeeklyRecap,
    });
  };

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeTitle.trim()) return;
    await createClassChallenge({
      classCode: challengeClass,
      title: challengeTitle.trim(),
      targetType: challengeType,
      targetCount: Number(challengeTarget) || 30,
    });
    setChallengeTitle("Bu hafta sinf bo'lib 30 ta darsni yakunlaymiz");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Motivatsiya va Gamifikatsiya Boshqaruvi</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              XP Ballari, Izchillik (Streak) va Sog'lom Motivatsiya Qoidalari
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Server-Authoritative XP
          </span>
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Kunlik maqsad (Check-in)
              </label>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={xpRewards.daily_checkin}
                  onChange={(e) =>
                    setXpRewards((p) => ({ ...p, daily_checkin: Number(e.target.value) }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                />
                <span className="text-xs font-semibold text-blue-600">XP</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Darsni yakunlash
              </label>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={xpRewards.lesson_completed}
                  onChange={(e) =>
                    setXpRewards((p) => ({ ...p, lesson_completed: Number(e.target.value) }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                />
                <span className="text-xs font-semibold text-blue-600">XP</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Amaliy mashq
              </label>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={xpRewards.practice_completed}
                  onChange={(e) =>
                    setXpRewards((p) => ({ ...p, practice_completed: Number(e.target.value) }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                />
                <span className="text-xs font-semibold text-blue-600">XP</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Test topshirish
              </label>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={xpRewards.assessment_completed}
                  onChange={(e) =>
                    setXpRewards((p) => ({ ...p, assessment_completed: Number(e.target.value) }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                />
                <span className="text-xs font-semibold text-blue-600">XP</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Haftalik maqsad
              </label>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={xpRewards.weekly_goal_completed}
                  onChange={(e) =>
                    setXpRewards((p) => ({ ...p, weekly_goal_completed: Number(e.target.value) }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                />
                <span className="text-xs font-semibold text-blue-600">XP</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                O'quv marrasi (BSB/CHSB)
              </label>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={xpRewards.curriculum_milestone_completed}
                  onChange={(e) =>
                    setXpRewards((p) => ({
                      ...p,
                      curriculum_milestone_completed: Number(e.target.value),
                    }))
                  }
                  className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                />
                <span className="text-xs font-semibold text-blue-600">XP</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Kunlik maksimal XP chegarasi (Anti-spam)
              </label>
              <input
                type="number"
                min={20}
                max={1000}
                value={dailyXpCap}
                onChange={(e) => setDailyXpCap(Number(e.target.value))}
                className="mt-1.5 w-full h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Streak imtiyozli tanaffus kunlari (Grace days)
              </label>
              <input
                type="number"
                min={0}
                max={5}
                value={streakGraceDays}
                onChange={(e) => setStreakGraceDays(Number(e.target.value))}
                className="mt-1.5 w-full h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableDailyCheckin}
                  onChange={(e) => setEnableDailyCheckin(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Kunlik maqsad (Check-in)</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableBadges}
                  onChange={(e) => setEnableBadges(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Yutuq nishonlari (Badges)</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableStreaks}
                  onChange={(e) => setEnableStreaks(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Izchillik (Streak)</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableClassChallenges}
                  onChange={(e) => setEnableClassChallenges(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Jamoaviy sinf maqsadlari</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableWeeklyRecap}
                  onChange={(e) => setEnableWeeklyRecap(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Haftalik natija (Weekly Recap)</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Sozlamalarni saqlash</span>
            </button>
          </div>
        </form>
      </div>

      {/* Badges Overview */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-blue-600" />
          <span>Rasmiy Yutuq Nishonlari (Badges)</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {gamificationBadges.map((b) => (
            <div
              key={b.id}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 flex items-start gap-3"
            >
              <GamificationBadgeSvg code={b.code} earned={b.isActive} size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 dark:text-white">{b.title}</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {b.description}
                </p>
                <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-1">
                  Mezon: {b.thresholdValue} ta faoliyat
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cooperative Class Challenges Management */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Jamoaviy Sinf Maqsadlari (Cooperative Class Challenges)</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            O'quvchilarni bir-biri bilan raqobat qildirmasdan, sinf bo'lib umumiy marraga erishishga undovchi jamoaviy maqsadlar.
          </p>
        </div>

        <form onSubmit={handleCreateChallenge} className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
          <select
            value={challengeClass}
            onChange={(e) => setChallengeClass(e.target.value)}
            className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
          >
            {OFFICIAL_19_CLASS_CODES.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()} sinf
              </option>
            ))}
          </select>

          <input
            type="text"
            value={challengeTitle}
            onChange={(e) => setChallengeTitle(e.target.value)}
            placeholder="Masalan: Bu hafta sinf bo'lib 30 ta darsni yakunlaymiz"
            className="sm:col-span-2 h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
          />

          <input
            type="number"
            min={5}
            max={500}
            value={challengeTarget}
            onChange={(e) => setChallengeTarget(Number(e.target.value))}
            className="h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
          />

          <button
            type="submit"
            className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>E'lon qilish</span>
          </button>
        </form>

        {classChallenges.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {classChallenges.map((ch) => {
              const pct = Math.min(100, Math.round((ch.currentCount / Math.max(1, ch.targetCount)) * 100));
              return (
                <div
                  key={ch.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[11px] font-bold uppercase">
                        {ch.classCode} sinf
                      </span>
                      <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                        {ch.title}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateClassChallenge(ch.id, { isActive: !ch.isActive })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                        ch.isActive
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {ch.isActive ? 'Faol' : 'To‘xtatilgan'}
                    </button>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                      <span>
                        Jamoaviy natija: {ch.currentCount} / {ch.targetCount}
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
