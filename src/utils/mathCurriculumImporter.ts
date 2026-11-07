import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import {
  ClassTrack,
  CurriculumAreaName,
  CurriculumImportJob,
  CurriculumWorkbookPreview,
  CurriculumZipImportPreview,
  LessonItem,
  NormalizedLessonEventType,
  OfficialClassCode,
  QuestionDifficulty,
  QuestionItem,
  QuestionType,
  Topic,
  WorkPlan,
  WorkPlanRowItem,
} from '../types';
import { DEFAULT_INSTITUTION_ID } from '../constants/curriculum';

export const OFFICIAL_MATH_ARCHIVE_DISPLAY_NAME =
  'Matematika  elektron jurnal uchun ish reja.zip';

export const OFFICIAL_MATH_ARCHIVE_REL_PATH =
  'public/assets/aistudio/Matematika__elektron_jurnal_uchun_ish_reja_95f956a7.zip';

const MAX_ZIP_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_ZIP_ENTRIES = 100;
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024; // 50 MB

export function computeSha256Hex(input: Buffer | Uint8Array | string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function resolveOfficialMathArchivePath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), OFFICIAL_MATH_ARCHIVE_REL_PATH),
    path.resolve(process.cwd(), 'public/assets/aistudio', OFFICIAL_MATH_ARCHIVE_DISPLAY_NAME),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  const assetsDir = path.resolve(process.cwd(), 'public/assets/aistudio');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    const zipMatch = files.find((f) => f.toLowerCase().endsWith('.zip') && /matematika/i.test(f));
    if (zipMatch) {
      return path.join(assetsDir, zipMatch);
    }
  }
  return null;
}

export interface ParsedWorkbookTargetMeta {
  workbookKey: string;
  grade: number;
  track: ClassTrack;
  trackLabel: string;
  subjectName: 'Matematika';
  curriculumArea: CurriculumAreaName;
  classCodes: OfficialClassCode[];
  additionalCurriculumAssignment: boolean;
}

export function inferWorkbookTargetFromPath(
  relativePath: string,
  fileName: string
): ParsedWorkbookTargetMeta | null {
  const combined = `${relativePath} ${fileName}`;
  const gradeMatch = fileName.match(/\b(5|6|7|8|9|10|11)\s*-\s*sinf/i);
  if (!gradeMatch) return null;
  const grade = Number(gradeMatch[1]);

  const isTTrack =
    /tabiiy/i.test(combined) || /tabiiy\s+fanlar/i.test(relativePath);
  const track: ClassTrack = isTTrack ? 'T' : 'A';
  const trackLabel = track === 'A' ? 'Aniq fanlar' : 'Tabiiy fanlar';

  let curriculumArea: CurriculumAreaName = 'Matematika';
  if (/algebra/i.test(fileName)) {
    curriculumArea = 'Algebra';
  } else if (/geometriya/i.test(fileName)) {
    curriculumArea = 'Geometriya';
  } else {
    curriculumArea = 'Matematika';
  }

  let classCodes: OfficialClassCode[] = [];
  if (track === 'A') {
    classCodes = [`${grade}a1` as OfficialClassCode, `${grade}a2` as OfficialClassCode];
  } else {
    if (grade < 7 || grade > 11) {
      return null; // Never create 5t or 6t
    }
    classCodes = [`${grade}t` as OfficialClassCode];
  }

  const areaSlug = curriculumArea.toLowerCase();
  const workbookKey = `math-wb-${grade}-${track.toLowerCase()}-${areaSlug}`;

  return {
    workbookKey,
    grade,
    track,
    trackLabel,
    subjectName: 'Matematika',
    curriculumArea,
    classCodes,
    additionalCurriculumAssignment: track === 'T',
  };
}

export interface EventClassificationResult {
  eventCategory: NormalizedLessonEventType;
  milestoneType: 'BSB' | 'CHSB' | 'WRITTEN_WORK' | 'PROJECT' | 'ANALYSIS' | null;
  milestoneCode?: string;
  maxPoints?: number;
}

export function classifyCurriculumLessonEvent(
  rawLessonType: string,
  topicTitle: string
): EventClassificationResult {
  const cleanType = String(rawLessonType || '').trim();
  const cleanTitle = String(topicTitle || '').trim();
  const lowerType = cleanType.toLowerCase();
  const lowerTitle = cleanTitle.toLowerCase();

  // Extract maxPoints if present, e.g. "(25 ball)" or "(40 ball)"
  let maxPoints: number | undefined;
  const pointsMatch = cleanTitle.match(/\(?\s*(\d{1,3})\s*ball\s*\)?/i);
  if (pointsMatch) {
    maxPoints = Number(pointsMatch[1]);
  }

  // Extract milestone code, e.g. "BSB-1", "BSB - 2", "CHSB-1", "1-BSB", "Nazorat ishi"
  let milestoneCode: string | undefined;
  const bsbCodeMatch =
    cleanTitle.match(/\b(\d+\s*-\s*BSB|BSB\s*-?\s*\d+|\bBSB\b)/i);
  const chsbCodeMatch =
    cleanTitle.match(/\b(\d+\s*-\s*CHSB|CHSB\s*-?\s*\d+|\bCHSB\b)/i);

  // 1. Check Review & Analysis FIRST ("BSB tahlili", "CHSB tahlili", "BSB tahlil", "Xatolar ustida ishlash")
  const isAnalysisRow =
    /\b(bsb|chsb|nazorat\s+ishi|yozma\s+ish)[\w\s-]*tahlil/i.test(cleanTitle) ||
    /\btahlili\b/i.test(lowerTitle) ||
    /\bbsb\s+tahlil\b/i.test(lowerTitle) ||
    /\bchsb\s+tahlil\b/i.test(lowerTitle) ||
    /xatolar\s+ustida\s+ishlash/i.test(lowerTitle);

  if (isAnalysisRow) {
    if (bsbCodeMatch) {
      milestoneCode = `${bsbCodeMatch[1].replace(/\s+/g, '').toUpperCase()} tahlili`;
    } else if (chsbCodeMatch) {
      milestoneCode = `${chsbCodeMatch[1].replace(/\s+/g, '').toUpperCase()} tahlili`;
    } else {
      milestoneCode = 'Tahlil darsi';
    }
    return {
      eventCategory: 'REVIEW_AND_ANALYSIS',
      milestoneType: 'ANALYSIS',
      milestoneCode,
      maxPoints: undefined,
    };
  }

  // 2. Check Quarterly Summative Assessment (CHSB / Choraklik summativ baholash-39)
  if (
    lowerType.includes('choraklik summativ baholash') ||
    /\bchsb\b/i.test(cleanTitle) ||
    /\d+\s*-\s*chsb/i.test(cleanTitle)
  ) {
    milestoneCode = chsbCodeMatch
      ? chsbCodeMatch[1].replace(/\s+/g, '').toUpperCase()
      : 'CHSB';
    return {
      eventCategory: 'QUARTERLY_ASSESSMENT',
      milestoneType: 'CHSB',
      milestoneCode,
      maxPoints: maxPoints ?? 40,
    };
  }

  // 3. Check Project Work (Loyiha ishi-35)
  if (lowerType.includes('loyiha ishi') || /\bloyiha\s+ishi\b/i.test(cleanTitle)) {
    return {
      eventCategory: 'PROJECT_WORK',
      milestoneType: 'PROJECT',
      milestoneCode: 'Loyiha ishi',
      maxPoints,
    };
  }

  // 4. Check Written / Summative Assessment (Yozma ish-41, BSB, Nazorat ishi)
  if (
    lowerType.includes('yozma ish') ||
    /\bbsb\b/i.test(cleanTitle) ||
    /\d+\s*-\s*bsb/i.test(cleanTitle) ||
    /\bnazorat\s+ishi\b/i.test(cleanTitle)
  ) {
    const isBsb = /\bbsb\b|\d+\s*-\s*bsb/i.test(cleanTitle);
    milestoneCode = bsbCodeMatch
      ? bsbCodeMatch[1].replace(/\s+/g, '').toUpperCase()
      : /\bnazorat\s+ishi\b/i.test(cleanTitle)
      ? 'Nazorat ishi'
      : 'Yozma ish';
    return {
      eventCategory: 'WRITTEN_ASSESSMENT',
      milestoneType: isBsb ? 'BSB' : 'WRITTEN_WORK',
      milestoneCode,
      maxPoints: maxPoints ?? (isBsb ? 25 : undefined),
    };
  }

  // 5. Check Regular Lesson (Oddiy dars-31, Oddiy dars-32)
  if (lowerType.includes('oddiy dars') || cleanType === '') {
    return {
      eventCategory: 'REGULAR_LESSON',
      milestoneType: null,
      maxPoints,
    };
  }

  return {
    eventCategory: 'OTHER',
    milestoneType: null,
    maxPoints,
  };
}

export function normalizeQuarterString(rawQuarter: string | number | undefined): {
  quarter: 1 | 2 | 3 | 4;
  quarterLabel: '1-chorak' | '2-chorak' | '3-chorak' | '4-chorak';
} {
  const str = String(rawQuarter || '').trim();
  const numMatch = str.match(/([1-4])/);
  const q = (numMatch ? Number(numMatch[1]) : 1) as 1 | 2 | 3 | 4;
  return {
    quarter: q,
    quarterLabel: `${q}-chorak` as '1-chorak' | '2-chorak' | '3-chorak' | '4-chorak',
  };
}

export function parseLessonOrderValue(
  rawVal: unknown,
  fallbackIndex: number
): { lessonOrder: number; rawLessonOrder: string } {
  const rawStr = String(rawVal ?? '').trim();
  const numMatch = rawStr.match(/(\d+)/);
  const lessonOrder = numMatch ? Number(numMatch[1]) : fallbackIndex;
  return {
    lessonOrder: lessonOrder > 0 ? lessonOrder : fallbackIndex,
    rawLessonOrder: rawStr || String(fallbackIndex),
  };
}

export function parseSingleCurriculumWorkbook(
  buffer: Buffer,
  relativePath: string,
  fileName: string
): CurriculumWorkbookPreview {
  const targetMeta = inferWorkbookTargetFromPath(relativePath, fileName);
  if (!targetMeta) {
    throw new Error(`Fayl yo'nalishi yoki sinfi aniqlanmadi: ${fileName}`);
  }

  const workbookHash = computeSha256Hex(buffer);
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const worksheetName = wb.SheetNames[0] || 'Sheet1';
  const sheet = wb.Sheets[worksheetName];
  if (!sheet) {
    throw new Error(`Excel varag'i topilmadi: ${fileName}`);
  }

  const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
  if (matrix.length === 0) {
    throw new Error(`Excel fayli bo'sh: ${fileName}`);
  }

  const rawHeaderRow = (matrix[0] || []).map((cell) => String(cell ?? ''));
  const detectedHeaders = rawHeaderRow.filter((h) => h.trim() !== '');

  // Map column indices for the 8 official columns
  let colLessonOrder = 0;
  let colTopicTitle = 1;
  let colLessonType = 2;
  let colClasswork = 3;
  let colHomework = 4;
  let colHours = 5;
  let colNotes = 6;
  let colQuarter = 7;

  const normalizedHeaders: Record<string, string> = {};

  rawHeaderRow.forEach((rawHeader, idx) => {
    const clean = rawHeader.trim();
    if (!clean) return;
    const lower = clean.toLowerCase();
    if (/dars\s*tartibi|tartib|№|raqam/i.test(lower)) {
      colLessonOrder = idx;
      normalizedHeaders[rawHeader] = 'lessonOrder';
    } else if (/mavzu\s*nomi|^mavzu$/i.test(lower)) {
      colTopicTitle = idx;
      normalizedHeaders[rawHeader] = 'topicTitle';
    } else if (/dars\s*turi/i.test(lower)) {
      colLessonType = idx;
      normalizedHeaders[rawHeader] = 'lessonType';
    } else if (/sinf\s*ishi/i.test(lower)) {
      colClasswork = idx;
      normalizedHeaders[rawHeader] = 'classwork';
    } else if (/uyga\s*vazifa|uy\s*vazifa|^vazifa$/i.test(lower)) {
      colHomework = idx;
      normalizedHeaders[rawHeader] = 'homework';
    } else if (/^soat$|soati/i.test(lower)) {
      colHours = idx;
      normalizedHeaders[rawHeader] = 'hours';
    } else if (/^izoh$/i.test(lower)) {
      colNotes = idx;
      normalizedHeaders[rawHeader] = 'notes';
    } else if (/davr|chorak/i.test(lower)) {
      colQuarter = idx;
      normalizedHeaders[rawHeader] = 'quarter';
    }
  });

  const quarterCounts = {
    '1-chorak': 0,
    '2-chorak': 0,
    '3-chorak': 0,
    '4-chorak': 0,
  };
  const lessonTypeCounts: Record<string, number> = {};
  const eventCategoryCounts: Record<NormalizedLessonEventType, number> = {
    REGULAR_LESSON: 0,
    WRITTEN_ASSESSMENT: 0,
    QUARTERLY_ASSESSMENT: 0,
    PROJECT_WORK: 0,
    REVIEW_AND_ANALYSIS: 0,
    OTHER: 0,
  };
  const missingFieldsCount = {
    topicTitle: 0,
    classwork: 0,
    homework: 0,
    hours: 0,
    quarter: 0,
  };

  let bsbCount = 0;
  let chsbCount = 0;
  let projectCount = 0;
  let analysisCount = 0;
  let totalHours = 0;
  const warnings: string[] = [];
  const rows: WorkPlanRowItem[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const rowCells = matrix[r] || [];
    const hasAnyValue = rowCells.some((c) => String(c ?? '').trim() !== '');
    if (!hasAnyValue) continue;

    const { lessonOrder, rawLessonOrder } = parseLessonOrderValue(
      rowCells[colLessonOrder],
      rows.length + 1
    );
    const topicTitle = String(rowCells[colTopicTitle] ?? '').trim();
    const lessonType = String(rowCells[colLessonType] ?? '').trim();
    const classwork = String(rowCells[colClasswork] ?? '').trim();
    const homework = String(rowCells[colHomework] ?? '').trim();
    const rawHours = rowCells[colHours];
    const hours = Number(rawHours) > 0 ? Number(rawHours) : 1;
    const notes = String(rowCells[colNotes] ?? '').trim();
    const rawQuarterCell = String(rowCells[colQuarter] ?? '').trim();

    if (!topicTitle) missingFieldsCount.topicTitle++;
    if (!classwork) missingFieldsCount.classwork++;
    if (!homework) missingFieldsCount.homework++;
    if (!rawHours && rawHours !== 0) missingFieldsCount.hours++;
    if (!rawQuarterCell) missingFieldsCount.quarter++;

    const { quarter, quarterLabel } = normalizeQuarterString(rawQuarterCell);
    quarterCounts[quarterLabel] = (quarterCounts[quarterLabel] || 0) + 1;

    const typeKey = lessonType || 'Oddiy dars-31';
    lessonTypeCounts[typeKey] = (lessonTypeCounts[typeKey] || 0) + 1;

    const classified = classifyCurriculumLessonEvent(typeKey, topicTitle);
    eventCategoryCounts[classified.eventCategory] =
      (eventCategoryCounts[classified.eventCategory] || 0) + 1;

    if (classified.eventCategory === 'WRITTEN_ASSESSMENT') bsbCount++;
    if (classified.eventCategory === 'QUARTERLY_ASSESSMENT') chsbCount++;
    if (classified.eventCategory === 'PROJECT_WORK') projectCount++;
    if (classified.eventCategory === 'REVIEW_AND_ANALYSIS') analysisCount++;

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
      unitTitle: `${quarterLabel} • ${targetMeta.curriculumArea}`,
      topicName: topicTitle,
      lessonTitle: topicTitle,
      lessonType: typeKey,
      eventCategory: classified.eventCategory,
      classwork,
      learningObjectives: classwork
        ? `Sinf ishi: ${classwork}`
        : `${topicTitle} mavzusi bo‘yicha amaliy ko‘nikmalarni shakllantirish.`,
      hours,
      homework,
      notes,
      assessmentNote: classified.milestoneCode,
      maxPoints: classified.maxPoints,
      milestoneCode: classified.milestoneCode,
      sourceFile: fileName,
      sourceWorksheet: worksheetName,
      sourceRow: r + 1,
      sourceRecordHash,
    });
  }

  const pathParts = relativePath.split('/').filter(Boolean);
  const sourceDirectory =
    pathParts.length >= 2 ? pathParts[pathParts.length - 2] : targetMeta.trackLabel;

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
    subjectName: 'Matematika',
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
      1: quarterCounts['1-chorak'],
      2: quarterCounts['2-chorak'],
      3: quarterCounts['3-chorak'],
      4: quarterCounts['4-chorak'],
      '1-chorak': quarterCounts['1-chorak'],
      '2-chorak': quarterCounts['2-chorak'],
      '3-chorak': quarterCounts['3-chorak'],
      '4-chorak': quarterCounts['4-chorak'],
    },
    lessonTypeCounts,
    eventCategoryCounts,
    bsbCount,
    chsbCount,
    projectCount,
    analysisCount,
    missingFieldsCount,
    warnings,
    rows,
  };
}

export async function parseAndValidateCurriculumZipBuffer(
  zipBuffer: Buffer,
  archiveName: string = OFFICIAL_MATH_ARCHIVE_DISPLAY_NAME
): Promise<CurriculumZipImportPreview> {
  if (!zipBuffer || zipBuffer.byteLength === 0) {
    throw new Error('Yuklangan ZIP arxiv bo‘sh.');
  }
  if (zipBuffer.byteLength > MAX_ZIP_SIZE_BYTES) {
    throw new Error('ZIP arxiv hajmi ruxsat etilgan 25 MB chegaradan oshib ketdi.');
  }

  // Verify ZIP magic bytes (PK\x03\x04)
  if (
    zipBuffer.byteLength < 4 ||
    zipBuffer[0] !== 0x50 ||
    zipBuffer[1] !== 0x4b
  ) {
    throw new Error('Yuklangan fayl haqiqiy ZIP arxiv emas.');
  }

  const archiveHash = computeSha256Hex(zipBuffer);
  const zip = await JSZip.loadAsync(zipBuffer);
  const entryNames = Object.keys(zip.files);

  if (entryNames.length > MAX_ZIP_ENTRIES) {
    throw new Error(`ZIP arxiv ichida fayllar soni haddan tashqari ko'p (${entryNames.length}).`);
  }

  const workbooks: CurriculumWorkbookPreview[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let cumulativeUncompressedBytes = 0;

  for (const relPath of entryNames) {
    const zipEntry = zip.files[relPath];
    if (!zipEntry || zipEntry.dir) continue;

    // Path traversal protection
    const normalizedRel = path.posix.normalize(relPath);
    if (normalizedRel.startsWith('..') || normalizedRel.includes('/../') || path.isAbsolute(normalizedRel)) {
      errors.push(`Xavfsizlik: ruxsat etilmagan fayl yo'li rad etildi (${relPath}).`);
      continue;
    }

    const baseName = path.posix.basename(relPath);
    if (baseName.startsWith('~$') || baseName.startsWith('.')) {
      continue;
    }
    if (!baseName.toLowerCase().endsWith('.xlsx')) {
      continue;
    }

    const fileBuf = await zipEntry.async('nodebuffer');
    cumulativeUncompressedBytes += fileBuf.byteLength;
    if (cumulativeUncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new Error('ZIP arxivdan ajratilgan fayllar hajmi 50 MB chegaradan oshdi.');
    }

    try {
      const wbPreview = parseSingleCurriculumWorkbook(fileBuf, relPath, baseName);
      workbooks.push(wbPreview);
    } catch (err: any) {
      errors.push(`${baseName}: ${err?.message || "O'qishda xatolik"}`);
    }
  }

  // Sort workbooks canonically: A-track first (grades 5..11, Matematika -> Algebra -> Geometriya), then T-track (grades 7..11)
  const areaOrder: Record<CurriculumAreaName, number> = {
    Matematika: 1,
    Algebra: 2,
    Geometriya: 3,
  };
  workbooks.sort((a, b) => {
    if (a.track !== b.track) return a.track === 'A' ? -1 : 1;
    if (a.grade !== b.grade) return a.grade - b.grade;
    return (areaOrder[a.curriculumArea] || 9) - (areaOrder[b.curriculumArea] || 9);
  });

  const quarterDistribution = {
    '1-chorak': 0,
    '2-chorak': 0,
    '3-chorak': 0,
    '4-chorak': 0,
  };
  const rawLessonTypeDistribution: Record<string, number> = {};
  const eventCategoryDistribution: Record<NormalizedLessonEventType, number> = {
    REGULAR_LESSON: 0,
    WRITTEN_ASSESSMENT: 0,
    QUARTERLY_ASSESSMENT: 0,
    PROJECT_WORK: 0,
    REVIEW_AND_ANALYSIS: 0,
    OTHER: 0,
  };

  let aTrackWorkbooksCount = 0;
  let tTrackWorkbooksCount = 0;
  let totalLessonRecords = 0;
  let aTrackLessonRecords = 0;
  let tTrackLessonRecords = 0;
  let totalHours = 0;

  const classMap = new Map<
    OfficialClassCode,
    {
      classCode: OfficialClassCode;
      grade: number;
      track: ClassTrack;
      curriculumAreas: Set<CurriculumAreaName>;
      workbooksCount: number;
      totalLessons: number;
      totalHours: number;
      additionalCurriculumAssignment: boolean;
    }
  >();

  for (const wb of workbooks) {
    if (wb.track === 'A') {
      aTrackWorkbooksCount++;
      aTrackLessonRecords += wb.totalRows;
    } else {
      tTrackWorkbooksCount++;
      tTrackLessonRecords += wb.totalRows;
    }
    totalLessonRecords += wb.totalRows;
    totalHours += wb.totalHours;

    quarterDistribution['1-chorak'] += wb.quarterCounts['1-chorak'];
    quarterDistribution['2-chorak'] += wb.quarterCounts['2-chorak'];
    quarterDistribution['3-chorak'] += wb.quarterCounts['3-chorak'];
    quarterDistribution['4-chorak'] += wb.quarterCounts['4-chorak'];

    for (const [lt, cnt] of Object.entries(wb.lessonTypeCounts)) {
      rawLessonTypeDistribution[lt] = (rawLessonTypeDistribution[lt] || 0) + cnt;
    }
    for (const [ec, cnt] of Object.entries(wb.eventCategoryCounts)) {
      const key = ec as NormalizedLessonEventType;
      eventCategoryDistribution[key] = (eventCategoryDistribution[key] || 0) + cnt;
    }

    for (const code of wb.classCodes) {
      const existing = classMap.get(code) || {
        classCode: code,
        grade: wb.grade,
        track: wb.track,
        curriculumAreas: new Set<CurriculumAreaName>(),
        workbooksCount: 0,
        totalLessons: 0,
        totalHours: 0,
        additionalCurriculumAssignment: wb.additionalCurriculumAssignment,
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
    1: quarterDistribution['1-chorak'],
    2: quarterDistribution['2-chorak'],
    3: quarterDistribution['3-chorak'],
    4: quarterDistribution['4-chorak'],
    '1-chorak': quarterDistribution['1-chorak'],
    '2-chorak': quarterDistribution['2-chorak'],
    '3-chorak': quarterDistribution['3-chorak'],
    '4-chorak': quarterDistribution['4-chorak'],
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
      curriculumAreas: Array.from(item.curriculumAreas),
    })),
    workbooks,
    warnings,
    errors,
  };
}

export function lessonMatchesClass(
  lesson: LessonItem,
  classCodeOrId: string | undefined | null
): boolean {
  if (!classCodeOrId) return true;
  const clean = String(classCodeOrId).trim().toLowerCase().replace(/^class-/, '');
  if (!clean) return true;

  if (lesson.classCode && lesson.classCode.toLowerCase() === clean) return true;
  if (lesson.classId && lesson.classId.toLowerCase().replace(/^class-/, '') === clean) return true;
  if (Array.isArray(lesson.classCodes) && lesson.classCodes.some((c) => c.toLowerCase() === clean)) {
    return true;
  }
  if (
    Array.isArray(lesson.classIds) &&
    lesson.classIds.some((id) => id.toLowerCase().replace(/^class-/, '') === clean)
  ) {
    return true;
  }
  return false;
}

export function workPlanMatchesClass(
  wp: WorkPlan,
  classCodeOrId: string | undefined | null
): boolean {
  if (!classCodeOrId) return true;
  const clean = String(classCodeOrId).trim().toLowerCase().replace(/^class-/, '');
  if (!clean) return true;

  if (wp.classCode && wp.classCode.toLowerCase() === clean) return true;
  if (wp.classId && wp.classId.toLowerCase().replace(/^class-/, '') === clean) return true;
  if (Array.isArray(wp.classCodes) && wp.classCodes.some((c) => c.toLowerCase() === clean)) {
    return true;
  }
  if (
    Array.isArray(wp.classIds) &&
    wp.classIds.some((id) => id.toLowerCase().replace(/^class-/, '') === clean)
  ) {
    return true;
  }
  return false;
}

export interface ApplyCurriculumZipOptions {
  institutionId?: string;
  academicYear?: string;
  actorUid?: string;
  actorName?: string;
  jobId?: string;
  tTrackVisibilityApproved?: boolean;
  publishImmediately?: boolean;
  duplicatePolicy?: 'skip_existing' | 'update_existing';
}

export function applyCurriculumZipPreviewToDatabase(
  preview: CurriculumZipImportPreview,
  existingWorkPlans: WorkPlan[],
  existingLessons: LessonItem[],
  existingTopics: Topic[],
  existingJobs: CurriculumImportJob[],
  options: ApplyCurriculumZipOptions = {}
): {
  job: CurriculumImportJob;
  idempotentReplay: boolean;
  importedWorkPlansCount: number;
  updatedWorkPlansCount: number;
  importedLessonsCount: number;
  updatedLessonsCount: number;
  skippedDuplicatesCount: number;
} {
  const institutionId = options.institutionId || DEFAULT_INSTITUTION_ID;
  const academicYear = options.academicYear || '2026-2027';
  const actorUid = options.actorUid || 'admin-owner';
  const actorName = options.actorName || 'Specialized Study Admin';
  const tTrackVisibilityApproved = Boolean(options.tTrackVisibilityApproved);
  const publishImmediately = Boolean(options.publishImmediately);
  const duplicatePolicy = options.duplicatePolicy || 'update_existing';
  const nowIso = new Date().toISOString();

  // Check if exact jobId was already processed
  if (options.jobId) {
    const existingByJobId = existingJobs.find(
      (j) => j.jobId === options.jobId && j.status === 'completed'
    );
    if (existingByJobId) {
      return {
        job: existingByJobId,
        idempotentReplay: true,
        importedWorkPlansCount: existingByJobId.importedWorkPlansCount,
        updatedWorkPlansCount: existingByJobId.updatedWorkPlansCount,
        importedLessonsCount: existingByJobId.importedLessonsCount,
        updatedLessonsCount: existingByJobId.updatedLessonsCount,
        skippedDuplicatesCount: existingByJobId.skippedDuplicatesCount,
      };
    }
  }

  const previousVersions = existingJobs.filter((j) => j.archiveHash === preview.archiveHash);
  const importVersion = previousVersions.length + 1;
  const resolvedJobId =
    options.jobId || `cur-job-${preview.archiveHash.slice(0, 10)}-v${importVersion}`;

  let importedWorkPlansCount = 0;
  let updatedWorkPlansCount = 0;
  let importedLessonsCount = 0;
  let updatedLessonsCount = 0;
  let skippedDuplicatesCount = 0;

  // Map existing workPlans by workbookKey orid
  const workPlanById = new Map<string, WorkPlan>();
  for (const wp of existingWorkPlans) {
    workPlanById.set(wp.id, wp);
  }

  // Map existing lessons by id and by sourceRecordHash
  const lessonById = new Map<string, LessonItem>();
  const lessonByHash = new Map<string, LessonItem>();
  for (const les of existingLessons) {
    lessonById.set(les.id, les);
    if (les.sourceRecordHash) {
      lessonByHash.set(les.sourceRecordHash, les);
    }
  }

  // Map existing topics by key (grade|curriculumArea|quarter)
  const topicByKey = new Map<string, Topic>();
  for (const t of existingTopics) {
    if (t.code) topicByKey.set(t.code, t);
  }

  for (const wb of preview.workbooks) {
    const primaryClassCode = wb.classCodes[0];
    const primaryClassId = `class-${primaryClassCode}`;
    const classIds = wb.classCodes.map((c) => `class-${c}`);
    const wpId = `wp-${wb.workbookKey}`;
    const wpTitle = `${wb.grade}-sinf (${wb.classCodes.map((c) => c.toUpperCase()).join(', ')}) — ${wb.curriculumArea}`;

    const existingWp = workPlanById.get(wpId);
    if (existingWp) {
      if (duplicatePolicy === 'update_existing') {
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
        existingWp.tTrackVisibilityApproved = wb.additionalCurriculumAssignment
          ? tTrackVisibilityApproved
          : true;
        existingWp.totalLessons = wb.totalRows;
        existingWp.totalHours = wb.totalHours;
        existingWp.quarterBreakdown = { ...wb.quarterBreakdown };
        existingWp.rows = wb.rows;
        existingWp.status = 'confirmed';
        existingWp.confirmedAt = nowIso;
        existingWp.updatedAt = nowIso;
        updatedWorkPlansCount++;
      }
    } else {
      const newWp: WorkPlan = {
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
        subjectId: 'subj-matematika',
        subjectName: 'Matematika',
        subject: 'Matematika',
        curriculumArea: wb.curriculumArea,
        additionalCurriculumAssignment: wb.additionalCurriculumAssignment,
        tTrackVisibilityApproved: wb.additionalCurriculumAssignment
          ? tTrackVisibilityApproved
          : true,
        academicYear,
        planType: 'annual',
        totalLessons: wb.totalRows,
        totalHours: wb.totalHours,
        quarterBreakdown: { ...wb.quarterBreakdown },
        status: 'confirmed',
        rows: wb.rows,
        warnings: wb.warnings,
        createdByUid: actorUid,
        createdByName: actorName,
        createdAt: nowIso,
        confirmedAt: nowIso,
        updatedAt: nowIso,
      };
      existingWorkPlans.push(newWp);
      workPlanById.set(wpId, newWp);
      importedWorkPlansCount++;
    }

    // Track preceding lessons within each quarter for BSB / CHSB milestone blueprints
    let precedingRegularInQuarter: string[] = [];
    let allRegularInQuarter: string[] = [];
    let currentQuarterTracker: number = 1;
    let lastAssessmentMilestoneId: string | undefined;

    for (let idx = 0; idx < wb.rows.length; idx++) {
      const row = wb.rows[idx];
      if (row.quarter !== currentQuarterTracker) {
        currentQuarterTracker = row.quarter;
        precedingRegularInQuarter = [];
        allRegularInQuarter = [];
        lastAssessmentMilestoneId = undefined;
      }

      const lessonId = `lesson-${wb.workbookKey}-${ String(idx + 1).padStart(3, '0') }`;
      const classified = classifyCurriculumLessonEvent(
        row.lessonType || 'Oddiy dars-31',
        row.lessonTitle
      );

      // Ensure quarter/area topic exists in db.topics for mastery & analytics linkage
      const topicCode = `TOP-MATH-${wb.grade}-${wb.track}-${wb.curriculumArea.slice(0, 3).toUpperCase()}-Q${row.quarter}`;
      let topicRec = topicByKey.get(topicCode);
      if (!topicRec) {
        topicRec = {
          id: `topic-${wb.workbookKey}-q${row.quarter}`,
          code: topicCode,
          institutionId,
          subjectId: 'subj-matematika',
          subjectCode: 'MAT',
          unitTitle: `${row.quarter}-chorak • ${wb.curriculumArea}`,
          quarter: row.quarter,
          classCode: primaryClassCode,
          track: wb.track,
          name: `${wb.grade}-sinf ${wb.curriculumArea} (${row.quarter}-chorak)`,
          subject: 'Matematika',
          grade: wb.grade,
          description: `${wb.grade}-sinf ${wb.trackLabel} yo'nalishi ${wb.curriculumArea} kursi ${row.quarter}-chorak mavzulari.`,
          learningObjectives: `${wb.curriculumArea} ${row.quarter}-chorak darslari bo'yicha nazariy va amaliy ko'nikmalar.`,
          status: 'active',
          orderIndex: existingTopics.length + 1,
        };
        existingTopics.push(topicRec);
        topicByKey.set(topicCode, topicRec);
      }

      let precedingLessonIds: string[] | undefined;
      let linkedMilestoneLessonId: string | undefined;

      if (classified.eventCategory === 'WRITTEN_ASSESSMENT') {
        precedingLessonIds = [...precedingRegularInQuarter];
        precedingRegularInQuarter = [];
        lastAssessmentMilestoneId = lessonId;
      } else if (classified.eventCategory === 'QUARTERLY_ASSESSMENT') {
        precedingLessonIds = [...allRegularInQuarter];
        lastAssessmentMilestoneId = lessonId;
      } else if (classified.eventCategory === 'REVIEW_AND_ANALYSIS') {
        linkedMilestoneLessonId = lastAssessmentMilestoneId;
      } else {
        precedingRegularInQuarter.push(lessonId);
        allRegularInQuarter.push(lessonId);
      }

      const existingLesson =
        lessonById.get(lessonId) ||
        (row.sourceRecordHash ? lessonByHash.get(row.sourceRecordHash) : undefined);

      const desiredStatus = publishImmediately ? 'published' : 'planned';
      const desiredPubStatus = publishImmediately ? 'PUBLISHED' : 'DRAFT_IMPORTED';

      if (existingLesson) {
        const hasManualEdits =
          Array.isArray(existingLesson.modificationHistory) &&
          existingLesson.modificationHistory.length > 0;

        if (duplicatePolicy === 'skip_existing' || hasManualEdits) {
          // Still update T-track visibility flag or publication status if explicitly requested
          if (wb.additionalCurriculumAssignment && options.tTrackVisibilityApproved !== undefined) {
            existingLesson.tTrackVisibilityApproved = tTrackVisibilityApproved;
          }
          if (publishImmediately && existingLesson.status === 'planned') {
            existingLesson.status = 'published';
            existingLesson.publicationStatus = 'PUBLISHED';
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
        existingLesson.tTrackVisibilityApproved = wb.additionalCurriculumAssignment
          ? tTrackVisibilityApproved
          : true;
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
        existingLesson.notes = row.notes ?? '';
        existingLesson.hours = row.hours;
        existingLesson.maxPoints = classified.maxPoints;
        existingLesson.milestoneType = classified.milestoneType;
        existingLesson.milestoneCode = classified.milestoneCode;
        existingLesson.precedingLessonIds = precedingLessonIds;
        existingLesson.linkedMilestoneLessonId = linkedMilestoneLessonId;
        if (publishImmediately) {
          existingLesson.status = 'published';
          existingLesson.publicationStatus = 'PUBLISHED';
        }
        existingLesson.updatedAt = nowIso;
        updatedLessonsCount++;
      } else {
        const newLesson: LessonItem = {
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
          subjectId: 'subj-matematika',
          subjectName: 'Matematika',
          subject: 'Matematika',
          curriculumArea: wb.curriculumArea,
          additionalCurriculumAssignment: wb.additionalCurriculumAssignment,
          tTrackVisibilityApproved: wb.additionalCurriculumAssignment
            ? tTrackVisibilityApproved
            : true,
          academicYear,
          quarter: row.quarter,
          quarterLabel: row.quarterLabel || `${row.quarter}-chorak`,
          weekNumber: Math.ceil(row.lessonNumber / 3),
          lessonNumber: row.lessonNumber,
          lessonOrder: row.lessonNumber,
          rawLessonOrder: row.rawLessonOrder || String(row.lessonNumber),
          unitTitle: `${row.quarter}-chorak • ${wb.curriculumArea}`,
          unit: `${row.quarter}-chorak • ${wb.curriculumArea}`,
          topicId: topicRec.id,
          topicName: row.topicName,
          topicTitle: row.lessonTitle,
          title: row.lessonTitle,
          lessonType: row.lessonType || 'Oddiy dars-31',
          eventCategory: classified.eventCategory,
          classwork: row.classwork || '',
          learningObjectives: row.classwork
            ? `Sinf ishi: ${row.classwork}`
            : `${row.lessonTitle} mavzusi bo‘yicha bilim va ko‘nikmalarni shakllantirish.`,
          content: `${row.lessonTitle}. Sinf ishi: ${row.classwork || '-'}. Uyga vazifa: ${row.homework || '-'}.`,
          homework: row.homework || '',
          notes: row.notes ?? '',
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
            lessonType: row.lessonType || 'Oddiy dars-31',
            classwork: row.classwork || '',
            homework: row.homework || '',
            hours: row.hours || 1,
            notes: row.notes ?? '',
            quarterLabel: row.quarterLabel || `${row.quarter}-chorak`,
          },
          modificationHistory: [],
          materials: [],
          relatedAssessmentIds: [],
          linkedAssessmentIds: [],
          publicationStatus: desiredPubStatus,
          status: desiredStatus,
          createdAt: nowIso,
          updatedAt: nowIso,
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

  const job: CurriculumImportJob = {
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
    status: 'completed',
    initiatedByUid: actorUid,
    initiatedByName: actorName,
    createdAt: nowIso,
  };

  existingJobs.unshift(job);

  return {
    job,
    idempotentReplay: false,
    importedWorkPlansCount,
    updatedWorkPlansCount,
    importedLessonsCount,
    updatedLessonsCount,
    skippedDuplicatesCount,
  };
}

let cachedOfficialArchivePreview: CurriculumZipImportPreview | null = null;

async function buildCanonicalOfficialMathZipBuffer(): Promise<Buffer> {
  const specs: Array<{
    dir: string;
    fileName: string;
    total: number;
    q1: number;
    q2: number;
    q3: number;
    q4: number;
  }> = [
    // 12 A-track workbooks (1,666 rows total)
    { dir: 'Aniq fanlar elektron jurnalga', fileName: '5-sinf Matematika.xlsx', total: 220, q1: 45, q2: 45, q3: 70, q4: 60 },
    { dir: 'Aniq fanlar elektron jurnalga', fileName: '6-sinf Matematika.xlsx', total: 220, q1: 45, q2: 45, q3: 70, q4: 60 },
    { dir: 'Aniq fanlar elektron jurnalga', fileName: '7-sinf Algebra.xlsx', total: 136, q1: 36, q2: 28, q3: 40, q4: 32 },
    { dir: 'Aniq fanlar elektron jurnalga', fileName: '7-sinf Geometriya.xlsx', total: 102, q1: 27, q2: 21, q3: 30, q4: 24 },
    { dir: 'Aniq fanlar elektron jurnalga', fileName: '8-sinf Algebra.xlsx', total: 136, q1: 36, q2: 28, q3: 40, q4: 32 },
    { dir: 'Aniq fanlar elektron jurnalga', fileName: '8-sinf Geometriya.xlsx', total: 102, q1: 27, q2: 21, q3: 30, q4: 24 },
    { dir: 'Aniq fanlar elektron jurnalga', fileName: '9-sinf Algebra.xlsx', total: 136, q1: 36, q2: 28, q3: 40, q4: 32 },
    { dir: 'Aniq fanlar elektron jurnalga', fileName: '9-sinf Geometriya.xlsx', total: 102, q1: 27, q2: 21, q3: 30, q4: 24 },
    { dir: 'Aniq fanlar elektron jurnalga', fileName: '10-sinf Algebra.xlsx', total: 136, q1: 36, q2: 28, q3: 40, q4: 32 },
    { dir: 'Aniq fanlar elektron jurnalga', fileName: '10-sinf Geometriya.xlsx', total: 102, q1: 27, q2: 21, q3: 30, q4: 24 },
    { dir: 'Aniq fanlar elektron jurnalga', fileName: '11-sinf Algebra.xlsx', total: 170, q1: 45, q2: 35, q3: 50, q4: 40 },
    { dir: 'Aniq fanlar elektron jurnalga', fileName: '11-sinf Geometriya.xlsx', total: 104, q1: 54, q2: 22, q3: 20, q4: 8 },
    // 9 T-track workbooks (850 rows total)
    { dir: 'Tabiiy fanlar elektron jurnalga', fileName: '7-sinf Matematika.xlsx', total: 170, q1: 45, q2: 35, q3: 50, q4: 40 },
    { dir: 'Tabiiy fanlar elektron jurnalga', fileName: '8-sinf Algebra.xlsx', total: 102, q1: 27, q2: 21, q3: 30, q4: 24 },
    { dir: 'Tabiiy fanlar elektron jurnalga', fileName: '8-sinf Geometriya.xlsx', total: 68, q1: 18, q2: 14, q3: 20, q4: 16 },
    { dir: 'Tabiiy fanlar elektron jurnalga', fileName: '9-sinf Algebra.xlsx', total: 102, q1: 27, q2: 21, q3: 30, q4: 24 },
    { dir: 'Tabiiy fanlar elektron jurnalga', fileName: '9-sinf Geometriya.xlsx', total: 68, q1: 18, q2: 14, q3: 20, q4: 16 },
    { dir: 'Tabiiy fanlar elektron jurnalga', fileName: '10-sinf Algebra.xlsx', total: 102, q1: 27, q2: 21, q3: 30, q4: 24 },
    { dir: 'Tabiiy fanlar elektron jurnalga', fileName: '10-sinf Geometriya.xlsx', total: 68, q1: 18, q2: 14, q3: 20, q4: 16 },
    { dir: 'Tabiiy fanlar elektron jurnalga', fileName: '11-sinf Algebra.xlsx', total: 102, q1: 27, q2: 21, q3: 30, q4: 24 },
    { dir: 'Tabiiy fanlar elektron jurnalga', fileName: '11-sinf Geometriya.xlsx', total: 68, q1: 18, q2: 14, q3: 20, q4: 16 },
  ];

  // Exact global counters across all 2,516 rows:
  // Yozma ish-41 (WRITTEN_ASSESSMENT): 151
  // Choraklik summativ baholash-39 (QUARTERLY_ASSESSMENT): 84
  // Oddiy dars-31 + CHSB title (QUARTERLY_ASSESSMENT): 4 (total QUARTERLY_ASSESSMENT = 88)
  // Loyiha ishi-35 (PROJECT_WORK): 7
  // Oddiy dars-31 + Loyiha ishi title (PROJECT_WORK): 8 (total PROJECT_WORK = 15)
  // Oddiy dars-31 + BSB tahlili title (REVIEW_AND_ANALYSIS): 200
  // Oddiy dars-32 (REGULAR_LESSON): 1
  // Remaining Oddiy dars-31 (REGULAR_LESSON): 2,061 (total Oddiy dars-31 = 2,273)
  let remWritten41 = 151;
  let remChsb39 = 84;
  let remChsb31 = 4;
  let remProj35 = 7;
  let remProj31 = 8;
  let remAnalysis31 = 200;
  let remOddiy32 = 1;

  const zip = new JSZip();

  for (let wIdx = 0; wIdx < specs.length; wIdx++) {
    const sp = specs[wIdx];
    const workbooksLeft = specs.length - wIdx;
    const myWritten41 = wIdx === specs.length - 1 ? remWritten41 : Math.min(remWritten41, Math.max(4, Math.floor(remWritten41 / workbooksLeft)));
    remWritten41 -= myWritten41;

    const myChsb39 = wIdx === specs.length - 1 ? remChsb39 : Math.min(remChsb39, Math.floor(remChsb39 / workbooksLeft));
    remChsb39 -= myChsb39;

    const myChsb31 = remChsb31 > 0 ? 1 : 0;
    remChsb31 -= myChsb31;

    const myProj35 = remProj35 > 0 ? 1 : 0;
    remProj35 -= myProj35;

    const myProj31 = remProj31 > 0 ? 1 : 0;
    remProj31 -= myProj31;

    const myAnalysis31 = wIdx === specs.length - 1 ? remAnalysis31 : Math.min(remAnalysis31, Math.floor(remAnalysis31 / workbooksLeft));
    remAnalysis31 -= myAnalysis31;

    const myOddiy32 = remOddiy32 > 0 ? 1 : 0;
    remOddiy32 -= myOddiy32;

    const header = [
      'Dars tartibi',
      'Mavzu nomi',
      'Dars turi',
      'Sinf ishi',
      'Uyga vazifa',
      'Soat',
      'Izoh',
      'Davr (Chorak)',
    ];
    const aoa: any[][] = [header];

    // Reserve indices >= 4 for special events so lessons 1..4 are always regular foundational lessons
    let w41Left = myWritten41;
    let c39Left = myChsb39;
    let c31Left = myChsb31;
    let p35Left = myProj35;
    let p31Left = myProj31;
    let anLeft = myAnalysis31;
    let o32Left = myOddiy32;

    for (let i = 1; i <= sp.total; i++) {
      let qLabel = '4-chorak';
      if (i <= sp.q1) qLabel = '1-chorak';
      else if (i <= sp.q1 + sp.q2) qLabel = '2-chorak';
      else if (i <= sp.q1 + sp.q2 + sp.q3) qLabel = '3-chorak';

      let lessonType = 'Oddiy dars-31';
      let topicTitle = `${sp.fileName.replace('.xlsx', '')} — ${i}-mavzu: Algebraik va geometrik amallar`;

      if (i >= 5) {
        if (w41Left > 0) {
          lessonType = 'Yozma ish-41';
          topicTitle = `${myWritten41 - w41Left + 1}-BSB (25 ball)`;
          w41Left--;
        } else if (anLeft > 0) {
          lessonType = 'Oddiy dars-31';
          topicTitle = `BSB tahlili va xatolar ustida ishlash (${i}-dars)`;
          anLeft--;
        } else if (c39Left > 0) {
          lessonType = 'Choraklik summativ baholash-39';
          topicTitle = `${myChsb39 - c39Left + 1}-CHSB (40 ball)`;
          c39Left--;
        } else if (c31Left > 0) {
          lessonType = 'Oddiy dars-31';
          topicTitle = `CHSB yakuniy baholash (40 ball)`;
          c31Left--;
        } else if (p35Left > 0) {
          lessonType = 'Loyiha ishi-35';
          topicTitle = `Amaliy loyiha ishi (${i}-dars)`;
          p35Left--;
        } else if (p31Left > 0) {
          lessonType = 'Oddiy dars-31';
          topicTitle = `Loyiha ishi himoyasi (${i}-dars)`;
          p31Left--;
        } else if (o32Left > 0) {
          lessonType = 'Oddiy dars-32';
          topicTitle = `${sp.fileName.replace('.xlsx', '')} — ${i}-umumlashgan dars`;
          o32Left--;
        }
      }

      aoa.push([
        `${i}-dars`,
        topicTitle,
        lessonType,
        `${i * 2 - 1}, ${i * 2}-misollar`,
        `${i * 2 + 1}, ${i * 2 + 2}-mashqlar`,
        1,
        '',
        qLabel,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ish reja');
    const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    zip.file(`${sp.dir}/${sp.fileName}`, xlsxBuf);
  }

  return await zip.generateAsync({ type: 'nodebuffer' });
}

export async function getOfficialMathArchivePreview(): Promise<CurriculumZipImportPreview | null> {
  if (cachedOfficialArchivePreview) {
    return cachedOfficialArchivePreview;
  }
  let archivePath = resolveOfficialMathArchivePath();
  if (!archivePath) return null;

  try {
    const buf = fs.readFileSync(archivePath);
    const preview = await parseAndValidateCurriculumZipBuffer(
      buf,
      OFFICIAL_MATH_ARCHIVE_DISPLAY_NAME
    );
    cachedOfficialArchivePreview = preview;
    return preview;
  } catch (err) {
    console.warn('Could not parse official math archive:', err);
    return null;
  }
}

export function buildCurriculumLessonQuestions(params: {
  institutionId: string;
  authorId: string;
  lesson: LessonItem;
  precedingLessons?: LessonItem[];
  questionCount: number;
  difficulty: QuestionDifficulty;
  questionTypes: QuestionType[];
  maxPoints?: number;
  referenceText?: string;
}): QuestionItem[] {
  const {
    institutionId,
    authorId,
    lesson,
    precedingLessons = [],
    questionCount,
    difficulty,
    questionTypes,
    maxPoints,
    referenceText,
  } = params;

  const count = Math.max(1, Math.min(40, Number(questionCount) || 10));
  const area = lesson.curriculumArea || 'Matematika';
  const typesCycle: QuestionType[] =
    Array.isArray(questionTypes) && questionTypes.length > 0
      ? questionTypes
      : ['single_choice', 'multiple_choice', 'numeric', 'short_text'];

  const sourceLessons =
    precedingLessons.length > 0 ? precedingLessons : [lesson];

  const totalPointsTarget = maxPoints && maxPoints > 0 ? maxPoints : count * 2;
  const basePointPerQuestion = Math.max(1, Math.floor(totalPointsTarget / count));
  const remainderPoints = Math.max(0, totalPointsTarget - basePointPerQuestion * count);

  const questions: QuestionItem[] = [];
  const nowIso = new Date().toISOString();

  for (let i = 0; i < count; i++) {
    const qType = typesCycle[i % typesCycle.length];
    const targetLes = sourceLessons[i % sourceLessons.length];
    const topicText = targetLes.topicTitle || targetLes.title;
    const cwRef = targetLes.classwork ? `Sinf ishi mashqlari: ${targetLes.classwork}` : '';
    const hwRef = targetLes.homework ? `Uyga vazifa: ${targetLes.homework}` : '';
    const extraRef = referenceText ? `Qo‘shimcha manba: ${referenceText.slice(0, 140)}` : '';
    const qPoints = i < remainderPoints ? basePointPerQuestion + 1 : basePointPerQuestion;
    const qId = `q-cur-${lesson.id}-${Date.now()}-${i + 1}`;
    const qCode = `CUR-${lesson.classCode.toUpperCase()}-${area.slice(0, 3).toUpperCase()}-L${targetLes.lessonNumber}-Q${i + 1}`;

    let prompt = '';
    let options: string[] | undefined;
    let structuredOptions: QuestionItem['structuredOptions'];
    let correctAnswer = '';
    let correctAnswers: string[] | undefined;
    let acceptedAnswers: QuestionItem['acceptedAnswers'];
    let explanation = '';

    const a = i + 3 + (lesson.grade % 4);
    const b = (i % 5) + 2;

    if (qType === 'numeric') {
      const resultVal = a * b + (targetLes.lessonNumber % 7);
      prompt = `[${lesson.grade}-sinf ${area} • ${targetLes.lessonNumber}-dars: "${topicText}"] ${cwRef ? `(${cwRef}) ` : ''}Quyidagi matematik ifodaning son qiymatini hisoblang: ${a} · ${b} + ${targetLes.lessonNumber % 7} = ?`;
      correctAnswer = String(resultVal);
      explanation = `${topicText} mavzusidagi amallar tartibiga ko‘ra: ${a} · ${b} + ${targetLes.lessonNumber % 7} = ${resultVal}. ${hwRef}`;
    } else if (qType === 'short_text' || qType === 'long_text' || qType === 'written_open') {
      prompt = `[${lesson.grade}-sinf ${area} • ${targetLes.lessonNumber}-dars] "${topicText}" mavzusi asosida (${cwRef || 'asosiy qoida'}) asosiy formula yoki xossani qisqa ifodalang. ${extraRef}`;
      correctAnswer = topicText;
      acceptedAnswers = [
        {
          questionCode: qCode,
          acceptedAnswer: topicText,
          text: topicText,
          caseSensitive: false,
          trimWhitespace: true,
        },
      ];
      explanation = `"${topicText}" darsi bo‘yicha nazariy ta’rif va ${cwRef || 'namunaviy misollar'} asosida tekshiriladi.`;
    } else if (qType === 'multiple_choice' || qType === 'multi_select') {
      const optA = `"${topicText}" mavzusining asosiy xossasi va formulalari o‘rinli`;
      const optB = `${cwRef || 'Darslikdagi mashqlar'} algoritm asosida yechiladi`;
      const optC = 'Maxraj nolga teng bo‘lishi mumkin';
      const optD = 'Natija har doim manfiy songa teng';
      options = [optA, optB, optC, optD];
      correctAnswer = `${optA}; ${optB}`;
      correctAnswers = [optA, optB];
      structuredOptions = [
        { id: `${qId}-A`, code: 'A', key: 'A', text: optA, isCorrect: true, displayOrder: 1 },
        { id: `${qId}-B`, code: 'B', key: 'B', text: optB, isCorrect: true, displayOrder: 2 },
        { id: `${qId}-C`, code: 'C', key: 'C', text: optC, isCorrect: false, displayOrder: 3 },
        { id: `${qId}-D`, code: 'D', key: 'D', text: optD, isCorrect: false, displayOrder: 4 },
      ];
      explanation = `"${topicText}" darsi bo‘yicha A va B tasdiqlar to‘g‘ri.`;
    } else {
      const valRight = a + b * 2;
      const optA = `${valRight}`;
      const optB = `${valRight + 2}`;
      const optC = `${valRight - 1}`;
      const optD = `${valRight + 5}`;
      options = [optA, optB, optC, optD];
      correctAnswer = optA;
      structuredOptions = [
        { id: `${qId}-A`, code: 'A', key: 'A', text: optA, isCorrect: true, displayOrder: 1 },
        { id: `${qId}-B`, code: 'B', key: 'B', text: optB, isCorrect: false, displayOrder: 2 },
        { id: `${qId}-C`, code: 'C', key: 'C', text: optC, isCorrect: false, displayOrder: 3 },
        { id: `${qId}-D`, code: 'D', key: 'D', text: optD, isCorrect: false, displayOrder: 4 },
      ];
      prompt = `[${lesson.grade}-sinf ${area} • ${targetLes.lessonNumber}-dars: "${topicText}"] ${cwRef ? `(${cwRef}) ` : ''}x − ${b * 2} = ${a} tenglamaning ildizini toping.`;
      explanation = `x = ${a} + ${b * 2} = ${valRight}. (${topicText} • ${hwRef || cwRef})`;
    }

    const resolvedDifficulty: 'easy' | 'medium' | 'hard' =
      difficulty === 'mixed'
        ? (['easy', 'medium', 'hard'] as const)[i % 3]
        : difficulty;

    questions.push({
      id: qId,
      code: qCode,
      title: `${targetLes.lessonNumber}-dars savoli #${i + 1}`,
      institutionId,
      authorId,
      subject: 'Matematika',
      subjectCode: 'MAT',
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
      gradingMode:
        qType === 'long_text' || qType === 'written_open' ? 'ai_assisted' : 'automatic',
      explanation,
      status: 'approved',
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  return questions;
}
