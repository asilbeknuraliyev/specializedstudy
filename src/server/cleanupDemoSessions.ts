import { examSessionStore } from "./examSessionStore";
import { runtimeNamespace } from "./runtimeScope";
export async function cleanupDemoSessions(db: any, demo: any) {
  if (!runtimeNamespace().startsWith("_specialized_preview_"))
    throw Error("Preview only");
  const users = new Set<string>(demo.userIds);
  if ([...users].some((u) => !u.startsWith(demo.id + "-")))
    throw Error("Invalid DEMO ownership");
  const exams = (db.assessments || []).filter(
    (a: any) => a.institutionId === demo.schoolId && users.has(a.teacherId),
  );
  const examIds = new Set(exams.map((a: any) => a.id));
  if (
    ["attempts", "examSessions"].some((name) =>
      (db[name] || []).some(
        (s: any) => examIds.has(s.assessmentId) && !users.has(s.studentId),
      ),
    )
  )
    throw Error("A non-DEMO legacy participant requires separate review");
  const store = examSessionStore(),
    keys: string[] = [];
  for (const exam of exams) {
    let after: string | undefined;
    do {
      const rows = await store.list(demo.schoolId, exam.id, after);
      if (rows.some((r) => !users.has(r.session.studentId)))
        throw Error("A non-DEMO learner session requires separate review");
      keys.push(...rows.map((r) => r.key));
      after = rows.length === 50 ? rows.at(-1)!.key : undefined;
    } while (after);
  }
  for (const key of keys) await store.deleteFixture(key);
  return keys.length;
}
