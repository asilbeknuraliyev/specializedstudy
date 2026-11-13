import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { publicStudentAttempt } from "../examPolicy";
import { registerAiAccessGuard } from "../../server/aiAccessGuard";
const formal: any = {
    id: "formal",
    institutionId: "s",
    title: "DEMO 1-BSB",
    examKind: "BSB",
  },
  practice: any = {
    ...formal,
    id: "practice",
    title: "DEMO mavzu mashqi",
    examKind: undefined,
  };
const attempt = (assessmentId = "formal"): any => ({
  id: assessmentId + "-attempt",
  institutionId: "s",
  assessmentId,
  studentId: "u",
  assessmentTitle: assessmentId === "formal" ? "DEMO BSB" : "DEMO mashq",
  scorePercent: 70,
  totalQuestions: 1,
  correctCount: 0,
  status: "completed",
  submittedAt: "2026-11-13T05:00:00Z",
  topicBreakdown: [],
  aiAnalysis: { summary: "PRIVATE_AI_KEY" },
  privateFutureField: "PRIVATE_ROOT",
  answers: [
    {
      questionId: "q",
      topicId: "topic",
      questionType: "single_choice",
      prompt: "DEMO 2 + 2",
      selectedAnswer: "2",
      correctAnswer: "PRIVATE_KEY",
      explanation: "PRIVATE_EXPLANATION",
      rubricText: "PRIVATE_RUBRIC",
      aiSuggestedFeedback: "PRIVATE_AI_SUGGESTION",
      privateFutureField: "PRIVATE_ANSWER",
      isCorrect: false,
      maxPoints: 1,
      teacherFeedback: "Keyingi safar yechim qadamlarini yozing.",
    },
  ],
});
test("formal student result uses allowlists, strips keys/rubrics/AI/future fields while preserving own response and human feedback; practice feedback remains available", () => {
  const raw = attempt(),
    safe = publicStudentAttempt(raw, [formal, practice])!;
  assert.equal(safe.resultKeysHidden, true);
  assert.equal(safe.answers[0].selectedAnswer, "2");
  assert.equal(safe.answers[0].teacherFeedback, raw.answers[0].teacherFeedback);
  assert.equal(safe.answers[0].correctAnswer, "");
  assert.ok(!JSON.stringify(safe).includes("PRIVATE_"));
  assert.equal(raw.answers[0].correctAnswer, "PRIVATE_KEY");
  const normal = attempt("practice");
  assert.equal(publicStudentAttempt(normal, [formal, practice]), normal);
  assert.equal(
    publicStudentAttempt({ ...normal, assessmentId: "missing" }, [practice])
      ?.resultKeysHidden,
    true,
  );
  assert.equal(
    publicStudentAttempt(raw, [{ ...formal, examKind: undefined }])
      ?.resultKeysHidden,
    true,
  );
});
async function fixture(run: (f: any) => Promise<void>) {
  const student = {
      uid: "u",
      institutionId: "s",
      role: "student",
      status: "active",
    },
    people: any = {
      student,
      other: { ...student, uid: "other" },
      teacher: { ...student, uid: "t", role: "teacher" },
      foreign: { ...student, uid: "foreign", institutionId: "other" },
      admin: {
        ...student,
        uid: "a",
        role: "admin",
        platformAdmin: true,
        emailVerified: true,
      },
    },
    db: any = {
      attempts: [
        attempt(),
        attempt("practice"),
        {
          ...attempt("practice"),
          id: "foreign-attempt",
          institutionId: "other",
          studentId: "foreign",
        },
      ],
      assessments: [formal, practice],
    };
  let serviceCalls = 0;
  const app = express();
  app.use(express.json());
  registerAiAccessGuard(app, {
    authenticate: (req: any) =>
      people[req.headers.authorization]
        ? { db, user: people[req.headers.authorization], env: "test" }
        : null,
  });
  app.use("/api/ai", (req, res) => {
    serviceCalls++;
    res.json(req.body);
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const call = async (path: string, body: any, actor = "student") => {
    const r = await fetch(
      `http://127.0.0.1:${(server.address() as any).port}/api/ai${path}`,
      {
        method: "POST",
        headers: { Authorization: actor, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return { status: r.status, data: await r.json() };
  };
  try {
    await run({ call, calls: () => serviceCalls, db });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
}
test("AI analysis rejects anonymous/foreign/formal requests before service access; own practice is local and admin receives authoritative records rather than injected client answers", () =>
  fixture(async ({ call, calls, db }: any) => {
    const body = {
      attemptId: "practice-attempt",
      assessmentTitle: "FAKE_CLIENT_DATA",
      scorePercent: 100,
      answers: [{ correctAnswer: "FAKE_CLIENT_DATA" }],
      topicBreakdown: [],
    };
    assert.equal((await call("/analyze-attempt", body, "missing")).status, 401);
    assert.equal((await call("/draft-question", {}, "missing")).status, 401);
    assert.equal((await call("/analyze-attempt", body, "other")).status, 403);
    assert.equal((await call("/analyze-attempt", body, "foreign")).status, 403);
    assert.equal(
      (await call("/analyze-attempt", { ...body, attemptId: "formal-attempt" }))
        .status,
      403,
    );
    assert.equal((await call("/draft-question", {})).status, 403);
    const local = await call("/analyze-attempt", body);
    assert.equal(local.status, 200);
    assert.equal(local.data.isFallback, true);
    assert.ok(!JSON.stringify(local.data).includes("FAKE_CLIENT_DATA"));
    assert.equal(calls(), 0);
    const authorized = await call("/analyze-attempt", body, "admin");
    assert.equal(authorized.status, 200);
    assert.equal(authorized.data.scorePercent, 70);
    assert.equal(authorized.data.answers[0].correctAnswer, "PRIVATE_KEY");
    assert.equal(
      (
        await call(
          "/analyze-attempt",
          { attemptId: "foreign-attempt" },
          "admin",
        )
      ).status,
      403,
    );
    assert.equal(calls(), 1);
    assert.equal(db.attempts[1].scorePercent, 70);
  }));
test("AI service requests are bounded per authenticated school/account", () =>
  fixture(async ({ call, calls }: any) => {
    for (let i = 0; i < 12; i++)
      assert.equal((await call("/draft-question", {}, "admin")).status, 200);
    assert.equal((await call("/draft-question", {}, "admin")).status, 429);
    assert.equal(calls(), 12);
  }));
