import React from "react";
export function StudentLearningSummary({ details }: { details: any }) {
  return (
    <section className="mt-5 space-y-4">
      <h3 className="font-semibold">Test urinishlari va qiyin mavzular</h3>
      <p className="text-xs leading-6 text-slate-500">
        Faqat sizga biriktirilgan fan va sinf. Kutilayotgan yozma ball yakuniy
        natija hisoblanmaydi.
      </p>
      {details.learningResults?.map((r: any) => (
        <article className="space-y-2 rounded-xl border p-3 text-sm" key={r.id}>
          <p className="font-semibold">{r.title}</p>
          <p>
            {r.kind} · {r.submittedAt?.slice(0, 10)} ·{" "}
            {r.pending
              ? "Inson tekshiruvi kutilmoqda"
              : `${r.scorePercent ?? "—"}%`}
          </p>
        </article>
      ))}
      {!details.learningResults?.length && (
        <p className="text-sm text-slate-500">Hali mos test urinishi yo‘q.</p>
      )}
      <h3 className="font-semibold">O‘zlashtirish dalillari</h3>
      {details.progress?.map((r: any) => (
        <p key={r.id} className="border-t py-3 text-sm">
          {r.lessonTitle || r.subject} · {r.attempted}/{r.pool} ishlangan ·{" "}
          {r.retained} mustahkamlangan · {r.unresolved} ochiq xato
        </p>
      ))}
      <h3 className="font-semibold">Takrorlashdagi xatolar · oxirgi 14 kun</h3>
      <p className="text-xs leading-6 text-slate-500">
        Kuzatilgan mashqlar soni. Ma’lumot bo‘lmagan kun uchun xulosa
        chiqarilmaydi.
      </p>
      {details.errorTrend?.map((r: any) => (
        <p className="border-t py-2 text-sm" key={r.day}>
          {r.day} · {r.wrong}/{r.total} javob qayta ko‘rib chiqishni talab
          qilgan
        </p>
      ))}
      {!details.errorTrend?.length && (
        <p className="text-sm text-slate-500">
          Bu davr uchun takrorlash dalili yetarli emas.
        </p>
      )}
    </section>
  );
}
