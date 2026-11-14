import React from "react";
import type { ExamReceipt } from "../utils/examReliability";
export function SubmissionReceipt({ receipt }: { receipt?: ExamReceipt }) {
  if (!receipt) return null;
  return (
    <section
      aria-label="Topshirish kvitansiyasi"
      className="ss-surface space-y-3 border-emerald-300 p-5"
    >
      <p className="font-semibold text-emerald-700 dark:text-emerald-300">
        Topshirish serverda tasdiqlandi
      </p>
      <p className="break-all text-sm">
        <span className="text-slate-500 dark:text-slate-400">Tasdiq raqami: </span>
        <strong>{receipt.id}</strong>
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {new Date(receipt.submittedAt).toLocaleString("uz-UZ")} · saqlash v
        {receipt.revision}
      </p>
      <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
        Bu kvitansiya ish qabul qilinganini tasdiqlaydi. Yozma javoblarning
        yakuniy bahosi ustoz tekshiruvidan keyin chiqadi.
      </p>
      <button
        className="ss-secondary"
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(receipt, null, 2)], {
              type: "application/json",
            }),
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = receipt.id + ".json";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        Kvitansiyani yuklab olish
      </button>
    </section>
  );
}
