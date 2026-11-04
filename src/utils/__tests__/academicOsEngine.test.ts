import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTimetableEntry,
  resolveStudentTimetableView,
  saveStudentAssignmentDraft,
  submitStudentAssignmentWork,
  isAnnouncementRelevantToStudent,
  filterAuthorizedMaterialsForStudent,
  calculateRubricTotalScore,
  computeFourAcademicStatesForLesson,
  buildUnifiedAcademicCalendarEvents,
  DEFAULT_GRADING_RUBRICS,
} from '../academicOsEngine';
import {
  Announcement,
  AssignmentSubmission,
  LearningMaterial,
  LessonDeliveryRecord,
  LessonItem,
  StudentAssignment,
  Timetable,
  TimetableEntry,
} from '../../types';

test('Smart Timetable: detects overlapping time slots, duplicate entries, and invalid durations', () => {
  const existing: TimetableEntry[] = [
    {
      id: 'entry_1',
      institutionId: 'inst-1',
      timetableId: 'tt_9a1_v1',
      classCode: '9a1',
      classId: 'class_9a1',
      weekday: 'Dushanba',
      weekdayIndex: 1,
      lessonNumber: 1,
      subject: 'Matematika',
      startTime: '08:30',
      endTime: '09:15',
      room: '204',
      createdAt: '2025-02-01T00:00:00Z',
      updatedAt: '2025-02-01T00:00:00Z',
    },
  ];

  // 1. Overlapping time slot on Monday for 9a1
  const conflictIssues = validateTimetableEntry(
    {
      institutionId: 'inst-1',
      timetableId: 'tt_9a1_v1',
      classCode: '9a1',
      classId: 'class_9a1',
      weekday: 'Dushanba',
      weekdayIndex: 1,
      lessonNumber: 2,
      subject: 'Fizika',
      startTime: '09:00',
      endTime: '09:45',
    },
    existing
  );
  assert.ok(conflictIssues.some((i) => i.type === 'time_conflict' && i.severity === 'error'));

  // 2. Duplicate entry
  const duplicateIssues = validateTimetableEntry(
    {
      institutionId: 'inst-1',
      timetableId: 'tt_9a1_v1',
      classCode: '9a1',
      classId: 'class_9a1',
      weekday: 'Dushanba',
      weekdayIndex: 1,
      lessonNumber: 1,
      subject: 'Matematika',
      startTime: '08:30',
      endTime: '09:15',
    },
    existing
  );
  assert.ok(duplicateIssues.some((i) => i.type === 'duplicate_entry' && i.severity === 'error'));

  // 3. Valid entry for T-track class with approved Mathematics
  const validTTrackMath = validateTimetableEntry(
    {
      institutionId: 'inst-1',
      timetableId: 'tt_8t_v1',
      classCode: '8t',
      classId: 'class_8t',
      weekday: 'Seshanba',
      weekdayIndex: 2,
      lessonNumber: 1,
      subject: 'Matematika',
      startTime: '08:30',
      endTime: '09:15',
    },
    []
  );
  assert.equal(validTTrackMath.length, 0);
});

test('Smart Timetable: returns clean empty state when no timetable is configured for student class', () => {
  const view = resolveStudentTimetableView({
    classCode: '10a1',
    timetables: [],
    entries: [],
    nowIso: '2025-03-03T08:00:00.000Z', // Monday
  });
  assert.equal(view.activeTimetable, null);
  assert.equal(view.todaysLessons.length, 0);
  assert.equal(view.nextLesson, null);
});

test('Homework & Assignment Center: draft save does not submit, and resubmission archives original submission in submission_revisions', () => {
  const assignment: StudentAssignment = {
    id: 'asgn_1',
    institutionId: 'inst-1',
    title: 'Kvadrat tenglamalar',
    description: '5 ta misol yechish',
    subject: 'Matematika',
    targetClassCodes: ['9a1'],
    targetClassIds: ['class_9a1'],
    assignedDate: '2025-03-01',
    dueDate: '2025-03-10',
    maxScore: 10,
    status: 'published',
    allowResubmission: true,
    createdByUid: 'admin-1',
    createdByName: 'Admin',
    createdAt: '2025-03-01T00:00:00Z',
    updatedAt: '2025-03-01T00:00:00Z',
  };

  const initialSub: AssignmentSubmission = {
    id: 'asgn_1_stu_1',
    assignmentId: 'asgn_1',
    assignmentTitle: 'Kvadrat tenglamalar',
    institutionId: 'inst-1',
    studentId: 'stu_1',
    studentName: 'Ali Valiyev',
    classCode: '9a1',
    classId: 'class_9a1',
    status: 'Yangi',
    assignedDate: '2025-03-01',
    dueDate: '2025-03-10',
    attemptCount: 0,
    maxScore: 10,
    createdAt: '2025-03-01T00:00:00Z',
    updatedAt: '2025-03-01T00:00:00Z',
  };

  // Save draft -> status becomes 'Jarayonda', attemptCount stays 0
  const afterDraft = saveStudentAssignmentDraft(initialSub, 'Qoralama javob: x = 2');
  assert.equal(afterDraft.status, 'Jarayonda');
  assert.equal(afterDraft.attemptCount, 0);
  assert.equal(afterDraft.draftContent, 'Qoralama javob: x = 2');

  // First confirmed submission -> status 'Topshirildi', attemptCount = 1, no archived revision yet
  const firstSubmit = submitStudentAssignmentWork({
    assignment,
    existingSubmission: afterDraft,
    content: '1-urinish javobi: x1 = 2, x2 = -3',
    nowIso: '2025-03-02T10:00:00Z',
  });
  assert.equal(firstSubmit.updatedSubmission.status, 'Topshirildi');
  assert.equal(firstSubmit.updatedSubmission.attemptCount, 1);
  assert.equal(firstSubmit.archivedRevision, null);

  // Second submission (resubmission) -> archives original into submission_revisions without overwriting it
  const secondSubmit = submitStudentAssignmentWork({
    assignment,
    existingSubmission: firstSubmit.updatedSubmission,
    content: '2-urinish to‘ldirilgan javobi: D = 25, x1 = 2, x2 = -3',
    nowIso: '2025-03-03T12:00:00Z',
  });
  assert.equal(secondSubmit.updatedSubmission.attemptCount, 2);
  assert.ok(secondSubmit.archivedRevision);
  assert.equal(secondSubmit.archivedRevision?.revisionNumber, 1);
  assert.equal(secondSubmit.archivedRevision?.content, '1-urinish javobi: x1 = 2, x2 = -3');
});

test('Announcement Center & Materials Library: enforces strict student class isolation', () => {
  const announcement9a1: Announcement = {
    id: 'ann_1',
    institutionId: 'inst-1',
    title: '9A1 Fizika laboratoriya o‘zgarishi',
    shortContent: 'Ertaga 3-soatda laboratoriya',
    type: 'schedule_change',
    audienceType: 'specific_classes',
    targetClassCodes: ['9a1'],
    targetSubjects: ['Fizika'],
    publicationDate: '2025-03-01',
    priority: 'high',
    requiresAcknowledgment: true,
    status: 'published',
    createdByUid: 'admin-1',
    createdByName: 'Admin',
    createdAt: '2025-03-01T00:00:00Z',
    updatedAt: '2025-03-01T00:00:00Z',
  };

  assert.equal(isAnnouncementRelevantToStudent(announcement9a1, '9a1', '2025-03-02'), true);
  assert.equal(isAnnouncementRelevantToStudent(announcement9a1, '8t', '2025-03-02'), false);

  const materials: LearningMaterial[] = [
    {
      id: 'mat_1',
      institutionId: 'inst-1',
      title: '9A1 Fizika Qo‘llanma PDF',
      description: 'Kinematika formulalari',
      materialType: 'pdf',
      fileUrl: 'https://storage.googleapis.com/specialized-study/materials/kinematika.pdf',
      folder: 'Fizika / 1-chorak',
      grade: 9,
      classCode: '9a1',
      targetClassCodes: ['9a1'],
      subject: 'Fizika',
      quarter: 1,
      status: 'published',
      allowDownload: true,
      uploadedByUid: 'admin-1',
      uploadedByName: 'Admin',
      createdAt: '2025-03-01T00:00:00Z',
      updatedAt: '2025-03-01T00:00:00Z',
    },
  ];

  assert.equal(filterAuthorizedMaterialsForStudent(materials, '9a1', 9).length, 1);
  assert.equal(filterAuthorizedMaterialsForStudent(materials, '9t', 9).length, 0);
});

test('Smart Grading & Lesson Delivery Tracker: rubric scoring and 4-state separation', () => {
  const rubric = DEFAULT_GRADING_RUBRICS[0];
  const scored = calculateRubricTotalScore(rubric, [
    { criterionId: 'crit_solution', criterionTitle: "To'g'ri yechim", awardedPoints: 3, maxPoints: 3 },
    { criterionId: 'crit_logic', criterionTitle: 'Mantiqiy fikrlash', awardedPoints: 2, maxPoints: 2 },
    { criterionId: 'crit_calc', criterionTitle: 'Hisoblash aniqligi', awardedPoints: 1.5, maxPoints: 2 },
    { criterionId: 'crit_explanation', criterionTitle: 'Tushuntirish', awardedPoints: 1, maxPoints: 1 },
    { criterionId: 'crit_final', criterionTitle: 'Yakuniy javob', awardedPoints: 2, maxPoints: 2 },
  ]);
  assert.equal(scored.totalAwarded, 9.5);
  assert.equal(scored.totalMax, 10);

  const lesson = {
    id: 'les_1',
    workPlanId: 'wp_1',
    institutionId: 'inst-1',
    classCode: '9a1',
    grade: 9,
    track: 'A',
    subject: 'Matematika',
    quarter: 1,
    lessonNumber: 1,
    topicTitle: 'Kvadrat funksiyalar',
    learningObjective: 'Parabola uchini topish',
    homework: '1-5 misollar',
    hours: 1,
    isPublished: true,
    createdAt: '2025-01-01T00:00:00Z',
  } as unknown as LessonItem;

  const deliveryRecords: LessonDeliveryRecord[] = [
    {
      id: '9a1_les_1',
      institutionId: 'inst-1',
      lessonId: 'les_1',
      lessonNumber: 1,
      lessonTitle: 'Kvadrat funksiyalar',
      workPlanId: 'wp_1',
      classCode: '9a1',
      classId: 'class_9a1',
      subject: 'Matematika',
      quarter: 1,
      actualDeliveryDate: '2025-03-04',
      deliveryStatus: "O'tildi",
      updatedByUid: 'admin-1',
      updatedByName: 'Admin',
      updatedAt: '2025-03-04T10:00:00Z',
      auditHistory: [],
    },
  ];

  // Lesson is published and delivered by school, but student has NOT completed or mastered it yet
  const states = computeFourAcademicStatesForLesson({
    lesson,
    classCode: '9a1',
    deliveryRecords,
    studentCompletions: [],
    masteryRecords: [],
    studentId: 'stu_1',
  });
  assert.equal(states.isLessonPublished, true);
  assert.equal(states.isLessonDelivered, true);
  assert.equal(states.isStudentLessonCompleted, false);
  assert.equal(states.isStudentTopicMastered, false);

  // Calendar aggregation includes delivered lesson on its actualDeliveryDate
  const calEvents = buildUnifiedAcademicCalendarEvents({
    institutionId: 'inst-1',
    timetableEntries: [],
    timetables: [],
    lessons: [lesson],
    deliveryRecords,
    assignments: [],
    assessments: [],
    announcements: [],
    customEvents: [],
  });
  assert.ok(calEvents.some((e) => e.date === '2025-03-04' && e.sourceRecordId === 'les_1'));
});
