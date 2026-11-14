import { ExamViewport, ExamHeader, QuestionNavigator } from "./ExamWorkspace";
import { ExamImage } from "./ExamImage";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Expand } from "lucide-react";
import { useLearnOS } from "../context/LearnOSContext";
import { ExamSketch } from "./ExamAnswers";
import { useReliableExam } from "../utils/useReliableExam";
import { EXAM_POLICY } from "../utils/examReliability";
import { SubmissionReceipt } from "./SubmissionReceipt";
import type { Assessment } from "../types";
export function ExamRunner({ assessment }: { assessment: Assessment }) {
  const { currentUser } = useLearnOS(),
    exam = useReliableExam(assessment.id, currentUser!.uid);
  const {
      data,
      answers,
      edit: setAnswers,
      finish,
      event,
      receipt,
      busy,
      error,
    } = exam,
    session = data?.session,
    state = data?.state;
  const [index, setIndex] = useState(0),
    [seconds, setSeconds] = useState(0),
    [confirm, setConfirm] = useState(false),
    [showContext, setShowContext] = useState(false),
    [drawing, setDrawing] = useState(false),
    [notice, setNotice] = useState(""),
    [reason, setReason] = useState("");
  const finishRef = useRef(finish);
  finishRef.current = finish;
  const eventRef = useRef(event);
  eventRef.current = event;
  const questions = assessment.questionSnapshot || [],
    q = questions[index];
  const start = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      setNotice(
        "Fullscreen ochilmadi. Bu holat ko‘chirish xulosasi emas; oddiy oynada davom etishingiz mumkin.",
      );
    }
    await exam.start();
  };
  useEffect(() => {
    if (!session || receipt) return;
    const timer = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((data.deadline - Date.now() - data.offset) / 1000),
      );
      setSeconds(remaining);
      if (
        remaining === 0 &&
        state !== "paused" &&
        state !== "review_required" &&
        !exam.conflict
      )
        void finishRef.current(true);
    }, 1000);
    return () => clearInterval(timer);
  }, [
    session?.id,
    data?.deadline,
    data?.offset,
    state,
    receipt,
    exam.conflict,
  ]);
  useEffect(() => {
    if (!session || receipt) return;
    const visibility = () => {
      if (document.hidden) void eventRef.current("tab_hidden");
    };
    const fullscreen = () => {
      if (!document.fullscreenElement) void eventRef.current("fullscreen_exit");
    };
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("fullscreenchange", fullscreen);
    window.addEventListener("beforeunload", unload);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("fullscreenchange", fullscreen);
      window.removeEventListener("beforeunload", unload);
    };
  }, [session?.id, receipt]);
  useEffect(() => {
    if (receipt && document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
  }, [receipt]);
  const review = (
    <section className="ss-surface space-y-3 p-5">
      <h2 className="font-semibold">Ustoz ko‘rigi</h2>
      <p className="text-sm leading-7">
        {EXAM_POLICY.exits} Hodisalar: {session?.exitCount || 0}. Javoblaringiz
        o‘chirilmaydi.
      </p>
      <label className="block text-sm">
        Nima yuz berdi?
        <textarea
          className="ss-field mt-2 min-h-24"
          value={reason}
          maxLength={2000}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Masalan, telefon qo‘ng‘irog‘i yoki tizim oynasi…"
        />
      </label>
      <button
        className="ss-secondary"
        disabled={reason.trim().length < 8}
        onClick={() => void exam.explain(reason)}
      >
        Izoh va qurilma nusxasini ustozga yuborish
      </button>
    </section>
  );
  if (!questions.length)
    return <p role="alert">Nazorat ishiga savollar biriktirilmagan.</p>;
  if (receipt)
    return (
      <div className="mx-auto max-w-2xl space-y-5 py-6">
        <h1 className="text-2xl font-bold">Ish qabul qilindi</h1>
        <SubmissionReceipt receipt={receipt} />
        {exam.unsent && (
          <>
            <p className="rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-950">
              Vaqt tugaguncha serverga yetib bormagan javoblar qurilmada qolgan.
              Ular avtomatik bahoga qo‘shilmaydi. Ustozdan ko‘rib chiqishni
              so‘rashingiz mumkin.
            </p>
            {review}
          </>
        )}
        {error && <p role="status">{error}</p>}
        {exam.notice && (
          <p role="status" className="text-sm text-blue-700 dark:text-blue-300">
            {exam.notice}
          </p>
        )}
        <Link
          className="ss-primary"
          to={"/student/results/" + receipt.attemptId}
        >
          Natijani ochish
        </Link>
      </div>
    );
  if (!session)
    return (
      <div className="mx-auto max-w-2xl space-y-5 py-6">
        <section className="rounded-3xl bg-slate-950 p-7 text-white">
          <p className="text-xs text-blue-300">
            {assessment.examNumber}-{assessment.examKind} · {assessment.quarter}
            -chorak
          </p>
          <h1 className="mt-4 text-2xl font-bold">{assessment.title}</h1>
          <p className="mt-4 text-sm">
            {questions.length} savol · {assessment.durationMinutes} daqiqa ·{" "}
            {assessment.totalPoints} ball
          </p>
        </section>
        <section className="ss-surface space-y-4 p-5">
          <h2 className="font-semibold">Saqlash va imtihon qoidalari</h2>
          <p className="text-sm leading-7">
            Javoblar qurilmada va serverda alohida holat bilan ko‘rsatiladi.
            Aloqa tiklanganda shu oynada avtomatik qayta yuboriladi. Ikki
            oynadan faqat bittasi javob yuboradi; boshqaruvni olish alohida
            tasdiqlanadi.
          </p>
          <p className="text-sm leading-7">{EXAM_POLICY.deadline}</p>
          <p className="text-sm leading-7">{EXAM_POLICY.exits}</p>
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          <button
            className="ss-primary w-full"
            disabled={busy}
            onClick={() => void start()}
          >
            <Expand size={18} />
            {busy ? "Tayyorlanmoqda…" : "Nazorat ishini boshlash"}
          </button>
          <Link className="block text-center text-sm" to="/student/assessments">
            Orqaga
          </Link>
        </section>
      </div>
    );
  let values: Record<string, string> = {};
  try {
    values = JSON.parse(answers[q.id] || "{}");
  } catch {}
  const updateField = (field: string, value: string) =>
    setAnswers((prev) => {
      let fields = {};
      try {
        fields = JSON.parse(prev[q.id] || "{}");
      } catch {}
      return { ...prev, [q.id]: JSON.stringify({ ...fields, [field]: value }) };
    });
  const disabled =
    busy ||
    exam.submitting ||
    exam.conflict ||
    state === "paused" ||
    state === "closed" ||
    state === "review_required";
  return (
    <ExamViewport>
      <ExamHeader
        title={assessment.title}
        subject={`${assessment.examNumber}-${assessment.examKind} · ${index + 1}/${questions.length}-savol`}
        saving={`${exam.localStatus} · ${exam.serverStatus}`}
        seconds={seconds}
        busy={disabled}
        onSubmit={() => setConfirm(true)}
      />
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950"
        >
          {notice}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
          <button className="ml-3 underline" onClick={() => void exam.flush()}>
            Qayta yuborish
          </button>
        </div>
      )}
      {exam.notice && (
        <p
          role="status"
          className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200"
        >
          {exam.notice}
        </p>
      )}
      {exam.conflict && (
        <section
          aria-label="Ikki oyna konflikti"
          className="ss-surface space-y-3 p-5"
        >
          <h2 className="font-semibold">Boshqa oyna boshqaruvda</h2>
          <p className="text-sm leading-7">
            Bu oynadagi javoblar qurilmada saqlanadi. Tanlovingizsiz server
            nusxasi almashtirilmaydi. Quyidagi amal boshqa oynaning yozishini
            to‘xtatadi.
          </p>
          <button
            className="ss-secondary"
            disabled={busy}
            onClick={() => void exam.takeover(false)}
          >
            Server nusxasini olib shu oynada davom etish
          </button>
          <button
            className="ss-secondary"
            disabled={busy}
            onClick={() => void exam.takeover(true)}
          >
            Bu oynadagi nusxani tanlab davom etish
          </button>
        </section>
      )}
      {exam.recovered && (
        <section className="ss-surface space-y-3 p-5">
          <h2 className="font-semibold">Qurilmada boshqa nusxa topildi</h2>
          <p className="text-sm">
            {new Date(exam.recovered.updatedAt).toLocaleString("uz-UZ")}.
            Tiklash server nusxasini siz tanlagan javoblar bilan yangilaydi.
          </p>
          <button
            className="ss-secondary"
            disabled={disabled}
            onClick={exam.restore}
          >
            Qurilma nusxasini tiklash
          </button>
          <button className="ss-secondary" onClick={exam.dismissRecovery}>
            Hozirgi nusxada qolish
          </button>
        </section>
      )}
      {state === "review_required" && review}
      {state === "paused" && (
        <p role="status">
          Nazorat pauzada. Javoblaringiz saqlanadi; davom etishini kuting.
        </p>
      )}
      <QuestionNavigator
        questions={questions}
        index={index}
        answers={answers}
        onChange={(i) => {
          setIndex(i);
          setDrawing(false);
        }}
      />
      {assessment.contextImages?.length ? (
        <section className="ss-surface p-4">
          <button
            className="flex items-center gap-2 text-sm font-semibold text-blue-600"
            onClick={() => setShowContext(!showContext)}
          >
            <BookOpen size={17} />
            Umumiy matn / ko‘rsatmalar {showContext ? "— yashirish" : ""}
          </button>
          {showContext &&
            assessment.contextImages.map((src, i) => (
              <ExamImage
                key={i}
                src={src}
                alt="Savollar uchun umumiy manba matni"
                className="mt-3 w-full bg-white"
              />
            ))}
        </section>
      ) : null}
      <section className="ss-surface space-y-5 p-4 sm:p-6">
        <div className="flex justify-between text-sm">
          <h2 className="font-semibold">{index + 1}-savol</h2>
          <span className="text-slate-500">{q.points} ball</span>
        </div>
        {q.sourceImages?.length ? (
          q.sourceImages.map((src, n) => (
            <div
              key={q.id + "-" + n}
              className="relative overflow-hidden rounded-lg border bg-white"
            >
              <ExamImage
                src={src}
                alt={`${index + 1}-savol, manba ${q.sourcePages?.[n] || n + 1}-sahifa`}
                className="block w-full"
              />
              {q.type !== "single_choice" &&
                q.answerFields
                  ?.filter((f) => f.imageIndex === n)
                  .map((f) => (
                    <textarea
                      key={f.id}
                      aria-label={f.label}
                      disabled={disabled}
                      value={values[f.id] || ""}
                      onChange={(e) => updateField(f.id, e.target.value)}
                      className="absolute resize-none rounded border border-blue-500 bg-white/95 px-1 text-[clamp(10px,1.5vw,16px)] leading-tight text-slate-900 focus:z-10 focus:min-h-12"
                      style={{
                        left: `${f.x * 100}%`,
                        top: `${f.y * 100}%`,
                        width: `${Math.max(f.width, 0.06) * 100}%`,
                        height: `${f.height * 100}%`,
                      }}
                    />
                  ))}
            </div>
          ))
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-7">{q.prompt}</p>
        )}
        {q.type === "single_choice" ? (
          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-semibold">
              Bitta javobni tanlang
            </legend>
            {q.options?.map((option, i) => (
              <label
                key={i}
                className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-4 ${answers[q.id] === option ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40" : "border-slate-200 dark:border-slate-700"}`}
              >
                <input
                  type="radio"
                  name={q.id}
                  disabled={disabled}
                  checked={answers[q.id] === option}
                  onChange={() => setAnswers({ ...answers, [q.id]: option })}
                />
                <span className="text-sm">
                  {String.fromCharCode(65 + i)}) {option}
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <>
            <label className="block text-sm font-semibold">
              Javob / yechim / izoh
              <textarea
                className="ss-field mt-2 min-h-36 font-normal leading-7"
                disabled={disabled}
                placeholder="Javobingizni yozing…"
                value={values._text || ""}
                onChange={(e) => updateField("_text", e.target.value)}
              />
            </label>
            <button
              className="ss-secondary"
              onClick={() => setDrawing(!drawing)}
            >
              Chizma maydoni {drawing ? "— yashirish" : "ochish"}
            </button>
            {drawing && (
              <ExamSketch
                key={q.id}
                value={values._drawing || ""}
                disabled={disabled}
                onChange={(value) => updateField("_drawing", value)}
              />
            )}
          </>
        )}
        <div className="flex justify-between gap-3">
          <button
            className="ss-secondary"
            disabled={!index}
            onClick={() => setIndex(index - 1)}
          >
            Oldingi
          </button>
          <button
            className="ss-secondary"
            disabled={index === questions.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            Keyingi
          </button>
        </div>
      </section>
      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Nazoratni topshirish"
            className="ss-surface w-full max-w-md space-y-5 p-6"
          >
            <h2 className="text-xl font-bold">Ishni topshirasizmi?</h2>
            <p className="text-sm text-slate-500">
              Topshirilgandan keyin javoblarni o‘zgartirib bo‘lmaydi. Yozma
              javoblarni vakolatli ustoz baholaydi. Tasdiq raqami server qabul
              qilgandan keyin beriladi.
            </p>
            <div className="flex gap-3">
              <button
                className="ss-secondary"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                Davom etish
              </button>
              <button
                className="ss-primary"
                disabled={busy}
                onClick={() => {
                  setConfirm(false);
                  void finish();
                }}
              >
                {busy ? "Yuborilmoqda…" : "Topshirish"}
              </button>
            </div>
          </section>
        </div>
      )}
    </ExamViewport>
  );
}
