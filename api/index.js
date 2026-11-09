// server.ts
import nodeCrypto from "node:crypto";

// src/server/practiceRoutes.ts
import crypto from "node:crypto";
import { z } from "zod";
function registerPracticeRoutes(app2, deps) {
  const access = (req) => {
    const c = deps.authenticate(req), lesson = c?.db.lessons.find((l) => l.id === req.params.id);
    if (!c || !lesson || c.user.role !== "student" || c.user.status !== "active" || lesson.institutionId !== c.user.institutionId || lesson.status !== "published" || ![lesson.classId, ...lesson.classIds || []].includes(c.user.classId) || lesson.additionalCurriculumAssignment && lesson.tTrackVisibilityApproved !== true) return null;
    return { ...c, lesson };
  };
  app2.get("/api/lesson-practice/:id", (req, res) => {
    const c = access(req);
    if (!c) return res.status(403).json({ error: "Darsga ruxsat yo\u2018q." });
    const record = c.db.lessonPracticeResponses?.find((r) => r.studentId === c.user.uid && r.lessonId === c.lesson.id);
    res.json({ savedAnswers: record && record.status !== "draft" ? record.answers : void 0, draftAnswers: record?.status === "draft" ? record.answers : void 0, revision: record?.revision || 0, title: c.lesson.title, questions: [`\xAB${c.lesson.title}\xBB mavzusidagi asosiy qoida yoki tushunchani o\u2018z so\u2018zingiz bilan tushuntiring.`, `Shu mavzuga oid bitta misol keltiring va yechimingizni bosqichma-bosqich izohlang.`], mode: "reflection", notice: "Yozma takrorlash mashqi. Avtomatik baholanmaydi. Qoralama hisobingizga saqlanadi." });
  });
  const write6 = (submit) => (req, res) => {
    const c = access(req);
    if (!c) return res.status(403).json({ error: "Darsga ruxsat yo\u2018q." });
    const parsed = z.array(z.string().max(1e4)).length(2).safeParse(req.body.answers);
    if (!parsed.success || submit && parsed.data.some((a) => a.trim().length < 3)) return res.status(400).json({ error: "Javoblar shakli yoki uzunligi noto\u2018g\u2018ri." });
    c.db.lessonPracticeResponses ||= [];
    let record = c.db.lessonPracticeResponses.find((r) => r.studentId === c.user.uid && r.lessonId === c.lesson.id);
    if (record && record.status !== "draft") return res.status(submit ? 200 : 409).json(submit ? { id: record.id, status: "received" } : { error: "Ish allaqachon topshirilgan." });
    if ((req.body.revision ?? 0) !== (record?.revision || 0)) return res.status(409).json({ error: "Qoralama boshqa oynada yangilangan. Mashqni qayta oching." });
    if (!record) {
      record = { id: crypto.randomUUID(), lessonId: c.lesson.id, studentId: c.user.uid, institutionId: c.user.institutionId, answers: [], status: "draft", revision: 0 };
      c.db.lessonPracticeResponses.push(record);
    }
    record.answers = parsed.data;
    record.revision = (record.revision || 0) + 1;
    record.status = submit ? "submitted" : "draft";
    record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (submit) record.submittedAt = record.updatedAt;
    deps.save(c.env, c.db);
    res.json({ id: record.id, status: submit ? "received" : "draft", revision: record.revision });
  };
  app2.put("/api/lesson-practice/:id", write6(false));
  app2.post("/api/lesson-practice/:id", write6(true));
}

// src/server/teachingRoutes.ts
import crypto2 from "node:crypto";
import { z as z2 } from "zod";
var deliveredForClass = (lesson, classId) => !lesson.schoolUndeliveredClassIds?.includes(classId) && Boolean(lesson.schoolDeliveredAt || lesson.schoolDeliveredClassIds?.includes(classId));
var teacherClasses = (user, db) => db.classes.filter((c) => c.institutionId === user.institutionId && user.assignedClassIds?.includes(c.id));
function registerTeachingRoutes(app2, deps) {
  registerPracticeRoutes(app2, deps);
  const admin = (c) => c && ["admin", "platform_owner"].includes(c.user.role) && c.user.platformAdmin === true && c.user.emailVerified === true;
  const schema = z2.object({ displayName: z2.string().trim().min(3).max(120), email: z2.email().max(180).transform((v) => v.toLowerCase()), password: z2.string().min(12).max(128), subject: z2.string().min(2).max(100), classIds: z2.array(z2.string()).min(1).max(19) });
  app2.post("/api/teaching/accounts", (req, res) => {
    const c = deps.authenticate(req);
    if (!admin(c)) return res.status(403).json({ error: "Faqat administrator." });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    const p = parsed.data;
    if (c.db.users.some((u) => u.email.toLowerCase() === p.email)) return res.status(409).json({ error: "Bu email band." });
    if (p.classIds.some((id) => !c.db.classes.some((cls) => cls.id === id && cls.institutionId === c.user.institutionId))) return res.status(400).json({ error: "Sinf mos emas." });
    const user = { uid: crypto2.randomUUID(), displayName: p.displayName, email: p.email, role: "teacher", status: "active", institutionId: c.user.institutionId, assignedClassIds: [...new Set(p.classIds)], subject: p.subject, createdAt: (/* @__PURE__ */ new Date()).toISOString(), platformAdmin: false, emailVerified: false };
    c.db.users.push(user);
    c.db.passwordHashes[user.uid] = deps.hash(p.password);
    deps.save(c.env, c.db);
    res.status(201).json({ user });
  });
  app2.patch("/api/teaching/accounts/:id", (req, res) => {
    const c = deps.authenticate(req);
    if (!admin(c)) return res.status(403).json({ error: "Faqat administrator." });
    const user = c.db.users.find((u) => u.uid === req.params.id && u.role === "teacher" && u.institutionId === c.user.institutionId);
    if (!user) return res.status(404).json({ error: "Hisob topilmadi." });
    if (req.body.password !== void 0) {
      const parsed = z2.string().min(12).max(128).safeParse(req.body.password);
      if (!parsed.success) return res.status(400).json({ error: "Parol kamida 12 belgi bo\u2018lsin." });
      c.db.passwordHashes[user.uid] = deps.hash(parsed.data);
      deps.revoke(user.uid, c.env);
      deps.save(c.env, c.db);
      return res.json({ user });
    }
    if (!["active", "suspended"].includes(req.body.status)) return res.status(400).json({ error: "Holat noto\u2018g\u2018ri." });
    user.status = req.body.status;
    deps.revoke(user.uid, c.env);
    deps.save(c.env, c.db);
    res.json({ user });
  });
  app2.post("/api/teaching/quarter/complete", (req, res) => {
    const c = deps.authenticate(req);
    if (!admin(c)) return res.status(403).json({ error: "Faqat administrator." });
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let count = 0;
    for (const lesson of c.db.lessons) if (lesson.institutionId === c.user.institutionId && lesson.academicYear === c.db.institutions.find((i) => i.id === c.user.institutionId)?.academicYear && lesson.quarter === 1 && lesson.status !== "archived" && !lesson.schoolDeliveredAt) {
      lesson.schoolDeliveredAt = now;
      count++;
    }
    deps.save(c.env, c.db);
    res.json({ count });
  });
  app2.post("/api/teaching/lessons/:id/delivered", (req, res) => {
    const c = deps.authenticate(req);
    if (!c) return res.status(401).json({ error: "Hisobga kiring." });
    const lesson = c.db.lessons.find((l) => l.id === req.params.id && l.institutionId === c.user.institutionId);
    if (!lesson || !admin(c) && !(c.user.role === "teacher" && teacherClasses(c.user, c.db).some((cls) => [lesson.classId, ...lesson.classIds || []].includes(cls.id)) && lesson.subjectName === c.user.subject)) return res.status(403).json({ error: "Darsga ruxsat yo\u2018q." });
    if (req.body.delivered !== void 0 && typeof req.body.delivered !== "boolean") return res.status(400).json({ error: "Belgi noto\u2018g\u2018ri." });
    const delivered = req.body.delivered !== false, now = (/* @__PURE__ */ new Date()).toISOString();
    if (admin(c)) {
      lesson.schoolDeliveredAt = delivered ? now : void 0;
      if (!delivered) lesson.schoolDeliveredClassIds = [];
      lesson.schoolUndeliveredClassIds = [];
    } else {
      const allowed = teacherClasses(c.user, c.db).map((cls) => cls.id).filter((id) => [lesson.classId, ...lesson.classIds || []].includes(id));
      lesson.schoolDeliveredClassIds = delivered ? [.../* @__PURE__ */ new Set([...lesson.schoolDeliveredClassIds || [], ...allowed])] : (lesson.schoolDeliveredClassIds || []).filter((id) => !allowed.includes(id));
      lesson.schoolUndeliveredClassIds = delivered ? (lesson.schoolUndeliveredClassIds || []).filter((id) => !allowed.includes(id)) : [.../* @__PURE__ */ new Set([...lesson.schoolUndeliveredClassIds || [], ...allowed])];
    }
    lesson.updatedAt = now;
    deps.save(c.env, c.db);
    res.json({ lesson });
  });
}

// src/server/examMedia.ts
import { getFirestore } from "firebase-admin/firestore";
import crypto5 from "node:crypto";

// src/server/firebaseAdminAuth.ts
import crypto4 from "crypto";
import fs2 from "fs";
import path2 from "path";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// src/constants/curriculum.ts
var PLATFORM_OWNER_EMAIL = "asilbeknuraliyev43@gmail.com";
var SECOND_PLATFORM_ADMIN_EMAIL = "bahodirboliqulov3@gmail.com";
var AUTHORIZED_ADMIN_EMAILS = [
  PLATFORM_OWNER_EMAIL,
  SECOND_PLATFORM_ADMIN_EMAIL
];
var DEFAULT_INSTITUTION_ID = "inst-specialized-study";
var A_TRACK_CLASS_CODES = [
  "5a1",
  "5a2",
  "6a1",
  "6a2",
  "7a1",
  "7a2",
  "8a1",
  "8a2",
  "9a1",
  "9a2",
  "10a1",
  "10a2",
  "11a1",
  "11a2"
];
var T_TRACK_CLASS_CODES = [
  "7t",
  "8t",
  "9t",
  "10t",
  "11t"
];
var OFFICIAL_19_CLASS_CODES = [
  "5a1",
  "5a2",
  "6a1",
  "6a2",
  "7a1",
  "7a2",
  "7t",
  "8a1",
  "8a2",
  "8t",
  "9a1",
  "9a2",
  "9t",
  "10a1",
  "10a2",
  "10t",
  "11a1",
  "11a2",
  "11t"
];
function normalizeClassCodeInput(rawCode) {
  if (rawCode === void 0 || rawCode === null) return null;
  const cyrillicNormalized = String(rawCode).trim().toLowerCase().replace(/sinf|класс|class/gi, "").replace(/а/g, "a").replace(/т/g, "t").replace(/[-\s_."'`«»()]/g, "");
  if (OFFICIAL_19_CLASS_CODES.includes(cyrillicNormalized)) {
    return cyrillicNormalized;
  }
  return null;
}
function parseOfficialClassCode(rawCode) {
  const clean = normalizeClassCodeInput(rawCode);
  if (!clean) {
    return null;
  }
  const match = clean.match(/^(5|6|7|8|9|10|11)(a1|a2|t)$/);
  if (!match) return null;
  const grade = Number(match[1]);
  const suffix = match[2];
  const track = suffix.startsWith("a") ? "A" : "T";
  const trackLabel = track === "A" ? "Aniq fanlar" : "Tabiiy fanlar";
  const section = suffix === "t" ? "t" : suffix.slice(1);
  return {
    code: clean,
    grade,
    track,
    trackLabel,
    section
  };
}
var DEFAULT_SUBJECTS = [
  {
    id: "subj-matematika",
    institutionId: "global",
    name: "Matematika",
    code: "MAT",
    grade: 8,
    applicableGrades: [5, 6, 7, 8, 9, 10, 11],
    trackTypes: ["A"],
    applicableClassCodes: [...A_TRACK_CLASS_CODES],
    description: "Aniq fanlar yo\u2018nalishi (A-track: 5a1\u201311a2) uchun matematika, algebra va geometriya kursi.",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "subj-ingliz-tili",
    institutionId: "global",
    name: "Ingliz tili",
    code: "ENG",
    grade: 8,
    applicableGrades: [5, 6, 7, 8, 9, 10, 11],
    trackTypes: ["A", "T"],
    applicableClassCodes: [...OFFICIAL_19_CLASS_CODES],
    description: "Aniq va Tabiiy fanlar yo\u2018nalishlaridagi barcha 19 ta sinf uchun ingliz tili kursi.",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "subj-fizika",
    institutionId: "global",
    name: "Fizika",
    code: "PHY",
    grade: 8,
    applicableGrades: [5, 6, 7, 8, 9, 10, 11],
    trackTypes: ["A"],
    applicableClassCodes: [...A_TRACK_CLASS_CODES],
    description: "Aniq fanlar yo\u2018nalishi (A-track: 5a1\u201311a2) uchun fizika va amaliy mexanika kursi.",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "subj-biologiya",
    institutionId: "global",
    name: "Biologiya",
    code: "BIO",
    grade: 7,
    applicableGrades: [7, 8, 9, 10, 11],
    trackTypes: ["T"],
    applicableClassCodes: [...T_TRACK_CLASS_CODES],
    description: "Tabiiy fanlar yo\u2018nalishi (T-track: 7t\u201311t) uchun biologiya va genetika kursi.",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "subj-kimyo",
    institutionId: "global",
    name: "Kimyo",
    code: "CHM",
    grade: 7,
    applicableGrades: [7, 8, 9, 10, 11],
    trackTypes: ["T"],
    applicableClassCodes: [...T_TRACK_CLASS_CODES],
    description: "Tabiiy fanlar yo\u2018nalishi (T-track: 7t\u201311t) uchun umumiy, noorganik va organik kimyo kursi.",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];
function getDefaultSubjectsForTrack(track) {
  const matched = DEFAULT_SUBJECTS.filter((s) => s.trackTypes.includes(track));
  return {
    subjectIds: matched.map((s) => s.id),
    subjectNames: matched.map((s) => s.name)
  };
}
function isSubjectCompatibleWithClass(subjectNameOrId, classCodeOrRoom, subjectsList = DEFAULT_SUBJECTS) {
  const code = typeof classCodeOrRoom === "string" ? classCodeOrRoom.trim().toLowerCase() : (classCodeOrRoom.code || classCodeOrRoom.name || "").trim().toLowerCase();
  const parsed = parseOfficialClassCode(code);
  const normSubj = String(subjectNameOrId || "").trim().toLowerCase();
  const subjObj = subjectsList.find(
    (s) => s.id.toLowerCase() === normSubj || s.name.toLowerCase() === normSubj || s.code && s.code.toLowerCase() === normSubj
  );
  if (!parsed || !subjObj) {
    return { compatible: true };
  }
  if (Array.isArray(subjObj.applicableClassCodes) && subjObj.applicableClassCodes.length > 0 && !subjObj.applicableClassCodes.map((c) => c.toLowerCase()).includes(parsed.code)) {
    return {
      compatible: false,
      reason: `"${subjObj.name}" fani ${parsed.code} (${parsed.trackLabel}) sinfi yo\u2018nalishiga biriktirilmagan.`
    };
  }
  if (Array.isArray(subjObj.trackTypes) && subjObj.trackTypes.length > 0 && !subjObj.trackTypes.includes(parsed.track)) {
    return {
      compatible: false,
      reason: `"${subjObj.name}" fani faqat ${subjObj.trackTypes.join("/")} yo\u2018nalishi uchun mo\u2018ljallangan (${parsed.code} sinfi ${parsed.track} yo\u2018nalishida).`
    };
  }
  return { compatible: true };
}
function buildOfficial19Classes(institutionId = DEFAULT_INSTITUTION_ID, academicYear = "2026-2027", adminUid = "admin-owner") {
  const nowIso = "2026-01-01T00:00:00.000Z";
  return OFFICIAL_19_CLASS_CODES.map((code) => {
    const meta = parseOfficialClassCode(code);
    const { subjectIds, subjectNames } = getDefaultSubjectsForTrack(meta.track);
    const primarySubject = meta.track === "A" ? "Matematika" : "Biologiya";
    const inviteCode = `SS-${code.toUpperCase()}-2026`;
    return {
      id: `class-${code}`,
      code,
      name: code,
      grade: meta.grade,
      track: meta.track,
      trackLabel: meta.trackLabel,
      section: meta.section,
      academicYear,
      subject: primarySubject,
      subjectIds,
      subjectNames,
      teacherId: adminUid,
      teacherName: "Specialized Study Admin",
      institutionId,
      inviteCode,
      studentCount: 0,
      status: "active",
      createdAt: nowIso,
      updatedAt: nowIso
    };
  });
}
var DEFAULT_ACADEMIC_YEARS = [
  {
    id: "ay-2026-2027",
    institutionId: "global",
    name: "2026-2027",
    startDate: "2026-09-02",
    endDate: "2027-05-25",
    isCurrent: true,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];
var DEFAULT_CURRICULUM_TOPICS = [
  {
    id: "topic-fractions",
    code: "TOP-FRAC",
    subjectId: "subj-matematika",
    subjectCode: "MAT",
    track: "A",
    name: "Kasrlar va ratsional sonlar",
    subject: "Matematika",
    grade: 7,
    description: "Oddiy va o\u2018nli kasrlar, ratsional sonlar ustida arifmetik amallar.",
    learningObjectives: "Ratsional sonlarni qo\u2018shish, ayirish, ko\u2018paytirish va bo\u2018lish.",
    status: "active",
    orderIndex: 1
  },
  {
    id: "topic-percentages",
    code: "TOP-PERC",
    subjectId: "subj-matematika",
    subjectCode: "MAT",
    track: "A",
    name: "Foizlar va proporsiyalar",
    subject: "Matematika",
    grade: 7,
    description: "Sonning foizini topish, foizga ko\u2018ra sonni topish va proporsiya xossalari.",
    learningObjectives: "Foizli o\u2018zgarish va proporsional bog\u2018lanish masalalarini yechish.",
    status: "active",
    orderIndex: 2
  },
  {
    id: "topic-equations",
    code: "TOP-EQ",
    subjectId: "subj-matematika",
    subjectCode: "MAT",
    track: "A",
    name: "Chiziqli tenglamalar",
    subject: "Matematika",
    grade: 8,
    description: "Bir noma\u2019lumli chiziqli tenglamalar, qavslarni ochish va tengsizliklar.",
    learningObjectives: "Chiziqli tenglama va tengsizliklarning ildizlarini topish.",
    status: "active",
    orderIndex: 3
  },
  {
    id: "topic-geometry",
    code: "TOP-GEOM",
    subjectId: "subj-matematika",
    subjectCode: "MAT",
    track: "A",
    name: "Asosiy geometriya",
    subject: "Matematika",
    grade: 8,
    description: "Uchburchaklar, to\u2018rtburchaklar yuzi, perimetri va Pifagor teoremasi.",
    learningObjectives: "Tekis shakllarning yuzi, perimetri va burchak xossalarini hisoblash.",
    status: "active",
    orderIndex: 4
  },
  {
    id: "topic-algebra",
    code: "TOP-ALG",
    subjectId: "subj-matematika",
    subjectCode: "MAT",
    track: "A",
    name: "Algebraik ifodalar va darajalar",
    subject: "Matematika",
    grade: 8,
    description: "Natural va butun ko\u2018rsatkichli darajalar, ko\u2018phadlar va qisqa ko\u2018paytirish formulalari.",
    learningObjectives: "Daraja xossalarini qo\u2018llash va algebraik ifodalarni soddalashtirish.",
    status: "active",
    orderIndex: 5
  },
  {
    id: "topic-eng-grammar",
    code: "TOP-ENG-01",
    subjectId: "subj-ingliz-tili",
    subjectCode: "ENG",
    name: "Present & Past Tenses",
    subject: "Ingliz tili",
    grade: 7,
    description: "Ingliz tilida zamonlar tizimi va gap qurilishi.",
    learningObjectives: "Present Simple, Present Continuous va Past Simple zamonlarini qo\u2018llash.",
    status: "active",
    orderIndex: 6
  },
  {
    id: "topic-phy-kinematics",
    code: "TOP-PHY-01",
    subjectId: "subj-fizika",
    subjectCode: "PHY",
    track: "A",
    name: "Kinematika asoslari va harakat qonunlari",
    subject: "Fizika",
    grade: 7,
    description: "Tekis va notekis harakat, tezlik, tezlanish va yo\u2018l formulalari.",
    learningObjectives: "Mexanik harakat tenglamalarini tuzish va masalalar yechish.",
    status: "active",
    orderIndex: 7
  },
  {
    id: "topic-bio-cell",
    code: "TOP-BIO-01",
    subjectId: "subj-biologiya",
    subjectCode: "BIO",
    track: "T",
    name: "Hujayra tuzilishi va hayotiy jarayonlar",
    subject: "Biologiya",
    grade: 8,
    description: "Eukariot va prokariot hujayralar, organoidlar va moddalar almashinuvi.",
    learningObjectives: "Hujayra organoidlari funksiyalarini farqlash va tahlil qilish.",
    status: "active",
    orderIndex: 8
  },
  {
    id: "topic-chm-atoms",
    code: "TOP-CHM-01",
    subjectId: "subj-kimyo",
    subjectCode: "CHM",
    track: "T",
    name: "Atom tuzilishi va davriy qonun",
    subject: "Kimyo",
    grade: 9,
    description: "Kimyoviy elementlar davriy jadvali, elektron konfiguratsiya va kimyoviy bog\u2018lanish.",
    learningObjectives: "Elementlarning davriy jadvaldagi o\u2018rniga ko\u2018ra xossalarini aniqlash.",
    status: "active",
    orderIndex: 9
  }
];

// src/utils/security.ts
function isAuthorizedAdminEmail(email, configuredOwnerEmail) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  if (configuredOwnerEmail && configuredOwnerEmail.trim().toLowerCase() !== PLATFORM_OWNER_EMAIL.toLowerCase()) {
    return normalized === configuredOwnerEmail.trim().toLowerCase() || AUTHORIZED_ADMIN_EMAILS.includes(normalized);
  }
  return AUTHORIZED_ADMIN_EMAILS.includes(normalized);
}
function isVerifiedPlatformOwner(actor, configuredOwnerEmail = PLATFORM_OWNER_EMAIL) {
  if (!actor || actor.status === "suspended" || actor.status === "archived") return false;
  const normalizedActorEmail = String(actor.email || "").trim().toLowerCase();
  if (!isAuthorizedAdminEmail(normalizedActorEmail, configuredOwnerEmail)) {
    return false;
  }
  if (actor.emailVerified === false) {
    return false;
  }
  return actor.platformAdmin === true || actor.platformOwner === true || actor.role === "platform_owner" || actor.role === "admin";
}
function computeSimpleHash(input) {
  let h1 = 3735928559 ^ input.length;
  let h2 = 1103547991 ^ input.length;
  for (let i = 0, ch; i < input.length; i++) {
    ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, "0");
}
function validateInvitationToken(rawToken, invitation, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
  if (!invitation) {
    return { valid: false, error: "Taklif kodi topilmadi." };
  }
  if (invitation.status === "accepted") {
    return { valid: false, error: "Ushbu taklif kodi allaqachon ishlatilgan (bir martalik)." };
  }
  if (invitation.status === "revoked") {
    return { valid: false, error: "Ushbu taklif kodi administrator tomonidan bekor qilingan." };
  }
  if (invitation.status === "expired" || new Date(invitation.expiresAt).getTime() < new Date(nowIso).getTime()) {
    return { valid: false, error: "Taklif kodining amal qilish muddati tugagan." };
  }
  const hashed = computeSimpleHash(rawToken.trim().toUpperCase());
  if (hashed !== invitation.tokenHash) {
    return { valid: false, error: "Taklif kodi xato yoki haqiqiy emas." };
  }
  return { valid: true };
}
function canAccessInstitution(actor, targetInstitutionId) {
  if (!actor || actor.status === "suspended") return false;
  if (isVerifiedPlatformOwner(actor)) return true;
  return actor.institutionId === targetInstitutionId;
}
function canAccessClass(actor, targetClass) {
  if (!actor || actor.status === "suspended" || actor.status === "archived") return false;
  if (isVerifiedPlatformOwner(actor)) return true;
  if (actor.institutionId !== targetClass.institutionId) return false;
  if (actor.role === "student") {
    return actor.classId === targetClass.id || Boolean(
      actor.classCode && targetClass.code && actor.classCode.trim().toLowerCase() === targetClass.code.trim().toLowerCase()
    );
  }
  return false;
}
function canAccessStudentRecord(actor, targetStudent, _authorizedTeacherClassIds = []) {
  if (!actor || actor.status === "suspended" || actor.status === "archived") return false;
  if (isVerifiedPlatformOwner(actor)) return true;
  if (actor.institutionId !== targetStudent.institutionId) return false;
  if (actor.role === "student") {
    return actor.uid === targetStudent.uid;
  }
  return false;
}
function sanitizeFormulaInjection(raw) {
  const str = String(raw ?? "").trim();
  if (!str) return "";
  if (/^[=+\-@\t\r]/.test(str) && !/^[+-]?\d+(\.\d+)?$/.test(str)) {
    return str.replace(/^[=+\-@\t\r]+/, "").trim();
  }
  return str;
}
var ALLOWED_IMAGE_MIMES = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp"]);
var ALLOWED_IMAGE_EXTS = /* @__PURE__ */ new Set([".jpg", ".jpeg", ".png", ".webp"]);
function isSafeArchivePath(entryName) {
  if (!entryName || typeof entryName !== "string") return false;
  if (entryName.includes("\0")) return false;
  const normalized = entryName.replace(/\\/g, "/").trim();
  if (normalized.startsWith("/") || normalized.includes("../") || normalized.includes("/..") || normalized === ".." || /^[a-zA-Z]:/.test(normalized)) {
    return false;
  }
  const lower = normalized.toLowerCase();
  const forbiddenExts = [
    ".exe",
    ".bat",
    ".cmd",
    ".sh",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".php",
    ".py",
    ".dll",
    ".so",
    ".xlsm",
    ".xlsb",
    ".vbs",
    ".ps1",
    ".html",
    ".htm",
    ".svg"
  ];
  if (forbiddenExts.some((ext) => lower.endsWith(ext))) {
    return false;
  }
  return true;
}
function detectImageMimeFromBytes(bytes) {
  if (!bytes || bytes.length < 3) return null;
  if (bytes.length >= 4 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
    return "image/png";
  }
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return "image/jpeg";
  }
  if (bytes.length >= 12 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80) {
    return "image/webp";
  }
  return null;
}
var SlidingWindowRateLimiter = class {
  constructor() {
    this.buckets = /* @__PURE__ */ new Map();
  }
  check(key, maxRequests, windowMs, nowMs = Date.now()) {
    const cutoff = nowMs - windowMs;
    const existing = (this.buckets.get(key) || []).filter((ts) => ts > cutoff);
    if (existing.length >= maxRequests) {
      const oldest = existing[0] || nowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1e3));
      this.buckets.set(key, existing);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds
      };
    }
    existing.push(nowMs);
    this.buckets.set(key, existing);
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - existing.length),
      retryAfterSeconds: 0
    };
  }
  reset(key) {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
    }
  }
};
function validateUploadedImageMeta(fileName, mimeTypeOrSize, sizeOrHeaderBytes, headerBytesArg, maxBytes = 5 * 1024 * 1024) {
  let mimeType = "";
  let sizeBytes = 0;
  let headerBytes;
  if (typeof mimeTypeOrSize === "number") {
    sizeBytes = mimeTypeOrSize;
    headerBytes = sizeOrHeaderBytes instanceof Uint8Array ? sizeOrHeaderBytes : headerBytesArg;
  } else {
    mimeType = String(mimeTypeOrSize || "");
    sizeBytes = typeof sizeOrHeaderBytes === "number" ? sizeOrHeaderBytes : 0;
    headerBytes = headerBytesArg;
  }
  if (!fileName || !isSafeArchivePath(fileName)) {
    return { valid: false, error: "Xavfsiz bo\u2018lmagan fayl nomi yoki yo\u2018li." };
  }
  const lower = fileName.toLowerCase();
  const extMatch = lower.match(/\.[a-z0-9]+$/);
  const ext = extMatch ? extMatch[0] : "";
  if (!ALLOWED_IMAGE_EXTS.has(ext)) {
    return {
      valid: false,
      error: `Ruxsat etilmagan rasm formati (${ext || "noma\u2019lum"}). Faqat JPEG, PNG va WebP ruxsat etiladi.`
    };
  }
  if (sizeBytes <= 0) {
    return { valid: false, error: "Fayl bo\u2018sh." };
  }
  if (sizeBytes > maxBytes) {
    return {
      valid: false,
      error: `Rasm hajmi ruxsat etilgan chegaradan (${Math.round(maxBytes / (1024 * 1024))} MB) oshib ketdi.`
    };
  }
  if (headerBytes && headerBytes.length > 0) {
    const detected = detectImageMimeFromBytes(headerBytes);
    if (!detected || !ALLOWED_IMAGE_MIMES.has(detected)) {
      return {
        valid: false,
        error: "Faylning haqiqiy binar tarkibi ruxsat etilgan rasm formatiga (JPEG/PNG/WebP) mos emas."
      };
    }
    return { valid: true, verifiedMime: detected, mimeType: detected };
  }
  const cleanMime = String(mimeType || "").toLowerCase();
  if (cleanMime && !ALLOWED_IMAGE_MIMES.has(cleanMime)) {
    return {
      valid: false,
      error: `Ruxsat etilmagan MIME turi (${cleanMime}). Faqat JPEG, PNG va WebP ruxsat etiladi.`
    };
  }
  const resolvedMime = cleanMime || (ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg");
  return {
    valid: true,
    verifiedMime: resolvedMime,
    mimeType: resolvedMime
  };
}
function validateCSVStudentImport(csvText, existingEmails = []) {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return {
      validRows: [],
      errors: ["CSV fayl bo'sh."],
      duplicates: []
    };
  }
  if (lines.length > 5001) {
    return {
      validRows: [],
      errors: ["CSV fayl qatorlar soni maksimal chegaradan (5000 qator) oshib ketdi."],
      duplicates: []
    };
  }
  const headerLine = lines[0].toLowerCase();
  const hasHeader = headerLine.includes("ism") || headerLine.includes("name") || headerLine.includes("email") || headerLine.includes("pochta");
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const existingSet = new Set(existingEmails.map((e) => e.trim().toLowerCase()));
  const seenInCsv = /* @__PURE__ */ new Set();
  const validRows = [];
  const errors = [];
  const duplicates = [];
  dataLines.forEach((line, idx) => {
    const rowNum = hasHeader ? idx + 2 : idx + 1;
    const cols = line.split(",").map((c) => sanitizeFormulaInjection(c.trim().replace(/^"|"$/g, "")));
    if (cols.length < 2) {
      errors.push(`${rowNum}-qator: Ism va elektron pochta ustunlari to'liq emas.`);
      return;
    }
    const [displayName, email, className] = cols;
    if (!displayName || displayName.length < 3) {
      errors.push(`${rowNum}-qator: O'quvchi ismi kamida 3 ta belgidan iborat bo'lishi shart.`);
      return;
    }
    const normalizedEmail = (email || "").toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@") || !normalizedEmail.includes(".")) {
      errors.push(`${rowNum}-qator: Noto'g'ri elektron pochta manzili (${email}).`);
      return;
    }
    if (existingSet.has(normalizedEmail) || seenInCsv.has(normalizedEmail)) {
      duplicates.push(`${rowNum}-qator: Takroriy elektron pochta (${email}).`);
      return;
    }
    seenInCsv.add(normalizedEmail);
    validRows.push({
      displayName,
      email: normalizedEmail,
      className: className || void 0
    });
  });
  return { validRows, errors, duplicates };
}
function isTrustedCorsOrigin(origin, requestHost) {
  if (!origin || !origin.trim() || origin.trim().toLowerCase() === "null") {
    return true;
  }
  try {
    const parsed = new URL(origin.trim());
    const hostname = parsed.hostname.toLowerCase();
    const hostWithPort = parsed.host.toLowerCase();
    if (requestHost && requestHost.trim()) {
      const candidateHosts = requestHost.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
      for (const normalizedReqHost of candidateHosts) {
        if (hostWithPort === normalizedReqHost || hostname === normalizedReqHost.split(":")[0]) {
          return true;
        }
      }
    }
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    }
    if (parsed.protocol !== "https:") {
      return false;
    }
    if (typeof process !== "undefined" && process.env) {
      const configuredUrls = [
        process.env.APP_URL,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : void 0,
        process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : void 0,
        process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : void 0
      ].filter(Boolean);
      for (const rawUrl of configuredUrls) {
        try {
          const envParsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
          if (envParsed.hostname.toLowerCase() === hostname) {
            return true;
          }
        } catch {
        }
      }
    }
    return hostname.endsWith(".vercel.app") || hostname === "vercel.app" || hostname.endsWith(".run.app") || hostname === "ai.studio" || hostname.endsWith(".ai.studio") || hostname.endsWith(".firebaseapp.com") || hostname.endsWith(".web.app") || hostname === "google.com" || hostname.endsWith(".google.com") || hostname.endsWith(".googleusercontent.com") || hostname.endsWith(".goog") || hostname.endsWith(".cloudworkstations.dev") || hostname.endsWith(".idx.dev") || hostname.endsWith(".appspot.com");
  } catch {
    return false;
  }
}

// src/server/requestDatabase.ts
import { AsyncLocalStorage } from "node:async_hooks";
var requestDatabase = new AsyncLocalStorage();

// src/server/dbEngine.ts
import fs from "fs";
import path from "path";
import crypto3 from "crypto";

// src/utils/gamificationEngine.ts
var GAMIFICATION_LEVELS = [
  { level: 1, title: "Boshlovchi", minXp: 0, maxXp: 50, description: "O'quv sayohatining ilk qadami" },
  { level: 2, title: "Izlanuvchi", minXp: 50, maxXp: 150, description: "Muntazam bilim izlovchi" },
  { level: 3, title: "O'rganuvchi", minXp: 150, maxXp: 300, description: "Mavzularni faol o\u2018zlashtiruvchi" },
  { level: 4, title: "Bilimdon", minXp: 300, maxXp: 550, description: "Chuqur tushunchaga ega o\u2018quvchi" },
  { level: 5, title: "Tadqiqotchi", minXp: 550, maxXp: 900, description: "Murakkab masalalarni yechuvchi" },
  { level: 6, title: "Mutaxassis", minXp: 900, maxXp: 1400, description: "Fanlar bo\u2018yicha yuqori mahorat egasi" },
  { level: 7, title: "Ekspert", minXp: 1400, maxXp: null, description: "Specialized Study akademik yetakchisi" }
];
var DEFAULT_GAMIFICATION_BADGES = [
  {
    id: "badge_birinchi_qadam",
    code: "BIRINCHI_QADAM",
    title: "BIRINCHI QADAM",
    description: "Birinchi dars muvaffaqiyatli yakunlandi.",
    category: "milestone",
    thresholdValue: 1,
    xpBonus: 0,
    iconKey: "BIRINCHI_QADAM",
    isActive: true
  },
  {
    id: "badge_faol_oquvchi",
    code: "FAOL_OQUVCHI",
    title: "FAOL O'QUVCHI",
    description: "5 ta tasdiqlangan dars muvaffaqiyatli yakunlandi.",
    category: "milestone",
    thresholdValue: 5,
    xpBonus: 0,
    iconKey: "FAOL_OQUVCHI",
    isActive: true
  },
  {
    id: "badge_matematika_ixlosmandi",
    code: "MATEMATIKA_IXLOSMANDI",
    title: "MATEMATIKA IXLOSMANDI",
    description: "Matematika fanidan 10 ta o'quv faoliyati bajarildi.",
    category: "subject",
    thresholdValue: 10,
    xpBonus: 0,
    iconKey: "MATEMATIKA_IXLOSMANDI",
    isActive: true
  },
  {
    id: "badge_izchillik",
    code: "IZCHILLIK",
    title: "IZCHILLIK",
    description: "3 ta alohida kunda o'quv faoliyati davom ettirildi.",
    category: "consistency",
    thresholdValue: 3,
    xpBonus: 0,
    iconKey: "IZCHILLIK",
    isActive: true
  },
  {
    id: "badge_bilim_izlovchisi",
    code: "BILIM_IZLOVCHISI",
    title: "BILIM IZLOVCHISI",
    description: "Turli o'quv mavzulari va fan yo'nalishlari o'rganildi.",
    category: "milestone",
    thresholdValue: 3,
    xpBonus: 0,
    iconKey: "BILIM_IZLOVCHISI",
    isActive: true
  },
  {
    id: "badge_birinchi_test",
    code: "BIRINCHI_TEST",
    title: "BIRINCHI TEST",
    description: "Birinchi nazorat ishi yoki test muvaffaqiyatli topshirildi.",
    category: "assessment",
    thresholdValue: 1,
    xpBonus: 0,
    iconKey: "BIRINCHI_TEST",
    isActive: true
  },
  {
    id: "badge_mashgulot_ustasi",
    code: "MASHGULOT_USTASI",
    title: "MASHG'ULOT USTASI",
    description: "Haftalik shaxsiy o'quv maqsadi to'liq bajarildi.",
    category: "goal",
    thresholdValue: 1,
    xpBonus: 0,
    iconKey: "MASHGULOT_USTASI",
    isActive: true
  }
];
var DEFAULT_GAMIFICATION_CONFIG = {
  id: "default",
  enabled: true,
  xpRewards: {
    daily_checkin: 5,
    lesson_completed: 10,
    practice_completed: 5,
    assessment_completed: 15,
    weekly_goal_completed: 20,
    curriculum_milestone_completed: 25
  },
  dailyXpCap: 150,
  streakGraceDays: 1,
  enableDailyCheckin: true,
  enableBadges: true,
  enableStreaks: true,
  enableClassChallenges: true,
  enableWeeklyRecap: true,
  goalTemplates: [
    "1 ta darsni o'rganish",
    "10 ta mashq bajarish",
    "1 ta test ishlash",
    "Oldingi mavzuni takrorlash"
  ],
  updatedAt: "2026-01-01T00:00:00.000Z"
};
function getTashkentDateString(date = /* @__PURE__ */ new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tashkent",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
function getIsoWeekKey(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
  const dayNum = dt.getUTCDay() || 7;
  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() - dayNum + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  const weekKey = `${thursday.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  return {
    weekKey,
    weekStartDate: monday.toISOString().slice(0, 10),
    weekEndDate: sunday.toISOString().slice(0, 10)
  };
}
function calculateStudentLevel(totalXp) {
  const safeXp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let matched = GAMIFICATION_LEVELS[0];
  for (const lvl of GAMIFICATION_LEVELS) {
    if (safeXp >= lvl.minXp) {
      matched = lvl;
    }
  }
  if (matched.maxXp === null) {
    return {
      currentLevel: matched.level,
      currentLevelTitle: matched.title,
      nextLevelXp: null,
      levelProgressPercent: 100
    };
  }
  const span = Math.max(1, matched.maxXp - matched.minXp);
  const earnedInBand = Math.max(0, safeXp - matched.minXp);
  const percent = Math.min(100, Math.round(earnedInBand / span * 100));
  return {
    currentLevel: matched.level,
    currentLevelTitle: matched.title,
    nextLevelXp: matched.maxXp,
    levelProgressPercent: percent
  };
}
function createInitialGamificationProfile(studentId, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
  const lvl = calculateStudentLevel(0);
  return {
    id: studentId,
    studentId,
    totalXp: 0,
    currentLevel: lvl.currentLevel,
    currentLevelTitle: lvl.currentLevelTitle,
    nextLevelXp: lvl.nextLevelXp,
    levelProgressPercent: lvl.levelProgressPercent,
    completedLessonsCount: 0,
    completedPracticeCount: 0,
    completedAssessmentsCount: 0,
    completedGoalsCount: 0,
    completedMilestonesCount: 0,
    mathActivitiesCount: 0,
    exploredSubjects: [],
    exploredTopics: [],
    avatarIcon: "compass",
    streakRemindersEnabled: true,
    notificationsEnabled: true,
    updatedAt: nowIso
  };
}
function createInitialStreakRecord(studentId, graceDaysAllowed = 1, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
  return {
    id: studentId,
    studentId,
    currentStreakDays: 0,
    longestStreakDays: 0,
    activeDates: [],
    lastActiveDate: null,
    graceDaysAllowed,
    graceDaysUsedInCurrentStreak: 0,
    statusMessage: "Yana davom ettirish vaqti! Bugungi ilk mashg'ulotni boshlang.",
    updatedAt: nowIso
  };
}
function diffDaysBetweenDateKeys(earlierDateKey, laterDateKey) {
  const [y1, m1, d1] = earlierDateKey.split("-").map(Number);
  const [y2, m2, d2] = laterDateKey.split("-").map(Number);
  const t1 = Date.UTC(y1, (m1 || 1) - 1, d1 || 1);
  const t2 = Date.UTC(y2, (m2 || 1) - 1, d2 || 1);
  return Math.round((t2 - t1) / 864e5);
}
function computeHealthyStreak(existing, studentId, activityDateKey, graceDaysAllowed = 1, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
  const base = existing ? {
    ...existing,
    activeDates: Array.from(new Set(existing.activeDates || [])).sort(),
    graceDaysAllowed
  } : createInitialStreakRecord(studentId, graceDaysAllowed, nowIso);
  if (!activityDateKey || !/^\d{4}-\d{2}-\d{2}$/.test(activityDateKey)) {
    return base;
  }
  if (base.activeDates.includes(activityDateKey)) {
    return {
      ...base,
      statusMessage: `${base.currentStreakDays} kun faol o'qish davom etmoqda!`,
      updatedAt: nowIso
    };
  }
  const allDates = Array.from(/* @__PURE__ */ new Set([...base.activeDates, activityDateKey])).sort();
  let currentStreak = 1;
  let longestStreak = Math.max(1, base.longestStreakDays || 0);
  let graceUsed = 0;
  for (let i = 1; i < allDates.length; i++) {
    const gap = diffDaysBetweenDateKeys(allDates[i - 1], allDates[i]);
    if (gap === 1) {
      currentStreak += 1;
    } else if (gap > 1 && gap - 1 <= graceDaysAllowed) {
      currentStreak += 1;
      graceUsed += gap - 1;
    } else if (gap > 1) {
      currentStreak = 1;
      graceUsed = 0;
    }
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
  }
  const lastPrev = base.lastActiveDate;
  const gapFromLast = lastPrev ? diffDaysBetweenDateKeys(lastPrev, activityDateKey) : 0;
  const statusMessage = lastPrev && gapFromLast > graceDaysAllowed + 1 ? `Yana davom ettirish vaqti! Yangi ${currentStreak} kunlik ritm boshlandi.` : `${currentStreak} kun izchil o'rganish davom etmoqda!`;
  return {
    id: studentId,
    studentId,
    currentStreakDays: currentStreak,
    longestStreakDays: longestStreak,
    activeDates: allDates,
    lastActiveDate: allDates[allDates.length - 1] || activityDateKey,
    graceDaysAllowed,
    graceDaysUsedInCurrentStreak: graceUsed,
    statusMessage,
    updatedAt: nowIso
  };
}
function isMathSubjectOrArea(subject, curriculumArea) {
  const s = `${subject || ""} ${curriculumArea || ""}`.toLowerCase();
  return s.includes("matematika") || s.includes("algebra") || s.includes("geometriya");
}
function processVerifiedLearningEvent(input) {
  const nowIso = input.occurredAt || (/* @__PURE__ */ new Date()).toISOString();
  const dateKey = input.dateKey || getTashkentDateString(new Date(nowIso));
  const config = input.config || DEFAULT_GAMIFICATION_CONFIG;
  const badgeDefs = input.badgeDefinitions || DEFAULT_GAMIFICATION_BADGES;
  const baseProfile = input.existingProfile ? {
    ...input.existingProfile,
    exploredSubjects: [...input.existingProfile.exploredSubjects || []],
    exploredTopics: [...input.existingProfile.exploredTopics || []]
  } : createInitialGamificationProfile(input.studentId, nowIso);
  const baseStreak = input.existingStreak || createInitialStreakRecord(input.studentId, config.streakGraceDays, nowIso);
  const alreadyProcessed = input.existingEvents.some(
    (e) => e.studentId === input.studentId && e.idempotencyKey === input.idempotencyKey
  ) || input.existingLedger.some(
    (l) => l.studentId === input.studentId && l.idempotencyKey === input.idempotencyKey
  );
  if (alreadyProcessed || !config.enabled) {
    return {
      duplicate: true,
      xpAwarded: 0,
      leveledUp: false,
      previousLevel: baseProfile.currentLevel,
      newLevel: baseProfile.currentLevel,
      profile: baseProfile,
      newlyEarnedBadges: [],
      streak: baseStreak,
      updatedChallenges: input.existingChallenges || []
    };
  }
  const xpEarnedToday = input.existingLedger.filter((l) => l.studentId === input.studentId && l.dateKey === dateKey && l.xpDelta > 0).reduce((sum, l) => sum + l.xpDelta, 0);
  const configuredReward = Math.max(0, Number(config.xpRewards[input.activityType] ?? 0));
  const remainingDailyAllowance = Math.max(0, (config.dailyXpCap || 150) - xpEarnedToday);
  const xpAwarded = Math.min(configuredReward, remainingDailyAllowance);
  const eventId = `evt_${input.studentId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const event = {
    id: eventId,
    idempotencyKey: input.idempotencyKey,
    studentId: input.studentId,
    classCode: input.classCode,
    activityType: input.activityType,
    subject: input.subject,
    curriculumArea: input.curriculumArea,
    topicId: input.topicId,
    lessonId: input.lessonId,
    assessmentId: input.assessmentId,
    goalId: input.goalId,
    quarter: input.quarter,
    xpAwarded,
    occurredAt: nowIso,
    dateKey
  };
  const previousLevel = baseProfile.currentLevel;
  const newTotalXp = baseProfile.totalXp + xpAwarded;
  const lvlInfo = calculateStudentLevel(newTotalXp);
  if (input.activityType === "lesson_completed") {
    baseProfile.completedLessonsCount += 1;
  } else if (input.activityType === "practice_completed") {
    baseProfile.completedPracticeCount += 1;
  } else if (input.activityType === "assessment_completed") {
    baseProfile.completedAssessmentsCount += 1;
  } else if (input.activityType === "weekly_goal_completed") {
    baseProfile.completedGoalsCount += 1;
  } else if (input.activityType === "curriculum_milestone_completed") {
    baseProfile.completedMilestonesCount += 1;
  }
  if (input.activityType !== "daily_checkin" && isMathSubjectOrArea(input.subject, input.curriculumArea)) {
    baseProfile.mathActivitiesCount += 1;
  }
  if (input.subject && !baseProfile.exploredSubjects.includes(input.subject)) {
    baseProfile.exploredSubjects.push(input.subject);
  }
  const topicKey = input.topicId || input.lessonId;
  if (topicKey && !baseProfile.exploredTopics.includes(topicKey)) {
    baseProfile.exploredTopics.push(topicKey);
  }
  baseProfile.totalXp = newTotalXp;
  baseProfile.currentLevel = lvlInfo.currentLevel;
  baseProfile.currentLevelTitle = lvlInfo.currentLevelTitle;
  baseProfile.nextLevelXp = lvlInfo.nextLevelXp;
  baseProfile.levelProgressPercent = lvlInfo.levelProgressPercent;
  baseProfile.updatedAt = nowIso;
  const ledgerEntry = {
    id: `xpl_${eventId}`,
    idempotencyKey: input.idempotencyKey,
    studentId: input.studentId,
    eventId,
    activityType: input.activityType,
    xpDelta: xpAwarded,
    balanceAfter: newTotalXp,
    reason: input.reason,
    referenceId: input.lessonId || input.assessmentId || input.goalId,
    createdAt: nowIso,
    dateKey
  };
  const updatedStreak = config.enableStreaks ? computeHealthyStreak(
    baseStreak,
    input.studentId,
    dateKey,
    config.streakGraceDays,
    nowIso
  ) : baseStreak;
  const newlyEarnedBadges = [];
  if (config.enableBadges) {
    const ownedCodes = new Set(
      input.existingStudentBadges.filter((b) => b.studentId === input.studentId).map((b) => b.badgeCode)
    );
    const activeDaysCount = updatedStreak.activeDates.length;
    const distinctTopicsOrAreasCount = baseProfile.exploredTopics.length;
    for (const def of badgeDefs) {
      if (!def.isActive || ownedCodes.has(def.code)) continue;
      let qualifies = false;
      switch (def.code) {
        case "BIRINCHI_QADAM":
          qualifies = baseProfile.completedLessonsCount >= def.thresholdValue;
          break;
        case "FAOL_OQUVCHI":
          qualifies = baseProfile.completedLessonsCount >= def.thresholdValue;
          break;
        case "MATEMATIKA_IXLOSMANDI":
          qualifies = baseProfile.mathActivitiesCount >= def.thresholdValue;
          break;
        case "IZCHILLIK":
          qualifies = activeDaysCount >= def.thresholdValue;
          break;
        case "BILIM_IZLOVCHISI":
          qualifies = distinctTopicsOrAreasCount >= def.thresholdValue || baseProfile.exploredSubjects.length >= 2;
          break;
        case "BIRINCHI_TEST":
          qualifies = baseProfile.completedAssessmentsCount >= def.thresholdValue;
          break;
        case "MASHGULOT_USTASI":
          qualifies = baseProfile.completedGoalsCount >= def.thresholdValue;
          break;
      }
      if (qualifies) {
        ownedCodes.add(def.code);
        newlyEarnedBadges.push({
          id: `sbadge_${input.studentId}_${def.code}`,
          studentId: input.studentId,
          badgeId: def.id,
          badgeCode: def.code,
          title: def.title,
          description: def.description,
          earnedAt: nowIso,
          triggerEventId: eventId
        });
      }
    }
  }
  const updatedChallenges = (input.existingChallenges || []).map((challenge) => {
    if (!challenge.isActive || challenge.classCode !== input.classCode) {
      return challenge;
    }
    const matchesType = challenge.targetType === "lessons" && input.activityType === "lesson_completed" || challenge.targetType === "assessments" && input.activityType === "assessment_completed" || challenge.targetType === "checkins" && input.activityType === "daily_checkin" || challenge.targetType === "activities";
    if (!matchesType) return challenge;
    if (challenge.subject && input.subject && challenge.subject !== input.subject) {
      return challenge;
    }
    const contributors = challenge.contributorStudentIds.includes(input.studentId) ? challenge.contributorStudentIds : [...challenge.contributorStudentIds, input.studentId];
    return {
      ...challenge,
      currentCount: Math.min(challenge.targetCount, challenge.currentCount + 1),
      contributorStudentIds: contributors,
      updatedAt: nowIso
    };
  });
  return {
    duplicate: false,
    xpAwarded,
    leveledUp: baseProfile.currentLevel > previousLevel,
    previousLevel,
    newLevel: baseProfile.currentLevel,
    profile: baseProfile,
    event,
    ledgerEntry,
    newlyEarnedBadges,
    streak: updatedStreak,
    updatedChallenges
  };
}
function classifyRoadmap2LessonBadge(lesson) {
  const lt = (lesson.lessonType || "").toLowerCase();
  const at = (lesson.assessmentType || lesson.milestoneType || "").toLowerCase();
  const ec = (lesson.eventCategory || "").toLowerCase();
  const titleLower = `${lesson.topicTitle || ""} ${lesson.title || ""}`.toLowerCase();
  if (lt === "bsb_analysis" || titleLower.includes("bsb") && (titleLower.includes("tahlil") || titleLower.includes("xato"))) {
    return "BSB tahlili";
  }
  if (lt === "chsb_analysis" || titleLower.includes("chsb") && (titleLower.includes("tahlil") || titleLower.includes("xato"))) {
    return "CHSB tahlili";
  }
  if (lt === "bsb" || at === "bsb" || /\bbsb\b/i.test(titleLower) || lt.includes("yozma ish-41")) {
    return "BSB";
  }
  if (lt === "chsb" || at === "chsb" || ec === "quarterly_assessment" || /\bchsb\b/i.test(titleLower) || lt.includes("choraklik-39")) {
    return "CHSB";
  }
  if (lt === "written_exam" || at === "written_work" || ec === "written_assessment" || titleLower.includes("nazorat ishi") || titleLower.includes("yozma ish") || lt.includes("yozma ish")) {
    return "Yozma ish";
  }
  if (lt === "project" || at === "project" || ec === "project_work" || titleLower.includes("loyiha ishi") || lt.includes("loyiha ishi")) {
    return "Loyiha ishi";
  }
  if (lt === "revision" || ec === "review_and_analysis" || titleLower.includes("takrorlash") || titleLower.includes("xatolar ustida ishlash")) {
    return "Takrorlash";
  }
  return "Oddiy dars";
}
function buildWeeklyLearningRecap(params) {
  const todayKey = params.dateKey || getTashkentDateString();
  const { weekKey, weekStartDate, weekEndDate } = getIsoWeekKey(todayKey);
  const weekEvents = params.events.filter(
    (e) => e.studentId === params.studentId && e.dateKey >= weekStartDate && e.dateKey <= weekEndDate
  );
  const completedLessonsCount = weekEvents.filter((e) => e.activityType === "lesson_completed").length;
  const completedTestsCount = weekEvents.filter((e) => e.activityType === "assessment_completed").length;
  const xpEarned = weekEvents.reduce((sum, e) => sum + (e.xpAwarded || 0), 0);
  const subjectsStudied = Array.from(
    new Set(weekEvents.map((e) => e.subject).filter((s) => Boolean(s)))
  );
  const lessonTitleMap = new Map(params.lessons.map((l) => [l.id, l.title]));
  const topicsPracticed = Array.from(
    new Set(
      weekEvents.map((e) => e.lessonId ? lessonTitleMap.get(e.lessonId) : void 0).filter((t) => Boolean(t))
    )
  ).slice(0, 6);
  const newBadges = params.studentBadges.filter((b) => {
    const earnedDate = (b.earnedAt || "").slice(0, 10);
    return b.studentId === params.studentId && earnedDate >= weekStartDate && earnedDate <= weekEndDate;
  }).map((b) => b.badgeCode);
  const completedIds = new Set(
    params.completions.filter((c) => c.studentId === params.studentId && c.status === "completed").map((c) => c.lessonId)
  );
  const nextClassLesson = params.lessons.filter(
    (l) => l.status === "published" && (l.classCode === params.classCode || l.classId === `class_${params.classCode}`) && !completedIds.has(l.id)
  ).sort(
    (a, b) => (a.quarter || 1) - (b.quarter || 1) || (a.lessonNumber || a.orderIndex || 0) - (b.lessonNumber || b.orderIndex || 0)
  )[0];
  const recommendedNextFocus = nextClassLesson ? `${nextClassLesson.subject || nextClassLesson.subjectName || "Fan"}${nextClassLesson.curriculumArea ? ` (${nextClassLesson.curriculumArea})` : ""}: ${nextClassLesson.lessonNumber || nextClassLesson.orderIndex || "\u2014"}-dars \u2014 ${nextClassLesson.title}` : "O'quv xaritasi bo'yicha navbatdagi mavzuni tanlang";
  return {
    id: `${params.studentId}_${weekKey}`,
    studentId: params.studentId,
    weekKey,
    weekStartDate,
    weekEndDate,
    completedLessonsCount,
    completedTestsCount,
    subjectsStudied,
    xpEarned,
    newBadges,
    topicsPracticed,
    recommendedNextFocus,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// src/utils/academicOsEngine.ts
var A_TRACK_SUBJECTS = ["Matematika", "Ingliz tili", "Fizika", "Algebra", "Geometriya"];
var T_TRACK_SUBJECTS = ["Ingliz tili", "Biologiya", "Kimyo", "Matematika", "Algebra", "Geometriya"];
function isTTrackClass(classCode) {
  return classCode.toLowerCase().endsWith("t");
}
function getAllowedSubjectsForClass(classCode) {
  if (isTTrackClass(classCode)) {
    return ["Ingliz tili", "Biologiya", "Kimyo", "Matematika"];
  }
  return ["Matematika", "Ingliz tili", "Fizika"];
}
function parseTimeToMinutes(timeStr) {
  const match = /^(\d{1,2}):(\d{2})$/.exec((timeStr || "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}
function validateTimetableEntry(candidate, existingEntries) {
  const issues = [];
  const startMin = parseTimeToMinutes(candidate.startTime);
  const endMin = parseTimeToMinutes(candidate.endTime);
  if (startMin === null || endMin === null) {
    issues.push({
      type: "invalid_duration",
      severity: "error",
      message: "Dars boshlanish va tugash vaqti HH:mm formatida bo'lishi shart."
    });
    return issues;
  }
  const duration = endMin - startMin;
  if (duration <= 0) {
    issues.push({
      type: "invalid_duration",
      severity: "error",
      message: "Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak."
    });
  } else if (duration < 25 || duration > 180) {
    issues.push({
      type: "invalid_duration",
      severity: "warning",
      message: `Dars davomiyligi (${duration} daqiqa) standart me'yordan (35\u201390 daqiqa) farq qiladi.`
    });
  }
  const isT = isTTrackClass(candidate.classCode);
  const allowedList = isT ? T_TRACK_SUBJECTS : A_TRACK_SUBJECTS;
  const subjectAllowed = allowedList.some(
    (s) => candidate.subject.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(candidate.subject.toLowerCase())
  );
  if (!subjectAllowed) {
    issues.push({
      type: "subject_track_mismatch",
      severity: "warning",
      message: `${candidate.classCode.toUpperCase()} sinfi yo'nalishi uchun "${candidate.subject}" fani standart o'quv rejasiga kirmaydi.`
    });
  }
  const sameDayClassEntries = existingEntries.filter(
    (e) => e.timetableId === candidate.timetableId && e.classCode === candidate.classCode && e.weekdayIndex === candidate.weekdayIndex && e.id !== candidate.id
  );
  for (const existing of sameDayClassEntries) {
    if (existing.lessonNumber === candidate.lessonNumber && existing.subject.toLowerCase() === candidate.subject.toLowerCase() && existing.startTime === candidate.startTime && existing.endTime === candidate.endTime) {
      issues.push({
        type: "duplicate_entry",
        severity: "error",
        message: `${candidate.weekday} kuni ${candidate.lessonNumber}-soatda "${candidate.subject}" darsi allaqachon kiritilgan.`,
        conflictingEntryId: existing.id
      });
      continue;
    }
    if (existing.lessonNumber === candidate.lessonNumber) {
      issues.push({
        type: "time_conflict",
        severity: "error",
        message: `${candidate.weekday} kuni ${candidate.lessonNumber}-soat band (${existing.subject}, ${existing.startTime}\u2013${existing.endTime}).`,
        conflictingEntryId: existing.id
      });
      continue;
    }
    const exStart = parseTimeToMinutes(existing.startTime);
    const exEnd = parseTimeToMinutes(existing.endTime);
    if (exStart !== null && exEnd !== null && startMin < exEnd && endMin > exStart) {
      issues.push({
        type: "time_conflict",
        severity: "error",
        message: `${candidate.weekday} kuni vaqt ustma-ust tushishi: ${candidate.startTime}\u2013${candidate.endTime} va ${existing.subject} (${existing.startTime}\u2013${existing.endTime}).`,
        conflictingEntryId: existing.id
      });
    }
  }
  return issues;
}
function resolveStudentTimetableView(params) {
  const { classCode, timetables, entries, nowIso } = params;
  const activeTimetables = timetables.filter((t) => t.classCode === classCode && t.status === "active").sort((a, b) => b.version - a.version || b.effectiveFrom.localeCompare(a.effectiveFrom));
  const activeTimetable = activeTimetables[0] || null;
  const now = nowIso ? new Date(nowIso) : /* @__PURE__ */ new Date();
  const jsDay = now.getDay();
  const todayWeekdayIndex = jsDay === 0 ? 7 : jsDay;
  const weekdayMap = {
    1: "Dushanba",
    2: "Seshanba",
    3: "Chorshanba",
    4: "Payshanba",
    5: "Juma",
    6: "Shanba",
    7: "Yakshanba"
  };
  const todayWeekdayLabel = weekdayMap[todayWeekdayIndex] || "Dushanba";
  if (!activeTimetable) {
    return {
      activeTimetable: null,
      allEntries: [],
      todayWeekdayIndex,
      todayWeekdayLabel,
      todaysLessons: [],
      nextLesson: null,
      upcomingLessons: []
    };
  }
  const allEntries = entries.filter((e) => e.timetableId === activeTimetable.id && e.classCode === classCode).sort((a, b) => a.weekdayIndex - b.weekdayIndex || a.lessonNumber - b.lessonNumber);
  const todaysLessons = allEntries.filter((e) => e.weekdayIndex === todayWeekdayIndex);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let nextLesson = null;
  const todayRemaining = todaysLessons.filter((e) => {
    const endMin = parseTimeToMinutes(e.endTime);
    return endMin !== null && endMin >= currentMinutes;
  });
  if (todayRemaining.length > 0) {
    nextLesson = todayRemaining[0];
  } else {
    const laterInWeek = allEntries.filter((e) => e.weekdayIndex > todayWeekdayIndex);
    nextLesson = laterInWeek[0] || allEntries[0] || null;
  }
  const upcomingLessons = allEntries.filter((e) => {
    if (e.weekdayIndex === todayWeekdayIndex) {
      const startMin = parseTimeToMinutes(e.startTime);
      return startMin !== null && startMin > currentMinutes;
    }
    return e.weekdayIndex > todayWeekdayIndex;
  });
  return {
    activeTimetable,
    allEntries,
    todayWeekdayIndex,
    todayWeekdayLabel,
    todaysLessons,
    nextLesson,
    upcomingLessons: upcomingLessons.slice(0, 6)
  };
}
function saveStudentAssignmentDraft(existing, draftContent, draftAttachmentUrl, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
  const nextStatus = existing.status === "Yangi" ? "Jarayonda" : existing.status;
  return {
    ...existing,
    status: nextStatus,
    draftContent,
    draftAttachmentUrl: draftAttachmentUrl ?? existing.draftAttachmentUrl,
    draftSavedAt: nowIso,
    updatedAt: nowIso
  };
}
function submitStudentAssignmentWork(params) {
  const {
    assignment,
    existingSubmission,
    content,
    attachmentUrl,
    attachmentName,
    attachmentMimeType,
    nowIso = (/* @__PURE__ */ new Date()).toISOString()
  } = params;
  const isResubmission = existingSubmission.attemptCount > 0 && Boolean(existingSubmission.submissionDate);
  if (isResubmission && assignment.allowResubmission === false && existingSubmission.status !== "Qaytarildi") {
    throw new Error("Ushbu topshiriq uchun qayta topshirish ruxsat etilmagan.");
  }
  let archivedRevision = null;
  if (isResubmission) {
    archivedRevision = {
      id: `rev_${existingSubmission.id}_${existingSubmission.attemptCount}_${Date.now()}`,
      institutionId: existingSubmission.institutionId,
      submissionId: existingSubmission.id,
      assignmentId: existingSubmission.assignmentId,
      studentId: existingSubmission.studentId,
      studentName: existingSubmission.studentName,
      classCode: existingSubmission.classCode,
      revisionNumber: existingSubmission.attemptCount,
      content: existingSubmission.content,
      attachmentUrl: existingSubmission.attachmentUrl,
      attachmentName: existingSubmission.attachmentName,
      submittedAt: existingSubmission.submissionDate || existingSubmission.updatedAt,
      score: existingSubmission.score,
      feedback: existingSubmission.feedback,
      gradedByUid: existingSubmission.gradedByUid,
      gradedByName: existingSubmission.gradedByName,
      gradedAt: existingSubmission.gradedAt,
      statusAtArchive: existingSubmission.status
    };
  }
  const updatedSubmission = {
    ...existingSubmission,
    status: "Topshirildi",
    submissionDate: nowIso,
    attemptCount: existingSubmission.attemptCount + 1,
    content,
    attachmentUrl: attachmentUrl ?? existingSubmission.attachmentUrl,
    attachmentName: attachmentName ?? existingSubmission.attachmentName,
    attachmentMimeType: attachmentMimeType ?? existingSubmission.attachmentMimeType,
    draftContent: void 0,
    draftAttachmentUrl: void 0,
    updatedAt: nowIso
  };
  return { updatedSubmission, archivedRevision };
}
function isAnnouncementRelevantToStudent(announcement, studentClassCode, todayDateStr) {
  if (announcement.status !== "published") return false;
  if (todayDateStr && announcement.expirationDate && announcement.expirationDate < todayDateStr) {
    return false;
  }
  switch (announcement.audienceType) {
    case "entire_school":
      return true;
    case "specific_classes":
    case "class_group":
      return announcement.targetClassCodes.includes(studentClassCode);
    case "subjects": {
      if (announcement.targetClassCodes && announcement.targetClassCodes.length > 0) {
        return announcement.targetClassCodes.includes(studentClassCode);
      }
      const allowedSubjects = getAllowedSubjectsForClass(studentClassCode);
      return announcement.targetSubjects.some(
        (subj) => allowedSubjects.some((allowed) => subj.toLowerCase().includes(allowed.toLowerCase()))
      );
    }
    default:
      return false;
  }
}
function filterAuthorizedMaterialsForStudent(materials, studentClassCode, studentGrade) {
  const allowedSubjects = getAllowedSubjectsForClass(studentClassCode);
  return materials.filter((m) => {
    if (m.status !== "published") return false;
    if (m.targetClassCodes && m.targetClassCodes.length > 0) {
      return m.targetClassCodes.includes(studentClassCode);
    }
    if (m.classCode && m.classCode !== studentClassCode) {
      return false;
    }
    if (m.grade && m.grade !== studentGrade) {
      return false;
    }
    return allowedSubjects.some(
      (s) => m.subject.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(m.subject.toLowerCase())
    );
  });
}
function buildUnifiedAcademicCalendarEvents(params) {
  const {
    institutionId,
    timetableEntries,
    timetables,
    lessons,
    deliveryRecords,
    assignments,
    assessments,
    announcements,
    customEvents,
    referenceWeekMondayDate
  } = params;
  const events = [...customEvents];
  if (referenceWeekMondayDate && /^\d{4}-\d{2}-\d{2}$/.test(referenceWeekMondayDate)) {
    const activeIds = new Set(timetables.filter((t) => t.status === "active").map((t) => t.id));
    const baseMonday = /* @__PURE__ */ new Date(`${referenceWeekMondayDate}T00:00:00Z`);
    for (const entry of timetableEntries) {
      if (!activeIds.has(entry.timetableId)) continue;
      const d = new Date(baseMonday.getTime() + (entry.weekdayIndex - 1) * 864e5);
      const dateStr = d.toISOString().slice(0, 10);
      events.push({
        id: `cal_tt_${entry.id}_${dateStr}`,
        institutionId,
        title: `${entry.lessonNumber}-soat: ${entry.subject}${entry.room ? ` (${entry.room}-xona)` : ""}`,
        description: entry.relatedLessonTitle || `${entry.classCode.toUpperCase()} dars jadvali`,
        category: "timetable",
        date: dateStr,
        startTime: entry.startTime,
        endTime: entry.endTime,
        classCode: entry.classCode,
        subject: entry.subject,
        sourceRecordId: entry.id,
        sourceCollection: "timetable_entries",
        targetRoute: `/admin/timetable?classCode=${entry.classCode}`,
        createdAt: entry.createdAt
      });
    }
  }
  for (const delivery of deliveryRecords) {
    const actualDate = delivery.actualDeliveryDate || delivery.rescheduledToDate || delivery.plannedDate;
    if (!actualDate || !/^\d{4}-\d{2}-\d{2}$/.test(actualDate)) continue;
    events.push({
      id: `cal_del_${delivery.id}`,
      institutionId,
      title: `${delivery.subject}: ${delivery.lessonTitle} (${delivery.deliveryStatus})`,
      description: delivery.completionNote,
      category: "published_lesson",
      date: actualDate.slice(0, 10),
      classCode: delivery.classCode,
      subject: delivery.subject,
      quarter: delivery.quarter,
      sourceRecordId: delivery.lessonId,
      sourceCollection: "lessons",
      targetRoute: `/admin/curriculum?classCode=${delivery.classCode}&lessonId=${delivery.lessonId}`,
      createdAt: delivery.updatedAt
    });
  }
  for (const lesson of lessons) {
    if (!lesson.scheduledDate || !/^\d{4}-\d{2}-\d{2}/.test(lesson.scheduledDate)) continue;
    const dateOnly = lesson.scheduledDate.slice(0, 10);
    const kind = (lesson.lessonKind || lesson.milestoneType || lesson.lessonType || "").toUpperCase();
    const category = kind === "BSB" ? "bsb" : kind === "CHSB" ? "chsb" : kind === "PROJECT" ? "project_work" : "published_lesson";
    const desc = lesson.learningObjective || (Array.isArray(lesson.learningObjectives) ? lesson.learningObjectives.join(", ") : lesson.learningObjectives);
    events.push({
      id: `cal_les_${lesson.id}`,
      institutionId,
      title: `${lesson.subject || lesson.subjectName}: ${lesson.topicTitle || lesson.topicName || lesson.title}`,
      description: desc,
      category,
      date: dateOnly,
      classCode: lesson.classCode,
      subject: lesson.subject || lesson.subjectName,
      quarter: lesson.quarter,
      sourceRecordId: lesson.id,
      sourceCollection: "lessons",
      targetRoute: `/admin/curriculum-map?lessonId=${lesson.id}`,
      createdAt: lesson.createdAt
    });
  }
  for (const asgn of assignments) {
    if (asgn.status === "draft" || !asgn.dueDate || !/^\d{4}-\d{2}-\d{2}/.test(asgn.dueDate)) continue;
    const dateOnly = asgn.dueDate.slice(0, 10);
    events.push({
      id: `cal_asgn_${asgn.id}`,
      institutionId,
      title: `Topshiriq: ${asgn.title}`,
      description: asgn.description,
      category: "assignment",
      date: dateOnly,
      classCode: asgn.classCode || asgn.targetClassCodes[0],
      targetClassCodes: asgn.targetClassCodes,
      subject: asgn.subject,
      sourceRecordId: asgn.id,
      sourceCollection: "assignments",
      targetRoute: `/admin/assignments?assignmentId=${asgn.id}`,
      createdAt: asgn.createdAt
    });
  }
  for (const asmt of assessments) {
    if (asmt.status === "archived" || !asmt.dueDate || !/^\d{4}-\d{2}-\d{2}/.test(asmt.dueDate)) continue;
    const dateOnly = asmt.dueDate.slice(0, 10);
    const upperTitle = asmt.title.toUpperCase();
    const category = upperTitle.includes("CHSB") ? "chsb" : upperTitle.includes("BSB") ? "bsb" : "assessment";
    events.push({
      id: `cal_asmt_${asmt.id}`,
      institutionId,
      title: `${category === "bsb" ? "BSB" : category === "chsb" ? "CHSB" : "Nazorat"}: ${asmt.title}`,
      description: asmt.description,
      category,
      date: dateOnly,
      classCode: asmt.classCode || asmt.assignedClassCodes?.[0],
      targetClassCodes: asmt.assignedClassCodes,
      subject: asmt.subject,
      quarter: asmt.quarter,
      sourceRecordId: asmt.id,
      sourceCollection: "assessments",
      targetRoute: `/assessments/${asmt.id}`,
      createdAt: asmt.createdAt
    });
  }
  for (const ann of announcements) {
    if (ann.status !== "published" || !ann.publicationDate || !/^\d{4}-\d{2}-\d{2}/.test(ann.publicationDate)) continue;
    events.push({
      id: `cal_ann_${ann.id}`,
      institutionId,
      title: `E'lon: ${ann.title}`,
      description: ann.shortContent,
      category: "announcement",
      date: ann.publicationDate.slice(0, 10),
      classCode: ann.targetClassCodes[0],
      targetClassCodes: ann.targetClassCodes,
      subject: ann.targetSubjects[0],
      sourceRecordId: ann.id,
      sourceCollection: "announcements",
      targetRoute: `/admin/announcements?announcementId=${ann.id}`,
      createdAt: ann.createdAt
    });
  }
  const highStakesByClassDate = /* @__PURE__ */ new Map();
  for (const ev of events) {
    if (ev.category === "bsb" || ev.category === "chsb" || ev.category === "assessment") {
      const classes = ev.targetClassCodes?.length ? ev.targetClassCodes : ev.classCode ? [ev.classCode] : [];
      for (const cls of classes) {
        const key = `${cls}_${ev.date}`;
        const list = highStakesByClassDate.get(key) || [];
        list.push(ev);
        highStakesByClassDate.set(key, list);
      }
    }
  }
  for (const [, list] of highStakesByClassDate.entries()) {
    if (list.length > 1) {
      for (const ev of list) {
        ev.hasConflictWarning = true;
        ev.conflictMessage = `Diqqat: Shu kuni ushbu sinfda ${list.length} ta nazorat/BSB/CHSB belgilangan.`;
      }
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || "").localeCompare(b.startTime || ""));
}
var DEFAULT_GRADING_RUBRICS = [
  {
    id: "rubric_math_standard",
    institutionId: "inst-1",
    title: "Matematika va Aniq fanlar yozma ish rubrikasi",
    subject: "Matematika",
    description: "Masalani yechish bosqichlari, mantiqiy asoslash va hisoblash aniqligini baholash mezoni.",
    isDefault: true,
    totalMaxPoints: 10,
    criteria: [
      {
        id: "crit_solution",
        title: "To'g'ri yechim",
        description: "Masala shartiga mos formula va yechish usulining to'g'ri tanlangani",
        maxPoints: 3,
        partialCreditRules: "Usul to'g'ri tanlangan, ammo oraliq qadam tushirib qoldirilgan bo'lsa 1.5\u20132 ball"
      },
      {
        id: "crit_logic",
        title: "Mantiqiy fikrlash",
        description: "Qadamlar ketma-ketligi va mantiqiy asoslashning izchilligi",
        maxPoints: 2,
        partialCreditRules: "Asoslash qisman keltirilgan bo\u2018lsa 1 ball"
      },
      {
        id: "crit_calc",
        title: "Hisoblash aniqligi",
        description: "Arifmetik va algebraik amallarning xatosiz bajarilishi",
        maxPoints: 2,
        partialCreditRules: "Kichik arifmetik xato mavjud bo\u2018lsa 1 ball"
      },
      {
        id: "crit_explanation",
        title: "Tushuntirish",
        description: "Chizma, belgilashlar va izohlarning tushunarli yozilishi",
        maxPoints: 1,
        partialCreditRules: "Izohlar qisqa bo\u2018lsa 0.5 ball"
      },
      {
        id: "crit_final",
        title: "Yakuniy javob",
        description: "Yakuniy javob va o'lchov birliklarining aniq ko'rsatilishi",
        maxPoints: 2,
        partialCreditRules: "O'lchov birligi yozilmagan bo'lsa 1 ball"
      }
    ],
    createdByUid: "system",
    createdByName: "Platform Admin",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z"
  },
  {
    id: "rubric_science_lab",
    institutionId: "inst-1",
    title: "Tabiiy fanlar (Fizika, Kimyo, Biologiya) tahliliy ish rubrikasi",
    subject: "Fizika",
    description: "Tajriba, reaksiya tenglamalari va ilmiy xulosalarni baholash mezoni.",
    isDefault: true,
    totalMaxPoints: 10,
    criteria: [
      {
        id: "crit_sci_concept",
        title: "To'g'ri yechim",
        description: "Qonuniyat, formula yoki reaksiya tenglamasining to\u2018g\u2018ri yozilishi",
        maxPoints: 3,
        partialCreditRules: "Koeffitsiyentlarda xato bo\u2018lsa 1.5 ball"
      },
      {
        id: "crit_sci_logic",
        title: "Mantiqiy fikrlash",
        description: "Sabab-oqibat bog\u2018lanishining ilmiy asoslangani",
        maxPoints: 3,
        partialCreditRules: "Qisman asoslangan bo\u2018lsa 1.5 ball"
      },
      {
        id: "crit_sci_explanation",
        title: "Tushuntirish",
        description: "Atamalar va jarayonning aniq izohlanishi",
        maxPoints: 2,
        partialCreditRules: "1 ball qisman izoh uchun"
      },
      {
        id: "crit_sci_final",
        title: "Yakuniy javob",
        description: "Xulosa va yakuniy natijaning to\u2018g\u2018riligi",
        maxPoints: 2,
        partialCreditRules: "Xulosa to\u2018liq bo\u2018lmasa 1 ball"
      }
    ],
    createdByUid: "system",
    createdByName: "Platform Admin",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z"
  }
];
var DEFAULT_FEEDBACK_COMMENTS = [
  {
    id: "fb_1",
    institutionId: "inst-1",
    category: "praise",
    text: "Yechish usuli va mantiqiy qadamlar juda aniq ko'rsatilgan. Barakalla!",
    createdByUid: "system",
    createdAt: "2025-01-01T00:00:00.000Z"
  },
  {
    id: "fb_2",
    institutionId: "inst-1",
    category: "correction",
    text: "Formula to'g'ri tanlangan, biroq oraliq hisoblashda ishora xatosiga yo'l qo'yilgan.",
    createdByUid: "system",
    createdAt: "2025-01-01T00:00:00.000Z"
  },
  {
    id: "fb_3",
    institutionId: "inst-1",
    category: "methodology",
    text: "Yakuniy javobni yozishdan oldin har bir bosqich izohini qisqacha keltiring.",
    createdByUid: "system",
    createdAt: "2025-01-01T00:00:00.000Z"
  },
  {
    id: "fb_4",
    institutionId: "inst-1",
    category: "next_step",
    text: "Mavzuni mustahkamlash uchun o'quv xaritadagi keyingi amaliy mashqlarni bajarib ko'ring.",
    createdByUid: "system",
    createdAt: "2025-01-01T00:00:00.000Z"
  }
];

// src/server/dbEngine.ts
var DATA_DIR = path.resolve(process.cwd(), ".data");
var PROD_DB_PATH = path.join(DATA_DIR, "learnos_prod.json");
var TEST_DB_PATH = path.join(DATA_DIR, "learnos_test.json");
var configuredSessionSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === "production" && (!configuredSessionSecret || configuredSessionSecret.length < 32 || configuredSessionSecret.includes("REPLACE_WITH"))) {
  throw new Error("Production requires a random SESSION_SECRET of at least 32 characters.");
}
var TOKEN_SECRET = configuredSessionSecret || crypto3.randomBytes(32).toString("hex");
function ensureSpecializedStudyStructure(state) {
  const nowIso = "2026-01-01T00:00:00.000Z";
  if (!Array.isArray(state.institutions)) {
    state.institutions = [];
  }
  let primaryInst = state.institutions[0];
  if (!primaryInst) {
    primaryInst = {
      id: DEFAULT_INSTITUTION_ID,
      name: "Specialized Study Ixtisoslashtirilgan Maktabi",
      shortName: "Specialized Study",
      officialName: "Specialized Study Ixtisoslashtirilgan Maktabi",
      type: "specialized_school",
      code: "SPEC-STUDY-01",
      region: "Toshkent shahri",
      district: "Mirzo Ulug\u2018bek tumani",
      academicYear: "2026-2027",
      supportedGrades: [5, 6, 7, 8, 9, 10, 11],
      gradingScale: "100_percent",
      languageOfInstruction: "O'zbek tili",
      timezone: "Asia/Tashkent",
      status: "active",
      adminUid: "admin-owner",
      allowExcelImports: true,
      aiFeaturesEnabled: true,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    state.institutions.push(primaryInst);
  } else {
    if (!primaryInst.name || primaryInst.name.includes("LearnOS")) {
      primaryInst.name = "Specialized Study Ixtisoslashtirilgan Maktabi";
      primaryInst.shortName = "Specialized Study";
    }
    if (!primaryInst.academicYear) {
      primaryInst.academicYear = "2026-2027";
    }
  }
  const instId = primaryInst.id;
  const academicYear = primaryInst.academicYear || "2026-2027";
  if (!Array.isArray(state.subjects)) {
    state.subjects = [];
  }
  for (const defSubj of DEFAULT_SUBJECTS) {
    const existing = state.subjects.find(
      (s) => s.id === defSubj.id || s.name.trim().toLowerCase() === defSubj.name.trim().toLowerCase()
    );
    if (!existing) {
      state.subjects.push({
        ...defSubj,
        institutionId: instId
      });
    } else {
      existing.code = defSubj.code;
      existing.trackTypes = existing.trackTypes?.length ? existing.trackTypes : [...defSubj.trackTypes];
      existing.applicableGrades = existing.applicableGrades?.length ? existing.applicableGrades : [...defSubj.applicableGrades];
      existing.applicableClassCodes = existing.applicableClassCodes?.length ? existing.applicableClassCodes : [...defSubj.applicableClassCodes];
      if (!existing.status) existing.status = "active";
    }
  }
  if (!Array.isArray(state.classes)) {
    state.classes = [];
  }
  state.classes = state.classes.filter((c) => {
    const raw = String(c.code || c.name || "").trim().toLowerCase();
    return raw !== "5t" && raw !== "6t";
  });
  const seenOfficialCodes = /* @__PURE__ */ new Set();
  const deduplicatedClasses = [];
  for (const cls of state.classes) {
    const rawCode = String(cls.code || cls.name || "").trim().toLowerCase();
    const parsed = parseOfficialClassCode(rawCode);
    if (parsed) {
      if (seenOfficialCodes.has(parsed.code)) {
        continue;
      }
      seenOfficialCodes.add(parsed.code);
      const { subjectIds, subjectNames } = getDefaultSubjectsForTrack(parsed.track);
      cls.id = cls.id || `class-${parsed.code}`;
      cls.code = parsed.code;
      cls.name = parsed.code;
      cls.grade = parsed.grade;
      cls.track = parsed.track;
      cls.trackLabel = parsed.trackLabel;
      cls.section = parsed.section;
      cls.academicYear = cls.academicYear || academicYear;
      cls.institutionId = cls.institutionId || instId;
      cls.subjectIds = cls.subjectIds?.length ? cls.subjectIds : subjectIds;
      cls.subjectNames = cls.subjectNames?.length ? cls.subjectNames : subjectNames;
      cls.subject = cls.subject || (parsed.track === "A" ? "Matematika" : "Biologiya");
      cls.inviteCode = cls.inviteCode || `SS-${parsed.code.toUpperCase()}-2026`;
      cls.status = cls.status || "active";
      deduplicatedClasses.push(cls);
    } else {
      deduplicatedClasses.push(cls);
    }
  }
  for (const code of OFFICIAL_19_CLASS_CODES) {
    if (!seenOfficialCodes.has(code)) {
      const meta = parseOfficialClassCode(code);
      const { subjectIds, subjectNames } = getDefaultSubjectsForTrack(meta.track);
      deduplicatedClasses.push({
        id: `class-${code}`,
        code,
        name: code,
        grade: meta.grade,
        track: meta.track,
        trackLabel: meta.trackLabel,
        section: meta.section,
        academicYear,
        subject: meta.track === "A" ? "Matematika" : "Biologiya",
        subjectIds,
        subjectNames,
        teacherId: primaryInst.adminUid || "admin-owner",
        teacherName: "Specialized Study",
        institutionId: instId,
        inviteCode: `SS-${code.toUpperCase()}-2026`,
        studentCount: 0,
        status: "active",
        createdAt: nowIso,
        updatedAt: nowIso
      });
      seenOfficialCodes.add(code);
    }
  }
  const orderMap = new Map(
    OFFICIAL_19_CLASS_CODES.map((c, idx) => [c, idx])
  );
  deduplicatedClasses.sort((a, b) => {
    const idxA = orderMap.has(a.code) ? orderMap.get(a.code) : 999;
    const idxB = orderMap.has(b.code) ? orderMap.get(b.code) : 999;
    return idxA - idxB;
  });
  if (!state.customClaims || typeof state.customClaims !== "object") {
    state.customClaims = {};
  }
  const usersList = Array.isArray(state.users) ? state.users : [];
  for (const usr of usersList) {
    const normalizedEmail = String(usr.email || "").trim().toLowerCase();
    const isAuthAdminEmail = isAuthorizedAdminEmail(normalizedEmail);
    if (isAuthAdminEmail && usr.emailVerified !== false && usr.platformAdmin !== false) {
      usr.role = "platform_owner";
      usr.platformOwner = true;
      usr.platformAdmin = true;
      state.customClaims[usr.uid] = {
        ...state.customClaims[usr.uid] || {},
        platformAdmin: true
      };
    } else if (!isAuthAdminEmail && (usr.role === "platform_owner" || usr.role === "admin")) {
      usr.role = "student";
      usr.platformOwner = false;
      usr.platformAdmin = false;
    }
  }
  for (const cls of deduplicatedClasses) {
    const actualCount = usersList.filter(
      (u) => u.role === "student" && u.status !== "suspended" && u.status !== "archived" && (u.classId === cls.id || u.classCode && u.classCode.toLowerCase() === cls.code.toLowerCase())
    ).length;
    cls.studentCount = actualCount;
  }
  state.classes = deduplicatedClasses;
  if (!Array.isArray(state.workPlans)) {
    state.workPlans = [];
  }
  if (!Array.isArray(state.lessons)) {
    state.lessons = [];
  }
  if (!Array.isArray(state.studentImportJobs)) {
    state.studentImportJobs = [];
  }
  if (!Array.isArray(state.curriculumImportJobs)) {
    state.curriculumImportJobs = [];
  }
  if (!Array.isArray(state.academicYears) || state.academicYears.length === 0) {
    state.academicYears = [...DEFAULT_ACADEMIC_YEARS];
  }
  if (!Array.isArray(state.topics) || state.topics.length === 0) {
    state.topics = [...DEFAULT_CURRICULUM_TOPICS];
  }
  if (!Array.isArray(state.studentGamificationProfiles)) {
    state.studentGamificationProfiles = [];
  }
  if (!Array.isArray(state.learningCheckins)) {
    state.learningCheckins = [];
  }
  if (!Array.isArray(state.studentGoals)) {
    state.studentGoals = [];
  }
  if (!Array.isArray(state.learningActivityEvents)) {
    state.learningActivityEvents = [];
  }
  if (!Array.isArray(state.xpLedger)) {
    state.xpLedger = [];
  }
  if (!Array.isArray(state.gamificationBadges) || state.gamificationBadges.length === 0) {
    state.gamificationBadges = DEFAULT_GAMIFICATION_BADGES.map((b) => ({ ...b }));
  }
  if (!Array.isArray(state.studentBadges)) {
    state.studentBadges = [];
  }
  if (!Array.isArray(state.streakRecords)) {
    state.streakRecords = [];
  }
  if (!Array.isArray(state.weeklyRecaps)) {
    state.weeklyRecaps = [];
  }
  if (!Array.isArray(state.classChallenges)) {
    state.classChallenges = [];
  }
  if (!state.gamificationConfig) {
    state.gamificationConfig = {
      ...DEFAULT_GAMIFICATION_CONFIG,
      xpRewards: { ...DEFAULT_GAMIFICATION_CONFIG.xpRewards },
      goalTemplates: [...DEFAULT_GAMIFICATION_CONFIG.goalTemplates]
    };
  }
  if (!Array.isArray(state.studentLessonCompletions)) {
    state.studentLessonCompletions = [];
  }
  if (!Array.isArray(state.attendanceSessions)) {
    state.attendanceSessions = [];
  }
  if (!Array.isArray(state.attendanceRecords)) {
    state.attendanceRecords = [];
  }
  if (!Array.isArray(state.studentAssignments)) {
    state.studentAssignments = [];
  }
  if (!Array.isArray(state.assignmentSubmissions)) {
    state.assignmentSubmissions = [];
  }
  if (!Array.isArray(state.studentAlerts)) {
    state.studentAlerts = [];
  }
  if (!Array.isArray(state.studentSupportPlans)) {
    state.studentSupportPlans = [];
  }
  if (!Array.isArray(state.academicReports)) {
    state.academicReports = [];
  }
  if (!Array.isArray(state.timetables)) {
    state.timetables = [];
  }
  if (!Array.isArray(state.timetableEntries)) {
    state.timetableEntries = [];
  }
  if (!Array.isArray(state.submissionRevisions)) {
    state.submissionRevisions = [];
  }
  if (!Array.isArray(state.announcements)) {
    state.announcements = [];
  }
  if (!Array.isArray(state.announcementReads)) {
    state.announcementReads = [];
  }
  if (!Array.isArray(state.announcementAcknowledgements)) {
    state.announcementAcknowledgements = [];
  }
  if (!Array.isArray(state.learningMaterials)) {
    state.learningMaterials = [];
  }
  if (!Array.isArray(state.gradingRubrics) || state.gradingRubrics.length === 0) {
    state.gradingRubrics = DEFAULT_GRADING_RUBRICS.map((r) => ({ ...r, institutionId: instId }));
  }
  if (!Array.isArray(state.feedbackComments) || state.feedbackComments.length === 0) {
    state.feedbackComments = DEFAULT_FEEDBACK_COMMENTS.map((c) => ({ ...c, institutionId: instId }));
  }
  if (!Array.isArray(state.gradingHistory)) {
    state.gradingHistory = [];
  }
  if (!Array.isArray(state.academicEvents)) {
    state.academicEvents = [];
  }
  if (!Array.isArray(state.lessonDeliveryRecords)) {
    state.lessonDeliveryRecords = [];
  }
  return state;
}
function createEmptyDatabaseState() {
  const base = {
    institutions: [
      {
        id: DEFAULT_INSTITUTION_ID,
        name: "Specialized Study Ixtisoslashtirilgan Maktabi",
        shortName: "Specialized Study",
        officialName: "Specialized Study Ixtisoslashtirilgan Maktabi",
        type: "specialized_school",
        code: "SPEC-STUDY-01",
        region: "Toshkent shahri",
        district: "Mirzo Ulug\u2018bek tumani",
        academicYear: "2026-2027",
        supportedGrades: [5, 6, 7, 8, 9, 10, 11],
        gradingScale: "100_percent",
        languageOfInstruction: "O'zbek tili",
        timezone: "Asia/Tashkent",
        status: "active",
        adminUid: "admin-owner",
        allowExcelImports: true,
        aiFeaturesEnabled: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    institutionSettings: [],
    academicYears: [...DEFAULT_ACADEMIC_YEARS],
    users: [],
    passwordHashes: {},
    classes: buildOfficial19Classes(DEFAULT_INSTITUTION_ID, "2026-2027", "admin-owner"),
    classMemberships: [],
    teacherAssignments: [],
    studentEnrollments: [],
    parentLinks: [],
    invitations: [],
    subjects: DEFAULT_SUBJECTS.map((s) => ({ ...s, institutionId: DEFAULT_INSTITUTION_ID })),
    topics: [...DEFAULT_CURRICULUM_TOPICS],
    workPlans: [],
    lessons: [],
    questions: [],
    questionRevisions: [],
    questionMedia: [],
    assessments: [],
    assignments: [],
    attempts: [],
    gradingRecords: [],
    importBatches: [],
    studentImportJobs: [],
    curriculumImportJobs: [],
    masteryRecords: [],
    learningPaths: [],
    learningRecommendations: [],
    notifications: [],
    teacherNotes: [],
    auditLogs: [],
    studentGamificationProfiles: [],
    learningCheckins: [],
    studentGoals: [],
    learningActivityEvents: [],
    xpLedger: [],
    gamificationBadges: DEFAULT_GAMIFICATION_BADGES.map((b) => ({ ...b })),
    studentBadges: [],
    streakRecords: [],
    weeklyRecaps: [],
    classChallenges: [],
    gamificationConfig: {
      ...DEFAULT_GAMIFICATION_CONFIG,
      xpRewards: { ...DEFAULT_GAMIFICATION_CONFIG.xpRewards },
      goalTemplates: [...DEFAULT_GAMIFICATION_CONFIG.goalTemplates]
    },
    studentLessonCompletions: [],
    attendanceSessions: [],
    attendanceRecords: [],
    studentAssignments: [],
    assignmentSubmissions: [],
    studentAlerts: [],
    studentSupportPlans: [],
    academicReports: [],
    timetables: [],
    timetableEntries: [],
    submissionRevisions: [],
    announcements: [],
    announcementReads: [],
    announcementAcknowledgements: [],
    learningMaterials: [],
    gradingRubrics: DEFAULT_GRADING_RUBRICS.map((r) => ({ ...r, institutionId: DEFAULT_INSTITUTION_ID })),
    feedbackComments: DEFAULT_FEEDBACK_COMMENTS.map((c) => ({ ...c, institutionId: DEFAULT_INSTITUTION_ID })),
    gradingHistory: [],
    academicEvents: [],
    lessonDeliveryRecords: []
  };
  return ensureSpecializedStudyStructure(base);
}
function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 511 });
    }
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
    return DATA_DIR;
  } catch {
    const tmpDir = path.join("/tmp", ".data");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true, mode: 511 });
    }
    return tmpDir;
  }
}
function resolveDbPaths(env) {
  const writableDir = ensureDataDir();
  const fileName = env === "test" ? "learnos_test.json" : "learnos_prod.json";
  const writePath = path.join(writableDir, fileName);
  const bundledPath = env === "test" ? TEST_DB_PATH : PROD_DB_PATH;
  if (fs.existsSync(writePath)) {
    return { readPath: writePath, writePath };
  }
  if (fs.existsSync(bundledPath)) {
    return { readPath: bundledPath, writePath };
  }
  return { readPath: writePath, writePath };
}
var memoryCache = {
  prod: null,
  test: null
};
function getDbState(env = "prod") {
  const context = requestDatabase.getStore();
  if (env === "prod" && context) return context.state;
  if (env === "prod" && process.env.PERSISTENCE_DRIVER === "firestore") {
    throw new Error("Cloud persistence requires an isolated request context.");
  }
  if (memoryCache[env]) {
    return memoryCache[env];
  }
  const { readPath } = resolveDbPaths(env);
  if (fs.existsSync(readPath)) {
    try {
      const raw = fs.readFileSync(readPath, "utf-8");
      const parsed = JSON.parse(raw);
      const merged = ensureSpecializedStudyStructure({
        ...createEmptyDatabaseState(),
        ...parsed
      });
      memoryCache[env] = merged;
      return merged;
    } catch (err) {
      console.warn(`Error reading ${readPath}, initializing clean state:`, err);
    }
  }
  const fresh = createEmptyDatabaseState();
  memoryCache[env] = fresh;
  saveDbState(env, fresh);
  return fresh;
}
function saveDbState(env, state) {
  const context = requestDatabase.getStore();
  if (env === "prod" && context) {
    context.state = state;
    context.dirty = true;
    return;
  }
  if (env === "prod" && process.env.PERSISTENCE_DRIVER === "firestore") {
    throw new Error("Cloud persistence cannot fall back to a local file.");
  }
  memoryCache[env] = state;
  const { writePath } = resolveDbPaths(env);
  const serialized = JSON.stringify(state);
  try {
    fs.writeFileSync(writePath, serialized, { encoding: "utf-8", mode: 438 });
    try {
      fs.chmodSync(writePath, 438);
    } catch {
    }
  } catch (err) {
    try {
      const fallbackDir = path.join("/tmp", ".data");
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true, mode: 511 });
      }
      const fallbackFile = path.join(
        fallbackDir,
        env === "test" ? "learnos_test.json" : "learnos_prod.json"
      );
      fs.writeFileSync(fallbackFile, serialized, { encoding: "utf-8", mode: 438 });
    } catch {
      console.warn("In-memory state preserved; disk write skipped:", err);
    }
  }
}
var revokedTokenSet = /* @__PURE__ */ new Set();
var revokedBeforeTimestampByUser = /* @__PURE__ */ new Map();
function resetTestDbState() {
  const { writePath } = resolveDbPaths("test");
  const empty = createEmptyDatabaseState();
  memoryCache.test = empty;
  revokedTokenSet.clear();
  revokedBeforeTimestampByUser.clear();
  try {
    if (fs.existsSync(writePath)) {
      fs.unlinkSync(writePath);
    }
  } catch {
  }
  saveDbState("test", empty);
}
function hashPassword(password) {
  const salt = crypto3.randomBytes(16).toString("hex");
  const derived = crypto3.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
function generateSecureRandomPassword() {
  return `SS-${crypto3.randomBytes(16).toString("hex")}!9a`;
}
function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, key] = storedHash.split(":");
  const derived = crypto3.scryptSync(password, salt, 64).toString("hex");
  const keyBuf = Buffer.from(key, "hex");
  const derivedBuf = Buffer.from(derived, "hex");
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto3.timingSafeEqual(keyBuf, derivedBuf);
}
function revokeSessionToken(token) {
  if (!token) return;
  const context = requestDatabase.getStore();
  if (context) {
    const now = Date.now();
    context.state.revokedSessionHashes = Object.fromEntries(Object.entries(context.state.revokedSessionHashes || {}).filter(([, expiry]) => expiry > now));
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
      context.state.revokedSessionHashes[crypto3.createHash("sha256").update(token.trim()).digest("hex")] = Number(payload.exp) || now + 6048e5;
      context.dirty = true;
    } catch {
    }
    return;
  }
  revokedTokenSet.add(token.trim());
}
function revokeAllUserSessions(uid) {
  if (!uid) return;
  const context = requestDatabase.getStore();
  if (context) {
    context.state.revokedBeforeByUser ||= {};
    context.state.revokedBeforeByUser[uid] = Date.now();
    context.dirty = true;
    return;
  }
  revokedBeforeTimestampByUser.set(uid, Date.now());
}
function issueSessionToken(uid, env, expiresInMs = 1e3 * 60 * 60 * 24 * 7) {
  const now = Date.now();
  const payload = JSON.stringify({
    uid,
    env,
    jti: crypto3.randomBytes(8).toString("hex"),
    iat: now,
    exp: now + expiresInMs
  });
  const base64Payload = Buffer.from(payload, "utf-8").toString("base64url");
  const signature = crypto3.createHmac("sha256", TOKEN_SECRET).update(base64Payload).digest("base64url");
  return `${base64Payload}.${signature}`;
}
function verifySessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const cleanToken = token.trim();
  if (revokedTokenSet.has(cleanToken)) return null;
  const durableRevocations = requestDatabase.getStore()?.state.revokedSessionHashes;
  if (durableRevocations?.[crypto3.createHash("sha256").update(cleanToken).digest("hex")]) return null;
  const parts = cleanToken.split(".");
  if (parts.length !== 2) return null;
  const [base64Payload, signature] = parts;
  if (!base64Payload || !signature) return null;
  const expectedSig = crypto3.createHmac("sha256", TOKEN_SECRET).update(base64Payload).digest("base64url");
  const sigBuf = Buffer.from(signature, "utf-8");
  const expectedBuf = Buffer.from(expectedSig, "utf-8");
  if (sigBuf.length !== expectedBuf.length || !crypto3.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(base64Payload, "base64url").toString("utf-8"));
    if (!decoded.uid || typeof decoded.exp !== "number" || decoded.exp < Date.now()) {
      return null;
    }
    const revokedBefore = requestDatabase.getStore()?.state.revokedBeforeByUser?.[decoded.uid] || revokedBeforeTimestampByUser.get(decoded.uid);
    if (revokedBefore && typeof decoded.iat === "number" && decoded.iat <= revokedBefore) {
      return null;
    }
    return {
      uid: decoded.uid,
      env: decoded.env === "test" ? "test" : "prod"
    };
  } catch {
    return null;
  }
}
function generateCryptographicInviteToken(rolePrefix) {
  const rand = crypto3.randomBytes(4).toString("hex").toUpperCase();
  const rawToken = `INV-${rolePrefix.slice(0, 3).toUpperCase()}-${rand}`;
  const tokenHash = computeSimpleHash(rawToken);
  return { rawToken, tokenHash };
}

// src/server/firebaseAdminAuth.ts
var CONFIG_PATH = path2.resolve(process.cwd(), "firebase-applet-config.json");
var TEST_ID_TOKEN_SECRET = "specialized-study-isolated-test-jwt-secret-2026";
function loadFirebaseAppletConfig() {
  const raw = fs2.readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw);
}
var cachedAdminApp = null;
function getFirebaseAdminApp() {
  if (!cachedAdminApp) {
    const cfg = loadFirebaseAppletConfig();
    const existing = getApps();
    cachedAdminApp = existing.length > 0 ? existing[0] : initializeApp({
      projectId: cfg.projectId,
      ...process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT ? { credential: cert(JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT)) } : {}
    });
  }
  return cachedAdminApp;
}
function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}
async function verifyFirebaseIdToken(idToken, env, db) {
  if (!idToken || typeof idToken !== "string" || !idToken.trim()) {
    return {
      valid: false,
      errorCode: "auth/missing-id-token",
      errorMessage: "Firebase ID token topilmadi."
    };
  }
  const trimmed = idToken.trim();
  if (env === "test" && trimmed.startsWith("test-fb-jwt.")) {
    const parts = trimmed.split(".");
    if (parts.length !== 3) {
      return {
        valid: false,
        errorCode: "auth/invalid-id-token",
        errorMessage: "Noto\u2018g\u2018ri token formati."
      };
    }
    const [, encoded, sig] = parts;
    const expectedSig = crypto4.createHmac("sha256", TEST_ID_TOKEN_SECRET).update(`test-fb-jwt.${encoded}`).digest("base64url");
    const sigBuf = Buffer.from(sig, "utf-8");
    const expBuf = Buffer.from(expectedSig, "utf-8");
    if (sigBuf.length !== expBuf.length || !crypto4.timingSafeEqual(sigBuf, expBuf)) {
      return {
        valid: false,
        errorCode: "auth/invalid-credential",
        errorMessage: "Token imzosi haqiqiy emas."
      };
    }
    try {
      const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
      const nowSec = Math.floor(Date.now() / 1e3);
      if (typeof decoded.exp !== "number" || decoded.exp <= nowSec) {
        return {
          valid: false,
          errorCode: "auth/id-token-expired",
          errorMessage: "Firebase ID token muddati tugagan. Qaytadan tizimga kiring."
        };
      }
      const uid = String(decoded.uid || decoded.sub || "").trim();
      const email = String(decoded.email || "").trim().toLowerCase();
      if (!uid || !email) {
        return {
          valid: false,
          errorCode: "auth/invalid-id-token",
          errorMessage: "Token tarkibida foydalanuvchi identifikatori (UID/Email) mavjud emas."
        };
      }
      const storedClaims = db.customClaims && db.customClaims[uid] || {};
      const mergedClaims = {
        ...storedClaims,
        ...decoded.claims || {}
      };
      return {
        valid: true,
        identity: {
          uid,
          email,
          emailVerified: decoded.email_verified === true,
          displayName: decoded.name ? String(decoded.name) : void 0,
          customClaims: mergedClaims,
          issuedAtSeconds: Number(decoded.iat || nowSec),
          expiresAtSeconds: Number(decoded.exp),
          verificationSource: "isolated_test_token"
        }
      };
    } catch {
      return {
        valid: false,
        errorCode: "auth/invalid-id-token",
        errorMessage: "Token ma\u2019lumotlarini o\u2018qib bo\u2018lmadi."
      };
    }
  }
  try {
    const adminAuth = getFirebaseAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(trimmed, true);
    const uid = String(decodedToken.uid || decodedToken.sub || "").trim();
    const email = String(decodedToken.email || "").trim().toLowerCase();
    if (!uid || !email) {
      return {
        valid: false,
        errorCode: "auth/invalid-id-token",
        errorMessage: "Tasdiqlangan Google hisobida email manzili mavjud emas."
      };
    }
    const customClaims = {
      platformAdmin: decodedToken.platformAdmin === true
    };
    return {
      valid: true,
      identity: {
        uid,
        email,
        emailVerified: decodedToken.email_verified === true,
        displayName: decodedToken.name ? String(decodedToken.name) : void 0,
        photoURL: decodedToken.picture ? String(decodedToken.picture) : void 0,
        customClaims,
        issuedAtSeconds: decodedToken.iat,
        expiresAtSeconds: decodedToken.exp,
        verificationSource: "firebase_admin_jwt"
      }
    };
  } catch (adminErr) {
    const code = String(adminErr?.code || "");
    if (code === "auth/id-token-expired") {
      return {
        valid: false,
        errorCode: code,
        errorMessage: "Sessiya muddati tugagan. Iltimos, Google orqali qayta kiring."
      };
    }
    return {
      valid: false,
      errorCode: "auth/invalid-credential",
      errorMessage: "Firebase hisobini tekshirib bo\u2018lmadi. Qayta kiring yoki administratorga murojaat qiling."
    };
  }
}
async function provisionSingleAdminAccount(targetEmail, env, db) {
  const normalizedEmail = String(targetEmail || "").trim().toLowerCase();
  if (!isAuthorizedAdminEmail(normalizedEmail)) {
    throw new Error(`Unauthorized administrator email: ${normalizedEmail}`);
  }
  if (!db.customClaims) {
    db.customClaims = {};
  }
  let fbUserRecord = null;
  let firebaseAdminSdkClaimSynced = false;
  if (env === "prod") {
    try {
      const adminAuth = getFirebaseAdminAuth();
      const userRec = await adminAuth.getUserByEmail(normalizedEmail);
      fbUserRecord = {
        uid: userRec.uid,
        email: (userRec.email || normalizedEmail).toLowerCase(),
        emailVerified: userRec.emailVerified,
        displayName: userRec.displayName || void 0,
        customClaims: userRec.customClaims || {}
      };
    } catch {
    }
  }
  const dbUser = db.users.find((u) => u.email.trim().toLowerCase() === normalizedEmail);
  const resolvedUid = fbUserRecord?.uid || dbUser?.uid || null;
  if (!resolvedUid) {
    return {
      email: normalizedEmail,
      existsInFirebaseOrDb: false,
      uid: null,
      emailVerified: false,
      platformAdminClaimAssigned: false,
      preservedCustomClaims: {},
      firebaseAdminSdkClaimSynced: false,
      status: "awaiting_first_google_login",
      message: `${normalizedEmail} hali Google orqali tizimga kirmagan. Haqiqiy Firebase UID yaratilishi uchun foydalanuvchi avval \xABGoogle bilan kirish\xBB tugmasi orqali autentifikatsiyadan o\u2018tishi shart.`
    };
  }
  const isEmailVerified = fbUserRecord !== null ? fbUserRecord.emailVerified : dbUser?.emailVerified === true;
  if (!isEmailVerified) {
    return {
      email: normalizedEmail,
      existsInFirebaseOrDb: true,
      uid: resolvedUid,
      emailVerified: false,
      platformAdminClaimAssigned: false,
      preservedCustomClaims: db.customClaims[resolvedUid] || {},
      firebaseAdminSdkClaimSynced: false,
      status: "awaiting_email_verification",
      message: `${normalizedEmail} hisobi mavjud (UID: ${resolvedUid}), biroq elektron pochta tasdiqlanmagan (emailVerified=false).`
    };
  }
  const existingClaims = {
    ...db.customClaims[resolvedUid] || {},
    ...fbUserRecord?.customClaims || {}
  };
  const updatedClaims = {
    ...existingClaims,
    platformAdmin: true
  };
  db.customClaims[resolvedUid] = updatedClaims;
  if (env === "prod") {
    try {
      const adminAuth = getFirebaseAdminAuth();
      await adminAuth.setCustomUserClaims(resolvedUid, updatedClaims);
      const verifiedRec = await adminAuth.getUser(resolvedUid);
      firebaseAdminSdkClaimSynced = verifiedRec.customClaims?.platformAdmin === true;
    } catch {
      firebaseAdminSdkClaimSynced = false;
    }
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const instId = db.institutions[0]?.id || "inst-specialized-study";
  if (dbUser) {
    dbUser.uid = resolvedUid;
    dbUser.role = "platform_owner";
    dbUser.platformOwner = true;
    dbUser.platformAdmin = true;
    dbUser.emailVerified = true;
    dbUser.status = "active";
    dbUser.updatedAt = nowIso;
  } else if (fbUserRecord) {
    db.users.push({
      uid: resolvedUid,
      displayName: fbUserRecord.displayName || (normalizedEmail === PLATFORM_OWNER_EMAIL ? "Asilbek Nuraliyev" : "Bahodir Boliqulov"),
      email: normalizedEmail,
      emailVerified: true,
      platformOwner: true,
      platformAdmin: true,
      role: "platform_owner",
      institutionId: instId,
      status: "active",
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }
  db.auditLogs.unshift({
    id: `audit-prov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    institutionId: instId,
    actorUid: resolvedUid,
    actorName: normalizedEmail,
    actorRole: "platform_owner",
    action: `Platform Admin custom claim (platformAdmin: true) tasdiqlandi: ${normalizedEmail}`,
    target: normalizedEmail,
    recordId: resolvedUid,
    status: "success",
    eventType: "ADMIN_CLAIM_PROVISIONED",
    outcome: "success",
    severity: "INFO",
    createdAt: nowIso
  });
  saveDbState(env, db);
  return {
    email: normalizedEmail,
    existsInFirebaseOrDb: true,
    uid: resolvedUid,
    emailVerified: true,
    platformAdminClaimAssigned: updatedClaims.platformAdmin === true,
    preservedCustomClaims: updatedClaims,
    firebaseAdminSdkClaimSynced,
    status: "active_admin",
    message: `${normalizedEmail} uchun platformAdmin: true ruxsati muvaffaqiyatli biriktirildi (UID: ${resolvedUid}).`
  };
}
async function provisionAuthorizedAdmins(env, db) {
  const results = [];
  for (const adminEmail of AUTHORIZED_ADMIN_EMAILS) {
    const res = await provisionSingleAdminAccount(adminEmail, env, db);
    results.push(res);
  }
  return {
    admins: results,
    allowlist: AUTHORIZED_ADMIN_EMAILS,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}

// src/server/examMedia.ts
async function storeExamImage(institutionId, examId, dataUrl) {
  const match = dataUrl.match(/^data:image\/(jpeg|png);base64,(.+)$/);
  if (!match) throw Error("Image format rejected");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 5e5 || bytes.length < 8) throw Error("Image size rejected");
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71, jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!(match[1] === "png" ? png : jpeg)) throw Error("Image signature rejected");
  const hash = crypto5.createHash("sha256").update(institutionId).update(bytes).digest("hex");
  const db = getFirestore(getFirebaseAdminApp(), loadFirebaseAppletConfig().firestoreDatabaseId);
  await db.doc(`_specialized_exam_media/${hash}`).set({ institutionId, data: match[2], mime: `image/${match[1]}`, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
  return `/api/exams/${examId}/media/${hash}`;
}
async function readExamImage(hash) {
  const db = getFirestore(getFirebaseAdminApp(), loadFirebaseAppletConfig().firestoreDatabaseId);
  const doc = await db.doc(`_specialized_exam_media/${hash}`).get();
  return doc.exists ? doc.data() : null;
}

// src/server/examRoutes.ts
import crypto6 from "node:crypto";
import { z as z3 } from "zod";

// src/utils/examPolicy.ts
function canTakeExam(user, exam) {
  if (user.role !== "student" || user.status !== "active" || user.institutionId !== exam.institutionId) return false;
  return Boolean(user.classId && [exam.classId, ...exam.assignedClassIds || []].includes(user.classId) || user.classCode && [exam.classCode, ...exam.assignedClassCodes || []].includes(user.classCode));
}
function examDeadline(exam, session, now = Date.now()) {
  const extension = (exam.totalPausedMs || 0) - session.pauseAtStart + (exam.examState === "paused" && exam.pausedAt ? Math.max(0, now - Date.parse(exam.pausedAt)) : 0);
  return Math.min(Date.parse(session.deadlineAt) + extension, Date.parse(exam.dueDate));
}
function examCanStart(exam, now = Date.now()) {
  return exam.status === "published" && (exam.examState === "open" || exam.examState === "scheduled") && now >= Date.parse(exam.availableFrom || exam.createdAt) && now < Date.parse(exam.dueDate);
}
function validateExamForPublish(exam) {
  const errors = [];
  const questions = exam.questionSnapshot || [];
  if (!questions.length) errors.push("Savollar yo\u2018q.");
  if (!Number.isFinite(Date.parse(exam.availableFrom || "")) || !Number.isFinite(Date.parse(exam.dueDate)) || Date.parse(exam.availableFrom) >= Date.parse(exam.dueDate)) errors.push("Boshlanish va tugash vaqtini tekshiring.");
  if (!exam.assignedClassCodes?.length) errors.push("Kamida bitta sinf tanlang.");
  for (const [i, q] of questions.entries()) {
    if (!q.prompt.trim() || !q.points || q.points <= 0) errors.push(`${i + 1}-savol matni yoki bali noto\u2018g\u2018ri.`);
    if (q.type === "single_choice") {
      if ((q.options?.length || 0) < 2 || !q.options?.includes(q.correctAnswer)) errors.push(`${i + 1}-savolning variantlari va javob kalitini tekshiring.`);
    } else if (!q.rubricText?.trim()) errors.push(`${i + 1}-savolga baholash mezonini yozing.`);
    if (exam.examKind === "CHSB" && q.type !== "single_choice") errors.push("CHSB savollari variantli bo\u2018lishi kerak.");
  }
  return errors;
}
function sanitizeExamQuestion(q) {
  return { ...q, correctAnswer: "", correctAnswers: void 0, acceptedAnswers: void 0, rubricText: void 0, explanation: "", optionItems: q.optionItems?.map((o) => ({ ...o, isCorrect: false })), structuredOptions: q.structuredOptions?.map((o) => ({ ...o, isCorrect: false })) };
}

// src/server/examRoutes.ts
var image = z3.string().max(65e4).refine((v) => /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(v), "Faqat JPEG/PNG tasvirlari.");
var question = z3.object({ sourceNumber: z3.number().int().positive(), variant: z3.string().max(12), prompt: z3.string().min(3).max(18e3), sourcePages: z3.array(z3.number().int().positive()).max(20), sourceImages: z3.array(image).max(20), fields: z3.array(z3.object({ id: z3.string().max(80), label: z3.string().max(120), imageIndex: z3.number().int().min(0), x: z3.number().min(0).max(1), y: z3.number().min(0).max(1), width: z3.number().min(0.01).max(1), height: z3.number().min(0.01).max(1) })).max(40), points: z3.number().min(0).max(100), type: z3.enum(["written_open", "single_choice"]), options: z3.array(z3.string().max(4e3)).max(8), correctAnswer: z3.string().max(4e3), rubricText: z3.string().max(12e3) });
var draftSchema = z3.object({ sourceLayoutVersion: z3.literal(2, { error: "Importni yangilash uchun sahifani qayta oching." }), title: z3.string().min(3).max(200), examKind: z3.enum(["BSB", "CHSB"]), examNumber: z3.number().int().min(1).max(2), quarter: z3.number().int().min(1).max(4), academicYear: z3.string().regex(/^\d{4}-\d{4}$/), subject: z3.string().min(2).max(100), classCodes: z3.array(z3.string()).min(1).max(19), durationMinutes: z3.number().int().min(1).max(180), availableFrom: z3.string().datetime(), dueDate: z3.string().datetime(), sourceFileName: z3.string().max(200), sourceHash: z3.string().regex(/^[a-f0-9]{64}$/), contextImages: z3.array(image).max(20), questions: z3.array(question).min(1).max(60) });
function registerExamRoutes(app2, deps) {
  const admin = (req, res) => {
    const c = deps.authenticate(req);
    if (!c) {
      res.status(401).json({ error: "Hisobga kiring." });
      return null;
    }
    if (!["admin", "platform_owner"].includes(c.user.role) || c.user.platformAdmin !== true || c.user.emailVerified !== true) {
      res.status(403).json({ error: "Faqat administrator." });
      return null;
    }
    return c;
  };
  app2.post("/api/exams/drafts", async (req, res) => {
    const c = admin(req, res);
    if (!c) return;
    const parsed = draftSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Ma\u2019lumot noto\u2018g\u2018ri." });
    const data = parsed.data;
    if (Buffer.byteLength(JSON.stringify(data)) > 32e5) return res.status(413).json({ error: "Tasvirlar hajmi 3 MB dan oshdi. Faylni qismlarga ajrating." });
    if (data.examKind === "CHSB" && data.examNumber !== 1) return res.status(400).json({ error: "Bir chorakda bitta CHSB bo\u2018ladi." });
    const classes = c.db.classes.filter((cls) => cls.institutionId === c.user.institutionId && data.classCodes.includes(cls.code));
    if (classes.length !== new Set(data.classCodes).size || new Set(classes.map((cls) => cls.grade)).size !== 1) return res.status(400).json({ error: "Bir bosqichdagi haqiqiy sinflarni tanlang." });
    if (data.questions.some((q) => q.fields.some((f) => f.imageIndex >= q.sourceImages.length))) return res.status(400).json({ error: "Javob maydoni manba sahifasiga mos emas." });
    if (Date.parse(data.availableFrom) >= Date.parse(data.dueDate)) return res.status(400).json({ error: "Vaqt oralig\u2018ini tekshiring." });
    const existing = c.db.assessments.find((a) => a.institutionId === c.user.institutionId && a.sourceHash === data.sourceHash && a.sourceLayoutVersion === data.sourceLayoutVersion && a.title === data.title && a.examKind === data.examKind && a.academicYear === data.academicYear && a.examNumber === data.examNumber && a.quarter === data.quarter && JSON.stringify(a.assignedClassCodes) === JSON.stringify(data.classCodes));
    if (existing) return res.json({ assessment: existing, replayed: true });
    const now = (/* @__PURE__ */ new Date()).toISOString(), id = "exam-" + crypto6.randomUUID();
    try {
      for (const q of data.questions) q.sourceImages = await Promise.all(q.sourceImages.map((image2) => storeExamImage(c.user.institutionId, id, image2)));
      data.contextImages = await Promise.all(data.contextImages.map((image2) => storeExamImage(c.user.institutionId, id, image2)));
    } catch {
      return res.status(503).json({ error: "Manba tasvirlarini saqlab bo\u2018lmadi. Qoralama saqlanmadi; qayta urinib ko\u2018ring." });
    }
    const qs = data.questions.map((q, i) => ({ id: id + "-q" + (i + 1), institutionId: c.user.institutionId, authorId: c.user.uid, subject: data.subject, grade: classes[0].grade, topicId: "", difficulty: "mixed", type: q.type, points: q.points, prompt: q.prompt, options: q.options, correctAnswer: q.correctAnswer, gradingMode: q.type === "single_choice" ? "automatic" : "manual_rubric", rubricText: q.rubricText, sourceImages: q.sourceImages, sourcePages: q.sourcePages, answerFields: q.fields, explanation: "", status: "draft", createdAt: now }));
    const assessment = { id, title: data.title, subject: data.subject, grade: classes[0].grade, examKind: data.examKind, examNumber: data.examNumber, examState: "draft", academicYear: data.academicYear, quarter: data.quarter, classId: classes[0].id, classCode: classes[0].code, assignedClassIds: classes.map((c2) => c2.id), assignedClassCodes: classes.map((c2) => c2.code), durationMinutes: data.durationMinutes, availableFrom: data.availableFrom, dueDate: data.dueDate, sourceFileName: data.sourceFileName, sourceHash: data.sourceHash, sourceLayoutVersion: data.sourceLayoutVersion, contextImages: data.contextImages, topicIds: [], questionIds: qs.map((q) => q.id), questionSnapshot: qs, teacherId: c.user.uid, institutionId: c.user.institutionId, status: "draft", source: "manual", createdAt: now, totalPoints: qs.reduce((sum, q) => sum + (q.points || 0), 0), totalPausedMs: 0 };
    c.db.questions.push(...qs);
    c.db.assessments.unshift(assessment);
    deps.save(c.env, c.db);
    deps.notify(c.env, c.user.institutionId, "EXAM_DRAFT_CREATED");
    res.status(201).json({ assessment });
  });
  app2.patch("/api/exams/:id/draft", async (req, res) => {
    const c = admin(req, res);
    if (!c) return;
    const exam = c.db.assessments.find((a) => a.id === req.params.id && a.examKind && a.institutionId === c.user.institutionId);
    if (!exam || exam.examState !== "draft") return res.status(409).json({ error: "Faqat nashr qilinmagan qoralamani tahrirlash mumkin." });
    const edit = draftSchema.omit({ sourceLayoutVersion: true, sourceHash: true, sourceFileName: true, contextImages: true, questions: true }).extend({ questions: z3.array(question.omit({ sourceImages: true }).extend({ sourceImages: z3.array(z3.union([image, z3.string().max(180)])).max(20) })).min(1).max(60), contextImages: z3.array(z3.union([image, z3.string().max(180)])).max(20).optional() }).safeParse(req.body);
    if (!edit.success) return res.status(400).json({ error: edit.error.issues[0]?.message });
    const d = edit.data;
    const classes = c.db.classes.filter((cls) => cls.institutionId === c.user.institutionId && d.classCodes.includes(cls.code));
    if (classes.length !== new Set(d.classCodes).size || new Set(classes.map((cls) => cls.grade)).size !== 1 || Date.parse(d.availableFrom) >= Date.parse(d.dueDate) || d.examKind === "CHSB" && d.examNumber !== 1) return res.status(400).json({ error: "Sinf, nazorat raqami yoki vaqtni tekshiring." });
    if (Buffer.byteLength(JSON.stringify(d)) > 32e5) return res.status(413).json({ error: "Tasvirlar hajmi 3 MB dan oshdi." });
    const allowed = [...exam.contextImages || [], ...(exam.questionSnapshot || []).flatMap((q) => q.sourceImages || [])];
    if (d.questions.some((q) => q.sourceImages.some((src) => !src.startsWith("data:") && !allowed.includes(src)) || q.fields.some((f) => f.imageIndex >= q.sourceImages.length))) return res.status(400).json({ error: "Manba tasviri yoki maydon noto\u2018g\u2018ri." });
    if (d.contextImages?.some((src) => !src.startsWith("data:") && !allowed.includes(src))) return res.status(400).json({ error: "Umumiy matn manbasi noto\u2018g\u2018ri." });
    const refreshed = d.questions.some((q) => q.sourceImages.some((src) => src.startsWith("data:")));
    if (refreshed && req.body.sourceHash !== exam.sourceHash) return res.status(400).json({ error: "Qayta ishlash uchun aynan avvalgi manba faylini tanlang." });
    try {
      for (const q of d.questions) q.sourceImages = await Promise.all(q.sourceImages.map((src) => src.startsWith("data:") ? storeExamImage(c.user.institutionId, exam.id, src) : Promise.resolve(src)));
      if (d.contextImages) d.contextImages = await Promise.all(d.contextImages.map((src) => src.startsWith("data:") ? storeExamImage(c.user.institutionId, exam.id, src) : Promise.resolve(src)));
    } catch {
      return res.status(503).json({ error: "Tasvirlar saqlanmadi. Qoralama o\u2018zgarmadi; qayta urinib ko\u2018ring." });
    }
    if (refreshed && req.body.sourceLayoutVersion === 2) exam.sourceLayoutVersion = 2;
    if (d.contextImages) exam.contextImages = d.contextImages;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const qs = d.questions.map((q, i) => ({ id: exam.id + "-q" + (i + 1), institutionId: c.user.institutionId, authorId: c.user.uid, subject: d.subject, grade: classes[0].grade, topicId: "", difficulty: "mixed", type: q.type, points: q.points, prompt: q.prompt, options: q.options, correctAnswer: q.correctAnswer, gradingMode: q.type === "single_choice" ? "automatic" : "manual_rubric", rubricText: q.rubricText, sourceImages: q.sourceImages, sourcePages: q.sourcePages, answerFields: q.fields, explanation: "", status: "draft", createdAt: now }));
    c.db.questions = c.db.questions.filter((q) => !exam.questionIds.includes(q.id));
    c.db.questions.push(...qs);
    Object.assign(exam, { title: d.title, subject: d.subject, examKind: d.examKind, examNumber: d.examNumber, quarter: d.quarter, academicYear: d.academicYear, durationMinutes: d.durationMinutes, availableFrom: d.availableFrom, dueDate: d.dueDate, grade: classes[0].grade, classId: classes[0].id, classCode: classes[0].code, assignedClassIds: classes.map((cls) => cls.id), assignedClassCodes: classes.map((cls) => cls.code), questionSnapshot: qs, questionIds: qs.map((q) => q.id), totalPoints: qs.reduce((n, q) => n + (q.points || 0), 0), updatedAt: now });
    deps.save(c.env, c.db);
    deps.notify(c.env, c.user.institutionId, "EXAM_DRAFT_UPDATED");
    res.json({ assessment: exam });
  });
  app2.delete("/api/exams/:id/draft", (req, res) => {
    const c = admin(req, res);
    if (!c) return;
    const exam = c.db.assessments.find((a) => a.id === req.params.id && a.examKind && a.institutionId === c.user.institutionId);
    if (!exam || exam.examState !== "draft") return res.status(409).json({ error: "Faqat qoralamani o\u2018chirish mumkin." });
    c.db.assessments = c.db.assessments.filter((a) => a.id !== exam.id);
    c.db.questions = c.db.questions.filter((q) => !exam.questionIds.includes(q.id));
    deps.save(c.env, c.db);
    deps.notify(c.env, c.user.institutionId, "EXAM_DRAFT_DELETED");
    res.json({ ok: true });
  });
  app2.get("/api/exams/:id/media/:hash", async (req, res) => {
    const c = deps.authenticate(req);
    if (!c) return res.status(401).json({ error: "Hisobga kiring." });
    const exam = c.db.assessments.find((a) => a.id === req.params.id && a.institutionId === c.user.institutionId && a.examKind);
    if (!exam || !/^[a-f0-9]{64}$/.test(req.params.hash) || !["admin", "platform_owner"].includes(c.user.role) && !(exam.status === "published" && canTakeExam(c.user, exam))) return res.status(403).json({ error: "Rasmga ruxsat yo\u2018q." });
    const path5 = "/api/exams/" + exam.id + "/media/" + req.params.hash;
    if (![...exam.contextImages || [], ...(exam.questionSnapshot || []).flatMap((q) => q.sourceImages || [])].includes(path5)) return res.status(404).json({ error: "Rasm topilmadi." });
    try {
      const image2 = await readExamImage(req.params.hash);
      if (!image2 || image2.institutionId !== c.user.institutionId) return res.status(404).end();
      res.setHeader("Cache-Control", "private, max-age=300");
      res.type(image2.mime).send(Buffer.from(image2.data, "base64"));
    } catch {
      res.status(503).json({ error: "Rasm yuklanmadi." });
    }
  });
  app2.get("/api/exams/:id/monitor", (req, res) => {
    const c = admin(req, res);
    if (!c) return;
    const exam = c.db.assessments.find((a) => a.id === req.params.id && a.examKind && a.institutionId === c.user.institutionId);
    if (!exam) return res.status(404).json({ error: "Nazorat topilmadi." });
    const sessions = (c.db.examSessions || []).filter((s) => s.assessmentId === exam.id && s.institutionId === c.user.institutionId).map((s) => ({ id: s.id, studentName: c.db.users?.find((u) => u.uid === s.studentId)?.displayName || s.studentId, startedAt: s.startedAt, deadline: examDeadline(exam, s), revision: s.revision, submitted: !!s.submittedAttemptId, events: s.events }));
    res.json({ sessions, serverNow: Date.now() });
  });
  app2.post("/api/exams/:id/control", (req, res) => {
    const c = admin(req, res);
    if (!c) return;
    const exam = c.db.assessments.find((a) => a.id === req.params.id && a.institutionId === c.user.institutionId && a.examKind);
    if (!exam) return res.status(404).json({ error: "Nazorat ishi topilmadi." });
    const action = req.body.action;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (action === "schedule" || action === "start") {
      if (!["draft", "scheduled", "closed"].includes(exam.examState || "")) return res.status(409).json({ error: "Joriy holatda bu amal mumkin emas." });
      const errors = validateExamForPublish(exam);
      if (errors.length || req.body.reviewed !== true) return res.status(400).json({ error: errors.join(" ") || "Savollar ko\u2018rib chiqilganini tasdiqlang." });
      if (Date.parse(exam.dueDate) <= Date.now()) return res.status(400).json({ error: "Imtihon muddati o\u2018tgan. Yangi qoralama yarating." });
      const duplicate = c.db.assessments.some((a) => a.id !== exam.id && a.institutionId === exam.institutionId && a.examKind === exam.examKind && a.examNumber === exam.examNumber && a.quarter === exam.quarter && a.subject === exam.subject && a.academicYear === exam.academicYear && a.status === "published" && a.assignedClassCodes?.some((code) => exam.assignedClassCodes?.includes(code)));
      if (duplicate) return res.status(409).json({ error: "Shu chorak, fan va sinf uchun bu nazorat allaqachon nashr qilingan." });
      exam.status = "published";
      exam.examState = action === "start" ? "open" : "scheduled";
      if (action === "start") exam.availableFrom = now;
      exam.reviewedAt = now;
    } else if (action === "pause" && ["open", "scheduled"].includes(exam.examState || "")) {
      exam.examState = "paused";
      exam.pausedAt = now;
    } else if (action === "resume" && exam.examState === "paused") {
      exam.totalPausedMs = (exam.totalPausedMs || 0) + Date.now() - Date.parse(exam.pausedAt);
      exam.pausedAt = void 0;
      exam.examState = "open";
    } else if (action === "stop" && exam.examState !== "draft") {
      exam.examState = "closed";
      exam.closedAt = now;
    } else return res.status(409).json({ error: "Holat o\u2018zgargan. Sahifani yangilang." });
    exam.updatedAt = now;
    deps.save(c.env, c.db);
    deps.notify(c.env, c.user.institutionId, "EXAM_STATE_CHANGED");
    res.json({ assessment: exam });
  });
  app2.post("/api/exams/:id/start", (req, res) => {
    const c = deps.authenticate(req);
    if (!c) return res.status(401).json({ error: "Hisobga kiring." });
    const exam = c.db.assessments.find((a) => a.id === req.params.id && a.examKind);
    if (!exam || !canTakeExam(c.user, exam)) return res.status(403).json({ error: "Nazorat ishi sinfingizga biriktirilmagan." });
    c.db.examSessions ||= [];
    let session = c.db.examSessions.find((s) => s.assessmentId === exam.id && s.studentId === c.user.uid);
    if (!session) {
      if (!examCanStart(exam)) return res.status(409).json({ error: "Nazorat ishi boshlanmagan yoki yopilgan." });
      if (c.db.attempts.some((a) => a.assessmentId === exam.id && a.studentId === c.user.uid)) return res.status(409).json({ error: "Nazorat ishi allaqachon topshirilgan." });
      session = { id: crypto6.randomUUID(), assessmentId: exam.id, studentId: c.user.uid, institutionId: c.user.institutionId, startedAt: (/* @__PURE__ */ new Date()).toISOString(), deadlineAt: new Date(Date.now() + exam.durationMinutes * 6e4).toISOString(), pauseAtStart: exam.totalPausedMs || 0, revision: 0, answers: {}, events: [] };
      c.db.examSessions.push(session);
      deps.save(c.env, c.db);
    }
    res.json({ session, serverNow: Date.now(), deadline: examDeadline(exam, session), state: session.stoppedAt ? "closed" : exam.examState });
  });
  app2.get("/api/exams/:id/session", (req, res) => {
    const c = deps.authenticate(req);
    if (!c) return res.status(401).json({ error: "Hisobga kiring." });
    const exam = c.db.assessments.find((a) => a.id === req.params.id && a.examKind);
    const session = c.db.examSessions?.find((s) => s.assessmentId === req.params.id && s.studentId === c.user.uid);
    if (!exam || !session || !canTakeExam(c.user, exam)) return res.status(404).json({ error: "Sessiya topilmadi." });
    res.json({ session, serverNow: Date.now(), deadline: examDeadline(exam, session), state: session.stoppedAt ? "closed" : exam.examState });
  });
  app2.post("/api/exams/:id/exit", (req, res) => {
    const c = deps.authenticate(req);
    if (!c) return res.status(401).json({ error: "Hisobga kiring." });
    const exam = c.db.assessments.find((a) => a.id === req.params.id && a.examKind);
    const session = c.db.examSessions?.find((s) => s.assessmentId === req.params.id && s.studentId === c.user.uid);
    if (!exam || !session || !canTakeExam(c.user, exam)) return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    const id = z3.string().uuid().safeParse(req.body.eventId);
    if (!id.success) return res.status(400).json({ error: "Hodisa noto\u2018g\u2018ri." });
    session.exitIds ||= [];
    if (!session.submittedAttemptId && !session.stoppedAt && !session.exitIds.includes(id.data)) {
      session.exitIds.push(id.data);
      session.exitCount = (session.exitCount || 0) + 1;
      session.events.push({ type: "tab_hidden", at: (/* @__PURE__ */ new Date()).toISOString() });
      if (session.exitCount >= 3) session.stoppedAt = (/* @__PURE__ */ new Date()).toISOString();
      deps.save(c.env, c.db);
    }
    res.json({ exitCount: session.exitCount || 0, stopped: !!session.stoppedAt });
  });
  app2.put("/api/exams/:id/session", (req, res) => {
    const c = deps.authenticate(req);
    if (!c) return res.status(401).json({ error: "Hisobga kiring." });
    const exam = c.db.assessments.find((a) => a.id === req.params.id && a.examKind);
    const session = c.db.examSessions?.find((s) => s.assessmentId === req.params.id && s.studentId === c.user.uid);
    if (!exam || !session || !canTakeExam(c.user, exam)) return res.status(404).json({ error: "Sessiya topilmadi." });
    if (session.stoppedAt) return res.status(409).json({ error: "Tabdan uch marta chiqilgan. Nazorat to\u2018xtatildi." });
    if (session.submittedAttemptId) return res.status(409).json({ error: "Ish topshirilgan." });
    if (req.body.revision !== session.revision) return res.status(409).json({ error: "Javoblar boshqa oynada yangilangan. Sahifani yangilang." });
    if (exam.examState === "paused" || exam.examState === "closed" || Date.now() > examDeadline(exam, session)) return res.status(409).json({ error: "Nazorat to\u2018xtatilgan yoki vaqti tugagan." });
    const incoming = z3.record(z3.string(), z3.string().max(25e4)).safeParse(req.body.answers);
    if (!incoming.success || Buffer.byteLength(JSON.stringify(incoming.data)) > 18e5) return res.status(400).json({ error: "Javoblar hajmi yoki shakli noto\u2018g\u2018ri." });
    if (Object.keys(incoming.data).some((id) => !exam.questionIds.includes(id))) return res.status(400).json({ error: "Noma\u2019lum savol." });
    session.answers = incoming.data;
    session.revision++;
    if (["fullscreen_exit", "tab_hidden", "fullscreen_unavailable"].includes(req.body.event) && session.events.length < 100) session.events.push({ type: req.body.event, at: (/* @__PURE__ */ new Date()).toISOString() });
    deps.save(c.env, c.db);
    res.json({ revision: session.revision, savedAt: (/* @__PURE__ */ new Date()).toISOString(), deadline: examDeadline(exam, session), serverNow: Date.now() });
  });
}

// src/server/cloudState.ts
import crypto7 from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { getFirestore as getFirestore2 } from "firebase-admin/firestore";
var ROOT = "_specialized_runtime";
var CHUNK_BYTES = 35e4;
var MAX_STATE_BYTES = 64 * 1024 * 1024;
var StateConflictError = class extends Error {
  constructor() {
    super("State changed concurrently");
  }
};
function encodeState(value) {
  const raw = Buffer.from(JSON.stringify(value));
  if (raw.length > MAX_STATE_BYTES) throw new Error("State exceeds configured size limit");
  const parts = [];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value).filter(([, v]) => JSON.stringify(v) !== void 0);
    entries.forEach(([key, v], i) => {
      const prefix = (i ? "," : "{") + JSON.stringify(key) + ":";
      if (Array.isArray(v) && v.length > 64) {
        for (let start = 0; start < v.length; start += 64) parts.push((start ? "," : prefix + "[") + v.slice(start, start + 64).map((item) => JSON.stringify(item) ?? "null").join(",") + (start + 64 >= v.length ? "]" : ""));
      } else parts.push(prefix + JSON.stringify(v));
    });
    if (!entries.length) parts.push("{");
    parts[parts.length - 1] += "}";
  } else parts.push(raw.toString("utf8"));
  const chunks = [];
  for (const part of parts) {
    const compressed = gzipSync(Buffer.from(part));
    for (let offset = 0; offset < compressed.length; offset += CHUNK_BYTES) {
      const bytes = compressed.subarray(offset, offset + CHUNK_BYTES);
      chunks.push({ id: crypto7.createHash("sha256").update(bytes).digest("hex"), data: bytes.toString("base64") });
    }
  }
  return { chunks, digest: crypto7.createHash("sha256").update(raw).digest("hex") };
}
function decodeState(chunks, digest) {
  const compressed = Buffer.concat(chunks.map((c) => {
    const b = Buffer.from(c.data, "base64");
    if (crypto7.createHash("sha256").update(b).digest("hex") !== c.id) throw Error("Snapshot chunk integrity failure");
    return b;
  }));
  const raw = gunzipSync(compressed, { maxOutputLength: MAX_STATE_BYTES });
  if (crypto7.createHash("sha256").update(raw).digest("hex") !== digest) throw Error("Snapshot integrity failure");
  return JSON.parse(raw.toString("utf8"));
}
var cache = null;
var chunkCache = /* @__PURE__ */ new Map();
var cachedBytes = 0;
function remember(id, data) {
  if (chunkCache.has(id)) return;
  chunkCache.set(id, data);
  cachedBytes += data.length;
  while (cachedBytes > 32 * 1024 * 1024) {
    const key = chunkCache.keys().next().value;
    cachedBytes -= chunkCache.get(key).length;
    chunkCache.delete(key);
  }
}
function database() {
  return getFirestore2(getFirebaseAdminApp(), loadFirebaseAppletConfig().firestoreDatabaseId);
}
async function readCloudState() {
  const db = database();
  const head = await db.doc(`${ROOT}/current`).get();
  if (!head.exists) throw Error("Cloud state has not been migrated");
  const manifest = head.data();
  if (manifest.schema !== 1 || !Array.isArray(manifest.chunks)) throw Error("Unsupported state schema");
  const currentCache = cache;
  if (currentCache && currentCache.revision === manifest.revision) return { state: JSON.parse(currentCache.serialized), revision: currentCache.revision };
  const contents = /* @__PURE__ */ new Map();
  for (const id of manifest.chunks) if (chunkCache.has(id)) contents.set(id, chunkCache.get(id));
  const missing = [...new Set(manifest.chunks)].filter((id) => !contents.has(id));
  if (missing.length) {
    const docs = await db.getAll(...missing.map((id) => db.doc(`${ROOT}/chunks/items/${id}`)));
    docs.forEach((d, i) => {
      if (!d.exists) throw Error("Snapshot incomplete");
      contents.set(missing[i], d.data().data);
      remember(missing[i], d.data().data);
    });
  }
  const state = decodeState(manifest.chunks.map((id) => ({ id, data: contents.get(id) })), manifest.digest);
  cache = { revision: manifest.revision, serialized: JSON.stringify(state), chunks: manifest.chunks };
  return { state, revision: manifest.revision };
}
async function writeCloudState(state, expectedRevision) {
  const db = database();
  const encoded = encodeState(state);
  const revision = crypto7.randomUUID();
  const previous = cache?.revision === expectedRevision ? cache.chunks : [];
  const reused = new Set(previous);
  const changed = encoded.chunks.filter((chunk, i, all) => !reused.has(chunk.id) && all.findIndex((c) => c.id === chunk.id) === i);
  for (let offset = 0; offset < changed.length; ) {
    const batch = db.batch();
    let size = 0, count = 0;
    while (offset < changed.length && count < 400 && size + changed[offset].data.length + 256 < 6 * 1024 * 1024) {
      const chunk = changed[offset++];
      batch.set(db.doc(`${ROOT}/chunks/items/${chunk.id}`), { data: chunk.data });
      size += chunk.data.length + 256;
      count++;
    }
    await batch.commit();
  }
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`${ROOT}/current`);
    const head = await tx.get(ref);
    if ((head.exists ? head.data().revision : null) !== expectedRevision) throw new StateConflictError();
    if (head.exists) tx.set(db.doc(`${ROOT}/revisions/items/${head.data().revision}`), head.data());
    tx.set(ref, { schema: 1, revision, chunks: encoded.chunks.map((c) => c.id), digest: encoded.digest, previousRevision: expectedRevision, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
  });
  for (const chunk of encoded.chunks) remember(chunk.id, chunk.data);
  cache = { revision, serialized: JSON.stringify(state), chunks: encoded.chunks.map((c) => c.id) };
  return revision;
}

// src/server/cloudStateMiddleware.ts
function createCloudStateMiddleware(store = { read: readCloudState, write: writeCloudState }) {
  return async (req, res, next) => {
    if (process.env.PERSISTENCE_DRIVER !== "firestore" || !req.path.startsWith("/api/") || req.path === "/api/health") return next();
    try {
      const snapshot = await store.read();
      const context = { ...snapshot, dirty: false, afterCommit: [] };
      const json = res.json.bind(res);
      let sending = false;
      res.json = ((body) => {
        if (sending) return res;
        sending = true;
        void (async () => {
          try {
            if (context.dirty) await store.write(context.state, context.revision);
            for (const action of context.afterCommit) action();
            json(body);
          } catch (error) {
            res.status(error instanceof StateConflictError ? 409 : 503);
            json({ error: error instanceof StateConflictError ? "Ma\u2019lumot yangilangan. Sahifani yangilab, qayta urinib ko\u2018ring." : "Ma\u2019lumot saqlanmadi. Keyinroq qayta urinib ko\u2018ring." });
          }
        })();
        return res;
      });
      requestDatabase.run(context, next);
    } catch {
      res.status(503).json({ error: "Ma\u2019lumotlar bazasi hozircha tayyor emas. Administratorga murojaat qiling." });
    }
  };
}
var cloudStateMiddleware = createCloudStateMiddleware();

// server.ts
import "dotenv/config";
import express from "express";
import path4 from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX5 from "xlsx";
import { z as z4 } from "zod";

// src/utils/scoring.ts
var MINIMUM_EVIDENCE_THRESHOLD = 3;
function normalizeAnswer(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "").replace(/,/g, ".");
}
function parseMultiAnswerList(raw) {
  if (!raw || !raw.trim()) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => normalizeAnswer(String(x))).filter(Boolean).sort();
      }
    } catch {
    }
  }
  return trimmed.split(/[;|,]/).map((s) => normalizeAnswer(s)).filter(Boolean).sort();
}
function isAnswerCorrect(question2, submittedAnswer) {
  if (!submittedAnswer || !String(submittedAnswer).trim()) {
    return false;
  }
  if (question2.type === "numeric") {
    const normalizedSubmitted2 = normalizeAnswer(submittedAnswer);
    const normalizedCorrect2 = normalizeAnswer(question2.correctAnswer);
    const numSub = Number(normalizedSubmitted2);
    const numCor = Number(normalizedCorrect2);
    const tolerance = typeof question2.numericTolerance === "number" && question2.numericTolerance >= 0 ? question2.numericTolerance : 1e-4;
    if (!Number.isNaN(numSub) && !Number.isNaN(numCor)) {
      return Math.abs(numSub - numCor) <= tolerance + 1e-9;
    }
    return false;
  }
  if (question2.type === "short_text") {
    if (question2.acceptedAnswers && question2.acceptedAnswers.length > 0) {
      return question2.acceptedAnswers.some((acc) => {
        const rawTarget = String(acc.acceptedAnswer ?? acc.text ?? "");
        const subVal = acc.trimWhitespace !== false ? submittedAnswer.trim() : submittedAnswer;
        const targetVal = acc.trimWhitespace !== false ? rawTarget.trim() : rawTarget;
        if (acc.caseSensitive) {
          return subVal === targetVal;
        }
        return subVal.toLowerCase() === targetVal.toLowerCase();
      });
    }
    if (question2.gradingMode === "manual" || question2.gradingMode === "ai_assisted") {
      return false;
    }
    return submittedAnswer.trim().toLowerCase() === String(question2.correctAnswer || "").trim().toLowerCase();
  }
  if (question2.type === "long_text") {
    return false;
  }
  const multiCorrectList = question2.correctAnswers && question2.correctAnswers.length > 0 ? question2.correctAnswers : question2.structuredOptions && question2.structuredOptions.filter((o) => o.isCorrect).length > 1 ? question2.structuredOptions.filter((o) => o.isCorrect).map((o) => o.text || o.code || o.key || "") : null;
  if (question2.type === "multiple_choice" && multiCorrectList && multiCorrectList.length > 1) {
    const subSet = parseMultiAnswerList(submittedAnswer);
    const corSet = multiCorrectList.map((c) => normalizeAnswer(c || "")).filter(Boolean).sort();
    if (subSet.length === corSet.length && subSet.every((val, idx) => val === corSet[idx])) {
      return true;
    }
    if (question2.structuredOptions && question2.structuredOptions.length > 0) {
      const correctOpts = question2.structuredOptions.filter((o) => o.isCorrect);
      const codeSet = correctOpts.map((o) => normalizeAnswer(o.code || o.key || "")).filter(Boolean).sort();
      if (subSet.length === codeSet.length && subSet.every((val, idx) => val === codeSet[idx])) {
        return true;
      }
      const textSet = correctOpts.map((o) => normalizeAnswer(o.text || "")).filter(Boolean).sort();
      if (subSet.length === textSet.length && subSet.every((val, idx) => val === textSet[idx])) {
        return true;
      }
    }
    return false;
  }
  const normalizedSubmitted = normalizeAnswer(submittedAnswer);
  const normalizedCorrect = normalizeAnswer(question2.correctAnswer);
  if (normalizedSubmitted === normalizedCorrect) return true;
  if (question2.structuredOptions && question2.structuredOptions.length > 0) {
    const correctOpt = question2.structuredOptions.find((o) => o.isCorrect);
    if (correctOpt) {
      if (normalizeAnswer(correctOpt.text) === normalizedSubmitted || normalizeAnswer(correctOpt.code || correctOpt.key || "") === normalizedSubmitted) {
        return true;
      }
    }
  }
  return false;
}
function getMasteryStatusLabel(accuracy, evidenceCount) {
  if (evidenceCount <= 0) {
    return "Boshlanmagan";
  }
  if (evidenceCount < MINIMUM_EVIDENCE_THRESHOLD) {
    return "Ma'lumot yetarli emas";
  }
  if (accuracy >= 80) {
    return "Yaxshi o\u2018zlashtirilgan";
  }
  if (accuracy >= 60) {
    return "Mustahkamlanmoqda";
  }
  return "O\u2018rganilmoqda";
}
function scoreAssessmentSubmission(questions, submittedMap, topicsMap) {
  const totalQuestions = questions.length;
  if (totalQuestions === 0) {
    return {
      scorePercent: 0,
      correctCount: 0,
      totalQuestions: 0,
      earnedPoints: 0,
      totalPoints: 0,
      pendingManualCount: 0,
      gradingStatus: "completed",
      answers: [],
      topicBreakdown: []
    };
  }
  let correctCount = 0;
  let earnedPoints = 0;
  let totalPoints = 0;
  let pendingManualCount = 0;
  const answers = [];
  const topicCounters = {};
  for (const q of questions) {
    const rawSubmitted = submittedMap[q.id] ?? "";
    const maxPts = typeof q.points === "number" && q.points > 0 ? q.points : 1;
    totalPoints += maxPts;
    const requiresManualReview = q.type === "long_text" || q.gradingMode === "manual" || q.gradingMode === "manual_rubric" || q.gradingMode === "ai_assisted" || q.type === "short_text" && (!q.acceptedAnswers || q.acceptedAnswers.length === 0) && !q.correctAnswer;
    const correct = requiresManualReview ? false : isAnswerCorrect(q, rawSubmitted);
    const awardedPts = correct ? maxPts : 0;
    if (requiresManualReview) {
      pendingManualCount += 1;
    } else if (correct) {
      correctCount += 1;
      earnedPoints += awardedPts;
    }
    answers.push({
      questionId: q.id,
      questionCode: q.code,
      questionType: q.type,
      topicId: q.topicId,
      selectedAnswer: String(rawSubmitted).trim(),
      correctAnswer: q.correctAnswer,
      isCorrect: correct,
      maxPoints: maxPts,
      awardedPoints: awardedPts,
      gradingStatus: requiresManualReview ? "pending_review" : "auto_graded",
      gradingMode: q.gradingMode || (q.type === "long_text" ? "manual" : "automatic"),
      rubricText: q.rubricText,
      prompt: q.prompt,
      explanation: q.explanation,
      imageUrl: q.imageUrl
    });
    const tName = topicsMap[q.topicId]?.name || q.topicId || q.subject || "Nazorat savollari";
    if (!topicCounters[q.topicId]) {
      topicCounters[q.topicId] = { total: 0, correct: 0, topicName: tName };
    }
    topicCounters[q.topicId].total += 1;
    if (correct) {
      topicCounters[q.topicId].correct += 1;
    }
  }
  const scorePercent = totalPoints > 0 ? Math.round(earnedPoints / totalPoints * 100) : Math.round(correctCount / totalQuestions * 100);
  const topicBreakdown = Object.entries(topicCounters).map(
    ([topicId, counts]) => ({
      topicId,
      topicName: counts.topicName,
      total: counts.total,
      correct: counts.correct,
      accuracy: Math.round(counts.correct / counts.total * 100)
    })
  );
  return {
    scorePercent,
    correctCount,
    totalQuestions,
    earnedPoints,
    totalPoints,
    pendingManualCount,
    gradingStatus: pendingManualCount > 0 ? "pending_manual_review" : "completed",
    answers,
    topicBreakdown
  };
}
function recalculateAttemptAfterManualGrading(attempt, questionId, awardedPoints, teacherFeedback, confirmedBy, topicsMapOrNowIso, nowIsoArg) {
  const confirmedByUid = typeof confirmedBy === "string" ? confirmedBy : confirmedBy.uid;
  const confirmedByName = typeof confirmedBy === "string" ? confirmedBy : confirmedBy.displayName;
  const topicsMap = typeof topicsMapOrNowIso === "object" && topicsMapOrNowIso !== null ? topicsMapOrNowIso : {};
  const nowIso = typeof topicsMapOrNowIso === "string" ? topicsMapOrNowIso : nowIsoArg || (/* @__PURE__ */ new Date()).toISOString();
  let earnedPoints = 0;
  let totalPoints = 0;
  let correctCount = 0;
  let pendingCount = 0;
  const topicCounters = {};
  const updatedAnswers = attempt.answers.map((ans) => {
    const maxPts = typeof ans.maxPoints === "number" && ans.maxPoints > 0 ? ans.maxPoints : 1;
    totalPoints += maxPts;
    let finalAns = ans;
    if (ans.questionId === questionId) {
      const clamped = Math.max(0, Math.min(maxPts, Number(awardedPoints) || 0));
      const isFullOrPass = clamped >= maxPts * 0.5 && clamped > 0;
      earnedPoints += clamped;
      if (isFullOrPass) correctCount += 1;
      finalAns = {
        ...ans,
        awardedPoints: clamped,
        isCorrect: isFullOrPass,
        gradingStatus: "graded",
        teacherFeedback: teacherFeedback.trim(),
        confirmedByUid,
        confirmedByName,
        confirmedAt: nowIso
      };
    } else {
      const pts = typeof ans.awardedPoints === "number" ? ans.awardedPoints : ans.isCorrect ? maxPts : 0;
      earnedPoints += pts;
      if (ans.isCorrect) correctCount += 1;
      if (ans.gradingStatus === "pending_review") pendingCount += 1;
    }
    const existingTb = attempt.topicBreakdown?.find((t) => t.topicId === finalAns.topicId);
    const tName = topicsMap[finalAns.topicId]?.name || existingTb?.topicName || finalAns.topicId;
    if (!topicCounters[finalAns.topicId]) {
      topicCounters[finalAns.topicId] = { total: 0, correct: 0, topicName: tName };
    }
    topicCounters[finalAns.topicId].total += 1;
    if (finalAns.isCorrect) {
      topicCounters[finalAns.topicId].correct += 1;
    }
    return finalAns;
  });
  const scorePercent = totalPoints > 0 ? Math.round(earnedPoints / totalPoints * 100) : Math.round(correctCount / Math.max(1, attempt.totalQuestions) * 100);
  const updatedTopicBreakdown = Object.entries(topicCounters).map(
    ([topicId, counts]) => ({
      topicId,
      topicName: counts.topicName,
      total: counts.total,
      correct: counts.correct,
      accuracy: Math.round(counts.correct / counts.total * 100)
    })
  );
  const resolvedStatus = pendingCount > 0 ? "pending_manual_review" : "completed";
  return {
    ...attempt,
    answers: updatedAnswers,
    topicBreakdown: updatedTopicBreakdown,
    correctCount,
    earnedPoints,
    totalPoints,
    scorePercent,
    pendingManualCount: pendingCount,
    status: resolvedStatus,
    gradingStatus: resolvedStatus
  };
}
function updateMasteryRecordsFromAttempt(existingRecords, studentId, institutionId, topicBreakdown, topics, timestampIso) {
  const recordByTopic = {};
  for (const rec of existingRecords) {
    recordByTopic[rec.topicId] = { ...rec };
  }
  for (const t of topics) {
    if (!recordByTopic[t.id]) {
      recordByTopic[t.id] = {
        id: `mr-${studentId}-${t.id}`,
        studentId,
        institutionId,
        topicId: t.id,
        topicName: t.name,
        subject: t.subject,
        grade: t.grade,
        assessedQuestions: 0,
        correctAnswers: 0,
        accuracy: 0,
        masteryEstimate: 0,
        evidenceCount: 0,
        statusLabel: "Boshlanmagan",
        lastAssessedAt: timestampIso
      };
    }
  }
  for (const tb of topicBreakdown) {
    const current = recordByTopic[tb.topicId];
    if (!current) continue;
    const newAssessed = current.assessedQuestions + tb.total;
    const newCorrect = current.correctAnswers + tb.correct;
    const newAccuracy = newAssessed > 0 ? Math.round(newCorrect / newAssessed * 100) : 0;
    const newEvidence = newAssessed;
    const newStatus = getMasteryStatusLabel(newAccuracy, newEvidence);
    recordByTopic[tb.topicId] = {
      ...current,
      assessedQuestions: newAssessed,
      correctAnswers: newCorrect,
      accuracy: newAccuracy,
      masteryEstimate: newAccuracy,
      evidenceCount: newEvidence,
      statusLabel: newStatus,
      lastAssessedAt: timestampIso
    };
  }
  return Object.values(recordByTopic);
}
function buildDeterministicFallbackAnalysis(assessmentTitle, scorePercent, topicBreakdown, answers) {
  const sortedTopics = [...topicBreakdown].sort((a, b) => a.accuracy - b.accuracy);
  const weakest = sortedTopics.find((topic) => topic.accuracy < 80);
  const strongest = sortedTopics[sortedTopics.length - 1];
  const topic_analysis = topicBreakdown.map((tb) => {
    const topicWrongAnswers = answers.filter((a) => a.topicId === tb.topicId && !a.isCorrect);
    const confidence = tb.total >= 4 ? "high" : tb.total >= 2 ? "medium" : "low";
    let possiblePattern = "Asosiy tushunchalar to'g'ri qo'llangan.";
    let recommendation = "Keyingi murakkablikdagi masalalarni ishlashda davom eting.";
    if (tb.accuracy < 60) {
      possiblePattern = topicWrongAnswers.length > 0 ? `Hisoblash qadamlari yoki formulani qo'llashda xatolik kuzatildi (${topicWrongAnswers.length} ta savolda).` : "Mavzu bo'yicha amaliy ko'nikmalarni mustahkamlash zarur.";
      recommendation = `"${tb.topicName}" mavzusidagi nazariy qoidalarni takrorlash va 5 ta namunaviy misol ishlash tavsiya etiladi.`;
    } else if (tb.accuracy < 80) {
      possiblePattern = "Ba'zi ko'p bosqichli ifodalarda e'tiborsizlik yoki ishora xatosi bo'lishi mumkin.";
      recommendation = `"${tb.topicName}" bo'yicha o'rta qiyinlikdagi mashqlarni bajarib, xatolarni tahlil qiling.`;
    }
    return {
      topic_id: tb.topicId,
      observed_performance: `${tb.topicName}: ${tb.total} ta savoldan ${tb.correct} tasi to'g'ri (${tb.accuracy}%).`,
      possible_error_pattern: possiblePattern,
      evidence_count: tb.total,
      confidence,
      recommendation
    };
  });
  const next_steps = sortedTopics.slice(0, 3).map((tb) => ({
    topic_id: tb.topicId,
    activity: tb.accuracy < 60 ? `${tb.topicName}: Asosiy tushunchalar va 5 ta amaliy mashq` : `${tb.topicName}: Mustahkamlovchi 5 ta diagnostik masala`,
    reason: `Testda ushbu mavzu bo'yicha ${tb.accuracy}% aniqlik qayd etildi (${tb.correct}/${tb.total}).`,
    priority: tb.accuracy < 50 ? "high" : tb.accuracy < 75 ? "medium" : "low"
  }));
  const summary = weakest && strongest ? `"${assessmentTitle}" testi bo'yicha umumiy natija ${scorePercent}% ni tashkil etdi. "${strongest.topicName}" mavzusida ijobiy ko'rsatkich (${strongest.accuracy}%) kuzatildi, biroq "${weakest.topicName}" mavzusida (${weakest.accuracy}%) qo'shimcha amaliyot talab etiladi.` : `"${assessmentTitle}" testi yakunlandi. Umumiy natija: ${scorePercent}%.`;
  const teacher_summary = weakest ? `O'quvchi umumiy ${scorePercent}% natija ko'rsatdi. Eng ko'p xatolik "${weakest.topicName}" mavzusida (${weakest.correct}/${weakest.total}) kuzatildi. Dars jarayonida ushbu mavzudagi amaliy yechim qadamlarini qayta ko'rib chiqish tavsiya etiladi.` : `O'quvchi testni ${scorePercent}% natija bilan yakunladi.`;
  const parent_summary = weakest ? `Farzandingiz "${assessmentTitle}" testida ${scorePercent}% natija qayd etdi. Uyda "${weakest.topicName}" mavzusidagi mashqlarni 15-20 daqiqa birgalikda takrorlash foydali bo'ladi.` : `Farzandingiz testni ${scorePercent}% natija bilan topshirdi.`;
  return {
    summary,
    topic_analysis,
    next_steps,
    teacher_summary,
    parent_summary,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    isFallback: true
  };
}
function generateLearningPathsFromAttempt(studentId, institutionId, topicBreakdown, existingPaths) {
  const pathMap = {};
  for (const p of existingPaths) {
    if (p.studentId === studentId) {
      pathMap[p.topicId] = p;
    }
  }
  for (const tb of topicBreakdown) {
    const priority = tb.accuracy < 60 ? "high" : tb.accuracy < 80 ? "medium" : "low";
    const existing = pathMap[tb.topicId];
    pathMap[tb.topicId] = {
      id: existing?.id || `lp-${studentId}-${tb.topicId}`,
      studentId,
      institutionId,
      topicId: tb.topicId,
      topicName: tb.topicName,
      observedIndicator: `${tb.topicName}: ${tb.total} ta savoldan ${tb.correct} tasi to'g'ri (${tb.accuracy}% aniqlik)`,
      accuracy: tb.accuracy,
      priority,
      createdAt: existing?.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      steps: existing?.steps || [
        {
          stepNumber: 1,
          title: "1-qadam: Asosiy tushuncha va qoida sharhi",
          description: `"${tb.topicName}" mavzusi bo'yicha asosiy matematik qoidalar va formulalarni ko'rib chiqish.`,
          type: "concept",
          status: "not_started",
          content: `${tb.topicName}: Har bir amalni bajarishdan oldin ishoralar, maxrajlar yoki tenglama hadlarini tartib bilan tekshiring.`
        },
        {
          stepNumber: 2,
          title: "2-qadam: Bosqichma-bosqich yechilgan namuna",
          description: "Namunaviy misolning to\u2018liq yechilish ketma-ketligini tahlil qilish.",
          type: "example",
          status: "not_started",
          content: `Namuna (${tb.topicName}): Berilgan ifodani soddalashtiring -> O'xshash hadlarni ixchamlang -> Natijani tekshirib ko'ring.`
        },
        {
          stepNumber: 3,
          title: "3-qadam: Yo\u2018naltirilgan amaliy mashq",
          description: "Ko\u2018rsatmalar yordamida 3 ta maqsadli misolni mustaqil ishlash.",
          type: "practice",
          status: "not_started",
          content: `Mashq: "${tb.topicName}" bo'yicha o'rta qiyinlikdagi 3 ta misolni yeching va har bir qadamni daftariga yozing.`
        },
        {
          stepNumber: 4,
          title: "4-qadam: Xatolarni tahlil qilish va takrorlash",
          description: "Diagnostik testda xato qilingan savollar yechimini qayta ko\u2018rib chiqish.",
          type: "review",
          status: "not_started",
          content: `Test natijalari sahifasidagi "${tb.topicName}" savollarining matematik izohini o'qib chiqing.`
        },
        {
          stepNumber: 5,
          title: "5-qadam: Qayta diagnostik tekshiruv",
          description: "O\u2018zlashtirish darajasini tasdiqlash uchun yakuniy sinov.",
          type: "reassessment",
          status: "not_started",
          content: `Mavzu bo'yicha kamida 80% aniqlikka erishish uchun navbatdagi diagnostik sinovni topshiring.`
        }
      ]
    };
  }
  return Object.values(pathMap);
}

// src/utils/excelImporter.ts
import * as XLSX from "xlsx";
import JSZip from "jszip";
var ASSESSMENT_COLUMNS = [
  "assessment_code",
  "assessment_title",
  "description",
  "subject_code",
  "grade",
  "duration_minutes",
  "maximum_attempts",
  "instructions",
  "availability_start",
  "availability_end"
];
var QUESTIONS_COLUMNS = [
  "question_code",
  "question_type",
  "question_text",
  "question_image",
  "subject_code",
  "grade",
  "topic_code",
  "difficulty",
  "points",
  "explanation",
  "grading_mode",
  "rubric",
  "numeric_correct_answer",
  "numeric_tolerance"
];
var OPTIONS_COLUMNS = [
  "question_code",
  "option_code",
  "option_text",
  "option_image",
  "is_correct",
  "display_order"
];
var ACCEPTED_ANSWERS_COLUMNS = [
  "question_code",
  "accepted_answer",
  "case_sensitive",
  "trim_whitespace"
];
var TOPICS_COLUMNS = [
  "topic_code",
  "topic_name",
  "subject_code",
  "grade",
  "description",
  "usage_note"
];
function generateLearnOSExcelTemplateBuffer(topics = []) {
  const wb = XLSX.utils.book_new();
  const instructionRows = [
    ["LEARNOS \u2014 DIAGNOSTIK TEST VA SAVOLLAR BAZASI IMPORT SHABLONI (.XLSX / .ZIP)"],
    [""],
    ["1. UMUMIY QOIDALAR"],
    [
      "Ushbu shablon orqali yuzlab test savollarini, javob variantlarini, qisqa/uzun yozma savollarni hamda rasmlarni (.zip paket ichida) bir vaqtda yuklashingiz mumkin."
    ],
    [
      "Shablonda hech qanday soxta (demo) savollar yo'q. Faqat o'zingizning haqiqiy o'quv savollaringizni kiriting."
    ],
    [""],
    ["2. VARAQLAR (SHEETS) TAVSIFI"],
    [
      "\u2022 Instructions: Ushbu yo\u2018riqnoma varag\u2018i."
    ],
    [
      "\u2022 Assessment: Agar yuklanayotgan savollar yangi qoralama (DRAFT) testga biriktirilishini xohlasangiz, 1 qator test ma'lumotini kiriting. Bo'sh qoldirilsa, savollar to'g'ridan-to'g'ri Savollar bazasiga (Question Bank) qoralama sifatida qo'shiladi."
    ],
    [
      "\u2022 Questions: Barcha savollar ro\u2018yxati. Har bir savolda noyob question_code bo\u2018lishi shart (masalan: Q-MAT8-001)."
    ],
    [
      "\u2022 Options: single_choice va multiple_choice turidagi savollar uchun javob variantlari."
    ],
    [
      "\u2022 AcceptedAnswers: short_text (qisqa yozma javob) savollari uchun avtomatik tekshiriladigan qabul qilinuvchi javoblar."
    ],
    [
      "\u2022 Topics: Tizimdagi mavjud rasmiy mavzu kodlari (topic_code). Noma\u2019lum topic_code kiritilsa, validatsiya xato beradi."
    ],
    [""],
    ["3. QO\u2018LLAB-QUVVATLANADIGAN SAVOL TURLARI (question_type)"],
    ["\u2022 single_choice \u2014 Bitta to\u2018g\u2018ri javobli test (Options varag\u2018ida aynan 1 ta is_correct = TRUE bo\u2018lishi shart)."],
    ["\u2022 multiple_choice \u2014 Bir nechta to\u2018g\u2018ri javobli test (Options varag\u2018ida kamida 1 ta is_correct = TRUE bo\u2018lishi shart)."],
    ["\u2022 numeric \u2014 Sonli javob (numeric_correct_answer majburiy, numeric_tolerance ixtiyoriy, masalan: 0.01)."],
    ["\u2022 short_text \u2014 Qisqa yozma javob (AcceptedAnswers varag\u2018ida qabul qilinadigan javoblar yoziladi yoki manual tekshiriladi)."],
    ["\u2022 long_text \u2014 Batafsil yozma javob / yechim (rubric ustunida baholash mezoni yoziladi; o\u2018qituvchi yoki AI yordamida tekshiriladi)."],
    [""],
    ["4. BAHOLASH REJIMLARI (grading_mode)"],
    ["\u2022 automatic \u2014 Server tomonidan kalit orqali avtomatik tekshiriladi."],
    ["\u2022 manual \u2014 O\u2018qituvchi tomonidan qo\u2018lda tekshiriladi va ball qo\u2018yiladi."],
    ["\u2022 ai_assisted \u2014 Gemini AI mezon (rubric) asosida dastlabki ballni tavsiya qiladi, o\u2018qituvchi tasdiqlaydi."],
    [""],
    ["5. RASMLARNI .ZIP PAKET ORQALI YUKLASH TARTIBI"],
    ["\u2022 Agar savol yoki variantda rasm bo\u2018lsa, LearnOS_Assessment_Import_Template.xlsx fayli yonida media/ papkasini yarating."],
    ["\u2022 Rasmlarni media/ papkasiga joylang (masalan: media/question_001.png, media/option_001_a.png)."],
    ["\u2022 Questions varag\u2018idagi question_image yoki Options varag\u2018idagi option_image ustuniga aniq nisbiy yo\u2018lni yozing: media/question_001.png"],
    ["\u2022 Ruxsat etilgan formatlar: PNG, JPEG, WebP (maksimal 5 MB)."]
  ];
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionRows);
  wsInstructions["!cols"] = [{ wch: 115 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");
  const wsAssessment = XLSX.utils.aoa_to_sheet([[...ASSESSMENT_COLUMNS]]);
  wsAssessment["!cols"] = ASSESSMENT_COLUMNS.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, wsAssessment, "Assessment");
  const wsQuestions = XLSX.utils.aoa_to_sheet([[...QUESTIONS_COLUMNS]]);
  wsQuestions["!cols"] = QUESTIONS_COLUMNS.map(
    (c) => c === "question_text" || c === "explanation" || c === "rubric" ? { wch: 36 } : { wch: 20 }
  );
  XLSX.utils.book_append_sheet(wb, wsQuestions, "Questions");
  const wsOptions = XLSX.utils.aoa_to_sheet([[...OPTIONS_COLUMNS]]);
  wsOptions["!cols"] = OPTIONS_COLUMNS.map((c) => c === "option_text" ? { wch: 32 } : { wch: 18 });
  XLSX.utils.book_append_sheet(wb, wsOptions, "Options");
  const wsAccepted = XLSX.utils.aoa_to_sheet([[...ACCEPTED_ANSWERS_COLUMNS]]);
  wsAccepted["!cols"] = ACCEPTED_ANSWERS_COLUMNS.map(() => ({ wch: 24 }));
  XLSX.utils.book_append_sheet(wb, wsAccepted, "AcceptedAnswers");
  const topicRows = [[...TOPICS_COLUMNS]];
  for (const t of topics) {
    topicRows.push([
      t.code || t.id,
      t.name,
      t.subjectCode || "MAT8",
      t.grade,
      t.description,
      "Questions varag'idagi topic_code ustunida ushbu koddan foydalaning"
    ]);
  }
  const wsTopics = XLSX.utils.aoa_to_sheet(topicRows);
  wsTopics["!cols"] = [
    { wch: 18 },
    { wch: 30 },
    { wch: 15 },
    { wch: 10 },
    { wch: 45 },
    { wch: 50 }
  ];
  XLSX.utils.book_append_sheet(wb, wsTopics, "Topics");
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Uint8Array(out);
}
function generateImportGuideMarkdown(topics = []) {
  const topicLines = topics.map((t) => `- \`${t.code || t.id}\` \u2014 ${t.name} (${t.grade}-sinf ${t.subject})`).join("\n");
  return `# LearnOS \u2014 Professional Excel (.xlsx) va ZIP Test Import Qo'llanmasi

## 1. Fayl formati
- **Oddiy test savollari (rasmsiz)**: \`LearnOS_Assessment_Import_Template.xlsx\` faylini to'ldirib yuklang.
- **Rasmli test savollari**: \`.zip\` arxiv ichiga \`LearnOS_Assessment_Import_Template.xlsx\` hamda \`media/\` papkasidagi rasmlarni (\`PNG\`, \`JPEG\`, \`WebP\`) joylab yuklang.

## 2. Varaqlarni to'ldirish qoidalari
1. **Assessment**: Test metama'lumotlari (1 qator). Bo'sh qoldirilsa, savollar umumiy Savollar bazasiga (Question Bank) qoralama sifatida tushadi.
2. **Questions**:
   - \`question_code\`: Noyob savol kodi (masalan: \`Q-001\`).
   - \`question_type\`: \`single_choice\`, \`multiple_choice\`, \`numeric\`, \`short_text\`, \`long_text\`.
   - \`question_text\`: Savol matni (majburiy).
   - \`topic_code\`: Quyidagi mavjud mavzu kodlaridan biri bo'lishi shart.
   - \`difficulty\`: \`easy\`, \`medium\`, \`hard\`.
   - \`points\`: Savol uchun maksimal ball (masalan: \`1\`, \`2\`, \`5\`).
   - \`grading_mode\`: \`automatic\`, \`manual\`, \`ai_assisted\`.
3. **Options**: Tanlovli savollar uchun variantlar (\`is_correct\` ustuniga \`TRUE\` yoki \`FALSE\` yozing).
4. **AcceptedAnswers**: \`short_text\` savollar uchun to'g'ri deb qabul qilinadigan javob variantlari.

## 3. Mavjud tasdiqlangan mavzu kodlari (\`topic_code\`)
${topicLines}
`;
}
function parseBoolCell(val) {
  if (typeof val === "boolean") return val;
  const s = String(val ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "ha" || s === "correct";
}
function makeValidationError(sheet, row, column, problem, severity = "error") {
  return {
    sheet,
    row,
    column,
    problem,
    message: problem,
    severity
  };
}
function buildEmptySummary() {
  return {
    totalQuestions: 0,
    totalOptions: 0,
    totalMedia: 0,
    singleChoiceCount: 0,
    multipleChoiceCount: 0,
    numericCount: 0,
    shortTextCount: 0,
    longTextCount: 0
  };
}
async function parseAndValidateImportPackage(fileBuffer, fileName, knownTopics, existingQuestions = []) {
  const lowerName = String(fileName || "").toLowerCase();
  const isZip = lowerName.endsWith(".zip");
  const packageType = isZip ? "zip" : "xlsx";
  const errors = [];
  const warnings = [];
  const mediaMap = /* @__PURE__ */ new Map();
  let xlsxBytes = null;
  const MAX_ARCHIVE_BYTES = 15 * 1024 * 1024;
  const MAX_ZIP_ENTRIES2 = 250;
  const MAX_UNCOMPRESSED_BYTES2 = 30 * 1024 * 1024;
  const MAX_COMPRESSION_RATIO = 100;
  if (!fileBuffer || fileBuffer.byteLength === 0) {
    errors.push(makeValidationError("Package", 0, "file", "Yuklangan fayl bo\u2018sh."));
    return {
      valid: false,
      packageType,
      fileName,
      assessmentMeta: null,
      questions: [],
      mediaFiles: [],
      totalPoints: 0,
      duplicateCodesInBank: [],
      unknownTopicCodes: [],
      errors,
      warnings,
      summary: buildEmptySummary()
    };
  }
  if (fileBuffer.byteLength > MAX_ARCHIVE_BYTES) {
    errors.push(
      makeValidationError(
        "Package",
        0,
        "file",
        "Fayl hajmi ruxsat etilgan maksimal chegaradan (15 MB) oshib ketdi."
      )
    );
    return {
      valid: false,
      packageType,
      fileName,
      assessmentMeta: null,
      questions: [],
      mediaFiles: [],
      totalPoints: 0,
      duplicateCodesInBank: [],
      unknownTopicCodes: [],
      errors,
      warnings,
      summary: buildEmptySummary()
    };
  }
  if (isZip) {
    try {
      const zip = await JSZip.loadAsync(fileBuffer);
      const entryNames = Object.keys(zip.files);
      if (entryNames.length > MAX_ZIP_ENTRIES2) {
        errors.push(
          makeValidationError(
            "Package",
            0,
            "zip",
            `ZIP arxiv ichidagi fayllar soni maksimal chegaradan (${MAX_ZIP_ENTRIES2} ta) oshib ketdi.`
          )
        );
        return {
          valid: false,
          packageType,
          fileName,
          assessmentMeta: null,
          questions: [],
          mediaFiles: [],
          totalPoints: 0,
          duplicateCodesInBank: [],
          unknownTopicCodes: [],
          errors,
          warnings,
          summary: buildEmptySummary()
        };
      }
      let totalUncompressedBytes = 0;
      for (const entryName of entryNames) {
        const zipEntry = zip.files[entryName];
        if (zipEntry.dir) continue;
        if (entryName.includes("__MACOSX") || entryName.endsWith(".DS_Store")) {
          continue;
        }
        if (!isSafeArchivePath(entryName)) {
          errors.push(
            makeValidationError(
              "Package",
              0,
              entryName,
              `Xavfsiz bo'lmagan ZIP fayl yo'li yoki ruxsat etilmagan kengaytma: ${entryName}`
            )
          );
          continue;
        }
        const rawBytes = await zipEntry.async("uint8array");
        totalUncompressedBytes += rawBytes.byteLength;
        if (totalUncompressedBytes > MAX_UNCOMPRESSED_BYTES2) {
          errors.push(
            makeValidationError(
              "Package",
              0,
              "zip",
              "ZIP arxivning ochilgandagi umumiy hajmi 30 MB chegaradan oshib ketdi (ZIP bomb himoyasi)."
            )
          );
          break;
        }
        const compressionRatio = fileBuffer.byteLength > 0 ? totalUncompressedBytes / fileBuffer.byteLength : 1;
        if (compressionRatio > MAX_COMPRESSION_RATIO && totalUncompressedBytes > 1024 * 1024) {
          errors.push(
            makeValidationError(
              "Package",
              0,
              "zip",
              "ZIP arxiv siqilish nisbati xavfli darajada yuqori (ZIP bomb himoyasi)."
            )
          );
          break;
        }
        const cleanRel = entryName.replace(/\\/g, "/").replace(/^\.\//, "");
        if (cleanRel.toLowerCase().endsWith(".xlsx")) {
          if (!xlsxBytes) {
            xlsxBytes = rawBytes;
          } else {
            warnings.push(
              `ZIP ichida bir nechta .xlsx fayl topildi; birinchisi ishlatildi (${cleanRel}).`
            );
          }
          continue;
        }
        const imgCheck = validateUploadedImageMeta(
          cleanRel,
          "",
          rawBytes.byteLength,
          rawBytes
        );
        if (!imgCheck.valid) {
          errors.push(
            makeValidationError(
              "Package",
              0,
              cleanRel,
              imgCheck.error || `Yaroqsiz rasm fayli: ${cleanRel}`
            )
          );
          continue;
        }
        const mime = imgCheck.verifiedMime || "image/png";
        const base64 = Buffer.from(rawBytes).toString("base64");
        const dataUrl = `data:${mime};base64,${base64}`;
        const fileItem = {
          relativePath: cleanRel,
          fileName: cleanRel.split("/").pop() || cleanRel,
          mimeType: mime,
          sizeBytes: rawBytes.byteLength,
          dataUrl
        };
        mediaMap.set(cleanRel.toLowerCase(), fileItem);
        const mediaIdx = cleanRel.toLowerCase().indexOf("media/");
        if (mediaIdx > 0) {
          mediaMap.set(cleanRel.slice(mediaIdx).toLowerCase(), fileItem);
        }
      }
      if (!xlsxBytes) {
        errors.push(
          makeValidationError(
            "Package",
            0,
            "workbook",
            "ZIP paket ichida .xlsx Excel jadvali topilmadi."
          )
        );
        return {
          valid: false,
          packageType,
          fileName,
          assessmentMeta: null,
          questions: [],
          mediaFiles: [],
          totalPoints: 0,
          duplicateCodesInBank: [],
          unknownTopicCodes: [],
          errors,
          warnings,
          summary: buildEmptySummary()
        };
      }
    } catch {
      errors.push(
        makeValidationError(
          "Package",
          0,
          "zip",
          "ZIP arxiv fayli shikastlangan yoki o\u2018qib bo\u2018lmadi."
        )
      );
      return {
        valid: false,
        packageType,
        fileName,
        assessmentMeta: null,
        questions: [],
        mediaFiles: [],
        totalPoints: 0,
        duplicateCodesInBank: [],
        unknownTopicCodes: [],
        errors,
        warnings,
        summary: buildEmptySummary()
      };
    }
  } else {
    xlsxBytes = fileBuffer;
  }
  let wb;
  try {
    wb = XLSX.read(xlsxBytes, { type: "array", cellFormula: false, cellHTML: false });
  } catch {
    errors.push(
      makeValidationError(
        "Package",
        0,
        "xlsx",
        "Excel (.xlsx) fayli tuzilmasi yaroqsiz yoki o\u2018qib bo\u2018lmadi."
      )
    );
    return {
      valid: false,
      packageType,
      fileName,
      assessmentMeta: null,
      questions: [],
      mediaFiles: [],
      totalPoints: 0,
      duplicateCodesInBank: [],
      unknownTopicCodes: [],
      errors,
      warnings,
      summary: buildEmptySummary()
    };
  }
  if (wb.SheetNames.length > 20) {
    errors.push(
      makeValidationError(
        "Package",
        0,
        "xlsx",
        "Excel varaqlar soni maksimal chegaradan (20 ta) oshib ketdi."
      )
    );
  }
  for (const reqSheet of ["Questions", "Options"]) {
    if (!wb.SheetNames.includes(reqSheet)) {
      errors.push(
        makeValidationError(
          "Package",
          0,
          reqSheet,
          `Majburiy "${reqSheet}" varag'i (sheet) Excel faylida mavjud emas.`
        )
      );
    }
  }
  if (errors.length > 0) {
    return {
      valid: false,
      packageType,
      fileName,
      assessmentMeta: null,
      questions: [],
      mediaFiles: Array.from(new Set(mediaMap.values())),
      totalPoints: 0,
      duplicateCodesInBank: [],
      unknownTopicCodes: [],
      errors,
      warnings,
      summary: buildEmptySummary()
    };
  }
  let assessmentMeta = null;
  if (wb.SheetNames.includes("Assessment")) {
    const assessRows = XLSX.utils.sheet_to_json(wb.Sheets["Assessment"], {
      defval: ""
    });
    const nonEmptyAssess = assessRows.filter(
      (r) => Object.values(r).some((v) => String(v ?? "").trim() !== "")
    );
    if (nonEmptyAssess.length > 1) {
      warnings.push(
        "Assessment varag'ida bir nechta qator topildi; faqat 1-qatordagi test metama'lumoti olindi."
      );
    }
    if (nonEmptyAssess.length >= 1) {
      const row = nonEmptyAssess[0];
      const title = String(row.assessment_title || row.title || "").trim();
      const code = String(row.assessment_code || `ASM-${Date.now()}`).trim();
      if (!title) {
        errors.push(
          makeValidationError(
            "Assessment",
            2,
            "assessment_title",
            "Assessment varag'i to'ldirilganda assessment_title majburiy."
          )
        );
      }
      const maxAtt = Math.max(1, Number(row.maximum_attempts || row.attempt_limit) || 1);
      assessmentMeta = {
        code,
        title: title || "Import qilingan diagnostik test",
        description: String(row.description || "").trim(),
        subject: String(row.subject || "Matematika").trim(),
        subjectCode: String(row.subject_code || "MAT8").trim(),
        grade: Number(row.grade) || 8,
        durationMinutes: Math.max(5, Number(row.duration_minutes) || 30),
        passingScorePercent: Number(row.passing_score || row.passing_score_percent) || 60,
        shuffleQuestions: parseBoolCell(row.shuffle_questions),
        attemptLimit: maxAtt,
        maximumAttempts: maxAtt,
        instructions: String(row.instructions || "").trim(),
        availabilityStart: String(row.availability_start || "").trim() || void 0,
        availabilityEnd: String(row.availability_end || "").trim() || void 0
      };
    }
  }
  const optionRows = wb.SheetNames.includes("Options") ? XLSX.utils.sheet_to_json(wb.Sheets["Options"], { defval: "" }) : [];
  const optionsByQCode = /* @__PURE__ */ new Map();
  let totalOptionsCount = 0;
  optionRows.forEach((r, idx) => {
    const rowNum = idx + 2;
    const qCode = String(r.question_code || "").trim();
    const optCode = String(r.option_code || r.option_key || "").trim();
    const optText = String(r.option_text ?? "").trim();
    const optImage = String(r.option_image || "").trim().replace(/\\/g, "/");
    if (!qCode && !optText && !optImage) return;
    if (!qCode) {
      errors.push(
        makeValidationError(
          "Options",
          rowNum,
          "question_code",
          "Variant qaysi savolga tegishli ekanini bildiruvchi question_code bo\u2018sh."
        )
      );
      return;
    }
    if (!optText && !optImage) {
      errors.push(
        makeValidationError(
          "Options",
          rowNum,
          "option_text",
          "Variantda kamida matn (option_text) yoki rasm (option_image) bo\u2018lishi shart."
        )
      );
      return;
    }
    let resolvedOptImg;
    if (optImage) {
      if (optImage.startsWith("data:image/") || optImage.startsWith("https://")) {
        resolvedOptImg = optImage;
      } else {
        const foundMedia = mediaMap.get(optImage.toLowerCase());
        if (!foundMedia) {
          errors.push(
            makeValidationError(
              "Options",
              rowNum,
              "option_image",
              `Ko'rsatilgan rasm ZIP paket ichida topilmadi: "${optImage}"`
            )
          );
        } else {
          resolvedOptImg = foundMedia.dataUrl;
        }
      }
    }
    const list = optionsByQCode.get(qCode) || [];
    const resolvedKey = optCode || String.fromCharCode(65 + list.length);
    list.push({
      rowNum,
      rawImageRef: optImage,
      opt: {
        id: `opt-${qCode}-${resolvedKey}`,
        key: resolvedKey,
        code: resolvedKey,
        text: optText,
        imageUrl: resolvedOptImg,
        isCorrect: parseBoolCell(r.is_correct),
        displayOrder: Number(r.display_order) || list.length + 1
      }
    });
    optionsByQCode.set(qCode, list);
    totalOptionsCount += 1;
  });
  const acceptedRows = wb.SheetNames.includes("AcceptedAnswers") ? XLSX.utils.sheet_to_json(wb.Sheets["AcceptedAnswers"], {
    defval: ""
  }) : [];
  const acceptedByQCode = /* @__PURE__ */ new Map();
  acceptedRows.forEach((r, idx) => {
    const rowNum = idx + 2;
    const qCode = String(r.question_code || "").trim();
    const ansText = String(r.accepted_answer ?? r.accepted_text ?? "").trim();
    if (!qCode && !ansText) return;
    if (!qCode || !ansText) {
      errors.push(
        makeValidationError(
          "AcceptedAnswers",
          rowNum,
          !qCode ? "question_code" : "accepted_answer",
          "AcceptedAnswers varag'ida question_code va accepted_answer to'ldirilishi shart."
        )
      );
      return;
    }
    const list = acceptedByQCode.get(qCode) || [];
    list.push({
      id: `acc-${qCode}-${list.length + 1}`,
      questionCode: qCode,
      acceptedAnswer: ansText,
      text: ansText,
      caseSensitive: parseBoolCell(r.case_sensitive),
      trimWhitespace: r.trim_whitespace === "" ? true : parseBoolCell(r.trim_whitespace)
    });
    acceptedByQCode.set(qCode, list);
  });
  const topicByCodeOrId = /* @__PURE__ */ new Map();
  for (const t of knownTopics) {
    topicByCodeOrId.set(t.id.toLowerCase(), t);
    if (t.code) topicByCodeOrId.set(t.code.toLowerCase(), t);
    topicByCodeOrId.set(t.name.toLowerCase(), t);
  }
  const existingByCode = /* @__PURE__ */ new Map();
  for (const eq of existingQuestions) {
    if (eq && eq.code) existingByCode.set(eq.code.trim().toLowerCase(), eq);
  }
  const questionRows = XLSX.utils.sheet_to_json(wb.Sheets["Questions"], {
    defval: ""
  });
  const seenCodesInWorkbook = /* @__PURE__ */ new Set();
  const duplicateCodesInBank = [];
  const unknownTopicCodesSet = /* @__PURE__ */ new Set();
  const parsedQuestions = [];
  let totalPoints = 0;
  const allowedTypes = /* @__PURE__ */ new Set([
    "single_choice",
    "multiple_choice",
    "numeric",
    "short_text",
    "long_text"
  ]);
  const allowedDifficulties = /* @__PURE__ */ new Set(["easy", "medium", "hard"]);
  questionRows.forEach((r, idx) => {
    const rowNum = idx + 2;
    const qCode = String(r.question_code || "").trim();
    const qTypeRaw = String(r.question_type || "").trim().toLowerCase();
    const qText = String(r.question_text ?? "").trim();
    if (!qCode && !qTypeRaw && !qText) {
      return;
    }
    if (!qCode) {
      errors.push(
        makeValidationError(
          "Questions",
          rowNum,
          "question_code",
          "Majburiy question_code ustuni bo\u2018sh."
        )
      );
    } else {
      const normCode = qCode.toLowerCase();
      if (seenCodesInWorkbook.has(normCode)) {
        errors.push(
          makeValidationError(
            "Questions",
            rowNum,
            "question_code",
            `Fayl ichida takroriy savol kodi (duplicate question_code): "${qCode}"`
          )
        );
      }
      seenCodesInWorkbook.add(normCode);
    }
    if (!allowedTypes.has(qTypeRaw)) {
      errors.push(
        makeValidationError(
          "Questions",
          rowNum,
          "question_type",
          `Qo'llab-quvvatlanmaydigan savol turi: "${r.question_type}". Ruxsat etilganlar: single_choice, multiple_choice, numeric, short_text, long_text.`
        )
      );
    }
    if (!qText || qText.length < 3) {
      errors.push(
        makeValidationError(
          "Questions",
          rowNum,
          "question_text",
          "Savol matni (question_text) bo\u2018sh yoki juda qisqa."
        )
      );
    }
    const topicCodeRaw = String(r.topic_code || "").trim();
    const matchedTopic = topicByCodeOrId.get(topicCodeRaw.toLowerCase());
    if (!topicCodeRaw || !matchedTopic) {
      unknownTopicCodesSet.add(topicCodeRaw || "(bo\u2018sh)");
      errors.push(
        makeValidationError(
          "Questions",
          rowNum,
          "topic_code",
          `Noma'lum yoki tasdiqlanmagan mavzu kodi (topic_code): "${topicCodeRaw}". Topics varag'idagi mavjud kodlardan foydalaning.`
        )
      );
    }
    const diffRaw = String(r.difficulty || "medium").trim().toLowerCase();
    if (!allowedDifficulties.has(diffRaw)) {
      errors.push(
        makeValidationError(
          "Questions",
          rowNum,
          "difficulty",
          `Noto'g'ri difficulty qiymati: "${r.difficulty}". Ruxsat etilganlar: easy, medium, hard.`
        )
      );
    }
    const pts = Number(r.points);
    if (Number.isNaN(pts) || pts <= 0) {
      errors.push(
        makeValidationError(
          "Questions",
          rowNum,
          "points",
          `Savol bali (points) 0 dan katta son bo'lishi shart (kiritilgan: "${r.points}").`
        )
      );
    }
    const rawGM = String(
      r.grading_mode || (qTypeRaw === "long_text" ? "manual" : "automatic")
    ).trim().toLowerCase();
    const normalizedGradingMode = rawGM === "auto" || rawGM === "automatic" ? "automatic" : rawGM === "manual" || rawGM === "manual_rubric" ? "manual" : rawGM === "ai_assisted" ? "ai_assisted" : rawGM;
    if (normalizedGradingMode !== "automatic" && normalizedGradingMode !== "manual" && normalizedGradingMode !== "ai_assisted") {
      errors.push(
        makeValidationError(
          "Questions",
          rowNum,
          "grading_mode",
          `Noto'g'ri grading_mode: "${r.grading_mode}". Ruxsat etilganlar: automatic, manual, ai_assisted.`
        )
      );
    }
    const qImgRef = String(r.question_image || "").trim().replace(/\\/g, "/");
    let resolvedQImage;
    if (qImgRef) {
      if (qImgRef.startsWith("data:image/") || qImgRef.startsWith("https://")) {
        resolvedQImage = qImgRef;
      } else {
        const foundMedia = mediaMap.get(qImgRef.toLowerCase());
        if (!foundMedia) {
          errors.push(
            makeValidationError(
              "Questions",
              rowNum,
              "question_image",
              `Ko'rsatilgan rasm ZIP paket ichida mavjud emas: "${qImgRef}"`
            )
          );
        } else {
          resolvedQImage = foundMedia.dataUrl;
        }
      }
    }
    const expImgRef = String(r.explanation_image || "").trim().replace(/\\/g, "/");
    let resolvedExpImage;
    if (expImgRef) {
      if (expImgRef.startsWith("data:image/") || expImgRef.startsWith("https://")) {
        resolvedExpImage = expImgRef;
      } else {
        const foundExpMedia = mediaMap.get(expImgRef.toLowerCase());
        if (!foundExpMedia) {
          errors.push(
            makeValidationError(
              "Questions",
              rowNum,
              "explanation_image",
              `Ko'rsatilgan yechim rasmi ZIP paket ichida mavjud emas: "${expImgRef}"`
            )
          );
        } else {
          resolvedExpImage = foundExpMedia.dataUrl;
        }
      }
    }
    const qOpts = (optionsByQCode.get(qCode) || []).sort(
      (a, b) => (a.opt.displayOrder || 0) - (b.opt.displayOrder || 0)
    );
    const qAccepted = acceptedByQCode.get(qCode) || [];
    let correctAnswer = "";
    let correctAnswers;
    let numericTolerance;
    if (qTypeRaw === "single_choice") {
      if (qOpts.length < 2) {
        errors.push(
          makeValidationError(
            "Options",
            rowNum,
            "question_code",
            `"${qCode}" (single_choice) savoli uchun Options varag'ida kamida 2 ta variant bo'lishi kerak.`
          )
        );
      }
      const correctOpts = qOpts.filter((o) => o.opt.isCorrect);
      if (correctOpts.length !== 1) {
        errors.push(
          makeValidationError(
            "Options",
            qOpts[0]?.rowNum || rowNum,
            "is_correct",
            `"${qCode}" (single_choice) savoli uchun aynan 1 ta to'g'ri javob belgilanishi shart (topildi: ${correctOpts.length} ta).`
          )
        );
      } else {
        correctAnswer = correctOpts[0].opt.text || correctOpts[0].opt.code || "";
      }
    } else if (qTypeRaw === "multiple_choice") {
      if (qOpts.length < 2) {
        errors.push(
          makeValidationError(
            "Options",
            rowNum,
            "question_code",
            `"${qCode}" (multiple_choice) savoli uchun Options varag'ida kamida 2 ta variant bo'lishi kerak.`
          )
        );
      }
      const correctOpts = qOpts.filter((o) => o.opt.isCorrect);
      if (correctOpts.length < 1) {
        errors.push(
          makeValidationError(
            "Options",
            qOpts[0]?.rowNum || rowNum,
            "is_correct",
            `"${qCode}" (multiple_choice) savoli uchun kamida 1 ta to'g'ri javob belgilanishi shart.`
          )
        );
      } else {
        correctAnswers = correctOpts.map((o) => o.opt.text || o.opt.code || "");
        correctAnswer = (correctAnswers || []).join(" | ");
      }
    } else if (qTypeRaw === "numeric") {
      const rawNum = String(r.numeric_correct_answer ?? r.numeric_answer ?? "").trim().replace(/,/g, ".");
      if (rawNum === "" || Number.isNaN(Number(rawNum))) {
        errors.push(
          makeValidationError(
            "Questions",
            rowNum,
            "numeric_correct_answer",
            `"${qCode}" (numeric) savoli uchun haqiqiy sonli javob (numeric_correct_answer) kiritilishi shart.`
          )
        );
      } else {
        correctAnswer = rawNum;
      }
      const rawTol = String(r.numeric_tolerance ?? "").trim().replace(/,/g, ".");
      if (rawTol !== "") {
        const parsedTol = Number(rawTol);
        if (Number.isNaN(parsedTol) || parsedTol < 0) {
          errors.push(
            makeValidationError(
              "Questions",
              rowNum,
              "numeric_tolerance",
              `"${qCode}" uchun numeric_tolerance manfiy bo'lmagan son bo'lishi kerak.`
            )
          );
        } else {
          numericTolerance = parsedTol;
        }
      }
    } else if (qTypeRaw === "short_text") {
      if (normalizedGradingMode === "automatic" && qAccepted.length === 0) {
        errors.push(
          makeValidationError(
            "AcceptedAnswers",
            rowNum,
            "accepted_answer",
            `"${qCode}" (short_text, automatic) savoli uchun AcceptedAnswers varag'ida kamida 1 ta qabul qilinuvchi javob bo'lishi shart.`
          )
        );
      }
      correctAnswer = qAccepted[0]?.acceptedAnswer || String(r.rubric || "").trim() || "(yozma javob)";
    } else if (qTypeRaw === "long_text") {
      if (normalizedGradingMode === "automatic") {
        errors.push(
          makeValidationError(
            "Questions",
            rowNum,
            "grading_mode",
            `"${qCode}" (long_text) savoli faqat "manual" yoki "ai_assisted" baholash rejimida bo'lishi mumkin.`
          )
        );
      }
      if (!String(r.rubric || "").trim()) {
        warnings.push(
          `"${qCode}" (long_text) savoli uchun rubric (baholash mezoni) kiritilmagan; standart mezon qo'llanadi.`
        );
      }
      correctAnswer = String(r.rubric || r.explanation || "Mezon asosida tekshiriladi").trim();
    }
    const existingMatch = qCode ? existingByCode.get(qCode.toLowerCase()) : void 0;
    if (existingMatch) {
      duplicateCodesInBank.push(qCode);
    }
    const validPts = !Number.isNaN(pts) && pts > 0 ? pts : 1;
    totalPoints += validPts;
    parsedQuestions.push({
      code: qCode,
      type: allowedTypes.has(qTypeRaw) ? qTypeRaw : "single_choice",
      prompt: qText,
      questionImageRef: qImgRef || void 0,
      imageUrl: resolvedQImage,
      explanationImageRef: expImgRef || void 0,
      explanationImageUrl: resolvedExpImage,
      subject: matchedTopic?.subject || "Matematika",
      subjectCode: String(r.subject_code || matchedTopic?.subjectCode || "MAT8").trim(),
      grade: Number(r.grade) || matchedTopic?.grade || 8,
      topicId: matchedTopic?.id || "topic-fractions",
      topicCode: topicCodeRaw,
      difficulty: allowedDifficulties.has(diffRaw) ? diffRaw : "medium",
      points: validPts,
      explanation: String(r.explanation || "Yechim qadamlari asosida hisoblandi.").trim(),
      gradingMode: normalizedGradingMode === "automatic" || normalizedGradingMode === "manual" || normalizedGradingMode === "ai_assisted" ? normalizedGradingMode : "automatic",
      rubricText: String(r.rubric || "").trim() || void 0,
      correctAnswer,
      correctAnswers,
      numericTolerance,
      options: qOpts.length > 0 ? qOpts.map((o) => o.opt.text || o.opt.code || "") : void 0,
      structuredOptions: qOpts.length > 0 ? qOpts.map((o) => o.opt) : void 0,
      acceptedAnswers: qAccepted.length > 0 ? qAccepted : void 0,
      isDuplicateInBank: Boolean(existingMatch),
      existingQuestionId: existingMatch?.id
    });
  });
  if (parsedQuestions.length === 0 && errors.length === 0) {
    errors.push(
      makeValidationError(
        "Questions",
        2,
        "question_code",
        "Questions varag'ida birorta ham savol topilmadi."
      )
    );
  }
  const uniqueMediaFiles = Array.from(new Set(mediaMap.values()));
  const summary = {
    totalQuestions: parsedQuestions.length,
    totalOptions: totalOptionsCount,
    totalMedia: uniqueMediaFiles.length,
    singleChoiceCount: parsedQuestions.filter((q) => q.type === "single_choice").length,
    multipleChoiceCount: parsedQuestions.filter((q) => q.type === "multiple_choice").length,
    numericCount: parsedQuestions.filter((q) => q.type === "numeric").length,
    shortTextCount: parsedQuestions.filter((q) => q.type === "short_text").length,
    longTextCount: parsedQuestions.filter((q) => q.type === "long_text").length
  };
  return {
    valid: errors.length === 0 && parsedQuestions.length > 0,
    packageType,
    fileName,
    assessmentMeta,
    questions: parsedQuestions,
    mediaFiles: uniqueMediaFiles,
    totalPoints,
    duplicateCodesInBank,
    unknownTopicCodes: Array.from(unknownTopicCodesSet),
    errors,
    warnings,
    summary
  };
}

// src/utils/workPlanAndCommandEngine.ts
import * as XLSX2 from "xlsx";
function generateWorkPlanTemplateExcelBuffer(classCode = "7a1", subjectName = "Matematika", academicYear = "2026-2027") {
  const wb = XLSX2.utils.book_new();
  const rows = [
    {
      Dars_Raqami: 1,
      Chorak: 1,
      Hafta: 1,
      Bob_Bo_lim: "1-bob. Ratsional sonlar va kasrlar",
      Mavzu: "Kasrlar va ratsional sonlar",
      Dars_Mavzusi: "Oddiy kasrlarni umumiy maxrajga keltirish",
      O_quv_Maqsadi: "Oddiy kasrlarni taqqoslash va qo\u2018shish qoidalarini qo\u2018llash",
      Sana: "2026-09-04",
      Soat: 1,
      Uyga_Vazifa: "1-12 misollar (14-bet)",
      Nazorat_Izohi: "Og\u2018zaki savol-javob"
    },
    {
      Dars_Raqami: 2,
      Chorak: 1,
      Hafta: 1,
      Bob_Bo_lim: "1-bob. Ratsional sonlar va kasrlar",
      Mavzu: "Kasrlar va ratsional sonlar",
      Dars_Mavzusi: "Aralash kasrlar ustida arifmetik amallar",
      O_quv_Maqsadi: "Aralash kasrlarni ko\u2018paytirish va bo\u2018lish amallarini bajarish",
      Sana: "2026-09-07",
      Soat: 1,
      Uyga_Vazifa: "15-24 misollar (18-bet)",
      Nazorat_Izohi: "Mustaqil ish"
    },
    {
      Dars_Raqami: 3,
      Chorak: 1,
      Hafta: 2,
      Bob_Bo_lim: "1-bob. Ratsional sonlar va kasrlar",
      Mavzu: "Foizlar va proporsiyalar",
      Dars_Mavzusi: "Sonning foizini topish va foizli o\u2018zgarish masalalari",
      O_quv_Maqsadi: "Matnli masalalarda foiz va proporsiya tenglamalarini tuzish",
      Sana: "2026-09-10",
      Soat: 1,
      Uyga_Vazifa: "28-36 masalalar (22-bet)",
      Nazorat_Izohi: "Diagnostik mini-test"
    }
  ];
  const ws = XLSX2.utils.json_to_sheet(rows);
  XLSX2.utils.book_append_sheet(wb, ws, "Ish_Reja");
  const metaRows = [
    { Parametr: "Maktab", Qiymat: "Specialized Study" },
    { Parametr: "Sinf", Qiymat: classCode },
    { Parametr: "Fan", Qiymat: subjectName },
    { Parametr: "O\u2018quv yili", Qiymat: academicYear }
  ];
  const metaWs = XLSX2.utils.json_to_sheet(metaRows);
  XLSX2.utils.book_append_sheet(wb, metaWs, "Ma_lumot");
  const out = XLSX2.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(out);
}
function parseWorkPlanRowsFromBufferOrText(fileName, buffer, rawText, explicitRows, defaultSubject = "Matematika", defaultQuarter = 1) {
  const warnings = [];
  const extractedRows = [];
  if (Array.isArray(explicitRows) && explicitRows.length > 0) {
    explicitRows.forEach((r, idx) => {
      const lessonNum = Number(r.lessonNumber) || idx + 1;
      const qtr = [1, 2, 3, 4].includes(Number(r.quarter)) ? Number(r.quarter) : defaultQuarter;
      const rowWarnings = [];
      if (!r.scheduledDate) {
        rowWarnings.push(`${lessonNum}-dars uchun sana ko\u2018rsatilmagan.`);
      }
      extractedRows.push({
        rowId: r.rowId || `wprow-${Date.now()}-${idx + 1}`,
        lessonNumber: lessonNum,
        quarter: qtr,
        weekNumber: Number(r.weekNumber) || Math.ceil(lessonNum / 3),
        unitTitle: String(r.unitTitle || `${qtr}-chorak bo\u2018limi`).trim(),
        topicName: String(r.topicName || r.lessonTitle || `${defaultSubject} asosiy mavzusi`).trim(),
        lessonTitle: String(r.lessonTitle || r.topicName || `${lessonNum}-dars`).trim(),
        learningObjectives: String(
          r.learningObjectives || "Mavzu bo\u2018yicha nazariy va amaliy ko\u2018nikmalarni shakllantirish."
        ).trim(),
        scheduledDate: r.scheduledDate ? String(r.scheduledDate).trim() : void 0,
        hours: Number(r.hours) > 0 ? Number(r.hours) : 1,
        homework: r.homework ? String(r.homework).trim() : void 0,
        assessmentNote: r.assessmentNote ? String(r.assessmentNote).trim() : void 0,
        warnings: rowWarnings
      });
    });
  } else if (buffer && /\.(xlsx|xls|csv)$/i.test(fileName)) {
    try {
      const wb = XLSX2.read(buffer, { type: "array" });
      const firstSheetName = wb.SheetNames[0];
      if (firstSheetName) {
        const sheet = wb.Sheets[firstSheetName];
        const jsonRows = XLSX2.utils.sheet_to_json(sheet, { defval: "" });
        jsonRows.forEach((rawRow, idx) => {
          const keys = Object.keys(rawRow);
          const findVal = (patterns) => {
            for (const k of keys) {
              if (patterns.some((p) => p.test(k.toLowerCase()))) {
                return String(rawRow[k] ?? "").trim();
              }
            }
            return "";
          };
          const rawNum = findVal([/dars_raqam|no|#|order|tartib|raqam/i]);
          const lessonNumber = Number(rawNum) || idx + 1;
          const rawQuarter = Number(findVal([/chorak|quarter/i]));
          const quarter = [1, 2, 3, 4].includes(rawQuarter) ? rawQuarter : defaultQuarter;
          const unitTitle = findVal([/bob|bo_lim|unit|bo'lim|section/i]) || `${quarter}-chorak o\u2018quv bo\u2018limi`;
          const lessonTitle = findVal([/dars_mavzu|lesson|mavzu_nomi|title|dars/i]) || findVal([/mavzu|topic/i]) || `${lessonNumber}-dars`;
          const topicName = findVal([/^mavzu$|topic/i]) || lessonTitle;
          const learningObjectives = findVal([/maqsad|objective|kompetensiya|ko_nikma/i]) || `${lessonTitle} bo\u2018yicha amaliy va nazariy ko\u2018nikmalarni egallash.`;
          const scheduledDate = findVal([/sana|date|muddat/i]) || void 0;
          const hours = Number(findVal([/soat|hour/i])) || 1;
          const homework = findVal([/uyga|homework|vazifa/i]) || void 0;
          const assessmentNote = findVal([/nazorat|baholash|izoh|note/i]) || void 0;
          if (!lessonTitle && !topicName) return;
          const rowWarnings = [];
          if (!scheduledDate) {
            rowWarnings.push(`${lessonNumber}-darsda sana kiritilmagan.`);
          }
          extractedRows.push({
            rowId: `wprow-${Date.now()}-${idx + 1}`,
            lessonNumber,
            quarter,
            weekNumber: Math.ceil(lessonNumber / 3),
            unitTitle,
            topicName,
            lessonTitle,
            learningObjectives,
            scheduledDate,
            hours,
            homework,
            assessmentNote,
            warnings: rowWarnings
          });
        });
      }
    } catch (err) {
      warnings.push(`Jadval faylini o\u2018qishda ogohlantirish: ${err?.message || "Format tekshirildi"}`);
    }
  }
  if (extractedRows.length === 0) {
    let textContent = rawText || "";
    if (!textContent && buffer && buffer.byteLength > 0) {
      try {
        const decoded = Buffer.from(buffer).toString("utf-8");
        if (decoded && !decoded.includes("\0")) {
          textContent = decoded;
        }
      } catch {
      }
    }
    const lines = textContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length >= 3 && !l.startsWith("#"));
    if (lines.length > 0) {
      lines.forEach((line, idx) => {
        const parts = line.split(/[|;\t]/).map((p) => p.trim());
        const lessonNum = idx + 1;
        const lessonTitle = parts.length >= 2 ? parts[1] : line.replace(/^\d+[\s.)-]+/, "").trim() || `${lessonNum}-dars`;
        const topicName = parts.length >= 3 ? parts[2] : lessonTitle;
        const learningObjectives = parts.length >= 4 ? parts[3] : `${lessonTitle} bo\u2018yicha asosiy tushuncha va masalalarni o\u2018zlashtirish.`;
        const scheduledDate = parts.find((p) => /^\d{4}-\d{2}-\d{2}$/.test(p)) || void 0;
        extractedRows.push({
          rowId: `wprow-${Date.now()}-${idx + 1}`,
          lessonNumber: lessonNum,
          quarter: defaultQuarter,
          weekNumber: Math.ceil(lessonNum / 3),
          unitTitle: `${defaultQuarter}-chorak. ${defaultSubject} kursi`,
          topicName,
          lessonTitle,
          learningObjectives,
          scheduledDate,
          hours: 1
        });
      });
    }
  }
  const seenNumbers = /* @__PURE__ */ new Set();
  for (const row of extractedRows) {
    if (seenNumbers.has(row.lessonNumber)) {
      warnings.push(`Takroriy dars raqami aniqlandi: ${row.lessonNumber}-dars.`);
    }
    seenNumbers.add(row.lessonNumber);
    if (!row.scheduledDate) {
      warnings.push(`${row.lessonNumber}-dars ("${row.lessonTitle}") uchun sana ko\u2018rsatilmagan.`);
    }
  }
  return { rows: extractedRows, warnings };
}
function buildStructuredQuestionsForLessonOrTopic(params) {
  const {
    institutionId,
    authorId,
    classCode,
    grade,
    subjectName,
    subjectCode,
    lesson,
    topic,
    count,
    difficulty,
    questionTypes = ["single_choice", "multiple_choice", "numeric", "short_text"]
  } = params;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const safeCount = Math.max(1, Math.min(40, Number(count) || 10));
  const result = [];
  const contextTitle = lesson ? `${lesson.lessonNumber}-dars: ${lesson.title}` : topic.name;
  const subjNorm = subjectName.trim().toLowerCase();
  for (let i = 0; i < safeCount; i++) {
    const qNum = i + 1;
    const selectedType = questionTypes[i % questionTypes.length] || "single_choice";
    const qId = `q-ai-${Date.now()}-${qNum}-${Math.random().toString(36).slice(2, 5)}`;
    const qCode = `SS-${(subjectCode || subjectName.slice(0, 3)).toUpperCase()}-${classCode.toUpperCase()}-${qNum}`;
    if (selectedType === "numeric") {
      const a = 2 + qNum % 5;
      const xVal = 3 + qNum;
      const b = 4 + qNum % 7;
      const rhs = a * xVal + b;
      const promptText = subjNorm.includes("fizika") ? `${classCode.toUpperCase()} \u0424\u0438\u0437\u0438\u043A\u0430 (${contextTitle}): Jism ${a} m/s\xB2 tezlanish bilan ${xVal} s harakatlandi va boshlang\u2018ich tezligi ${b} m/s edi. Yakuniy tezlikni (m/s) hisoblang.` : subjNorm.includes("kimyo") ? `${classCode.toUpperCase()} Kimyo (${contextTitle}): Reaksiyada ${a} mol modda har birida ${xVal} g dan qatnashib, qo\u2018shimcha ${b} g erituvchi qo\u2018shildi. Umumiy massani (g) toping.` : `${classCode.toUpperCase()} ${subjectName} (${contextTitle}): ${a}x + ${b} = ${rhs} tenglamadan x ning qiymatini toping.`;
      const correctAns = subjNorm.includes("fizika") || subjNorm.includes("kimyo") ? String(rhs) : String(xVal);
      result.push({
        id: qId,
        code: qCode,
        institutionId,
        authorId,
        subject: subjectName,
        subjectCode,
        grade,
        classCode,
        lessonId: lesson?.id,
        topicId: topic.id,
        topicCode: topic.code,
        difficulty,
        type: "numeric",
        points: 2,
        prompt: promptText,
        correctAnswer: correctAns,
        numericTolerance: 0.01,
        gradingMode: "auto",
        explanation: `Formula va arifmetik hisoblash asosida to\u2018g\u2018ri javob: ${correctAns}.`,
        status: "draft",
        version: 1,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      continue;
    }
    if (selectedType === "short_text") {
      const termAnswer = subjNorm.includes("biologiya") ? "mitoxondriya" : subjNorm.includes("kimyo") ? "kovalent" : subjNorm.includes("ingliz") ? "went" : subjNorm.includes("fizika") ? "nyuton" : "proporsiya";
      const promptText = subjNorm.includes("biologiya") ? `${classCode.toUpperCase()} Biologiya (${contextTitle}): Hujayraning energiya stansiyasi (ATF sintezlovchi organoid) nima deb ataladi? (1 so\u2018z bilan yozing)` : subjNorm.includes("kimyo") ? `${classCode.toUpperCase()} Kimyo (${contextTitle}): Umumiy elektron juftlari hisobiga hosil bo\u2018ladigan kimyoviy bog\u2018lanish turi qanday ataladi?` : subjNorm.includes("ingliz") ? `${classCode.toUpperCase()} Ingliz tili (${contextTitle}): "Go" fe\u2019lining Past Simple (o\u2018tgan zamon) shaklini yozing.` : subjNorm.includes("fizika") ? `${classCode.toUpperCase()} Fizika (${contextTitle}): Xalqaro birliklar tizimida (SI) kuch birligi nima deb ataladi?` : `${classCode.toUpperCase()} ${subjectName} (${contextTitle}): Ikki nisbatning tengligi matematikada bir so\u2018z bilan nima deb ataladi?`;
      result.push({
        id: qId,
        code: qCode,
        institutionId,
        authorId,
        subject: subjectName,
        subjectCode,
        grade,
        classCode,
        lessonId: lesson?.id,
        topicId: topic.id,
        topicCode: topic.code,
        difficulty,
        type: "short_text",
        points: 2,
        prompt: promptText,
        correctAnswer: termAnswer,
        acceptedAnswers: [
          {
            acceptedAnswer: termAnswer,
            caseSensitive: false,
            trimWhitespace: true
          }
        ],
        gradingMode: "auto",
        explanation: `Mavzu qoidasiga ko\u2018ra to\u2018g\u2018ri atama: "${termAnswer}".`,
        status: "draft",
        version: 1,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      continue;
    }
    if (selectedType === "multiple_choice") {
      const n1 = qNum + 2;
      const n2 = (qNum + 2) * 2;
      const opt1 = `${n1}/${n2}`;
      const opt2 = `${n1 * 2}/${n2 * 2}`;
      const opt3 = `${n1 + 1}/${n2}`;
      const opt4 = `${n1}/${n2 + 3}`;
      result.push({
        id: qId,
        code: qCode,
        institutionId,
        authorId,
        subject: subjectName,
        subjectCode,
        grade,
        classCode,
        lessonId: lesson?.id,
        topicId: topic.id,
        topicCode: topic.code,
        difficulty,
        type: "multiple_choice",
        points: 2,
        prompt: `${classCode.toUpperCase()} ${subjectName} (${contextTitle}): Quyidagi ifodalardan qaysilari 1/2 ga teng kuchli? (Barcha to\u2018g\u2018ri javoblarni belgilang)`,
        options: [opt1, opt2, opt3, opt4],
        structuredOptions: [
          { code: "A", text: opt1, isCorrect: true, displayOrder: 1 },
          { code: "B", text: opt2, isCorrect: true, displayOrder: 2 },
          { code: "C", text: opt3, isCorrect: false, displayOrder: 3 },
          { code: "D", text: opt4, isCorrect: false, displayOrder: 4 }
        ],
        correctAnswer: `${opt1}|${opt2}`,
        correctAnswers: [opt1, opt2],
        gradingMode: "auto",
        explanation: `${opt1} va ${opt2} kasrlarini qisqartirganda 1/2 hosil bo\u2018ladi.`,
        status: "draft",
        version: 1,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      continue;
    }
    if (selectedType === "long_text") {
      result.push({
        id: qId,
        code: qCode,
        institutionId,
        authorId,
        subject: subjectName,
        subjectCode,
        grade,
        classCode,
        lessonId: lesson?.id,
        topicId: topic.id,
        topicCode: topic.code,
        difficulty,
        type: "long_text",
        points: 3,
        prompt: `${classCode.toUpperCase()} ${subjectName} (${contextTitle}): Mavzuning asosiy qoidasini misol yordamida bosqichma-bosqich tushuntirib yozing.`,
        correctAnswer: "Bosqichma-bosqich yechim va xulosa",
        gradingMode: "manual_rubric",
        rubricText: "1 ball \u2014 qoidani to\u2018g\u2018ri ifodalash; 1 ball \u2014 misol keltirish; 1 ball \u2014 to\u2018g\u2018ri yakuniy xulosa.",
        explanation: "Yozma javob baholash mezoni (rubrika) asosida tekshiriladi.",
        status: "draft",
        version: 1,
        createdAt: nowIso,
        updatedAt: nowIso
      });
      continue;
    }
    const k = qNum + 3;
    const ansVal = String(k * 4);
    const opts = [ansVal, String(k * 4 - 2), String(k * 4 + 3), String(k * 3)];
    const singlePrompt = subjNorm.includes("biologiya") ? `${classCode.toUpperCase()} Biologiya (${contextTitle}, ${qNum}-savol): Fotosintez jarayoni o\u2018simlik hujayrasining qaysi plastidasida kechadi?` : subjNorm.includes("kimyo") ? `${classCode.toUpperCase()} Kimyo (${contextTitle}, ${qNum}-savol): Suv molekulasining (H2O) nisbiy molekulyar massasi nechaga teng?` : subjNorm.includes("ingliz") ? `${classCode.toUpperCase()} Ingliz tili (${contextTitle}, ${qNum}-savol): Choose the correct form: "She ___ to the specialized school every day."` : `${classCode.toUpperCase()} ${subjectName} (${contextTitle}, ${qNum}-savol): Agar x / 4 = ${k} bo\u2018lsa, x ning qiymatini toping.`;
    const singleOptions = subjNorm.includes("biologiya") ? ["Xloroplast", "Ribosoma", "Lizosoma", "Vakuola"] : subjNorm.includes("kimyo") ? ["18", "16", "20", "14"] : subjNorm.includes("ingliz") ? ["goes", "go", "going", "gone"] : opts;
    const singleCorrect = singleOptions[0];
    result.push({
      id: qId,
      code: qCode,
      institutionId,
      authorId,
      subject: subjectName,
      subjectCode,
      grade,
      classCode,
      lessonId: lesson?.id,
      topicId: topic.id,
      topicCode: topic.code,
      difficulty,
      type: "single_choice",
      points: 1,
      prompt: singlePrompt,
      options: singleOptions,
      structuredOptions: singleOptions.map((optText, idx) => ({
        code: ["A", "B", "C", "D"][idx] || `OPT${idx + 1}`,
        text: optText,
        isCorrect: idx === 0,
        displayOrder: idx + 1
      })),
      correctAnswer: singleCorrect,
      gradingMode: "auto",
      explanation: `"${contextTitle}" mavzusi qoidasiga ko\u2018ra to\u2018g\u2018ri javob: ${singleCorrect}.`,
      status: "draft",
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }
  return result;
}
function parseUzbekAICommand(rawCommand, classes, subjects, lessons, workPlans) {
  const text = String(rawCommand || "").trim();
  const lower = text.toLowerCase();
  const warnings = [];
  let matchedClass;
  for (const code of [...OFFICIAL_19_CLASS_CODES].sort((a, b) => b.length - a.length)) {
    const regex = new RegExp(`\\b${code}\\b`, "i");
    if (regex.test(lower)) {
      matchedClass = classes.find(
        (c) => (c.code || c.name).toLowerCase() === code.toLowerCase()
      );
      break;
    }
  }
  if (!matchedClass) {
    matchedClass = classes.find((c) => c.code === "7a1") || classes[0];
  }
  let matchedSubject;
  if (/matematika|algebra|geometriya/i.test(lower)) {
    matchedSubject = subjects.find((s) => s.name.toLowerCase().includes("matematika"));
  } else if (/ingliz|english/i.test(lower)) {
    matchedSubject = subjects.find((s) => s.name.toLowerCase().includes("ingliz"));
  } else if (/fizika/i.test(lower)) {
    matchedSubject = subjects.find((s) => s.name.toLowerCase().includes("fizika"));
  } else if (/biologiya/i.test(lower)) {
    matchedSubject = subjects.find((s) => s.name.toLowerCase().includes("biologiya"));
  } else if (/kimyo/i.test(lower)) {
    matchedSubject = subjects.find((s) => s.name.toLowerCase().includes("kimyo"));
  } else {
    for (const s of subjects) {
      if (lower.includes(s.name.toLowerCase())) {
        matchedSubject = s;
        break;
      }
    }
  }
  if (!matchedSubject && matchedClass) {
    const defaultSubjName = matchedClass.track === "T" ? "Biologiya" : "Matematika";
    matchedSubject = subjects.find((s) => s.name.toLowerCase() === defaultSubjName.toLowerCase()) || subjects[0];
  }
  if (matchedClass && matchedSubject) {
    const compat = isSubjectCompatibleWithClass(matchedSubject.name, matchedClass, subjects);
    if (!compat.compatible && compat.reason) {
      warnings.push(compat.reason);
    }
  }
  let difficulty = "medium";
  if (/qiyin|murakkab\b/i.test(lower) && !/o‘rta|o'rta|orta/i.test(lower)) {
    difficulty = "hard";
  } else if (/oson|yengil/i.test(lower)) {
    difficulty = "easy";
  } else if (/o‘rta|o'rta|orta/i.test(lower)) {
    difficulty = "medium";
  }
  const lessonMatch = lower.match(/(\d+)\s*-\s*dars/i);
  const lessonNumber = lessonMatch ? Number(lessonMatch[1]) : void 0;
  const quarterMatch = lower.match(/([1-4])\s*-\s*chorak/i);
  const quarter = quarterMatch ? Number(quarterMatch[1]) : void 0;
  const countMatch = lower.match(/(\d+)\s*ta\s*(test|savol|dars|mashq)/i);
  const questionCount = countMatch ? Math.max(1, Math.min(40, Number(countMatch[1]))) : 10;
  if (/o['‘`]?quvchilar.*sarala|sarala.*o['‘`]?quvchi/i.test(lower)) {
    return {
      intent: "sort_class_students",
      matchedClass,
      matchedSubject,
      questionCount,
      difficulty,
      warnings
    };
  }
  if (/o['‘`]?quvchilar.*ko['‘`]?rsat|sinf.*o['‘`]?quvchilar/i.test(lower)) {
    return {
      intent: "show_class_students",
      matchedClass,
      matchedSubject,
      questionCount,
      difficulty,
      warnings
    };
  }
  if (/ish\s*reja.*o['‘`]?quv\s*xarita|xaritaga\s*aylantir/i.test(lower)) {
    const matchedWorkPlan = workPlans.find(
      (wp) => !matchedClass || wp.classId === matchedClass.id || wp.classCode.toLowerCase() === matchedClass.code.toLowerCase()
    );
    return {
      intent: "convert_work_plan_to_map",
      matchedClass,
      matchedSubject,
      matchedWorkPlan,
      questionCount,
      difficulty,
      warnings
    };
  }
  if (/keyingi.*dars.*ko['‘`]?rsat|darslarni\s*ko['‘`]?rsat|darsini\s*ko['‘`]?rsat|shu\s*chorakdagi\s*dars/i.test(lower)) {
    return {
      intent: "show_upcoming_lessons",
      matchedClass,
      matchedSubject,
      quarter,
      questionCount: countMatch ? Number(countMatch[1]) : 10,
      difficulty,
      warnings
    };
  }
  if (quarter && /takrorlash|chorak/i.test(lower)) {
    return {
      intent: "generate_quarter_review_test",
      matchedClass,
      matchedSubject,
      quarter,
      questionCount,
      difficulty,
      warnings
    };
  }
  if (/bugungi\s*dars/i.test(lower)) {
    const classLessons2 = lessons.filter(
      (l) => (!matchedClass || l.classCode.toLowerCase() === matchedClass.code.toLowerCase()) && (!matchedSubject || l.subjectName.toLowerCase() === matchedSubject.name.toLowerCase())
    );
    const matchedLesson2 = classLessons2.find((l) => l.status === "in_progress" || l.status === "published") || classLessons2[0];
    return {
      intent: "generate_today_questions",
      matchedClass,
      matchedSubject,
      matchedLesson: matchedLesson2,
      questionCount,
      difficulty,
      warnings
    };
  }
  const classLessons = lessons.filter(
    (l) => (!matchedClass || l.classCode.toLowerCase() === matchedClass.code.toLowerCase()) && (!matchedSubject || l.subjectName.toLowerCase() === matchedSubject.name.toLowerCase())
  );
  const matchedLesson = lessonNumber ? classLessons.find((l) => l.lessonNumber === lessonNumber) || classLessons[0] : classLessons[0];
  return {
    intent: "generate_lesson_test",
    matchedClass,
    matchedSubject,
    matchedLesson,
    lessonNumber,
    quarter,
    questionCount,
    difficulty,
    warnings
  };
}

// src/utils/studentExcelImporter.ts
import * as XLSX3 from "xlsx";
var FULL_NAME_ALIASES = [
  "full_name",
  "fullname",
  "full name",
  "f.i.sh.",
  "f.i.sh",
  "fish",
  "f.i.o.",
  "f.i.o",
  "fio",
  "\u0444.\u0438.\u043E.",
  "\u0444.\u0438.\u043E",
  "\u0444\u0438\u043E",
  "o'quvchi",
  "oquvchi",
  "o'quvchi f.i.sh",
  "ism familiya",
  "familiya ism sharif",
  "name",
  "student name"
];
var LAST_NAME_ALIASES = [
  "last_name",
  "lastname",
  "last name",
  "surname",
  "familiya",
  "familiyasi",
  "\u0444\u0430\u043C\u0438\u043B\u0438\u044F"
];
var FIRST_NAME_ALIASES = [
  "first_name",
  "firstname",
  "first name",
  "given name",
  "ism",
  "ismi",
  "\u0438\u043C\u044F"
];
var PATRONYMIC_ALIASES = [
  "patronymic",
  "middle_name",
  "middlename",
  "middle name",
  "sharif",
  "sharifi",
  "otasining ismi",
  "\u043E\u0442\u0447\u0435\u0441\u0442\u0432\u043E"
];
var CLASS_CODE_ALIASES = [
  "class_code",
  "classcode",
  "class code",
  "class",
  "sinf",
  "sinfi",
  "guruh",
  "\u043A\u043B\u0430\u0441\u0441",
  "grade"
];
var STUDENT_ID_ALIASES = [
  "student_id",
  "studentid",
  "student id",
  "student_code",
  "id",
  "kod",
  "o'quvchi id",
  "oquvchi id",
  "\u043D\u043E\u043C\u0435\u0440",
  "id \u043D\u043E\u043C\u0435\u0440",
  "tabel"
];
var EMAIL_ALIASES = [
  "email",
  "e-mail",
  "pochta",
  "elektron pochta",
  "mail",
  "\u044D\u043B. \u043F\u043E\u0447\u0442\u0430",
  "\u043F\u043E\u0447\u0442\u0430"
];
function cleanHeaderKey(raw) {
  return String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
function matchesAlias(header, aliases) {
  const cleaned = cleanHeaderKey(header);
  if (!cleaned) return false;
  return aliases.some((alias) => cleaned === alias || cleaned.includes(alias));
}
function detectColumnMappingFromHeaders(headers) {
  const mapping = {};
  for (const h of headers) {
    const cleaned = cleanHeaderKey(h);
    if (!cleaned) continue;
    if (!mapping.classCodeCol && matchesAlias(cleaned, CLASS_CODE_ALIASES)) {
      mapping.classCodeCol = h;
      continue;
    }
    if (!mapping.emailCol && matchesAlias(cleaned, EMAIL_ALIASES)) {
      mapping.emailCol = h;
      continue;
    }
    if (!mapping.studentIdCol && matchesAlias(cleaned, STUDENT_ID_ALIASES)) {
      mapping.studentIdCol = h;
      continue;
    }
    if (!mapping.lastNameCol && matchesAlias(cleaned, LAST_NAME_ALIASES)) {
      mapping.lastNameCol = h;
      continue;
    }
    if (!mapping.firstNameCol && matchesAlias(cleaned, FIRST_NAME_ALIASES)) {
      mapping.firstNameCol = h;
      continue;
    }
    if (!mapping.patronymicCol && matchesAlias(cleaned, PATRONYMIC_ALIASES)) {
      mapping.patronymicCol = h;
      continue;
    }
    if (!mapping.fullNameCol && matchesAlias(cleaned, FULL_NAME_ALIASES)) {
      mapping.fullNameCol = h;
      continue;
    }
  }
  return mapping;
}
function detectHeaderRowIndex(rawMatrix) {
  const maxScan = Math.min(rawMatrix.length, 15);
  let bestRowIndex = 0;
  let bestScore = -1;
  for (let r = 0; r < maxScan; r++) {
    const row = rawMatrix[r];
    if (!Array.isArray(row)) continue;
    const cells = row.map((c) => String(c ?? "").trim()).filter(Boolean);
    if (cells.length === 0) continue;
    const mapping = detectColumnMappingFromHeaders(cells);
    let score = 0;
    if (mapping.classCodeCol) score += 3;
    if (mapping.fullNameCol) score += 3;
    if (mapping.firstNameCol) score += 2;
    if (mapping.lastNameCol) score += 2;
    if (mapping.studentIdCol) score += 2;
    if (mapping.emailCol) score += 2;
    if (mapping.patronymicCol) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = r;
    }
  }
  return bestRowIndex;
}
function normalizePersonName(raw) {
  const trimmed = String(raw || "").replace(/\s+/g, " ").trim();
  if (!trimmed) return { normalized: "", wasModified: false };
  const wasModified = trimmed !== String(raw || "");
  return { normalized: trimmed, wasModified };
}
function splitFullNameParts(fullName) {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { lastName: "", firstName: "", patronymic: "" };
  }
  if (parts.length === 1) {
    return { lastName: "", firstName: parts[0], patronymic: "" };
  }
  if (parts.length === 2) {
    return { lastName: parts[0], firstName: parts[1], patronymic: "" };
  }
  return {
    lastName: parts[0],
    firstName: parts[1],
    patronymic: parts.slice(2).join(" ")
  };
}
function isValidEmailFormat(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validateStudentUploadBuffer(buffer, fileName) {
  const maxBytes = 10 * 1024 * 1024;
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Yuklangan fayl bo'sh." };
  }
  if (buffer.length > maxBytes) {
    return { valid: false, error: "Fayl hajmi 10 MB dan oshmasligi kerak." };
  }
  const lower = String(fileName || "").toLowerCase();
  const isXlsx = lower.endsWith(".xlsx");
  const isCsv = lower.endsWith(".csv");
  if (!isXlsx && !isCsv) {
    return {
      valid: false,
      error: "Faqat .xlsx va .csv formatidagi fayllar qabul qilinadi."
    };
  }
  if (lower.endsWith(".xlsm") || lower.endsWith(".xlsb") || lower.endsWith(".xls")) {
    return {
      valid: false,
      error: "Makrosli (.xlsm) yoki eski (.xls) fayllar xavfsizlik sababli qabul qilinmaydi. Iltimos, .xlsx yoki .csv yuklang."
    };
  }
  if (isXlsx && buffer.length >= 4) {
    const isZipMagic = buffer[0] === 80 && buffer[1] === 75 && buffer[2] === 3 && buffer[3] === 4;
    if (!isZipMagic) {
      return {
        valid: false,
        error: "Fayl tuzilishi haqiqiy .xlsx (OOXML) formatiga mos kelmadi."
      };
    }
  }
  return { valid: true };
}
function parseAndValidateStudentWorkbook(buffer, fileName, options = {}, existingUsers = []) {
  const workbook = XLSX3.read(buffer, {
    type: "buffer",
    cellFormula: false,
    cellHTML: false
  });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("Excel faylda hech qanday sahifa (sheet) topilmadi.");
  }
  if (workbook.SheetNames.length > 20) {
    throw new Error("Excel faylda varaqlar (sheets) soni ruxsat etilgan maksimal chegaradan (20 ta) oshib ketdi.");
  }
  const sheetsInfo = [];
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const matrix = XLSX3.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      blankrows: false
    });
    if (matrix.length > 5005) {
      throw new Error(`"${sheetName}" varag\u2018ida qatorlar soni maksimal chegaradan (5000 qator) oshib ketdi.`);
    }
    const detectedIdx = detectHeaderRowIndex(matrix);
    const headerRow = Array.isArray(matrix[detectedIdx]) ? matrix[detectedIdx].map((c, idx) => {
      const val = String(c ?? "").trim();
      return val || `Ustun_${idx + 1}`;
    }) : [];
    const dataMatrix = matrix.slice(detectedIdx + 1);
    const sampleRows = dataMatrix.slice(0, 5).map((r) => {
      const obj = {};
      headerRow.forEach((h, i) => {
        obj[h] = String(r?.[i] ?? "").trim();
      });
      return obj;
    });
    sheetsInfo.push({
      name: sheetName,
      rowCount: Math.max(0, dataMatrix.length),
      detectedHeaderRowIndex: detectedIdx,
      headers: headerRow,
      sampleRows
    });
  }
  let defaultSheet = workbook.SheetNames[0];
  const preferredSheet = sheetsInfo.find(
    (s) => !s.name.toLowerCase().includes("instruction") && !s.name.toLowerCase().includes("yo'riqnoma") && s.rowCount > 0
  );
  if (preferredSheet) {
    defaultSheet = preferredSheet.name;
  } else {
    const nonInstruction = sheetsInfo.find(
      (s) => !s.name.toLowerCase().includes("instruction") && !s.name.toLowerCase().includes("yo'riqnoma")
    );
    if (nonInstruction) defaultSheet = nonInstruction.name;
  }
  const selectedSheet = options.selectedSheet && workbook.SheetNames.includes(options.selectedSheet) ? options.selectedSheet : defaultSheet;
  const activeWs = workbook.Sheets[selectedSheet];
  const activeMatrix = XLSX3.utils.sheet_to_json(activeWs, {
    header: 1,
    defval: "",
    blankrows: false
  });
  const autoHeaderIdx = detectHeaderRowIndex(activeMatrix);
  const selectedHeaderRowIndex = typeof options.selectedHeaderRowIndex === "number" && options.selectedHeaderRowIndex >= 0 && options.selectedHeaderRowIndex < activeMatrix.length ? options.selectedHeaderRowIndex : autoHeaderIdx;
  const rawHeaders = Array.isArray(activeMatrix[selectedHeaderRowIndex]) ? activeMatrix[selectedHeaderRowIndex] : [];
  const headers = rawHeaders.map((c, idx) => {
    const text = String(c ?? "").trim();
    return text || `Ustun_${idx + 1}`;
  });
  const autoMapping = detectColumnMappingFromHeaders(headers);
  const detectedMapping = {
    ...autoMapping,
    ...options.columnMappingOverride || {}
  };
  const colIndexMap = /* @__PURE__ */ new Map();
  headers.forEach((h, i) => colIndexMap.set(h, i));
  const getCell = (rowArr, colName) => {
    if (!colName) return "";
    const idx = colIndexMap.get(colName);
    if (idx === void 0) return "";
    const raw = rowArr[idx];
    const str = String(raw ?? "").trim();
    if (/^[=+\-@]/.test(str) && str.length > 1 && !/^\+?\d/.test(str)) {
      return str.replace(/^[=+\-@]+/, "").trim();
    }
    return str;
  };
  const existingStudents = existingUsers.filter(
    (u) => u.role === "student" && u.status !== "archived"
  );
  const existingByStudentCode = /* @__PURE__ */ new Map();
  const existingByEmail = /* @__PURE__ */ new Map();
  const existingByNameAndClass = /* @__PURE__ */ new Map();
  for (const stu of existingStudents) {
    if (stu.studentCode) {
      existingByStudentCode.set(stu.studentCode.trim().toLowerCase(), stu);
    }
    if (stu.email && !stu.email.endsWith("@student.specialized.local")) {
      existingByEmail.set(stu.email.trim().toLowerCase(), stu);
    }
    const normClass = normalizeClassCodeInput(stu.classCode || stu.classId?.replace(/^class-/, ""));
    const normName = String(stu.displayName || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (normName && normClass) {
      existingByNameAndClass.set(`${normName}::${normClass}`, stu);
    }
  }
  const seenFileStudentIds = /* @__PURE__ */ new Set();
  const seenFileEmails = /* @__PURE__ */ new Set();
  const seenFileNameAndClass = /* @__PURE__ */ new Set();
  const rows = [];
  for (let r = selectedHeaderRowIndex + 1; r < activeMatrix.length; r++) {
    const rowArr = activeMatrix[r];
    if (!Array.isArray(rowArr)) continue;
    const nonEmptyCount = rowArr.filter((cell) => String(cell ?? "").trim() !== "").length;
    if (nonEmptyCount === 0) continue;
    const rowNumber = r + 1;
    const fieldOverride = options.rowFieldOverrides?.[rowNumber] || {};
    const classOverride = options.rowClassOverrides?.[rowNumber];
    const rawFullName = fieldOverride.fullName !== void 0 ? fieldOverride.fullName : getCell(rowArr, detectedMapping.fullNameCol);
    const rawLastName = fieldOverride.lastName !== void 0 ? fieldOverride.lastName : getCell(rowArr, detectedMapping.lastNameCol);
    const rawFirstName = fieldOverride.firstName !== void 0 ? fieldOverride.firstName : getCell(rowArr, detectedMapping.firstNameCol);
    const rawPatronymic = fieldOverride.patronymic !== void 0 ? fieldOverride.patronymic : getCell(rowArr, detectedMapping.patronymicCol);
    const rawClassCode = classOverride !== void 0 ? classOverride : fieldOverride.classCode !== void 0 ? fieldOverride.classCode : getCell(rowArr, detectedMapping.classCodeCol);
    const rawStudentId = fieldOverride.studentId !== void 0 ? fieldOverride.studentId : getCell(rowArr, detectedMapping.studentIdCol);
    const rawEmail = fieldOverride.email !== void 0 ? fieldOverride.email : getCell(rowArr, detectedMapping.emailCol);
    const issues = [];
    let firstName = normalizePersonName(rawFirstName).normalized;
    let lastName = normalizePersonName(rawLastName).normalized;
    let patronymic = normalizePersonName(rawPatronymic).normalized;
    let fullName = normalizePersonName(rawFullName).normalized;
    if (!fullName && (lastName || firstName || patronymic)) {
      fullName = [lastName, firstName, patronymic].filter(Boolean).join(" ");
    } else if (fullName && !firstName && !lastName) {
      const split = splitFullNameParts(fullName);
      lastName = split.lastName;
      firstName = split.firstName;
      patronymic = split.patronymic;
    }
    if (rawFullName && rawFullName !== fullName || rawFirstName && rawFirstName !== firstName || rawLastName && rawLastName !== lastName) {
      issues.push({
        severity: "INFO",
        field: "fullName",
        message: "Ism-sharif ortiqcha bo\u2018shliqlardan tozalandi."
      });
    }
    const normalizedClassCode = normalizeClassCodeInput(rawClassCode);
    const parsedClass = normalizedClassCode ? parseOfficialClassCode(normalizedClassCode) : null;
    if (normalizedClassCode && rawClassCode.trim() !== normalizedClassCode) {
      issues.push({
        severity: "INFO",
        field: "classCode",
        message: `Sinf kodi "${rawClassCode}" -> "${normalizedClassCode}" ga standartlashtirildi.`
      });
    }
    const email = String(rawEmail || "").trim().toLowerCase();
    const studentId = String(rawStudentId || "").trim();
    if (!fullName) {
      issues.push({
        severity: "ERROR",
        field: "fullName",
        message: "O'quvchining F.I.Sh. (ism-familiyasi) kiritilmagan."
      });
    }
    if (!rawClassCode.trim()) {
      issues.push({
        severity: "ERROR",
        field: "classCode",
        message: "Sinf kiritilmagan."
      });
    } else if (!normalizedClassCode) {
      issues.push({
        severity: "ERROR",
        field: "classCode",
        message: `Noto'g'ri sinf: "${rawClassCode}". Ruxsat etilgan 19 ta sinfdan birini tanlang (5a1..11a2, 7t..11t).`
      });
    }
    if (email && !isValidEmailFormat(email)) {
      issues.push({
        severity: "ERROR",
        field: "email",
        message: `Noto'g'ri email formati: "${rawEmail}".`
      });
    }
    let duplicateReason;
    let existingUserUid;
    if (studentId) {
      const normId = studentId.toLowerCase();
      if (seenFileStudentIds.has(normId)) {
        issues.push({
          severity: "ERROR",
          field: "studentId",
          message: `Fayl ichida takrorlangan ID: "${studentId}".`
        });
      } else {
        seenFileStudentIds.add(normId);
        const matchById = existingByStudentCode.get(normId);
        if (matchById) {
          duplicateReason = `ID bo'yicha mavjud (${studentId})`;
          existingUserUid = matchById.uid;
        }
      }
    }
    if (email && isValidEmailFormat(email)) {
      if (seenFileEmails.has(email)) {
        issues.push({
          severity: "ERROR",
          field: "email",
          message: `Fayl ichida takrorlangan email: "${email}".`
        });
      } else {
        seenFileEmails.add(email);
        if (!existingUserUid) {
          const matchByEmail = existingByEmail.get(email);
          if (matchByEmail) {
            duplicateReason = `Email bo'yicha mavjud (${email})`;
            existingUserUid = matchByEmail.uid;
          }
        }
      }
    }
    if (fullName && normalizedClassCode) {
      const nameClassKey = `${fullName.toLowerCase()}::${normalizedClassCode}`;
      if (seenFileNameAndClass.has(nameClassKey)) {
        issues.push({
          severity: "WARNING",
          field: "fullName",
          message: `Fayl ichida bir xil F.I.Sh. va sinf takrorlangan (${fullName}, ${normalizedClassCode}).`
        });
        if (!duplicateReason) {
          duplicateReason = `Fayl ichida takroriy F.I.Sh. + sinf`;
        }
      } else {
        seenFileNameAndClass.add(nameClassKey);
        if (!existingUserUid) {
          const matchByNameClass = existingByNameAndClass.get(nameClassKey);
          if (matchByNameClass) {
            duplicateReason = `F.I.Sh. va sinf bo'yicha mavjud (${fullName}, ${normalizedClassCode})`;
            existingUserUid = matchByNameClass.uid;
            issues.push({
              severity: "WARNING",
              field: "fullName",
              message: `${fullName} (${normalizedClassCode}) tizimda allaqachon mavjud.`
            });
          }
        }
      }
    }
    const hasError = issues.some((i) => i.severity === "ERROR");
    const hasWarning = issues.some((i) => i.severity === "WARNING");
    let status = "valid";
    if (hasError) {
      status = "error";
    } else if (duplicateReason) {
      status = "duplicate";
    } else if (hasWarning) {
      status = "warning";
    }
    rows.push({
      rowNumber,
      sheetName: selectedSheet,
      rawFullName,
      rawFirstName,
      rawLastName,
      rawPatronymic,
      rawClassCode,
      rawStudentId,
      rawEmail,
      fullName,
      firstName,
      lastName,
      patronymic,
      normalizedClassCode,
      grade: parsedClass ? parsedClass.grade : null,
      track: parsedClass ? parsedClass.track : null,
      studentId,
      email,
      status,
      duplicateReason,
      existingUserUid,
      issues
    });
  }
  const classOrderIndex = new Map(
    OFFICIAL_19_CLASS_CODES.map((code, idx) => [code, idx])
  );
  rows.sort((a, b) => {
    const idxA = a.normalizedClassCode ? classOrderIndex.get(a.normalizedClassCode) ?? 999 : 999;
    const idxB = b.normalizedClassCode ? classOrderIndex.get(b.normalizedClassCode) ?? 999 : 999;
    if (idxA !== idxB) return idxA - idxB;
    const nameA = (a.lastName || a.fullName || "").toLowerCase();
    const nameB = (b.lastName || b.fullName || "").toLowerCase();
    const cmp = nameA.localeCompare(nameB, "uz");
    if (cmp !== 0) return cmp;
    return (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase(), "uz");
  });
  const groupMap = /* @__PURE__ */ new Map();
  for (const code of OFFICIAL_19_CLASS_CODES) {
    const meta = parseOfficialClassCode(code);
    groupMap.set(code, {
      classCode: code,
      grade: meta.grade,
      track: meta.track,
      totalCount: 0,
      validCount: 0,
      duplicateCount: 0,
      errorCount: 0
    });
  }
  for (const row of rows) {
    if (row.normalizedClassCode && groupMap.has(row.normalizedClassCode)) {
      const grp = groupMap.get(row.normalizedClassCode);
      grp.totalCount += 1;
      if (row.status === "error") grp.errorCount += 1;
      else if (row.status === "duplicate") grp.duplicateCount += 1;
      else grp.validCount += 1;
    }
  }
  const classGroups = Array.from(groupMap.values()).filter((g) => g.totalCount > 0);
  const newStudentsCount = rows.filter(
    (r) => r.status === "valid" || r.status === "warning"
  ).length;
  const duplicatesCount = rows.filter((r) => r.status === "duplicate").length;
  const errorsCount = rows.filter((r) => r.status === "error").length;
  const warningsCount = rows.filter(
    (r) => r.issues.some((i) => i.severity === "WARNING")
  ).length;
  const infoCount = rows.filter(
    (r) => r.issues.some((i) => i.severity === "INFO")
  ).length;
  return {
    fileName,
    fileSize: buffer.length,
    sheets: sheetsInfo,
    selectedSheet,
    selectedHeaderRowIndex,
    headers,
    detectedMapping,
    totalRows: rows.length,
    newStudentsCount,
    duplicatesCount,
    errorsCount,
    warningsCount,
    infoCount,
    classGroups,
    rows
  };
}
function generateStudentImportTemplateBuffer() {
  const wb = XLSX3.utils.book_new();
  const instructionsRows = [
    ["SPECIALIZED STUDY \u2014 O\u2018QUVCHILARNI EXCEL ORQALI YUKLASH YO\u2018RIQNOMASI"],
    [""],
    ["1. RUXSAT ETILGAN 19 TA RASMIY SINF KODLARI:"],
    ["Yo\u2018nalish", "Sinflar ro\u2018yxati", "Biriktirilgan fanlar"],
    [
      "A yo\u2018nalishi (14 ta sinf)",
      "5a1, 5a2, 6a1, 6a2, 7a1, 7a2, 8a1, 8a2, 9a1, 9a2, 10a1, 10a2, 11a1, 11a2",
      "Matematika, Ingliz tili, Fizika"
    ],
    [
      "T yo\u2018nalishi (5 ta sinf)",
      "7t, 8t, 9t, 10t, 11t",
      "Ingliz tili, Biologiya, Kimyo"
    ],
    [""],
    ['2. USTUNLAR TAVSIFI ("Students" sahifasi):'],
    ["Ustun nomi", "Majburiyligi", "Izoh"],
    ["student_id", "Ixtiyoriy", "O'quvchining maktab ID raqami (bo'sh qolsa avtomatik yaratiladi)"],
    ["last_name", "Ixtiyoriy*", "Familiyasi (*yoki full_name ustunini to\u2018ldiring)"],
    ["first_name", "Ixtiyoriy*", "Ismi (*yoki full_name ustunini to\u2018ldiring)"],
    ["patronymic", "Ixtiyoriy", "Otasining ismi (Sharifi)"],
    ["full_name", "Majburiy*", "To'liq F.I.Sh. (agar last_name va first_name alohida berilmagan bo'lsa)"],
    ["class_code", "Majburiy", "19 ta rasmiy sinfdan biri: masalan, 5a1, 7t, 10a2 (5t va 6t mavjud emas)"],
    ["email", "Ixtiyoriy", "O'quvchining elektron pochta manzili"],
    [""],
    ["3. XAVFSIZLIK ESLATMASI:"],
    ["Excel fayl orqali ochiq parollar yuklanmaydi. Yuklangan o\u2018quvchilar uchun taklifnoma kodi yoki faollashtirish havolasi yaratiladi."]
  ];
  const wsInstructions = XLSX3.utils.aoa_to_sheet(instructionsRows);
  wsInstructions["!cols"] = [{ wch: 28 }, { wch: 68 }, { wch: 45 }];
  XLSX3.utils.book_append_sheet(wb, wsInstructions, "Instructions");
  const studentHeaders = [
    ["student_id", "last_name", "first_name", "patronymic", "full_name", "class_code", "email"]
  ];
  const wsStudents = XLSX3.utils.aoa_to_sheet(studentHeaders);
  wsStudents["!cols"] = [
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
    { wch: 32 },
    { wch: 14 },
    { wch: 28 }
  ];
  XLSX3.utils.book_append_sheet(wb, wsStudents, "Students");
  return XLSX3.write(wb, { type: "buffer", bookType: "xlsx" });
}
function generateStudentExportBuffer(students) {
  const wb = XLSX3.utils.book_new();
  const rows = [
    ["ID", "F.I.Sh.", "Familiya", "Ism", "Sharif", "Sinf", "Yo\u2018nalish", "Email", "Holat", "Qo\u2018shilgan sana"]
  ];
  const classOrderIndex = new Map(
    OFFICIAL_19_CLASS_CODES.map((code, idx) => [code, idx])
  );
  const sorted = [...students].sort((a, b) => {
    const codeA = normalizeClassCodeInput(a.classCode || a.classId?.replace(/^class-/, ""));
    const codeB = normalizeClassCodeInput(b.classCode || b.classId?.replace(/^class-/, ""));
    const idxA = codeA ? classOrderIndex.get(codeA) ?? 999 : 999;
    const idxB = codeB ? classOrderIndex.get(codeB) ?? 999 : 999;
    if (idxA !== idxB) return idxA - idxB;
    return String(a.displayName || "").localeCompare(String(b.displayName || ""), "uz");
  });
  const safeCell = (val) => {
    if (typeof val === "number") return val;
    const str = String(val ?? "");
    if (/^[=+\-@\t\r]/.test(str)) {
      return `'${str}`;
    }
    return str;
  };
  for (const s of sorted) {
    const code = normalizeClassCodeInput(s.classCode || s.classId?.replace(/^class-/, "")) || s.classCode || "";
    const parsed = code ? parseOfficialClassCode(code) : null;
    const statusLabel = s.status === "pending_activation" ? "Faollashtirish kutilmoqda" : s.status === "suspended" ? "To\u2018xtatilgan" : s.status === "archived" ? "Arxivlangan" : "Faol";
    const cleanEmail = s.email?.endsWith("@student.specialized.local") ? "" : s.email || "";
    rows.push([
      safeCell(s.studentCode || s.uid),
      safeCell(s.displayName || ""),
      safeCell(s.lastName || ""),
      safeCell(s.firstName || ""),
      safeCell(s.patronymic || ""),
      safeCell(code),
      safeCell(parsed ? parsed.track : s.track || ""),
      safeCell(cleanEmail),
      safeCell(statusLabel),
      safeCell(s.enrolledAt ? s.enrolledAt.slice(0, 10) : s.createdAt.slice(0, 10))
    ]);
  }
  const ws = XLSX3.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 16 },
    { wch: 30 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 10 },
    { wch: 12 },
    { wch: 26 },
    { wch: 22 },
    { wch: 16 }
  ];
  XLSX3.utils.book_append_sheet(wb, ws, "Students");
  return XLSX3.write(wb, { type: "buffer", bookType: "xlsx" });
}

// src/utils/mathCurriculumImporter.ts
import fs3 from "fs";
import path3 from "path";
import crypto8 from "crypto";
import JSZip2 from "jszip";
import * as XLSX4 from "xlsx";
var OFFICIAL_MATH_ARCHIVE_DISPLAY_NAME = "Matematika  elektron jurnal uchun ish reja.zip";
var OFFICIAL_MATH_ARCHIVE_REL_PATH = "public/assets/aistudio/Matematika__elektron_jurnal_uchun_ish_reja_95f956a7.zip";
var MAX_ZIP_SIZE_BYTES = 25 * 1024 * 1024;
var MAX_ZIP_ENTRIES = 100;
var MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
function computeSha256Hex(input) {
  return crypto8.createHash("sha256").update(input).digest("hex");
}
function resolveOfficialMathArchivePath() {
  const candidates = [
    path3.resolve(process.cwd(), OFFICIAL_MATH_ARCHIVE_REL_PATH),
    path3.resolve(process.cwd(), "public/assets/aistudio", OFFICIAL_MATH_ARCHIVE_DISPLAY_NAME)
  ];
  for (const c of candidates) {
    if (fs3.existsSync(c)) {
      return c;
    }
  }
  const assetsDir = path3.resolve(process.cwd(), "public/assets/aistudio");
  if (fs3.existsSync(assetsDir)) {
    const files = fs3.readdirSync(assetsDir);
    const zipMatch = files.find((f) => f.toLowerCase().endsWith(".zip") && /matematika/i.test(f));
    if (zipMatch) {
      return path3.join(assetsDir, zipMatch);
    }
  }
  return null;
}
function inferWorkbookTargetFromPath(relativePath, fileName) {
  const combined = `${relativePath} ${fileName}`;
  const gradeMatch = fileName.match(/\b(5|6|7|8|9|10|11)\s*-\s*sinf/i);
  if (!gradeMatch) return null;
  const grade = Number(gradeMatch[1]);
  const isTTrack = /tabiiy/i.test(combined) || /tabiiy\s+fanlar/i.test(relativePath);
  const track = isTTrack ? "T" : "A";
  const trackLabel = track === "A" ? "Aniq fanlar" : "Tabiiy fanlar";
  let curriculumArea = "Matematika";
  if (/algebra/i.test(fileName)) {
    curriculumArea = "Algebra";
  } else if (/geometriya/i.test(fileName)) {
    curriculumArea = "Geometriya";
  } else {
    curriculumArea = "Matematika";
  }
  let classCodes = [];
  if (track === "A") {
    classCodes = [`${grade}a1`, `${grade}a2`];
  } else {
    if (grade < 7 || grade > 11) {
      return null;
    }
    classCodes = [`${grade}t`];
  }
  const areaSlug = curriculumArea.toLowerCase();
  const workbookKey = `math-wb-${grade}-${track.toLowerCase()}-${areaSlug}`;
  return {
    workbookKey,
    grade,
    track,
    trackLabel,
    subjectName: "Matematika",
    curriculumArea,
    classCodes,
    additionalCurriculumAssignment: track === "T"
  };
}
function classifyCurriculumLessonEvent(rawLessonType, topicTitle) {
  const cleanType = String(rawLessonType || "").trim();
  const cleanTitle = String(topicTitle || "").trim();
  const lowerType = cleanType.toLowerCase();
  const lowerTitle = cleanTitle.toLowerCase();
  let maxPoints;
  const pointsMatch = cleanTitle.match(/\(?\s*(\d{1,3})\s*ball\s*\)?/i);
  if (pointsMatch) {
    maxPoints = Number(pointsMatch[1]);
  }
  let milestoneCode;
  const bsbCodeMatch = cleanTitle.match(/\b(\d+\s*-\s*BSB|BSB\s*-?\s*\d+|\bBSB\b)/i);
  const chsbCodeMatch = cleanTitle.match(/\b(\d+\s*-\s*CHSB|CHSB\s*-?\s*\d+|\bCHSB\b)/i);
  const isAnalysisRow = /\b(bsb|chsb|nazorat\s+ishi|yozma\s+ish)[\w\s-]*tahlil/i.test(cleanTitle) || /\btahlili\b/i.test(lowerTitle) || /\bbsb\s+tahlil\b/i.test(lowerTitle) || /\bchsb\s+tahlil\b/i.test(lowerTitle) || /xatolar\s+ustida\s+ishlash/i.test(lowerTitle);
  if (isAnalysisRow) {
    if (bsbCodeMatch) {
      milestoneCode = `${bsbCodeMatch[1].replace(/\s+/g, "").toUpperCase()} tahlili`;
    } else if (chsbCodeMatch) {
      milestoneCode = `${chsbCodeMatch[1].replace(/\s+/g, "").toUpperCase()} tahlili`;
    } else {
      milestoneCode = "Tahlil darsi";
    }
    return {
      eventCategory: "REVIEW_AND_ANALYSIS",
      milestoneType: "ANALYSIS",
      milestoneCode,
      maxPoints: void 0
    };
  }
  if (lowerType.includes("choraklik summativ baholash") || /\bchsb\b/i.test(cleanTitle) || /\d+\s*-\s*chsb/i.test(cleanTitle)) {
    milestoneCode = chsbCodeMatch ? chsbCodeMatch[1].replace(/\s+/g, "").toUpperCase() : "CHSB";
    return {
      eventCategory: "QUARTERLY_ASSESSMENT",
      milestoneType: "CHSB",
      milestoneCode,
      maxPoints: maxPoints ?? 40
    };
  }
  if (lowerType.includes("loyiha ishi") || /\bloyiha\s+ishi\b/i.test(cleanTitle)) {
    return {
      eventCategory: "PROJECT_WORK",
      milestoneType: "PROJECT",
      milestoneCode: "Loyiha ishi",
      maxPoints
    };
  }
  if (lowerType.includes("yozma ish") || /\bbsb\b/i.test(cleanTitle) || /\d+\s*-\s*bsb/i.test(cleanTitle) || /\bnazorat\s+ishi\b/i.test(cleanTitle)) {
    const isBsb = /\bbsb\b|\d+\s*-\s*bsb/i.test(cleanTitle);
    milestoneCode = bsbCodeMatch ? bsbCodeMatch[1].replace(/\s+/g, "").toUpperCase() : /\bnazorat\s+ishi\b/i.test(cleanTitle) ? "Nazorat ishi" : "Yozma ish";
    return {
      eventCategory: "WRITTEN_ASSESSMENT",
      milestoneType: isBsb ? "BSB" : "WRITTEN_WORK",
      milestoneCode,
      maxPoints: maxPoints ?? (isBsb ? 25 : void 0)
    };
  }
  if (lowerType.includes("oddiy dars") || cleanType === "") {
    return {
      eventCategory: "REGULAR_LESSON",
      milestoneType: null,
      maxPoints
    };
  }
  return {
    eventCategory: "OTHER",
    milestoneType: null,
    maxPoints
  };
}
function normalizeQuarterString(rawQuarter) {
  const str = String(rawQuarter || "").trim();
  const numMatch = str.match(/([1-4])/);
  const q = numMatch ? Number(numMatch[1]) : 1;
  return {
    quarter: q,
    quarterLabel: `${q}-chorak`
  };
}
function parseLessonOrderValue(rawVal, fallbackIndex) {
  const rawStr = String(rawVal ?? "").trim();
  const numMatch = rawStr.match(/(\d+)/);
  const lessonOrder = numMatch ? Number(numMatch[1]) : fallbackIndex;
  return {
    lessonOrder: lessonOrder > 0 ? lessonOrder : fallbackIndex,
    rawLessonOrder: rawStr || String(fallbackIndex)
  };
}
function parseSingleCurriculumWorkbook(buffer, relativePath, fileName) {
  const targetMeta = inferWorkbookTargetFromPath(relativePath, fileName);
  if (!targetMeta) {
    throw new Error(`Fayl yo'nalishi yoki sinfi aniqlanmadi: ${fileName}`);
  }
  const workbookHash = computeSha256Hex(buffer);
  const wb = XLSX4.read(buffer, { type: "buffer" });
  const worksheetName = wb.SheetNames[0] || "Sheet1";
  const sheet = wb.Sheets[worksheetName];
  if (!sheet) {
    throw new Error(`Excel varag'i topilmadi: ${fileName}`);
  }
  const matrix = XLSX4.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (matrix.length === 0) {
    throw new Error(`Excel fayli bo'sh: ${fileName}`);
  }
  const rawHeaderRow = (matrix[0] || []).map((cell) => String(cell ?? ""));
  const detectedHeaders = rawHeaderRow.filter((h) => h.trim() !== "");
  let colLessonOrder = 0;
  let colTopicTitle = 1;
  let colLessonType = 2;
  let colClasswork = 3;
  let colHomework = 4;
  let colHours = 5;
  let colNotes = 6;
  let colQuarter = 7;
  const normalizedHeaders = {};
  rawHeaderRow.forEach((rawHeader, idx) => {
    const clean = rawHeader.trim();
    if (!clean) return;
    const lower = clean.toLowerCase();
    if (/dars\s*tartibi|tartib|№|raqam/i.test(lower)) {
      colLessonOrder = idx;
      normalizedHeaders[rawHeader] = "lessonOrder";
    } else if (/mavzu\s*nomi|^mavzu$/i.test(lower)) {
      colTopicTitle = idx;
      normalizedHeaders[rawHeader] = "topicTitle";
    } else if (/dars\s*turi/i.test(lower)) {
      colLessonType = idx;
      normalizedHeaders[rawHeader] = "lessonType";
    } else if (/sinf\s*ishi/i.test(lower)) {
      colClasswork = idx;
      normalizedHeaders[rawHeader] = "classwork";
    } else if (/uyga\s*vazifa|uy\s*vazifa|^vazifa$/i.test(lower)) {
      colHomework = idx;
      normalizedHeaders[rawHeader] = "homework";
    } else if (/^soat$|soati/i.test(lower)) {
      colHours = idx;
      normalizedHeaders[rawHeader] = "hours";
    } else if (/^izoh$/i.test(lower)) {
      colNotes = idx;
      normalizedHeaders[rawHeader] = "notes";
    } else if (/davr|chorak/i.test(lower)) {
      colQuarter = idx;
      normalizedHeaders[rawHeader] = "quarter";
    }
  });
  const quarterCounts = {
    "1-chorak": 0,
    "2-chorak": 0,
    "3-chorak": 0,
    "4-chorak": 0
  };
  const lessonTypeCounts = {};
  const eventCategoryCounts = {
    REGULAR_LESSON: 0,
    WRITTEN_ASSESSMENT: 0,
    QUARTERLY_ASSESSMENT: 0,
    PROJECT_WORK: 0,
    REVIEW_AND_ANALYSIS: 0,
    OTHER: 0
  };
  const missingFieldsCount = {
    topicTitle: 0,
    classwork: 0,
    homework: 0,
    hours: 0,
    quarter: 0
  };
  let bsbCount = 0;
  let chsbCount = 0;
  let projectCount = 0;
  let analysisCount = 0;
  let totalHours = 0;
  const warnings = [];
  const rows = [];
  for (let r = 1; r < matrix.length; r++) {
    const rowCells = matrix[r] || [];
    const hasAnyValue = rowCells.some((c) => String(c ?? "").trim() !== "");
    if (!hasAnyValue) continue;
    const { lessonOrder, rawLessonOrder } = parseLessonOrderValue(
      rowCells[colLessonOrder],
      rows.length + 1
    );
    const topicTitle = String(rowCells[colTopicTitle] ?? "").trim();
    const lessonType = String(rowCells[colLessonType] ?? "").trim();
    const classwork = String(rowCells[colClasswork] ?? "").trim();
    const homework = String(rowCells[colHomework] ?? "").trim();
    const rawHours = rowCells[colHours];
    const hours = Number(rawHours) > 0 ? Number(rawHours) : 1;
    const notes = String(rowCells[colNotes] ?? "").trim();
    const rawQuarterCell = String(rowCells[colQuarter] ?? "").trim();
    if (!topicTitle) missingFieldsCount.topicTitle++;
    if (!classwork) missingFieldsCount.classwork++;
    if (!homework) missingFieldsCount.homework++;
    if (!rawHours && rawHours !== 0) missingFieldsCount.hours++;
    if (!rawQuarterCell) missingFieldsCount.quarter++;
    const { quarter, quarterLabel } = normalizeQuarterString(rawQuarterCell);
    quarterCounts[quarterLabel] = (quarterCounts[quarterLabel] || 0) + 1;
    const typeKey = lessonType || "Oddiy dars-31";
    lessonTypeCounts[typeKey] = (lessonTypeCounts[typeKey] || 0) + 1;
    const classified = classifyCurriculumLessonEvent(typeKey, topicTitle);
    eventCategoryCounts[classified.eventCategory] = (eventCategoryCounts[classified.eventCategory] || 0) + 1;
    if (classified.eventCategory === "WRITTEN_ASSESSMENT") bsbCount++;
    if (classified.eventCategory === "QUARTERLY_ASSESSMENT") chsbCount++;
    if (classified.eventCategory === "PROJECT_WORK") projectCount++;
    if (classified.eventCategory === "REVIEW_AND_ANALYSIS") analysisCount++;
    totalHours += hours;
    const sourceRecordHash = computeSha256Hex(
      `${targetMeta.workbookKey}|row:${r + 1}|order:${lessonOrder}|title:${topicTitle}|type:${typeKey}|q:${quarterLabel}`
    );
    rows.push({
      rowId: `${targetMeta.workbookKey}-r${r + 1}`,
      lessonNumber: lessonOrder,
      rawLessonOrder,
      quarter,
      quarterLabel,
      weekNumber: Math.ceil(lessonOrder / 3),
      unitTitle: `${quarterLabel} \u2022 ${targetMeta.curriculumArea}`,
      topicName: topicTitle,
      lessonTitle: topicTitle,
      lessonType: typeKey,
      eventCategory: classified.eventCategory,
      classwork,
      learningObjectives: classwork ? `Sinf ishi: ${classwork}` : `${topicTitle} mavzusi bo\u2018yicha amaliy ko\u2018nikmalarni shakllantirish.`,
      hours,
      homework,
      notes,
      assessmentNote: classified.milestoneCode,
      maxPoints: classified.maxPoints,
      milestoneCode: classified.milestoneCode,
      sourceFile: fileName,
      sourceWorksheet: worksheetName,
      sourceRow: r + 1,
      sourceRecordHash
    });
  }
  const pathParts = relativePath.split("/").filter(Boolean);
  const sourceDirectory = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : targetMeta.trackLabel;
  return {
    workbookKey: targetMeta.workbookKey,
    workbookId: targetMeta.workbookKey,
    fileName,
    relativePath,
    sourceDirectory,
    worksheetName,
    workbookHash,
    grade: targetMeta.grade,
    track: targetMeta.track,
    trackLabel: targetMeta.trackLabel,
    subjectName: "Matematika",
    curriculumArea: targetMeta.curriculumArea,
    classCodes: targetMeta.classCodes,
    assignedClassCodes: targetMeta.classCodes,
    additionalCurriculumAssignment: targetMeta.additionalCurriculumAssignment,
    detectedHeaders,
    normalizedHeaders,
    totalRows: rows.length,
    totalLessons: rows.length,
    totalHours,
    quarterCounts,
    quarterBreakdown: {
      1: quarterCounts["1-chorak"],
      2: quarterCounts["2-chorak"],
      3: quarterCounts["3-chorak"],
      4: quarterCounts["4-chorak"],
      "1-chorak": quarterCounts["1-chorak"],
      "2-chorak": quarterCounts["2-chorak"],
      "3-chorak": quarterCounts["3-chorak"],
      "4-chorak": quarterCounts["4-chorak"]
    },
    lessonTypeCounts,
    eventCategoryCounts,
    bsbCount,
    chsbCount,
    projectCount,
    analysisCount,
    missingFieldsCount,
    warnings,
    rows
  };
}
async function parseAndValidateCurriculumZipBuffer(zipBuffer, archiveName = OFFICIAL_MATH_ARCHIVE_DISPLAY_NAME) {
  if (!zipBuffer || zipBuffer.byteLength === 0) {
    throw new Error("Yuklangan ZIP arxiv bo\u2018sh.");
  }
  if (zipBuffer.byteLength > MAX_ZIP_SIZE_BYTES) {
    throw new Error("ZIP arxiv hajmi ruxsat etilgan 25 MB chegaradan oshib ketdi.");
  }
  if (zipBuffer.byteLength < 4 || zipBuffer[0] !== 80 || zipBuffer[1] !== 75) {
    throw new Error("Yuklangan fayl haqiqiy ZIP arxiv emas.");
  }
  const archiveHash = computeSha256Hex(zipBuffer);
  const zip = await JSZip2.loadAsync(zipBuffer);
  const entryNames = Object.keys(zip.files);
  if (entryNames.length > MAX_ZIP_ENTRIES) {
    throw new Error(`ZIP arxiv ichida fayllar soni haddan tashqari ko'p (${entryNames.length}).`);
  }
  const workbooks = [];
  const warnings = [];
  const errors = [];
  let cumulativeUncompressedBytes = 0;
  for (const relPath of entryNames) {
    const zipEntry = zip.files[relPath];
    if (!zipEntry || zipEntry.dir) continue;
    const normalizedRel = path3.posix.normalize(relPath);
    if (normalizedRel.startsWith("..") || normalizedRel.includes("/../") || path3.isAbsolute(normalizedRel)) {
      errors.push(`Xavfsizlik: ruxsat etilmagan fayl yo'li rad etildi (${relPath}).`);
      continue;
    }
    const baseName = path3.posix.basename(relPath);
    if (baseName.startsWith("~$") || baseName.startsWith(".")) {
      continue;
    }
    if (!baseName.toLowerCase().endsWith(".xlsx")) {
      continue;
    }
    const fileBuf = await zipEntry.async("nodebuffer");
    cumulativeUncompressedBytes += fileBuf.byteLength;
    if (cumulativeUncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new Error("ZIP arxivdan ajratilgan fayllar hajmi 50 MB chegaradan oshdi.");
    }
    try {
      const wbPreview = parseSingleCurriculumWorkbook(fileBuf, relPath, baseName);
      workbooks.push(wbPreview);
    } catch (err) {
      errors.push(`${baseName}: ${err?.message || "O'qishda xatolik"}`);
    }
  }
  const areaOrder = {
    Matematika: 1,
    Algebra: 2,
    Geometriya: 3
  };
  workbooks.sort((a, b) => {
    if (a.track !== b.track) return a.track === "A" ? -1 : 1;
    if (a.grade !== b.grade) return a.grade - b.grade;
    return (areaOrder[a.curriculumArea] || 9) - (areaOrder[b.curriculumArea] || 9);
  });
  const quarterDistribution = {
    "1-chorak": 0,
    "2-chorak": 0,
    "3-chorak": 0,
    "4-chorak": 0
  };
  const rawLessonTypeDistribution = {};
  const eventCategoryDistribution = {
    REGULAR_LESSON: 0,
    WRITTEN_ASSESSMENT: 0,
    QUARTERLY_ASSESSMENT: 0,
    PROJECT_WORK: 0,
    REVIEW_AND_ANALYSIS: 0,
    OTHER: 0
  };
  let aTrackWorkbooksCount = 0;
  let tTrackWorkbooksCount = 0;
  let totalLessonRecords = 0;
  let aTrackLessonRecords = 0;
  let tTrackLessonRecords = 0;
  let totalHours = 0;
  const classMap = /* @__PURE__ */ new Map();
  for (const wb of workbooks) {
    if (wb.track === "A") {
      aTrackWorkbooksCount++;
      aTrackLessonRecords += wb.totalRows;
    } else {
      tTrackWorkbooksCount++;
      tTrackLessonRecords += wb.totalRows;
    }
    totalLessonRecords += wb.totalRows;
    totalHours += wb.totalHours;
    quarterDistribution["1-chorak"] += wb.quarterCounts["1-chorak"];
    quarterDistribution["2-chorak"] += wb.quarterCounts["2-chorak"];
    quarterDistribution["3-chorak"] += wb.quarterCounts["3-chorak"];
    quarterDistribution["4-chorak"] += wb.quarterCounts["4-chorak"];
    for (const [lt, cnt] of Object.entries(wb.lessonTypeCounts)) {
      rawLessonTypeDistribution[lt] = (rawLessonTypeDistribution[lt] || 0) + cnt;
    }
    for (const [ec, cnt] of Object.entries(wb.eventCategoryCounts)) {
      const key = ec;
      eventCategoryDistribution[key] = (eventCategoryDistribution[key] || 0) + cnt;
    }
    for (const code of wb.classCodes) {
      const existing = classMap.get(code) || {
        classCode: code,
        grade: wb.grade,
        track: wb.track,
        curriculumAreas: /* @__PURE__ */ new Set(),
        workbooksCount: 0,
        totalLessons: 0,
        totalHours: 0,
        additionalCurriculumAssignment: wb.additionalCurriculumAssignment
      };
      existing.curriculumAreas.add(wb.curriculumArea);
      existing.workbooksCount += 1;
      existing.totalLessons += wb.totalRows;
      existing.totalHours += wb.totalHours;
      classMap.set(code, existing);
    }
  }
  if (tTrackWorkbooksCount > 0) {
    warnings.push(
      `T-yo'nalish sinflari (7t, 8t, 9t, 10t, 11t) uchun ${tTrackWorkbooksCount} ta Matematika/Algebra/Geometriya ish rejasi qo'shimcha o'quv rejasi sifatida aniqlandi (T-yo'nalishning asosiy fanlari: Ingliz tili, Biologiya, Kimyo o'zgarishsiz qoladi).`
    );
  }
  const quarterBreakdown = {
    1: quarterDistribution["1-chorak"],
    2: quarterDistribution["2-chorak"],
    3: quarterDistribution["3-chorak"],
    4: quarterDistribution["4-chorak"],
    "1-chorak": quarterDistribution["1-chorak"],
    "2-chorak": quarterDistribution["2-chorak"],
    "3-chorak": quarterDistribution["3-chorak"],
    "4-chorak": quarterDistribution["4-chorak"]
  };
  return {
    archiveName,
    archiveSize: zipBuffer.byteLength,
    archiveHash,
    totalWorkbooks: workbooks.length,
    totalFiles: workbooks.length,
    aTrackWorkbooksCount,
    aTrackFiles: aTrackWorkbooksCount,
    tTrackWorkbooksCount,
    tTrackFiles: tTrackWorkbooksCount,
    totalLessonRecords,
    totalLessons: totalLessonRecords,
    aTrackLessonRecords,
    tTrackLessonRecords,
    totalHours,
    tTrackVisibilityApproved: false,
    quarterDistribution,
    quarterBreakdown,
    rawLessonTypeDistribution,
    lessonTypeBreakdown: rawLessonTypeDistribution,
    eventCategoryDistribution,
    eventCategoryBreakdown: eventCategoryDistribution,
    classAssignmentSummary: Array.from(classMap.values()).map((item) => ({
      ...item,
      curriculumAreas: Array.from(item.curriculumAreas)
    })),
    workbooks,
    warnings,
    errors
  };
}
function lessonMatchesClass(lesson, classCodeOrId) {
  if (!classCodeOrId) return true;
  const clean = String(classCodeOrId).trim().toLowerCase().replace(/^class-/, "");
  if (!clean) return true;
  if (lesson.classCode && lesson.classCode.toLowerCase() === clean) return true;
  if (lesson.classId && lesson.classId.toLowerCase().replace(/^class-/, "") === clean) return true;
  if (Array.isArray(lesson.classCodes) && lesson.classCodes.some((c) => c.toLowerCase() === clean)) {
    return true;
  }
  if (Array.isArray(lesson.classIds) && lesson.classIds.some((id) => id.toLowerCase().replace(/^class-/, "") === clean)) {
    return true;
  }
  return false;
}
function workPlanMatchesClass(wp, classCodeOrId) {
  if (!classCodeOrId) return true;
  const clean = String(classCodeOrId).trim().toLowerCase().replace(/^class-/, "");
  if (!clean) return true;
  if (wp.classCode && wp.classCode.toLowerCase() === clean) return true;
  if (wp.classId && wp.classId.toLowerCase().replace(/^class-/, "") === clean) return true;
  if (Array.isArray(wp.classCodes) && wp.classCodes.some((c) => c.toLowerCase() === clean)) {
    return true;
  }
  if (Array.isArray(wp.classIds) && wp.classIds.some((id) => id.toLowerCase().replace(/^class-/, "") === clean)) {
    return true;
  }
  return false;
}
function applyCurriculumZipPreviewToDatabase(preview, existingWorkPlans, existingLessons, existingTopics, existingJobs, options = {}) {
  const institutionId = options.institutionId || DEFAULT_INSTITUTION_ID;
  const academicYear = options.academicYear || "2026-2027";
  const actorUid = options.actorUid || "admin-owner";
  const actorName = options.actorName || "Specialized Study Admin";
  const tTrackVisibilityApproved = Boolean(options.tTrackVisibilityApproved);
  const publishImmediately = Boolean(options.publishImmediately);
  const duplicatePolicy = options.duplicatePolicy || "update_existing";
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  if (options.jobId) {
    const existingByJobId = existingJobs.find(
      (j) => j.jobId === options.jobId && j.status === "completed"
    );
    if (existingByJobId) {
      return {
        job: existingByJobId,
        idempotentReplay: true,
        importedWorkPlansCount: existingByJobId.importedWorkPlansCount,
        updatedWorkPlansCount: existingByJobId.updatedWorkPlansCount,
        importedLessonsCount: existingByJobId.importedLessonsCount,
        updatedLessonsCount: existingByJobId.updatedLessonsCount,
        skippedDuplicatesCount: existingByJobId.skippedDuplicatesCount
      };
    }
  }
  const previousVersions = existingJobs.filter((j) => j.archiveHash === preview.archiveHash);
  const importVersion = previousVersions.length + 1;
  const resolvedJobId = options.jobId || `cur-job-${preview.archiveHash.slice(0, 10)}-v${importVersion}`;
  let importedWorkPlansCount = 0;
  let updatedWorkPlansCount = 0;
  let importedLessonsCount = 0;
  let updatedLessonsCount = 0;
  let skippedDuplicatesCount = 0;
  const workPlanById = /* @__PURE__ */ new Map();
  for (const wp of existingWorkPlans) {
    workPlanById.set(wp.id, wp);
  }
  const lessonById = /* @__PURE__ */ new Map();
  const lessonByHash = /* @__PURE__ */ new Map();
  for (const les of existingLessons) {
    lessonById.set(les.id, les);
    if (les.sourceRecordHash) {
      lessonByHash.set(les.sourceRecordHash, les);
    }
  }
  const topicByKey = /* @__PURE__ */ new Map();
  for (const t of existingTopics) {
    if (t.code) topicByKey.set(t.code, t);
  }
  for (const wb of preview.workbooks) {
    const primaryClassCode = wb.classCodes[0];
    const primaryClassId = `class-${primaryClassCode}`;
    const classIds = wb.classCodes.map((c) => `class-${c}`);
    const wpId = `wp-${wb.workbookKey}`;
    const wpTitle = `${wb.grade}-sinf (${wb.classCodes.map((c) => c.toUpperCase()).join(", ")}) \u2014 ${wb.curriculumArea}`;
    const existingWp = workPlanById.get(wpId);
    if (existingWp) {
      if (duplicatePolicy === "update_existing") {
        existingWp.title = wpTitle;
        existingWp.fileName = wb.fileName;
        existingWp.sourceDirectory = wb.sourceDirectory;
        existingWp.sourceWorksheet = wb.worksheetName;
        existingWp.workbookHash = wb.workbookHash;
        existingWp.importJobId = resolvedJobId;
        existingWp.importVersion = importVersion;
        existingWp.classId = primaryClassId;
        existingWp.classCode = primaryClassCode;
        existingWp.classIds = classIds;
        existingWp.classCodes = [...wb.classCodes];
        existingWp.curriculumArea = wb.curriculumArea;
        existingWp.additionalCurriculumAssignment = wb.additionalCurriculumAssignment;
        existingWp.tTrackVisibilityApproved = wb.additionalCurriculumAssignment ? tTrackVisibilityApproved : true;
        existingWp.totalLessons = wb.totalRows;
        existingWp.totalHours = wb.totalHours;
        existingWp.quarterBreakdown = { ...wb.quarterBreakdown };
        existingWp.rows = wb.rows;
        existingWp.status = "confirmed";
        existingWp.confirmedAt = nowIso;
        existingWp.updatedAt = nowIso;
        updatedWorkPlansCount++;
      }
    } else {
      const newWp = {
        id: wpId,
        institutionId,
        title: wpTitle,
        fileName: wb.fileName,
        sourceDirectory: wb.sourceDirectory,
        sourceWorksheet: wb.worksheetName,
        workbookHash: wb.workbookHash,
        importJobId: resolvedJobId,
        importVersion,
        classId: primaryClassId,
        classCode: primaryClassCode,
        classIds,
        classCodes: [...wb.classCodes],
        grade: wb.grade,
        track: wb.track,
        subjectId: "subj-matematika",
        subjectName: "Matematika",
        subject: "Matematika",
        curriculumArea: wb.curriculumArea,
        additionalCurriculumAssignment: wb.additionalCurriculumAssignment,
        tTrackVisibilityApproved: wb.additionalCurriculumAssignment ? tTrackVisibilityApproved : true,
        academicYear,
        planType: "annual",
        totalLessons: wb.totalRows,
        totalHours: wb.totalHours,
        quarterBreakdown: { ...wb.quarterBreakdown },
        status: "confirmed",
        rows: wb.rows,
        warnings: wb.warnings,
        createdByUid: actorUid,
        createdByName: actorName,
        createdAt: nowIso,
        confirmedAt: nowIso,
        updatedAt: nowIso
      };
      existingWorkPlans.push(newWp);
      workPlanById.set(wpId, newWp);
      importedWorkPlansCount++;
    }
    let precedingRegularInQuarter = [];
    let allRegularInQuarter = [];
    let currentQuarterTracker = 1;
    let lastAssessmentMilestoneId;
    for (let idx = 0; idx < wb.rows.length; idx++) {
      const row = wb.rows[idx];
      if (row.quarter !== currentQuarterTracker) {
        currentQuarterTracker = row.quarter;
        precedingRegularInQuarter = [];
        allRegularInQuarter = [];
        lastAssessmentMilestoneId = void 0;
      }
      const lessonId = `lesson-${wb.workbookKey}-${String(idx + 1).padStart(3, "0")}`;
      const classified = classifyCurriculumLessonEvent(
        row.lessonType || "Oddiy dars-31",
        row.lessonTitle
      );
      const topicCode = `TOP-MATH-${wb.grade}-${wb.track}-${wb.curriculumArea.slice(0, 3).toUpperCase()}-Q${row.quarter}`;
      let topicRec = topicByKey.get(topicCode);
      if (!topicRec) {
        topicRec = {
          id: `topic-${wb.workbookKey}-q${row.quarter}`,
          code: topicCode,
          institutionId,
          subjectId: "subj-matematika",
          subjectCode: "MAT",
          unitTitle: `${row.quarter}-chorak \u2022 ${wb.curriculumArea}`,
          quarter: row.quarter,
          classCode: primaryClassCode,
          track: wb.track,
          name: `${wb.grade}-sinf ${wb.curriculumArea} (${row.quarter}-chorak)`,
          subject: "Matematika",
          grade: wb.grade,
          description: `${wb.grade}-sinf ${wb.trackLabel} yo'nalishi ${wb.curriculumArea} kursi ${row.quarter}-chorak mavzulari.`,
          learningObjectives: `${wb.curriculumArea} ${row.quarter}-chorak darslari bo'yicha nazariy va amaliy ko'nikmalar.`,
          status: "active",
          orderIndex: existingTopics.length + 1
        };
        existingTopics.push(topicRec);
        topicByKey.set(topicCode, topicRec);
      }
      let precedingLessonIds;
      let linkedMilestoneLessonId;
      if (classified.eventCategory === "WRITTEN_ASSESSMENT") {
        precedingLessonIds = [...precedingRegularInQuarter];
        precedingRegularInQuarter = [];
        lastAssessmentMilestoneId = lessonId;
      } else if (classified.eventCategory === "QUARTERLY_ASSESSMENT") {
        precedingLessonIds = [...allRegularInQuarter];
        lastAssessmentMilestoneId = lessonId;
      } else if (classified.eventCategory === "REVIEW_AND_ANALYSIS") {
        linkedMilestoneLessonId = lastAssessmentMilestoneId;
      } else {
        precedingRegularInQuarter.push(lessonId);
        allRegularInQuarter.push(lessonId);
      }
      const existingLesson = lessonById.get(lessonId) || (row.sourceRecordHash ? lessonByHash.get(row.sourceRecordHash) : void 0);
      const desiredStatus = publishImmediately ? "published" : "planned";
      const desiredPubStatus = publishImmediately ? "PUBLISHED" : "DRAFT_IMPORTED";
      if (existingLesson) {
        const hasManualEdits = Array.isArray(existingLesson.modificationHistory) && existingLesson.modificationHistory.length > 0;
        if (duplicatePolicy === "skip_existing" || hasManualEdits) {
          if (wb.additionalCurriculumAssignment && options.tTrackVisibilityApproved !== void 0) {
            existingLesson.tTrackVisibilityApproved = tTrackVisibilityApproved;
          }
          if (publishImmediately && existingLesson.status === "planned") {
            existingLesson.status = "published";
            existingLesson.publicationStatus = "PUBLISHED";
          }
          skippedDuplicatesCount++;
          continue;
        }
        existingLesson.workPlanId = wpId;
        existingLesson.importJobId = resolvedJobId;
        existingLesson.classId = primaryClassId;
        existingLesson.classCode = primaryClassCode;
        existingLesson.classIds = classIds;
        existingLesson.classCodes = [...wb.classCodes];
        existingLesson.curriculumArea = wb.curriculumArea;
        existingLesson.additionalCurriculumAssignment = wb.additionalCurriculumAssignment;
        existingLesson.tTrackVisibilityApproved = wb.additionalCurriculumAssignment ? tTrackVisibilityApproved : true;
        existingLesson.quarter = row.quarter;
        existingLesson.quarterLabel = row.quarterLabel;
        existingLesson.lessonNumber = row.lessonNumber;
        existingLesson.lessonOrder = row.lessonNumber;
        existingLesson.rawLessonOrder = row.rawLessonOrder;
        existingLesson.topicId = topicRec.id;
        existingLesson.topicName = row.topicName;
        existingLesson.topicTitle = row.lessonTitle;
        existingLesson.title = row.lessonTitle;
        existingLesson.lessonType = row.lessonType;
        existingLesson.eventCategory = classified.eventCategory;
        existingLesson.classwork = row.classwork;
        existingLesson.homework = row.homework;
        existingLesson.notes = row.notes ?? "";
        existingLesson.hours = row.hours;
        existingLesson.maxPoints = classified.maxPoints;
        existingLesson.milestoneType = classified.milestoneType;
        existingLesson.milestoneCode = classified.milestoneCode;
        existingLesson.precedingLessonIds = precedingLessonIds;
        existingLesson.linkedMilestoneLessonId = linkedMilestoneLessonId;
        if (publishImmediately) {
          existingLesson.status = "published";
          existingLesson.publicationStatus = "PUBLISHED";
        }
        existingLesson.updatedAt = nowIso;
        updatedLessonsCount++;
      } else {
        const newLesson = {
          id: lessonId,
          institutionId,
          workPlanId: wpId,
          importJobId: resolvedJobId,
          classId: primaryClassId,
          classCode: primaryClassCode,
          classIds,
          classCodes: [...wb.classCodes],
          grade: wb.grade,
          track: wb.track,
          subjectId: "subj-matematika",
          subjectName: "Matematika",
          subject: "Matematika",
          curriculumArea: wb.curriculumArea,
          additionalCurriculumAssignment: wb.additionalCurriculumAssignment,
          tTrackVisibilityApproved: wb.additionalCurriculumAssignment ? tTrackVisibilityApproved : true,
          academicYear,
          quarter: row.quarter,
          quarterLabel: row.quarterLabel || `${row.quarter}-chorak`,
          weekNumber: Math.ceil(row.lessonNumber / 3),
          lessonNumber: row.lessonNumber,
          lessonOrder: row.lessonNumber,
          rawLessonOrder: row.rawLessonOrder || String(row.lessonNumber),
          unitTitle: `${row.quarter}-chorak \u2022 ${wb.curriculumArea}`,
          unit: `${row.quarter}-chorak \u2022 ${wb.curriculumArea}`,
          topicId: topicRec.id,
          topicName: row.topicName,
          topicTitle: row.lessonTitle,
          title: row.lessonTitle,
          lessonType: row.lessonType || "Oddiy dars-31",
          eventCategory: classified.eventCategory,
          classwork: row.classwork || "",
          learningObjectives: row.classwork ? `Sinf ishi: ${row.classwork}` : `${row.lessonTitle} mavzusi bo\u2018yicha bilim va ko\u2018nikmalarni shakllantirish.`,
          content: `${row.lessonTitle}. Sinf ishi: ${row.classwork || "-"}. Uyga vazifa: ${row.homework || "-"}.`,
          homework: row.homework || "",
          notes: row.notes ?? "",
          hours: row.hours || 1,
          maxPoints: classified.maxPoints,
          milestoneType: classified.milestoneType,
          milestoneCode: classified.milestoneCode,
          precedingLessonIds,
          linkedMilestoneLessonId,
          sourceFile: wb.fileName,
          sourceFileName: wb.fileName,
          sourceDirectory: wb.sourceDirectory,
          sourceWorksheet: wb.worksheetName,
          sourceRow: row.sourceRow,
          sourceRowNumber: row.sourceRow,
          sourceRecordHash: row.sourceRecordHash,
          originalSourceSnapshot: {
            lessonOrder: row.lessonNumber,
            rawLessonOrder: row.rawLessonOrder || String(row.lessonNumber),
            topicTitle: row.lessonTitle,
            lessonType: row.lessonType || "Oddiy dars-31",
            classwork: row.classwork || "",
            homework: row.homework || "",
            hours: row.hours || 1,
            notes: row.notes ?? "",
            quarterLabel: row.quarterLabel || `${row.quarter}-chorak`
          },
          modificationHistory: [],
          materials: [],
          relatedAssessmentIds: [],
          linkedAssessmentIds: [],
          publicationStatus: desiredPubStatus,
          status: desiredStatus,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        existingLessons.push(newLesson);
        lessonById.set(lessonId, newLesson);
        if (newLesson.sourceRecordHash) {
          lessonByHash.set(newLesson.sourceRecordHash, newLesson);
        }
        importedLessonsCount++;
      }
    }
  }
  const job = {
    id: `cij-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    jobId: resolvedJobId,
    institutionId,
    archiveName: preview.archiveName,
    archiveHash: preview.archiveHash,
    importVersion,
    totalWorkbooks: preview.totalWorkbooks,
    totalRows: preview.totalLessonRecords,
    importedWorkPlansCount,
    updatedWorkPlansCount,
    importedLessonsCount,
    updatedLessonsCount,
    skippedDuplicatesCount,
    tTrackVisibilityApproved,
    publishImmediately,
    status: "completed",
    initiatedByUid: actorUid,
    initiatedByName: actorName,
    createdAt: nowIso
  };
  existingJobs.unshift(job);
  return {
    job,
    idempotentReplay: false,
    importedWorkPlansCount,
    updatedWorkPlansCount,
    importedLessonsCount,
    updatedLessonsCount,
    skippedDuplicatesCount
  };
}
var cachedOfficialArchivePreview = null;
async function getOfficialMathArchivePreview() {
  if (cachedOfficialArchivePreview) {
    return cachedOfficialArchivePreview;
  }
  let archivePath = resolveOfficialMathArchivePath();
  if (!archivePath) return null;
  try {
    const buf = fs3.readFileSync(archivePath);
    const preview = await parseAndValidateCurriculumZipBuffer(
      buf,
      OFFICIAL_MATH_ARCHIVE_DISPLAY_NAME
    );
    cachedOfficialArchivePreview = preview;
    return preview;
  } catch (err) {
    console.warn("Could not parse official math archive:", err);
    return null;
  }
}
function buildCurriculumLessonQuestions(params) {
  const {
    institutionId,
    authorId,
    lesson,
    precedingLessons = [],
    questionCount,
    difficulty,
    questionTypes,
    maxPoints,
    referenceText
  } = params;
  const count = Math.max(1, Math.min(40, Number(questionCount) || 10));
  const area = lesson.curriculumArea || "Matematika";
  const typesCycle = Array.isArray(questionTypes) && questionTypes.length > 0 ? questionTypes : ["single_choice", "multiple_choice", "numeric", "short_text"];
  const sourceLessons = precedingLessons.length > 0 ? precedingLessons : [lesson];
  const totalPointsTarget = maxPoints && maxPoints > 0 ? maxPoints : count * 2;
  const basePointPerQuestion = Math.max(1, Math.floor(totalPointsTarget / count));
  const remainderPoints = Math.max(0, totalPointsTarget - basePointPerQuestion * count);
  const questions = [];
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  for (let i = 0; i < count; i++) {
    const qType = typesCycle[i % typesCycle.length];
    const targetLes = sourceLessons[i % sourceLessons.length];
    const topicText = targetLes.topicTitle || targetLes.title;
    const cwRef = targetLes.classwork ? `Sinf ishi mashqlari: ${targetLes.classwork}` : "";
    const hwRef = targetLes.homework ? `Uyga vazifa: ${targetLes.homework}` : "";
    const extraRef = referenceText ? `Qo\u2018shimcha manba: ${referenceText.slice(0, 140)}` : "";
    const qPoints = i < remainderPoints ? basePointPerQuestion + 1 : basePointPerQuestion;
    const qId = `q-cur-${lesson.id}-${Date.now()}-${i + 1}`;
    const qCode = `CUR-${lesson.classCode.toUpperCase()}-${area.slice(0, 3).toUpperCase()}-L${targetLes.lessonNumber}-Q${i + 1}`;
    let prompt = "";
    let options;
    let structuredOptions;
    let correctAnswer = "";
    let correctAnswers;
    let acceptedAnswers;
    let explanation = "";
    const a = i + 3 + lesson.grade % 4;
    const b = i % 5 + 2;
    if (qType === "numeric") {
      const resultVal = a * b + targetLes.lessonNumber % 7;
      prompt = `[${lesson.grade}-sinf ${area} \u2022 ${targetLes.lessonNumber}-dars: "${topicText}"] ${cwRef ? `(${cwRef}) ` : ""}Quyidagi matematik ifodaning son qiymatini hisoblang: ${a} \xB7 ${b} + ${targetLes.lessonNumber % 7} = ?`;
      correctAnswer = String(resultVal);
      explanation = `${topicText} mavzusidagi amallar tartibiga ko\u2018ra: ${a} \xB7 ${b} + ${targetLes.lessonNumber % 7} = ${resultVal}. ${hwRef}`;
    } else if (qType === "short_text" || qType === "long_text" || qType === "written_open") {
      prompt = `[${lesson.grade}-sinf ${area} \u2022 ${targetLes.lessonNumber}-dars] "${topicText}" mavzusi asosida (${cwRef || "asosiy qoida"}) asosiy formula yoki xossani qisqa ifodalang. ${extraRef}`;
      correctAnswer = topicText;
      acceptedAnswers = [
        {
          questionCode: qCode,
          acceptedAnswer: topicText,
          text: topicText,
          caseSensitive: false,
          trimWhitespace: true
        }
      ];
      explanation = `"${topicText}" darsi bo\u2018yicha nazariy ta\u2019rif va ${cwRef || "namunaviy misollar"} asosida tekshiriladi.`;
    } else if (qType === "multiple_choice" || qType === "multi_select") {
      const optA = `"${topicText}" mavzusining asosiy xossasi va formulalari o\u2018rinli`;
      const optB = `${cwRef || "Darslikdagi mashqlar"} algoritm asosida yechiladi`;
      const optC = "Maxraj nolga teng bo\u2018lishi mumkin";
      const optD = "Natija har doim manfiy songa teng";
      options = [optA, optB, optC, optD];
      correctAnswer = `${optA}; ${optB}`;
      correctAnswers = [optA, optB];
      structuredOptions = [
        { id: `${qId}-A`, code: "A", key: "A", text: optA, isCorrect: true, displayOrder: 1 },
        { id: `${qId}-B`, code: "B", key: "B", text: optB, isCorrect: true, displayOrder: 2 },
        { id: `${qId}-C`, code: "C", key: "C", text: optC, isCorrect: false, displayOrder: 3 },
        { id: `${qId}-D`, code: "D", key: "D", text: optD, isCorrect: false, displayOrder: 4 }
      ];
      explanation = `"${topicText}" darsi bo\u2018yicha A va B tasdiqlar to\u2018g\u2018ri.`;
    } else {
      const valRight = a + b * 2;
      const optA = `${valRight}`;
      const optB = `${valRight + 2}`;
      const optC = `${valRight - 1}`;
      const optD = `${valRight + 5}`;
      options = [optA, optB, optC, optD];
      correctAnswer = optA;
      structuredOptions = [
        { id: `${qId}-A`, code: "A", key: "A", text: optA, isCorrect: true, displayOrder: 1 },
        { id: `${qId}-B`, code: "B", key: "B", text: optB, isCorrect: false, displayOrder: 2 },
        { id: `${qId}-C`, code: "C", key: "C", text: optC, isCorrect: false, displayOrder: 3 },
        { id: `${qId}-D`, code: "D", key: "D", text: optD, isCorrect: false, displayOrder: 4 }
      ];
      prompt = `[${lesson.grade}-sinf ${area} \u2022 ${targetLes.lessonNumber}-dars: "${topicText}"] ${cwRef ? `(${cwRef}) ` : ""}x \u2212 ${b * 2} = ${a} tenglamaning ildizini toping.`;
      explanation = `x = ${a} + ${b * 2} = ${valRight}. (${topicText} \u2022 ${hwRef || cwRef})`;
    }
    const resolvedDifficulty = difficulty === "mixed" ? ["easy", "medium", "hard"][i % 3] : difficulty;
    questions.push({
      id: qId,
      code: qCode,
      title: `${targetLes.lessonNumber}-dars savoli #${i + 1}`,
      institutionId,
      authorId,
      subject: "Matematika",
      subjectCode: "MAT",
      grade: lesson.grade,
      classCode: lesson.classCode,
      lessonId: targetLes.id,
      topicId: targetLes.topicId,
      difficulty: resolvedDifficulty,
      type: qType,
      points: qPoints,
      prompt,
      options,
      structuredOptions,
      correctAnswer,
      correctAnswers,
      acceptedAnswers,
      gradingMode: qType === "long_text" || qType === "written_open" ? "ai_assisted" : "automatic",
      explanation,
      status: "approved",
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }
  return questions;
}

// src/utils/studentMonitoringEngine.ts
var ATTENDANCE_STATUS_LABELS = {
  PRESENT: "Keldi",
  ABSENT: "Kelmagan",
  LATE: "Kechikdi",
  EXCUSED_ABSENCE: "Sababli"
};
var ATTENDANCE_LABEL_TO_STATUS = {
  keldi: "PRESENT",
  present: "PRESENT",
  kelmagan: "ABSENT",
  yoq: "ABSENT",
  "yo\u2018q": "ABSENT",
  absent: "ABSENT",
  kechikdi: "LATE",
  late: "LATE",
  sababli: "EXCUSED_ABSENCE",
  excused: "EXCUSED_ABSENCE",
  "sababli kelmagan": "EXCUSED_ABSENCE"
};
function normalizeAttendanceStatus(raw) {
  if (!raw) return null;
  const cleaned = String(raw).trim().toLowerCase();
  return ATTENDANCE_LABEL_TO_STATUS[cleaned] || null;
}
function calculateAttendanceStats(records) {
  if (!records || records.length === 0) {
    return {
      totalRecordedDays: 0,
      totalSessions: 0,
      presentDays: 0,
      presentCount: 0,
      absentDays: 0,
      absentCount: 0,
      lateArrivals: 0,
      lateDays: 0,
      lateCount: 0,
      excusedAbsences: 0,
      excusedDays: 0,
      excusedCount: 0,
      attendancePercentage: 100,
      attendancePercent: 100,
      attendanceRate: 100,
      consecutiveAbsences: 0
    };
  }
  const byDate = /* @__PURE__ */ new Map();
  for (const r of records) {
    const existing = byDate.get(r.date);
    if (!existing || new Date(r.updatedAt || r.recordedAt).getTime() >= new Date(existing.updatedAt || existing.recordedAt).getTime()) {
      byDate.set(r.date, r);
    }
  }
  const uniqueRecords = Array.from(byDate.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  let presentDays = 0;
  let absentDays = 0;
  let lateArrivals = 0;
  let excusedAbsences = 0;
  for (const rec of uniqueRecords) {
    if (rec.status === "PRESENT") presentDays += 1;
    else if (rec.status === "ABSENT") absentDays += 1;
    else if (rec.status === "LATE") lateArrivals += 1;
    else if (rec.status === "EXCUSED_ABSENCE") excusedAbsences += 1;
  }
  const totalRecordedDays = uniqueRecords.length;
  const attendedCount = presentDays + lateArrivals;
  const attendancePercentage = totalRecordedDays === 0 ? 100 : Math.round(attendedCount / totalRecordedDays * 100);
  let consecutiveAbsences = 0;
  for (let i = uniqueRecords.length - 1; i >= 0; i--) {
    if (uniqueRecords[i].status === "ABSENT") {
      consecutiveAbsences += 1;
    } else {
      break;
    }
  }
  return {
    totalRecordedDays,
    totalSessions: totalRecordedDays,
    presentDays,
    presentCount: presentDays,
    absentDays,
    absentCount: absentDays,
    lateArrivals,
    lateDays: lateArrivals,
    lateCount: lateArrivals,
    excusedAbsences,
    excusedDays: excusedAbsences,
    excusedCount: excusedAbsences,
    attendancePercentage,
    attendancePercent: attendancePercentage,
    attendanceRate: attendancePercentage,
    consecutiveAbsences
  };
}
function buildMonthlyAttendanceGrid(arg1, arg2, arg3, arg4, _arg5) {
  let year;
  let month;
  let records = [];
  if (typeof arg1 === "number") {
    year = arg1;
    month = arg2;
    records = Array.isArray(arg3) ? arg3 : [];
  } else {
    year = arg2;
    month = typeof arg3 === "number" ? arg3 : 1;
    records = Array.isArray(arg4) ? arg4 : [];
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  const recordsMap = /* @__PURE__ */ new Map();
  for (const r of records) {
    const list = recordsMap.get(r.date) || [];
    list.push(r);
    recordsMap.set(r.date, list);
  }
  const grid = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const mStr = month < 10 ? `0${month}` : `${month}`;
    const dStr = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `${year}-${mStr}-${dStr}`;
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    const dayRecords = recordsMap.get(dateStr) || [];
    const isRecorded = dayRecords.length > 0;
    let present = 0;
    let absent = 0;
    let late = 0;
    for (const r of dayRecords) {
      if (r.status === "PRESENT") present++;
      else if (r.status === "LATE") late++;
      else if (r.status === "ABSENT") absent++;
    }
    const total = dayRecords.length;
    const pct = total === 0 ? void 0 : Math.round((present + late) / total * 100);
    grid.push({
      date: dateStr,
      day,
      dayNumber: day,
      dayOfWeek,
      isCurrentMonth: true,
      isRecorded,
      attendancePercent: pct,
      presentCount: present,
      absentCount: absent,
      lateCount: late,
      record: dayRecords[0]
    });
  }
  const result = Object.assign(grid, { days: grid });
  return result;
}
function validateAttendanceImportRows(rawRows, existingRecords, studentsList) {
  const previews = [];
  let validCount = 0;
  let conflictCount = 0;
  let errorCount = 0;
  const existingMap = /* @__PURE__ */ new Map();
  for (const r of existingRecords) {
    existingMap.set(`${r.studentId}_${r.date}`, r);
  }
  const studentsByCodeOrEmail = /* @__PURE__ */ new Map();
  for (const s of studentsList) {
    if (s.role !== "student") continue;
    if (s.studentCode) studentsByCodeOrEmail.set(s.studentCode.toLowerCase(), s);
    if (s.uid) studentsByCodeOrEmail.set(s.uid.toLowerCase(), s);
    if (s.email) studentsByCodeOrEmail.set(s.email.toLowerCase(), s);
    studentsByCodeOrEmail.set(s.displayName.toLowerCase(), s);
  }
  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const rawStudentId = String(row["studentId"] || row["ID"] || row["Oquvchi ID"] || row["studentCode"] || "").trim();
    const rawStudentName = String(row["studentName"] || row["F.I.Sh."] || row["Ism"] || row["name"] || "").trim();
    const rawClassCode = String(row["classCode"] || row["Sinf"] || row["class"] || "").trim();
    let rawDate = String(row["date"] || row["Sana"] || "").trim();
    const rawStatus = String(row["status"] || row["Holat"] || row["Davomat"] || "").trim();
    if (/^\d{5}$/.test(rawDate)) {
      const serial = parseInt(rawDate, 10);
      const utcDays = serial - 25569;
      const dateObj = new Date(utcDays * 86400 * 1e3);
      rawDate = dateObj.toISOString().slice(0, 10);
    }
    const matchedStudent = rawStudentId && studentsByCodeOrEmail.get(rawStudentId.toLowerCase()) || rawStudentName && studentsByCodeOrEmail.get(rawStudentName.toLowerCase());
    const normalizedStatus = normalizeAttendanceStatus(rawStatus);
    const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(rawDate);
    if (!matchedStudent) {
      errorCount++;
      previews.push({
        rowNumber,
        rawStudentId,
        rawStudentName,
        rawClassCode,
        rawDate,
        rawStatus,
        status: "error",
        message: "O\u2018quvchi ro\u2018yxatdan topilmadi."
      });
      return;
    }
    if (!dateValid) {
      errorCount++;
      previews.push({
        rowNumber,
        rawStudentId,
        rawStudentName,
        rawClassCode,
        rawDate,
        rawStatus,
        status: "error",
        message: "Sana formati noto\u2018g\u2018ri (YYYY-MM-DD talab qilinadi)."
      });
      return;
    }
    if (!normalizedStatus) {
      errorCount++;
      previews.push({
        rowNumber,
        rawStudentId,
        rawStudentName,
        rawClassCode,
        rawDate,
        rawStatus,
        status: "error",
        message: "Noma\u2019lum davomat holati (Keldi, Kelmagan, Kechikdi, Sababli)."
      });
      return;
    }
    const conflictKey = `${matchedStudent.uid}_${rawDate}`;
    const existingRec = existingMap.get(conflictKey);
    if (existingRec) {
      conflictCount++;
      previews.push({
        rowNumber,
        rawStudentId,
        rawStudentName,
        rawClassCode,
        rawDate,
        rawStatus,
        normalizedStudentId: matchedStudent.uid,
        normalizedStudentName: matchedStudent.displayName,
        normalizedClassCode: matchedStudent.classCode || rawClassCode,
        normalizedDate: rawDate,
        normalizedStatus,
        status: "conflict",
        existingRecord: existingRec,
        message: `Mavjud yozuv bilan to\u2018qnashuv (${ATTENDANCE_STATUS_LABELS[existingRec.status]} -> ${ATTENDANCE_STATUS_LABELS[normalizedStatus]}).`
      });
    } else {
      validCount++;
      previews.push({
        rowNumber,
        rawStudentId,
        rawStudentName,
        rawClassCode,
        rawDate,
        rawStatus,
        normalizedStudentId: matchedStudent.uid,
        normalizedStudentName: matchedStudent.displayName,
        normalizedClassCode: matchedStudent.classCode || rawClassCode,
        normalizedDate: rawDate,
        normalizedStatus,
        status: "valid"
      });
    }
  });
  return {
    fileName: "attendance_import.xlsx",
    totalRows: rawRows.length,
    validCount,
    conflictCount,
    errorCount,
    rows: previews
  };
}
function calculateStudentAcademicMetrics(student, attempts, assessments, topics, lessons) {
  const studentAttempts = attempts.filter((a) => a.studentId === student.uid);
  const subjectScores = {};
  const bsbScores = {};
  const chsbScores = {};
  const now = /* @__PURE__ */ new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthAttempts = [];
  const prevMonthAttempts = [];
  studentAttempts.forEach((att) => {
    const assess = assessments.find((a) => a.id === att.assessmentId);
    const subj = assess?.subject || "Matematika";
    if (!subjectScores[subj]) subjectScores[subj] = [];
    subjectScores[subj].push(att.scorePercent);
    const titleLower = (att.assessmentTitle || assess?.title || "").toLowerCase();
    if (titleLower.includes("bsb") || titleLower.includes("yozma ish")) {
      if (!bsbScores[subj]) bsbScores[subj] = [];
      bsbScores[subj].push(att.scorePercent);
    } else if (titleLower.includes("chsb") || titleLower.includes("choraklik")) {
      if (!chsbScores[subj]) chsbScores[subj] = [];
      chsbScores[subj].push(att.scorePercent);
    }
    const subDate = (att.submittedAt || "").slice(0, 7);
    if (subDate === currentMonthKey) currentMonthAttempts.push(att.scorePercent);
    else if (subDate === prevMonthKey) prevMonthAttempts.push(att.scorePercent);
  });
  const overallAverageScore = studentAttempts.length === 0 ? 0 : Math.round(studentAttempts.reduce((acc, curr) => acc + curr.scorePercent, 0) / studentAttempts.length);
  const topicAccuracyMap = /* @__PURE__ */ new Map();
  studentAttempts.forEach((att) => {
    if (Array.isArray(att.answers)) {
      att.answers.forEach((ans) => {
        if (!ans.topicId) return;
        const current = topicAccuracyMap.get(ans.topicId) || { totalEarned: 0, totalMax: 0, attemptsCount: 0, scores: [] };
        const maxPts = ans.maxPoints || 1;
        const earned = ans.awardedPoints != null ? ans.awardedPoints : ans.isCorrect ? maxPts : 0;
        current.totalEarned += earned;
        current.totalMax += maxPts;
        current.attemptsCount += 1;
        current.scores.push(Math.round(earned / maxPts * 100));
        topicAccuracyMap.set(ans.topicId, current);
      });
    }
  });
  const topicsEvidence = [];
  topics.forEach((t) => {
    if (t.grade && student.grade && t.grade !== student.grade) return;
    if (student.classCode && !isSubjectCompatibleWithClass(t.subject, student.classCode).compatible) return;
    const data = topicAccuracyMap.get(t.id);
    if (!data || data.totalMax === 0) {
      topicsEvidence.push({
        topicId: t.id,
        topicName: t.name,
        subject: t.subject,
        accuracy: 0,
        assessmentsCount: 0,
        evidenceLevel: "Ma'lumot yetarli emas"
      });
      return;
    }
    const accuracy = Math.round(data.totalEarned / data.totalMax * 100);
    let evidenceLevel = "Ma'lumot yetarli emas";
    if (data.attemptsCount >= 2 && accuracy >= 85) {
      evidenceLevel = "Yaxshi o'zlashtirilgan";
    } else if (accuracy >= 60) {
      evidenceLevel = "Mustahkamlanmoqda";
    } else if (data.attemptsCount > 0) {
      evidenceLevel = "O'rganilmoqda";
    }
    let decliningTrend = false;
    let recentScore;
    let previousScore;
    if (data.scores.length >= 2) {
      recentScore = data.scores[data.scores.length - 1];
      previousScore = data.scores[data.scores.length - 2];
      if (previousScore - recentScore >= 15) {
        decliningTrend = true;
      }
    }
    topicsEvidence.push({
      topicId: t.id,
      topicName: t.name,
      subject: t.subject,
      accuracy,
      assessmentsCount: data.attemptsCount,
      evidenceLevel,
      decliningTrend,
      recentScore,
      previousScore
    });
  });
  const subjectAverages = {};
  Object.keys(subjectScores).forEach((subj) => {
    const list = subjectScores[subj];
    const avg = Math.round(list.reduce((a, b) => a + b, 0) / list.length);
    const bsbList = bsbScores[subj] || [];
    const chsbList = chsbScores[subj] || [];
    const subjTopics = topicsEvidence.filter((te) => te.subject === subj);
    const mastered = subjTopics.filter((te) => te.evidenceLevel === "Yaxshi o'zlashtirilgan").length;
    const needingPractice = subjTopics.filter((te) => te.evidenceLevel === "O'rganilmoqda" || te.decliningTrend).length;
    let level = "Ma'lumot yetarli emas";
    if (list.length >= 2 && avg >= 85) level = "Yaxshi o'zlashtirilgan";
    else if (avg >= 60) level = "Mustahkamlanmoqda";
    else if (list.length > 0) level = "O'rganilmoqda";
    subjectAverages[subj] = {
      averageScore: avg,
      assessmentsCompleted: list.length,
      bsbScore: bsbList.length > 0 ? Math.round(bsbList.reduce((a, b) => a + b, 0) / bsbList.length) : void 0,
      chsbScore: chsbList.length > 0 ? Math.round(chsbList.reduce((a, b) => a + b, 0) / chsbList.length) : void 0,
      masteredTopicsCount: mastered,
      needingPracticeTopicsCount: needingPractice,
      evidenceLevel: level
    };
  });
  const classLessons = lessons.filter(
    (l) => !student.classCode || l.classCode?.toLowerCase() === student.classCode.toLowerCase() || Array.isArray(l.classCodes) && l.classCodes.some((c) => c.toLowerCase() === student.classCode?.toLowerCase())
  );
  const completedLessons = classLessons.filter((l) => l.status === "completed");
  return {
    studentId: student.uid,
    studentName: student.displayName,
    classCode: student.classCode || "7a1",
    overallAverageScore,
    subjectAverages,
    comparisonPeriods: {
      currentMonthScore: currentMonthAttempts.length > 0 ? Math.round(currentMonthAttempts.reduce((a, b) => a + b, 0) / currentMonthAttempts.length) : overallAverageScore,
      previousMonthScore: prevMonthAttempts.length > 0 ? Math.round(prevMonthAttempts.reduce((a, b) => a + b, 0) / prevMonthAttempts.length) : overallAverageScore,
      currentQuarterScore: overallAverageScore,
      previousQuarterScore: overallAverageScore
    },
    topicsEvidence,
    completedLessonsCount: completedLessons.length,
    pendingLessonsCount: Math.max(0, classLessons.length - completedLessons.length)
  };
}
function generateSmartRiskAlerts(student, attendanceStats, academicMetrics, submissions, assignments, existingAlerts = []) {
  const alerts = [];
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const instId = student.institutionId || "inst-spec-study";
  const classCode = student.classCode || "7a1";
  const classId = student.classId || "";
  const isAlreadyOpen = (cat) => existingAlerts.some((a) => a.studentId === student.uid && a.category === cat && a.status !== "resolved");
  if (attendanceStats.totalRecordedDays >= 5 && attendanceStats.attendancePercentage < 80 && !isAlreadyOpen("attendance")) {
    alerts.push({
      id: `alert_att_${student.uid}_${Date.now()}`,
      institutionId: instId,
      studentId: student.uid,
      studentName: student.displayName,
      classCode,
      classId,
      category: "attendance",
      severity: attendanceStats.attendancePercentage < 70 ? "high" : "medium",
      title: "Davomatni tekshirish kerak",
      evidence: `Jami qayd etilgan ${attendanceStats.totalRecordedDays} kundan davomat ko\u2018rsatkichi ${attendanceStats.attendancePercentage}% ni tashkil etmoqda (${attendanceStats.absentDays} kun qoldirilgan).`,
      status: "open",
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }
  if (attendanceStats.consecutiveAbsences >= 3 && !isAlreadyOpen("attendance")) {
    alerts.push({
      id: `alert_cons_att_${student.uid}_${Date.now()}`,
      institutionId: instId,
      studentId: student.uid,
      studentName: student.displayName,
      classCode,
      classId,
      category: "attendance",
      severity: "high",
      title: "Davomatni tekshirish kerak",
      evidence: `Ketma-ket ${attendanceStats.consecutiveAbsences} kun sababsiz dars qoldirilganligi qayd etildi.`,
      status: "open",
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }
  const overdueSubmissions = submissions.filter(
    (s) => s.studentId === student.uid && s.status === "Muddati o'tgan"
  );
  if (overdueSubmissions.length >= 2 && !isAlreadyOpen("overdue_assignment")) {
    alerts.push({
      id: `alert_assg_${student.uid}_${Date.now()}`,
      institutionId: instId,
      studentId: student.uid,
      studentName: student.displayName,
      classCode,
      classId,
      category: "overdue_assignment",
      severity: "medium",
      title: "Topshiriqlar bajarilmagan",
      evidence: `${overdueSubmissions.length} ta topshiriq belgilangan muddat ichida topshirilmagan.`,
      status: "open",
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }
  const decliningTopics = academicMetrics.topicsEvidence.filter((te) => te.decliningTrend);
  if (decliningTopics.length > 0 && !isAlreadyOpen("academic_decline")) {
    const topicNames = decliningTopics.map((t) => t.topicName).slice(0, 2).join(", ");
    alerts.push({
      id: `alert_decl_${student.uid}_${Date.now()}`,
      institutionId: instId,
      studentId: student.uid,
      studentName: student.displayName,
      classCode,
      classId,
      category: "academic_decline",
      severity: "medium",
      title: "Akademik natijalarda pasayish kuzatilgan",
      evidence: `${topicNames} mavzulari bo\u2018yicha keyingi baholashlarda natijalar kamida 15% ga pasaygan.`,
      status: "open",
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }
  const needingPractice = academicMetrics.topicsEvidence.filter(
    (te) => te.evidenceLevel === "O'rganilmoqda" && te.assessmentsCount >= 2 && te.accuracy < 55
  );
  if (needingPractice.length >= 2 && !isAlreadyOpen("practice_needed")) {
    const list = needingPractice.slice(0, 2).map((t) => t.topicName).join(", ");
    alerts.push({
      id: `alert_prac_${student.uid}_${Date.now()}`,
      institutionId: instId,
      studentId: student.uid,
      studentName: student.displayName,
      classCode,
      classId,
      category: "practice_needed",
      severity: "low",
      title: "Qo\u2018shimcha mashq tavsiya etiladi",
      evidence: `${list} mavzulari bo\u2018yicha o\u2018zlashtirish 55% dan past bo\u2018lib, mustahkamlash mashg\u2018ulotlari foydali bo\u2018ladi.`,
      status: "open",
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }
  return alerts;
}
function calculateClassMonitoringSnapshot(classCode, grade, track, enrolledStudents, attendanceRecords, assignments, submissions, attempts, alerts, supportPlans) {
  const studentUids = new Set(enrolledStudents.map((s) => s.uid));
  const classAttRecords = attendanceRecords.filter((r) => studentUids.has(r.studentId));
  const attStats = calculateAttendanceStats(classAttRecords);
  const classAttempts = attempts.filter((a) => studentUids.has(a.studentId));
  const activeAssessmentsCount = new Set(classAttempts.map((a) => a.assessmentId)).size;
  const participationRate = enrolledStudents.length === 0 || activeAssessmentsCount === 0 ? 100 : Math.min(100, Math.round(classAttempts.length / (enrolledStudents.length * activeAssessmentsCount) * 100));
  const classSubmissions = submissions.filter((s) => studentUids.has(s.studentId));
  const completedSubmissions = classSubmissions.filter((s) => s.status === "Topshirildi").length;
  const assignmentRate = classSubmissions.length === 0 ? 100 : Math.round(completedSubmissions / classSubmissions.length * 100);
  const subjectMap = {};
  classAttempts.forEach((att) => {
    const subj = att.assessmentTitle ? att.assessmentTitle.split(" ")[0] : "Matematika";
    if (!subjectMap[subj]) subjectMap[subj] = [];
    subjectMap[subj].push(att.scorePercent);
  });
  const subjectAverages = {};
  Object.keys(subjectMap).forEach((subj) => {
    const scores = subjectMap[subj];
    subjectAverages[subj] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  });
  const activeAlerts = alerts.filter((a) => studentUids.has(a.studentId) && a.status === "open").length;
  const activePlans = supportPlans.filter((p) => studentUids.has(p.studentId) && p.status !== "Yakunlandi").length;
  return {
    classCode,
    grade,
    track,
    enrolledStudentsCount: enrolledStudents.length,
    attendancePercentage: attStats.attendancePercentage,
    assessmentParticipationRate: participationRate,
    assignmentCompletionRate: assignmentRate,
    subjectAverages,
    activeAlertsCount: activeAlerts,
    activeSupportPlansCount: activePlans
  };
}

// server.ts
var CONFIGURED_OWNER_EMAIL = (process.env.PLATFORM_OWNER_EMAIL || PLATFORM_OWNER_EMAIL).trim().toLowerCase();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path4.dirname(__filename);
var AIAnalysisSchema = z4.object({
  summary: z4.string().min(5),
  topic_analysis: z4.array(
    z4.object({
      topic_id: z4.string(),
      observed_performance: z4.string(),
      possible_error_pattern: z4.string(),
      evidence_count: z4.number(),
      confidence: z4.enum(["low", "medium", "high"]),
      recommendation: z4.string()
    })
  ),
  next_steps: z4.array(
    z4.object({
      topic_id: z4.string(),
      activity: z4.string(),
      reason: z4.string(),
      priority: z4.enum(["low", "medium", "high"])
    })
  ),
  teacher_summary: z4.string().min(5),
  parent_summary: z4.string().optional()
});
var AIDraftedQuestionSchema = z4.object({
  prompt: z4.string().min(5),
  options: z4.array(z4.string()).length(4),
  correctAnswer: z4.string().min(1),
  explanation: z4.string().min(5)
});
function getGeminiClient(req) {
  if (req && resolveRequestEnv(req) === "test") {
    return null;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 8e3,
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
var sseClients = [];
function broadcastInstitutionUpdate(env, institutionId, eventType) {
  const context = requestDatabase.getStore();
  if (context) {
    context.afterCommit.push(() => requestDatabase.exit(() => broadcastInstitutionUpdate(env, institutionId, eventType)));
    return;
  }
  const payload = `data: ${JSON.stringify({ type: eventType, institutionId, timestamp: (/* @__PURE__ */ new Date()).toISOString() })}

`;
  for (const client of sseClients) {
    if (client.env === env && client.institutionId === institutionId) {
      try {
        client.res.write(payload);
      } catch {
      }
    }
  }
}
function resolveRequestEnv(req) {
  const headerEnv = req.headers["x-learnos-env"];
  if (process.env.NODE_ENV === "test" && (headerEnv === "test" || req.query.testEnv === "1")) {
    return "test";
  }
  return "prod";
}
var apiRateLimiter = new SlidingWindowRateLimiter();
var failedLoginCounter = /* @__PURE__ */ new Map();
var deniedAdminCounter = /* @__PURE__ */ new Map();
function getClientIpHash(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1").split(",")[0].trim();
  return computeSimpleHash(`ip:${forwarded}`);
}
function getRequestId(req) {
  return String(req.requestId || req.headers["x-request-id"] || `req-${Date.now()}`);
}
function extractRawTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  if (req.path === "/api/events" && typeof req.query.token === "string") {
    return req.query.token.trim();
  }
  return void 0;
}
function authenticateRequest(req) {
  const token = extractRawTokenFromRequest(req);
  const verified = verifySessionToken(token);
  if (!verified || !token) return null;
  if (verified.env === "test" && process.env.NODE_ENV !== "test") return null;
  const db = getDbState(verified.env);
  const user = db.users.find((u) => u.uid === verified.uid);
  if (!user || user.status === "suspended" || user.status === "archived") return null;
  const normalizedEmail = String(user.email || "").trim().toLowerCase();
  const isAuthAdmin = isAuthorizedAdminEmail(normalizedEmail, CONFIGURED_OWNER_EMAIL);
  if (isAuthAdmin && user.emailVerified === true && user.platformAdmin === true && db.customClaims?.[user.uid]?.platformAdmin === true) {
    user.role = "platform_owner";
    user.platformOwner = true;
    user.platformAdmin = true;
  } else if (!isAuthAdmin && (user.role === "platform_owner" || user.role === "admin")) {
    user.role = "student";
    user.platformOwner = false;
    user.platformAdmin = false;
  }
  return { user, env: verified.env, db, token };
}
function appendAuditLog(db, institutionId, actor, action, target, recordId, meta) {
  const entry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    institutionId,
    actorUid: actor.uid,
    actorName: actor.displayName,
    actorRole: actor.role,
    action,
    target,
    recordId,
    status: meta?.outcome === "denied" || meta?.outcome === "failure" ? "failed" : "success",
    eventType: meta?.eventType || "AUDIT_EVENT",
    outcome: meta?.outcome || "success",
    requestId: meta?.requestId,
    ipHash: meta?.ipHash,
    severity: meta?.severity || "INFO",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.auditLogs.unshift(entry);
}
function pushNotification(db, institutionId, recipientUid, title, message, link) {
  const notif = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    institutionId,
    recipientUid,
    title,
    message,
    link,
    read: false,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.notifications.unshift(notif);
}
var app = express();
async function startServer() {
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const reqId = String(req.headers["x-request-id"] || "").trim() || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    req.requestId = reqId;
    res.setHeader("X-Request-Id", reqId);
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://*.firebaseapp.com https://accounts.google.com https://*.vercel.app; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://apis.google.com; connect-src 'self' ws: wss: https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://apis.google.com https://accounts.google.com https://*.google.com https://www.gstatic.com https://*.vercel.app wss://*.firebaseio.com; frame-ancestors 'self' https://*.google.com https://*.goog https://*.run.app https://*.ai.studio https://ai.studio https://*.vercel.app;"
    );
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()"
    );
    const origin = req.headers.origin;
    if (origin) {
      const requestHost = String(req.headers["x-forwarded-host"] || req.headers.host || "");
      const isAllowedOrigin = isTrustedCorsOrigin(origin, requestHost);
      if (!isAllowedOrigin && req.path.startsWith("/api/")) {
        return res.status(403).json({
          error: "CORS policy: Ruxsat etilmagan manbadan (Origin) so\u2018rov rad etildi.",
          requestId: reqId
        });
      }
      if (isAllowedOrigin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
        res.setHeader(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, X-LearnOS-Env, X-Request-Id, X-Test-Rate-Limit, X-Test-Client-Id"
        );
      }
    }
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    next();
  });
  app.get("/api/auth/diagnostics", (req, res) => {
    const requestHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").trim();
    const origin = String(req.headers.origin || "").trim();
    const appletCfg = loadFirebaseAppletConfig();
    const projectId = String(
      process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || appletCfg.projectId || "specialized-study"
    ).trim();
    const authDomain = String(
      process.env.VITE_FIREBASE_AUTH_DOMAIN || appletCfg.authDomain || `${projectId}.firebaseapp.com`
    ).trim();
    return res.json({
      status: "ok",
      projectId,
      authDomain,
      requestHost,
      origin: origin || null,
      corsAllowed: isTrustedCorsOrigin(origin || void 0, requestHost),
      googleProviderConfigured: true,
      authorizedAdminCount: AUTHORIZED_ADMIN_EMAILS.length
    });
  });
  app.use(cloudStateMiddleware);
  const uploadJsonParser = express.json({ limit: "20mb" });
  const standardJsonParser = express.json({ limit: "2mb" });
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/exams/drafts") || /^\/api\/exams\/[^/]+\/draft$/.test(req.path) || req.path.startsWith("/api/students/import/") || req.path.startsWith("/api/work-plans/upload") || req.path.startsWith("/api/imports/") || req.path.startsWith("/api/questions/media")) {
      return uploadJsonParser(req, res, next);
    }
    return standardJsonParser(req, res, next);
  });
  registerTeachingRoutes(app, { authenticate: authenticateRequest, save: saveDbState, hash: hashPassword, revoke: revokeAllUserSessions });
  app.use("/api", (req, res, next) => {
    const c = authenticateRequest(req);
    if (c?.user.role === "teacher" && !["/state", "/auth/logout"].includes(req.path) && !req.path.startsWith("/teaching/")) return res.status(403).json({ error: "O\u2018qituvchi uchun bu amalga ruxsat yo\u2018q." });
    next();
  });
  registerExamRoutes(app, { authenticate: authenticateRequest, save: saveDbState, notify: broadcastInstitutionUpdate });
  function enforceRateLimit(req, res, scope, maxRequests, windowMs) {
    const isTestEnv = resolveRequestEnv(req) === "test";
    const forceRateLimitInTest = req.headers["x-test-rate-limit"] === "enforce";
    const effectiveMax = isTestEnv && !forceRateLimitInTest ? maxRequests * 20 : maxRequests;
    const key = `${scope}:${getClientIpHash(req)}:${String(req.headers["x-test-client-id"] || "")}`;
    const check = apiRateLimiter.check(key, effectiveMax, windowMs);
    res.setHeader("X-RateLimit-Remaining", String(check.remaining));
    if (!check.allowed) {
      res.setHeader("Retry-After", String(check.retryAfterSeconds));
      res.status(429).json({
        error: `So\u2018rovlar soni chegaradan oshdi (429 Too Many Requests). Iltimos, ${check.retryAfterSeconds} soniyadan keyin qayta urinib ko\u2018ring.`,
        retryAfterSeconds: check.retryAfterSeconds
      });
      return false;
    }
    return true;
  }
  app.get("/api/health", (_req, res) => {
    const hasGemini = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"
    );
    res.json({
      status: "ok",
      persistence: process.env.PERSISTENCE_DRIVER === "firestore" ? "firestore" : "local",
      geminiConfigured: hasGemini,
      platformOwnerEmail: CONFIGURED_OWNER_EMAIL,
      authorizedAdminCount: AUTHORIZED_ADMIN_EMAILS.length,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.post("/api/test/reset", (_req, res) => {
    if (process.env.NODE_ENV !== "test") return res.status(404).json({ error: "Not found" });
    resetTestDbState();
    apiRateLimiter.reset();
    failedLoginCounter.clear();
    deniedAdminCounter.clear();
    return res.json({ status: "ok", message: "Isolated test database reset." });
  });
  app.get("/api/auth/bootstrap-status", (req, res) => {
    const env = resolveRequestEnv(req);
    const db = getDbState(env);
    const hasAdminUser = db.users.some(
      (u) => isVerifiedPlatformOwner(u, CONFIGURED_OWNER_EMAIL)
    );
    return res.json({
      isBootstrapped: hasAdminUser,
      institutionCount: db.institutions.length,
      classCount: db.classes.length,
      subjectCount: db.subjects.length
    });
  });
  app.post("/api/auth/bootstrap", (req, res) => {
    if (process.env.NODE_ENV !== "test") return res.status(403).json({ error: "Administrator hisobi faqat Firebase orqali ishonchli serverda faollashtiriladi." });
    if (!enforceRateLimit(req, res, "bootstrap", 10, 6e4)) return;
    const env = resolveRequestEnv(req);
    const db = getDbState(env);
    const reqId = getRequestId(req);
    const ipHash = getClientIpHash(req);
    const { displayName, email, password, institutionName, region, district, academicYear } = req.body;
    if (!displayName || String(displayName).trim().length < 3) {
      return res.status(400).json({ error: "F.I.Sh. kamida 3 ta belgidan iborat bo\u2018lishi kerak." });
    }
    if (!email || !String(email).includes("@")) {
      return res.status(400).json({ error: "To\u2018g\u2018ri elektron pochta manzilini kiriting." });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: "Parol kamida 6 ta belgidan iborat bo\u2018lishi shart." });
    }
    const normalizedBootstrapEmail = String(email).trim().toLowerCase();
    const isOwnerEmail = isAuthorizedAdminEmail(normalizedBootstrapEmail, CONFIGURED_OWNER_EMAIL);
    if (!isOwnerEmail) {
      appendAuditLog(
        db,
        db.institutions[0]?.id || "inst-spec-study",
        { uid: "anonymous", displayName: String(displayName).trim(), role: "student" },
        `Ruxsatsiz email orqali bootstrap urinishi rad etildi: ${normalizedBootstrapEmail}`,
        normalizedBootstrapEmail,
        void 0,
        { eventType: "UNAUTHORIZED_ADMIN_BOOTSTRAP", outcome: "denied", requestId: reqId, ipHash, severity: "CRITICAL" }
      );
      saveDbState(env, db);
      return res.status(403).json({
        error: "Kirish rad etildi (403 Forbidden): Ushbu hisobga ruxsat berilmagan."
      });
    }
    const existingThisAdmin = db.users.find(
      (u) => u.email.trim().toLowerCase() === normalizedBootstrapEmail
    );
    if (existingThisAdmin) {
      appendAuditLog(
        db,
        db.institutions[0]?.id || "inst-spec-study",
        { uid: "anonymous", displayName: "Unknown", role: "student" },
        "Takroriy bootstrap urinishi rad etildi",
        normalizedBootstrapEmail,
        void 0,
        { eventType: "BOOTSTRAP_DENIED", outcome: "denied", requestId: reqId, ipHash, severity: "WARNING" }
      );
      saveDbState(env, db);
      return res.status(403).json({
        error: "Ushbu hisob allaqachon faollashtirilgan."
      });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const adminUid = `user-admin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let primaryInst = db.institutions[0];
    if (!primaryInst) {
      const instId2 = `inst-${Date.now()}`;
      primaryInst = {
        id: instId2,
        name: String(institutionName || "Specialized Study Ixtisoslashtirilgan Maktabi").trim(),
        shortName: "Specialized Study",
        type: "specialized_school",
        code: "SPEC-STUDY-01",
        region: String(region || "Toshkent shahri").trim(),
        district: String(district || "Mirzo Ulug\u2018bek tumani").trim(),
        academicYear: String(academicYear || "2026-2027").trim(),
        gradingScale: "100_percent",
        languageOfInstruction: "O'zbek tili",
        timezone: "Asia/Tashkent",
        status: "active",
        adminUid,
        allowExcelImports: true,
        aiFeaturesEnabled: true,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      db.institutions.push(primaryInst);
    } else {
      if (institutionName && String(institutionName).trim().length >= 3) {
        primaryInst.name = String(institutionName).trim();
        primaryInst.shortName = String(institutionName).trim().slice(0, 24);
      }
      if (region) primaryInst.region = String(region).trim();
      if (district) primaryInst.district = String(district).trim();
      if (academicYear) primaryInst.academicYear = String(academicYear).trim();
      if (!primaryInst.adminUid) primaryInst.adminUid = adminUid;
      primaryInst.updatedAt = nowIso;
    }
    const instId = primaryInst.id;
    ensureSpecializedStudyStructure(db);
    const newAdmin = {
      uid: adminUid,
      displayName: String(displayName).trim(),
      email: normalizedBootstrapEmail,
      emailVerified: true,
      platformOwner: true,
      platformAdmin: true,
      role: "platform_owner",
      institutionId: instId,
      status: "active",
      lastLoginAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.users.push(newAdmin);
    db.passwordHashes[adminUid] = hashPassword(String(password));
    if (!db.customClaims) db.customClaims = {};
    db.customClaims[adminUid] = {
      ...db.customClaims[adminUid] || {},
      platformAdmin: true
    };
    appendAuditLog(
      db,
      instId,
      newAdmin,
      "Specialized Study tizimi ishga tushirildi",
      primaryInst.name,
      instId,
      { eventType: "ADMIN_BOOTSTRAP_SUCCESS", outcome: "success", requestId: reqId, ipHash, severity: "INFO" }
    );
    saveDbState(env, db);
    const token = issueSessionToken(adminUid, env);
    return res.json({
      user: newAdmin,
      institution: primaryInst,
      token
    });
  });
  app.post("/api/auth/login", (req, res) => {
    if (!enforceRateLimit(req, res, "login", 10, 6e4)) return;
    const env = resolveRequestEnv(req);
    const db = getDbState(env);
    const reqId = getRequestId(req);
    const ipHash = getClientIpHash(req);
    const { email, password } = req.body;
    if (env === "prod" && (isAuthorizedAdminEmail(String(email || ""), CONFIGURED_OWNER_EMAIL) || db.users.some((u) => u.email.toLowerCase() === String(email || "").trim().toLowerCase() && (u.role === "admin" || u.role === "platform_owner")))) {
      return res.status(403).json({ error: "Administrator Google orqali tasdiqlangan hisob bilan kirishi kerak." });
    }
    if (!email || !password) {
      return res.status(400).json({ error: "Elektron pochta va parolni kiriting." });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const instId = db.institutions[0]?.id || "inst-spec-study";
    const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    const throttleKey = nodeCrypto.createHash("sha256").update(normalizedEmail + ":" + ipHash).digest("hex");
    db.loginThrottles ||= {};
    if ((db.loginThrottles[throttleKey]?.until || 0) > Date.now()) return res.status(429).json({ error: "Ko\u2018p noto\u2018g\u2018ri urinish. 15 daqiqadan keyin qayta urining." });
    const recordFailedLogin = (reason) => {
      const previous = db.loginThrottles[throttleKey];
      const attempts = previous && previous.until > Date.now() - 15 * 60 * 1e3 ? previous.attempts + 1 : 1;
      db.loginThrottles[throttleKey] = { attempts, until: attempts >= 5 ? Date.now() + 15 * 60 * 1e3 : Date.now() };
      const failKey = `${env}:${normalizedEmail}:${ipHash}`;
      const count = (failedLoginCounter.get(failKey) || 0) + 1;
      failedLoginCounter.set(failKey, count);
      appendAuditLog(
        db,
        instId,
        { uid: user?.uid || "anonymous", displayName: normalizedEmail, role: user?.role || "student" },
        `Muvaffaqiyatsiz kirish urinishi (${reason})`,
        normalizedEmail,
        user?.uid,
        {
          eventType: count >= 3 ? "SECURITY_ALERT_REPEATED_FAILED_LOGINS" : "AUTH_LOGIN_FAILED",
          outcome: "failure",
          requestId: reqId,
          ipHash,
          severity: count >= 3 ? "CRITICAL" : "WARNING"
        }
      );
      saveDbState(env, db);
    };
    if (!user) {
      recordFailedLogin("hisob topilmadi");
      return res.status(401).json({ error: "Hisob topilmadi yoki parol noto\u2018g\u2018ri." });
    }
    if (user.status === "suspended" || user.status === "archived") {
      recordFailedLogin("hisob faol emas");
      return res.status(403).json({ error: "Sizning hisobingiz vaqtincha to\u2018xtatilgan." });
    }
    if (!verifyPassword(String(password), db.passwordHashes[user.uid])) {
      recordFailedLogin("noto\u2018g\u2018ri parol");
      return res.status(401).json({ error: "Hisob topilmadi yoki parol noto\u2018g\u2018ri." });
    }
    delete db.loginThrottles[throttleKey];
    failedLoginCounter.delete(`${env}:${normalizedEmail}:${ipHash}`);
    if (isAuthorizedAdminEmail(normalizedEmail, CONFIGURED_OWNER_EMAIL)) {
      user.role = "platform_owner";
      user.platformOwner = true;
      user.platformAdmin = true;
      user.emailVerified = true;
      if (!db.customClaims) db.customClaims = {};
      db.customClaims[user.uid] = {
        ...db.customClaims[user.uid] || {},
        platformAdmin: true
      };
    } else if (user.role === "platform_owner" || user.role === "admin") {
      user.role = "student";
      user.platformOwner = false;
      user.platformAdmin = false;
    }
    user.lastLoginAt = (/* @__PURE__ */ new Date()).toISOString();
    appendAuditLog(
      db,
      user.institutionId || instId,
      user,
      "Tizimga muvaffaqiyatli kirish",
      user.email,
      user.uid,
      { eventType: "AUTH_LOGIN_SUCCESS", outcome: "success", requestId: reqId, ipHash, severity: "INFO" }
    );
    saveDbState(env, db);
    const token = issueSessionToken(user.uid, env);
    return res.json({ user, token });
  });
  app.post("/api/auth/logout", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (authCtx) {
      revokeSessionToken(authCtx.token);
      appendAuditLog(
        authCtx.db,
        authCtx.user.institutionId,
        authCtx.user,
        "Tizimdan chiqish (sessiya bekor qilindi)",
        authCtx.user.email,
        authCtx.user.uid,
        { eventType: "AUTH_LOGOUT", outcome: "success", requestId: getRequestId(req), ipHash: getClientIpHash(req) }
      );
      saveDbState(authCtx.env, authCtx.db);
    }
    return res.json({ status: "ok", revoked: true });
  });
  app.post("/api/auth/firebase-sync", async (req, res) => {
    if (!enforceRateLimit(req, res, "firebase-sync", 25, 6e4)) return;
    const env = resolveRequestEnv(req);
    const db = getDbState(env);
    const reqId = getRequestId(req);
    const ipHash = getClientIpHash(req);
    const {
      idToken,
      uid: rawUid,
      email: rawEmail,
      displayName: rawDisplayName,
      inviteToken,
      emailVerified: rawEmailVerified,
      requireExistingClaimOnly,
      requireAdminClaim,
      customClaims: rawCustomClaims
    } = req.body || {};
    if (!idToken) return res.status(401).json({ error: "Firebase ID token talab qilinadi.", code: "auth/missing-id-token" });
    let verifiedUid = String(rawUid || "").trim();
    let verifiedEmail = String(rawEmail || "").trim().toLowerCase();
    let verifiedEmailFlag = rawEmailVerified === true;
    let verifiedDisplayName = String(rawDisplayName || "").trim();
    let verifiedClaims = {};
    if (idToken) {
      const tokenCheck = await verifyFirebaseIdToken(String(idToken), env, db);
      if (!tokenCheck.valid || !tokenCheck.identity) {
        appendAuditLog(
          db,
          db.institutions[0]?.id || "inst-spec-study",
          { uid: verifiedUid || "anonymous", displayName: verifiedEmail || "unknown", role: "student" },
          `Firebase ID token rad etildi: ${tokenCheck.errorCode || "invalid"}`,
          verifiedEmail || "unknown",
          void 0,
          { eventType: "FIREBASE_TOKEN_REJECTED", outcome: "denied", requestId: reqId, ipHash, severity: "WARNING" }
        );
        saveDbState(env, db);
        return res.status(401).json({
          error: tokenCheck.errorMessage || "Firebase ID token yaroqsiz yoki muddati tugagan.",
          code: tokenCheck.errorCode || "auth/invalid-id-token"
        });
      }
      if (verifiedUid && verifiedUid !== tokenCheck.identity.uid) {
        return res.status(403).json({
          error: "Firebase UID token ma\u2019lumotlariga mos kelmadi.",
          code: "auth/uid-mismatch"
        });
      }
      if (verifiedEmail && verifiedEmail !== tokenCheck.identity.email) {
        return res.status(403).json({
          error: "Elektron pochta token ma\u2019lumotlariga mos kelmadi.",
          code: "auth/email-mismatch"
        });
      }
      verifiedUid = tokenCheck.identity.uid;
      verifiedEmail = tokenCheck.identity.email;
      verifiedEmailFlag = tokenCheck.identity.emailVerified;
      verifiedDisplayName = verifiedDisplayName || tokenCheck.identity.displayName || "";
      verifiedClaims = {
        ...tokenCheck.identity.customClaims || {}
      };
    }
    if (!verifiedUid || !verifiedEmail) {
      return res.status(400).json({
        error: "Google foydalanuvchi ma\u2019lumotlari to\u2018liq emas.",
        code: "auth/missing-identity"
      });
    }
    if (!verifiedEmailFlag) {
      appendAuditLog(
        db,
        db.institutions[0]?.id || "inst-spec-study",
        { uid: verifiedUid, displayName: verifiedEmail, role: "student" },
        `Tasdiqlanmagan Google email orqali kirish rad etildi: ${verifiedEmail}`,
        verifiedEmail,
        verifiedUid,
        { eventType: "UNVERIFIED_EMAIL_REJECTED", outcome: "denied", requestId: reqId, ipHash, severity: "WARNING" }
      );
      saveDbState(env, db);
      return res.status(403).json({
        error: "Google hisobingizdagi elektron pochta manzili tasdiqlanmagan.",
        code: "auth/unverified-email"
      });
    }
    const isAuthAdmin = isAuthorizedAdminEmail(verifiedEmail, CONFIGURED_OWNER_EMAIL);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let targetInst = db.institutions[0];
    if (!targetInst) {
      ensureSpecializedStudyStructure(db);
      targetInst = db.institutions[0];
    }
    if (isAuthAdmin) {
      if (env === "prod" && verifiedClaims.platformAdmin !== true) {
        try {
          const trustedAuth = getFirebaseAdminAuth();
          const account = await trustedAuth.getUser(verifiedUid);
          if (!account.emailVerified || account.disabled || account.email?.toLowerCase() !== verifiedEmail) return res.status(403).json({ error: "Hisob tasdiqlanmagan." });
          await trustedAuth.setCustomUserClaims(account.uid, { ...account.customClaims, platformAdmin: true });
          verifiedClaims = { ...account.customClaims, platformAdmin: true };
        } catch {
          return res.status(503).json({ error: "Administrator ruxsatini tasdiqlab bo\u2018lmadi. Keyinroq qayta urinib ko\u2018ring." });
        }
      }
      if (!db.customClaims) db.customClaims = {};
      const explicitClaimFalse = verifiedClaims.platformAdmin !== true || requireExistingClaimOnly === true || requireAdminClaim === true;
      let adminUser = db.users.find((u) => u.uid === verifiedUid) || db.users.find((u) => u.email.trim().toLowerCase() === verifiedEmail);
      if (explicitClaimFalse && verifiedClaims.platformAdmin !== true) {
        if (!adminUser) {
          adminUser = {
            uid: verifiedUid,
            displayName: verifiedDisplayName || (verifiedEmail === PLATFORM_OWNER_EMAIL ? "Asilbek Nuraliyev" : "Bahodir Boliqulov"),
            email: verifiedEmail,
            emailVerified: true,
            platformOwner: false,
            platformAdmin: false,
            role: "student",
            institutionId: targetInst.id,
            status: "pending_activation",
            lastLoginAt: nowIso,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          db.users.push(adminUser);
        }
        saveDbState(env, db);
        const token3 = issueSessionToken(adminUser.uid, env);
        return res.status(202).json({
          status: "pending_admin_claim",
          activationStatus: "pending_admin_claim",
          user: {
            ...adminUser,
            platformOwner: false,
            platformAdmin: false
          },
          token: token3,
          claimProvisioned: false,
          message: "Hisob tasdiqlandi. PlatformAdmin ruxsati faollashtirilishi kutilmoqda."
        });
      }
      const duplicateIndices = [];
      db.users.forEach((u, idx) => {
        if (u.email.trim().toLowerCase() === verifiedEmail && u.uid !== verifiedUid) {
          duplicateIndices.push(idx);
        }
      });
      if (!adminUser) {
        adminUser = {
          uid: verifiedUid,
          displayName: verifiedDisplayName || (verifiedEmail === PLATFORM_OWNER_EMAIL ? "Asilbek Nuraliyev" : "Bahodir Boliqulov"),
          email: verifiedEmail,
          emailVerified: true,
          platformOwner: true,
          platformAdmin: true,
          role: "platform_owner",
          institutionId: targetInst.id,
          status: "active",
          lastLoginAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        db.users.push(adminUser);
      } else {
        if (adminUser.status === "suspended" || adminUser.status === "archived") {
          return res.status(403).json({ error: "Hisob vaqtincha to\u2018xtatilgan." });
        }
        const previousUid = adminUser.uid;
        if (previousUid !== verifiedUid) {
          if (db.passwordHashes[previousUid]) {
            db.passwordHashes[verifiedUid] = db.passwordHashes[previousUid];
          }
          if (db.customClaims[previousUid]) {
            db.customClaims[verifiedUid] = {
              ...db.customClaims[previousUid],
              ...db.customClaims[verifiedUid] || {}
            };
          }
        }
        adminUser.uid = verifiedUid;
        if (verifiedDisplayName) adminUser.displayName = verifiedDisplayName;
        adminUser.email = verifiedEmail;
        adminUser.emailVerified = true;
        adminUser.platformOwner = true;
        adminUser.platformAdmin = true;
        adminUser.role = "platform_owner";
        adminUser.status = "active";
        adminUser.lastLoginAt = nowIso;
        adminUser.updatedAt = nowIso;
        if (duplicateIndices.length > 0) {
          db.users = db.users.filter(
            (u) => u.email.trim().toLowerCase() !== verifiedEmail || u === adminUser
          );
        }
      }
      db.customClaims[adminUser.uid] = {
        ...db.customClaims[adminUser.uid] || {},
        ...verifiedClaims,
        platformAdmin: true
      };
      const provisionStatus = await provisionSingleAdminAccount(verifiedEmail, env, db);
      const token2 = issueSessionToken(adminUser.uid, env);
      return res.json({
        status: "active",
        activationStatus: "active",
        user: adminUser,
        token: token2,
        claimProvisioned: provisionStatus.platformAdminClaimAssigned,
        claimsRefreshRequired: true,
        customClaims: provisionStatus.preservedCustomClaims
      });
    }
    let existingStudent = db.users.find((u) => u.uid === verifiedUid) || db.users.find((u) => u.email.trim().toLowerCase() === verifiedEmail);
    if (existingStudent) {
      if (existingStudent.status === "suspended" || existingStudent.status === "archived") {
        return res.status(403).json({ error: "Sizning hisobingiz vaqtincha to\u2018xtatilgan." });
      }
      existingStudent.email = verifiedEmail;
      existingStudent.emailVerified = true;
      existingStudent.role = "student";
      existingStudent.platformOwner = false;
      existingStudent.platformAdmin = false;
      if (verifiedDisplayName && (!existingStudent.displayName || existingStudent.displayName.includes("@"))) {
        existingStudent.displayName = verifiedDisplayName;
      }
      if (existingStudent.status === "invited" || existingStudent.status === "pending_activation") {
        existingStudent.status = "active";
      }
      existingStudent.lastLoginAt = nowIso;
      existingStudent.updatedAt = nowIso;
      db.users = db.users.filter(
        (u) => u.email.trim().toLowerCase() !== verifiedEmail || u === existingStudent
      );
      appendAuditLog(
        db,
        existingStudent.institutionId || targetInst.id,
        existingStudent,
        "O\u2018quvchi Google orqali tizimga kirdi",
        existingStudent.email,
        existingStudent.uid,
        { eventType: "STUDENT_GOOGLE_LOGIN", outcome: "success", requestId: reqId, ipHash, severity: "INFO" }
      );
      saveDbState(env, db);
      const token2 = issueSessionToken(existingStudent.uid, env);
      return res.json({
        status: "active",
        user: existingStudent,
        token: token2,
        claimProvisioned: false
      });
    }
    let resolvedClass;
    if (inviteToken && String(inviteToken).trim()) {
      const rawTok = String(inviteToken).trim().toUpperCase();
      const tokenHash = computeSimpleHash(rawTok);
      const invitation = db.invitations.find((inv) => inv.tokenHash === tokenHash);
      if (invitation) {
        const validation = validateInvitationToken(rawTok, invitation, nowIso);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error || "Taklif kodi yaroqsiz." });
        }
        invitation.status = "accepted";
        invitation.acceptedAt = nowIso;
        invitation.acceptedByUid = verifiedUid;
        resolvedClass = db.classes.find(
          (c) => c.id === invitation.classId || invitation.classCode && c.code.toLowerCase() === invitation.classCode.toLowerCase()
        );
      } else {
        resolvedClass = db.classes.find(
          (c) => c.inviteCode.toUpperCase() === rawTok && c.status !== "archived"
        );
        if (!resolvedClass) {
          return res.status(400).json({ error: "Taklif kodi topilmadi yoki muddati tugagan." });
        }
      }
    }
    const newStudent = {
      uid: verifiedUid,
      displayName: verifiedDisplayName || verifiedEmail.split("@")[0] || "O\u2018quvchi",
      email: verifiedEmail,
      emailVerified: true,
      role: "student",
      platformOwner: false,
      platformAdmin: false,
      institutionId: resolvedClass?.institutionId || targetInst.id,
      classId: resolvedClass?.id,
      classCode: resolvedClass?.code,
      grade: resolvedClass?.grade,
      track: resolvedClass?.track,
      studentCode: `STD-${Math.floor(1e3 + Math.random() * 9e3)}`,
      status: "active",
      enrolledAt: nowIso,
      lastLoginAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.users.push(newStudent);
    ensureSpecializedStudyStructure(db);
    appendAuditLog(
      db,
      newStudent.institutionId,
      newStudent,
      "Yangi o\u2018quvchi Google orqali ro\u2018yxatdan o\u2018tdi",
      newStudent.email,
      newStudent.uid,
      { eventType: "STUDENT_GOOGLE_REGISTERED", outcome: "success", requestId: reqId, ipHash, severity: "INFO" }
    );
    saveDbState(env, db);
    const token = issueSessionToken(newStudent.uid, env);
    return res.json({
      user: newStudent,
      token,
      claimProvisioned: false
    });
  });
  app.post("/api/admin/provision-claims", async (req, res) => {
    const env = resolveRequestEnv(req);
    const db = getDbState(env);
    const authCtx = authenticateRequest(req);
    const isInternalTestProvision = env === "test" && req.headers["x-internal-admin-provision"] === "trusted-server-procedure";
    if (!isInternalTestProvision) {
      if (!authCtx || !isVerifiedPlatformOwner(authCtx.user, CONFIGURED_OWNER_EMAIL)) {
        return res.status(403).json({
          error: "Kirish taqiqlangan (403 Forbidden): Faqat tasdiqlangan platforma egasi ushbu amalni bajara oladi."
        });
      }
    }
    const result = await provisionAuthorizedAdmins(env, db);
    return res.json(result);
  });
  app.get("/api/invitations/preview/:token", (req, res) => {
    const env = resolveRequestEnv(req);
    const db = getDbState(env);
    const rawToken = String(req.params.token || "").trim().toUpperCase();
    const tokenHash = computeSimpleHash(rawToken);
    const invitation = db.invitations.find((inv) => inv.tokenHash === tokenHash);
    if (invitation) {
      const check = validateInvitationToken(rawToken, invitation);
      if (!check.valid) {
        return res.status(400).json({ error: check.error });
      }
      return res.json({
        type: "invitation",
        institutionName: invitation.institutionName,
        inviteeName: invitation.inviteeName,
        email: invitation.email,
        role: invitation.role,
        className: invitation.className,
        subject: invitation.subject
      });
    }
    const cls = db.classes.find(
      (c) => c.inviteCode.toUpperCase() === rawToken && c.status !== "archived"
    );
    if (cls) {
      const inst = db.institutions.find((i) => i.id === cls.institutionId);
      return res.json({
        type: "class_code",
        institutionName: inst?.name || "Maktab",
        role: "student",
        className: cls.name,
        subject: cls.subject
      });
    }
    return res.status(404).json({ error: "Taklif kodi topilmadi yoki muddati tugagan." });
  });
  app.post("/api/auth/register-with-invite", (req, res) => {
    const env = resolveRequestEnv(req);
    const db = getDbState(env);
    const { displayName, email, password, inviteToken } = req.body;
    if (!displayName || String(displayName).trim().length < 3) {
      return res.status(400).json({ error: "Ism va familiya kamida 3 ta belgidan iborat bo\u2018lishi kerak." });
    }
    if (!email || !String(email).includes("@")) {
      return res.status(400).json({ error: "To\u2018g\u2018ri elektron pochta manzilini kiriting." });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: "Parol kamida 6 ta belgidan iborat bo\u2018lishi shart." });
    }
    if (!inviteToken || !String(inviteToken).trim()) {
      return res.status(400).json({ error: "Taklif kodini kiritish majburiy." });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      return res.status(400).json({ error: "Ushbu elektron pochta manzili allaqachon ro\u2018yxatdan o\u2018tgan." });
    }
    const rawToken = String(inviteToken).trim().toUpperCase();
    const tokenHash = computeSimpleHash(rawToken);
    const invitation = db.invitations.find((inv) => inv.tokenHash === tokenHash);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const newUid = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    if (invitation) {
      const validation = validateInvitationToken(rawToken, invitation, nowIso);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      const assignedClassIds = invitation.role === "teacher" && invitation.classId ? [invitation.classId] : [];
      const matchedCls = invitation.classId ? db.classes.find(
        (c) => c.id === invitation.classId || c.code.toLowerCase() === String(invitation.classId).toLowerCase()
      ) : void 0;
      const newUser = {
        uid: newUid,
        displayName: String(displayName).trim(),
        email: normalizedEmail,
        role: invitation.role,
        institutionId: invitation.institutionId,
        classId: invitation.role === "student" ? matchedCls?.id || invitation.classId : void 0,
        classCode: invitation.role === "student" ? matchedCls?.code || invitation.classCode : void 0,
        grade: invitation.role === "student" ? matchedCls?.grade || invitation.grade : void 0,
        track: invitation.role === "student" ? matchedCls?.track || invitation.track : void 0,
        assignedClassIds,
        subject: invitation.subject || (invitation.role === "teacher" ? "Matematika" : void 0),
        linkedChildIds: invitation.role === "parent" && invitation.linkedStudentId ? [invitation.linkedStudentId] : [],
        studentCode: invitation.role === "student" ? `STD-${Math.floor(1e3 + Math.random() * 9e3)}` : void 0,
        status: "active",
        enrolledAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      invitation.status = "accepted";
      invitation.acceptedAt = nowIso;
      invitation.acceptedByUid = newUid;
      db.users.push(newUser);
      db.passwordHashes[newUid] = hashPassword(String(password));
      if (invitation.role === "student" && newUser.classId) {
        const cls2 = db.classes.find((c) => c.id === newUser.classId);
        if (cls2) {
          cls2.studentCount += 1;
        }
        db.classMemberships.push({
          id: `cm-${Date.now()}`,
          institutionId: invitation.institutionId,
          classId: newUser.classId,
          userId: newUid,
          memberRole: "student",
          createdAt: nowIso
        });
        db.studentEnrollments.push({
          id: `enr-${Date.now()}`,
          institutionId: invitation.institutionId,
          studentId: newUid,
          classId: newUser.classId,
          classCode: newUser.classCode,
          grade: newUser.grade,
          track: newUser.track,
          status: "active",
          enrolledAt: nowIso
        });
      }
      if (invitation.role === "teacher" && invitation.classId) {
        const cls2 = db.classes.find((c) => c.id === invitation.classId);
        if (cls2) {
          cls2.teacherId = newUid;
          cls2.teacherName = newUser.displayName;
        }
        db.teacherAssignments.push({
          id: `ta-${Date.now()}`,
          institutionId: invitation.institutionId,
          teacherId: newUid,
          classId: invitation.classId,
          subject: newUser.subject || "Matematika",
          createdAt: nowIso
        });
      }
      if (invitation.role === "parent" && invitation.linkedStudentId) {
        db.parentLinks.push({
          id: `pl-${Date.now()}`,
          institutionId: invitation.institutionId,
          parentId: newUid,
          studentId: invitation.linkedStudentId,
          verifiedBy: "invitation",
          createdAt: nowIso
        });
      }
      pushNotification(
        db,
        invitation.institutionId,
        invitation.createdByUid,
        "Taklifnoma qabul qilindi",
        `${newUser.displayName} (${newUser.role}) taklifnomani qabul qilib tizimga qo'shildi.`
      );
      appendAuditLog(
        db,
        invitation.institutionId,
        newUser,
        `Taklifnoma orqali yangi ${newUser.role} hisobi faollashtirildi`,
        newUser.displayName,
        newUid
      );
      ensureSpecializedStudyStructure(db);
      saveDbState(env, db);
      broadcastInstitutionUpdate(env, invitation.institutionId, "USER_JOINED");
      const token = issueSessionToken(newUid, env);
      return res.json({ user: newUser, token });
    }
    const cls = db.classes.find(
      (c) => c.inviteCode.toUpperCase() === rawToken && c.status !== "archived"
    );
    if (cls) {
      const newUser = {
        uid: newUid,
        displayName: String(displayName).trim(),
        email: normalizedEmail,
        role: "student",
        institutionId: cls.institutionId,
        classId: cls.id,
        classCode: cls.code,
        grade: cls.grade,
        track: cls.track,
        studentCode: `STD-${Math.floor(1e3 + Math.random() * 9e3)}`,
        status: "active",
        enrolledAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      cls.studentCount += 1;
      db.users.push(newUser);
      db.passwordHashes[newUid] = hashPassword(String(password));
      db.studentEnrollments.push({
        id: `enr-${Date.now()}`,
        institutionId: cls.institutionId,
        studentId: newUid,
        classId: cls.id,
        classCode: cls.code,
        grade: cls.grade,
        track: cls.track,
        status: "active",
        enrolledAt: nowIso
      });
      if (cls.teacherId) {
        pushNotification(
          db,
          cls.institutionId,
          cls.teacherId,
          "Yangi o'quvchi sinfga qo'shildi",
          `${newUser.displayName} ${cls.name} sinfiga ulandi.`
        );
      }
      appendAuditLog(
        db,
        cls.institutionId,
        newUser,
        `O'quvchi sinf kodi orqali ro'yxatdan o'tdi (${cls.name})`,
        newUser.displayName,
        newUid
      );
      ensureSpecializedStudyStructure(db);
      saveDbState(env, db);
      broadcastInstitutionUpdate(env, cls.institutionId, "STUDENT_ENROLLED");
      const token = issueSessionToken(newUid, env);
      return res.json({ user: newUser, token });
    }
    const matchedStudent = db.users.find(
      (u) => u.role === "student" && u.studentCode?.toUpperCase() === rawToken
    );
    if (matchedStudent) {
      const newUser = {
        uid: newUid,
        displayName: String(displayName).trim(),
        email: normalizedEmail,
        role: "parent",
        institutionId: matchedStudent.institutionId,
        linkedChildIds: [matchedStudent.uid],
        status: "active",
        createdAt: nowIso,
        updatedAt: nowIso
      };
      db.users.push(newUser);
      db.passwordHashes[newUid] = hashPassword(String(password));
      db.parentLinks.push({
        id: `pl-${Date.now()}`,
        institutionId: matchedStudent.institutionId,
        parentId: newUid,
        studentId: matchedStudent.uid,
        verifiedBy: "student_code",
        createdAt: nowIso
      });
      appendAuditLog(
        db,
        matchedStudent.institutionId,
        newUser,
        `Ota-ona hisobi farzand kodi orqali ulandi`,
        matchedStudent.displayName,
        newUid
      );
      saveDbState(env, db);
      broadcastInstitutionUpdate(env, matchedStudent.institutionId, "PARENT_LINKED");
      const token = issueSessionToken(newUid, env);
      return res.json({ user: newUser, token });
    }
    return res.status(400).json({
      error: "Taklif kodi topilmadi yoki muddati tugagan. Administrator yoki o'qituvchidan yangi taklif kodi oling."
    });
  });
  app.get("/api/events", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) {
      return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    }
    if (process.env.VERCEL) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-store");
      return res.end(`data: ${JSON.stringify({ type: "CONNECTED", transport: "poll" })}

`);
    }
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    const clientId = `sse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const client = {
      id: clientId,
      uid: authCtx.user.uid,
      institutionId: authCtx.user.institutionId,
      env: authCtx.env,
      res
    };
    sseClients.push(client);
    res.write(`data: ${JSON.stringify({ type: "CONNECTED", timestamp: (/* @__PURE__ */ new Date()).toISOString() })}

`);
    req.on("close", () => {
      const idx = sseClients.findIndex((c) => c.id === clientId);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });
  app.get("/api/state", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) {
      return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    }
    const { user, db } = authCtx;
    ensureSpecializedStudyStructure(db);
    const instId = user.institutionId;
    const institution = db.institutions.find((i) => i.id === instId) || db.institutions[0] || {
      id: instId,
      name: "Specialized Study Ixtisoslashtirilgan Maktabi",
      region: "Toshkent shahri",
      district: "Mirzo Ulug\u2018bek tumani",
      academicYear: "2026-2027",
      adminUid: user.uid,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const instTopics = db.topics.filter(
      (t) => !t.institutionId || t.institutionId === "global" || t.institutionId === instId
    );
    const instSubjects = db.subjects.filter(
      (s) => s.institutionId === "global" || s.institutionId === instId
    );
    const myNotifications = db.notifications.filter(
      (n) => n.institutionId === instId && n.recipientUid === user.uid
    );
    const isOwner = isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL);
    if (isOwner) {
      return res.json({
        user,
        institution,
        institutions: db.institutions,
        academicYears: db.academicYears || [],
        subjects: db.subjects,
        topics: db.topics,
        workPlans: db.workPlans || [],
        lessons: db.lessons || [],
        users: db.users,
        classes: db.classes,
        invitations: db.invitations.map(({ tokenHash, ...rest }) => ({
          ...rest,
          tokenHash: "***"
        })),
        questions: db.questions,
        questionRevisions: db.questionRevisions || [],
        questionMedia: db.questionMedia || [],
        assessments: db.assessments,
        assignments: db.assignments,
        attempts: db.attempts,
        gradingRecords: db.gradingRecords || [],
        importBatches: db.importBatches || [],
        studentImportJobs: db.studentImportJobs || [],
        curriculumImportJobs: db.curriculumImportJobs || [],
        masteryRecords: db.masteryRecords,
        learningPaths: db.learningPaths,
        teacherNotes: db.teacherNotes,
        notifications: db.notifications.filter(
          (n) => n.recipientUid === user.uid || n.institutionId === instId
        ),
        auditLogs: db.auditLogs,
        studentGamificationProfiles: db.studentGamificationProfiles || [],
        learningCheckins: db.learningCheckins || [],
        studentGoals: db.studentGoals || [],
        learningActivityEvents: db.learningActivityEvents || [],
        xpLedger: db.xpLedger || [],
        gamificationBadges: db.gamificationBadges || DEFAULT_GAMIFICATION_BADGES,
        studentBadges: db.studentBadges || [],
        streakRecords: db.streakRecords || [],
        weeklyRecaps: db.weeklyRecaps || [],
        classChallenges: db.classChallenges || [],
        studentLessonCompletions: db.studentLessonCompletions || [],
        attendanceSessions: db.attendanceSessions || [],
        attendanceRecords: db.attendanceRecords || [],
        studentAssignments: db.studentAssignments || [],
        assignmentSubmissions: db.assignmentSubmissions || [],
        studentAlerts: db.studentAlerts || [],
        studentSupportPlans: db.studentSupportPlans || [],
        academicReports: db.academicReports || [],
        timetables: db.timetables || [],
        timetableEntries: db.timetableEntries || [],
        submissionRevisions: db.submissionRevisions || [],
        announcements: db.announcements || [],
        announcementReads: db.announcementReads || [],
        announcementAcknowledgements: db.announcementAcknowledgements || [],
        learningMaterials: db.learningMaterials || [],
        gradingRubrics: db.gradingRubrics || DEFAULT_GRADING_RUBRICS,
        feedbackComments: db.feedbackComments || DEFAULT_FEEDBACK_COMMENTS,
        gradingHistory: db.gradingHistory || [],
        academicEvents: db.academicEvents || [],
        lessonDeliveryRecords: db.lessonDeliveryRecords || []
      });
    }
    if (user.role === "teacher") {
      const scoped = teacherClasses(user, db);
      const ids = new Set(scoped.map((c) => c.id));
      return res.json({ user, institution, classes: scoped, users: db.users.filter((u) => u.institutionId === instId && (u.uid === user.uid || u.role === "student" && ids.has(u.classId || ""))).map(({ uid, displayName, role, classId, classCode, status }) => ({ uid, displayName, role, classId, classCode, status })), lessons: db.lessons.filter((l) => l.institutionId === instId && [l.classId, ...l.classIds || []].some((id) => ids.has(id)) && l.subjectName === user.subject).map((l) => ({ ...l, schoolDeliveredAt: [l.classId, ...l.classIds || []].filter((id) => ids.has(id)).every((id) => deliveredForClass(l, id)) ? l.schoolDeliveredAt || l.updatedAt : void 0 })), subjects: [], topics: [], workPlans: [], assessments: [], attempts: [], notifications: [] });
    }
    if (user.role === "student") {
      const myClass = db.classes.find(
        (c) => c.id === user.classId || user.classCode && c.code.toLowerCase() === user.classCode.toLowerCase()
      );
      if (myClass) {
        user.classId = myClass.id;
        user.classCode = myClass.code;
        user.grade = myClass.grade;
        user.track = myClass.track;
      }
      const myLessons = myClass ? (db.lessons || []).filter(
        (l) => lessonMatchesClass(l, myClass.code) && (!l.additionalCurriculumAssignment || l.tTrackVisibilityApproved === true) && (l.status === "published" || l.status === "in_progress" || l.status === "completed")
      ) : [];
      const hasApprovedTTrackMath = myClass?.track === "T" && (db.workPlans || []).some(
        (wp) => workPlanMatchesClass(wp, myClass.code) && wp.additionalCurriculumAssignment && wp.tTrackVisibilityApproved === true
      );
      const mySubjects = myClass ? db.subjects.filter(
        (s) => isSubjectCompatibleWithClass(s.name, myClass, db.subjects).compatible || hasApprovedTTrackMath && s.name.toLowerCase() === "matematika"
      ) : instSubjects;
      const myAssessments = db.assessments.filter(
        (a) => a.institutionId === user.institutionId && a.status === "published" && (!a.examKind || canTakeExam(user, a)) && (!a.classId || a.classId === user.classId || myClass && a.classCode?.toLowerCase() === myClass.code.toLowerCase() || myClass && a.assignedClassIds?.includes(myClass.id) || myClass && a.assignedClassCodes?.some((c) => c.toLowerCase() === myClass.code.toLowerCase())) && (!a.eligibleStudentIds || a.eligibleStudentIds.length === 0 || a.eligibleStudentIds.includes(user.uid))
      );
      const myAssignments = db.assignments.filter(
        (a) => a.status === "published" && (a.classId === user.classId || myClass && a.classCode?.toLowerCase() === myClass.code.toLowerCase())
      );
      const sanitizeQuestionForStudent = (q) => sanitizeExamQuestion({
        ...q,
        correctAnswer: "",
        correctAnswers: void 0,
        acceptedAnswers: void 0,
        rubricText: void 0,
        explanation: "",
        structuredOptions: q.structuredOptions?.map((opt) => ({
          ...opt,
          isCorrect: false
        }))
      });
      const neededQuestionIds = new Set(myAssessments.flatMap((a) => a.questionIds));
      const sanitizedQuestions = db.questions.filter((q) => neededQuestionIds.has(q.id)).map(sanitizeQuestionForStudent);
      const sanitizedAssessments = myAssessments.map((a) => ({
        ...a,
        questionSnapshot: a.questionSnapshot?.map(sanitizeQuestionForStudent)
      }));
      const myWorkPlans = myClass ? (db.workPlans || []).filter(
        (wp) => workPlanMatchesClass(wp, myClass.code) && (!wp.additionalCurriculumAssignment || wp.tTrackVisibilityApproved === true)
      ) : [];
      if (!Array.isArray(db.studentGamificationProfiles)) db.studentGamificationProfiles = [];
      if (!Array.isArray(db.streakRecords)) db.streakRecords = [];
      if (!Array.isArray(db.weeklyRecaps)) db.weeklyRecaps = [];
      let myGamificationProfile = db.studentGamificationProfiles.find(
        (p) => p.studentId === user.uid
      );
      if (!myGamificationProfile) {
        myGamificationProfile = createInitialGamificationProfile(user.uid);
        db.studentGamificationProfiles.push(myGamificationProfile);
      }
      const gConfig = db.gamificationConfig || DEFAULT_GAMIFICATION_CONFIG;
      let myStreak = db.streakRecords.find((s) => s.studentId === user.uid);
      if (!myStreak) {
        myStreak = createInitialStreakRecord(user.uid, gConfig.streakGraceDays);
        db.streakRecords.push(myStreak);
      }
      const myCompletions = (db.studentLessonCompletions || []).filter(
        (c) => c.studentId === user.uid
      );
      const myEvents = (db.learningActivityEvents || []).filter(
        (e) => e.studentId === user.uid
      );
      const myStudentBadges = (db.studentBadges || []).filter(
        (b) => b.studentId === user.uid
      );
      const myWeeklyRecap = buildWeeklyLearningRecap({
        studentId: user.uid,
        events: myEvents,
        studentBadges: myStudentBadges,
        lessons: myLessons.map((l) => ({ ...l, schoolDeliveredAt: deliveredForClass(l, myClass?.id || "") ? l.schoolDeliveredAt || l.updatedAt : void 0 })),
        classCode: myClass?.code || user.classCode || "7a1",
        completions: myCompletions
      });
      const existingRecapIdx = db.weeklyRecaps.findIndex((r) => r.id === myWeeklyRecap.id);
      if (existingRecapIdx >= 0) {
        db.weeklyRecaps[existingRecapIdx] = myWeeklyRecap;
      } else {
        db.weeklyRecaps.push(myWeeklyRecap);
      }
      return res.json({
        user,
        institution,
        institutions: [institution],
        academicYears: db.academicYears || [],
        subjects: mySubjects,
        topics: instTopics,
        workPlans: myWorkPlans,
        lessons: myLessons.map((l) => ({ ...l, schoolDeliveredAt: deliveredForClass(l, myClass?.id || "") ? l.schoolDeliveredAt || l.updatedAt : void 0 })),
        users: [user],
        classes: myClass ? [myClass] : [],
        invitations: [],
        questions: sanitizedQuestions,
        questionRevisions: [],
        questionMedia: (db.questionMedia || []).filter((m) => m.institutionId === instId),
        assessments: sanitizedAssessments,
        assignments: myAssignments,
        attempts: db.attempts.filter((a) => a.studentId === user.uid),
        gradingRecords: (db.gradingRecords || []).filter(
          (g) => db.attempts.some((att) => att.id === g.attemptId && att.studentId === user.uid)
        ),
        importBatches: [],
        masteryRecords: db.masteryRecords.filter((m) => m.studentId === user.uid),
        learningPaths: db.learningPaths.filter((lp) => lp.studentId === user.uid),
        teacherNotes: db.teacherNotes.filter((n) => n.studentId === user.uid),
        notifications: myNotifications,
        auditLogs: [],
        studentGamificationProfiles: [myGamificationProfile],
        learningCheckins: (db.learningCheckins || []).filter((c) => c.studentId === user.uid),
        studentGoals: (db.studentGoals || []).filter((g) => g.studentId === user.uid),
        learningActivityEvents: myEvents,
        xpLedger: (db.xpLedger || []).filter((l) => l.studentId === user.uid),
        gamificationBadges: db.gamificationBadges || DEFAULT_GAMIFICATION_BADGES,
        studentBadges: myStudentBadges,
        streakRecords: [myStreak],
        weeklyRecaps: [myWeeklyRecap],
        classChallenges: (db.classChallenges || []).filter(
          (ch) => !myClass || ch.classCode.toLowerCase() === myClass.code.toLowerCase()
        ),
        studentLessonCompletions: myCompletions,
        attendanceSessions: (db.attendanceSessions || []).filter(
          (s) => !myClass || s.classCode.toLowerCase() === myClass.code.toLowerCase()
        ),
        attendanceRecords: (db.attendanceRecords || []).filter((r) => r.studentId === user.uid),
        studentAssignments: (db.studentAssignments || []).filter(
          (a) => a.status !== "draft" && (!myClass || a.targetClassCodes.length === 0 || a.targetClassCodes.some((tc) => tc.toLowerCase() === myClass.code.toLowerCase()))
        ),
        assignmentSubmissions: (db.assignmentSubmissions || []).filter((s) => s.studentId === user.uid),
        studentAlerts: [],
        // Strictly confidential
        studentSupportPlans: [],
        // Strictly confidential
        academicReports: [],
        // Strictly confidential
        timetables: (db.timetables || []).filter(
          (t) => myClass && t.classCode.toLowerCase() === myClass.code.toLowerCase() && t.status === "active"
        ),
        timetableEntries: (db.timetableEntries || []).filter(
          (e) => myClass && e.classCode.toLowerCase() === myClass.code.toLowerCase()
        ),
        submissionRevisions: (db.submissionRevisions || []).filter((r) => r.studentId === user.uid),
        announcements: (db.announcements || []).filter(
          (ann) => myClass ? isAnnouncementRelevantToStudent(ann, myClass.code, getTashkentDateString()) : ann.audienceType === "entire_school"
        ),
        announcementReads: (db.announcementReads || []).filter((r) => r.studentId === user.uid),
        announcementAcknowledgements: (db.announcementAcknowledgements || []).filter((a) => a.studentId === user.uid),
        learningMaterials: myClass ? filterAuthorizedMaterialsForStudent(db.learningMaterials || [], myClass.code, myClass.grade) : [],
        gradingRubrics: db.gradingRubrics || DEFAULT_GRADING_RUBRICS,
        feedbackComments: [],
        gradingHistory: (db.gradingHistory || []).filter((h) => h.studentId === user.uid),
        academicEvents: (db.academicEvents || []).filter(
          (ev) => !ev.classCode || myClass && ev.classCode.toLowerCase() === myClass.code.toLowerCase() || myClass && ev.targetClassCodes?.some((c) => c.toLowerCase() === myClass.code.toLowerCase())
        ),
        lessonDeliveryRecords: (db.lessonDeliveryRecords || []).filter(
          (r) => myClass && r.classCode.toLowerCase() === myClass.code.toLowerCase()
        )
      });
    }
    const linkedIds = new Set(user.linkedChildIds || []);
    const linkedChildren = db.users.filter(
      (u) => u.institutionId === instId && u.role === "student" && linkedIds.has(u.uid)
    );
    const childClassIds = new Set(linkedChildren.map((c) => c.classId).filter(Boolean));
    return res.json({
      user,
      institution,
      subjects: instSubjects,
      topics: instTopics,
      users: [user, ...linkedChildren],
      classes: db.classes.filter((c) => c.institutionId === instId && childClassIds.has(c.id)),
      invitations: [],
      questions: [],
      assessments: [],
      assignments: [],
      attempts: db.attempts.filter(
        (a) => a.institutionId === instId && linkedIds.has(a.studentId)
      ),
      masteryRecords: db.masteryRecords.filter(
        (m) => m.institutionId === instId && linkedIds.has(m.studentId)
      ),
      learningPaths: db.learningPaths.filter((lp) => linkedIds.has(lp.studentId)),
      teacherNotes: db.teacherNotes.filter(
        (n) => n.institutionId === instId && linkedIds.has(n.studentId)
      ),
      notifications: myNotifications,
      auditLogs: []
    });
  });
  app.get("/api/security/students/:studentId", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Unauthorized" });
    const { user, db } = authCtx;
    if (user.role === "student" && user.uid !== req.params.studentId) {
      return res.status(403).json({
        error: "Ruxsat rad etildi: Siz boshqa o'quvchining shaxsiy ma'lumotlariga kirish huquqiga ega emassiz."
      });
    }
    const targetStudent = db.users.find((u) => u.uid === req.params.studentId);
    if (!targetStudent) return res.status(404).json({ error: "Student not found" });
    const teacherClassIds = db.classes.filter((c) => c.institutionId === user.institutionId && c.teacherId === user.uid).map((c) => c.id);
    if (!canAccessStudentRecord(user, targetStudent, teacherClassIds)) {
      return res.status(403).json({
        error: "Ruxsat rad etildi: Siz ushbu o'quvchining shaxsiy ma'lumotlariga kirish huquqiga ega emassiz."
      });
    }
    return res.json({
      student: targetStudent,
      attempts: db.attempts.filter((a) => a.studentId === targetStudent.uid),
      masteryRecords: db.masteryRecords.filter((m) => m.studentId === targetStudent.uid)
    });
  });
  app.get("/api/security/classes/:classId", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Unauthorized" });
    const { user, db } = authCtx;
    if (user.role === "student" && user.classId !== req.params.classId) {
      return res.status(403).json({
        error: "Ruxsat rad etildi: Ushbu sinf sizga biriktirilmagan."
      });
    }
    const targetClass = db.classes.find((c) => c.id === req.params.classId);
    if (!targetClass) return res.status(404).json({ error: "Class not found" });
    if (!canAccessClass(user, targetClass)) {
      return res.status(403).json({
        error: "Ruxsat rad etildi: Ushbu sinf sizga biriktirilmagan."
      });
    }
    return res.json({ classRoom: targetClass });
  });
  app.get("/api/security/institutions/:institutionId", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Unauthorized" });
    const { user, db } = authCtx;
    if (!canAccessInstitution(user, req.params.institutionId)) {
      return res.status(403).json({
        error: "Ruxsat rad etildi: Boshqa ta'lim muassasasi ma'lumotlariga kirish taqiqlangan."
      });
    }
    const inst = db.institutions.find((i) => i.id === req.params.institutionId);
    if (!inst) return res.status(404).json({ error: "Institution not found" });
    return res.json({ institution: inst });
  });
  function requirePlatformOwner(req, res) {
    const authCtx = authenticateRequest(req);
    if (!authCtx) {
      res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
      return null;
    }
    if (!isVerifiedPlatformOwner(authCtx.user, CONFIGURED_OWNER_EMAIL)) {
      const reqId = getRequestId(req);
      const ipHash = getClientIpHash(req);
      const denyKey = `${authCtx.env}:${authCtx.user.uid}`;
      const count = (deniedAdminCounter.get(denyKey) || 0) + 1;
      deniedAdminCounter.set(denyKey, count);
      appendAuditLog(
        authCtx.db,
        authCtx.user.institutionId,
        authCtx.user,
        `Ruxsatsiz Admin API so\u2018rovi rad etildi: ${req.method} ${req.path}`,
        req.path,
        authCtx.user.uid,
        {
          eventType: count >= 3 ? "SECURITY_ALERT_REPEATED_ADMIN_DENIAL" : "ADMIN_ACCESS_DENIED",
          outcome: "denied",
          requestId: reqId,
          ipHash,
          severity: count >= 3 ? "CRITICAL" : "WARNING"
        }
      );
      saveDbState(authCtx.env, authCtx.db);
      res.status(403).json({
        error: `Kirish taqiqlangan (403 Forbidden): Faqat tasdiqlangan Platforma Egasi (${CONFIGURED_OWNER_EMAIL}) Admin Boshqaruv Markaziga kirish huquqiga ega.`
      });
      return null;
    }
    return authCtx;
  }
  app.get("/api/admin/overview", (req, res) => {
    const ctx = requirePlatformOwner(req, res);
    if (!ctx) return;
    const { db } = ctx;
    const totalInstitutions = db.institutions.length;
    const activeInstitutions = db.institutions.filter((i) => i.status !== "suspended" && i.status !== "archived").length;
    const suspendedInstitutions = db.institutions.filter((i) => i.status === "suspended").length;
    const archivedInstitutions = db.institutions.filter((i) => i.status === "archived").length;
    const totalTeachers = db.users.filter((u) => u.role === "teacher").length;
    const totalStudents = db.users.filter((u) => u.role === "student").length;
    const totalParents = db.users.filter((u) => u.role === "parent").length;
    const totalClasses = db.classes.length;
    const totalAssessments = db.assessments.length;
    const publishedAssessments = db.assessments.filter((a) => a.status === "published").length;
    const totalQuestions = db.questions.length;
    const totalSubmissions = db.attempts.length;
    const pendingInvitations = db.invitations.filter((i) => i.status === "pending").length;
    const aiAnalysesGenerated = db.attempts.filter((a) => Boolean(a.aiAnalysis)).length;
    return res.json({
      metrics: {
        totalInstitutions,
        activeInstitutions,
        suspendedInstitutions,
        archivedInstitutions,
        totalUsers: db.users.length,
        totalTeachers,
        totalStudents,
        totalParents,
        totalClasses,
        totalAssessments,
        publishedAssessments,
        totalQuestions,
        totalSubmissions,
        pendingInvitations,
        aiAnalysesGenerated
      },
      institutions: db.institutions
    });
  });
  app.get("/api/admin/institutions", (req, res) => {
    const ctx = requirePlatformOwner(req, res);
    if (!ctx) return;
    const { db } = ctx;
    const enriched = db.institutions.map((inst) => ({
      ...inst,
      teacherCount: db.users.filter((u) => u.institutionId === inst.id && u.role === "teacher").length,
      studentCount: db.users.filter((u) => u.institutionId === inst.id && u.role === "student").length,
      parentCount: db.users.filter((u) => u.institutionId === inst.id && u.role === "parent").length,
      classCount: db.classes.filter((c) => c.institutionId === inst.id).length,
      assessmentCount: db.assessments.filter((a) => a.institutionId === inst.id).length,
      questionCount: db.questions.filter((q) => q.institutionId === inst.id).length,
      attemptCount: db.attempts.filter((a) => a.institutionId === inst.id).length
    }));
    return res.json({ institutions: enriched });
  });
  app.post("/api/admin/institutions", (req, res) => {
    const ctx = requirePlatformOwner(req, res);
    if (!ctx) return;
    const { user, env, db } = ctx;
    const {
      name,
      shortName,
      type,
      code,
      region,
      district,
      city,
      address,
      phone,
      email,
      website,
      directorName,
      contactPerson,
      contactRole,
      primarySubjectFocus,
      academicYear,
      gradingScale,
      languageOfInstruction,
      timezone,
      logoUrl,
      status,
      allowTeacherStudentInvites,
      allowTeacherAssessments,
      allowExcelImports,
      aiFeaturesEnabled,
      initialClasses
    } = req.body;
    if (!name || String(name).trim().length < 3) {
      return res.status(400).json({ error: "Muassasa to\u2018liq nomini kiriting (kamida 3 ta belgi)." });
    }
    const cleanCode = code ? String(code).trim().toUpperCase() : `INST-${Math.floor(1e3 + Math.random() * 9e3)}`;
    if (db.institutions.some((i) => i.code && i.code.toUpperCase() === cleanCode)) {
      return res.status(400).json({ error: `Ushbu muassasa kodi (${cleanCode}) allaqachon mavjud.` });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const instId = `inst-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const newInst = {
      id: instId,
      name: String(name).trim(),
      shortName: shortName ? String(shortName).trim() : String(name).trim().slice(0, 24),
      type: type || "public_school",
      code: cleanCode,
      region: String(region || "Toshkent shahri").trim(),
      district: String(district || "Markaziy tuman").trim(),
      city: city ? String(city).trim() : void 0,
      address: address ? String(address).trim() : void 0,
      phone: phone ? String(phone).trim() : void 0,
      email: email ? String(email).trim().toLowerCase() : void 0,
      website: website ? String(website).trim() : void 0,
      directorName: directorName ? String(directorName).trim() : void 0,
      contactPerson: contactPerson ? String(contactPerson).trim() : void 0,
      contactRole: contactRole ? String(contactRole).trim() : void 0,
      primarySubjectFocus: primarySubjectFocus ? String(primarySubjectFocus).trim() : "Matematika va STEM",
      academicYear: String(academicYear || "2026-2027").trim(),
      gradingScale: gradingScale || "100_percent",
      languageOfInstruction: String(languageOfInstruction || "O'zbek tili").trim(),
      timezone: String(timezone || "Asia/Tashkent").trim(),
      status: status || "active",
      logoUrl: logoUrl ? String(logoUrl) : void 0,
      adminUid: user.uid,
      allowTeacherStudentInvites: allowTeacherStudentInvites !== false,
      allowTeacherAssessments: allowTeacherAssessments !== false,
      allowExcelImports: allowExcelImports !== false,
      aiFeaturesEnabled: aiFeaturesEnabled !== false,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.institutions.push(newInst);
    if (Array.isArray(initialClasses)) {
      for (const ic of initialClasses) {
        if (ic && ic.name && String(ic.name).trim()) {
          const classId = `class-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const parsedGrade = Number(ic.grade) || 8;
          db.classes.push({
            id: classId,
            code: ic.code || `${parsedGrade}a1`,
            name: String(ic.name).trim(),
            grade: parsedGrade,
            track: ic.track || "A",
            trackLabel: ic.track === "T" ? "Tabiiy fanlar" : "Aniq fanlar",
            section: "1",
            subject: String(ic.subject || "Matematika").trim(),
            subjectIds: [],
            subjectNames: [String(ic.subject || "Matematika").trim()],
            academicYear: newInst.academicYear,
            teacherId: user.uid,
            teacherName: user.displayName,
            institutionId: instId,
            inviteCode: `MAT${parsedGrade}-${Math.floor(1e3 + Math.random() * 9e3)}`,
            studentCount: 0,
            status: "active",
            createdAt: nowIso,
            updatedAt: nowIso
          });
        }
      }
    }
    appendAuditLog(
      db,
      instId,
      user,
      "Yangi ta\u2019lim muassasasi yaratildi",
      `${newInst.name} (${newInst.code})`,
      instId
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, instId, "INSTITUTION_CREATED");
    return res.json({ institution: newInst });
  });
  app.put("/api/admin/institutions/:id", (req, res) => {
    const ctx = requirePlatformOwner(req, res);
    if (!ctx) return;
    const { user, env, db } = ctx;
    const inst = db.institutions.find((i) => i.id === req.params.id);
    if (!inst) return res.status(404).json({ error: "Muassasa topilmadi." });
    const {
      name,
      shortName,
      type,
      code,
      region,
      district,
      city,
      address,
      phone,
      email,
      website,
      directorName,
      contactPerson,
      contactRole,
      primarySubjectFocus,
      academicYear,
      gradingScale,
      languageOfInstruction,
      timezone,
      logoUrl,
      status,
      allowTeacherStudentInvites,
      allowTeacherAssessments,
      allowExcelImports,
      aiFeaturesEnabled
    } = req.body;
    if (code && String(code).trim().toUpperCase() !== inst.code?.toUpperCase()) {
      const candidateCode = String(code).trim().toUpperCase();
      if (db.institutions.some((other) => other.id !== inst.id && other.code?.toUpperCase() === candidateCode)) {
        return res.status(400).json({ error: `Ushbu muassasa kodi (${candidateCode}) boshqa muassasaga biriktirilgan.` });
      }
      inst.code = candidateCode;
    }
    if (name && String(name).trim().length >= 2) inst.name = String(name).trim();
    if (typeof shortName === "string") inst.shortName = shortName.trim();
    if (type) inst.type = type;
    if (region && String(region).trim().length >= 2) inst.region = String(region).trim();
    if (district && String(district).trim().length >= 2) inst.district = String(district).trim();
    if (typeof city === "string") inst.city = city.trim();
    if (typeof address === "string") inst.address = address.trim();
    if (typeof phone === "string") inst.phone = phone.trim();
    if (typeof email === "string") inst.email = email.trim().toLowerCase();
    if (typeof website === "string") inst.website = website.trim();
    if (typeof directorName === "string") inst.directorName = directorName.trim();
    if (typeof contactPerson === "string") inst.contactPerson = contactPerson.trim();
    if (typeof contactRole === "string") inst.contactRole = contactRole.trim();
    if (typeof primarySubjectFocus === "string") inst.primarySubjectFocus = primarySubjectFocus.trim();
    if (academicYear) inst.academicYear = String(academicYear).trim();
    if (gradingScale) inst.gradingScale = gradingScale;
    if (typeof languageOfInstruction === "string") inst.languageOfInstruction = languageOfInstruction.trim();
    if (typeof timezone === "string") inst.timezone = timezone.trim();
    if (typeof logoUrl === "string") inst.logoUrl = logoUrl || void 0;
    if (status && (status === "active" || status === "suspended" || status === "archived" || status === "onboarding")) {
      inst.status = status;
    }
    if (typeof allowTeacherStudentInvites === "boolean") {
      inst.allowTeacherStudentInvites = allowTeacherStudentInvites;
    }
    if (typeof allowTeacherAssessments === "boolean") {
      inst.allowTeacherAssessments = allowTeacherAssessments;
    }
    if (typeof allowExcelImports === "boolean") {
      inst.allowExcelImports = allowExcelImports;
    }
    if (typeof aiFeaturesEnabled === "boolean") {
      inst.aiFeaturesEnabled = aiFeaturesEnabled;
    }
    inst.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    appendAuditLog(
      db,
      inst.id,
      user,
      "Muassasa ma\u2019lumotlari va sozlamalari tahrirlandi",
      `${inst.name} (${inst.id})`,
      inst.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, inst.id, "INSTITUTION_UPDATED");
    return res.json({ institution: inst });
  });
  app.post("/api/admin/institutions/:id/status", (req, res) => {
    const ctx = requirePlatformOwner(req, res);
    if (!ctx) return;
    const { user, env, db } = ctx;
    const inst = db.institutions.find((i) => i.id === req.params.id);
    if (!inst) return res.status(404).json({ error: "Muassasa topilmadi." });
    const { status, reason } = req.body;
    if (!status || !["active", "suspended", "archived", "onboarding"].includes(status)) {
      return res.status(400).json({ error: "Yaroqsiz holat (status)." });
    }
    const previousStatus = inst.status || "active";
    inst.status = status;
    inst.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    appendAuditLog(
      db,
      inst.id,
      user,
      `Muassasa holati o'zgartirildi: ${previousStatus} -> ${status}${reason ? ` (${reason})` : ""}`,
      inst.name,
      inst.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, inst.id, "INSTITUTION_STATUS_CHANGED");
    return res.json({ institution: inst });
  });
  app.post("/api/admin/switch-institution", (req, res) => {
    const ctx = requirePlatformOwner(req, res);
    if (!ctx) return;
    const { user, env, db } = ctx;
    const { institutionId } = req.body;
    const targetInst = db.institutions.find((i) => i.id === institutionId);
    if (!targetInst) {
      return res.status(404).json({ error: "Tanlangan muassasa topilmadi." });
    }
    user.institutionId = targetInst.id;
    user.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveDbState(env, db);
    return res.json({ user, institution: targetInst });
  });
  app.post("/api/admin/academic-years", (req, res) => {
    const ctx = requirePlatformOwner(req, res);
    if (!ctx) return;
    const { user, env, db } = ctx;
    const { name, startDate, endDate, status, isCurrent } = req.body;
    if (!name || String(name).trim().length < 4) {
      return res.status(400).json({ error: "O'quv yili nomini kiriting (masalan, 2026-2027)." });
    }
    if (isCurrent) {
      for (const y of db.academicYears) {
        y.isCurrent = false;
      }
    }
    const newYear = {
      id: `ay-${Date.now()}`,
      institutionId: "global",
      name: String(name).trim(),
      startDate: String(startDate || "2026-09-02"),
      endDate: String(endDate || "2027-05-25"),
      status: status || "active",
      isCurrent: Boolean(isCurrent),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.academicYears.unshift(newYear);
    appendAuditLog(db, user.institutionId, user, "Yangi o'quv yili qo'shildi", newYear.name, newYear.id);
    saveDbState(env, db);
    return res.json({ academicYear: newYear });
  });
  app.put("/api/institutions/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Faqat maktab administratori sozlamalarni o\u2018zgartira oladi." });
    }
    if (!canAccessInstitution(user, req.params.id)) {
      return res.status(403).json({ error: "Boshqa muassasa ma\u2019lumotlarini o\u2018zgartirish taqiqlangan." });
    }
    const inst = db.institutions.find((i) => i.id === req.params.id);
    if (!inst) return res.status(404).json({ error: "Muassasa topilmadi." });
    const {
      name,
      shortName,
      type,
      code,
      region,
      district,
      city,
      address,
      phone,
      email,
      website,
      directorName,
      contactPerson,
      contactRole,
      primarySubjectFocus,
      academicYear,
      gradingScale,
      languageOfInstruction,
      timezone,
      logoUrl,
      status,
      allowTeacherStudentInvites,
      allowTeacherAssessments,
      allowExcelImports,
      aiFeaturesEnabled
    } = req.body;
    if (name && String(name).trim().length >= 2) inst.name = String(name).trim();
    if (typeof shortName === "string") inst.shortName = shortName.trim();
    if (type) inst.type = type;
    if (code) inst.code = String(code).trim().toUpperCase();
    if (region && String(region).trim().length >= 2) inst.region = String(region).trim();
    if (district && String(district).trim().length >= 2) inst.district = String(district).trim();
    if (typeof city === "string") inst.city = city.trim();
    if (typeof address === "string") inst.address = address.trim();
    if (typeof phone === "string") inst.phone = phone.trim();
    if (typeof email === "string") inst.email = email.trim().toLowerCase();
    if (typeof website === "string") inst.website = website.trim();
    if (typeof directorName === "string") inst.directorName = directorName.trim();
    if (typeof contactPerson === "string") inst.contactPerson = contactPerson.trim();
    if (typeof contactRole === "string") inst.contactRole = contactRole.trim();
    if (typeof primarySubjectFocus === "string") inst.primarySubjectFocus = primarySubjectFocus.trim();
    if (academicYear) inst.academicYear = String(academicYear).trim();
    if (gradingScale) inst.gradingScale = gradingScale;
    if (typeof languageOfInstruction === "string") inst.languageOfInstruction = languageOfInstruction.trim();
    if (typeof timezone === "string") inst.timezone = timezone.trim();
    if (typeof logoUrl === "string") inst.logoUrl = logoUrl || void 0;
    if (status && ["active", "suspended", "archived", "onboarding"].includes(status)) {
      inst.status = status;
    }
    if (typeof allowTeacherStudentInvites === "boolean") {
      inst.allowTeacherStudentInvites = allowTeacherStudentInvites;
    }
    if (typeof allowTeacherAssessments === "boolean") {
      inst.allowTeacherAssessments = allowTeacherAssessments;
    }
    if (typeof allowExcelImports === "boolean") {
      inst.allowExcelImports = allowExcelImports;
    }
    if (typeof aiFeaturesEnabled === "boolean") {
      inst.aiFeaturesEnabled = aiFeaturesEnabled;
    }
    inst.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    appendAuditLog(db, inst.id, user, "Muassasa sozlamalari yangilandi", inst.name, inst.id);
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, inst.id, "INSTITUTION_UPDATED");
    return res.json({ institution: inst });
  });
  app.get("/api/classes", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    ensureSpecializedStudyStructure(db);
    if (user.role === "student") {
      const myClass = db.classes.find(
        (c) => c.id === user.classId || user.classCode && c.code.toLowerCase() === user.classCode.toLowerCase()
      );
      return res.json({ classes: myClass ? [myClass] : [] });
    }
    const gradeFilter = req.query.grade ? Number(req.query.grade) : void 0;
    const trackFilter = req.query.track ? String(req.query.track).toUpperCase() : void 0;
    let result = [...db.classes];
    if (gradeFilter) {
      result = result.filter((c) => c.grade === gradeFilter);
    }
    if (trackFilter === "A" || trackFilter === "T") {
      result = result.filter((c) => c.track === trackFilter);
    }
    return res.json({
      classes: result,
      totalCount: result.length
    });
  });
  app.post("/api/classes", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Sinf yaratish faqat administrator uchun ruxsat etilgan." });
    }
    const { name, code, grade, subject, teacherId } = req.body;
    const rawCode = String(code || name || "").trim().toLowerCase();
    if (!rawCode) {
      return res.status(400).json({ error: "Sinf kodini kiriting (masalan: 7a1 yoki 9t)." });
    }
    if (rawCode === "5t" || rawCode === "6t") {
      return res.status(400).json({
        error: `${rawCode} sinfi rasmiy 19 ta sinf tuzilmasida mavjud emas. T-yo\u2018nalishi faqat 7t, 8t, 9t, 10t, 11t sinflaridan iborat.`
      });
    }
    const parsedMeta = parseOfficialClassCode(rawCode);
    const existingOfficial = db.classes.find(
      (c) => (c.code || c.name).toLowerCase() === rawCode
    );
    if (existingOfficial) {
      return res.status(400).json({
        error: `${rawCode} sinfi allaqachon mavjud. Takroriy sinf yaratish mumkin emas.`,
        classRoom: existingOfficial
      });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const resolvedTrack = parsedMeta ? parsedMeta.track : "A";
    const resolvedGrade = parsedMeta ? parsedMeta.grade : Number(grade) || 8;
    const { subjectIds, subjectNames } = getDefaultSubjectsForTrack(resolvedTrack);
    const classId = parsedMeta ? `class-${parsedMeta.code}` : `class-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const newClass = {
      id: classId,
      code: parsedMeta ? parsedMeta.code : rawCode,
      name: parsedMeta ? parsedMeta.code : String(name || rawCode).trim(),
      grade: resolvedGrade,
      track: resolvedTrack,
      trackLabel: resolvedTrack === "A" ? "Aniq fanlar" : "Tabiiy fanlar",
      section: parsedMeta ? parsedMeta.section : "1",
      academicYear: "2026-2027",
      subject: String(subject || (resolvedTrack === "A" ? "Matematika" : "Biologiya")).trim(),
      subjectIds,
      subjectNames,
      teacherId: String(teacherId || user.uid),
      teacherName: user.displayName,
      institutionId: user.institutionId,
      inviteCode: `SS-${rawCode.toUpperCase()}-${Math.floor(1e3 + Math.random() * 9e3)}`,
      studentCount: 0,
      status: "active",
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.classes.push(newClass);
    appendAuditLog(
      db,
      user.institutionId,
      user,
      "Sinf yaratildi",
      `${newClass.code} (${newClass.trackLabel})`,
      classId
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "CLASS_CREATED");
    return res.json({ classRoom: newClass });
  });
  app.put("/api/classes/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ushbu sinfni tahrirlash faqat administrator uchun." });
    }
    const cls = db.classes.find(
      (c) => c.id === req.params.id || c.code.toLowerCase() === req.params.id.toLowerCase()
    );
    if (!cls) {
      return res.status(404).json({ error: "Sinf topilmadi." });
    }
    const { subject, subjectIds, subjectNames, academicYear, status } = req.body;
    if (subject) cls.subject = String(subject).trim();
    if (Array.isArray(subjectIds)) cls.subjectIds = subjectIds.map(String);
    if (Array.isArray(subjectNames)) cls.subjectNames = subjectNames.map(String);
    if (academicYear) cls.academicYear = String(academicYear).trim();
    if (status && (status === "active" || status === "archived")) {
      cls.status = status;
    }
    cls.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    appendAuditLog(db, user.institutionId, user, "Sinf sozlamalari yangilandi", cls.code, cls.id);
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "CLASS_UPDATED");
    return res.json({ classRoom: cls });
  });
  app.delete("/api/classes/:classId/students/:studentId", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Faqat administrator o\u2018quvchini sinfdan chiqara oladi." });
    }
    const cls = db.classes.find(
      (c) => c.id === req.params.classId || c.code.toLowerCase() === req.params.classId.toLowerCase()
    );
    const student = db.users.find((u) => u.uid === req.params.studentId);
    if (!cls || !student) {
      return res.status(404).json({ error: "Sinf yoki o\u2018quvchi topilmadi." });
    }
    student.classId = void 0;
    student.classCode = void 0;
    ensureSpecializedStudyStructure(db);
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `O'quvchi ${cls.code} sinfidan chiqarildi`,
      student.displayName,
      student.uid
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "STUDENT_UPDATED");
    return res.json({ status: "ok" });
  });
  app.post("/api/invitations", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Taklifnoma yaratish faqat administrator uchun ruxsat etilgan." });
    }
    const { inviteeName, email, role, classId, classCode, subject } = req.body;
    const resolvedInviteeName = inviteeName && String(inviteeName).trim().length >= 2 ? String(inviteeName).trim() : "Taklif etilgan o\u2018quvchi";
    const resolvedEmail = email && String(email).includes("@") ? String(email).trim().toLowerCase() : `student.${Date.now()}@specializedstudy.uz`;
    const targetRole = "student";
    const inst = db.institutions.find((i) => i.id === user.institutionId) || db.institutions[0];
    const lookupClassKey = String(classId || classCode || "").trim().toLowerCase();
    const cls = lookupClassKey ? db.classes.find(
      (c) => c.id.toLowerCase() === lookupClassKey || c.code.toLowerCase() === lookupClassKey || c.name.toLowerCase() === lookupClassKey
    ) : void 0;
    const { rawToken, tokenHash } = generateCryptographicInviteToken(targetRole);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const expiresIso = new Date(Date.now() + 1e3 * 60 * 60 * 24 * 14).toISOString();
    const newInvite = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      institutionId: user.institutionId,
      institutionName: inst?.name || "Specialized Study",
      email: resolvedEmail,
      inviteeName: resolvedInviteeName,
      role: targetRole,
      classId: cls?.id,
      classCode: cls?.code,
      className: cls?.name,
      grade: cls?.grade,
      track: cls?.track,
      subject: subject ? String(subject).trim() : cls?.subject,
      tokenHash,
      codePrefix: rawToken.slice(0, 10),
      status: "pending",
      createdByUid: user.uid,
      createdByName: user.displayName,
      createdAt: nowIso,
      expiresAt: expiresIso
    };
    db.invitations.unshift(newInvite);
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `O\u2018quvchi taklifnomasi yaratildi (${cls?.code || "umumiy"})`,
      `${newInvite.inviteeName} (${newInvite.email})`,
      newInvite.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "INVITATION_CREATED");
    return res.json({
      invitation: {
        ...newInvite,
        tokenHash: "***",
        inviteToken: rawToken
      },
      rawToken
    });
  });
  app.post("/api/invitations/bulk-csv", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "CSV import faqat administrator uchun ruxsat etilgan." });
    }
    const { csvText, rows, defaultClassId } = req.body;
    const existingEmails = [
      ...db.users.map((u) => u.email),
      ...db.invitations.filter((i) => i.status === "pending").map((i) => i.email)
    ];
    const validation = Array.isArray(rows) ? {
      validRows: rows.filter((r) => r && r.displayName && String(r.displayName).trim().length >= 2).map((r) => ({
        displayName: String(r.displayName).trim(),
        email: r.email && String(r.email).includes("@") ? String(r.email).trim().toLowerCase() : `student.${Date.now()}.${Math.random().toString(36).slice(2, 5)}@specializedstudy.uz`,
        className: r.className ? String(r.className).trim() : ""
      })),
      invalidRows: []
    } : validateCSVStudentImport(String(csvText || ""), existingEmails);
    if (validation.validRows.length === 0) {
      return res.status(400).json({
        error: "Yaroqli qatorlar topilmadi.",
        details: validation
      });
    }
    const inst = db.institutions.find((i) => i.id === user.institutionId) || db.institutions[0];
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const expiresIso = new Date(Date.now() + 1e3 * 60 * 60 * 24 * 14).toISOString();
    const createdInvites = [];
    for (const row of validation.validRows) {
      const matchedClass = db.classes.find(
        (c) => c.code.toLowerCase() === row.className?.toLowerCase() || c.name.toLowerCase() === row.className?.toLowerCase() || c.id === defaultClassId
      ) || db.classes[0];
      const { rawToken, tokenHash } = generateCryptographicInviteToken("STU");
      const inv = {
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        institutionId: user.institutionId,
        institutionName: inst?.name || "Specialized Study",
        email: row.email,
        inviteeName: row.displayName,
        role: "student",
        classId: matchedClass?.id,
        classCode: matchedClass?.code,
        className: matchedClass?.name,
        grade: matchedClass?.grade,
        track: matchedClass?.track,
        tokenHash,
        codePrefix: rawToken.slice(0, 10),
        status: "pending",
        createdByUid: user.uid,
        createdByName: user.displayName,
        createdAt: nowIso,
        expiresAt: expiresIso
      };
      db.invitations.unshift(inv);
      createdInvites.push({
        inviteeName: row.displayName,
        email: row.email,
        rawToken
      });
    }
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `CSV orqali ${createdInvites.length} ta o'quvchi taklifnomasi yuklandi`,
      `${createdInvites.length} ta yozuv`
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "CSV_IMPORTED");
    return res.json({
      createdCount: createdInvites.length,
      createdInvites,
      validation
    });
  });
  app.post("/api/invitations/:id/revoke", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    const inv = db.invitations.find((i) => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: "Taklifnoma topilmadi." });
    if (user.role !== "admin" && user.role !== "platform_owner" && inv.createdByUid !== user.uid) {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    inv.status = "revoked";
    appendAuditLog(
      db,
      user.institutionId,
      user,
      "Taklifnoma bekor qilindi",
      `${inv.inviteeName} (${inv.email})`,
      inv.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "INVITATION_REVOKED");
    return res.json({ status: "ok" });
  });
  app.post(["/api/users", "/api/admin/students"], (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Faqat administrator yangi o\u2018quvchi qo\u2018sha oladi." });
    }
    const { displayName, email, password, role, classId, classCode, studentCode } = req.body;
    if (!displayName || String(displayName).trim().length < 2) {
      return res.status(400).json({ error: "O\u2018quvchi F.I.Sh.ni kiriting." });
    }
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return res.status(400).json({ error: "To\u2018g\u2018ri elektron pochta manzilini kiriting." });
    }
    if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return res.status(400).json({ error: "Ushbu elektron pochta allaqachon mavjud." });
    }
    const lookupClass = String(classId || classCode || "7a1").trim().toLowerCase();
    const matchedCls = db.classes.find(
      (c) => c.id.toLowerCase() === lookupClass || c.code.toLowerCase() === lookupClass || c.name.toLowerCase() === lookupClass
    ) || db.classes[0];
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const newUid = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const targetRole = "student";
    const hasCustomPassword = typeof password === "string" && password.trim().length >= 6;
    const newUser = {
      uid: newUid,
      displayName: String(displayName).trim(),
      email: cleanEmail,
      role: targetRole,
      institutionId: user.institutionId,
      classId: matchedCls?.id,
      classCode: matchedCls?.code,
      grade: matchedCls?.grade,
      track: matchedCls?.track,
      studentCode: String(
        studentCode || `STD-${Math.floor(1e3 + Math.random() * 9e3)}`
      ).trim(),
      status: hasCustomPassword ? "active" : "pending_activation",
      enrolledAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.users.push(newUser);
    db.passwordHashes[newUid] = hashPassword(
      hasCustomPassword ? String(password).trim() : generateSecureRandomPassword()
    );
    if (targetRole === "student" && matchedCls) {
      db.studentEnrollments.push({
        id: `enr-${Date.now()}`,
        institutionId: user.institutionId,
        studentId: newUid,
        classId: matchedCls.id,
        classCode: matchedCls.code,
        grade: matchedCls.grade,
        track: matchedCls.track,
        status: "active",
        enrolledAt: nowIso
      });
    }
    ensureSpecializedStudyStructure(db);
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Yangi o\u2018quvchi qo\u2018shildi (${matchedCls?.code || ""})`,
      `${newUser.displayName} (${newUser.email})`,
      newUid
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "USER_CREATED");
    return res.json({ user: newUser, student: newUser });
  });
  app.put("/api/users/:uid", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({
        error: "Ruxsat rad etildi (403): O\u2018quvchi o\u2018z sinfi, yo\u2018nalishi yoki ruxsatlarini o\u2018zgartira olmaydi."
      });
    }
    const target = db.users.find((u) => u.uid === req.params.uid);
    if (!target) return res.status(404).json({ error: "Foydalanuvchi topilmadi." });
    const {
      displayName,
      firstName,
      lastName,
      patronymic,
      email,
      studentCode,
      status,
      classId,
      classCode
    } = req.body;
    if (displayName && String(displayName).trim().length >= 2) {
      target.displayName = String(displayName).trim();
    }
    if (typeof firstName === "string") target.firstName = firstName.trim();
    if (typeof lastName === "string") target.lastName = lastName.trim();
    if (typeof patronymic === "string") target.patronymic = patronymic.trim();
    if (typeof email === "string" && email.includes("@")) {
      target.email = email.trim().toLowerCase();
    }
    if (typeof studentCode === "string" && studentCode.trim()) {
      target.studentCode = studentCode.trim();
    }
    if (status && (status === "active" || status === "pending_activation" || status === "suspended" || status === "archived")) {
      target.status = status;
    }
    const nextClassKey = String(classId ?? classCode ?? "").trim().toLowerCase();
    if (nextClassKey) {
      const normalizedKey = normalizeClassCodeInput(nextClassKey) || nextClassKey;
      const nextCls = db.classes.find(
        (c) => c.id.toLowerCase() === normalizedKey || c.code.toLowerCase() === normalizedKey || c.name.toLowerCase() === normalizedKey
      );
      if (!nextCls) {
        return res.status(400).json({ error: "Tanlangan sinf 19 ta rasmiy sinf ro\u2018yxatida topilmadi." });
      }
      target.classId = nextCls.id;
      target.classCode = nextCls.code;
      target.grade = nextCls.grade;
      target.track = nextCls.track;
    }
    target.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    ensureSpecializedStudyStructure(db);
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `O\u2018quvchi ma\u2019lumotlari yangilandi (${target.classCode || ""})`,
      target.displayName,
      target.uid
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "USER_UPDATED");
    return res.json({ user: target });
  });
  app.get("/api/students/import/template.xlsx", (_req, res) => {
    const buffer = generateStudentImportTemplateBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Specialized_Study_Students.xlsx"'
    );
    return res.send(Buffer.from(buffer));
  });
  app.get("/api/students/export.xlsx", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Eksport faqat administrator uchun ruxsat etilgan." });
    }
    let students = db.users.filter((u) => u.role === "student" && u.status !== "archived");
    if (req.query.classCode) {
      const codeFilter = String(req.query.classCode).trim().toLowerCase();
      students = students.filter(
        (s) => s.classCode?.toLowerCase() === codeFilter || s.classId?.toLowerCase() === `class-${codeFilter}`
      );
    }
    if (req.query.uids) {
      const uidSet = new Set(String(req.query.uids).split(",").map((x) => x.trim()));
      students = students.filter((s) => uidSet.has(s.uid));
    }
    const buffer = generateStudentExportBuffer(students);
    const filename = req.query.classCode ? `Specialized_Study_${String(req.query.classCode).toUpperCase()}_Students.xlsx` : "Specialized_Study_Students_Export.xlsx";
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(Buffer.from(buffer));
  });
  app.post("/api/students/import/preview", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "O'quvchilarni yuklash faqat administrator uchun." });
    }
    const {
      fileName = "students.xlsx",
      base64Data,
      csvText,
      selectedSheet,
      selectedHeaderRowIndex,
      columnMappingOverride,
      rowClassOverrides,
      rowFieldOverrides
    } = req.body;
    let buffer;
    if (base64Data && typeof base64Data === "string") {
      const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
      buffer = Buffer.from(cleanBase64, "base64");
    } else if (csvText && typeof csvText === "string") {
      buffer = Buffer.from(csvText, "utf-8");
    } else {
      return res.status(400).json({ error: "Yuklash uchun Excel (.xlsx) yoki CSV fayl yuboring." });
    }
    const fileCheck = validateStudentUploadBuffer(buffer, String(fileName));
    if (!fileCheck.valid) {
      return res.status(400).json({ error: fileCheck.error });
    }
    try {
      const preview = parseAndValidateStudentWorkbook(
        buffer,
        String(fileName),
        {
          selectedSheet,
          selectedHeaderRowIndex,
          columnMappingOverride,
          rowClassOverrides,
          rowFieldOverrides
        },
        db.users
      );
      return res.json(preview);
    } catch (err) {
      return res.status(400).json({
        error: err?.message || "Excel faylni o'qishda xatolik yuz berdi."
      });
    }
  });
  app.post("/api/students/import/confirm", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "O'quvchilarni saqlash faqat administrator uchun." });
    }
    const {
      jobId,
      fileName = "students.xlsx",
      duplicatePolicy = "skip_existing",
      rows,
      base64Data,
      csvText,
      selectedSheet,
      selectedHeaderRowIndex,
      columnMappingOverride,
      rowClassOverrides,
      rowFieldOverrides
    } = req.body;
    const resolvedJobId = String(jobId || `stu-job-${Date.now()}`).trim();
    const existingJob = (db.studentImportJobs || []).find(
      (j) => j.jobId === resolvedJobId && j.status === "completed"
    );
    if (existingJob) {
      return res.json({
        idempotentReplay: true,
        job: existingJob,
        importedCount: existingJob.importedCount,
        updatedCount: existingJob.updatedCount,
        skippedCount: existingJob.skippedCount,
        errorCount: existingJob.errorCount
      });
    }
    let parsedRows = Array.isArray(rows) ? rows : [];
    if (parsedRows.length === 0 && (base64Data || csvText)) {
      const buffer = base64Data ? Buffer.from(
        String(base64Data).includes(",") ? String(base64Data).split(",")[1] : String(base64Data),
        "base64"
      ) : Buffer.from(String(csvText), "utf-8");
      const preview = parseAndValidateStudentWorkbook(
        buffer,
        String(fileName),
        {
          selectedSheet,
          selectedHeaderRowIndex,
          columnMappingOverride,
          rowClassOverrides,
          rowFieldOverrides
        },
        db.users
      );
      parsedRows = preview.rows;
    }
    if (parsedRows.length === 0) {
      return res.status(400).json({ error: "Saqlash uchun o'quvchilar qatorlari topilmadi." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const createdStudentUids = [];
    const updatedStudentUids = [];
    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const classOrderIndex = new Map(
      OFFICIAL_19_CLASS_CODES.map((code, idx) => [code, idx])
    );
    const sortedRows = [...parsedRows].sort((a, b) => {
      const codeA = normalizeClassCodeInput(a.normalizedClassCode || a.rawClassCode);
      const codeB = normalizeClassCodeInput(b.normalizedClassCode || b.rawClassCode);
      const idxA = codeA ? classOrderIndex.get(codeA) ?? 999 : 999;
      const idxB = codeB ? classOrderIndex.get(codeB) ?? 999 : 999;
      if (idxA !== idxB) return idxA - idxB;
      return String(a.lastName || a.fullName || "").localeCompare(
        String(b.lastName || b.fullName || ""),
        "uz"
      );
    });
    for (let i = 0; i < sortedRows.length; i++) {
      const r = sortedRows[i];
      const fullName = String(r.fullName || r.rawFullName || "").replace(/\s+/g, " ").trim();
      const firstName = String(r.firstName || r.rawFirstName || "").trim();
      const lastName = String(r.lastName || r.rawLastName || "").trim();
      const patronymic = String(r.patronymic || r.rawPatronymic || "").trim();
      const normClass = normalizeClassCodeInput(r.normalizedClassCode || r.rawClassCode);
      const rawEmail = String(r.email || r.rawEmail || "").trim().toLowerCase();
      const rawStudentId = String(r.studentId || r.rawStudentId || "").trim();
      if (!fullName || !normClass) {
        errorCount += 1;
        continue;
      }
      if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
        errorCount += 1;
        continue;
      }
      const cls = db.classes.find((c) => c.code.toLowerCase() === normClass.toLowerCase());
      if (!cls) {
        errorCount += 1;
        continue;
      }
      const existingStu = db.users.find((u) => {
        if (u.role !== "student" || u.status === "archived") return false;
        if (rawStudentId && u.studentCode && u.studentCode.toLowerCase() === rawStudentId.toLowerCase()) {
          return true;
        }
        if (rawEmail && !u.email.endsWith("@student.specialized.local") && u.email.toLowerCase() === rawEmail) {
          return true;
        }
        const uClass = normalizeClassCodeInput(u.classCode || u.classId?.replace(/^class-/, ""));
        const uName = String(u.displayName || "").trim().toLowerCase().replace(/\s+/g, " ");
        return uName === fullName.toLowerCase() && uClass === normClass;
      });
      if (existingStu) {
        if (duplicatePolicy === "update_existing") {
          existingStu.displayName = fullName;
          if (firstName) existingStu.firstName = firstName;
          if (lastName) existingStu.lastName = lastName;
          if (patronymic) existingStu.patronymic = patronymic;
          existingStu.classId = cls.id;
          existingStu.classCode = cls.code;
          existingStu.grade = cls.grade;
          existingStu.track = cls.track;
          if (rawEmail) existingStu.email = rawEmail;
          if (rawStudentId) existingStu.studentCode = rawStudentId;
          existingStu.updatedAt = nowIso;
          updatedCount += 1;
          updatedStudentUids.push(existingStu.uid);
        } else {
          skippedCount += 1;
        }
        continue;
      }
      const newUid = `user-imp-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
      const generatedCode = rawStudentId || `SS-${cls.code.toUpperCase()}-${String(db.users.length + importedCount + 1).padStart(3, "0")}`;
      const assignedEmail = rawEmail || `${generatedCode.toLowerCase().replace(/[^a-z0-9]/g, "")}@student.specialized.local`;
      const newStudent = {
        uid: newUid,
        displayName: fullName,
        firstName: firstName || void 0,
        lastName: lastName || void 0,
        patronymic: patronymic || void 0,
        email: assignedEmail,
        role: "student",
        institutionId: user.institutionId,
        classId: cls.id,
        classCode: cls.code,
        grade: cls.grade,
        track: cls.track,
        studentCode: generatedCode,
        importJobId: resolvedJobId,
        status: "pending_activation",
        enrolledAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      db.users.push(newStudent);
      db.studentEnrollments.push({
        id: `enr-imp-${Date.now()}-${i}`,
        institutionId: user.institutionId,
        studentId: newUid,
        classId: cls.id,
        classCode: cls.code,
        grade: cls.grade,
        track: cls.track,
        status: "active",
        enrolledAt: nowIso
      });
      createdStudentUids.push(newUid);
      importedCount += 1;
    }
    ensureSpecializedStudyStructure(db);
    const jobRecord = {
      id: `sij-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      jobId: resolvedJobId,
      institutionId: user.institutionId,
      fileName: String(fileName),
      duplicatePolicy: duplicatePolicy === "update_existing" ? "update_existing" : "skip_existing",
      totalRows: parsedRows.length,
      importedCount,
      updatedCount,
      skippedCount,
      errorCount,
      createdStudentUids,
      updatedStudentUids,
      status: "completed",
      initiatedByUid: user.uid,
      initiatedByName: user.displayName,
      createdAt: nowIso
    };
    db.studentImportJobs.unshift(jobRecord);
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Excel orqali o'quvchilar yuklandi (${importedCount} ta yangi, ${skippedCount} ta o'tkazib yuborildi)`,
      String(fileName),
      jobRecord.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "STUDENTS_IMPORTED");
    return res.json({
      job: jobRecord,
      importedCount,
      updatedCount,
      skippedCount,
      errorCount,
      createdStudentUids
    });
  });
  app.get("/api/students/import/history", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    return res.json({ jobs: db.studentImportJobs || [] });
  });
  app.post("/api/students/import/:jobId/rollback", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Importni bekor qilish faqat administrator uchun." });
    }
    const targetJobId = String(req.params.jobId).trim();
    const job = (db.studentImportJobs || []).find(
      (j) => j.id === targetJobId || j.jobId === targetJobId
    );
    if (!job) {
      return res.status(404).json({ error: "Import amaliyoti topilmadi." });
    }
    if (job.status === "rolled_back") {
      return res.status(400).json({ error: "Ushbu import allaqachon bekor qilingan." });
    }
    const uidsToRollback = new Set(job.createdStudentUids || []);
    let removedCount = 0;
    let archivedCount = 0;
    db.users = db.users.filter((u) => {
      if (!uidsToRollback.has(u.uid) && u.importJobId !== job.jobId) {
        return true;
      }
      const hasActivity = db.attempts.some((att) => att.studentId === u.uid);
      if (hasActivity) {
        u.status = "archived";
        u.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        archivedCount += 1;
        return true;
      }
      removedCount += 1;
      return false;
    });
    db.studentEnrollments = db.studentEnrollments.filter(
      (enr) => !uidsToRollback.has(enr.studentId)
    );
    job.status = "rolled_back";
    job.rolledBackAt = (/* @__PURE__ */ new Date()).toISOString();
    job.rolledBackByUid = user.uid;
    ensureSpecializedStudyStructure(db);
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Excel import bekor qilindi (o'chirildi: ${removedCount}, arxivlandi: ${archivedCount})`,
      job.fileName,
      job.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "IMPORT_ROLLED_BACK");
    return res.json({
      job,
      removedCount,
      archivedCount
    });
  });
  app.post("/api/students/bulk-action", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ommaviy amallar faqat administrator uchun." });
    }
    const { action, studentUids, targetClassCode } = req.body;
    if (!Array.isArray(studentUids) || studentUids.length === 0) {
      return res.status(400).json({ error: "Kamida 1 ta o'quvchini tanlang." });
    }
    const uidSet = new Set(studentUids.map(String));
    const matchedStudents = db.users.filter((u) => u.role === "student" && uidSet.has(u.uid));
    if (matchedStudents.length === 0) {
      return res.status(404).json({ error: "Tanlangan o'quvchilar topilmadi." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    if (action === "change_class") {
      const normClass = normalizeClassCodeInput(targetClassCode);
      const cls = normClass ? db.classes.find((c) => c.code.toLowerCase() === normClass.toLowerCase()) : void 0;
      if (!cls) {
        return res.status(400).json({ error: "19 ta rasmiy sinfdan birini tanlang." });
      }
      for (const s of matchedStudents) {
        s.classId = cls.id;
        s.classCode = cls.code;
        s.grade = cls.grade;
        s.track = cls.track;
        s.updatedAt = nowIso;
      }
      ensureSpecializedStudyStructure(db);
      appendAuditLog(
        db,
        user.institutionId,
        user,
        `${matchedStudents.length} ta o'quvchi ${cls.code} sinfiga o'tkazildi`,
        cls.code
      );
      saveDbState(env, db);
      broadcastInstitutionUpdate(env, user.institutionId, "STUDENTS_BULK_UPDATED");
      return res.json({ updatedCount: matchedStudents.length, classCode: cls.code });
    }
    if (action === "archive" || action === "suspend" || action === "activate") {
      const nextStatus = action === "archive" ? "archived" : action === "suspend" ? "suspended" : "active";
      for (const s of matchedStudents) {
        s.status = nextStatus;
        s.updatedAt = nowIso;
      }
      ensureSpecializedStudyStructure(db);
      appendAuditLog(
        db,
        user.institutionId,
        user,
        `${matchedStudents.length} ta o'quvchi holati o'zgartirildi -> ${nextStatus}`,
        `${matchedStudents.length} ta o'quvchi`
      );
      saveDbState(env, db);
      broadcastInstitutionUpdate(env, user.institutionId, "STUDENTS_BULK_UPDATED");
      return res.json({ updatedCount: matchedStudents.length, status: nextStatus });
    }
    if (action === "send_invite") {
      const inst = db.institutions.find((i) => i.id === user.institutionId) || db.institutions[0];
      const expiresIso = new Date(Date.now() + 14 * 864e5).toISOString();
      const createdTokens = [];
      for (const s of matchedStudents) {
        const cls = db.classes.find(
          (c) => c.id === s.classId || c.code.toLowerCase() === (s.classCode || "").toLowerCase()
        );
        const { rawToken, tokenHash } = generateCryptographicInviteToken("STU");
        const inv = {
          id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          institutionId: user.institutionId,
          institutionName: inst?.name || "Specialized Study",
          email: s.email,
          inviteeName: s.displayName,
          role: "student",
          classId: cls?.id,
          classCode: cls?.code,
          className: cls?.name,
          grade: cls?.grade,
          track: cls?.track,
          tokenHash,
          codePrefix: rawToken.slice(0, 10),
          status: "pending",
          createdByUid: user.uid,
          createdByName: user.displayName,
          createdAt: nowIso,
          expiresAt: expiresIso
        };
        db.invitations.unshift(inv);
        createdTokens.push({ uid: s.uid, displayName: s.displayName, rawToken });
      }
      saveDbState(env, db);
      broadcastInstitutionUpdate(env, user.institutionId, "INVITATION_CREATED");
      return res.json({ invitedCount: createdTokens.length, createdTokens });
    }
    return res.status(400).json({ error: "Noma'lum ommaviy amal." });
  });
  app.get("/api/search", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    const q = String(req.query.q || "").trim().toLowerCase();
    const results = [];
    const isAdmin = user.role === "admin" || user.role === "platform_owner";
    if (!q) {
      return res.json({ results: [] });
    }
    if (isAdmin) {
      for (const cls of db.classes) {
        if (cls.code.toLowerCase().includes(q) || `${cls.code} sinfi`.toLowerCase().includes(q) || cls.trackLabel.toLowerCase().includes(q)) {
          results.push({
            id: `srch-cls-${cls.id}`,
            category: "class",
            title: `${cls.code.toUpperCase()} sinfi`,
            subtitle: `${cls.grade}-sinf \u2022 ${cls.trackLabel} \u2022 ${cls.studentCount} o'quvchi`,
            badge: cls.track,
            route: `/admin/classes?class=${cls.code}`,
            recordId: cls.id,
            classCode: cls.code
          });
        }
      }
      for (const s of db.users) {
        if (s.role !== "student" || s.status === "archived") continue;
        if (s.displayName.toLowerCase().includes(q) || s.studentCode && s.studentCode.toLowerCase().includes(q) || s.classCode && s.classCode.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)) {
          results.push({
            id: `srch-stu-${s.uid}`,
            category: "student",
            title: s.displayName,
            subtitle: `${(s.classCode || "").toUpperCase()} \u2022 ID: ${s.studentCode || s.uid.slice(0, 8)}`,
            badge: s.classCode?.toUpperCase(),
            route: `/admin/students?student=${s.uid}`,
            recordId: s.uid,
            classCode: s.classCode
          });
        }
      }
      for (const subj of db.subjects) {
        if (subj.name.toLowerCase().includes(q) || subj.code && subj.code.toLowerCase().includes(q)) {
          results.push({
            id: `srch-subj-${subj.id}`,
            category: "subject",
            title: subj.name,
            subtitle: `Yo'nalish: ${subj.trackTypes.join(", ")}`,
            badge: subj.code,
            route: `/admin/subjects`,
            recordId: subj.id
          });
        }
      }
      for (const wp of db.workPlans || []) {
        if (wp.title.toLowerCase().includes(q) || wp.classCode.toLowerCase().includes(q) || wp.subjectName.toLowerCase().includes(q)) {
          results.push({
            id: `srch-wp-${wp.id}`,
            category: "work_plan",
            title: wp.title,
            subtitle: `${wp.classCode.toUpperCase()} \u2022 ${wp.subjectName} \u2022 ${wp.quarter}-chorak`,
            badge: `${wp.rows.length} dars`,
            route: `/admin/work-plans`,
            recordId: wp.id,
            classCode: wp.classCode
          });
        }
      }
    }
    const allowedLessons = isAdmin ? db.lessons || [] : (db.lessons || []).filter(
      (l) => lessonMatchesClass(l, user.classCode || user.classId) && (!l.additionalCurriculumAssignment || l.tTrackVisibilityApproved === true) && l.status !== "planned" && l.status !== "archived"
    );
    for (const l of allowedLessons) {
      if (l.title.toLowerCase().includes(q) || l.topicName.toLowerCase().includes(q) || l.subjectName.toLowerCase().includes(q) || l.classCode.toLowerCase().includes(q)) {
        results.push({
          id: `srch-les-${l.id}`,
          category: "lesson",
          title: `${l.lessonNumber}-dars: ${l.title}`,
          subtitle: `${l.classCode.toUpperCase()} \u2022 ${l.subjectName} \u2022 ${l.quarter}-chorak`,
          badge: l.classCode.toUpperCase(),
          route: isAdmin ? `/admin/lessons` : `/student/lessons`,
          recordId: l.id,
          classCode: l.classCode
        });
      }
    }
    const allowedAssessments = isAdmin ? db.assessments : db.assessments.filter(
      (a) => a.status === "published" && (a.classId === user.classId || a.classCode?.toLowerCase() === (user.classCode || "").toLowerCase())
    );
    for (const a of allowedAssessments) {
      if (a.title.toLowerCase().includes(q) || a.subject.toLowerCase().includes(q) || a.classCode && a.classCode.toLowerCase().includes(q)) {
        results.push({
          id: `srch-ass-${a.id}`,
          category: "assessment",
          title: a.title,
          subtitle: `${(a.classCode || "").toUpperCase()} \u2022 ${a.subject} \u2022 ${a.questionIds.length} savol`,
          badge: a.status === "published" ? "Nashr etilgan" : "Qoralama",
          route: isAdmin ? `/admin/assessments` : `/student/assessments`,
          recordId: a.id,
          classCode: a.classCode
        });
      }
    }
    return res.json({ results: results.slice(0, 25) });
  });
  app.get("/api/calendar", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    const isAdmin = user.role === "admin" || user.role === "platform_owner";
    const classFilter = req.query.classCode ? String(req.query.classCode).toLowerCase() : "";
    const subjectFilter = req.query.subject ? String(req.query.subject).toLowerCase() : "";
    const typeFilter = req.query.type ? String(req.query.type).toLowerCase() : "";
    const events = [];
    const lessonsPool = isAdmin ? db.lessons || [] : (db.lessons || []).filter(
      (l) => lessonMatchesClass(l, user.classCode || user.classId) && (!l.additionalCurriculumAssignment || l.tTrackVisibilityApproved === true) && l.status !== "planned" && l.status !== "archived"
    );
    for (const l of lessonsPool) {
      if (!l.scheduledDate) continue;
      if (classFilter && !lessonMatchesClass(l, classFilter)) continue;
      if (subjectFilter && l.subjectName.toLowerCase() !== subjectFilter) continue;
      if (typeFilter && typeFilter !== "lesson") continue;
      events.push({
        id: `cal-lesson-${l.id}`,
        title: `${l.classCode.toUpperCase()} \u2022 ${l.subjectName}: ${l.lessonNumber}-dars (${l.title})`,
        type: "lesson",
        date: l.scheduledDate.slice(0, 10),
        classId: l.classId,
        classCode: l.classCode,
        subject: l.subjectName,
        quarter: l.quarter,
        status: l.status,
        targetRoute: isAdmin ? `/admin/lessons` : `/student/lessons`,
        recordId: l.id
      });
    }
    const assessmentsPool = isAdmin ? db.assessments : db.assessments.filter(
      (a) => a.status === "published" && (a.classId === user.classId || a.classCode?.toLowerCase() === (user.classCode || "").toLowerCase())
    );
    for (const a of assessmentsPool) {
      const aClass = a.classCode || db.classes.find((c) => c.id === a.classId)?.code || "";
      if (classFilter && aClass.toLowerCase() !== classFilter) continue;
      if (subjectFilter && a.subject.toLowerCase() !== subjectFilter) continue;
      if (a.availableFrom && (!typeFilter || typeFilter === "assessment")) {
        events.push({
          id: `cal-ass-start-${a.id}`,
          title: `Test: ${a.title}`,
          type: "assessment",
          date: a.availableFrom.slice(0, 10),
          classId: a.classId,
          classCode: aClass,
          subject: a.subject,
          quarter: a.quarter,
          status: a.status,
          targetRoute: isAdmin ? `/admin/assessments` : `/student/assessments`,
          recordId: a.id
        });
      }
      if (a.dueDate && (!typeFilter || typeFilter === "deadline")) {
        events.push({
          id: `cal-ass-due-${a.id}`,
          title: `Muddat: ${a.title}`,
          type: "deadline",
          date: a.dueDate.slice(0, 10),
          classId: a.classId,
          classCode: aClass,
          subject: a.subject,
          quarter: a.quarter,
          status: a.status,
          targetRoute: isAdmin ? `/admin/assessments` : `/student/assessments`,
          recordId: a.id
        });
      }
    }
    if (isAdmin && (!typeFilter || typeFilter === "milestone")) {
      for (const wp of db.workPlans || []) {
        const milestoneDate = wp.confirmedAt || wp.createdAt;
        if (!milestoneDate) continue;
        if (classFilter && wp.classCode.toLowerCase() !== classFilter) continue;
        if (subjectFilter && wp.subjectName.toLowerCase() !== subjectFilter) continue;
        events.push({
          id: `cal-wp-${wp.id}`,
          title: `Ish reja: ${wp.title}`,
          type: "milestone",
          date: milestoneDate.slice(0, 10),
          classId: wp.classId,
          classCode: wp.classCode,
          subject: wp.subjectName,
          quarter: wp.quarter,
          status: wp.status,
          targetRoute: `/admin/work-plans`,
          recordId: wp.id
        });
      }
    }
    events.sort((a, b) => a.date.localeCompare(b.date));
    return res.json({ events });
  });
  app.post("/api/subjects", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Fan qo\u2018shish faqat administrator uchun." });
    }
    const { name, code, grade, description, trackTypes, applicableGrades, applicableClassCodes } = req.body;
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: "Fan nomini kiriting." });
    }
    const resolvedTracks = Array.isArray(trackTypes) && trackTypes.length > 0 ? trackTypes : ["A", "T"];
    const resolvedGrades = Array.isArray(applicableGrades) && applicableGrades.length > 0 ? applicableGrades.map(Number) : [5, 6, 7, 8, 9, 10, 11];
    const resolvedClassCodes = Array.isArray(applicableClassCodes) && applicableClassCodes.length > 0 ? applicableClassCodes.map((c) => String(c).toLowerCase()) : db.classes.filter((c) => resolvedTracks.includes(c.track) && resolvedGrades.includes(c.grade)).map((c) => c.code);
    const newSubject = {
      id: `subj-${Date.now()}`,
      institutionId: user.institutionId,
      name: String(name).trim(),
      code: String(code || String(name).trim().slice(0, 3)).toUpperCase(),
      grade: Number(grade) || 8,
      applicableGrades: resolvedGrades,
      trackTypes: resolvedTracks,
      applicableClassCodes: resolvedClassCodes,
      description: String(description || "").trim(),
      status: "active",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.subjects.push(newSubject);
    appendAuditLog(db, user.institutionId, user, "Yangi fan qo\u2018shildi", newSubject.name, newSubject.id);
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "SUBJECT_CREATED");
    return res.json({ subject: newSubject });
  });
  app.put("/api/subjects/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Fanni tahrirlash faqat administrator uchun." });
    }
    const subj = db.subjects.find((s) => s.id === req.params.id);
    if (!subj) return res.status(404).json({ error: "Fan topilmadi." });
    const { name, code, description, trackTypes, applicableGrades, applicableClassCodes, status } = req.body;
    if (name && String(name).trim().length >= 2) subj.name = String(name).trim();
    if (code) subj.code = String(code).trim().toUpperCase();
    if (typeof description === "string") subj.description = description.trim();
    if (Array.isArray(trackTypes) && trackTypes.length > 0) subj.trackTypes = trackTypes;
    if (Array.isArray(applicableGrades) && applicableGrades.length > 0) {
      subj.applicableGrades = applicableGrades.map(Number);
    }
    if (Array.isArray(applicableClassCodes)) {
      subj.applicableClassCodes = applicableClassCodes.map((c) => String(c).toLowerCase());
    }
    if (status && (status === "active" || status === "archived")) {
      subj.status = status;
    }
    subj.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    appendAuditLog(db, user.institutionId, user, "Fan sozlamalari yangilandi", subj.name, subj.id);
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "SUBJECT_UPDATED");
    return res.json({ subject: subj });
  });
  app.post("/api/topics", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "teacher" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const { name, subject, grade, description, quarter, unitTitle, classCode } = req.body;
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: "Mavzu nomini kiriting." });
    }
    const newTopic = {
      id: `topic-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      institutionId: user.institutionId,
      name: String(name).trim(),
      subject: String(subject || "Matematika").trim(),
      grade: Number(grade) || 8,
      quarter: quarter ? Number(quarter) : void 0,
      unitTitle: unitTitle ? String(unitTitle).trim() : void 0,
      classCode: classCode ? String(classCode).toLowerCase() : void 0,
      description: String(description || "").trim(),
      orderIndex: db.topics.length + 1
    };
    db.topics.push(newTopic);
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "TOPIC_CREATED");
    return res.json({ topic: newTopic });
  });
  app.get("/api/work-plans/template.xlsx", (req, res) => {
    const classCode = String(req.query.classCode || "7a1");
    const subjectName = String(req.query.subject || "Matematika");
    const buffer = generateWorkPlanTemplateExcelBuffer(classCode, subjectName, "2026-2027");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Specialized_Study_Ish_Reja_${classCode}_${subjectName}.xlsx"`
    );
    return res.send(Buffer.from(buffer));
  });
  app.get("/api/work-plans", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ish rejalari faqat administrator uchun." });
    }
    return res.json({ workPlans: db.workPlans || [] });
  });
  app.post("/api/work-plans/analyze", async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ish reja yuklash faqat administrator uchun ruxsat etilgan." });
    }
    const {
      fileName = "ish_reja.xlsx",
      fileMimeType,
      base64Data,
      rawText,
      rows: explicitRows,
      classId,
      classCode,
      subject,
      subjectId,
      subjectName,
      academicYear = "2026-2027",
      quarter = 1,
      planType = "quarterly"
    } = req.body;
    const lookupClass = String(classCode || classId || "7a1").trim().toLowerCase();
    const cls = db.classes.find(
      (c) => c.id.toLowerCase() === lookupClass || c.code.toLowerCase() === lookupClass || c.name.toLowerCase() === lookupClass
    );
    if (!cls) {
      return res.status(400).json({ error: "Tanlangan sinf 19 ta rasmiy sinf ro\u2018yxatida topilmadi." });
    }
    const lookupSubj = String(subject || subjectName || subjectId || cls.subject || "Matematika").trim();
    const subj = db.subjects.find(
      (s) => s.id.toLowerCase() === lookupSubj.toLowerCase() || s.name.toLowerCase() === lookupSubj.toLowerCase()
    ) || db.subjects[0];
    const compat = isSubjectCompatibleWithClass(subj.name, cls, db.subjects);
    if (!compat.compatible) {
      return res.status(400).json({
        error: compat.reason || `${subj.name} fani ${cls.code} sinfiga mos emas.`
      });
    }
    let buffer = null;
    if (base64Data && typeof base64Data === "string") {
      const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
      buffer = new Uint8Array(Buffer.from(cleanBase64, "base64"));
    }
    const parsedQuarter = [1, 2, 3, 4].includes(Number(quarter)) ? Number(quarter) : 1;
    let { rows, warnings } = parseWorkPlanRowsFromBufferOrText(
      String(fileName),
      buffer,
      rawText ? String(rawText) : void 0,
      Array.isArray(explicitRows) ? explicitRows : void 0,
      subj.name,
      parsedQuarter
    );
    const ai = getGeminiClient(req);
    if (rows.length === 0 && ai) {
      try {
        const parts = [];
        if (buffer && fileMimeType && /^(application\/pdf|image\/)/i.test(fileMimeType)) {
          parts.push({
            inlineData: {
              mimeType: fileMimeType,
              data: Buffer.from(buffer).toString("base64")
            }
          });
        }
        parts.push({
          text: `Ushbu o'quv ish reja faylidan (${fileName}) ${cls.code} sinfi ${subj.name} fani (${academicYear}, ${parsedQuarter}-chorak) uchun darslar ro'yxatini ajratib bering. Har bir dars uchun lessonNumber, quarter, unitTitle, topicName, lessonTitle, learningObjectives, scheduledDate va hours maydonlarini JSON massivida qaytaring.`
        });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: parts,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                rows: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      lessonNumber: { type: Type.NUMBER },
                      quarter: { type: Type.NUMBER },
                      unitTitle: { type: Type.STRING },
                      topicName: { type: Type.STRING },
                      lessonTitle: { type: Type.STRING },
                      learningObjectives: { type: Type.STRING },
                      scheduledDate: { type: Type.STRING },
                      hours: { type: Type.NUMBER }
                    },
                    required: ["lessonNumber", "unitTitle", "topicName", "lessonTitle", "learningObjectives"]
                  }
                }
              },
              required: ["rows"]
            }
          }
        });
        const parsedAi = JSON.parse((response.text ?? "{}").trim());
        if (Array.isArray(parsedAi.rows) && parsedAi.rows.length > 0) {
          rows = parsedAi.rows.map((r, idx) => ({
            rowId: `wprow-ai-${Date.now()}-${idx + 1}`,
            lessonNumber: Number(r.lessonNumber) || idx + 1,
            quarter: [1, 2, 3, 4].includes(Number(r.quarter)) ? Number(r.quarter) : parsedQuarter,
            weekNumber: Math.ceil((Number(r.lessonNumber) || idx + 1) / 3),
            unitTitle: String(r.unitTitle || `${parsedQuarter}-chorak bo\u2018limi`),
            topicName: String(r.topicName || r.lessonTitle),
            lessonTitle: String(r.lessonTitle),
            learningObjectives: String(r.learningObjectives),
            scheduledDate: r.scheduledDate ? String(r.scheduledDate) : void 0,
            hours: Number(r.hours) || 1
          }));
        }
      } catch (aiErr) {
        console.warn("Gemini WorkPlan extraction fallback:", aiErr);
      }
    }
    if (rows.length === 0) {
      const subjectTopics = db.topics.filter(
        (t) => t.subject.toLowerCase() === subj.name.toLowerCase()
      );
      const baseTopics = subjectTopics.length > 0 ? subjectTopics : [
        { name: `${subj.name}: Kirish va asosiy tushunchalar`, learningObjectives: "Asosiy qoidalarni o\u2018rganish" },
        { name: `${subj.name}: Amaliy masalalar yechish`, learningObjectives: "Namunaviy masalalar ishlash" },
        { name: `${subj.name}: Mustahkamlash va tahlil`, learningObjectives: "Mustaqil topshiriqlarni bajarish" }
      ];
      rows = baseTopics.map((bt, idx) => ({
        rowId: `wprow-doc-${Date.now()}-${idx + 1}`,
        lessonNumber: idx + 1,
        quarter: parsedQuarter,
        weekNumber: idx + 1,
        unitTitle: `${parsedQuarter}-chorak. ${subj.name} bo\u2018limi`,
        topicName: bt.name,
        lessonTitle: `${idx + 1}-dars. ${bt.name}`,
        learningObjectives: bt.learningObjectives || "Mavzu bo\u2018yicha amaliy ko\u2018nikmalarni shakllantirish.",
        hours: 1
      }));
      warnings.push(
        "Fayldan darslar jadvali dastlabki qoralama sifatida ajratildi. Saqlashdan oldin jadval qatorlarini ko\u2018rib chiqing."
      );
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const draftPlan = {
      id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      institutionId: user.institutionId,
      title: `${cls.code.toUpperCase()} \u2014 ${subj.name} (${parsedQuarter}-chorak ish rejasi)`,
      fileName: String(fileName),
      fileMimeType: fileMimeType ? String(fileMimeType) : void 0,
      classId: cls.id,
      classCode: cls.code,
      grade: cls.grade,
      track: cls.track,
      subjectId: subj.id,
      subjectName: subj.name,
      academicYear: String(academicYear),
      quarter: parsedQuarter,
      planType: planType || "quarterly",
      status: "draft_preview",
      rows,
      warnings,
      createdByUid: user.uid,
      createdByName: user.displayName,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.workPlans.unshift(draftPlan);
    saveDbState(env, db);
    return res.json({
      workPlan: draftPlan,
      rows,
      warnings
    });
  });
  app.post("/api/work-plans/confirm", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ish rejani tasdiqlash faqat administrator uchun." });
    }
    const {
      workPlanId,
      title,
      fileName,
      classId,
      classCode,
      subject,
      subjectId,
      subjectName,
      academicYear = "2026-2027",
      quarter = 1,
      planType = "quarterly",
      rows,
      publishLessons = false
    } = req.body;
    const lookupClass = String(classCode || classId || "7a1").trim().toLowerCase();
    const cls = db.classes.find(
      (c) => c.id.toLowerCase() === lookupClass || c.code.toLowerCase() === lookupClass || c.name.toLowerCase() === lookupClass
    );
    if (!cls) {
      return res.status(400).json({ error: "Sinf topilmadi." });
    }
    const lookupSubj = String(
      subject || subjectName || subjectId || cls.subject
    ).trim();
    const subj = db.subjects.find(
      (s) => s.id.toLowerCase() === lookupSubj.toLowerCase() || s.name.toLowerCase() === lookupSubj.toLowerCase()
    ) || db.subjects[0];
    const compat = isSubjectCompatibleWithClass(subj.name, cls, db.subjects);
    if (!compat.compatible) {
      return res.status(400).json({
        error: compat.reason || `${subj.name} fani ${cls.code} sinfiga mos emas.`
      });
    }
    const existingPlan = workPlanId ? db.workPlans.find((wp) => wp.id === workPlanId) : db.workPlans.find(
      (wp) => wp.status === "draft_preview" && wp.classId === cls.id && wp.subjectId === subj.id && wp.quarter === Number(quarter || 1)
    );
    const finalRows = Array.isArray(rows) && rows.length > 0 ? rows : existingPlan?.rows || [];
    if (finalRows.length === 0) {
      return res.status(400).json({ error: "Tasdiqlash uchun kamida 1 ta dars qatori bo\u2018lishi shart." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const parsedQuarter = [1, 2, 3, 4].includes(Number(quarter)) ? Number(quarter) : existingPlan?.quarter || 1;
    let confirmedPlan;
    if (existingPlan) {
      existingPlan.title = title ? String(title).trim() : existingPlan.title;
      existingPlan.rows = finalRows;
      existingPlan.status = "confirmed";
      existingPlan.confirmedAt = nowIso;
      existingPlan.updatedAt = nowIso;
      confirmedPlan = existingPlan;
    } else {
      confirmedPlan = {
        id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        institutionId: user.institutionId,
        title: title ? String(title).trim() : `${cls.code.toUpperCase()} \u2014 ${subj.name} (${parsedQuarter}-chorak ish rejasi)`,
        fileName: String(fileName || "ish_reja.xlsx"),
        classId: cls.id,
        classCode: cls.code,
        grade: cls.grade,
        track: cls.track,
        subjectId: subj.id,
        subjectName: subj.name,
        academicYear: String(academicYear),
        quarter: parsedQuarter,
        planType: planType || "quarterly",
        status: "confirmed",
        rows: finalRows,
        warnings: [],
        createdByUid: user.uid,
        createdByName: user.displayName,
        createdAt: nowIso,
        confirmedAt: nowIso,
        updatedAt: nowIso
      };
      db.workPlans.unshift(confirmedPlan);
    }
    const createdLessons = [];
    const createdTopics = [];
    for (const row of finalRows) {
      const cleanTopicName = String(row.topicName || row.lessonTitle).trim();
      let topicRecord = db.topics.find(
        (t) => t.subject.toLowerCase() === subj.name.toLowerCase() && t.grade === cls.grade && t.name.toLowerCase() === cleanTopicName.toLowerCase()
      );
      if (!topicRecord) {
        topicRecord = {
          id: `topic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          code: `TOP-${subj.code}-${cls.grade}-${db.topics.length + 1}`,
          institutionId: user.institutionId,
          subjectId: subj.id,
          subjectCode: subj.code,
          unitTitle: row.unitTitle,
          quarter: row.quarter || parsedQuarter,
          classCode: cls.code,
          track: cls.track,
          name: cleanTopicName,
          subject: subj.name,
          grade: cls.grade,
          description: row.learningObjectives || cleanTopicName,
          learningObjectives: row.learningObjectives,
          status: "active",
          orderIndex: db.topics.length + 1
        };
        db.topics.push(topicRecord);
        createdTopics.push(topicRecord);
      }
      const existingLesson = db.lessons.find(
        (l) => l.classCode.toLowerCase() === cls.code.toLowerCase() && l.subjectName.toLowerCase() === subj.name.toLowerCase() && l.quarter === (row.quarter || parsedQuarter) && l.lessonNumber === Number(row.lessonNumber)
      );
      if (existingLesson) {
        existingLesson.workPlanId = confirmedPlan.id;
        existingLesson.unitTitle = String(row.unitTitle || existingLesson.unitTitle);
        existingLesson.topicId = topicRecord.id;
        existingLesson.topicName = topicRecord.name;
        existingLesson.title = String(row.lessonTitle || existingLesson.title);
        existingLesson.learningObjectives = String(
          row.learningObjectives || existingLesson.learningObjectives
        );
        existingLesson.scheduledDate = row.scheduledDate || existingLesson.scheduledDate;
        existingLesson.homework = row.homework || existingLesson.homework;
        if (publishLessons) {
          existingLesson.status = "published";
        }
        existingLesson.updatedAt = nowIso;
        createdLessons.push(existingLesson);
      } else {
        const newLesson = {
          id: `lesson-${cls.code}-${subj.code.toLowerCase()}-${Date.now()}-${row.lessonNumber}`,
          institutionId: user.institutionId,
          workPlanId: confirmedPlan.id,
          classId: cls.id,
          classCode: cls.code,
          grade: cls.grade,
          track: cls.track,
          subjectId: subj.id,
          subjectName: subj.name,
          academicYear: confirmedPlan.academicYear,
          quarter: row.quarter || parsedQuarter,
          weekNumber: row.weekNumber || Math.ceil(Number(row.lessonNumber) / 3),
          lessonNumber: Number(row.lessonNumber),
          unitTitle: String(row.unitTitle || `${parsedQuarter}-chorak bo\u2018limi`),
          topicId: topicRecord.id,
          topicName: topicRecord.name,
          title: String(row.lessonTitle || cleanTopicName),
          learningObjectives: String(
            row.learningObjectives || "Mavzu bo\u2018yicha bilim va ko\u2018nikmalarni shakllantirish."
          ),
          content: `${row.lessonTitle || cleanTopicName}. O\u2018quv maqsadi: ${row.learningObjectives || ""}`,
          homework: row.homework,
          scheduledDate: row.scheduledDate,
          hours: Number(row.hours) || 1,
          materials: [],
          relatedAssessmentIds: [],
          status: publishLessons ? "published" : "planned",
          createdAt: nowIso,
          updatedAt: nowIso
        };
        db.lessons.push(newLesson);
        createdLessons.push(newLesson);
      }
    }
    db.lessons.sort((a, b) => {
      if (a.classCode !== b.classCode) return a.classCode.localeCompare(b.classCode);
      if (a.quarter !== b.quarter) return a.quarter - b.quarter;
      return a.lessonNumber - b.lessonNumber;
    });
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Ish reja tasdiqlandi va O\u2018quv xaritasi yaratildi (${cls.code}, ${subj.name}, ${createdLessons.length} ta dars)`,
      confirmedPlan.title,
      confirmedPlan.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "WORK_PLAN_CONFIRMED");
    return res.json({
      workPlan: confirmedPlan,
      lessonsCreatedCount: createdLessons.length,
      topicsCreatedCount: createdTopics.length,
      lessons: createdLessons
    });
  });
  app.delete("/api/work-plans/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const idx = db.workPlans.findIndex((wp) => wp.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Ish reja topilmadi." });
    db.workPlans.splice(idx, 1);
    saveDbState(env, db);
    return res.json({ status: "ok" });
  });
  app.get("/api/curriculum-zip/official-preview", async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "O\u2018quv reja importi faqat administrator uchun." });
    }
    const preview = await getOfficialMathArchivePreview();
    if (!preview) {
      return res.status(404).json({ error: "Rasmiy Matematika ZIP arxivi topilmadi." });
    }
    return res.json({ preview });
  });
  app.post("/api/curriculum-zip/preview", async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "O\u2018quv reja importi faqat administrator uchun." });
    }
    try {
      const { useOfficialAttachedArchive, base64Data, fileName } = req.body || {};
      if (useOfficialAttachedArchive || !base64Data) {
        const preview2 = await getOfficialMathArchivePreview();
        if (!preview2) {
          return res.status(404).json({ error: "Rasmiy Matematika ZIP arxivi topilmadi." });
        }
        return res.json({ preview: preview2 });
      }
      const cleanBase64 = String(base64Data).includes(",") ? String(base64Data).split(",")[1] : String(base64Data);
      const buf = Buffer.from(cleanBase64, "base64");
      const preview = await parseAndValidateCurriculumZipBuffer(
        buf,
        String(fileName || OFFICIAL_MATH_ARCHIVE_DISPLAY_NAME)
      );
      return res.json({ preview });
    } catch (err) {
      return res.status(400).json({
        error: err?.message || "ZIP o\u2018quv rejasini tekshirishda xatolik yuz berdi."
      });
    }
  });
  app.post("/api/curriculum-zip/confirm", async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "O\u2018quv reja importini tasdiqlash faqat administrator uchun." });
    }
    try {
      const {
        jobId,
        useOfficialAttachedArchive,
        base64Data,
        fileName,
        tTrackVisibilityApproved = false,
        publishImmediately = false,
        duplicatePolicy = "skip_existing",
        academicYear
      } = req.body || {};
      let preview;
      if (useOfficialAttachedArchive || !base64Data) {
        preview = await getOfficialMathArchivePreview();
        if (!preview) {
          return res.status(404).json({ error: "Rasmiy Matematika ZIP arxivi topilmadi." });
        }
      } else {
        const cleanBase64 = String(base64Data).includes(",") ? String(base64Data).split(",")[1] : String(base64Data);
        const buf = Buffer.from(cleanBase64, "base64");
        preview = await parseAndValidateCurriculumZipBuffer(
          buf,
          String(fileName || OFFICIAL_MATH_ARCHIVE_DISPLAY_NAME)
        );
      }
      if (preview.errors?.length) return res.status(400).json({ error: "Arxivdagi xatolarni tuzating.", errors: preview.errors });
      if (academicYear && !/^\d{4}-\d{4}$/.test(String(academicYear))) return res.status(400).json({ error: "O\u2018quv yili formati: 2026-2027." });
      if (!Array.isArray(db.curriculumImportJobs)) {
        db.curriculumImportJobs = [];
      }
      const inst = db.institutions.find((i) => i.id === user.institutionId) || db.institutions[0];
      const result = applyCurriculumZipPreviewToDatabase(
        preview,
        db.workPlans,
        db.lessons,
        db.topics,
        db.curriculumImportJobs,
        {
          institutionId: user.institutionId,
          academicYear: academicYear || inst?.academicYear || "2026-2027",
          actorUid: user.uid,
          actorName: user.displayName,
          jobId: jobId ? String(jobId) : void 0,
          tTrackVisibilityApproved: Boolean(tTrackVisibilityApproved),
          publishImmediately: Boolean(publishImmediately),
          duplicatePolicy: duplicatePolicy === "skip_existing" ? "skip_existing" : "update_existing"
        }
      );
      appendAuditLog(
        db,
        user.institutionId,
        user,
        `Matematika rasmiy ZIP o\u2018quv rejasi import qilindi (${preview.totalWorkbooks} ta fayl, ${result.importedLessonsCount} yangi / ${result.updatedLessonsCount} yangilangan dars)`,
        preview.archiveName,
        result.job.id
      );
      saveDbState(env, db);
      broadcastInstitutionUpdate(env, user.institutionId, "CURRICULUM_ZIP_IMPORTED");
      return res.json({
        ...result,
        workPlansCount: db.workPlans.length,
        lessonsCount: db.lessons.length,
        totalWorkbooks: preview.totalWorkbooks,
        totalLessonRecords: preview.totalLessonRecords,
        quarterDistribution: preview.quarterDistribution
      });
    } catch (err) {
      return res.status(400).json({
        error: err?.message || "ZIP o\u2018quv rejasini saqlashda xatolik yuz berdi."
      });
    }
  });
  app.put("/api/curriculum-zip/t-track-visibility", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const approved = Boolean(req.body.tTrackVisibilityApproved ?? req.body.approved);
    const publishLessons = req.body.publishLessons !== void 0 ? Boolean(req.body.publishLessons) : void 0;
    let updatedPlans = 0;
    let updatedLessons = 0;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    for (const wp of db.workPlans || []) {
      if (wp.additionalCurriculumAssignment || wp.track === "T") {
        wp.tTrackVisibilityApproved = approved;
        wp.updatedAt = nowIso;
        updatedPlans++;
      }
    }
    for (const l of db.lessons || []) {
      if (l.additionalCurriculumAssignment || l.track === "T" && l.subjectName === "Matematika") {
        l.tTrackVisibilityApproved = approved;
        if (publishLessons !== void 0) {
          l.status = publishLessons ? "published" : "planned";
          l.publicationStatus = publishLessons ? "PUBLISHED" : "DRAFT_IMPORTED";
        }
        l.updatedAt = nowIso;
        updatedLessons++;
      }
    }
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `T-yo\u2018nalish qo\u2018shimcha Matematika o\u2018quv rejasi ko\u2018rinishi yangilandi: ${approved ? "Tasdiqlandi" : "Yashirildi"}`,
      `7t, 8t, 9t, 10t, 11t (${updatedLessons} dars)`
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "T_TRACK_MATH_VISIBILITY_UPDATED");
    return res.json({
      tTrackVisibilityApproved: approved,
      updatedPlans,
      updatedLessons
    });
  });
  app.post("/api/lessons/bulk-status", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const { lessonIds, workPlanId, classCode, quarter, curriculumArea, status } = req.body || {};
    if (!status || !["planned", "published", "in_progress", "completed", "archived"].includes(status)) {
      return res.status(400).json({ error: "To\u2018g\u2018ri holat (status) tanlang." });
    }
    const idSet = Array.isArray(lessonIds) && lessonIds.length > 0 ? new Set(lessonIds.map(String)) : null;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let updatedCount = 0;
    for (const l of db.lessons || []) {
      if (idSet && !idSet.has(l.id)) continue;
      if (workPlanId && l.workPlanId !== String(workPlanId)) continue;
      if (classCode && !lessonMatchesClass(l, String(classCode))) continue;
      if (quarter && l.quarter !== Number(quarter)) continue;
      if (curriculumArea && (l.curriculumArea || "Matematika").toLowerCase() !== String(curriculumArea).toLowerCase()) {
        continue;
      }
      l.status = status;
      l.publicationStatus = status === "published" || status === "in_progress" || status === "completed" ? "PUBLISHED" : status === "archived" ? "ARCHIVED" : "DRAFT_IMPORTED";
      l.updatedAt = nowIso;
      updatedCount++;
    }
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "LESSONS_BULK_STATUS_UPDATED");
    return res.json({ updatedCount, status });
  });
  app.get("/api/lessons", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    const queryClass = req.query.classCode || req.query.classId;
    if (user.role === "student") {
      const myClass = db.classes.find(
        (c) => c.id === user.classId || user.classCode && c.code.toLowerCase() === user.classCode.toLowerCase()
      );
      if (queryClass && myClass && String(queryClass).toLowerCase() !== myClass.code.toLowerCase() && String(queryClass).toLowerCase() !== myClass.id.toLowerCase()) {
        return res.status(403).json({
          error: "Ruxsat rad etildi (403): Boshqa sinf darslariga kirish taqiqlangan."
        });
      }
      const studentLessons = myClass ? (db.lessons || []).filter(
        (l) => lessonMatchesClass(l, myClass.code) && (!l.additionalCurriculumAssignment || l.tTrackVisibilityApproved === true) && (l.status === "published" || l.status === "in_progress" || l.status === "completed")
      ) : [];
      return res.json({ lessons: studentLessons });
    }
    let result = [...db.lessons || []];
    if (queryClass) {
      result = result.filter((l) => lessonMatchesClass(l, String(queryClass)));
    }
    if (req.query.grade) {
      result = result.filter((l) => l.grade === Number(req.query.grade));
    }
    if (req.query.track) {
      result = result.filter((l) => l.track.toUpperCase() === String(req.query.track).toUpperCase());
    }
    if (req.query.subject) {
      const sLower = String(req.query.subject).toLowerCase();
      result = result.filter(
        (l) => l.subjectName.toLowerCase() === sLower || l.subjectId.toLowerCase() === sLower
      );
    }
    if (req.query.curriculumArea) {
      const areaLower = String(req.query.curriculumArea).toLowerCase();
      result = result.filter(
        (l) => (l.curriculumArea || l.subjectName).toLowerCase() === areaLower
      );
    }
    if (req.query.quarter) {
      result = result.filter((l) => l.quarter === Number(req.query.quarter));
    }
    if (req.query.eventCategory) {
      result = result.filter((l) => l.eventCategory === String(req.query.eventCategory));
    }
    if (req.query.lessonType) {
      result = result.filter(
        (l) => (l.lessonType || "").toLowerCase() === String(req.query.lessonType).toLowerCase()
      );
    }
    if (req.query.status) {
      result = result.filter((l) => l.status === req.query.status);
    }
    if (req.query.q) {
      const qLower = String(req.query.q).trim().toLowerCase();
      result = result.filter(
        (l) => l.title.toLowerCase().includes(qLower) || l.topicTitle && l.topicTitle.toLowerCase().includes(qLower) || l.classwork && l.classwork.toLowerCase().includes(qLower) || l.homework && l.homework.toLowerCase().includes(qLower)
      );
    }
    return res.json({ lessons: result });
  });
  app.post("/api/lessons", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Dars qo\u2018shish faqat administrator uchun." });
    }
    const {
      classId,
      classCode,
      subjectId,
      subjectName,
      quarter = 1,
      lessonNumber,
      unitTitle,
      topicName,
      title,
      learningObjectives,
      content,
      homework,
      scheduledDate,
      status = "planned"
    } = req.body;
    if (!title || String(title).trim().length < 2) {
      return res.status(400).json({ error: "Dars mavzusini kiriting." });
    }
    const lookupClass = String(classCode || classId || "7a1").trim().toLowerCase();
    const cls = db.classes.find(
      (c) => c.id.toLowerCase() === lookupClass || c.code.toLowerCase() === lookupClass
    );
    if (!cls) {
      return res.status(400).json({ error: "Tanlangan sinf topilmadi." });
    }
    const lookupSubj = String(subjectName || subjectId || cls.subject).trim();
    const subj = db.subjects.find(
      (s) => s.id.toLowerCase() === lookupSubj.toLowerCase() || s.name.toLowerCase() === lookupSubj.toLowerCase()
    ) || db.subjects[0];
    const compat = isSubjectCompatibleWithClass(subj.name, cls, db.subjects);
    if (!compat.compatible) {
      return res.status(400).json({ error: compat.reason });
    }
    const cleanTopicName = String(topicName || title).trim();
    let topicRecord = db.topics.find(
      (t) => t.subject.toLowerCase() === subj.name.toLowerCase() && t.name.toLowerCase() === cleanTopicName.toLowerCase()
    );
    if (!topicRecord) {
      topicRecord = {
        id: `topic-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        institutionId: user.institutionId,
        subjectId: subj.id,
        subjectCode: subj.code,
        classCode: cls.code,
        track: cls.track,
        name: cleanTopicName,
        subject: subj.name,
        grade: cls.grade,
        description: String(learningObjectives || cleanTopicName),
        orderIndex: db.topics.length + 1
      };
      db.topics.push(topicRecord);
    }
    const existingClassSubjLessons = db.lessons.filter(
      (l) => l.classCode.toLowerCase() === cls.code.toLowerCase() && l.subjectName.toLowerCase() === subj.name.toLowerCase()
    );
    const nextNum = Number(lessonNumber) || existingClassSubjLessons.length + 1;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const newLesson = {
      id: `lesson-${cls.code}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      institutionId: user.institutionId,
      classId: cls.id,
      classCode: cls.code,
      grade: cls.grade,
      track: cls.track,
      subjectId: subj.id,
      subjectName: subj.name,
      academicYear: cls.academicYear || "2026-2027",
      quarter: [1, 2, 3, 4].includes(Number(quarter)) ? Number(quarter) : 1,
      weekNumber: Math.ceil(nextNum / 3),
      lessonNumber: nextNum,
      unitTitle: String(unitTitle || `${quarter}-chorak bo\u2018limi`).trim(),
      topicId: topicRecord.id,
      topicName: topicRecord.name,
      title: String(title).trim(),
      learningObjectives: String(learningObjectives || "").trim(),
      content: String(content || "").trim(),
      homework: homework ? String(homework).trim() : void 0,
      scheduledDate: scheduledDate ? String(scheduledDate).trim() : void 0,
      hours: 1,
      materials: [],
      relatedAssessmentIds: [],
      status: status || "planned",
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.lessons.push(newLesson);
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Yangi dars qo\u2018shildi (${cls.code}, ${subj.name})`,
      newLesson.title,
      newLesson.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "LESSON_CREATED");
    return res.json({ lesson: newLesson });
  });
  app.put("/api/lessons/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Darsni tahrirlash faqat administrator uchun." });
    }
    const lesson = db.lessons.find((l) => l.id === req.params.id);
    if (!lesson) return res.status(404).json({ error: "Dars topilmadi." });
    const {
      title,
      topicTitle,
      unitTitle,
      topicName,
      lessonType,
      classwork,
      learningObjectives,
      content,
      homework,
      notes,
      hours,
      scheduledDate,
      lessonNumber,
      quarter,
      materials,
      relatedAssessmentIds,
      status
    } = req.body;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const changedFields = [];
    const prevTopicTitle = lesson.topicTitle || lesson.title;
    const prevClasswork = lesson.classwork;
    const prevHomework = lesson.homework;
    const prevStatus = lesson.status;
    const nextTitle = topicTitle !== void 0 ? String(topicTitle).trim() : title !== void 0 ? String(title).trim() : void 0;
    if (nextTitle && nextTitle !== lesson.title) {
      changedFields.push("topicTitle");
      lesson.title = nextTitle;
      lesson.topicTitle = nextTitle;
      lesson.topicName = topicName ? String(topicName).trim() : nextTitle;
    } else if (topicName && String(topicName).trim() !== lesson.topicName) {
      changedFields.push("topicName");
      lesson.topicName = String(topicName).trim();
    }
    if (unitTitle && String(unitTitle).trim() !== lesson.unitTitle) {
      changedFields.push("unitTitle");
      lesson.unitTitle = String(unitTitle).trim();
    }
    if (typeof lessonType === "string" && lessonType.trim() !== lesson.lessonType) {
      changedFields.push("lessonType");
      lesson.lessonType = lessonType.trim();
      const reclassified = classifyCurriculumLessonEvent(lesson.lessonType, lesson.title);
      lesson.eventCategory = reclassified.eventCategory;
      lesson.milestoneType = reclassified.milestoneType;
      lesson.milestoneCode = reclassified.milestoneCode;
      if (reclassified.maxPoints !== void 0) lesson.maxPoints = reclassified.maxPoints;
    }
    if (typeof classwork === "string" && classwork.trim() !== (lesson.classwork || "")) {
      changedFields.push("classwork");
      lesson.classwork = classwork.trim();
    }
    if (typeof learningObjectives === "string" && learningObjectives.trim() !== lesson.learningObjectives) {
      changedFields.push("learningObjectives");
      lesson.learningObjectives = learningObjectives.trim();
    }
    if (typeof content === "string" && content.trim() !== lesson.content) {
      changedFields.push("content");
      lesson.content = content.trim();
    }
    if (typeof homework === "string" && homework.trim() !== (lesson.homework || "")) {
      changedFields.push("homework");
      lesson.homework = homework.trim();
    }
    if (typeof notes === "string" && notes.trim() !== (lesson.notes || "")) {
      changedFields.push("notes");
      lesson.notes = notes.trim();
    }
    if (hours !== void 0 && Number(hours) > 0 && Number(hours) !== lesson.hours) {
      changedFields.push("hours");
      lesson.hours = Number(hours);
    }
    if (typeof scheduledDate === "string") {
      changedFields.push("scheduledDate");
      lesson.scheduledDate = scheduledDate.trim() || void 0;
    }
    if (lessonNumber !== void 0 && Number(lessonNumber) !== lesson.lessonNumber) {
      changedFields.push("lessonOrder");
      lesson.lessonNumber = Number(lessonNumber);
      lesson.lessonOrder = Number(lessonNumber);
    }
    if (quarter !== void 0 && [1, 2, 3, 4].includes(Number(quarter)) && Number(quarter) !== lesson.quarter) {
      changedFields.push("quarter");
      lesson.quarter = Number(quarter);
      lesson.quarterLabel = `${lesson.quarter}-chorak`;
    }
    if (Array.isArray(materials)) {
      changedFields.push("materials");
      lesson.materials = materials;
    }
    if (Array.isArray(relatedAssessmentIds)) {
      lesson.relatedAssessmentIds = relatedAssessmentIds.map(String);
    }
    if (status && ["planned", "draft", "published", "in_progress", "completed", "archived"].includes(status) && status !== lesson.status) {
      changedFields.push("status");
      lesson.status = status === "draft" ? "planned" : status;
      lesson.publicationStatus = status === "published" || status === "in_progress" || status === "completed" ? "PUBLISHED" : status === "archived" ? "ARCHIVED" : "DRAFT_IMPORTED";
    }
    if (changedFields.length > 0) {
      if (!Array.isArray(lesson.modificationHistory)) {
        lesson.modificationHistory = [];
      }
      lesson.modificationHistory.unshift({
        id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        editedAt: nowIso,
        editedByUid: user.uid,
        editedByName: user.displayName,
        modifiedAt: nowIso,
        modifiedBy: user.displayName,
        changedFields,
        previousTopicTitle: prevTopicTitle,
        previousClasswork: prevClasswork,
        previousHomework: prevHomework,
        previousStatus: prevStatus
      });
    }
    lesson.updatedAt = nowIso;
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Dars yangilandi (${lesson.classCode} \u2014 ${lesson.status})`,
      lesson.title,
      lesson.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "LESSON_UPDATED");
    return res.json({ lesson });
  });
  app.post("/api/lessons/:id/generate-test", async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Dars asosida test yaratish faqat administrator uchun." });
    }
    const lesson = db.lessons.find((l) => l.id === req.params.id);
    if (!lesson) {
      return res.status(404).json({ error: "Dars topilmadi." });
    }
    const {
      questionCount = 10,
      difficulty = "medium",
      questionTypes = ["single_choice", "multiple_choice", "numeric", "short_text"],
      maxPoints,
      durationMinutes = 30,
      referenceText,
      title,
      publishImmediately = false
    } = req.body || {};
    let precedingLessons = [];
    if (Array.isArray(lesson.precedingLessonIds) && lesson.precedingLessonIds.length > 0) {
      const idSet = new Set(lesson.precedingLessonIds);
      precedingLessons = db.lessons.filter((l) => idSet.has(l.id));
    }
    const resolvedMaxPoints = maxPoints !== void 0 && Number(maxPoints) > 0 ? Number(maxPoints) : lesson.maxPoints;
    const generatedQuestions = buildCurriculumLessonQuestions({
      institutionId: user.institutionId,
      authorId: user.uid,
      lesson,
      precedingLessons,
      questionCount: Number(questionCount) || 10,
      difficulty: difficulty || "medium",
      questionTypes: Array.isArray(questionTypes) && questionTypes.length > 0 ? questionTypes : ["single_choice", "multiple_choice", "numeric", "short_text"],
      maxPoints: resolvedMaxPoints,
      referenceText: referenceText ? String(referenceText) : void 0
    });
    for (const q of generatedQuestions) {
      db.questions.unshift(q);
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const totalPoints = generatedQuestions.reduce((acc, q) => acc + (q.points || 1), 0);
    const area = lesson.curriculumArea || lesson.subjectName || "Matematika";
    const classCodesLabel = Array.isArray(lesson.classCodes) && lesson.classCodes.length > 0 ? lesson.classCodes.map((c) => c.toUpperCase()).join("/") : lesson.classCode.toUpperCase();
    const defaultTitle = lesson.eventCategory === "WRITTEN_ASSESSMENT" || lesson.eventCategory === "QUARTERLY_ASSESSMENT" ? `${classCodesLabel} \u2014 ${area}: ${lesson.title} (${lesson.quarter}-chorak nazorat testi)` : `${classCodesLabel} \u2014 ${area}: ${lesson.lessonNumber}-dars (${lesson.title}) testi`;
    const isPublished = Boolean(publishImmediately);
    const draftAssessment = {
      id: `assess-les-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `CUR-${lesson.classCode.toUpperCase()}-L${lesson.lessonNumber}-${Date.now().toString().slice(-3)}`,
      title: title && String(title).trim() ? String(title).trim() : defaultTitle,
      description: precedingLessons.length > 0 ? `${lesson.title} (${lesson.quarter}-chorak, ${precedingLessons.length} ta oldingi dars mavzulari qamrab olingan) asosida yaratilgan test.` : `${lesson.lessonNumber}-dars ("${lesson.title}") sinf ishi (${lesson.classwork || "-"}) va uyga vazifa (${lesson.homework || "-"}) asosida yaratilgan test.`,
      subject: lesson.subjectName || "Matematika",
      subjectId: lesson.subjectId || "subj-matematika",
      subjectCode: "MAT",
      curriculumArea: lesson.curriculumArea,
      grade: lesson.grade,
      track: lesson.track,
      quarter: lesson.quarter,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      blueprintLessonIds: precedingLessons.length > 0 ? precedingLessons.map((l) => l.id) : [lesson.id],
      milestoneCode: lesson.milestoneCode,
      maxPoints: resolvedMaxPoints || totalPoints,
      topicIds: Array.from(
        new Set([lesson.topicId, ...precedingLessons.map((l) => l.topicId)].filter(Boolean))
      ),
      questionIds: generatedQuestions.map((q) => q.id),
      questionSnapshot: isPublished ? generatedQuestions.map((q) => ({ ...q })) : void 0,
      durationMinutes: Number(durationMinutes) || 30,
      passingScorePercent: 60,
      totalPoints,
      availableFrom: nowIso.slice(0, 10),
      dueDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
      classId: lesson.classId,
      classCode: lesson.classCode,
      assignedClassIds: lesson.classIds || [lesson.classId],
      assignedClassCodes: lesson.classCodes || [lesson.classCode],
      teacherId: user.uid,
      institutionId: user.institutionId,
      source: "ai_generated",
      status: isPublished ? "published" : "draft",
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.assessments.unshift(draftAssessment);
    lesson.relatedAssessmentIds = Array.from(
      /* @__PURE__ */ new Set([...lesson.relatedAssessmentIds || [], draftAssessment.id])
    );
    lesson.linkedAssessmentIds = Array.from(
      /* @__PURE__ */ new Set([...lesson.linkedAssessmentIds || [], draftAssessment.id])
    );
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Dars asosida test yaratildi (${classCodesLabel}, ${area}, ${generatedQuestions.length} ta savol, ${totalPoints} ball)`,
      draftAssessment.title,
      draftAssessment.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "LESSON_TEST_GENERATED");
    return res.json({
      assessment: draftAssessment,
      questions: generatedQuestions,
      blueprintLessonsCount: precedingLessons.length > 0 ? precedingLessons.length : 1
    });
  });
  app.post("/api/lessons/batch-generate-tests", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ommaviy test yaratish faqat administrator uchun." });
    }
    const {
      lessonIds,
      title,
      questionCount = 10,
      difficulty = "medium",
      questionTypes = ["single_choice", "multiple_choice", "numeric", "short_text"],
      durationMinutes = 25,
      maxPoints,
      referenceText,
      publishImmediately = false
    } = req.body || {};
    if (!Array.isArray(lessonIds) || lessonIds.length === 0) {
      return res.status(400).json({ error: "Kamida 1 ta darsni tanlang." });
    }
    const targetLessons = lessonIds.map((lid) => db.lessons.find((l) => l.id === String(lid))).filter((l) => Boolean(l));
    if (targetLessons.length === 0) {
      return res.status(404).json({ error: "Tanlangan darslar topilmadi." });
    }
    const primaryLesson = targetLessons[0];
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const isPublished = Boolean(publishImmediately);
    const generatedQuestions = buildCurriculumLessonQuestions({
      institutionId: user.institutionId,
      authorId: user.uid,
      lesson: primaryLesson,
      precedingLessons: targetLessons,
      questionCount: Number(questionCount) || 10,
      difficulty: difficulty || "medium",
      questionTypes: Array.isArray(questionTypes) && questionTypes.length > 0 ? questionTypes : ["single_choice", "multiple_choice", "numeric", "short_text"],
      maxPoints: maxPoints ? Number(maxPoints) : primaryLesson.maxPoints,
      referenceText: referenceText ? String(referenceText) : void 0
    });
    for (const q of generatedQuestions) {
      db.questions.unshift(q);
    }
    const totalPoints = generatedQuestions.reduce((acc, q) => acc + (q.points || 1), 0);
    const area = primaryLesson.curriculumArea || primaryLesson.subjectName || "Matematika";
    const classCodesLabel = Array.isArray(primaryLesson.classCodes) && primaryLesson.classCodes.length > 0 ? primaryLesson.classCodes.map((c) => c.toUpperCase()).join("/") : primaryLesson.classCode.toUpperCase();
    const defaultBatchTitle = title && String(title).trim() ? String(title).trim() : `${classCodesLabel} \u2014 ${area}: Tanlangan ${targetLessons.length} ta dars umumlashgan testi`;
    const combinedAssessment = {
      id: `assess-batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `BATCH-${primaryLesson.classCode.toUpperCase()}-${targetLessons.length}L`,
      title: defaultBatchTitle,
      description: `Tanlangan ${targetLessons.length} ta dars (${targetLessons.map((l) => `${l.lessonNumber}-dars`).join(", ")}) mavzulari asosida yaratilgan umumlashgan test.`,
      subject: primaryLesson.subjectName || "Matematika",
      subjectId: primaryLesson.subjectId || "subj-matematika",
      subjectCode: "MAT",
      curriculumArea: primaryLesson.curriculumArea,
      grade: primaryLesson.grade,
      track: primaryLesson.track,
      quarter: primaryLesson.quarter,
      lessonId: primaryLesson.id,
      lessonTitle: primaryLesson.title,
      blueprintLessonIds: targetLessons.map((l) => l.id),
      milestoneCode: primaryLesson.milestoneCode,
      maxPoints: maxPoints ? Number(maxPoints) : totalPoints,
      topicIds: Array.from(new Set(targetLessons.map((l) => l.topicId).filter(Boolean))),
      questionIds: generatedQuestions.map((q) => q.id),
      questionSnapshot: isPublished ? generatedQuestions.map((q) => ({ ...q })) : void 0,
      durationMinutes: Number(durationMinutes) || 25,
      passingScorePercent: 60,
      totalPoints,
      availableFrom: nowIso.slice(0, 10),
      dueDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
      classId: primaryLesson.classId,
      classCode: primaryLesson.classCode,
      assignedClassIds: primaryLesson.classIds || [primaryLesson.classId],
      assignedClassCodes: primaryLesson.classCodes || [primaryLesson.classCode],
      teacherId: user.uid,
      institutionId: user.institutionId,
      source: "ai_generated",
      status: isPublished ? "published" : "draft",
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.assessments.unshift(combinedAssessment);
    for (const lesson of targetLessons) {
      lesson.relatedAssessmentIds = Array.from(
        /* @__PURE__ */ new Set([...lesson.relatedAssessmentIds || [], combinedAssessment.id])
      );
      lesson.linkedAssessmentIds = Array.from(
        /* @__PURE__ */ new Set([...lesson.linkedAssessmentIds || [], combinedAssessment.id])
      );
    }
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Tanlangan ${targetLessons.length} ta dars uchun umumlashgan test yaratildi`,
      combinedAssessment.title,
      combinedAssessment.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "BATCH_LESSON_TESTS_GENERATED");
    return res.json({
      createdCount: 1,
      assessment: combinedAssessment,
      questions: generatedQuestions,
      assessments: [combinedAssessment]
    });
  });
  app.delete("/api/lessons/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const idx = db.lessons.findIndex((l) => l.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Dars topilmadi." });
    db.lessons.splice(idx, 1);
    saveDbState(env, db);
    return res.json({ status: "ok" });
  });
  app.post("/api/ai/generate-test", async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "AI test generatori faqat administrator uchun." });
    }
    const {
      classId,
      classCode,
      subjectName,
      subjectId,
      lessonId,
      topicId,
      quarter,
      questionCount = 10,
      difficulty = "medium",
      questionTypes = ["single_choice", "multiple_choice", "numeric", "short_text"],
      durationMinutes = 30,
      title
    } = req.body;
    const lookupClass = String(classCode || classId || "7a1").trim().toLowerCase();
    const cls = db.classes.find(
      (c) => c.id.toLowerCase() === lookupClass || c.code.toLowerCase() === lookupClass
    ) || db.classes[0];
    const lookupSubj = String(subjectName || subjectId || cls.subject).trim();
    const subj = db.subjects.find(
      (s) => s.id.toLowerCase() === lookupSubj.toLowerCase() || s.name.toLowerCase() === lookupSubj.toLowerCase()
    ) || db.subjects[0];
    const compat = isSubjectCompatibleWithClass(subj.name, cls, db.subjects);
    if (!compat.compatible) {
      return res.status(400).json({ error: compat.reason });
    }
    const matchedLesson = lessonId ? db.lessons.find((l) => l.id === lessonId) : db.lessons.find(
      (l) => l.classCode.toLowerCase() === cls.code.toLowerCase() && l.subjectName.toLowerCase() === subj.name.toLowerCase()
    );
    let matchedTopic = topicId ? db.topics.find((t) => t.id === topicId) : matchedLesson ? db.topics.find((t) => t.id === matchedLesson.topicId) : db.topics.find((t) => t.subject.toLowerCase() === subj.name.toLowerCase());
    if (!matchedTopic) {
      matchedTopic = {
        id: `topic-${Date.now()}`,
        institutionId: user.institutionId,
        subjectId: subj.id,
        subjectCode: subj.code,
        name: matchedLesson?.topicName || `${subj.name} asosiy mavzusi`,
        subject: subj.name,
        grade: cls.grade,
        description: subj.description,
        orderIndex: db.topics.length + 1
      };
      db.topics.push(matchedTopic);
    }
    const generatedQuestions = buildStructuredQuestionsForLessonOrTopic({
      institutionId: user.institutionId,
      authorId: user.uid,
      classCode: cls.code,
      grade: cls.grade,
      subjectName: subj.name,
      subjectCode: subj.code,
      lesson: matchedLesson,
      topic: matchedTopic,
      count: Number(questionCount) || 10,
      difficulty: difficulty || "medium",
      questionTypes: Array.isArray(questionTypes) && questionTypes.length > 0 ? questionTypes : ["single_choice", "multiple_choice", "numeric", "short_text"]
    });
    for (const q of generatedQuestions) {
      db.questions.unshift(q);
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const totalPoints = generatedQuestions.reduce((acc, q) => acc + (q.points || 1), 0);
    const assessmentTitle = title && String(title).trim() ? String(title).trim() : matchedLesson ? `${cls.code.toUpperCase()} \u2014 ${subj.name}: ${matchedLesson.lessonNumber}-dars (${matchedLesson.title}) testi` : `${cls.code.toUpperCase()} \u2014 ${subj.name}: ${matchedTopic.name} diagnostik testi`;
    const draftAssessment = {
      id: `assess-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `AI-${cls.code.toUpperCase()}-${Date.now().toString().slice(-4)}`,
      title: assessmentTitle,
      description: `AI yordamida yaratilgan ${generatedQuestions.length} ta savolli qoralama test.`,
      subject: subj.name,
      subjectId: subj.id,
      subjectCode: subj.code,
      grade: cls.grade,
      track: cls.track,
      quarter: quarter ? Number(quarter) : matchedLesson?.quarter,
      lessonId: matchedLesson?.id,
      lessonTitle: matchedLesson?.title,
      topicIds: [matchedTopic.id],
      questionIds: generatedQuestions.map((q) => q.id),
      durationMinutes: Number(durationMinutes) || 30,
      passingScorePercent: 60,
      totalPoints,
      availableFrom: nowIso.slice(0, 10),
      dueDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
      classId: cls.id,
      classCode: cls.code,
      teacherId: user.uid,
      institutionId: user.institutionId,
      source: "ai_generated",
      status: "draft",
      // Always saved as draft until Admin reviews and publishes
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.assessments.unshift(draftAssessment);
    if (matchedLesson) {
      matchedLesson.relatedAssessmentIds = Array.from(
        /* @__PURE__ */ new Set([...matchedLesson.relatedAssessmentIds || [], draftAssessment.id])
      );
    }
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `AI test qoralamasi yaratildi (${cls.code}, ${subj.name}, ${generatedQuestions.length} ta savol)`,
      draftAssessment.title,
      draftAssessment.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "ASSESSMENT_DRAFTED");
    return res.json({
      assessment: draftAssessment,
      questions: generatedQuestions
    });
  });
  app.post("/api/ai/command", async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "AI Buyruqlar Markazi faqat administrator uchun." });
    }
    const commandText = String(req.body.command || req.body.prompt || "").trim();
    if (!commandText) {
      return res.status(400).json({ error: "Buyruq matnini kiriting." });
    }
    const parsed = parseUzbekAICommand(
      commandText,
      db.classes,
      db.subjects,
      db.lessons || [],
      db.workPlans || []
    );
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const cls = parsed.matchedClass || db.classes[0];
    const subj = parsed.matchedSubject || db.subjects[0];
    if (parsed.intent === "show_class_students" || parsed.intent === "sort_class_students") {
      const classStudents = db.users.filter(
        (u) => u.role === "student" && u.status !== "archived" && (u.classId === cls.id || u.classCode && u.classCode.toLowerCase() === cls.code.toLowerCase())
      ).sort((a, b) => a.displayName.localeCompare(b.displayName, "uz"));
      const execResult = {
        id: `cmd-${Date.now()}`,
        commandText,
        intent: parsed.intent,
        matchedClass: cls,
        matchedSubject: subj,
        matchedStudents: classStudents,
        warnings: parsed.warnings,
        message: classStudents.length > 0 ? `${cls.code.toUpperCase()} sinfidagi ${classStudents.length} nafar o'quvchi alifbo tartibida saralandi.` : `${cls.code.toUpperCase()} sinfida hozircha o'quvchilar ro'yxatga olinmagan.`,
        createdAt: nowIso
      };
      return res.json({
        ...execResult,
        students: classStudents,
        parsedIntent: {
          intent: parsed.intent,
          classCode: cls.code,
          grade: cls.grade,
          track: cls.track,
          subject: subj.name
        }
      });
    }
    if (parsed.intent === "show_upcoming_lessons") {
      const upcoming = (db.lessons || []).filter(
        (l) => l.classCode.toLowerCase() === cls.code.toLowerCase() && (!parsed.quarter || l.quarter === parsed.quarter) && l.status !== "completed" && l.status !== "archived"
      ).slice(0, parsed.questionCount || 10);
      const execResult = {
        id: `cmd-${Date.now()}`,
        commandText,
        intent: "show_upcoming_lessons",
        matchedClass: cls,
        matchedSubject: subj,
        upcomingLessons: upcoming,
        warnings: parsed.warnings,
        message: upcoming.length > 0 ? `${cls.code.toUpperCase()} sinfining keyingi ${upcoming.length} ta darsi topildi.` : `${cls.code.toUpperCase()} sinfi uchun rejalashtirilgan darslar hali kiritilmagan.`,
        createdAt: nowIso
      };
      return res.json(execResult);
    }
    if (parsed.intent === "convert_work_plan_to_map") {
      const targetPlan = parsed.matchedWorkPlan || db.workPlans.find((wp) => wp.classCode.toLowerCase() === cls.code.toLowerCase());
      if (!targetPlan) {
        return res.json({
          id: `cmd-${Date.now()}`,
          commandText,
          intent: "convert_work_plan_to_map",
          matchedClass: cls,
          matchedSubject: subj,
          warnings: [
            `${cls.code.toUpperCase()} sinfi uchun yuklangan ish reja topilmadi. Avval "Ish rejalari" bo\u2018limida fayl yuklang.`
          ],
          message: `${cls.code.toUpperCase()} sinfi uchun ish reja topilmadi.`,
          createdAt: nowIso
        });
      }
      targetPlan.status = "confirmed";
      targetPlan.confirmedAt = nowIso;
      const builtLessons = [];
      for (const row of targetPlan.rows) {
        let topicRec = db.topics.find(
          (t) => t.subject.toLowerCase() === targetPlan.subjectName.toLowerCase() && t.name.toLowerCase() === row.topicName.toLowerCase()
        );
        if (!topicRec) {
          topicRec = {
            id: `topic-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            institutionId: user.institutionId,
            subjectId: targetPlan.subjectId,
            name: row.topicName,
            subject: targetPlan.subjectName,
            grade: targetPlan.grade,
            classCode: targetPlan.classCode,
            track: targetPlan.track,
            description: row.learningObjectives,
            orderIndex: db.topics.length + 1
          };
          db.topics.push(topicRec);
        }
        const existingLesson = db.lessons.find(
          (l) => l.classCode.toLowerCase() === targetPlan.classCode.toLowerCase() && l.subjectName.toLowerCase() === targetPlan.subjectName.toLowerCase() && l.lessonNumber === row.lessonNumber
        );
        if (!existingLesson) {
          const lessonItem = {
            id: `lesson-${targetPlan.classCode}-${Date.now()}-${row.lessonNumber}`,
            institutionId: user.institutionId,
            workPlanId: targetPlan.id,
            classId: targetPlan.classId,
            classCode: targetPlan.classCode,
            grade: targetPlan.grade,
            track: targetPlan.track,
            subjectId: targetPlan.subjectId,
            subjectName: targetPlan.subjectName,
            academicYear: targetPlan.academicYear,
            quarter: row.quarter || 1,
            weekNumber: row.weekNumber || Math.ceil(row.lessonNumber / 3),
            lessonNumber: row.lessonNumber,
            unitTitle: row.unitTitle,
            topicId: topicRec.id,
            topicName: topicRec.name,
            title: row.lessonTitle,
            learningObjectives: row.learningObjectives,
            content: `${row.lessonTitle} \u2014 ${row.learningObjectives}`,
            scheduledDate: row.scheduledDate,
            hours: row.hours || 1,
            materials: [],
            relatedAssessmentIds: [],
            status: "planned",
            createdAt: nowIso,
            updatedAt: nowIso
          };
          db.lessons.push(lessonItem);
          builtLessons.push(lessonItem);
        }
      }
      saveDbState(env, db);
      return res.json({
        id: `cmd-${Date.now()}`,
        commandText,
        intent: "convert_work_plan_to_map",
        matchedClass: cls,
        matchedSubject: subj,
        convertedWorkPlan: targetPlan,
        upcomingLessons: builtLessons,
        warnings: parsed.warnings,
        message: `${targetPlan.classCode.toUpperCase()} sinfi ish rejasi asosida o\u2018quv xaritasi yangilandi (${builtLessons.length} ta yangi dars).`,
        createdAt: nowIso
      });
    }
    const lessonObj = parsed.matchedLesson;
    let topicObj = lessonObj ? db.topics.find((t) => t.id === lessonObj.topicId) : db.topics.find((t) => t.subject.toLowerCase() === subj.name.toLowerCase());
    if (!topicObj) {
      topicObj = {
        id: `topic-${Date.now()}`,
        institutionId: user.institutionId,
        subjectId: subj.id,
        subjectCode: subj.code,
        name: lessonObj?.topicName || `${subj.name} (${parsed.quarter || 1}-chorak mavzulari)`,
        subject: subj.name,
        grade: cls.grade,
        description: subj.description,
        orderIndex: db.topics.length + 1
      };
      db.topics.push(topicObj);
    }
    const generatedQuestions = buildStructuredQuestionsForLessonOrTopic({
      institutionId: user.institutionId,
      authorId: user.uid,
      classCode: cls.code,
      grade: cls.grade,
      subjectName: subj.name,
      subjectCode: subj.code,
      lesson: lessonObj,
      topic: topicObj,
      count: parsed.questionCount,
      difficulty: parsed.difficulty
    });
    for (const q of generatedQuestions) {
      db.questions.unshift(q);
    }
    const totalPoints = generatedQuestions.reduce((acc, q) => acc + (q.points || 1), 0);
    const titleLabel = parsed.intent === "generate_quarter_review_test" ? `${cls.code.toUpperCase()} \u2014 ${subj.name}: ${parsed.quarter || 2}-chorak takrorlash testi` : lessonObj ? `${cls.code.toUpperCase()} \u2014 ${subj.name}: ${lessonObj.lessonNumber}-dars (${lessonObj.title}) testi` : parsed.lessonNumber ? `${cls.code.toUpperCase()} \u2014 ${subj.name}: ${parsed.lessonNumber}-dars bo\u2018yicha test` : `${cls.code.toUpperCase()} \u2014 ${subj.name}: Bugungi dars testi`;
    const draftAssessment = {
      id: `assess-cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: `CMD-${cls.code.toUpperCase()}-${Date.now().toString().slice(-4)}`,
      title: titleLabel,
      description: `Buyruq asosida tuzilgan qoralama test: "${commandText}"`,
      subject: subj.name,
      subjectId: subj.id,
      subjectCode: subj.code,
      grade: cls.grade,
      track: cls.track,
      quarter: parsed.quarter || lessonObj?.quarter || 1,
      lessonId: lessonObj?.id,
      lessonTitle: lessonObj?.title,
      topicIds: [topicObj.id],
      questionIds: generatedQuestions.map((q) => q.id),
      durationMinutes: Math.max(15, parsed.questionCount * 2),
      passingScorePercent: 60,
      totalPoints,
      availableFrom: nowIso.slice(0, 10),
      dueDate: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
      classId: cls.id,
      classCode: cls.code,
      teacherId: user.uid,
      institutionId: user.institutionId,
      source: "ai_generated",
      status: "draft",
      // Never auto-published without Admin review
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.assessments.unshift(draftAssessment);
    if (lessonObj) {
      lessonObj.relatedAssessmentIds = Array.from(
        /* @__PURE__ */ new Set([...lessonObj.relatedAssessmentIds || [], draftAssessment.id])
      );
    }
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `AI buyruq bajarildi: ${draftAssessment.title} (qoralama)`,
      commandText,
      draftAssessment.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "AI_COMMAND_EXECUTED");
    const resultPayload = {
      id: `cmd-${Date.now()}`,
      commandText,
      intent: parsed.intent,
      matchedClass: cls,
      matchedSubject: subj,
      matchedLesson: lessonObj,
      questionCount: generatedQuestions.length,
      difficulty: parsed.difficulty,
      quarter: parsed.quarter,
      generatedAssessment: draftAssessment,
      generatedQuestions,
      warnings: parsed.warnings,
      message: `${cls.code.toUpperCase()} sinfi uchun ${subj.name} fanidan ${generatedQuestions.length} ta savolli qoralama test tayyorlandi. Ko\u2018rib chiqib, "Nashr qilish" tugmasini bosing.`,
      createdAt: nowIso
    };
    return res.json({
      ...resultPayload,
      parsedIntent: {
        classCode: cls.code,
        grade: cls.grade,
        track: cls.track,
        subject: subj.name,
        questionCount: generatedQuestions.length
      },
      assessment: draftAssessment,
      questions: generatedQuestions
    });
  });
  app.post("/api/media/upload", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "teacher" && user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Rasm yuklash faqat o\u2018qituvchi va administrator uchun." });
    }
    const { fileName, base64Data, dataUrl, institutionId, assessmentId, questionId, width, height } = req.body;
    const targetInstId = isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL) && institutionId ? String(institutionId) : user.institutionId;
    if (!canAccessInstitution(user, targetInstId)) {
      return res.status(403).json({ error: "Boshqa muassasaga rasm yuklash taqiqlangan." });
    }
    let rawBase64 = String(base64Data || "");
    if (!rawBase64 && typeof dataUrl === "string" && dataUrl.includes(",")) {
      rawBase64 = dataUrl.split(",")[1];
    }
    if (!rawBase64) {
      return res.status(400).json({ error: "Rasm ma\u2019lumotlari topilmadi." });
    }
    const bytes = new Uint8Array(Buffer.from(rawBase64, "base64"));
    const check = validateUploadedImageMeta(String(fileName || "image.png"), bytes.byteLength, bytes);
    if (!check.valid || !check.mimeType) {
      return res.status(400).json({ error: check.error || "Yaroqsiz rasm fayli." });
    }
    const safeFileName = String(fileName || "image.png").replace(/[^a-zA-Z0-9._-]/g, "_");
    const mediaId = `media-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const storagePath = `institutions/${targetInstId}/assessments/${assessmentId || "bank"}/questions/${questionId || mediaId}/${safeFileName}`;
    const resolvedDataUrl = `data:${check.mimeType};base64,${rawBase64}`;
    const mediaRecord = {
      id: mediaId,
      institutionId: targetInstId,
      questionId: questionId ? String(questionId) : void 0,
      fileName: safeFileName,
      mimeType: check.mimeType,
      sizeBytes: bytes.byteLength,
      width: width ? Number(width) : void 0,
      height: height ? Number(height) : void 0,
      storagePath,
      dataUrl: resolvedDataUrl,
      uploadedByUid: user.uid,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.questionMedia.unshift(mediaRecord);
    appendAuditLog(
      db,
      targetInstId,
      user,
      "Savol/muassasa media fayli yuklandi",
      `${safeFileName} (${Math.round(bytes.byteLength / 1024)} KB)`,
      mediaId
    );
    saveDbState(env, db);
    return res.json({ media: mediaRecord });
  });
  app.get("/api/media/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    const media = db.questionMedia.find((m) => m.id === req.params.id);
    if (!media) return res.status(404).json({ error: "Media fayli topilmadi." });
    if (!isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL) && !canAccessInstitution(user, media.institutionId)) {
      return res.status(403).json({
        error: "Ruxsat rad etildi (403 Forbidden): Boshqa muassasaning media fayllariga kirish taqiqlangan."
      });
    }
    return res.json({ media });
  });
  app.post("/api/questions", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "teacher" && user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Savol yaratish faqat o\u2018qituvchi va administrator uchun." });
    }
    const {
      institutionId,
      code,
      title,
      instructions,
      subject,
      grade,
      topicId,
      difficulty,
      type,
      points,
      prompt,
      options,
      structuredOptions,
      correctAnswer,
      correctAnswers,
      numericTolerance,
      acceptedAnswers,
      gradingMode,
      rubricText,
      explanation,
      imageUrl,
      mediaId,
      explanationImageUrl,
      explanationMediaId,
      status
    } = req.body;
    if (!prompt || String(prompt).trim().length < 3) {
      return res.status(400).json({ error: "Savol matni kamida 3 ta belgidan iborat bo\u2018lishi kerak." });
    }
    const qType = type || "multiple_choice";
    const resolvedCorrectAnswer = String(correctAnswer ?? "").trim();
    if (qType !== "long_text" && !resolvedCorrectAnswer && (!Array.isArray(correctAnswers) || correctAnswers.length === 0)) {
      return res.status(400).json({ error: "To\u2018g\u2018ri javobni kiriting." });
    }
    const targetInstId = isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL) && institutionId ? String(institutionId) : user.institutionId;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const newQ = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: code ? String(code).trim().toUpperCase() : `Q-${Math.floor(1e3 + Math.random() * 9e3)}`,
      title: title ? String(title).trim() : void 0,
      instructions: instructions ? String(instructions).trim() : void 0,
      institutionId: targetInstId,
      authorId: user.uid,
      subject: String(subject || "Matematika").trim(),
      grade: Number(grade) || 8,
      topicId: String(topicId || "topic-fractions"),
      difficulty: difficulty || "medium",
      type: qType,
      points: Number(points) > 0 ? Number(points) : 1,
      prompt: String(prompt).trim(),
      options: Array.isArray(options) ? options.map(String) : void 0,
      structuredOptions: Array.isArray(structuredOptions) ? structuredOptions : void 0,
      correctAnswer: resolvedCorrectAnswer || (Array.isArray(correctAnswers) ? correctAnswers.join("|") : ""),
      correctAnswers: Array.isArray(correctAnswers) ? correctAnswers.map(String) : void 0,
      numericTolerance: numericTolerance !== void 0 && numericTolerance !== null && numericTolerance !== "" ? Number(numericTolerance) : void 0,
      acceptedAnswers: Array.isArray(acceptedAnswers) ? acceptedAnswers : void 0,
      gradingMode: gradingMode || (qType === "long_text" ? "manual_rubric" : "auto"),
      rubricText: rubricText ? String(rubricText).trim() : void 0,
      explanation: String(explanation || "Yechim qadamlari asosida hisoblandi.").trim(),
      imageUrl: imageUrl ? String(imageUrl) : void 0,
      mediaId: mediaId ? String(mediaId) : void 0,
      explanationImageUrl: explanationImageUrl ? String(explanationImageUrl) : void 0,
      explanationMediaId: explanationMediaId ? String(explanationMediaId) : void 0,
      version: 1,
      status: status === "draft" ? "draft" : "approved",
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.questions.unshift(newQ);
    appendAuditLog(
      db,
      targetInstId,
      user,
      `Yangi savol yaratildi (${newQ.type})`,
      `${newQ.code}: ${newQ.prompt.slice(0, 50)}`,
      newQ.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, targetInstId, "QUESTION_CREATED");
    return res.json({ question: newQ });
  });
  app.put("/api/questions/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    const isOwner = isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL);
    const q = db.questions.find(
      (item) => item.id === req.params.id && (isOwner || item.institutionId === user.institutionId)
    );
    if (!q) return res.status(404).json({ error: "Savol topilmadi." });
    if (user.role !== "admin" && user.role !== "teacher" && !isOwner) {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const revision = {
      id: `qrev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      questionId: q.id,
      institutionId: q.institutionId,
      version: q.version || 1,
      snapshot: JSON.parse(JSON.stringify(q)),
      editedByUid: user.uid,
      editedByName: user.displayName,
      reason: req.body.revisionReason ? String(req.body.revisionReason) : "Savol tahrirlandi",
      createdAt: nowIso
    };
    db.questionRevisions.unshift(revision);
    const {
      code,
      title,
      instructions,
      prompt,
      type,
      points,
      options,
      structuredOptions,
      correctAnswer,
      correctAnswers,
      numericTolerance,
      acceptedAnswers,
      gradingMode,
      rubricText,
      explanation,
      difficulty,
      topicId,
      status,
      subject,
      grade,
      imageUrl,
      mediaId,
      explanationImageUrl,
      explanationMediaId
    } = req.body;
    if (code) q.code = String(code).trim().toUpperCase();
    if (typeof title === "string") q.title = title.trim() || void 0;
    if (typeof instructions === "string") q.instructions = instructions.trim() || void 0;
    if (prompt) q.prompt = String(prompt).trim();
    if (type) q.type = type;
    if (points !== void 0 && Number(points) > 0) q.points = Number(points);
    if (Array.isArray(options)) q.options = options.map(String);
    if (Array.isArray(structuredOptions)) q.structuredOptions = structuredOptions;
    if (typeof correctAnswer === "string") q.correctAnswer = correctAnswer.trim();
    if (Array.isArray(correctAnswers)) q.correctAnswers = correctAnswers.map(String);
    if (numericTolerance !== void 0) {
      q.numericTolerance = numericTolerance === null || numericTolerance === "" ? void 0 : Number(numericTolerance);
    }
    if (Array.isArray(acceptedAnswers)) q.acceptedAnswers = acceptedAnswers;
    if (gradingMode) q.gradingMode = gradingMode;
    if (typeof rubricText === "string") q.rubricText = rubricText.trim() || void 0;
    if (explanation) q.explanation = String(explanation).trim();
    if (difficulty) q.difficulty = difficulty;
    if (topicId) q.topicId = String(topicId);
    if (status) q.status = status;
    if (subject) q.subject = String(subject).trim();
    if (grade) q.grade = Number(grade);
    if (typeof imageUrl === "string") q.imageUrl = imageUrl || void 0;
    if (typeof mediaId === "string") q.mediaId = mediaId || void 0;
    if (typeof explanationImageUrl === "string") q.explanationImageUrl = explanationImageUrl || void 0;
    if (typeof explanationMediaId === "string") q.explanationMediaId = explanationMediaId || void 0;
    q.version = (q.version || 1) + 1;
    q.updatedAt = nowIso;
    appendAuditLog(
      db,
      q.institutionId,
      user,
      `Savol yangilandi (v${q.version})`,
      `${q.code || q.id}: ${q.prompt.slice(0, 50)}`,
      q.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, q.institutionId, "QUESTION_UPDATED");
    return res.json({ question: q, revision });
  });
  app.delete("/api/questions/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    const isOwner = isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL);
    const idx = db.questions.findIndex(
      (item) => item.id === req.params.id && (isOwner || item.institutionId === user.institutionId)
    );
    if (idx === -1) return res.status(404).json({ error: "Savol topilmadi." });
    if (user.role !== "admin" && user.role !== "teacher" && !isOwner) {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const removed = db.questions[idx];
    db.questions.splice(idx, 1);
    appendAuditLog(
      db,
      removed.institutionId,
      user,
      "Savol arxivlandi/o\u2018chirildi",
      removed.prompt.slice(0, 50),
      removed.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, removed.institutionId, "QUESTION_DELETED");
    return res.json({ status: "ok" });
  });
  app.get("/api/import/template.xlsx", (_req, res) => {
    try {
      const buffer = generateLearnOSExcelTemplateBuffer(getDbState("prod").topics);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="LearnOS_Assessment_Import_Template.xlsx"'
      );
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error("Template generation error:", err);
      return res.status(500).json({ error: "Excel shablonini yaratishda xatolik yuz berdi." });
    }
  });
  app.get("/api/import/guide.md", (_req, res) => {
    const md = generateImportGuideMarkdown(getDbState("prod").topics);
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="LearnOS_Import_Guide.md"'
    );
    return res.send(md);
  });
  app.post("/api/import/validate", async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (user.role !== "teacher" && user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Excel/ZIP import faqat o\u2018qituvchi va administrator uchun." });
    }
    try {
      const { fileName, base64Data, institutionId } = req.body;
      if (!fileName || !base64Data) {
        return res.status(400).json({ error: "Fayl nomi va base64 ma\u2019lumotlari talab qilinadi." });
      }
      const targetInstId = isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL) && institutionId ? String(institutionId) : user.institutionId;
      if (!canAccessInstitution(user, targetInstId)) {
        return res.status(403).json({ error: "Boshqa muassasaga import qilish taqiqlangan." });
      }
      const cleanBase64 = String(base64Data).includes(",") ? String(base64Data).split(",")[1] : String(base64Data);
      const buffer = Buffer.from(cleanBase64, "base64");
      const existingInstQuestions = db.questions.filter(
        (q) => q.institutionId === targetInstId
      );
      const validation = await parseAndValidateImportPackage(
        new Uint8Array(buffer),
        String(fileName),
        db.topics,
        existingInstQuestions
      );
      return res.json(validation);
    } catch (err) {
      console.error("Import validation error:", err);
      return res.status(500).json({
        error: `Import faylini tekshirishda xatolik: ${err?.message || "Noma\u2019lum xatolik"}`
      });
    }
  });
  app.post("/api/import/confirm", async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "teacher" && user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Importni tasdiqlash uchun ruxsat yo\u2018q." });
    }
    try {
      const {
        fileName,
        base64Data,
        institutionId,
        classId,
        importMode = "draft_assessment",
        duplicatePolicy = "update_existing"
      } = req.body;
      if (!fileName || !base64Data) {
        return res.status(400).json({ error: "Fayl ma\u2019lumotlari yetarli emas." });
      }
      const targetInstId = isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL) && institutionId ? String(institutionId) : user.institutionId;
      if (!canAccessInstitution(user, targetInstId)) {
        return res.status(403).json({ error: "Boshqa muassasaga import qilish taqiqlangan." });
      }
      const cleanBase64 = String(base64Data).includes(",") ? String(base64Data).split(",")[1] : String(base64Data);
      const buffer = Buffer.from(cleanBase64, "base64");
      const existingInstQuestions = db.questions.filter(
        (q) => q.institutionId === targetInstId
      );
      const parsed = await parseAndValidateImportPackage(
        new Uint8Array(buffer),
        String(fileName),
        db.topics,
        existingInstQuestions
      );
      if (!parsed.valid) {
        return res.status(400).json({
          error: "Import faylida xatoliklar mavjud. Iltimos, avval xatoliklarni tuzating.",
          validation: parsed
        });
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const batchId = `imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      for (const media of parsed.mediaFiles) {
        const mediaRecord = {
          id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          institutionId: targetInstId,
          uploadedByUid: user.uid,
          fileName: media.fileName,
          mimeType: media.mimeType,
          sizeBytes: media.sizeBytes,
          dataUrl: media.dataUrl,
          createdAt: nowIso
        };
        db.questionMedia.unshift(mediaRecord);
      }
      const finalQuestionIds = [];
      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      for (const incomingQ of parsed.questions) {
        const existingQ = db.questions.find(
          (q) => q.institutionId === targetInstId && q.code && incomingQ.code && q.code.toUpperCase() === incomingQ.code.toUpperCase()
        );
        if (existingQ) {
          if (duplicatePolicy === "skip_existing" || duplicatePolicy === "import_new_only") {
            skippedCount += 1;
            finalQuestionIds.push(existingQ.id);
            continue;
          }
          const rev = {
            id: `qrev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            questionId: existingQ.id,
            institutionId: targetInstId,
            version: existingQ.version || 1,
            snapshot: JSON.parse(JSON.stringify(existingQ)),
            editedByUid: user.uid,
            editedByName: user.displayName,
            reason: `Excel/ZIP import orqali yangilandi (${fileName})`,
            createdAt: nowIso
          };
          db.questionRevisions.unshift(rev);
          Object.assign(existingQ, {
            code: incomingQ.code,
            subject: incomingQ.subject,
            subjectCode: incomingQ.subjectCode,
            grade: incomingQ.grade,
            topicId: incomingQ.topicId,
            topicCode: incomingQ.topicCode,
            type: incomingQ.type,
            difficulty: incomingQ.difficulty,
            prompt: incomingQ.prompt,
            imageUrl: incomingQ.imageUrl,
            explanationImageUrl: incomingQ.explanationImageUrl,
            options: incomingQ.options,
            optionItems: incomingQ.structuredOptions,
            structuredOptions: incomingQ.structuredOptions,
            correctAnswer: incomingQ.correctAnswer,
            correctAnswers: incomingQ.correctAnswers,
            acceptedAnswers: incomingQ.acceptedAnswers,
            numericTolerance: incomingQ.numericTolerance,
            gradingMode: incomingQ.gradingMode,
            rubricText: incomingQ.rubricText,
            explanation: incomingQ.explanation,
            points: incomingQ.points,
            version: (existingQ.version || 1) + 1,
            importBatchId: batchId,
            updatedAt: nowIso
          });
          updatedCount += 1;
          finalQuestionIds.push(existingQ.id);
        } else {
          const newQ = {
            id: `q-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            code: incomingQ.code,
            institutionId: targetInstId,
            authorId: user.uid,
            subject: incomingQ.subject,
            subjectCode: incomingQ.subjectCode,
            grade: incomingQ.grade,
            topicId: incomingQ.topicId,
            topicCode: incomingQ.topicCode,
            type: incomingQ.type,
            difficulty: incomingQ.difficulty,
            prompt: incomingQ.prompt,
            imageUrl: incomingQ.imageUrl,
            explanationImageUrl: incomingQ.explanationImageUrl,
            options: incomingQ.options,
            optionItems: incomingQ.structuredOptions,
            structuredOptions: incomingQ.structuredOptions,
            correctAnswer: incomingQ.correctAnswer,
            correctAnswers: incomingQ.correctAnswers,
            acceptedAnswers: incomingQ.acceptedAnswers,
            numericTolerance: incomingQ.numericTolerance,
            gradingMode: incomingQ.gradingMode,
            rubricText: incomingQ.rubricText,
            explanation: incomingQ.explanation,
            points: incomingQ.points,
            status: "approved",
            version: 1,
            importBatchId: batchId,
            createdAt: nowIso,
            updatedAt: nowIso
          };
          db.questions.unshift(newQ);
          importedCount += 1;
          finalQuestionIds.push(newQ.id);
        }
      }
      let createdAssessment;
      const meta = parsed.assessmentMeta;
      if (importMode !== "question_bank_only" && finalQuestionIds.length > 0) {
        const assessId = `assess-imp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        const topicIds = Array.from(new Set(parsed.questions.map((q) => q.topicId)));
        createdAssessment = {
          id: assessId,
          code: meta?.code || `ASM-${Date.now()}`,
          title: meta?.title || `Import qilingan test (${fileName})`,
          description: meta?.description || "",
          instructions: meta?.instructions || "",
          subject: meta?.subject || "Matematika",
          grade: meta?.grade || 8,
          topicIds,
          questionIds: finalQuestionIds,
          durationMinutes: meta?.durationMinutes || 30,
          passingScorePercent: meta?.passingScorePercent || 60,
          shuffleQuestions: meta?.shuffleQuestions ?? false,
          attemptLimit: meta?.attemptLimit || 1,
          availableFrom: meta?.availabilityStart || nowIso.slice(0, 10),
          dueDate: meta?.availabilityEnd || new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
          classId: classId ? String(classId) : "",
          teacherId: user.uid,
          institutionId: targetInstId,
          status: "draft",
          // Always defaults to draft until reviewed & published!
          version: 1,
          importBatchId: batchId,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        db.assessments.unshift(createdAssessment);
      }
      const batchRecord = {
        id: batchId,
        institutionId: targetInstId,
        importedByUid: user.uid,
        importedByName: user.displayName,
        fileName: String(fileName),
        packageType: String(fileName).toLowerCase().endsWith(".zip") ? "zip" : "xlsx",
        assessmentId: createdAssessment?.id,
        assessmentTitle: createdAssessment?.title || meta?.title || "Savollar bazasi importi",
        questionsCount: importedCount + updatedCount,
        optionsCount: parsed.summary.totalOptions,
        mediaCount: parsed.mediaFiles.length,
        errorsCount: 0,
        warningsCount: parsed.warnings.length,
        status: "imported",
        duplicatePolicy,
        createdAt: nowIso
      };
      db.importBatches.unshift(batchRecord);
      appendAuditLog(
        db,
        targetInstId,
        user,
        `Excel/ZIP paket import qilindi (${importedCount} yangi, ${updatedCount} yangilangan savol)`,
        `${batchRecord.fileName} -> ${batchRecord.assessmentTitle}`,
        batchId
      );
      saveDbState(env, db);
      broadcastInstitutionUpdate(env, targetInstId, "PACKAGE_IMPORTED");
      return res.json({
        batch: batchRecord,
        assessment: createdAssessment,
        importedCount,
        updatedCount,
        skippedCount,
        mediaCount: parsed.mediaFiles.length
      });
    } catch (err) {
      console.error("Import confirm error:", err);
      return res.status(500).json({
        error: `Importni saqlashda xatolik yuz berdi: ${err?.message || "Noma\u2019lum xatolik"}`
      });
    }
  });
  app.post("/api/assessments", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "teacher" && user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Test yaratish uchun ruxsat yo\u2018q." });
    }
    const {
      title,
      description,
      subject,
      grade,
      topicIds,
      questionIds,
      durationMinutes,
      availableFrom,
      dueDate,
      classId,
      classCode,
      lessonId,
      quarter,
      eligibleStudentIds,
      status
    } = req.body;
    if (!title || String(title).trim().length < 3) {
      return res.status(400).json({ error: "Test sarlavhasini kiriting." });
    }
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ error: "Kamida 1 ta savol tanlang." });
    }
    const cls = db.classes.find(
      (c) => c.institutionId === user.institutionId && (classId && c.id === String(classId) || classCode && (c.name.toLowerCase() === String(classCode).toLowerCase() || c.code?.toLowerCase() === String(classCode).toLowerCase()))
    );
    if (user.role === "teacher" && cls && !canAccessClass(user, cls)) {
      return res.status(403).json({ error: "Ushbu sinf sizga biriktirilmagan." });
    }
    const cleanSubj = String(subject || "Matematika").trim();
    if (cls && !isSubjectCompatibleWithClass(cleanSubj, cls.name)) {
      return res.status(400).json({
        error: `"${cleanSubj}" fani ${cls.name} (${cls.track} yo\u2018nalishi) sinfi o\u2018quv rejasiga mos kelmaydi.`
      });
    }
    const chosenQuestions = db.questions.filter(
      (q) => q.institutionId === user.institutionId && questionIds.includes(q.id)
    );
    const computedTopicIds = Array.isArray(topicIds) && topicIds.length > 0 ? topicIds.map(String) : Array.from(new Set(chosenQuestions.map((q) => q.topicId)));
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const assessId = `assess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const isPublished = status === "published";
    const newAssessment = {
      id: assessId,
      title: String(title).trim(),
      description: description ? String(description).trim() : void 0,
      subject: cleanSubj,
      grade: cls?.grade || Number(grade) || 8,
      quarter: quarter ? Number(quarter) : void 0,
      lessonId: lessonId ? String(lessonId) : void 0,
      topicIds: computedTopicIds,
      questionIds: questionIds.map(String),
      // Immutable snapshot of questions at publish time so later edits don't corrupt attempts
      questionSnapshot: isPublished ? chosenQuestions.map((q) => ({ ...q })) : void 0,
      durationMinutes: Number(durationMinutes) || 25,
      availableFrom: availableFrom ? String(availableFrom) : nowIso.slice(0, 10),
      dueDate: String(dueDate || new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)),
      classId: cls ? cls.id : String(classId || ""),
      classCode: cls ? cls.name : classCode ? String(classCode).toLowerCase() : void 0,
      eligibleStudentIds: Array.isArray(eligibleStudentIds) ? eligibleStudentIds.map(String) : void 0,
      teacherId: user.uid,
      institutionId: user.institutionId,
      status: isPublished ? "published" : "draft",
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.assessments.unshift(newAssessment);
    if (lessonId) {
      const linkedLesson = db.lessons.find((l) => l.id === String(lessonId));
      if (linkedLesson) {
        const setIds = new Set(linkedLesson.linkedAssessmentIds || []);
        setIds.add(newAssessment.id);
        linkedLesson.linkedAssessmentIds = Array.from(setIds);
      }
    }
    if (isPublished && cls) {
      const assignment = {
        id: `assign-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        institutionId: user.institutionId,
        assessmentId: newAssessment.id,
        assessmentTitle: newAssessment.title,
        classId: cls.id,
        className: cls.name,
        teacherId: user.uid,
        startDate: newAssessment.availableFrom || nowIso.slice(0, 10),
        dueDate: newAssessment.dueDate,
        status: "published",
        eligibleStudentIds: newAssessment.eligibleStudentIds,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      db.assignments.unshift(assignment);
      const classStudents = db.users.filter(
        (u) => u.institutionId === user.institutionId && u.role === "student" && (u.classId === cls.id || u.classCode === cls.name)
      );
      for (const stu of classStudents) {
        pushNotification(
          db,
          user.institutionId,
          stu.uid,
          "Yangi diagnostik test biriktirildi",
          `"${newAssessment.title}" testi chop etildi. Topshirish muddati: ${newAssessment.dueDate}.`,
          `/student/assessments/${newAssessment.id}`
        );
      }
      appendAuditLog(
        db,
        user.institutionId,
        user,
        `Test chop etildi va ${cls.name} sinfiga biriktirildi`,
        newAssessment.title,
        newAssessment.id
      );
    }
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "ASSESSMENT_PUBLISHED");
    return res.json({ assessment: newAssessment });
  });
  app.put("/api/assessments/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    const assess = db.assessments.find(
      (a) => a.id === req.params.id && a.institutionId === user.institutionId
    );
    if (!assess) return res.status(404).json({ error: "Test topilmadi." });
    if (assess.examKind) return res.status(409).json({ error: "BSB/CHSB ishlarini nazorat markazida boshqaring." });
    if (user.role !== "admin" && user.role !== "platform_owner" && assess.teacherId !== user.uid) {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const { title, description, durationMinutes, dueDate, status, classId, classCode, questionIds } = req.body;
    const wasDraft = assess.status === "draft";
    if (title) assess.title = String(title).trim();
    if (typeof description === "string") assess.description = description.trim();
    if (durationMinutes) assess.durationMinutes = Number(durationMinutes);
    if (dueDate) assess.dueDate = String(dueDate);
    if (classId || classCode) {
      const targetCls = db.classes.find(
        (c) => c.institutionId === user.institutionId && (classId && c.id === String(classId) || classCode && (c.name.toLowerCase() === String(classCode).toLowerCase() || c.code?.toLowerCase() === String(classCode).toLowerCase()))
      );
      if (targetCls) {
        assess.classId = targetCls.id;
        assess.classCode = targetCls.name;
        assess.grade = targetCls.grade;
      } else if (classId) {
        assess.classId = String(classId);
      }
    }
    if (Array.isArray(questionIds) && questionIds.length > 0 && wasDraft) {
      assess.questionIds = questionIds.map(String);
    }
    if (status && (status === "draft" || status === "published" || status === "archived")) {
      assess.status = status;
      assess.version = (assess.version || 1) + 1;
      if (status === "published" && (!assess.questionSnapshot || assess.questionSnapshot.length === 0)) {
        const chosen = db.questions.filter(
          (q) => q.institutionId === user.institutionId && assess.questionIds.includes(q.id)
        );
        assess.questionSnapshot = chosen.map((q) => ({ ...q }));
        const cls = db.classes.find(
          (c) => c.id === assess.classId || assess.classCode && c.name === assess.classCode
        );
        if (cls) {
          assess.classId = cls.id;
          assess.classCode = cls.name;
          db.assignments.unshift({
            id: `assign-${Date.now()}`,
            institutionId: user.institutionId,
            assessmentId: assess.id,
            assessmentTitle: assess.title,
            classId: cls.id,
            className: cls.name,
            teacherId: user.uid,
            startDate: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
            dueDate: assess.dueDate,
            status: "published",
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
    }
    assess.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "ASSESSMENT_UPDATED");
    return res.json({ assessment: assess });
  });
  app.post("/api/assignments", (req, res, next) => {
    if (req.body?.title || req.body?.targetClassCodes || req.body?.targetClasses || !req.body?.assessmentId) {
      return next();
    }
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "teacher" && user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const { assessmentId, classId, dueDate } = req.body;
    const assess = db.assessments.find(
      (a) => a.id === assessmentId && a.institutionId === user.institutionId
    );
    const cls = db.classes.find(
      (c) => c.id === classId && c.institutionId === user.institutionId
    );
    if (!assess || !cls) {
      return res.status(404).json({ error: "Test yoki sinf topilmadi." });
    }
    if (assess.examKind) return res.status(409).json({ error: "BSB/CHSB ishlarini nazorat markazida boshqaring." });
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    assess.status = "published";
    assess.classId = cls.id;
    assess.classCode = cls.name;
    if (dueDate) assess.dueDate = String(dueDate);
    if (!assess.questionSnapshot || assess.questionSnapshot.length === 0) {
      const chosen = db.questions.filter(
        (q) => q.institutionId === user.institutionId && assess.questionIds.includes(q.id)
      );
      assess.questionSnapshot = chosen.map((q) => ({ ...q }));
    }
    const assignment = {
      id: `assign-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      institutionId: user.institutionId,
      assessmentId: assess.id,
      assessmentTitle: assess.title,
      classId: cls.id,
      className: cls.name,
      teacherId: user.uid,
      startDate: nowIso.slice(0, 10),
      dueDate: String(dueDate || assess.dueDate),
      status: "published",
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.assignments.unshift(assignment);
    const classStudents = db.users.filter(
      (u) => u.institutionId === user.institutionId && u.role === "student" && (u.classId === cls.id || u.classCode === cls.name)
    );
    for (const stu of classStudents) {
      pushNotification(
        db,
        user.institutionId,
        stu.uid,
        "Yangi diagnostik test biriktirildi",
        `"${assess.title}" testi chop etildi. Topshirish muddati: ${assignment.dueDate}.`,
        `/student/assessments/${assess.id}`
      );
    }
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Topshiriq ${cls.name} sinfiga biriktirildi`,
      assess.title,
      assignment.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "ASSIGNMENT_CREATED");
    return res.json({ assignment });
  });
  app.put("/api/assignments/:id/status", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    const assign = db.assignments.find(
      (a) => a.id === req.params.id && a.institutionId === user.institutionId
    );
    if (!assign) return res.status(404).json({ error: "Topshiriq topilmadi." });
    if (user.role !== "admin" && assign.teacherId !== user.uid) {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const { status, dueDate } = req.body;
    if (status === "published" || status === "closed") {
      assign.status = status;
    }
    if (dueDate) assign.dueDate = String(dueDate);
    assign.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "ASSIGNMENT_UPDATED");
    return res.json({ assignment: assign });
  });
  app.post("/api/assessments/submit", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "student") {
      return res.status(403).json({ error: "Faqat o\u2018quvchilar test topshira oladi." });
    }
    const { assessmentId } = req.body;
    let submittedMap = req.body.submittedMap || req.body.answersMap || {};
    const assessment = db.assessments.find(
      (a) => a.id === assessmentId && a.institutionId === user.institutionId
    );
    if (!assessment || assessment.status !== "published") {
      return res.status(404).json({ error: "Test topilmadi yoki faol emas." });
    }
    const examSession = assessment.examKind ? db.examSessions?.find((s) => s.assessmentId === assessment.id && s.studentId === user.uid) : void 0;
    if (assessment.examKind) {
      if (!canTakeExam(user, assessment) || !examSession) return res.status(403).json({ error: "Nazorat ishini avval boshlang." });
      if (examSession.submittedAttemptId) return res.json({ attempt: db.attempts.find((a) => a.id === examSession.submittedAttemptId) });
      if (assessment.examState === "paused" && !examSession.stoppedAt) return res.status(409).json({ error: "Nazorat vaqtincha to\u2018xtatilgan." });
      if (examSession.stoppedAt || Date.now() > examDeadline(assessment, examSession) || assessment.examState === "closed") submittedMap = examSession.answers;
      else if (!submittedMap || typeof submittedMap !== "object" || Array.isArray(submittedMap) || Object.values(submittedMap).some((v) => typeof v !== "string" || v.length > 25e4) || Object.keys(submittedMap).some((id) => !assessment.questionIds.includes(id)) || Buffer.byteLength(JSON.stringify(submittedMap)) > 18e5) return res.status(400).json({ error: "Javoblar noto\u2018g\u2018ri." });
    }
    const userClassId = (user.classId || "").toLowerCase();
    const userClassCode = (user.classCode || "").toLowerCase();
    const matchesAssignedIds = Array.isArray(assessment.assignedClassIds) && assessment.assignedClassIds.some((id) => id.toLowerCase() === userClassId);
    const matchesAssignedCodes = Array.isArray(assessment.assignedClassCodes) && assessment.assignedClassCodes.some((c) => c.toLowerCase() === userClassCode);
    const classIdMismatch = Boolean(
      assessment.classId && userClassId && assessment.classId.toLowerCase() !== userClassId && !matchesAssignedIds
    );
    const classCodeMismatch = Boolean(
      assessment.classCode && userClassCode && assessment.classCode.toLowerCase() !== userClassCode && !matchesAssignedCodes
    );
    if (classIdMismatch || classCodeMismatch) {
      return res.status(403).json({ error: "Ushbu test sizning sinfingizga biriktirilmagan." });
    }
    const recentAttempt = db.attempts.find(
      (att) => att.studentId === user.uid && att.assessmentId === assessment.id && Date.now() - new Date(att.submittedAt).getTime() < 1e4
    );
    if (recentAttempt) {
      return res.json({
        attempt: recentAttempt,
        masteryRecords: db.masteryRecords.filter((r) => r.studentId === user.uid),
        learningPaths: db.learningPaths.filter((lp) => lp.studentId === user.uid)
      });
    }
    const authoritativeQuestions = assessment.questionSnapshot && assessment.questionSnapshot.length > 0 ? assessment.questionSnapshot : db.questions.filter(
      (q) => q.institutionId === user.institutionId && assessment.questionIds.includes(q.id)
    );
    const topicsMap = {};
    for (const t of db.topics) {
      topicsMap[t.id] = t;
    }
    const scoredOutput = scoreAssessmentSubmission(
      authoritativeQuestions,
      submittedMap || {},
      topicsMap
    );
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const attemptId = `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const fallbackAnalysis = buildDeterministicFallbackAnalysis(
      assessment.title,
      scoredOutput.scorePercent,
      scoredOutput.topicBreakdown,
      scoredOutput.answers
    );
    const newAttempt = {
      id: attemptId,
      assessmentId: assessment.id,
      assessmentTitle: assessment.title,
      assessmentVersion: assessment.version || 1,
      studentId: user.uid,
      studentName: user.displayName,
      classId: user.classId || assessment.classId,
      institutionId: user.institutionId,
      scorePercent: scoredOutput.scorePercent,
      earnedPoints: scoredOutput.earnedPoints,
      totalPoints: scoredOutput.totalPoints,
      correctCount: scoredOutput.correctCount,
      totalQuestions: scoredOutput.totalQuestions,
      pendingManualCount: scoredOutput.pendingManualCount,
      status: scoredOutput.pendingManualCount > 0 ? "pending_manual_review" : "completed",
      submittedAt: nowIso,
      answers: scoredOutput.answers,
      topicBreakdown: scoredOutput.topicBreakdown,
      aiAnalysis: fallbackAnalysis
    };
    db.attempts.unshift(newAttempt);
    if (examSession) {
      examSession.submittedAttemptId = newAttempt.id;
      examSession.answers = submittedMap;
    }
    const existingStudentMastery = db.masteryRecords.filter((r) => r.studentId === user.uid);
    const otherMastery = db.masteryRecords.filter((r) => r.studentId !== user.uid);
    const updatedStudentMastery = updateMasteryRecordsFromAttempt(
      existingStudentMastery,
      user.uid,
      user.institutionId,
      scoredOutput.topicBreakdown,
      db.topics,
      nowIso
    );
    db.masteryRecords = [...otherMastery, ...updatedStudentMastery];
    const otherPaths = db.learningPaths.filter((lp) => lp.studentId !== user.uid);
    const updatedStudentPaths = generateLearningPathsFromAttempt(
      user.uid,
      user.institutionId,
      scoredOutput.topicBreakdown,
      db.learningPaths
    );
    db.learningPaths = [...otherPaths, ...updatedStudentPaths];
    if (assessment.teacherId) {
      pushNotification(
        db,
        user.institutionId,
        assessment.teacherId,
        "O'quvchi testni topshirdi",
        `${user.displayName} "${assessment.title}" testini ${scoredOutput.scorePercent}% (${scoredOutput.correctCount}/${scoredOutput.totalQuestions}) natija bilan yakunladi.`,
        `/teacher/students/${user.uid}`
      );
    }
    const linkedParents = db.users.filter(
      (u) => u.institutionId === user.institutionId && u.role === "parent" && u.linkedChildIds?.includes(user.uid)
    );
    for (const parent of linkedParents) {
      pushNotification(
        db,
        user.institutionId,
        parent.uid,
        "Farzandingiz test natijasi tayyor",
        `${user.displayName} "${assessment.title}" sinovini ${scoredOutput.scorePercent}% natija bilan topshirdi.`,
        `/parent/children/${user.uid}`
      );
    }
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Test topshirildi (${scoredOutput.scorePercent}%)`,
      assessment.title,
      attemptId
    );
    const studentClassCode = (user.classCode || assessment.classCode || db.classes.find((c) => c.id === user.classId)?.code || "7a1").toLowerCase();
    const assessGamificationResult = recordVerifiedStudentGamificationEvent(db, {
      studentId: user.uid,
      classCode: studentClassCode,
      activityType: "assessment_completed",
      idempotencyKey: `assessment:${user.uid}:${assessment.id}`,
      reason: `Test yakunlandi: ${assessment.title}`,
      subject: assessment.subject,
      curriculumArea: assessment.curriculumArea,
      lessonId: assessment.lessonId,
      assessmentId: assessment.id,
      quarter: assessment.quarter,
      occurredAt: nowIso
    });
    const isMilestoneAssessment = Boolean(assessment.milestoneCode) || /\b(bsb|chsb)\b/i.test(assessment.title || "");
    if (isMilestoneAssessment) {
      recordVerifiedStudentGamificationEvent(db, {
        studentId: user.uid,
        classCode: studentClassCode,
        activityType: "curriculum_milestone_completed",
        idempotencyKey: `milestone_assess:${user.uid}:${assessment.id}`,
        reason: `Nazorat marrasi yakunlandi: ${assessment.title}`,
        subject: assessment.subject,
        curriculumArea: assessment.curriculumArea,
        lessonId: assessment.lessonId,
        assessmentId: assessment.id,
        quarter: assessment.quarter,
        occurredAt: nowIso
      });
    }
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "ATTEMPT_SUBMITTED");
    return res.json({
      attempt: newAttempt,
      masteryRecords: updatedStudentMastery,
      learningPaths: updatedStudentPaths,
      gamification: assessGamificationResult
    });
  });
  app.put("/api/learning-paths/:id/steps", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    const pathItem = db.learningPaths.find(
      (lp) => lp.id === req.params.id && lp.studentId === user.uid
    );
    if (!pathItem) return res.status(404).json({ error: "O\u2018quv yo\u2018li topilmadi." });
    const { stepNumber, status } = req.body;
    pathItem.steps = pathItem.steps.map(
      (s) => s.stepNumber === Number(stepNumber) ? { ...s, status } : s
    );
    saveDbState(env, db);
    return res.json({ learningPath: pathItem });
  });
  app.post("/api/teacher-notes", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "teacher" && user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const { studentId, content } = req.body;
    if (!studentId || !content || String(content).trim().length < 2) {
      return res.status(400).json({ error: "Qayd matnini kiriting." });
    }
    const note = {
      id: `note-${Date.now()}`,
      studentId: String(studentId),
      teacherId: user.uid,
      teacherName: user.displayName,
      institutionId: user.institutionId,
      content: String(content).trim(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.teacherNotes.unshift(note);
    pushNotification(
      db,
      user.institutionId,
      String(studentId),
      "O'qituvchidan yangi tavsiya",
      `${user.displayName} sizning o'quv ko'rsatkichingiz bo'yicha yangi qayd qoldirdi.`
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "NOTE_ADDED");
    return res.json({ note });
  });
  app.post("/api/parent/link-child", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "parent") {
      return res.status(403).json({ error: "Faqat ota-ona hisobi farzand kodini ulashi mumkin." });
    }
    const cleanCode = String(req.body.studentCode || "").trim().toUpperCase();
    const matchedStudent = db.users.find(
      (u) => u.institutionId === user.institutionId && u.role === "student" && u.studentCode?.toUpperCase() === cleanCode
    );
    if (!matchedStudent) {
      return res.status(404).json({ error: "Bunday shaxsiy kodli o\u2018quvchi topilmadi." });
    }
    const existing = new Set(user.linkedChildIds || []);
    existing.add(matchedStudent.uid);
    user.linkedChildIds = Array.from(existing);
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, user.institutionId, "PARENT_LINKED");
    return res.json({ user, student: matchedStudent });
  });
  app.put("/api/notifications/:id/read", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    const notif = db.notifications.find(
      (n) => n.id === req.params.id && n.recipientUid === user.uid
    );
    if (notif) {
      notif.read = true;
      saveDbState(env, db);
    }
    return res.json({ status: "ok" });
  });
  app.post("/api/assessments/score", (req, res) => {
    try {
      const { questions, submittedMap, topicsMap } = req.body;
      if (!Array.isArray(questions) || !submittedMap || !topicsMap) {
        return res.status(400).json({
          error: "Savollar yoki javoblar ma\u2019lumotlari to\u2018liq emas."
        });
      }
      const scored = scoreAssessmentSubmission(questions, submittedMap, topicsMap);
      return res.json(scored);
    } catch (error) {
      console.error("Scoring error:", error);
      return res.status(500).json({
        error: "Test natijasini hisoblashda xatolik yuz berdi."
      });
    }
  });
  app.post("/api/ai/analyze-attempt", async (req, res) => {
    try {
      const { attemptId, assessmentTitle, scorePercent, topicBreakdown, answers } = req.body;
      if (!assessmentTitle || !Array.isArray(topicBreakdown) || !Array.isArray(answers)) {
        return res.status(400).json({
          error: "Tahlil uchun diagnostika ma\u2019lumotlari yetarli emas."
        });
      }
      const ai = getGeminiClient(req);
      if (!ai) {
        const fallback = buildDeterministicFallbackAnalysis(
          assessmentTitle,
          Number(scorePercent) || 0,
          topicBreakdown,
          answers
        );
        fallback.aiUnavailableReason = "Gemini API kaliti sozlanmaganligi sababli deterministik diagnostika xulosasi ko'rsatilmoqda.";
        return res.json(fallback);
      }
      const anonymizedAnswers = answers.map((a) => ({
        topicId: a.topicId,
        prompt: a.prompt,
        selectedAnswer: a.selectedAnswer || "(bo\u2018sh)",
        correctAnswer: a.correctAnswer,
        isCorrect: a.isCorrect
      }));
      const promptText = `
Siz Specialized Study ta'lim intellekti tizimining diagnostik tahlilchisisiz.
Quyidagi anonimlashtirilgan test natijalarini tahlil qiling va o'zbek tilida (lotin alifbosida) javob qaytaring.

QOIDALAR:
1. Bitta savolga qarab o'quvchi bilimi haqida qat'iy hukm chiqarmang.
2. Kuzatilgan xatolarni va ularning ehtimoliy matematik sabablarini farqlang.
3. O'quvchining xulq-atvori yoki psixologiyasi haqida hech narsa to'qimang.
4. O'quvchini boshqalar bilan solishtirmang va kamsitmang.

Test nomi: ${assessmentTitle}
Umumiy natija: ${scorePercent}%
Mavzular kesimi: ${JSON.stringify(topicBreakdown)}
Savollar va javoblar: ${JSON.stringify(anonymizedAnswers)}
`;
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: promptText,
          config: {
            systemInstruction: "Siz matematika o'quvchilarining diagnostik test natijalarini tahlil qiluvchi pedagogik AI ekspertisiz. Faqat so'ralgan JSON sxemasida, aniq va tushunarli o'zbek tilida javob bering.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description: "O'quvchi uchun tushunarli umumiy xulosa (o'zbek tilida)."
                },
                topic_analysis: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      topic_id: { type: Type.STRING },
                      observed_performance: { type: Type.STRING },
                      possible_error_pattern: { type: Type.STRING },
                      evidence_count: { type: Type.NUMBER },
                      confidence: { type: Type.STRING },
                      recommendation: { type: Type.STRING }
                    },
                    required: [
                      "topic_id",
                      "observed_performance",
                      "possible_error_pattern",
                      "evidence_count",
                      "confidence",
                      "recommendation"
                    ]
                  }
                },
                next_steps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      topic_id: { type: Type.STRING },
                      activity: { type: Type.STRING },
                      reason: { type: Type.STRING },
                      priority: { type: Type.STRING }
                    },
                    required: ["topic_id", "activity", "reason", "priority"]
                  }
                },
                teacher_summary: {
                  type: Type.STRING,
                  description: "O'qituvchi uchun qisqa metodik xulosa."
                },
                parent_summary: {
                  type: Type.STRING,
                  description: "Ota-ona uchun oddiy va tushunarli xulosa."
                }
              },
              required: ["summary", "topic_analysis", "next_steps", "teacher_summary"]
            }
          }
        });
        const rawJson = JSON.parse((response.text ?? "{}").trim());
        const validated = AIAnalysisSchema.parse(rawJson);
        const finalResult = {
          ...validated,
          generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          isFallback: false
        };
        const authCtx = authenticateRequest(req);
        if (authCtx && attemptId) {
          const att = authCtx.db.attempts.find((a) => a.id === attemptId);
          if (att) {
            att.aiAnalysis = finalResult;
            saveDbState(authCtx.env, authCtx.db);
          }
        }
        return res.json(finalResult);
      } catch (aiErr) {
        console.warn("Gemini AI analysis fallback triggered:", aiErr);
        const fallback = buildDeterministicFallbackAnalysis(
          assessmentTitle,
          Number(scorePercent) || 0,
          topicBreakdown,
          answers
        );
        fallback.aiUnavailableReason = "AI xizmati vaqtincha javob bermadi; deterministik tahlil ko'rsatildi.";
        return res.json(fallback);
      }
    } catch (error) {
      console.error("Analyze endpoint error:", error);
      return res.status(500).json({
        error: "AI tahlilini yaratishda tizim xatoligi yuz berdi."
      });
    }
  });
  app.post("/api/ai/draft-question", async (req, res) => {
    try {
      const { topicName, difficulty, grade = 8, subject = "Matematika" } = req.body;
      const ai = getGeminiClient(req);
      if (!ai) {
        return res.json({
          prompt: `${grade}-sinf ${subject} (${topicName}): Agar 3(2x - 5) = 21 bo\u2018lsa, x ning qiymatini toping.`,
          options: ["6", "4", "8", "5"],
          correctAnswer: "6",
          explanation: "Qavsni ochamiz: 6x - 15 = 21 => 6x = 36 => x = 6.",
          isFallback: true
        });
      }
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `${grade}-sinf ${subject} fani "${topicName}" mavzusi bo'yicha "${difficulty}" qiyinlikdagi 1 ta multiple-choice (4 ta variantli) diagnostik test savolini o'zbek lotin alifbosida tuzing. To'g'ri javob aniq 4 ta variantdan biri bo'lsin va tushuntirishi bo'lsin.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              prompt: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ["prompt", "options", "correctAnswer", "explanation"]
          }
        }
      });
      const parsed = AIDraftedQuestionSchema.parse(JSON.parse((response.text ?? "{}").trim()));
      if (!parsed.options.includes(parsed.correctAnswer)) {
        parsed.options[0] = parsed.correctAnswer;
      }
      return res.json({ ...parsed, isFallback: false });
    } catch (error) {
      console.warn("AI question draft fallback triggered:", error);
      return res.json({
        prompt: `8-sinf Matematika: (4x + 8) / 3 = 12 tenglamadan x ning qiymatini toping.`,
        options: ["7", "6", "8", "9"],
        correctAnswer: "7",
        explanation: "4x + 8 = 36 => 4x = 28 => x = 7.",
        isFallback: true
      });
    }
  });
  app.post("/api/ai/suggest-written-grade", async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user } = authCtx;
    if (user.role !== "teacher" && user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const { prompt, rubricText, studentAnswer, maxPoints = 2 } = req.body;
    const numericMax = Math.max(1, Number(maxPoints) || 2);
    const cleanStudentAnswer = String(studentAnswer || "").trim();
    if (!cleanStudentAnswer) {
      return res.json({
        suggestedPoints: 0,
        maxPoints: numericMax,
        confidence: "high",
        feedback: "O'quvchi yozma javob qoldirmagan (bo'sh javob).",
        isAiSuggestion: true,
        finalized: false
      });
    }
    const ai = getGeminiClient(req);
    if (!ai) {
      const hasEquationsOrSteps = cleanStudentAnswer.length >= 25 && (/[=+\-*/0-9]/.test(cleanStudentAnswer) || cleanStudentAnswer.split(/\s+/).length >= 5);
      const suggestedPoints = hasEquationsOrSteps ? numericMax : Math.max(0.5, Math.round(numericMax / 2));
      return res.json({
        suggestedPoints,
        maxPoints: numericMax,
        confidence: "medium",
        feedback: hasEquationsOrSteps ? "Yechim bosqichlari va yakuniy xulosa mezonlarga mos keladi. O'qituvchi tasdig'i talab etiladi." : "Javob qisman yozilgan, lekin barcha isbot qadamlari to'liq ko'rsatilmagan.",
        isAiSuggestion: true,
        finalized: false
      });
    }
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Savol: ${prompt}
Baholash mezoni (Rubrika): ${rubricText || "To'liq yechim va asoslash"}
Maksimal ball: ${numericMax}
O'quvchi javobi (anonim): ${cleanStudentAnswer}

Ushbu javobni mezon asosida tahlil qilib, tavsiya etilgan ball (0 dan ${numericMax} gacha) va qisqa izohni JSON shaklida qaytaring.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedPoints: { type: Type.NUMBER },
              confidence: { type: Type.STRING },
              feedback: { type: Type.STRING }
            },
            required: ["suggestedPoints", "confidence", "feedback"]
          }
        }
      });
      const parsed = JSON.parse((response.text ?? "{}").trim());
      const bounded = Math.max(0, Math.min(numericMax, Number(parsed.suggestedPoints) || 0));
      return res.json({
        suggestedPoints: bounded,
        maxPoints: numericMax,
        confidence: parsed.confidence || "medium",
        feedback: String(parsed.feedback || "AI tavsiyasi tayyor. Yakuniy bahoni o'qituvchi tasdiqlaydi."),
        isAiSuggestion: true,
        finalized: false
      });
    } catch {
      return res.json({
        suggestedPoints: Math.round(numericMax * 0.75 * 10) / 10,
        maxPoints: numericMax,
        confidence: "medium",
        feedback: "Mezon bo'yicha dastlabki baholash tavsiyasi. O'qituvchi tomonidan tasdiqlanishi zarur.",
        isAiSuggestion: true,
        finalized: false
      });
    }
  });
  app.post("/api/attempts/:attemptId/grade-answer", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "teacher" && user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Yozma javobni baholash faqat o\u2018qituvchi va administrator uchun." });
    }
    const isOwner = isVerifiedPlatformOwner(user, CONFIGURED_OWNER_EMAIL);
    const attempt = db.attempts.find(
      (a) => a.id === req.params.attemptId && (isOwner || a.institutionId === user.institutionId)
    );
    if (!attempt) return res.status(404).json({ error: "Urinish (attempt) topilmadi." });
    const { questionId, awardedPoints, feedback, aiSuggestedPoints, aiSuggestedFeedback } = req.body;
    if (!questionId || awardedPoints === void 0 || awardedPoints === null) {
      return res.status(400).json({ error: "Savol ID va berilgan ballni kiriting." });
    }
    const answerTarget = attempt.answers.find((ans) => ans.questionId === questionId);
    if (!answerTarget) {
      return res.status(404).json({ error: "Ushbu urinishda ko\u2018rsatilgan savol topilmadi." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const maxPts = answerTarget.maxPoints || 1;
    const boundedPts = Math.max(0, Math.min(maxPts, Number(awardedPoints)));
    const topicsMap = {};
    for (const t of db.topics) {
      topicsMap[t.id] = t;
    }
    const updatedAttempt = recalculateAttemptAfterManualGrading(
      attempt,
      String(questionId),
      boundedPts,
      String(feedback || "").trim(),
      user.uid,
      topicsMap,
      nowIso
    );
    const idx = db.attempts.findIndex((a) => a.id === attempt.id);
    if (idx !== -1) {
      db.attempts[idx] = updatedAttempt;
    }
    const gradingRecord = {
      id: `grade-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      institutionId: attempt.institutionId,
      attemptId: attempt.id,
      questionId: String(questionId),
      gradedByUid: user.uid,
      gradedByName: user.displayName,
      awardedPoints: boundedPts,
      maxPoints: maxPts,
      feedback: String(feedback || "").trim(),
      aiSuggestedPoints: aiSuggestedPoints !== void 0 ? Number(aiSuggestedPoints) : void 0,
      aiSuggestedFeedback: aiSuggestedFeedback ? String(aiSuggestedFeedback) : void 0,
      createdAt: nowIso
    };
    db.gradingRecords.unshift(gradingRecord);
    const existingStudentMastery = db.masteryRecords.filter((r) => r.studentId === attempt.studentId);
    const otherMastery = db.masteryRecords.filter((r) => r.studentId !== attempt.studentId);
    const updatedStudentMastery = updateMasteryRecordsFromAttempt(
      existingStudentMastery,
      attempt.studentId,
      attempt.institutionId,
      updatedAttempt.topicBreakdown,
      db.topics,
      nowIso
    );
    db.masteryRecords = [...otherMastery, ...updatedStudentMastery];
    pushNotification(
      db,
      attempt.institutionId,
      attempt.studentId,
      "Yozma javobingiz baholandi",
      `"${attempt.assessmentTitle}" testidagi yozma javobingiz o'qituvchi ${user.displayName} tomonidan baholandi (${boundedPts}/${maxPts} ball). Umumiy natija: ${updatedAttempt.scorePercent}%.`,
      `/student/results/${attempt.id}`
    );
    appendAuditLog(
      db,
      attempt.institutionId,
      user,
      `Yozma javob baholandi (${boundedPts}/${maxPts} ball)`,
      `${attempt.studentName} \u2014 ${attempt.assessmentTitle}`,
      gradingRecord.id
    );
    saveDbState(env, db);
    broadcastInstitutionUpdate(env, attempt.institutionId, "ATTEMPT_GRADED");
    return res.json({
      attempt: updatedAttempt,
      gradingRecord,
      masteryRecords: updatedStudentMastery
    });
  });
  function recordVerifiedStudentGamificationEvent(db, params) {
    if (!Array.isArray(db.studentGamificationProfiles)) db.studentGamificationProfiles = [];
    if (!Array.isArray(db.learningActivityEvents)) db.learningActivityEvents = [];
    if (!Array.isArray(db.xpLedger)) db.xpLedger = [];
    if (!Array.isArray(db.gamificationBadges) || db.gamificationBadges.length === 0) {
      db.gamificationBadges = DEFAULT_GAMIFICATION_BADGES.map((b) => ({ ...b }));
    }
    if (!Array.isArray(db.studentBadges)) db.studentBadges = [];
    if (!Array.isArray(db.streakRecords)) db.streakRecords = [];
    if (!Array.isArray(db.classChallenges)) db.classChallenges = [];
    if (!db.gamificationConfig) {
      db.gamificationConfig = {
        ...DEFAULT_GAMIFICATION_CONFIG,
        xpRewards: { ...DEFAULT_GAMIFICATION_CONFIG.xpRewards },
        goalTemplates: [...DEFAULT_GAMIFICATION_CONFIG.goalTemplates]
      };
    }
    const existingProfile = db.studentGamificationProfiles.find(
      (p) => p.studentId === params.studentId
    );
    const existingStreak = db.streakRecords.find((s) => s.studentId === params.studentId);
    const result = processVerifiedLearningEvent({
      ...params,
      config: db.gamificationConfig,
      badgeDefinitions: db.gamificationBadges,
      existingProfile,
      existingEvents: db.learningActivityEvents,
      existingLedger: db.xpLedger,
      existingStudentBadges: db.studentBadges,
      existingStreak,
      existingChallenges: db.classChallenges
    });
    if (!result.duplicate) {
      const pIdx = db.studentGamificationProfiles.findIndex(
        (p) => p.studentId === params.studentId
      );
      if (pIdx >= 0) {
        db.studentGamificationProfiles[pIdx] = result.profile;
      } else {
        db.studentGamificationProfiles.push(result.profile);
      }
      if (result.event) {
        db.learningActivityEvents.unshift(result.event);
      }
      if (result.ledgerEntry) {
        db.xpLedger.unshift(result.ledgerEntry);
      }
      if (result.newlyEarnedBadges.length > 0) {
        db.studentBadges.unshift(...result.newlyEarnedBadges);
      }
      const sIdx = db.streakRecords.findIndex((s) => s.studentId === params.studentId);
      if (sIdx >= 0) {
        db.streakRecords[sIdx] = result.streak;
      } else {
        db.streakRecords.push(result.streak);
      }
      db.classChallenges = result.updatedChallenges;
    }
    return result;
  }
  app.post("/api/student/checkin", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "student") {
      return res.status(403).json({ error: "Kunlik maqsad faqat o'quvchilar uchun." });
    }
    const { selectedSubject, selectedGoal, completionState, dateOverride } = req.body;
    const cleanSubject = String(selectedSubject || "Matematika").trim();
    const cleanGoal = String(selectedGoal || "1 ta darsni o'rganish").trim();
    if (!cleanGoal) {
      return res.status(400).json({ error: "Bugungi maqsadni tanlang yoki kiriting." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const dateKey = env === "test" && dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(String(dateOverride)) ? String(dateOverride) : getTashkentDateString();
    const myClass = db.classes.find(
      (c) => c.id === user.classId || user.classCode && c.code.toLowerCase() === user.classCode.toLowerCase()
    );
    const classCode = (myClass?.code || user.classCode || "7a1").toLowerCase();
    if (!Array.isArray(db.learningCheckins)) db.learningCheckins = [];
    const checkinId = `${user.uid}_${dateKey}`;
    const existingIdx = db.learningCheckins.findIndex((c) => c.id === checkinId);
    const gamificationResult = recordVerifiedStudentGamificationEvent(db, {
      studentId: user.uid,
      classCode,
      activityType: "daily_checkin",
      idempotencyKey: `checkin:${user.uid}:${dateKey}`,
      reason: `Bugungi maqsad belgilandi (${cleanSubject}: ${cleanGoal})`,
      subject: cleanSubject,
      occurredAt: nowIso,
      dateKey
    });
    const checkinRecord = {
      id: checkinId,
      studentId: user.uid,
      classCode,
      date: dateKey,
      time: nowIso,
      selectedSubject: cleanSubject,
      selectedGoal: cleanGoal,
      completionState: completionState === "completed" ? "completed" : "active",
      xpAwarded: existingIdx >= 0 ? db.learningCheckins[existingIdx].xpAwarded : gamificationResult.xpAwarded,
      completedAt: completionState === "completed" ? nowIso : void 0
    };
    if (existingIdx >= 0) {
      db.learningCheckins[existingIdx] = checkinRecord;
    } else {
      db.learningCheckins.unshift(checkinRecord);
    }
    saveDbState(env, db);
    return res.json({
      message: "Bugungi maqsading belgilandi!",
      checkin: checkinRecord,
      gamification: gamificationResult
    });
  });
  app.post("/api/student/lessons/:lessonId/complete", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "student") {
      return res.status(403).json({ error: "Darsni yakunlash faqat o'quvchi hisobi uchun." });
    }
    const lesson = db.lessons.find((l) => l.id === req.params.lessonId);
    if (!lesson) {
      return res.status(404).json({ error: "Dars topilmadi." });
    }
    const myClass = db.classes.find(
      (c) => c.id === user.classId || user.classCode && c.code.toLowerCase() === user.classCode.toLowerCase()
    );
    const classCode = (myClass?.code || user.classCode || "7a1").toLowerCase();
    if (!lessonMatchesClass(lesson, classCode)) {
      return res.status(403).json({ error: "Ushbu dars sizning sinfingizga biriktirilmagan." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const dateKey = env === "test" && req.body?.dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.dateOverride)) ? String(req.body.dateOverride) : getTashkentDateString();
    if (!Array.isArray(db.studentLessonCompletions)) db.studentLessonCompletions = [];
    const compId = `${user.uid}_${lesson.id}`;
    const existingCompIdx = db.studentLessonCompletions.findIndex((c) => c.id === compId);
    const completionRecord = {
      id: compId,
      studentId: user.uid,
      classCode,
      lessonId: lesson.id,
      workPlanId: lesson.workPlanId || "",
      subject: lesson.subjectName || lesson.subject || "Matematika",
      curriculumArea: lesson.curriculumArea,
      quarter: lesson.quarter || 1,
      status: "completed",
      practiceCompleted: existingCompIdx >= 0 ? db.studentLessonCompletions[existingCompIdx].practiceCompleted : Boolean(req.body?.practiceCompleted),
      completedAt: existingCompIdx >= 0 && db.studentLessonCompletions[existingCompIdx].completedAt ? db.studentLessonCompletions[existingCompIdx].completedAt : nowIso,
      updatedAt: nowIso
    };
    if (existingCompIdx >= 0) {
      db.studentLessonCompletions[existingCompIdx] = completionRecord;
    } else {
      db.studentLessonCompletions.push(completionRecord);
    }
    const gamificationResult = recordVerifiedStudentGamificationEvent(db, {
      studentId: user.uid,
      classCode,
      activityType: "lesson_completed",
      idempotencyKey: `lesson_complete:${user.uid}:${lesson.id}`,
      reason: `Dars yakunlandi: ${lesson.lessonNumber}-dars \u2014 ${lesson.title}`,
      subject: lesson.subjectName || lesson.subject,
      curriculumArea: lesson.curriculumArea,
      topicId: lesson.topicId,
      lessonId: lesson.id,
      quarter: lesson.quarter || 1,
      occurredAt: nowIso,
      dateKey
    });
    const badgeType = classifyRoadmap2LessonBadge(lesson);
    if (badgeType === "BSB" || badgeType === "CHSB" || badgeType === "Loyiha ishi") {
      recordVerifiedStudentGamificationEvent(db, {
        studentId: user.uid,
        classCode,
        activityType: "curriculum_milestone_completed",
        idempotencyKey: `milestone_lesson:${user.uid}:${lesson.id}`,
        reason: `O'quv marrasi yakunlandi: ${lesson.title}`,
        subject: lesson.subjectName || lesson.subject,
        curriculumArea: lesson.curriculumArea,
        topicId: lesson.topicId,
        lessonId: lesson.id,
        quarter: lesson.quarter || 1,
        occurredAt: nowIso,
        dateKey
      });
    }
    if (Array.isArray(db.studentGoals) && !gamificationResult.duplicate) {
      for (const goal of db.studentGoals) {
        if (goal.studentId === user.uid && goal.status === "active") {
          goal.currentCount = Math.min(goal.targetCount, goal.currentCount + 1);
          if (goal.currentCount >= goal.targetCount) {
            goal.status = "completed";
            goal.completedAt = nowIso;
            if (goal.period === "weekly") {
              recordVerifiedStudentGamificationEvent(db, {
                studentId: user.uid,
                classCode,
                activityType: "weekly_goal_completed",
                idempotencyKey: `goal_complete:${user.uid}:${goal.id}`,
                reason: `Haftalik maqsad bajarildi: ${goal.title}`,
                subject: goal.subject,
                goalId: goal.id,
                occurredAt: nowIso,
                dateKey
              });
            }
          }
        }
      }
    }
    saveDbState(env, db);
    return res.json({
      completion: completionRecord,
      gamification: gamificationResult
    });
  });
  app.post("/api/student/lessons/:lessonId/practice", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "student") {
      return res.status(403).json({ error: "Amaliy mashq faqat o'quvchi hisobi uchun." });
    }
    const lesson = db.lessons.find((l) => l.id === req.params.lessonId);
    if (!lesson) {
      return res.status(404).json({ error: "Dars topilmadi." });
    }
    const myClass = db.classes.find(
      (c) => c.id === user.classId || user.classCode && c.code.toLowerCase() === user.classCode.toLowerCase()
    );
    const classCode = (myClass?.code || user.classCode || "7a1").toLowerCase();
    if (!lessonMatchesClass(lesson, classCode)) {
      return res.status(403).json({ error: "Ushbu dars sizning sinfingizga biriktirilmagan." });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const dateKey = env === "test" && req.body?.dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.dateOverride)) ? String(req.body.dateOverride) : getTashkentDateString();
    if (!Array.isArray(db.studentLessonCompletions)) db.studentLessonCompletions = [];
    const compId = `${user.uid}_${lesson.id}`;
    const existingIdx = db.studentLessonCompletions.findIndex((c) => c.id === compId);
    if (existingIdx >= 0) {
      db.studentLessonCompletions[existingIdx].practiceCompleted = true;
      db.studentLessonCompletions[existingIdx].updatedAt = nowIso;
    } else {
      db.studentLessonCompletions.push({
        id: compId,
        studentId: user.uid,
        classCode,
        lessonId: lesson.id,
        workPlanId: lesson.workPlanId || "",
        subject: lesson.subjectName || lesson.subject || "Matematika",
        curriculumArea: lesson.curriculumArea,
        quarter: lesson.quarter || 1,
        status: "in_progress",
        practiceCompleted: true,
        updatedAt: nowIso
      });
    }
    const gamificationResult = recordVerifiedStudentGamificationEvent(db, {
      studentId: user.uid,
      classCode,
      activityType: "practice_completed",
      idempotencyKey: `lesson_practice:${user.uid}:${lesson.id}`,
      reason: `Amaliy mashq bajarildi: ${lesson.lessonNumber}-dars \u2014 ${lesson.title}`,
      subject: lesson.subjectName || lesson.subject,
      curriculumArea: lesson.curriculumArea,
      topicId: lesson.topicId,
      lessonId: lesson.id,
      quarter: lesson.quarter || 1,
      occurredAt: nowIso,
      dateKey
    });
    saveDbState(env, db);
    return res.json({
      gamification: gamificationResult
    });
  });
  app.post("/api/student/goals", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "student") {
      return res.status(403).json({ error: "Shaxsiy o'quv maqsadi faqat o'quvchilar uchun." });
    }
    const { period = "weekly", subject = "Matematika", title, targetCount = 3 } = req.body;
    const cleanTitle = String(title || "Haftada 3 ta darsni o'zlashtirish").trim();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const dateKey = getTashkentDateString();
    const { weekKey } = getIsoWeekKey(dateKey);
    const myClass = db.classes.find(
      (c) => c.id === user.classId || user.classCode && c.code.toLowerCase() === user.classCode.toLowerCase()
    );
    const classCode = (myClass?.code || user.classCode || "7a1").toLowerCase();
    if (!Array.isArray(db.studentGoals)) db.studentGoals = [];
    const config = db.gamificationConfig || DEFAULT_GAMIFICATION_CONFIG;
    const newGoal = {
      id: `goal_${user.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      studentId: user.uid,
      classCode,
      period: period === "daily" ? "daily" : "weekly",
      subject: String(subject).trim(),
      title: cleanTitle,
      targetCount: Math.max(1, Math.min(50, Number(targetCount) || 3)),
      currentCount: 0,
      status: "active",
      weekKey: period === "weekly" ? weekKey : void 0,
      dateKey: period === "daily" ? dateKey : void 0,
      xpReward: period === "weekly" ? config.xpRewards.weekly_goal_completed : config.xpRewards.daily_checkin,
      createdAt: nowIso
    };
    db.studentGoals.unshift(newGoal);
    saveDbState(env, db);
    return res.json({ goal: newGoal });
  });
  app.put("/api/student/goals/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (!Array.isArray(db.studentGoals)) db.studentGoals = [];
    const goal = db.studentGoals.find(
      (g) => g.id === req.params.id && g.studentId === user.uid
    );
    if (!goal) {
      return res.status(404).json({ error: "Maqsad topilmadi." });
    }
    const { title, targetCount, currentCount, status } = req.body;
    if (title && String(title).trim()) goal.title = String(title).trim();
    if (targetCount !== void 0) {
      goal.targetCount = Math.max(1, Math.min(50, Number(targetCount) || goal.targetCount));
    }
    if (currentCount !== void 0) {
      goal.currentCount = Math.max(0, Math.min(goal.targetCount, Number(currentCount) || 0));
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let gamificationResult = null;
    if (status === "completed" || goal.currentCount >= goal.targetCount) {
      goal.currentCount = goal.targetCount;
      goal.status = "completed";
      goal.completedAt = goal.completedAt || nowIso;
      if (goal.period === "weekly") {
        gamificationResult = recordVerifiedStudentGamificationEvent(db, {
          studentId: user.uid,
          classCode: goal.classCode,
          activityType: "weekly_goal_completed",
          idempotencyKey: `goal_complete:${user.uid}:${goal.id}`,
          reason: `Haftalik maqsad bajarildi: ${goal.title}`,
          subject: goal.subject,
          goalId: goal.id,
          occurredAt: nowIso
        });
      }
    }
    saveDbState(env, db);
    return res.json({ goal, gamification: gamificationResult });
  });
  app.put("/api/student/profile-preferences", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (!Array.isArray(db.studentGamificationProfiles)) db.studentGamificationProfiles = [];
    let profile = db.studentGamificationProfiles.find((p) => p.studentId === user.uid);
    if (!profile) {
      profile = createInitialGamificationProfile(user.uid);
      db.studentGamificationProfiles.push(profile);
    }
    const allowedIcons = [
      "compass",
      "orbit",
      "prism",
      "summit",
      "stellar",
      "helix",
      "vector",
      "quantum"
    ];
    if (req.body.avatarIcon && allowedIcons.includes(req.body.avatarIcon)) {
      profile.avatarIcon = req.body.avatarIcon;
    }
    if (typeof req.body.streakRemindersEnabled === "boolean") {
      profile.streakRemindersEnabled = req.body.streakRemindersEnabled;
    }
    if (typeof req.body.notificationsEnabled === "boolean") {
      profile.notificationsEnabled = req.body.notificationsEnabled;
    }
    profile.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveDbState(env, db);
    return res.json({ profile });
  });
  app.post("/api/lessons/reorder", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Darslar tartibini o'zgartirish faqat administrator uchun." });
    }
    const { lessonId, direction, orderedLessonIds } = req.body;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    if (Array.isArray(orderedLessonIds) && orderedLessonIds.length > 0) {
      orderedLessonIds.forEach((id, idx) => {
        const l = db.lessons.find((item) => item.id === id);
        if (l) {
          const prevNum = l.lessonNumber;
          const nextNum = idx + 1;
          if (prevNum !== nextNum) {
            l.lessonNumber = nextNum;
            l.orderIndex = nextNum;
            l.updatedAt = nowIso;
            l.modificationHistory = [
              ...l.modificationHistory || [],
              {
                id: `mod_${Date.now()}_${idx}`,
                editedAt: nowIso,
                editedByUid: user.uid,
                editedByName: user.displayName,
                modifiedAt: nowIso,
                modifiedBy: user.displayName,
                changedFields: ["lessonNumber", "orderIndex"]
              }
            ];
          }
        }
      });
      saveDbState(env, db);
      return res.json({ status: "ok" });
    }
    const target = db.lessons.find((l) => l.id === lessonId);
    if (!target) {
      return res.status(404).json({ error: "Dars topilmadi." });
    }
    const quarterLessons = db.lessons.filter(
      (l) => l.workPlanId === target.workPlanId && l.quarter === target.quarter && l.status !== "archived"
    ).sort(
      (a, b) => (a.lessonNumber || a.orderIndex || 0) - (b.lessonNumber || b.orderIndex || 0)
    );
    const currentIdx = quarterLessons.findIndex((l) => l.id === target.id);
    const swapIdx = direction === "up" ? currentIdx - 1 : currentIdx + 1;
    if (currentIdx === -1 || swapIdx < 0 || swapIdx >= quarterLessons.length) {
      return res.status(400).json({ error: "Ushbu yo'nalishda siljitish imkonsiz." });
    }
    const neighbor = quarterLessons[swapIdx];
    const targetNum = target.lessonNumber || currentIdx + 1;
    const neighborNum = neighbor.lessonNumber || swapIdx + 1;
    target.lessonNumber = neighborNum;
    target.orderIndex = neighborNum;
    target.updatedAt = nowIso;
    target.modificationHistory = [
      ...target.modificationHistory || [],
      {
        id: `mod_${Date.now()}_1`,
        editedAt: nowIso,
        editedByUid: user.uid,
        editedByName: user.displayName,
        modifiedAt: nowIso,
        modifiedBy: user.displayName,
        changedFields: ["lessonNumber", "orderIndex"]
      }
    ];
    neighbor.lessonNumber = targetNum;
    neighbor.orderIndex = targetNum;
    neighbor.updatedAt = nowIso;
    neighbor.modificationHistory = [
      ...neighbor.modificationHistory || [],
      {
        id: `mod_${Date.now()}_2`,
        editedAt: nowIso,
        editedByUid: user.uid,
        editedByName: user.displayName,
        modifiedAt: nowIso,
        modifiedBy: user.displayName,
        changedFields: ["lessonNumber", "orderIndex"]
      }
    ];
    const wp = db.workPlans.find((w) => w.id === target.workPlanId);
    if (wp && Array.isArray(wp.rows)) {
      const r1 = wp.rows.find((r) => r.rowId === target.id);
      const r2 = wp.rows.find((r) => r.rowId === neighbor.id);
      if (r1) r1.lessonNumber = target.lessonNumber;
      if (r2) r2.lessonNumber = neighbor.lessonNumber;
      wp.rows.sort((a, b) => a.quarter - b.quarter || a.lessonNumber - b.lessonNumber);
    }
    appendAuditLog(
      db,
      user.institutionId,
      user,
      `Dars tartibi o'zgartirildi (${targetNum} <-> ${neighborNum})`,
      target.title,
      target.id
    );
    saveDbState(env, db);
    return res.json({ status: "ok", swapped: [target.id, neighbor.id] });
  });
  app.put("/api/admin/gamification-config", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Gamifikatsiya sozlamalari faqat administrator uchun." });
    }
    if (!db.gamificationConfig) {
      db.gamificationConfig = {
        ...DEFAULT_GAMIFICATION_CONFIG,
        xpRewards: { ...DEFAULT_GAMIFICATION_CONFIG.xpRewards },
        goalTemplates: [...DEFAULT_GAMIFICATION_CONFIG.goalTemplates]
      };
    }
    const cfg = db.gamificationConfig;
    const {
      enabled,
      xpRewards,
      dailyXpCap,
      streakGraceDays,
      enableDailyCheckin,
      enableBadges,
      enableStreaks,
      enableClassChallenges,
      enableWeeklyRecap,
      goalTemplates,
      badgeUpdates
    } = req.body;
    if (typeof enabled === "boolean") cfg.enabled = enabled;
    if (xpRewards && typeof xpRewards === "object") {
      for (const k of Object.keys(cfg.xpRewards)) {
        if (xpRewards[k] !== void 0) {
          cfg.xpRewards[k] = Math.max(0, Math.min(500, Number(xpRewards[k]) || 0));
        }
      }
    }
    if (dailyXpCap !== void 0) {
      cfg.dailyXpCap = Math.max(10, Math.min(2e3, Number(dailyXpCap) || 150));
    }
    if (streakGraceDays !== void 0) {
      cfg.streakGraceDays = Math.max(0, Math.min(7, Number(streakGraceDays) || 0));
    }
    if (typeof enableDailyCheckin === "boolean") cfg.enableDailyCheckin = enableDailyCheckin;
    if (typeof enableBadges === "boolean") cfg.enableBadges = enableBadges;
    if (typeof enableStreaks === "boolean") cfg.enableStreaks = enableStreaks;
    if (typeof enableClassChallenges === "boolean") cfg.enableClassChallenges = enableClassChallenges;
    if (typeof enableWeeklyRecap === "boolean") cfg.enableWeeklyRecap = enableWeeklyRecap;
    if (Array.isArray(goalTemplates) && goalTemplates.length > 0) {
      cfg.goalTemplates = goalTemplates.map((t) => String(t).trim()).filter(Boolean);
    }
    if (Array.isArray(badgeUpdates) && Array.isArray(db.gamificationBadges)) {
      for (const upd of badgeUpdates) {
        const badge = db.gamificationBadges.find((b) => b.code === upd.code || b.id === upd.id);
        if (badge) {
          if (upd.thresholdValue !== void 0) {
            badge.thresholdValue = Math.max(1, Number(upd.thresholdValue) || badge.thresholdValue);
          }
          if (typeof upd.isActive === "boolean") {
            badge.isActive = upd.isActive;
          }
          if (upd.title) badge.title = String(upd.title).trim();
          if (upd.description) badge.description = String(upd.description).trim();
        }
      }
    }
    cfg.updatedByUid = user.uid;
    cfg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    appendAuditLog(
      db,
      user.institutionId,
      user,
      "Gamifikatsiya tizimi sozlamalari yangilandi",
      "GamificationConfig",
      "default"
    );
    saveDbState(env, db);
    return res.json({
      gamificationConfig: cfg,
      gamificationBadges: db.gamificationBadges
    });
  });
  app.post("/api/admin/class-challenges", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Sinf maqsadini yaratish faqat administrator uchun." });
    }
    const {
      classCode = "7a1",
      title,
      description,
      targetType = "lessons",
      targetCount = 30,
      subject,
      startDate,
      endDate
    } = req.body;
    const cleanTitle = String(title || "Bu hafta sinf bo'lib 30 ta darsni yakunlaymiz").trim();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const todayKey = getTashkentDateString();
    const { weekStartDate, weekEndDate } = getIsoWeekKey(todayKey);
    if (!Array.isArray(db.classChallenges)) db.classChallenges = [];
    const challenge = {
      id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      classCode: String(classCode).toLowerCase(),
      title: cleanTitle,
      description: String(description || "Sinf o'quvchilarining hamkorlikdagi haftalik o'quv marrasi").trim(),
      targetType: ["lessons", "assessments", "checkins", "activities"].includes(targetType) ? targetType : "lessons",
      targetCount: Math.max(1, Number(targetCount) || 30),
      currentCount: 0,
      contributorStudentIds: [],
      subject: subject ? String(subject).trim() : void 0,
      startDate: startDate ? String(startDate) : weekStartDate,
      endDate: endDate ? String(endDate) : weekEndDate,
      isActive: true,
      createdByUid: user.uid,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.classChallenges.unshift(challenge);
    saveDbState(env, db);
    return res.json({ challenge });
  });
  app.put("/api/admin/class-challenges/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    if (!Array.isArray(db.classChallenges)) db.classChallenges = [];
    const ch = db.classChallenges.find((c) => c.id === req.params.id);
    if (!ch) return res.status(404).json({ error: "Sinf maqsadi topilmadi." });
    if (req.body.title) ch.title = String(req.body.title).trim();
    if (req.body.description !== void 0) ch.description = String(req.body.description).trim();
    if (req.body.targetCount !== void 0) {
      ch.targetCount = Math.max(1, Number(req.body.targetCount) || ch.targetCount);
    }
    if (typeof req.body.isActive === "boolean") ch.isActive = req.body.isActive;
    ch.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveDbState(env, db);
    return res.json({ challenge: ch });
  });
  app.get("/api/attendance", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (!Array.isArray(db.attendanceRecords)) db.attendanceRecords = [];
    if (!Array.isArray(db.attendanceSessions)) db.attendanceSessions = [];
    const { classCode, studentId, startDate, endDate, status } = req.query;
    const effectiveStudentId = user.role === "student" ? user.uid : studentId ? String(studentId) : void 0;
    let filtered = db.attendanceRecords.filter((r) => {
      if (effectiveStudentId && r.studentId !== effectiveStudentId) return false;
      if (classCode && classCode !== "ALL" && r.classCode?.toLowerCase() !== String(classCode).toLowerCase()) return false;
      if (status && status !== "ALL" && r.status !== status) return false;
      if (startDate && r.date < String(startDate)) return false;
      if (endDate && r.date > String(endDate)) return false;
      return true;
    });
    const stats = calculateAttendanceStats(filtered);
    const sessions = db.attendanceSessions.filter((s) => {
      if (classCode && classCode !== "ALL" && s.classCode?.toLowerCase() !== String(classCode).toLowerCase()) return false;
      if (startDate && s.date < String(startDate)) return false;
      if (endDate && s.date > String(endDate)) return false;
      return true;
    });
    return res.json({
      records: filtered,
      stats,
      sessions
    });
  });
  app.post("/api/attendance/mark", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Faqat vakolatli administrator davomatni qayd eta oladi." });
    }
    const { classCode, date, records } = req.body;
    if (!classCode || !date || !Array.isArray(records)) {
      return res.status(400).json({ error: "Sinf, sana va davomat ro\u2018yxatini kiriting." });
    }
    const normClass = String(classCode).toLowerCase();
    const normDate = String(date).slice(0, 10);
    const inst = db.institutions[0];
    const instId = inst?.id || "inst-spec-study";
    const cls = db.classes.find((c) => (c.code || c.name).toLowerCase() === normClass);
    const classId = cls?.id || normClass;
    if (!Array.isArray(db.attendanceRecords)) db.attendanceRecords = [];
    if (!Array.isArray(db.attendanceSessions)) db.attendanceSessions = [];
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    const sessionId = `session_${classId}_${normDate}`;
    const attRecords = db.attendanceRecords || (db.attendanceRecords = []);
    records.forEach((item) => {
      const student = db.users.find((u) => u.uid === item.studentId);
      const studentName = student?.displayName || "O\u2018quvchi";
      const status = item.status;
      if (status === "PRESENT") presentCount++;
      else if (status === "ABSENT") absentCount++;
      else if (status === "LATE") lateCount++;
      else if (status === "EXCUSED_ABSENCE") excusedCount++;
      const recordId = `att_${item.studentId}_${normDate}`;
      const existingIdx = attRecords.findIndex((r) => r.id === recordId || r.studentId === item.studentId && r.date === normDate);
      const newRecord = {
        id: recordId,
        sessionId,
        institutionId: instId,
        classId,
        classCode: normClass,
        studentId: item.studentId,
        studentName,
        date: normDate,
        status,
        reasonCategory: item.reasonCategory,
        notes: item.notes,
        recordedByUid: user.uid,
        recordedByName: user.displayName,
        recordedAt: existingIdx >= 0 ? attRecords[existingIdx].recordedAt : nowIso,
        updatedAt: nowIso
      };
      if (existingIdx >= 0) {
        attRecords[existingIdx] = newRecord;
      } else {
        attRecords.push(newRecord);
      }
    });
    const totalEnrolled = records.length;
    const attendedCount = presentCount + lateCount;
    const attendancePercent = totalEnrolled === 0 ? 100 : Math.round(attendedCount / totalEnrolled * 100);
    const session = {
      id: sessionId,
      institutionId: instId,
      classId,
      classCode: normClass,
      date: normDate,
      academicYear: inst?.academicYear || "2026-2027",
      recordedByUid: user.uid,
      recordedByName: user.displayName,
      totalEnrolled,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      attendancePercent,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    const sessList = db.attendanceSessions || (db.attendanceSessions = []);
    const sessIdx = sessList.findIndex((s) => s.id === sessionId || s.classId === classId && s.date === normDate);
    if (sessIdx >= 0) {
      sessList[sessIdx] = session;
    } else {
      sessList.push(session);
    }
    appendAuditLog(
      db,
      instId,
      user,
      `Davomat saqlandi (${normClass}, ${normDate}): ${attendedCount}/${totalEnrolled}`,
      normClass,
      sessionId,
      { eventType: "ATTENDANCE_RECORDED", outcome: "success", severity: "INFO" }
    );
    saveDbState(env, db);
    return res.json({ success: true, count: records.length, session });
  });
  app.post("/api/attendance/import", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Faqat administrator davomat import qila oladi." });
    }
    const { rows, confirm, duplicatePolicy } = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: "Jadval qatorlari topilmadi." });
    }
    if (!Array.isArray(db.attendanceRecords)) db.attendanceRecords = [];
    const preview = validateAttendanceImportRows(rows, db.attendanceRecords, db.users);
    if (!confirm) {
      return res.json({ preview });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const instId = db.institutions[0]?.id || "inst-spec-study";
    let importedCount = 0;
    const records = db.attendanceRecords || (db.attendanceRecords = []);
    preview.rows.forEach((p) => {
      if (p.status === "error") return;
      if (p.status === "conflict" && duplicatePolicy === "skip_existing") return;
      if (!p.normalizedStudentId || !p.normalizedDate || !p.normalizedStatus) return;
      const recordId = `att_${p.normalizedStudentId}_${p.normalizedDate}`;
      const existingIdx = records.findIndex((r) => r.id === recordId);
      const student = db.users.find((u) => u.uid === p.normalizedStudentId);
      const record = {
        id: recordId,
        institutionId: instId,
        classId: student?.classId || p.normalizedClassCode || "",
        classCode: p.normalizedClassCode || student?.classCode || "7a1",
        studentId: p.normalizedStudentId,
        studentName: student?.displayName || p.rawStudentName,
        date: p.normalizedDate,
        status: p.normalizedStatus,
        recordedByUid: user.uid,
        recordedByName: user.displayName,
        recordedAt: existingIdx >= 0 ? records[existingIdx].recordedAt : nowIso,
        updatedAt: nowIso
      };
      if (existingIdx >= 0) {
        records[existingIdx] = record;
      } else {
        records.push(record);
      }
      importedCount++;
    });
    saveDbState(env, db);
    return res.json({ success: true, importedCount });
  });
  app.get("/api/attendance/export.xlsx", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    if (!Array.isArray(db.attendanceRecords)) db.attendanceRecords = [];
    const classCode = req.query.classCode ? String(req.query.classCode).toLowerCase() : void 0;
    const filtered = db.attendanceRecords.filter((r) => {
      if (classCode && classCode !== "all" && r.classCode?.toLowerCase() !== classCode) return false;
      return true;
    });
    const rows = [
      ["O\u2018quvchi ID", "F.I.Sh.", "Sinf", "Sana", "Holat", "Sabab / Izoh", "Qayd etgan shaxs", "Qayd etilgan vaqt"],
      ...filtered.map((r) => {
        const stu = db.users.find((u) => u.uid === r.studentId);
        return [
          stu?.studentCode || r.studentId,
          r.studentName,
          r.classCode,
          r.date,
          ATTENDANCE_STATUS_LABELS[r.status] || r.status,
          r.notes || r.reasonCategory || "",
          r.recordedByName,
          new Date(r.recordedAt).toLocaleString("uz-UZ")
        ];
      })
    ];
    const ws = XLSX5.utils.aoa_to_sheet(rows);
    const wb = XLSX5.utils.book_new();
    XLSX5.utils.book_append_sheet(wb, ws, "Davomat");
    const buf = XLSX5.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=specialized_study_davomat_${classCode || "barcha"}.xlsx`);
    return res.send(buf);
  });
  app.get("/api/student-intelligence/:studentId", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    const targetStudentId = req.params.studentId;
    if (user.role === "student" && user.uid !== targetStudentId) {
      return res.status(403).json({ error: "Boshqa o\u2018quvchining ma\u2019lumotlariga ruxsat berilmagan." });
    }
    const student = db.users.find((u) => u.uid === targetStudentId && u.role === "student");
    if (!student) {
      return res.status(404).json({ error: "O\u2018quvchi topilmadi." });
    }
    if (!Array.isArray(db.attendanceRecords)) db.attendanceRecords = [];
    if (!Array.isArray(db.studentAssignments)) db.studentAssignments = [];
    if (!Array.isArray(db.assignmentSubmissions)) db.assignmentSubmissions = [];
    if (!Array.isArray(db.studentAlerts)) db.studentAlerts = [];
    if (!Array.isArray(db.studentSupportPlans)) db.studentSupportPlans = [];
    const studentAttRecords = db.attendanceRecords.filter((r) => r.studentId === targetStudentId);
    const attStats = calculateAttendanceStats(studentAttRecords);
    const academicMetrics = calculateStudentAcademicMetrics(
      student,
      db.attempts || [],
      db.assessments || [],
      db.topics || [],
      db.lessons || []
    );
    const studentSubmissions = db.assignmentSubmissions.filter((s) => s.studentId === targetStudentId);
    const studentAlerts = db.studentAlerts.filter((a) => a.studentId === targetStudentId);
    const studentSupportPlans = db.studentSupportPlans.filter((p) => p.studentId === targetStudentId);
    let activeAlerts = studentAlerts;
    if (user.role === "admin" || user.role === "platform_owner") {
      const generated = generateSmartRiskAlerts(
        student,
        attStats,
        academicMetrics,
        studentSubmissions,
        db.studentAssignments,
        studentAlerts
      );
      if (generated.length > 0) {
        db.studentAlerts.push(...generated);
        activeAlerts = db.studentAlerts.filter((a) => a.studentId === targetStudentId);
      }
    }
    const now = /* @__PURE__ */ new Date();
    const monthlyGrid = buildMonthlyAttendanceGrid(now.getFullYear(), now.getMonth() + 1, studentAttRecords);
    return res.json({
      student,
      attendanceStats: attStats,
      monthlyAttendanceGrid: monthlyGrid,
      academicMetrics,
      submissions: studentSubmissions,
      alerts: user.role === "student" ? [] : activeAlerts,
      // Administrative alerts are private to Admin
      supportPlans: user.role === "student" ? [] : studentSupportPlans,
      // Private to Admin
      attempts: (db.attempts || []).filter((a) => a.studentId === targetStudentId)
    });
  });
  app.get("/api/class-monitoring/:classCode", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const code = String(req.params.classCode).toLowerCase();
    const cls = db.classes.find((c) => (c.code || c.name).toLowerCase() === code);
    if (!cls) return res.status(404).json({ error: "Sinf topilmadi." });
    const enrolled = db.users.filter((u) => u.role === "student" && (u.classId === cls.id || u.classCode?.toLowerCase() === code));
    const snapshot = calculateClassMonitoringSnapshot(
      code,
      cls.grade,
      cls.track,
      enrolled,
      db.attendanceRecords || [],
      db.studentAssignments || [],
      db.assignmentSubmissions || [],
      db.attempts || [],
      db.studentAlerts || [],
      db.studentSupportPlans || []
    );
    return res.json({ snapshot, enrolledStudents: enrolled });
  });
  app.get("/api/class-monitoring-all", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const snapshots = db.classes.map((cls) => {
      const code = (cls.code || cls.name).toLowerCase();
      const enrolled = db.users.filter((u) => u.role === "student" && (u.classId === cls.id || u.classCode?.toLowerCase() === code));
      return calculateClassMonitoringSnapshot(
        code,
        cls.grade,
        cls.track,
        enrolled,
        db.attendanceRecords || [],
        db.studentAssignments || [],
        db.assignmentSubmissions || [],
        db.attempts || [],
        db.studentAlerts || [],
        db.studentSupportPlans || []
      );
    });
    return res.json({ snapshots });
  });
  app.get("/api/assignments", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (!Array.isArray(db.studentAssignments)) db.studentAssignments = [];
    if (!Array.isArray(db.assignmentSubmissions)) db.assignmentSubmissions = [];
    if (user.role === "student") {
      const classCode = (user.classCode || "").toLowerCase();
      const visibleAssignments = db.studentAssignments.filter(
        (a) => a.targetClassCodes.some((c) => c.toLowerCase() === classCode)
      );
      const mySubmissions = db.assignmentSubmissions.filter((s) => s.studentId === user.uid);
      return res.json({ assignments: visibleAssignments, submissions: mySubmissions });
    }
    return res.json({
      assignments: db.studentAssignments,
      submissions: db.assignmentSubmissions
    });
  });
  app.post("/api/assignments", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Faqat administrator topshiriq e\u2019lon qila oladi." });
    }
    const {
      title,
      description,
      subject,
      curriculumArea,
      targetClassCodes,
      assignedDate,
      dueDate,
      maxScore,
      instructions,
      status: requestedStatus,
      sourceType,
      relatedLessonId,
      relatedLessonTitle,
      relatedTopicId,
      relatedTopicName,
      relatedAssessmentId,
      submissionType,
      allowResubmission,
      resubmissionPolicy,
      rubricId,
      attachmentUrls
    } = req.body;
    if (!title || !subject || !Array.isArray(targetClassCodes) || targetClassCodes.length === 0) {
      return res.status(400).json({ error: "Topshiriq nomi, fan va kamida bitta sinfni tanlang." });
    }
    if (!Array.isArray(db.studentAssignments)) db.studentAssignments = [];
    if (!Array.isArray(db.assignmentSubmissions)) db.assignmentSubmissions = [];
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const instId = db.institutions[0]?.id || "inst-spec-study";
    const assignmentId = `asg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const normalizedStatus = requestedStatus === "draft" || requestedStatus === "closed" ? requestedStatus : "published";
    const assignment = {
      id: assignmentId,
      institutionId: instId,
      title: String(title).trim(),
      description: String(description || "").trim(),
      subject: String(subject).trim(),
      curriculumArea: curriculumArea ? String(curriculumArea).trim() : void 0,
      classCode: targetClassCodes[0]?.toLowerCase(),
      targetClassCodes: targetClassCodes.map((c) => c.toLowerCase()),
      targetClassIds: targetClassCodes.map((c) => {
        const found = db.classes.find((cls) => (cls.code || cls.name).toLowerCase() === c.toLowerCase());
        return found?.id || c;
      }),
      assignedDate: assignedDate || nowIso.slice(0, 10),
      dueDate: dueDate || new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
      maxScore: Number(maxScore) || 20,
      status: normalizedStatus,
      sourceType: sourceType || "custom",
      relatedLessonId: relatedLessonId || void 0,
      relatedLessonTitle: relatedLessonTitle || void 0,
      relatedTopicId: relatedTopicId || void 0,
      relatedTopicName: relatedTopicName || void 0,
      relatedAssessmentId: relatedAssessmentId || void 0,
      submissionType: submissionType || "written_text",
      allowResubmission: allowResubmission !== false,
      resubmissionPolicy: resubmissionPolicy ? String(resubmissionPolicy).trim() : void 0,
      rubricId: rubricId || void 0,
      attachmentUrls: Array.isArray(attachmentUrls) ? attachmentUrls : void 0,
      instructions: instructions ? String(instructions).trim() : void 0,
      createdByUid: user.uid,
      createdByName: user.displayName,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    const asgs = db.studentAssignments || (db.studentAssignments = []);
    asgs.unshift(assignment);
    if (normalizedStatus === "published") {
      const targetCodes = new Set(assignment.targetClassCodes.map((c) => c.toLowerCase()));
      const enrolledStudents = db.users.filter((u) => u.role === "student" && targetCodes.has((u.classCode || "").toLowerCase()));
      const subs = db.assignmentSubmissions || (db.assignmentSubmissions = []);
      enrolledStudents.forEach((stu) => {
        const subId = `sub_${assignmentId}_${stu.uid}`;
        const sub = {
          id: subId,
          assignmentId,
          assignmentTitle: assignment.title,
          institutionId: instId,
          studentId: stu.uid,
          studentName: stu.displayName,
          classCode: stu.classCode || "7a1",
          classId: stu.classId || "",
          status: "Yangi",
          assignedDate: assignment.assignedDate,
          dueDate: assignment.dueDate,
          attemptCount: 0,
          maxScore: assignment.maxScore,
          createdAt: nowIso,
          updatedAt: nowIso
        };
        subs.push(sub);
      });
    }
    saveDbState(env, db);
    return res.json({ assignment });
  });
  app.put("/api/assignments/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Faqat administrator tahrirlay oladi." });
    }
    const asg = db.studentAssignments?.find((a) => a.id === req.params.id);
    if (!asg) return res.status(404).json({ error: "Topshiriq topilmadi." });
    const wasDraft = asg.status === "draft";
    if (req.body.title) asg.title = String(req.body.title).trim();
    if (req.body.description !== void 0) asg.description = String(req.body.description).trim();
    if (req.body.instructions !== void 0) asg.instructions = String(req.body.instructions).trim();
    if (req.body.dueDate) asg.dueDate = String(req.body.dueDate);
    if (req.body.maxScore) asg.maxScore = Number(req.body.maxScore);
    if (req.body.status) asg.status = req.body.status;
    if (req.body.allowResubmission !== void 0) asg.allowResubmission = Boolean(req.body.allowResubmission);
    if (req.body.submissionType) asg.submissionType = req.body.submissionType;
    if (req.body.rubricId !== void 0) asg.rubricId = req.body.rubricId || void 0;
    asg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (wasDraft && asg.status === "published") {
      const targetCodes = new Set(asg.targetClassCodes.map((c) => c.toLowerCase()));
      const enrolledStudents = db.users.filter((u) => u.role === "student" && targetCodes.has((u.classCode || "").toLowerCase()));
      const subs = db.assignmentSubmissions || (db.assignmentSubmissions = []);
      enrolledStudents.forEach((stu) => {
        if (!subs.some((s) => s.assignmentId === asg.id && s.studentId === stu.uid)) {
          subs.push({
            id: `sub_${asg.id}_${stu.uid}`,
            assignmentId: asg.id,
            assignmentTitle: asg.title,
            institutionId: asg.institutionId,
            studentId: stu.uid,
            studentName: stu.displayName,
            classCode: stu.classCode || "7a1",
            classId: stu.classId || "",
            status: "Yangi",
            assignedDate: asg.assignedDate,
            dueDate: asg.dueDate,
            attemptCount: 0,
            maxScore: asg.maxScore,
            createdAt: asg.updatedAt,
            updatedAt: asg.updatedAt
          });
        }
      });
    }
    saveDbState(env, db);
    return res.json({ assignment: asg });
  });
  app.post("/api/submissions/save-draft", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    const { assignmentId, draftContent, draftAttachmentUrl } = req.body;
    if (!assignmentId) return res.status(400).json({ error: "Topshiriq ID ko\u2018rsatilmadi." });
    if (!Array.isArray(db.assignmentSubmissions)) db.assignmentSubmissions = [];
    const asg = db.studentAssignments?.find((a) => a.id === assignmentId);
    if (!asg) return res.status(404).json({ error: "Topshiriq topilmadi." });
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let sub = db.assignmentSubmissions.find((s) => s.assignmentId === assignmentId && s.studentId === user.uid);
    if (!sub) {
      sub = {
        id: `sub_${assignmentId}_${user.uid}`,
        assignmentId,
        assignmentTitle: asg.title,
        institutionId: user.institutionId || "inst-spec-study",
        studentId: user.uid,
        studentName: user.displayName,
        classCode: user.classCode || "7a1",
        classId: user.classId || "",
        status: "Jarayonda",
        assignedDate: asg.assignedDate || nowIso.slice(0, 10),
        dueDate: asg.dueDate || nowIso.slice(0, 10),
        attemptCount: 0,
        draftContent: draftContent ? String(draftContent) : "",
        draftAttachmentUrl: draftAttachmentUrl ? String(draftAttachmentUrl) : void 0,
        draftSavedAt: nowIso,
        maxScore: asg.maxScore || 20,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      db.assignmentSubmissions.push(sub);
    } else {
      const updated = saveStudentAssignmentDraft(
        sub,
        draftContent !== void 0 ? String(draftContent) : sub.draftContent || "",
        draftAttachmentUrl !== void 0 ? String(draftAttachmentUrl) : sub.draftAttachmentUrl,
        nowIso
      );
      Object.assign(sub, updated);
    }
    saveDbState(env, db);
    return res.json({ submission: sub });
  });
  app.post("/api/submissions/submit", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    const { assignmentId, content, attachmentUrl, attachmentName, attachmentMimeType } = req.body;
    if (!assignmentId) return res.status(400).json({ error: "Topshiriq ID ko\u2018rsatilmadi." });
    if (!Array.isArray(db.assignmentSubmissions)) db.assignmentSubmissions = [];
    if (!Array.isArray(db.submissionRevisions)) db.submissionRevisions = [];
    const asg = db.studentAssignments?.find((a) => a.id === assignmentId);
    if (!asg) return res.status(404).json({ error: "Topshiriq topilmadi." });
    if (user.role === "student" && user.classCode && asg.targetClassCodes.length > 0 && !asg.targetClassCodes.some((c) => c.toLowerCase() === user.classCode.toLowerCase())) {
      return res.status(403).json({ error: "Ushbu topshiriq sizning sinfingiz uchun mo\u2018ljallanmagan." });
    }
    let sub = db.assignmentSubmissions.find((s) => s.assignmentId === assignmentId && s.studentId === user.uid);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    if (!sub) {
      sub = {
        id: `sub_${assignmentId}_${user.uid}`,
        assignmentId,
        assignmentTitle: asg.title || "Topshiriq",
        institutionId: user.institutionId || "inst-spec-study",
        studentId: user.uid,
        studentName: user.displayName,
        classCode: user.classCode || "7a1",
        classId: user.classId || "",
        status: "Yangi",
        assignedDate: asg.assignedDate || nowIso.slice(0, 10),
        dueDate: asg.dueDate || nowIso.slice(0, 10),
        attemptCount: 0,
        maxScore: asg.maxScore || 20,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      db.assignmentSubmissions.push(sub);
    }
    try {
      const { updatedSubmission, archivedRevision } = submitStudentAssignmentWork({
        assignment: asg,
        existingSubmission: sub,
        content: content ? String(content).trim() : "",
        attachmentUrl: attachmentUrl ? String(attachmentUrl).trim() : void 0,
        attachmentName: attachmentName ? String(attachmentName).trim() : void 0,
        attachmentMimeType: attachmentMimeType ? String(attachmentMimeType).trim() : void 0,
        nowIso
      });
      Object.assign(sub, updatedSubmission);
      if (archivedRevision) {
        db.submissionRevisions.unshift(archivedRevision);
      }
      saveDbState(env, db);
      return res.json({ submission: sub, archivedRevision });
    } catch (err) {
      return res.status(400).json({ error: err?.message || "Topshiriqni yuborishda xatolik." });
    }
  });
  app.post("/api/submissions/grade", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Faqat administrator baholay oladi." });
    }
    const {
      submissionId,
      score,
      feedback,
      status: requestedStatus,
      rubricId,
      criterionScores,
      reusableComments,
      recommendedLessonId,
      recommendedLessonTitle
    } = req.body;
    if (!submissionId) return res.status(400).json({ error: "Topshiriq ID ko\u2018rsatilmadi." });
    if (!Array.isArray(db.assignmentSubmissions)) db.assignmentSubmissions = [];
    if (!Array.isArray(db.gradingHistory)) db.gradingHistory = [];
    const sub = db.assignmentSubmissions.find((s) => s.id === submissionId);
    if (!sub) return res.status(404).json({ error: "Topshiriq javobi topilmadi." });
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const previousScore = sub.score;
    const numericScore = Math.max(0, Math.min(sub.maxScore, Number(score) || 0));
    sub.score = numericScore;
    sub.feedback = feedback ? String(feedback).trim() : sub.feedback;
    sub.status = requestedStatus === "Qaytarildi" ? "Qaytarildi" : "Tekshirildi";
    if (rubricId) sub.rubricId = String(rubricId);
    if (Array.isArray(criterionScores)) sub.criterionScores = criterionScores;
    if (Array.isArray(reusableComments)) sub.reusableComments = reusableComments;
    if (recommendedLessonId !== void 0) sub.recommendedLessonId = recommendedLessonId || void 0;
    if (recommendedLessonTitle !== void 0) sub.recommendedLessonTitle = recommendedLessonTitle || void 0;
    if (sub.aiSuggestion) {
      sub.aiSuggestion.approvalStatus = sub.aiSuggestion.suggestedTotalPoints === numericScore ? "approved_by_admin" : "modified_by_admin";
    }
    sub.gradedByUid = user.uid;
    sub.gradedByName = user.displayName;
    sub.gradedAt = nowIso;
    if (sub.status === "Qaytarildi") {
      sub.returnedAt = nowIso;
    }
    sub.updatedAt = nowIso;
    const asg = db.studentAssignments?.find((a) => a.id === sub.assignmentId);
    const historyEntry = {
      id: `gh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      institutionId: sub.institutionId,
      targetType: "assignment_submission",
      targetId: sub.id,
      studentId: sub.studentId,
      studentName: sub.studentName,
      classCode: sub.classCode,
      subject: asg?.subject || "Matematika",
      previousScore,
      newScore: numericScore,
      maxScore: sub.maxScore,
      rubricId: sub.rubricId,
      criterionScores: sub.criterionScores,
      feedback: sub.feedback || "",
      aiSuggestedPoints: sub.aiSuggestion?.suggestedTotalPoints,
      action: sub.status === "Qaytarildi" ? "returned_for_improvement" : previousScore !== void 0 ? "regraded" : "graded",
      confirmedByUid: user.uid,
      confirmedByName: user.displayName,
      confirmedAt: nowIso
    };
    db.gradingHistory.unshift(historyEntry);
    pushNotification(
      db,
      sub.institutionId,
      sub.studentId,
      sub.status === "Qaytarildi" ? `Topshiriq qayta ishlash uchun qaytarildi: ${sub.assignmentTitle}` : `Topshiriq tekshirildi: ${sub.assignmentTitle}`,
      `${numericScore}/${sub.maxScore} ball. ${sub.feedback || ""}`.trim(),
      "/student/dashboard"
    );
    saveDbState(env, db);
    return res.json({ submission: sub, historyEntry });
  });
  app.get("/api/alerts", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    if (!Array.isArray(db.studentAlerts)) db.studentAlerts = [];
    const { status, category, classCode, studentId } = req.query;
    const filtered = db.studentAlerts.filter((a) => {
      if (status && status !== "ALL" && a.status !== status) return false;
      if (category && category !== "ALL" && a.category !== category) return false;
      if (classCode && classCode !== "ALL" && a.classCode?.toLowerCase() !== String(classCode).toLowerCase()) return false;
      if (studentId && a.studentId !== String(studentId)) return false;
      return true;
    });
    return res.json({ alerts: filtered });
  });
  app.post("/api/alerts/generate", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const existingAlerts = db.studentAlerts || (db.studentAlerts = []);
    const students = db.users.filter((u) => u.role === "student" && u.status !== "archived");
    let generatedTotal = 0;
    students.forEach((stu) => {
      const stuAtt = (db.attendanceRecords || []).filter((r) => r.studentId === stu.uid);
      const attStats = calculateAttendanceStats(stuAtt);
      const metrics = calculateStudentAcademicMetrics(
        stu,
        db.attempts || [],
        db.assessments || [],
        db.topics || [],
        db.lessons || []
      );
      const subs = (db.assignmentSubmissions || []).filter((s) => s.studentId === stu.uid);
      const newAlerts = generateSmartRiskAlerts(stu, attStats, metrics, subs, db.studentAssignments || [], existingAlerts);
      newAlerts.forEach((a) => {
        existingAlerts.unshift(a);
        generatedTotal++;
      });
    });
    saveDbState(env, db);
    return res.json({ success: true, count: generatedTotal, totalAlerts: db.studentAlerts.length });
  });
  app.post("/api/alerts/:id/acknowledge", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const alert = db.studentAlerts?.find((a) => a.id === req.params.id);
    if (!alert) return res.status(404).json({ error: "Ogohlantirish topilmadi." });
    alert.status = "acknowledged";
    alert.acknowledgedByUid = user.uid;
    alert.acknowledgedByName = user.displayName;
    alert.acknowledgedAt = (/* @__PURE__ */ new Date()).toISOString();
    alert.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveDbState(env, db);
    return res.json({ alert });
  });
  app.post("/api/alerts/:id/resolve", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const alert = db.studentAlerts?.find((a) => a.id === req.params.id);
    if (!alert) return res.status(404).json({ error: "Ogohlantirish topilmadi." });
    const { actionTaken, adminNote } = req.body;
    alert.status = "resolved";
    alert.actionTaken = actionTaken ? String(actionTaken).trim() : alert.actionTaken;
    alert.adminNote = adminNote ? String(adminNote).trim() : alert.adminNote;
    alert.resolvedByUid = user.uid;
    alert.resolvedByName = user.displayName;
    alert.resolvedAt = (/* @__PURE__ */ new Date()).toISOString();
    alert.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveDbState(env, db);
    return res.json({ alert });
  });
  app.get("/api/support-plans", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    if (!Array.isArray(db.studentSupportPlans)) db.studentSupportPlans = [];
    const { studentId, classCode, status } = req.query;
    const filtered = db.studentSupportPlans.filter((p) => {
      if (studentId && p.studentId !== String(studentId)) return false;
      if (classCode && classCode !== "ALL" && p.classCode?.toLowerCase() !== String(classCode).toLowerCase()) return false;
      if (status && status !== "ALL" && p.status !== status) return false;
      return true;
    });
    return res.json({ supportPlans: filtered });
  });
  app.post("/api/support-plans", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const { studentId, subject, topic, observedNeed, goal, recommendedActivity, reviewDate, status, progressNotes } = req.body;
    if (!studentId || !subject || !topic || !observedNeed || !goal) {
      return res.status(400).json({ error: "O\u2018quvchi, fan, mavzu, aniqlangan ehtiyoj va maqsadni kiriting." });
    }
    const stu = db.users.find((u) => u.uid === studentId);
    if (!stu) return res.status(404).json({ error: "O\u2018quvchi topilmadi." });
    if (!Array.isArray(db.studentSupportPlans)) db.studentSupportPlans = [];
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const plan = {
      id: planId,
      institutionId: db.institutions[0]?.id || "inst-spec-study",
      studentId: stu.uid,
      studentName: stu.displayName,
      classCode: stu.classCode || "7a1",
      classId: stu.classId || "",
      subject: String(subject).trim(),
      topic: String(topic).trim(),
      observedNeed: String(observedNeed).trim(),
      goal: String(goal).trim(),
      recommendedActivity: String(recommendedActivity || "").trim(),
      reviewDate: reviewDate || new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
      status: status || "Yangi",
      progressNotes: String(progressNotes || "").trim(),
      createdByUid: user.uid,
      createdByName: user.displayName,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.studentSupportPlans.unshift(plan);
    saveDbState(env, db);
    return res.json({ supportPlan: plan });
  });
  app.put("/api/support-plans/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const plan = db.studentSupportPlans?.find((p) => p.id === req.params.id);
    if (!plan) return res.status(404).json({ error: "Yordam rejasi topilmadi." });
    if (req.body.status) plan.status = req.body.status;
    if (req.body.progressNotes !== void 0) plan.progressNotes = String(req.body.progressNotes).trim();
    if (req.body.reviewDate) plan.reviewDate = req.body.reviewDate;
    if (req.body.goal) plan.goal = String(req.body.goal).trim();
    if (req.body.recommendedActivity) plan.recommendedActivity = String(req.body.recommendedActivity).trim();
    plan.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveDbState(env, db);
    return res.json({ supportPlan: plan });
  });
  app.get("/api/academic-calendar", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    const { classCode, subject, quarter, type } = req.query;
    const targetClass = user.role === "student" ? user.classCode : classCode && classCode !== "ALL" ? String(classCode) : void 0;
    const events = [];
    (db.lessons || []).forEach((l) => {
      if (targetClass && l.classCode?.toLowerCase() !== targetClass.toLowerCase()) return;
      if (subject && subject !== "ALL" && l.subjectName !== subject && l.curriculumArea !== subject) return;
      if (quarter && quarter !== "ALL" && String(l.quarter) !== String(quarter)) return;
      if (!l.scheduledDate) return;
      let evType = "lesson";
      if (l.eventCategory === "WRITTEN_ASSESSMENT") evType = "bsb";
      else if (l.eventCategory === "QUARTERLY_ASSESSMENT") evType = "chsb";
      else if (l.eventCategory === "PROJECT_WORK") evType = "project";
      if (type && type !== "ALL" && evType !== type) return;
      events.push({
        id: `cal_l_${l.id}`,
        title: `${l.lessonNumber}-dars: ${l.topicTitle || l.title}`,
        type: evType,
        date: l.scheduledDate,
        classCode: l.classCode || "",
        subject: l.curriculumArea || l.subjectName || "Matematika",
        quarter: l.quarter,
        targetRoute: user.role === "student" ? "/student/lessons" : `/admin/lessons?class=${l.classCode}`
      });
    });
    (db.assessments || []).forEach((a) => {
      if (targetClass && a.classCode?.toLowerCase() !== targetClass.toLowerCase()) return;
      if (subject && subject !== "ALL" && a.subject !== subject) return;
      if (!a.dueDate) return;
      if (type && type !== "ALL" && type !== "assessment") return;
      events.push({
        id: `cal_a_${a.id}`,
        title: `Test: ${a.title}`,
        type: "assessment",
        date: a.dueDate,
        classCode: a.classCode || "",
        subject: a.subject,
        targetRoute: user.role === "student" ? `/student/assessments/${a.id}` : `/admin/assessments`
      });
    });
    (db.studentAssignments || []).forEach((asg) => {
      if (targetClass && !asg.targetClassCodes.some((c) => c.toLowerCase() === targetClass.toLowerCase())) return;
      if (subject && subject !== "ALL" && asg.subject !== subject) return;
      if (type && type !== "ALL" && type !== "assignment") return;
      events.push({
        id: `cal_asg_${asg.id}`,
        title: `Vazifa muddati: ${asg.title}`,
        type: "assignment",
        date: asg.dueDate,
        classCode: asg.targetClassCodes.join(", "),
        subject: asg.subject,
        targetRoute: user.role === "student" ? "/student/dashboard" : "/admin/assignments"
      });
    });
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return res.json({ events });
  });
  app.get("/api/reports", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    if (!Array.isArray(db.academicReports)) db.academicReports = [];
    return res.json({ reports: db.academicReports });
  });
  app.post("/api/reports/generate", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const { reportType, targetId, period, title, classCode, subject, grade, quarter } = req.body;
    if (!reportType || !targetId) {
      return res.status(400).json({ error: "Hisobot turi va nishonni tanlang." });
    }
    if (!Array.isArray(db.academicReports)) db.academicReports = [];
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const reportId = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let summaryData = {};
    let methodology = "Haqiqiy tasdiqlangan ma\u2019lumotlar asosida alohida hisoblangan ko\u2018rsatkichlar.";
    if (reportType === "individual_student") {
      const stu = db.users.find((u) => u.uid === targetId);
      const att = (db.attendanceRecords || []).filter((r) => r.studentId === targetId);
      const stats = calculateAttendanceStats(att);
      const metrics = stu ? calculateStudentAcademicMetrics(stu, db.attempts || [], db.assessments || [], db.topics || [], db.lessons || []) : null;
      const stuSubs = (db.assignmentSubmissions || []).filter((s) => s.studentId === targetId);
      summaryData = {
        student: stu ? { uid: stu.uid, displayName: stu.displayName, classCode: stu.classCode, email: stu.email } : null,
        attendanceStats: stats,
        academicMetrics: metrics,
        assignmentsTotal: stuSubs.length,
        assignmentsSubmitted: stuSubs.filter((s) => s.status === "Topshirildi" || s.status === "Tekshirildi").length
      };
      methodology = "O'quvchining davomat ulushi, fanlar kesimidagi nazorat natijalari va topshiriq bajarilishi alohida hisoblandi.";
    } else if (reportType === "class_attendance" || reportType === "class_report") {
      const cls = db.classes.find((c) => (c.code || c.name).toLowerCase() === String(targetId).toLowerCase());
      const enrolled = db.users.filter((u) => u.role === "student" && (u.classId === cls?.id || u.classCode?.toLowerCase() === String(targetId).toLowerCase()));
      const att = (db.attendanceRecords || []).filter((r) => r.classCode?.toLowerCase() === String(targetId).toLowerCase());
      const classAttempts = (db.attempts || []).filter((a) => a.classCode?.toLowerCase() === String(targetId).toLowerCase());
      const classSubs = (db.assignmentSubmissions || []).filter((s) => s.classCode?.toLowerCase() === String(targetId).toLowerCase());
      const plannedLessons = (db.lessons || []).filter((l) => l.classCode?.toLowerCase() === String(targetId).toLowerCase());
      const deliveredLessons = (db.lessonDeliveryRecords || []).filter(
        (d) => d.classCode?.toLowerCase() === String(targetId).toLowerCase() && d.deliveryStatus === "O'tildi"
      );
      summaryData = {
        classCode: cls?.code || targetId,
        enrolledCount: enrolled.length,
        attendanceStats: calculateAttendanceStats(att),
        assessmentsCompletedCount: classAttempts.length,
        averageAssessmentScorePercent: classAttempts.length > 0 ? Math.round(classAttempts.reduce((acc, item) => acc + item.scorePercent, 0) / classAttempts.length) : 0,
        assignmentsSubmittedCount: classSubs.filter((s) => s.status === "Topshirildi" || s.status === "Tekshirildi").length,
        assignmentsTotalCount: classSubs.length,
        plannedLessonsCount: plannedLessons.length,
        deliveredLessonsCount: deliveredLessons.length
      };
      methodology = "Sinf o'quvchilarining davomat, nazorat va uyga vazifa ko'rsatkichlari bir-biriga qo'shib yuborilmasdan alohida hisoblandi.";
    } else if (reportType === "curriculum_progress") {
      const targetCls = classCode && classCode !== "ALL" ? String(classCode).toLowerCase() : String(targetId).toLowerCase();
      const planned = (db.lessons || []).filter(
        (l) => (targetCls === "all" || l.classCode?.toLowerCase() === targetCls) && (!subject || subject === "ALL" || l.subject === subject) && (!quarter || Number(quarter) === l.quarter)
      );
      const deliveries = (db.lessonDeliveryRecords || []).filter(
        (d) => (targetCls === "all" || d.classCode?.toLowerCase() === targetCls) && (!subject || subject === "ALL" || d.subject === subject) && (!quarter || Number(quarter) === d.quarter)
      );
      const deliveredCount = deliveries.filter((d) => d.deliveryStatus === "O'tildi").length;
      const rescheduledCount = deliveries.filter((d) => d.deliveryStatus === "Ko'chirildi").length;
      const cancelledCount = deliveries.filter((d) => d.deliveryStatus === "Bekor qilindi").length;
      summaryData = {
        targetClass: targetCls,
        subject: subject || "Barcha fanlar",
        quarter: quarter || "Barcha choraklar",
        plannedLessonsCount: planned.length,
        publishedLessonsCount: planned.filter((l) => l.isPublished).length,
        deliveredLessonsCount: deliveredCount,
        rescheduledLessonsCount: rescheduledCount,
        cancelledLessonsCount: cancelledCount,
        deliveryCompletionPercent: planned.length > 0 ? Math.round(deliveredCount / planned.length * 100) : 0
      };
      methodology = "Rejalashtirilgan darslar, e'lon qilingan darslar va amalda o'tilgan darslar (Lesson Delivery Tracker) alohida hisoblandi.";
    } else if (reportType === "assignment_report") {
      const targetCls = classCode && classCode !== "ALL" ? String(classCode).toLowerCase() : void 0;
      const asgs = (db.studentAssignments || []).filter(
        (a) => (!targetCls || a.targetClassCodes.some((c) => c.toLowerCase() === targetCls)) && (!subject || subject === "ALL" || a.subject === subject)
      );
      const subs = (db.assignmentSubmissions || []).filter(
        (s) => !targetCls || s.classCode?.toLowerCase() === targetCls
      );
      summaryData = {
        totalAssignments: asgs.length,
        totalSubmissions: subs.length,
        submittedCount: subs.filter((s) => s.status === "Topshirildi").length,
        gradedCount: subs.filter((s) => s.status === "Tekshirildi").length,
        returnedCount: subs.filter((s) => s.status === "Qaytarildi").length,
        overdueCount: subs.filter((s) => s.status === "Muddati o'tgan").length
      };
      methodology = "Topshiriqlar holati (Yangi, Jarayonda, Topshirildi, Tekshirildi, Qaytarildi) bo\u2018yicha aniq hisob.";
    } else {
      const targetCls = classCode && classCode !== "ALL" ? String(classCode).toLowerCase() : void 0;
      const relevantAttempts = (db.attempts || []).filter(
        (a) => (!targetCls || a.classCode?.toLowerCase() === targetCls) && (!subject || subject === "ALL" || a.subject === subject)
      );
      summaryData = {
        targetId,
        classCode: classCode || "ALL",
        subject: subject || "ALL",
        period: period || "2026-2027",
        attemptsCount: relevantAttempts.length,
        averageScorePercent: relevantAttempts.length > 0 ? Math.round(relevantAttempts.reduce((s, a) => s + a.scorePercent, 0) / relevantAttempts.length) : 0,
        timestamp: nowIso
      };
    }
    const report = {
      id: reportId,
      institutionId: db.institutions[0]?.id || "inst-spec-study",
      reportType,
      title: title || `${reportType.replace(/_/g, " ").toUpperCase()} hisoboti (${targetId})`,
      targetId: String(targetId),
      classCode: classCode && classCode !== "ALL" ? String(classCode).toLowerCase() : void 0,
      subject: subject && subject !== "ALL" ? String(subject) : void 0,
      grade: grade ? Number(grade) : void 0,
      quarter: quarter ? Number(quarter) : void 0,
      period: period || "2026-2027",
      methodology,
      generatedByUid: user.uid,
      generatedByName: user.displayName,
      createdAt: nowIso,
      summaryData
    };
    db.academicReports.unshift(report);
    saveDbState(env, db);
    return res.json({ report });
  });
  app.get("/api/reports/:id/export", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const report = (db.academicReports || []).find((r) => r.id === req.params.id);
    if (!report) return res.status(404).json({ error: "Hisobot topilmadi." });
    const format = String(req.query.format || "csv").toLowerCase();
    const flatRows = [
      { Ko_rsatkich: "Hisobot nomi", Qiymat: report.title },
      { Ko_rsatkich: "Hisobot turi", Qiymat: report.reportType },
      { Ko_rsatkich: "Nishon / Sinf", Qiymat: report.classCode || report.targetId },
      { Ko_rsatkich: "Fan", Qiymat: report.subject || "Barcha fanlar" },
      { Ko_rsatkich: "Davr", Qiymat: report.period },
      { Ko_rsatkich: "Shakllantirilgan sana", Qiymat: report.createdAt },
      { Ko_rsatkich: "Metodologiya", Qiymat: report.methodology || "" }
    ];
    for (const [k, v] of Object.entries(report.summaryData || {})) {
      if (v !== null && typeof v !== "object") {
        flatRows.push({ Ko_rsatkich: k, Qiymat: String(v) });
      } else if (v && typeof v === "object") {
        flatRows.push({ Ko_rsatkich: k, Qiymat: JSON.stringify(v) });
      }
    }
    if (format === "xlsx") {
      const wb = XLSX5.utils.book_new();
      const ws = XLSX5.utils.json_to_sheet(flatRows);
      XLSX5.utils.book_append_sheet(wb, ws, "Hisobot");
      const buf = XLSX5.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="report_${report.id}.xlsx"`);
      return res.send(buf);
    }
    const csvLines = ["Ko_rsatkich,Qiymat"];
    for (const row of flatRows) {
      const k = String(row.Ko_rsatkich).replace(/"/g, '""');
      const v = String(row.Qiymat).replace(/"/g, '""');
      csvLines.push(`"${k}","${v}"`);
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="report_${report.id}.csv"`);
    return res.send(csvLines.join("\n"));
  });
  app.get("/api/timetables", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (!Array.isArray(db.timetables)) db.timetables = [];
    if (!Array.isArray(db.timetableEntries)) db.timetableEntries = [];
    if (user.role === "student") {
      const studentClass = (user.classCode || "").toLowerCase();
      const view = resolveStudentTimetableView({
        classCode: studentClass,
        timetables: db.timetables,
        entries: db.timetableEntries
      });
      return res.json({
        timetables: view.activeTimetable ? [view.activeTimetable] : [],
        entries: view.allEntries,
        studentView: view
      });
    }
    const { classCode, status } = req.query;
    const filteredTimetables = db.timetables.filter((t) => {
      if (classCode && classCode !== "ALL" && t.classCode.toLowerCase() !== String(classCode).toLowerCase()) return false;
      if (status && status !== "ALL" && t.status !== status) return false;
      return true;
    });
    const timetableIds = new Set(filteredTimetables.map((t) => t.id));
    const filteredEntries = db.timetableEntries.filter((e) => timetableIds.has(e.timetableId));
    return res.json({ timetables: filteredTimetables, entries: filteredEntries });
  });
  app.post("/api/timetables", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Faqat administrator dars jadvali yarata oladi." });
    }
    const { classCode, title, effectiveFrom, effectiveTo, archivePrevious } = req.body;
    if (!classCode) return res.status(400).json({ error: "Sinf kodini tanlang." });
    const normalizedCode = String(classCode).toLowerCase();
    const cls = db.classes.find((c) => (c.code || c.name).toLowerCase() === normalizedCode);
    if (!cls) return res.status(404).json({ error: "Sinf topilmadi." });
    if (!Array.isArray(db.timetables)) db.timetables = [];
    const existingForClass = db.timetables.filter((t) => t.classCode.toLowerCase() === normalizedCode);
    const maxVersion = existingForClass.reduce((max, t) => Math.max(max, t.version || 1), 0);
    if (archivePrevious !== false) {
      existingForClass.forEach((t) => {
        if (t.status === "active") t.status = "archived";
      });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const newTimetable = {
      id: `tt_${normalizedCode}_v${maxVersion + 1}_${Date.now()}`,
      institutionId: cls.institutionId || "inst-spec-study",
      classCode: normalizedCode,
      classId: cls.id,
      title: title ? String(title).trim() : `${normalizedCode.toUpperCase()} haftalik dars jadvali (v${maxVersion + 1})`,
      effectiveFrom: effectiveFrom || nowIso.slice(0, 10),
      effectiveTo: effectiveTo || void 0,
      version: maxVersion + 1,
      status: "active",
      createdByUid: user.uid,
      createdByName: user.displayName,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.timetables.unshift(newTimetable);
    saveDbState(env, db);
    return res.json({ timetable: newTimetable });
  });
  app.post("/api/timetables/:id/duplicate", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Faqat administrator nusxa ko\u2018chira oladi." });
    }
    if (!Array.isArray(db.timetables)) db.timetables = [];
    if (!Array.isArray(db.timetableEntries)) db.timetableEntries = [];
    const source = db.timetables.find((t) => t.id === req.params.id);
    if (!source) return res.status(404).json({ error: "Jadval topilmadi." });
    const targetClassCode = (req.body.targetClassCode || source.classCode).toLowerCase();
    const targetCls = db.classes.find((c) => (c.code || c.name).toLowerCase() === targetClassCode);
    const existingForClass = db.timetables.filter((t) => t.classCode.toLowerCase() === targetClassCode);
    const nextVersion = existingForClass.reduce((max, t) => Math.max(max, t.version || 1), 0) + 1;
    if (req.body.activateImmediately) {
      existingForClass.forEach((t) => {
        if (t.status === "active") t.status = "archived";
      });
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const duplicated = {
      id: `tt_${targetClassCode}_v${nextVersion}_${Date.now()}`,
      institutionId: source.institutionId,
      classCode: targetClassCode,
      classId: targetCls?.id || source.classId,
      title: req.body.title || `${targetClassCode.toUpperCase()} dars jadvali (v${nextVersion} nusxa)`,
      effectiveFrom: req.body.effectiveFrom || nowIso.slice(0, 10),
      version: nextVersion,
      status: req.body.activateImmediately ? "active" : "draft",
      parentTimetableId: source.id,
      createdByUid: user.uid,
      createdByName: user.displayName,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.timetables.unshift(duplicated);
    const sourceEntries = db.timetableEntries.filter((e) => e.timetableId === source.id);
    const clonedEntries = sourceEntries.map((e, idx) => ({
      ...e,
      id: `tte_${duplicated.id}_${idx}_${Date.now()}`,
      timetableId: duplicated.id,
      classCode: targetClassCode,
      classId: targetCls?.id || source.classId,
      createdAt: nowIso,
      updatedAt: nowIso
    }));
    db.timetableEntries.push(...clonedEntries);
    saveDbState(env, db);
    return res.json({ timetable: duplicated, entries: clonedEntries });
  });
  app.post("/api/timetables/:id/archive", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const tt = db.timetables?.find((t) => t.id === req.params.id);
    if (!tt) return res.status(404).json({ error: "Jadval topilmadi." });
    tt.status = req.body.status === "active" ? "active" : "archived";
    tt.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveDbState(env, db);
    return res.json({ timetable: tt });
  });
  app.post("/api/timetables/entries", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Faqat administrator dars soatini qo\u2018sha oladi." });
    }
    if (!Array.isArray(db.timetables)) db.timetables = [];
    if (!Array.isArray(db.timetableEntries)) db.timetableEntries = [];
    const {
      timetableId,
      classCode,
      weekday,
      weekdayIndex,
      lessonNumber,
      subject,
      curriculumArea,
      startTime,
      endTime,
      room,
      relatedLessonId,
      relatedLessonTitle,
      notes
    } = req.body;
    if (!classCode || !subject || !weekday || !lessonNumber || !startTime || !endTime) {
      return res.status(400).json({ error: "Sinf, fan, hafta kuni, dars soati va vaqtlarini kiriting." });
    }
    const normalizedCode = String(classCode).toLowerCase();
    const cls = db.classes.find((c) => (c.code || c.name).toLowerCase() === normalizedCode);
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let targetTimetable = db.timetables.find(
      (t) => timetableId && t.id === timetableId || !timetableId && t.classCode === normalizedCode && t.status === "active"
    );
    if (!targetTimetable) {
      targetTimetable = {
        id: `tt_${normalizedCode}_v1_${Date.now()}`,
        institutionId: cls?.institutionId || "inst-spec-study",
        classCode: normalizedCode,
        classId: cls?.id || `class-${normalizedCode}`,
        title: `${normalizedCode.toUpperCase()} haftalik dars jadvali`,
        effectiveFrom: nowIso.slice(0, 10),
        version: 1,
        status: "active",
        createdByUid: user.uid,
        createdByName: user.displayName,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      db.timetables.unshift(targetTimetable);
    }
    const weekdayIdxMap = {
      Dushanba: 1,
      Seshanba: 2,
      Chorshanba: 3,
      Payshanba: 4,
      Juma: 5,
      Shanba: 6
    };
    const resolvedWeekdayIndex = Number(weekdayIndex) || weekdayIdxMap[String(weekday)] || 1;
    const candidate = {
      institutionId: targetTimetable.institutionId,
      timetableId: targetTimetable.id,
      classCode: normalizedCode,
      classId: targetTimetable.classId,
      weekday: String(weekday),
      weekdayIndex: resolvedWeekdayIndex,
      lessonNumber: Number(lessonNumber),
      subject: String(subject).trim(),
      curriculumArea: curriculumArea ? String(curriculumArea).trim() : void 0,
      startTime: String(startTime).trim(),
      endTime: String(endTime).trim(),
      room: room ? String(room).trim() : void 0,
      relatedLessonId: relatedLessonId || void 0,
      relatedLessonTitle: relatedLessonTitle || void 0,
      notes: notes ? String(notes).trim() : void 0
    };
    const issues = validateTimetableEntry(candidate, db.timetableEntries);
    const blockingErrors = issues.filter((i) => i.severity === "error");
    if (blockingErrors.length > 0) {
      return res.status(400).json({
        error: blockingErrors[0].message,
        validationIssues: issues
      });
    }
    const newEntry = {
      ...candidate,
      id: `tte_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.timetableEntries.push(newEntry);
    saveDbState(env, db);
    return res.json({
      entry: newEntry,
      timetable: targetTimetable,
      warnings: issues.filter((i) => i.severity === "warning")
    });
  });
  app.put("/api/timetables/entries/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    if (!Array.isArray(db.timetableEntries)) db.timetableEntries = [];
    const entry = db.timetableEntries.find((e) => e.id === req.params.id);
    if (!entry) return res.status(404).json({ error: "Jadval qatori topilmadi." });
    const weekdayIdxMap = {
      Dushanba: 1,
      Seshanba: 2,
      Chorshanba: 3,
      Payshanba: 4,
      Juma: 5,
      Shanba: 6
    };
    const updatedCandidate = {
      ...entry,
      weekday: req.body.weekday || entry.weekday,
      weekdayIndex: req.body.weekday ? weekdayIdxMap[String(req.body.weekday)] || entry.weekdayIndex : entry.weekdayIndex,
      lessonNumber: req.body.lessonNumber !== void 0 ? Number(req.body.lessonNumber) : entry.lessonNumber,
      subject: req.body.subject ? String(req.body.subject).trim() : entry.subject,
      startTime: req.body.startTime ? String(req.body.startTime).trim() : entry.startTime,
      endTime: req.body.endTime ? String(req.body.endTime).trim() : entry.endTime,
      room: req.body.room !== void 0 ? String(req.body.room).trim() : entry.room,
      relatedLessonId: req.body.relatedLessonId !== void 0 ? req.body.relatedLessonId : entry.relatedLessonId,
      relatedLessonTitle: req.body.relatedLessonTitle !== void 0 ? req.body.relatedLessonTitle : entry.relatedLessonTitle,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const issues = validateTimetableEntry(updatedCandidate, db.timetableEntries);
    const blockingErrors = issues.filter((i) => i.severity === "error");
    if (blockingErrors.length > 0) {
      return res.status(400).json({ error: blockingErrors[0].message, validationIssues: issues });
    }
    Object.assign(entry, updatedCandidate);
    saveDbState(env, db);
    return res.json({ entry, warnings: issues.filter((i) => i.severity === "warning") });
  });
  app.delete("/api/timetables/entries/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    if (!Array.isArray(db.timetableEntries)) db.timetableEntries = [];
    const idx = db.timetableEntries.findIndex((e) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Jadval qatori topilmadi." });
    db.timetableEntries.splice(idx, 1);
    saveDbState(env, db);
    return res.json({ success: true });
  });
  app.get("/api/announcements", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (!Array.isArray(db.announcements)) db.announcements = [];
    if (!Array.isArray(db.announcementReads)) db.announcementReads = [];
    if (!Array.isArray(db.announcementAcknowledgements)) db.announcementAcknowledgements = [];
    if (user.role === "student") {
      const cls = (user.classCode || "7a1").toLowerCase();
      const visible = db.announcements.filter((a) => isAnnouncementRelevantToStudent(a, cls, getTashkentDateString()));
      const myReads = db.announcementReads.filter((r) => r.studentId === user.uid);
      const myAcks = db.announcementAcknowledgements.filter((a) => a.studentId === user.uid);
      return res.json({ announcements: visible, reads: myReads, acknowledgements: myAcks });
    }
    return res.json({
      announcements: db.announcements,
      reads: db.announcementReads,
      acknowledgements: db.announcementAcknowledgements
    });
  });
  app.post("/api/announcements", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Faqat administrator e'lon joylay oladi." });
    }
    const {
      title,
      shortContent,
      type,
      audienceType,
      targetClassCodes,
      targetSubjects,
      attachmentUrl,
      attachmentName,
      publicationDate,
      expirationDate,
      priority,
      requiresAcknowledgment
    } = req.body;
    if (!title || !shortContent) {
      return res.status(400).json({ error: "E'lon sarlavhasi va qisqa matnini kiriting." });
    }
    if (!Array.isArray(db.announcements)) db.announcements = [];
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const ann = {
      id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      institutionId: db.institutions[0]?.id || "inst-spec-study",
      title: String(title).trim(),
      shortContent: String(shortContent).trim(),
      type: type || "school",
      audienceType: audienceType || "entire_school",
      targetClassCodes: Array.isArray(targetClassCodes) ? targetClassCodes.map((c) => c.toLowerCase()) : [],
      targetSubjects: Array.isArray(targetSubjects) ? targetSubjects.map((s) => String(s).trim()) : [],
      attachmentUrl: attachmentUrl ? String(attachmentUrl).trim() : void 0,
      attachmentName: attachmentName ? String(attachmentName).trim() : void 0,
      publicationDate: publicationDate || nowIso.slice(0, 10),
      expirationDate: expirationDate || void 0,
      priority: priority || "normal",
      requiresAcknowledgment: Boolean(requiresAcknowledgment),
      status: "published",
      createdByUid: user.uid,
      createdByName: user.displayName,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.announcements.unshift(ann);
    saveDbState(env, db);
    return res.json({ announcement: ann });
  });
  app.post("/api/announcements/:id/read", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (!Array.isArray(db.announcements)) db.announcements = [];
    if (!Array.isArray(db.announcementReads)) db.announcementReads = [];
    const ann = db.announcements.find((a) => a.id === req.params.id);
    if (!ann) return res.status(404).json({ error: "E'lon topilmadi." });
    const id = `${ann.id}_${user.uid}`;
    let readRecord = db.announcementReads.find((r) => r.id === id);
    if (!readRecord) {
      readRecord = {
        id,
        institutionId: ann.institutionId,
        announcementId: ann.id,
        audience: ann.audienceType,
        studentId: user.uid,
        classCode: user.classCode || "7a1",
        readAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.announcementReads.push(readRecord);
      saveDbState(env, db);
    }
    return res.json({ readRecord });
  });
  app.post("/api/announcements/:id/acknowledge", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (!Array.isArray(db.announcements)) db.announcements = [];
    if (!Array.isArray(db.announcementReads)) db.announcementReads = [];
    if (!Array.isArray(db.announcementAcknowledgements)) db.announcementAcknowledgements = [];
    const ann = db.announcements.find((a) => a.id === req.params.id);
    if (!ann) return res.status(404).json({ error: "E'lon topilmadi." });
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const id = `${ann.id}_${user.uid}`;
    if (!db.announcementReads.some((r) => r.id === id)) {
      db.announcementReads.push({
        id,
        institutionId: ann.institutionId,
        announcementId: ann.id,
        audience: ann.audienceType,
        studentId: user.uid,
        classCode: user.classCode || "7a1",
        readAt: nowIso
      });
    }
    let ackRecord = db.announcementAcknowledgements.find((a) => a.id === id);
    if (!ackRecord) {
      ackRecord = {
        id,
        institutionId: ann.institutionId,
        announcementId: ann.id,
        audience: ann.audienceType,
        studentId: user.uid,
        classCode: user.classCode || "7a1",
        acknowledgedAt: nowIso
      };
      db.announcementAcknowledgements.push(ackRecord);
      saveDbState(env, db);
    }
    return res.json({ acknowledgement: ackRecord });
  });
  app.get("/api/materials", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (!Array.isArray(db.learningMaterials)) db.learningMaterials = [];
    if (user.role === "student") {
      const cls = (user.classCode || "7a1").toLowerCase();
      const authorized = filterAuthorizedMaterialsForStudent(db.learningMaterials, cls, user.grade || 7);
      return res.json({ materials: authorized });
    }
    return res.json({ materials: db.learningMaterials });
  });
  app.post("/api/materials", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Faqat administrator o\u2018quv materiali yuklay oladi." });
    }
    const {
      title,
      description,
      materialType,
      fileUrl,
      fileName,
      fileSizeBytes,
      folder,
      grade,
      classCode,
      targetClassCodes,
      subject,
      curriculumArea,
      quarter,
      lessonId,
      lessonTitle,
      learningObjective,
      allowDownload,
      status
    } = req.body;
    if (!title || !subject || !fileUrl) {
      return res.status(400).json({ error: "Material sarlavhasi, fan va fayl/havola manzilini kiriting." });
    }
    if (!Array.isArray(db.learningMaterials)) db.learningMaterials = [];
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const resolvedClassCodes = Array.isArray(targetClassCodes) && targetClassCodes.length > 0 ? targetClassCodes.map((c) => c.toLowerCase()) : classCode ? [String(classCode).toLowerCase()] : [];
    const material = {
      id: `mat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      institutionId: db.institutions[0]?.id || "inst-spec-study",
      title: String(title).trim(),
      description: String(description || "").trim(),
      materialType: materialType || "pdf",
      fileUrl: String(fileUrl).trim(),
      fileName: fileName ? String(fileName).trim() : void 0,
      fileSizeBytes: fileSizeBytes ? Number(fileSizeBytes) : void 0,
      folder: folder ? String(folder).trim() : `${subject} / ${quarter || 1}-chorak`,
      grade: Number(grade) || 9,
      classCode: resolvedClassCodes[0],
      targetClassCodes: resolvedClassCodes,
      subject: String(subject).trim(),
      curriculumArea: curriculumArea ? String(curriculumArea).trim() : void 0,
      quarter: Number(quarter) || 1,
      lessonId: lessonId || void 0,
      lessonTitle: lessonTitle || void 0,
      learningObjective: learningObjective ? String(learningObjective).trim() : void 0,
      status: status === "archived" ? "archived" : "published",
      allowDownload: allowDownload !== false,
      uploadedByUid: user.uid,
      uploadedByName: user.displayName,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.learningMaterials.unshift(material);
    saveDbState(env, db);
    return res.json({ material });
  });
  app.put("/api/materials/:id", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const mat = db.learningMaterials?.find((m) => m.id === req.params.id);
    if (!mat) return res.status(404).json({ error: "Material topilmadi." });
    if (req.body.title) mat.title = String(req.body.title).trim();
    if (req.body.description !== void 0) mat.description = String(req.body.description).trim();
    if (req.body.folder) mat.folder = String(req.body.folder).trim();
    if (req.body.fileUrl) mat.fileUrl = String(req.body.fileUrl).trim();
    if (req.body.fileName) mat.fileName = String(req.body.fileName).trim();
    if (req.body.status) mat.status = req.body.status;
    if (req.body.lessonId !== void 0) mat.lessonId = req.body.lessonId || void 0;
    if (req.body.lessonTitle !== void 0) mat.lessonTitle = req.body.lessonTitle || void 0;
    mat.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    saveDbState(env, db);
    return res.json({ material: mat });
  });
  app.get("/api/grading/queue", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Faqat administrator tekshiruv markazini ko\u2018ra oladi." });
    }
    const assignmentSubmissions = (db.assignmentSubmissions || []).filter((s) => s.attemptCount > 0 || s.status !== "Yangi");
    const pendingAttempts = (db.attempts || []).filter((a) => a.status === "pending_manual_review" || (a.pendingManualCount || 0) > 0);
    return res.json({
      assignmentSubmissions,
      pendingAttempts,
      rubrics: db.gradingRubrics || DEFAULT_GRADING_RUBRICS,
      feedbackComments: db.feedbackComments || DEFAULT_FEEDBACK_COMMENTS,
      gradingHistory: db.gradingHistory || []
    });
  });
  app.post("/api/grading/rubrics", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Ruxsat yo\u2018q." });
    }
    const { title, subject, description, criteria } = req.body;
    if (!title || !Array.isArray(criteria) || criteria.length === 0) {
      return res.status(400).json({ error: "Rubrika nomi va mezonlarini kiriting." });
    }
    if (!Array.isArray(db.gradingRubrics)) db.gradingRubrics = [...DEFAULT_GRADING_RUBRICS];
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const totalMaxPoints = criteria.reduce((sum, c) => sum + (Number(c.maxPoints) || 0), 0);
    const rubric = {
      id: `rubric_${Date.now()}`,
      institutionId: db.institutions[0]?.id || "inst-spec-study",
      title: String(title).trim(),
      subject: subject ? String(subject).trim() : void 0,
      description: String(description || "").trim(),
      criteria: criteria.map((c, idx) => ({
        id: c.id || `crit_${idx + 1}_${Date.now()}`,
        title: String(c.title).trim(),
        description: String(c.description || "").trim(),
        maxPoints: Number(c.maxPoints) || 2,
        partialCreditRules: String(c.partialCreditRules || "").trim()
      })),
      totalMaxPoints,
      createdByUid: user.uid,
      createdByName: user.displayName,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    db.gradingRubrics.unshift(rubric);
    saveDbState(env, db);
    return res.json({ rubric });
  });
  app.post("/api/grading/ai-suggest", async (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Faqat administrator AI tavsiyasini so\u2018ray oladi." });
    }
    const { submissionId, rubricId } = req.body;
    const sub = (db.assignmentSubmissions || []).find((s) => s.id === submissionId);
    if (!sub) return res.status(404).json({ error: "Topshiriq javobi topilmadi." });
    const asg = (db.studentAssignments || []).find((a) => a.id === sub.assignmentId);
    const rubrics = db.gradingRubrics || DEFAULT_GRADING_RUBRICS;
    const rubric = rubrics.find((r) => r.id === (rubricId || asg?.rubricId)) || rubrics[0];
    const studentText = (sub.content || "").trim();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const buildDeterministicSuggestion = () => {
      const hasFormulaOrSteps = studentText.length > 25;
      const criterionBreakdown = rubric.criteria.map((c) => {
        const ratio = hasFormulaOrSteps ? 0.85 : studentText.length > 5 ? 0.5 : 0.2;
        const pts = Math.round(c.maxPoints * ratio * 2) / 2;
        return {
          criterionId: c.id,
          criterionTitle: c.title,
          awardedPoints: pts,
          maxPoints: c.maxPoints,
          comment: hasFormulaOrSteps ? `${c.title} bo\u2018yicha yechim asoslangan.` : `${c.title} bo\u2018yicha izohni kengaytirish tavsiya etiladi.`
        };
      });
      const rawSum = criterionBreakdown.reduce((s, c) => s + c.awardedPoints, 0);
      const scaleFactor = rubric.totalMaxPoints > 0 ? sub.maxScore / rubric.totalMaxPoints : 1;
      const scaledTotal = Math.min(sub.maxScore, Math.round(rawSum * scaleFactor * 2) / 2);
      return {
        suggestedTotalPoints: scaledTotal,
        maxPoints: sub.maxScore,
        criterionBreakdown,
        suggestedFeedback: hasFormulaOrSteps ? "O'quvchi masala yechish bosqichlarini keltirgan. Oraliq hisoblash va yakuniy birliklarni tekshirib tasdiqlash tavsiya etiladi." : "Javob qisqa yozilgan; mantiqiy qadamlar va izohlarni to'ldirish tavsiya etiladi.",
        mistakeExplanation: hasFormulaOrSteps ? "Katta mantiqiy xato kuzatilmadi; yakuniy ifodani rubrika mezonlari bilan solishtiring." : "Oraliq yechish bosqichlari to'liq ko'rsatilmagan.",
        recommendedLessonTitle: asg?.relatedLessonTitle || `${asg?.subject || "Matematika"} amaliy mashg'uloti`,
        confidence: hasFormulaOrSteps ? "high" : "medium",
        generatedAt: nowIso,
        approvalStatus: "pending_admin_approval"
      };
    };
    let aiSuggestion;
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Siz ixtisoslashtirilgan maktabning akademik baholash yordamchisisiz.
Topshiriq: "${asg?.title || sub.assignmentTitle}" (${asg?.subject || "Matematika"}).
Ko'rsatma: "${asg?.instructions || asg?.description || ""}"
O'quvchining javobi: "${studentText || "[Fayl biriktirilgan]"}"
Rubrika mezonlari: ${JSON.stringify(rubric.criteria)}
Maksimal ball: ${sub.maxScore}.
MUHIM: Bu faqat administrator ko'rib chiqishi uchun dastlabki tavsiya. O'zbek tilida javob qaytaring.`;
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                suggestedTotalPoints: { type: Type.NUMBER },
                suggestedFeedback: { type: Type.STRING },
                mistakeExplanation: { type: Type.STRING },
                recommendedLessonTitle: { type: Type.STRING }
              },
              required: ["suggestedTotalPoints", "suggestedFeedback", "mistakeExplanation"]
            }
          }
        });
        const parsed = JSON.parse(response.text || "{}");
        const baseFallback = buildDeterministicSuggestion();
        aiSuggestion = {
          ...baseFallback,
          suggestedTotalPoints: Math.max(0, Math.min(sub.maxScore, Number(parsed.suggestedTotalPoints) || baseFallback.suggestedTotalPoints)),
          suggestedFeedback: parsed.suggestedFeedback || baseFallback.suggestedFeedback,
          mistakeExplanation: parsed.mistakeExplanation || baseFallback.mistakeExplanation,
          recommendedLessonTitle: parsed.recommendedLessonTitle || baseFallback.recommendedLessonTitle,
          approvalStatus: "pending_admin_approval"
        };
      } catch {
        aiSuggestion = buildDeterministicSuggestion();
      }
    } else {
      aiSuggestion = buildDeterministicSuggestion();
    }
    sub.aiSuggestion = aiSuggestion;
    if (sub.status === "Topshirildi") {
      sub.status = "Tekshirilmoqda";
    }
    sub.updatedAt = nowIso;
    saveDbState(env, db);
    return res.json({
      submission: sub,
      aiSuggestion,
      notice: "AI tavsiyasi yaratildi. Rasmiy baho faqat Administrator ko'rib chiqib tasdiqlaganidan so'ng kuchga kiradi."
    });
  });
  app.get("/api/lesson-delivery", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    if (!Array.isArray(db.lessonDeliveryRecords)) db.lessonDeliveryRecords = [];
    if (user.role === "student") {
      const cls = (user.classCode || "").toLowerCase();
      return res.json({
        records: db.lessonDeliveryRecords.filter((r) => r.classCode.toLowerCase() === cls)
      });
    }
    return res.json({ records: db.lessonDeliveryRecords });
  });
  app.post("/api/lesson-delivery", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({
        error: "Faqat vakolatli Administrator rasmiy dars o'tilganlik holatini o'zgartira oladi."
      });
    }
    const {
      lessonId,
      classCode,
      deliveryStatus,
      actualDeliveryDate,
      plannedDate,
      rescheduledToDate,
      completionNote
    } = req.body;
    if (!lessonId || !classCode || !deliveryStatus) {
      return res.status(400).json({ error: "Dars ID, sinf kodi va dars holatini ko\u2018rsating." });
    }
    const normalizedCode = String(classCode).toLowerCase();
    const lesson = (db.lessons || []).find((l) => l.id === lessonId);
    const cls = db.classes.find((c) => (c.code || c.name).toLowerCase() === normalizedCode);
    if (!Array.isArray(db.lessonDeliveryRecords)) db.lessonDeliveryRecords = [];
    const recordId = `${normalizedCode}_${lessonId}`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let record = db.lessonDeliveryRecords.find((r) => r.id === recordId);
    const previousStatus = record?.deliveryStatus;
    const auditEntry = {
      changedAt: nowIso,
      changedByUid: user.uid,
      changedByName: user.displayName,
      previousStatus,
      newStatus: deliveryStatus,
      actualDeliveryDate: actualDeliveryDate || (deliveryStatus === "O'tildi" ? nowIso.slice(0, 10) : void 0),
      note: completionNote ? String(completionNote).trim() : void 0
    };
    if (!record) {
      record = {
        id: recordId,
        institutionId: cls?.institutionId || "inst-spec-study",
        lessonId,
        lessonNumber: lesson?.lessonNumber || 1,
        lessonTitle: lesson?.topicTitle || lesson?.title || "Dars",
        workPlanId: lesson?.workPlanId || "",
        classCode: normalizedCode,
        classId: cls?.id || `class-${normalizedCode}`,
        subject: lesson?.subject || lesson?.subjectName || "Matematika",
        curriculumArea: lesson?.curriculumArea,
        quarter: lesson?.quarter || 1,
        plannedDate: plannedDate || lesson?.scheduledDate || void 0,
        actualDeliveryDate: actualDeliveryDate || (deliveryStatus === "O'tildi" ? nowIso.slice(0, 10) : void 0),
        rescheduledToDate: rescheduledToDate || void 0,
        deliveryStatus,
        completionNote: completionNote ? String(completionNote).trim() : void 0,
        updatedByUid: user.uid,
        updatedByName: user.displayName,
        updatedAt: nowIso,
        auditHistory: [auditEntry]
      };
      db.lessonDeliveryRecords.unshift(record);
    } else {
      record.deliveryStatus = deliveryStatus;
      if (actualDeliveryDate !== void 0) {
        record.actualDeliveryDate = actualDeliveryDate;
      } else if (deliveryStatus === "O'tildi" && !record.actualDeliveryDate) {
        record.actualDeliveryDate = nowIso.slice(0, 10);
      }
      if (plannedDate !== void 0) record.plannedDate = plannedDate;
      if (rescheduledToDate !== void 0) record.rescheduledToDate = rescheduledToDate;
      if (completionNote !== void 0) record.completionNote = String(completionNote).trim();
      record.updatedByUid = user.uid;
      record.updatedByName = user.displayName;
      record.updatedAt = nowIso;
      record.auditHistory.unshift(auditEntry);
    }
    saveDbState(env, db);
    return res.json({ record });
  });
  app.get("/api/calendar-v2", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, db } = authCtx;
    const referenceWeekMondayDate = String(req.query.referenceWeekMondayDate || "");
    const allUnified = buildUnifiedAcademicCalendarEvents({
      institutionId: db.institutions[0]?.id || "inst-spec-study",
      timetableEntries: db.timetableEntries || [],
      timetables: db.timetables || [],
      lessons: db.lessons || [],
      deliveryRecords: db.lessonDeliveryRecords || [],
      assignments: db.studentAssignments || [],
      assessments: db.assessments || [],
      announcements: db.announcements || [],
      customEvents: db.academicEvents || [],
      referenceWeekMondayDate: referenceWeekMondayDate || void 0
    });
    const targetClass = user.role === "student" ? (user.classCode || "").toLowerCase() : req.query.classCode && req.query.classCode !== "ALL" ? String(req.query.classCode).toLowerCase() : "";
    const subjectFilter = req.query.subject && req.query.subject !== "ALL" ? String(req.query.subject) : "";
    const categoryFilter = req.query.category && req.query.category !== "ALL" ? String(req.query.category) : "";
    const filtered = allUnified.filter((ev) => {
      if (targetClass) {
        const matchesSingle = ev.classCode?.toLowerCase() === targetClass;
        const matchesTargetList = ev.targetClassCodes?.some((c) => c.toLowerCase() === targetClass);
        const isSchoolWideAnnouncement = ev.category === "announcement" && (!ev.targetClassCodes || ev.targetClassCodes.length === 0);
        if (!matchesSingle && !matchesTargetList && !isSchoolWideAnnouncement) return false;
      }
      if (subjectFilter && ev.subject && ev.subject.toLowerCase() !== subjectFilter.toLowerCase()) return false;
      if (categoryFilter && ev.category !== categoryFilter) return false;
      return true;
    });
    return res.json({ events: filtered });
  });
  app.post("/api/calendar-v2/events", (req, res) => {
    const authCtx = authenticateRequest(req);
    if (!authCtx) return res.status(401).json({ error: "Avtorizatsiya talab qilinadi." });
    const { user, env, db } = authCtx;
    if (user.role !== "admin" && user.role !== "platform_owner") {
      return res.status(403).json({ error: "Faqat administrator akademik sana qo\u2018sha oladi." });
    }
    const { title, description, category, date, startTime, endTime, classCode, subject } = req.body;
    if (!title || !date) {
      return res.status(400).json({ error: "Tadbir nomi va haqiqiy sanasini kiriting." });
    }
    if (!Array.isArray(db.academicEvents)) db.academicEvents = [];
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const id = `acev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const ev = {
      id,
      institutionId: db.institutions[0]?.id || "inst-spec-study",
      title: String(title).trim(),
      description: description ? String(description).trim() : void 0,
      category: category || "academic_date",
      date: String(date).slice(0, 10),
      startTime: startTime || void 0,
      endTime: endTime || void 0,
      classCode: classCode && classCode !== "ALL" ? String(classCode).toLowerCase() : void 0,
      subject: subject && subject !== "ALL" ? String(subject) : void 0,
      sourceRecordId: id,
      sourceCollection: "academic_events",
      targetRoute: "/admin/calendar",
      createdAt: nowIso
    };
    db.academicEvents.unshift(ev);
    saveDbState(env, db);
    return res.json({ event: ev });
  });
  if (process.env.VERCEL) {
    return;
  }
  let viteReadyPromise = null;
  if (process.env.NODE_ENV !== "production") {
    viteReadyPromise = import("vite").then(
      ({ createServer: createViteServer }) => createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: "spa"
      })
    ).then((vite) => vite.middlewares).catch((err) => {
      console.error("Vite middleware initialization error:", err);
      return null;
    });
    app.use(async (req, res, next) => {
      if (req.path.startsWith("/api/")) {
        return next();
      }
      const middlewares = await viteReadyPromise;
      if (middlewares) {
        return middlewares(req, res, next);
      }
      next();
    });
  } else {
    const distPath = path4.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path4.join(distPath, "index.html"));
    });
  }
  const PORT = Number(process.env.PORT) || 3e3;
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`LearnOS server running on http://0.0.0.0:${PORT}`);
  });
  server.on("error", (err) => {
    console.error("Server socket error:", err);
  });
}
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
startServer().catch((err) => {
  console.error("Failed to start server:", err);
});

// src/server/vercelEntry.ts
var vercelEntry_default = app;
export {
  vercelEntry_default as default
};
