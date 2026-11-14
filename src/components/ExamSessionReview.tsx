import React, { useEffect, useRef, useState } from "react";
import { useExamApi } from "../utils/useExamApi";
import { ExamAnswerContent } from "./ExamAnswers";
import { EXAM_POLICY } from "../utils/examReliability";
import { Button, Card, Select, Input } from "./DesignSystem";
export function ExamSessionReview() {
  const api = useExamApi(),
    [exams, setExams] = useState<any[]>([]),
    [id, setId] = useState(""),
    [rows, setRows] = useState<any[]>([]),
    [after, setAfter] = useState<string | null>(),
    [error, setError] = useState(""),
    [target, setTarget] = useState<any>(),
    [reason, setReason] = useState(""),
    [minutes, setMinutes] = useState(10),
    [approved, setApproved] = useState(false),
    [busy, setBusy] = useState(false),
    op = useRef<any>(undefined);
  useEffect(() => {
    let live = true;
    api("/api/exams/manage")
      .then((d) => {
        if (live) {
          setExams(d.assessments);
          setId(d.assessments[0]?.id || "");
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      live = false;
    };
  }, [api]);
  async function load(cursor?: string) {
    if (!id) return;
    try {
      const d = await api(
        `/api/exams/${id}/monitor-v2${cursor ? "?after=" + cursor : ""}`,
      );
      setRows((v) => (cursor ? [...v, ...d.rows] : d.rows));
      setAfter(d.next);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    setRows([]);
    void load();
  }, [id]);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">Imtihon hodisalari va qayta ochish</h2>
      <p className="text-sm leading-7 text-slate-500 dark:text-slate-400">
        {EXAM_POLICY.exits} Qayta ochish sababi, mas’ul va yangi muddat tarixda
        qoladi.
      </p>
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      <label className="block text-sm">
        Nazorat ishi
        <Select
          aria-label="Hodisalar uchun nazorat"
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          {exams.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </Select>
      </label>
      <Button disabled={!id || busy} onClick={() => void load()}>
        Hodisalarni yangilash
      </Button>
      {!rows.length && (
        <Card>Bu nazorat uchun yangi saqlash sessiyasi hali yo‘q.</Card>
      )}
      {rows.map((s) => (
        <Card key={s.key}>
          <h3 className="font-semibold">{s.studentName}</h3>
          <p className="my-2 text-sm">
            {s.receipt
              ? "Topshirilgan"
              : s.stoppedAt
                ? "Ko‘rik kutilmoqda"
                : "Jarayonda"}{" "}
            · {s.answered} javob · {s.exitCount} oyna almashishi
          </p>
          {s.explanation && (
            <p className="my-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900">
              O‘quvchi izohi: {s.explanation}
            </p>
          )}
          <details>
            <summary className="min-h-11 cursor-pointer content-center text-sm">
              Hodisalar va qarorlar tarixi
            </summary>
            {s.events.map((e: any, n: number) => (
              <p key={n} className="my-2 text-xs text-slate-500 dark:text-slate-400">
                {e.type === "tab_hidden"
                  ? "Boshqa oyna"
                  : e.type === "window_takeover"
                    ? "Boshqaruv almashdi"
                    : "Ekran holati"}{" "}
                · {new Date(e.at).toLocaleString("uz-UZ")}
              </p>
            ))}
            {s.reviews.map((r: any) => (
              <p key={r.id} className="my-2 text-sm">
                {r.reason} · {new Date(r.at).toLocaleString("uz-UZ")} · yangi
                muddat {new Date(r.deadline).toLocaleString("uz-UZ")}
              </p>
            ))}
          </details>
          {s.recovery && (
            <details>
              <summary className="min-h-11 cursor-pointer content-center text-sm">
                Qurilmadan yuborilgan nusxa — avtomatik baholanmagan
              </summary>
              {Object.entries(s.recovery.answers).map(([q, a]) => (
                <div key={q} className="my-3 rounded-xl border p-3">
                  <ExamAnswerContent answer={String(a)} />
                </div>
              ))}
            </details>
          )}
          {!s.receipt &&
            (s.stoppedAt || Date.parse(s.deadline) < Date.now()) && (
              <Button
                onClick={() => {
                  setTarget(s);
                  setReason("");
                  setApproved(false);
                }}
              >
                Asos bilan qayta ochish
              </Button>
            )}
        </Card>
      ))}
      {after && (
        <Button onClick={() => void load(after)}>Keyingi 50 sessiya</Button>
      )}
      {target && (
        <Card>
          <h3 className="font-semibold">{target.studentName}: qaror</h3>
          <label className="mt-4 block text-sm">
            Qarorning asosli sababi
            <textarea
              className="ss-field mt-2 min-h-24"
              value={reason}
              maxLength={2000}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className="mt-4 block text-sm">
            Qayta ochilgandan keyingi daqiqalar
            <Input
              type="number"
              min={1}
              max={180}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
          <label className="my-4 flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />
            Hodisalar va sababni ko‘rib chiqdim; bu inson qarori.
          </label>
          <div className="flex flex-wrap gap-3">
            <Button
              busy={busy}
              disabled={
                !approved ||
                reason.trim().length < 8 ||
                minutes < 1 ||
                minutes > 180
              }
              onClick={async () => {
                const body = {
                    studentId: target.studentId,
                    revision: target.revision,
                    reason,
                    minutes,
                  },
                  sig = JSON.stringify(body);
                op.current?.sig === sig ||
                  (op.current = { sig, id: crypto.randomUUID() });
                setBusy(true);
                try {
                  await api(`/api/exams/${id}/review-v2`, "POST", {
                    ...body,
                    operationId: op.current.id,
                  });
                  setTarget(undefined);
                  op.current = undefined;
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Qarorni saqlab qayta ochish
            </Button>
            <Button disabled={busy} onClick={() => setTarget(undefined)}>
              Bekor qilish
            </Button>
          </div>
        </Card>
      )}
    </section>
  );
}
