import React, { useEffect, useRef, useState } from "react";
import { useExamApi } from "../utils/useExamApi";
import {
  Button,
  Card,
  EmptyState,
  Select,
  Skeleton,
  Toast,
} from "./DesignSystem";
import { QuestionInput } from "./QuestionInput";
const descriptions: Record<string, string> = {
  flashcards:
    "Savolni o‘qing, xotiradan javob bering, keyin kartochkani oching.",
  formula:
    "Tasdiqlangan formulalarni ular mos keladigan tushunchalar bilan bog‘lang.",
  word: "So‘z va tushunchalarni variant yordamisiz eslang.",
  timeline: "Tarixiy voqealarni izchil tartibga keltiring.",
  math: "Qisqa matematik mashq. Tezlik uchun ball berilmaydi.",
  science: "Tabiiy fanlardagi tushunchalarni misollar bilan mustahkamlang.",
  memory: "Kartochkani ochishdan oldin javobni xotiradan eslang.",
  logic: "Sinfingiz savollaridagi mantiqiy bog‘lanishlarni tekshiring.",
  topic: "Bir mavzu bo‘yicha o‘zingizni sinang. Ommaviy reyting yo‘q.",
  class: "Sinfingizga ochilgan savollardan qisqa mashq.",
  daily: "Bugungi qisqa mashq. Xatolarni oraliq takrorlash alohida bo‘limda.",
};
export function ReinforcementPage() {
  const api = useExamApi(),
    [data, setData] = useState<any>(),
    [session, setSession] = useState<any>(),
    [lesson, setLesson] = useState(""),
    [answer, setAnswer] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState<any>(),
    [version, setVersion] = useState(0),
    operation = useRef<{ sig: string; id: string } | undefined>(undefined),
    lock = useRef(false);
  useEffect(() => {
    let live = true;
    api("/api/reinforcement")
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
  const run = async (path: string, body: any) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const sig = JSON.stringify({ path, body });
    if (operation.current?.sig !== sig)
      operation.current = { sig, id: crypto.randomUUID() };
    try {
      const d = await api(path, "POST", {
        ...body,
        operationId: operation.current.id,
      });
      operation.current = undefined;
      if (d.session.answers.length > (session?.answers.length || 0))
        setFeedback(d.session.answers.at(-1));
      setSession(d.session);
      setAnswer("");
      setVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!data) return error ? <Card role="alert">{error}</Card> : <Skeleton />;
  const cards = session && ["flashcards", "memory"].includes(session.game),
    q = session?.current;
  return (
    <main className="mx-auto max-w-4xl space-y-5">
      <header className="rounded-3xl bg-gradient-to-br from-blue-950 to-blue-700 p-7 text-white">
        <p className="text-xs uppercase tracking-widest text-blue-200">
          Qisqa mashq · mustaqil o‘rganish
        </p>
        <h1 className="mt-3 text-3xl font-bold">Bilimingizni mustahkamlang</h1>
        <p className="mt-3 text-sm leading-7 text-blue-100">{data.notice}</p>
      </header>
      {error && (
        <Card role="alert" className="text-rose-700">
          {error}
          {session && (
            <button
              className="ss-secondary ml-3"
              disabled={busy}
              onClick={async () => {
                try {
                  const d = await api("/api/reinforcement/" + session.id);
                  setSession(d.session);
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Server holatini ochish
            </button>
          )}
        </Card>
      )}
      {!session ? (
        <>
          <label className="block text-sm">
            Mavzu
            <Select value={lesson} onChange={(e) => setLesson(e.target.value)}>
              <option value="">Barcha ruxsat berilgan mavzular</option>
              {data.lessons.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.subject} · {l.title}
                </option>
              ))}
            </Select>
          </label>
          {data.active.map((s: any) => (
            <Toast key={s.id}>
              Boshlangan mashq bor.{" "}
              <button
                className="font-semibold underline"
                onClick={() => setSession(s)}
              >
                Davom etish
              </button>
            </Toast>
          ))}
          <p className="text-sm text-slate-500">
            Bugungi limitdan {data.remaining} savol qoldi.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.games.map((g: any) => (
              <Card key={g.id}>
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                  {g.mechanic === "cards"
                    ? "Xotiradan eslash"
                    : g.mechanic === "matching"
                      ? "Moslashtirish"
                      : g.mechanic === "ordering"
                        ? "Tartiblash"
                        : g.mechanic === "short"
                          ? "Qisqa javob"
                          : "Savol-javob"}
                </p>
                <h2 className="mt-2 text-xl font-bold">{g.name}</h2>
                <p className="my-3 min-h-12 text-sm leading-6 text-slate-500">
                  {descriptions[g.id]}
                </p>
                <Button
                  disabled={busy || !g.available || !data.remaining}
                  onClick={() =>
                    void run("/api/reinforcement/start", {
                      game: g.id,
                      lessonId: lesson,
                    })
                  }
                >
                  {g.available ? "5 savollik mashq" : "Mos savollar hali yo‘q"}
                </Button>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="font-bold">
                {data.games.find((g: any) => g.id === session.game)?.name}
              </h2>
              <p className="text-sm text-slate-500">
                {session.index}/{session.total} savol
              </p>
            </div>
            <progress
              aria-label="Mashq davomiyligi"
              className="mt-4 h-2 w-full"
              max={session.total}
              value={session.index}
            />
            {feedback ? (
              <div className="mt-5 space-y-4">
                <p className="font-semibold">
                  {feedback.selfReported
                    ? "Kartochka qayd qilindi"
                    : feedback.correct
                      ? "To‘g‘ri yechim"
                      : "Yechimni birga ko‘rib chiqamiz"}
                </p>
                <p className="whitespace-pre-wrap text-sm">{feedback.prompt}</p>
                <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-950">
                  {feedback.correctAnswer}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-7">
                  {feedback.explanation}
                </p>
                <Button onClick={() => setFeedback(undefined)}>
                  {session.status === "finished"
                    ? "Natijani ko‘rish"
                    : "Keyingi savol"}
                </Button>
              </div>
            ) : session.status === "finished" ? (
              <div className="mt-5 space-y-4">
                <h3 className="text-2xl font-bold">Mashq yakunlandi</h3>
                <p className="text-sm leading-7">
                  {cards
                    ? `${session.correct} kartochkani eslaganingizni belgiladingiz.`
                    : `${session.correct} savol to‘g‘ri yechildi.`}{" "}
                  Bu rasmiy baho emas. Qisqa tanaffus qiling.
                </p>
                <Button
                  onClick={() => {
                    setSession(undefined);
                    setFeedback(undefined);
                  }}
                >
                  Mashqlar ro‘yxati
                </Button>
              </div>
            ) : q ? (
              <div className="mt-5 space-y-5">
                {cards ? (
                  <>
                    <p className="whitespace-pre-wrap text-lg leading-8">
                      {q.prompt}
                    </p>
                    {q.image && (
                      <img
                        src={q.image}
                        alt="Savol rasmi"
                        className="max-h-80 max-w-full rounded-xl"
                      />
                    )}
                    {session.revealed ? (
                      <>
                        <div className="rounded-2xl bg-blue-50 p-5 text-blue-950">
                          <p className="whitespace-pre-wrap font-semibold">
                            {session.revealed.answer}
                          </p>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
                            {session.revealed.explanation}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Button
                            busy={busy}
                            onClick={() =>
                              void run(
                                "/api/reinforcement/" + session.id + "/answer",
                                {
                                  revision: session.revision,
                                  remembered: true,
                                },
                              )
                            }
                          >
                            Xotiradan esladim
                          </Button>
                          <button
                            className="ss-secondary"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                "/api/reinforcement/" + session.id + "/answer",
                                {
                                  revision: session.revision,
                                  remembered: false,
                                },
                              )
                            }
                          >
                            Yana takrorlayman
                          </button>
                        </div>
                      </>
                    ) : (
                      <Button
                        busy={busy}
                        onClick={() =>
                          void run(
                            "/api/reinforcement/" + session.id + "/reveal",
                            { revision: session.revision },
                          )
                        }
                      >
                        Javobni ochish
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <QuestionInput
                      question={q}
                      value={answer}
                      onChange={setAnswer}
                    />
                    <Button
                      busy={busy}
                      disabled={!answer.trim()}
                      onClick={() =>
                        void run(
                          "/api/reinforcement/" + session.id + "/answer",
                          { revision: session.revision, answer },
                        )
                      }
                    >
                      Javobni tekshirish
                    </Button>
                  </>
                )}
                <button
                  className="ss-secondary"
                  disabled={busy}
                  onClick={() =>
                    void run("/api/reinforcement/" + session.id + "/answer", {
                      revision: session.revision,
                      finish: true,
                    })
                  }
                >
                  Mashqni hozir yakunlash
                </button>
              </div>
            ) : (
              <EmptyState title="Mashq tugadi">
                Mashqlar ro‘yxatiga qayting.
              </EmptyState>
            )}
          </Card>
        </>
      )}
    </main>
  );
}
