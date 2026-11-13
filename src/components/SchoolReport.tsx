import React, { useEffect, useState } from "react";
import { useExamApi } from "../utils/useExamApi";
import { Button, Card, Input, Skeleton } from "./DesignSystem";
import { schoolExcel, openSchoolPrint } from "../utils/schoolExport";
export function SchoolReport({ classId = "" }: { classId?: string }) {
  const api = useExamApi(),
    [month, setMonth] = useState(
      new Date()
        .toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" })
        .slice(0, 7),
    ),
    [data, setData] = useState<any>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setData(undefined);
    api("/api/workspace/report?" + new URLSearchParams({ classId, month }))
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [api, classId, month]);
  const excel = async () => {
    setBusy(true);
    try {
      await schoolExcel(
        "Davomat-" + month,
        ["Sana", "Dars", "O‘quvchi", "Sinf", "Fan", "Holat", "Izoh"],
        data.attendance.map((r: any) => [
          r.date,
          r.lessonNumber || "Kunlik",
          r.studentName,
          r.classCode,
          r.subject || "Eski kunlik qayd",
          r.status,
          r.notes || "",
        ]),
      );
      await schoolExcel(
        "Vazifalar-" + month,
        [
          "O‘quvchi",
          "Sinf",
          "Vazifa",
          "Holat",
          "Ball",
          "Maksimal ball",
          "Izoh",
        ],
        data.submissions.map((s: any) => [
          s.studentName,
          s.classCode,
          s.assignmentTitle,
          s.status,
          s.score ?? "",
          s.maxScore,
          s.feedback || "",
        ]),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <h2 className="font-bold">Oylik davomat va yozma ish hisoboti</h2>
      <label className="my-4 block text-sm">
        Hisobot oyi
        <Input
          type="month"
          value={month}
          onChange={(e) => {
            setError("");
            setMonth(e.target.value);
          }}
        />
      </label>
      {error && (
        <p role="alert" className="mb-4 text-sm text-rose-700">
          {error}
        </p>
      )}
      {!data ? (
        <Skeleton />
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500">{data.scope}</p>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["present", "Qatnashdi"],
              ["late", "Kechikdi"],
              ["absent", "Qatnashmadi"],
              ["excused", "Sababli"],
              ["submissions", "Topshirishlar"],
              ["graded", "Tekshirilgan"],
            ].map(([key, label]) => (
              <div className="rounded-xl border p-3" key={key}>
                <p className="text-2xl font-bold text-blue-600">
                  {data.counts[key]}
                </p>
                <p className="mt-2 text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>
          <p className="mb-4 text-xs leading-6 text-slate-500">
            Davomat sonlari qayd etilgan darslar kesimida. Eski kunlik qaydlar
            eksportda alohida belgilangan. Rasmiy baho yoki intizom balli
            avtomatik o‘zgarmaydi.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button busy={busy} onClick={() => void excel()}>
              Excel · davomat va ishlar
            </Button>
            <button
              className="ss-secondary"
              onClick={() => {
                const popup = window.open("", "_blank");
                const text = [
                  data.scope,
                  month,
                  ...Object.entries(data.counts).map(([k, v]) => `${k}: ${v}`),
                  "",
                  "Davomat",
                  ...data.attendance.map(
                    (r: any) =>
                      `${r.date} · ${r.lessonNumber || "Kunlik"} · ${r.studentName} · ${r.classCode} · ${r.status} · ${r.notes || ""}`,
                  ),
                  "",
                  "Yozma ishlar",
                  ...data.submissions.map(
                    (s: any) =>
                      `${s.studentName} · ${s.assignmentTitle} · ${s.status} · ${s.score ?? "—"}/${s.maxScore} · ${s.feedback || ""}`,
                  ),
                ].join("\n");
                openSchoolPrint(
                  popup,
                  "Specialized Study · oylik hisobot",
                  text,
                  "Shaxsiy ruxsat doirasidagi hisobot",
                );
              }}
            >
              PDF / chop etish
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
