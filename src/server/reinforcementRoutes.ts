import crypto from "node:crypto";
import type { Express } from "express";
import { z } from "zod";
import { gradeQuestion, publicQuestion, shuffle } from "./topicEngine";
import {
  SchoolError,
  ensureRows,
  schoolKey,
  operation,
  remember,
  localDate,
  type SchoolContext,
} from "./enterpriseCore";
export const learningGames = [
  {
    id: "formula",
    name: "Formula Match",
    mechanic: "matching",
    subjects: /matem|fizik|kimyo/i,
  },
  {
    id: "word",
    name: "Word Challenge",
    mechanic: "short",
    subjects: /til|ingliz|rus|english/i,
  },
  {
    id: "timeline",
    name: "Timeline Challenge",
    mechanic: "ordering",
    subjects: /tarix|history/i,
  },
  { id: "math", name: "Quick Math", mechanic: "quiz", subjects: /matem/i },
  {
    id: "science",
    name: "Science Quiz",
    mechanic: "quiz",
    subjects: /tabiiy|biolog|fizik|kimyo|science/i,
  },
  { id: "memory", name: "Memory Cards", mechanic: "cards" },
  { id: "logic", name: "Logic Challenge", mechanic: "quiz" },
  { id: "topic", name: "Topic Battle", mechanic: "quiz" },
  { id: "class", name: "Class Quiz", mechanic: "quiz" },
  { id: "daily", name: "Daily Revision Challenge", mechanic: "quiz" },
];
export function reinforcementPool(
  c: SchoolContext,
  game: string,
  lessonId = "",
) {
  const lessons = c.db.lessons.filter(
    (l: any) =>
      l.institutionId === c.user.institutionId &&
      l.status === "published" &&
      [l.classId, ...(l.classIds || [])].includes(c.user.classId) &&
      (!l.additionalCurriculumAssignment || l.tTrackVisibilityApproved),
  );
  const mode = learningGames.find((g) => g.id === game);
  return (c.db.topicQuestions || []).filter(
    (q: any) =>
      q.institutionId === c.user.institutionId &&
      (!q.schoolId || q.schoolId === c.user.institutionId) &&
      q.status === "published" &&
      q.approval?.revision === q.revision &&
      q.kind !== "written" &&
      q.key?.trim() &&
      q.explanation?.trim() &&
      (!lessonId || q.lessonId === lessonId) &&
      lessons.some(
        (l: any) =>
          l.id === q.lessonId &&
          (!mode?.subjects ||
            mode.subjects.test(l.subjectName || l.subject || "")),
      ) &&
      (!mode || mode.mechanic === "matching"
        ? !mode || q.kind === "matching"
        : mode.mechanic === "ordering"
          ? q.kind === "ordering"
          : mode.mechanic === "short"
            ? ["short", "blank"].includes(q.kind)
            : true),
  );
}
export function registerReinforcementRoutes(app: Express, deps: any) {
  const rates = new Map<string, { at: number; n: number }>();
  const access = (
    req: any,
    res: any,
    write = false,
  ): SchoolContext | undefined => {
    const a = deps.authenticate(req);
    if (!a || a.user.status !== "active") {
      res.status(401).json({ error: "Hisobga kiring." });
      return;
    }
    if (a.user.role !== "student" || !a.user.classId) {
      res.status(403).json({ error: "Sinfga biriktirilgan o‘quvchi kerak." });
      return;
    }
    const c = { ...a, now: deps.now ? new Date(deps.now()) : new Date() };
    res.setHeader("Cache-Control", "no-store");
    if (write) {
      const key = schoolKey(a.user.institutionId, a.user.uid),
        old = rates.get(key),
        r =
          !old || c.now.getTime() - old.at > 60000
            ? { at: c.now.getTime(), n: 1 }
            : { ...old, n: old.n + 1 };
      if (rates.size > 2000) rates.delete(rates.keys().next().value!);
      rates.set(key, r);
      if (r.n > 80) {
        res.status(429).json({ error: "Bir oz tanaffus qiling." });
        return;
      }
    }
    return c;
  };
  const own = (c: SchoolContext, id: string) => {
    const s = (c.db.reinforcementSessions || []).find(
      (s: any) =>
        s.id === id &&
        s.schoolId === c.user.institutionId &&
        s.studentId === c.user.uid,
    );
    if (!s) throw new SchoolError(403, "Mashqqa ruxsat yo‘q.");
    return s;
  };
  const dto = (s: any) => ({
    id: s.id,
    game: s.game,
    status: s.status,
    revision: s.revision,
    total: s.questions.length,
    index: s.answers.length,
    correct: s.answers.filter((a: any) => a.correct).length,
    answers: s.answers,
    current: s.questions[s.answers.length]
      ? publicQuestion(s.questions[s.answers.length])
      : null,
    revealed: s.revealed?.includes(s.questions[s.answers.length]?.id)
      ? {
          answer: s.questions[s.answers.length]?.key,
          explanation: s.questions[s.answers.length]?.explanation,
        }
      : undefined,
  });
  const fail = (res: any, e: any) =>
    res
      .status(e instanceof SchoolError ? e.status : 500)
      .json({
        error:
          e instanceof SchoolError
            ? e.message
            : "Mashq saqlanmadi. Qayta urinib ko‘ring.",
      });
  const write =
    (kind: string, schema: any, fn: any) => (req: any, res: any) => {
      const c = access(req, res, true);
      if (!c) return;
      const parsed = schema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: "Javobni tekshiring." });
      try {
        const d = parsed.data,
          sig = { path: req.path, body: d },
          prev = operation(c, d.operationId, kind, sig);
        if (prev) {
          const s = own(c, prev.refs[0]);
          return res.json({ session: dto(s), duplicate: true });
        }
        const s = fn(c, d, req);
        remember(c, d.operationId, kind, sig, [s.id]);
        deps.save(c.env, c.db);
        res.json({ session: dto(s) });
      } catch (e) {
        return fail(res, e);
      }
    };
  app.get("/api/reinforcement", (req, res) => {
    const c = access(req, res);
    if (!c) return;
    const pool = reinforcementPool(c, "flashcards"),
      lessons = c.db.lessons
        .filter((l: any) => pool.some((q: any) => q.lessonId === l.id))
        .map((l: any) => ({
          id: l.id,
          title: l.title || l.topicTitle,
          subject: l.subjectName || l.subject,
        })),
      sessions = (c.db.reinforcementSessions || []).filter(
        (s: any) =>
          s.schoolId === c.user.institutionId && s.studentId === c.user.uid,
      ),
      used = sessions
        .filter((s: any) => s.day === localDate(c.now))
        .reduce((n: number, s: any) => n + s.questions.length, 0);
    res.json({
      games: [
        { id: "flashcards", name: "Flashcards", mechanic: "cards" },
        ...learningGames.map((g) => ({
          id: g.id,
          name: g.name,
          mechanic: g.mechanic,
        })),
      ].map((g) => ({ ...g, available: reinforcementPool(c, g.id).length })),
      lessons,
      remaining: Math.max(0, 20 - used),
      active: sessions.filter((s: any) => s.status === "active").map(dto),
      notice:
        "Bu mashqlar rasmiy bahoga yoki intizomga ta’sir qilmaydi. Bir safar 5 savol, kuniga 20 savolgacha. Reyting va yutuq bosimi yo‘q.",
    });
  });
  app.get("/api/reinforcement/:id", (req, res) => {
    const c = access(req, res);
    if (c)
      try {
        res.json({ session: dto(own(c, String(req.params.id))) });
      } catch (e) {
        fail(res, e);
      }
  });
  app.post(
    "/api/reinforcement/start",
    write(
      "reinforcement-start",
      z.object({
        operationId: z.uuid(),
        game: z.enum([
          "flashcards",
          "formula",
          "word",
          "timeline",
          "math",
          "science",
          "memory",
          "logic",
          "topic",
          "class",
          "daily",
        ]),
        lessonId: z.string().max(200).default(""),
      }),
      (c: SchoolContext, d: any) => {
        const rows = ensureRows(c.db, "reinforcementSessions"),
          active = rows.find(
            (s: any) =>
              s.schoolId === c.user.institutionId &&
              s.studentId === c.user.uid &&
              s.status === "active",
          );
        if (active) return active;
        const day = localDate(c.now),
          used = rows
            .filter(
              (s: any) =>
                s.schoolId === c.user.institutionId &&
                s.studentId === c.user.uid &&
                s.day === day,
            )
            .reduce((n: number, s: any) => n + s.questions.length, 0);
        if (used >= 20)
          throw new SchoolError(
            429,
            "Bugungi mashqlar tugadi. Ertaga davom etasiz.",
          );
        const pool = reinforcementPool(c, d.game, d.lessonId);
        if (!pool.length)
          throw new SchoolError(
            422,
            "Bu usul uchun tasdiqlangan savollar hali yo‘q. Boshqa mavzu yoki mashqni tanlang.",
          );
        const s = {
          id: crypto.randomUUID(),
          schoolId: c.user.institutionId,
          studentId: c.user.uid,
          classId: c.user.classId,
          game: d.game,
          day,
          status: "active",
          revision: 1,
          questions: shuffle(pool).slice(0, Math.min(5, 20 - used)),
          answers: [],
          revealed: [],
          createdAt: c.now.toISOString(),
        };
        rows.push(s);
        return s;
      },
    ),
  );
  app.post(
    "/api/reinforcement/:id/reveal",
    write(
      "reinforcement-reveal",
      z.object({ operationId: z.uuid(), revision: z.number().int() }),
      (c: SchoolContext, d: any, req: any) => {
        const s = own(c, String(req.params.id));
        if (!["flashcards", "memory"].includes(s.game) || s.status !== "active")
          throw new SchoolError(409, "Kartochkani ochib bo‘lmaydi.");
        if (s.revision !== d.revision)
          throw new SchoolError(409, "Mashq boshqa oynada yangilangan.");
        const id = s.questions[s.answers.length]?.id;
        if (!id) throw new SchoolError(409, "Mashq yakunlangan.");
        if (!s.revealed.includes(id)) s.revealed.push(id);
        s.revision++;
        return s;
      },
    ),
  );
  app.post(
    "/api/reinforcement/:id/answer",
    write(
      "reinforcement-answer",
      z.object({
        operationId: z.uuid(),
        revision: z.number().int(),
        answer: z.string().max(8000).default(""),
        remembered: z.boolean().optional(),
        finish: z.boolean().default(false),
      }),
      (c: SchoolContext, d: any, req: any) => {
        const s = own(c, String(req.params.id));
        if (s.revision !== d.revision || s.status !== "active")
          throw new SchoolError(
            409,
            "Mashq holati yangilangan. Davom etish uchun server holatini oching.",
          );
        if (d.finish) {
          s.status = "finished";
          s.revision++;
          return s;
        }
        const q = s.questions[s.answers.length],
          cards = ["flashcards", "memory"].includes(s.game);
        if (cards && !s.revealed.includes(q.id))
          throw new SchoolError(400, "Avval kartochkani oching.");
        s.answers.push({
          questionId: q.id,
          prompt: q.prompt,
          answer: d.answer,
          correct: cards
            ? d.remembered === true
            : gradeQuestion(q, d.answer) === q.points,
          correctAnswer: q.key,
          explanation: q.explanation,
          selfReported: cards,
          at: c.now.toISOString(),
        });
        s.revision++;
        if (s.answers.length === s.questions.length) s.status = "finished";
        return s;
      },
    ),
  );
}
