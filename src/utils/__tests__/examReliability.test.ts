import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { registerExamReliabilityRoutes } from "../../server/examReliabilityRoutes";
import {
  LocalExamSessionStore,
  examSessionKey,
} from "../../server/examSessionStore";
import { finiteScoreOrFallback } from "../examReliability";
async function fixture(run: (v: any) => Promise<void>) {
  let now = Date.now(),
    failProjection = false,
    saves = 0;
  const teacher = {
      uid: "t",
      role: "teacher",
      status: "active",
      institutionId: "s",
      subject: "Math",
      assignedClassIds: ["c"],
      displayName: "DEMO teacher",
    },
    student = {
      uid: "u",
      role: "student",
      status: "active",
      institutionId: "s",
      classId: "c",
      classCode: "8a2",
      displayName: "DEMO learner",
    },
    people: any = {
      student,
      teacher,
      other: { ...teacher, uid: "other" },
      foreign: { ...student, uid: "foreign", institutionId: "different" },
      wrong: { ...student, uid: "wrong", classId: "no", classCode: "7a1" },
    };
  const exam = {
      id: "exam",
      examKind: "BSB",
      title: "DEMO BSB",
      institutionId: "s",
      subject: "Math",
      teacherId: "t",
      classId: "c",
      classCode: "8a2",
      assignedClassIds: ["c"],
      assignedClassCodes: ["8a2"],
      questionIds: ["q"],
      questionSnapshot: [
        {
          id: "q",
          institutionId: "s",
          type: "single_choice",
          prompt: "DEMO 2+2",
          correctAnswer: "4",
          options: ["3", "4"],
          points: 5,
          gradingMode: "automatic",
          topicId: "topic",
        },
      ],
      durationMinutes: 10,
      dueDate: new Date(now + 7200000).toISOString(),
      availableFrom: new Date(now - 1000).toISOString(),
      createdAt: new Date(now - 1000).toISOString(),
      status: "published",
      examState: "open",
    },
    db: any = {
      users: Object.values(people),
      assessments: [exam],
      questions: exam.questionSnapshot,
      attempts: [],
      topics: [],
      auditLogs: [],
      examSessions: [],
    };
  const store = new LocalExamSessionStore(),
    app = express();
  app.use(express.json());
  registerExamReliabilityRoutes(app, {
    examStore: store,
    now: () => now,
    authenticate: (req: any) =>
      people[req.headers.authorization]
        ? { user: people[req.headers.authorization], db, env: "test" }
        : null,
    save: () => {
      saves++;
      if (failProjection) {
        failProjection = false;
        db.attempts = [];
        db.schoolAuditEvents = [];
        throw Error("simulated projection failure");
      }
    },
  });
  app.get("/api/unrelated", (_q, r) => r.json({ ok: true }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const call = async (
    path: string,
    body?: any,
    who = "student",
    method = body ? "POST" : "GET",
  ) => {
    const r = await fetch(
      `http://127.0.0.1:${(server.address() as any).port}/api${path}`,
      {
        method,
        headers: { Authorization: who, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    return { status: r.status, data: await r.json() };
  };
  try {
    await run({
      db,
      store,
      call,
      exam,
      clock: () => now,
      advance: (ms: number) => (now += ms),
      fail: () => (failProjection = true),
      saves: () => saves,
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
const op = () => crypto.randomUUID();
const start = (call: any, clientId = op()) =>
  call("/exams/exam/start-v2", { operationId: op(), clientId }).then(
    (r: any) => ({ ...r, clientId }),
  );
test("independent autosave ACK replay is idempotent, operation collision/stale revision are rejected, unrelated routes still work", () =>
  fixture(async ({ call, db, saves }: any) => {
    assert.equal((await call("/unrelated", undefined, "")).status, 200);
    assert.equal(
      (
        await call(
          "/exams/exam/start-v2",
          { operationId: op(), clientId: op() },
          "",
        )
      ).status,
      401,
    );
    const a = await start(call);
    assert.equal(a.status, 200);
    const packet = {
      operationId: op(),
      clientId: a.clientId,
      epoch: a.data.session.epoch,
      revision: 0,
      answers: { q: "4" },
    };
    const first = await call(
      "/exams/exam/session-v2",
      packet,
      "student",
      "PUT",
    );
    assert.equal(first.status, 200);
    assert.equal(first.data.session.revision, 1);
    assert.equal(
      (await call("/exams/exam/session-v2", packet, "student", "PUT")).data
        .duplicate,
      true,
    );
    assert.equal(
      (
        await call(
          "/exams/exam/session-v2",
          { ...packet, answers: { q: "3" } },
          "student",
          "PUT",
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await call(
          "/exams/exam/session-v2",
          { ...packet, operationId: op() },
          "student",
          "PUT",
        )
      ).data.code,
      "REVISION_CONFLICT",
    );
    assert.equal(saves(), 0);
    assert.deepEqual(db.examSessions, []);
  }));
test("second window remains read-only until explicit takeover; old owner cannot overwrite a newer lease", () =>
  fixture(async ({ call }: any) => {
    const a = await start(call),
      b = await start(call);
    assert.equal(b.data.canWrite, false);
    const taken = await call("/exams/exam/takeover-v2", {
      operationId: op(),
      clientId: b.clientId,
      epoch: b.data.session.epoch,
      revision: 0,
    });
    assert.equal(taken.status, 200);
    const old = await call(
      "/exams/exam/session-v2",
      {
        operationId: op(),
        clientId: a.clientId,
        epoch: a.data.session.epoch,
        revision: 0,
        answers: { q: "3" },
      },
      "student",
      "PUT",
    );
    assert.equal(old.data.code, "WINDOW_CONFLICT");
    assert.equal(
      (
        await call(
          "/exams/exam/session-v2",
          {
            operationId: op(),
            clientId: b.clientId,
            epoch: taken.data.session.epoch,
            revision: 0,
            answers: { q: "4" },
          },
          "student",
          "PUT",
        )
      ).status,
      200,
    );
  }));
test("third tab event freezes without cheating verdict or auto submission; deduplicated event and scoped human review reopen with audited extension", () =>
  fixture(async ({ call, db }: any) => {
    const a = await start(call),
      body = {
        operationId: op(),
        clientId: a.clientId,
        epoch: a.data.session.epoch,
        kind: "tab_hidden",
      };
    await call("/exams/exam/exit-v2", body);
    await call("/exams/exam/exit-v2", body);
    await call("/exams/exam/exit-v2", { ...body, operationId: op() });
    const stopped = (
      await call("/exams/exam/exit-v2", { ...body, operationId: op() })
    ).data;
    assert.equal(stopped.session.exitCount, 3);
    assert.equal(stopped.state, "review_required");
    assert.equal(db.attempts.length, 0);
    assert.equal(
      (
        await call("/exams/exam/finish-v2", {
          operationId: op(),
          clientId: a.clientId,
          epoch: a.data.session.epoch,
        })
      ).status,
      423,
    );
    const review = {
      operationId: op(),
      studentId: "u",
      revision: 0,
      reason: "DEMO system call confirmed",
      minutes: 10,
    };
    assert.equal(
      (await call("/exams/exam/review-v2", review, "other")).status,
      403,
    );
    assert.equal(
      (await call("/exams/exam/review-v2", review, "teacher")).status,
      200,
    );
    assert.equal(
      (await call("/exams/exam/review-v2", review, "teacher")).status,
      200,
    );
    const monitor = (await call("/exams/exam/monitor-v2", undefined, "teacher"))
      .data;
    assert.equal(monitor.rows[0].reviews.length, 1);
    assert.equal(monitor.rows[0].stoppedAt, undefined);
    assert.equal(
      (await call("/exams/exam/monitor-v2", undefined, "student")).status,
      403,
    );
  }));
test("deadline rejects late answers; durable receipt survives projection failure/retry and never exposes formal keys", () =>
  fixture(async ({ call, advance, fail, db }: any) => {
    const a = await start(call),
      base = { clientId: a.clientId, epoch: a.data.session.epoch };
    await call(
      "/exams/exam/session-v2",
      { ...base, operationId: op(), revision: 0, answers: { q: "4" } },
      "student",
      "PUT",
    );
    advance(601000);
    assert.equal(
      (
        await call(
          "/exams/exam/session-v2",
          { ...base, operationId: op(), revision: 1, answers: { q: "3" } },
          "student",
          "PUT",
        )
      ).status,
      410,
    );
    const finish = { ...base, operationId: op() };
    fail();
    assert.equal((await call("/exams/exam/finish-v2", finish)).status, 503);
    const receipt = (await call("/exams/exam/receipt-v2")).data;
    assert.ok(receipt.receipt.id.startsWith("SS-"));
    assert.equal(receipt.projectionPending, true);
    const done = await call("/exams/exam/finish-v2", finish);
    assert.equal(done.status, 200);
    assert.equal(done.data.receipt.id, receipt.receipt.id);
    assert.equal(done.data.receipt.reason, "deadline");
    assert.equal(done.data.attempt.answers[0].selectedAnswer, "4");
    assert.equal(done.data.attempt.answers[0].correctAnswer, "");
    assert.equal(
      (await call("/exams/exam/finish-v2", finish)).data.receipt.id,
      receipt.receipt.id,
    );
    assert.equal(db.attempts.length, 1);
    assert.equal(
      (await call("/exams/exam/receipt-v2", undefined, "foreign")).status,
      403,
    );
    assert.equal(
      (await call("/exams/exam/start", { clientId: a.clientId })).status,
      426,
    );
  }));
test("offline events survive window takeover, but events predating human reopening never penalize the new phase", () =>
  fixture(async ({ call, store }: any) => {
    const a = await start(call),
      b = await start(call);
    await call("/exams/exam/takeover-v2", {
      operationId: op(),
      clientId: b.clientId,
      epoch: b.data.session.epoch,
      revision: 0,
    });
    const first = {
      operationId: op(),
      clientId: a.clientId,
      epoch: a.data.session.epoch,
      kind: "tab_hidden",
    };
    await call("/exams/exam/exit-v2", first);
    await store.change(examSessionKey("s", "exam", "u"), (s: any) => {
      s.operations = [];
      return { session: s, result: true };
    });
    await call("/exams/exam/exit-v2", first);
    await call("/exams/exam/exit-v2", { ...first, operationId: op() });
    const stop = await call("/exams/exam/exit-v2", {
      ...first,
      operationId: op(),
    });
    assert.equal(stop.data.session.exitCount, 3);
    assert.equal(stop.data.state, "review_required");
    await call(
      "/exams/exam/review-v2",
      {
        operationId: op(),
        studentId: "u",
        revision: 0,
        reason: "DEMO human system dialog review",
        minutes: 10,
      },
      "teacher",
    );
    const late = await call("/exams/exam/exit-v2", {
      ...first,
      operationId: op(),
    });
    assert.equal(late.data.session.exitCount, 0);
    assert.equal(late.data.session.stoppedAt, undefined);
  }));
test("independent learner transactions do not serialize behind another learner; zero AI score is retained and invalid values fall back", async () => {
  const store = new LocalExamSessionStore(),
    base: any = {
      id: "s",
      institutionId: "s",
      assessmentId: "a",
      studentId: "u",
      answers: {},
      revision: 0,
    };
  await Promise.all(
    Array.from({ length: 1000 }, (_, i) =>
      store.change(examSessionKey("s", "a", "u" + i), () => ({
        session: { ...base, studentId: "u" + i },
        result: i,
      })),
    ),
  );
  assert.equal(
    (await store.read(examSessionKey("s", "a", "u999")))?.studentId,
    "u999",
  );
  assert.equal(finiteScoreOrFallback(0, 7, 10), 0);
  assert.equal(finiteScoreOrFallback("", 7, 10), 7);
  assert.equal(finiteScoreOrFallback("oops", 7, 10), 7);
  assert.equal(finiteScoreOrFallback(12, 7, 10), 10);
});
