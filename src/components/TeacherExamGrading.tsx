import {FeedbackTemplates} from './FeedbackTemplates';
import {useUnsavedChanges} from '../utils/useUnsavedChanges';
import React, { useEffect, useRef, useState } from "react";
import { useExamApi } from "../utils/useExamApi";
import { Button, Card, Drawer, Input, Skeleton } from "./DesignSystem";
export function TeacherExamGrading() {
  const api = useExamApi(),
    [data, setData] = useState<any>(),
    [version, setVersion] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [target, setTarget] = useState<any>(),
    [points, setPoints] = useState(0),
    [feedback, setFeedback] = useState(""),
    [latest, setLatest] = useState<any>(),
    op = useRef<{ sig: string; id: string } | undefined>(undefined);
  useUnsavedChanges(!!target);
  useEffect(() => {
    let live = true;
    api("/api/exams/manage")
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [api, version]);
  const rows =
    data?.attempts.flatMap((a: any) =>
      a.answers
        .filter(
          (q: any) =>
            q.questionType === "written_open" ||
            q.gradingMode === "manual_rubric",
        )
        .map((q: any) => ({ attempt: a, answer: q })),
    ) || [];
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">BSB / CHSB yozma ish tekshiruvi</h2>
      {error && <Card role="alert">{error}</Card>}
      {!data ? (
        <Skeleton />
      ) : !rows.length ? (
        <Card>
          Hozircha tekshiriladigan yozma javob yo‘q. Oxirgi 100 topshirish
          ko‘rsatiladi.
        </Card>
      ) : (
        rows.map(({ attempt: a, answer: q }: any) => (
          <Card key={a.id + q.questionId}>
            <p className="text-xs text-blue-600">
              {a.assessmentTitle} · {a.classCode?.toUpperCase()}
            </p>
            <h3 className="my-3 font-bold">{a.studentName}</h3>
            <p className="whitespace-pre-wrap text-sm leading-7">{q.prompt}</p>
            <p className="my-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-900">
              {q.selectedAnswer || "Javob kiritilmagan"}
            </p>
            {q.rubricText && (
              <p className="mb-4 text-sm">Mezon: {q.rubricText}</p>
            )}
            <p className="mb-3 text-sm">
              {q.gradingStatus === "graded"
                ? `${q.awardedPoints}/${q.maxPoints} ball`
                : "Inson tekshiruvi kutilmoqda"}
            </p>
            <Button
              onClick={() => {
                setTarget({ attempt: a, answer: q });
                setPoints(q.awardedPoints || 0);
                setFeedback(q.teacherFeedback || "");
                setLatest(undefined);
              }}
            >
              Tekshirish
            </Button>
          </Card>
        ))
      )}
      {target && (
        <Drawer
          title="Nazorat javobini tekshirish"
          onClose={() => {
            if (!busy && window.confirm("Tekshiruv oynasini yopasizmi?"))
              setTarget(undefined);
          }}
          dismissible={!busy}
        >
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              const body = {
                  questionId: target.answer.questionId,
                  revision: target.attempt.revision,
                  points,
                  feedback,
                },
                sig = JSON.stringify(body);
              if (op.current?.sig !== sig)
                op.current = { sig, id: crypto.randomUUID() };
              try {
                await api(
                  "/api/exams/attempts/" + target.attempt.id + "/grade",
                  "POST",
                  { ...body, operationId: op.current.id },
                );
                op.current = undefined;
                setTarget(undefined);
                setVersion((v) => v + 1);
              } catch (e) {
                setError((e as Error).message);
                if ((e as any).status === 409) {
                  const d = await api("/api/exams/manage");
                  setLatest(
                    d.attempts.find((a: any) => a.id === target.attempt.id),
                  );
                }
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="whitespace-pre-wrap text-sm leading-7">
              {target.answer.prompt}
            </p>
            {error && (
              <p role="alert" className="text-sm text-rose-700">
                {error}
              </p>
            )}
            {latest && (
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                <p>Boshqa tekshiruv saqlangan. Fikringiz saqlanib turibdi.</p>
                <button
                  type="button"
                  className="ss-secondary mt-3"
                  onClick={() => {
                    setTarget({ ...target, attempt: latest });
                    setLatest(undefined);
                  }}
                >
                  Fikrimni joriy versiyada qo‘llash
                </button>
              </div>
            )}
            <label className="block text-sm">
              Ball · 0–{target.answer.maxPoints}
              <Input
                type="number"
                required
                step="0.5"
                min={0}
                max={target.answer.maxPoints}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
              />
            </label>
            <FeedbackTemplates rows={data.feedbackTemplates} onChoose={text => setFeedback(text)}/>
            <label className="block text-sm">
              Fikr va keyingi qadam
              <textarea
                className="ss-field min-h-36"
                required
                minLength={3}
                maxLength={4000}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </label>
            <Button busy={busy} disabled={!!latest} type="submit">
              Inson bahosini saqlash
            </Button>
          </form>
        </Drawer>
      )}
    </section>
  );
}
