import {
  SubjectItem,
  Topic,
  AcademicYearItem,
  ClassRoom,
  ClassTrack,
  OfficialClassCode,
} from '../types';

export const APP_NAME = 'Specialized Study';
export const APP_TAGLINE = 'Structured Learning. Measurable Progress.';
export const PLATFORM_OWNER_EMAIL = 'asilbeknuraliyev43@gmail.com';
export const SECOND_PLATFORM_ADMIN_EMAIL = 'bahodirboliqulov3@gmail.com';
export const AUTHORIZED_ADMIN_EMAILS: readonly string[] = [
  PLATFORM_OWNER_EMAIL,
  SECOND_PLATFORM_ADMIN_EMAIL,
] as const;
export const DEFAULT_INSTITUTION_ID = 'inst-specialized-study';

export const A_TRACK_CLASS_CODES: OfficialClassCode[] = [
  '5a1',
  '5a2',
  '6a1',
  '6a2',
  '7a1',
  '7a2',
  '8a1',
  '8a2',
  '9a1',
  '9a2',
  '10a1',
  '10a2',
  '11a1',
  '11a2',
];

export const T_TRACK_CLASS_CODES: OfficialClassCode[] = [
  '7t',
  '8t',
  '9t',
  '10t',
  '11t',
];

export const OFFICIAL_A_TRACK_CLASSES: OfficialClassCode[] = A_TRACK_CLASS_CODES;
export const OFFICIAL_T_TRACK_CLASSES: OfficialClassCode[] = T_TRACK_CLASS_CODES;

// Exact 19 official classes (14 A-track + 5 T-track) ordered by grade. Never includes 5t or 6t.
export const OFFICIAL_19_CLASS_CODES: OfficialClassCode[] = [
  '5a1',
  '5a2',
  '6a1',
  '6a2',
  '7a1',
  '7a2',
  '7t',
  '8a1',
  '8a2',
  '8t',
  '9a1',
  '9a2',
  '9t',
  '10a1',
  '10a2',
  '10t',
  '11a1',
  '11a2',
  '11t',
];

export interface ParsedClassMetadata {
  code: OfficialClassCode;
  grade: number;
  track: ClassTrack;
  trackLabel: string;
  section: string;
}

export function normalizeClassCodeInput(rawCode: string | number | undefined | null): OfficialClassCode | null {
  if (rawCode === undefined || rawCode === null) return null;
  // Convert Cyrillic lookalikes (а -> a, т -> t) and strip spaces/hyphens/underscores/quotes/sinf/класс suffixes
  const cyrillicNormalized = String(rawCode)
    .trim()
    .toLowerCase()
    .replace(/sinf|класс|class/gi, '')
    .replace(/а/g, 'a') // Cyrillic 'а'
    .replace(/т/g, 't') // Cyrillic 'т'
    .replace(/[-\s_."'`«»()]/g, '');

  if ((OFFICIAL_19_CLASS_CODES as string[]).includes(cyrillicNormalized)) {
    return cyrillicNormalized as OfficialClassCode;
  }
  return null;
}

export function parseOfficialClassCode(rawCode: string): ParsedClassMetadata | null {
  const clean = normalizeClassCodeInput(rawCode);
  if (!clean) {
    return null;
  }

  const match = clean.match(/^(5|6|7|8|9|10|11)(a1|a2|t)$/);
  if (!match) return null;

  const grade = Number(match[1]);
  const suffix = match[2];
  const track: ClassTrack = suffix.startsWith('a') ? 'A' : 'T';
  const trackLabel = track === 'A' ? 'Aniq fanlar' : 'Tabiiy fanlar';
  const section = suffix === 't' ? 't' : suffix.slice(1);

  return {
    code: clean,
    grade,
    track,
    trackLabel,
    section,
  };
}

export const DEFAULT_SUBJECTS: SubjectItem[] = [
  {
    id: 'subj-matematika',
    institutionId: 'global',
    name: 'Matematika',
    code: 'MAT',
    grade: 8,
    applicableGrades: [5, 6, 7, 8, 9, 10, 11],
    trackTypes: ['A'],
    applicableClassCodes: [...A_TRACK_CLASS_CODES],
    description: 'Aniq fanlar yo‘nalishi (A-track: 5a1–11a2) uchun matematika, algebra va geometriya kursi.',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'subj-ingliz-tili',
    institutionId: 'global',
    name: 'Ingliz tili',
    code: 'ENG',
    grade: 8,
    applicableGrades: [5, 6, 7, 8, 9, 10, 11],
    trackTypes: ['A', 'T'],
    applicableClassCodes: [...OFFICIAL_19_CLASS_CODES],
    description: 'Aniq va Tabiiy fanlar yo‘nalishlaridagi barcha 19 ta sinf uchun ingliz tili kursi.',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'subj-fizika',
    institutionId: 'global',
    name: 'Fizika',
    code: 'PHY',
    grade: 8,
    applicableGrades: [5, 6, 7, 8, 9, 10, 11],
    trackTypes: ['A'],
    applicableClassCodes: [...A_TRACK_CLASS_CODES],
    description: 'Aniq fanlar yo‘nalishi (A-track: 5a1–11a2) uchun fizika va amaliy mexanika kursi.',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'subj-biologiya',
    institutionId: 'global',
    name: 'Biologiya',
    code: 'BIO',
    grade: 7,
    applicableGrades: [7, 8, 9, 10, 11],
    trackTypes: ['T'],
    applicableClassCodes: [...T_TRACK_CLASS_CODES],
    description: 'Tabiiy fanlar yo‘nalishi (T-track: 7t–11t) uchun biologiya va genetika kursi.',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'subj-kimyo',
    institutionId: 'global',
    name: 'Kimyo',
    code: 'CHM',
    grade: 7,
    applicableGrades: [7, 8, 9, 10, 11],
    trackTypes: ['T'],
    applicableClassCodes: [...T_TRACK_CLASS_CODES],
    description: 'Tabiiy fanlar yo‘nalishi (T-track: 7t–11t) uchun umumiy, noorganik va organik kimyo kursi.',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export function getDefaultSubjectsForTrack(track: ClassTrack): {
  subjectIds: string[];
  subjectNames: string[];
} {
  const matched = DEFAULT_SUBJECTS.filter((s) => s.trackTypes.includes(track));
  return {
    subjectIds: matched.map((s) => s.id),
    subjectNames: matched.map((s) => s.name),
  };
}

export function isSubjectCompatibleWithClass(
  subjectNameOrId: string,
  classCodeOrRoom: string | ClassRoom,
  subjectsList: SubjectItem[] = DEFAULT_SUBJECTS
): { compatible: boolean; reason?: string } {
  const code =
    typeof classCodeOrRoom === 'string'
      ? classCodeOrRoom.trim().toLowerCase()
      : (classCodeOrRoom.code || classCodeOrRoom.name || '').trim().toLowerCase();

  const parsed = parseOfficialClassCode(code);
  const normSubj = String(subjectNameOrId || '').trim().toLowerCase();

  const subjObj = subjectsList.find(
    (s) =>
      s.id.toLowerCase() === normSubj ||
      s.name.toLowerCase() === normSubj ||
      (s.code && s.code.toLowerCase() === normSubj)
  );

  if (!parsed || !subjObj) {
    return { compatible: true };
  }

  if (
    Array.isArray(subjObj.applicableClassCodes) &&
    subjObj.applicableClassCodes.length > 0 &&
    !subjObj.applicableClassCodes.map((c) => c.toLowerCase()).includes(parsed.code)
  ) {
    return {
      compatible: false,
      reason: `"${subjObj.name}" fani ${parsed.code} (${parsed.trackLabel}) sinfi yo‘nalishiga biriktirilmagan.`,
    };
  }

  if (
    Array.isArray(subjObj.trackTypes) &&
    subjObj.trackTypes.length > 0 &&
    !subjObj.trackTypes.includes(parsed.track)
  ) {
    return {
      compatible: false,
      reason: `"${subjObj.name}" fani faqat ${subjObj.trackTypes.join('/')} yo‘nalishi uchun mo‘ljallangan (${parsed.code} sinfi ${parsed.track} yo‘nalishida).`,
    };
  }

  return { compatible: true };
}

export function buildOfficial19Classes(
  institutionId: string = DEFAULT_INSTITUTION_ID,
  academicYear: string = '2026-2027',
  adminUid: string = 'admin-owner'
): ClassRoom[] {
  const nowIso = '2026-01-01T00:00:00.000Z';
  return OFFICIAL_19_CLASS_CODES.map((code) => {
    const meta = parseOfficialClassCode(code)!;
    const { subjectIds, subjectNames } = getDefaultSubjectsForTrack(meta.track);
    const primarySubject = meta.track === 'A' ? 'Matematika' : 'Biologiya';
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
      teacherName: 'Specialized Study Admin',
      institutionId,
      inviteCode,
      studentCount: 0,
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  });
}

export const DEFAULT_ACADEMIC_YEARS: AcademicYearItem[] = [
  {
    id: 'ay-2026-2027',
    institutionId: 'global',
    name: '2026-2027',
    startDate: '2026-09-02',
    endDate: '2027-05-25',
    isCurrent: true,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const DEFAULT_CURRICULUM_TOPICS: Topic[] = [
  {
    id: 'topic-fractions',
    code: 'TOP-FRAC',
    subjectId: 'subj-matematika',
    subjectCode: 'MAT',
    track: 'A',
    name: 'Kasrlar va ratsional sonlar',
    subject: 'Matematika',
    grade: 7,
    description: 'Oddiy va o‘nli kasrlar, ratsional sonlar ustida arifmetik amallar.',
    learningObjectives: 'Ratsional sonlarni qo‘shish, ayirish, ko‘paytirish va bo‘lish.',
    status: 'active',
    orderIndex: 1,
  },
  {
    id: 'topic-percentages',
    code: 'TOP-PERC',
    subjectId: 'subj-matematika',
    subjectCode: 'MAT',
    track: 'A',
    name: 'Foizlar va proporsiyalar',
    subject: 'Matematika',
    grade: 7,
    description: 'Sonning foizini topish, foizga ko‘ra sonni topish va proporsiya xossalari.',
    learningObjectives: 'Foizli o‘zgarish va proporsional bog‘lanish masalalarini yechish.',
    status: 'active',
    orderIndex: 2,
  },
  {
    id: 'topic-equations',
    code: 'TOP-EQ',
    subjectId: 'subj-matematika',
    subjectCode: 'MAT',
    track: 'A',
    name: 'Chiziqli tenglamalar',
    subject: 'Matematika',
    grade: 8,
    description: 'Bir noma’lumli chiziqli tenglamalar, qavslarni ochish va tengsizliklar.',
    learningObjectives: 'Chiziqli tenglama va tengsizliklarning ildizlarini topish.',
    status: 'active',
    orderIndex: 3,
  },
  {
    id: 'topic-geometry',
    code: 'TOP-GEOM',
    subjectId: 'subj-matematika',
    subjectCode: 'MAT',
    track: 'A',
    name: 'Asosiy geometriya',
    subject: 'Matematika',
    grade: 8,
    description: 'Uchburchaklar, to‘rtburchaklar yuzi, perimetri va Pifagor teoremasi.',
    learningObjectives: 'Tekis shakllarning yuzi, perimetri va burchak xossalarini hisoblash.',
    status: 'active',
    orderIndex: 4,
  },
  {
    id: 'topic-algebra',
    code: 'TOP-ALG',
    subjectId: 'subj-matematika',
    subjectCode: 'MAT',
    track: 'A',
    name: 'Algebraik ifodalar va darajalar',
    subject: 'Matematika',
    grade: 8,
    description: 'Natural va butun ko‘rsatkichli darajalar, ko‘phadlar va qisqa ko‘paytirish formulalari.',
    learningObjectives: 'Daraja xossalarini qo‘llash va algebraik ifodalarni soddalashtirish.',
    status: 'active',
    orderIndex: 5,
  },
  {
    id: 'topic-eng-grammar',
    code: 'TOP-ENG-01',
    subjectId: 'subj-ingliz-tili',
    subjectCode: 'ENG',
    name: 'Present & Past Tenses',
    subject: 'Ingliz tili',
    grade: 7,
    description: 'Ingliz tilida zamonlar tizimi va gap qurilishi.',
    learningObjectives: 'Present Simple, Present Continuous va Past Simple zamonlarini qo‘llash.',
    status: 'active',
    orderIndex: 6,
  },
  {
    id: 'topic-phy-kinematics',
    code: 'TOP-PHY-01',
    subjectId: 'subj-fizika',
    subjectCode: 'PHY',
    track: 'A',
    name: 'Kinematika asoslari va harakat qonunlari',
    subject: 'Fizika',
    grade: 7,
    description: 'Tekis va notekis harakat, tezlik, tezlanish va yo‘l formulalari.',
    learningObjectives: 'Mexanik harakat tenglamalarini tuzish va masalalar yechish.',
    status: 'active',
    orderIndex: 7,
  },
  {
    id: 'topic-bio-cell',
    code: 'TOP-BIO-01',
    subjectId: 'subj-biologiya',
    subjectCode: 'BIO',
    track: 'T',
    name: 'Hujayra tuzilishi va hayotiy jarayonlar',
    subject: 'Biologiya',
    grade: 8,
    description: 'Eukariot va prokariot hujayralar, organoidlar va moddalar almashinuvi.',
    learningObjectives: 'Hujayra organoidlari funksiyalarini farqlash va tahlil qilish.',
    status: 'active',
    orderIndex: 8,
  },
  {
    id: 'topic-chm-atoms',
    code: 'TOP-CHM-01',
    subjectId: 'subj-kimyo',
    subjectCode: 'CHM',
    track: 'T',
    name: 'Atom tuzilishi va davriy qonun',
    subject: 'Kimyo',
    grade: 9,
    description: 'Kimyoviy elementlar davriy jadvali, elektron konfiguratsiya va kimyoviy bog‘lanish.',
    learningObjectives: 'Elementlarning davriy jadvaldagi o‘rniga ko‘ra xossalarini aniqlash.',
    status: 'active',
    orderIndex: 9,
  },
];
