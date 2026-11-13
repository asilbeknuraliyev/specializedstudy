import crypto from "node:crypto";
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export class MergeConflictError extends Error {}
function atomic(base: any, local: any, remote: any): any {
  if (same(base, local)) return remote;
  if (same(base, remote)) return local;
  throw new MergeConflictError("The same record changed concurrently");
}
// Merge disjoint entity changes only. A user, lesson, or session is atomic;
// counters and same-record edits never silently overwrite one another.
export function mergeState(base: any, local: any, remote: any): any {
  const result: any = {};
  for (const key of new Set([
    ...Object.keys(base),
    ...Object.keys(local),
    ...Object.keys(remote),
  ])) {
    const b = base[key],
      l = local[key],
      r = remote[key];
    if (same(b, l)) {
      result[key] = r;
      continue;
    }
    if (same(b, r)) {
      result[key] = l;
      continue;
    }
    const entityKey = (row: any) =>
      row &&
      typeof row === "object" &&
      (typeof row.id === "string"
        ? row.id
        : typeof row.uid === "string"
          ? row.uid
          : null);
    if (
      [b, l, r].every(Array.isArray) &&
      [b, l, r].every(
        (a) =>
          a.every((v: any) => entityKey(v)) &&
          new Set(a.map(entityKey)).size === a.length,
      )
    ) {
      if (key === "schoolAuditEvents") {
        if (
          b.some(
            (event: any) =>
              !same(
                event,
                l.find((v: any) => v.id === event.id),
              ) ||
              !same(
                event,
                r.find((v: any) => v.id === event.id),
              ),
          )
        )
          throw new MergeConflictError("Committed audit events are immutable");
        const ids = new Set(b.map((v: any) => v.id)),
          remoteIds = new Set(r.map((v: any) => v.id)),
          merged = [...r];
        for (const event of l.filter((v: any) => !ids.has(v.id))) {
          if (remoteIds.has(event.id)) {
            if (
              !same(
                event,
                r.find((v: any) => v.id === event.id),
              )
            )
              throw new MergeConflictError("Audit event differs");
            continue;
          }
          const previous =
            merged.filter((v: any) => v.schoolId === event.schoolId).at(-1)
              ?.hash || "genesis";
          const { hash, ...unsigned } = { ...event, previous };
          merged.push({
            ...unsigned,
            hash: crypto
              .createHash("sha256")
              .update(JSON.stringify(unsigned))
              .digest("hex"),
          });
        }
        result[key] = merged;
        continue;
      }
      if (
        ![
          "reinforcementSessions",
          "pilotPrograms",
          "learningConsents",
          "dataDeletionRequests",
          "dataDeletionPreviews",
          "schoolRetentionPolicies",
          "disciplinePeriods",
          "disciplinePolicies",
          "disciplineTypes",
          "disciplineRecords",
          "disciplineTotals",
          "disciplineCases",
          "disciplineAppeals",
          "warningLetters",
          "disciplineCorrections",
          "schoolAuditEvents",
          "schoolOperations",
          "assessments",
          "questions",
          "attempts",
          "gradingRecords",
          "attendanceSessions",
          "attendanceRecords",
          "studentAssignments",
          "assignmentSubmissions",
          "submissionRevisions",
          "studentSupportPlans",
          "learningMaterials",
          "announcements",
          "topicAnalysisFacts",
          "topicAnalysisCohorts",
          "mistakeRecords",
          "spacedReviewQueue",
          "spacedReviewSessions",
          "spacedReviewAnswers",
          "reviewDailyUsage",
          "studentTopicProgress",
          "topicWriteOperations",
          "topicQuestionVersions",
          "topicTestVersions",
          "users",
          "topicImportBatches",
          "topicQuestions",
          "topicTests",
          "topicSessions",
          "topicReviews",
          "examSessions",
          "lessonPracticeResponses",
          "studentLastLessons",
          "auditLogs",
          "notifications",
        ].includes(key)
      )
        throw new MergeConflictError("Collection invariants require a retry");
      const maps = [b, l, r].map(
        (a) => new Map(a.map((v: any) => [entityKey(v), v])),
      );
      const ids = new Set([
        ...r.map(entityKey),
        ...l.map(entityKey),
        ...b.map(entityKey),
      ]);
      result[key] = [...ids]
        .map((id) => atomic(...(maps.map((m) => m.get(id)) as [any, any, any])))
        .filter((v) => v !== undefined);
    } else if (
      [b, l, r].every((v) => v && typeof v === "object" && !Array.isArray(v))
    ) {
      const merged: any = {};
      for (const id of new Set([
        ...Object.keys(b),
        ...Object.keys(l),
        ...Object.keys(r),
      ])) {
        const value = atomic(b[id], l[id], r[id]);
        if (value !== undefined) merged[id] = value;
      }
      result[key] = merged;
    } else result[key] = atomic(b, l, r);
  }

  if (result.users) {
    const identities = new Map<string, string>();
    for (const user of result.users)
      for (const raw of [
        user.login,
        user.email,
        user.linkedGoogleUid,
        ...(user.loginAliases || []),
      ]) {
        if (!raw) continue;
        const value = String(raw).toLowerCase();
        if (identities.has(value) && identities.get(value) !== user.uid)
          throw new MergeConflictError("Account identity must remain unique");
        identities.set(value, user.uid);
      }
  }
  if (base.topicSessions && local.topicSessions && remote.topicSessions) {
    const added = (rows: any[]) =>
      rows.filter((s) => !base.topicSessions.some((b: any) => b.id === s.id));
    if (
      added(local.topicSessions).some(
        (s: any) =>
          s.studentId &&
          s.testId &&
          added(remote.topicSessions).some(
            (r: any) =>
              r.id !== s.id &&
              r.studentId === s.studentId &&
              r.testId === s.testId,
          ),
      )
    )
      throw new MergeConflictError("Concurrent starts must retry");
  }
  if (
    base.spacedReviewSessions &&
    local.spacedReviewSessions &&
    remote.spacedReviewSessions
  ) {
    const added = (rows: any[]) =>
      rows.filter(
        (s) =>
          s.status === "active" &&
          !base.spacedReviewSessions.some((b: any) => b.id === s.id),
      );
    if (
      added(local.spacedReviewSessions).some((s: any) =>
        added(remote.spacedReviewSessions).some(
          (r: any) =>
            r.id !== s.id &&
            r.schoolId === s.schoolId &&
            r.studentId === s.studentId,
        ),
      )
    )
      throw new MergeConflictError("Concurrent review starts must retry");
  }
  if (
    base.reinforcementSessions &&
    local.reinforcementSessions &&
    remote.reinforcementSessions
  ) {
    const added = (rows: any[]) =>
      rows.filter(
        (s) => !base.reinforcementSessions.some((b: any) => b.id === s.id),
      );
    if (
      added(local.reinforcementSessions).some((s: any) =>
        added(remote.reinforcementSessions).some(
          (r: any) =>
            r.id !== s.id &&
            r.schoolId === s.schoolId &&
            r.studentId === s.studentId,
        ),
      )
    )
      throw new MergeConflictError("Concurrent practice starts must retry");
  }
  if (base.examSessions && local.examSessions && remote.examSessions) {
    const added = (rows: any[]) =>
      rows.filter((s) => !base.examSessions.some((b: any) => b.id === s.id));
    if (
      added(local.examSessions).some((s: any) =>
        added(remote.examSessions).some(
          (r: any) =>
            r.id !== s.id &&
            s.institutionId &&
            s.studentId &&
            s.assessmentId &&
            r.institutionId === s.institutionId &&
            r.studentId === s.studentId &&
            r.assessmentId === s.assessmentId,
        ),
      )
    )
      throw new MergeConflictError("Concurrent formal exam starts must retry");
  }
  if (base.assessments && local.assessments && remote.assessments) {
    const changed = (rows: any[]) =>
      rows.filter(
        (a) =>
          a.examKind &&
          !same(
            a,
            base.assessments.find((b: any) => b.id === a.id),
          ),
      );
    if (
      changed(local.assessments).some((a: any) =>
        changed(remote.assessments).some(
          (r: any) =>
            a.id !== r.id &&
            a.institutionId === r.institutionId &&
            a.subject === r.subject &&
            a.academicYear === r.academicYear &&
            a.examKind === r.examKind &&
            a.examNumber === r.examNumber &&
            a.quarter === r.quarter &&
            (a.assignedClassCodes || []).some((code: string) =>
              r.assignedClassCodes?.includes(code),
            ) &&
            ((a.status === "published" && r.status === "published") ||
              (a.sourceHash &&
                a.sourceHash === r.sourceHash &&
                a.teacherId === r.teacherId)),
        ),
      )
    )
      throw new MergeConflictError(
        "Concurrent duplicate formal exams must retry",
      );
  }
  return result;
}
