import React, { lazy, Suspense, useState } from "react";
const Formal = lazy(() =>
  import("./TeacherExamGrading").then((m) => ({
    default: m.TeacherExamGrading,
  })),
);
const Topic = lazy(() =>
  import("./TopicGradingCenter").then((m) => ({
    default: m.TopicGradingCenter,
  })),
);
const Events = lazy(() =>
  import("./ExamSessionReview").then((m) => ({ default: m.ExamSessionReview })),
);
export function ReviewDesk({ children }: React.PropsWithChildren) {
  const [tab, setTab] = useState("assignments");
  return (
    <section className="space-y-5">
      <p className="text-sm text-slate-500">
        Ish, o‘quvchining javobi, mezon va ustoz fikri bitta tekshirish
        markazida.
      </p>
      <nav
        aria-label="Tekshirish turi"
        className="flex gap-2 overflow-x-auto pb-2"
      >
        {[
          ["assignments", "Vazifalar"],
          ["formal", "BSB / CHSB"],
          ["topic", "Mavzu javoblari"],
          ["events", "Hodisalar ko‘rigi"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === tab}
            className={
              id === tab ? "ss-primary shrink-0" : "ss-secondary shrink-0"
            }
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <Suspense fallback={<p role="status">Tekshirish oynasi ochilmoqda…</p>}>
        {tab === "assignments" ? (
          children
        ) : tab === "formal" ? (
          <Formal />
        ) : tab === "topic" ? (
          <Topic />
        ) : (
          <Events />
        )}
      </Suspense>
    </section>
  );
}
