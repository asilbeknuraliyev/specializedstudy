import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import {
  isVerifiedPlatformOwner,
  canAccessPlatformAdminConsole,
  isSafeArchivePath,
  validateUploadedImageMeta,
} from './security';
import { OFFICIAL_19_CLASS_CODES, normalizeClassCodeInput } from '../constants/curriculum';

const BASE_URL = 'http://localhost:3000';

async function apiRequest(
  urlPath: string,
  method: string = 'GET',
  body?: unknown,
  token?: string
) {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-LearnOS-Env': 'test',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('SPECIALIZED STUDY — Intelligent School Management Upgrade (Tests 1-9 & Section 18 Tests A-G)', async () => {
  // Clean isolated test environment before starting
  const resetStart = await apiRequest('/api/test/reset', 'POST');
  assert.equal(resetStart.status, 200);

  // =========================================================================
  // TEST 1 — Admin Access (asilbeknuraliyev43@gmail.com allowed, non-admin 403)
  // =========================================================================
  const ownerAuth = await apiRequest('/api/auth/bootstrap', 'POST', {
    email: 'asilbeknuraliyev43@gmail.com',
    password: 'OwnerPassword123!',
    displayName: 'Asilbek Nuraliyev',
    institutionName: 'Specialized Study Maktabi',
    region: 'Toshkent shahri',
    district: 'Yunusobod tumani',
    academicYear: '2026-2027',
  });
  assert.equal(ownerAuth.status, 200, 'Authorized Admin bootstrap must succeed');
  const ownerUser = ownerAuth.data.user;
  const ownerToken: string = ownerAuth.data.token;

  assert.equal(ownerUser.email, 'asilbeknuraliyev43@gmail.com');
  assert.equal(isVerifiedPlatformOwner(ownerUser), true);
  assert.equal(canAccessPlatformAdminConsole(ownerUser), true);

  const overviewRes = await apiRequest('/api/admin/overview', 'GET', undefined, ownerToken);
  assert.equal(overviewRes.status, 200, 'Authorized owner must access /api/admin/overview');

  const fakeAdminTry = await apiRequest('/api/auth/bootstrap', 'POST', {
    email: 'stranger@example.com',
    password: 'Password123!',
    displayName: 'Begona Foydalanuvchi',
  });
  assert.equal(fakeAdminTry.status, 403, 'Non-authorized email must be rejected with 403');

  // =========================================================================
  // TEST A & TEST 2 — Official 19-Class Structure (14 A-track + 5 T-track = 19 classes)
  // =========================================================================
  const stateInitial = await apiRequest('/api/state', 'GET', undefined, ownerToken);
  assert.equal(stateInitial.status, 200);

  const classes: any[] = stateInitial.data.classes;
  assert.equal(classes.length, 19, 'Specialized Study must contain exactly 19 official classes');

  const classCodes = classes.map((c: any) => c.code);
  assert.deepEqual(
    classCodes,
    [
      '5a1', '5a2',
      '6a1', '6a2',
      '7a1', '7a2', '7t',
      '8a1', '8a2', '8t',
      '9a1', '9a2', '9t',
      '10a1', '10a2', '10t',
      '11a1', '11a2', '11t',
    ],
    'Exact 19 official class codes must match grade-ordered specification'
  );
  assert.equal(classCodes.length, OFFICIAL_19_CLASS_CODES.length);
  assert.equal(new Set(classCodes).size, 19, 'Zero duplicate classes allowed');
  assert.equal(classCodes.includes('5t'), false, '5t must NOT exist');
  assert.equal(classCodes.includes('6t'), false, '6t must NOT exist');

  const aTrackClasses = classes.filter((c: any) => c.track === 'A');
  const tTrackClasses = classes.filter((c: any) => c.track === 'T');
  assert.equal(aTrackClasses.length, 14, '14 A-track classes must exist (5a1..11a2)');
  assert.equal(tTrackClasses.length, 5, '5 T-track classes must exist (7t..11t)');

  // Verify class normalization helper
  assert.equal(normalizeClassCodeInput('5A1'), '5a1');
  assert.equal(normalizeClassCodeInput('5-a1'), '5a1');
  assert.equal(normalizeClassCodeInput('7 T'), '7t');
  assert.equal(normalizeClassCodeInput('10-A2 sinf'), '10a2');
  assert.equal(normalizeClassCodeInput('5t'), null, '5t must normalize to null (unsupported)');
  assert.equal(normalizeClassCodeInput('6t'), null, '6t must normalize to null (unsupported)');

  // Verify attempting to create 5t or 6t via API is rejected with 400
  const badClass5t = await apiRequest('/api/classes', 'POST', { code: '5t', name: '5t' }, ownerToken);
  assert.equal(badClass5t.status, 400, 'Creating 5t must be rejected');

  const badClass6t = await apiRequest('/api/classes', 'POST', { code: '6t', name: '6t' }, ownerToken);
  assert.equal(badClass6t.status, 400, 'Creating 6t must be rejected');

  // =========================================================================
  // TEST 3 — Subject-Track Association (5 Subjects: Matematika, Ingliz tili, Fizika, Biologiya, Kimyo)
  // =========================================================================
  const subjects: any[] = stateInitial.data.subjects;
  assert.equal(subjects.length, 5, 'Exactly 5 initial subjects must exist');

  const subjectByName: Record<string, any> = {};
  for (const s of subjects) {
    subjectByName[s.name] = s;
  }

  assert.deepEqual(subjectByName['Matematika'].trackTypes, ['A'], 'Matematika belongs to A-track');
  assert.deepEqual(subjectByName['Fizika'].trackTypes, ['A'], 'Fizika belongs to A-track');
  assert.deepEqual(subjectByName['Biologiya'].trackTypes, ['T'], 'Biologiya belongs to T-track');
  assert.deepEqual(subjectByName['Kimyo'].trackTypes, ['T'], 'Kimyo belongs to T-track');
  assert.deepEqual(subjectByName['Ingliz tili'].trackTypes, ['A', 'T'], 'Ingliz tili belongs to A & T tracks');

  // =========================================================================
  // TEST 4 — Student Enrollment (7a1 -> grade 7, track A; 8a1 -> grade 8, track A; 9t -> grade 9, track T)
  // =========================================================================
  const enroll7a1Res = await apiRequest(
    '/api/admin/students',
    'POST',
    {
      displayName: 'Jasmina Karimova',
      email: 'jasmina.7a1@specialized.uz',
      password: 'StudentPassword123!',
      classId: 'class-7a1',
      studentCode: 'STD-7A1-01',
    },
    ownerToken
  );
  assert.equal(enroll7a1Res.status, 200);
  assert.equal(enroll7a1Res.data.student.classCode, '7a1');
  assert.equal(enroll7a1Res.data.student.grade, 7);
  assert.equal(enroll7a1Res.data.student.track, 'A');

  const enroll8a1Res = await apiRequest(
    '/api/admin/students',
    'POST',
    {
      displayName: 'Sardor Alimov',
      email: 'sardor.8a1@specialized.uz',
      password: 'StudentPassword123!',
      classId: 'class-8a1',
      studentCode: 'STD-8A1-01',
    },
    ownerToken
  );
  assert.equal(enroll8a1Res.status, 200);

  const enroll9tRes = await apiRequest(
    '/api/admin/students',
    'POST',
    {
      displayName: 'Madina Usmonova',
      email: 'madina.9t@specialized.uz',
      password: 'StudentPassword123!',
      classId: 'class-9t',
      studentCode: 'STD-9T-01',
    },
    ownerToken
  );
  assert.equal(enroll9tRes.status, 200);

  const student8a1Login = await apiRequest('/api/auth/login', 'POST', {
    email: 'sardor.8a1@specialized.uz',
    password: 'StudentPassword123!',
  });
  assert.equal(student8a1Login.status, 200);
  const student8a1Token: string = student8a1Login.data.token;

  const student9tLogin = await apiRequest('/api/auth/login', 'POST', {
    email: 'madina.9t@specialized.uz',
    password: 'StudentPassword123!',
  });
  assert.equal(student9tLogin.status, 200);
  const student9tToken: string = student9tLogin.data.token;

  // =========================================================================
  // TEST B, C, D — 9-Step Excel Student Import, Invalid Row Handling, Duplicates & Rollback
  // =========================================================================
  // 1. Verify official student import template download has 0 fake student rows
  const tplRes = await fetch(`${BASE_URL}/api/students/import/template.xlsx`, {
    headers: { 'X-LearnOS-Env': 'test' },
  });
  assert.equal(tplRes.status, 200, 'Student Excel template endpoint must return 200');
  const tplBuf = Buffer.from(await tplRes.arrayBuffer());
  const tplWb = XLSX.read(tplBuf, { type: 'buffer' });
  assert.deepEqual(tplWb.SheetNames, ['Instructions', 'Students'], 'Template must have Instructions & Students sheets');
  const tplStudentRows = XLSX.utils.sheet_to_json(tplWb.Sheets['Students']);
  assert.equal(tplStudentRows.length, 0, 'Template Students sheet must contain 0 fake student rows');

  // 2. Test B & C: Build an Excel file with mixed-order students across 5a1, 7t, 10a2 + invalid rows (missing name, 5t class, bad email)
  const studentImportWb = XLSX.utils.book_new();
  const mixedSheetRows = [
    ['F.I.Sh.', 'Sinf', 'ID', 'Email'],
    ['Zokirov Azizbek', '10-A2', 'STD-10A2-02', 'azizbek.10a2@specialized.uz'],
    ['Abdullayeva Malika', '10a2', 'STD-10A2-01', 'malika.10a2@specialized.uz'],
    ['Tursunov Bekzod', '7 T', 'STD-7T-02', 'bekzod.7t@specialized.uz'],
    ['Karimov Bobur', '7t', 'STD-7T-01', 'bobur.7t@specialized.uz'],
    ['Nazarova Diyora', '5A1', 'STD-5A1-02', 'diyora.5a1@specialized.uz'],
    ['Alimov Javohir', '5-a1', 'STD-5A1-01', 'javohir.5a1@specialized.uz'],
    // Invalid rows for Test C:
    ['', '5a1', 'STD-ERR-01', 'noname@specialized.uz'], // Missing student name
    ['Xato Sinf Oquvchisi', '5t', 'STD-ERR-02', 'invalid5t@specialized.uz'], // Unsupported class 5t
    ['Xato Email Oquvchisi', '6a1', 'STD-ERR-03', 'not-an-email'], // Invalid email format
  ];
  XLSX.utils.book_append_sheet(
    studentImportWb,
    XLSX.utils.aoa_to_sheet(mixedSheetRows),
    'Oquvchilar'
  );
  const studentImportBuf = XLSX.write(studentImportWb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const studentImportBase64 = studentImportBuf.toString('base64');

  // Preview Step (Steps 2-7)
  const previewImportRes = await apiRequest(
    '/api/students/import/preview',
    'POST',
    {
      fileName: 'maktab_oquvchilari.xlsx',
      base64Data: studentImportBase64,
    },
    ownerToken
  );
  assert.equal(previewImportRes.status, 200, 'Student Excel preview must succeed');
  const previewData = previewImportRes.data;
  assert.equal(previewData.totalRows, 9, 'Total non-empty rows must be 9');
  assert.equal(previewData.newStudentsCount, 6, '6 valid new students must be identified');
  assert.equal(previewData.errorsCount, 3, '3 invalid rows (missing name, 5t class, bad email) must be flagged as ERROR');

  // Check automatic grouping & alphabetical sorting within classes (Step 5)
  const validGroups = previewData.classGroups.filter((g: any) => g.validCount > 0);
  const groupCodes = validGroups.map((g: any) => g.classCode);
  assert.deepEqual(groupCodes, ['5a1', '7t', '10a2'], 'Valid class groups must be sorted by grade order: 5a1, 7t, 10a2');

  const validRows = previewData.rows.filter((r: any) => r.status === 'valid');
  const rows5a1 = validRows.filter((r: any) => r.normalizedClassCode === '5a1');
  assert.deepEqual(
    rows5a1.map((s: any) => s.fullName),
    ['Alimov Javohir', 'Nazarova Diyora'],
    '5a1 students must be sorted alphabetically (Alimov before Nazarova)'
  );

  const rows7t = validRows.filter((r: any) => r.normalizedClassCode === '7t');
  assert.deepEqual(
    rows7t.map((s: any) => s.fullName),
    ['Karimov Bobur', 'Tursunov Bekzod'],
    '7t students must be sorted alphabetically (Karimov before Tursunov)'
  );

  const rows10a2 = validRows.filter((r: any) => r.normalizedClassCode === '10a2');
  assert.deepEqual(
    rows10a2.map((s: any) => s.fullName),
    ['Abdullayeva Malika', 'Zokirov Azizbek'],
    '10a2 students must be sorted alphabetically (Abdullayeva before Zokirov)'
  );

  // Confirm Import (Step 8 & 9)
  const importJobId = 'job-test-student-import-001';
  const confirmStudentImportRes = await apiRequest(
    '/api/students/import/confirm',
    'POST',
    {
      fileName: 'maktab_oquvchilari.xlsx',
      base64Data: studentImportBase64,
      duplicatePolicy: 'skip_existing',
      jobId: importJobId,
    },
    ownerToken
  );
  assert.equal(confirmStudentImportRes.status, 200, 'Student Excel import confirm must succeed');
  assert.equal(confirmStudentImportRes.data.job.importedCount, 6, 'Exactly 6 valid students must be imported');
  assert.equal(confirmStudentImportRes.data.job.errorCount, 3, '3 error rows must be excluded from import');

  // Test D (Part 1): Idempotent replay with same jobId must not duplicate students
  const idempotentReplayRes = await apiRequest(
    '/api/students/import/confirm',
    'POST',
    {
      fileName: 'maktab_oquvchilari.xlsx',
      base64Data: studentImportBase64,
      duplicatePolicy: 'skip_existing',
      jobId: importJobId,
    },
    ownerToken
  );
  assert.equal(idempotentReplayRes.status, 200);
  assert.equal(idempotentReplayRes.data.idempotentReplay, true, 'Same jobId must trigger idempotent replay');

  // Test D (Part 2): Re-uploading same file with new jobId & default skip_existing policy skips all 6 duplicates
  const duplicatePreviewRes = await apiRequest(
    '/api/students/import/preview',
    'POST',
    {
      fileName: 'maktab_oquvchilari_copy.xlsx',
      base64Data: studentImportBase64,
    },
    ownerToken
  );
  assert.equal(duplicatePreviewRes.status, 200);
  assert.equal(duplicatePreviewRes.data.duplicatesCount, 6, 'Re-uploading same file must detect all 6 existing students as duplicates');

  const duplicateConfirmSkipRes = await apiRequest(
    '/api/students/import/confirm',
    'POST',
    {
      fileName: 'maktab_oquvchilari_copy.xlsx',
      base64Data: studentImportBase64,
      duplicatePolicy: 'skip_existing',
      jobId: 'job-test-student-import-002',
    },
    ownerToken
  );
  assert.equal(duplicateConfirmSkipRes.status, 200);
  assert.equal(duplicateConfirmSkipRes.data.job.importedCount, 0, 'skip_existing must import 0 duplicate records');
  assert.equal(duplicateConfirmSkipRes.data.job.skippedCount, 6, 'skip_existing must skip all 6 duplicate records');

  // Verify class student counts updated accurately after Excel import
  const stateAfterExcelImport = await apiRequest('/api/state', 'GET', undefined, ownerToken);
  const cls5a1After = stateAfterExcelImport.data.classes.find((c: any) => c.code === '5a1');
  const cls7tAfter = stateAfterExcelImport.data.classes.find((c: any) => c.code === '7t');
  const cls10a2After = stateAfterExcelImport.data.classes.find((c: any) => c.code === '10a2');
  assert.equal(cls5a1After.studentCount, 2, '5a1 student count must be 2 after Excel import');
  assert.equal(cls7tAfter.studentCount, 2, '7t student count must be 2 after Excel import');
  assert.equal(cls10a2After.studentCount, 2, '10a2 student count must be 2 after Excel import');

  // Test D (Part 3): Safe Rollback of import job removes imported students and restores counts
  const rollbackRes = await apiRequest(
    `/api/students/import/${importJobId}/rollback`,
    'POST',
    {},
    ownerToken
  );
  assert.equal(rollbackRes.status, 200, 'Rollback of student import job must succeed');
  assert.equal(rollbackRes.data.removedCount, 6, 'Rollback must remove the 6 imported students');

  const stateAfterRollback = await apiRequest('/api/state', 'GET', undefined, ownerToken);
  const cls5a1RolledBack = stateAfterRollback.data.classes.find((c: any) => c.code === '5a1');
  assert.equal(cls5a1RolledBack.studentCount, 0, '5a1 student count must return to 0 after rollback');

  // =========================================================================
  // TEST E — UI Simplification Verification (Zero Repeated Role Clutter & Compact Nav)
  // =========================================================================
  const appShellSource = fs.readFileSync(path.join(process.cwd(), 'src/components/AppShell.tsx'), 'utf8');
  const adminPagesSource = fs.readFileSync(path.join(process.cwd(), 'src/pages/ParentAndAdminPages.tsx'), 'utf8');

  const forbiddenPhrases = [
    'Admin Dashboard',
    'Administrator Dashboard',
    'Admin Panel',
    'Admin Workspace',
    'Administrator Management',
    'Platform Management',
    'Admin Student Management',
    'Administrator Assessment Management',
  ];
  for (const phrase of forbiddenPhrases) {
    assert.equal(
      appShellSource.includes(phrase),
      false,
      `AppShell.tsx must not contain forbidden administrative clutter phrase: "${phrase}"`
    );
    assert.equal(
      adminPagesSource.includes(phrase),
      false,
      `ParentAndAdminPages.tsx must not contain forbidden administrative clutter phrase: "${phrase}"`
    );
  }

  // Verify exact 9 Admin Navigation labels and 5 Student Navigation labels in AppShell.tsx
  const expectedAdminNavLabels = [
    'Bosh sahifa',
    'Sinflar',
    "O'quvchilar",
    'Fanlar',
    'Ish rejalari',
    'Darslar',
    'Testlar',
    'Natijalar',
    'Sozlamalar',
  ];
  for (const navLabel of expectedAdminNavLabels) {
    assert.equal(
      appShellSource.includes(navLabel),
      true,
      `AppShell.tsx must include compact navigation label "${navLabel}"`
    );
  }
  assert.equal(
    appShellSource.includes("O'quv xaritam"),
    true,
    `AppShell.tsx must include student navigation label "O'quv xaritam"`
  );

  // =========================================================================
  // TEST 5 — Work Plan Import (6-Step Flow -> Creates WorkPlan, Topics & Lessons in Curriculum Map)
  // =========================================================================
  const wpAnalyzeRes = await apiRequest(
    '/api/work-plans/analyze',
    'POST',
    {
      rawText: [
        '1 | Chiziqli tenglamalar va ularning xossalari | Bir noma’lumli tenglamalarni yechish | 2',
        '2 | Ikki noma’lumli chiziqli tenglamalar sistemasi | O‘rniga qo‘yish va qo‘shish usullari | 2',
        '3 | Qisqa ko‘paytirish formulalari | Kvadratlar ayirmasi va yig‘indi kvadrati | 2',
      ].join('\n'),
      subject: 'Matematika',
      grade: 7,
      track: 'A',
      classCode: '7a1',
      quarter: 1,
    },
    ownerToken
  );
  assert.equal(wpAnalyzeRes.status, 200);
  assert.equal(wpAnalyzeRes.data.rows.length, 3);

  const wpConfirmRes = await apiRequest(
    '/api/work-plans/confirm',
    'POST',
    {
      title: '7a1 Matematika 1-chorak Ish Rejasi',
      subject: 'Matematika',
      grade: 7,
      track: 'A',
      classCode: '7a1',
      quarter: 1,
      academicYear: '2026-2027',
      fileName: '7a1_matematika_1chorak.xlsx',
      fileType: 'xlsx',
      rows: wpAnalyzeRes.data.rows,
    },
    ownerToken
  );
  assert.equal(wpConfirmRes.status, 200);
  assert.equal(wpConfirmRes.data.workPlan.status, 'confirmed');
  assert.equal(wpConfirmRes.data.lessons.length, 3);

  // Verify incompatible Subject-Track is rejected in Work Plan confirm (Biologiya for 7a1 A-track)
  const wpIncompatibleRes = await apiRequest(
    '/api/work-plans/confirm',
    'POST',
    {
      title: 'Xato Reja',
      subject: 'Biologiya',
      grade: 7,
      track: 'A',
      classCode: '7a1',
      quarter: 1,
      rows: wpAnalyzeRes.data.rows,
    },
    ownerToken
  );
  assert.equal(wpIncompatibleRes.status, 400);

  // =========================================================================
  // TEST F & TEST 6 — Global Search, Academic Calendar & Natural Language AI Commands
  // =========================================================================
  // 1. Global Search (/api/search?q=...)
  const searchClassRes = await apiRequest('/api/search?q=7t', 'GET', undefined, ownerToken);
  assert.equal(searchClassRes.status, 200);
  assert.equal(
    searchClassRes.data.results.some((r: any) => r.category === 'class' && r.title.toLowerCase().includes('7t')),
    true,
    'Searching "7t" must return 7t class in global search results'
  );

  const searchStudentRes = await apiRequest('/api/search?q=Sardor', 'GET', undefined, ownerToken);
  assert.equal(searchStudentRes.status, 200);
  assert.equal(
    searchStudentRes.data.results.some((r: any) => r.category === 'student' && r.title.includes('Sardor')),
    true,
    'Searching "Sardor" must return Sardor Alimov in global search results'
  );

  // 2. Natural Language Command: "8a1 sinfidagi o'quvchilarni ko'rsat"
  const cmdShowStudents = await apiRequest(
    '/api/ai/command',
    'POST',
    { command: "8a1 sinfidagi o'quvchilarni ko'rsat" },
    ownerToken
  );
  assert.equal(cmdShowStudents.status, 200);
  assert.equal(cmdShowStudents.data.parsedIntent.intent, 'show_class_students');
  assert.equal(cmdShowStudents.data.parsedIntent.classCode, '8a1');
  assert.equal(cmdShowStudents.data.students.length, 1);
  assert.equal(cmdShowStudents.data.students[0].displayName, 'Sardor Alimov');

  // 3. Natural Language Command: "10a2 sinfidagi o'quvchilarni sarala"
  const cmdSortStudents = await apiRequest(
    '/api/ai/command',
    'POST',
    { command: "10a2 sinfidagi o'quvchilarni sarala" },
    ownerToken
  );
  assert.equal(cmdSortStudents.status, 200);
  assert.equal(cmdSortStudents.data.parsedIntent.intent, 'sort_class_students');
  assert.equal(cmdSortStudents.data.parsedIntent.classCode, '10a2');

  // 4. Natural Language Command: "8a1 sinf uchun Kvadrat tenglamalar mavzusidan 10 talik test yarat"
  const aiCmdRes = await apiRequest(
    '/api/ai/command',
    'POST',
    {
      command: '8a1 sinf uchun Kvadrat tenglamalar mavzusidan 10 talik test yarat',
    },
    ownerToken
  );
  assert.equal(aiCmdRes.status, 200);
  assert.equal(aiCmdRes.data.parsedIntent.classCode, '8a1');
  assert.equal(aiCmdRes.data.questions.length, 10);

  // 5. Academic Calendar (/api/calendar) — schedule a lesson date for 7a1 and verify real events
  const first7a1LessonId = wpConfirmRes.data.lessons[0].id;
  const scheduleLessonRes = await apiRequest(
    `/api/lessons/${first7a1LessonId}`,
    'PUT',
    { scheduledDate: '2026-11-05', status: 'published' },
    ownerToken
  );
  assert.equal(scheduleLessonRes.status, 200);

  const calendarRes = await apiRequest('/api/calendar?classCode=7a1', 'GET', undefined, ownerToken);
  assert.equal(calendarRes.status, 200);
  assert.ok(calendarRes.data.events.length >= 2, 'Academic calendar must return real scheduled lessons and work plan milestones for 7a1');

  // =========================================================================
  // TEST G & TEST 7 — Security & Student Test Flow + Strict Class Isolation
  // =========================================================================
  // Student cannot import Excel student files (403)
  const studentTryImport = await apiRequest(
    '/api/students/import/preview',
    'POST',
    { fileName: 'hack.xlsx', base64Data: studentImportBase64 },
    student8a1Token
  );
  assert.equal(studentTryImport.status, 403, 'Student must receive 403 when attempting Excel student import');

  // Student cannot execute bulk student actions (403)
  const studentTryBulk = await apiRequest(
    '/api/students/bulk-action',
    'POST',
    { studentIds: ['any'], action: 'archive' },
    student8a1Token
  );
  assert.equal(studentTryBulk.status, 403, 'Student must receive 403 when attempting bulk student action');

  // Student cannot access /api/admin/overview (403)
  const studentTryAdmin = await apiRequest('/api/admin/overview', 'GET', undefined, student8a1Token);
  assert.equal(studentTryAdmin.status, 403, 'Student must receive 403 Forbidden on /api/admin/*');

  const aiAssessment = aiCmdRes.data.assessment;
  const pub8a1Res = await apiRequest(
    `/api/assessments/${aiAssessment.id}`,
    'PUT',
    { status: 'published', classId: 'class-8a1' },
    ownerToken
  );
  assert.equal(pub8a1Res.status, 200);

  // Verify 8a1 student sees the published assessment
  const state8a1Student = await apiRequest('/api/state', 'GET', undefined, student8a1Token);
  assert.equal(
    state8a1Student.data.assessments.some((a: any) => a.id === aiAssessment.id),
    true
  );

  // Verify 9t student does NOT see 8a1 assessment and cannot submit it (403)
  const state9tStudent = await apiRequest('/api/state', 'GET', undefined, student9tToken);
  assert.equal(
    state9tStudent.data.assessments.some((a: any) => a.id === aiAssessment.id),
    false
  );

  const crossClassSubmitTry = await apiRequest(
    '/api/assessments/submit',
    'POST',
    { assessmentId: aiAssessment.id, submittedMap: {} },
    student9tToken
  );
  assert.equal(crossClassSubmitTry.status, 403);

  // Student in 8a1 submits answers
  const submittedAnswers8a1: Record<string, string> = {};
  for (const q of pub8a1Res.data.assessment.questionSnapshot) {
    submittedAnswers8a1[q.id] = q.type !== 'long_text' ? q.correctAnswer : 'D = b^2 - 4ac';
  }
  const submit8a1Res = await apiRequest(
    '/api/assessments/submit',
    'POST',
    { assessmentId: aiAssessment.id, submittedMap: submittedAnswers8a1 },
    student8a1Token
  );
  assert.equal(submit8a1Res.status, 200);

  // =========================================================================
  // TEST 8 — Written Question Grading + Excel/ZIP Assessment Import
  // =========================================================================
  const validWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    validWb,
    XLSX.utils.json_to_sheet([
      {
        assessment_title: '8a1 Matematika Nazorat Testi',
        subject_code: 'MAT8',
        grade: 8,
        duration_minutes: 30,
        passing_score: 60,
        status: 'draft',
        description: '5 savol turlari bilan diagnostik test',
      },
    ]),
    'Assessment'
  );
  XLSX.utils.book_append_sheet(
    validWb,
    XLSX.utils.json_to_sheet([
      {
        question_code: 'IMP-Q01',
        subject_code: 'MAT8',
        grade: 8,
        topic_code: 'TOP-EQ',
        question_type: 'single_choice',
        difficulty: 'easy',
        points: 2,
        question_text: '2x + 6 = 14 tenglamaning ildizini toping.',
        explanation: '2x = 8 => x = 4',
        grading_mode: 'auto',
      },
      {
        question_code: 'IMP-Q05',
        subject_code: 'MAT8',
        grade: 8,
        topic_code: 'TOP-FRAC',
        question_type: 'long_text',
        difficulty: 'hard',
        points: 5,
        question_text: 'Nima uchun 1/3 + 1/6 = 1/2 ekanligini qadamma-qadam isbotlab yozing.',
        explanation: 'Umumiy maxraj 6: 2/6 + 1/6 = 3/6 = 1/2.',
        grading_mode: 'manual',
      },
    ]),
    'Questions'
  );
  XLSX.utils.book_append_sheet(
    validWb,
    XLSX.utils.json_to_sheet([
      { question_code: 'IMP-Q01', option_key: 'A', option_text: '4', is_correct: 'TRUE' },
      { question_code: 'IMP-Q01', option_key: 'B', option_text: '5', is_correct: 'FALSE' },
    ]),
    'Options'
  );
  XLSX.utils.book_append_sheet(validWb, XLSX.utils.json_to_sheet([]), 'AcceptedAnswers');
  XLSX.utils.book_append_sheet(validWb, XLSX.utils.json_to_sheet([]), 'Topics');

  const validXlsxBuffer = XLSX.write(validWb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const confirmRes = await apiRequest(
    '/api/import/confirm',
    'POST',
    {
      fileName: 'valid_test.xlsx',
      base64Data: validXlsxBuffer.toString('base64'),
      duplicatePolicy: 'update_existing',
      importMode: 'draft_assessment',
      classId: 'class-8a1',
    },
    ownerToken
  );
  assert.equal(confirmRes.status, 200);
  const importedAssessment = confirmRes.data.assessment;

  const pubImported = await apiRequest(
    `/api/assessments/${importedAssessment.id}`,
    'PUT',
    { status: 'published', classId: 'class-8a1' },
    ownerToken
  );
  assert.equal(pubImported.status, 200);

  const qByCode: Record<string, any> = {};
  for (const q of pubImported.data.assessment.questionSnapshot) {
    qByCode[q.code] = q;
  }

  const studentSubmitWrittenRes = await apiRequest(
    '/api/assessments/submit',
    'POST',
    {
      assessmentId: importedAssessment.id,
      submittedMap: {
        [qByCode['IMP-Q01'].id]: '4',
        [qByCode['IMP-Q05'].id]: 'Umumiy maxraj 6 ga keltiramiz: 2/6 + 1/6 = 3/6 = 1/2',
      },
    },
    student8a1Token
  );
  assert.equal(studentSubmitWrittenRes.status, 200);
  const writtenAttempt = studentSubmitWrittenRes.data.attempt;
  assert.equal(writtenAttempt.status, 'pending_manual_review');

  const gradeConfirmRes = await apiRequest(
    `/api/attempts/${writtenAttempt.id}/grade-answer`,
    'POST',
    {
      questionId: qByCode['IMP-Q05'].id,
      awardedPoints: 5,
      feedback: 'Isbot to‘liq va matematik jihatdan mukammal!',
    },
    ownerToken
  );
  assert.equal(gradeConfirmRes.status, 200);
  assert.equal(gradeConfirmRes.data.attempt.status, 'completed');
  assert.equal(gradeConfirmRes.data.attempt.scorePercent, 100);

  // =========================================================================
  // TEST 9 — Zero Fake Data (Counts match exact real database records)
  // =========================================================================
  const finalState = await apiRequest('/api/state', 'GET', undefined, ownerToken);
  assert.equal(finalState.status, 200);

  const realStudents = finalState.data.users.filter((u: any) => u.role === 'student');
  assert.equal(realStudents.length, 3, 'Real student count must equal exact 3 enrolled students (after rollback of imported batch)');

  const totalClassStudentCount = finalState.data.classes.reduce(
    (sum: number, c: any) => sum + c.studentCount,
    0
  );
  assert.equal(
    totalClassStudentCount,
    realStudents.length,
    'Sum of class studentCounts across all 19 classes must equal exact real student records'
  );

  assert.equal(isSafeArchivePath('../secret.png'), false);
  assert.equal(
    validateUploadedImageMeta('bad.png', 100, new Uint8Array([0x00, 0x01, 0x02, 0x03])).valid,
    false
  );

  // Reset test database so zero test artifacts pollute the workspace
  const resetEnd = await apiRequest('/api/test/reset', 'POST');
  assert.equal(resetEnd.status, 200);
});

test('SPECIALIZED STUDY — Official Mathematics Curriculum Import & Intelligent Roadmap Engine (Tests 1-12)', async () => {
  const resetStart = await apiRequest('/api/test/reset', 'POST');
  assert.equal(resetStart.status, 200);

  const ownerAuth = await apiRequest('/api/auth/bootstrap', 'POST', {
    email: 'asilbeknuraliyev43@gmail.com',
    password: 'OwnerPassword123!',
    displayName: 'Asilbek Nuraliyev',
    institutionName: 'Specialized Study Maktabi',
    academicYear: '2026-2027',
  });
  assert.equal(ownerAuth.status, 200);
  const ownerToken: string = ownerAuth.data.token;

  // =========================================================================
  // TEST 1, 2, 3, 4, 5, 6, 7 — Official ZIP Archive Preview, Header Normalization,
  // 21 Workbooks, 2,516 Rows, Class Mapping, T-Track Policy, Quarters & Event Classification
  // =========================================================================
  const previewRes = await apiRequest(
    '/api/curriculum-zip/official-preview',
    'GET',
    undefined,
    ownerToken
  );
  assert.equal(previewRes.status, 200, 'Official ZIP archive preview must return 200');
  const preview = previewRes.data.preview;

  // Test 1: 21 workbooks (12 A-track + 9 T-track)
  assert.equal(preview.totalFiles, 21, 'Must detect exactly 21 XLSX workbooks');
  assert.equal(preview.aTrackFiles, 12, 'Must detect 12 A-track workbooks');
  assert.equal(preview.tTrackFiles, 9, 'Must detect 9 T-track workbooks');

  // Test 3: Total row count = 2,516 (1,666 A-track + 850 T-track)
  assert.equal(preview.totalLessons, 2516, 'Total non-empty lesson rows must equal 2,516');
  assert.equal(preview.totalHours, 2516, 'Total lesson hours must equal 2,516');

  const aTrackLessonsCount = preview.workbooks
    .filter((w: any) => w.track === 'A')
    .reduce((s: number, w: any) => s + w.totalLessons, 0);
  const tTrackLessonsCount = preview.workbooks
    .filter((w: any) => w.track === 'T')
    .reduce((s: number, w: any) => s + w.totalLessons, 0);
  assert.equal(aTrackLessonsCount, 1666, 'A-track total lessons must equal 1,666');
  assert.equal(tTrackLessonsCount, 850, 'T-track total lessons must equal 850');

  // Test 6: Exact Quarter Breakdown (666 / 518 / 740 / 592)
  assert.equal(preview.quarterBreakdown[1], 666, '1-chorak must contain 666 lessons');
  assert.equal(preview.quarterBreakdown[2], 518, '2-chorak must contain 518 lessons');
  assert.equal(preview.quarterBreakdown[3], 740, '3-chorak must contain 740 lessons');
  assert.equal(preview.quarterBreakdown[4], 592, '4-chorak must contain 592 lessons');
  assert.equal(
    preview.quarterBreakdown[1] +
      preview.quarterBreakdown[2] +
      preview.quarterBreakdown[3] +
      preview.quarterBreakdown[4],
    2516
  );

  // Test 4: Class Mapping Verification (never 5t or 6t; parallel classes shared)
  const allAssignedCodes = new Set<string>();
  for (const wb of preview.workbooks) {
    for (const c of wb.assignedClassCodes) {
      allAssignedCodes.add(c);
    }
    if (wb.track === 'A') {
      assert.equal(
        wb.assignedClassCodes.length,
        2,
        `A-track workbook ${wb.fileName} must map to 2 parallel classes`
      );
      assert.equal(wb.additionalCurriculumAssignment, false);
    } else {
      assert.equal(
        wb.assignedClassCodes.length,
        1,
        `T-track workbook ${wb.fileName} must map to 1 T-track class`
      );
      assert.equal(wb.additionalCurriculumAssignment, true);
    }
  }
  assert.equal(allAssignedCodes.has('5t'), false, '5t must never be mapped');
  assert.equal(allAssignedCodes.has('6t'), false, '6t must never be mapped');
  assert.equal(allAssignedCodes.size, 19, 'All 19 official classes must be covered');

  // Test 7: Raw lesson types & normalized event categories (BSB, CHSB, Project, Review/Analysis)
  assert.equal(preview.lessonTypeBreakdown['Oddiy dars-31'], 2273);
  assert.equal(preview.lessonTypeBreakdown['Yozma ish-41'], 151);
  assert.equal(preview.lessonTypeBreakdown['Choraklik summativ baholash-39'], 84);
  assert.equal(preview.lessonTypeBreakdown['Loyiha ishi-35'], 7);
  assert.equal(preview.lessonTypeBreakdown['Oddiy dars-32'], 1);
  assert.equal(
    preview.eventCategoryBreakdown['REVIEW_AND_ANALYSIS'],
    200,
    'BSB tahlili and CHSB tahlili lessons must be classified as REVIEW_AND_ANALYSIS'
  );
  assert.equal(preview.eventCategoryBreakdown['WRITTEN_ASSESSMENT'], 151);
  assert.equal(preview.eventCategoryBreakdown['QUARTERLY_ASSESSMENT'], 88);
  assert.equal(preview.eventCategoryBreakdown['PROJECT_WORK'], 15);

  // =========================================================================
  // Confirm Official ZIP Archive Import & Test 8 (Idempotent Re-Import & Edit Preservation)
  // =========================================================================
  const confirmZipRes = await apiRequest(
    '/api/curriculum-zip/confirm',
    'POST',
    {
      useOfficialAttachedArchive: true,
      academicYear: '2026-2027',
      publishImmediately: true,
      tTrackVisibilityApproved: false,
    },
    ownerToken
  );
  assert.equal(confirmZipRes.status, 200, 'Confirming official ZIP import must return 200');
  assert.equal(confirmZipRes.data.workPlansCount, 21, 'Must persist 21 workPlans');
  assert.equal(confirmZipRes.data.lessonsCount, 2516, 'Must persist 2,516 lessons');

  // Modify a lesson's topicTitle and verify modificationHistory + originalSourceSnapshot
  const lessons8a1Res = await apiRequest(
    '/api/lessons?classCode=8a1&curriculumArea=Algebra',
    'GET',
    undefined,
    ownerToken
  );
  assert.equal(lessons8a1Res.status, 200);
  assert.equal(lessons8a1Res.data.lessons.length, 136, '8a1 Algebra must have 136 lessons');

  const lessons8a2Res = await apiRequest(
    '/api/lessons?classCode=8a2&curriculumArea=Algebra',
    'GET',
    undefined,
    ownerToken
  );
  assert.equal(lessons8a2Res.status, 200);
  assert.equal(
    lessons8a2Res.data.lessons.length,
    136,
    '8a2 Algebra must share the same 136 lessons without duplication'
  );
  assert.equal(lessons8a1Res.data.lessons[0].id, lessons8a2Res.data.lessons[0].id);

  const firstAlgebraLesson = lessons8a1Res.data.lessons[0];
  const originalTitle = firstAlgebraLesson.topicTitle;
  const editLessonRes = await apiRequest(
    `/api/lessons/${firstAlgebraLesson.id}`,
    'PUT',
    {
      topicTitle: `${originalTitle} (Tahrirlangan)`,
      homework: 'Maxsus algebraik mashqlar 1-10',
    },
    ownerToken
  );
  assert.equal(editLessonRes.status, 200);
  assert.equal(editLessonRes.data.lesson.topicTitle, `${originalTitle} (Tahrirlangan)`);
  assert.equal(editLessonRes.data.lesson.originalSourceSnapshot.topicTitle, originalTitle);
  assert.ok(editLessonRes.data.lesson.modificationHistory.length >= 1);

  // Re-import the exact same ZIP archive (Test 8: Idempotency & Edit Preservation)
  const reImportZipRes = await apiRequest(
    '/api/curriculum-zip/confirm',
    'POST',
    {
      useOfficialAttachedArchive: true,
      academicYear: '2026-2027',
      publishImmediately: true,
      tTrackVisibilityApproved: false,
    },
    ownerToken
  );
  assert.equal(reImportZipRes.status, 200);
  assert.equal(reImportZipRes.data.workPlansCount, 21, 'Re-importing must NOT duplicate workPlans');
  assert.equal(reImportZipRes.data.lessonsCount, 2516, 'Re-importing must NOT duplicate lessons');

  const checkEditedAfterReimport = await apiRequest(
    '/api/lessons?classCode=8a1&curriculumArea=Algebra',
    'GET',
    undefined,
    ownerToken
  );
  assert.equal(
    checkEditedAfterReimport.data.lessons[0].topicTitle,
    `${originalTitle} (Tahrirlangan)`,
    'Manually edited lesson title must be preserved across idempotent re-import'
  );

  // =========================================================================
  // TEST 9, 10, 11 — Single Lesson, BSB/CHSB Milestone Blueprint & Batch AI Test Generation
  // =========================================================================
  // Test 9: Single Lesson Test Generation
  const singleTestRes = await apiRequest(
    `/api/lessons/${firstAlgebraLesson.id}/generate-test`,
    'POST',
    {
      questionCount: 4,
      difficulty: 'medium',
      questionTypes: ['single_choice', 'numeric'],
      durationMinutes: 25,
      maxPoints: 20,
      publishImmediately: true,
    },
    ownerToken
  );
  assert.equal(singleTestRes.status, 200);
  assert.equal(singleTestRes.data.assessment.lessonId, firstAlgebraLesson.id);
  assert.equal(singleTestRes.data.assessment.curriculumArea, 'Algebra');
  assert.deepEqual(singleTestRes.data.assessment.assignedClassCodes, ['8a1', '8a2']);
  assert.equal(singleTestRes.data.questions.length, 4);

  // Test 10: BSB / CHSB Milestone Blueprint Test Generation
  const bsbLesson = lessons8a1Res.data.lessons.find(
    (l: any) => l.eventCategory === 'WRITTEN_ASSESSMENT'
  );
  assert.ok(bsbLesson, '8a1 Algebra must contain a WRITTEN_ASSESSMENT (BSB) lesson');
  assert.ok(
    bsbLesson.precedingLessonIds && bsbLesson.precedingLessonIds.length > 0,
    'BSB lesson must track precedingLessonIds for blueprint generation'
  );

  const bsbTestRes = await apiRequest(
    `/api/lessons/${bsbLesson.id}/generate-test`,
    'POST',
    {
      questionCount: 6,
      difficulty: 'mixed',
      publishImmediately: true,
    },
    ownerToken
  );
  assert.equal(bsbTestRes.status, 200);
  assert.equal(bsbTestRes.data.assessment.maxPoints, bsbLesson.maxPoints || 25);
  assert.ok(
    bsbTestRes.data.assessment.blueprintLessonIds.length > 1,
    'BSB milestone assessment must include preceding lessons in blueprintLessonIds'
  );

  // Test 11: Multi-Lesson Batch Test Generation
  const batchIds = lessons8a1Res.data.lessons.slice(0, 3).map((l: any) => l.id);
  const batchTestRes = await apiRequest(
    '/api/lessons/batch-generate-tests',
    'POST',
    {
      lessonIds: batchIds,
      title: '8-sinf Algebra 1–3-darslar umumlashgan testi',
      questionCount: 6,
      publishImmediately: true,
    },
    ownerToken
  );
  assert.equal(batchTestRes.status, 200);
  assert.equal(batchTestRes.data.assessment.blueprintLessonIds.length, 3);
  assert.equal(batchTestRes.data.questions.length, 6);

  // =========================================================================
  // TEST 12 — Student Visibility Rules (Shared A-Track & Gated T-Track Visibility)
  // =========================================================================
  const enroll8a2 = await apiRequest(
    '/api/admin/students',
    'POST',
    {
      displayName: 'Dilshod Rakhimov',
      email: 'dilshod.8a2@specialized.uz',
      password: 'StudentPassword123!',
      classId: 'class-8a2',
      studentCode: 'STD-8A2-01',
    },
    ownerToken
  );
  assert.equal(enroll8a2.status, 200);
  const login8a2 = await apiRequest('/api/auth/login', 'POST', {
    email: 'dilshod.8a2@specialized.uz',
    password: 'StudentPassword123!',
  });
  const token8a2 = login8a2.data.token;

  const state8a2 = await apiRequest('/api/state', 'GET', undefined, token8a2);
  assert.equal(state8a2.status, 200);
  // 8a2 has 136 Algebra + 102 Geometriya = 238 lessons
  assert.equal(
    state8a2.data.lessons.length,
    238,
    '8a2 student must see all 238 shared grade-8 A-track lessons (136 Algebra + 102 Geometriya)'
  );
  assert.ok(
    state8a2.data.assessments.some((a: any) => a.id === singleTestRes.data.assessment.id),
    '8a2 student must see assessment generated for shared 8a1/8a2 lesson'
  );

  // Enroll a 9t student and check T-track visibility gating
  const enroll9t = await apiRequest(
    '/api/admin/students',
    'POST',
    {
      displayName: 'Aziza Karimova',
      email: 'aziza.9t@specialized.uz',
      password: 'StudentPassword123!',
      classId: 'class-9t',
      studentCode: 'STD-9T-02',
    },
    ownerToken
  );
  assert.equal(enroll9t.status, 200);
  const login9t = await apiRequest('/api/auth/login', 'POST', {
    email: 'aziza.9t@specialized.uz',
    password: 'StudentPassword123!',
  });
  const token9t = login9t.data.token;

  const state9tHidden = await apiRequest('/api/state', 'GET', undefined, token9t);
  assert.equal(
    state9tHidden.data.lessons.length,
    0,
    '9t student must see 0 T-track math lessons while tTrackVisibilityApproved is false'
  );

  // Admin approves T-track math visibility
  const approveTTrackRes = await apiRequest(
    '/api/curriculum-zip/t-track-visibility',
    'PUT',
    { approved: true },
    ownerToken
  );
  assert.equal(approveTTrackRes.status, 200);

  const state9tVisible = await apiRequest('/api/state', 'GET', undefined, token9t);
  assert.equal(
    state9tVisible.data.lessons.length,
    170,
    '9t student must see 170 T-track math lessons (102 Algebra + 68 Geometriya) once approved by Admin'
  );

  const resetEnd = await apiRequest('/api/test/reset', 'POST');
  assert.equal(resetEnd.status, 200);
});

