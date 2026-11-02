import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createEmptyDatabaseState } from '../server/dbEngine.ts';

test('Full E2E Production SaaS Workflow (TEST A through TEST G) in Isolated Test Environment', async () => {
  const baseUrl = 'http://localhost:3000';
  const headers = (token?: string): Record<string, string> => ({
    'Content-Type': 'application/json',
    'X-LearnOS-Env': 'test',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  // Verify clean empty state template has zero demo users, questions, assessments, attempts
  const emptyTemplate = createEmptyDatabaseState();
  assert.equal(emptyTemplate.users.length, 0, 'Empty state must have 0 users');
  assert.equal(emptyTemplate.questions.length, 0, 'Empty state must have 0 questions');
  assert.equal(emptyTemplate.assessments.length, 0, 'Empty state must have 0 assessments');
  assert.equal(emptyTemplate.attempts.length, 0, 'Empty state must have 0 attempts');

  // Reset isolated test environment via API
  const resetRes = await fetch(`${baseUrl}/api/test/reset`, {
    method: 'POST',
    headers: headers(),
  });
  assert.equal(resetRes.status, 200);

  // =========================================================================
  // TEST A — ADMINISTRATOR WORKFLOW
  // =========================================================================
  // 1. Check bootstrap status
  const bootStatus1 = await (
    await fetch(`${baseUrl}/api/auth/bootstrap-status`, { headers: headers() })
  ).json();
  assert.equal(bootStatus1.isBootstrapped, false);

  // 2. Bootstrap Initial Administrator & Institution ("Toshkent 14-sonli maktab")
  const bootRes = await fetch(`${baseUrl}/api/auth/bootstrap`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      displayName: 'Bahodir Admin',
      email: 'admin@maktab14.uz',
      password: 'AdminPassword123!',
      institutionName: 'Toshkent 14-sonli maktab',
      region: 'Toshkent shahri',
      district: 'Yunusobod tumani',
      academicYear: '2026-2027',
    }),
  });
  assert.equal(bootRes.status, 200, 'Initial admin bootstrap should succeed');
  const bootData = await bootRes.json();
  const adminToken: string = bootData.token;
  const adminUser = bootData.user;
  const institution = bootData.institution;
  assert.equal(adminUser.role, 'admin');
  assert.equal(institution.name, 'Toshkent 14-sonli maktab');

  // Verify bootstrap is now permanently locked
  const secondBootRes = await fetch(`${baseUrl}/api/auth/bootstrap`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      displayName: 'Hacker Admin',
      email: 'hacker@maktab14.uz',
      password: 'Password123!',
      institutionName: 'Fake School',
    }),
  });
  assert.equal(secondBootRes.status, 403, 'Second bootstrap attempt must be rejected with 403');

  // 3. Create Class ("8-A sinf")
  const classRes = await fetch(`${baseUrl}/api/classes`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      name: '8-A sinf',
      grade: 8,
      subject: 'Matematika',
    }),
  });
  assert.equal(classRes.status, 200);
  const { classRoom: createdClass } = await classRes.json();
  assert.equal(createdClass.name, '8-A sinf');

  // 4. Generate Teacher Invitation Token
  const teacherInviteRes = await fetch(`${baseUrl}/api/invitations`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      inviteeName: 'Dilshod Toshmatov',
      role: 'teacher',
      classId: createdClass.id,
      email: 'dilshod.teacher@maktab14.uz',
      subject: 'Matematika',
      expiresInHours: 72,
    }),
  });
  assert.equal(teacherInviteRes.status, 200);
  const teacherInviteData = await teacherInviteRes.json();
  const rawTeacherToken: string = teacherInviteData.rawToken;
  assert.ok(rawTeacherToken.startsWith('INV-'));

  // 5. Generate Student Invitation Token
  const studentInviteRes = await fetch(`${baseUrl}/api/invitations`, {
    method: 'POST',
    headers: headers(adminToken),
    body: JSON.stringify({
      inviteeName: 'Jasur Karimov',
      role: 'student',
      classId: createdClass.id,
      email: 'jasur.student@maktab14.uz',
      expiresInHours: 72,
    }),
  });
  assert.equal(studentInviteRes.status, 200);
  const studentInviteData = await studentInviteRes.json();
  const rawStudentToken: string = studentInviteData.rawToken;
  assert.ok(rawStudentToken.startsWith('INV-'));

  // =========================================================================
  // TEST B — TEACHER WORKFLOW
  // =========================================================================
  // 1. Register Teacher using cryptographic invitation token
  const teacherRegRes = await fetch(`${baseUrl}/api/auth/register-with-invite`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      displayName: 'Dilshod Toshmatov',
      email: 'dilshod.teacher@maktab14.uz',
      password: 'TeacherPassword123!',
      inviteToken: rawTeacherToken,
    }),
  });
  assert.equal(teacherRegRes.status, 200, 'Teacher registration with valid token should succeed');
  const teacherRegData = await teacherRegRes.json();
  const teacherToken: string = teacherRegData.token;
  const teacherUser = teacherRegData.user;
  assert.equal(teacherUser.role, 'teacher');

  // 2. Create 5 Questions across topics in Question Bank
  const sampleQuestions = [
    {
      topicId: 'topic-fractions',
      difficulty: 'easy',
      type: 'multiple_choice',
      prompt: '3/4 + 1/8 yig‘indisini hisoblang.',
      options: ['7/8', '4/12', '5/8', '1'],
      correctAnswer: '7/8',
      explanation: 'Umumiy maxraj 8: 6/8 + 1/8 = 7/8.',
    },
    {
      topicId: 'topic-fractions',
      difficulty: 'medium',
      type: 'multiple_choice',
      prompt: '5/6 - 1/3 ayirmani toping.',
      options: ['1/2', '4/3', '2/6', '1/3'],
      correctAnswer: '1/2',
      explanation: '5/6 - 2/6 = 3/6 = 1/2.',
    },
    {
      topicId: 'topic-fractions',
      difficulty: 'hard',
      type: 'multiple_choice',
      prompt: '(2/3) * (9/10) ko‘paytmani hisoblang.',
      options: ['3/5', '11/13', '18/30', '2/5'],
      correctAnswer: '3/5',
      explanation: '18/30 qisqartirilganda 3/5 hosil bo‘ladi.',
    },
    {
      topicId: 'topic-equations',
      difficulty: 'medium',
      type: 'multiple_choice',
      prompt: '2x - 6 = 10 tenglamani yeching.',
      options: ['8', '2', '4', '16'],
      correctAnswer: '8',
      explanation: '2x = 16 => x = 8.',
    },
    {
      topicId: 'topic-equations',
      difficulty: 'hard',
      type: 'multiple_choice',
      prompt: '3(x - 2) = 9 tenglamaning ildizini toping.',
      options: ['5', '3', '1', '7'],
      correctAnswer: '5',
      explanation: 'x - 2 = 3 => x = 5.',
    },
  ];

  const createdQuestionIds: string[] = [];
  for (const sq of sampleQuestions) {
    const qRes = await fetch(`${baseUrl}/api/questions`, {
      method: 'POST',
      headers: headers(teacherToken),
      body: JSON.stringify({
        ...sq,
        subject: 'Matematika',
        grade: 8,
        status: 'approved',
      }),
    });
    assert.equal(qRes.status, 200);
    const { question: qObj } = await qRes.json();
    createdQuestionIds.push(qObj.id);
  }
  assert.equal(createdQuestionIds.length, 5);

  // 3. Create & Publish Assessment ("1-chorak Matematika Diagnostika") and assign to 8-A sinf
  const assessRes = await fetch(`${baseUrl}/api/assessments`, {
    method: 'POST',
    headers: headers(teacherToken),
    body: JSON.stringify({
      title: '1-chorak Matematika Diagnostika',
      description: 'Kasrlar va chiziqli tenglamalar bo‘yicha sinov',
      subject: 'Matematika',
      grade: 8,
      topicIds: ['topic-fractions', 'topic-equations'],
      questionIds: createdQuestionIds,
      durationMinutes: 25,
      passingScore: 60,
      dueDate: '2026-11-30',
      classId: createdClass.id,
      status: 'published',
    }),
  });
  assert.equal(assessRes.status, 200);
  const { assessment: createdAssessment } = await assessRes.json();
  assert.equal(createdAssessment.status, 'published');
  assert.equal(createdAssessment.questionSnapshot.length, 5, 'Immutable question snapshot must contain 5 questions');

  // =========================================================================
  // TEST C — STUDENT WORKFLOW
  // =========================================================================
  // 1. Register Student using student invitation token
  const studentRegRes = await fetch(`${baseUrl}/api/auth/register-with-invite`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      displayName: 'Jasur Karimov',
      email: 'jasur.student@maktab14.uz',
      password: 'StudentPassword123!',
      inviteToken: rawStudentToken,
    }),
  });
  assert.equal(studentRegRes.status, 200, 'Student registration with valid token should succeed');
  const studentRegData = await studentRegRes.json();
  const studentToken: string = studentRegData.token;
  const studentUser = studentRegData.user;
  assert.equal(studentUser.role, 'student');
  assert.equal(studentUser.classId, createdClass.id);

  // 2. Verify Student sees the assigned assessment WITHOUT answer keys exposed
  const studentState = await (
    await fetch(`${baseUrl}/api/state`, { headers: headers(studentToken) })
  ).json();
  assert.equal(studentState.assessments.length, 1);
  assert.equal(
    studentState.questions[0].correctAnswer,
    '',
    'Answer keys must be stripped from /api/state for student role'
  );

  // 3. Submit Assessment Attempt (3/3 correct on fractions = 100%, 0/2 on equations = 0% => total 3/5 = 60%)
  const submittedMap: Record<string, string> = {
    [createdQuestionIds[0]]: '7/8',
    [createdQuestionIds[1]]: '1/2',
    [createdQuestionIds[2]]: '3/5',
    [createdQuestionIds[3]]: '2', // wrong
    [createdQuestionIds[4]]: '3', // wrong
  };

  const submitRes = await fetch(`${baseUrl}/api/assessments/submit`, {
    method: 'POST',
    headers: headers(studentToken),
    body: JSON.stringify({
      assessmentId: createdAssessment.id,
      submittedMap,
    }),
  });
  assert.equal(submitRes.status, 200);
  const submitData = await submitRes.json();
  assert.equal(submitData.attempt.scorePercent, 60);
  assert.equal(submitData.attempt.correctCount, 3);
  assert.equal(submitData.attempt.totalQuestions, 5);
  assert.ok(submitData.masteryRecords.length >= 2, 'Mastery records must be updated');
  assert.ok(submitData.learningPaths.length >= 1, 'Personalized learning path must be generated for weak topic');

  // =========================================================================
  // TEST D — TEACHER VIEWS STUDENT RESULTS
  // =========================================================================
  const teacherStateAfter = await (
    await fetch(`${baseUrl}/api/state`, { headers: headers(teacherToken) })
  ).json();
  assert.equal(teacherStateAfter.attempts.length, 1);
  assert.equal(teacherStateAfter.attempts[0].studentName, 'Jasur Karimov');
  assert.equal(teacherStateAfter.attempts[0].scorePercent, 60);
  assert.ok(teacherStateAfter.notifications.length >= 1, 'Teacher should receive notification of student submission');

  // Teacher adds pedagogical note
  const noteRes = await fetch(`${baseUrl}/api/teacher-notes`, {
    method: 'POST',
    headers: headers(teacherToken),
    body: JSON.stringify({
      studentId: studentUser.uid,
      content: 'Chiziqli tenglamalar bo‘yicha qo‘shimcha mashqlar berildi.',
    }),
  });
  assert.equal(noteRes.status, 200);

  // =========================================================================
  // TEST E — ADMINISTRATOR VIEWS INSTITUTION RESULTS
  // =========================================================================
  const adminStateAfter = await (
    await fetch(`${baseUrl}/api/state`, { headers: headers(adminToken) })
  ).json();
  assert.equal(adminStateAfter.users.length, 3, 'Admin should see 3 users (Admin, Teacher, Student)');
  assert.equal(adminStateAfter.classes.length, 1);
  assert.equal(adminStateAfter.assessments.length, 1);
  assert.equal(adminStateAfter.attempts.length, 1);
  assert.ok(adminStateAfter.auditLogs.length >= 4, 'Audit logs should record all key actions');

  // =========================================================================
  // TEST F — SECURITY & PERMISSION VERIFICATION (403 FORBIDDEN CHECKS)
  // =========================================================================
  // 1. Reusing single-use student invitation token must fail
  const reuseInviteRes = await fetch(`${baseUrl}/api/auth/register-with-invite`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      displayName: 'Duplicate Student',
      email: 'dup@maktab14.uz',
      password: 'Password123!',
      inviteToken: rawStudentToken,
    }),
  });
  assert.equal(reuseInviteRes.status, 400, 'Reusing a single-use invitation token must be rejected');

  // 2. Student attempting to create a question must receive 403
  const studentCreateQ = await fetch(`${baseUrl}/api/questions`, {
    method: 'POST',
    headers: headers(studentToken),
    body: JSON.stringify({
      topicId: 'topic-fractions',
      prompt: 'Unauthorized question',
      correctAnswer: '1',
      explanation: 'test',
    }),
  });
  assert.equal(studentCreateQ.status, 403, 'Student must not be able to create questions');

  // 3. Student attempting to access another student record via /api/security/students/:studentId
  const studentCrossAccess = await fetch(
    `${baseUrl}/api/security/students/other-student-999`,
    { headers: headers(studentToken) }
  );
  assert.equal(studentCrossAccess.status, 403, 'Student must not access another student record');

  // 4. Cross-institution access check via /api/security/institutions/:institutionId
  const crossInstAccess = await fetch(
    `${baseUrl}/api/security/institutions/inst-other-school-999`,
    { headers: headers(adminToken) }
  );
  assert.equal(crossInstAccess.status, 403, 'Admin must not access another institution');

  // =========================================================================
  // TEST G — REFRESH & PERSISTENCE + CLEANUP
  // =========================================================================
  const testDbFile = path.resolve(process.cwd(), '.data', 'learnos_test.json');
  assert.equal(fs.existsSync(testDbFile), true, 'Test DB file must persist on disk');
  const persistedDiskStore = JSON.parse(fs.readFileSync(testDbFile, 'utf-8'));
  assert.equal(persistedDiskStore.users.length, 3);
  assert.equal(persistedDiskStore.attempts.length, 1);
  assert.equal(persistedDiskStore.attempts[0].scorePercent, 60);

  // Clean up test store so zero test artifacts remain
  const finalReset = await fetch(`${baseUrl}/api/test/reset`, {
    method: 'POST',
    headers: headers(),
  });
  assert.equal(finalReset.status, 200);
});
