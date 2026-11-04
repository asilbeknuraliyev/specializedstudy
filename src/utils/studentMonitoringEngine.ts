import {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  AttendanceSummaryStats,
  AttendanceImportRowPreview,
  AttendanceImportPreviewResult,
  StudentAssignment,
  AssignmentSubmission,
  StudentAlert,
  StudentSupportPlan,
  StudentAcademicMetrics,
  TopicEvidenceRecord,
  ClassMonitoringSnapshot,
  OfficialClassCode,
  UserProfile,
  AssessmentAttempt,
  Assessment,
  LessonItem,
  Topic,
  LearningEvidenceLevel,
} from '../types';
import { isSubjectCompatibleWithClass } from '../constants/curriculum';

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Keldi',
  ABSENT: 'Kelmagan',
  LATE: 'Kechikdi',
  EXCUSED_ABSENCE: 'Sababli',
};

export const ATTENDANCE_LABEL_TO_STATUS: Record<string, AttendanceStatus> = {
  keldi: 'PRESENT',
  present: 'PRESENT',
  kelmagan: 'ABSENT',
  yoq: 'ABSENT',
  'yo‘q': 'ABSENT',
  absent: 'ABSENT',
  kechikdi: 'LATE',
  late: 'LATE',
  sababli: 'EXCUSED_ABSENCE',
  excused: 'EXCUSED_ABSENCE',
  'sababli kelmagan': 'EXCUSED_ABSENCE',
};

/**
 * Normalizes input text or raw code into a standard AttendanceStatus.
 */
export function normalizeAttendanceStatus(raw: string | undefined): AttendanceStatus | null {
  if (!raw) return null;
  const cleaned = String(raw).trim().toLowerCase();
  return ATTENDANCE_LABEL_TO_STATUS[cleaned] || null;
}

/**
 * Calculates attendance summary statistics.
 * Uses only actual recorded attendance sessions as denominator.
 * Days without a record are not counted as absences.
 */
export function calculateAttendanceStats(records: AttendanceRecord[]): AttendanceSummaryStats {
  if (!records || records.length === 0) {
    return {
      totalRecordedDays: 0,
      totalSessions: 0,
      presentDays: 0,
      presentCount: 0,
      absentDays: 0,
      absentCount: 0,
      lateArrivals: 0,
      lateDays: 0,
      lateCount: 0,
      excusedAbsences: 0,
      excusedDays: 0,
      excusedCount: 0,
      attendancePercentage: 100,
      attendancePercent: 100,
      attendanceRate: 100,
      consecutiveAbsences: 0,
    };
  }

  // Deduplicate by date (latest updated record wins)
  const byDate = new Map<string, AttendanceRecord>();
  for (const r of records) {
    const existing = byDate.get(r.date);
    if (!existing || new Date(r.updatedAt || r.recordedAt).getTime() >= new Date(existing.updatedAt || existing.recordedAt).getTime()) {
      byDate.set(r.date, r);
    }
  }

  const uniqueRecords = Array.from(byDate.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let presentDays = 0;
  let absentDays = 0;
  let lateArrivals = 0;
  let excusedAbsences = 0;

  for (const rec of uniqueRecords) {
    if (rec.status === 'PRESENT') presentDays += 1;
    else if (rec.status === 'ABSENT') absentDays += 1;
    else if (rec.status === 'LATE') lateArrivals += 1;
    else if (rec.status === 'EXCUSED_ABSENCE') excusedAbsences += 1;
  }

  const totalRecordedDays = uniqueRecords.length;
  // Present + Late arrivals count towards attendance participation
  const attendedCount = presentDays + lateArrivals;
  const attendancePercentage =
    totalRecordedDays === 0 ? 100 : Math.round((attendedCount / totalRecordedDays) * 100);

  // Consecutive unexcused trailing absences
  let consecutiveAbsences = 0;
  for (let i = uniqueRecords.length - 1; i >= 0; i--) {
    if (uniqueRecords[i].status === 'ABSENT') {
      consecutiveAbsences += 1;
    } else {
      break;
    }
  }

  return {
    totalRecordedDays,
    totalSessions: totalRecordedDays,
    presentDays,
    presentCount: presentDays,
    absentDays,
    absentCount: absentDays,
    lateArrivals,
    lateDays: lateArrivals,
    lateCount: lateArrivals,
    excusedAbsences,
    excusedDays: excusedAbsences,
    excusedCount: excusedAbsences,
    attendancePercentage,
    attendancePercent: attendancePercentage,
    attendanceRate: attendancePercentage,
    consecutiveAbsences,
  };
}

export interface MonthlyCalendarDayItem {
  date: string;
  day: number;
  dayNumber: number;
  dayOfWeek: number;
  isCurrentMonth: boolean;
  isRecorded: boolean;
  attendancePercent?: number;
  presentCount?: number;
  absentCount?: number;
  lateCount?: number;
  record?: AttendanceRecord;
}

export type MonthlyAttendanceGridResult = MonthlyCalendarDayItem[] & { days: MonthlyCalendarDayItem[] };

/**
 * Computes monthly attendance calendar matrix for a student or class.
 */
export function buildMonthlyAttendanceGrid(
  arg1: string | number,
  arg2: number,
  arg3?: number | AttendanceRecord[],
  arg4?: AttendanceRecord[] | AttendanceSession[],
  _arg5?: AttendanceSession[]
): MonthlyAttendanceGridResult {
  let year: number;
  let month: number;
  let records: AttendanceRecord[] = [];

  if (typeof arg1 === 'number') {
    year = arg1;
    month = arg2;
    records = Array.isArray(arg3) ? arg3 : [];
  } else {
    // called as (classCode, year, month, records, sessions)
    year = arg2;
    month = typeof arg3 === 'number' ? arg3 : 1;
    records = Array.isArray(arg4) ? (arg4 as AttendanceRecord[]) : [];
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const recordsMap = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    const list = recordsMap.get(r.date) || [];
    list.push(r);
    recordsMap.set(r.date, list);
  }

  const grid: MonthlyCalendarDayItem[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const mStr = month < 10 ? `0${month}` : `${month}`;
    const dStr = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `${year}-${mStr}-${dStr}`;
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    const dayRecords = recordsMap.get(dateStr) || [];
    const isRecorded = dayRecords.length > 0;

    let present = 0;
    let absent = 0;
    let late = 0;
    for (const r of dayRecords) {
      if (r.status === 'PRESENT') present++;
      else if (r.status === 'LATE') late++;
      else if (r.status === 'ABSENT') absent++;
    }
    const total = dayRecords.length;
    const pct = total === 0 ? undefined : Math.round(((present + late) / total) * 100);

    grid.push({
      date: dateStr,
      day,
      dayNumber: day,
      dayOfWeek,
      isCurrentMonth: true,
      isRecorded,
      attendancePercent: pct,
      presentCount: present,
      absentCount: absent,
      lateCount: late,
      record: dayRecords[0],
    });
  }

  const result = Object.assign(grid, { days: grid });
  return result;
}

/**
 * Parses and validates attendance rows from an Excel worksheet.
 */
export function validateAttendanceImportRows(
  rawRows: Array<Record<string, any>>,
  existingRecords: AttendanceRecord[],
  studentsList: UserProfile[]
): AttendanceImportPreviewResult {
  const previews: AttendanceImportRowPreview[] = [];
  let validCount = 0;
  let conflictCount = 0;
  let errorCount = 0;

  const existingMap = new Map<string, AttendanceRecord>();
  for (const r of existingRecords) {
    existingMap.set(`${r.studentId}_${r.date}`, r);
  }

  const studentsByCodeOrEmail = new Map<string, UserProfile>();
  for (const s of studentsList) {
    if (s.role !== 'student') continue;
    if (s.studentCode) studentsByCodeOrEmail.set(s.studentCode.toLowerCase(), s);
    if (s.uid) studentsByCodeOrEmail.set(s.uid.toLowerCase(), s);
    if (s.email) studentsByCodeOrEmail.set(s.email.toLowerCase(), s);
    studentsByCodeOrEmail.set(s.displayName.toLowerCase(), s);
  }

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2; // header is row 1
    const rawStudentId = String(row['studentId'] || row['ID'] || row['Oquvchi ID'] || row['studentCode'] || '').trim();
    const rawStudentName = String(row['studentName'] || row['F.I.Sh.'] || row['Ism'] || row['name'] || '').trim();
    const rawClassCode = String(row['classCode'] || row['Sinf'] || row['class'] || '').trim();
    let rawDate = String(row['date'] || row['Sana'] || '').trim();
    const rawStatus = String(row['status'] || row['Holat'] || row['Davomat'] || '').trim();

    // Normalizing excel serial dates if present
    if (/^\d{5}$/.test(rawDate)) {
      const serial = parseInt(rawDate, 10);
      const utcDays = serial - 25569;
      const dateObj = new Date(utcDays * 86400 * 1000);
      rawDate = dateObj.toISOString().slice(0, 10);
    }

    const matchedStudent =
      (rawStudentId && studentsByCodeOrEmail.get(rawStudentId.toLowerCase())) ||
      (rawStudentName && studentsByCodeOrEmail.get(rawStudentName.toLowerCase()));

    const normalizedStatus = normalizeAttendanceStatus(rawStatus);

    // Validate date format YYYY-MM-DD
    const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(rawDate);

    if (!matchedStudent) {
      errorCount++;
      previews.push({
        rowNumber,
        rawStudentId,
        rawStudentName,
        rawClassCode,
        rawDate,
        rawStatus,
        status: 'error',
        message: 'O‘quvchi ro‘yxatdan topilmadi.',
      });
      return;
    }

    if (!dateValid) {
      errorCount++;
      previews.push({
        rowNumber,
        rawStudentId,
        rawStudentName,
        rawClassCode,
        rawDate,
        rawStatus,
        status: 'error',
        message: 'Sana formati noto‘g‘ri (YYYY-MM-DD talab qilinadi).',
      });
      return;
    }

    if (!normalizedStatus) {
      errorCount++;
      previews.push({
        rowNumber,
        rawStudentId,
        rawStudentName,
        rawClassCode,
        rawDate,
        rawStatus,
        status: 'error',
        message: 'Noma’lum davomat holati (Keldi, Kelmagan, Kechikdi, Sababli).',
      });
      return;
    }

    const conflictKey = `${matchedStudent.uid}_${rawDate}`;
    const existingRec = existingMap.get(conflictKey);

    if (existingRec) {
      conflictCount++;
      previews.push({
        rowNumber,
        rawStudentId,
        rawStudentName,
        rawClassCode,
        rawDate,
        rawStatus,
        normalizedStudentId: matchedStudent.uid,
        normalizedStudentName: matchedStudent.displayName,
        normalizedClassCode: (matchedStudent.classCode || rawClassCode) as OfficialClassCode,
        normalizedDate: rawDate,
        normalizedStatus,
        status: 'conflict',
        existingRecord: existingRec,
        message: `Mavjud yozuv bilan to‘qnashuv (${ATTENDANCE_STATUS_LABELS[existingRec.status]} -> ${ATTENDANCE_STATUS_LABELS[normalizedStatus]}).`,
      });
    } else {
      validCount++;
      previews.push({
        rowNumber,
        rawStudentId,
        rawStudentName,
        rawClassCode,
        rawDate,
        rawStatus,
        normalizedStudentId: matchedStudent.uid,
        normalizedStudentName: matchedStudent.displayName,
        normalizedClassCode: (matchedStudent.classCode || rawClassCode) as OfficialClassCode,
        normalizedDate: rawDate,
        normalizedStatus,
        status: 'valid',
      });
    }
  });

  return {
    fileName: 'attendance_import.xlsx',
    totalRows: rawRows.length,
    validCount,
    conflictCount,
    errorCount,
    rows: previews,
  };
}

/**
 * Calculates academic performance and learning progress intelligence for a student.
 */
export function calculateStudentAcademicMetrics(
  student: UserProfile,
  attempts: AssessmentAttempt[],
  assessments: Assessment[],
  topics: Topic[],
  lessons: LessonItem[]
): StudentAcademicMetrics {
  const studentAttempts = attempts.filter((a) => a.studentId === student.uid);

  // Group attempts by subject
  const subjectScores: Record<string, number[]> = {};
  const bsbScores: Record<string, number[]> = {};
  const chsbScores: Record<string, number[]> = {};

  // Track monthly and quarterly comparison scores
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthAttempts: number[] = [];
  const prevMonthAttempts: number[] = [];

  studentAttempts.forEach((att) => {
    const assess = assessments.find((a) => a.id === att.assessmentId);
    const subj = assess?.subject || 'Matematika';

    if (!subjectScores[subj]) subjectScores[subj] = [];
    subjectScores[subj].push(att.scorePercent);

    const titleLower = (att.assessmentTitle || assess?.title || '').toLowerCase();
    if (titleLower.includes('bsb') || titleLower.includes('yozma ish')) {
      if (!bsbScores[subj]) bsbScores[subj] = [];
      bsbScores[subj].push(att.scorePercent);
    } else if (titleLower.includes('chsb') || titleLower.includes('choraklik')) {
      if (!chsbScores[subj]) chsbScores[subj] = [];
      chsbScores[subj].push(att.scorePercent);
    }

    const subDate = (att.submittedAt || '').slice(0, 7);
    if (subDate === currentMonthKey) currentMonthAttempts.push(att.scorePercent);
    else if (subDate === prevMonthKey) prevMonthAttempts.push(att.scorePercent);
  });

  const overallAverageScore =
    studentAttempts.length === 0
      ? 0
      : Math.round(studentAttempts.reduce((acc, curr) => acc + curr.scorePercent, 0) / studentAttempts.length);

  // Analyze topic-level mastery evidence
  const topicAccuracyMap = new Map<string, { totalEarned: number; totalMax: number; attemptsCount: number; scores: number[] }>();

  studentAttempts.forEach((att) => {
    if (Array.isArray(att.answers)) {
      att.answers.forEach((ans) => {
        if (!ans.topicId) return;
        const current = topicAccuracyMap.get(ans.topicId) || { totalEarned: 0, totalMax: 0, attemptsCount: 0, scores: [] };
        const maxPts = ans.maxPoints || 1;
        const earned = ans.awardedPoints != null ? ans.awardedPoints : ans.isCorrect ? maxPts : 0;
        current.totalEarned += earned;
        current.totalMax += maxPts;
        current.attemptsCount += 1;
        current.scores.push(Math.round((earned / maxPts) * 100));
        topicAccuracyMap.set(ans.topicId, current);
      });
    }
  });

  const topicsEvidence: TopicEvidenceRecord[] = [];
  topics.forEach((t) => {
    // Only evaluate topics matching student's classCode / grade if applicable
    if (t.grade && student.grade && t.grade !== student.grade) return;
    if (student.classCode && !isSubjectCompatibleWithClass(t.subject, student.classCode).compatible) return;

    const data = topicAccuracyMap.get(t.id);
    if (!data || data.totalMax === 0) {
      topicsEvidence.push({
        topicId: t.id,
        topicName: t.name,
        subject: t.subject,
        accuracy: 0,
        assessmentsCount: 0,
        evidenceLevel: 'Ma\'lumot yetarli emas',
      });
      return;
    }

    const accuracy = Math.round((data.totalEarned / data.totalMax) * 100);
    let evidenceLevel: LearningEvidenceLevel = 'Ma\'lumot yetarli emas';
    if (data.attemptsCount >= 2 && accuracy >= 85) {
      evidenceLevel = 'Yaxshi o\'zlashtirilgan';
    } else if (accuracy >= 60) {
      evidenceLevel = 'Mustahkamlanmoqda';
    } else if (data.attemptsCount > 0) {
      evidenceLevel = 'O\'rganilmoqda';
    }

    // Check for declining trend across consecutive assessment attempts (e.g., dropping > 15%)
    let decliningTrend = false;
    let recentScore: number | undefined;
    let previousScore: number | undefined;
    if (data.scores.length >= 2) {
      recentScore = data.scores[data.scores.length - 1];
      previousScore = data.scores[data.scores.length - 2];
      if (previousScore - recentScore >= 15) {
        decliningTrend = true;
      }
    }

    topicsEvidence.push({
      topicId: t.id,
      topicName: t.name,
      subject: t.subject,
      accuracy,
      assessmentsCount: data.attemptsCount,
      evidenceLevel,
      decliningTrend,
      recentScore,
      previousScore,
    });
  });

  // Calculate subject averages and breakdown
  const subjectAverages: StudentAcademicMetrics['subjectAverages'] = {};
  Object.keys(subjectScores).forEach((subj) => {
    const list = subjectScores[subj];
    const avg = Math.round(list.reduce((a, b) => a + b, 0) / list.length);
    const bsbList = bsbScores[subj] || [];
    const chsbList = chsbScores[subj] || [];
    const subjTopics = topicsEvidence.filter((te) => te.subject === subj);
    const mastered = subjTopics.filter((te) => te.evidenceLevel === 'Yaxshi o\'zlashtirilgan').length;
    const needingPractice = subjTopics.filter((te) => te.evidenceLevel === 'O\'rganilmoqda' || te.decliningTrend).length;

    let level: LearningEvidenceLevel = 'Ma\'lumot yetarli emas';
    if (list.length >= 2 && avg >= 85) level = 'Yaxshi o\'zlashtirilgan';
    else if (avg >= 60) level = 'Mustahkamlanmoqda';
    else if (list.length > 0) level = 'O\'rganilmoqda';

    subjectAverages[subj] = {
      averageScore: avg,
      assessmentsCompleted: list.length,
      bsbScore: bsbList.length > 0 ? Math.round(bsbList.reduce((a, b) => a + b, 0) / bsbList.length) : undefined,
      chsbScore: chsbList.length > 0 ? Math.round(chsbList.reduce((a, b) => a + b, 0) / chsbList.length) : undefined,
      masteredTopicsCount: mastered,
      needingPracticeTopicsCount: needingPractice,
      evidenceLevel: level,
    };
  });

  const classLessons = lessons.filter(
    (l) =>
      !student.classCode ||
      l.classCode?.toLowerCase() === student.classCode.toLowerCase() ||
      (Array.isArray(l.classCodes) && l.classCodes.some((c) => c.toLowerCase() === student.classCode?.toLowerCase()))
  );
  const completedLessons = classLessons.filter((l) => l.status === 'completed');

  return {
    studentId: student.uid,
    studentName: student.displayName,
    classCode: (student.classCode || '7a1') as OfficialClassCode,
    overallAverageScore,
    subjectAverages,
    comparisonPeriods: {
      currentMonthScore:
        currentMonthAttempts.length > 0
          ? Math.round(currentMonthAttempts.reduce((a, b) => a + b, 0) / currentMonthAttempts.length)
          : overallAverageScore,
      previousMonthScore:
        prevMonthAttempts.length > 0
          ? Math.round(prevMonthAttempts.reduce((a, b) => a + b, 0) / prevMonthAttempts.length)
          : overallAverageScore,
      currentQuarterScore: overallAverageScore,
      previousQuarterScore: overallAverageScore,
    },
    topicsEvidence,
    completedLessonsCount: completedLessons.length,
    pendingLessonsCount: Math.max(0, classLessons.length - completedLessons.length),
  };
}

/**
 * Deterministically generates smart, evidence-based alerts for human review.
 * Phrased neutrally without subjective or judgmental labels.
 */
export function generateSmartRiskAlerts(
  student: UserProfile,
  attendanceStats: AttendanceSummaryStats,
  academicMetrics: StudentAcademicMetrics,
  submissions: AssignmentSubmission[],
  assignments: StudentAssignment[],
  existingAlerts: StudentAlert[] = []
): StudentAlert[] {
  const alerts: StudentAlert[] = [];
  const nowIso = new Date().toISOString();
  const instId = student.institutionId || 'inst-spec-study';
  const classCode = (student.classCode || '7a1') as OfficialClassCode;
  const classId = student.classId || '';

  const isAlreadyOpen = (cat: string) =>
    existingAlerts.some((a) => a.studentId === student.uid && a.category === cat && a.status !== 'resolved');

  // 1. Attendance low alert (<80%)
  if (attendanceStats.totalRecordedDays >= 5 && attendanceStats.attendancePercentage < 80 && !isAlreadyOpen('attendance')) {
    alerts.push({
      id: `alert_att_${student.uid}_${Date.now()}`,
      institutionId: instId,
      studentId: student.uid,
      studentName: student.displayName,
      classCode,
      classId,
      category: 'attendance',
      severity: attendanceStats.attendancePercentage < 70 ? 'high' : 'medium',
      title: 'Davomatni tekshirish kerak',
      evidence: `Jami qayd etilgan ${attendanceStats.totalRecordedDays} kundan davomat ko‘rsatkichi ${attendanceStats.attendancePercentage}% ni tashkil etmoqda (${attendanceStats.absentDays} kun qoldirilgan).`,
      status: 'open',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  // 2. Consecutive unexcused absences (>=3)
  if (attendanceStats.consecutiveAbsences >= 3 && !isAlreadyOpen('attendance')) {
    alerts.push({
      id: `alert_cons_att_${student.uid}_${Date.now()}`,
      institutionId: instId,
      studentId: student.uid,
      studentName: student.displayName,
      classCode,
      classId,
      category: 'attendance',
      severity: 'high',
      title: 'Davomatni tekshirish kerak',
      evidence: `Ketma-ket ${attendanceStats.consecutiveAbsences} kun sababsiz dars qoldirilganligi qayd etildi.`,
      status: 'open',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  // 3. Overdue assignments (>=2)
  const overdueSubmissions = submissions.filter(
    (s) => s.studentId === student.uid && s.status === 'Muddati o\'tgan'
  );
  if (overdueSubmissions.length >= 2 && !isAlreadyOpen('overdue_assignment')) {
    alerts.push({
      id: `alert_assg_${student.uid}_${Date.now()}`,
      institutionId: instId,
      studentId: student.uid,
      studentName: student.displayName,
      classCode,
      classId,
      category: 'overdue_assignment',
      severity: 'medium',
      title: 'Topshiriqlar bajarilmagan',
      evidence: `${overdueSubmissions.length} ta topshiriq belgilangan muddat ichida topshirilmagan.`,
      status: 'open',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  // 4. Declining performance in topics across multiple assessments
  const decliningTopics = academicMetrics.topicsEvidence.filter((te) => te.decliningTrend);
  if (decliningTopics.length > 0 && !isAlreadyOpen('academic_decline')) {
    const topicNames = decliningTopics.map((t) => t.topicName).slice(0, 2).join(', ');
    alerts.push({
      id: `alert_decl_${student.uid}_${Date.now()}`,
      institutionId: instId,
      studentId: student.uid,
      studentName: student.displayName,
      classCode,
      classId,
      category: 'academic_decline',
      severity: 'medium',
      title: 'Akademik natijalarda pasayish kuzatilgan',
      evidence: `${topicNames} mavzulari bo‘yicha keyingi baholashlarda natijalar kamida 15% ga pasaygan.`,
      status: 'open',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  // 5. Topics needing additional practice
  const needingPractice = academicMetrics.topicsEvidence.filter(
    (te) => te.evidenceLevel === 'O\'rganilmoqda' && te.assessmentsCount >= 2 && te.accuracy < 55
  );
  if (needingPractice.length >= 2 && !isAlreadyOpen('practice_needed')) {
    const list = needingPractice.slice(0, 2).map((t) => t.topicName).join(', ');
    alerts.push({
      id: `alert_prac_${student.uid}_${Date.now()}`,
      institutionId: instId,
      studentId: student.uid,
      studentName: student.displayName,
      classCode,
      classId,
      category: 'practice_needed',
      severity: 'low',
      title: 'Qo‘shimcha mashq tavsiya etiladi',
      evidence: `${list} mavzulari bo‘yicha o‘zlashtirish 55% dan past bo‘lib, mustahkamlash mashg‘ulotlari foydali bo‘ladi.`,
      status: 'open',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  return alerts;
}

/**
 * Computes snapshot monitoring data for a specific class.
 */
export function calculateClassMonitoringSnapshot(
  classCode: OfficialClassCode,
  grade: number,
  track: 'A' | 'T',
  enrolledStudents: UserProfile[],
  attendanceRecords: AttendanceRecord[],
  assignments: StudentAssignment[],
  submissions: AssignmentSubmission[],
  attempts: AssessmentAttempt[],
  alerts: StudentAlert[],
  supportPlans: StudentSupportPlan[]
): ClassMonitoringSnapshot {
  const studentUids = new Set(enrolledStudents.map((s) => s.uid));
  const classAttRecords = attendanceRecords.filter((r) => studentUids.has(r.studentId));

  const attStats = calculateAttendanceStats(classAttRecords);

  // Assessment participation rate
  const classAttempts = attempts.filter((a) => studentUids.has(a.studentId));
  const activeAssessmentsCount = new Set(classAttempts.map((a) => a.assessmentId)).size;
  const participationRate =
    enrolledStudents.length === 0 || activeAssessmentsCount === 0
      ? 100
      : Math.min(100, Math.round((classAttempts.length / (enrolledStudents.length * activeAssessmentsCount)) * 100));

  // Assignment completion rate
  const classSubmissions = submissions.filter((s) => studentUids.has(s.studentId));
  const completedSubmissions = classSubmissions.filter((s) => s.status === 'Topshirildi').length;
  const assignmentRate =
    classSubmissions.length === 0 ? 100 : Math.round((completedSubmissions / classSubmissions.length) * 100);

  // Subject averages
  const subjectMap: Record<string, number[]> = {};
  classAttempts.forEach((att) => {
    const subj = att.assessmentTitle ? att.assessmentTitle.split(' ')[0] : 'Matematika';
    if (!subjectMap[subj]) subjectMap[subj] = [];
    subjectMap[subj].push(att.scorePercent);
  });
  const subjectAverages: Record<string, number> = {};
  Object.keys(subjectMap).forEach((subj) => {
    const scores = subjectMap[subj];
    subjectAverages[subj] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  });

  const activeAlerts = alerts.filter((a) => studentUids.has(a.studentId) && a.status === 'open').length;
  const activePlans = supportPlans.filter((p) => studentUids.has(p.studentId) && p.status !== 'Yakunlandi').length;

  return {
    classCode,
    grade,
    track,
    enrolledStudentsCount: enrolledStudents.length,
    attendancePercentage: attStats.attendancePercentage,
    assessmentParticipationRate: participationRate,
    assignmentCompletionRate: assignmentRate,
    subjectAverages,
    activeAlertsCount: activeAlerts,
    activeSupportPlansCount: activePlans,
  };
}
