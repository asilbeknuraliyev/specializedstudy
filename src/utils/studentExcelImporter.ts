import * as XLSX from 'xlsx';
import {
  OfficialClassCode,
  StudentImportClassGroupSummary,
  StudentImportColumnMapping,
  StudentImportIssue,
  StudentImportPreviewResult,
  StudentImportRowPreview,
  StudentImportSheetInfo,
  UserProfile,
} from '../types';
import {
  OFFICIAL_19_CLASS_CODES,
  normalizeClassCodeInput,
  parseOfficialClassCode,
} from '../constants/curriculum';

const FULL_NAME_ALIASES = [
  'full_name',
  'fullname',
  'full name',
  'f.i.sh.',
  'f.i.sh',
  'fish',
  'f.i.o.',
  'f.i.o',
  'fio',
  'ф.и.о.',
  'ф.и.о',
  'фио',
  "o'quvchi",
  'oquvchi',
  "o'quvchi f.i.sh",
  'ism familiya',
  'familiya ism sharif',
  'name',
  'student name',
];

const LAST_NAME_ALIASES = [
  'last_name',
  'lastname',
  'last name',
  'surname',
  'familiya',
  'familiyasi',
  'фамилия',
];

const FIRST_NAME_ALIASES = [
  'first_name',
  'firstname',
  'first name',
  'given name',
  'ism',
  'ismi',
  'имя',
];

const PATRONYMIC_ALIASES = [
  'patronymic',
  'middle_name',
  'middlename',
  'middle name',
  'sharif',
  'sharifi',
  'otasining ismi',
  'отчество',
];

const CLASS_CODE_ALIASES = [
  'class_code',
  'classcode',
  'class code',
  'class',
  'sinf',
  'sinfi',
  'guruh',
  'класс',
  'grade',
];

const STUDENT_ID_ALIASES = [
  'student_id',
  'studentid',
  'student id',
  'student_code',
  'id',
  'kod',
  "o'quvchi id",
  'oquvchi id',
  'номер',
  'id номер',
  'tabel',
];

const EMAIL_ALIASES = [
  'email',
  'e-mail',
  'pochta',
  'elektron pochta',
  'mail',
  'эл. почта',
  'почта',
];

function cleanHeaderKey(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function matchesAlias(header: string, aliases: string[]): boolean {
  const cleaned = cleanHeaderKey(header);
  if (!cleaned) return false;
  return aliases.some((alias) => cleaned === alias || cleaned.includes(alias));
}

export function detectColumnMappingFromHeaders(headers: string[]): StudentImportColumnMapping {
  const mapping: StudentImportColumnMapping = {};

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

export function detectHeaderRowIndex(rawMatrix: unknown[][]): number {
  const maxScan = Math.min(rawMatrix.length, 15);
  let bestRowIndex = 0;
  let bestScore = -1;

  for (let r = 0; r < maxScan; r++) {
    const row = rawMatrix[r];
    if (!Array.isArray(row)) continue;
    const cells = row.map((c) => String(c ?? '').trim()).filter(Boolean);
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

function normalizePersonName(raw: string): { normalized: string; wasModified: boolean } {
  const trimmed = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!trimmed) return { normalized: '', wasModified: false };
  const wasModified = trimmed !== String(raw || '');
  return { normalized: trimmed, wasModified };
}

function splitFullNameParts(fullName: string): {
  lastName: string;
  firstName: string;
  patronymic: string;
} {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { lastName: '', firstName: '', patronymic: '' };
  }
  if (parts.length === 1) {
    return { lastName: '', firstName: parts[0], patronymic: '' };
  }
  if (parts.length === 2) {
    return { lastName: parts[0], firstName: parts[1], patronymic: '' };
  }
  return {
    lastName: parts[0],
    firstName: parts[1],
    patronymic: parts.slice(2).join(' '),
  };
}

function isValidEmailFormat(email: string): boolean {
  if (!email) return true; // optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export interface ParseStudentWorkbookOptions {
  selectedSheet?: string;
  selectedHeaderRowIndex?: number;
  columnMappingOverride?: StudentImportColumnMapping;
  rowClassOverrides?: Record<number, string>; // rowNumber -> overridden classCode
  rowFieldOverrides?: Record<
    number,
    Partial<{
      fullName: string;
      firstName: string;
      lastName: string;
      patronymic: string;
      classCode: string;
      studentId: string;
      email: string;
    }>
  >;
}

export function validateStudentUploadBuffer(
  buffer: Buffer,
  fileName: string
): { valid: boolean; error?: string } {
  const maxBytes = 10 * 1024 * 1024; // 10 MB
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Yuklangan fayl bo'sh." };
  }
  if (buffer.length > maxBytes) {
    return { valid: false, error: 'Fayl hajmi 10 MB dan oshmasligi kerak.' };
  }

  const lower = String(fileName || '').toLowerCase();
  const isXlsx = lower.endsWith('.xlsx');
  const isCsv = lower.endsWith('.csv');

  if (!isXlsx && !isCsv) {
    return {
      valid: false,
      error: 'Faqat .xlsx va .csv formatidagi fayllar qabul qilinadi.',
    };
  }

  // Reject macro-enabled / binary legacy formats by magic bytes or extension
  if (lower.endsWith('.xlsm') || lower.endsWith('.xlsb') || lower.endsWith('.xls')) {
    return {
      valid: false,
      error: "Makrosli (.xlsm) yoki eski (.xls) fayllar xavfsizlik sababli qabul qilinmaydi. Iltimos, .xlsx yoki .csv yuklang.",
    };
  }

  if (isXlsx && buffer.length >= 4) {
    // ZIP/OOXML magic bytes PK\x03\x04
    const isZipMagic =
      buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    if (!isZipMagic) {
      return {
        valid: false,
        error: "Fayl tuzilishi haqiqiy .xlsx (OOXML) formatiga mos kelmadi.",
      };
    }
  }

  return { valid: true };
}

export function parseAndValidateStudentWorkbook(
  buffer: Buffer,
  fileName: string,
  options: ParseStudentWorkbookOptions = {},
  existingUsers: UserProfile[] = []
): StudentImportPreviewResult {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellFormula: false,
    cellHTML: false,
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("Excel faylda hech qanday sahifa (sheet) topilmadi.");
  }

  if (workbook.SheetNames.length > 20) {
    throw new Error("Excel faylda varaqlar (sheets) soni ruxsat etilgan maksimal chegaradan (20 ta) oshib ketdi.");
  }

  const sheetsInfo: StudentImportSheetInfo[] = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
      blankrows: false,
    });
    if (matrix.length > 5005) {
      throw new Error(`"${sheetName}" varag‘ida qatorlar soni maksimal chegaradan (5000 qator) oshib ketdi.`);
    }
    const detectedIdx = detectHeaderRowIndex(matrix);
    const headerRow = Array.isArray(matrix[detectedIdx])
      ? (matrix[detectedIdx] as unknown[]).map((c, idx) => {
          const val = String(c ?? '').trim();
          return val || `Ustun_${idx + 1}`;
        })
      : [];

    const dataMatrix = matrix.slice(detectedIdx + 1);
    const sampleRows = dataMatrix.slice(0, 5).map((r) => {
      const obj: Record<string, string> = {};
      headerRow.forEach((h, i) => {
        obj[h] = String((r as unknown[])?.[i] ?? '').trim();
      });
      return obj;
    });

    sheetsInfo.push({
      name: sheetName,
      rowCount: Math.max(0, dataMatrix.length),
      detectedHeaderRowIndex: detectedIdx,
      headers: headerRow,
      sampleRows,
    });
  }

  // Pick default sheet: prefer sheet named 'Students' or "O'quvchilar", or the first non-Instructions sheet with rows
  let defaultSheet = workbook.SheetNames[0];
  const preferredSheet = sheetsInfo.find(
    (s) =>
      !s.name.toLowerCase().includes('instruction') &&
      !s.name.toLowerCase().includes("yo'riqnoma") &&
      s.rowCount > 0
  );
  if (preferredSheet) {
    defaultSheet = preferredSheet.name;
  } else {
    const nonInstruction = sheetsInfo.find(
      (s) =>
        !s.name.toLowerCase().includes('instruction') &&
        !s.name.toLowerCase().includes("yo'riqnoma")
    );
    if (nonInstruction) defaultSheet = nonInstruction.name;
  }

  const selectedSheet =
    options.selectedSheet && workbook.SheetNames.includes(options.selectedSheet)
      ? options.selectedSheet
      : defaultSheet;

  const activeWs = workbook.Sheets[selectedSheet];
  const activeMatrix = XLSX.utils.sheet_to_json<unknown[]>(activeWs, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  const autoHeaderIdx = detectHeaderRowIndex(activeMatrix);
  const selectedHeaderRowIndex =
    typeof options.selectedHeaderRowIndex === 'number' &&
    options.selectedHeaderRowIndex >= 0 &&
    options.selectedHeaderRowIndex < activeMatrix.length
      ? options.selectedHeaderRowIndex
      : autoHeaderIdx;

  const rawHeaders = Array.isArray(activeMatrix[selectedHeaderRowIndex])
    ? (activeMatrix[selectedHeaderRowIndex] as unknown[])
    : [];

  const headers: string[] = rawHeaders.map((c, idx) => {
    const text = String(c ?? '').trim();
    return text || `Ustun_${idx + 1}`;
  });

  const autoMapping = detectColumnMappingFromHeaders(headers);
  const detectedMapping: StudentImportColumnMapping = {
    ...autoMapping,
    ...(options.columnMappingOverride || {}),
  };

  const colIndexMap = new Map<string, number>();
  headers.forEach((h, i) => colIndexMap.set(h, i));

  const getCell = (rowArr: unknown[], colName?: string): string => {
    if (!colName) return '';
    const idx = colIndexMap.get(colName);
    if (idx === undefined) return '';
    const raw = rowArr[idx];
    // Prevent formula injection or leading =
    const str = String(raw ?? '').trim();
    if (/^[=+\-@]/.test(str) && str.length > 1 && !/^\+?\d/.test(str)) {
      return str.replace(/^[=+\-@]+/, '').trim();
    }
    return str;
  };

  // Existing student lookup indexes for duplicate detection
  const existingStudents = existingUsers.filter(
    (u) => u.role === 'student' && u.status !== 'archived'
  );
  const existingByStudentCode = new Map<string, UserProfile>();
  const existingByEmail = new Map<string, UserProfile>();
  const existingByNameAndClass = new Map<string, UserProfile>();

  for (const stu of existingStudents) {
    if (stu.studentCode) {
      existingByStudentCode.set(stu.studentCode.trim().toLowerCase(), stu);
    }
    if (stu.email && !stu.email.endsWith('@student.specialized.local')) {
      existingByEmail.set(stu.email.trim().toLowerCase(), stu);
    }
    const normClass = normalizeClassCodeInput(stu.classCode || stu.classId?.replace(/^class-/, ''));
    const normName = String(stu.displayName || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (normName && normClass) {
      existingByNameAndClass.set(`${normName}::${normClass}`, stu);
    }
  }

  // Track within-file duplicates
  const seenFileStudentIds = new Set<string>();
  const seenFileEmails = new Set<string>();
  const seenFileNameAndClass = new Set<string>();

  const rows: StudentImportRowPreview[] = [];

  for (let r = selectedHeaderRowIndex + 1; r < activeMatrix.length; r++) {
    const rowArr = activeMatrix[r] as unknown[];
    if (!Array.isArray(rowArr)) continue;

    // Skip completely empty rows
    const nonEmptyCount = rowArr.filter((cell) => String(cell ?? '').trim() !== '').length;
    if (nonEmptyCount === 0) continue;

    const rowNumber = r + 1; // 1-indexed Excel row
    const fieldOverride = options.rowFieldOverrides?.[rowNumber] || {};
    const classOverride = options.rowClassOverrides?.[rowNumber];

    const rawFullName =
      fieldOverride.fullName !== undefined
        ? fieldOverride.fullName
        : getCell(rowArr, detectedMapping.fullNameCol);
    const rawLastName =
      fieldOverride.lastName !== undefined
        ? fieldOverride.lastName
        : getCell(rowArr, detectedMapping.lastNameCol);
    const rawFirstName =
      fieldOverride.firstName !== undefined
        ? fieldOverride.firstName
        : getCell(rowArr, detectedMapping.firstNameCol);
    const rawPatronymic =
      fieldOverride.patronymic !== undefined
        ? fieldOverride.patronymic
        : getCell(rowArr, detectedMapping.patronymicCol);
    const rawClassCode =
      classOverride !== undefined
        ? classOverride
        : fieldOverride.classCode !== undefined
          ? fieldOverride.classCode
          : getCell(rowArr, detectedMapping.classCodeCol);
    const rawStudentId =
      fieldOverride.studentId !== undefined
        ? fieldOverride.studentId
        : getCell(rowArr, detectedMapping.studentIdCol);
    const rawEmail =
      fieldOverride.email !== undefined
        ? fieldOverride.email
        : getCell(rowArr, detectedMapping.emailCol);

    const issues: StudentImportIssue[] = [];

    // Build full name and parts
    let firstName = normalizePersonName(rawFirstName).normalized;
    let lastName = normalizePersonName(rawLastName).normalized;
    let patronymic = normalizePersonName(rawPatronymic).normalized;
    let fullName = normalizePersonName(rawFullName).normalized;

    if (!fullName && (lastName || firstName || patronymic)) {
      fullName = [lastName, firstName, patronymic].filter(Boolean).join(' ');
    } else if (fullName && !firstName && !lastName) {
      const split = splitFullNameParts(fullName);
      lastName = split.lastName;
      firstName = split.firstName;
      patronymic = split.patronymic;
    }

    if (
      (rawFullName && rawFullName !== fullName) ||
      (rawFirstName && rawFirstName !== firstName) ||
      (rawLastName && rawLastName !== lastName)
    ) {
      issues.push({
        severity: 'INFO',
        field: 'fullName',
        message: 'Ism-sharif ortiqcha bo‘shliqlardan tozalandi.',
      });
    }

    // Normalize class code
    const normalizedClassCode = normalizeClassCodeInput(rawClassCode);
    const parsedClass = normalizedClassCode ? parseOfficialClassCode(normalizedClassCode) : null;

    if (
      normalizedClassCode &&
      rawClassCode.trim() !== normalizedClassCode
    ) {
      issues.push({
        severity: 'INFO',
        field: 'classCode',
        message: `Sinf kodi "${rawClassCode}" -> "${normalizedClassCode}" ga standartlashtirildi.`,
      });
    }

    const email = String(rawEmail || '').trim().toLowerCase();
    const studentId = String(rawStudentId || '').trim();

    // Validation rules (ERROR / WARNING / INFO)
    if (!fullName) {
      issues.push({
        severity: 'ERROR',
        field: 'fullName',
        message: "O'quvchining F.I.Sh. (ism-familiyasi) kiritilmagan.",
      });
    }

    if (!rawClassCode.trim()) {
      issues.push({
        severity: 'ERROR',
        field: 'classCode',
        message: 'Sinf kiritilmagan.',
      });
    } else if (!normalizedClassCode) {
      issues.push({
        severity: 'ERROR',
        field: 'classCode',
        message: `Noto'g'ri sinf: "${rawClassCode}". Ruxsat etilgan 19 ta sinfdan birini tanlang (5a1..11a2, 7t..11t).`,
      });
    }

    if (email && !isValidEmailFormat(email)) {
      issues.push({
        severity: 'ERROR',
        field: 'email',
        message: `Noto'g'ri email formati: "${rawEmail}".`,
      });
    }

    // Duplicate Detection
    let duplicateReason: string | undefined;
    let existingUserUid: string | undefined;

    if (studentId) {
      const normId = studentId.toLowerCase();
      if (seenFileStudentIds.has(normId)) {
        issues.push({
          severity: 'ERROR',
          field: 'studentId',
          message: `Fayl ichida takrorlangan ID: "${studentId}".`,
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
          severity: 'ERROR',
          field: 'email',
          message: `Fayl ichida takrorlangan email: "${email}".`,
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
          severity: 'WARNING',
          field: 'fullName',
          message: `Fayl ichida bir xil F.I.Sh. va sinf takrorlangan (${fullName}, ${normalizedClassCode}).`,
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
              severity: 'WARNING',
              field: 'fullName',
              message: `${fullName} (${normalizedClassCode}) tizimda allaqachon mavjud.`,
            });
          }
        }
      }
    }

    const hasError = issues.some((i) => i.severity === 'ERROR');
    const hasWarning = issues.some((i) => i.severity === 'WARNING');

    let status: StudentImportRowPreview['status'] = 'valid';
    if (hasError) {
      status = 'error';
    } else if (duplicateReason) {
      status = 'duplicate';
    } else if (hasWarning) {
      status = 'warning';
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
      issues,
    });
  }

  // STEP 5 — AUTOMATIC GROUPING AND SORTING
  // Sort by:
  // 1. Grade ascending (5 -> 11)
  // 2. Canonical class order (5a1, 5a2, 6a1, 6a2, 7a1, 7a2, 7t, ...)
  // 3. Surname / Full name alphabetically
  const classOrderIndex = new Map<string, number>(
    OFFICIAL_19_CLASS_CODES.map((code, idx) => [code, idx])
  );

  rows.sort((a, b) => {
    const idxA = a.normalizedClassCode ? (classOrderIndex.get(a.normalizedClassCode) ?? 999) : 999;
    const idxB = b.normalizedClassCode ? (classOrderIndex.get(b.normalizedClassCode) ?? 999) : 999;
    if (idxA !== idxB) return idxA - idxB;

    const nameA = (a.lastName || a.fullName || '').toLowerCase();
    const nameB = (b.lastName || b.fullName || '').toLowerCase();
    const cmp = nameA.localeCompare(nameB, 'uz');
    if (cmp !== 0) return cmp;
    return (a.firstName || '').toLowerCase().localeCompare((b.firstName || '').toLowerCase(), 'uz');
  });

  // Build class groups summary in canonical 19-class order
  const groupMap = new Map<OfficialClassCode, StudentImportClassGroupSummary>();
  for (const code of OFFICIAL_19_CLASS_CODES) {
    const meta = parseOfficialClassCode(code)!;
    groupMap.set(code, {
      classCode: code,
      grade: meta.grade,
      track: meta.track,
      totalCount: 0,
      validCount: 0,
      duplicateCount: 0,
      errorCount: 0,
    });
  }

  for (const row of rows) {
    if (row.normalizedClassCode && groupMap.has(row.normalizedClassCode)) {
      const grp = groupMap.get(row.normalizedClassCode)!;
      grp.totalCount += 1;
      if (row.status === 'error') grp.errorCount += 1;
      else if (row.status === 'duplicate') grp.duplicateCount += 1;
      else grp.validCount += 1;
    }
  }

  const classGroups = Array.from(groupMap.values()).filter((g) => g.totalCount > 0);

  const newStudentsCount = rows.filter(
    (r) => r.status === 'valid' || r.status === 'warning'
  ).length;
  const duplicatesCount = rows.filter((r) => r.status === 'duplicate').length;
  const errorsCount = rows.filter((r) => r.status === 'error').length;
  const warningsCount = rows.filter((r) =>
    r.issues.some((i) => i.severity === 'WARNING')
  ).length;
  const infoCount = rows.filter((r) =>
    r.issues.some((i) => i.severity === 'INFO')
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
    rows,
  };
}

export function generateStudentImportTemplateBuffer(): Buffer {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Instructions
  const instructionsRows = [
    ['SPECIALIZED STUDY — O‘QUVCHILARNI EXCEL ORQALI YUKLASH YO‘RIQNOMASI'],
    [''],
    ['1. RUXSAT ETILGAN 19 TA RASMIY SINF KODLARI:'],
    ['Yo‘nalish', 'Sinflar ro‘yxati', 'Biriktirilgan fanlar'],
    [
      'A yo‘nalishi (14 ta sinf)',
      '5a1, 5a2, 6a1, 6a2, 7a1, 7a2, 8a1, 8a2, 9a1, 9a2, 10a1, 10a2, 11a1, 11a2',
      'Matematika, Ingliz tili, Fizika',
    ],
    [
      'T yo‘nalishi (5 ta sinf)',
      '7t, 8t, 9t, 10t, 11t',
      'Ingliz tili, Biologiya, Kimyo',
    ],
    [''],
    ['2. USTUNLAR TAVSIFI ("Students" sahifasi):'],
    ['Ustun nomi', 'Majburiyligi', 'Izoh'],
    ['student_id', 'Ixtiyoriy', "O'quvchining maktab ID raqami (bo'sh qolsa avtomatik yaratiladi)"],
    ['last_name', 'Ixtiyoriy*', 'Familiyasi (*yoki full_name ustunini to‘ldiring)'],
    ['first_name', 'Ixtiyoriy*', 'Ismi (*yoki full_name ustunini to‘ldiring)'],
    ['patronymic', 'Ixtiyoriy', 'Otasining ismi (Sharifi)'],
    ['full_name', 'Majburiy*', "To'liq F.I.Sh. (agar last_name va first_name alohida berilmagan bo'lsa)"],
    ['class_code', 'Majburiy', '19 ta rasmiy sinfdan biri: masalan, 5a1, 7t, 10a2 (5t va 6t mavjud emas)'],
    ['email', 'Ixtiyoriy', "O'quvchining elektron pochta manzili"],
    [''],
    ['3. XAVFSIZLIK ESLATMASI:'],
    ['Excel fayl orqali ochiq parollar yuklanmaydi. Yuklangan o‘quvchilar uchun taklifnoma kodi yoki faollashtirish havolasi yaratiladi.'],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsRows);
  wsInstructions['!cols'] = [{ wch: 28 }, { wch: 68 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  // Sheet 2: Students (Only headers, NO fake students)
  const studentHeaders = [
    ['student_id', 'last_name', 'first_name', 'patronymic', 'full_name', 'class_code', 'email'],
  ];
  const wsStudents = XLSX.utils.aoa_to_sheet(studentHeaders);
  wsStudents['!cols'] = [
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
    { wch: 32 },
    { wch: 14 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, wsStudents, 'Students');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function generateStudentExportBuffer(students: UserProfile[]): Buffer {
  const wb = XLSX.utils.book_new();
  const rows: (string | number)[][] = [
    ['ID', 'F.I.Sh.', 'Familiya', 'Ism', 'Sharif', 'Sinf', 'Yo‘nalish', 'Email', 'Holat', 'Qo‘shilgan sana'],
  ];

  // Sort by class canonical order then alphabetically
  const classOrderIndex = new Map<string, number>(
    OFFICIAL_19_CLASS_CODES.map((code, idx) => [code, idx])
  );

  const sorted = [...students].sort((a, b) => {
    const codeA = normalizeClassCodeInput(a.classCode || a.classId?.replace(/^class-/, ''));
    const codeB = normalizeClassCodeInput(b.classCode || b.classId?.replace(/^class-/, ''));
    const idxA = codeA ? (classOrderIndex.get(codeA) ?? 999) : 999;
    const idxB = codeB ? (classOrderIndex.get(codeB) ?? 999) : 999;
    if (idxA !== idxB) return idxA - idxB;
    return String(a.displayName || '').localeCompare(String(b.displayName || ''), 'uz');
  });

  const safeCell = (val: string | number | undefined | null): string | number => {
    if (typeof val === 'number') return val;
    const str = String(val ?? '');
    if (/^[=+\-@\t\r]/.test(str)) {
      return `'${str}`;
    }
    return str;
  };

  for (const s of sorted) {
    const code = normalizeClassCodeInput(s.classCode || s.classId?.replace(/^class-/, '')) || s.classCode || '';
    const parsed = code ? parseOfficialClassCode(code) : null;
    const statusLabel =
      s.status === 'pending_activation'
        ? 'Faollashtirish kutilmoqda'
        : s.status === 'suspended'
          ? 'To‘xtatilgan'
          : s.status === 'archived'
            ? 'Arxivlangan'
            : 'Faol';
    const cleanEmail = s.email?.endsWith('@student.specialized.local') ? '' : s.email || '';

    rows.push([
      safeCell(s.studentCode || s.uid),
      safeCell(s.displayName || ''),
      safeCell(s.lastName || ''),
      safeCell(s.firstName || ''),
      safeCell(s.patronymic || ''),
      safeCell(code),
      safeCell(parsed ? parsed.track : s.track || ''),
      safeCell(cleanEmail),
      safeCell(statusLabel),
      safeCell(s.enrolledAt ? s.enrolledAt.slice(0, 10) : s.createdAt.slice(0, 10)),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 16 },
    { wch: 30 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 10 },
    { wch: 12 },
    { wch: 26 },
    { wch: 22 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Students');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
