export function cleanupDemoExams(db: any, schoolId: string, users: ReadonlySet<unknown>) {
  const exams = new Set((db.assessments || []).filter((a: any) => a.institutionId === schoolId && users.has(a.teacherId)).map((a: any) => a.id));
  if (['attempts', 'examSessions'].some(name => (db[name] || []).some((r: any) => exams.has(r.assessmentId) && !users.has(r.studentId)))) return false;
  const questions = new Set((db.assessments || []).filter((a: any) => exams.has(a.id)).flatMap((a: any) => a.questionIds || []));
  const attempts = new Set((db.attempts || []).filter((a: any) => a.institutionId === schoolId && (users.has(a.studentId) || exams.has(a.assessmentId))).map((a: any) => a.id));
  db.assessments = (db.assessments || []).filter((a: any) => !exams.has(a.id));
  db.questions = (db.questions || []).filter((q: any) => !questions.has(q.id));
  for (const name of ['attempts', 'examSessions', 'assignments', 'gradingRecords']) db[name] = (db[name] || []).filter((r: any) => r.institutionId !== schoolId || !(exams.has(r.assessmentId) || attempts.has(r.attemptId) || users.has(r.studentId)));
  return true;
}
