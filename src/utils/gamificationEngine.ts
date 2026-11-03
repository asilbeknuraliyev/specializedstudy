import {
  Assessment,
  AssessmentAttempt as Submission,
  BadgeCode,
  ClassChallenge,
  GamificationActivityType,
  GamificationBadgeDefinition,
  GamificationConfig,
  GamificationLevelDefinition,
  LearningActivityEvent,
  LearningCheckin,
  LearningJourneyMilestone,
  LessonItem as Lesson,
  Roadmap2LessonBadgeLabel,
  Roadmap2StudentLessonState,
  RoadmapPlanOverviewStats,
  SmartLearningRecommendation,
  StreakRecord,
  StudentBadgeRecord,
  StudentGamificationProfile,
  StudentGoal,
  StudentLessonCompletion,
  WeeklyRecapRecord,
  XpLedgerEntry,
} from '../types';

export const GAMIFICATION_LEVELS: GamificationLevelDefinition[] = [
  { level: 1, title: 'Boshlovchi', minXp: 0, maxXp: 50, description: "O'quv sayohatining ilk qadami" },
  { level: 2, title: 'Izlanuvchi', minXp: 50, maxXp: 150, description: 'Muntazam bilim izlovchi' },
  { level: 3, title: "O'rganuvchi", minXp: 150, maxXp: 300, description: 'Mavzularni faol o‘zlashtiruvchi' },
  { level: 4, title: 'Bilimdon', minXp: 300, maxXp: 550, description: 'Chuqur tushunchaga ega o‘quvchi' },
  { level: 5, title: 'Tadqiqotchi', minXp: 550, maxXp: 900, description: 'Murakkab masalalarni yechuvchi' },
  { level: 6, title: 'Mutaxassis', minXp: 900, maxXp: 1400, description: 'Fanlar bo‘yicha yuqori mahorat egasi' },
  { level: 7, title: 'Ekspert', minXp: 1400, maxXp: null, description: 'Specialized Study akademik yetakchisi' },
];

export const DEFAULT_GAMIFICATION_BADGES: GamificationBadgeDefinition[] = [
  {
    id: 'badge_birinchi_qadam',
    code: 'BIRINCHI_QADAM',
    title: 'BIRINCHI QADAM',
    description: 'Birinchi dars muvaffaqiyatli yakunlandi.',
    category: 'milestone',
    thresholdValue: 1,
    xpBonus: 0,
    iconKey: 'BIRINCHI_QADAM',
    isActive: true,
  },
  {
    id: 'badge_faol_oquvchi',
    code: 'FAOL_OQUVCHI',
    title: "FAOL O'QUVCHI",
    description: '5 ta tasdiqlangan dars muvaffaqiyatli yakunlandi.',
    category: 'milestone',
    thresholdValue: 5,
    xpBonus: 0,
    iconKey: 'FAOL_OQUVCHI',
    isActive: true,
  },
  {
    id: 'badge_matematika_ixlosmandi',
    code: 'MATEMATIKA_IXLOSMANDI',
    title: 'MATEMATIKA IXLOSMANDI',
    description: "Matematika fanidan 10 ta o'quv faoliyati bajarildi.",
    category: 'subject',
    thresholdValue: 10,
    xpBonus: 0,
    iconKey: 'MATEMATIKA_IXLOSMANDI',
    isActive: true,
  },
  {
    id: 'badge_izchillik',
    code: 'IZCHILLIK',
    title: 'IZCHILLIK',
    description: "3 ta alohida kunda o'quv faoliyati davom ettirildi.",
    category: 'consistency',
    thresholdValue: 3,
    xpBonus: 0,
    iconKey: 'IZCHILLIK',
    isActive: true,
  },
  {
    id: 'badge_bilim_izlovchisi',
    code: 'BILIM_IZLOVCHISI',
    title: 'BILIM IZLOVCHISI',
    description: "Turli o'quv mavzulari va fan yo'nalishlari o'rganildi.",
    category: 'milestone',
    thresholdValue: 3,
    xpBonus: 0,
    iconKey: 'BILIM_IZLOVCHISI',
    isActive: true,
  },
  {
    id: 'badge_birinchi_test',
    code: 'BIRINCHI_TEST',
    title: 'BIRINCHI TEST',
    description: 'Birinchi nazorat ishi yoki test muvaffaqiyatli topshirildi.',
    category: 'assessment',
    thresholdValue: 1,
    xpBonus: 0,
    iconKey: 'BIRINCHI_TEST',
    isActive: true,
  },
  {
    id: 'badge_mashgulot_ustasi',
    code: 'MASHGULOT_USTASI',
    title: "MASHG'ULOT USTASI",
    description: "Haftalik shaxsiy o'quv maqsadi to'liq bajarildi.",
    category: 'goal',
    thresholdValue: 1,
    xpBonus: 0,
    iconKey: 'MASHGULOT_USTASI',
    isActive: true,
  },
];

export const DEFAULT_GAMIFICATION_CONFIG: GamificationConfig = {
  id: 'default',
  enabled: true,
  xpRewards: {
    daily_checkin: 5,
    lesson_completed: 10,
    practice_completed: 5,
    assessment_completed: 15,
    weekly_goal_completed: 20,
    curriculum_milestone_completed: 25,
  },
  dailyXpCap: 150,
  streakGraceDays: 1,
  enableDailyCheckin: true,
  enableBadges: true,
  enableStreaks: true,
  enableClassChallenges: true,
  enableWeeklyRecap: true,
  goalTemplates: [
    "1 ta darsni o'rganish",
    '10 ta mashq bajarish',
    '1 ta test ishlash',
    'Oldingi mavzuni takrorlash',
  ],
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export function getTashkentDateString(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function getIsoWeekKey(dateStr: string): { weekKey: string; weekStartDate: string; weekEndDate: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
  const dayNum = dt.getUTCDay() || 7; // 1 (Mon) .. 7 (Sun)
  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() - dayNum + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const weekKey = `${thursday.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  return {
    weekKey,
    weekStartDate: monday.toISOString().slice(0, 10),
    weekEndDate: sunday.toISOString().slice(0, 10),
  };
}

export function calculateStudentLevel(totalXp: number): {
  currentLevel: GamificationLevelDefinition['level'];
  currentLevelTitle: GamificationLevelDefinition['title'];
  nextLevelXp: number | null;
  levelProgressPercent: number;
} {
  const safeXp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let matched = GAMIFICATION_LEVELS[0];
  for (const lvl of GAMIFICATION_LEVELS) {
    if (safeXp >= lvl.minXp) {
      matched = lvl;
    }
  }
  if (matched.maxXp === null) {
    return {
      currentLevel: matched.level,
      currentLevelTitle: matched.title,
      nextLevelXp: null,
      levelProgressPercent: 100,
    };
  }
  const span = Math.max(1, matched.maxXp - matched.minXp);
  const earnedInBand = Math.max(0, safeXp - matched.minXp);
  const percent = Math.min(100, Math.round((earnedInBand / span) * 100));
  return {
    currentLevel: matched.level,
    currentLevelTitle: matched.title,
    nextLevelXp: matched.maxXp,
    levelProgressPercent: percent,
  };
}

export function createInitialGamificationProfile(studentId: string, nowIso: string = new Date().toISOString()): StudentGamificationProfile {
  const lvl = calculateStudentLevel(0);
  return {
    id: studentId,
    studentId,
    totalXp: 0,
    currentLevel: lvl.currentLevel,
    currentLevelTitle: lvl.currentLevelTitle,
    nextLevelXp: lvl.nextLevelXp,
    levelProgressPercent: lvl.levelProgressPercent,
    completedLessonsCount: 0,
    completedPracticeCount: 0,
    completedAssessmentsCount: 0,
    completedGoalsCount: 0,
    completedMilestonesCount: 0,
    mathActivitiesCount: 0,
    exploredSubjects: [],
    exploredTopics: [],
    avatarIcon: 'compass',
    streakRemindersEnabled: true,
    notificationsEnabled: true,
    updatedAt: nowIso,
  };
}

export function createInitialStreakRecord(
  studentId: string,
  graceDaysAllowed: number = 1,
  nowIso: string = new Date().toISOString()
): StreakRecord {
  return {
    id: studentId,
    studentId,
    currentStreakDays: 0,
    longestStreakDays: 0,
    activeDates: [],
    lastActiveDate: null,
    graceDaysAllowed,
    graceDaysUsedInCurrentStreak: 0,
    statusMessage: "Yana davom ettirish vaqti! Bugungi ilk mashg'ulotni boshlang.",
    updatedAt: nowIso,
  };
}

function diffDaysBetweenDateKeys(earlierDateKey: string, laterDateKey: string): number {
  const [y1, m1, d1] = earlierDateKey.split('-').map(Number);
  const [y2, m2, d2] = laterDateKey.split('-').map(Number);
  const t1 = Date.UTC(y1, (m1 || 1) - 1, d1 || 1);
  const t2 = Date.UTC(y2, (m2 || 1) - 1, d2 || 1);
  return Math.round((t2 - t1) / 86400000);
}

/**
 * Healthy streak computation:
 * - Tracks consecutive or grace-bridged active days (`1 kun`, `2 kun`, etc.).
 * - Never subtracts XP or punishes missed days.
 * - Uses supportive messaging ("Yana davom ettirish vaqti!") after longer breaks.
 */
export function computeHealthyStreak(
  existing: StreakRecord | undefined,
  studentId: string,
  activityDateKey: string,
  graceDaysAllowed: number = 1,
  nowIso: string = new Date().toISOString()
): StreakRecord {
  const base = existing
    ? {
        ...existing,
        activeDates: Array.from(new Set(existing.activeDates || [])).sort(),
        graceDaysAllowed,
      }
    : createInitialStreakRecord(studentId, graceDaysAllowed, nowIso);

  if (!activityDateKey || !/^\d{4}-\d{2}-\d{2}$/.test(activityDateKey)) {
    return base;
  }

  if (base.activeDates.includes(activityDateKey)) {
    return {
      ...base,
      statusMessage: `${base.currentStreakDays} kun faol o'qish davom etmoqda!`,
      updatedAt: nowIso,
    };
  }

  const allDates = Array.from(new Set([...base.activeDates, activityDateKey])).sort();
  let currentStreak = 1;
  let longestStreak = Math.max(1, base.longestStreakDays || 0);
  let graceUsed = 0;

  for (let i = 1; i < allDates.length; i++) {
    const gap = diffDaysBetweenDateKeys(allDates[i - 1], allDates[i]);
    if (gap === 1) {
      currentStreak += 1;
    } else if (gap > 1 && gap - 1 <= graceDaysAllowed) {
      currentStreak += 1;
      graceUsed += gap - 1;
    } else if (gap > 1) {
      currentStreak = 1;
      graceUsed = 0;
    }
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
  }

  const lastPrev = base.lastActiveDate;
  const gapFromLast = lastPrev ? diffDaysBetweenDateKeys(lastPrev, activityDateKey) : 0;
  const statusMessage =
    lastPrev && gapFromLast > graceDaysAllowed + 1
      ? `Yana davom ettirish vaqti! Yangi ${currentStreak} kunlik ritm boshlandi.`
      : `${currentStreak} kun izchil o'rganish davom etmoqda!`;

  return {
    id: studentId,
    studentId,
    currentStreakDays: currentStreak,
    longestStreakDays: longestStreak,
    activeDates: allDates,
    lastActiveDate: allDates[allDates.length - 1] || activityDateKey,
    graceDaysAllowed,
    graceDaysUsedInCurrentStreak: graceUsed,
    statusMessage,
    updatedAt: nowIso,
  };
}

export function isMathSubjectOrArea(subject?: string, curriculumArea?: string): boolean {
  const s = `${subject || ''} ${curriculumArea || ''}`.toLowerCase();
  return s.includes('matematika') || s.includes('algebra') || s.includes('geometriya');
}

export interface ProcessVerifiedEventInput {
  studentId: string;
  classCode: string;
  activityType: GamificationActivityType;
  idempotencyKey: string;
  reason: string;
  subject?: string;
  curriculumArea?: string;
  topicId?: string;
  lessonId?: string;
  assessmentId?: string;
  goalId?: string;
  quarter?: 1 | 2 | 3 | 4;
  occurredAt?: string;
  dateKey?: string;
  config?: GamificationConfig;
  badgeDefinitions?: GamificationBadgeDefinition[];
  existingProfile?: StudentGamificationProfile;
  existingEvents: LearningActivityEvent[];
  existingLedger: XpLedgerEntry[];
  existingStudentBadges: StudentBadgeRecord[];
  existingStreak?: StreakRecord;
  existingChallenges?: ClassChallenge[];
}

export interface ProcessVerifiedEventResult {
  duplicate: boolean;
  xpAwarded: number;
  leveledUp: boolean;
  previousLevel: number;
  newLevel: number;
  profile: StudentGamificationProfile;
  event?: LearningActivityEvent;
  ledgerEntry?: XpLedgerEntry;
  newlyEarnedBadges: StudentBadgeRecord[];
  streak: StreakRecord;
  updatedChallenges: ClassChallenge[];
}

/**
 * Server-authoritative XP & Badge processor.
 * Enforces idempotency via unique `idempotencyKey`, daily XP cap protection,
 * progressive level calculation, badge threshold evaluation, and cooperative class challenge updates.
 */
export function processVerifiedLearningEvent(input: ProcessVerifiedEventInput): ProcessVerifiedEventResult {
  const nowIso = input.occurredAt || new Date().toISOString();
  const dateKey = input.dateKey || getTashkentDateString(new Date(nowIso));
  const config = input.config || DEFAULT_GAMIFICATION_CONFIG;
  const badgeDefs = input.badgeDefinitions || DEFAULT_GAMIFICATION_BADGES;

  const baseProfile = input.existingProfile
    ? {
        ...input.existingProfile,
        exploredSubjects: [...(input.existingProfile.exploredSubjects || [])],
        exploredTopics: [...(input.existingProfile.exploredTopics || [])],
      }
    : createInitialGamificationProfile(input.studentId, nowIso);

  const baseStreak =
    input.existingStreak ||
    createInitialStreakRecord(input.studentId, config.streakGraceDays, nowIso);

  // Check idempotency across existing events and ledger
  const alreadyProcessed =
    input.existingEvents.some(
      (e) => e.studentId === input.studentId && e.idempotencyKey === input.idempotencyKey
    ) ||
    input.existingLedger.some(
      (l) => l.studentId === input.studentId && l.idempotencyKey === input.idempotencyKey
    );

  if (alreadyProcessed || !config.enabled) {
    return {
      duplicate: true,
      xpAwarded: 0,
      leveledUp: false,
      previousLevel: baseProfile.currentLevel,
      newLevel: baseProfile.currentLevel,
      profile: baseProfile,
      newlyEarnedBadges: [],
      streak: baseStreak,
      updatedChallenges: input.existingChallenges || [],
    };
  }

  // Compute daily XP earned so far on this dateKey for daily cap protection
  const xpEarnedToday = input.existingLedger
    .filter((l) => l.studentId === input.studentId && l.dateKey === dateKey && l.xpDelta > 0)
    .reduce((sum, l) => sum + l.xpDelta, 0);

  const configuredReward = Math.max(0, Number(config.xpRewards[input.activityType] ?? 0));
  const remainingDailyAllowance = Math.max(0, (config.dailyXpCap || 150) - xpEarnedToday);
  const xpAwarded = Math.min(configuredReward, remainingDailyAllowance);

  const eventId = `evt_${input.studentId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const event: LearningActivityEvent = {
    id: eventId,
    idempotencyKey: input.idempotencyKey,
    studentId: input.studentId,
    classCode: input.classCode,
    activityType: input.activityType,
    subject: input.subject,
    curriculumArea: input.curriculumArea,
    topicId: input.topicId,
    lessonId: input.lessonId,
    assessmentId: input.assessmentId,
    goalId: input.goalId,
    quarter: input.quarter,
    xpAwarded,
    occurredAt: nowIso,
    dateKey,
  };

  const previousLevel = baseProfile.currentLevel;
  const newTotalXp = baseProfile.totalXp + xpAwarded;
  const lvlInfo = calculateStudentLevel(newTotalXp);

  // Update counters
  if (input.activityType === 'lesson_completed') {
    baseProfile.completedLessonsCount += 1;
  } else if (input.activityType === 'practice_completed') {
    baseProfile.completedPracticeCount += 1;
  } else if (input.activityType === 'assessment_completed') {
    baseProfile.completedAssessmentsCount += 1;
  } else if (input.activityType === 'weekly_goal_completed') {
    baseProfile.completedGoalsCount += 1;
  } else if (input.activityType === 'curriculum_milestone_completed') {
    baseProfile.completedMilestonesCount += 1;
  }

  if (
    input.activityType !== 'daily_checkin' &&
    isMathSubjectOrArea(input.subject, input.curriculumArea)
  ) {
    baseProfile.mathActivitiesCount += 1;
  }

  if (input.subject && !baseProfile.exploredSubjects.includes(input.subject)) {
    baseProfile.exploredSubjects.push(input.subject);
  }
  const topicKey = input.topicId || input.lessonId;
  if (topicKey && !baseProfile.exploredTopics.includes(topicKey)) {
    baseProfile.exploredTopics.push(topicKey);
  }

  baseProfile.totalXp = newTotalXp;
  baseProfile.currentLevel = lvlInfo.currentLevel;
  baseProfile.currentLevelTitle = lvlInfo.currentLevelTitle;
  baseProfile.nextLevelXp = lvlInfo.nextLevelXp;
  baseProfile.levelProgressPercent = lvlInfo.levelProgressPercent;
  baseProfile.updatedAt = nowIso;

  const ledgerEntry: XpLedgerEntry = {
    id: `xpl_${eventId}`,
    idempotencyKey: input.idempotencyKey,
    studentId: input.studentId,
    eventId,
    activityType: input.activityType,
    xpDelta: xpAwarded,
    balanceAfter: newTotalXp,
    reason: input.reason,
    referenceId: input.lessonId || input.assessmentId || input.goalId,
    createdAt: nowIso,
    dateKey,
  };

  // Update healthy streak
  const updatedStreak = config.enableStreaks
    ? computeHealthyStreak(
        baseStreak,
        input.studentId,
        dateKey,
        config.streakGraceDays,
        nowIso
      )
    : baseStreak;

  // Evaluate badges
  const newlyEarnedBadges: StudentBadgeRecord[] = [];
  if (config.enableBadges) {
    const ownedCodes = new Set(
      input.existingStudentBadges
        .filter((b) => b.studentId === input.studentId)
        .map((b) => b.badgeCode)
    );

    const activeDaysCount = updatedStreak.activeDates.length;
    const distinctTopicsOrAreasCount = baseProfile.exploredTopics.length;

    for (const def of badgeDefs) {
      if (!def.isActive || ownedCodes.has(def.code)) continue;
      let qualifies = false;
      switch (def.code) {
        case 'BIRINCHI_QADAM':
          qualifies = baseProfile.completedLessonsCount >= def.thresholdValue;
          break;
        case 'FAOL_OQUVCHI':
          qualifies = baseProfile.completedLessonsCount >= def.thresholdValue;
          break;
        case 'MATEMATIKA_IXLOSMANDI':
          qualifies = baseProfile.mathActivitiesCount >= def.thresholdValue;
          break;
        case 'IZCHILLIK':
          qualifies = activeDaysCount >= def.thresholdValue;
          break;
        case 'BILIM_IZLOVCHISI':
          qualifies =
            distinctTopicsOrAreasCount >= def.thresholdValue ||
            baseProfile.exploredSubjects.length >= 2;
          break;
        case 'BIRINCHI_TEST':
          qualifies = baseProfile.completedAssessmentsCount >= def.thresholdValue;
          break;
        case 'MASHGULOT_USTASI':
          qualifies = baseProfile.completedGoalsCount >= def.thresholdValue;
          break;
      }

      if (qualifies) {
        ownedCodes.add(def.code);
        newlyEarnedBadges.push({
          id: `sbadge_${input.studentId}_${def.code}`,
          studentId: input.studentId,
          badgeId: def.id,
          badgeCode: def.code,
          title: def.title,
          description: def.description,
          earnedAt: nowIso,
          triggerEventId: eventId,
        });
      }
    }
  }

  // Update cooperative class challenges (if active for student's class)
  const updatedChallenges = (input.existingChallenges || []).map((challenge) => {
    if (!challenge.isActive || challenge.classCode !== input.classCode) {
      return challenge;
    }
    const matchesType =
      (challenge.targetType === 'lessons' && input.activityType === 'lesson_completed') ||
      (challenge.targetType === 'assessments' && input.activityType === 'assessment_completed') ||
      (challenge.targetType === 'checkins' && input.activityType === 'daily_checkin') ||
      challenge.targetType === 'activities';

    if (!matchesType) return challenge;
    if (challenge.subject && input.subject && challenge.subject !== input.subject) {
      return challenge;
    }

    const contributors = challenge.contributorStudentIds.includes(input.studentId)
      ? challenge.contributorStudentIds
      : [...challenge.contributorStudentIds, input.studentId];

    return {
      ...challenge,
      currentCount: Math.min(challenge.targetCount, challenge.currentCount + 1),
      contributorStudentIds: contributors,
      updatedAt: nowIso,
    };
  });

  return {
    duplicate: false,
    xpAwarded,
    leveledUp: baseProfile.currentLevel > previousLevel,
    previousLevel,
    newLevel: baseProfile.currentLevel,
    profile: baseProfile,
    event,
    ledgerEntry,
    newlyEarnedBadges,
    streak: updatedStreak,
    updatedChallenges,
  };
}

/**
 * Classifies a curriculum lesson into one of the 8 subtle Roadmap 2.0 badge labels:
 * Oddiy dars, Yozma ish, BSB, CHSB, BSB tahlili, CHSB tahlili, Loyiha ishi, Takrorlash
 */
export function classifyRoadmap2LessonBadge(
  lesson: Partial<Pick<Lesson, 'title' | 'topicTitle' | 'lessonType' | 'assessmentType' | 'milestoneType' | 'eventCategory'>>
): Roadmap2LessonBadgeLabel {
  const lt = (lesson.lessonType || '').toLowerCase();
  const at = (lesson.assessmentType || lesson.milestoneType || '').toLowerCase();
  const ec = (lesson.eventCategory || '').toLowerCase();
  const titleLower = `${lesson.topicTitle || ''} ${lesson.title || ''}`.toLowerCase();

  if (
    lt === 'bsb_analysis' ||
    (titleLower.includes('bsb') && (titleLower.includes('tahlil') || titleLower.includes('xato')))
  ) {
    return 'BSB tahlili';
  }
  if (
    lt === 'chsb_analysis' ||
    (titleLower.includes('chsb') && (titleLower.includes('tahlil') || titleLower.includes('xato')))
  ) {
    return 'CHSB tahlili';
  }
  if (
    lt === 'bsb' ||
    at === 'bsb' ||
    /\bbsb\b/i.test(titleLower) ||
    lt.includes('yozma ish-41')
  ) {
    return 'BSB';
  }
  if (
    lt === 'chsb' ||
    at === 'chsb' ||
    ec === 'quarterly_assessment' ||
    /\bchsb\b/i.test(titleLower) ||
    lt.includes('choraklik-39')
  ) {
    return 'CHSB';
  }
  if (
    lt === 'written_exam' ||
    at === 'written_work' ||
    ec === 'written_assessment' ||
    titleLower.includes('nazorat ishi') ||
    titleLower.includes('yozma ish') ||
    lt.includes('yozma ish')
  ) {
    return 'Yozma ish';
  }
  if (
    lt === 'project' ||
    at === 'project' ||
    ec === 'project_work' ||
    titleLower.includes('loyiha ishi') ||
    lt.includes('loyiha ishi')
  ) {
    return 'Loyiha ishi';
  }
  if (
    lt === 'revision' ||
    ec === 'review_and_analysis' ||
    titleLower.includes('takrorlash') ||
    titleLower.includes('xatolar ustida ishlash')
  ) {
    return 'Takrorlash';
  }
  return 'Oddiy dars';
}

/**
 * Determines the true student learning state for a Roadmap 2.0 lesson.
 * NEVER marks a lesson as Completed merely because it exists in the curriculum or is published.
 */
export function getStudentLessonRoadmapState(
  lesson: Pick<Lesson, 'id' | 'status'>,
  studentCompletions: StudentLessonCompletion[],
  studentId?: string
): Roadmap2StudentLessonState {
  if (studentId) {
    const completed = studentCompletions.some(
      (c) => c.studentId === studentId && c.lessonId === lesson.id && c.status === 'completed'
    );
    if (completed) {
      return 'Completed';
    }
  }
  if (lesson.status === 'published') {
    return 'Published';
  }
  return 'Planned';
}

export function computeRoadmapPlanOverview(
  lessons: Lesson[],
  studentCompletions: StudentLessonCompletion[] = [],
  studentId?: string
): RoadmapPlanOverviewStats {
  const activeLessons = lessons.filter((l) => l.status !== 'archived');
  let ordinaryLessons = 0;
  let assessmentMilestones = 0;
  let projectActivities = 0;
  let revisionLessons = 0;
  let publishedLessons = 0;
  let completedLessons = 0;
  let totalHours = 0;

  for (const lesson of activeLessons) {
    const badge = classifyRoadmap2LessonBadge(lesson);
    if (badge === 'BSB' || badge === 'CHSB' || badge === 'Yozma ish') {
      assessmentMilestones += 1;
    } else if (badge === 'Loyiha ishi') {
      projectActivities += 1;
    } else if (badge === 'Takrorlash' || badge === 'BSB tahlili' || badge === 'CHSB tahlili') {
      revisionLessons += 1;
    } else {
      ordinaryLessons += 1;
    }

    if (lesson.status === 'published') {
      publishedLessons += 1;
    }

    const st = getStudentLessonRoadmapState(lesson, studentCompletions, studentId);
    if (st === 'Completed') {
      completedLessons += 1;
    }

    totalHours += Number(lesson.hours) || 1;
  }

  return {
    totalLessons: activeLessons.length,
    ordinaryLessons,
    assessmentMilestones,
    projectActivities,
    revisionLessons,
    publishedLessons,
    completedLessons,
    totalHours,
  };
}

export function buildStudentLearningJourney(params: {
  studentId: string;
  profile: StudentGamificationProfile;
  completions: StudentLessonCompletion[];
  submissions: Submission[];
  lessons: Lesson[];
}): LearningJourneyMilestone[] {
  const { studentId, profile, completions, submissions, lessons } = params;
  const studentCompletions = completions
    .filter((c) => c.studentId === studentId && c.status === 'completed')
    .sort((a, b) => (a.completedAt || a.updatedAt).localeCompare(b.completedAt || b.updatedAt));

  const studentSubmissions = submissions
    .filter((s) => s.studentId === studentId)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));

  const firstLesson = studentCompletions[0];
  const fifthLesson = studentCompletions[4];
  const firstAssessment = studentSubmissions[0];

  // Check if any quarter of any subject/workPlan has all published lessons completed (or >= 10 lessons in a quarter)
  const quarterCounts = new Map<string, number>();
  for (const c of studentCompletions) {
    const k = `${c.subject}_${c.curriculumArea || 'general'}_q${c.quarter}`;
    quarterCounts.set(k, (quarterCounts.get(k) || 0) + 1);
  }
  let unitCompleted = false;
  for (const [k, count] of quarterCounts.entries()) {
    const [subj, area, qStr] = k.split('_');
    const qNum = Number((qStr || '').replace('q', ''));
    const matchingPlanLessons = lessons.filter(
      (l) =>
        l.status !== 'archived' &&
        l.subject === subj &&
        (area === 'general' || l.curriculumArea === area) &&
        l.quarter === qNum
    );
    if (
      (matchingPlanLessons.length > 0 && count >= matchingPlanLessons.length) ||
      count >= 10
    ) {
      unitCompleted = true;
      break;
    }
  }

  return [
    {
      id: 'ms_first_lesson',
      key: 'first_lesson',
      title: 'Birinchi dars',
      subtitle: "Ilk mavzuni o'rganib yakunlash",
      reached: studentCompletions.length >= 1,
      reachedAt: firstLesson?.completedAt,
      progressText: `${Math.min(1, studentCompletions.length)} / 1 dars`,
    },
    {
      id: 'ms_first_topic',
      key: 'first_completed_topic',
      title: 'Birinchi yakunlangan mavzu',
      subtitle: "Mavzu bo'yicha dars va mashqni bajarish",
      reached:
        studentCompletions.some((c) => c.practiceCompleted) ||
        profile.completedPracticeCount >= 1 ||
        studentCompletions.length >= 2,
      reachedAt: firstLesson?.completedAt,
      progressText:
        profile.completedPracticeCount >= 1 || studentCompletions.length >= 2
          ? 'Bajarildi'
          : 'Jarayonda',
    },
    {
      id: 'ms_first_assessment',
      key: 'first_assessment',
      title: 'Birinchi test sinovi',
      subtitle: 'Bilimni nazorat testi orqali tekshirish',
      reached: studentSubmissions.length >= 1 || profile.completedAssessmentsCount >= 1,
      reachedAt: firstAssessment?.submittedAt,
      progressText: `${Math.min(1, Math.max(studentSubmissions.length, profile.completedAssessmentsCount))} / 1 test`,
    },
    {
      id: 'ms_five_lessons',
      key: 'five_completed_lessons',
      title: '5 ta yakunlangan dars',
      subtitle: "Muntazam o'rganish ritmini shakllantirish",
      reached: studentCompletions.length >= 5,
      reachedAt: fifthLesson?.completedAt,
      progressText: `${Math.min(5, studentCompletions.length)} / 5 dars`,
    },
    {
      id: 'ms_new_subject',
      key: 'new_subject_explored',
      title: "Yangi fan yo'nalishi",
      subtitle: "Ikki yoki undan ortiq o'quv yo'nalishini o'rganish",
      reached: profile.exploredSubjects.length >= 2 || profile.exploredTopics.length >= 3,
      progressText: `${profile.exploredSubjects.length} ta fan / ${profile.exploredTopics.length} ta mavzu`,
    },
    {
      id: 'ms_unit_completed',
      key: 'curriculum_unit_completed',
      title: "O'quv bo'limi yakuni",
      subtitle: "Chorak yoki o'quv bo'limi marralarini yakunlash",
      reached: unitCompleted || profile.completedMilestonesCount >= 1,
      progressText: unitCompleted || profile.completedMilestonesCount >= 1 ? 'Yakunlandi' : 'Davom etmoqda',
    },
  ];
}

export function buildWeeklyLearningRecap(params: {
  studentId: string;
  dateKey?: string;
  events: LearningActivityEvent[];
  studentBadges: StudentBadgeRecord[];
  lessons: Lesson[];
  classCode: string;
  completions: StudentLessonCompletion[];
}): WeeklyRecapRecord {
  const todayKey = params.dateKey || getTashkentDateString();
  const { weekKey, weekStartDate, weekEndDate } = getIsoWeekKey(todayKey);

  const weekEvents = params.events.filter(
    (e) =>
      e.studentId === params.studentId &&
      e.dateKey >= weekStartDate &&
      e.dateKey <= weekEndDate
  );

  const completedLessonsCount = weekEvents.filter((e) => e.activityType === 'lesson_completed').length;
  const completedTestsCount = weekEvents.filter((e) => e.activityType === 'assessment_completed').length;
  const xpEarned = weekEvents.reduce((sum, e) => sum + (e.xpAwarded || 0), 0);

  const subjectsStudied = Array.from(
    new Set(weekEvents.map((e) => e.subject).filter((s): s is string => Boolean(s)))
  );

  const lessonTitleMap = new Map(params.lessons.map((l) => [l.id, l.title]));
  const topicsPracticed = Array.from(
    new Set(
      weekEvents
        .map((e) => (e.lessonId ? lessonTitleMap.get(e.lessonId) : undefined))
        .filter((t): t is string => Boolean(t))
    )
  ).slice(0, 6);

  const newBadges = params.studentBadges
    .filter((b) => {
      const earnedDate = (b.earnedAt || '').slice(0, 10);
      return (
        b.studentId === params.studentId &&
        earnedDate >= weekStartDate &&
        earnedDate <= weekEndDate
      );
    })
    .map((b) => b.badgeCode);

  const completedIds = new Set(
    params.completions
      .filter((c) => c.studentId === params.studentId && c.status === 'completed')
      .map((c) => c.lessonId)
  );

  const nextClassLesson = params.lessons
    .filter(
      (l) =>
        l.status === 'published' &&
        (l.classCode === params.classCode || l.classId === `class_${params.classCode}`) &&
        !completedIds.has(l.id)
    )
    .sort(
      (a, b) =>
        (a.quarter || 1) - (b.quarter || 1) ||
        (a.lessonNumber || a.orderIndex || 0) - (b.lessonNumber || b.orderIndex || 0)
    )[0];

  const recommendedNextFocus = nextClassLesson
    ? `${nextClassLesson.subject}${nextClassLesson.curriculumArea ? ` (${nextClassLesson.curriculumArea})` : ''}: ${nextClassLesson.lessonNumber}-dars — ${nextClassLesson.title}`
    : "O'quv xaritasi bo'yicha navbatdagi mavzuni tanlang";

  return {
    id: `${params.studentId}_${weekKey}`,
    studentId: params.studentId,
    weekKey,
    weekStartDate,
    weekEndDate,
    completedLessonsCount,
    completedTestsCount,
    subjectsStudied,
    xpEarned,
    newBadges,
    topicsPracticed,
    recommendedNextFocus,
    generatedAt: new Date().toISOString(),
  };
}

export function buildSmartNextSteps(params: {
  studentId: string;
  classCode: string;
  lessons: Lesson[];
  assessments: Assessment[];
  completions: StudentLessonCompletion[];
  submissions: Submission[];
}): SmartLearningRecommendation[] {
  const { studentId, classCode, lessons, assessments, completions, submissions } = params;
  const recommendations: SmartLearningRecommendation[] = [];

  const completedLessonIds = new Set(
    completions
      .filter((c) => c.studentId === studentId && c.status === 'completed')
      .map((c) => c.lessonId)
  );

  const unpracticedCompletion = completions.find(
    (c) => c.studentId === studentId && c.status === 'completed' && !c.practiceCompleted
  );

  const classLessons = lessons
    .filter(
      (l) =>
        l.status !== 'archived' &&
        (l.classCode === classCode || l.classId === `class_${classCode}`)
    )
    .sort(
      (a, b) =>
        (a.quarter || 1) - (b.quarter || 1) ||
        (a.lessonNumber || a.orderIndex || 0) - (b.lessonNumber || b.orderIndex || 0)
    );

  const publishedUncompleted = classLessons.filter(
    (l) => l.status === 'published' && !completedLessonIds.has(l.id)
  );
  const nextSeqLesson = publishedUncompleted[0] || classLessons.find((l) => !completedLessonIds.has(l.id));

  if (nextSeqLesson) {
    const areaSuffix = nextSeqLesson.curriculumArea ? ` (${nextSeqLesson.curriculumArea})` : '';
    recommendations.push({
      id: `rec_next_${nextSeqLesson.id}`,
      type: 'next_lesson',
      title: `${nextSeqLesson.lessonNumber}-dars: ${nextSeqLesson.title}`,
      subject: `${nextSeqLesson.subject}${areaSuffix}`,
      curriculumArea: nextSeqLesson.curriculumArea,
      quarter: nextSeqLesson.quarter,
      reason: `${nextSeqLesson.quarter || 1}-chorak o'quv rejasidagi navbatdagi mavzu`,
      actionLabel: "Darsni boshlash",
      targetRoute: 'learning-path',
      lessonId: nextSeqLesson.id,
    });
  }

  if (unpracticedCompletion) {
    const lessonObj = lessons.find((l) => l.id === unpracticedCompletion.lessonId);
    if (lessonObj) {
      recommendations.push({
        id: `rec_practice_${lessonObj.id}`,
        type: 'practice',
        title: `${lessonObj.title} — Uyga vazifa va mashq`,
        subject: lessonObj.subject || lessonObj.subjectName || 'Matematika',
        curriculumArea: lessonObj.curriculumArea,
        quarter: lessonObj.quarter,
        reason: "Yakunlangan dars bo'yicha amaliy mashqni mustahkamlash",
        actionLabel: 'Mashqni bajarish',
        targetRoute: 'learning-path',
        lessonId: lessonObj.id,
      });
    }
  }

  const submittedAssessmentIds = new Set(
    submissions.filter((s) => s.studentId === studentId).map((s) => s.assessmentId)
  );

  const openAssessment = assessments.find(
    (a) =>
      a.status === 'published' &&
      (!a.classId || a.classId === `class_${classCode}` || a.classId === classCode) &&
      !submittedAssessmentIds.has(a.id)
  );

  if (openAssessment) {
    recommendations.push({
      id: `rec_assess_${openAssessment.id}`,
      type: 'assessment',
      title: openAssessment.title,
      subject: openAssessment.subject,
      reason: "O'tilgan mavzular bo'yicha bilimingizni sinab ko'ring",
      actionLabel: 'Testni ishlash',
      targetRoute: 'assessments',
      assessmentId: openAssessment.id,
    });
  }

  const revisionLesson = classLessons.find(
    (l) =>
      !completedLessonIds.has(l.id) &&
      (classifyRoadmap2LessonBadge(l) === 'Takrorlash' ||
        classifyRoadmap2LessonBadge(l) === 'BSB tahlili' ||
        classifyRoadmap2LessonBadge(l) === 'CHSB tahlili')
  );

  if (revisionLesson && recommendations.length < 3) {
    recommendations.push({
      id: `rec_rev_${revisionLesson.id}`,
      type: 'revision',
      title: `${revisionLesson.lessonNumber}-dars: ${revisionLesson.title}`,
      subject: revisionLesson.subject || revisionLesson.subjectName || 'Matematika',
      curriculumArea: revisionLesson.curriculumArea,
      quarter: revisionLesson.quarter,
      reason: "Nazorat oldidan mavzularni tizimli takrorlash",
      actionLabel: "Ko'rib chiqish",
      targetRoute: 'learning-path',
      lessonId: revisionLesson.id,
    });
  }

  return recommendations.slice(0, 3);
}
