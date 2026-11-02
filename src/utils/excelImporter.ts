import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {
  Topic,
  QuestionItem,
  QuestionType,
  QuestionDifficulty,
  GradingMode,
  QuestionOption,
  AcceptedAnswer,
  ImportValidationError,
} from '../types';
import { isSafeArchivePath, validateUploadedImageMeta } from './security';

export const TEMPLATE_FILENAME = 'LearnOS_Assessment_Import_Template.xlsx';

export const REQUIRED_SHEETS = [
  'Instructions',
  'Assessment',
  'Questions',
  'Options',
  'AcceptedAnswers',
  'Topics',
] as const;

export const ASSESSMENT_COLUMNS = [
  'assessment_code',
  'assessment_title',
  'description',
  'subject_code',
  'grade',
  'duration_minutes',
  'maximum_attempts',
  'instructions',
  'availability_start',
  'availability_end',
] as const;

export const QUESTIONS_COLUMNS = [
  'question_code',
  'question_type',
  'question_text',
  'question_image',
  'subject_code',
  'grade',
  'topic_code',
  'difficulty',
  'points',
  'explanation',
  'grading_mode',
  'rubric',
  'numeric_correct_answer',
  'numeric_tolerance',
] as const;

export const OPTIONS_COLUMNS = [
  'question_code',
  'option_code',
  'option_text',
  'option_image',
  'is_correct',
  'display_order',
] as const;

export const ACCEPTED_ANSWERS_COLUMNS = [
  'question_code',
  'accepted_answer',
  'case_sensitive',
  'trim_whitespace',
] as const;

export const TOPICS_COLUMNS = [
  'topic_code',
  'topic_name',
  'subject_code',
  'grade',
  'description',
  'usage_note',
] as const;

export function generateLearnOSExcelTemplateBuffer(topics: Topic[] = []): Uint8Array {
  const wb = XLSX.utils.book_new();

  // SHEET 1: Instructions (Uzbek Latin)
  const instructionRows = [
    ['LEARNOS — DIAGNOSTIK TEST VA SAVOLLAR BAZASI IMPORT SHABLONI (.XLSX / .ZIP)'],
    [''],
    ['1. UMUMIY QOIDALAR'],
    [
      "Ushbu shablon orqali yuzlab test savollarini, javob variantlarini, qisqa/uzun yozma savollarni hamda rasmlarni (.zip paket ichida) bir vaqtda yuklashingiz mumkin.",
    ],
    [
      "Shablonda hech qanday soxta (demo) savollar yo'q. Faqat o'zingizning haqiqiy o'quv savollaringizni kiriting.",
    ],
    [''],
    ['2. VARAQLAR (SHEETS) TAVSIFI'],
    [
      '• Instructions: Ushbu yo‘riqnoma varag‘i.',
    ],
    [
      "• Assessment: Agar yuklanayotgan savollar yangi qoralama (DRAFT) testga biriktirilishini xohlasangiz, 1 qator test ma'lumotini kiriting. Bo'sh qoldirilsa, savollar to'g'ridan-to'g'ri Savollar bazasiga (Question Bank) qoralama sifatida qo'shiladi.",
    ],
    [
      '• Questions: Barcha savollar ro‘yxati. Har bir savolda noyob question_code bo‘lishi shart (masalan: Q-MAT8-001).',
    ],
    [
      '• Options: single_choice va multiple_choice turidagi savollar uchun javob variantlari.',
    ],
    [
      '• AcceptedAnswers: short_text (qisqa yozma javob) savollari uchun avtomatik tekshiriladigan qabul qilinuvchi javoblar.',
    ],
    [
      '• Topics: Tizimdagi mavjud rasmiy mavzu kodlari (topic_code). Noma’lum topic_code kiritilsa, validatsiya xato beradi.',
    ],
    [''],
    ['3. QO‘LLAB-QUVVATLANADIGAN SAVOL TURLARI (question_type)'],
    ['• single_choice — Bitta to‘g‘ri javobli test (Options varag‘ida aynan 1 ta is_correct = TRUE bo‘lishi shart).'],
    ['• multiple_choice — Bir nechta to‘g‘ri javobli test (Options varag‘ida kamida 1 ta is_correct = TRUE bo‘lishi shart).'],
    ['• numeric — Sonli javob (numeric_correct_answer majburiy, numeric_tolerance ixtiyoriy, masalan: 0.01).'],
    ['• short_text — Qisqa yozma javob (AcceptedAnswers varag‘ida qabul qilinadigan javoblar yoziladi yoki manual tekshiriladi).'],
    ['• long_text — Batafsil yozma javob / yechim (rubric ustunida baholash mezoni yoziladi; o‘qituvchi yoki AI yordamida tekshiriladi).'],
    [''],
    ['4. BAHOLASH REJIMLARI (grading_mode)'],
    ['• automatic — Server tomonidan kalit orqali avtomatik tekshiriladi.'],
    ['• manual — O‘qituvchi tomonidan qo‘lda tekshiriladi va ball qo‘yiladi.'],
    ['• ai_assisted — Gemini AI mezon (rubric) asosida dastlabki ballni tavsiya qiladi, o‘qituvchi tasdiqlaydi.'],
    [''],
    ['5. RASMLARNI .ZIP PAKET ORQALI YUKLASH TARTIBI'],
    ['• Agar savol yoki variantda rasm bo‘lsa, LearnOS_Assessment_Import_Template.xlsx fayli yonida media/ papkasini yarating.'],
    ['• Rasmlarni media/ papkasiga joylang (masalan: media/question_001.png, media/option_001_a.png).'],
    ['• Questions varag‘idagi question_image yoki Options varag‘idagi option_image ustuniga aniq nisbiy yo‘lni yozing: media/question_001.png'],
    ['• Ruxsat etilgan formatlar: PNG, JPEG, WebP (maksimal 5 MB).'],
  ];
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionRows);
  wsInstructions['!cols'] = [{ wch: 115 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  // SHEET 2: Assessment (Blank with headers)
  const wsAssessment = XLSX.utils.aoa_to_sheet([[...ASSESSMENT_COLUMNS]]);
  wsAssessment['!cols'] = ASSESSMENT_COLUMNS.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, wsAssessment, 'Assessment');

  // SHEET 3: Questions (Blank with headers)
  const wsQuestions = XLSX.utils.aoa_to_sheet([[...QUESTIONS_COLUMNS]]);
  wsQuestions['!cols'] = QUESTIONS_COLUMNS.map((c) =>
    c === 'question_text' || c === 'explanation' || c === 'rubric' ? { wch: 36 } : { wch: 20 }
  );
  XLSX.utils.book_append_sheet(wb, wsQuestions, 'Questions');

  // SHEET 4: Options (Blank with headers)
  const wsOptions = XLSX.utils.aoa_to_sheet([[...OPTIONS_COLUMNS]]);
  wsOptions['!cols'] = OPTIONS_COLUMNS.map((c) => (c === 'option_text' ? { wch: 32 } : { wch: 18 }));
  XLSX.utils.book_append_sheet(wb, wsOptions, 'Options');

  // SHEET 5: AcceptedAnswers (Blank with headers)
  const wsAccepted = XLSX.utils.aoa_to_sheet([[...ACCEPTED_ANSWERS_COLUMNS]]);
  wsAccepted['!cols'] = ACCEPTED_ANSWERS_COLUMNS.map(() => ({ wch: 24 }));
  XLSX.utils.book_append_sheet(wb, wsAccepted, 'AcceptedAnswers');

  // SHEET 6: Topics (Reference of authorized topic codes)
  const topicRows: any[][] = [[...TOPICS_COLUMNS]];
  for (const t of topics) {
    topicRows.push([
      t.code || t.id,
      t.name,
      t.subjectCode || 'MAT8',
      t.grade,
      t.description,
      "Questions varag'idagi topic_code ustunida ushbu koddan foydalaning",
    ]);
  }
  const wsTopics = XLSX.utils.aoa_to_sheet(topicRows);
  wsTopics['!cols'] = [
    { wch: 18 },
    { wch: 30 },
    { wch: 15 },
    { wch: 10 },
    { wch: 45 },
    { wch: 50 },
  ];
  XLSX.utils.book_append_sheet(wb, wsTopics, 'Topics');

  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new Uint8Array(out);
}

export function generateImportGuideMarkdown(topics: Topic[] = []): string {
  const topicLines = topics
    .map((t) => `- \`${t.code || t.id}\` — ${t.name} (${t.grade}-sinf ${t.subject})`)
    .join('\n');

  return `# LearnOS — Professional Excel (.xlsx) va ZIP Test Import Qo'llanmasi

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

export interface ExtractedMediaFile {
  relativePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

export interface ParsedAssessmentMeta {
  code: string;
  title: string;
  description: string;
  subject: string;
  subjectCode: string;
  grade: number;
  durationMinutes: number;
  passingScorePercent: number;
  shuffleQuestions: boolean;
  attemptLimit: number;
  maximumAttempts: number;
  instructions: string;
  availabilityStart?: string;
  availabilityEnd?: string;
}

export interface ParsedQuestionDraft {
  code: string;
  type: QuestionType;
  prompt: string;
  questionImageRef?: string;
  imageUrl?: string;
  explanationImageRef?: string;
  explanationImageUrl?: string;
  subject: string;
  subjectCode: string;
  grade: number;
  topicId: string;
  topicCode: string;
  difficulty: QuestionDifficulty;
  points: number;
  explanation: string;
  gradingMode: GradingMode;
  rubricText?: string;
  correctAnswer: string;
  correctAnswers?: string[];
  numericTolerance?: number;
  options?: string[];
  structuredOptions?: QuestionOption[];
  acceptedAnswers?: AcceptedAnswer[];
  isDuplicateInBank: boolean;
  existingQuestionId?: string;
}

export interface ImportSummaryStats {
  totalQuestions: number;
  totalOptions: number;
  totalMedia: number;
  singleChoiceCount: number;
  multipleChoiceCount: number;
  numericCount: number;
  shortTextCount: number;
  longTextCount: number;
}

export interface ParsedImportPackageResult {
  valid: boolean;
  packageType: 'xlsx' | 'zip';
  fileName: string;
  assessmentMeta: ParsedAssessmentMeta | null;
  questions: ParsedQuestionDraft[];
  mediaFiles: ExtractedMediaFile[];
  totalPoints: number;
  duplicateCodesInBank: string[];
  unknownTopicCodes: string[];
  errors: ImportValidationError[];
  warnings: string[];
  summary: ImportSummaryStats;
}

function parseBoolCell(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  const s = String(val ?? '')
    .trim()
    .toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'ha' || s === 'correct';
}

function makeValidationError(
  sheet: string,
  row: number,
  column: string,
  problem: string,
  severity: 'error' | 'warning' = 'error'
): ImportValidationError {
  return {
    sheet,
    row,
    column,
    problem,
    message: problem,
    severity,
  };
}

function buildEmptySummary(): ImportSummaryStats {
  return {
    totalQuestions: 0,
    totalOptions: 0,
    totalMedia: 0,
    singleChoiceCount: 0,
    multipleChoiceCount: 0,
    numericCount: 0,
    shortTextCount: 0,
    longTextCount: 0,
  };
}

export async function parseAndValidateImportPackage(
  fileBuffer: Uint8Array,
  fileName: string,
  knownTopics: Topic[],
  existingQuestions: QuestionItem[] = []
): Promise<ParsedImportPackageResult> {
  const lowerName = String(fileName || '').toLowerCase();
  const isZip = lowerName.endsWith('.zip');
  const packageType: 'xlsx' | 'zip' = isZip ? 'zip' : 'xlsx';

  const errors: ImportValidationError[] = [];
  const warnings: string[] = [];
  const mediaMap = new Map<string, ExtractedMediaFile>();
  let xlsxBytes: Uint8Array | null = null;

  const MAX_ARCHIVE_BYTES = 15 * 1024 * 1024; // 15 MB
  const MAX_ZIP_ENTRIES = 250;
  const MAX_UNCOMPRESSED_BYTES = 30 * 1024 * 1024; // 30 MB
  const MAX_COMPRESSION_RATIO = 100;

  if (!fileBuffer || fileBuffer.byteLength === 0) {
    errors.push(makeValidationError('Package', 0, 'file', 'Yuklangan fayl bo‘sh.'));
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
      summary: buildEmptySummary(),
    };
  }

  if (fileBuffer.byteLength > MAX_ARCHIVE_BYTES) {
    errors.push(
      makeValidationError(
        'Package',
        0,
        'file',
        'Fayl hajmi ruxsat etilgan maksimal chegaradan (15 MB) oshib ketdi.'
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
      summary: buildEmptySummary(),
    };
  }

  if (isZip) {
    try {
      const zip = await JSZip.loadAsync(fileBuffer);
      const entryNames = Object.keys(zip.files);

      if (entryNames.length > MAX_ZIP_ENTRIES) {
        errors.push(
          makeValidationError(
            'Package',
            0,
            'zip',
            `ZIP arxiv ichidagi fayllar soni maksimal chegaradan (${MAX_ZIP_ENTRIES} ta) oshib ketdi.`
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
          summary: buildEmptySummary(),
        };
      }

      let totalUncompressedBytes = 0;

      for (const entryName of entryNames) {
        const zipEntry = zip.files[entryName];
        if (zipEntry.dir) continue;

        if (entryName.includes('__MACOSX') || entryName.endsWith('.DS_Store')) {
          continue;
        }

        if (!isSafeArchivePath(entryName)) {
          errors.push(
            makeValidationError(
              'Package',
              0,
              entryName,
              `Xavfsiz bo'lmagan ZIP fayl yo'li yoki ruxsat etilmagan kengaytma: ${entryName}`
            )
          );
          continue;
        }

        const rawBytes = await zipEntry.async('uint8array');
        totalUncompressedBytes += rawBytes.byteLength;

        if (totalUncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
          errors.push(
            makeValidationError(
              'Package',
              0,
              'zip',
              'ZIP arxivning ochilgandagi umumiy hajmi 30 MB chegaradan oshib ketdi (ZIP bomb himoyasi).'
            )
          );
          break;
        }

        const compressionRatio =
          fileBuffer.byteLength > 0 ? totalUncompressedBytes / fileBuffer.byteLength : 1;
        if (compressionRatio > MAX_COMPRESSION_RATIO && totalUncompressedBytes > 1024 * 1024) {
          errors.push(
            makeValidationError(
              'Package',
              0,
              'zip',
              'ZIP arxiv siqilish nisbati xavfli darajada yuqori (ZIP bomb himoyasi).'
            )
          );
          break;
        }

        const cleanRel = entryName.replace(/\\/g, '/').replace(/^\.\//, '');
        if (cleanRel.toLowerCase().endsWith('.xlsx')) {
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
          '',
          rawBytes.byteLength,
          rawBytes
        );
        if (!imgCheck.valid) {
          errors.push(
            makeValidationError(
              'Package',
              0,
              cleanRel,
              imgCheck.error || `Yaroqsiz rasm fayli: ${cleanRel}`
            )
          );
          continue;
        }

        const mime = imgCheck.verifiedMime || 'image/png';
        const base64 = Buffer.from(rawBytes).toString('base64');
        const dataUrl = `data:${mime};base64,${base64}`;
        const fileItem: ExtractedMediaFile = {
          relativePath: cleanRel,
          fileName: cleanRel.split('/').pop() || cleanRel,
          mimeType: mime,
          sizeBytes: rawBytes.byteLength,
          dataUrl,
        };
        mediaMap.set(cleanRel.toLowerCase(), fileItem);
        const mediaIdx = cleanRel.toLowerCase().indexOf('media/');
        if (mediaIdx > 0) {
          mediaMap.set(cleanRel.slice(mediaIdx).toLowerCase(), fileItem);
        }
      }

      if (!xlsxBytes) {
        errors.push(
          makeValidationError(
            'Package',
            0,
            'workbook',
            'ZIP paket ichida .xlsx Excel jadvali topilmadi.'
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
          summary: buildEmptySummary(),
        };
      }
    } catch {
      errors.push(
        makeValidationError(
          'Package',
          0,
          'zip',
          'ZIP arxiv fayli shikastlangan yoki o‘qib bo‘lmadi.'
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
        summary: buildEmptySummary(),
      };
    }
  } else {
    xlsxBytes = fileBuffer;
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(xlsxBytes, { type: 'array', cellFormula: false, cellHTML: false });
  } catch {
    errors.push(
      makeValidationError(
        'Package',
        0,
        'xlsx',
        'Excel (.xlsx) fayli tuzilmasi yaroqsiz yoki o‘qib bo‘lmadi.'
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
      summary: buildEmptySummary(),
    };
  }

  if (wb.SheetNames.length > 20) {
    errors.push(
      makeValidationError(
        'Package',
        0,
        'xlsx',
        'Excel varaqlar soni maksimal chegaradan (20 ta) oshib ketdi.'
      )
    );
  }

  for (const reqSheet of ['Questions', 'Options']) {
    if (!wb.SheetNames.includes(reqSheet)) {
      errors.push(
        makeValidationError(
          'Package',
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
      summary: buildEmptySummary(),
    };
  }

  // Parse Assessment Sheet (optional 1 metadata row)
  let assessmentMeta: ParsedAssessmentMeta | null = null;
  if (wb.SheetNames.includes('Assessment')) {
    const assessRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['Assessment'], {
      defval: '',
    });
    const nonEmptyAssess = assessRows.filter((r) =>
      Object.values(r).some((v) => String(v ?? '').trim() !== '')
    );
    if (nonEmptyAssess.length > 1) {
      warnings.push(
        "Assessment varag'ida bir nechta qator topildi; faqat 1-qatordagi test metama'lumoti olindi."
      );
    }
    if (nonEmptyAssess.length >= 1) {
      const row = nonEmptyAssess[0];
      const title = String(row.assessment_title || row.title || '').trim();
      const code = String(row.assessment_code || `ASM-${Date.now()}`).trim();
      if (!title) {
        errors.push(
          makeValidationError(
            'Assessment',
            2,
            'assessment_title',
            "Assessment varag'i to'ldirilganda assessment_title majburiy."
          )
        );
      }
      const maxAtt = Math.max(1, Number(row.maximum_attempts || row.attempt_limit) || 1);
      assessmentMeta = {
        code,
        title: title || 'Import qilingan diagnostik test',
        description: String(row.description || '').trim(),
        subject: String(row.subject || 'Matematika').trim(),
        subjectCode: String(row.subject_code || 'MAT8').trim(),
        grade: Number(row.grade) || 8,
        durationMinutes: Math.max(5, Number(row.duration_minutes) || 30),
        passingScorePercent: Number(row.passing_score || row.passing_score_percent) || 60,
        shuffleQuestions: parseBoolCell(row.shuffle_questions),
        attemptLimit: maxAtt,
        maximumAttempts: maxAtt,
        instructions: String(row.instructions || '').trim(),
        availabilityStart: String(row.availability_start || '').trim() || undefined,
        availabilityEnd: String(row.availability_end || '').trim() || undefined,
      };
    }
  }

  // Parse Options Sheet
  const optionRows = wb.SheetNames.includes('Options')
    ? XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['Options'], { defval: '' })
    : [];
  const optionsByQCode = new Map<
    string,
    Array<{ rowNum: number; opt: QuestionOption; rawImageRef: string }>
  >();
  let totalOptionsCount = 0;

  optionRows.forEach((r, idx) => {
    const rowNum = idx + 2;
    const qCode = String(r.question_code || '').trim();
    const optCode = String(r.option_code || r.option_key || '').trim();
    const optText = String(r.option_text ?? '').trim();
    const optImage = String(r.option_image || '').trim().replace(/\\/g, '/');
    if (!qCode && !optText && !optImage) return;

    if (!qCode) {
      errors.push(
        makeValidationError(
          'Options',
          rowNum,
          'question_code',
          'Variant qaysi savolga tegishli ekanini bildiruvchi question_code bo‘sh.'
        )
      );
      return;
    }

    if (!optText && !optImage) {
      errors.push(
        makeValidationError(
          'Options',
          rowNum,
          'option_text',
          'Variantda kamida matn (option_text) yoki rasm (option_image) bo‘lishi shart.'
        )
      );
      return;
    }

    let resolvedOptImg: string | undefined;
    if (optImage) {
      if (optImage.startsWith('data:image/') || optImage.startsWith('https://')) {
        resolvedOptImg = optImage;
      } else {
        const foundMedia = mediaMap.get(optImage.toLowerCase());
        if (!foundMedia) {
          errors.push(
            makeValidationError(
              'Options',
              rowNum,
              'option_image',
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
        displayOrder: Number(r.display_order) || list.length + 1,
      },
    });
    optionsByQCode.set(qCode, list);
    totalOptionsCount += 1;
  });

  // Parse AcceptedAnswers Sheet
  const acceptedRows = wb.SheetNames.includes('AcceptedAnswers')
    ? XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['AcceptedAnswers'], {
        defval: '',
      })
    : [];
  const acceptedByQCode = new Map<string, AcceptedAnswer[]>();
  acceptedRows.forEach((r, idx) => {
    const rowNum = idx + 2;
    const qCode = String(r.question_code || '').trim();
    const ansText = String(r.accepted_answer ?? r.accepted_text ?? '').trim();
    if (!qCode && !ansText) return;
    if (!qCode || !ansText) {
      errors.push(
        makeValidationError(
          'AcceptedAnswers',
          rowNum,
          !qCode ? 'question_code' : 'accepted_answer',
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
      trimWhitespace: r.trim_whitespace === '' ? true : parseBoolCell(r.trim_whitespace),
    });
    acceptedByQCode.set(qCode, list);
  });

  // Lookup maps for Topics & Existing Questions
  const topicByCodeOrId = new Map<string, Topic>();
  for (const t of knownTopics) {
    topicByCodeOrId.set(t.id.toLowerCase(), t);
    if (t.code) topicByCodeOrId.set(t.code.toLowerCase(), t);
    topicByCodeOrId.set(t.name.toLowerCase(), t);
  }

  const existingByCode = new Map<string, QuestionItem>();
  for (const eq of existingQuestions) {
    if (eq && eq.code) existingByCode.set(eq.code.trim().toLowerCase(), eq);
  }

  const questionRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['Questions'], {
    defval: '',
  });
  const seenCodesInWorkbook = new Set<string>();
  const duplicateCodesInBank: string[] = [];
  const unknownTopicCodesSet = new Set<string>();
  const parsedQuestions: ParsedQuestionDraft[] = [];
  let totalPoints = 0;

  const allowedTypes = new Set<QuestionType>([
    'single_choice',
    'multiple_choice',
    'numeric',
    'short_text',
    'long_text',
  ]);
  const allowedDifficulties = new Set<QuestionDifficulty>(['easy', 'medium', 'hard']);

  questionRows.forEach((r, idx) => {
    const rowNum = idx + 2;
    const qCode = String(r.question_code || '').trim();
    const qTypeRaw = String(r.question_type || '').trim().toLowerCase() as QuestionType;
    const qText = String(r.question_text ?? '').trim();

    if (!qCode && !qTypeRaw && !qText) {
      return;
    }

    if (!qCode) {
      errors.push(
        makeValidationError(
          'Questions',
          rowNum,
          'question_code',
          'Majburiy question_code ustuni bo‘sh.'
        )
      );
    } else {
      const normCode = qCode.toLowerCase();
      if (seenCodesInWorkbook.has(normCode)) {
        errors.push(
          makeValidationError(
            'Questions',
            rowNum,
            'question_code',
            `Fayl ichida takroriy savol kodi (duplicate question_code): "${qCode}"`
          )
        );
      }
      seenCodesInWorkbook.add(normCode);
    }

    if (!allowedTypes.has(qTypeRaw)) {
      errors.push(
        makeValidationError(
          'Questions',
          rowNum,
          'question_type',
          `Qo'llab-quvvatlanmaydigan savol turi: "${r.question_type}". Ruxsat etilganlar: single_choice, multiple_choice, numeric, short_text, long_text.`
        )
      );
    }

    if (!qText || qText.length < 3) {
      errors.push(
        makeValidationError(
          'Questions',
          rowNum,
          'question_text',
          'Savol matni (question_text) bo‘sh yoki juda qisqa.'
        )
      );
    }

    const topicCodeRaw = String(r.topic_code || '').trim();
    const matchedTopic = topicByCodeOrId.get(topicCodeRaw.toLowerCase());
    if (!topicCodeRaw || !matchedTopic) {
      unknownTopicCodesSet.add(topicCodeRaw || '(bo‘sh)');
      errors.push(
        makeValidationError(
          'Questions',
          rowNum,
          'topic_code',
          `Noma'lum yoki tasdiqlanmagan mavzu kodi (topic_code): "${topicCodeRaw}". Topics varag'idagi mavjud kodlardan foydalaning.`
        )
      );
    }

    const diffRaw = String(r.difficulty || 'medium').trim().toLowerCase() as QuestionDifficulty;
    if (!allowedDifficulties.has(diffRaw)) {
      errors.push(
        makeValidationError(
          'Questions',
          rowNum,
          'difficulty',
          `Noto'g'ri difficulty qiymati: "${r.difficulty}". Ruxsat etilganlar: easy, medium, hard.`
        )
      );
    }

    const pts = Number(r.points);
    if (Number.isNaN(pts) || pts <= 0) {
      errors.push(
        makeValidationError(
          'Questions',
          rowNum,
          'points',
          `Savol bali (points) 0 dan katta son bo'lishi shart (kiritilgan: "${r.points}").`
        )
      );
    }

    const rawGM = String(
      r.grading_mode || (qTypeRaw === 'long_text' ? 'manual' : 'automatic')
    )
      .trim()
      .toLowerCase();
    const normalizedGradingMode: GradingMode =
      rawGM === 'auto' || rawGM === 'automatic'
        ? 'automatic'
        : rawGM === 'manual' || rawGM === 'manual_rubric'
        ? 'manual'
        : rawGM === 'ai_assisted'
        ? 'ai_assisted'
        : (rawGM as GradingMode);

    if (
      normalizedGradingMode !== 'automatic' &&
      normalizedGradingMode !== 'manual' &&
      normalizedGradingMode !== 'ai_assisted'
    ) {
      errors.push(
        makeValidationError(
          'Questions',
          rowNum,
          'grading_mode',
          `Noto'g'ri grading_mode: "${r.grading_mode}". Ruxsat etilganlar: automatic, manual, ai_assisted.`
        )
      );
    }

    // Validate question_image if referenced
    const qImgRef = String(r.question_image || '').trim().replace(/\\/g, '/');
    let resolvedQImage: string | undefined;
    if (qImgRef) {
      if (qImgRef.startsWith('data:image/') || qImgRef.startsWith('https://')) {
        resolvedQImage = qImgRef;
      } else {
        const foundMedia = mediaMap.get(qImgRef.toLowerCase());
        if (!foundMedia) {
          errors.push(
            makeValidationError(
              'Questions',
              rowNum,
              'question_image',
              `Ko'rsatilgan rasm ZIP paket ichida mavjud emas: "${qImgRef}"`
            )
          );
        } else {
          resolvedQImage = foundMedia.dataUrl;
        }
      }
    }

    // Validate explanation_image if referenced
    const expImgRef = String(r.explanation_image || '').trim().replace(/\\/g, '/');
    let resolvedExpImage: string | undefined;
    if (expImgRef) {
      if (expImgRef.startsWith('data:image/') || expImgRef.startsWith('https://')) {
        resolvedExpImage = expImgRef;
      } else {
        const foundExpMedia = mediaMap.get(expImgRef.toLowerCase());
        if (!foundExpMedia) {
          errors.push(
            makeValidationError(
              'Questions',
              rowNum,
              'explanation_image',
              `Ko'rsatilgan yechim rasmi ZIP paket ichida mavjud emas: "${expImgRef}"`
            )
          );
        } else {
          resolvedExpImage = foundExpMedia.dataUrl;
        }
      }
    }

    // Type-specific validation
    const qOpts = (optionsByQCode.get(qCode) || []).sort(
      (a, b) => (a.opt.displayOrder || 0) - (b.opt.displayOrder || 0)
    );
    const qAccepted = acceptedByQCode.get(qCode) || [];
    let correctAnswer = '';
    let correctAnswers: string[] | undefined;
    let numericTolerance: number | undefined;

    if (qTypeRaw === 'single_choice') {
      if (qOpts.length < 2) {
        errors.push(
          makeValidationError(
            'Options',
            rowNum,
            'question_code',
            `"${qCode}" (single_choice) savoli uchun Options varag'ida kamida 2 ta variant bo'lishi kerak.`
          )
        );
      }
      const correctOpts = qOpts.filter((o) => o.opt.isCorrect);
      if (correctOpts.length !== 1) {
        errors.push(
          makeValidationError(
            'Options',
            qOpts[0]?.rowNum || rowNum,
            'is_correct',
            `"${qCode}" (single_choice) savoli uchun aynan 1 ta to'g'ri javob belgilanishi shart (topildi: ${correctOpts.length} ta).`
          )
        );
      } else {
        correctAnswer = correctOpts[0].opt.text || correctOpts[0].opt.code || '';
      }
    } else if (qTypeRaw === 'multiple_choice') {
      if (qOpts.length < 2) {
        errors.push(
          makeValidationError(
            'Options',
            rowNum,
            'question_code',
            `"${qCode}" (multiple_choice) savoli uchun Options varag'ida kamida 2 ta variant bo'lishi kerak.`
          )
        );
      }
      const correctOpts = qOpts.filter((o) => o.opt.isCorrect);
      if (correctOpts.length < 1) {
        errors.push(
          makeValidationError(
            'Options',
            qOpts[0]?.rowNum || rowNum,
            'is_correct',
            `"${qCode}" (multiple_choice) savoli uchun kamida 1 ta to'g'ri javob belgilanishi shart.`
          )
        );
      } else {
        correctAnswers = correctOpts.map((o) => o.opt.text || o.opt.code || '');
        correctAnswer = (correctAnswers || []).join(' | ');
      }
    } else if (qTypeRaw === 'numeric') {
      const rawNum = String(r.numeric_correct_answer ?? r.numeric_answer ?? '')
        .trim()
        .replace(/,/g, '.');
      if (rawNum === '' || Number.isNaN(Number(rawNum))) {
        errors.push(
          makeValidationError(
            'Questions',
            rowNum,
            'numeric_correct_answer',
            `"${qCode}" (numeric) savoli uchun haqiqiy sonli javob (numeric_correct_answer) kiritilishi shart.`
          )
        );
      } else {
        correctAnswer = rawNum;
      }
      const rawTol = String(r.numeric_tolerance ?? '').trim().replace(/,/g, '.');
      if (rawTol !== '') {
        const parsedTol = Number(rawTol);
        if (Number.isNaN(parsedTol) || parsedTol < 0) {
          errors.push(
            makeValidationError(
              'Questions',
              rowNum,
              'numeric_tolerance',
              `"${qCode}" uchun numeric_tolerance manfiy bo'lmagan son bo'lishi kerak.`
            )
          );
        } else {
          numericTolerance = parsedTol;
        }
      }
    } else if (qTypeRaw === 'short_text') {
      if (normalizedGradingMode === 'automatic' && qAccepted.length === 0) {
        errors.push(
          makeValidationError(
            'AcceptedAnswers',
            rowNum,
            'accepted_answer',
            `"${qCode}" (short_text, automatic) savoli uchun AcceptedAnswers varag'ida kamida 1 ta qabul qilinuvchi javob bo'lishi shart.`
          )
        );
      }
      correctAnswer =
        qAccepted[0]?.acceptedAnswer || String(r.rubric || '').trim() || '(yozma javob)';
    } else if (qTypeRaw === 'long_text') {
      if (normalizedGradingMode === 'automatic') {
        errors.push(
          makeValidationError(
            'Questions',
            rowNum,
            'grading_mode',
            `"${qCode}" (long_text) savoli faqat "manual" yoki "ai_assisted" baholash rejimida bo'lishi mumkin.`
          )
        );
      }
      if (!String(r.rubric || '').trim()) {
        warnings.push(
          `"${qCode}" (long_text) savoli uchun rubric (baholash mezoni) kiritilmagan; standart mezon qo'llanadi.`
        );
      }
      correctAnswer = String(r.rubric || r.explanation || 'Mezon asosida tekshiriladi').trim();
    }

    const existingMatch = qCode ? existingByCode.get(qCode.toLowerCase()) : undefined;
    if (existingMatch) {
      duplicateCodesInBank.push(qCode);
    }

    const validPts = !Number.isNaN(pts) && pts > 0 ? pts : 1;
    totalPoints += validPts;

    parsedQuestions.push({
      code: qCode,
      type: allowedTypes.has(qTypeRaw) ? qTypeRaw : 'single_choice',
      prompt: qText,
      questionImageRef: qImgRef || undefined,
      imageUrl: resolvedQImage,
      explanationImageRef: expImgRef || undefined,
      explanationImageUrl: resolvedExpImage,
      subject: matchedTopic?.subject || 'Matematika',
      subjectCode: String(r.subject_code || matchedTopic?.subjectCode || 'MAT8').trim(),
      grade: Number(r.grade) || matchedTopic?.grade || 8,
      topicId: matchedTopic?.id || 'topic-fractions',
      topicCode: topicCodeRaw,
      difficulty: allowedDifficulties.has(diffRaw) ? diffRaw : 'medium',
      points: validPts,
      explanation: String(r.explanation || 'Yechim qadamlari asosida hisoblandi.').trim(),
      gradingMode:
        normalizedGradingMode === 'automatic' ||
        normalizedGradingMode === 'manual' ||
        normalizedGradingMode === 'ai_assisted'
          ? normalizedGradingMode
          : 'automatic',
      rubricText: String(r.rubric || '').trim() || undefined,
      correctAnswer,
      correctAnswers,
      numericTolerance,
      options: qOpts.length > 0 ? qOpts.map((o) => o.opt.text || o.opt.code || '') : undefined,
      structuredOptions: qOpts.length > 0 ? qOpts.map((o) => o.opt) : undefined,
      acceptedAnswers: qAccepted.length > 0 ? qAccepted : undefined,
      isDuplicateInBank: Boolean(existingMatch),
      existingQuestionId: existingMatch?.id,
    });
  });

  if (parsedQuestions.length === 0 && errors.length === 0) {
    errors.push(
      makeValidationError(
        'Questions',
        2,
        'question_code',
        "Questions varag'ida birorta ham savol topilmadi."
      )
    );
  }

  const uniqueMediaFiles = Array.from(new Set(mediaMap.values()));
  const summary: ImportSummaryStats = {
    totalQuestions: parsedQuestions.length,
    totalOptions: totalOptionsCount,
    totalMedia: uniqueMediaFiles.length,
    singleChoiceCount: parsedQuestions.filter((q) => q.type === 'single_choice').length,
    multipleChoiceCount: parsedQuestions.filter((q) => q.type === 'multiple_choice').length,
    numericCount: parsedQuestions.filter((q) => q.type === 'numeric').length,
    shortTextCount: parsedQuestions.filter((q) => q.type === 'short_text').length,
    longTextCount: parsedQuestions.filter((q) => q.type === 'long_text').length,
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
    summary,
  };
}
