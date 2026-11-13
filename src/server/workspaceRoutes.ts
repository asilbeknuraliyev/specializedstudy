import {feedbackTemplates} from './feedbackTemplates';
import { deliveredNotification } from "../utils/notificationPolicy";
import crypto from "node:crypto";
import { z } from "zod";
import type { Express } from "express";
import {
  SchoolError,
  schoolAdmin,
  schoolClasses,
  schoolStudent,
  schoolKey,
  ensureRows,
  schoolAudit,
  operation,
  remember,
  checkRevision,
  localDate,
  validDate,
  type SchoolContext,
} from "./enterpriseCore";
import { canReadDiscipline } from "./disciplineEngine";
const text = z.string().trim().min(2).max(4000),
  date = z.string().refine(validDate, "Sana noto‘g‘ri"),
  base = z.object({ operationId: z.uuid() });
const link = z
  .url()
  .max(2000)
  .refine((v) => {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password;
  }, "HTTPS havola kerak");
export function registerWorkspaceRoutes(app: Express, deps: any) {
  const rates = new Map<string, { at: number; n: number }>();
  const context = (
    req: any,
    res: any,
    write = false,
  ): SchoolContext | undefined => {
    const a = deps.authenticate(req);
    if (!a || a.user.status !== "active") {
      res.status(401).json({ error: "Hisobga kiring." });
      return;
    }
    if (!schoolAdmin(a.user) && !["teacher", "student"].includes(a.user.role)) {
      res.status(403).json({ error: "Ruxsat yo‘q." });
      return;
    }
    const c = { ...a, now: deps.now ? new Date(deps.now()) : new Date() };
    if (write) {
      const key = schoolKey(a.user.institutionId, a.user.uid),
        old = rates.get(key),
        r =
          !old || c.now.getTime() - old.at > 60000
            ? { at: c.now.getTime(), n: 1 }
            : { ...old, n: old.n + 1 };
      if (rates.size > 2000) rates.delete(rates.keys().next().value!);
      rates.set(key, r);
      if (r.n > 60) {
        res.status(429).json({ error: "Bir oz kutib qayta urinib ko‘ring." });
        return;
      }
    }
    res.setHeader("Cache-Control", "no-store");
    return c;
  };
  const fail = (res: any, e: any) =>
    res.status(e instanceof SchoolError ? e.status : 500).json({
      error:
        e instanceof SchoolError
          ? e.message
          : "Amal bajarilmadi. Kiritilgan matnni saqlab, qayta urinib ko‘ring.",
    });
  const read = (fn: any) => (req: any, res: any) => {
    const c = context(req, res);
    if (c)
      try {
        return fn(c, req, res);
      } catch (e) {
        return fail(res, e);
      }
  };
  const write =
    (kind: string, schema: z.ZodType<any>, fn: any) => (req: any, res: any) => {
      const c = context(req, res, true);
      if (!c) return;
      const d = schema.safeParse(req.body);
      if (!d.success)
        return res.status(400).json({
          error: "Maydonlarni tekshiring.",
          fields: d.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        });
      try {
        const sig = { path: req.path, body: d.data },
          prev = operation(c, d.data.operationId, kind, sig);
        if (prev) return res.json({ duplicate: true, refs: prev.refs });
        const result = fn(c, d.data, req);
        remember(
          c,
          d.data.operationId,
          kind,
          sig,
          [result?.id].filter(Boolean),
        );
        deps.save(c.env, c.db);
        return res.json({ result });
      } catch (e) {
        return fail(res, e);
      }
    };
  const staff = (c: SchoolContext) => {
    if (!schoolAdmin(c.user) && c.user.role !== "teacher")
      throw new SchoolError(403, "Faqat ustoz yoki administrator.");
  };
  const classFor = (c: SchoolContext, id: string) => {
    const cl = schoolClasses(c).find((v: any) => v.id === id);
    if (!cl) throw new SchoolError(403, "Sinfga ruxsat yo‘q.");
    return cl;
  };
  const subjectFor = (c: SchoolContext, value: string) => {
    if (
      !schoolAdmin(c.user) &&
      c.user.role === "teacher" &&
      value !== c.user.subject
    )
      throw new SchoolError(403, "Faqat biriktirilgan fan.");
    return value;
  };
  const scoped = (c: SchoolContext, row: any) =>
    row.institutionId === c.user.institutionId;
  const visible = (c: SchoolContext, row: any) =>
    scoped(c, row) &&
    (schoolAdmin(c.user) ||
      (c.user.role === "teacher" &&
        row.subject === c.user.subject &&
        (row.targetClassIds || []).some((id: string) =>
          schoolClasses(c).some((cl: any) => cl.id === id),
        )) ||
      (c.user.role === "student" &&
        row.status !== "draft" &&
        (row.targetClassIds || []).includes(c.user.classId)));
  const assignmentFor = (c: SchoolContext, id: string) => {
    const a = (c.db.studentAssignments || []).find(
      (v: any) => v.id === id && visible(c, v),
    );
    if (!a) throw new SchoolError(403, "Vazifaga ruxsat yo‘q.");
    return a;
  };
  const owned = (c: SchoolContext, row: any) => {
    staff(c);
    if (
      !row ||
      !scoped(c, row) ||
      (!schoolAdmin(c.user) &&
        row.createdByUid !== c.user.uid &&
        row.uploadedByUid !== c.user.uid)
    )
      throw new SchoolError(403, "Faqat o‘zingiz yaratgan yozuvni boshqaring.");
  };
  const lessonFor = (c: SchoolContext, id: string, classId?: string) => {
    const l = c.db.lessons.find((v: any) => v.id === id && scoped(c, v));
    if (
      !l ||
      (!schoolAdmin(c.user) &&
        ![l.subjectName, l.subject].includes(c.user.subject)) ||
      !schoolClasses(c).some(
        (cl: any) =>
          (!classId || cl.id === classId) &&
          [l.classId, ...(l.classIds || [])].includes(cl.id),
      )
    )
      throw new SchoolError(403, "Darsga ruxsat yo‘q.");
    return l;
  };
  app.get(
    "/api/workspace/report",
    read((c: SchoolContext, req: any, res: any) => {
      const month = String(req.query.month || localDate(c.now).slice(0, 7)),
        classId = String(req.query.classId || "");
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        throw new SchoolError(400, "Oyni tanlang.");
      if (classId) classFor(c, classId);
      const ids = new Set(
          schoolClasses(c)
            .filter((cl: any) => !classId || cl.id === classId)
            .map((cl: any) => cl.id),
        ),
        admin = schoolAdmin(c.user),
        student = c.user.role === "student",
        attendance = (c.db.attendanceRecords || []).filter(
          (r: any) =>
            scoped(c, r) &&
            ids.has(r.classId) &&
            r.date.startsWith(month) &&
            (!student || r.studentId === c.user.uid) &&
            (admin || student || !r.subject || r.subject === c.user.subject),
        ),
        assignments = (c.db.studentAssignments || []).filter((a: any) =>
          visible(c, a),
        ),
        submissions = (c.db.assignmentSubmissions || []).filter(
          (s: any) =>
            scoped(c, s) &&
            ids.has(s.classId) &&
            (!student || s.studentId === c.user.uid) &&
            assignments.some((a: any) => a.id === s.assignmentId) &&
            (s.submittedAt
              ? localDate(new Date(s.submittedAt))
              : s.assignedDate
            ).startsWith(month),
        );
      if (attendance.length + submissions.length > 10000)
        throw new SchoolError(413, "Hisobot katta. Bitta sinfni tanlang.");
      res.json({
        month,
        attendance,
        submissions,
        counts: {
          recordedLessons: attendance.length,
          present: attendance.filter((r: any) => r.status === "PRESENT").length,
          late: attendance.filter((r: any) => r.status === "LATE").length,
          absent: attendance.filter((r: any) => r.status === "ABSENT").length,
          excused: attendance.filter((r: any) => r.status === "EXCUSED_ABSENCE")
            .length,
          submissions: submissions.length,
          graded: submissions.filter((s: any) => s.status === "Tekshirildi")
            .length,
        },
        scope: student
          ? "Faqat o‘zim"
          : admin
            ? "Maktab sinflari"
            : "Biriktirilgan sinflar va fan. Fani ko‘rsatilmagan eski kunlik davomat alohida qayd hisoblanadi.",
      });
    }),
  );
  app.get(
    "/api/workspace",
    read((c: SchoolContext, req: any, res: any) => {
      const classes = schoolClasses(c),
        ids = new Set(classes.map((cl: any) => cl.id)),
        admin = schoolAdmin(c.user),
        student = c.user.role === "student",
        classId = String(req.query.classId || "");
      if (classId) classFor(c, classId);
      const students = c.db.users
        .filter(
          (u: any) =>
            u.role === "student" &&
            u.institutionId === c.user.institutionId &&
            ids.has(u.classId) &&
            (!classId || u.classId === classId) &&
            (!student || u.uid === c.user.uid),
        )
        .map((u: any) => ({
          id: u.uid,
          name: u.displayName,
          classId: u.classId,
          classCode: u.classCode,
          status: u.status,
          login: u.login,
        }));
      const lessonFilter = z
        .object({
          lessonPage: z.coerce.number().int().min(0).max(10000).default(0),
          lessonQ: z.string().max(100).default(""),
        })
        .safeParse(req.query);
      if (!lessonFilter.success)
        throw new SchoolError(400, "Dars qidiruvi yoki sahifasini tekshiring.");
      const lessons = c.db.lessons.filter(
        (l: any) =>
          scoped(c, l) &&
          [l.classId, ...(l.classIds || [])].some(
            (id: string) => ids.has(id) && (!classId || id === classId),
          ) &&
          (admin ||
            student ||
            [l.subject, l.subjectName].includes(c.user.subject)),
      );
      const assignments = (c.db.studentAssignments || []).filter(
        (a: any) =>
          visible(c, a) && (!classId || a.targetClassIds.includes(classId)),
      );
      const submissions = (c.db.assignmentSubmissions || []).filter(
        (s: any) =>
          scoped(c, s) &&
          assignments.some((a: any) => a.id === s.assignmentId) &&
          (!student || s.studentId === c.user.uid),
      );
      const attendance = (c.db.attendanceRecords || []).filter(
        (r: any) =>
          scoped(c, r) &&
          ids.has(r.classId) &&
          (!classId || r.classId === classId) &&
          (!student || r.studentId === c.user.uid) &&
          (admin || student || !r.subject || r.subject === c.user.subject),
      );
      const sessions = (c.db.attendanceSessions || []).filter(
        (r: any) =>
          scoped(c, r) &&
          ids.has(r.classId) &&
          (!classId || r.classId === classId) &&
          (admin || student || !r.subject || r.subject === c.user.subject),
      );
      const support = (c.db.studentSupportPlans || []).filter(
        (r: any) =>
          scoped(c, r) &&
          ids.has(r.classId) &&
          (!classId || r.classId === classId) &&
          (admin ||
            (student && r.studentId === c.user.uid) ||
            (!student && r.subject === c.user.subject)),
      );
      const materials = (c.db.learningMaterials || []).filter(
        (m: any) =>
          scoped(c, m) &&
          (m.targetClassCodes || []).some((code: string) =>
            classes.some(
              (cl: any) => cl.code === code && (!classId || cl.id === classId),
            ),
          ) &&
          (admin || student || m.subject === c.user.subject) &&
          (m.status === "published" || m.uploadedByUid === c.user.uid),
      );
      const announcements = (c.db.announcements || []).filter(
        (a: any) =>
          scoped(c, a) &&
          (a.audienceType === "entire_school" ||
            (a.targetClassCodes || []).some((code: string) =>
              classes.some(
                (cl: any) =>
                  cl.code === code && (!classId || cl.id === classId),
              ),
            )) &&
          (a.status === "published" || a.createdByUid === c.user.uid),
      );
      const today = localDate(c.now),
        weekday = new Date(today + "T12:00:00Z").getUTCDay(),
        timetables = (c.db.timetables || []).filter(
          (t: any) =>
            scoped(c, t) &&
            t.status === "active" &&
            t.effectiveFrom <= today &&
            (!t.effectiveTo || t.effectiveTo >= today),
        ),
        entries = (c.db.timetableEntries || []).filter(
          (e: any) =>
            scoped(c, e) &&
            ids.has(e.classId) &&
            (!classId || e.classId === classId) &&
            timetables.some((t: any) => t.id === e.timetableId) &&
            (admin ||
              student ||
              (e.teacherId
                ? e.teacherId === c.user.uid
                : e.subject === c.user.subject)),
        );
      const limit = (rows: any[]) =>
        rows
          .slice()
          .sort((a, b) =>
            String(b.updatedAt || b.createdAt || b.date || "").localeCompare(
              String(a.updatedAt || a.createdAt || a.date || ""),
            ),
          )
          .slice(0, 100);
      const workPlans = (c.db.workPlans || [])
        .filter(
          (p: any) =>
            scoped(c, p) &&
            [p.classId, ...(p.classIds || [])].some(
              (id: string) => ids.has(id) && (!classId || id === classId),
            ) &&
            (admin ||
              student ||
              [p.subject, p.subjectName].includes(c.user.subject)),
        )
        .map((p: any) => ({
          id: p.id,
          title: p.title,
          subject: p.subjectName || p.subject,
          academicYear: p.academicYear,
          status: p.status,
          totalLessons: p.totalLessons,
          totalHours: p.totalHours,
          quarterBreakdown: p.quarterBreakdown,
        }));
      const progress = (c.db.studentTopicProgress || [])
        .filter(
          (p: any) =>
            p.schoolId === c.user.institutionId &&
            students.some((s: any) => s.id === p.studentId) &&
            lessons.some((l: any) => l.id === p.lessonId),
        )
        .slice(0, 1000);
      res.json({
        feedbackTemplates: feedbackTemplates(c.db, c.user),
        workPlans,
        progress,
        classes: classes.map((cl: any) => ({ id: cl.id, code: cl.code })),
        students,
        subject: c.user.subject || "",
        today,
        time: c.now.toLocaleTimeString("en-GB", {
          timeZone: "Asia/Tashkent",
          hour: "2-digit",
          minute: "2-digit",
        }),
        timetable: entries,
        todaySchedule: entries
          .filter((e: any) => e.weekdayIndex === weekday)
          .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime)),
        lessons: lessons
          .filter(
            (l: any) =>
              !lessonFilter.data.lessonQ ||
              `${l.title || l.topicTitle || ""} ${l.subjectName || l.subject || ""}`
                .toLowerCase()
                .includes(lessonFilter.data.lessonQ.toLowerCase()),
          )
          .sort(
            (a: any, b: any) =>
              (a.quarter || 0) - (b.quarter || 0) ||
              (a.lessonNumber || a.orderIndex || 0) -
                (b.lessonNumber || b.orderIndex || 0) ||
              a.id.localeCompare(b.id),
          )
          .slice(
            lessonFilter.data.lessonPage * 100,
            lessonFilter.data.lessonPage * 100 + 100,
          ),
        lessonPagination: {
          page: lessonFilter.data.lessonPage,
          total: lessons.filter(
            (l: any) =>
              !lessonFilter.data.lessonQ ||
              `${l.title || l.topicTitle || ""} ${l.subjectName || l.subject || ""}`
                .toLowerCase()
                .includes(lessonFilter.data.lessonQ.toLowerCase()),
          ).length,
        },
        assignments: limit(assignments),
        submissions: limit(submissions),
        attendance: limit(attendance),
        attendanceSessions: limit(sessions),
        materials: limit(materials),
        announcements: limit(announcements),
        support: limit(support),
        counts: {
          students: students.length,
          lessons: lessons.length,
          delivered: lessons.filter((l: any) => l.schoolDeliveredAt).length,
          assignments: assignments.length,
          waiting: submissions.filter((s: any) =>
            ["Topshirildi", "Tekshirilmoqda"].includes(s.status),
          ).length,
          attendance: attendance.length,
          absent: attendance.filter(
            (a: any) => a.date === today && a.status === "ABSENT",
          ).length,
          support: support.filter((s: any) => s.status !== "Yakunlandi").length,
          materials: materials.length,
        },
        truncated: {
          lessons: lessons.length > 100,
          assignments: assignments.length > 100,
          submissions: submissions.length > 100,
          attendance: attendance.length > 100,
        },
        permissions: { admin, staff: !student },
      });
    }),
  );
  app.get(
    "/api/workspace/attendance",
    read((c: SchoolContext, req: any, res: any) => {
      const classId = String(req.query.classId || ""),
        date = String(req.query.date || ""),
        lessonNumber = Number(req.query.lessonNumber);
      classFor(c, classId);
      if (
        !validDate(date) ||
        !Number.isInteger(lessonNumber) ||
        lessonNumber < 1 ||
        lessonNumber > 12
      )
        throw new SchoolError(400, "Sana yoki dars raqamini tekshiring.");
      const id = schoolKey(
          "lesson",
          c.user.institutionId,
          classId,
          date,
          lessonNumber,
        ),
        session = (c.db.attendanceSessions || []).find((s: any) => s.id === id);
      if (
        session &&
        !schoolAdmin(c.user) &&
        c.user.role === "teacher" &&
        session.subject !== c.user.subject
      )
        throw new SchoolError(403, "Boshqa fan davomati.");
      res.json({
        session,
        rows: (c.db.attendanceRecords || []).filter(
          (r: any) =>
            r.sessionId === id &&
            scoped(c, r) &&
            (c.user.role !== "student" || r.studentId === c.user.uid),
        ),
      });
    }),
  );
  app.post(
    "/api/workspace/attendance",
    write(
      "lesson-attendance",
      base.extend({
        classId: z.string(),
        date,
        lessonId: z.string().optional(),
        lessonNumber: z.number().int().min(1).max(12),
        subject: text,
        revision: z.number().int().min(0),
        records: z
          .array(
            z.object({
              studentId: z.string(),
              status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED_ABSENCE"]),
              notes: z.string().max(1000).default(""),
            }),
          )
          .min(1)
          .max(100),
      }),
      (c: SchoolContext, d: any) => {
        staff(c);
        const cl = classFor(c, d.classId);
        subjectFor(c, d.subject);
        if (d.date > localDate(c.now))
          throw new SchoolError(400, "Kelajak davomatini qayd etib bo‘lmaydi.");
        if (d.lessonId) lessonFor(c, d.lessonId, d.classId);
        if (
          new Set(d.records.map((r: any) => r.studentId)).size !==
          d.records.length
        )
          throw new SchoolError(400, "Takrorlangan o‘quvchi.");
        d.records.forEach((r: any) => {
          const s = schoolStudent(c, r.studentId);
          if (s.classId !== cl.id)
            throw new SchoolError(403, "O‘quvchi bu sinfda emas.");
        });
        const id = schoolKey(
            "lesson",
            c.user.institutionId,
            cl.id,
            d.date,
            d.lessonNumber,
          ),
          sessions = ensureRows(c.db, "attendanceSessions"),
          old = sessions.find((s: any) => s.id === id);
        checkRevision(old?.revision || 0, d.revision);
        if (
          old &&
          !schoolAdmin(c.user) &&
          (old.subject !== c.user.subject || old.recordedByUid !== c.user.uid)
        )
          throw new SchoolError(403, "Boshqa ustoz davomatiga ruxsat yo‘q.");
        const before = old ? structuredClone(old) : null,
          rows = ensureRows(c.db, "attendanceRecords"),
          now = c.now.toISOString();
        for (const r of d.records) {
          const rid = schoolKey(id, r.studentId),
            s = schoolStudent(c, r.studentId),
            previous = rows.find((v: any) => v.id === rid),
            row = {
              ...previous,
              id: rid,
              sessionId: id,
              institutionId: c.user.institutionId,
              classId: cl.id,
              classCode: cl.code,
              studentId: s.uid,
              studentName: s.displayName,
              date: d.date,
              lessonId: d.lessonId,
              lessonNumber: d.lessonNumber,
              subject: d.subject,
              status: r.status,
              notes: r.notes,
              recordedByUid: c.user.uid,
              recordedByName: c.user.displayName,
              recordedAt: previous?.recordedAt || now,
              updatedAt: now,
            };
          if (previous) Object.assign(previous, row);
          else rows.push(row);
        }
        const all = rows.filter((r: any) => r.sessionId === id),
          count = (s: string) => all.filter((r: any) => r.status === s).length,
          row = {
            ...old,
            id,
            institutionId: c.user.institutionId,
            classId: cl.id,
            classCode: cl.code,
            date: d.date,
            lessonId: d.lessonId,
            lessonNumber: d.lessonNumber,
            subject: d.subject,
            revision: d.revision + 1,
            academicYear:
              c.db.academicYears?.find((y: any) => y.isActive)?.name || "",
            recordedByUid: c.user.uid,
            recordedByName: c.user.displayName,
            totalEnrolled: c.db.users.filter(
              (u: any) =>
                u.institutionId === c.user.institutionId &&
                u.classId === cl.id &&
                u.role === "student" &&
                u.status === "active",
            ).length,
            presentCount: count("PRESENT"),
            absentCount: count("ABSENT"),
            lateCount: count("LATE"),
            excusedCount: count("EXCUSED_ABSENCE"),
            attendancePercent: all.length
              ? Math.round(
                  ((count("PRESENT") + count("LATE")) / all.length) * 100,
                )
              : 0,
            createdAt: old?.createdAt || now,
            updatedAt: now,
          };
        if (old) Object.assign(old, row);
        else sessions.push(row);
        schoolAudit(c, "Dars davomati saqlandi", id, before, {
          ...row,
          records: all,
        });
        return row;
      },
    ),
  );
  const assignmentSchema = base.extend({
    id: z.string().optional(),
    revision: z.number().int().min(0),
    title: text,
    description: text,
    subject: text,
    classIds: z.array(z.string()).min(1).max(30),
    dueDate: date,
    maxScore: z.number().positive().max(1000),
    status: z.enum(["draft", "published", "closed"]),
    allowResubmission: z.boolean().default(true),
    relatedLessonId: z.string().optional(),
  });
  app.post(
    "/api/workspace/assignments",
    write(
      "workspace-assignment",
      assignmentSchema,
      (c: SchoolContext, d: any) => {
        staff(c);
        subjectFor(c, d.subject);
        const classes = d.classIds.map((id: string) => classFor(c, id));
        if (d.relatedLessonId)
          for (const cl of classes) lessonFor(c, d.relatedLessonId, cl.id);
        const rows = ensureRows(c.db, "studentAssignments"),
          old = d.id ? rows.find((a: any) => a.id === d.id) : undefined;
        if (d.id) owned(c, old);
        checkRevision(old?.revision || 0, d.revision);
        const before = old ? structuredClone(old) : null;
        if (
          old &&
          (c.db.assignmentSubmissions || []).some(
            (s: any) => s.assignmentId === old.id,
          ) &&
          (JSON.stringify(old.targetClassIds.slice().sort()) !==
            JSON.stringify([...new Set(d.classIds)].sort()) ||
            old.maxScore !== d.maxScore)
        )
          throw new SchoolError(
            409,
            "Topshirishlar bor. Sinf yoki maksimal ballni o‘zgartirish uchun vazifadan nusxa yarating.",
          );
        const now = c.now.toISOString(),
          row = {
            ...old,
            id: old?.id || crypto.randomUUID(),
            institutionId: c.user.institutionId,
            title: d.title,
            description: d.description,
            subject: d.subject,
            targetClassIds: [...new Set(d.classIds)],
            targetClassCodes: [...new Set(classes.map((cl: any) => cl.code))],
            assignedDate: old?.assignedDate || localDate(c.now),
            dueDate: d.dueDate,
            maxScore: d.maxScore,
            status: d.status,
            allowResubmission: d.allowResubmission,
            relatedLessonId: d.relatedLessonId,
            sourceType: d.relatedLessonId ? "lesson" : "custom",
            submissionType: "written_text",
            createdByUid: old?.createdByUid || c.user.uid,
            createdByName: old?.createdByName || c.user.displayName,
            createdAt: old?.createdAt || now,
            updatedAt: now,
            revision: d.revision + 1,
          };
        if (old) Object.assign(old, row);
        else rows.push(row);
        schoolAudit(c, "Vazifa saqlandi", row.id, before, row);
        const inbox = ensureRows(c.db, "notifications");
        for (const n of inbox)
          if (
            n.institutionId === c.user.institutionId &&
            n.reminderAssignmentId === row.id
          )
            n.cancelled = true;
        if (row.status === "published")
          for (const student of c.db.users.filter(
            (s: any) =>
              s.institutionId === c.user.institutionId &&
              s.role === "student" &&
              s.status === "active" &&
              row.targetClassIds.includes(s.classId),
          )) {
            notify(
              c,
              student.uid,
              "Yangi o‘quv vazifasi",
              "/student/workspace/assignments",
              row.id + ":" + row.revision,
            );
            if (row.dueDate >= localDate(c.now))
              inbox.push({
                id: schoolKey(
                  c.user.institutionId,
                  student.uid,
                  "due",
                  row.id,
                  row.revision,
                ),
                institutionId: c.user.institutionId,
                recipientUid: student.uid,
                title: "Vazifa muddati bugun",
                message:
                  "Vazifalaringiz bo‘limini ochib, topshirish holatini tekshiring.",
                link: "/student/workspace/assignments",
                deliverOn: row.dueDate,
                reminderAssignmentId: row.id,
                cancelled: false,
                createdAt: c.now.toISOString(),
                read: false,
              });
          }
        return row;
      },
    ),
  );
  app.post(
    "/api/workspace/submissions",
    write(
      "workspace-submission",
      base.extend({
        assignmentId: z.string(),
        revision: z.number().int().min(0),
        content: z.string().max(20000),
        submit: z.boolean(),
      }),
      (c: SchoolContext, d: any) => {
        if (c.user.role !== "student")
          throw new SchoolError(403, "Faqat o‘quvchi topshiradi.");
        const a = assignmentFor(c, d.assignmentId);
        if (a.status !== "published")
          throw new SchoolError(409, "Vazifa hozir ochiq emas.");
        if (d.submit && !d.content.trim())
          throw new SchoolError(400, "Javob kiriting.");
        const rows = ensureRows(c.db, "assignmentSubmissions"),
          id = schoolKey(a.id, c.user.uid),
          old = rows.find(
            (s: any) => s.assignmentId === a.id && s.studentId === c.user.uid,
          );
        checkRevision(old?.revision || 0, d.revision);
        if (old && !a.allowResubmission && old.submittedAt)
          throw new SchoolError(409, "Qayta topshirishga ruxsat berilmagan.");
        const before = old ? structuredClone(old) : null,
          now = c.now.toISOString();
        if (old?.submittedAt && d.submit)
          ensureRows(c.db, "submissionRevisions").push({
            ...structuredClone(old),
            id: crypto.randomUUID(),
            submissionId: old.id,
            revisionNumber: old.attemptCount,
            statusAtArchive: old.status,
          });
        const row = {
          ...old,
          id: old?.id || id,
          institutionId: c.user.institutionId,
          assignmentId: a.id,
          assignmentTitle: a.title,
          studentId: c.user.uid,
          studentName: c.user.displayName,
          classId: c.user.classId,
          classCode: c.user.classCode,
          assignedDate: a.assignedDate,
          dueDate: a.dueDate,
          maxScore: a.maxScore,
          status: d.submit
            ? "Topshirildi"
            : old?.submittedAt
              ? old.status
              : "Jarayonda",
          content: d.submit ? d.content : old?.content,
          draftContent: d.content,
          draftSavedAt: now,
          submittedAt: d.submit ? now : old?.submittedAt,
          attemptCount: (old?.attemptCount || 0) + (d.submit ? 1 : 0),
          revision: d.revision + 1,
          updatedAt: now,
          createdAt: old?.createdAt || now,
          ...(d.submit
            ? {
                score: undefined,
                feedback: undefined,
                gradedAt: undefined,
                gradedByUid: undefined,
              }
            : {}),
        };
        if (old) Object.assign(old, row);
        else rows.push(row);
        schoolAudit(
          c,
          d.submit ? "Yozma ish topshirildi" : "Yozma ish qoralamasi",
          row.id,
          before,
          { status: row.status, revision: row.revision },
        );
        if (d.submit)
          notify(
            c,
            a.createdByUid,
            "Tekshirish uchun yangi ish",
            "/teacher/workspace/grading",
            row.id + ":" + row.revision,
          );
        return row;
      },
    ),
  );
  app.post(
    "/api/workspace/grading",
    write(
      "workspace-grading",
      base.extend({
        submissionId: z.string(),
        revision: z.number().int(),
        score: z.number().min(0).max(1000),
        feedback: text,
        returnForRevision: z.boolean().default(false),
      }),
      (c: SchoolContext, d: any) => {
        staff(c);
        const s = (c.db.assignmentSubmissions || []).find(
          (s: any) => s.id === d.submissionId && scoped(c, s),
        );
        if (!s) throw new SchoolError(403, "Ishga ruxsat yo‘q.");
        assignmentFor(c, s.assignmentId);
        schoolStudent(c, s.studentId);
        checkRevision(s.revision || 0, d.revision);
        if (!s.submittedAt || d.score > s.maxScore)
          throw new SchoolError(
            400,
            "Topshirilgan ish va uning maksimal ballini tekshiring.",
          );
        const before = structuredClone(s);
        Object.assign(s, {
          score: d.score,
          feedback: d.feedback,
          status: d.returnForRevision ? "Qaytarildi" : "Tekshirildi",
          gradedByUid: c.user.uid,
          gradedByName: c.user.displayName,
          gradedAt: c.now.toISOString(),
          updatedAt: c.now.toISOString(),
          revision: (s.revision || 0) + 1,
        });
        schoolAudit(c, "Yozma ish inson tomonidan baholandi", s.id, before, s);
        notify(
          c,
          s.studentId,
          "Vazifangiz bo‘yicha fikr tayyor",
          "/student/assignments",
          s.id + ":graded:" + s.revision,
        );
        return s;
      },
    ),
  );
  app.post(
    "/api/workspace/support",
    write(
      "workspace-support",
      base.extend({
        id: z.string().optional(),
        revision: z.number().int().min(0),
        studentId: z.string(),
        subject: text,
        topic: text,
        observedNeed: text,
        goal: text,
        recommendedActivity: text,
        reviewDate: date,
        status: z.enum(["Yangi", "Jarayonda", "Yakunlandi"]),
        progressNotes: z.string().max(4000).default(""),
      }),
      (c: SchoolContext, d: any) => {
        staff(c);
        const s = schoolStudent(c, d.studentId);
        subjectFor(c, d.subject);
        const rows = ensureRows(c.db, "studentSupportPlans"),
          old = d.id ? rows.find((s: any) => s.id === d.id) : undefined;
        if (d.id) owned(c, old);
        if (old && old.studentId !== s.uid)
          throw new SchoolError(400, "O‘quvchini o‘zgartirib bo‘lmaydi.");
        checkRevision(old?.revision || 0, d.revision);
        const before = old ? structuredClone(old) : null,
          now = c.now.toISOString(),
          row = {
            ...old,
            ...d,
            id: old?.id || crypto.randomUUID(),
            operationId: undefined,
            institutionId: c.user.institutionId,
            studentName: s.displayName,
            classId: s.classId,
            classCode: s.classCode,
            createdByUid: old?.createdByUid || c.user.uid,
            createdByName: old?.createdByName || c.user.displayName,
            createdAt: old?.createdAt || now,
            updatedAt: now,
            revision: d.revision + 1,
          };
        if (old) Object.assign(old, row);
        else rows.push(row);
        schoolAudit(c, "Yordam rejasi saqlandi", row.id, before, row);
        notify(
          c,
          s.uid,
          "Shaxsiy o‘quv tavsiyasi",
          "/student/workspace/support",
          row.id + ":" + row.revision,
        );
        return row;
      },
    ),
  );
  app.post(
    "/api/workspace/materials",
    write(
      "workspace-material",
      base.extend({
        id: z.string().optional(),
        revision: z.number().int().min(0),
        title: text,
        description: text,
        subject: text,
        classIds: z.array(z.string()).min(1).max(30),
        fileUrl: link,
        materialType: z.enum([
          "pdf",
          "docx",
          "pptx",
          "xlsx",
          "jpeg",
          "png",
          "webp",
          "video_link",
        ]),
        quarter: z.number().int().min(1).max(4),
        folder: text,
        status: z.enum(["published", "archived"]),
      }),
      (c: SchoolContext, d: any) => {
        staff(c);
        subjectFor(c, d.subject);
        const classes = d.classIds.map((id: string) => classFor(c, id)),
          rows = ensureRows(c.db, "learningMaterials"),
          old = d.id ? rows.find((m: any) => m.id === d.id) : undefined;
        if (d.id) owned(c, old);
        checkRevision(old?.revision || 0, d.revision);
        const before = old ? structuredClone(old) : null,
          now = c.now.toISOString(),
          row = {
            ...old,
            id: old?.id || crypto.randomUUID(),
            institutionId: c.user.institutionId,
            title: d.title,
            description: d.description,
            subject: d.subject,
            targetClassCodes: classes.map((cl: any) => cl.code),
            fileUrl: d.fileUrl,
            materialType: d.materialType,
            quarter: d.quarter,
            folder: d.folder,
            status: d.status,
            grade:
              classes[0].grade ||
              Number(String(classes[0].code).match(/\d+/)?.[0]) ||
              0,
            allowDownload: true,
            uploadedByUid: old?.uploadedByUid || c.user.uid,
            uploadedByName: old?.uploadedByName || c.user.displayName,
            createdAt: old?.createdAt || now,
            updatedAt: now,
            revision: d.revision + 1,
          };
        if (old) Object.assign(old, row);
        else rows.push(row);
        schoolAudit(c, "Material saqlandi", row.id, before, row);
        return row;
      },
    ),
  );
  app.post(
    "/api/workspace/announcements",
    write(
      "workspace-announcement",
      base.extend({
        id: z.string().optional(),
        revision: z.number().int().min(0),
        title: text,
        content: text,
        classIds: z.array(z.string()).min(1).max(30),
        priority: z.enum(["normal", "high", "urgent"]),
        status: z.enum(["published", "archived"]),
      }),
      (c: SchoolContext, d: any) => {
        staff(c);
        const classes = d.classIds.map((id: string) => classFor(c, id)),
          rows = ensureRows(c.db, "announcements"),
          old = d.id ? rows.find((m: any) => m.id === d.id) : undefined;
        if (d.id) owned(c, old);
        checkRevision(old?.revision || 0, d.revision);
        const before = old ? structuredClone(old) : null,
          now = c.now.toISOString(),
          row = {
            ...old,
            id: old?.id || crypto.randomUUID(),
            institutionId: c.user.institutionId,
            title: d.title,
            shortContent: d.content.slice(0, 200),
            content: d.content,
            type: "academic",
            audienceType: "specific_classes",
            targetClassCodes: classes.map((cl: any) => cl.code),
            targetSubjects: [c.user.subject].filter(Boolean),
            priority: d.priority,
            status: d.status,
            requiresAcknowledgment: false,
            publicationDate: localDate(c.now),
            createdByUid: old?.createdByUid || c.user.uid,
            createdByName: old?.createdByName || c.user.displayName,
            createdAt: old?.createdAt || now,
            updatedAt: now,
            revision: d.revision + 1,
          };
        if (old) Object.assign(old, row);
        else rows.push(row);
        schoolAudit(c, "Sinf e’loni saqlandi", row.id, before, row);
        if (row.status === "published")
          for (const student of c.db.users.filter(
            (u: any) =>
              u.institutionId === c.user.institutionId &&
              u.role === "student" &&
              u.status === "active" &&
              row.targetClassCodes.includes(u.classCode),
          ))
            notify(
              c,
              student.uid,
              "Sinfingiz uchun yangi e’lon",
              "/student/workspace/announcements",
              row.id + ":" + row.revision,
            );
        return row;
      },
    ),
  );
  app.get(
    "/api/workspace/student/:id",
    read((c: SchoolContext, req: any, res: any) => {
      staff(c);
      const s = schoolStudent(c, String(req.params.id)),
        ownSubject = (r: any) =>
          schoolAdmin(c.user) || r.subject === c.user.subject;
      const assignments = (c.db.studentAssignments || []).filter(
        (a: any) => visible(c, a) && a.targetClassIds.includes(s.classId),
      );
      const discipline = (c.db.disciplineRecords || []).filter(
        (r: any) =>
          r.studentId === s.uid &&
          canReadDiscipline(c, r) &&
          r.status === "approved",
      );
      const lessonIds = new Set(
          c.db.lessons
            .filter(
              (l: any) =>
                scoped(c, l) &&
                [l.classId, ...(l.classIds || [])].includes(s.classId) &&
                (schoolAdmin(c.user) ||
                  [l.subject, l.subjectName].includes(c.user.subject)),
            )
            .map((l: any) => l.id),
        ),
        learningResults = [
          ...(c.db.topicSessions || [])
            .filter(
              (r: any) =>
                scoped(c, r) &&
                r.studentId === s.uid &&
                r.submittedAt &&
                lessonIds.has(r.lessonId || r.questions?.[0]?.lessonId),
            )
            .map((r: any) => ({
              id: r.id,
              title: r.title || "Mavzu testi",
              kind: "Mavzu mashqi",
              submittedAt: r.submittedAt,
              pending: r.pending,
              scorePercent: r.pending
                ? null
                : r.maxScore
                  ? Math.round(((r.score || 0) / r.maxScore) * 100)
                  : null,
            })),
          ...(c.db.attempts || [])
            .filter(
              (r: any) =>
                scoped(c, r) &&
                r.studentId === s.uid &&
                c.db.assessments.some(
                  (a: any) =>
                    a.id === r.assessmentId &&
                    scoped(c, a) &&
                    (schoolAdmin(c.user) || a.subject === c.user.subject),
                ),
            )
            .map((r: any) => ({
              id: r.id,
              title: r.assessmentTitle,
              kind: "Nazorat / baholash",
              submittedAt: r.submittedAt,
              pending: r.status === "pending_manual_review",
              scorePercent:
                r.status === "pending_manual_review" ? null : r.scorePercent,
            })),
        ]
          .sort((a: any, b: any) => b.submittedAt.localeCompare(a.submittedAt))
          .slice(0, 100);
      const oldest = new Date(localDate(c.now) + "T12:00:00Z");
      oldest.setUTCDate(oldest.getUTCDate() - 13);
      const firstDay = oldest.toISOString().slice(0, 10),
        today = localDate(c.now),
        trend = new Map<
          string,
          { day: string; total: number; wrong: number }
        >();
      for (const r of c.db.spacedReviewAnswers || [])
        if (
          r.schoolId === c.user.institutionId &&
          r.studentId === s.uid &&
          lessonIds.has(r.lessonId) &&
          r.day >= firstDay &&
          r.day <= today &&
          typeof r.correct === "boolean"
        ) {
          const day = trend.get(r.day) || { day: r.day, total: 0, wrong: 0 };
          day.total++;
          if (!r.correct) day.wrong++;
          trend.set(r.day, day);
        }
      res.json({
        learningResults,
        errorTrend: [...trend.values()].sort((a, b) =>
          a.day.localeCompare(b.day),
        ),
        discipline: {
          approved: discipline.length,
          points: discipline.reduce((n: number, r: any) => n + r.points, 0),
          scope:
            "Faqat ko‘rishga ruxsat berilgan tasdiqlangan holatlar; bu global intizom balansi emas.",
        },
        mistakes: (c.db.mistakeRecords || []).filter(
          (r: any) =>
            r.schoolId === c.user.institutionId &&
            r.studentId === s.uid &&
            r.state !== "mastered" &&
            ownSubject(r),
        ).length,
        student: { id: s.uid, name: s.displayName, classCode: s.classCode },
        attendance: (c.db.attendanceRecords || [])
          .filter(
            (r: any) => scoped(c, r) && r.studentId === s.uid && ownSubject(r),
          )
          .slice(-100),
        support: (c.db.studentSupportPlans || []).filter(
          (r: any) => scoped(c, r) && r.studentId === s.uid && ownSubject(r),
        ),
        submissions: (c.db.assignmentSubmissions || [])
          .filter(
            (r: any) =>
              scoped(c, r) &&
              r.studentId === s.uid &&
              assignments.some((a: any) => a.id === r.assignmentId),
          )
          .slice(-100),
        progress: (c.db.studentTopicProgress || [])
          .filter(
            (r: any) =>
              r.schoolId === c.user.institutionId &&
              r.studentId === s.uid &&
              (schoolAdmin(c.user) ||
                c.db.lessons.some(
                  (l: any) =>
                    l.id === r.lessonId &&
                    lessonIds.has(l.id) &&
                    scoped(c, l) &&
                    [l.subject, l.subjectName].includes(c.user.subject),
                )),
          )
          .slice(-100)
          .map((r: any) => ({
            ...r,
            lessonTitle: c.db.lessons.find(
              (l: any) => l.id === r.lessonId && scoped(c, l),
            )?.title,
          })),
      });
    }),
  );
  app.get(
    "/api/workspace/notifications",
    read((c: SchoolContext, req: any, res: any) => {
      const day = localDate(c.now);
      const page = Math.max(0, Math.min(10000, Number(req.query.page) || 0)),
        rows = (c.db.notifications || [])
          .filter(
            (n: any) =>
              n.institutionId === c.user.institutionId &&
              n.recipientUid === c.user.uid &&
              deliveredNotification(n, day),
          )
          .slice()
          .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
      res.json({
        rows: rows.slice(page * 20, page * 20 + 20),
        visibleIds: rows.map((n: any) => n.id),
        total: rows.length,
        unread: rows.filter((n: any) => !n.read).length,
        page,
      });
    }),
  );
  app.post(
    "/api/workspace/notifications/read",
    write(
      "notification-read",
      base.extend({
        id: z.string().optional(),
        all: z.boolean().default(false),
      }),
      (c: SchoolContext, d: any) => {
        const day = localDate(c.now);
        const rows = (c.db.notifications || []).filter(
          (n: any) =>
            n.institutionId === c.user.institutionId &&
            n.recipientUid === c.user.uid &&
            deliveredNotification(n, day) &&
            (d.all || n.id === d.id),
        );
        rows.forEach((n: any) => {
          n.read = true;
        });
        return { id: d.id || "all", count: rows.length };
      },
    ),
  );
  function notify(
    c: SchoolContext,
    uid: string,
    title: string,
    href: string,
    source: string,
  ) {
    const rows = ensureRows(c.db, "notifications"),
      id = schoolKey(c.user.institutionId, uid, source);
    if (!rows.some((r: any) => r.id === id))
      rows.push({
        id,
        institutionId: c.user.institutionId,
        recipientUid: uid,
        title,
        message: "Shaxsiy bo‘limingizda tafsilotlarni ko‘ring.",
        link: href,
        createdAt: c.now.toISOString(),
        read: false,
      });
  }
}
