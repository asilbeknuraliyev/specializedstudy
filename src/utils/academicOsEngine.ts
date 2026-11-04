import {
  AcademicCalendarEvent,
  Announcement,
  AnnouncementAudienceType,
  Assessment,
  AssignmentCriterionScore,
  AssignmentSubmission,
  AssignmentSubmissionStatus,
  GradingRubric,
  LearningMaterial,
  LessonDeliveryRecord,
  LessonDeliveryStatus,
  LessonItem,
  MasteryRecord,
  OfficialClassCode,
  StudentAssignment,
  StudentLessonCompletion,
  SubmissionRevision,
  Timetable,
  TimetableEntry,
  TimetableValidationIssue,
  TimetableWeekday,
} from '../types';

export const TIMETABLE_WEEKDAYS: { label: TimetableWeekday; index: 1 | 2 | 3 | 4 | 5 | 6 }[] = [
  { label: 'Dushanba', index: 1 },
  { label: 'Seshanba', index: 2 },
  { label: 'Chorshanba', index: 3 },
  { label: 'Payshanba', index: 4 },
  { label: 'Juma', index: 5 },
  { label: 'Shanba', index: 6 },
];

export const DEFAULT_PERIOD_TIMES: Record<number, { startTime: string; endTime: string }> = {
  1: { startTime: '08:30', endTime: '09:15' },
  2: { startTime: '09:20', endTime: '10:05' },
  3: { startTime: '10:15', endTime: '11:00' },
  4: { startTime: '11:05', endTime: '11:50' },
  5: { startTime: '12:00', endTime: '12:45' },
  6: { startTime: '13:30', endTime: '14:15' },
  7: { startTime: '14:20', endTime: '15:05' },
};

const A_TRACK_SUBJECTS = ['Matematika', 'Ingliz tili', 'Fizika', 'Algebra', 'Geometriya'];
// T-track supports Ingliz tili, Biologiya, Kimyo, AND explicitly approved additional mathematics curricula (e.g. 7t, 8t, 9t, 10t, 11t Matematika/Algebra/Geometriya)
const T_TRACK_SUBJECTS = ['Ingliz tili', 'Biologiya', 'Kimyo', 'Matematika', 'Algebra', 'Geometriya'];

export function isTTrackClass(classCode: string): boolean {
  return classCode.toLowerCase().endsWith('t');
}

export function getAllowedSubjectsForClass(classCode: OfficialClassCode): string[] {
  if (isTTrackClass(classCode)) {
    return ['Ingliz tili', 'Biologiya', 'Kimyo', 'Matematika'];
  }
  return ['Matematika', 'Ingliz tili', 'Fizika'];
}

export function parseTimeToMinutes(timeStr: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((timeStr || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Validates a candidate timetable entry against existing entries in the same timetable/class.
 * Prevents conflicting time slots, detects duplicate entries, warns about invalid lesson durations,
 * and checks A-track / T-track subject compatibility.
 */
export function validateTimetableEntry(
  candidate: Omit<TimetableEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  existingEntries: TimetableEntry[]
): TimetableValidationIssue[] {
  const issues: TimetableValidationIssue[] = [];

  const startMin = parseTimeToMinutes(candidate.startTime);
  const endMin = parseTimeToMinutes(candidate.endTime);

  if (startMin === null || endMin === null) {
    issues.push({
      type: 'invalid_duration',
      severity: 'error',
      message: "Dars boshlanish va tugash vaqti HH:mm formatida bo'lishi shart.",
    });
    return issues;
  }

  const duration = endMin - startMin;
  if (duration <= 0) {
    issues.push({
      type: 'invalid_duration',
      severity: 'error',
      message: "Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak.",
    });
  } else if (duration < 25 || duration > 180) {
    issues.push({
      type: 'invalid_duration',
      severity: 'warning',
      message: `Dars davomiyligi (${duration} daqiqa) standart me'yordan (35–90 daqiqa) farq qiladi.`,
    });
  }

  // Track compatibility check
  const isT = isTTrackClass(candidate.classCode);
  const allowedList = isT ? T_TRACK_SUBJECTS : A_TRACK_SUBJECTS;
  const subjectAllowed = allowedList.some(
    (s) => candidate.subject.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(candidate.subject.toLowerCase())
  );
  if (!subjectAllowed) {
    issues.push({
      type: 'subject_track_mismatch',
      severity: 'warning',
      message: `${candidate.classCode.toUpperCase()} sinfi yo'nalishi uchun "${candidate.subject}" fani standart o'quv rejasiga kirmaydi.`,
    });
  }

  const sameDayClassEntries = existingEntries.filter(
    (e) =>
      e.timetableId === candidate.timetableId &&
      e.classCode === candidate.classCode &&
      e.weekdayIndex === candidate.weekdayIndex &&
      e.id !== candidate.id
  );

  for (const existing of sameDayClassEntries) {
    if (
      existing.lessonNumber === candidate.lessonNumber &&
      existing.subject.toLowerCase() === candidate.subject.toLowerCase() &&
      existing.startTime === candidate.startTime &&
      existing.endTime === candidate.endTime
    ) {
      issues.push({
        type: 'duplicate_entry',
        severity: 'error',
        message: `${candidate.weekday} kuni ${candidate.lessonNumber}-soatda "${candidate.subject}" darsi allaqachon kiritilgan.`,
        conflictingEntryId: existing.id,
      });
      continue;
    }

    if (existing.lessonNumber === candidate.lessonNumber) {
      issues.push({
        type: 'time_conflict',
        severity: 'error',
        message: `${candidate.weekday} kuni ${candidate.lessonNumber}-soat band (${existing.subject}, ${existing.startTime}–${existing.endTime}).`,
        conflictingEntryId: existing.id,
      });
      continue;
    }

    const exStart = parseTimeToMinutes(existing.startTime);
    const exEnd = parseTimeToMinutes(existing.endTime);
    if (exStart !== null && exEnd !== null && startMin < exEnd && endMin > exStart) {
      issues.push({
        type: 'time_conflict',
        severity: 'error',
        message: `${candidate.weekday} kuni vaqt ustma-ust tushishi: ${candidate.startTime}–${candidate.endTime} va ${existing.subject} (${existing.startTime}–${existing.endTime}).`,
        conflictingEntryId: existing.id,
      });
    }
  }

  return issues;
}

/**
 * Resolves a student's active class timetable, today's lessons, next lesson, and upcoming lessons.
 * Never invents a timetable if none is configured.
 */
export function resolveStudentTimetableView(params: {
  classCode: OfficialClassCode;
  timetables: Timetable[];
  entries: TimetableEntry[];
  nowIso?: string;
}): {
  activeTimetable: Timetable | null;
  allEntries: TimetableEntry[];
  todayWeekdayIndex: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  todayWeekdayLabel: string;
  todaysLessons: TimetableEntry[];
  nextLesson: TimetableEntry | null;
  upcomingLessons: TimetableEntry[];
} {
  const { classCode, timetables, entries, nowIso } = params;
  const activeTimetables = timetables
    .filter((t) => t.classCode === classCode && t.status === 'active')
    .sort((a, b) => b.version - a.version || b.effectiveFrom.localeCompare(a.effectiveFrom));

  const activeTimetable = activeTimetables[0] || null;
  const now = nowIso ? new Date(nowIso) : new Date();
  // Convert JS getDay() (0=Sun..6=Sat) to 1=Mon..7=Sun
  const jsDay = now.getDay();
  const todayWeekdayIndex = (jsDay === 0 ? 7 : jsDay) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const weekdayMap: Record<number, string> = {
    1: 'Dushanba',
    2: 'Seshanba',
    3: 'Chorshanba',
    4: 'Payshanba',
    5: 'Juma',
    6: 'Shanba',
    7: 'Yakshanba',
  };
  const todayWeekdayLabel = weekdayMap[todayWeekdayIndex] || 'Dushanba';

  if (!activeTimetable) {
    return {
      activeTimetable: null,
      allEntries: [],
      todayWeekdayIndex,
      todayWeekdayLabel,
      todaysLessons: [],
      nextLesson: null,
      upcomingLessons: [],
    };
  }

  const allEntries = entries
    .filter((e) => e.timetableId === activeTimetable.id && e.classCode === classCode)
    .sort((a, b) => a.weekdayIndex - b.weekdayIndex || a.lessonNumber - b.lessonNumber);

  const todaysLessons = allEntries.filter((e) => e.weekdayIndex === todayWeekdayIndex);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let nextLesson: TimetableEntry | null = null;
  const todayRemaining = todaysLessons.filter((e) => {
    const endMin = parseTimeToMinutes(e.endTime);
    return endMin !== null && endMin >= currentMinutes;
  });

  if (todayRemaining.length > 0) {
    nextLesson = todayRemaining[0];
  } else {
    const laterInWeek = allEntries.filter((e) => e.weekdayIndex > todayWeekdayIndex);
    nextLesson = laterInWeek[0] || allEntries[0] || null;
  }

  const upcomingLessons = allEntries.filter((e) => {
    if (e.weekdayIndex === todayWeekdayIndex) {
      const startMin = parseTimeToMinutes(e.startTime);
      return startMin !== null && startMin > currentMinutes;
    }
    return e.weekdayIndex > todayWeekdayIndex;
  });

  return {
    activeTimetable,
    allEntries,
    todayWeekdayIndex,
    todayWeekdayLabel,
    todaysLessons,
    nextLesson,
    upcomingLessons: upcomingLessons.slice(0, 6),
  };
}

/**
 * Assignment lifecycle helpers:
 * - Opening an assignment NEVER marks it complete.
 * - Saving a draft transitions status from 'Yangi' to 'Jarayonda' without incrementing attemptCount.
 * - Confirmed submission transitions to 'Topshirildi' and preserves any prior submitted version in `submission_revisions`.
 */
export function saveStudentAssignmentDraft(
  existing: AssignmentSubmission,
  draftContent: string,
  draftAttachmentUrl?: string,
  nowIso = new Date().toISOString()
): AssignmentSubmission {
  const nextStatus: AssignmentSubmissionStatus =
    existing.status === 'Yangi' ? 'Jarayonda' : existing.status;

  return {
    ...existing,
    status: nextStatus,
    draftContent,
    draftAttachmentUrl: draftAttachmentUrl ?? existing.draftAttachmentUrl,
    draftSavedAt: nowIso,
    updatedAt: nowIso,
  };
}

export function submitStudentAssignmentWork(params: {
  assignment: StudentAssignment;
  existingSubmission: AssignmentSubmission;
  content: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  nowIso?: string;
}): {
  updatedSubmission: AssignmentSubmission;
  archivedRevision: SubmissionRevision | null;
} {
  const {
    assignment,
    existingSubmission,
    content,
    attachmentUrl,
    attachmentName,
    attachmentMimeType,
    nowIso = new Date().toISOString(),
  } = params;

  const isResubmission = existingSubmission.attemptCount > 0 && Boolean(existingSubmission.submissionDate);
  if (isResubmission && assignment.allowResubmission === false && existingSubmission.status !== 'Qaytarildi') {
    throw new Error("Ushbu topshiriq uchun qayta topshirish ruxsat etilmagan.");
  }

  let archivedRevision: SubmissionRevision | null = null;
  if (isResubmission) {
    archivedRevision = {
      id: `rev_${existingSubmission.id}_${existingSubmission.attemptCount}_${Date.now()}`,
      institutionId: existingSubmission.institutionId,
      submissionId: existingSubmission.id,
      assignmentId: existingSubmission.assignmentId,
      studentId: existingSubmission.studentId,
      studentName: existingSubmission.studentName,
      classCode: existingSubmission.classCode,
      revisionNumber: existingSubmission.attemptCount,
      content: existingSubmission.content,
      attachmentUrl: existingSubmission.attachmentUrl,
      attachmentName: existingSubmission.attachmentName,
      submittedAt: existingSubmission.submissionDate || existingSubmission.updatedAt,
      score: existingSubmission.score,
      feedback: existingSubmission.feedback,
      gradedByUid: existingSubmission.gradedByUid,
      gradedByName: existingSubmission.gradedByName,
      gradedAt: existingSubmission.gradedAt,
      statusAtArchive: existingSubmission.status,
    };
  }

  const updatedSubmission: AssignmentSubmission = {
    ...existingSubmission,
    status: 'Topshirildi',
    submissionDate: nowIso,
    attemptCount: existingSubmission.attemptCount + 1,
    content,
    attachmentUrl: attachmentUrl ?? existingSubmission.attachmentUrl,
    attachmentName: attachmentName ?? existingSubmission.attachmentName,
    attachmentMimeType: attachmentMimeType ?? existingSubmission.attachmentMimeType,
    draftContent: undefined,
    draftAttachmentUrl: undefined,
    updatedAt: nowIso,
  };

  return { updatedSubmission, archivedRevision };
}

/**
 * Announcement targeting: determines whether an announcement is visible to a student of a given classCode.
 */
export function isAnnouncementRelevantToStudent(
  announcement: Announcement,
  studentClassCode: OfficialClassCode,
  todayDateStr?: string
): boolean {
  if (announcement.status !== 'published') return false;
  if (todayDateStr && announcement.expirationDate && announcement.expirationDate < todayDateStr) {
    return false;
  }

  switch (announcement.audienceType) {
    case 'entire_school':
      return true;
    case 'specific_classes':
    case 'class_group':
      return announcement.targetClassCodes.includes(studentClassCode);
    case 'subjects': {
      if (announcement.targetClassCodes && announcement.targetClassCodes.length > 0) {
        return announcement.targetClassCodes.includes(studentClassCode);
      }
      const allowedSubjects = getAllowedSubjectsForClass(studentClassCode);
      return announcement.targetSubjects.some((subj) =>
        allowedSubjects.some((allowed) => subj.toLowerCase().includes(allowed.toLowerCase()))
      );
    }
    default:
      return false;
  }
}

/**
 * Learning Materials Authorization: filters materials a student in `studentClassCode` is permitted to browse.
 */
export function filterAuthorizedMaterialsForStudent(
  materials: LearningMaterial[],
  studentClassCode: OfficialClassCode,
  studentGrade: number
): LearningMaterial[] {
  const allowedSubjects = getAllowedSubjectsForClass(studentClassCode);
  return materials.filter((m) => {
    if (m.status !== 'published') return false;
    if (m.targetClassCodes && m.targetClassCodes.length > 0) {
      return m.targetClassCodes.includes(studentClassCode);
    }
    if (m.classCode && m.classCode !== studentClassCode) {
      return false;
    }
    if (m.grade && m.grade !== studentGrade) {
      return false;
    }
    return allowedSubjects.some(
      (s) => m.subject.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(m.subject.toLowerCase())
    );
  });
}

/**
 * Smart Grading Rubric calculation:
 * Sums criterion scores, caps at criterion maxPoints, and enforces that AI suggestions
 * NEVER automatically overwrite an official grade without explicit Admin confirmation.
 */
export function calculateRubricTotalScore(
  rubric: GradingRubric,
  criterionScores: AssignmentCriterionScore[]
): { totalAwarded: number; totalMax: number; normalizedScores: AssignmentCriterionScore[] } {
  const normalizedScores: AssignmentCriterionScore[] = rubric.criteria.map((c) => {
    const match = criterionScores.find((cs) => cs.criterionId === c.id || cs.criterionTitle === c.title);
    const rawAwarded = match ? Number(match.awardedPoints) || 0 : 0;
    const boundedAwarded = Math.max(0, Math.min(c.maxPoints, rawAwarded));
    return {
      criterionId: c.id,
      criterionTitle: c.title,
      awardedPoints: boundedAwarded,
      maxPoints: c.maxPoints,
      comment: match?.comment,
    };
  });

  const totalAwarded = normalizedScores.reduce((sum, item) => sum + item.awardedPoints, 0);
  const totalMax = rubric.criteria.reduce((sum, item) => sum + item.maxPoints, 0);

  return { totalAwarded, totalMax, normalizedScores };
}

/**
 * Lesson Delivery Tracker:
 * Distinguishes the 4 distinct academic states:
 * 1. Lesson published (`lesson.isPublished`)
 * 2. Lesson delivered (`deliveryRecord.deliveryStatus === "O'tildi"`)
 * 3. Student lesson completed (`studentCompletion.status === 'completed'`)
 * 4. Student topic mastered (`masteryRecord.accuracy >= 80 && evidenceCount >= 3`)
 */
export function computeFourAcademicStatesForLesson(params: {
  lesson: LessonItem;
  classCode: OfficialClassCode;
  deliveryRecords: LessonDeliveryRecord[];
  studentCompletions: StudentLessonCompletion[];
  masteryRecords: MasteryRecord[];
  studentId?: string;
}): {
  isLessonPublished: boolean;
  deliveryStatus: LessonDeliveryStatus;
  isLessonDelivered: boolean;
  actualDeliveryDate?: string;
  isStudentLessonCompleted: boolean;
  isStudentTopicMastered: boolean;
  classCompletionCount: number;
} {
  const { lesson, classCode, deliveryRecords, studentCompletions, masteryRecords, studentId } = params;
  const isLessonPublished = Boolean(
    lesson.isPublished || lesson.status === 'published' || lesson.publicationStatus === 'PUBLISHED'
  );
  const deliveryRecord = deliveryRecords.find(
    (r) => r.lessonId === lesson.id && r.classCode === classCode
  );
  const deliveryStatus: LessonDeliveryStatus = deliveryRecord?.deliveryStatus || 'Rejalashtirilgan';
  const isLessonDelivered = deliveryStatus === "O'tildi";

  const classCompletionCount = studentCompletions.filter(
    (c) => c.lessonId === lesson.id && c.classCode === classCode && c.status === 'completed'
  ).length;

  const isStudentLessonCompleted = studentId
    ? studentCompletions.some(
        (c) => c.lessonId === lesson.id && c.studentId === studentId && c.status === 'completed'
      )
    : false;

  const lessonTopicTitle = (lesson.topicTitle || lesson.topicName || lesson.title || '').toLowerCase();
  const isStudentTopicMastered = studentId
    ? masteryRecords.some(
        (m) =>
          m.studentId === studentId &&
          (m.topicId === lesson.id || m.topicName.toLowerCase() === lessonTopicTitle) &&
          m.accuracy >= 80 &&
          m.evidenceCount >= 3
      )
    : false;

  return {
    isLessonPublished,
    deliveryStatus,
    isLessonDelivered,
    actualDeliveryDate: deliveryRecord?.actualDeliveryDate,
    isStudentLessonCompleted,
    isStudentTopicMastered,
    classCompletionCount,
  };
}

/**
 * Academic Calendar 2.0 Aggregator:
 * Uses actual dates only. Never invents dates from missing work-plan information.
 * Detects conflicting events on the same date & class.
 */
export function buildUnifiedAcademicCalendarEvents(params: {
  institutionId: string;
  timetableEntries: TimetableEntry[];
  timetables: Timetable[];
  lessons: LessonItem[];
  deliveryRecords: LessonDeliveryRecord[];
  assignments: StudentAssignment[];
  assessments: Assessment[];
  announcements: Announcement[];
  customEvents: AcademicCalendarEvent[];
  referenceWeekMondayDate?: string; // YYYY-MM-DD for projecting active timetable entries into current week
}): AcademicCalendarEvent[] {
  const {
    institutionId,
    timetableEntries,
    timetables,
    lessons,
    deliveryRecords,
    assignments,
    assessments,
    announcements,
    customEvents,
    referenceWeekMondayDate,
  } = params;

  const events: AcademicCalendarEvent[] = [...customEvents];

  // 1. Timetable entries projected onto the reference week (if active timetable exists)
  if (referenceWeekMondayDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceWeekMondayDate)) {
    const activeIds = new Set(timetables.filter((t) => t.status === 'active').map((t) => t.id));
    const baseMonday = new Date(`${referenceWeekMondayDate}T00:00:00Z`);
    for (const entry of timetableEntries) {
      if (!activeIds.has(entry.timetableId)) continue;
      const d = new Date(baseMonday.getTime() + (entry.weekdayIndex - 1) * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      events.push({
        id: `cal_tt_${entry.id}_${dateStr}`,
        institutionId,
        title: `${entry.lessonNumber}-soat: ${entry.subject}${entry.room ? ` (${entry.room}-xona)` : ''}`,
        description: entry.relatedLessonTitle || `${entry.classCode.toUpperCase()} dars jadvali`,
        category: 'timetable',
        date: dateStr,
        startTime: entry.startTime,
        endTime: entry.endTime,
        classCode: entry.classCode,
        subject: entry.subject,
        sourceRecordId: entry.id,
        sourceCollection: 'timetable_entries',
        targetRoute: `/admin/timetable?classCode=${entry.classCode}`,
        createdAt: entry.createdAt,
      });
    }
  }

  // 2. Lessons with actual delivery / planned dates or real scheduledDate (never invent dates)
  for (const delivery of deliveryRecords) {
    const actualDate = delivery.actualDeliveryDate || delivery.rescheduledToDate || delivery.plannedDate;
    if (!actualDate || !/^\d{4}-\d{2}-\d{2}$/.test(actualDate)) continue;
    events.push({
      id: `cal_del_${delivery.id}`,
      institutionId,
      title: `${delivery.subject}: ${delivery.lessonTitle} (${delivery.deliveryStatus})`,
      description: delivery.completionNote,
      category: 'published_lesson',
      date: actualDate.slice(0, 10),
      classCode: delivery.classCode,
      subject: delivery.subject,
      quarter: delivery.quarter,
      sourceRecordId: delivery.lessonId,
      sourceCollection: 'lessons',
      targetRoute: `/admin/curriculum?classCode=${delivery.classCode}&lessonId=${delivery.lessonId}`,
      createdAt: delivery.updatedAt,
    });
  }

  for (const lesson of lessons) {
    if (!lesson.scheduledDate || !/^\d{4}-\d{2}-\d{2}/.test(lesson.scheduledDate)) continue;
    const dateOnly = lesson.scheduledDate.slice(0, 10);
    const kind = (lesson.lessonKind || lesson.milestoneType || lesson.lessonType || '').toUpperCase();
    const category =
      kind === 'BSB'
        ? 'bsb'
        : kind === 'CHSB'
        ? 'chsb'
        : kind === 'PROJECT'
        ? 'project_work'
        : 'published_lesson';

    const desc =
      lesson.learningObjective ||
      (Array.isArray(lesson.learningObjectives)
        ? lesson.learningObjectives.join(', ')
        : lesson.learningObjectives);

    events.push({
      id: `cal_les_${lesson.id}`,
      institutionId,
      title: `${lesson.subject || lesson.subjectName}: ${lesson.topicTitle || lesson.topicName || lesson.title}`,
      description: desc,
      category,
      date: dateOnly,
      classCode: lesson.classCode as OfficialClassCode,
      subject: lesson.subject || lesson.subjectName,
      quarter: lesson.quarter,
      sourceRecordId: lesson.id,
      sourceCollection: 'lessons',
      targetRoute: `/admin/curriculum-map?lessonId=${lesson.id}`,
      createdAt: lesson.createdAt,
    });
  }

  // 3. Assignments with actual dueDate
  for (const asgn of assignments) {
    if (asgn.status === 'draft' || !asgn.dueDate || !/^\d{4}-\d{2}-\d{2}/.test(asgn.dueDate)) continue;
    const dateOnly = asgn.dueDate.slice(0, 10);
    events.push({
      id: `cal_asgn_${asgn.id}`,
      institutionId,
      title: `Topshiriq: ${asgn.title}`,
      description: asgn.description,
      category: 'assignment',
      date: dateOnly,
      classCode: asgn.classCode || asgn.targetClassCodes[0],
      targetClassCodes: asgn.targetClassCodes,
      subject: asgn.subject,
      sourceRecordId: asgn.id,
      sourceCollection: 'assignments',
      targetRoute: `/admin/assignments?assignmentId=${asgn.id}`,
      createdAt: asgn.createdAt,
    });
  }

  // 4. Assessments with actual dueDate (distinguishing BSB / CHSB / standard assessment)
  for (const asmt of assessments) {
    if (asmt.status === 'archived' || !asmt.dueDate || !/^\d{4}-\d{2}-\d{2}/.test(asmt.dueDate)) continue;
    const dateOnly = asmt.dueDate.slice(0, 10);
    const upperTitle = asmt.title.toUpperCase();
    const category = upperTitle.includes('CHSB')
      ? 'chsb'
      : upperTitle.includes('BSB')
      ? 'bsb'
      : 'assessment';

    events.push({
      id: `cal_asmt_${asmt.id}`,
      institutionId,
      title: `${category === 'bsb' ? 'BSB' : category === 'chsb' ? 'CHSB' : 'Nazorat'}: ${asmt.title}`,
      description: asmt.description,
      category,
      date: dateOnly,
      classCode: (asmt.classCode as OfficialClassCode) || asmt.assignedClassCodes?.[0],
      targetClassCodes: asmt.assignedClassCodes,
      subject: asmt.subject,
      quarter: asmt.quarter,
      sourceRecordId: asmt.id,
      sourceCollection: 'assessments',
      targetRoute: `/assessments/${asmt.id}`,
      createdAt: asmt.createdAt,
    });
  }

  // 5. Announcements with actual publicationDate
  for (const ann of announcements) {
    if (ann.status !== 'published' || !ann.publicationDate || !/^\d{4}-\d{2}-\d{2}/.test(ann.publicationDate)) continue;
    events.push({
      id: `cal_ann_${ann.id}`,
      institutionId,
      title: `E'lon: ${ann.title}`,
      description: ann.shortContent,
      category: 'announcement',
      date: ann.publicationDate.slice(0, 10),
      classCode: ann.targetClassCodes[0],
      targetClassCodes: ann.targetClassCodes,
      subject: ann.targetSubjects[0],
      sourceRecordId: ann.id,
      sourceCollection: 'announcements',
      targetRoute: `/admin/announcements?announcementId=${ann.id}`,
      createdAt: ann.createdAt,
    });
  }

  // Detect high-stakes conflicts (e.g., more than 2 BSB/CHSB/assessments on the same day for the same class)
  const highStakesByClassDate = new Map<string, AcademicCalendarEvent[]>();
  for (const ev of events) {
    if (ev.category === 'bsb' || ev.category === 'chsb' || ev.category === 'assessment') {
      const classes = ev.targetClassCodes?.length
        ? ev.targetClassCodes
        : ev.classCode
        ? [ev.classCode]
        : [];
      for (const cls of classes) {
        const key = `${cls}_${ev.date}`;
        const list = highStakesByClassDate.get(key) || [];
        list.push(ev);
        highStakesByClassDate.set(key, list);
      }
    }
  }

  for (const [, list] of highStakesByClassDate.entries()) {
    if (list.length > 1) {
      for (const ev of list) {
        ev.hasConflictWarning = true;
        ev.conflictMessage = `Diqqat: Shu kuni ushbu sinfda ${list.length} ta nazorat/BSB/CHSB belgilangan.`;
      }
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
}

export const DEFAULT_GRADING_RUBRICS: GradingRubric[] = [
  {
    id: 'rubric_math_standard',
    institutionId: 'inst-1',
    title: 'Matematika va Aniq fanlar yozma ish rubrikasi',
    subject: 'Matematika',
    description: "Masalani yechish bosqichlari, mantiqiy asoslash va hisoblash aniqligini baholash mezoni.",
    isDefault: true,
    totalMaxPoints: 10,
    criteria: [
      {
        id: 'crit_solution',
        title: "To'g'ri yechim",
        description: "Masala shartiga mos formula va yechish usulining to'g'ri tanlangani",
        maxPoints: 3,
        partialCreditRules: "Usul to'g'ri tanlangan, ammo oraliq qadam tushirib qoldirilgan bo'lsa 1.5–2 ball",
      },
      {
        id: 'crit_logic',
        title: 'Mantiqiy fikrlash',
        description: 'Qadamlar ketma-ketligi va mantiqiy asoslashning izchilligi',
        maxPoints: 2,
        partialCreditRules: 'Asoslash qisman keltirilgan bo‘lsa 1 ball',
      },
      {
        id: 'crit_calc',
        title: 'Hisoblash aniqligi',
        description: 'Arifmetik va algebraik amallarning xatosiz bajarilishi',
        maxPoints: 2,
        partialCreditRules: 'Kichik arifmetik xato mavjud bo‘lsa 1 ball',
      },
      {
        id: 'crit_explanation',
        title: 'Tushuntirish',
        description: "Chizma, belgilashlar va izohlarning tushunarli yozilishi",
        maxPoints: 1,
        partialCreditRules: 'Izohlar qisqa bo‘lsa 0.5 ball',
      },
      {
        id: 'crit_final',
        title: 'Yakuniy javob',
        description: "Yakuniy javob va o'lchov birliklarining aniq ko'rsatilishi",
        maxPoints: 2,
        partialCreditRules: "O'lchov birligi yozilmagan bo'lsa 1 ball",
      },
    ],
    createdByUid: 'system',
    createdByName: 'Platform Admin',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'rubric_science_lab',
    institutionId: 'inst-1',
    title: 'Tabiiy fanlar (Fizika, Kimyo, Biologiya) tahliliy ish rubrikasi',
    subject: 'Fizika',
    description: 'Tajriba, reaksiya tenglamalari va ilmiy xulosalarni baholash mezoni.',
    isDefault: true,
    totalMaxPoints: 10,
    criteria: [
      {
        id: 'crit_sci_concept',
        title: "To'g'ri yechim",
        description: 'Qonuniyat, formula yoki reaksiya tenglamasining to‘g‘ri yozilishi',
        maxPoints: 3,
        partialCreditRules: 'Koeffitsiyentlarda xato bo‘lsa 1.5 ball',
      },
      {
        id: 'crit_sci_logic',
        title: 'Mantiqiy fikrlash',
        description: 'Sabab-oqibat bog‘lanishining ilmiy asoslangani',
        maxPoints: 3,
        partialCreditRules: 'Qisman asoslangan bo‘lsa 1.5 ball',
      },
      {
        id: 'crit_sci_explanation',
        title: 'Tushuntirish',
        description: 'Atamalar va jarayonning aniq izohlanishi',
        maxPoints: 2,
        partialCreditRules: '1 ball qisman izoh uchun',
      },
      {
        id: 'crit_sci_final',
        title: 'Yakuniy javob',
        description: 'Xulosa va yakuniy natijaning to‘g‘riligi',
        maxPoints: 2,
        partialCreditRules: 'Xulosa to‘liq bo‘lmasa 1 ball',
      },
    ],
    createdByUid: 'system',
    createdByName: 'Platform Admin',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

export const DEFAULT_FEEDBACK_COMMENTS: {
  id: string;
  institutionId: string;
  category: 'praise' | 'correction' | 'methodology' | 'next_step';
  subject?: string;
  text: string;
  createdByUid: string;
  createdAt: string;
}[] = [
  {
    id: 'fb_1',
    institutionId: 'inst-1',
    category: 'praise',
    text: "Yechish usuli va mantiqiy qadamlar juda aniq ko'rsatilgan. Barakalla!",
    createdByUid: 'system',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'fb_2',
    institutionId: 'inst-1',
    category: 'correction',
    text: "Formula to'g'ri tanlangan, biroq oraliq hisoblashda ishora xatosiga yo'l qo'yilgan.",
    createdByUid: 'system',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'fb_3',
    institutionId: 'inst-1',
    category: 'methodology',
    text: "Yakuniy javobni yozishdan oldin har bir bosqich izohini qisqacha keltiring.",
    createdByUid: 'system',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'fb_4',
    institutionId: 'inst-1',
    category: 'next_step',
    text: "Mavzuni mustahkamlash uchun o'quv xaritadagi keyingi amaliy mashqlarni bajarib ko'ring.",
    createdByUid: 'system',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];
