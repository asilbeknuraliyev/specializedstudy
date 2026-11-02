import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAnswerCorrect,
  getMasteryStatusLabel,
  scoreAssessmentSubmission,
  updateMasteryRecordsFromAttempt,
  buildDeterministicFallbackAnalysis,
  generateLearningPathsFromAttempt,
} from './scoring';
import {
  computeSimpleHash,
  validateInvitationToken,
  canAccessInstitution,
  canAccessClass,
  canAccessStudentRecord,
  validateCSVStudentImport,
} from './security';
import {
  OFFICIAL_19_CLASS_CODES,
  A_TRACK_CLASS_CODES,
  T_TRACK_CLASS_CODES,
  DEFAULT_SUBJECTS,
  parseOfficialClassCode,
  isSubjectCompatibleWithClass,
  buildOfficial19Classes,
} from '../constants/curriculum';
import { parseUzbekAICommand } from './workPlanAndCommandEngine';
import { QuestionItem, Topic, UserProfile, ClassRoom, Invitation } from '../types';

const sampleTopics: Record<string, Topic> = {
  'topic-fractions': {
    id: 'topic-fractions',
    name: 'Kasrlar va ratsional sonlar',
    subject: 'Matematika',
    grade: 8,
    description: 'Oddiy va o‘nli kasrlar',
    orderIndex: 1,
  },
  'topic-equations': {
    id: 'topic-equations',
    name: 'Chiziqli tenglamalar',
    subject: 'Matematika',
    grade: 8,
    description: 'Chiziqli tenglamalar',
    orderIndex: 2,
  },
};

const sampleQuestions: QuestionItem[] = [
  {
    id: 'q1',
    institutionId: 'inst-1',
    authorId: 't-1',
    subject: 'Matematika',
    grade: 8,
    topicId: 'topic-fractions',
    difficulty: 'easy',
    type: 'multiple_choice',
    prompt: 'Hisoblang: 1/4 + 2/4',
    options: ['3/4', '1/2', '3/8', '1'],
    correctAnswer: '3/4',
    explanation: 'Maxrajlar bir xil: (1+2)/4 = 3/4.',
    status: 'approved',
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'q2',
    institutionId: 'inst-1',
    authorId: 't-1',
    subject: 'Matematika',
    grade: 8,
    topicId: 'topic-equations',
    difficulty: 'medium',
    type: 'numeric',
    prompt: '2x - 6 = 10 tenglamani yeching.',
    correctAnswer: '8',
    explanation: '2x = 16 => x = 8.',
    status: 'approved',
    createdAt: '2026-10-01T00:00:00.000Z',
  },
];

test('Official 19-Class Structure: exact 14 A-track and 5 T-track classes, no 5t or 6t', () => {
  assert.equal(OFFICIAL_19_CLASS_CODES.length, 19);
  assert.equal(A_TRACK_CLASS_CODES.length, 14);
  assert.equal(T_TRACK_CLASS_CODES.length, 5);

  const built = buildOfficial19Classes('inst-1', '2026-2027', 'admin-1');
  assert.equal(built.length, 19);
  assert.equal(built.filter((c) => c.track === 'A').length, 14);
  assert.equal(built.filter((c) => c.track === 'T').length, 5);

  // Reject 5t and 6t
  assert.equal(parseOfficialClassCode('5t'), null);
  assert.equal(parseOfficialClassCode('6t'), null);

  // Verify 7a1 and 9t metadata
  const c7a1 = parseOfficialClassCode('7a1');
  assert.ok(c7a1);
  assert.equal(c7a1.grade, 7);
  assert.equal(c7a1.track, 'A');

  const c9t = parseOfficialClassCode('9t');
  assert.ok(c9t);
  assert.equal(c9t.grade, 9);
  assert.equal(c9t.track, 'T');

  // Verify 5 initial subjects and track compatibility
  assert.equal(DEFAULT_SUBJECTS.length, 5);
  assert.equal(isSubjectCompatibleWithClass('Matematika', '7a1').compatible, true);
  assert.equal(isSubjectCompatibleWithClass('Matematika', '7t').compatible, false);
  assert.equal(isSubjectCompatibleWithClass('Biologiya', '9t').compatible, true);
  assert.equal(isSubjectCompatibleWithClass('Biologiya', '9a1').compatible, false);
  assert.equal(isSubjectCompatibleWithClass('Ingliz tili', '5a1').compatible, true);
  assert.equal(isSubjectCompatibleWithClass('Ingliz tili', '11t').compatible, true);
});

test('isAnswerCorrect validates multiple_choice and numeric answers accurately', () => {
  assert.equal(isAnswerCorrect(sampleQuestions[0], '3/4'), true);
  assert.equal(isAnswerCorrect(sampleQuestions[0], ' 3/4 '), true);
  assert.equal(isAnswerCorrect(sampleQuestions[0], '1/2'), false);
  assert.equal(isAnswerCorrect(sampleQuestions[1], '8.0'), true);
  assert.equal(isAnswerCorrect(sampleQuestions[1], '7'), false);
});

test('getMasteryStatusLabel enforces Specialized Study Uzbek status bands', () => {
  assert.equal(getMasteryStatusLabel(0, 0), 'Boshlanmagan');
  assert.equal(getMasteryStatusLabel(100, 1), "Ma'lumot yetarli emas");
  assert.equal(getMasteryStatusLabel(100, 2), "Ma'lumot yetarli emas");
  assert.equal(getMasteryStatusLabel(85, 3), 'Yaxshi o‘zlashtirilgan');
  assert.equal(getMasteryStatusLabel(65, 4), 'Mustahkamlanmoqda');
  assert.equal(getMasteryStatusLabel(45, 5), 'O‘rganilmoqda');
});

test('scoreAssessmentSubmission computes deterministic score and topic breakdown', () => {
  const result = scoreAssessmentSubmission(
    sampleQuestions,
    { q1: '3/4', q2: '5' },
    sampleTopics
  );
  assert.equal(result.scorePercent, 50);
  assert.equal(result.correctCount, 1);
  assert.equal(result.totalQuestions, 2);
  assert.equal(result.topicBreakdown.length, 2);
});

test('updateMasteryRecordsFromAttempt accumulates evidence and updates status labels', () => {
  const breakdown = [
    {
      topicId: 'topic-fractions',
      topicName: 'Kasrlar va ratsional sonlar',
      total: 3,
      correct: 3,
      accuracy: 100,
    },
  ];
  const updated = updateMasteryRecordsFromAttempt(
    [],
    'stu-1',
    'inst-1',
    breakdown,
    Object.values(sampleTopics),
    '2026-10-31T00:00:00.000Z'
  );
  const fracRec = updated.find((r) => r.topicId === 'topic-fractions');
  assert.ok(fracRec);
  assert.equal(fracRec.accuracy, 100);
  assert.equal(fracRec.evidenceCount, 3);
  assert.equal(fracRec.statusLabel, 'Yaxshi o‘zlashtirilgan');

  const paths = generateLearningPathsFromAttempt('stu-1', 'inst-1', breakdown, []);
  assert.equal(paths.length, 1);
  assert.equal(paths[0].steps.length, 5);
});

test('buildDeterministicFallbackAnalysis produces valid structured analysis', () => {
  const scored = scoreAssessmentSubmission(
    sampleQuestions,
    { q1: '3/4', q2: '5' },
    sampleTopics
  );
  const analysis = buildDeterministicFallbackAnalysis(
    '8-sinf Diagnostika',
    scored.scorePercent,
    scored.topicBreakdown,
    scored.answers
  );
  assert.ok(analysis.summary.length > 10);
  assert.equal(analysis.topic_analysis.length, 2);
  assert.equal(analysis.isFallback, true);
});

test('parseUzbekAICommand parses natural Uzbek Latin academic commands accurately', () => {
  const classes = buildOfficial19Classes('inst-1', '2026-2027', 'admin-1');
  const parsed1 = parseUzbekAICommand(
    '7a1 sinfi uchun matematika fanidan 3-dars bo‘yicha 15 ta test tuz.',
    classes,
    DEFAULT_SUBJECTS,
    [],
    []
  );
  assert.equal(parsed1.intent, 'generate_lesson_test');
  assert.equal(parsed1.matchedClass?.code, '7a1');
  assert.equal(parsed1.matchedSubject?.name, 'Matematika');
  assert.equal(parsed1.lessonNumber, 3);
  assert.equal(parsed1.questionCount, 15);

  const parsed2 = parseUzbekAICommand(
    '7a1 sinfining matematika bo‘yicha keyingi 5 ta darsini ko‘rsat.',
    classes,
    DEFAULT_SUBJECTS,
    [],
    []
  );
  assert.equal(parsed2.intent, 'show_upcoming_lessons');
  assert.equal(parsed2.matchedClass?.code, '7a1');
  assert.equal(parsed2.questionCount, 5);
});

test('Security: Multi-tenant isolation and RBAC reject unauthorized access', () => {
  const adminInst1: UserProfile = {
    uid: 'admin-1',
    displayName: 'Admin One',
    email: 'admin1@school1.uz',
    role: 'admin',
    institutionId: 'inst-1',
    createdAt: '2026-10-31T00:00:00.000Z',
  };
  const studentA: UserProfile = {
    uid: 'student-a',
    displayName: 'Student A',
    email: 'studenta@school1.uz',
    role: 'student',
    institutionId: 'inst-1',
    classId: 'class-7a1',
    createdAt: '2026-10-31T00:00:00.000Z',
  };
  const studentB: UserProfile = {
    uid: 'student-b',
    displayName: 'Student B',
    email: 'studentb@school1.uz',
    role: 'student',
    institutionId: 'inst-1',
    classId: 'class-8t',
    createdAt: '2026-10-31T00:00:00.000Z',
  };

  const builtClasses = buildOfficial19Classes('inst-1', '2026-2027', 'admin-1');
  const class7a1 = builtClasses.find((c) => c.code === '7a1')!;
  const class8t = builtClasses.find((c) => c.code === '8t')!;

  assert.equal(canAccessStudentRecord(studentA, studentA), true);
  assert.equal(canAccessStudentRecord(studentA, studentB), false);
  assert.equal(canAccessClass(studentA, class7a1), true);
  assert.equal(canAccessClass(studentA, class8t), false);
  assert.equal(canAccessInstitution(adminInst1, 'inst-1'), true);
  assert.equal(canAccessInstitution(adminInst1, 'inst-2'), false);
});

test('Cryptographic invitation token validation enforces hash match, single-use, and expiry', () => {
  const rawToken = 'INV-STU-9021';
  const tokenHash = computeSimpleHash(rawToken);
  const pendingInvite: Invitation = {
    id: 'inv-1',
    institutionId: 'inst-1',
    institutionName: 'Specialized Study',
    email: 'student@school.uz',
    inviteeName: 'Olimjon',
    role: 'student',
    tokenHash,
    status: 'pending',
    createdByUid: 'admin-1',
    createdByName: 'Admin',
    createdAt: '2026-10-31T00:00:00.000Z',
    expiresAt: '2026-11-15T00:00:00.000Z',
  };

  assert.equal(
    validateInvitationToken(rawToken, pendingInvite, '2026-11-01T00:00:00.000Z').valid,
    true
  );
  assert.equal(
    validateInvitationToken('INV-WRONG-0000', pendingInvite, '2026-11-01T00:00:00.000Z').valid,
    false
  );
  assert.equal(
    validateInvitationToken(rawToken, pendingInvite, '2026-11-20T00:00:00.000Z').valid,
    false
  );
  assert.equal(
    validateInvitationToken(
      rawToken,
      { ...pendingInvite, status: 'accepted' },
      '2026-11-01T00:00:00.000Z'
    ).valid,
    false
  );
});

test('CSV student import validation detects duplicates and invalid rows', () => {
  const csv = `Ism,Email,Sinf
Azizbek Karimov,azizbek@maktab.uz,7a1
Madina Sobirova,madina@maktab.uz,7a1
Takroriy Oquvchi,azizbek@maktab.uz,7a1
Xato Email,not-an-email,7a1`;

  const res = validateCSVStudentImport(csv, ['existing@maktab.uz']);
  assert.equal(res.validRows.length, 2);
  assert.equal(res.duplicates.length, 1);
  assert.equal(res.errors.length, 1);
});
