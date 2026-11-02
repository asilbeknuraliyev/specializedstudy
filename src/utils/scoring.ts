import {
  QuestionItem,
  StudentAnswerItem,
  TopicBreakdownItem,
  MasteryRecord,
  MasteryStatusLabel,
  Topic,
  AIAnalysisResult,
  LearningPathItem,
  AssessmentAttempt,
} from '../types';

export const MINIMUM_EVIDENCE_THRESHOLD = 3;

export function normalizeAnswer(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/,/g, '.');
}

function parseMultiAnswerList(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => normalizeAnswer(String(x))).filter(Boolean).sort();
      }
    } catch {
      // Fall through
    }
  }
  return trimmed
    .split(/[;|,]/)
    .map((s) => normalizeAnswer(s))
    .filter(Boolean)
    .sort();
}

export function isAnswerCorrect(question: QuestionItem, submittedAnswer: string): boolean {
  if (!submittedAnswer || !String(submittedAnswer).trim()) {
    return false;
  }

  // Numeric answer with optional tolerance
  if (question.type === 'numeric') {
    const normalizedSubmitted = normalizeAnswer(submittedAnswer);
    const normalizedCorrect = normalizeAnswer(question.correctAnswer);
    const numSub = Number(normalizedSubmitted);
    const numCor = Number(normalizedCorrect);
    const tolerance =
      typeof question.numericTolerance === 'number' && question.numericTolerance >= 0
        ? question.numericTolerance
        : 0.0001;
    if (!Number.isNaN(numSub) && !Number.isNaN(numCor)) {
      return Math.abs(numSub - numCor) <= tolerance + 1e-9;
    }
    return false;
  }

  // Short-text answer with acceptedAnswers list
  if (question.type === 'short_text') {
    if (question.acceptedAnswers && question.acceptedAnswers.length > 0) {
      return question.acceptedAnswers.some((acc) => {
        const rawTarget = String(acc.acceptedAnswer ?? acc.text ?? '');
        const subVal = acc.trimWhitespace !== false ? submittedAnswer.trim() : submittedAnswer;
        const targetVal = acc.trimWhitespace !== false ? rawTarget.trim() : rawTarget;
        if (acc.caseSensitive) {
          return subVal === targetVal;
        }
        return subVal.toLowerCase() === targetVal.toLowerCase();
      });
    }
    if (question.gradingMode === 'manual' || question.gradingMode === 'ai_assisted') {
      return false;
    }
    return (
      submittedAnswer.trim().toLowerCase() ===
      String(question.correctAnswer || '').trim().toLowerCase()
    );
  }

  // Long written answer requires teacher / rubric review
  if (question.type === 'long_text') {
    return false;
  }

  // Multiple choice with >1 correct option
  const multiCorrectList =
    question.correctAnswers && question.correctAnswers.length > 0
      ? question.correctAnswers
      : question.structuredOptions &&
        question.structuredOptions.filter((o) => o.isCorrect).length > 1
      ? question.structuredOptions
          .filter((o) => o.isCorrect)
          .map((o) => o.text || o.code || o.key || '')
      : null;

  if (question.type === 'multiple_choice' && multiCorrectList && multiCorrectList.length > 1) {
    const subSet = parseMultiAnswerList(submittedAnswer);
    const corSet = multiCorrectList.map((c) => normalizeAnswer(c || '')).filter(Boolean).sort();
    if (subSet.length === corSet.length && subSet.every((val, idx) => val === corSet[idx])) {
      return true;
    }
    if (question.structuredOptions && question.structuredOptions.length > 0) {
      const correctOpts = question.structuredOptions.filter((o) => o.isCorrect);
      const codeSet = correctOpts
        .map((o) => normalizeAnswer(o.code || o.key || ''))
        .filter(Boolean)
        .sort();
      if (subSet.length === codeSet.length && subSet.every((val, idx) => val === codeSet[idx])) {
        return true;
      }
      const textSet = correctOpts
        .map((o) => normalizeAnswer(o.text || ''))
        .filter(Boolean)
        .sort();
      if (subSet.length === textSet.length && subSet.every((val, idx) => val === textSet[idx])) {
        return true;
      }
    }
    return false;
  }

  // Single choice (or standard 1-key multiple_choice)
  const normalizedSubmitted = normalizeAnswer(submittedAnswer);
  const normalizedCorrect = normalizeAnswer(question.correctAnswer);
  if (normalizedSubmitted === normalizedCorrect) return true;

  if (question.structuredOptions && question.structuredOptions.length > 0) {
    const correctOpt = question.structuredOptions.find((o) => o.isCorrect);
    if (correctOpt) {
      if (
        normalizeAnswer(correctOpt.text) === normalizedSubmitted ||
        normalizeAnswer(correctOpt.code || correctOpt.key || '') === normalizedSubmitted
      ) {
        return true;
      }
    }
  }

  return false;
}

export function getMasteryStatusLabel(accuracy: number, evidenceCount: number): MasteryStatusLabel {
  if (evidenceCount <= 0) {
    return 'Boshlanmagan';
  }
  if (evidenceCount < MINIMUM_EVIDENCE_THRESHOLD) {
    return "Ma'lumot yetarli emas";
  }
  if (accuracy >= 80) {
    return 'Yaxshi o‘zlashtirilgan';
  }
  if (accuracy >= 60) {
    return 'Mustahkamlanmoqda';
  }
  return 'O‘rganilmoqda';
}

export interface ScoredAssessmentOutput {
  scorePercent: number;
  correctCount: number;
  totalQuestions: number;
  earnedPoints: number;
  totalPoints: number;
  pendingManualCount: number;
  gradingStatus: 'completed' | 'pending_manual_review';
  answers: StudentAnswerItem[];
  topicBreakdown: TopicBreakdownItem[];
}

export function scoreAssessmentSubmission(
  questions: QuestionItem[],
  submittedMap: Record<string, string>,
  topicsMap: Record<string, Topic>
): ScoredAssessmentOutput {
  const totalQuestions = questions.length;
  if (totalQuestions === 0) {
    return {
      scorePercent: 0,
      correctCount: 0,
      totalQuestions: 0,
      earnedPoints: 0,
      totalPoints: 0,
      pendingManualCount: 0,
      gradingStatus: 'completed',
      answers: [],
      topicBreakdown: [],
    };
  }

  let correctCount = 0;
  let earnedPoints = 0;
  let totalPoints = 0;
  let pendingManualCount = 0;

  const answers: StudentAnswerItem[] = [];
  const topicCounters: Record<string, { total: number; correct: number; topicName: string }> = {};

  for (const q of questions) {
    const rawSubmitted = submittedMap[q.id] ?? '';
    const maxPts = typeof q.points === 'number' && q.points > 0 ? q.points : 1;
    totalPoints += maxPts;

    const requiresManualReview =
      q.type === 'long_text' ||
      q.gradingMode === 'manual' ||
      q.gradingMode === 'manual_rubric' ||
      q.gradingMode === 'ai_assisted' ||
      (q.type === 'short_text' &&
        (!q.acceptedAnswers || q.acceptedAnswers.length === 0) &&
        !q.correctAnswer);

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
      gradingStatus: requiresManualReview ? 'pending_review' : 'auto_graded',
      gradingMode: q.gradingMode || (q.type === 'long_text' ? 'manual' : 'automatic'),
      rubricText: q.rubricText,
      prompt: q.prompt,
      explanation: q.explanation,
      imageUrl: q.imageUrl,
    });

    const tName = topicsMap[q.topicId]?.name || q.topicId;
    if (!topicCounters[q.topicId]) {
      topicCounters[q.topicId] = { total: 0, correct: 0, topicName: tName };
    }
    topicCounters[q.topicId].total += 1;
    if (correct) {
      topicCounters[q.topicId].correct += 1;
    }
  }

  const scorePercent =
    totalPoints > 0
      ? Math.round((earnedPoints / totalPoints) * 100)
      : Math.round((correctCount / totalQuestions) * 100);
  const topicBreakdown: TopicBreakdownItem[] = Object.entries(topicCounters).map(
    ([topicId, counts]) => ({
      topicId,
      topicName: counts.topicName,
      total: counts.total,
      correct: counts.correct,
      accuracy: Math.round((counts.correct / counts.total) * 100),
    })
  );

  return {
    scorePercent,
    correctCount,
    totalQuestions,
    earnedPoints,
    totalPoints,
    pendingManualCount,
    gradingStatus: pendingManualCount > 0 ? 'pending_manual_review' : 'completed',
    answers,
    topicBreakdown,
  };
}

export function recalculateAttemptAfterManualGrading(
  attempt: AssessmentAttempt,
  questionId: string,
  awardedPoints: number,
  teacherFeedback: string,
  confirmedBy: string | { uid: string; displayName: string },
  topicsMapOrNowIso?: Record<string, Topic> | string,
  nowIsoArg?: string
): AssessmentAttempt {
  const confirmedByUid = typeof confirmedBy === 'string' ? confirmedBy : confirmedBy.uid;
  const confirmedByName =
    typeof confirmedBy === 'string' ? confirmedBy : confirmedBy.displayName;
  const topicsMap: Record<string, Topic> =
    typeof topicsMapOrNowIso === 'object' && topicsMapOrNowIso !== null
      ? topicsMapOrNowIso
      : {};
  const nowIso =
    typeof topicsMapOrNowIso === 'string'
      ? topicsMapOrNowIso
      : nowIsoArg || new Date().toISOString();

  let earnedPoints = 0;
  let totalPoints = 0;
  let correctCount = 0;
  let pendingCount = 0;
  const topicCounters: Record<string, { total: number; correct: number; topicName: string }> = {};

  const updatedAnswers = attempt.answers.map((ans) => {
    const maxPts = typeof ans.maxPoints === 'number' && ans.maxPoints > 0 ? ans.maxPoints : 1;
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
        gradingStatus: 'graded' as const,
        teacherFeedback: teacherFeedback.trim(),
        confirmedByUid,
        confirmedByName,
        confirmedAt: nowIso,
      };
    } else {
      const pts =
        typeof ans.awardedPoints === 'number' ? ans.awardedPoints : ans.isCorrect ? maxPts : 0;
      earnedPoints += pts;
      if (ans.isCorrect) correctCount += 1;
      if (ans.gradingStatus === 'pending_review') pendingCount += 1;
    }

    const existingTb = attempt.topicBreakdown?.find((t) => t.topicId === finalAns.topicId);
    const tName =
      topicsMap[finalAns.topicId]?.name || existingTb?.topicName || finalAns.topicId;
    if (!topicCounters[finalAns.topicId]) {
      topicCounters[finalAns.topicId] = { total: 0, correct: 0, topicName: tName };
    }
    topicCounters[finalAns.topicId].total += 1;
    if (finalAns.isCorrect) {
      topicCounters[finalAns.topicId].correct += 1;
    }

    return finalAns;
  });

  const scorePercent =
    totalPoints > 0
      ? Math.round((earnedPoints / totalPoints) * 100)
      : Math.round((correctCount / Math.max(1, attempt.totalQuestions)) * 100);

  const updatedTopicBreakdown: TopicBreakdownItem[] = Object.entries(topicCounters).map(
    ([topicId, counts]) => ({
      topicId,
      topicName: counts.topicName,
      total: counts.total,
      correct: counts.correct,
      accuracy: Math.round((counts.correct / counts.total) * 100),
    })
  );

  const resolvedStatus = pendingCount > 0 ? 'pending_manual_review' : 'completed';

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
    gradingStatus: resolvedStatus,
  };
}

export function updateMasteryRecordsFromAttempt(
  existingRecords: MasteryRecord[],
  studentId: string,
  institutionId: string,
  topicBreakdown: TopicBreakdownItem[],
  topics: Topic[],
  timestampIso: string
): MasteryRecord[] {
  const recordByTopic: Record<string, MasteryRecord> = {};
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
        statusLabel: 'Boshlanmagan',
        lastAssessedAt: timestampIso,
      };
    }
  }

  for (const tb of topicBreakdown) {
    const current = recordByTopic[tb.topicId];
    if (!current) continue;

    const newAssessed = current.assessedQuestions + tb.total;
    const newCorrect = current.correctAnswers + tb.correct;
    const newAccuracy = newAssessed > 0 ? Math.round((newCorrect / newAssessed) * 100) : 0;
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
      lastAssessedAt: timestampIso,
    };
  }

  return Object.values(recordByTopic);
}

export function buildDeterministicFallbackAnalysis(
  assessmentTitle: string,
  scorePercent: number,
  topicBreakdown: TopicBreakdownItem[],
  answers: StudentAnswerItem[]
): AIAnalysisResult {
  const sortedTopics = [...topicBreakdown].sort((a, b) => a.accuracy - b.accuracy);
  const weakest = sortedTopics[0];
  const strongest = sortedTopics[sortedTopics.length - 1];

  const topic_analysis = topicBreakdown.map((tb) => {
    const topicWrongAnswers = answers.filter((a) => a.topicId === tb.topicId && !a.isCorrect);
    const confidence: 'low' | 'medium' | 'high' =
      tb.total >= 4 ? 'high' : tb.total >= 2 ? 'medium' : 'low';

    let possiblePattern = "Asosiy tushunchalar to'g'ri qo'llangan.";
    let recommendation = "Keyingi murakkablikdagi masalalarni ishlashda davom eting.";

    if (tb.accuracy < 60) {
      possiblePattern =
        topicWrongAnswers.length > 0
          ? `Hisoblash qadamlari yoki formulani qo'llashda xatolik kuzatildi (${topicWrongAnswers.length} ta savolda).`
          : "Mavzu bo'yicha amaliy ko'nikmalarni mustahkamlash zarur.";
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
      recommendation,
    };
  });

  const next_steps = sortedTopics.slice(0, 3).map((tb) => ({
    topic_id: tb.topicId,
    activity:
      tb.accuracy < 60
        ? `${tb.topicName}: Asosiy tushunchalar va 5 ta amaliy mashq`
        : `${tb.topicName}: Mustahkamlovchi 5 ta diagnostik masala`,
    reason: `Testda ushbu mavzu bo'yicha ${tb.accuracy}% aniqlik qayd etildi (${tb.correct}/${tb.total}).`,
    priority: (tb.accuracy < 50 ? 'high' : tb.accuracy < 75 ? 'medium' : 'low') as
      | 'low'
      | 'medium'
      | 'high',
  }));

  const summary =
    weakest && strongest
      ? `"${assessmentTitle}" testi bo'yicha umumiy natija ${scorePercent}% ni tashkil etdi. "${strongest.topicName}" mavzusida ijobiy ko'rsatkich (${strongest.accuracy}%) kuzatildi, biroq "${weakest.topicName}" mavzusida (${weakest.accuracy}%) qo'shimcha amaliyot talab etiladi.`
      : `"${assessmentTitle}" testi yakunlandi. Umumiy natija: ${scorePercent}%.`;

  const teacher_summary =
    weakest
      ? `O'quvchi umumiy ${scorePercent}% natija ko'rsatdi. Eng ko'p xatolik "${weakest.topicName}" mavzusida (${weakest.correct}/${weakest.total}) kuzatildi. Dars jarayonida ushbu mavzudagi amaliy yechim qadamlarini qayta ko'rib chiqish tavsiya etiladi.`
      : `O'quvchi testni ${scorePercent}% natija bilan yakunladi.`;

  const parent_summary =
    weakest
      ? `Farzandingiz "${assessmentTitle}" testida ${scorePercent}% natija qayd etdi. Uyda "${weakest.topicName}" mavzusidagi mashqlarni 15-20 daqiqa birgalikda takrorlash foydali bo'ladi.`
      : `Farzandingiz testni ${scorePercent}% natija bilan topshirdi.`;

  return {
    summary,
    topic_analysis,
    next_steps,
    teacher_summary,
    parent_summary,
    generatedAt: new Date().toISOString(),
    isFallback: true,
  };
}

export function generateLearningPathsFromAttempt(
  studentId: string,
  institutionId: string,
  topicBreakdown: TopicBreakdownItem[],
  existingPaths: LearningPathItem[]
): LearningPathItem[] {
  const pathMap: Record<string, LearningPathItem> = {};
  for (const p of existingPaths) {
    if (p.studentId === studentId) {
      pathMap[p.topicId] = p;
    }
  }

  for (const tb of topicBreakdown) {
    const priority: 'high' | 'medium' | 'low' =
      tb.accuracy < 60 ? 'high' : tb.accuracy < 80 ? 'medium' : 'low';
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
      createdAt: existing?.createdAt || new Date().toISOString(),
      steps: existing?.steps || [
        {
          stepNumber: 1,
          title: '1-qadam: Asosiy tushuncha va qoida sharhi',
          description: `"${tb.topicName}" mavzusi bo'yicha asosiy matematik qoidalar va formulalarni ko'rib chiqish.`,
          type: 'concept',
          status: 'not_started',
          content: `${tb.topicName}: Har bir amalni bajarishdan oldin ishoralar, maxrajlar yoki tenglama hadlarini tartib bilan tekshiring.`,
        },
        {
          stepNumber: 2,
          title: '2-qadam: Bosqichma-bosqich yechilgan namuna',
          description: 'Namunaviy misolning to‘liq yechilish ketma-ketligini tahlil qilish.',
          type: 'example',
          status: 'not_started',
          content: `Namuna (${tb.topicName}): Berilgan ifodani soddalashtiring -> O'xshash hadlarni ixchamlang -> Natijani tekshirib ko'ring.`,
        },
        {
          stepNumber: 3,
          title: '3-qadam: Yo‘naltirilgan amaliy mashq',
          description: 'Ko‘rsatmalar yordamida 3 ta maqsadli misolni mustaqil ishlash.',
          type: 'practice',
          status: 'not_started',
          content: `Mashq: "${tb.topicName}" bo'yicha o'rta qiyinlikdagi 3 ta misolni yeching va har bir qadamni daftariga yozing.`,
        },
        {
          stepNumber: 4,
          title: '4-qadam: Xatolarni tahlil qilish va takrorlash',
          description: 'Diagnostik testda xato qilingan savollar yechimini qayta ko‘rib chiqish.',
          type: 'review',
          status: 'not_started',
          content: `Test natijalari sahifasidagi "${tb.topicName}" savollarining matematik izohini o'qib chiqing.`,
        },
        {
          stepNumber: 5,
          title: '5-qadam: Qayta diagnostik tekshiruv',
          description: 'O‘zlashtirish darajasini tasdiqlash uchun yakuniy sinov.',
          type: 'reassessment',
          status: 'not_started',
          content: `Mavzu bo'yicha kamida 80% aniqlikka erishish uchun navbatdagi diagnostik sinovni topshiring.`,
        },
      ],
    };
  }

  return Object.values(pathMap);
}
