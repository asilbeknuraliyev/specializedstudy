import type { Express } from "express";
import { formalResult } from "../utils/examPolicy";
import { buildDeterministicFallbackAnalysis } from "../utils/scoring";
import { schoolAdmin, SchoolError, type SchoolContext } from "./enterpriseCore";
export function authoritativeAnalysis(c: SchoolContext, input: any) {
  const id = typeof input?.attemptId === "string" ? input.attemptId : "";
  const a = c.db.attempts.find(
    (a: any) => a.id === id && a.institutionId === c.user.institutionId,
  );
  if (!a)
    throw new SchoolError(403, "Bu urinishni tahlil qilishga ruxsat yo‘q.");
  if (
    !schoolAdmin(c.user) &&
    !(c.user.role === "student" && a.studentId === c.user.uid)
  )
    throw new SchoolError(
      403,
      "Faqat o‘zingizning mashqingiz yoki vakolatli administrator.",
    );
  const assessment = c.db.assessments.find(
    (e: any) =>
      e.id === a.assessmentId && e.institutionId === c.user.institutionId,
  );
  if (!schoolAdmin(c.user) && formalResult(assessment, a.assessmentTitle))
    throw new SchoolError(
      403,
      "BSB/CHSB javob kalitlari va avtomatik yechim tahlili o‘quvchiga ochilmaydi. Ustoz fikrini kuting.",
    );
  return {
    attemptId: a.id,
    assessmentTitle: a.assessmentTitle,
    scorePercent: a.scorePercent,
    topicBreakdown: a.topicBreakdown,
    answers: a.answers,
  };
}
export function registerAiAccessGuard(app: Express, deps: any) {
  const rates = new Map<string, { at: number; n: number }>();
  app.use("/api/ai", (req: any, res: any, next: any) => {
    const a = deps.authenticate(req);
    if (!a || a.user.status !== "active")
      return res.status(401).json({ error: "Hisobga kiring." });
    const c = { ...a, now: new Date() };
    res.setHeader("Cache-Control", "no-store");
    const key = c.user.institutionId + ":" + c.user.uid,
      old = rates.get(key),
      r =
        !old || Date.now() - old.at > 60000
          ? { at: Date.now(), n: 1 }
          : { ...old, n: old.n + 1 };
    if (rates.size > 2000) rates.delete(rates.keys().next().value!);
    rates.set(key, r);
    if (r.n > 12) {
      res.setHeader("Retry-After", "60");
      return res.status(429).json({
        error: "Tahlil so‘rovlari ko‘paydi. Bir oz kutib qayta urinib ko‘ring.",
      });
    }
    try {
      if (req.path === "/analyze-attempt") {
        req.body = authoritativeAnalysis(c, req.body);
        if (c.user.role === "student") {
          const b = req.body,
            result = buildDeterministicFallbackAnalysis(
              b.assessmentTitle,
              b.scorePercent,
              b.topicBreakdown,
              b.answers,
            );
          result.aiUnavailableReason =
            "Shaxsiy mashq natijasi serverdagi qoidalar bilan tahlil qilindi; javoblaringiz tashqi AI xizmatiga yuborilmadi.";
          return res.json(result);
        }
      } else if (!schoolAdmin(c.user))
        return res
          .status(403)
          .json({ error: "Bu amal faqat vakolatli administrator uchun." });
      return next();
    } catch (e) {
      return res.status(e instanceof SchoolError ? e.status : 500).json({
        error:
          e instanceof SchoolError
            ? e.message
            : "Tahlilga ruxsat tekshirilmadi.",
      });
    }
  });
}
