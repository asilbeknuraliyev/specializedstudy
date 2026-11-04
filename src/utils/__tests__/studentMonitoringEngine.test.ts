import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAttendanceStats,
  normalizeAttendanceStatus,
  buildMonthlyAttendanceGrid,
  validateAttendanceImportRows,
  calculateStudentAcademicMetrics,
  generateSmartRiskAlerts,
  calculateClassMonitoringSnapshot,
} from '../studentMonitoringEngine';
import {
  AttendanceRecord,
  UserProfile,
  AssessmentAttempt,
  Assessment,
  Topic,
  LessonItem,
  StudentAssignment,
  AssignmentSubmission,
} from '../../types';

test('Student Monitoring & Intelligence Engine', async (t) => {
  await t.test('calculates attendance statistics strictly using actual recorded sessions', () => {
    const records: AttendanceRecord[] = [
      {
        id: 'rec_1',
        institutionId: 'inst_1',
        classId: 'cls_7a1',
        classCode: '7a1',
        studentId: 'stu_1',
        studentName: 'Sardor Karimov',
        date: '2026-11-01',
        status: 'PRESENT',
        recordedByUid: 'admin_1',
        recordedByName: 'Asilbek Nuraliyev',
        recordedAt: '2026-11-01T08:00:00Z',
        updatedAt: '2026-11-01T08:00:00Z',
      },
      {
        id: 'rec_2',
        institutionId: 'inst_1',
        classId: 'cls_7a1',
        classCode: '7a1',
        studentId: 'stu_1',
        studentName: 'Sardor Karimov',
        date: '2026-11-02',
        status: 'LATE',
        recordedByUid: 'admin_1',
        recordedByName: 'Asilbek Nuraliyev',
        recordedAt: '2026-11-02T08:00:00Z',
        updatedAt: '2026-11-02T08:00:00Z',
      },
      {
        id: 'rec_3',
        institutionId: 'inst_1',
        classId: 'cls_7a1',
        classCode: '7a1',
        studentId: 'stu_1',
        studentName: 'Sardor Karimov',
        date: '2026-11-03',
        status: 'EXCUSED_ABSENCE',
        recordedByUid: 'admin_1',
        recordedByName: 'Asilbek Nuraliyev',
        recordedAt: '2026-11-03T08:00:00Z',
        updatedAt: '2026-11-03T08:00:00Z',
      },
      {
        id: 'rec_4',
        institutionId: 'inst_1',
        classId: 'cls_7a1',
        classCode: '7a1',
        studentId: 'stu_1',
        studentName: 'Sardor Karimov',
        date: '2026-11-04',
        status: 'ABSENT',
        recordedByUid: 'admin_1',
        recordedByName: 'Asilbek Nuraliyev',
        recordedAt: '2026-11-04T08:00:00Z',
        updatedAt: '2026-11-04T08:00:00Z',
      },
    ];

    const stats = calculateAttendanceStats(records);
    assert.equal(stats.totalRecordedDays, 4);
    assert.equal(stats.presentDays, 1);
    assert.equal(stats.lateArrivals, 1);
    assert.equal(stats.excusedAbsences, 1);
    assert.equal(stats.absentDays, 1);
    // Attended: 1 present + 1 late = 2 out of 4 recorded days = 50%
    assert.equal(stats.attendancePercentage, 50);
    assert.equal(stats.consecutiveAbsences, 1);
  });

  await t.test('normalizes Uzbek Latin and technical attendance status labels', () => {
    assert.equal(normalizeAttendanceStatus('Keldi'), 'PRESENT');
    assert.equal(normalizeAttendanceStatus('kelmagan'), 'ABSENT');
    assert.equal(normalizeAttendanceStatus('Kechikdi'), 'LATE');
    assert.equal(normalizeAttendanceStatus('Sababli'), 'EXCUSED_ABSENCE');
    assert.equal(normalizeAttendanceStatus('sababli kelmagan'), 'EXCUSED_ABSENCE');
    assert.equal(normalizeAttendanceStatus('unknown'), null);
  });

  await t.test('detects conflicts and validates rows during Excel attendance import', () => {
    const existing: AttendanceRecord[] = [
      {
        id: 'rec_10',
        institutionId: 'inst_1',
        classId: 'cls_7a1',
        classCode: '7a1',
        studentId: 'stu_1',
        studentName: 'Sardor Karimov',
        date: '2026-11-01',
        status: 'PRESENT',
        recordedByUid: 'admin_1',
        recordedByName: 'Asilbek Nuraliyev',
        recordedAt: '2026-11-01T08:00:00Z',
        updatedAt: '2026-11-01T08:00:00Z',
      },
    ];

    const students: UserProfile[] = [
      {
        uid: 'stu_1',
        displayName: 'Sardor Karimov',
        email: 'sardor@specialized.uz',
        role: 'student',
        institutionId: 'inst_1',
        classCode: '7a1',
        studentCode: 'STU-001',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    const rawRows = [
      {
        studentId: 'STU-001',
        date: '2026-11-01',
        status: 'Kechikdi', // conflict with existing 'PRESENT'
      },
      {
        studentId: 'STU-001',
        date: '2026-11-02',
        status: 'Keldi', // valid new record
      },
      {
        studentId: 'UNKNOWN-999',
        date: '2026-11-02',
        status: 'Keldi', // error: unknown student
      },
    ];

    const preview = validateAttendanceImportRows(rawRows, existing, students);
    assert.equal(preview.totalRows, 3);
    assert.equal(preview.validCount, 1);
    assert.equal(preview.conflictCount, 1);
    assert.equal(preview.errorCount, 1);
  });

  await t.test('evaluates topic accuracy and evidence levels with neutral evidence labels', () => {
    const student: UserProfile = {
      uid: 'stu_1',
      displayName: 'Sardor Karimov',
      email: 'sardor@specialized.uz',
      role: 'student',
      institutionId: 'inst_1',
      classCode: '7a1',
      grade: 7,
      createdAt: '2026-01-01T00:00:00Z',
    };

    const topics: Topic[] = [
      {
        id: 'top_1',
        name: 'Chiziqli tenglamalar',
        subject: 'Matematika',
        grade: 7,
        description: 'Chiziqli tenglamalar',
        orderIndex: 1,
      },
      {
        id: 'top_2',
        name: 'Uchburchaklar',
        subject: 'Geometriya',
        grade: 7,
        description: 'Uchburchaklar',
        orderIndex: 2,
      },
    ];

    const attempts: AssessmentAttempt[] = [
      {
        id: 'att_1',
        assessmentId: 'as_1',
        assessmentTitle: 'Algebra 1-nazorat',
        institutionId: 'inst_1',
        status: 'completed',
        studentId: 'stu_1',
        studentName: 'Sardor Karimov',
        classId: 'cls_7a1',
        scorePercent: 90,
        correctCount: 9,
        totalQuestions: 10,
        answers: [
          {
            questionId: 'q_1',
            topicId: 'top_1',
            selectedAnswer: 'A',
            correctAnswer: 'A',
            isCorrect: true,
            maxPoints: 10,
            awardedPoints: 9,
            prompt: 'Test',
            explanation: '',
          },
        ],
        topicBreakdown: [],
        submittedAt: '2026-11-01T10:25:00Z',
      },
      {
        id: 'att_2',
        assessmentId: 'as_2',
        assessmentTitle: 'Algebra 2-nazorat',
        institutionId: 'inst_1',
        status: 'completed',
        studentId: 'stu_1',
        studentName: 'Sardor Karimov',
        classId: 'cls_7a1',
        scorePercent: 90,
        correctCount: 9,
        totalQuestions: 10,
        answers: [
          {
            questionId: 'q_2',
            topicId: 'top_1',
            selectedAnswer: 'B',
            correctAnswer: 'B',
            isCorrect: true,
            maxPoints: 10,
            awardedPoints: 9,
            prompt: 'Test 2',
            explanation: '',
          },
        ],
        topicBreakdown: [],
        submittedAt: '2026-11-02T10:25:00Z',
      },
    ];

    const assessments: Assessment[] = [
      {
        id: 'as_1',
        title: 'Algebra 1-nazorat',
        subject: 'Matematika',
        grade: 7,
        classId: 'cls_7a1',
        topicIds: ['top_1'],
        questionIds: ['q_1'],
        durationMinutes: 30,
        dueDate: '2026-11-10',
        teacherId: 'admin_1',
        institutionId: 'inst_1',
        status: 'published',
        createdAt: '2026-11-01T00:00:00Z',
      },
      {
        id: 'as_2',
        title: 'Algebra 2-nazorat',
        subject: 'Matematika',
        grade: 7,
        classId: 'cls_7a1',
        topicIds: ['top_1'],
        questionIds: ['q_2'],
        durationMinutes: 30,
        dueDate: '2026-11-10',
        teacherId: 'admin_1',
        institutionId: 'inst_1',
        status: 'published',
        createdAt: '2026-11-02T00:00:00Z',
      },
    ];

    const lessons: LessonItem[] = [];

    const metrics = calculateStudentAcademicMetrics(student, attempts, assessments, topics, lessons);
    assert.equal(metrics.overallAverageScore, 90);

    const top1Evidence = metrics.topicsEvidence.find((t) => t.topicId === 'top_1');
    assert.ok(top1Evidence);
    assert.equal(top1Evidence?.accuracy, 90);
    assert.equal(top1Evidence?.evidenceLevel, 'Yaxshi o\'zlashtirilgan');

    const top2Evidence = metrics.topicsEvidence.find((t) => t.topicId === 'top_2');
    assert.ok(top2Evidence);
    assert.equal(top2Evidence?.evidenceLevel, 'Ma\'lumot yetarli emas');
  });

  await t.test('generates neutral, evidence-based alerts without judgmental phrasing', () => {
    const student: UserProfile = {
      uid: 'stu_1',
      displayName: 'Sardor Karimov',
      email: 'sardor@specialized.uz',
      role: 'student',
      institutionId: 'inst_1',
      classCode: '7a1',
      createdAt: '2026-01-01T00:00:00Z',
    };

    const attendanceStats = {
      totalRecordedDays: 10,
      presentDays: 6,
      absentDays: 4,
      lateArrivals: 0,
      excusedAbsences: 0,
      attendancePercentage: 60,
      consecutiveAbsences: 3,
    };

    const academicMetrics = {
      studentId: 'stu_1',
      studentName: 'Sardor Karimov',
      classCode: '7a1' as const,
      overallAverageScore: 75,
      subjectAverages: {},
      comparisonPeriods: {
        currentMonthScore: 75,
        previousMonthScore: 75,
        currentQuarterScore: 75,
        previousQuarterScore: 75,
      },
      topicsEvidence: [
        {
          topicId: 't_1',
          topicName: 'Algebraik kasrlar',
          subject: 'Matematika',
          accuracy: 50,
          assessmentsCount: 3,
          evidenceLevel: 'O\'rganilmoqda' as const,
          decliningTrend: true,
          previousScore: 80,
          recentScore: 50,
        },
      ],
      completedLessonsCount: 4,
      pendingLessonsCount: 6,
    };

    const submissions: AssignmentSubmission[] = [
      {
        id: 'sub_1',
        assignmentId: 'asg_1',
        assignmentTitle: '1-vazifa',
        institutionId: 'inst_1',
        studentId: 'stu_1',
        studentName: 'Sardor Karimov',
        classCode: '7a1',
        classId: 'cls_7a1',
        status: 'Muddati o\'tgan',
        assignedDate: '2026-10-20',
        dueDate: '2026-10-25',
        attemptCount: 0,
        maxScore: 20,
        createdAt: '2026-10-20T00:00:00Z',
        updatedAt: '2026-10-26T00:00:00Z',
      },
      {
        id: 'sub_2',
        assignmentId: 'asg_2',
        assignmentTitle: '2-vazifa',
        institutionId: 'inst_1',
        studentId: 'stu_1',
        studentName: 'Sardor Karimov',
        classCode: '7a1',
        classId: 'cls_7a1',
        status: 'Muddati o\'tgan',
        assignedDate: '2026-10-22',
        dueDate: '2026-10-28',
        attemptCount: 0,
        maxScore: 20,
        createdAt: '2026-10-22T00:00:00Z',
        updatedAt: '2026-10-29T00:00:00Z',
      },
    ];

    const alerts = generateSmartRiskAlerts(student, attendanceStats, academicMetrics, submissions, []);
    assert.ok(alerts.length >= 3);

    // Verify neutral phrasing
    for (const a of alerts) {
      assert.doesNotMatch(a.title, /dangasa|yomon|sust|muammoli/i);
      assert.doesNotMatch(a.evidence, /dangasa|yomon|sust|muammoli/i);
    }

    const attAlert = alerts.find((a) => a.category === 'attendance');
    assert.ok(attAlert);
    assert.equal(attAlert?.title, 'Davomatni tekshirish kerak');

    const asgAlert = alerts.find((a) => a.category === 'overdue_assignment');
    assert.ok(asgAlert);
    assert.equal(asgAlert?.title, 'Topshiriqlar bajarilmagan');

    const declineAlert = alerts.find((a) => a.category === 'academic_decline');
    assert.ok(declineAlert);
    assert.equal(declineAlert?.title, 'Akademik natijalarda pasayish kuzatilgan');
  });
});
