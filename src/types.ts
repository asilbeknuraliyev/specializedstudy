export type UserRole = 'platform_owner' | 'admin' | 'teacher' | 'student' | 'parent';

export type ClassTrack = 'A' | 'T';

export type OfficialClassCode =
  | '5a1'
  | '5a2'
  | '6a1'
  | '6a2'
  | '7a1'
  | '7a2'
  | '7t'
  | '8a1'
  | '8a2'
  | '8t'
  | '9a1'
  | '9a2'
  | '9t'
  | '10a1'
  | '10a2'
  | '10t'
  | '11a1'
  | '11a2'
  | '11t';

export type InstitutionType =
  | 'public_school'
  | 'general_school'
  | 'specialized_school'
  | 'lyceum'
  | 'private_school'
  | 'learning_center'
  | 'academy';

export type InstitutionStatus = 'active' | 'suspended' | 'archived';

export interface Institution {
  id: string;
  name: string;
  shortName?: string;
  officialName?: string;
  code?: string;
  type?: InstitutionType;
  description?: string;
  logoUrl?: string;
  logoStoragePath?: string;
  country?: string;
  region: string;
  district: string;
  city?: string;
  address?: string;
  email?: string;
  officialEmail?: string;
  phone?: string;
  website?: string;
  directorName?: string;
  contactPerson?: string;
  contactRole?: string;
  primarySubjectFocus?: string;
  gradingScale?: '100_percent' | '5_point' | 'letter';
  languageOfInstruction?: string;
  academicYear: string;
  supportedGrades?: number[];
  defaultLanguage?: 'uz' | 'ru' | 'en';
  timezone?: string;
  availableSubjects?: string[];
  status?: InstitutionStatus;
  accountLimits?: {
    maxStudents?: number;
    maxTeachers?: number;
  };
  featuresEnabled?: {
    aiDiagnostics?: boolean;
    excelImport?: boolean;
    parentPortal?: boolean;
  };
  adminUid: string;
  allowTeacherStudentInvites?: boolean;
  allowTeacherAssessments?: boolean;
  allowExcelImports?: boolean;
  aiFeaturesEnabled?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface InstitutionSettings {
  id: string;
  institutionId: string;
  academicYear: string;
  gradingScale: 'percent' | 'five_point';
  allowTeacherInvites: boolean;
  requireQuestionApproval: boolean;
  updatedAt: string;
}

export interface AcademicYearItem {
  id: string;
  institutionId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: 'active' | 'archived';
  createdAt: string;
}

export type StudentAccountStatus = 'active' | 'pending_activation' | 'suspended' | 'archived';

export interface UserProfile {
  uid: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  patronymic?: string;
  email: string;
  emailVerified?: boolean;
  platformOwner?: boolean;
  platformAdmin?: boolean;
  role: UserRole;
  institutionId: string;
  classId?: string;
  classCode?: string;
  grade?: number;
  track?: ClassTrack;
  classIds?: string[];
  assignedClassIds?: string[];
  subject?: string;
  linkedChildIds?: string[];
  studentCode?: string;
  importJobId?: string;
  status?: StudentAccountStatus;
  enrolledAt?: string;
  lastLoginAt?: string;
  lastActiveAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ClassRoom {
  id: string;
  code: string; // e.g., '5a1', '7t'
  name: string; // e.g., '5a1', '7t'
  grade: number; // 5..11
  track: ClassTrack; // 'A' | 'T'
  trackLabel: string; // 'Aniq fanlar' | 'Tabiiy fanlar'
  section: string; // '1' | '2' | 't'
  academicYear: string;
  subject: string;
  subjectIds: string[];
  subjectNames: string[];
  teacherId: string;
  teacherName?: string;
  institutionId: string;
  inviteCode: string;
  studentCount: number;
  status?: 'active' | 'archived';
  createdAt: string;
  updatedAt?: string;
}

export interface ClassMembership {
  id: string;
  institutionId: string;
  classId: string;
  userId: string;
  memberRole: 'teacher' | 'student';
  createdAt: string;
}

export interface TeacherAssignment {
  id: string;
  institutionId: string;
  teacherId: string;
  classId: string;
  subject: string;
  createdAt: string;
}

export interface StudentEnrollment {
  id: string;
  institutionId: string;
  studentId: string;
  classId: string;
  classCode?: string;
  grade?: number;
  track?: ClassTrack;
  status: 'active' | 'removed';
  enrolledAt: string;
}

export interface ParentLink {
  id: string;
  institutionId: string;
  parentId: string;
  studentId: string;
  verifiedBy: 'invitation' | 'student_code' | 'admin';
  createdAt: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface Invitation {
  id: string;
  institutionId: string;
  institutionName: string;
  email: string;
  inviteeName: string;
  role: UserRole;
  classId?: string;
  classCode?: string;
  className?: string;
  grade?: number;
  track?: ClassTrack;
  subject?: string;
  linkedStudentId?: string;
  tokenHash: string;
  codePrefix?: string;
  inviteToken?: string;
  status: InvitationStatus;
  createdByUid: string;
  createdByName: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  acceptedByUid?: string;
}

export interface SubjectItem {
  id: string;
  institutionId: string;
  name: string;
  code: string;
  grade: number;
  applicableGrades: number[];
  trackTypes: ClassTrack[];
  applicableClassCodes: string[];
  description: string;
  status?: 'active' | 'archived';
  createdAt: string;
  updatedAt?: string;
}

export interface Topic {
  id: string;
  code?: string;
  institutionId?: string;
  subjectId?: string;
  parentTopicId?: string;
  unitTitle?: string;
  quarter?: 1 | 2 | 3 | 4;
  classCode?: string;
  track?: ClassTrack;
  name: string;
  subject: string;
  subjectCode?: string;
  grade: number;
  description: string;
  learningObjectives?: string;
  status?: 'active' | 'archived';
  orderIndex: number;
}

export type CurriculumAreaName = 'Matematika' | 'Algebra' | 'Geometriya';

export type NormalizedLessonEventType =
  | 'REGULAR_LESSON'
  | 'WRITTEN_ASSESSMENT'
  | 'QUARTERLY_ASSESSMENT'
  | 'PROJECT_WORK'
  | 'REVIEW_AND_ANALYSIS'
  | 'OTHER';

export type WorkPlanType = 'annual' | 'quarterly' | 'weekly' | 'lesson_list';
export type WorkPlanStatus = 'draft_preview' | 'confirmed' | 'archived';

export interface WorkPlanRowItem {
  rowId: string;
  lessonNumber: number;
  rawLessonOrder?: string;
  quarter: 1 | 2 | 3 | 4;
  quarterLabel?: string;
  weekNumber?: number;
  unitTitle: string;
  topicName: string;
  lessonTitle: string;
  lessonType?: string;
  eventCategory?: NormalizedLessonEventType;
  classwork?: string;
  learningObjectives: string;
  scheduledDate?: string;
  hours: number;
  homework?: string;
  notes?: string;
  assessmentNote?: string;
  maxPoints?: number;
  milestoneCode?: string;
  sourceFile?: string;
  sourceWorksheet?: string;
  sourceRow?: number;
  sourceRecordHash?: string;
  warnings?: string[];
}

export interface WorkPlan {
  id: string;
  institutionId: string;
  title: string;
  fileName: string;
  sourceDirectory?: string;
  sourceWorksheet?: string;
  workbookHash?: string;
  importJobId?: string;
  importVersion?: number;
  fileMimeType?: string;
  classId: string;
  classCode: string;
  classIds?: string[];
  classCodes?: OfficialClassCode[];
  grade: number;
  track: ClassTrack;
  subjectId: string;
  subjectName: string;
  subject?: string;
  curriculumArea?: CurriculumAreaName;
  additionalCurriculumAssignment?: boolean;
  tTrackVisibilityApproved?: boolean;
  academicYear: string;
  quarter?: 1 | 2 | 3 | 4;
  totalLessons?: number;
  totalHours?: number;
  quarterBreakdown?: Record<string | number, number>;
  planType: WorkPlanType;
  status: WorkPlanStatus;
  rows: WorkPlanRowItem[];
  warnings: string[];
  createdByUid: string;
  createdByName: string;
  createdAt: string;
  confirmedAt?: string;
  updatedAt?: string;
}

export type LessonStatus = 'planned' | 'draft' | 'published' | 'in_progress' | 'completed' | 'archived';
export type LessonPublicationStatus = 'DRAFT_IMPORTED' | 'PUBLISHED' | 'ARCHIVED';

export interface LessonMaterial {
  id: string;
  title: string;
  type: 'file' | 'link' | 'note';
  url?: string;
  fileName?: string;
  content?: string;
}

export interface LessonModificationEntry {
  id: string;
  editedAt: string;
  editedByUid: string;
  editedByName: string;
  modifiedAt: string;
  modifiedBy: string;
  changedFields: string[];
  previousTopicTitle?: string;
  previousClasswork?: string;
  previousHomework?: string;
  previousStatus?: LessonStatus;
}

export interface LessonItem {
  id: string;
  institutionId: string;
  workPlanId?: string;
  importJobId?: string;
  classId: string;
  classCode: string;
  classIds?: string[];
  classCodes?: OfficialClassCode[];
  grade: number;
  track: ClassTrack;
  subjectId: string;
  subjectName: string;
  subject?: string;
  curriculumArea?: CurriculumAreaName;
  additionalCurriculumAssignment?: boolean;
  tTrackVisibilityApproved?: boolean;
  academicYear: string;
  quarter: 1 | 2 | 3 | 4;
  quarterLabel?: string;
  weekNumber?: number;
  lessonNumber: number;
  lessonOrder?: number;
  rawLessonOrder?: string;
  unitTitle: string;
  unit?: string;
  topicId: string;
  topicName: string;
  topicTitle?: string;
  title: string;
  lessonType?: string;
  eventCategory?: NormalizedLessonEventType;
  classwork?: string;
  learningObjectives: string | string[];
  content: string;
  explanationContent?: string;
  description?: string;
  homework?: string;
  notes?: string;
  scheduledDate?: string;
  hours?: number;
  maxPoints?: number;
  milestoneType?: 'BSB' | 'CHSB' | 'WRITTEN_WORK' | 'PROJECT' | 'ANALYSIS' | null;
  milestoneCode?: string;
  precedingLessonIds?: string[];
  linkedMilestoneLessonId?: string;
  sourceFile?: string;
  sourceFileName?: string;
  sourceDirectory?: string;
  sourceWorksheet?: string;
  sourceRow?: number;
  sourceRowNumber?: number;
  sourceRecordHash?: string;
  originalSourceSnapshot?: {
    lessonOrder: number;
    rawLessonOrder: string;
    topicTitle: string;
    lessonType: string;
    classwork: string;
    homework: string;
    hours: number;
    notes: string;
    quarterLabel: string;
  };
  modificationHistory?: LessonModificationEntry[];
  materials: LessonMaterial[];
  relatedAssessmentIds: string[];
  linkedAssessmentIds?: string[];
  publicationStatus?: LessonPublicationStatus;
  status: LessonStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface CurriculumWorkbookPreview {
  workbookKey: string;
  workbookId: string;
  fileName: string;
  relativePath: string;
  sourceDirectory: string;
  worksheetName: string;
  workbookHash: string;
  grade: number;
  track: ClassTrack;
  trackLabel: string;
  subjectName: 'Matematika';
  curriculumArea: CurriculumAreaName;
  classCodes: OfficialClassCode[];
  assignedClassCodes: OfficialClassCode[];
  additionalCurriculumAssignment: boolean;
  detectedHeaders: string[];
  normalizedHeaders: Record<string, string>;
  totalRows: number;
  totalLessons: number;
  totalHours: number;
  quarterCounts: {
    '1-chorak': number;
    '2-chorak': number;
    '3-chorak': number;
    '4-chorak': number;
  };
  quarterBreakdown: {
    1: number;
    2: number;
    3: number;
    4: number;
    '1-chorak': number;
    '2-chorak': number;
    '3-chorak': number;
    '4-chorak': number;
  };
  lessonTypeCounts: Record<string, number>;
  eventCategoryCounts: Record<NormalizedLessonEventType, number>;
  bsbCount: number;
  chsbCount: number;
  projectCount: number;
  analysisCount: number;
  missingFieldsCount: {
    topicTitle: number;
    classwork: number;
    homework: number;
    hours: number;
    quarter: number;
  };
  warnings: string[];
  rows: WorkPlanRowItem[];
}

export interface CurriculumZipImportPreview {
  archiveName: string;
  archiveSize: number;
  archiveHash: string;
  totalWorkbooks: number;
  totalFiles: number;
  aTrackWorkbooksCount: number;
  aTrackFiles: number;
  tTrackWorkbooksCount: number;
  tTrackFiles: number;
  totalLessonRecords: number;
  totalLessons: number;
  aTrackLessonRecords: number;
  tTrackLessonRecords: number;
  totalHours: number;
  tTrackVisibilityApproved?: boolean;
  quarterDistribution: {
    '1-chorak': number;
    '2-chorak': number;
    '3-chorak': number;
    '4-chorak': number;
  };
  quarterBreakdown: {
    1: number;
    2: number;
    3: number;
    4: number;
    '1-chorak': number;
    '2-chorak': number;
    '3-chorak': number;
    '4-chorak': number;
  };
  rawLessonTypeDistribution: Record<string, number>;
  lessonTypeBreakdown: Record<string, number>;
  eventCategoryDistribution: Record<NormalizedLessonEventType, number>;
  eventCategoryBreakdown: Record<NormalizedLessonEventType, number>;
  classAssignmentSummary: Array<{
    classCode: OfficialClassCode;
    grade: number;
    track: ClassTrack;
    curriculumAreas: CurriculumAreaName[];
    workbooksCount: number;
    totalLessons: number;
    totalHours: number;
    additionalCurriculumAssignment: boolean;
  }>;
  workbooks: CurriculumWorkbookPreview[];
  warnings: string[];
  errors: string[];
}

export interface CurriculumImportJob {
  id: string;
  jobId: string;
  institutionId: string;
  archiveName: string;
  archiveHash: string;
  importVersion: number;
  totalWorkbooks: number;
  totalRows: number;
  importedWorkPlansCount: number;
  updatedWorkPlansCount: number;
  importedLessonsCount: number;
  updatedLessonsCount: number;
  skippedDuplicatesCount: number;
  tTrackVisibilityApproved: boolean;
  publishImmediately: boolean;
  status: 'completed' | 'rolled_back' | 'failed';
  initiatedByUid: string;
  initiatedByName: string;
  createdAt: string;
}

export type QuestionDifficulty = 'easy' | 'medium' | 'hard' | 'mixed';
export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'multi_select'
  | 'numeric'
  | 'short_text'
  | 'long_text'
  | 'written_open';

export type GradingMode = 'automatic' | 'manual' | 'ai_assisted' | 'auto' | 'manual_rubric';

export interface QuestionOption {
  id?: string;
  code?: string;
  key?: string;
  text: string;
  imageUrl?: string;
  imageStoragePath?: string;
  isCorrect: boolean;
  displayOrder?: number;
}

export interface AcceptedAnswer {
  id?: string;
  questionCode?: string;
  acceptedAnswer?: string;
  text?: string;
  caseSensitive: boolean;
  trimWhitespace: boolean;
}

export interface QuestionMedia {
  id: string;
  institutionId: string;
  questionId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath?: string;
  url?: string;
  dataUrl?: string;
  width?: number;
  height?: number;
  caption?: string;
  altText?: string;
  uploadedBy?: string;
  uploadedByUid?: string;
  createdAt: string;
}

export interface QuestionItem {
  id: string;
  code?: string;
  title?: string;
  instructions?: string;
  institutionId: string;
  authorId: string;
  subject: string;
  subjectCode?: string;
  grade: number;
  classCode?: string;
  lessonId?: string;
  topicId: string;
  topicCode?: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  points?: number;
  prompt: string;
  options?: string[];
  optionItems?: QuestionOption[];
  structuredOptions?: QuestionOption[];
  correctAnswer: string;
  correctAnswers?: string[];
  numericTolerance?: number;
  acceptedAnswers?: AcceptedAnswer[];
  gradingMode?: GradingMode;
  rubricText?: string;
  imageUrl?: string;
  imageStoragePath?: string;
  mediaId?: string;
  explanationImageUrl?: string;
  explanationMediaId?: string;
  media?: QuestionMedia[];
  explanation: string;
  status: 'draft' | 'approved' | 'archived';
  version?: number;
  importBatchId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface QuestionRevision {
  id: string;
  questionId: string;
  questionCode?: string;
  institutionId: string;
  version: number;
  previousPrompt?: string;
  snapshot?: QuestionItem;
  updatedByUid?: string;
  updatedByName?: string;
  editedByUid?: string;
  editedByName?: string;
  reason?: string;
  createdAt: string;
}

export interface Assessment {
  id: string;
  code?: string;
  title: string;
  description?: string;
  instructions?: string;
  subject: string;
  subjectId?: string;
  subjectCode?: string;
  curriculumArea?: CurriculumAreaName;
  grade: number;
  track?: ClassTrack;
  quarter?: 1 | 2 | 3 | 4;
  lessonId?: string;
  lessonTitle?: string;
  blueprintLessonIds?: string[];
  milestoneCode?: string;
  maxPoints?: number;
  topicIds: string[];
  questionIds: string[];
  questionSnapshot?: QuestionItem[];
  durationMinutes: number;
  passingScorePercent?: number;
  passingScore?: number;
  shuffleQuestions?: boolean;
  attemptLimit?: number;
  maximumAttempts?: number;
  availableFrom?: string;
  dueDate: string;
  classId: string;
  classCode?: string;
  assignedClassIds?: string[];
  assignedClassCodes?: OfficialClassCode[];
  eligibleStudentIds?: string[];
  randomizeOrder?: boolean;
  totalPoints?: number;
  teacherId: string;
  institutionId: string;
  source?: 'manual' | 'ai_generated' | 'excel_import' | 'zip_import';
  status: 'draft' | 'published' | 'archived';
  version?: number;
  importBatchId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Assignment {
  id: string;
  institutionId: string;
  assessmentId: string;
  assessmentTitle: string;
  classId: string;
  classCode?: string;
  className: string;
  teacherId: string;
  startDate: string;
  dueDate: string;
  status: 'published' | 'closed';
  eligibleStudentIds?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface StudentAnswerItem {
  questionId: string;
  questionCode?: string;
  questionType?: QuestionType;
  topicId: string;
  selectedAnswer: string;
  selectedAnswers?: string[];
  correctAnswer: string;
  isCorrect: boolean;
  points?: number;
  maxPoints?: number;
  earnedPoints?: number;
  awardedPoints?: number;
  pendingManualReview?: boolean;
  gradingStatus?: 'auto_graded' | 'pending_review' | 'pending_manual' | 'graded';
  gradingMode?: GradingMode;
  rubricText?: string;
  aiSuggestedPoints?: number;
  aiSuggestedRationale?: string;
  aiSuggestedFeedback?: string;
  teacherFeedback?: string;
  confirmedByUid?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  prompt: string;
  explanation: string;
  imageUrl?: string;
  explanationImageUrl?: string;
}

export interface GradingRecord {
  id: string;
  institutionId: string;
  attemptId: string;
  questionId: string;
  studentId?: string;
  maxPoints: number;
  awardedPoints: number;
  aiSuggestedPoints?: number;
  aiSuggestedRationale?: string;
  aiSuggestedFeedback?: string;
  teacherFeedback?: string;
  feedback?: string;
  confirmedByUid?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  gradedByUid?: string;
  gradedByName?: string;
  gradedAt?: string;
  createdAt?: string;
}

export interface TopicBreakdownItem {
  topicId: string;
  topicName: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  assignmentId?: string;
  assessmentTitle: string;
  assessmentVersion?: number;
  subject?: string;
  lessonId?: string;
  studentId: string;
  studentName: string;
  classId: string;
  classCode?: string;
  institutionId: string;
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  earnedPoints?: number;
  totalPoints?: number;
  pendingManualCount?: number;
  gradingStatus?: 'completed' | 'pending_manual_review';
  status: 'completed' | 'pending_manual_review';
  submittedAt: string;
  answers: StudentAnswerItem[];
  topicBreakdown: TopicBreakdownItem[];
  aiAnalysis?: AIAnalysisResult;
}

export interface ImportValidationError {
  sheet: 'Assessment' | 'Questions' | 'Options' | 'AcceptedAnswers' | 'Topics' | 'Package' | string;
  row: number;
  column: string;
  problem: string;
  message?: string;
  severity: 'error' | 'warning';
}

export interface ImportBatch {
  id: string;
  institutionId: string;
  uploadedByUid?: string;
  uploadedByName?: string;
  importedByUid?: string;
  importedByName?: string;
  fileName: string;
  packageType: 'xlsx' | 'zip';
  assessmentId?: string;
  assessmentTitle?: string;
  questionsCount?: number;
  optionsCount?: number;
  mediaCount?: number;
  errorsCount?: number;
  warningsCount?: number;
  duplicatePolicy?: string;
  totalQuestions?: number;
  importedQuestions?: number;
  skippedDuplicates?: number;
  updatedQuestions?: number;
  imagesUploaded?: number;
  totalPoints?: number;
  destinationType?: 'assessment' | 'question_bank';
  destinationAssessmentId?: string;
  destinationAssessmentTitle?: string;
  status: 'validated' | 'completed' | 'imported' | 'failed';
  errors?: ImportValidationError[];
  warnings?: string[];
  createdAt: string;
}

export type MasteryStatusLabel =
  | "Ma'lumot yetarli emas"
  | 'Boshlanmagan'
  | 'O‘rganilmoqda'
  | 'Mustahkamlanmoqda'
  | 'Yaxshi o‘zlashtirilgan'
  | 'Qayta ishlash kerak'
  | 'Rivojlanmoqda'
  | "Yaxshi o'zlashtirilmoqda"
  | 'Mustahkam';

export interface MasteryRecord {
  id: string;
  studentId: string;
  institutionId: string;
  topicId: string;
  topicName: string;
  subject: string;
  grade: number;
  assessedQuestions: number;
  correctAnswers: number;
  accuracy: number;
  masteryEstimate: number;
  evidenceCount: number;
  statusLabel: MasteryStatusLabel;
  lastAssessedAt: string;
}

export interface AITopicAnalysis {
  topic_id: string;
  observed_performance: string;
  possible_error_pattern: string;
  evidence_count: number;
  confidence: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface AINextStep {
  topic_id: string;
  activity: string;
  reason: string;
  priority: 'low' | 'medium' | 'high';
}

export interface AIAnalysisResult {
  summary: string;
  topic_analysis: AITopicAnalysis[];
  next_steps: AINextStep[];
  teacher_summary: string;
  parent_summary?: string;
  generatedAt?: string;
  isFallback?: boolean;
  aiUnavailableReason?: string;
}

export type LearningPathStepStatus = 'not_started' | 'in_progress' | 'completed';

export interface LearningPathStep {
  stepNumber: number;
  title: string;
  description: string;
  type: 'concept' | 'example' | 'practice' | 'review' | 'reassessment';
  status: LearningPathStepStatus;
  content: string;
}

export interface LearningPathItem {
  id: string;
  studentId: string;
  institutionId?: string;
  topicId: string;
  topicName: string;
  observedIndicator: string;
  accuracy: number;
  priority: 'high' | 'medium' | 'low';
  steps: LearningPathStep[];
  createdAt?: string;
}

export interface LearningRecommendation {
  id: string;
  institutionId: string;
  studentId: string;
  attemptId: string;
  topicId: string;
  topicName: string;
  recommendation: string;
  priority: 'low' | 'medium' | 'high';
  evidenceCount: number;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  institutionId: string;
  recipientUid: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface TeacherNote {
  id: string;
  studentId: string;
  teacherId: string;
  teacherName: string;
  institutionId: string;
  content: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  institutionId: string;
  actorUid?: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  target: string;
  recordId?: string;
  status?: 'success' | 'failed';
  eventType?: string;
  outcome?: 'success' | 'denied' | 'failure';
  requestId?: string;
  ipHash?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  createdAt: string;
}

export interface AICommandExecutionResult {
  id: string;
  commandText: string;
  intent:
    | 'generate_lesson_test'
    | 'generate_quarter_review_test'
    | 'generate_today_questions'
    | 'show_upcoming_lessons'
    | 'convert_work_plan_to_map'
    | 'show_class_students'
    | 'sort_class_students'
    | 'general_academic_query';
  matchedClass?: ClassRoom;
  matchedSubject?: SubjectItem;
  matchedLesson?: LessonItem;
  questionCount?: number;
  difficulty?: QuestionDifficulty;
  quarter?: 1 | 2 | 3 | 4;
  generatedAssessment?: Assessment;
  generatedQuestions?: QuestionItem[];
  upcomingLessons?: LessonItem[];
  matchedStudents?: UserProfile[];
  convertedWorkPlan?: WorkPlan;
  warnings?: string[];
  message: string;
  createdAt: string;
}

export interface StudentImportColumnMapping {
  fullNameCol?: string;
  firstNameCol?: string;
  lastNameCol?: string;
  patronymicCol?: string;
  classCodeCol?: string;
  studentIdCol?: string;
  emailCol?: string;
}

export type StudentImportRowStatus = 'valid' | 'duplicate' | 'warning' | 'error';

export interface StudentImportIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO';
  field: string;
  message: string;
}

export interface StudentImportRowPreview {
  rowNumber: number;
  sheetName: string;
  rawFullName: string;
  rawFirstName: string;
  rawLastName: string;
  rawPatronymic: string;
  rawClassCode: string;
  rawStudentId: string;
  rawEmail: string;
  fullName: string;
  firstName: string;
  lastName: string;
  patronymic: string;
  normalizedClassCode: OfficialClassCode | null;
  grade: number | null;
  track: ClassTrack | null;
  studentId: string;
  email: string;
  status: StudentImportRowStatus;
  duplicateReason?: string;
  existingUserUid?: string;
  issues: StudentImportIssue[];
}

export interface StudentImportSheetInfo {
  name: string;
  rowCount: number;
  detectedHeaderRowIndex: number;
  headers: string[];
  sampleRows: Record<string, string>[];
}

export interface StudentImportClassGroupSummary {
  classCode: OfficialClassCode;
  grade: number;
  track: ClassTrack;
  totalCount: number;
  validCount: number;
  duplicateCount: number;
  errorCount: number;
}

export interface StudentImportPreviewResult {
  fileName: string;
  fileSize: number;
  sheets: StudentImportSheetInfo[];
  selectedSheet: string;
  selectedHeaderRowIndex: number;
  headers: string[];
  detectedMapping: StudentImportColumnMapping;
  totalRows: number;
  newStudentsCount: number;
  duplicatesCount: number;
  errorsCount: number;
  warningsCount: number;
  infoCount: number;
  classGroups: StudentImportClassGroupSummary[];
  rows: StudentImportRowPreview[];
}

export interface StudentImportJob {
  id: string;
  jobId: string;
  institutionId: string;
  fileName: string;
  duplicatePolicy: 'skip_existing' | 'update_existing';
  totalRows: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  createdStudentUids: string[];
  updatedStudentUids: string[];
  status: 'completed' | 'rolled_back' | 'failed';
  initiatedByUid: string;
  initiatedByName: string;
  rolledBackAt?: string;
  rolledBackByUid?: string;
  createdAt: string;
}

export interface CalendarEventItem {
  id: string;
  title: string;
  type: 'lesson' | 'assessment' | 'deadline' | 'milestone';
  date: string; // YYYY-MM-DD or ISO
  classId?: string;
  classCode?: string;
  subject?: string;
  quarter?: 1 | 2 | 3 | 4;
  status?: string;
  targetRoute: string;
  recordId: string;
}

export interface GlobalSearchResultItem {
  id: string;
  category: 'student' | 'class' | 'subject' | 'lesson' | 'work_plan' | 'assessment' | 'navigation' | 'action';
  title: string;
  subtitle: string;
  badge?: string;
  route: string;
  recordId?: string;
  classCode?: string;
}

