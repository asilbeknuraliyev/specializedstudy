import {RuntimeStatus} from './RuntimeStatus';
import {useUnsavedChanges} from '../utils/useUnsavedChanges';
import {ContentCoverage} from './ContentCoverage';
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useExamApi } from "../utils/useExamApi";
import {
  Button,
  Card,
  Drawer,
  Input,
  Select,
  Skeleton,
  Tabs,
  Toast,
} from "./DesignSystem";
import { schoolExcel } from "../utils/schoolExport";
export function SchoolControlCenter() {
  const api = useExamApi(),
    [data, setData] = useState<any>(),
    [view, setView] = useState("Umumiy"),
    [page, setPage] = useState(0),
    [version, setVersion] = useState(0),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [dialog, setDialog] = useState<any>(),
    [form, setForm] = useState<any>({}),
    [preview, setPreview] = useState<any>(),
    op = useRef<{ key: string; id: string } | undefined>(undefined),
    lock = useRef(false);
  useUnsavedChanges(!!dialog&&dialog.kind!=='audit');
  useEffect(() => {
    let live = true;
    api("/api/school-admin?page=" + page)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [api, page, version]);
  const run = async (path: string, body: any) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const key = JSON.stringify({ path, body });
    if (op.current?.key !== key) op.current = { key, id: crypto.randomUUID() };
    try {
      const d = await api(path, "POST", {
        ...body,
        operationId: op.current.id,
      });
      op.current = undefined;
      setVersion((v) => v + 1);
      setMessage(
        d.duplicate ? "Oldin bajarilgan amal tekshirildi." : "Amal saqlandi.",
      );
      return d.result;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const openPilot = (p?: any) => {
    const date =
      data?.status &&
      new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
    setForm(
      p
        ? { ...p, summary: undefined }
        : {
            revision: 0,
            title: "",
            testId: data.tests[0]?.id || "",
            testVersion: data.tests[0]?.version || 1,
            groupA: [],
            groupB: [],
            preFrom: date,
            preTo: date,
            postFrom: date,
            postTo: date,
            status: "draft",
            schoolPermissionAcknowledged: false,
            reason: "",
          },
    );
    setDialog({ kind: "pilot" });
  };
  const close = () => {
    if (
      !busy &&
      window.confirm("Yozuv oynasini yopasizmi? Saqlanmagan matn saqlanmaydi.")
    ) {
      setDialog(undefined);
      setPreview(undefined);
    }
  };
  if (!data)
    return error ? (
      <Card role="alert">
        {error}
        <button
          className="ss-secondary ml-2"
          onClick={() => setVersion((v) => v + 1)}
        >
          Qayta urinish
        </button>
      </Card>
    ) : (
      <Skeleton />
    );
  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-3xl bg-slate-950 p-6 text-white">
        <p className="text-xs uppercase tracking-widest text-blue-300">
          Maktab boshqaruvi
        </p>
        <h1 className="mt-3 text-3xl font-bold">Boshqaruv markazi</h1>
        <p className="mt-3 text-sm text-slate-300">
          Haqiqiy maktab ma’lumotlari, ruxsatlar va tekshiriladigan tarix.
        </p>
      </header>
      {error && (
        <Card role="alert" className="text-rose-700">
          {error}
        </Card>
      )}
      {message && <Toast>{message}</Toast>}
      <Tabs
        items={[
          "Umumiy",
          "Kontent qamrovi",
          "Pilot o‘lchovi",
          "Ma’lumot siyosati",
          "Audit va zaxira",
          "Tizim holati",
        ]}
        value={view}
        onChange={setView}
      />
      {view === "Umumiy" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(data.counts).map(([key, n]) => {
              const labels: Record<string, string> = {
                students: "O‘quvchilar",
                teachers: "Ustozlar",
                classes: "Sinflar",
                lessons: "Darslar",
                pendingGrading: "Tekshiriladigan ishlar",
                pendingDiscipline: "Tasdiqlash kutilmoqda",
                appeals: "Ochiq e’tirozlar",
                missingContent: "Mavzu testi yetishmaydi",
                pilots: "Pilot dasturlar",
                deletionRequests: "Ma’lumot so‘rovlari",
              };
              return (
                <Card key={key}>
                  <p className="text-3xl font-bold text-blue-600">
                    {String(n)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{labels[key]}</p>
                </Card>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["/admin/accounts", "Hisoblar va kirish kartochkalari"],
              ["/admin/teachers", "Ustozlarni biriktirish"],
              ["/admin/classes", "Sinflar"],
              ["/admin/content", "Kontent va import"],
              ["/admin/timetable", "Jadval va to‘qnashuvlar"],
              ["/admin/assessments", "BSB / CHSB"],
              ["/admin/discipline", "Intizom va e’tirozlar"],
              ["/admin/workspace/grading", "Yozma ishlarni tekshirish"],
              ["/admin/topic-analysis", "O‘quv tahlili"],
              ["/admin/workspace/support", "Yordam rejalari"],
              ["/admin/notifications", "Bildirishnomalar"],
              ["/admin/settings", "Maktab sozlamalari"],
            ].map(([to, label]) => (
              <Link key={to} className="ss-secondary" to={to}>
                {label} →
              </Link>
            ))}
          </div>
        </>
      )}
      {view === 'Kontent qamrovi'&&<ContentCoverage/>}
      {view === "Pilot o‘lchovi" && (
        <>
          <Card>
            <h2 className="font-bold">
              Guruhlar bo‘yicha oldingi / keyingi o‘lchov
            </h2>
            <p className="my-3 text-sm leading-7">
              Bir xil test versiyasi va ikkala davrda qatnashgan o‘quvchilarning
              birinchi topshirishi olinadi. Kamida 5 juft kuzatuvsiz o‘rtacha
              natija ochilmaydi. Guruh farqi sababiy ta’sirni isbotlamaydi.
            </p>
            <Button onClick={() => openPilot()}>
              Pilot qoralamasi yaratish
            </Button>
          </Card>
          {data.pilots.map((p: any) => (
            <Card key={p.id}>
              <div className="flex flex-wrap justify-between gap-3">
                <h2 className="font-bold">{p.title}</h2>
                <span className="text-xs text-slate-500">
                  {p.status} · v{p.revision}
                </span>
              </div>
              <p className="my-3 text-sm">
                Oldingi: {p.preFrom}–{p.preTo}; keyingi: {p.postFrom}–{p.postTo}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {["groupA", "groupB"].map((key, i) => {
                  const g = p.summary[key];
                  return (
                    <section
                      className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900"
                      key={key}
                    >
                      <h3 className="font-semibold">
                        {i === 0 ? "A" : "B"} guruhi
                      </h3>
                      <p className="mt-2 text-sm">
                        {g.consented}/{g.enrolled} rozilik ·{" "}
                        {g.paired ?? "5 tadan kam"} juft kuzatuv
                      </p>
                      <p className="mt-2 text-sm">
                        {g.prePercent ?? "—"}% → {g.postPercent ?? "—"}% ·
                        o‘zgarish {g.changePoints ?? "—"} foiz punkt
                      </p>
                      <p className="mt-2 text-xs text-slate-500">{g.notice}</p>
                    </section>
                  );
                })}
              </div>
              <p className="my-3 text-xs text-slate-500">{p.summary.notice}</p>
              <div className="flex flex-wrap gap-3">
                <button className="ss-secondary" onClick={() => openPilot(p)}>
                  Sozlamalar
                </button>
                <Button
                  busy={busy}
                  onClick={async () => {
                    const r = await run(
                      "/api/school-admin/pilots/" + p.id + "/export",
                      {},
                    );
                    if (r) {
                      const s = r.report;
                      await schoolExcel(
                        "Pilot-guruh-hisoboti",
                        [
                          "Guruh",
                          "Rozilik",
                          "Juft kuzatuv",
                          "Oldingi %",
                          "Keyingi %",
                          "O‘zgarish (foiz punkt)",
                        ],
                        ["groupA", "groupB"].map((k, i) => [
                          i === 0 ? "A" : "B",
                          s[k].consented,
                          s[k].paired ?? "Yetarli emas",
                          s[k].prePercent ?? "",
                          s[k].postPercent ?? "",
                          s[k].changePoints ?? "",
                        ]),
                      );
                    }
                  }}
                >
                  Ismlarsiz Excel
                </Button>
              </div>
            </Card>
          ))}
        </>
      )}
      {view === "Ma’lumot siyosati" && (
        <>
          <Card>
            <h2 className="font-bold">O‘quv mashqlari ma’lumotini saqlash</h2>
            <p className="my-3 text-sm leading-7">
              Joriy muddat: {data.retention.days} kun ·{" "}
              {data.retention.approved
                ? "Tasdiqlangan"
                : "Tasdiqlanmagan namuna"}
              . Avtomatik o‘chirish o‘chiq. Rasmiy nazorat, davomat va intizom
              hujjatlari bu amal bilan o‘chmaydi.
            </p>
            <button
              className="ss-secondary"
              onClick={() => {
                setForm({ ...data.retention, reason: "" });
                setDialog({ kind: "retention" });
              }}
            >
              Muddatni boshqarish
            </button>
          </Card>
          <Card>
            <h2 className="font-bold">
              Ixtiyoriy rozilik matni · {data.consent.version}
            </h2>
            <p className="mt-3 text-sm leading-7">{data.consent.text}</p>
          </Card>
          {data.deletions.map((r: any) => (
            <Card key={r.id}>
              <h2 className="font-bold">
                {data.students.find((s: any) => s.id === r.studentId)?.name ||
                  "O‘quvchi so‘rovi"}
              </h2>
              <p className="mt-3 text-sm">{r.reason}</p>
              <p className="my-3 text-xs text-slate-500">
                {r.status} · {r.createdAt}
              </p>
              {r.status === "pending" && (
                <button
                  className="ss-secondary"
                  onClick={() => {
                    setForm({ reason: "", confirmation: "" });
                    setDialog({ kind: "deletion", row: r });
                    setPreview(undefined);
                  }}
                >
                  Sinov ko‘rinishi va ko‘rib chiqish
                </button>
              )}
            </Card>
          ))}
        </>
      )}
      {view === "Audit va zaxira" && (
        <>
          <Card>
            <h2 className="font-bold">Maktab ma’lumotlari eksporti</h2>
            <p className="my-3 text-sm leading-7">
              Boshqaruv ma’lumotlari JSON formatda olinadi. Parollar va maxfiy
              server sozlamalari eksportga kiritilmaydi. Bu to‘liq server
              snapshotining o‘rnini bosmaydi; tiklash operator tomonidan
              tekshiriladi.
            </p>
            <Button
              busy={busy}
              onClick={async () => {
                const reason = window.prompt(
                  "Eksportning aniq sababini yozing (kamida 8 belgi)",
                );
                if (!reason) return;
                const r = await run("/api/school-admin/backup", { reason });
                if (r) {
                  const a = document.createElement("a"),
                    url = URL.createObjectURL(
                      new Blob([JSON.stringify(r, null, 2)], {
                        type: "application/json",
                      }),
                    );
                  a.href = url;
                  a.download = "Specialized-Study-maktab-zaxirasi.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
              }}
            >
              JSON zaxira eksporti
            </Button>
          </Card>
          <Card>
            <h2 className="mb-3 font-bold">
              O‘zgartirishlar tarixi · {data.audit.total}
            </h2>
            {data.audit.rows.map((r: any) => (
              <button
                className="block w-full border-t py-4 text-left"
                key={r.id}
                onClick={() => setDialog({ kind: "audit", row: r })}
              >
                <p className="font-semibold">{r.action}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {r.actorName} · {r.at}
                </p>
              </button>
            ))}
            <div className="mt-3 flex justify-between">
              <button
                className="ss-secondary"
                disabled={!page}
                onClick={() => setPage((p) => p - 1)}
              >
                Oldingi
              </button>
              <span className="text-sm">
                {page + 1}/{Math.max(1, Math.ceil(data.audit.total / 20))}
              </span>
              <button
                className="ss-secondary"
                disabled={(page + 1) * 20 >= data.audit.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Keyingi
              </button>
            </div>
          </Card>
        </>
      )}
      {view === "Tizim holati" && (
        <Card>
          <h2 className="font-bold">Joriy server muhiti</h2>
          <RuntimeStatus value={data.runtime}/>
          {Object.entries(data.status).map(([k, v]) => (
            <p className="mt-4 break-all text-sm" key={k}>
              <strong>{k}: </strong>
              {String(v)}
            </p>
          ))}
          <p className="mt-5 text-sm text-slate-500">
            Bu sozlama holati. Uzluksiz ishlash yoki kirib bo‘lmaslik kafolati
            emas.
          </p>
          <Button className="mt-4" onClick={() => setVersion((v) => v + 1)}>
            Holatni yangilash
          </Button>
        </Card>
      )}
      {dialog && (
        <Drawer
          title={
            dialog.kind === "pilot"
              ? "Pilot sozlamalari"
              : dialog.kind === "retention"
                ? "Saqlash muddati"
                : dialog.kind === "audit"
                  ? "Audit voqeasi"
                  : "Ma’lumot so‘rovi"
          }
          onClose={close}
          dismissible={!busy}
        >
          {error && (
            <p role="alert" className="mb-4 text-sm text-rose-700">
              {error}
            </p>
          )}
          {dialog.kind === "audit" ? (
            <pre className="whitespace-pre-wrap break-all text-xs leading-6">
              {JSON.stringify(dialog.row, null, 2)}
            </pre>
          ) : (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (dialog.kind === "pilot") {
                  if (await run("/api/school-admin/pilots", form))
                    setDialog(undefined);
                } else if (dialog.kind === "retention") {
                  if (
                    await run("/api/school-admin/retention", {
                      revision: form.revision,
                      days: Number(form.days),
                      approved: !!form.approved,
                      reason: form.reason,
                    })
                  )
                    setDialog(undefined);
                }
              }}
            >
              {dialog.kind === "pilot" && (
                <>
                  <label className="block text-sm">
                    Nomi
                    <Input
                      required
                      value={form.title}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    Bir xil, o‘zgarmaydigan test versiyasi
                    <Select
                      value={form.testId + ":" + form.testVersion}
                      onChange={(e) => {
                        const t = data.tests.find(
                          (t: any) => t.id + ":" + t.version === e.target.value,
                        );
                        setForm({
                          ...form,
                          testId: t.id,
                          testVersion: t.version,
                        });
                      }}
                    >
                      {data.tests.map((t: any) => (
                        <option
                          key={t.id + ":" + t.version}
                          value={t.id + ":" + t.version}
                        >
                          {t.title} · v{t.version}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["preFrom", "Oldingi davr: boshi"],
                      ["preTo", "Oldingi davr: oxiri"],
                      ["postFrom", "Keyingi davr: boshi"],
                      ["postTo", "Keyingi davr: oxiri"],
                    ].map(([key, label]) => (
                      <label className="text-sm" key={key}>
                        {label}
                        <Input
                          required
                          type="date"
                          value={form[key]}
                          onChange={(e) =>
                            setForm({ ...form, [key]: e.target.value })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <p className="text-sm text-slate-500">
                    Har guruhga kamida 5 o‘quvchi. Bir o‘quvchi faqat bitta
                    guruhda bo‘lsin. Rozilikni o‘quvchi o‘z hisobida bildiradi.
                  </p>
                  <div className="max-h-72 overflow-auto rounded-xl border p-3">
                    {data.students.map((s: any) => (
                      <div
                        className="flex items-center justify-between gap-2 border-b py-3"
                        key={s.id}
                      >
                        <span className="text-xs">
                          {s.name} · {s.classCode?.toUpperCase()} ·{" "}
                          {s.consented ? "Rozilik bor" : "Rozilik yo‘q"}
                        </span>
                        {["groupA", "groupB"].map((key, i) => (
                          <label
                            className="flex min-h-11 items-center gap-1 text-sm"
                            key={key}
                          >
                            <input
                              type="checkbox"
                              checked={form[key].includes(s.id)}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  [key]: e.target.checked
                                    ? [...form[key], s.id]
                                    : form[key].filter(
                                        (id: string) => id !== s.id,
                                      ),
                                })
                              }
                            />
                            {i === 0 ? "A" : "B"}
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                  <label className="block text-sm">
                    Holat
                    <Select
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value })
                      }
                    >
                      {["draft", "active", "closed"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </Select>
                  </label>
                  <label className="flex gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={form.schoolPermissionAcknowledged}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          schoolPermissionAcknowledged: e.target.checked,
                        })
                      }
                    />
                    Maktabning ichki pilot uchun ruxsati mavjudligini
                    tasdiqlayman.
                  </label>
                </>
              )}
              {dialog.kind === "retention" && (
                <>
                  <label className="block text-sm">
                    Saqlash muddati (30–1825 kun)
                    <Input
                      type="number"
                      required
                      min={30}
                      max={1825}
                      value={form.days}
                      onChange={(e) =>
                        setForm({ ...form, days: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="flex gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={form.approved}
                      onChange={(e) =>
                        setForm({ ...form, approved: e.target.checked })
                      }
                    />
                    Maktab tartibiga mosligini tekshirdim.
                  </label>
                  <p className="text-sm text-slate-500">
                    Bu sozlama avtomatik o‘chirishni yoqmaydi. Har bir o‘chirish
                    alohida inson qarori bilan bajariladi.
                  </p>
                </>
              )}
              <label className="block text-sm">
                Asos va izoh
                <textarea
                  required
                  minLength={8}
                  maxLength={2000}
                  className="ss-field min-h-28"
                  value={form.reason || ""}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </label>
              {dialog.kind === "deletion" ? (
                <>
                  <Button
                    type="button"
                    busy={busy}
                    onClick={async () => {
                      const r = await run(
                        "/api/school-admin/deletions/" +
                          dialog.row.id +
                          "/review",
                        {
                          revision: dialog.row.revision,
                          action: "dry_run",
                          reason: form.reason,
                        },
                      );
                      if (r) setPreview(r);
                    }}
                  >
                    Avval sinov ko‘rinishi
                  </Button>
                  {preview && (
                    <>
                      <pre className="whitespace-pre-wrap text-xs">
                        {JSON.stringify(preview.counts, null, 2)}
                      </pre>
                      <p className="text-sm text-rose-700">
                        Faqat o‘quv mashqlari o‘chadi. Amalni qaytarish uchun
                        operator zaxirasi kerak bo‘ladi.
                      </p>
                      <label className="block text-sm">
                        Tasdiqlash uchun aynan: O‘QUV MASHQLARINI O‘CHIRISH
                        <Input
                          value={form.confirmation}
                          onChange={(e) =>
                            setForm({ ...form, confirmation: e.target.value })
                          }
                        />
                      </label>
                      <Button
                        type="button"
                        busy={busy}
                        disabled={
                          form.confirmation !== "O‘QUV MASHQLARINI O‘CHIRISH"
                        }
                        onClick={async () => {
                          if (
                            await run(
                              "/api/school-admin/deletions/" +
                                dialog.row.id +
                                "/review",
                              {
                                revision: dialog.row.revision,
                                action: "approve",
                                reason: form.reason,
                                confirmation: form.confirmation,
                                previewId: preview.previewId,
                              },
                            )
                          )
                            setDialog(undefined);
                        }}
                      >
                        So‘rovni bajarish
                      </Button>
                    </>
                  )}
                  <button
                    type="button"
                    className="ss-secondary ml-2"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await run(
                          "/api/school-admin/deletions/" +
                            dialog.row.id +
                            "/review",
                          {
                            revision: dialog.row.revision,
                            action: "reject",
                            reason: form.reason,
                          },
                        )
                      )
                        setDialog(undefined);
                    }}
                  >
                    Asos bilan rad etish
                  </button>
                </>
              ) : (
                <Button busy={busy} type="submit">
                  Saqlash
                </Button>
              )}
            </form>
          )}
        </Drawer>
      )}
    </main>
  );
}
export function LearningPrivacyPage() {
  const api = useExamApi(),
    [data, setData] = useState<any>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState("");
  const load = () =>
    api("/api/learning-privacy")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, [api]);
  const save = async (path: string, body: any) => {
    setBusy(true);
    setError("");
    try {
      await api("/api/learning-privacy/" + path, "POST", {
        ...body,
        operationId: crypto.randomUUID(),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-3xl font-bold">O‘quv ma’lumotlarim va rozilik</h1>
      {error && <Card role="alert">{error}</Card>}
      {!data ? (
        <Skeleton />
      ) : (
        <>
          <Card>
            <h2 className="font-bold">Ixtiyoriy ichki pilot</h2>
            <p className="mt-3 text-sm leading-7">{data.text}</p>
            <p className="my-4 text-sm">
              Hozir:{" "}
              {data.consent?.accepted
                ? "Rozilik berilgan"
                : "Rozilik berilmagan"}{" "}
              · {data.version}
            </p>
            <Button
              busy={busy}
              onClick={() =>
                void save("consent", {
                  accepted: !data.consent?.accepted,
                  version: data.version,
                })
              }
            >
              {data.consent?.accepted
                ? "Rozilikni bekor qilish"
                : "Matnni o‘qidim, ixtiyoriy roziman"}
            </Button>
          </Card>
          <Card>
            <h2 className="font-bold">O‘quv mashqlarini o‘chirish so‘rovi</h2>
            <p className="my-3 text-sm leading-7">
              Mashq javoblari va shaxsiy takrorlash ma’lumotlari uchun
              administratorga so‘rov yuborasiz. Rasmiy baholar, davomat va
              boshqa rasmiy qaydlar bu so‘rovga kirmaydi. Avtomatik o‘chirish
              yo‘q.
            </p>
            <label className="text-sm">
              Sabab
              <textarea
                className="ss-field min-h-28"
                value={reason}
                minLength={8}
                maxLength={2000}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <Button
              busy={busy}
              disabled={
                reason.trim().length < 8 ||
                data.requests.some((r: any) => r.status === "pending")
              }
              onClick={() => void save("deletion", { reason })}
            >
              So‘rov yuborish
            </Button>
            {data.requests.map((r: any) => (
              <p className="mt-3 text-sm" key={r.id}>
                {r.createdAt} · {r.status} ·{" "}
                {r.reasonForDecision || "Ko‘rib chiqiladi"}
              </p>
            ))}
          </Card>
        </>
      )}
    </main>
  );
}
