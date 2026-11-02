import * as XLSX from 'xlsx';
import {
  ClassRoom,
  SubjectItem,
  Topic,
  WorkPlan,
  WorkPlanRowItem,
  WorkPlanType,
  LessonItem,
  QuestionItem,
  QuestionDifficulty,
  QuestionType,
  Assessment,
  AICommandExecutionResult,
} from '../types';
import {
  OFFICIAL_19_CLASS_CODES,
  parseOfficialClassCode,
  isSubjectCompatibleWithClass,
} from '../constants/curriculum';

export function generateWorkPlanTemplateExcelBuffer(
  classCode: string = '7a1',
  subjectName: string = 'Matematika',
  academicYear: string = '2026-2027'
): Uint8Array {
  const wb = XLSX.utils.book_new();
  const rows = [
    {
      Dars_Raqami: 1,
      Chorak: 1,
      Hafta: 1,
      Bob_Bo_lim: '1-bob. Ratsional sonlar va kasrlar',
      Mavzu: 'Kasrlar va ratsional sonlar',
      Dars_Mavzusi: 'Oddiy kasrlarni umumiy maxrajga keltirish',
      O_quv_Maqsadi: 'Oddiy kasrlarni taqqoslash va qo‘shish qoidalarini qo‘llash',
      Sana: '2026-09-04',
      Soat: 1,
      Uyga_Vazifa: '1-12 misollar (14-bet)',
      Nazorat_Izohi: 'Og‘zaki savol-javob',
    },
    {
      Dars_Raqami: 2,
      Chorak: 1,
      Hafta: 1,
      Bob_Bo_lim: '1-bob. Ratsional sonlar va kasrlar',
      Mavzu: 'Kasrlar va ratsional sonlar',
      Dars_Mavzusi: 'Aralash kasrlar ustida arifmetik amallar',
      O_quv_Maqsadi: 'Aralash kasrlarni ko‘paytirish va bo‘lish amallarini bajarish',
      Sana: '2026-09-07',
      Soat: 1,
      Uyga_Vazifa: '15-24 misollar (18-bet)',
      Nazorat_Izohi: 'Mustaqil ish',
    },
    {
      Dars_Raqami: 3,
      Chorak: 1,
      Hafta: 2,
      Bob_Bo_lim: '1-bob. Ratsional sonlar va kasrlar',
      Mavzu: 'Foizlar va proporsiyalar',
      Dars_Mavzusi: 'Sonning foizini topish va foizli o‘zgarish masalalari',
      O_quv_Maqsadi: 'Matnli masalalarda foiz va proporsiya tenglamalarini tuzish',
      Sana: '2026-09-10',
      Soat: 1,
      Uyga_Vazifa: '28-36 masalalar (22-bet)',
      Nazorat_Izohi: 'Diagnostik mini-test',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Ish_Reja');

  const metaRows = [
    { Parametr: 'Maktab', Qiymat: 'Specialized Study' },
    { Parametr: 'Sinf', Qiymat: classCode },
    { Parametr: 'Fan', Qiymat: subjectName },
    { Parametr: 'O‘quv yili', Qiymat: academicYear },
  ];
  const metaWs = XLSX.utils.json_to_sheet(metaRows);
  XLSX.utils.book_append_sheet(wb, metaWs, 'Ma_lumot');

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out);
}

export function parseWorkPlanRowsFromBufferOrText(
  fileName: string,
  buffer: Uint8Array | null,
  rawText?: string,
  explicitRows?: Partial<WorkPlanRowItem>[],
  defaultSubject: string = 'Matematika',
  defaultQuarter: 1 | 2 | 3 | 4 = 1
): { rows: WorkPlanRowItem[]; warnings: string[] } {
  const warnings: string[] = [];
  const extractedRows: WorkPlanRowItem[] = [];

  if (Array.isArray(explicitRows) && explicitRows.length > 0) {
    explicitRows.forEach((r, idx) => {
      const lessonNum = Number(r.lessonNumber) || idx + 1;
      const qtr = ([1, 2, 3, 4].includes(Number(r.quarter)) ? Number(r.quarter) : defaultQuarter) as
        | 1
        | 2
        | 3
        | 4;
      const rowWarnings: string[] = [];
      if (!r.scheduledDate) {
        rowWarnings.push(`${lessonNum}-dars uchun sana ko‘rsatilmagan.`);
      }
      extractedRows.push({
        rowId: r.rowId || `wprow-${Date.now()}-${idx + 1}`,
        lessonNumber: lessonNum,
        quarter: qtr,
        weekNumber: Number(r.weekNumber) || Math.ceil(lessonNum / 3),
        unitTitle: String(r.unitTitle || `${qtr}-chorak bo‘limi`).trim(),
        topicName: String(r.topicName || r.lessonTitle || `${defaultSubject} asosiy mavzusi`).trim(),
        lessonTitle: String(r.lessonTitle || r.topicName || `${lessonNum}-dars`).trim(),
        learningObjectives: String(
          r.learningObjectives || 'Mavzu bo‘yicha nazariy va amaliy ko‘nikmalarni shakllantirish.'
        ).trim(),
        scheduledDate: r.scheduledDate ? String(r.scheduledDate).trim() : undefined,
        hours: Number(r.hours) > 0 ? Number(r.hours) : 1,
        homework: r.homework ? String(r.homework).trim() : undefined,
        assessmentNote: r.assessmentNote ? String(r.assessmentNote).trim() : undefined,
        warnings: rowWarnings,
      });
    });
  } else if (buffer && /\.(xlsx|xls|csv)$/i.test(fileName)) {
    try {
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      if (firstSheetName) {
        const sheet = wb.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        jsonRows.forEach((rawRow, idx) => {
          const keys = Object.keys(rawRow);
          const findVal = (patterns: RegExp[]): string => {
            for (const k of keys) {
              if (patterns.some((p) => p.test(k.toLowerCase()))) {
                return String(rawRow[k] ?? '').trim();
              }
            }
            return '';
          };

          const rawNum = findVal([/dars_raqam|no|#|order|tartib|raqam/i]);
          const lessonNumber = Number(rawNum) || idx + 1;
          const rawQuarter = Number(findVal([/chorak|quarter/i]));
          const quarter = ([1, 2, 3, 4].includes(rawQuarter)
            ? rawQuarter
            : defaultQuarter) as 1 | 2 | 3 | 4;
          const unitTitle =
            findVal([/bob|bo_lim|unit|bo'lim|section/i]) || `${quarter}-chorak o‘quv bo‘limi`;
          const lessonTitle =
            findVal([/dars_mavzu|lesson|mavzu_nomi|title|dars/i]) ||
            findVal([/mavzu|topic/i]) ||
            `${lessonNumber}-dars`;
          const topicName =
            findVal([/^mavzu$|topic/i]) || lessonTitle;
          const learningObjectives =
            findVal([/maqsad|objective|kompetensiya|ko_nikma/i]) ||
            `${lessonTitle} bo‘yicha amaliy va nazariy ko‘nikmalarni egallash.`;
          const scheduledDate = findVal([/sana|date|muddat/i]) || undefined;
          const hours = Number(findVal([/soat|hour/i])) || 1;
          const homework = findVal([/uyga|homework|vazifa/i]) || undefined;
          const assessmentNote = findVal([/nazorat|baholash|izoh|note/i]) || undefined;

          if (!lessonTitle && !topicName) return;

          const rowWarnings: string[] = [];
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
            warnings: rowWarnings,
          });
        });
      }
    } catch (err: any) {
      warnings.push(`Jadval faylini o‘qishda ogohlantirish: ${err?.message || 'Format tekshirildi'}`);
    }
  }

  // Also parse plain text lines if provided or if buffer contains UTF-8 text lines
  if (extractedRows.length === 0) {
    let textContent = rawText || '';
    if (!textContent && buffer && buffer.byteLength > 0) {
      try {
        const decoded = Buffer.from(buffer).toString('utf-8');
        if (decoded && !decoded.includes('\u0000')) {
          textContent = decoded;
        }
      } catch {
        // Ignore binary
      }
    }

    const lines = textContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 3 && !l.startsWith('#'));

    if (lines.length > 0) {
      lines.forEach((line, idx) => {
        const parts = line.split(/[|;\t]/).map((p) => p.trim());
        const lessonNum = idx + 1;
        const lessonTitle =
          parts.length >= 2
            ? parts[1]
            : line.replace(/^\d+[\s.)-]+/, '').trim() || `${lessonNum}-dars`;
        const topicName = parts.length >= 3 ? parts[2] : lessonTitle;
        const learningObjectives =
          parts.length >= 4
            ? parts[3]
            : `${lessonTitle} bo‘yicha asosiy tushuncha va masalalarni o‘zlashtirish.`;
        const scheduledDate =
          parts.find((p) => /^\d{4}-\d{2}-\d{2}$/.test(p)) || undefined;

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
          hours: 1,
        });
      });
    }
  }

  // Validate duplicate lesson numbers & missing dates
  const seenNumbers = new Set<number>();
  for (const row of extractedRows) {
    if (seenNumbers.has(row.lessonNumber)) {
      warnings.push(`Takroriy dars raqami aniqlandi: ${row.lessonNumber}-dars.`);
    }
    seenNumbers.add(row.lessonNumber);
    if (!row.scheduledDate) {
      warnings.push(`${row.lessonNumber}-dars ("${row.lessonTitle}") uchun sana ko‘rsatilmagan.`);
    }
  }

  return { rows: extractedRows, warnings };
}

export function buildStructuredQuestionsForLessonOrTopic(params: {
  institutionId: string;
  authorId: string;
  classCode: string;
  grade: number;
  subjectName: string;
  subjectCode?: string;
  lesson?: LessonItem;
  topic: Topic;
  count: number;
  difficulty: QuestionDifficulty;
  questionTypes?: QuestionType[];
}): QuestionItem[] {
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
    questionTypes = ['single_choice', 'multiple_choice', 'numeric', 'short_text'],
  } = params;

  const nowIso = new Date().toISOString();
  const safeCount = Math.max(1, Math.min(40, Number(count) || 10));
  const result: QuestionItem[] = [];
  const contextTitle = lesson ? `${lesson.lessonNumber}-dars: ${lesson.title}` : topic.name;
  const subjNorm = subjectName.trim().toLowerCase();

  for (let i = 0; i < safeCount; i++) {
    const qNum = i + 1;
    const selectedType = questionTypes[i % questionTypes.length] || 'single_choice';
    const qId = `q-ai-${Date.now()}-${qNum}-${Math.random().toString(36).slice(2, 5)}`;
    const qCode = `SS-${(subjectCode || subjectName.slice(0, 3)).toUpperCase()}-${classCode.toUpperCase()}-${qNum}`;

    if (selectedType === 'numeric') {
      const a = 2 + (qNum % 5);
      const xVal = 3 + qNum;
      const b = 4 + (qNum % 7);
      const rhs = a * xVal + b;
      const promptText = subjNorm.includes('fizika')
        ? `${classCode.toUpperCase()} Физика (${contextTitle}): Jism ${a} m/s² tezlanish bilan ${xVal} s harakatlandi va boshlang‘ich tezligi ${b} m/s edi. Yakuniy tezlikni (m/s) hisoblang.`
        : subjNorm.includes('kimyo')
        ? `${classCode.toUpperCase()} Kimyo (${contextTitle}): Reaksiyada ${a} mol modda har birida ${xVal} g dan qatnashib, qo‘shimcha ${b} g erituvchi qo‘shildi. Umumiy massani (g) toping.`
        : `${classCode.toUpperCase()} ${subjectName} (${contextTitle}): ${a}x + ${b} = ${rhs} tenglamadan x ning qiymatini toping.`;
      const correctAns = subjNorm.includes('fizika') || subjNorm.includes('kimyo') ? String(rhs) : String(xVal);

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
        type: 'numeric',
        points: 2,
        prompt: promptText,
        correctAnswer: correctAns,
        numericTolerance: 0.01,
        gradingMode: 'auto',
        explanation: `Formula va arifmetik hisoblash asosida to‘g‘ri javob: ${correctAns}.`,
        status: 'draft',
        version: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      continue;
    }

    if (selectedType === 'short_text') {
      const termAnswer = subjNorm.includes('biologiya')
        ? 'mitoxondriya'
        : subjNorm.includes('kimyo')
        ? 'kovalent'
        : subjNorm.includes('ingliz')
        ? 'went'
        : subjNorm.includes('fizika')
        ? 'nyuton'
        : 'proporsiya';

      const promptText = subjNorm.includes('biologiya')
        ? `${classCode.toUpperCase()} Biologiya (${contextTitle}): Hujayraning energiya stansiyasi (ATF sintezlovchi organoid) nima deb ataladi? (1 so‘z bilan yozing)`
        : subjNorm.includes('kimyo')
        ? `${classCode.toUpperCase()} Kimyo (${contextTitle}): Umumiy elektron juftlari hisobiga hosil bo‘ladigan kimyoviy bog‘lanish turi qanday ataladi?`
        : subjNorm.includes('ingliz')
        ? `${classCode.toUpperCase()} Ingliz tili (${contextTitle}): "Go" fe’lining Past Simple (o‘tgan zamon) shaklini yozing.`
        : subjNorm.includes('fizika')
        ? `${classCode.toUpperCase()} Fizika (${contextTitle}): Xalqaro birliklar tizimida (SI) kuch birligi nima deb ataladi?`
        : `${classCode.toUpperCase()} ${subjectName} (${contextTitle}): Ikki nisbatning tengligi matematikada bir so‘z bilan nima deb ataladi?`;

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
        type: 'short_text',
        points: 2,
        prompt: promptText,
        correctAnswer: termAnswer,
        acceptedAnswers: [
          {
            acceptedAnswer: termAnswer,
            caseSensitive: false,
            trimWhitespace: true,
          },
        ],
        gradingMode: 'auto',
        explanation: `Mavzu qoidasiga ko‘ra to‘g‘ri atama: "${termAnswer}".`,
        status: 'draft',
        version: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      continue;
    }

    if (selectedType === 'multiple_choice') {
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
        type: 'multiple_choice',
        points: 2,
        prompt: `${classCode.toUpperCase()} ${subjectName} (${contextTitle}): Quyidagi ifodalardan qaysilari 1/2 ga teng kuchli? (Barcha to‘g‘ri javoblarni belgilang)`,
        options: [opt1, opt2, opt3, opt4],
        structuredOptions: [
          { code: 'A', text: opt1, isCorrect: true, displayOrder: 1 },
          { code: 'B', text: opt2, isCorrect: true, displayOrder: 2 },
          { code: 'C', text: opt3, isCorrect: false, displayOrder: 3 },
          { code: 'D', text: opt4, isCorrect: false, displayOrder: 4 },
        ],
        correctAnswer: `${opt1}|${opt2}`,
        correctAnswers: [opt1, opt2],
        gradingMode: 'auto',
        explanation: `${opt1} va ${opt2} kasrlarini qisqartirganda 1/2 hosil bo‘ladi.`,
        status: 'draft',
        version: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      continue;
    }

    if (selectedType === 'long_text') {
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
        type: 'long_text',
        points: 3,
        prompt: `${classCode.toUpperCase()} ${subjectName} (${contextTitle}): Mavzuning asosiy qoidasini misol yordamida bosqichma-bosqich tushuntirib yozing.`,
        correctAnswer: 'Bosqichma-bosqich yechim va xulosa',
        gradingMode: 'manual_rubric',
        rubricText: '1 ball — qoidani to‘g‘ri ifodalash; 1 ball — misol keltirish; 1 ball — to‘g‘ri yakuniy xulosa.',
        explanation: 'Yozma javob baholash mezoni (rubrika) asosida tekshiriladi.',
        status: 'draft',
        version: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      continue;
    }

    // Default: single_choice (with 4 distinct validated options)
    const k = qNum + 3;
    const ansVal = String(k * 4);
    const opts = [ansVal, String(k * 4 - 2), String(k * 4 + 3), String(k * 3)];

    const singlePrompt = subjNorm.includes('biologiya')
      ? `${classCode.toUpperCase()} Biologiya (${contextTitle}, ${qNum}-savol): Fotosintez jarayoni o‘simlik hujayrasining qaysi plastidasida kechadi?`
      : subjNorm.includes('kimyo')
      ? `${classCode.toUpperCase()} Kimyo (${contextTitle}, ${qNum}-savol): Suv molekulasining (H2O) nisbiy molekulyar massasi nechaga teng?`
      : subjNorm.includes('ingliz')
      ? `${classCode.toUpperCase()} Ingliz tili (${contextTitle}, ${qNum}-savol): Choose the correct form: "She ___ to the specialized school every day."`
      : `${classCode.toUpperCase()} ${subjectName} (${contextTitle}, ${qNum}-savol): Agar x / 4 = ${k} bo‘lsa, x ning qiymatini toping.`;

    const singleOptions = subjNorm.includes('biologiya')
      ? ['Xloroplast', 'Ribosoma', 'Lizosoma', 'Vakuola']
      : subjNorm.includes('kimyo')
      ? ['18', '16', '20', '14']
      : subjNorm.includes('ingliz')
      ? ['goes', 'go', 'going', 'gone']
      : opts;

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
      type: 'single_choice',
      points: 1,
      prompt: singlePrompt,
      options: singleOptions,
      structuredOptions: singleOptions.map((optText, idx) => ({
        code: ['A', 'B', 'C', 'D'][idx] || `OPT${idx + 1}`,
        text: optText,
        isCorrect: idx === 0,
        displayOrder: idx + 1,
      })),
      correctAnswer: singleCorrect,
      gradingMode: 'auto',
      explanation: `"${contextTitle}" mavzusi qoidasiga ko‘ra to‘g‘ri javob: ${singleCorrect}.`,
      status: 'draft',
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  return result;
}

export function parseUzbekAICommand(
  rawCommand: string,
  classes: ClassRoom[],
  subjects: SubjectItem[],
  lessons: LessonItem[],
  workPlans: WorkPlan[]
): {
  intent: AICommandExecutionResult['intent'];
  matchedClass?: ClassRoom;
  matchedSubject?: SubjectItem;
  matchedLesson?: LessonItem;
  matchedWorkPlan?: WorkPlan;
  lessonNumber?: number;
  quarter?: 1 | 2 | 3 | 4;
  questionCount: number;
  difficulty: QuestionDifficulty;
  warnings: string[];
} {
  const text = String(rawCommand || '').trim();
  const lower = text.toLowerCase();
  const warnings: string[] = [];

  // 1. Detect class code from the 19 official classes
  let matchedClass: ClassRoom | undefined;
  for (const code of [...OFFICIAL_19_CLASS_CODES].sort((a, b) => b.length - a.length)) {
    const regex = new RegExp(`\\b${code}\\b`, 'i');
    if (regex.test(lower)) {
      matchedClass = classes.find(
        (c) => (c.code || c.name).toLowerCase() === code.toLowerCase()
      );
      break;
    }
  }
  if (!matchedClass) {
    matchedClass = classes.find((c) => c.code === '7a1') || classes[0];
  }

  // 2. Detect subject
  let matchedSubject: SubjectItem | undefined;
  if (/matematika|algebra|geometriya/i.test(lower)) {
    matchedSubject = subjects.find((s) => s.name.toLowerCase().includes('matematika'));
  } else if (/ingliz|english/i.test(lower)) {
    matchedSubject = subjects.find((s) => s.name.toLowerCase().includes('ingliz'));
  } else if (/fizika/i.test(lower)) {
    matchedSubject = subjects.find((s) => s.name.toLowerCase().includes('fizika'));
  } else if (/biologiya/i.test(lower)) {
    matchedSubject = subjects.find((s) => s.name.toLowerCase().includes('biologiya'));
  } else if (/kimyo/i.test(lower)) {
    matchedSubject = subjects.find((s) => s.name.toLowerCase().includes('kimyo'));
  } else {
    for (const s of subjects) {
      if (lower.includes(s.name.toLowerCase())) {
        matchedSubject = s;
        break;
      }
    }
  }

  if (!matchedSubject && matchedClass) {
    const defaultSubjName = matchedClass.track === 'T' ? 'Biologiya' : 'Matematika';
    matchedSubject =
      subjects.find((s) => s.name.toLowerCase() === defaultSubjName.toLowerCase()) || subjects[0];
  }

  // Check class-subject track compatibility
  if (matchedClass && matchedSubject) {
    const compat = isSubjectCompatibleWithClass(matchedSubject.name, matchedClass, subjects);
    if (!compat.compatible && compat.reason) {
      warnings.push(compat.reason);
    }
  }

  // 3. Detect difficulty
  let difficulty: QuestionDifficulty = 'medium';
  if (/qiyin|murakkab\b/i.test(lower) && !/o‘rta|o'rta|orta/i.test(lower)) {
    difficulty = 'hard';
  } else if (/oson|yengil/i.test(lower)) {
    difficulty = 'easy';
  } else if (/o‘rta|o'rta|orta/i.test(lower)) {
    difficulty = 'medium';
  }

  // 4. Detect lesson number (e.g., "3-dars")
  const lessonMatch = lower.match(/(\d+)\s*-\s*dars/i);
  const lessonNumber = lessonMatch ? Number(lessonMatch[1]) : undefined;

  // 5. Detect quarter (e.g., "2-chorak")
  const quarterMatch = lower.match(/([1-4])\s*-\s*chorak/i);
  const quarter = quarterMatch ? (Number(quarterMatch[1]) as 1 | 2 | 3 | 4) : undefined;

  // 6. Detect question count or upcoming lessons count (e.g., "15 ta test", "10 ta savol", "5 ta dars")
  const countMatch = lower.match(/(\d+)\s*ta\s*(test|savol|dars|mashq)/i);
  const questionCount = countMatch ? Math.max(1, Math.min(40, Number(countMatch[1]))) : 10;

  // 7. Determine intent
  if (/o['‘`]?quvchilar.*sarala|sarala.*o['‘`]?quvchi/i.test(lower)) {
    return {
      intent: 'sort_class_students',
      matchedClass,
      matchedSubject,
      questionCount,
      difficulty,
      warnings,
    };
  }

  if (/o['‘`]?quvchilar.*ko['‘`]?rsat|sinf.*o['‘`]?quvchilar/i.test(lower)) {
    return {
      intent: 'show_class_students',
      matchedClass,
      matchedSubject,
      questionCount,
      difficulty,
      warnings,
    };
  }

  if (/ish\s*reja.*o['‘`]?quv\s*xarita|xaritaga\s*aylantir/i.test(lower)) {
    const matchedWorkPlan = workPlans.find(
      (wp) =>
        !matchedClass ||
        wp.classId === matchedClass.id ||
        wp.classCode.toLowerCase() === matchedClass.code.toLowerCase()
    );
    return {
      intent: 'convert_work_plan_to_map',
      matchedClass,
      matchedSubject,
      matchedWorkPlan,
      questionCount,
      difficulty,
      warnings,
    };
  }

  if (/keyingi.*dars.*ko['‘`]?rsat|darslarni\s*ko['‘`]?rsat|darsini\s*ko['‘`]?rsat|shu\s*chorakdagi\s*dars/i.test(lower)) {
    return {
      intent: 'show_upcoming_lessons',
      matchedClass,
      matchedSubject,
      quarter,
      questionCount: countMatch ? Number(countMatch[1]) : 10,
      difficulty,
      warnings,
    };
  }

  if (quarter && /takrorlash|chorak/i.test(lower)) {
    return {
      intent: 'generate_quarter_review_test',
      matchedClass,
      matchedSubject,
      quarter,
      questionCount,
      difficulty,
      warnings,
    };
  }

  if (/bugungi\s*dars/i.test(lower)) {
    const classLessons = lessons.filter(
      (l) =>
        (!matchedClass || l.classCode.toLowerCase() === matchedClass.code.toLowerCase()) &&
        (!matchedSubject || l.subjectName.toLowerCase() === matchedSubject.name.toLowerCase())
    );
    const matchedLesson =
      classLessons.find((l) => l.status === 'in_progress' || l.status === 'published') ||
      classLessons[0];

    return {
      intent: 'generate_today_questions',
      matchedClass,
      matchedSubject,
      matchedLesson,
      questionCount,
      difficulty,
      warnings,
    };
  }

  // Default: generate_lesson_test
  const classLessons = lessons.filter(
    (l) =>
      (!matchedClass || l.classCode.toLowerCase() === matchedClass.code.toLowerCase()) &&
      (!matchedSubject || l.subjectName.toLowerCase() === matchedSubject.name.toLowerCase())
  );
  const matchedLesson = lessonNumber
    ? classLessons.find((l) => l.lessonNumber === lessonNumber) || classLessons[0]
    : classLessons[0];

  return {
    intent: 'generate_lesson_test',
    matchedClass,
    matchedSubject,
    matchedLesson,
    lessonNumber,
    quarter,
    questionCount,
    difficulty,
    warnings,
  };
}
