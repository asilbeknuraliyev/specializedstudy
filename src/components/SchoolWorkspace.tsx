import {ReviewDesk} from './ReviewDesk';
import {FeedbackTemplates} from './FeedbackTemplates';
import { StudentLearningSummary } from "./StudentLearningSummary";
import { SchoolReport } from "./SchoolReport";
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLearnOS } from "../context/LearnOSContext";
import { useExamApi } from "../utils/useExamApi";
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Toast,
} from "./DesignSystem";
import { schoolExcel, openSchoolPrint } from "../utils/schoolExport";
export const teacherModules = [
  ["home", "Bugungi ishlar"],
  ["timetable", "Dars jadvali"],
  ["classes", "Sinflarim"],
  ["subjects", "Fanlarim"],
  ["students", "O‘quvchi 360°"],
  ["plans", "Ish rejalari"],
  ["lessons", "Darslar"],
  ["materials", "Materiallar"],
  ["assignments", "Vazifalar"],
  ["templates", "Vazifa shablonlari"],
  ["bank", "Savollar banki"],
  ["tests", "Mavzu testlari"],
  ["exams", "BSB / CHSB"],
  ["attendance", "Davomat"],
  ["grading", "Yozma ish tekshiruvi"],
  ["results", "Natijalar va tahlil"],
  ["map", "Bilim xaritasi"],
  ["discipline", "Intizom"],
  ["support", "Yordam rejalari"],
  ["announcements", "Sinf e’lonlari"],
  ["reports", "Hisobotlar"],
  ["settings", "Sozlamalar"],
];
const statuses: Record<string, string> = {
  PRESENT: "Qatnashdi",
  ABSENT: "Qatnashmadi",
  LATE: "Kechikdi",
  EXCUSED_ABSENCE: "Sababli yo‘q",
  draft: "Qoralama",
  published: "E’lon qilingan",
  closed: "Yopilgan",
  archived: "Arxiv",
};
const areaLinks: Record<string, string> = {
  bank: "topic-bank",
  tests: "topic-bank",
  results: "topic-analysis",
  discipline: "discipline",
  exams: "assessments",
};
export function SchoolWorkspace() {
  const api = useExamApi(),
    { currentUser, theme, toggleTheme } = useLearnOS(),
    location = useLocation(),
    student = currentUser?.role === "student",
    admin = ["admin", "platform_owner"].includes(currentUser?.role || ""),
    prefix = student ? "student" : admin ? "admin" : "teacher";
  const part = location.pathname.split("/").at(-1) || "home",
    module = part === "workspace" || part === "dashboard" ? "home" : part;
  const [data, setData] = useState<any>(),
    [classId, setClass] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0),
    [form, setForm] = useState<any>(),
    [details, setDetails] = useState<any>(),
    [query, setQuery] = useState(""),
    [lessonPage, setLessonPage] = useState(0),
    [date, setDate] = useState(
      new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" }),
    ),
    [slot, setSlot] = useState(1),
    [marks, setMarks] = useState<
      Record<string, { status: string; notes: string }>
    >({}),
    [attendanceDirty, setAttendanceDirty] = useState(false),
    [attendanceSession, setAttendanceSession] = useState<any>(),
    [attendanceLoaded, setAttendanceLoaded] = useState("");
  const operation = useRef<{ signature: string; id: string } | undefined>(
      undefined,
    ),
    working = useRef(false);
  const dirty = !!form || attendanceDirty;
  const lessonQuery = ["plans", "lessons"].includes(module) ? query : "";
  useEffect(() => setLessonPage(0), [classId, lessonQuery]);
  useEffect(() => {
    let live = true;
    setError("");
    const timer = setTimeout(() => {
      api(
        "/api/workspace?" +
          new URLSearchParams({
            classId,
            lessonQ: lessonQuery,
            lessonPage: String(lessonPage),
          }),
      )
        .then((d) => {
          if (live) setData(d);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      live = false;
    };
  }, [api, classId, version, lessonQuery, lessonPage]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  useEffect(() => {
    if (!classId || attendanceDirty) return;
    let live = true;
    setAttendanceLoaded("");
    api(
      "/api/workspace/attendance?" +
        new URLSearchParams({ classId, date, lessonNumber: String(slot) }),
    )
      .then((d) => {
        if (!live) return;
        setAttendanceSession(d.session);
        setMarks(
          Object.fromEntries(
            d.rows.map((r: any) => [
              r.studentId,
              { status: r.status, notes: r.notes || "" },
            ]),
          ),
        );
        setAttendanceLoaded(classId + date + slot);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [api, classId, date, slot, version, attendanceDirty]);
  useEffect(() => {
    if (!dirty) return;
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.("a[href]");
      if (
        a &&
        a.getAttribute("href") !== location.pathname &&
        !window.confirm("Saqlanmagan yozuv bor. Sahifadan chiqasizmi?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, [dirty, location.pathname]);

  const run = async (path: string, body: any, success = "Saqlandi.") => {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
    setError("");
    const signature = JSON.stringify({ path, body });
    if (operation.current?.signature !== signature)
      operation.current = { signature, id: crypto.randomUUID() };
    try {
      const result = await api(path, "POST", {
        ...body,
        operationId: operation.current.id,
      });
      setNotice(
        result.duplicate ? "Oldin saqlangan amal qayta tekshirildi." : success,
      );
      operation.current = undefined;
      setVersion((v) => v + 1);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  const close = () => {
    if (!busy && (!dirty || window.confirm("Saqlanmagan yozuvni yopasizmi?")))
      setForm(undefined);
  };
  if (!data)
    return (
      <main className="space-y-4">
        {error ? (
          <Card role="alert">
            {error}
            <button
              className="ss-secondary ml-3"
              onClick={() => setVersion((v) => v + 1)}
            >
              Qayta urinish
            </button>
          </Card>
        ) : (
          <Skeleton />
        )}
      </main>
    );
  const students = data.students.filter(
      (s: any) =>
        !query ||
        `${s.name} ${s.login || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ),
    classes = data.classes,
    subject = data.subject || "",
    selectedClass = classId || classes[0]?.id || "",
    classCode = (id: string) =>
      classes.find((c: any) => c.id === id)?.code?.toUpperCase() || "—";
  const openAssignment = (a?: any, copy = false) =>
    setForm({
      kind: "assignments",
      id: copy ? undefined : a?.id,
      revision: copy ? 0 : a?.revision || 0,
      title: a?.title || "",
      description: a?.description || "",
      subject: a?.subject || subject,
      classIds: a?.targetClassIds || [selectedClass].filter(Boolean),
      dueDate: a?.dueDate || data.today,
      maxScore: a?.maxScore || 10,
      status: copy ? "draft" : a?.status || "draft",
      allowResubmission: a?.allowResubmission ?? true,
    });
  const openSupport = (s?: any) =>
    setForm({
      kind: "support",
      id: s?.id,
      revision: s?.revision || 0,
      studentId: s?.studentId || students[0]?.id || "",
      subject: s?.subject || subject,
      topic: s?.topic || "",
      observedNeed: s?.observedNeed || "",
      goal: s?.goal || "",
      recommendedActivity: s?.recommendedActivity || "",
      reviewDate: s?.reviewDate || data.today,
      status: s?.status || "Yangi",
      progressNotes: s?.progressNotes || "",
    });
  const openMaterial = (m?: any) =>
    setForm({
      kind: "materials",
      id: m?.id,
      revision: m?.revision || 0,
      title: m?.title || "",
      description: m?.description || "",
      subject: m?.subject || subject,
      classIds: m
        ? classes
            .filter((c: any) => m.targetClassCodes.includes(c.code))
            .map((c: any) => c.id)
        : [selectedClass].filter(Boolean),
      fileUrl: m?.fileUrl || "",
      materialType: m?.materialType || "pdf",
      quarter: m?.quarter || 2,
      folder: m?.folder || "Dars materiallari",
      status: m?.status || "published",
    });
  const openAnnouncement = (a?: any) =>
    setForm({
      kind: "announcements",
      id: a?.id,
      revision: a?.revision || 0,
      title: a?.title || "",
      content: a?.content || "",
      classIds: a
        ? classes
            .filter((c: any) => a.targetClassCodes.includes(c.code))
            .map((c: any) => c.id)
        : [selectedClass].filter(Boolean),
      priority: a?.priority || "normal",
      status: a?.status || "published",
    });
  const title =
      teacherModules.find(([id]) => id === module)?.[1] || "Ish oynasi",
    filtered = (rows: any[]) =>
      rows.filter(
        (r) =>
          !query ||
          JSON.stringify([r.title, r.topic, r.studentName, r.description])
            .toLowerCase()
            .includes(query.toLowerCase()),
      );
  const exportReport = async () => {
    await schoolExcel(
      "O‘quv-hisobot",
      ["O‘quvchi", "Sinf", "Vazifa", "Holat", "Ball", "Maksimal ball", "Izoh"],
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
    setNotice("Ruxsat doirangizdagi hisobot yuklandi.");
  };
  return (
    <main className="mx-auto max-w-7xl space-y-5">
      <header className="rounded-3xl bg-slate-950 p-6 text-white">
        <p className="text-xs uppercase tracking-widest text-blue-300">
          {student
            ? "Mening maktabim"
            : admin
              ? "Maktab boshqaruvi"
              : `Ustoz kabineti · ${subject}`}
        </p>
        <h1 className="mt-3 text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-slate-300">
          {currentUser?.displayName} · {data.today}
        </p>
      </header>
      {!student && (
        <nav
          aria-label="Ustoz ish bo‘limlari"
          className="flex gap-2 overflow-auto pb-2"
        >
          {teacherModules.map(([id, name]) => (
            <Link
              className={
                "shrink-0 rounded-xl px-4 py-3 text-sm " +
                (module === id ? "bg-blue-600 text-white" : "ss-surface")
              }
              key={id}
              to={
                areaLinks[id]
                  ? `/${prefix}/${areaLinks[id]}`
                  : `/${prefix}/workspace/${id}`
              }
            >
              {name}
            </Link>
          ))}
        </nav>
      )}
      {error && (
        <Card role="alert" className="border-rose-300 text-rose-700">
          {error}
        </Card>
      )}
      {notice && <Toast>{notice}</Toast>}
      <div className="flex flex-wrap gap-3">
        {!student && (
          <label className="min-w-40 flex-1 text-sm">
            Sinf
            <Select
              value={classId}
              onChange={(e) => {
                if (
                  attendanceDirty &&
                  !window.confirm("Saqlanmagan davomatni tashlaysizmi?")
                )
                  return;
                setAttendanceDirty(false);
                setClass(e.target.value);
                setQuery("");
              }}
            >
              <option value="">Barcha sinflar</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.code.toUpperCase()}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label className="min-w-40 flex-1 text-sm">
          Qidirish
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mavzu, ism yoki vazifa…"
          />
        </label>
        <button
          className="ss-secondary self-end"
          disabled={busy || dirty}
          onClick={() => setVersion((v) => v + 1)}
        >
          Yangilash
        </button>
      </div>
      {module === "home" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [data.counts.students, "O‘quvchilar"],
              [data.counts.waiting, "Tekshirish kutmoqda"],
              [data.counts.absent, "Bugun qatnashmagan"],
              [data.counts.support, "Faol yordam rejasi"],
            ].map(([n, t]) => (
              <Card key={t}>
                <p className="text-3xl font-bold text-blue-600">{n}</p>
                <p className="mt-2 text-sm text-slate-500">{t}</p>
              </Card>
            ))}
          </div>
          <Card>
            <h2 className="font-bold">Bugungi darslar</h2>
            <p className="mt-2 text-sm text-slate-500">
              Toshkent vaqti {data.time}. Jadvaldagi tasdiqlangan darslar.
            </p>
            {data.todaySchedule.length ? (
              data.todaySchedule.map((e: any) => (
                <div
                  key={e.id}
                  className="flex flex-wrap justify-between gap-3 border-t py-4"
                >
                  <div>
                    <p className="font-semibold">
                      {e.startTime}–{e.endTime} · {e.subject}
                    </p>
                    <p className="text-sm text-slate-500">
                      {classCode(e.classId)} · {e.room || "Xona ko‘rsatilmagan"}{" "}
                      · {e.roadmapTopic || e.relatedLessonTitle || ""}
                    </p>
                  </div>
                  <span className="text-sm">
                    {data.time >= e.startTime && data.time < e.endTime
                      ? "Hozirgi dars"
                      : data.time < e.startTime
                        ? "Keyingi dars"
                        : "Yakunlangan"}
                  </span>
                  <Link
                    className="ss-secondary"
                    to={`/${prefix}/workspace/attendance`}
                    onClick={() => {
                      setClass(e.classId);
                      setSlot(e.lessonNumber);
                    }}
                  >
                    Davomat
                  </Link>
                </div>
              ))
            ) : (
              <p className="py-5 text-slate-500">Bugun jadvalda dars yo‘q.</p>
            )}
          </Card>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["grading", "Ishlarni tekshirish"],
              ["assignments", "Vazifa berish"],
              ["support", "Yordam rejasi"],
            ].map(([id, label]) => (
              <Link
                className="ss-secondary"
                key={id}
                to={`/${prefix}/workspace/${id}`}
              >
                {label} →
              </Link>
            ))}
          </div>
        </>
      )}
      {module === "timetable" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.timetable.map((e: any) => (
            <Card key={e.id}>
              <p className="text-sm text-blue-600">
                {e.weekday} · {e.lessonNumber}-dars · {classCode(e.classId)}
              </p>
              <h2 className="mt-2 font-bold">{e.subject}</h2>
              <p>
                {e.startTime}–{e.endTime} · {e.room || "Xona yo‘q"}
              </p>
              <p className="text-sm text-slate-500">
                {e.roadmapTopic || e.relatedLessonTitle}
              </p>
            </Card>
          ))}
          {!data.timetable.length && (
            <EmptyState title="Jadval hali kiritilmagan">
              Administrator kontent markazida tasdiqlangan jadvalni kiritadi.
            </EmptyState>
          )}
        </div>
      )}
      {module === "classes" && (
        <div className="grid gap-3 sm:grid-cols-3">
          {classes.map((c: any) => (
            <Card key={c.id}>
              <h2 className="text-xl font-bold">{c.code.toUpperCase()}</h2>
              <p className="my-3 text-sm">
                {data.students.filter((s: any) => s.classId === c.id).length}{" "}
                o‘quvchi
              </p>
              <Link
                className="ss-secondary"
                to={`/${prefix}/workspace/students`}
                onClick={() => setClass(c.id)}
              >
                Sinfni ochish
              </Link>
            </Card>
          ))}
        </div>
      )}
      {module === "students" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {students.map((s: any) => (
            <Card key={s.id}>
              <h2 className="font-bold">{s.name}</h2>
              <p className="my-3 text-sm text-slate-500">
                {s.classCode?.toUpperCase()} · {s.login || "Google hisob"}
              </p>
              <Button
                busy={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setDetails(
                      await api(
                        "/api/workspace/student/" + encodeURIComponent(s.id),
                      ),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                360° ko‘rinish
              </Button>
            </Card>
          ))}
        </div>
      )}
      {module === "subjects" && (
        <Card>
          <h2 className="font-bold">{subject || "Maktab fanlari"}</h2>
          <p className="my-3 text-sm leading-7">
            {data.counts.lessons} dars · {data.counts.materials} material ·{" "}
            {data.counts.assignments} vazifa. Biriktirilgan sinflar:{" "}
            {classes.map((c: any) => c.code.toUpperCase()).join(", ")}.
          </p>
          <Link className="ss-secondary" to={`/${prefix}/workspace/lessons`}>
            Fan mavzulari
          </Link>
        </Card>
      )}
      {module === "plans" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.workPlans.map((p: any) => (
            <Card key={p.id}>
              <h2 className="font-bold">{p.title}</h2>
              <p className="my-3 text-sm">
                {p.subject} · {p.academicYear} · {p.totalLessons ?? "—"} dars ·{" "}
                {p.totalHours ?? "—"} soat · {p.status}
              </p>
            </Card>
          ))}
          {!data.workPlans.length && (
            <EmptyState title="Ish reja hali biriktirilmagan">
              Administrator fan va sinf uchun reja kiritadi. Mavjud darslar
              quyida ko‘rinadi.
            </EmptyState>
          )}
        </div>
      )}
      {["plans", "lessons"].includes(module) && (
        <Card>
          <h2 className="mb-3 font-bold">
            {data.counts.delivered} / {data.counts.lessons} dars maktabda
            o‘tilgan
          </h2>
          {filtered(data.lessons).map((l: any) => (
            <article
              key={l.id}
              className="flex flex-wrap justify-between gap-3 border-t py-4"
            >
              <div>
                <h3 className="font-semibold">{l.title || l.topicTitle}</h3>
                <p className="text-sm text-slate-500">
                  {l.quarter}-chorak · {l.subjectName || l.subject} ·{" "}
                  {l.schoolDeliveredAt ? "Maktabda o‘tilgan" : "Rejada"}
                </p>
              </div>
              <Link
                className="ss-secondary"
                to={`/${prefix}/topic-bank?lesson=${encodeURIComponent(l.id)}`}
              >
                Savol va testlar
              </Link>
              <button
                className="ss-secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(
                      `/api/teaching/lessons/${l.id}/delivered`,
                      "POST",
                      { delivered: !l.schoolDeliveredAt },
                    );
                    setVersion((v) => v + 1);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {l.schoolDeliveredAt ? "Belgini qaytarish" : "Dars o‘tildi"}
              </button>
            </article>
          ))}
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              className="ss-secondary"
              disabled={!lessonPage}
              onClick={() => setLessonPage((p) => p - 1)}
            >
              Oldingi darslar
            </button>
            <span className="text-xs">
              {lessonPage + 1}/
              {Math.max(
                1,
                Math.ceil((data.lessonPagination?.total || 0) / 100),
              )}
            </span>
            <button
              className="ss-secondary"
              disabled={
                (lessonPage + 1) * 100 >= (data.lessonPagination?.total || 0)
              }
              onClick={() => setLessonPage((p) => p + 1)}
            >
              Keyingi darslar
            </button>
          </div>
        </Card>
      )}
      {["assignments", "templates"].includes(module) && (
        <>
          <div className="flex gap-3">
            {!student && (
              <Button onClick={() => openAssignment()}>Vazifa yaratish</Button>
            )}
          </div>
          {filtered(data.assignments)
            .filter((a: any) => module !== "templates" || a.status === "draft")
            .map((a: any) => {
              const s = data.submissions.find(
                (s: any) =>
                  s.assignmentId === a.id && s.studentId === currentUser?.uid,
              );
              return (
                <Card key={a.id}>
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h2 className="font-bold">{a.title}</h2>
                      <p className="mt-2 text-sm text-slate-500">
                        {a.subject} · {a.dueDate} gacha · {a.maxScore} ball ·{" "}
                        {statuses[a.status]}
                      </p>
                    </div>
                    {!student && (
                      <div className="flex flex-wrap gap-2">
                        {(admin || a.createdByUid === currentUser?.uid) && (
                          <button
                            className="ss-secondary"
                            onClick={() => openAssignment(a)}
                          >
                            Tahrirlash
                          </button>
                        )}
                        <button
                          className="ss-secondary"
                          onClick={() => openAssignment(a, true)}
                        >
                          Nusxa / shablondan yaratish
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7">
                    {a.description}
                  </p>
                  {student && (
                    <div className="mt-4">
                      <p className="mb-3 text-sm">
                        {s?.status || "Hali topshirilmadi"}
                        {s?.score !== undefined
                          ? ` · ${s.score}/${s.maxScore}`
                          : ""}
                      </p>
                      {s?.feedback && (
                        <p className="mb-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-950">
                          {s.feedback}
                        </p>
                      )}
                      {a.status === "published" && (
                        <Button
                          onClick={() =>
                            setForm({
                              kind: "submissions",
                              assignmentId: a.id,
                              revision: s?.revision || 0,
                              content: s?.draftContent || s?.content || "",
                              submit: false,
                            })
                          }
                        >
                          Javob yozish
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          {!data.assignments.length && (
            <EmptyState title="Hozircha vazifa yo‘q">
              Vazifalar e’lon qilingach shu yerda ko‘rinadi.
            </EmptyState>
          )}
        </>
      )}
      {module === "attendance" && (
        <>
          <Card>
            <h2 className="font-bold">
              {student ? "Mening davomating" : "Dars bo‘yicha davomat"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Davomat intizom ballini avtomatik qo‘shmaydi. Zarur pedagogik
              holat alohida ko‘rib chiqiladi.
            </p>
            {!student && (
              <>
                <div className="my-4 grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    Sana
                    <Input
                      type="date"
                      max={data.today}
                      value={date}
                      disabled={attendanceDirty}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                  <label className="text-sm">
                    Dars raqami
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={slot}
                      disabled={attendanceDirty}
                      onChange={(e) => setSlot(Number(e.target.value))}
                    />
                  </label>
                </div>
                {!classId ? (
                  <p className="text-sm text-amber-700">
                    Avval bitta sinfni tanlang.
                  </p>
                ) : (
                  <>
                    <button
                      className="ss-secondary mb-3"
                      onClick={() => {
                        setMarks(
                          Object.fromEntries(
                            students
                              .filter((s: any) => s.status === "active")
                              .map((s: any) => [
                                s.id,
                                { status: "PRESENT", notes: "" },
                              ]),
                          ),
                        );
                        setAttendanceDirty(true);
                      }}
                    >
                      Hammasi qatnashdi — keyin istisnolarni belgilang
                    </button>
                    {students
                      .filter((s: any) => s.status === "active")
                      .map((s: any) => (
                        <div key={s.id} className="space-y-2 border-t py-4">
                          <p className="font-semibold">{s.name}</p>
                          <Select
                            aria-label={s.name + " davomati"}
                            value={marks[s.id]?.status || ""}
                            onChange={(e) => {
                              setAttendanceDirty(true);
                              setMarks((m) => ({
                                ...m,
                                [s.id]: {
                                  status: e.target.value,
                                  notes: m[s.id]?.notes || "",
                                },
                              }));
                            }}
                          >
                            <option value="">Belgilanmagan</option>
                            {Object.entries(statuses)
                              .filter(([k]) =>
                                [
                                  "PRESENT",
                                  "ABSENT",
                                  "LATE",
                                  "EXCUSED_ABSENCE",
                                ].includes(k),
                              )
                              .map(([k, v]) => (
                                <option value={k} key={k}>
                                  {v}
                                </option>
                              ))}
                          </Select>
                          <Input
                            aria-label={s.name + " izohi"}
                            placeholder="Sabab yoki izoh (ixtiyoriy)"
                            value={marks[s.id]?.notes || ""}
                            onChange={(e) => {
                              setAttendanceDirty(true);
                              setMarks((m) => ({
                                ...m,
                                [s.id]: {
                                  status: m[s.id]?.status || "",
                                  notes: e.target.value,
                                },
                              }));
                            }}
                          />
                        </div>
                      ))}
                    <Button
                      busy={busy}
                      disabled={
                        attendanceLoaded !== classId + date + slot ||
                        !attendanceDirty ||
                        !Object.values(marks).some((m) => m.status)
                      }
                      onClick={async () => {
                        const session = attendanceSession;
                        if (
                          await run("/api/workspace/attendance", {
                            classId,
                            date,
                            lessonNumber: slot,
                            subject: subject || "Umumiy",
                            revision: session?.revision || 0,
                            records: Object.entries(marks)
                              .filter(([, v]) => v.status)
                              .map(([studentId, v]) => ({ studentId, ...v })),
                          })
                        ) {
                          setAttendanceDirty(false);
                        }
                      }}
                    >
                      Davomatni saqlash
                    </Button>
                    {attendanceDirty && (
                      <button
                        className="ss-secondary ml-2"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Saqlanmagan davomatni bekor qilasizmi?",
                            )
                          )
                            setAttendanceDirty(false);
                        }}
                      >
                        Bekor qilish
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </Card>
          <Card>
            <h2 className="mb-4 font-bold">Qaydlar tarixi</h2>
            {data.attendance.map((r: any) => (
              <p key={r.id} className="border-t py-3 text-sm">
                {r.date} · {r.lessonNumber ? `${r.lessonNumber}-dars · ` : ""}
                {r.studentName} · {statuses[r.status]}
                {r.notes ? " · " + r.notes : ""}
              </p>
            ))}
          </Card>
        </>
      )}
      {module === "grading" && (
        <ReviewDesk>
          {filtered(data.submissions).map((s: any) => (
            <Card key={s.id}>
              <h2 className="font-bold">
                {s.studentName} · {s.assignmentTitle}
              </h2>
              <p className="my-2 text-sm text-slate-500">
                {s.status} · {s.submittedAt || "Qoralama"} · {s.score ?? "—"}/
                {s.maxScore}
              </p>
              <p className="my-4 whitespace-pre-wrap text-sm">
                {s.content || "Hali topshirilmagan."}
              </p>
              {s.submittedAt && (
                <Button
                  onClick={() =>
                    setForm({
                      kind: "grading",
                      submissionId: s.id,
                      revision: s.revision || 0,
                      score: s.score ?? 0,
                      feedback: s.feedback || "",
                      returnForRevision: false,
                      maxScore: s.maxScore,
                    })
                  }
                >
                  Tekshirish / qayta ko‘rish
                </Button>
              )}
            </Card>
          ))}
          {!data.submissions.length && (
            <EmptyState title="Tekshirish uchun ish yo‘q">
              O‘quvchilar vazifani topshirgach, shu yerda ko‘rasiz.
            </EmptyState>
          )}
        </ReviewDesk>
      )}
      {module === "materials" && (
        <>
          {!student && (
            <Button onClick={() => openMaterial()}>Material qo‘shish</Button>
          )}
          {filtered(data.materials).map((m: any) => (
            <Card key={m.id}>
              <p className="text-xs text-blue-600">
                {m.folder} · {m.materialType.toUpperCase()} · {m.quarter}-chorak
              </p>
              <h2 className="my-2 font-bold">{m.title}</h2>
              <p className="mb-4 text-sm">{m.description}</p>
              <a
                className="ss-secondary"
                target="_blank"
                rel="noopener noreferrer"
                href={m.fileUrl}
              >
                Materialni ochish â†—
              </a>
              {!student && (admin || m.uploadedByUid === currentUser?.uid) && (
                <button
                  className="ss-secondary ml-2"
                  onClick={() => openMaterial(m)}
                >
                  Tahrirlash
                </button>
              )}
            </Card>
          ))}
        </>
      )}
      {module === "support" && (
        <>
          {!student && (
            <Button onClick={() => openSupport()}>
              Yordam rejasi yaratish
            </Button>
          )}
          {filtered(data.support).map((s: any) => (
            <Card key={s.id}>
              <p className="text-xs text-blue-600">
                {s.status} · {s.reviewDate} kuni qayta ko‘rish
              </p>
              <h2 className="my-2 font-bold">
                {s.studentName} · {s.topic}
              </h2>
              {[
                ["Kuzatilgan ehtiyoj", s.observedNeed],
                ["Maqsad", s.goal],
                ["Tavsiya", s.recommendedActivity],
                ["O‘sish qaydi", s.progressNotes],
              ].map(([k, v]) => (
                <p className="mt-3 text-sm leading-6" key={k}>
                  <strong>{k}: </strong>
                  {v || "Hali qayd yo‘q"}
                </p>
              ))}
              {!student && (admin || s.createdByUid === currentUser?.uid) && (
                <button
                  className="ss-secondary mt-4"
                  onClick={() => openSupport(s)}
                >
                  Rejani yangilash
                </button>
              )}
            </Card>
          ))}
        </>
      )}
      {module === "announcements" && (
        <>
          {!student && (
            <Button onClick={() => openAnnouncement()}>
              Sinf e’loni yaratish
            </Button>
          )}
          {filtered(data.announcements).map((a: any) => (
            <Card key={a.id}>
              <h2 className="font-bold">{a.title}</h2>
              <p className="my-3 whitespace-pre-wrap text-sm leading-7">
                {a.content || a.shortContent}
              </p>
              <p className="text-xs text-slate-500">
                {a.createdByName} · {a.publicationDate}
              </p>
              {!student && (admin || a.createdByUid === currentUser?.uid) && (
                <button
                  className="ss-secondary mt-4"
                  onClick={() => openAnnouncement(a)}
                >
                  Tahrirlash
                </button>
              )}
            </Card>
          ))}
        </>
      )}
      {module === "map" && (
        <Card>
          <h2 className="mb-4 font-bold">O‘quvchi bilim xaritasi</h2>
          <p className="mb-4 text-sm text-slate-500">
            Bu rasmiy baho emas. Mustaqil oraliq takrorlash dalillari: ishlangan
            savollar, mustahkamlangan javoblar va ochiq xatolar. Sinf va qidiruv
            orqali toraytiring.
          </p>
          {data.progress
            .filter(
              (r: any) =>
                !query ||
                `${data.students.find((s: any) => s.id === r.studentId)?.name} ${data.lessons.find((l: any) => l.id === r.lessonId)?.title}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            )
            .slice(0, 100)
            .map((r: any) => (
              <article key={r.id} className="space-y-2 border-t py-4 text-sm">
                <h3 className="font-semibold">
                  {data.students.find((s: any) => s.id === r.studentId)?.name} ·{" "}
                  {data.lessons.find((l: any) => l.id === r.lessonId)?.title ||
                    r.subject}
                </h3>
                <p>
                  {r.attempted}/{r.pool} ishlangan · {r.retained}{" "}
                  mustahkamlangan · {r.unresolved} ochiq xato
                </p>
                <progress
                  className="h-2 w-full"
                  aria-label="Mustahkamlangan savollar"
                  max={r.pool || 1}
                  value={r.retained}
                />
              </article>
            ))}
          {!data.progress.length && (
            <p className="text-sm text-slate-500">
              Bu sinf uchun hali takrorlash dalili yo‘q.
            </p>
          )}
        </Card>
      )}
      {module === "reports" && <SchoolReport classId={classId} />}
      {module === "reports" && (
        <Card>
          <h2 className="font-bold">O‘z sinflarim va fanim hisoboti</h2>
          <p className="my-3 text-sm leading-7">
            {data.counts.assignments} vazifa, {data.counts.waiting} tekshirish
            kutilmoqda, {data.counts.delivered} o‘tilgan dars. Eksport ekranda
            yuklangan, ko‘pi bilan 100 ta topshirishni qamrab oladi; katta
            hisobot uchun sinfni tanlang.
          </p>
          <Button onClick={() => void exportReport()}>Excel hisoboti</Button>
          <Link className="ss-secondary ml-2" to={`/${prefix}/topic-analysis`}>
            Mavzular tahlili
          </Link>
        </Card>
      )}
      {module === "exams" && (
        <Card>
          <h2 className="font-bold">BSB va CHSB nazoratlari</h2>
          <p className="my-3 text-sm leading-7">
            O‘z sinflaringiz va faningiz uchun BSB / CHSB faylini import qiling,
            qoralamani ko‘rib chiqing, vaqtini rejalashtiring va yozma
            javoblarni tekshiring.
          </p>
          {admin ? (
            <Link className="ss-primary" to="/admin/assessments">
              Nazoratlarni boshqarish
            </Link>
          ) : (
            <Link className="ss-primary" to="/teacher/assessments">
              Nazoratlarni boshqarish
            </Link>
          )}
        </Card>
      )}
      {module === "settings" && (
        <Card>
          <h2 className="font-bold">Shaxsiy sozlamalar</h2>
          <p className="my-4 text-sm">
            Biriktirilgan fan: {subject || "—"} ·{" "}
            {classes.map((c: any) => c.code.toUpperCase()).join(", ")}
          </p>
          <button className="ss-secondary" onClick={toggleTheme}>
            {theme === "dark" ? "Yorug‘ rejim" : "Qorong‘i rejim"}
          </button>
          <Link className="ss-secondary ml-2" to="/account/security">
            Parol va hisob
          </Link>
          <Link className="ss-secondary ml-2" to="/help">
            Yordam
          </Link>
        </Card>
      )}
      {details && (
        <Drawer title="O‘quvchi 360°" onClose={() => setDetails(undefined)}>
          <h2 className="text-xl font-bold">
            {details.student.name} · {details.student.classCode?.toUpperCase()}
          </h2>
          <p className="my-3 text-sm text-slate-500">
            Faqat sizga ruxsat berilgan fan ma’lumotlari.
          </p>
          <Card className="my-4">
            <p className="text-sm">
              {details.mistakes} ochiq xato · {details.discipline.approved}{" "}
              tasdiqlangan holat · {details.discipline.points} ball
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {details.discipline.scope}
            </p>
          </Card>
          <h3 className="mt-5 font-semibold">Topshirishlar</h3>
          {details.submissions.map((s: any) => (
            <p className="border-t py-3 text-sm" key={s.id}>
              {s.assignmentTitle} · {s.status} · {s.score ?? "—"}/{s.maxScore}
            </p>
          ))}
          <StudentLearningSummary details={details} />
          <h3 className="mt-5 font-semibold">Davomat</h3>
          {details.attendance.map((r: any) => (
            <p className="border-t py-2 text-sm" key={r.id}>
              {r.date} · {statuses[r.status]}
            </p>
          ))}
          <h3 className="mt-5 font-semibold">Yordam rejalari</h3>
          {details.support.map((s: any) => (
            <p className="border-t py-2 text-sm" key={s.id}>
              {s.topic} · {s.goal} · {s.status}
            </p>
          ))}
        </Drawer>
      )}
      {form && (
        <Drawer
          title={form.id ? "Yozuvni tahrirlash" : "Yangi yozuv"}
          onClose={close}
          dismissible={!busy}
        >
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const { kind, maxScore, ...body } = form;
              if (kind === "assignments") body.maxScore = maxScore;
              if (await run("/api/workspace/" + kind, body)) setForm(undefined);
            }}
          >
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800"
              >
                {error}
              </p>
            )}
            {form.kind === "grading" && <FeedbackTemplates rows={data.feedbackTemplates} onChoose={text => setForm({...form, feedback: text})}/>}
            {Object.entries(form)
              .filter(
                ([k]) =>
                  ![
                    "kind",
                    "id",
                    "revision",
                    "assignmentId",
                    "submissionId",
                    "classIds",
                    "maxScore",
                  ].includes(k) ||
                  (k === "maxScore" && form.kind === "assignments"),
              )
              .map(([key, value]) => {
                const labels: Record<string, string> = {
                  title: "Sarlavha",
                  description: "Tavsif va ko‘rsatma",
                  subject: "Fan",
                  dueDate: "Topshirish muddati",
                  maxScore: "Maksimal ball",
                  allowResubmission: "Qayta topshirish mumkin",
                  status: "Holat",
                  content: "Matn / javob",
                  submit: "Javobni topshirish (o‘chirilsa qoralama)",
                  score: `Ball (0–${form.maxScore})`,
                  feedback: "Ustoz fikri va keyingi qadam",
                  returnForRevision: "Qayta ishlash uchun qaytarish",
                  studentId: "O‘quvchi",
                  topic: "Mavzu",
                  observedNeed: "Kuzatilgan ehtiyoj",
                  goal: "Aniq maqsad",
                  recommendedActivity: "Tavsiya etilgan mashq",
                  reviewDate: "Qayta ko‘rish kuni",
                  progressNotes: "O‘sish qaydi",
                  fileUrl: "HTTPS material havolasi",
                  materialType: "Material turi",
                  quarter: "Chorak",
                  folder: "Papka",
                  priority: "Ustuvorlik",
                };
                const set = (v: any) =>
                  setForm((f: any) => ({ ...f, [key]: v }));
                let options: string[] | undefined;
                if (key === "status")
                  options =
                    form.kind === "assignments"
                      ? ["draft", "published", "closed"]
                      : form.kind === "support"
                        ? ["Yangi", "Jarayonda", "Yakunlandi"]
                        : ["published", "archived"];
                if (key === "materialType")
                  options = [
                    "pdf",
                    "docx",
                    "pptx",
                    "xlsx",
                    "jpeg",
                    "png",
                    "webp",
                    "video_link",
                  ];
                if (key === "priority") options = ["normal", "high", "urgent"];
                return (
                  <label key={key} className="block text-sm">
                    <span className="mb-2 block font-medium">
                      {labels[key] || key}
                    </span>
                    {typeof value === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => set(e.target.checked)}
                      />
                    ) : key === "studentId" ? (
                      <Select
                        value={String(value)}
                        onChange={(e) => set(e.target.value)}
                      >
                        {students.map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    ) : options ? (
                      <Select
                        value={String(value)}
                        onChange={(e) => set(e.target.value)}
                      >
                        {options.map((v) => (
                          <option key={v} value={v}>
                            {statuses[v] || v}
                          </option>
                        ))}
                      </Select>
                    ) : [
                        "description",
                        "content",
                        "feedback",
                        "observedNeed",
                        "goal",
                        "recommendedActivity",
                        "progressNotes",
                      ].includes(key) ? (
                      <textarea
                        className="ss-field min-h-32"
                        maxLength={key === "content" ? 20000 : 4000}
                        required={
                          key !== "progressNotes" &&
                          !(
                            key === "content" &&
                            form.kind === "submissions" &&
                            !form.submit
                          )
                        }
                        value={String(value ?? "")}
                        onChange={(e) => set(e.target.value)}
                      />
                    ) : (
                      <Input
                        type={
                          typeof value === "number"
                            ? "number"
                            : key.toLowerCase().includes("date")
                              ? "date"
                              : key === "fileUrl"
                                ? "url"
                                : "text"
                        }
                        min={
                          typeof value === "number"
                            ? key === "quarter"
                              ? 1
                              : 0
                            : undefined
                        }
                        max={
                          key === "quarter"
                            ? 4
                            : key === "score"
                              ? form.maxScore
                              : undefined
                        }
                        required
                        value={String(value ?? "")}
                        onChange={(e) =>
                          set(
                            typeof value === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                          )
                        }
                        readOnly={key === "subject" && !admin}
                      />
                    )}
                  </label>
                );
              })}
            {form.classIds && (
              <fieldset className="space-y-3">
                <legend className="mb-2 font-medium">
                  Sinflar · ommaviy biriktirish
                </legend>
                {classes.map((c: any) => (
                  <label
                    key={c.id}
                    className="mr-4 inline-flex min-h-11 items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={form.classIds.includes(c.id)}
                      onChange={(e) =>
                        setForm((f: any) => ({
                          ...f,
                          classIds: e.target.checked
                            ? [...f.classIds, c.id]
                            : f.classIds.filter((id: string) => id !== c.id),
                        }))
                      }
                    />
                    {c.code.toUpperCase()}
                  </label>
                ))}
              </fieldset>
            )}
            <div className="flex gap-3">
              <Button type="submit" busy={busy}>
                Saqlash
              </Button>
              <button
                type="button"
                className="ss-secondary"
                disabled={busy}
                onClick={close}
              >
                Bekor qilish
              </button>
            </div>
          </form>
        </Drawer>
      )}
    </main>
  );
}
