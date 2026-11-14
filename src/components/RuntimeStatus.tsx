import React from "react";
export function RuntimeStatus({ value }: { value: any }) {
  if (!value) return null;
  const labels: Record<string, string> = {
    conflict: "Parallel saqlash to‘qnashuvi",
    read_failed: "Snapshot o‘qilmadi",
    write_failed: "Snapshot saqlanmadi",
    internal: "Ichki xato",
    quota_exhausted: "Firebase kvotasi tugagan",
  };
  return (
    <section className="mt-6 space-y-4 border-t pt-5">
      <h3 className="font-semibold">Ma’lumot saqlash kuzatuvi</h3>
      <p className="text-xs leading-6 text-slate-500">
        Faqat hozirgi server nusxasidagi hujjat o‘qish/yozish urinishlari. Nusxa
        yangilansa sanash qayta boshlanadi. Bu hisob-faktura yoki loyihaning
        kunlik kvotasi emas.
      </p>
      <p className="text-xs text-slate-500">
        Nusxa boshlangan:{" "}
        {new Date(value.startedAt).toLocaleString("uz-UZ", {
          timeZone: "Asia/Tashkent",
        })}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {[
          [value.snapshotReadAttempts, "O‘qish urinishlari"],
          [value.snapshotWriteAttempts, "Yozish urinishlari"],
          [value.conflicts, "409 to‘qnashuvlar"],
        ].map(([n, label]) => (
          <div className="rounded-xl border p-3" key={label}>
            <p className="text-xl font-bold text-blue-600">{n}</p>
            <p className="mt-2 text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      <h4 className="text-sm font-semibold">
        Oxirgi saqlash xatolari · ko‘pi bilan 20 ta
      </h4>
      {value.errors.length ? (
        value.errors
          .slice()
          .reverse()
          .map((r: any, i: number) => (
            <p key={i} className="text-xs">
              {new Date(r.at).toLocaleString("uz-UZ", {
                timeZone: "Asia/Tashkent",
              })}{" "}
              · {labels[r.kind] || "Ichki xato"}
            </p>
          ))
      ) : (
        <p className="text-xs text-slate-500">
          Bu server nusxasida saqlash xatosi qayd etilmagan.
        </p>
      )}
      <a
        className="ss-secondary inline-flex"
        target="_blank"
        rel="noopener noreferrer"
        href="https://console.firebase.google.com/project/specialized-study/firestore"
      >
        Haqiqiy foydalanish va kvota · Firebase Console ↗
      </a>
    </section>
  );
}
