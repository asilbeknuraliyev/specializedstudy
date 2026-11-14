import React from "react";
import { Link } from "react-router-dom";
import { useLearnOS } from "../context/LearnOSContext";
import { Card } from "./DesignSystem";
export function WorkflowHub() {
  const { currentUser } = useLearnOS(),
    teacher = currentUser?.role === "teacher",
    prefix = teacher ? "teacher" : "admin";
  const groups = teacher
    ? [
        [
          "Darsga tayyorlanish",
          [
            ["/teacher/workspace/plans", "Ish rejalari"],
            ["/teacher/workspace/lessons", "Mavzular"],
            ["/teacher/workspace/materials", "Dars materiallari"],
            ["/teacher/topic-bank", "Savollar va mavzu testlari"],
          ],
        ],
        [
          "Dars va topshiriq",
          [
            ["/teacher/workspace/assignments", "Vazifa va shablonlar"],
            ["/teacher/assessments", "BSB / CHSB"],
            ["/teacher/workspace/attendance", "Davomat"],
            ["/teacher/workspace/announcements", "Sinf e’lonlari"],
          ],
        ],
        [
          "O‘quvchiga yordam",
          [
            ["/teacher/workspace/students", "O‘quvchi 360°"],
            ["/teacher/workspace/map", "Bilim xaritasi"],
            ["/teacher/topic-analysis", "Savol tahlili"],
            ["/teacher/workspace/support", "Yordam rejalari"],
            ["/teacher/discipline", "Intizom va apellyatsiya"],
          ],
        ],
      ]
    : [
        [
          "Tayyorlash",
          [
            ["/admin/content", "Kontent va import"],
            ["/admin/timetable", "Dars jadvali va to‘qnashuvlar"],
            ["/admin/classes", "Sinflar"],
            ["/admin/subjects", "Fanlar"],
          ],
        ],
        [
          "O‘tkazish",
          [
            ["/admin/assessments", "BSB / CHSB"],
            ["/admin/topic-bank", "Savollar banki"],
            ["/admin/workspace/assignments", "Vazifalar"],
            ["/admin/workspace/attendance", "Davomat"],
            ["/admin/workspace/materials", "Materiallar"],
          ],
        ],
        [
          "Ko‘rib chiqish",
          [
            ["/admin/workspace/grading", "Yagona tekshirish markazi"],
            ["/admin/topic-analysis", "O‘quv tahlili"],
            ["/admin/workspace/support", "Yordam rejalari"],
            ["/admin/discipline", "Intizom va apellyatsiya"],
          ],
        ],
      ];
  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
          {teacher ? "USTOZ KONTENTI" : "O‘QUV JARAYONI"}
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          {teacher ? "Darsni tayyorlash va o‘tkazish" : "Rejadan natijagacha"}
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">
          Reja → dars → topshiriq → baholash → hisobot. Har bir amal o‘zining
          yagona boshqaruv joyiga olib boradi.
        </p>
      </header>
      {groups.map(([title, links]) => (
        <Card key={title as string}>
          <h2 className="font-semibold">{title as string}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(links as string[][]).map(([to, label]) => (
              <Link key={to} to={to} className="ss-secondary justify-between">
                {label}
                <span aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </Card>
      ))}
      <Link className="ss-secondary" to={"/" + prefix + "/dashboard"}>
        Bugungi asosiy ishlarga qaytish
      </Link>
    </main>
  );
}
