import React from "react";
import { Link } from "react-router-dom";
import { useLearnOS } from "../context/LearnOSContext";
import { Card } from "./DesignSystem";
const learning = [
  ["/student/review", "Takrorlash"],
  ["/student/mistakes", "Xatolar daftari"],
  ["/student/practice", "Fleshkarta va mashqlar"],
  ["/student/topic-progress", "Shaxsiy o‘sish"],
  ["/student/knowledge-map", "O‘quv xaritasi"],
];
const school = [
  ["/student/timetable", "Dars jadvali"],
  ["/student/workspace/attendance", "Davomat"],
  ["/student/workspace/support", "Ustoz tavsiyalari"],
  ["/student/discipline", "Intizom va apellyatsiya"],
  ["/student/learning-privacy", "Rozilik va o‘quv ma’lumotlarim"],
];
export function StudentMenu() {
  const { currentUser } = useLearnOS();
  return (
    <main className="mx-auto max-w-3xl space-y-5">
      <header>
        <p className="text-xs font-semibold text-blue-600">SHAXSIY BO‘LIM</p>
        <h1 className="mt-2 text-3xl font-bold">Men</h1>
        <p className="mt-3 text-sm text-slate-500">
          {currentUser?.displayName} ·{" "}
          {currentUser?.classCode?.toUpperCase() || "Sinf biriktirilmagan"}
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3">
        {[
          ["/student/profile", "Profil va maqsadlar"],
          ["/student/notifications", "Bildirishnomalar"],
          ["/account/security", "Hisob xavfsizligi"],
          ["/help", "Yordam"],
        ].map(([to, label]) => (
          <Link key={to} to={to}>
            <Card className="flex min-h-24 items-center text-sm font-semibold">
              {label} →
            </Card>
          </Link>
        ))}
      </div>
      {[
        ["O‘qishim va rivojlanishim", learning],
        ["Maktabdagi holatim", school],
      ].map(([title, items]) => (
        <details key={title as string} className="ss-surface p-4">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">
            {title as string}
          </summary>
          <nav className="mt-3 space-y-2">
            {(items as string[][]).map(([to, label]) => (
              <Link
                key={to}
                to={to}
                className="ss-secondary w-full justify-between"
              >
                {label}
                <span aria-hidden>→</span>
              </Link>
            ))}
          </nav>
        </details>
      ))}
      <p className="text-sm leading-7 text-slate-500">
        Bugungi ishlar — Bugun sahifasida. Topshiriqlar — Vazifalarda, ustoz
        bahosi — Natijalarda.
      </p>
    </main>
  );
}
