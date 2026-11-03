import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  getIdToken,
  getIdTokenResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  createGoogleAuthProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  mapFirebaseAuthError,
  isMobileOrTouchRedirectPreferred,
  SanitizedFirebaseAuthError,
} from '../utils/firebaseAuthErrors';
import {
  Institution,
  UserProfile,
  UserRole,
  ClassRoom,
  Invitation,
  SubjectItem,
  Topic,
  QuestionItem,
  Assessment,
  Assignment,
  AssessmentAttempt,
  MasteryRecord,
  LearningPathItem,
  LearningPathStepStatus,
  TeacherNote,
  AppNotification,
  AuditLogEntry,
  AIAnalysisResult,
  AcademicYearItem,
  QuestionRevision,
  QuestionMedia,
  GradingRecord,
  ImportBatch,
  WorkPlan,
  WorkPlanRowItem,
  WorkPlanType,
  LessonItem,
  AICommandExecutionResult,
  OfficialClassCode,
  StudentAccountStatus,
  StudentImportColumnMapping,
  StudentImportPreviewResult,
  StudentImportRowPreview,
  StudentImportJob,
  CurriculumImportJob,
  CurriculumZipImportPreview,
  LessonStatus,
  QuestionDifficulty,
  QuestionType,
  CalendarEventItem,
  GlobalSearchResultItem,
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
  StudentAvatarIconKey,
} from '../types';
import {
  DEFAULT_SUBJECTS,
  DEFAULT_CURRICULUM_TOPICS,
  DEFAULT_ACADEMIC_YEARS,
  PLATFORM_OWNER_EMAIL,
} from '../constants/curriculum';
import {
  DEFAULT_GAMIFICATION_BADGES,
  DEFAULT_GAMIFICATION_CONFIG,
} from '../utils/gamificationEngine';
import { canAccessPlatformAdminConsole } from '../utils/security';
import { LanguageCode } from '../i18n/translations';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface LearnOSContextValue {
  currentUser: UserProfile | null;
  sessionToken: string | null;
  authReady: boolean;
  isGoogleSigningIn: boolean;
  authError: SanitizedFirebaseAuthError | null;
  activationPendingMessage: string | null;
  clearAuthError: () => void;
  isBootstrapped: boolean;
  isPlatformOwner: boolean;
  theme: 'light' | 'dark';
  language: LanguageCode;
  institution: Institution;
  institutions: Institution[];
  academicYears: AcademicYearItem[];
  subjects: SubjectItem[];
  topics: Topic[];
  users: UserProfile[];
  classes: ClassRoom[];
  invitations: Invitation[];
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
  workPlans: WorkPlan[];
  lessons: LessonItem[];
  masteryRecords: MasteryRecord[];
  learningPaths: LearningPathItem[];
  teacherNotes: TeacherNote[];
  notifications: AppNotification[];
  auditLogs: AuditLogEntry[];
  studentGamificationProfiles: StudentGamificationProfile[];
  learningCheckins: LearningCheckin[];
  studentGoals: StudentGoal[];
  learningActivityEvents: LearningActivityEvent[];
  xpLedger: XpLedgerEntry[];
  gamificationBadges: GamificationBadgeDefinition[];
  studentBadges: StudentBadgeRecord[];
  streakRecords: StreakRecord[];
  weeklyRecaps: WeeklyRecapRecord[];
  classChallenges: ClassChallenge[];
  gamificationConfig: GamificationConfig;
  studentLessonCompletions: StudentLessonCompletion[];
  toasts: ToastMessage[];
  toggleTheme: () => void;
  setLanguage: (lang: LanguageCode) => void;
  addToast: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
  removeToast: (id: string) => void;
  refreshState: () => Promise<void>;
  bootstrapInitialAdmin: (payload: {
    displayName: string;
    email: string;
    password: string;
    institutionName: string;
    region: string;
    district: string;
    academicYear: string;
  }) => Promise<UserProfile>;
  loginWithPassword: (email: string, password: string) => Promise<UserProfile>;
  registerWithInvitation: (payload: {
    displayName: string;
    email: string;
    password: string;
    inviteToken: string;
  }) => Promise<UserProfile>;
  previewInvitationToken: (token: string) => Promise<{
    role: UserRole;
    institutionName: string;
    className: string | null;
    email?: string;
    subject?: string;
  } | null>;
  loginWithGoogle: (
    inviteOrOptions?: string | { forceRedirect?: boolean; inviteToken?: string },
    options?: { forceRedirect?: boolean }
  ) => Promise<UserProfile | null>;
  logout: () => Promise<void>;
  submitAssessmentAttempt: (
    assessmentId: string,
    submittedMap: Record<string, string>
  ) => Promise<AssessmentAttempt>;
  generateAttemptAIAnalysis: (attemptId: string) => Promise<AIAnalysisResult>;
  createClassRoom: (
    name: string,
    grade: number,
    subject: string,
    teacherId?: string
  ) => Promise<ClassRoom>;
  updateClassRoom: (classId: string, updates: Partial<ClassRoom>) => Promise<void>;
  removeStudentFromClass: (classId: string, studentId: string) => Promise<void>;
  createInvitation: (payload: {
    inviteeName?: string;
    email?: string;
    role: UserRole;
    classId?: string;
    subject?: string;
    linkedStudentId?: string;
    expiresInHours?: number;
  }) => Promise<{ invitation: Invitation; rawToken: string }>;
  importStudentsCSV: (
    csvTextOrRows: string | Array<{ displayName: string; email?: string; className?: string }>,
    defaultClassId?: string
  ) => Promise<{
    createdCount: number;
    createdInvites: Array<{ inviteeName: string; email: string; rawToken: string }>;
  }>;
  revokeInvitation: (invitationId: string) => Promise<void>;
  addUserByAdmin: (
    displayName: string,
    email: string,
    role: UserRole,
    classId?: string,
    password?: string,
    classCode?: string
  ) => Promise<UserProfile>;
  updateUserAdmin: (
    uid: string,
    updates: {
      status?: StudentAccountStatus;
      classId?: string;
      classCode?: string;
      displayName?: string;
      firstName?: string;
      lastName?: string;
      patronymic?: string;
      email?: string;
      studentCode?: string;
      assignedClassIds?: string[];
      subject?: string;
    }
  ) => Promise<void>;
  previewStudentExcelImport: (payload: {
    fileName: string;
    base64Data?: string;
    csvText?: string;
    selectedSheet?: string;
    selectedHeaderRowIndex?: number;
    columnMappingOverride?: StudentImportColumnMapping;
    rowClassOverrides?: Record<number, string>;
    rowFieldOverrides?: Record<number, Record<string, string>>;
  }) => Promise<StudentImportPreviewResult>;
  confirmStudentExcelImport: (payload: {
    jobId: string;
    fileName: string;
    duplicatePolicy?: 'skip_existing' | 'update_existing';
    rows?: StudentImportRowPreview[];
    base64Data?: string;
    csvText?: string;
    selectedSheet?: string;
    selectedHeaderRowIndex?: number;
    columnMappingOverride?: StudentImportColumnMapping;
    rowClassOverrides?: Record<number, string>;
    rowFieldOverrides?: Record<number, Record<string, string>>;
  }) => Promise<{
    job: StudentImportJob;
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
    errorCount: number;
  }>;
  rollbackStudentImportJob: (jobId: string) => Promise<{
    job: StudentImportJob;
    removedCount: number;
    archivedCount: number;
  }>;
  executeBulkStudentAction: (payload: {
    action: 'change_class' | 'send_invite' | 'archive' | 'suspend' | 'activate';
    studentUids: string[];
    targetClassCode?: string;
  }) => Promise<any>;
  searchGlobal: (queryText: string) => Promise<GlobalSearchResultItem[]>;
  fetchCalendarEvents: (filters?: {
    classCode?: string;
    subject?: string;
    type?: string;
  }) => Promise<CalendarEventItem[]>;
  createSubject: (
    nameOrPayload:
      | string
      | {
          name: string;
          code?: string;
          track?: 'A' | 'T' | 'BOTH';
          grades?: number[];
          applicableClassCodes?: OfficialClassCode[];
          description?: string;
        },
    grade?: number,
    description?: string
  ) => Promise<void>;
  updateSubject: (
    subjectId: string,
    updates: Partial<SubjectItem>
  ) => Promise<void>;
  createTopic: (
    nameOrPayload:
      | string
      | {
          name: string;
          subject: string;
          grade: number;
          description: string;
          unit?: string;
          quarter?: 1 | 2 | 3 | 4;
          classCode?: OfficialClassCode;
        },
    subject?: string,
    grade?: number,
    description?: string
  ) => Promise<void>;
  analyzeWorkPlan: (payload: {
    fileName: string;
    base64Data?: string;
    rawText?: string;
    classId?: string;
    classCode?: string;
    subject: string;
    academicYear?: string;
    quarter?: number;
    planType?: WorkPlanType;
  }) => Promise<{
    rows: WorkPlanRowItem[];
    warnings: string[];
    sourceType: string;
  }>;
  confirmWorkPlan: (payload: {
    title?: string;
    fileName?: string;
    sourceType?: string;
    classId?: string;
    classCode?: string;
    subject: string;
    academicYear?: string;
    quarter?: number;
    planType?: WorkPlanType;
    rows: WorkPlanRowItem[];
    publishImmediately?: boolean;
  }) => Promise<{
    workPlan: WorkPlan;
    createdLessonsCount: number;
    createdTopicsCount: number;
    lessons: LessonItem[];
  }>;
  deleteWorkPlan: (workPlanId: string) => Promise<void>;
  previewCurriculumZipArchive: (payload?: {
    useOfficialAttachedArchive?: boolean;
    base64Data?: string;
    fileName?: string;
  }) => Promise<CurriculumZipImportPreview>;
  confirmCurriculumZipArchive: (payload: {
    jobId?: string;
    useOfficialAttachedArchive?: boolean;
    base64Data?: string;
    fileName?: string;
    academicYear?: string;
    tTrackVisibilityApproved?: boolean;
    publishImmediately?: boolean;
    duplicatePolicy?: 'skip_existing' | 'update_existing';
  }) => Promise<{
    job: CurriculumImportJob;
    idempotentReplay: boolean;
    importedWorkPlansCount: number;
    updatedWorkPlansCount: number;
    importedLessonsCount: number;
    updatedLessonsCount: number;
    skippedDuplicatesCount: number;
  }>;
  updateTTrackMathVisibility: (
    approvedOrPayload:
      | boolean
      | {
          tTrackVisibilityApproved: boolean;
          publishLessons?: boolean;
        }
  ) => Promise<{
    tTrackVisibilityApproved: boolean;
    updatedPlans: number;
    updatedLessons: number;
  }>;
  bulkUpdateLessonsStatus: (
    lessonIdsOrPayload:
      | string[]
      | {
          lessonIds?: string[];
          workPlanId?: string;
          classCode?: string;
          quarter?: number;
          curriculumArea?: string;
          status: LessonStatus;
        },
    statusArg?: LessonStatus
  ) => Promise<{ updatedCount: number; status: LessonStatus }>;
  generateLessonAssessment: (
    lessonId: string,
    payload: {
      questionCount?: number;
      difficulty?: QuestionDifficulty;
      questionTypes?: QuestionType[];
      maxPoints?: number;
      durationMinutes?: number;
      referenceText?: string;
      title?: string;
      publishImmediately?: boolean;
    }
  ) => Promise<{
    assessment: Assessment;
    questions: QuestionItem[];
    blueprintLessonsCount: number;
  }>;
  batchGenerateLessonAssessments: (payload: {
    lessonIds: string[];
    title?: string;
    questionCount?: number;
    difficulty?: QuestionDifficulty;
    questionTypes?: QuestionType[];
    durationMinutes?: number;
    maxPoints?: number;
    referenceText?: string;
    publishImmediately?: boolean;
  }) => Promise<{
    createdCount: number;
    assessment: Assessment;
    questions: QuestionItem[];
    assessments: Assessment[];
  }>;
  createLesson: (payload: Partial<LessonItem>) => Promise<LessonItem>;
  updateLesson: (lessonId: string, updates: Partial<LessonItem>) => Promise<LessonItem>;
  deleteLesson: (lessonId: string) => Promise<void>;
  generateAITest: (payload: {
    classId?: string;
    classCode?: string;
    subject?: string;
    topicName?: string;
    topicId?: string;
    lessonId?: string;
    questionCount?: number;
    difficulty?: string;
    quarter?: number;
    title?: string;
  }) => Promise<{
    assessment: Assessment;
    questions: QuestionItem[];
    topic: Topic;
  }>;
  executeAICommand: (commandText: string) => Promise<AICommandExecutionResult>;
  createQuestion: (
    item: Omit<QuestionItem, 'id' | 'institutionId' | 'authorId' | 'createdAt'>
  ) => Promise<QuestionItem>;
  updateQuestion: (questionId: string, updates: Partial<QuestionItem>) => Promise<void>;
  deleteQuestion: (questionId: string) => Promise<void>;
  createAssessment: (
    payload: Omit<Assessment, 'id' | 'teacherId' | 'institutionId' | 'createdAt'>
  ) => Promise<Assessment>;
  updateAssessment: (assessmentId: string, updates: Partial<Assessment>) => Promise<void>;
  createAssignment: (payload: {
    assessmentId: string;
    classId: string;
    dueDate: string;
  }) => Promise<Assignment>;
  updateAssignmentStatus: (
    assignmentId: string,
    status: 'published' | 'closed',
    dueDate?: string
  ) => Promise<void>;
  updateLearningPathStepStatus: (
    pathId: string,
    stepNumber: number,
    status: LearningPathStepStatus
  ) => Promise<void>;
  addTeacherNote: (studentId: string, content: string) => Promise<void>;
  linkChildByCode: (studentCode: string) => Promise<boolean>;
  updateInstitutionSettings: (
    name: string,
    region: string,
    district: string,
    academicYear?: string,
    allowTeacherStudentInvites?: boolean
  ) => Promise<void>;
  createInstitution: (payload: Partial<Institution> & {
    name: string;
    initialClasses?: Array<{ name: string; grade: number; subject: string }>;
  }) => Promise<Institution>;
  updateInstitutionFull: (id: string, updates: Partial<Institution>) => Promise<Institution>;
  changeInstitutionStatus: (
    id: string,
    status: 'active' | 'suspended' | 'archived' | 'onboarding',
    reason?: string
  ) => Promise<Institution>;
  switchActiveInstitution: (institutionId: string) => Promise<void>;
  createAcademicYear: (payload: {
    name: string;
    startDate: string;
    endDate: string;
    isCurrent?: boolean;
  }) => Promise<AcademicYearItem>;
  uploadMediaFile: (payload: {
    fileName: string;
    base64Data?: string;
    dataUrl?: string;
    institutionId?: string;
    assessmentId?: string;
    questionId?: string;
    width?: number;
    height?: number;
  }) => Promise<QuestionMedia>;
  validateImportPackage: (
    fileName: string,
    base64Data: string,
    institutionId?: string
  ) => Promise<any>;
  confirmImportPackage: (payload: {
    fileName: string;
    base64Data: string;
    institutionId?: string;
    classId?: string;
    importMode?: 'draft_assessment' | 'question_bank_only' | 'assessment_and_bank';
    duplicatePolicy?: 'skip_existing' | 'import_new_only' | 'update_existing';
  }) => Promise<any>;
  suggestWrittenGrade: (payload: {
    prompt: string;
    rubricText?: string;
    studentAnswer: string;
    maxPoints?: number;
  }) => Promise<{
    suggestedPoints: number;
    maxPoints: number;
    confidence: string;
    feedback: string;
    isAiSuggestion: boolean;
    finalized: boolean;
  }>;
  confirmWrittenGrade: (
    attemptId: string,
    payload: {
      questionId: string;
      awardedPoints: number;
      feedback: string;
      aiSuggestedPoints?: number;
      aiSuggestedFeedback?: string;
    }
  ) => Promise<AssessmentAttempt>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  submitDailyCheckin: (payload: {
    selectedSubject: string;
    selectedGoal: string;
    completionState?: 'active' | 'completed';
  }) => Promise<{ checkin: LearningCheckin; gamification: any }>;
  completeStudentLesson: (
    lessonId: string,
    practiceCompleted?: boolean
  ) => Promise<{ completion: StudentLessonCompletion; gamification: any }>;
  completeStudentLessonPractice: (lessonId: string) => Promise<{ gamification: any }>;
  createStudentGoal: (payload: {
    period: 'daily' | 'weekly';
    subject: string;
    title: string;
    targetCount: number;
  }) => Promise<StudentGoal>;
  updateStudentGoal: (
    goalId: string,
    updates: {
      title?: string;
      targetCount?: number;
      currentCount?: number;
      status?: 'active' | 'completed';
    }
  ) => Promise<StudentGoal>;
  updateStudentProfilePreferences: (updates: {
    avatarIcon?: StudentAvatarIconKey;
    streakRemindersEnabled?: boolean;
    notificationsEnabled?: boolean;
  }) => Promise<StudentGamificationProfile>;
  reorderLesson: (payload: {
    lessonId?: string;
    direction?: 'up' | 'down';
    orderedLessonIds?: string[];
  }) => Promise<void>;
  updateGamificationConfig: (
    updates: Partial<GamificationConfig> & {
      badgeUpdates?: Array<{
        code: string;
        thresholdValue?: number;
        isActive?: boolean;
        title?: string;
        description?: string;
      }>;
    }
  ) => Promise<void>;
  createClassChallenge: (payload: {
    classCode: string;
    title: string;
    description?: string;
    targetType?: 'lessons' | 'assessments' | 'checkins' | 'activities';
    targetCount: number;
    subject?: string;
    startDate?: string;
    endDate?: string;
  }) => Promise<ClassChallenge>;
  updateClassChallenge: (
    id: string,
    updates: {
      title?: string;
      description?: string;
      targetCount?: number;
      isActive?: boolean;
    }
  ) => Promise<ClassChallenge>;
}

const LearnOSContext = createContext<LearnOSContextValue | undefined>(undefined);

const EMPTY_INSTITUTION: Institution = {
  id: 'inst-specialized-study',
  name: 'Specialized Study',
  region: 'O‘zbekiston',
  district: 'Toshkent',
  academicYear: '2026-2027',
  adminUid: '',
  createdAt: new Date().toISOString(),
};

function isIsolatedTestMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('testEnv') === '1') {
    sessionStorage.setItem('learnos_test_env', '1');
    return true;
  }
  return sessionStorage.getItem('learnos_test_env') === '1';
}

export const LearnOSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('learnos_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [language, setLanguage] = useState<LanguageCode>('uz');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    return localStorage.getItem('learnos_session_token');
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<SanitizedFirebaseAuthError | null>(null);
  const [activationPendingMessage, setActivationPendingMessage] = useState<string | null>(null);
  const [isBootstrapped, setIsBootstrapped] = useState<boolean>(true);
  const googleSignInInFlightRef = useRef<boolean>(false);
  const clearAuthError = useCallback(() => {
    setAuthError(null);
    setActivationPendingMessage(null);
  }, []);

  const [institution, setInstitution] = useState<Institution>(EMPTY_INSTITUTION);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>(DEFAULT_ACADEMIC_YEARS);
  const [subjects, setSubjects] = useState<SubjectItem[]>(DEFAULT_SUBJECTS);
  const [topics, setTopics] = useState<Topic[]>(DEFAULT_CURRICULUM_TOPICS);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [questionRevisions, setQuestionRevisions] = useState<QuestionRevision[]>([]);
  const [questionMedia, setQuestionMedia] = useState<QuestionMedia[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
  const [gradingRecords, setGradingRecords] = useState<GradingRecord[]>([]);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [studentImportJobs, setStudentImportJobs] = useState<StudentImportJob[]>([]);
  const [curriculumImportJobs, setCurriculumImportJobs] = useState<CurriculumImportJob[]>([]);
  const [workPlans, setWorkPlans] = useState<WorkPlan[]>([]);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [masteryRecords, setMasteryRecords] = useState<MasteryRecord[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPathItem[]>([]);
  const [teacherNotes, setTeacherNotes] = useState<TeacherNote[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [studentGamificationProfiles, setStudentGamificationProfiles] = useState<
    StudentGamificationProfile[]
  >([]);
  const [learningCheckins, setLearningCheckins] = useState<LearningCheckin[]>([]);
  const [studentGoals, setStudentGoals] = useState<StudentGoal[]>([]);
  const [learningActivityEvents, setLearningActivityEvents] = useState<LearningActivityEvent[]>([]);
  const [xpLedger, setXpLedger] = useState<XpLedgerEntry[]>([]);
  const [gamificationBadges, setGamificationBadges] = useState<GamificationBadgeDefinition[]>(
    DEFAULT_GAMIFICATION_BADGES
  );
  const [studentBadges, setStudentBadges] = useState<StudentBadgeRecord[]>([]);
  const [streakRecords, setStreakRecords] = useState<StreakRecord[]>([]);
  const [weeklyRecaps, setWeeklyRecaps] = useState<WeeklyRecapRecord[]>([]);
  const [classChallenges, setClassChallenges] = useState<ClassChallenge[]>([]);
  const [gamificationConfig, setGamificationConfig] = useState<GamificationConfig>(
    DEFAULT_GAMIFICATION_CONFIG
  );
  const [studentLessonCompletions, setStudentLessonCompletions] = useState<
    StudentLessonCompletion[]
  >([]);

  const isPlatformOwner = canAccessPlatformAdminConsole(currentUser, PLATFORM_OWNER_EMAIL);

  // Remove any legacy demo state cache from browser storage on mount
  useEffect(() => {
    localStorage.removeItem('learnos_demo_state_v1');
    localStorage.removeItem('learnos_active_user');
    localStorage.removeItem('learnos_is_demo');
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('learnos_theme', theme);
  }, [theme]);

  const addToast = useCallback(
    (type: 'success' | 'error' | 'info', title: string, description?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const apiFetch = useCallback(
    async (url: string, options: RequestInit = {}, overrideToken?: string | null) => {
      const activeToken = overrideToken !== undefined ? overrideToken : sessionToken;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
      };
      if (activeToken) {
        headers.Authorization = `Bearer ${activeToken}`;
      }
      if (isIsolatedTestMode()) {
        headers['X-LearnOS-Env'] = 'test';
      }
      return fetch(url, {
        ...options,
        headers,
      });
    },
    [sessionToken]
  );

  const checkBootstrapStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/bootstrap-status', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        setIsBootstrapped(Boolean(data.isBootstrapped));
      }
    } catch {
      // Ignore network hiccup
    }
  }, [apiFetch]);

  const applyServerState = useCallback((data: any) => {
    if (data.user) setCurrentUser(data.user);
    if (data.institution) setInstitution(data.institution);
    if (Array.isArray(data.institutions)) setInstitutions(data.institutions);
    if (Array.isArray(data.academicYears)) setAcademicYears(data.academicYears);
    if (Array.isArray(data.subjects)) setSubjects(data.subjects);
    if (Array.isArray(data.topics)) setTopics(data.topics);
    if (Array.isArray(data.users)) setUsers(data.users);
    if (Array.isArray(data.classes)) setClasses(data.classes);
    if (Array.isArray(data.invitations)) setInvitations(data.invitations);
    if (Array.isArray(data.questions)) setQuestions(data.questions);
    if (Array.isArray(data.questionRevisions)) setQuestionRevisions(data.questionRevisions);
    if (Array.isArray(data.questionMedia)) setQuestionMedia(data.questionMedia);
    if (Array.isArray(data.assessments)) setAssessments(data.assessments);
    if (Array.isArray(data.assignments)) setAssignments(data.assignments);
    if (Array.isArray(data.attempts)) setAttempts(data.attempts);
    if (Array.isArray(data.gradingRecords)) setGradingRecords(data.gradingRecords);
    if (Array.isArray(data.importBatches)) setImportBatches(data.importBatches);
    if (Array.isArray(data.studentImportJobs)) setStudentImportJobs(data.studentImportJobs);
    if (Array.isArray(data.curriculumImportJobs)) setCurriculumImportJobs(data.curriculumImportJobs);
    if (Array.isArray(data.workPlans)) setWorkPlans(data.workPlans);
    if (Array.isArray(data.lessons)) setLessons(data.lessons);
    if (Array.isArray(data.masteryRecords)) setMasteryRecords(data.masteryRecords);
    if (Array.isArray(data.learningPaths)) setLearningPaths(data.learningPaths);
    if (Array.isArray(data.teacherNotes)) setTeacherNotes(data.teacherNotes);
    if (Array.isArray(data.notifications)) setNotifications(data.notifications);
    if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
    if (Array.isArray(data.studentGamificationProfiles)) {
      setStudentGamificationProfiles(data.studentGamificationProfiles);
    }
    if (Array.isArray(data.learningCheckins)) setLearningCheckins(data.learningCheckins);
    if (Array.isArray(data.studentGoals)) setStudentGoals(data.studentGoals);
    if (Array.isArray(data.learningActivityEvents)) {
      setLearningActivityEvents(data.learningActivityEvents);
    }
    if (Array.isArray(data.xpLedger)) setXpLedger(data.xpLedger);
    if (Array.isArray(data.gamificationBadges)) setGamificationBadges(data.gamificationBadges);
    if (Array.isArray(data.studentBadges)) setStudentBadges(data.studentBadges);
    if (Array.isArray(data.streakRecords)) setStreakRecords(data.streakRecords);
    if (Array.isArray(data.weeklyRecaps)) setWeeklyRecaps(data.weeklyRecaps);
    if (Array.isArray(data.classChallenges)) setClassChallenges(data.classChallenges);
    if (data.gamificationConfig) setGamificationConfig(data.gamificationConfig);
    if (Array.isArray(data.studentLessonCompletions)) {
      setStudentLessonCompletions(data.studentLessonCompletions);
    }
  }, []);

  const refreshState = useCallback(
    async (tokenOverride?: string | null) => {
      const activeTok = tokenOverride !== undefined ? tokenOverride : sessionToken;
      if (!activeTok) {
        setAuthReady(true);
        return;
      }
      try {
        const res = await apiFetch('/api/state', { method: 'GET' }, activeTok);
        if (res.ok) {
          const data = await res.json();
          applyServerState(data);
        } else if (res.status === 401 || res.status === 403) {
          setSessionToken(null);
          setCurrentUser(null);
          localStorage.removeItem('learnos_session_token');
        }
      } catch (err) {
        console.warn('State fetch error:', err);
      } finally {
        setAuthReady(true);
      }
    },
    [sessionToken, apiFetch, applyServerState]
  );

  // Initial boot: check bootstrap status & load session state
  useEffect(() => {
    checkBootstrapStatus();
    refreshState();
  }, [checkBootstrapStatus, refreshState]);

  // Real-time Server-Sent Events (SSE) subscription for multi-role synchronization
  useEffect(() => {
    if (!sessionToken || !currentUser) return;
    const testParam = isIsolatedTestMode() ? '&testEnv=1' : '';
    const es = new EventSource(
      `/api/events?token=${encodeURIComponent(sessionToken)}${testParam}`
    );

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type && parsed.type !== 'CONNECTED') {
          refreshState(sessionToken);
        }
      } catch {
        // Ignore parse error
      }
    };

    return () => {
      es.close();
    };
  }, [sessionToken, currentUser?.uid, refreshState]);

  const syncFirebaseUserWithBackend = useCallback(
    async (fbUser: FirebaseUser, inviteToken?: string): Promise<UserProfile | null> => {
      const idToken = await getIdToken(fbUser, false);
      const tokenResult = await getIdTokenResult(fbUser, false);

      const res = await apiFetch('/api/auth/firebase-sync', {
        method: 'POST',
        body: JSON.stringify({
          idToken,
          uid: fbUser.uid,
          email: fbUser.email,
          emailVerified: fbUser.emailVerified,
          displayName: fbUser.displayName,
          photoURL: fbUser.photoURL,
          customClaims: tokenResult.claims,
          inviteToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const mapped = mapFirebaseAuthError({
          code: data.code || 'auth/invalid-credential',
          message: data.error || 'Google orqali kirishda ruxsat rad etildi',
        });
        console.warn(mapped.sanitizedLog);
        setAuthError({
          ...mapped,
          userMessage: data.error || mapped.userMessage,
        });
        addToast('error', data.error || mapped.userMessage);
        return null;
      }

      if (data.activationStatus === 'pending_admin_claim') {
        setActivationPendingMessage(
          data.message || 'Hisob tasdiqlandi. Ruxsatlar faollashtirilishi kutilmoqda.'
        );
      } else {
        setActivationPendingMessage(null);
      }

      // If custom claims were provisioned/updated, force-refresh ID token and inspect new claims (Section 6)
      if (data.claimsRefreshRequired) {
        try {
          await getIdToken(fbUser, true);
          await getIdTokenResult(fbUser, false);
        } catch {
          // Non-fatal if offline during token refresh
        }
      }

      // Safely sync verified user document to Firestore with all required schema fields
      if (data.user && fbUser.email) {
        try {
          await setDoc(
            doc(db, 'users', fbUser.uid),
            {
              uid: fbUser.uid,
              displayName: data.user.displayName || fbUser.displayName || 'Foydalanuvchi',
              email: data.user.email || fbUser.email,
              role: data.user.role,
              institutionId: data.user.institutionId || 'inst-specialized-study',
              createdAt: data.user.createdAt || new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.WRITE, `users/${fbUser.uid}`);
          } catch {
            // Continue with verified backend session
          }
        }
      }

      setSessionToken(data.token);
      localStorage.setItem('learnos_session_token', data.token);
      setIsBootstrapped(true);
      await refreshState(data.token);
      return data.user;
    },
    [apiFetch, refreshState, addToast]
  );

  // Process pending mobile/redirect Google login and maintain centralized Firebase Auth listener
  useEffect(() => {
    let active = true;

    getRedirectResult(auth)
      .then(async (redirectResult) => {
        if (!active || !redirectResult || !redirectResult.user) return;
        setIsGoogleSigningIn(true);
        try {
          const pendingInvite = sessionStorage.getItem('ss_pending_invite_token') || undefined;
          sessionStorage.removeItem('ss_pending_invite_token');
          const profile = await syncFirebaseUserWithBackend(redirectResult.user, pendingInvite);
          if (profile && active) {
            addToast('success', `Xush kelibsiz, ${profile.displayName}!`);
          }
        } finally {
          if (active) setIsGoogleSigningIn(false);
        }
      })
      .catch((err) => {
        if (!active) return;
        const mapped = mapFirebaseAuthError(err);
        console.warn(mapped.sanitizedLog);
        setAuthError(mapped);
      });

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (!active || !fbUser) return;

      // If Firebase Auth already has an active Google user (e.g. after redirect or refresh)
      // and no backend session token is stored yet, automatically synchronize with backend
      const existingBackendToken = localStorage.getItem('learnos_session_token');
      if (!existingBackendToken && !googleSignInInFlightRef.current) {
        googleSignInInFlightRef.current = true;
        setIsGoogleSigningIn(true);
        try {
          const pendingInvite = sessionStorage.getItem('ss_pending_invite_token') || undefined;
          sessionStorage.removeItem('ss_pending_invite_token');
          await syncFirebaseUserWithBackend(fbUser, pendingInvite);
        } catch {
          // Handled inside syncFirebaseUserWithBackend
        } finally {
          googleSignInInFlightRef.current = false;
          if (active) setIsGoogleSigningIn(false);
        }
      }

      const syntheticDemoIds = [
        'demo-student-1',
        'demo-teacher-1',
        'demo-parent-1',
        'demo-admin-1',
      ];
      for (const synId of syntheticDemoIds) {
        try {
          await deleteDoc(doc(db, 'users', synId));
        } catch {
          // Ignore if not present or restricted
        }
      }
    });

    return () => {
      active = false;
      unsubscribeAuth();
    };
  }, [syncFirebaseUserWithBackend, addToast]);

  // Firestore real-time onSnapshot listener when Firebase Auth user is active
  useEffect(() => {
    if (!auth.currentUser || !currentUser) return;
    const uid = auth.currentUser.uid;
    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('recipientUid', '==', uid)),
      (snapshot) => {
        if (!snapshot.empty) {
          const fsNotifs = snapshot.docs.map((d) => d.data() as AppNotification);
          setNotifications((prev) => {
            const byId = new Map(prev.map((n) => [n.id, n]));
            for (const fn of fsNotifs) byId.set(fn.id, fn);
            return Array.from(byId.values());
          });
        }
      },
      (err) => {
        console.warn('Firestore notification listener info:', err.message);
      }
    );

    return () => unsubNotifs();
  }, [currentUser?.uid]);

  const bootstrapInitialAdmin = useCallback(
    async (payload: {
      displayName: string;
      email: string;
      password: string;
      institutionName: string;
      region: string;
      district: string;
      academicYear: string;
    }): Promise<UserProfile> => {
      const res = await apiFetch('/api/auth/bootstrap', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Boshlang'ich administrator yaratishda xatolik");
      }

      setSessionToken(data.token);
      localStorage.setItem('learnos_session_token', data.token);
      setIsBootstrapped(true);
      await refreshState(data.token);
      addToast('success', 'Specialized Study va administrator hisobi muvaffaqiyatli faollashtirildi!');
      return data.user;
    },
    [apiFetch, refreshState, addToast]
  );

  const loginWithPassword = useCallback(
    async (email: string, password: string): Promise<UserProfile> => {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kirishda xatolik yuz berdi');
      }

      setSessionToken(data.token);
      localStorage.setItem('learnos_session_token', data.token);
      await refreshState(data.token);
      addToast('success', `Xush kelibsiz, ${data.user.displayName}!`);
      return data.user;
    },
    [apiFetch, refreshState, addToast]
  );

  const registerWithInvitation = useCallback(
    async (payload: {
      displayName: string;
      email: string;
      password: string;
      inviteToken: string;
    }): Promise<UserProfile> => {
      const res = await apiFetch('/api/auth/register-with-invite', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ro'yxatdan o'tishda xatolik");
      }

      setSessionToken(data.token);
      localStorage.setItem('learnos_session_token', data.token);
      await refreshState(data.token);
      addToast('success', 'Taklifnoma tasdiqlandi va hisobingiz faollashtirildi!');
      return data.user;
    },
    [apiFetch, refreshState, addToast]
  );

  const previewInvitationToken = useCallback(
    async (token: string) => {
      const clean = String(token || '').trim();
      if (!clean) return null;
      try {
        const res = await apiFetch(
          `/api/invitations/preview/${encodeURIComponent(clean)}`,
          { method: 'GET' }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return {
          role: data.role as UserRole,
          institutionName: String(data.institutionName || 'Specialized Study'),
          className: data.className ? String(data.className) : null,
          email:
            data.email && data.email !== 'invite@learnos.uz'
              ? String(data.email)
              : undefined,
          subject: data.subject ? String(data.subject) : undefined,
        };
      } catch {
        return null;
      }
    },
    [apiFetch]
  );

  const loginWithGoogle = useCallback(
    async (
      inviteOrOptions?:
        | string
        | { forceRedirect?: boolean; preferPopup?: boolean; inviteToken?: string; redirectPath?: string },
      options?: { forceRedirect?: boolean; preferPopup?: boolean; redirectPath?: string }
    ): Promise<UserProfile | null> => {
      if (googleSignInInFlightRef.current) {
        return null;
      }
      googleSignInInFlightRef.current = true;
      setIsGoogleSigningIn(true);
      setAuthError(null);
      setActivationPendingMessage(null);

      const inviteToken =
        typeof inviteOrOptions === 'string'
          ? inviteOrOptions.trim() || undefined
          : inviteOrOptions?.inviteToken?.trim() || undefined;
      const forceRedirect =
        (typeof inviteOrOptions === 'object' && inviteOrOptions?.forceRedirect === true) ||
        options?.forceRedirect === true;
      const preferPopup =
        (typeof inviteOrOptions === 'object' && inviteOrOptions?.preferPopup === true) ||
        options?.preferPopup === true;

      try {
        const provider = createGoogleAuthProvider();
        const useRedirect =
          forceRedirect || (!preferPopup && isMobileOrTouchRedirectPreferred() && forceRedirect);

        if (useRedirect) {
          if (inviteToken) {
            sessionStorage.setItem('ss_pending_invite_token', inviteToken);
          }
          await signInWithRedirect(auth, provider);
          return null;
        }

        try {
          const result = await signInWithPopup(auth, provider);
          const fbUser = result.user;
          const syncedUser = await syncFirebaseUserWithBackend(fbUser, inviteToken);
          if (syncedUser) {
            addToast('success', `Xush kelibsiz, ${syncedUser.displayName}!`);
          }
          return syncedUser;
        } catch (popupErr) {
          const popupMapped = mapFirebaseAuthError(popupErr);
          // On mobile browsers where popups are blocked or unsupported, automatically fall back to signInWithRedirect
          if (
            isMobileOrTouchRedirectPreferred() &&
            (popupMapped.code === 'auth/popup-blocked' ||
              popupMapped.code === 'auth/operation-not-supported-in-this-environment')
          ) {
            if (inviteToken) {
              sessionStorage.setItem('ss_pending_invite_token', inviteToken);
            }
            await signInWithRedirect(auth, provider);
            return null;
          }
          throw popupErr;
        }
      } catch (error) {
        const mapped = mapFirebaseAuthError(error);
        console.warn(mapped.sanitizedLog);
        setAuthError(mapped);
        addToast('error', mapped.userMessage, mapped.recoveryAction);
        return null;
      } finally {
        googleSignInInFlightRef.current = false;
        setIsGoogleSigningIn(false);
      }
    },
    [syncFirebaseUserWithBackend, addToast]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network hiccup during logout
    }
    try {
      if (auth.currentUser) {
        await firebaseSignOut(auth);
      }
    } catch {
      // Ignore
    }
    setCurrentUser(null);
    setSessionToken(null);
    setAuthError(null);
    setActivationPendingMessage(null);
    localStorage.removeItem('learnos_session_token');
    addToast('info', 'Tizimdan chiqdingiz');
  }, [apiFetch, addToast]);

  const createClassRoom = useCallback(
    async (
      name: string,
      grade: number,
      subject: string,
      teacherId?: string
    ): Promise<ClassRoom> => {
      const res = await apiFetch('/api/classes', {
        method: 'POST',
        body: JSON.stringify({ name, grade, subject, teacherId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sinf yaratishda xatolik');

      if (auth.currentUser) {
        try {
          await setDoc(doc(db, 'classes', data.classRoom.id), {
            id: data.classRoom.id,
            name: data.classRoom.name,
            grade: data.classRoom.grade,
            subject: data.classRoom.subject,
            teacherId: data.classRoom.teacherId,
            institutionId: data.classRoom.institutionId,
            inviteCode: data.classRoom.inviteCode,
            studentCount: data.classRoom.studentCount,
            createdAt: data.classRoom.createdAt,
          });
        } catch {
          // Handled via server sync
        }
      }

      await refreshState();
      addToast(
        'success',
        `"${data.classRoom.name}" sinfi faollashtirildi`,
        `Taklif kodi: ${data.classRoom.inviteCode}`
      );
      return data.classRoom;
    },
    [apiFetch, refreshState, addToast]
  );

  const updateClassRoom = useCallback(
    async (classId: string, updates: Partial<ClassRoom>) => {
      const res = await apiFetch(`/api/classes/${classId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sinfni yangilashda xatolik');
      await refreshState();
      addToast('success', 'Sinf ma’lumotlari saqlandi');
    },
    [apiFetch, refreshState, addToast]
  );

  const removeStudentFromClass = useCallback(
    async (classId: string, studentId: string) => {
      const res = await apiFetch(`/api/classes/${classId}/students/${studentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'O‘quvchini sinfdan chiqarishda xatolik');
      }
      await refreshState();
      addToast('info', 'O‘quvchi sinfdan chiqarildi');
    },
    [apiFetch, refreshState, addToast]
  );

  const createInvitation = useCallback(
    async (payload: {
      inviteeName?: string;
      email?: string;
      role: UserRole;
      classId?: string;
      subject?: string;
      linkedStudentId?: string;
      expiresInHours?: number;
    }) => {
      const res = await apiFetch('/api/invitations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Taklifnoma yaratishda xatolik');
      await refreshState();
      addToast(
        'success',
        `Taklifnoma yaratildi: ${data.rawToken}`,
        `${payload.inviteeName || payload.role} uchun bir martalik taklif kodi tayyor`
      );
      return data;
    },
    [apiFetch, refreshState, addToast]
  );

  const importStudentsCSV = useCallback(
    async (
      csvTextOrRows: string | Array<{ displayName: string; email?: string; className?: string }>,
      defaultClassId?: string
    ) => {
      const bodyPayload = Array.isArray(csvTextOrRows)
        ? { rows: csvTextOrRows, defaultClassId }
        : { csvText: csvTextOrRows, defaultClassId };
      const res = await apiFetch('/api/invitations/bulk-csv', {
        method: 'POST',
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'CSV import xatoligi');
      await refreshState();
      addToast('success', `${data.createdCount} ta o‘quvchi taklifnomasi yaratildi`);
      return data;
    },
    [apiFetch, refreshState, addToast]
  );

  const revokeInvitation = useCallback(
    async (invitationId: string) => {
      const res = await apiFetch(`/api/invitations/${invitationId}/revoke`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Taklifnomani bekor qilishda xatolik');
      }
      await refreshState();
      addToast('info', 'Taklifnoma bekor qilindi');
    },
    [apiFetch, refreshState, addToast]
  );

  const addUserByAdmin = useCallback(
    async (
      displayName: string,
      email: string,
      role: UserRole,
      classId?: string,
      password?: string,
      classCode?: string
    ): Promise<UserProfile> => {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({ displayName, email, role, classId, password, classCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Foydalanuvchi qo'shishda xatolik");
      }
      await refreshState();
      addToast('success', `${data.user.displayName} muvaffaqiyatli qo'shildi`);
      return data.user;
    },
    [apiFetch, refreshState, addToast]
  );

  const updateUserAdmin = useCallback(
    async (
      uid: string,
      updates: {
        status?: StudentAccountStatus;
        classId?: string;
        classCode?: string;
        displayName?: string;
        firstName?: string;
        lastName?: string;
        patronymic?: string;
        email?: string;
        studentCode?: string;
        assignedClassIds?: string[];
        subject?: string;
      }
    ) => {
      const res = await apiFetch(`/api/users/${uid}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Foydalanuvchi ma’lumotlarini yangilashda xatolik');
      }
      await refreshState();
      addToast('success', "Ma'lumotlar yangilandi");
    },
    [apiFetch, refreshState, addToast]
  );

  const previewStudentExcelImport = useCallback(
    async (payload: {
      fileName: string;
      base64Data?: string;
      csvText?: string;
      selectedSheet?: string;
      selectedHeaderRowIndex?: number;
      columnMappingOverride?: StudentImportColumnMapping;
      rowClassOverrides?: Record<number, string>;
      rowFieldOverrides?: Record<number, Record<string, string>>;
    }): Promise<StudentImportPreviewResult> => {
      const res = await apiFetch('/api/students/import/preview', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Excel faylni ko'rib chiqishda xatolik");
      }
      return data;
    },
    [apiFetch]
  );

  const confirmStudentExcelImport = useCallback(
    async (payload: {
      jobId: string;
      fileName: string;
      duplicatePolicy?: 'skip_existing' | 'update_existing';
      rows?: StudentImportRowPreview[];
      base64Data?: string;
      csvText?: string;
      selectedSheet?: string;
      selectedHeaderRowIndex?: number;
      columnMappingOverride?: StudentImportColumnMapping;
      rowClassOverrides?: Record<number, string>;
      rowFieldOverrides?: Record<number, Record<string, string>>;
    }) => {
      const res = await apiFetch('/api/students/import/confirm', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "O'quvchilarni saqlashda xatolik");
      }
      await refreshState();
      addToast(
        'success',
        `${data.importedCount} ta o'quvchi muvaffaqiyatli yuklandi`,
        data.skippedCount > 0 ? `${data.skippedCount} ta takroriy qator o'tkazib yuborildi` : undefined
      );
      return data;
    },
    [apiFetch, refreshState, addToast]
  );

  const rollbackStudentImportJob = useCallback(
    async (jobId: string) => {
      const res = await apiFetch(`/api/students/import/${encodeURIComponent(jobId)}/rollback`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Importni bekor qilishda xatolik');
      }
      await refreshState();
      addToast(
        'info',
        'Import bekor qilindi',
        `O'chirildi: ${data.removedCount} ta, Arxivlandi: ${data.archivedCount} ta`
      );
      return data;
    },
    [apiFetch, refreshState, addToast]
  );

  const executeBulkStudentAction = useCallback(
    async (payload: {
      action: 'change_class' | 'send_invite' | 'archive' | 'suspend' | 'activate';
      studentUids: string[];
      targetClassCode?: string;
    }) => {
      const res = await apiFetch('/api/students/bulk-action', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ommaviy amalni bajarishda xatolik');
      }
      await refreshState();
      addToast('success', 'Tanlangan o‘quvchilar uchun amal bajarildi');
      return data;
    },
    [apiFetch, refreshState, addToast]
  );

  const searchGlobal = useCallback(
    async (queryText: string): Promise<GlobalSearchResultItem[]> => {
      const q = String(queryText || '').trim();
      if (!q) return [];
      const res = await apiFetch(`/api/search?q=${encodeURIComponent(q)}`, { method: 'GET' });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.results) ? data.results : [];
    },
    [apiFetch]
  );

  const fetchCalendarEvents = useCallback(
    async (filters?: {
      classCode?: string;
      subject?: string;
      type?: string;
    }): Promise<CalendarEventItem[]> => {
      const params = new URLSearchParams();
      if (filters?.classCode) params.set('classCode', filters.classCode);
      if (filters?.subject) params.set('subject', filters.subject);
      if (filters?.type) params.set('type', filters.type);
      const qs = params.toString();
      const res = await apiFetch(`/api/calendar${qs ? `?${qs}` : ''}`, { method: 'GET' });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.events) ? data.events : [];
    },
    [apiFetch]
  );

  const createSubject = useCallback(
    async (
      nameOrPayload:
        | string
        | {
            name: string;
            code?: string;
            track?: 'A' | 'T' | 'BOTH';
            grades?: number[];
            applicableClassCodes?: OfficialClassCode[];
            description?: string;
          },
      grade?: number,
      description?: string
    ) => {
      const payload =
        typeof nameOrPayload === 'string'
          ? { name: nameOrPayload, grade: grade || 8, description: description || '' }
          : nameOrPayload;

      const res = await apiFetch('/api/subjects', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fan qo‘shishda xatolik');
      }
      await refreshState();
      addToast('success', `"${payload.name}" fani qo‘shildi`);
    },
    [apiFetch, refreshState, addToast]
  );

  const updateSubject = useCallback(
    async (subjectId: string, updates: Partial<SubjectItem>) => {
      const res = await apiFetch(`/api/subjects/${subjectId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fan ma’lumotlarini yangilashda xatolik');
      }
      await refreshState();
      addToast('success', 'Fan ma’lumotlari saqlandi');
    },
    [apiFetch, refreshState, addToast]
  );

  const createTopic = useCallback(
    async (
      nameOrPayload:
        | string
        | {
            name: string;
            subject: string;
            grade: number;
            description: string;
            unit?: string;
            quarter?: 1 | 2 | 3 | 4;
            classCode?: OfficialClassCode;
          },
      subject?: string,
      grade?: number,
      description?: string
    ) => {
      const payload =
        typeof nameOrPayload === 'string'
          ? {
              name: nameOrPayload,
              subject: subject || 'Matematika',
              grade: grade || 8,
              description: description || '',
            }
          : nameOrPayload;

      const res = await apiFetch('/api/topics', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Mavzu qo‘shishda xatolik');
      }
      await refreshState();
      addToast('success', `"${payload.name}" mavzusi qo‘shildi`);
    },
    [apiFetch, refreshState, addToast]
  );

  const analyzeWorkPlan = useCallback(
    async (payload: {
      fileName: string;
      base64Data?: string;
      rawText?: string;
      classId?: string;
      classCode?: string;
      subject: string;
      academicYear?: string;
      quarter?: number;
      planType?: WorkPlanType;
    }) => {
      const res = await apiFetch('/api/work-plans/analyze', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ish rejani tahlil qilishda xatolik');
      }
      return data;
    },
    [apiFetch]
  );

  const confirmWorkPlan = useCallback(
    async (payload: {
      title?: string;
      fileName?: string;
      sourceType?: string;
      classId?: string;
      classCode?: string;
      subject: string;
      academicYear?: string;
      quarter?: number;
      planType?: WorkPlanType;
      rows: WorkPlanRowItem[];
      publishImmediately?: boolean;
    }) => {
      const res = await apiFetch('/api/work-plans/confirm', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ish rejani saqlashda xatolik');
      }
      await refreshState();
      addToast(
        'success',
        `"${data.workPlan.title}" ish rejasi tasdiqlandi`,
        `${data.createdLessonsCount} ta dars va ${data.createdTopicsCount} ta yangi mavzu o‘quv xaritasiga qo‘shildi`
      );
      return data;
    },
    [apiFetch, refreshState, addToast]
  );

  const deleteWorkPlan = useCallback(
    async (workPlanId: string) => {
      const res = await apiFetch(`/api/work-plans/${workPlanId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Ish rejani o‘chirishda xatolik');
      }
      await refreshState();
      addToast('info', 'Ish rejasi o‘chirildi');
    },
    [apiFetch, refreshState, addToast]
  );

  const createLesson = useCallback(
    async (payload: Partial<LessonItem>): Promise<LessonItem> => {
      const res = await apiFetch('/api/lessons', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Dars yaratishda xatolik');
      }
      await refreshState();
      addToast('success', `"${data.lesson.topicTitle}" darsi qo‘shildi`);
      return data.lesson;
    },
    [apiFetch, refreshState, addToast]
  );

  const updateLesson = useCallback(
    async (lessonId: string, updates: Partial<LessonItem>): Promise<LessonItem> => {
      const res = await apiFetch(`/api/lessons/${lessonId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Darsni yangilashda xatolik');
      }
      await refreshState();
      addToast('success', 'Dars ma’lumotlari saqlandi');
      return data.lesson;
    },
    [apiFetch, refreshState, addToast]
  );

  const deleteLesson = useCallback(
    async (lessonId: string) => {
      const res = await apiFetch(`/api/lessons/${lessonId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Darsni o‘chirishda xatolik');
      }
      await refreshState();
      addToast('info', 'Dars o‘chirildi');
    },
    [apiFetch, refreshState, addToast]
  );

  const generateAITest = useCallback(
    async (payload: {
      classId?: string;
      classCode?: string;
      subject?: string;
      topicName?: string;
      topicId?: string;
      lessonId?: string;
      questionCount?: number;
      difficulty?: string;
      quarter?: number;
      title?: string;
    }) => {
      const res = await apiFetch('/api/ai/generate-test', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI test yaratishda xatolik');
      }
      await refreshState();
      addToast(
        'success',
        `AI qoralama test yaratdi (${data.questions.length} ta savol)`,
        `"${data.assessment.title}" — ko‘rib chiqib nashr qilishingiz mumkin`
      );
      return data;
    },
    [apiFetch, refreshState, addToast]
  );

  const executeAICommand = useCallback(
    async (commandText: string): Promise<AICommandExecutionResult> => {
      const res = await apiFetch('/api/ai/command', {
        method: 'POST',
        body: JSON.stringify({ commandText }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI buyrug‘ini bajarishda xatolik');
      }
      await refreshState();
      addToast('success', 'AI buyrug‘i bajarildi', data.result.summary);
      return data.result;
    },
    [apiFetch, refreshState, addToast]
  );

  const createQuestion = useCallback(
    async (
      item: Omit<QuestionItem, 'id' | 'institutionId' | 'authorId' | 'createdAt'>
    ): Promise<QuestionItem> => {
      const res = await apiFetch('/api/questions', {
        method: 'POST',
        body: JSON.stringify(item),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Savol saqlashda xatolik');
      await refreshState();
      addToast(
        'success',
        data.question.status === 'draft'
          ? 'Savol qoralama sifatida saqlandi'
          : 'Yangi savol savollar bazasiga qo‘shildi'
      );
      return data.question;
    },
    [apiFetch, refreshState, addToast]
  );

  const updateQuestion = useCallback(
    async (questionId: string, updates: Partial<QuestionItem>) => {
      const res = await apiFetch(`/api/questions/${questionId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Savolni yangilashda xatolik');
      }
      await refreshState();
      addToast('success', 'Savol yangilandi');
    },
    [apiFetch, refreshState, addToast]
  );

  const deleteQuestion = useCallback(
    async (questionId: string) => {
      const res = await apiFetch(`/api/questions/${questionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Savolni o‘chirishda xatolik');
      }
      await refreshState();
      addToast('info', 'Savol o‘chirildi');
    },
    [apiFetch, refreshState, addToast]
  );

  const createAssessment = useCallback(
    async (
      payload: Omit<Assessment, 'id' | 'teacherId' | 'institutionId' | 'createdAt'>
    ): Promise<Assessment> => {
      const res = await apiFetch('/api/assessments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test yaratishda xatolik');
      await refreshState();
      addToast(
        'success',
        data.assessment.status === 'published'
          ? `"${data.assessment.title}" testi chop etildi va sinfga biriktirildi`
          : `"${data.assessment.title}" qoralama sifatida saqlandi`
      );
      return data.assessment;
    },
    [apiFetch, refreshState, addToast]
  );

  const updateAssessment = useCallback(
    async (assessmentId: string, updates: Partial<Assessment>) => {
      const res = await apiFetch(`/api/assessments/${assessmentId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Testni yangilashda xatolik');
      }
      await refreshState();
      addToast('success', 'Test holati yangilandi');
    },
    [apiFetch, refreshState, addToast]
  );

  const createAssignment = useCallback(
    async (payload: {
      assessmentId: string;
      classId: string;
      dueDate: string;
    }): Promise<Assignment> => {
      const res = await apiFetch('/api/assignments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Topshiriq biriktirishda xatolik');
      }
      await refreshState();
      addToast('success', 'Topshiriq sinfga muvaffaqiyatli biriktirildi');
      return data.assignment;
    },
    [apiFetch, refreshState, addToast]
  );

  const updateAssignmentStatus = useCallback(
    async (assignmentId: string, status: 'published' | 'closed', dueDate?: string) => {
      const res = await apiFetch(`/api/assignments/${assignmentId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, dueDate }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Topshiriq holatini yangilashda xatolik');
      }
      await refreshState();
      addToast(
        'success',
        status === 'closed' ? 'Topshiriq yopildi' : 'Topshiriq qayta faollashtirildi'
      );
    },
    [apiFetch, refreshState, addToast]
  );

  const submitAssessmentAttempt = useCallback(
    async (
      assessmentId: string,
      submittedMap: Record<string, string>
    ): Promise<AssessmentAttempt> => {
      const res = await apiFetch('/api/assessments/submit', {
        method: 'POST',
        body: JSON.stringify({ assessmentId, submittedMap }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Test natijasini saqlashda xatolik');
      }

      if (auth.currentUser) {
        try {
          await setDoc(doc(db, 'assessment_attempts', data.attempt.id), {
            id: data.attempt.id,
            assessmentId: data.attempt.assessmentId,
            studentId: auth.currentUser.uid,
            classId: data.attempt.classId,
            institutionId: data.attempt.institutionId,
            scorePercent: data.attempt.scorePercent,
            correctCount: data.attempt.correctCount,
            totalQuestions: data.attempt.totalQuestions,
            status: 'completed',
            submittedAt: data.attempt.submittedAt,
          });
        } catch {
          // Handled via server persistence
        }
      }

      await refreshState();
      addToast(
        'success',
        `Test yakunlandi: ${data.attempt.scorePercent}%`,
        `${data.attempt.correctCount}/${data.attempt.totalQuestions} ta to'g'ri javob`
      );
      return data.attempt;
    },
    [apiFetch, refreshState, addToast]
  );

  const generateAttemptAIAnalysis = useCallback(
    async (attemptId: string): Promise<AIAnalysisResult> => {
      const attempt = attempts.find((a) => a.id === attemptId);
      if (!attempt) {
        throw new Error('Test urinishi topilmadi');
      }

      const res = await apiFetch('/api/ai/analyze-attempt', {
        method: 'POST',
        body: JSON.stringify({
          attemptId: attempt.id,
          assessmentTitle: attempt.assessmentTitle,
          scorePercent: attempt.scorePercent,
          topicBreakdown: attempt.topicBreakdown,
          answers: attempt.answers,
        }),
      });

      if (!res.ok) {
        throw new Error('AI tahlil xizmati vaqtincha javob bermadi');
      }

      const analysis: AIAnalysisResult = await res.json();
      await refreshState();
      addToast('success', 'Diagnostik AI tahlili yangilandi');
      return analysis;
    },
    [attempts, apiFetch, refreshState, addToast]
  );

  const updateLearningPathStepStatus = useCallback(
    async (pathId: string, stepNumber: number, status: LearningPathStepStatus) => {
      const res = await apiFetch(`/api/learning-paths/${pathId}/steps`, {
        method: 'PUT',
        body: JSON.stringify({ stepNumber, status }),
      });
      if (!res.ok) {
        throw new Error('O‘quv yo‘li holatini saqlashda xatolik');
      }
      await refreshState();
      addToast('success', 'O‘quv bosqichi holati saqlandi');
    },
    [apiFetch, refreshState, addToast]
  );

  const addTeacherNote = useCallback(
    async (studentId: string, content: string) => {
      const res = await apiFetch('/api/teacher-notes', {
        method: 'POST',
        body: JSON.stringify({ studentId, content }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Qaydni saqlashda xatolik');
      }
      await refreshState();
      addToast('success', "Ma'muriyat qaydi saqlandi");
    },
    [apiFetch, refreshState, addToast]
  );

  const linkChildByCode = useCallback(
    async (studentCode: string): Promise<boolean> => {
      const res = await apiFetch('/api/parent/link-child', {
        method: 'POST',
        body: JSON.stringify({ studentCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast('error', data.error || 'Bunday kodli o‘quvchi topilmadi');
        return false;
      }
      await refreshState();
      addToast('success', `${data.student.displayName} farzandlar ro‘yxatiga ulandi`);
      return true;
    },
    [apiFetch, refreshState, addToast]
  );

  const updateInstitutionSettings = useCallback(
    async (
      name: string,
      region: string,
      district: string,
      academicYear?: string,
      allowTeacherStudentInvites?: boolean
    ) => {
      const res = await apiFetch(`/api/institutions/${institution.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name,
          region,
          district,
          academicYear,
          allowTeacherStudentInvites,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Sozlamalarni saqlashda xatolik');
      }
      await refreshState();
      addToast('success', 'Muassasa sozlamalari saqlandi');
    },
    [institution.id, apiFetch, refreshState, addToast]
  );

  const createInstitution = useCallback(
    async (
      payload: Partial<Institution> & {
        name: string;
        initialClasses?: Array<{ name: string; grade: number; subject: string }>;
      }
    ): Promise<Institution> => {
      const res = await apiFetch('/api/admin/institutions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Muassasa yaratishda xatolik');
      }
      await refreshState();
      addToast('success', `"${data.institution.name}" muassasasi yaratildi`);
      return data.institution;
    },
    [apiFetch, refreshState, addToast]
  );

  const updateInstitutionFull = useCallback(
    async (id: string, updates: Partial<Institution>): Promise<Institution> => {
      const endpoint = isPlatformOwner
        ? `/api/admin/institutions/${id}`
        : `/api/institutions/${id}`;
      const res = await apiFetch(endpoint, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Muassasa ma’lumotlarini saqlashda xatolik');
      }
      await refreshState();
      addToast('success', `"${data.institution.name}" ma’lumotlari saqlandi`);
      return data.institution;
    },
    [isPlatformOwner, apiFetch, refreshState, addToast]
  );

  const changeInstitutionStatus = useCallback(
    async (
      id: string,
      status: 'active' | 'suspended' | 'archived' | 'onboarding',
      reason?: string
    ): Promise<Institution> => {
      const res = await apiFetch(`/api/admin/institutions/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Muassasa holatini o‘zgartirishda xatolik');
      }
      await refreshState();
      addToast('success', `Muassasa holati "${status}" ga o‘zgartirildi`);
      return data.institution;
    },
    [apiFetch, refreshState, addToast]
  );

  const switchActiveInstitution = useCallback(
    async (institutionId: string) => {
      const res = await apiFetch('/api/admin/switch-institution', {
        method: 'POST',
        body: JSON.stringify({ institutionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Muassasani almashtirishda xatolik');
      }
      await refreshState();
      addToast('info', `Faol muassasa: ${data.institution.name}`);
    },
    [apiFetch, refreshState, addToast]
  );

  const createAcademicYear = useCallback(
    async (payload: {
      name: string;
      startDate: string;
      endDate: string;
      isCurrent?: boolean;
    }): Promise<AcademicYearItem> => {
      const res = await apiFetch('/api/admin/academic-years', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "O'quv yili yaratishda xatolik");
      }
      await refreshState();
      addToast('success', `"${data.academicYear.name}" o'quv yili qo'shildi`);
      return data.academicYear;
    },
    [apiFetch, refreshState, addToast]
  );

  const uploadMediaFile = useCallback(
    async (payload: {
      fileName: string;
      base64Data?: string;
      dataUrl?: string;
      institutionId?: string;
      assessmentId?: string;
      questionId?: string;
      width?: number;
      height?: number;
    }): Promise<QuestionMedia> => {
      const res = await apiFetch('/api/media/upload', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Rasm yuklashda xatolik');
      }
      await refreshState();
      addToast('success', `"${data.media.fileName}" muvaffaqiyatli yuklandi`);
      return data.media;
    },
    [apiFetch, refreshState, addToast]
  );

  const validateImportPackage = useCallback(
    async (fileName: string, base64Data: string, institutionId?: string) => {
      const res = await apiFetch('/api/import/validate', {
        method: 'POST',
        body: JSON.stringify({ fileName, base64Data, institutionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Import faylini tekshirishda xatolik');
      }
      return data;
    },
    [apiFetch]
  );

  const confirmImportPackage = useCallback(
    async (payload: {
      fileName: string;
      base64Data: string;
      institutionId?: string;
      classId?: string;
      importMode?: 'draft_assessment' | 'question_bank_only' | 'assessment_and_bank';
      duplicatePolicy?: 'skip_existing' | 'import_new_only' | 'update_existing';
    }) => {
      const res = await apiFetch('/api/import/confirm', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Importni tasdiqlashda xatolik');
      }
      await refreshState();
      addToast(
        'success',
        `Import yakunlandi: ${data.importedCount} yangi, ${data.updatedCount} yangilangan savol`,
        data.assessment ? `Qoralama test yaratildi: "${data.assessment.title}"` : undefined
      );
      return data;
    },
    [apiFetch, refreshState, addToast]
  );

  const suggestWrittenGrade = useCallback(
    async (payload: {
      prompt: string;
      rubricText?: string;
      studentAnswer: string;
      maxPoints?: number;
    }) => {
      const res = await apiFetch('/api/ai/suggest-written-grade', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI tavsiyasini olishda xatolik');
      }
      return data;
    },
    [apiFetch]
  );

  const confirmWrittenGrade = useCallback(
    async (
      attemptId: string,
      payload: {
        questionId: string;
        awardedPoints: number;
        feedback: string;
        aiSuggestedPoints?: number;
        aiSuggestedFeedback?: string;
      }
    ): Promise<AssessmentAttempt> => {
      const res = await apiFetch(`/api/attempts/${attemptId}/grade-answer`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Yozma javobni baholashda xatolik');
      }
      await refreshState();
      addToast(
        'success',
        `Yozma javob baholandi (${payload.awardedPoints} ball)`,
        `Yangi umumiy natija: ${data.attempt.scorePercent}%`
      );
      return data.attempt;
    },
    [apiFetch, refreshState, addToast]
  );

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      await apiFetch(`/api/notifications/${notificationId}/read`, { method: 'PUT' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    },
    [apiFetch]
  );

  const previewCurriculumZipArchive = useCallback(
    async (payload?: {
      useOfficialAttachedArchive?: boolean;
      base64Data?: string;
      fileName?: string;
    }): Promise<CurriculumZipImportPreview> => {
      const res = await apiFetch('/api/curriculum-zip/preview', {
        method: 'POST',
        body: JSON.stringify(payload || { useOfficialAttachedArchive: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ZIP o‘quv rejasini tekshirishda xatolik');
      }
      return data.preview;
    },
    [apiFetch]
  );

  const confirmCurriculumZipArchive = useCallback(
    async (payload: {
      jobId?: string;
      useOfficialAttachedArchive?: boolean;
      base64Data?: string;
      fileName?: string;
      academicYear?: string;
      tTrackVisibilityApproved?: boolean;
      publishImmediately?: boolean;
      duplicatePolicy?: 'skip_existing' | 'update_existing';
    }) => {
      const res = await apiFetch('/api/curriculum-zip/confirm', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ZIP o‘quv rejasini saqlashda xatolik');
      }
      await refreshState();
      addToast(
        'success',
        `O‘quv reja saqlandi (${data.totalWorkbooks} ta fayl)`,
        `${data.importedLessonsCount} yangi, ${data.updatedLessonsCount} yangilangan dars`
      );
      return data;
    },
    [apiFetch, refreshState, addToast]
  );

  const updateTTrackMathVisibility = useCallback(
    async (
      approvedOrPayload:
        | boolean
        | { tTrackVisibilityApproved: boolean; publishLessons?: boolean }
    ) => {
      const payload =
        typeof approvedOrPayload === 'boolean'
          ? { tTrackVisibilityApproved: approvedOrPayload }
          : approvedOrPayload;
      const res = await apiFetch('/api/curriculum-zip/t-track-visibility', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'T-yo‘nalish ko‘rinishini yangilashda xatolik');
      }
      await refreshState();
      addToast(
        'success',
        payload.tTrackVisibilityApproved
          ? "T-yo'nalish Matematika o'quv rejasi o'quvchilar uchun faollashtirildi"
          : "T-yo'nalish Matematika o'quv rejasi yashirildi"
      );
      return data;
    },
    [apiFetch, refreshState, addToast]
  );

  const bulkUpdateLessonsStatus = useCallback(
    async (
      lessonIdsOrPayload:
        | string[]
        | {
            lessonIds?: string[];
            workPlanId?: string;
            classCode?: string;
            quarter?: number;
            curriculumArea?: string;
            status: LessonStatus;
          },
      statusArg?: LessonStatus
    ) => {
      const payload = Array.isArray(lessonIdsOrPayload)
        ? { lessonIds: lessonIdsOrPayload, status: statusArg || 'published' }
        : lessonIdsOrPayload;
      const res = await apiFetch('/api/lessons/bulk-status', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Darslar holatini yangilashda xatolik');
      }
      await refreshState();
      addToast('success', `${data.updatedCount} ta dars holati yangilandi`);
      return data;
    },
    [apiFetch, refreshState, addToast]
  );

  const generateLessonAssessment = useCallback(
    async (
      lessonId: string,
      payload: {
        questionCount?: number;
        difficulty?: QuestionDifficulty;
        questionTypes?: QuestionType[];
        maxPoints?: number;
        durationMinutes?: number;
        referenceText?: string;
        title?: string;
        publishImmediately?: boolean;
      }
    ) => {
      const res = await apiFetch(`/api/lessons/${encodeURIComponent(lessonId)}/generate-test`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Dars asosida test yaratishda xatolik');
      }
      await refreshState();
      addToast(
        'success',
        `Test yaratildi: "${data.assessment.title}"`,
        `${data.questions.length} ta savol shakllantirildi`
      );
      return data;
    },
    [apiFetch, refreshState, addToast]
  );

  const batchGenerateLessonAssessments = useCallback(
    async (payload: {
      lessonIds: string[];
      title?: string;
      questionCount?: number;
      difficulty?: QuestionDifficulty;
      questionTypes?: QuestionType[];
      durationMinutes?: number;
      maxPoints?: number;
      referenceText?: string;
      publishImmediately?: boolean;
    }) => {
      const res = await apiFetch('/api/lessons/batch-generate-tests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Tanlangan darslar uchun test yaratishda xatolik');
      }
      await refreshState();
      addToast(
        'success',
        `Umumlashgan test yaratildi: "${data.assessment?.title || 'Test'}"`,
        "Testlar bo'limida ko'rib chiqib boshqarishingiz mumkin"
      );
      return data;
    },
    [apiFetch, refreshState, addToast]
  );

  const submitDailyCheckin = useCallback(
    async (payload: {
      selectedSubject: string;
      selectedGoal: string;
      completionState?: 'active' | 'completed';
    }) => {
      const res = await apiFetch('/api/student/checkin', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Maqsadni belgilashda xatolik');
      await refreshState();
      const xp = data.gamification?.xpAwarded || 0;
      addToast(
        'success',
        'Bugungi maqsading belgilandi!',
        xp > 0 ? `+${xp} XP qo'shildi` : `${payload.selectedSubject}: ${payload.selectedGoal}`
      );
      return data;
    },
    [apiFetch, refreshState, addToast]
  );

  const completeStudentLesson = useCallback(
    async (lessonId: string, practiceCompleted?: boolean) => {
      const res = await apiFetch(`/api/student/lessons/${encodeURIComponent(lessonId)}/complete`, {
        method: 'POST',
        body: JSON.stringify({ practiceCompleted }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Darsni yakunlashda xatolik');
      await refreshState();
      const xp = data.gamification?.xpAwarded || 0;
      const newBadges = data.gamification?.newlyEarnedBadges || [];
      if (newBadges.length > 0) {
        addToast(
          'success',
          `Yangi nishon: ${newBadges[0].title}!`,
          xp > 0 ? `+${xp} XP va yangi yutuq qo'lga kiritildi` : newBadges[0].description
        );
      } else {
        addToast(
          'success',
          'Dars muvaffaqiyatli yakunlandi!',
          xp > 0 ? `+${xp} XP hisobingizga qo'shildi` : undefined
        );
      }
      return data;
    },
    [apiFetch, refreshState, addToast]
  );

  const completeStudentLessonPractice = useCallback(
    async (lessonId: string) => {
      const res = await apiFetch(`/api/student/lessons/${encodeURIComponent(lessonId)}/practice`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mashqni tasdiqlashda xatolik');
      await refreshState();
      const xp = data.gamification?.xpAwarded || 0;
      addToast(
        'success',
        'Amaliy mashq bajarildi!',
        xp > 0 ? `+${xp} XP hisobingizga qo'shildi` : undefined
      );
      return data;
    },
    [apiFetch, refreshState, addToast]
  );

  const createStudentGoal = useCallback(
    async (payload: {
      period: 'daily' | 'weekly';
      subject: string;
      title: string;
      targetCount: number;
    }): Promise<StudentGoal> => {
      const res = await apiFetch('/api/student/goals', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Maqsad yaratishda xatolik');
      await refreshState();
      addToast('success', "Shaxsiy o'quv maqsadi saqlandi");
      return data.goal;
    },
    [apiFetch, refreshState, addToast]
  );

  const updateStudentGoal = useCallback(
    async (
      goalId: string,
      updates: {
        title?: string;
        targetCount?: number;
        currentCount?: number;
        status?: 'active' | 'completed';
      }
    ): Promise<StudentGoal> => {
      const res = await apiFetch(`/api/student/goals/${encodeURIComponent(goalId)}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Maqsadni yangilashda xatolik');
      await refreshState();
      const xp = data.gamification?.xpAwarded || 0;
      if (xp > 0) {
        addToast('success', `Maqsad bajarildi! +${xp} XP`);
      } else {
        addToast('success', 'Maqsad holati yangilandi');
      }
      return data.goal;
    },
    [apiFetch, refreshState, addToast]
  );

  const updateStudentProfilePreferences = useCallback(
    async (updates: {
      avatarIcon?: StudentAvatarIconKey;
      streakRemindersEnabled?: boolean;
      notificationsEnabled?: boolean;
    }): Promise<StudentGamificationProfile> => {
      const res = await apiFetch('/api/student/profile-preferences', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Profil sozlamalarini saqlashda xatolik');
      await refreshState();
      addToast('success', 'Profil sozlamalari saqlandi');
      return data.profile;
    },
    [apiFetch, refreshState, addToast]
  );

  const reorderLesson = useCallback(
    async (payload: {
      lessonId?: string;
      direction?: 'up' | 'down';
      orderedLessonIds?: string[];
    }) => {
      const res = await apiFetch('/api/lessons/reorder', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Dars tartibini o'zgartirishda xatolik");
      await refreshState();
      addToast('success', 'Darslar ketma-ketligi yangilandi');
    },
    [apiFetch, refreshState, addToast]
  );

  const updateGamificationConfig = useCallback(
    async (
      updates: Partial<GamificationConfig> & {
        badgeUpdates?: Array<{
          code: string;
          thresholdValue?: number;
          isActive?: boolean;
          title?: string;
          description?: string;
        }>;
      }
    ) => {
      const res = await apiFetch('/api/admin/gamification-config', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gamifikatsiya sozlamalarini saqlashda xatolik');
      await refreshState();
      addToast('success', 'Gamifikatsiya tizimi sozlamalari saqlandi');
    },
    [apiFetch, refreshState, addToast]
  );

  const createClassChallenge = useCallback(
    async (payload: {
      classCode: string;
      title: string;
      description?: string;
      targetType?: 'lessons' | 'assessments' | 'checkins' | 'activities';
      targetCount: number;
      subject?: string;
      startDate?: string;
      endDate?: string;
    }): Promise<ClassChallenge> => {
      const res = await apiFetch('/api/admin/class-challenges', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sinf maqsadini yaratishda xatolik');
      await refreshState();
      addToast('success', `${payload.classCode.toUpperCase()} sinfi uchun jamoaviy maqsad yaratildi`);
      return data.challenge;
    },
    [apiFetch, refreshState, addToast]
  );

  const updateClassChallenge = useCallback(
    async (
      id: string,
      updates: {
        title?: string;
        description?: string;
        targetCount?: number;
        isActive?: boolean;
      }
    ): Promise<ClassChallenge> => {
      const res = await apiFetch(`/api/admin/class-challenges/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sinf maqsadini yangilashda xatolik');
      await refreshState();
      addToast('success', 'Jamoaviy sinf maqsadi yangilandi');
      return data.challenge;
    },
    [apiFetch, refreshState, addToast]
  );

  return (
    <LearnOSContext.Provider
      value={{
        currentUser,
        sessionToken,
        authReady,
        isBootstrapped,
        isPlatformOwner,
        theme,
        language,
        institution,
        institutions,
        academicYears,
        subjects,
        topics,
        users,
        classes,
        invitations,
        questions,
        questionRevisions,
        questionMedia,
        assessments,
        assignments,
        attempts,
        gradingRecords,
        importBatches,
        studentImportJobs,
        curriculumImportJobs,
        workPlans,
        lessons,
        masteryRecords,
        learningPaths,
        teacherNotes,
        notifications,
        auditLogs,
        studentGamificationProfiles,
        learningCheckins,
        studentGoals,
        learningActivityEvents,
        xpLedger,
        gamificationBadges,
        studentBadges,
        streakRecords,
        weeklyRecaps,
        classChallenges,
        gamificationConfig,
        studentLessonCompletions,
        toasts,
        toggleTheme,
        setLanguage,
        addToast,
        removeToast,
        refreshState,
        isGoogleSigningIn,
        authError,
        activationPendingMessage,
        clearAuthError,
        bootstrapInitialAdmin,
        loginWithPassword,
        registerWithInvitation,
        previewInvitationToken,
        loginWithGoogle,
        logout,
        submitAssessmentAttempt,
        generateAttemptAIAnalysis,
        createClassRoom,
        updateClassRoom,
        removeStudentFromClass,
        createInvitation,
        importStudentsCSV,
        revokeInvitation,
        addUserByAdmin,
        updateUserAdmin,
        previewStudentExcelImport,
        confirmStudentExcelImport,
        rollbackStudentImportJob,
        executeBulkStudentAction,
        searchGlobal,
        fetchCalendarEvents,
        createSubject,
        updateSubject,
        createTopic,
        analyzeWorkPlan,
        confirmWorkPlan,
        deleteWorkPlan,
        previewCurriculumZipArchive,
        confirmCurriculumZipArchive,
        updateTTrackMathVisibility,
        bulkUpdateLessonsStatus,
        generateLessonAssessment,
        batchGenerateLessonAssessments,
        createLesson,
        updateLesson,
        deleteLesson,
        generateAITest,
        executeAICommand,
        createQuestion,
        updateQuestion,
        deleteQuestion,
        createAssessment,
        updateAssessment,
        createAssignment,
        updateAssignmentStatus,
        updateLearningPathStepStatus,
        addTeacherNote,
        linkChildByCode,
        updateInstitutionSettings,
        createInstitution,
        updateInstitutionFull,
        changeInstitutionStatus,
        switchActiveInstitution,
        createAcademicYear,
        uploadMediaFile,
        validateImportPackage,
        confirmImportPackage,
        suggestWrittenGrade,
        confirmWrittenGrade,
        markNotificationRead,
        submitDailyCheckin,
        completeStudentLesson,
        completeStudentLessonPractice,
        createStudentGoal,
        updateStudentGoal,
        updateStudentProfilePreferences,
        reorderLesson,
        updateGamificationConfig,
        createClassChallenge,
        updateClassChallenge,
      }}
    >
      {children}
    </LearnOSContext.Provider>
  );
};

export function useLearnOS(): LearnOSContextValue {
  const ctx = useContext(LearnOSContext);
  if (!ctx) {
    throw new Error('useLearnOS must be used inside LearnOSProvider');
  }
  return ctx;
}
