import { requestDatabase } from './requestDatabase';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Institution,
  InstitutionSettings,
  AcademicYearItem,
  UserProfile,
  ClassRoom,
  ClassMembership,
  TeacherAssignment,
  StudentEnrollment,
  ParentLink,
  Invitation,
  SubjectItem,
  Topic,
  WorkPlan,
  LessonItem,
  QuestionItem,
  QuestionRevision,
  QuestionMedia,
  Assessment,
  Assignment,
  AssessmentAttempt,
  GradingRecord,
  ImportBatch,
  MasteryRecord,
  LearningPathItem,
  LearningRecommendation,
  AppNotification,
  TeacherNote,
  AuditLogEntry,
  StudentImportJob,
  CurriculumImportJob,
  StudentGamificationProfile,
  LearningCheckin,
  StudentGoal,
  LearningActivityEvent,
  XpLedgerEntry,
  GamificationBadgeDefinition,
  StudentBadgeRecord,
  StreakRecord,
  WeeklyRecapRecord,
  ClassChallenge,
  GamificationConfig,
  StudentLessonCompletion,
  AttendanceSession,
  AttendanceRecord,
  StudentAssignment,
  AssignmentSubmission,
  StudentAlert,
  StudentSupportPlan,
  AcademicReportItem,
  Timetable,
  TimetableEntry,
  SubmissionRevision,
  Announcement,
  AnnouncementRead,
  AnnouncementAcknowledgement,
  LearningMaterial,
  GradingRubric,
  FeedbackComment,
  GradingHistoryEntry,
  AcademicCalendarEvent,
  LessonDeliveryRecord,
} from '../types';
import {
  DEFAULT_SUBJECTS,
  DEFAULT_CURRICULUM_TOPICS,
  DEFAULT_ACADEMIC_YEARS,
  DEFAULT_INSTITUTION_ID,
  OFFICIAL_19_CLASS_CODES,
  parseOfficialClassCode,
  getDefaultSubjectsForTrack,
  buildOfficial19Classes,
} from '../constants/curriculum';
import { computeSimpleHash, isAuthorizedAdminEmail } from '../utils/security';
import {
  DEFAULT_GAMIFICATION_BADGES,
  DEFAULT_GAMIFICATION_CONFIG,
} from '../utils/gamificationEngine';
import {
  DEFAULT_GRADING_RUBRICS,
  DEFAULT_FEEDBACK_COMMENTS,
} from '../utils/academicOsEngine';

export interface PersistentDatabaseState {
  loginThrottles?: Record<string,{attempts:number;until:number}>;
  lessonPracticeResponses?: Array<{id:string;lessonId:string;studentId:string;institutionId:string;answers:string[];submittedAt:string}>;
  examSessions?: import('../examTypes').ExamSession[];
  revokedSessionHashes?: Record<string, number>;
  revokedBeforeByUser?: Record<string, number>;
  institutions: Institution[];
  institutionSettings: InstitutionSettings[];
  academicYears: AcademicYearItem[];
  users: UserProfile[];
  passwordHashes: Record<string, string>; // uid -> salt:hash
  customClaims?: Record<string, Record<string, unknown>>; // uid -> customClaims
  classes: ClassRoom[];
  classMemberships: ClassMembership[];
  teacherAssignments: TeacherAssignment[];
  studentEnrollments: StudentEnrollment[];
  parentLinks: ParentLink[];
  invitations: Invitation[];
  subjects: SubjectItem[];
  topics: Topic[];
  workPlans: WorkPlan[];
  lessons: LessonItem[];
  questions: QuestionItem[];
  questionRevisions: QuestionRevision[];
  questionMedia: QuestionMedia[];
  assessments: Assessment[];
  assignments: Assignment[];
  attempts: AssessmentAttempt[];
  gradingRecords: GradingRecord[];
  importBatches: ImportBatch[];
  studentImportJobs: StudentImportJob[];
  curriculumImportJobs: CurriculumImportJob[];
  masteryRecords: MasteryRecord[];
  learningPaths: LearningPathItem[];
  learningRecommendations: LearningRecommendation[];
  notifications: AppNotification[];
  teacherNotes: TeacherNote[];
  auditLogs: AuditLogEntry[];
  // Gamification & Roadmap 2.0 Collections
  studentGamificationProfiles?: StudentGamificationProfile[];
  learningCheckins?: LearningCheckin[];
  studentGoals?: StudentGoal[];
  learningActivityEvents?: LearningActivityEvent[];
  xpLedger?: XpLedgerEntry[];
  gamificationBadges?: GamificationBadgeDefinition[];
  studentBadges?: StudentBadgeRecord[];
  streakRecords?: StreakRecord[];
  weeklyRecaps?: WeeklyRecapRecord[];
  classChallenges?: ClassChallenge[];
  gamificationConfig?: GamificationConfig;
  studentLessonCompletions?: StudentLessonCompletion[];
  // Student Monitoring & Academic Intelligence Collections
  attendanceSessions?: AttendanceSession[];
  attendanceRecords?: AttendanceRecord[];
  studentAssignments?: StudentAssignment[];
  assignmentSubmissions?: AssignmentSubmission[];
  studentAlerts?: StudentAlert[];
  studentSupportPlans?: StudentSupportPlan[];
  academicReports?: AcademicReportItem[];
  // Academic Operating System 2.0 Collections
  timetables?: Timetable[];
  timetableEntries?: TimetableEntry[];
  submissionRevisions?: SubmissionRevision[];
  announcements?: Announcement[];
  announcementReads?: AnnouncementRead[];
  announcementAcknowledgements?: AnnouncementAcknowledgement[];
  learningMaterials?: LearningMaterial[];
  gradingRubrics?: GradingRubric[];
  feedbackComments?: FeedbackComment[];
  gradingHistory?: GradingHistoryEntry[];
  academicEvents?: AcademicCalendarEvent[];
  lessonDeliveryRecords?: LessonDeliveryRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const PROD_DB_PATH = path.join(DATA_DIR, 'learnos_prod.json');
const TEST_DB_PATH = path.join(DATA_DIR, 'learnos_test.json');
const configuredSessionSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === 'production' && (!configuredSessionSecret || configuredSessionSecret.length < 32 || configuredSessionSecret.includes('REPLACE_WITH'))) {
  throw new Error('Production requires a random SESSION_SECRET of at least 32 characters.');
}
// Development sessions expire when the process restarts unless configured explicitly.
const TOKEN_SECRET = configuredSessionSecret || crypto.randomBytes(32).toString('hex');

export function ensureSpecializedStudyStructure(
  state: PersistentDatabaseState
): PersistentDatabaseState {
  const nowIso = '2026-01-01T00:00:00.000Z';

  // 1. Ensure primary Specialized Study institution exists
  if (!Array.isArray(state.institutions)) {
    state.institutions = [];
  }
  let primaryInst = state.institutions[0];
  if (!primaryInst) {
    primaryInst = {
      id: DEFAULT_INSTITUTION_ID,
      name: 'Specialized Study Ixtisoslashtirilgan Maktabi',
      shortName: 'Specialized Study',
      officialName: 'Specialized Study Ixtisoslashtirilgan Maktabi',
      type: 'specialized_school',
      code: 'SPEC-STUDY-01',
      region: 'Toshkent shahri',
      district: 'Mirzo Ulug‘bek tumani',
      academicYear: '2026-2027',
      supportedGrades: [5, 6, 7, 8, 9, 10, 11],
      gradingScale: '100_percent',
      languageOfInstruction: "O'zbek tili",
      timezone: 'Asia/Tashkent',
      status: 'active',
      adminUid: 'admin-owner',
      allowExcelImports: true,
      aiFeaturesEnabled: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    state.institutions.push(primaryInst);
  } else {
    if (!primaryInst.name || primaryInst.name.includes('LearnOS')) {
      primaryInst.name = 'Specialized Study Ixtisoslashtirilgan Maktabi';
      primaryInst.shortName = 'Specialized Study';
    }
    if (!primaryInst.academicYear) {
      primaryInst.academicYear = '2026-2027';
    }
  }

  const instId = primaryInst.id;
  const academicYear = primaryInst.academicYear || '2026-2027';

  // 2. Ensure the 5 initial subjects exist without duplicates
  if (!Array.isArray(state.subjects)) {
    state.subjects = [];
  }
  for (const defSubj of DEFAULT_SUBJECTS) {
    const existing = state.subjects.find(
      (s) =>
        s.id === defSubj.id ||
        s.name.trim().toLowerCase() === defSubj.name.trim().toLowerCase()
    );
    if (!existing) {
      state.subjects.push({
        ...defSubj,
        institutionId: instId,
      });
    } else {
      existing.code = defSubj.code;
      existing.trackTypes = existing.trackTypes?.length ? existing.trackTypes : [...defSubj.trackTypes];
      existing.applicableGrades = existing.applicableGrades?.length
        ? existing.applicableGrades
        : [...defSubj.applicableGrades];
      existing.applicableClassCodes = existing.applicableClassCodes?.length
        ? existing.applicableClassCodes
        : [...defSubj.applicableClassCodes];
      if (!existing.status) existing.status = 'active';
    }
  }

  // 3. Ensure the exact 19 official classes exist (14 A-track + 5 T-track, never 5t or 6t, no duplicates)
  if (!Array.isArray(state.classes)) {
    state.classes = [];
  }

  // Remove any invalid 5t or 6t classes if ever present
  state.classes = state.classes.filter((c) => {
    const raw = String(c.code || c.name || '').trim().toLowerCase();
    return raw !== '5t' && raw !== '6t';
  });

  const seenOfficialCodes = new Set<string>();
  const deduplicatedClasses: ClassRoom[] = [];

  for (const cls of state.classes) {
    const rawCode = String(cls.code || cls.name || '')
      .trim()
      .toLowerCase();
    const parsed = parseOfficialClassCode(rawCode);
    if (parsed) {
      if (seenOfficialCodes.has(parsed.code)) {
        continue; // Skip duplicate official class
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
      cls.subject = cls.subject || (parsed.track === 'A' ? 'Matematika' : 'Biologiya');
      cls.inviteCode = cls.inviteCode || `SS-${parsed.code.toUpperCase()}-2026`;
      cls.status = cls.status || 'active';
      deduplicatedClasses.push(cls);
    } else {
      // Keep non-conflicting custom classes only if they don't collide
      deduplicatedClasses.push(cls);
    }
  }

  // Create any missing official classes from the 19-class list
  for (const code of OFFICIAL_19_CLASS_CODES) {
    if (!seenOfficialCodes.has(code)) {
      const meta = parseOfficialClassCode(code)!;
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
        subject: meta.track === 'A' ? 'Matematika' : 'Biologiya',
        subjectIds,
        subjectNames,
        teacherId: primaryInst.adminUid || 'admin-owner',
        teacherName: 'Specialized Study',
        institutionId: instId,
        inviteCode: `SS-${code.toUpperCase()}-2026`,
        studentCount: 0,
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      seenOfficialCodes.add(code);
    }
  }

  // Sort official classes in canonical order (5a1..11t)
  const orderMap = new Map<string, number>(
    OFFICIAL_19_CLASS_CODES.map((c, idx) => [c, idx])
  );
  deduplicatedClasses.sort((a, b) => {
    const idxA = orderMap.has(a.code) ? orderMap.get(a.code)! : 999;
    const idxB = orderMap.has(b.code) ? orderMap.get(b.code)! : 999;
    return idxA - idxB;
  });

  if (!state.customClaims || typeof state.customClaims !== 'object') {
    state.customClaims = {};
  }

  // Recalculate real studentCount for every class from actual enrolled students
  const usersList = Array.isArray(state.users) ? state.users : [];
  for (const usr of usersList) {
    const normalizedEmail = String(usr.email || '').trim().toLowerCase();
    const isAuthAdminEmail = isAuthorizedAdminEmail(normalizedEmail);
    if (isAuthAdminEmail && usr.emailVerified !== false && usr.platformAdmin !== false) {
      usr.role = 'platform_owner';
      usr.platformOwner = true;
      usr.platformAdmin = true;
      state.customClaims[usr.uid] = {
        ...(state.customClaims[usr.uid] || {}),
        platformAdmin: true,
      };
    } else if (!isAuthAdminEmail && (usr.role === 'platform_owner' || usr.role === 'admin')) {
      usr.role = 'student';
      usr.platformOwner = false;
      usr.platformAdmin = false;
    }
  }

  for (const cls of deduplicatedClasses) {
    const actualCount = usersList.filter(
      (u) =>
        u.role === 'student' &&
        u.status !== 'suspended' &&
        u.status !== 'archived' &&
        (u.classId === cls.id ||
          (u.classCode && u.classCode.toLowerCase() === cls.code.toLowerCase()))
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

  // Ensure Gamification & Roadmap 2.0 collections exist
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
      goalTemplates: [...DEFAULT_GAMIFICATION_CONFIG.goalTemplates],
    };
  }
  if (!Array.isArray(state.studentLessonCompletions)) {
    state.studentLessonCompletions = [];
  }

  // Ensure Monitoring & Intelligence collections exist
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

  // Ensure Academic OS 2.0 collections exist
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

export function createEmptyDatabaseState(): PersistentDatabaseState {
  const base: PersistentDatabaseState = {
    institutions: [
      {
        id: DEFAULT_INSTITUTION_ID,
        name: 'Specialized Study Ixtisoslashtirilgan Maktabi',
        shortName: 'Specialized Study',
        officialName: 'Specialized Study Ixtisoslashtirilgan Maktabi',
        type: 'specialized_school',
        code: 'SPEC-STUDY-01',
        region: 'Toshkent shahri',
        district: 'Mirzo Ulug‘bek tumani',
        academicYear: '2026-2027',
        supportedGrades: [5, 6, 7, 8, 9, 10, 11],
        gradingScale: '100_percent',
        languageOfInstruction: "O'zbek tili",
        timezone: 'Asia/Tashkent',
        status: 'active',
        adminUid: 'admin-owner',
        allowExcelImports: true,
        aiFeaturesEnabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    institutionSettings: [],
    academicYears: [...DEFAULT_ACADEMIC_YEARS],
    users: [],
    passwordHashes: {},
    classes: buildOfficial19Classes(DEFAULT_INSTITUTION_ID, '2026-2027', 'admin-owner'),
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
      goalTemplates: [...DEFAULT_GAMIFICATION_CONFIG.goalTemplates],
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
    lessonDeliveryRecords: [],
  };
  return ensureSpecializedStudyStructure(base);
}

function ensureDataDir(): string {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o777 });
    }
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
    return DATA_DIR;
  } catch {
    const tmpDir = path.join('/tmp', '.data');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true, mode: 0o777 });
    }
    return tmpDir;
  }
}

function resolveDbPaths(env: 'prod' | 'test'): { readPath: string; writePath: string } {
  const writableDir = ensureDataDir();
  const fileName = env === 'test' ? 'learnos_test.json' : 'learnos_prod.json';
  const writePath = path.join(writableDir, fileName);
  const bundledPath = env === 'test' ? TEST_DB_PATH : PROD_DB_PATH;
  if (fs.existsSync(writePath)) {
    return { readPath: writePath, writePath };
  }
  if (fs.existsSync(bundledPath)) {
    return { readPath: bundledPath, writePath };
  }
  return { readPath: writePath, writePath };
}

const memoryCache: Record<'prod' | 'test', PersistentDatabaseState | null> = {
  prod: null,
  test: null,
};

export function getDbState(env: 'prod' | 'test' = 'prod'): PersistentDatabaseState {
  const context = requestDatabase.getStore();
  if (env === 'prod' && context) return context.state;
  if (memoryCache[env]) {
    return memoryCache[env]!;
  }
  const { readPath } = resolveDbPaths(env);
  if (fs.existsSync(readPath)) {
    try {
      const raw = fs.readFileSync(readPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistentDatabaseState>;
      const merged: PersistentDatabaseState = ensureSpecializedStudyStructure({
        ...createEmptyDatabaseState(),
        ...parsed,
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

export function saveDbState(env: 'prod' | 'test', state: PersistentDatabaseState): void {
  const context = requestDatabase.getStore();
  if (env === 'prod' && context) { context.state = state; context.dirty = true; return; }
  memoryCache[env] = state;
  const { writePath } = resolveDbPaths(env);
  const serialized = JSON.stringify(state);
  try {
    fs.writeFileSync(writePath, serialized, { encoding: 'utf-8', mode: 0o666 });
    try {
      fs.chmodSync(writePath, 0o666);
    } catch {
      // ignore chmod errors if not owner
    }
  } catch (err) {
    // Fallback to /tmp/.data if primary DATA_DIR becomes read-only
    try {
      const fallbackDir = path.join('/tmp', '.data');
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true, mode: 0o777 });
      }
      const fallbackFile = path.join(
        fallbackDir,
        env === 'test' ? 'learnos_test.json' : 'learnos_prod.json'
      );
      fs.writeFileSync(fallbackFile, serialized, { encoding: 'utf-8', mode: 0o666 });
    } catch {
      console.warn('In-memory state preserved; disk write skipped:', err);
    }
  }
}

const revokedTokenSet = new Set<string>();
const revokedBeforeTimestampByUser = new Map<string, number>();

export function resetTestDbState(): void {
  const { writePath } = resolveDbPaths('test');
  const empty = createEmptyDatabaseState();
  memoryCache.test = empty;
  revokedTokenSet.clear();
  revokedBeforeTimestampByUser.clear();
  try {
    if (fs.existsSync(writePath)) {
      fs.unlinkSync(writePath);
    }
  } catch {
    // Ignore unlink error on read-only fs
  }
  saveDbState('test', empty);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function generateSecureRandomPassword(): string {
  return `SS-${crypto.randomBytes(16).toString('hex')}!9a`;
}

export function verifyPassword(password: string, storedHash: string | undefined): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  const keyBuf = Buffer.from(key, 'hex');
  const derivedBuf = Buffer.from(derived, 'hex');
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function revokeSessionToken(token: string | undefined): void {
  if (!token) return;
  const context = requestDatabase.getStore();
  if (context) {
    const now=Date.now();
    context.state.revokedSessionHashes=Object.fromEntries(Object.entries(context.state.revokedSessionHashes || {}).filter(([,expiry])=>expiry>now));
    try { const payload=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString('utf8'));context.state.revokedSessionHashes[crypto.createHash('sha256').update(token.trim()).digest('hex')]=Number(payload.exp)||now+604800000;context.dirty=true; } catch { /* malformed tokens cannot authenticate */ }
    return;
  }
  revokedTokenSet.add(token.trim());
}

export function revokeAllUserSessions(uid: string): void {
  if (!uid) return;
  const context=requestDatabase.getStore();
  if(context){context.state.revokedBeforeByUser||={};context.state.revokedBeforeByUser[uid]=Date.now();context.dirty=true;return;}
  revokedBeforeTimestampByUser.set(uid, Date.now());
}

export function issueSessionToken(
  uid: string,
  env: 'prod' | 'test',
  expiresInMs: number = 1000 * 60 * 60 * 24 * 7
): string {
  const now = Date.now();
  const payload = JSON.stringify({
    uid,
    env,
    jti: crypto.randomBytes(8).toString('hex'),
    iat: now,
    exp: now + expiresInMs,
  });
  const base64Payload = Buffer.from(payload, 'utf-8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(base64Payload)
    .digest('base64url');
  return `${base64Payload}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined
): { uid: string; env: 'prod' | 'test' } | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const cleanToken = token.trim();
  if (revokedTokenSet.has(cleanToken)) return null;
  const durableRevocations=requestDatabase.getStore()?.state.revokedSessionHashes;
  if(durableRevocations?.[crypto.createHash('sha256').update(cleanToken).digest('hex')])return null;

  const parts = cleanToken.split('.');
  if (parts.length !== 2) return null;
  const [base64Payload, signature] = parts;
  if (!base64Payload || !signature) return null;

  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(base64Payload)
    .digest('base64url');

  const sigBuf = Buffer.from(signature, 'utf-8');
  const expectedBuf = Buffer.from(expectedSig, 'utf-8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf-8'));
    if (!decoded.uid || typeof decoded.exp !== 'number' || decoded.exp < Date.now()) {
      return null;
    }
    const revokedBefore = requestDatabase.getStore()?.state.revokedBeforeByUser?.[decoded.uid] || revokedBeforeTimestampByUser.get(decoded.uid);
    if (revokedBefore && typeof decoded.iat === 'number' && decoded.iat <= revokedBefore) {
      return null;
    }
    return {
      uid: decoded.uid,
      env: decoded.env === 'test' ? 'test' : 'prod',
    };
  } catch {
    return null;
  }
}

export function generateCryptographicInviteToken(rolePrefix: string): {
  rawToken: string;
  tokenHash: string;
} {
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  const rawToken = `INV-${rolePrefix.slice(0, 3).toUpperCase()}-${rand}`;
  const tokenHash = computeSimpleHash(rawToken);
  return { rawToken, tokenHash };
}
