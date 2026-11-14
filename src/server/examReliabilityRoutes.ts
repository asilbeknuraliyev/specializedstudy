import crypto from "node:crypto";
import { z } from "zod";
import type { Express } from "express";
import {
  examSessionKey,
  examSessionStore,
  type ExamSessionStore,
} from "./examSessionStore";
import {
  EXAM_POLICY,
  ExamProtocolError,
  assertExamLease,
  assertExamEditable,
  deadlineFor,
  type DurableExamSession,
} from "../utils/examReliability";
import {
  canTakeExam,
  examCanStart,
  publicStudentAttempt,
} from "../utils/examPolicy";
import { scoreAssessmentSubmission } from "../utils/scoring";
import { schoolAudit, notifySchool } from "./enterpriseCore";
import { runtimeMetrics, quotaExhausted } from "./runtimeMetrics";
const packet = z.object({
  operationId: z.uuid(),
  clientId: z.uuid(),
  epoch: z.number().int().nonnegative(),
});
const answers = z.record(z.string().max(200), z.string().max(250000));
const digest = (value: unknown) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fail = (status: number, code: string, message: string): never => {
  throw new ExamProtocolError(status, code, message);
};
const platform = (u: any) =>
  ["admin", "platform_owner"].includes(u.role) &&
  u.platformAdmin &&
  u.emailVerified;
const manages = (u: any, a: any) =>
  u.institutionId === a.institutionId &&
  (platform(u) ||
    (u.role === "teacher" &&
      a.teacherId === u.uid &&
      a.subject === u.subject &&
      (a.assignedClassIds || [a.classId]).every((id: string) =>
        u.assignedClassIds?.includes(id),
      )));
function checked<T>(schema: z.ZodType<T>, body: unknown): T {
  const d = schema.safeParse(body);
  if (!d.success)
    fail(400, "INVALID_PACKET", "So‘rov shakli noto‘g‘ri. Sahifani yangilang.");
  return d.data!;
}
function boundedAnswers(value: Record<string, string>, exam: any) {
  if (
    Buffer.byteLength(JSON.stringify(value)) > 1800000 ||
    Object.keys(value).some((k) => !exam.questionIds.includes(k))
  )
    fail(400, "INVALID_ANSWER", "Savol yoki javob hajmi noto‘g‘ri.");
}
function prior(s: DurableExamSession, d: any) {
  const old = s.operations.find((o) => o.id === d.operationId);
  if (old && old.digest !== digest(d))
    fail(
      409,
      "OPERATION_REUSED",
      "Saqlash identifikatori boshqa javob uchun ishlatilgan.",
    );
  return old;
}
function remember(s: DurableExamSession, d: any) {
  s.stateVersion = (s.stateVersion || 0) + 1;
  s.operations.push({
    id: d.operationId,
    digest: digest(d),
    revision: s.revision,
  });
  s.operations = s.operations.slice(-200);
}
function dto(s: DurableExamSession, exam: any, clientId: string, now: number) {
  return {
    session: {
      id: s.id,
      assessmentId: s.assessmentId,
      studentId: s.studentId,
      institutionId: s.institutionId,
      startedAt: s.startedAt,
      deadlineAt: s.deadlineAt,
      pauseAtStart: s.pauseAtStart,
      revision: s.revision,
      stateVersion: s.stateVersion || 0,
      answers: s.answers,
      events: s.events,
      exitCount: s.exitCount || 0,
      stoppedAt: s.stoppedAt,
      submittedAttemptId: s.submittedAttemptId,
      epoch: s.epoch,
      receipt: s.receipt,
      reviewStatus: s.reviewStatus,
      explanation: s.explanation,
    },
    canWrite: s.lease?.clientId === clientId,
    leaseUntil: s.lease?.until || 0,
    serverNow: now,
    deadline: deadlineFor(exam, s, now),
    state: s.stoppedAt ? "review_required" : exam.examState,
    policy: EXAM_POLICY,
  };
}
export function registerExamReliabilityRoutes(app: Express, deps: any) {
  const store: ExamSessionStore = deps.examStore || examSessionStore(),
    rates = new Map<string, { at: number; n: number }>();
  const route =
    (fn: (c: any, req: any, res: any) => Promise<any>) =>
    async (req: any, res: any) => {
      try {
        const c = deps.authenticate(req);
        if (!c || c.user.status !== "active")
          return res
            .status(401)
            .json({ error: "Hisobga kiring.", code: "LOGIN_REQUIRED" });
        c.now = deps.now ? new Date(deps.now()).getTime() : Date.now();
        res.setHeader("Cache-Control", "no-store");
        const key = c.user.institutionId + ":" + c.user.uid,
          old = rates.get(key),
          limit =
            !old || c.now - old.at > 60000
              ? { at: c.now, n: 1 }
              : { at: old.at, n: old.n + 1 };
        if (rates.size > 2000) rates.delete(rates.keys().next().value!);
        rates.set(key, limit);
        if (limit.n > 180) {
          res.setHeader("Retry-After", "60");
          return res.status(429).json({
            code: "RATE_LIMIT",
            error:
              "Saqlash so‘rovlari ko‘paydi. Bir ozdan avtomatik qayta uriniladi.",
          });
        }
        await fn(c, req, res);
      } catch (e) {
        if (!(e instanceof ExamProtocolError))
          runtimeMetrics.failure(
            quotaExhausted(e) ? "quota_exhausted" : "write_failed",
          );
        res.status(e instanceof ExamProtocolError ? e.status : 503).json({
          code:
            e instanceof ExamProtocolError
              ? e.code
              : quotaExhausted(e)
                ? "QUOTA_EXHAUSTED"
                : "TEMPORARY",
          error:
            e instanceof ExamProtocolError
              ? e.message
              : "Server saqlashni tasdiqlamadi. Qurilma nusxasi qoladi; qayta uriniladi.",
        });
      }
    };
  function own(c: any, id: string) {
    const a = c.db.assessments.find(
      (a: any) =>
        a.id === id && a.examKind && a.institutionId === c.user.institutionId,
    );
    if (!a || !canTakeExam(c.user, a))
      fail(403, "NOT_ASSIGNED", "Bu nazorat sinfingizga biriktirilmagan.");
    return a;
  }
  function teacher(c: any, id: string) {
    const a = c.db.assessments.find(
      (a: any) => a.id === id && a.examKind && manages(c.user, a),
    );
    if (!a) fail(403, "NOT_ASSIGNED", "Nazoratga boshqaruv ruxsati yo‘q.");
    return a;
  }
  function key(c: any, a: any, student = c.user.uid) {
    return examSessionKey(c.user.institutionId, a.id, student);
  }
  function session(s: DurableExamSession | undefined) {
    if (!s) fail(404, "NOT_STARTED", "Avval imtihonni boshlang.");
    return s!;
  }
  // Old pages cannot keep writing to a legacy copy after this learner has migrated.
  app.use(async (req, res, next) => {
    const m = req.path.match(/^\/api\/exams\/([^/]+)\/(start|session|exit)$/),
      id =
        m?.[1] ||
        (req.path === "/api/assessments/submit"
          ? req.body?.assessmentId
          : undefined);
    if (!id || req.method === "GET") return next();
    const c = deps.authenticate(req);
    if (!c) return next();
    try {
      if (
        await store.read(examSessionKey(c.user.institutionId, id, c.user.uid))
      )
        return res.status(426).json({
          code: "UPGRADE_REQUIRED",
          error:
            "Imtihonning ishonchli saqlash versiyasi yoqilgan. Sahifani yangilang; serverdagi javoblar saqlangan.",
        });
      next();
    } catch {
      return res
        .status(503)
        .json({ error: "Sessiya holati tekshirilmadi. Qayta urinib ko‘ring." });
    }
  });
  // The guard above must only intercept its matching requests, never consume other routes.
  app.post(
    "/api/exams/:id/start-v2",
    route(async (c, req, res) => {
      const a = own(c, req.params.id),
        d = checked(
          z.object({ operationId: z.uuid(), clientId: z.uuid() }),
          req.body,
        ),
        candidate = crypto.randomUUID();
      const result = await store.change(key(c, a), (old) => {
        let s: DurableExamSession = old!;
        if (!s) {
          const legacy = c.db.examSessions?.find(
            (s: any) => s.assessmentId === a.id && s.studentId === c.user.uid,
          );
          if (!legacy && !examCanStart(a, c.now))
            fail(409, "NOT_OPEN", "Nazorat hali ochilmagan yoki yopilgan.");
          const previous = c.db.attempts.find(
            (v: any) => v.assessmentId === a.id && v.studentId === c.user.uid,
          );
          if (previous)
            fail(
              409,
              "LEGACY_SUBMITTED",
              "Bu nazorat topshirilgan. Natijalar bo‘limini oching.",
            );
          s = {
            ...(legacy || {
              id: candidate,
              assessmentId: a.id,
              studentId: c.user.uid,
              institutionId: c.user.institutionId,
              startedAt: new Date(c.now).toISOString(),
              deadlineAt: new Date(
                c.now + a.durationMinutes * 60000,
              ).toISOString(),
              pauseAtStart: a.totalPausedMs || 0,
              revision: 0,
              answers: {},
              events: [],
            }),
            protocol: 2,
            epoch: 0,
            operations: [],
            reviews: [],
          };
        }
        if (!s.lease || s.lease.clientId === d.clientId) {
          if (s.lease?.clientId !== d.clientId) s.epoch++;
          s.lease = {
            clientId: d.clientId,
            until: c.now + EXAM_POLICY.leaseMs,
          };
        }
        return { session: s, result: dto(s, a, d.clientId, c.now) };
      });
      res.json(result);
    }),
  );
  app.get(
    "/api/exams/:id/session-v2",
    route(async (c, req, res) => {
      const a = own(c, req.params.id),
        d = checked(z.object({ clientId: z.uuid() }), req.query),
        s = session(await store.read(key(c, a)));
      res.json(dto(s, a, d.clientId, c.now));
    }),
  );
  app.put(
    "/api/exams/:id/session-v2",
    route(async (c, req, res) => {
      const a = own(c, req.params.id),
        d = checked(
          packet.extend({ revision: z.number().int().nonnegative(), answers }),
          req.body,
        );
      boundedAnswers(d.answers, a);
      const result = await store.change(key(c, a), (old) => {
        const s = session(old),
          op = prior(s, d);
        if (op)
          return {
            session: s,
            result: {
              ...dto(s, a, d.clientId, c.now),
              duplicate: true,
              savedAt: undefined as string | undefined,
              savedOperationId: d.operationId,
              savedRevision: op.revision,
            },
          };
        assertExamLease(s, d.clientId, d.epoch);
        assertExamEditable(s, a, c.now);
        if (d.revision !== s.revision)
          fail(
            409,
            "REVISION_CONFLICT",
            "Serverda yangi javoblar bor. Qurilma nusxasini saqlab, qaysi nusxani qo‘llashni tanlang.",
          );
        s.answers = d.answers;
        s.revision++;
        s.lease!.until = c.now + EXAM_POLICY.leaseMs;
        remember(s, d);
        return {
          session: s,
          result: {
            ...dto(s, a, d.clientId, c.now),
            duplicate: false,
            savedOperationId: d.operationId,
            savedRevision: s.revision,
            savedAt: new Date(c.now).toISOString(),
          },
        };
      });
      res.json(result);
    }),
  );
  app.post(
    "/api/exams/:id/takeover-v2",
    route(async (c, req, res) => {
      const a = own(c, req.params.id),
        d = checked(
          packet.extend({ revision: z.number().int().nonnegative() }),
          req.body,
        );
      res.json(
        await store.change(key(c, a), (old) => {
          const s = session(old);
          if (prior(s, d))
            return { session: s, result: dto(s, a, d.clientId, c.now) };
          assertExamEditable(s, a, c.now);
          if (s.revision !== d.revision)
            fail(
              409,
              "REVISION_CONFLICT",
              "Joriy server nusxasini qayta oching.",
            );
          s.epoch++;
          s.lease = {
            clientId: d.clientId,
            until: c.now + EXAM_POLICY.leaseMs,
          };
          s.events.push({
            type: "window_takeover",
            at: new Date(c.now).toISOString(),
          });
          s.events = s.events.slice(-200);
          remember(s, d);
          return { session: s, result: dto(s, a, d.clientId, c.now) };
        }),
      );
    }),
  );
  app.post(
    "/api/exams/:id/exit-v2",
    route(async (c, req, res) => {
      const a = own(c, req.params.id),
        d = checked(
          packet.extend({
            kind: z.enum([
              "tab_hidden",
              "fullscreen_exit",
              "fullscreen_unavailable",
            ]),
            observedAt: z.string().max(50).optional(),
          }),
          req.body,
        );
      res.json(
        await store.change(key(c, a), (old) => {
          const s = session(old);
          if (prior(s, d))
            return { session: s, result: dto(s, a, d.clientId, c.now) };
          const historical = d.epoch < s.epoch;
          if (s.exitIds?.includes(d.operationId))
            return { session: s, result: dto(s, a, d.clientId, c.now) };
          if (!historical) assertExamLease(s, d.clientId, d.epoch);
          s.events.push({
            type: historical ? "late_" + d.kind : d.kind,
            at: new Date(c.now).toISOString(),
            ...(d.observedAt ? { observedAt: d.observedAt } : {}),
          } as any);
          s.events = s.events.slice(-200);
          s.exitIds ||= [];
          if (
            !s.receipt &&
            !s.stoppedAt &&
            d.kind === "tab_hidden" &&
            d.epoch >= (s.reviewEpoch || 0) &&
            !s.exitIds.includes(d.operationId)
          ) {
            s.exitIds.push(d.operationId);
            s.exitCount = (s.exitCount || 0) + 1;
            if (s.exitCount >= 3) {
              s.stoppedAt = new Date(c.now).toISOString();
              s.reviewStatus = "pending";
            }
          }
          remember(s, d);
          return { session: s, result: dto(s, a, d.clientId, c.now) };
        }),
      );
    }),
  );
  app.post(
    "/api/exams/:id/explanation-v2",
    route(async (c, req, res) => {
      const a = own(c, req.params.id),
        d = checked(
          packet.extend({
            reason: z.string().trim().min(8).max(2000),
            answers: answers.optional(),
          }),
          req.body,
        );
      if (d.answers) boundedAnswers(d.answers, a);
      res.json(
        await store.change(key(c, a), (old) => {
          const s = session(old);
          if (!prior(s, d)) {
            s.explanation = d.reason;
            if (d.answers)
              s.recovery = {
                answers: d.answers,
                reason: d.reason,
                receivedAt: new Date(c.now).toISOString(),
              };
            remember(s, d);
          }
          return {
            session: s,
            result: {
              recorded: true,
              receivedAt: new Date(c.now).toISOString(),
            },
          };
        }),
      );
    }),
  );
  app.post(
    "/api/exams/:id/finish-v2",
    route(async (c, req, res) => {
      const a = own(c, req.params.id),
        d = checked(packet, req.body),
        receiptId = "SS-" + crypto.randomUUID().toUpperCase();
      const result = await store.change(key(c, a), (old) => {
        const s = session(old);
        if (!s.receipt) {
          assertExamLease(s, d.clientId, d.epoch);
          if (s.stoppedAt) fail(423, "REVIEW_REQUIRED", EXAM_POLICY.exits);
          if (a.examState === "paused")
            fail(
              423,
              "EXAM_PAUSED",
              "Nazorat pauzada. Topshirish uchun davom etishini kuting.",
            );
          const scored = scoreAssessmentSubmission(
              a.questionSnapshot ||
                c.db.questions.filter((q: any) => a.questionIds.includes(q.id)),
              s.answers,
              Object.fromEntries(
                (c.db.topics || []).map((t: any) => [t.id, t]),
              ),
            ),
            at = new Date(c.now).toISOString(),
            attemptId = "attempt-v2-" + s.id;
          const receipt = {
            id: receiptId,
            attemptId,
            submittedAt: at,
            revision: s.revision,
            answerDigest: digest(s.answers),
            reason:
              c.now >= deadlineFor(a, s, c.now)
                ? ("deadline" as const)
                : ("manual" as const),
          };
          s.receipt = receipt;
          s.submittedAttemptId = attemptId;
          s.finalAttempt = {
            id: attemptId,
            assessmentId: a.id,
            assessmentTitle: a.title,
            assessmentVersion: a.version || 1,
            studentId: c.user.uid,
            studentName: c.user.displayName,
            classId: c.user.classId || a.classId,
            classCode: c.user.classCode,
            institutionId: c.user.institutionId,
            ...scored,
            status:
              scored.pendingManualCount > 0
                ? "pending_manual_review"
                : "completed",
            submittedAt: at,
            receipt,
          };
          remember(s, d);
        }
        return {
          session: s,
          result: { attempt: s.finalAttempt, receipt: s.receipt },
        };
      });
      // Durable receipt is authoritative. A failed legacy projection can be safely retried with the same operation ID.
      let attempt = c.db.attempts.find(
        (v: any) => v.id === result.receipt!.attemptId,
      );
      if (!attempt) {
        attempt = result.attempt;
        c.db.attempts.unshift(attempt);
        const context = { ...c, now: new Date(c.now) };
        schoolAudit(
          context,
          "Nazorat kvitansiyasi saqlandi",
          attempt.id,
          null,
          {
            receiptId: result.receipt!.id,
            assessmentId: a.id,
            studentId: c.user.uid,
          },
        );
        if (a.teacherId)
          notifySchool(
            context,
            a.teacherId,
            "Nazorat ishi tekshiruvga tayyor",
            "/teacher/workspace/grading",
            attempt.id,
          );
        deps.save(c.env, c.db);
      }
      res.json({
        attempt: publicStudentAttempt(attempt, c.db.assessments),
        receipt: result.receipt,
      });
    }),
  );
  app.get(
    "/api/exams/:id/receipt-v2",
    route(async (c, req, res) => {
      const a = own(c, req.params.id),
        s = session(await store.read(key(c, a)));
      res.json({
        receipt: s.receipt || null,
        projectionPending:
          !!s.receipt &&
          !c.db.attempts.some((v: any) => v.id === s.receipt!.attemptId),
      });
    }),
  );
  app.get(
    "/api/exams/:id/monitor-v2",
    route(async (c, req, res) => {
      const a = teacher(c, req.params.id),
        d = checked(
          z.object({
            after: z
              .string()
              .regex(/^[a-f0-9]{64}$/)
              .optional(),
          }),
          req.query,
        ),
        rows = await store.list(c.user.institutionId, a.id, d.after);
      res.json({
        policy: EXAM_POLICY,
        rows: rows.map(({ key, session: s }) => ({
          key,
          studentId: s.studentId,
          studentName:
            c.db.users.find((u: any) => u.uid === s.studentId)?.displayName ||
            "O‘quvchi",
          revision: s.revision,
          epoch: s.epoch,
          exitCount: s.exitCount || 0,
          stoppedAt: s.stoppedAt,
          reviewStatus: s.reviewStatus,
          explanation: s.explanation,
          events: s.events,
          reviews: s.reviews,
          deadline: new Date(deadlineFor(a, s, c.now)).toISOString(),
          receipt: s.receipt,
          answered: Object.values(s.answers).filter(Boolean).length,
          recovery: s.recovery,
        })),
        next: rows.length === 50 ? rows.at(-1)!.key : null,
      });
    }),
  );
  app.post(
    "/api/exams/:id/review-v2",
    route(async (c, req, res) => {
      const a = teacher(c, req.params.id),
        d = checked(
          z.object({
            operationId: z.uuid(),
            studentId: z.string().max(200),
            revision: z.number().int().nonnegative(),
            reason: z.string().trim().min(8).max(2000),
            minutes: z.number().int().min(1).max(180),
          }),
          req.body,
        );
      const result = await store.change(key(c, a, d.studentId), (old) => {
        const s = session(old);
        if (prior(s, d)) return { session: s, result: { reopened: true } };
        if (s.receipt)
          fail(
            409,
            "FINAL_RECEIPT",
            "Kvitansiya berilgan ish qayta ochilmaydi. Natijaga tuzatish inson baholashi tartibida kiritiladi.",
          );
        if (s.revision !== d.revision)
          fail(
            409,
            "REVISION_CONFLICT",
            "Sessiya yangilangan. Qayta ochib tekshiring.",
          );
        if (!s.stoppedAt && c.now <= deadlineFor(a, s, c.now))
          fail(
            409,
            "NOT_BLOCKED",
            "Bu sessiya bloklanmagan yoki vaqti tugamagan.",
          );
        if (a.examState === "closed" || a.examState === "paused")
          fail(
            409,
            "EXAM_PAUSED",
            "Avval nazoratning umumiy holatini tekshiring.",
          );
        const previous = s.deadlineAt;
        s.deadlineAt = new Date(c.now + d.minutes * 60000).toISOString();
        s.pauseAtStart = a.totalPausedMs || 0;
        s.reviews.push({
          id: d.operationId,
          actorId: c.user.uid,
          at: new Date(c.now).toISOString(),
          reason: d.reason,
          action: "reopen",
          previousDeadline: previous,
          deadline: s.deadlineAt,
        });
        s.stoppedAt = undefined;
        s.exitCount = 0;
        s.reviewStatus = "reopened";
        s.epoch++;
        s.reviewEpoch = s.epoch;
        s.exitIds = [];
        s.lease = undefined;
        s.revision++;
        remember(s, d);
        return { session: s, result: { reopened: true } };
      });
      res.json(result);
    }),
  );
}
