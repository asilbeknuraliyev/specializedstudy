import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStudentLevel,
  computeHealthyStreak,
  processVerifiedLearningEvent,
  classifyRoadmap2LessonBadge,
  getStudentLessonRoadmapState,
  computeRoadmapPlanOverview,
  buildStudentLearningJourney,
  buildWeeklyLearningRecap,
  buildSmartNextSteps,
  DEFAULT_GAMIFICATION_CONFIG,
  createInitialGamificationProfile,
} from '../gamificationEngine';
import { LessonItem, StudentLessonCompletion } from '../../types';

describe('Gamification & Roadmap 2.0 Engine', () => {
  it('calculates progressive student levels accurately across all 7 bands', () => {
    const l1 = calculateStudentLevel(0);
    assert.equal(l1.currentLevel, 1);
    assert.equal(l1.currentLevelTitle, 'Boshlovchi');
    assert.equal(l1.nextLevelXp, 50);

    const l2 = calculateStudentLevel(50);
    assert.equal(l2.currentLevel, 2);
    assert.equal(l2.currentLevelTitle, 'Izlanuvchi');
    assert.equal(l2.nextLevelXp, 150);

    const l3 = calculateStudentLevel(150);
    assert.equal(l3.currentLevel, 3);
    assert.equal(l3.currentLevelTitle, "O'rganuvchi");

    const l4 = calculateStudentLevel(300);
    assert.equal(l4.currentLevel, 4);
    assert.equal(l4.currentLevelTitle, 'Bilimdon');

    const l5 = calculateStudentLevel(550);
    assert.equal(l5.currentLevel, 5);
    assert.equal(l5.currentLevelTitle, 'Tadqiqotchi');

    const l6 = calculateStudentLevel(900);
    assert.equal(l6.currentLevel, 6);
    assert.equal(l6.currentLevelTitle, 'Mutaxassis');

    const l7 = calculateStudentLevel(1450);
    assert.equal(l7.currentLevel, 7);
    assert.equal(l7.currentLevelTitle, 'Ekspert');
    assert.equal(l7.nextLevelXp, null);
    assert.equal(l7.levelProgressPercent, 100);
  });

  it('enforces idempotency so the same learning event never awards duplicate XP', () => {
    const first = processVerifiedLearningEvent({
      studentId: 'stu_1',
      classCode: '7a1',
      activityType: 'daily_checkin',
      idempotencyKey: 'checkin_stu_1_2026-11-03',
      reason: 'Kunlik o‘quv maqsadi',
      subject: 'Matematika',
      dateKey: '2026-11-03',
      existingEvents: [],
      existingLedger: [],
      existingStudentBadges: [],
    });

    assert.equal(first.duplicate, false);
    assert.equal(first.xpAwarded, 5);
    assert.equal(first.profile.totalXp, 5);
    assert.ok(first.event);
    assert.ok(first.ledgerEntry);

    const duplicateCall = processVerifiedLearningEvent({
      studentId: 'stu_1',
      classCode: '7a1',
      activityType: 'daily_checkin',
      idempotencyKey: 'checkin_stu_1_2026-11-03',
      reason: 'Kunlik o‘quv maqsadi',
      subject: 'Matematika',
      dateKey: '2026-11-03',
      existingProfile: first.profile,
      existingEvents: [first.event!],
      existingLedger: [first.ledgerEntry!],
      existingStudentBadges: first.newlyEarnedBadges,
      existingStreak: first.streak,
    });

    assert.equal(duplicateCall.duplicate, true);
    assert.equal(duplicateCall.xpAwarded, 0);
    assert.equal(duplicateCall.profile.totalXp, 5);
  });

  it('respects daily XP cap protection so XP farming is prevented', () => {
    const capConfig = {
      ...DEFAULT_GAMIFICATION_CONFIG,
      dailyXpCap: 15,
    };

    const res1 = processVerifiedLearningEvent({
      studentId: 'stu_cap',
      classCode: '7a1',
      activityType: 'lesson_completed',
      idempotencyKey: 'lesson_1',
      reason: '1-dars',
      subject: 'Matematika',
      dateKey: '2026-11-03',
      config: capConfig,
      existingEvents: [],
      existingLedger: [],
      existingStudentBadges: [],
    });
    assert.equal(res1.xpAwarded, 10);

    const res2 = processVerifiedLearningEvent({
      studentId: 'stu_cap',
      classCode: '7a1',
      activityType: 'lesson_completed',
      idempotencyKey: 'lesson_2',
      reason: '2-dars',
      subject: 'Matematika',
      dateKey: '2026-11-03',
      config: capConfig,
      existingProfile: res1.profile,
      existingEvents: [res1.event!],
      existingLedger: [res1.ledgerEntry!],
      existingStudentBadges: res1.newlyEarnedBadges,
    });
    // Only 5 XP remaining before hitting the 15 XP cap
    assert.equal(res2.xpAwarded, 5);
    assert.equal(res2.profile.totalXp, 15);
  });

  it('unlocks BIRINCHI QADAM, BIRINCHI TEST, and MASHGULOT USTASI badges on verified milestones', () => {
    const lessonRes = processVerifiedLearningEvent({
      studentId: 'stu_badge',
      classCode: '7a1',
      activityType: 'lesson_completed',
      idempotencyKey: 'lesson_stu_badge_1',
      reason: 'Birinchi dars',
      subject: 'Matematika',
      curriculumArea: 'Algebra',
      lessonId: 'les_1',
      dateKey: '2026-11-03',
      existingEvents: [],
      existingLedger: [],
      existingStudentBadges: [],
    });

    assert.ok(lessonRes.newlyEarnedBadges.some((b) => b.badgeCode === 'BIRINCHI_QADAM'));

    const testRes = processVerifiedLearningEvent({
      studentId: 'stu_badge',
      classCode: '7a1',
      activityType: 'assessment_completed',
      idempotencyKey: 'assess_stu_badge_1',
      reason: 'Birinchi test',
      subject: 'Matematika',
      assessmentId: 'ass_1',
      dateKey: '2026-11-03',
      existingProfile: lessonRes.profile,
      existingEvents: [lessonRes.event!],
      existingLedger: [lessonRes.ledgerEntry!],
      existingStudentBadges: lessonRes.newlyEarnedBadges,
    });

    assert.ok(testRes.newlyEarnedBadges.some((b) => b.badgeCode === 'BIRINCHI_TEST'));

    const goalRes = processVerifiedLearningEvent({
      studentId: 'stu_badge',
      classCode: '7a1',
      activityType: 'weekly_goal_completed',
      idempotencyKey: 'goal_stu_badge_1',
      reason: 'Haftalik maqsad',
      subject: 'Matematika',
      goalId: 'goal_1',
      dateKey: '2026-11-03',
      existingProfile: testRes.profile,
      existingEvents: [lessonRes.event!, testRes.event!],
      existingLedger: [lessonRes.ledgerEntry!, testRes.ledgerEntry!],
      existingStudentBadges: [...lessonRes.newlyEarnedBadges, ...testRes.newlyEarnedBadges],
    });

    assert.ok(goalRes.newlyEarnedBadges.some((b) => b.badgeCode === 'MASHGULOT_USTASI'));
  });

  it('computes healthy streaks with grace days and supportive messaging without XP loss', () => {
    const s1 = computeHealthyStreak(undefined, 'stu_streak', '2026-11-01', 1);
    assert.equal(s1.currentStreakDays, 1);

    // Consecutive day
    const s2 = computeHealthyStreak(s1, 'stu_streak', '2026-11-02', 1);
    assert.equal(s2.currentStreakDays, 2);

    // 1 missed day (2026-11-03) bridged by graceDaysAllowed = 1
    const s3 = computeHealthyStreak(s2, 'stu_streak', '2026-11-04', 1);
    assert.equal(s3.currentStreakDays, 3);
    assert.equal(s3.graceDaysUsedInCurrentStreak, 1);

    // Longer break resets streak count to 1 with supportive message
    const s4 = computeHealthyStreak(s3, 'stu_streak', '2026-11-10', 1);
    assert.equal(s4.currentStreakDays, 1);
    assert.equal(s4.longestStreakDays, 3);
    assert.ok(s4.statusMessage.includes('Yana davom ettirish vaqti!'));
  });

  it('classifies Roadmap 2.0 lesson badges and never marks lessons Completed without student completion', () => {
    assert.equal(
      classifyRoadmap2LessonBadge({ title: 'Chiziqli tenglamalar', lessonType: 'Oddiy dars-31' }),
      'Oddiy dars'
    );
    assert.equal(
      classifyRoadmap2LessonBadge({ title: '1-BSB nazorat ishi', lessonType: 'Yozma ish-41' }),
      'BSB'
    );
    assert.equal(
      classifyRoadmap2LessonBadge({ title: 'BSB tahlili va xatolar ustida ishlash', lessonType: 'Oddiy dars-31' }),
      'BSB tahlili'
    );
    assert.equal(
      classifyRoadmap2LessonBadge({ title: '1-CHSB choraklik baholash', lessonType: 'Choraklik-39' }),
      'CHSB'
    );
    assert.equal(
      classifyRoadmap2LessonBadge({ title: 'Matematik modellashtirish loyiha ishi', lessonType: 'Loyiha ishi-35' }),
      'Loyiha ishi'
    );

    // Verify lesson completion state accuracy
    const sampleLesson: Pick<LessonItem, 'id' | 'status'> = {
      id: 'lesson_7a1_alg_1',
      status: 'published',
    };
    assert.equal(getStudentLessonRoadmapState(sampleLesson, [], 'stu_1'), 'Published');

    const completions: StudentLessonCompletion[] = [
      {
        id: 'stu_1_lesson_7a1_alg_1',
        studentId: 'stu_1',
        classCode: '7a1',
        lessonId: 'lesson_7a1_alg_1',
        workPlanId: 'wp_1',
        subject: 'Matematika',
        curriculumArea: 'Algebra',
        quarter: 1,
        status: 'completed',
        practiceCompleted: true,
        completedAt: '2026-11-03T10:00:00.000Z',
        updatedAt: '2026-11-03T10:00:00.000Z',
      },
    ];
    assert.equal(getStudentLessonRoadmapState(sampleLesson, completions, 'stu_1'), 'Completed');
    assert.equal(getStudentLessonRoadmapState(sampleLesson, completions, 'other_student'), 'Published');
  });

  it('computes Roadmap Plan Overview, Learning Journey Milestones, Weekly Recap, and Smart Next Steps', () => {
    const lessons: LessonItem[] = [
      {
        id: 'les_1',
        institutionId: 'inst_1',
        classId: 'class_7a1',
        classCode: '7a1',
        grade: 7,
        track: 'A',
        subjectId: 'subj_math',
        subjectName: 'Matematika',
        subject: 'Matematika',
        curriculumArea: 'Algebra',
        academicYear: '2026-2027',
        quarter: 1,
        lessonNumber: 1,
        unitTitle: 'Algebraik ifodalar',
        topicId: 'top_1',
        topicName: 'Sonli ifodalar',
        title: 'Sonli va harfli ifodalar',
        lessonType: 'Oddiy dars-31',
        learningObjectives: 'Sonli ifodalar qiymatini topish',
        content: 'Dars mazmuni',
        hours: 1,
        status: 'published',
        materials: [],
        relatedAssessmentIds: [],
        createdAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'les_2',
        institutionId: 'inst_1',
        classId: 'class_7a1',
        classCode: '7a1',
        grade: 7,
        track: 'A',
        subjectId: 'subj_math',
        subjectName: 'Matematika',
        subject: 'Matematika',
        curriculumArea: 'Algebra',
        academicYear: '2026-2027',
        quarter: 1,
        lessonNumber: 2,
        unitTitle: 'Algebraik ifodalar',
        topicId: 'top_2',
        topicName: '1-BSB',
        title: '1-BSB nazorat ishi',
        lessonType: 'Yozma ish-41',
        learningObjectives: 'Nazorat',
        content: 'BSB',
        hours: 1,
        status: 'published',
        materials: [],
        relatedAssessmentIds: [],
        createdAt: '2026-09-02T00:00:00.000Z',
      },
    ];

    const completions: StudentLessonCompletion[] = [
      {
        id: 'stu_1_les_1',
        studentId: 'stu_1',
        classCode: '7a1',
        lessonId: 'les_1',
        workPlanId: 'wp_1',
        subject: 'Matematika',
        curriculumArea: 'Algebra',
        quarter: 1,
        status: 'completed',
        practiceCompleted: false,
        completedAt: '2026-11-03T10:00:00.000Z',
        updatedAt: '2026-11-03T10:00:00.000Z',
      },
    ];

    const overview = computeRoadmapPlanOverview(lessons, completions, 'stu_1');
    assert.equal(overview.totalLessons, 2);
    assert.equal(overview.ordinaryLessons, 1);
    assert.equal(overview.assessmentMilestones, 1);
    assert.equal(overview.completedLessons, 1);

    const profile = createInitialGamificationProfile('stu_1');
    profile.completedLessonsCount = 1;
    const journey = buildStudentLearningJourney({
      studentId: 'stu_1',
      profile,
      completions,
      submissions: [],
      lessons,
    });
    assert.equal(journey.find((m) => m.key === 'first_lesson')?.reached, true);
    assert.equal(journey.find((m) => m.key === 'five_completed_lessons')?.reached, false);

    const nextSteps = buildSmartNextSteps({
      studentId: 'stu_1',
      classCode: '7a1',
      lessons,
      assessments: [],
      completions,
      submissions: [],
    });
    assert.ok(nextSteps.some((r) => r.type === 'next_lesson' && r.lessonId === 'les_2'));
    assert.ok(nextSteps.some((r) => r.type === 'practice' && r.lessonId === 'les_1'));

    const recap = buildWeeklyLearningRecap({
      studentId: 'stu_1',
      dateKey: '2026-11-03',
      events: [
        {
          id: 'ev_1',
          idempotencyKey: 'ik_1',
          studentId: 'stu_1',
          classCode: '7a1',
          activityType: 'lesson_completed',
          subject: 'Matematika',
          lessonId: 'les_1',
          xpAwarded: 10,
          occurredAt: '2026-11-03T10:00:00.000Z',
          dateKey: '2026-11-03',
        },
      ],
      studentBadges: [],
      lessons,
      classCode: '7a1',
      completions,
    });
    assert.equal(recap.completedLessonsCount, 1);
    assert.equal(recap.xpEarned, 10);
    assert.ok(recap.recommendedNextFocus.includes('2-dars'));
  });
});
