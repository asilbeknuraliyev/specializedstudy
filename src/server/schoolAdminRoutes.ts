import { runtimeMetrics } from "./runtimeMetrics";
import {
  analysisQuestion,
  calculateItems,
  firstAnalysisFacts,
} from "./topicAnalysisEngine";
import crypto from "node:crypto";
import { z } from "zod";
import type { Express } from "express";
import {
  SchoolError,
  schoolAdmin,
  schoolKey,
  schoolAudit,
  ensureRows,
  operation,
  remember,
  checkRevision,
  localDate,
  validDate,
  digest,
  type SchoolContext,
} from "./enterpriseCore";
import { runtimeNamespace } from "./runtimeScope";
const base = z.object({ operationId: z.uuid() }),
  date = z.string().refine(validDate),
  reason = z.string().trim().min(8).max(2000);
export const CONSENT_VERSION = "learning-pilot-v1";
export const CONSENT_TEXT =
  "Ixtiyoriy ichki o‘quv sinovi: mavzu testlaridagi javoblar va takrorlash faolligi ta’lim usulini yaxshilash uchun guruhlar bo‘yicha tahlil qilinadi. Qatnashmaslik baho, darsga kirish va intizomga ta’sir qilmaydi. Ism-familiya tashqi hisobotga kiritilmaydi. Istalgan vaqtda rozilikni bekor qilish va o‘quv mashqlari ma’lumotini o‘chirishni so‘rash mumkin. Rasmiy nazorat, davomat va tarbiyaviy hujjatlar alohida tartibda yuritiladi.";
export function pilotSummary(c: SchoolContext, p: any) {
  const consented = (id: string) =>
      (c.db.learningConsents || []).some(
        (v: any) =>
          v.schoolId === p.schoolId &&
          v.studentId === id &&
          v.accepted &&
          v.version === p.consentVersion,
      ),
    facts = (c.db.topicAnalysisFacts || []).filter(
      (f: any) =>
        f.schoolId === p.schoolId &&
        f.testId === p.testId &&
        f.testVersion === p.testVersion &&
        f.autoTotal > 0,
    );
  const group = (ids: string[]) => {
    const eligible = ids.filter(consented),
      pairs = eligible.flatMap((id) => {
        const f = facts
            .filter((f: any) => f.studentId === id)
            .sort((a: any, b: any) =>
              a.submittedAt.localeCompare(b.submittedAt),
            ),
          first = (from: string, to: string) =>
            f.find(
              (v: any) =>
                localDate(new Date(v.submittedAt)) >= from &&
                localDate(new Date(v.submittedAt)) <= to,
            ),
          pre = first(p.preFrom, p.preTo),
          post = first(p.postFrom, p.postTo);
        return pre && post
          ? [
              {
                pre: pre.autoCorrect / pre.autoTotal,
                post: post.autoCorrect / post.autoTotal,
              },
            ]
          : [];
      });
    const enough = pairs.length >= 5,
      mean = (k: "pre" | "post") =>
        pairs.reduce((n, v) => n + v[k], 0) / pairs.length;
    return {
      enrolled: ids.length,
      consented: eligible.length,
      paired: enough ? pairs.length : null,
      missing: enough ? eligible.length - pairs.length : null,
      prePercent: enough ? Math.round(mean("pre") * 1000) / 10 : null,
      postPercent: enough ? Math.round(mean("post") * 1000) / 10 : null,
      changePoints: enough
        ? Math.round((mean("post") - mean("pre")) * 1000) / 10
        : null,
      notice: enough
        ? "Birinchi topshirish, bir xil test versiyasi, ikkala davrda qatnashganlar."
        : "Juft kuzatuvli kamida 5 nafar rozilik bergan o‘quvchi kerak.",
    };
  };
  const a = group(p.groupA),
    b = group(p.groupB);
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    groupA: a,
    groupB: b,
    differenceInChange:
      a.changePoints !== null && b.changePoints !== null
        ? Math.round((a.changePoints - b.changePoints) * 10) / 10
        : null,
    notice:
      "Bu kuzatuv hisoboti; sababiy ta’sir isboti emas. Guruh tanlovi, qayta test va yo‘qolgan kuzatuvlar natijaga ta’sir qilishi mumkin. Rasmiy baholar o‘zgarmaydi.",
  };
}
export function registerSchoolAdminRoutes(app: Express, deps: any) {
  const rates = new Map<string, { at: number; n: number }>();
  const access = (
    req: any,
    res: any,
    admin = true,
    write = false,
  ): SchoolContext | undefined => {
    const a = deps.authenticate(req);
    if (!a || a.user.status !== "active") {
      res.status(401).json({ error: "Hisobga kiring." });
      return;
    }
    if (
      (admin && !schoolAdmin(a.user)) ||
      (!admin && !schoolAdmin(a.user) && a.user.role !== "student")
    ) {
      res.status(403).json({ error: "Bu bo‘limga ruxsat yo‘q." });
      return;
    }
    const c = { ...a, now: deps.now ? new Date(deps.now()) : new Date() };
    res.setHeader("Cache-Control", "no-store");
    if (write) {
      const key = schoolKey(a.user.institutionId, a.user.uid),
        old = rates.get(key),
        r =
          !old || c.now.getTime() - old.at > 60000
            ? { at: c.now.getTime(), n: 1 }
            : { ...old, n: old.n + 1 };
      if (rates.size > 1000) rates.delete(rates.keys().next().value!);
      rates.set(key, r);
      if (r.n > 30) {
        res.status(429).json({ error: "Bir oz kutib qayta urinib ko‘ring." });
        return;
      }
    }
    return c;
  };
  const fail = (res: any, e: any) =>
    res.status(e instanceof SchoolError ? e.status : 500).json({
      error:
        e instanceof SchoolError
          ? e.message
          : "Boshqaruv amali bajarilmadi. Qayta urinib ko‘ring.",
    });
  const read =
    (fn: any, admin = true) =>
    (req: any, res: any) => {
      const c = access(req, res, admin);
      if (c)
        try {
          fn(c, req, res);
        } catch (e) {
          fail(res, e);
        }
    };
  const write =
    (kind: string, schema: any, fn: any, admin = true) =>
    (req: any, res: any) => {
      const c = access(req, res, admin, true);
      if (!c) return;
      const parsed = schema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          error: "Maydonlarni tekshiring.",
          fields: parsed.error.issues.map((i: any) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        });
      try {
        const d = parsed.data,
          sig = { path: req.path, body: d },
          prev = operation(c, d.operationId, kind, sig);
        if (prev) return res.json({ duplicate: true, refs: prev.refs });
        const result = fn(c, d, req);
        remember(c, d.operationId, kind, sig, [result?.id].filter(Boolean));
        deps.save(c.env, c.db);
        res.json({ result });
      } catch (e) {
        fail(res, e);
      }
    };
  const school = (c: SchoolContext, row: any) =>
    (row.institutionId || row.schoolId) === c.user.institutionId;
  const account = (c: SchoolContext, id: string) =>
    c.db.users.find(
      (u: any) =>
        u.uid === id &&
        u.institutionId === c.user.institutionId &&
        ["student", "teacher"].includes(u.role),
    );
  app.get(
    "/api/school-admin/accounts/:id",
    read((c: SchoolContext, req: any, res: any) => {
      const u = account(c, String(req.params.id));
      if (!u) throw new SchoolError(404, "Hisob topilmadi.");
      res.json({
        user: {
          id: u.uid,
          name: u.displayName,
          role: u.role,
          status: u.status,
          classId: u.classId || "",
          classIds: u.assignedClassIds || [],
          subject: u.subject || "",
          revision: u.profileRevision || 0,
        },
        classes: c.db.classes
          .filter((cl: any) => cl.institutionId === c.user.institutionId)
          .map((cl: any) => ({ id: cl.id, code: cl.code })),
      });
    }),
  );
  app.get(
    "/api/school-admin/coverage",
    read((c: SchoolContext, req: any, res: any) => {
      const f = z
        .object({
          classId: z.string().max(200).default(""),
          subject: z.string().max(100).default(""),
          q: z.string().max(100).default(""),
          page: z.coerce.number().int().min(0).max(10000).default(0),
        })
        .safeParse(req.query);
      if (!f.success) throw new SchoolError(400, "Filtrlarni tekshiring.");
      const classes = c.db.classes.filter(
        (cl: any) =>
          cl.institutionId === c.user.institutionId &&
          (!f.data.classId || cl.id === f.data.classId),
      );
      if (f.data.classId && !classes.length)
        throw new SchoolError(403, "Sinfga ruxsat yo‘q.");
      const plans = new Set(
          (c.db.workPlans || [])
            .filter((p: any) => school(c, p) && p.status !== "archived")
            .map((p: any) => p.id),
        ),
        tests = new Map<string, any[]>();
      for (const t of c.db.topicTests || [])
        if (school(c, t) && t.status === "published")
          tests.set(t.lessonId, [...(tests.get(t.lessonId) || []), t]);
      const lessons = c.db.lessons.filter(
          (l: any) =>
            school(c, l) &&
            l.status === "published" &&
            (!f.data.subject ||
              [l.subject, l.subjectName].includes(f.data.subject)) &&
            (!f.data.q ||
              (l.title || l.topicTitle || "")
                .toLowerCase()
                .includes(f.data.q.toLowerCase())),
        ),
        rows = lessons
          .flatMap((l: any) =>
            classes
              .filter((cl: any) =>
                [l.classId, ...(l.classIds || [])].includes(cl.id),
              )
              .map((cl: any) => ({
                id: schoolKey(l.id, cl.id),
                lessonId: l.id,
                title: l.title || l.topicTitle,
                subject: l.subjectName || l.subject,
                classId: cl.id,
                classCode: cl.code,
                quarter: l.quarter,
                planMissing: !l.workPlanId || !plans.has(l.workPlanId),
                testMissing: !(tests.get(l.id) || []).some(
                  (t) => !t.classIds || t.classIds.includes(cl.id),
                ),
              })),
          )
          .filter((r: any) => r.planMissing || r.testMissing);
      res.json({
        rows: rows.slice(f.data.page * 20, f.data.page * 20 + 20),
        total: rows.length,
        page: f.data.page,
        classes: c.db.classes
          .filter((cl: any) => cl.institutionId === c.user.institutionId)
          .map((cl: any) => ({ id: cl.id, code: cl.code })),
        subjects: [
          ...new Set(lessons.map((l: any) => l.subjectName || l.subject)),
        ].sort(),
      });
    }),
  );
  app.post(
    "/api/school-admin/accounts/:id",
    write(
      "account-assignment",
      base.extend({
        revision: z.number().int().min(0),
        name: z.string().trim().min(3).max(120),
        classId: z.string().max(200).default(""),
        classIds: z.array(z.string().max(200)).max(30).default([]),
        subject: z.string().trim().max(100).default(""),
        reason,
      }),
      (c: SchoolContext, d: any, req: any) => {
        const u = account(c, String(req.params.id));
        if (!u) throw new SchoolError(404, "Hisob topilmadi.");
        checkRevision(u.profileRevision || 0, d.revision);
        const ids =
          u.role === "teacher" ? d.classIds : d.classId ? [d.classId] : [];
        if (
          ids.some(
            (id: string) =>
              !c.db.classes.some(
                (cl: any) =>
                  cl.id === id && cl.institutionId === c.user.institutionId,
              ),
          ) ||
          (u.role === "teacher" && (!ids.length || d.subject.length < 2))
        )
          throw new SchoolError(
            400,
            "Maktab sinflari va ustoz fanini tekshiring.",
          );
        const before = {
          name: u.displayName,
          classId: u.classId,
          classIds: u.assignedClassIds,
          subject: u.subject,
          revision: u.profileRevision || 0,
        };
        u.displayName = d.name;
        u.profileRevision = d.revision + 1;
        if (u.role === "teacher") {
          u.assignedClassIds = [...new Set(ids)];
          u.subject = d.subject;
        } else {
          u.classId = d.classId || undefined;
          u.classCode = c.db.classes.find(
            (cl: any) =>
              cl.id === d.classId && cl.institutionId === c.user.institutionId,
          )?.code;
          for (const cl of c.db.classes.filter(
            (cl: any) => cl.institutionId === c.user.institutionId,
          ))
            cl.studentCount = c.db.users.filter(
              (s: any) =>
                s.institutionId === c.user.institutionId &&
                s.role === "student" &&
                s.classId === cl.id &&
                s.status === "active",
            ).length;
        }
        deps.revoke?.(u.uid, c.env);
        schoolAudit(
          c,
          "Hisob profili va biriktirish yangilandi",
          u.uid,
          before,
          {
            name: u.displayName,
            classId: u.classId,
            classIds: u.assignedClassIds,
            subject: u.subject,
            revision: u.profileRevision,
            reason: d.reason,
          },
        );
        return { id: u.uid, revision: u.profileRevision };
      },
    ),
  );
  app.get(
    "/api/school-admin",
    read((c: SchoolContext, req: any, res: any) => {
      const count = (key: string, predicate = (r: any) => true) =>
          (c.db[key] || []).filter((r: any) => school(c, r) && predicate(r))
            .length,
        page = Math.max(0, Math.min(10000, Number(req.query.page) || 0)),
        audit = (c.db.schoolAuditEvents || [])
          .filter((r: any) => school(c, r))
          .slice()
          .reverse(),
        policy = (c.db.schoolRetentionPolicies || []).find(
          (p: any) => p.schoolId === c.user.institutionId,
        ) || {
          revision: 0,
          days: 180,
          approved: false,
          automaticDeletion: false,
        };
      res.json({
        counts: {
          students: count("users", (u) => u.role === "student"),
          teachers: count("users", (u) => u.role === "teacher"),
          classes: count("classes"),
          lessons: count("lessons"),
          pendingGrading:
            count("assignmentSubmissions", (s) =>
              ["Topshirildi", "Tekshirilmoqda"].includes(s.status),
            ) +
            count("topicSessions", (s) => !!s.submittedAt && s.pending) +
            count("attempts", (a) => a.status === "pending_manual_review"),
          pendingDiscipline: count("disciplineRecords", (r) =>
            ["submitted", "review"].includes(r.status),
          ),
          appeals: count("disciplineAppeals", (a) => a.status === "pending"),
          missingContent: count(
            "lessons",
            (l) =>
              l.status === "published" &&
              !(c.db.topicTests || []).some(
                (t: any) =>
                  school(c, t) &&
                  t.lessonId === l.id &&
                  t.status === "published",
              ),
          ),
          pilots: count("pilotPrograms"),
          deletionRequests: count(
            "dataDeletionRequests",
            (r) => r.status === "pending",
          ),
        },
        audit: {
          rows: audit.slice(page * 20, page * 20 + 20),
          total: audit.length,
          page,
        },
        status: {
          namespace: runtimeNamespace(),
          environment: process.env.VERCEL_ENV || "local",
          build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local",
          storage: process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT
            ? "Firestore server"
            : "Lokal yoki muhit sozlamasi",
          automaticDiscipline: false,
          automaticDeletion: false,
        },
        runtime: runtimeMetrics.snapshot(),
        retention: policy,
        pilots: (c.db.pilotPrograms || [])
          .filter((p: any) => school(c, p))
          .map((p: any) => ({ ...p, summary: pilotSummary(c, p) })),
        students: c.db.users
          .filter(
            (u: any) =>
              u.institutionId === c.user.institutionId &&
              u.role === "student" &&
              u.status === "active",
          )
          .map((u: any) => ({
            id: u.uid,
            name: u.displayName,
            classId: u.classId,
            classCode: u.classCode,
            consented: (c.db.learningConsents || []).some(
              (v: any) =>
                v.schoolId === c.user.institutionId &&
                v.studentId === u.uid &&
                v.version === CONSENT_VERSION &&
                v.accepted,
            ),
          })),
        tests: (c.db.topicTestVersions || [])
          .filter((t: any) => t.schoolId === c.user.institutionId)
          .map((t: any) => ({
            id: t.testId,
            version: t.version,
            title: t.test.title,
          })),
        deletions: (c.db.dataDeletionRequests || [])
          .filter((r: any) => school(c, r))
          .slice(-100),
        consent: { version: CONSENT_VERSION, text: CONSENT_TEXT },
      });
    }),
  );
  app.post(
    "/api/school-admin/pilots",
    write(
      "pilot-config",
      base.extend({
        id: z.string().optional(),
        revision: z.number().int().min(0),
        title: z.string().trim().min(3).max(200),
        testId: z.string(),
        testVersion: z.number().int().positive(),
        groupA: z.array(z.string()).min(5).max(100),
        groupB: z.array(z.string()).min(5).max(100),
        preFrom: date,
        preTo: date,
        postFrom: date,
        postTo: date,
        status: z.enum(["draft", "active", "closed"]),
        schoolPermissionAcknowledged: z.boolean(),
        reason,
      }),
      (c: SchoolContext, d: any) => {
        const ids = [...d.groupA, ...d.groupB];
        if (
          new Set(ids).size !== ids.length ||
          ids.some(
            (id) =>
              !c.db.users.some(
                (u: any) =>
                  u.uid === id &&
                  u.institutionId === c.user.institutionId &&
                  u.role === "student" &&
                  u.status === "active",
              ),
          )
        )
          throw new SchoolError(
            400,
            "Guruhlar takrorlanmasin va faqat faol maktab o‘quvchilaridan tuzilsin.",
          );
        if (
          d.preFrom > d.preTo ||
          d.preTo >= d.postFrom ||
          d.postFrom > d.postTo
        )
          throw new SchoolError(
            400,
            "Oldingi va keyingi davrlar izchil, kesishmaydigan bo‘lsin.",
          );
        if (
          !c.db.topicTestVersions?.some(
            (t: any) =>
              t.schoolId === c.user.institutionId &&
              t.testId === d.testId &&
              t.version === d.testVersion,
          )
        )
          throw new SchoolError(400, "Tasdiqlangan test versiyasini tanlang.");
        if (!d.id || d.status === "active") {
          const version = c.db.topicTestVersions.find(
              (t: any) =>
                t.schoolId === c.user.institutionId &&
                t.testId === d.testId &&
                t.version === d.testVersion,
            ),
            lesson = c.db.lessons.find(
              (l: any) => l.id === version?.test.lessonId && school(c, l),
            );
          if (
            !lesson ||
            lesson.status !== "published" ||
            version.test.status !== "published" ||
            ids.some((id) => {
              const student = c.db.users.find(
                (u: any) =>
                  u.uid === id && u.institutionId === c.user.institutionId,
              );
              return (
                ![lesson.classId, ...(lesson.classIds || [])].includes(
                  student.classId,
                ) ||
                (version.test.classIds &&
                  !version.test.classIds.includes(student.classId))
              );
            })
          )
            throw new SchoolError(
              400,
              "Pilot qatnashchilari nashr qilingan test biriktirilgan sinflardan bo‘lsin.",
            );
        }
        if (
          d.status === "active" &&
          (!d.schoolPermissionAcknowledged ||
            ids.some(
              (id) =>
                !(c.db.learningConsents || []).some(
                  (v: any) =>
                    v.schoolId === c.user.institutionId &&
                    v.studentId === id &&
                    v.version === CONSENT_VERSION &&
                    v.accepted,
                ),
            ))
        )
          throw new SchoolError(
            400,
            "Faollashtirish uchun maktab ruxsati va ishtirokchilarning ixtiyoriy roziligi kerak.",
          );
        const rows = ensureRows(c.db, "pilotPrograms"),
          old = d.id
            ? rows.find((p: any) => p.id === d.id && school(c, p))
            : undefined;
        if (d.id && !old) throw new SchoolError(403, "Pilot topilmadi.");
        checkRevision(old?.revision || 0, d.revision);
        const before = old ? structuredClone(old) : null,
          now = c.now.toISOString(),
          row = {
            ...d,
            operationId: undefined,
            id: old?.id || crypto.randomUUID(),
            schoolId: c.user.institutionId,
            consentVersion: CONSENT_VERSION,
            revision: d.revision + 1,
            createdAt: old?.createdAt || now,
            updatedAt: now,
            approvedBy: d.status === "active" ? c.user.uid : old?.approvedBy,
          };
        if (old) Object.assign(old, row);
        else rows.push(row);
        schoolAudit(c, "Pilot sozlamasi saqlandi", row.id, before, row);
        return row;
      },
    ),
  );
  app.post(
    "/api/school-admin/pilots/:id/export",
    write("pilot-export", base, (c: SchoolContext, _d: any, req: any) => {
      const p = (c.db.pilotPrograms || []).find(
        (p: any) => p.id === req.params.id && school(c, p),
      );
      if (!p) throw new SchoolError(403, "Pilotga ruxsat yo‘q.");
      const report = pilotSummary(c, p);
      schoolAudit(c, "Pilot guruh hisoboti eksporti", p.id, null, {
        aggregate: true,
      });
      return { id: p.id, report };
    }),
  );
  app.get(
    "/api/learning-privacy",
    read(
      (c: SchoolContext, _req: any, res: any) =>
        res.json({
          version: CONSENT_VERSION,
          text: CONSENT_TEXT,
          consent:
            (c.db.learningConsents || []).find(
              (v: any) =>
                v.schoolId === c.user.institutionId &&
                v.studentId === c.user.uid,
            ) || null,
          requests: (c.db.dataDeletionRequests || []).filter(
            (r: any) => school(c, r) && r.studentId === c.user.uid,
          ),
          retention:
            (c.db.schoolRetentionPolicies || []).find(
              (p: any) => p.schoolId === c.user.institutionId,
            )?.days || 180,
        }),
      false,
    ),
  );
  app.post(
    "/api/learning-privacy/consent",
    write(
      "learning-consent",
      base.extend({
        accepted: z.boolean(),
        version: z.literal(CONSENT_VERSION),
      }),
      (c: SchoolContext, d: any) => {
        if (c.user.role !== "student")
          throw new SchoolError(
            403,
            "Rozilikni o‘quvchi o‘z hisobida bildiradi.",
          );
        const rows = ensureRows(c.db, "learningConsents"),
          id = schoolKey(c.user.institutionId, c.user.uid),
          old = rows.find((v: any) => v.id === id),
          before = old ? structuredClone(old) : null,
          row = {
            id,
            schoolId: c.user.institutionId,
            studentId: c.user.uid,
            accepted: d.accepted,
            version: CONSENT_VERSION,
            text: CONSENT_TEXT,
            at: c.now.toISOString(),
          };
        if (old) Object.assign(old, row);
        else rows.push(row);
        schoolAudit(c, "Ixtiyoriy pilot roziligi o‘zgardi", id, before, row);
        return row;
      },
      false,
    ),
  );
  app.post(
    "/api/learning-privacy/deletion",
    write(
      "learning-deletion-request",
      base.extend({ reason }),
      (c: SchoolContext, d: any) => {
        if (c.user.role !== "student")
          throw new SchoolError(
            403,
            "O‘zingizning ma’lumotlaringiz uchun so‘rov yuboring.",
          );
        const rows = ensureRows(c.db, "dataDeletionRequests");
        if (
          rows.some(
            (r: any) =>
              school(c, r) &&
              r.studentId === c.user.uid &&
              r.status === "pending",
          )
        )
          throw new SchoolError(409, "Ochiq so‘rovingiz bor.");
        const row = {
          id: crypto.randomUUID(),
          schoolId: c.user.institutionId,
          studentId: c.user.uid,
          reason: d.reason,
          status: "pending",
          revision: 1,
          createdAt: c.now.toISOString(),
        };
        rows.push(row);
        schoolAudit(c, "O‘quv ma’lumotini o‘chirish so‘raldi", row.id, null, {
          studentId: c.user.uid,
        });
        return row;
      },
      false,
    ),
  );
  app.post(
    "/api/school-admin/retention",
    write(
      "learning-retention",
      base.extend({
        revision: z.number().int().min(0),
        days: z.number().int().min(30).max(1825),
        approved: z.boolean(),
        reason,
      }),
      (c: SchoolContext, d: any) => {
        const rows = ensureRows(c.db, "schoolRetentionPolicies"),
          old = rows.find((r: any) => school(c, r));
        checkRevision(old?.revision || 0, d.revision);
        const before = old ? structuredClone(old) : null,
          row = {
            id: c.user.institutionId,
            schoolId: c.user.institutionId,
            days: d.days,
            approved: d.approved,
            automaticDeletion: false,
            reason: d.reason,
            revision: d.revision + 1,
            updatedAt: c.now.toISOString(),
            by: c.user.uid,
          };
        if (old) Object.assign(old, row);
        else rows.push(row);
        schoolAudit(c, "O‘quv ma’lumoti saqlash muddati", row.id, before, row);
        return row;
      },
    ),
  );
  app.post(
    "/api/school-admin/deletions/:id/review",
    write(
      "learning-deletion-review",
      base.extend({
        revision: z.number().int(),
        action: z.enum(["dry_run", "reject", "approve"]),
        reason,
        confirmation: z.string().optional(),
        previewId: z.uuid().optional(),
      }),
      (c: SchoolContext, d: any, req: any) => {
        const r = (c.db.dataDeletionRequests || []).find(
          (r: any) => r.id === req.params.id && school(c, r),
        );
        if (!r) throw new SchoolError(403, "So‘rov topilmadi.");
        checkRevision(r.revision, d.revision);
        if (r.status !== "pending")
          throw new SchoolError(409, "So‘rov ko‘rib chiqilgan.");
        const keys = [
            "topicSessions",
            "topicReviews",
            "topicAnalysisFacts",
            "mistakeRecords",
            "spacedReviewQueue",
            "spacedReviewSessions",
            "spacedReviewAnswers",
            "reviewDailyUsage",
            "studentTopicProgress",
            "reinforcementSessions",
            "lessonPracticeResponses",
            "studentLastLessons",
          ],
          matches = (v: any) => school(c, v) && v.studentId === r.studentId,
          counts = Object.fromEntries(
            keys.map((k) => [k, (c.db[k] || []).filter(matches).length]),
          );
        const signature = digest(
          keys.map((k) => [k, (c.db[k] || []).filter(matches)]),
        );
        if (d.action === "dry_run") {
          const preview = {
            id: crypto.randomUUID(),
            schoolId: c.user.institutionId,
            studentId: r.studentId,
            requestId: r.id,
            actorId: c.user.uid,
            revision: r.revision,
            signature,
            createdAt: c.now.toISOString(),
          };
          ensureRows(c.db, "dataDeletionPreviews").push(preview);
          schoolAudit(c, "O‘chirish sinov ko‘rinishi olindi", r.id, null, {
            counts,
          });
          return {
            id: r.id,
            previewId: preview.id,
            counts,
            officialDataChanged: false,
          };
        }
        const before = structuredClone(r);
        if (d.action === "approve") {
          const preview = (c.db.dataDeletionPreviews || []).find(
            (v: any) =>
              v.id === d.previewId &&
              v.schoolId === c.user.institutionId &&
              v.actorId === c.user.uid &&
              v.requestId === r.id &&
              v.revision === r.revision &&
              v.signature === signature &&
              c.now.getTime() - Date.parse(v.createdAt) <= 600000,
          );
          if (!preview)
            throw new SchoolError(
              409,
              "Joriy ma’lumotlar uchun yangi sinov ko‘rinishi oling.",
            );
          if (d.confirmation !== "O‘QUV MASHQLARINI O‘CHIRISH")
            throw new SchoolError(400, "Tasdiqlash matni to‘liq mos bo‘lsin.");
          const affected = new Set(
            (c.db.topicAnalysisFacts || [])
              .filter(matches)
              .map((f: any) => [f.classId, f.testId, f.testVersion].join(":")),
          );
          for (const key of keys)
            c.db[key] = (c.db[key] || []).filter((v: any) => !matches(v));
          c.db.topicAnalysisCohorts = (c.db.topicAnalysisCohorts || []).flatMap(
            (v: any) => {
              if (
                !school(c, v) ||
                !affected.has([v.classId, v.testId, v.testVersion].join(":"))
              )
                return [v];
              const facts = (c.db.topicAnalysisFacts || []).filter(
                (f: any) =>
                  school(c, f) &&
                  f.classId === v.classId &&
                  f.testId === v.testId &&
                  f.testVersion === v.testVersion &&
                  f.autoTotal > 0 &&
                  Array.isArray(f.responses),
              );
              if (!facts.length) return [];
              const first = firstAnalysisFacts(facts),
                questions = new Map<string, any>();
              for (const f of facts)
                for (const response of f.responses) {
                  const q = analysisQuestion(
                    c.db,
                    c.user.institutionId,
                    response.questionId,
                    response.revision,
                  );
                  if (q) questions.set(q.id + ":" + q.revision, q);
                }
              return [
                {
                  ...v,
                  items: calculateItems(facts, [...questions.values()], v.id),
                  observations: first.length,
                  meanCorrect:
                    first.reduce(
                      (sum, f) => sum + f.autoCorrect / f.autoTotal,
                      0,
                    ) / first.length,
                  revision: v.revision + 1,
                  updatedAt: c.now.toISOString(),
                },
              ];
            },
          );
          r.status = "completed";
        } else r.status = "rejected";
        r.reasonForDecision = d.reason;
        r.reviewedBy = c.user.uid;
        r.reviewedAt = c.now.toISOString();
        r.revision++;
        schoolAudit(
          c,
          "O‘chirish so‘rovi inson tomonidan ko‘rildi",
          r.id,
          before,
          { ...r, counts },
        );
        return {
          id: r.id,
          status: r.status,
          counts,
          officialDataChanged: false,
        };
      },
    ),
  );
  app.post(
    "/api/school-admin/backup",
    write(
      "school-backup",
      base.extend({ reason }),
      (c: SchoolContext, d: any) => {
        const keys = [
          "classes",
          "subjects",
          "topics",
          "workPlans",
          "lessons",
          "timetables",
          "timetableEntries",
          "studentAssignments",
          "assignmentSubmissions",
          "attendanceSessions",
          "attendanceRecords",
          "studentSupportPlans",
          "learningMaterials",
          "announcements",
          "disciplinePolicies",
          "disciplineTypes",
          "disciplinePeriods",
          "disciplineRecords",
          "disciplineTotals",
          "disciplineCases",
          "disciplineAppeals",
          "warningLetters",
          "schoolAuditEvents",
          "pilotPrograms",
          "schoolRetentionPolicies",
        ];
        const content = Object.fromEntries(
          keys.map((k) => [
            k,
            (c.db[k] || []).filter((r: any) => school(c, r)),
          ]),
        );
        schoolAudit(
          c,
          "Maktab boshqaruv zaxirasi eksporti",
          c.user.institutionId,
          null,
          { reason: d.reason, collections: keys },
        );
        return {
          id: "backup",
          schema: 1,
          createdAt: c.now.toISOString(),
          schoolId: c.user.institutionId,
          scope:
            "Maktab boshqaruv ma’lumotlari. Parollar, sessiya kalitlari va Firebase maxfiy sozlamalari kiritilmagan. To‘liq server snapshot alohida operator zaxirasidir.",
          data: content,
        };
      },
    ),
  );
}
