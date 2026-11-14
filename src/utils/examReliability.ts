import type { ExamSession } from "../examTypes";
export interface ExamReceipt {
  id: string;
  attemptId: string;
  submittedAt: string;
  revision: number;
  answerDigest: string;
  reason: "manual" | "deadline";
}
export interface DurableExamSession extends ExamSession {
  stateVersion?: number;
  protocol: 2;
  epoch: number;
  lease?: { clientId: string; until: number };
  operations: Array<{ id: string; digest: string; revision: number }>;
  reviewStatus?: "pending" | "reopened";
  explanation?: string;
  receipt?: ExamReceipt;
  finalAttempt?: any;
  recovery?: {
    answers: Record<string, string>;
    reason: string;
    receivedAt: string;
  };
  reviews: Array<{
    id: string;
    actorId: string;
    at: string;
    reason: string;
    action: string;
    previousDeadline: string;
    deadline: string;
  }>;
}
export class ExamProtocolError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const EXAM_POLICY = {
  version: "exam-save-v2",
  leaseMs: 30000,
  localRetentionDays: 7,
  exitLimit: 3,
  deadline:
    "Vaqt tugagach faqat shu vaqtgacha server tasdiqlagan javoblar baholanadi. Aloqa uzilishi vaqtni uzaytirmaydi. Qurilmadagi yuborilmagan nusxa saqlanadi va ustoz ko‘rib chiqishi uchun tiklash so‘rovi berish mumkin.",
  exits:
    "Oyna almashishi ko‘chirishni isbotlamaydi. Uchinchi hodisada javoblar bloklanadi; ustoz sababni ko‘rib, asos bilan qayta ochishi mumkin.",
};
export function assertExamLease(
  s: DurableExamSession,
  clientId: string,
  epoch: number,
) {
  if (s.lease?.clientId !== clientId || s.epoch !== epoch)
    throw new ExamProtocolError(
      409,
      "WINDOW_CONFLICT",
      "Imtihon boshqa oynada boshqarilmoqda. Mahalliy javoblaringiz saqlandi; qaysi oynada davom etishni tanlang.",
    );
}
export function assertExamEditable(
  s: DurableExamSession,
  exam: any,
  now: number,
) {
  if (s.receipt)
    throw new ExamProtocolError(
      409,
      "ALREADY_SUBMITTED",
      "Ish topshirilgan. Kvitansiyani oching.",
    );
  if (s.stoppedAt)
    throw new ExamProtocolError(
      423,
      "REVIEW_REQUIRED",
      "Oyna almashish hodisalari qayd etildi. Ustoz ko‘rigi kutilmoqda; bu ko‘chirish xulosasi emas.",
    );
  if (exam.examState === "paused" || exam.examState === "closed")
    throw new ExamProtocolError(
      423,
      "EXAM_PAUSED",
      "Nazorat vaqtincha to‘xtatilgan yoki yopilgan.",
    );
  if (now > deadlineFor(exam, s, now))
    throw new ExamProtocolError(
      410,
      "DEADLINE",
      "Vaqt tugagan. Yuborilmagan qurilma nusxasi saqlanadi; serverdagi javoblar topshiriladi.",
    );
}
export function deadlineFor(exam: any, s: ExamSession, now = Date.now()) {
  const end =
    Date.parse(s.deadlineAt) +
    Math.max(0, (exam.totalPausedMs || 0) - s.pauseAtStart) +
    (exam.examState === "paused" && exam.pausedAt
      ? Math.max(0, now - Date.parse(exam.pausedAt))
      : 0);
  return (s as DurableExamSession).reviews?.length
    ? end
    : Math.min(end, Date.parse(exam.dueDate));
}
export function finiteScoreOrFallback(
  value: unknown,
  fallback: number,
  max: number,
) {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : fallback;
}
