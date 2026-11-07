import { ExamAnswerContent } from './ExamAnswers';
import React, { useState } from 'react';
import {
  Download,
  Upload,
  FileSpreadsheet,
  FolderArchive,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Plus,
  Trash2,
  Image as ImageIcon,
  Sparkles,
  History,
  Check,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { useLearnOS } from '../context/LearnOSContext';
import {
  QuestionItem,
  QuestionType,
  QuestionDifficulty,
  GradingMode,
  QuestionOption,
  AcceptedAnswer,
  AssessmentAttempt,
} from '../types';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Bir tanlovli test (Single Choice)',
  multiple_choice: "Ko'p tanlovli test (Multiple Choice)",
  multi_select: "Ko'p tanlovli (Multi-select)",
  numeric: 'Sonli javob (Numeric + Tolerance)',
  short_text: 'Qisqa matnli javob (Short Text)',
  long_text: 'Yozma / kengaytirilgan javob (Long Text / Essay)',
  written_open: 'Ochiq yozma javob (Written Open)',
};

export const ExcelImportCenterPanel: React.FC<{
  targetInstitutionId?: string;
  onImportSuccess?: (assessmentId?: string) => void;
}> = ({ targetInstitutionId, onImportSuccess }) => {
  const {
    institution,
    institutions,
    classes,
    importBatches,
    validateImportPackage,
    confirmImportPackage,
    addToast,
  } = useLearnOS();

  const [selectedInstId, setSelectedInstId] = useState<string>(
    targetInstitutionId || institution.id
  );
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [importMode, setImportMode] = useState<
    'draft_assessment' | 'question_bank_only' | 'assessment_and_bank'
  >('draft_assessment');
  const [duplicatePolicy, setDuplicatePolicy] = useState<
    'update_existing' | 'skip_existing' | 'import_new_only'
  >('update_existing');

  const [fileName, setFileName] = useState<string>('');
  const [fileBase64, setFileBase64] = useState<string>('');
  const [validating, setValidating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [validationResult, setValidationResult] = useState<any | null>(null);

  const instClasses = classes.filter((c) => c.institutionId === selectedInstId);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.zip')) {
      addToast('error', 'Faqat .xlsx yoki .zip formatdagi paketlarni yuklash mumkin');
      return;
    }

    setFileName(file.name);
    setValidationResult(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const resultStr = String(reader.result || '');
      const base64 = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
      setFileBase64(base64);
      setValidating(true);
      try {
        const report = await validateImportPackage(file.name, base64, selectedInstId);
        setValidationResult(report);
        if (report.valid) {
          addToast(
            'success',
            `Fayl tekshiruvdan o'tdi: ${report.summary.totalQuestions} ta savol tayyor`
          );
        } else {
          addToast(
            'error',
            `Faylda ${report.errors.length} ta xatolik aniqlandi`,
            "Quyidagi jadvaldan xatolik qatorlari va sababini ko'ring"
          );
        }
      } catch (err: any) {
        addToast('error', err?.message || 'Faylni tekshirishda xatolik');
      } finally {
        setValidating(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadErrorsCsv = () => {
    if (!validationResult || !Array.isArray(validationResult.errors)) return;
    const header = 'Sheet,Row,Column,Severity,Message\n';
    const rows = validationResult.errors
      .concat(validationResult.warnings || [])
      .map(
        (err: any) =>
          `"${err.sheet}",${err.row},"${err.column}","${err.severity}","${String(
            err.message
          ).replace(/"/g, '""')}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LearnOS_Import_Errors_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmImport = async () => {
    if (!validationResult?.valid || !fileBase64) return;
    setConfirming(true);
    try {
      const result = await confirmImportPackage({
        fileName,
        base64Data: fileBase64,
        institutionId: selectedInstId,
        classId: selectedClassId || undefined,
        importMode,
        duplicatePolicy,
      });
      setValidationResult(null);
      setFileName('');
      setFileBase64('');
      if (onImportSuccess) {
        onImportSuccess(result.assessment?.id);
      }
    } catch (err: any) {
      addToast('error', err?.message || 'Importni tasdiqlashda xatolik');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Official Template & Format Guide Download */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              1-Qadam: Rasmiy Shablon va Qo‘llanma
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              LearnOS Excel (.xlsx) va Rasmli ZIP (.zip) Import Standarti
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
              6 ta varaqdan iborat rasmiy Excel shablonini yuklab oling (
              <code>Instructions</code>, <code>Assessment</code>, <code>Questions</code>,{' '}
              <code>Options</code>, <code>AcceptedAnswers</code>, <code>Topics</code>). Agar
              savollarda geometrik chizma, grafik yoki formula rasmlari bo‘lsa, Excel faylni va{' '}
              <code>media/</code> papkasini bitta <code>.zip</code> arxivga joylab yuklang.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <a
              href="/api/import/template.xlsx"
              download="LearnOS_Assessment_Import_Template.xlsx"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              Rasmiy .xlsx shablonni yuklab olish
            </a>
            <a
              href="/api/import/guide.md"
              download="LearnOS_Import_Guide.md"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
            >
              <FileText className="w-4 h-4" />
              Qo‘llanma (.md)
            </a>
          </div>
        </div>
      </div>

      {/* Step 2 & 3: Configuration & File Upload */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            2-Qadam: Import Sozlamalari va Paketni Yuklash (.xlsx yoki .zip)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {institutions.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Maqsadli Muassasa
              </label>
              <select
                value={selectedInstId}
                onChange={(e) => setSelectedInstId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              >
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Import Rejimi
            </label>
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            >
              <option value="draft_assessment">
                Qoralama Test (Draft Assessment) + Savollar Bazasiga
              </option>
              <option value="question_bank_only">Faqat Savollar Bazasiga (Question Bank)</option>
              <option value="assessment_and_bank">To‘liq Paket (Test + Savollar Bazasi)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Takroriy savol kodlari (Duplicate Policy)
            </label>
            <select
              value={duplicatePolicy}
              onChange={(e) => setDuplicatePolicy(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            >
              <option value="update_existing">
                Mavjud savolni yangilash (yangi reviziya saqlanadi)
              </option>
              <option value="skip_existing">Mavjud savollarni o‘tkazib yuborish (Skip)</option>
              <option value="import_new_only">Faqat yangi savollarni qo‘shish</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Sinfga biriktirish (ixtiyoriy)
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            >
              <option value="">Sinf tanlanmagan (umumiy qoralama)</option>
              {instClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.subject})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* File Dropzone */}
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl p-8 cursor-pointer transition-colors bg-slate-50/60 dark:bg-slate-800/30">
          <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400 mb-2">
            <Upload className="w-6 h-6" />
            <FolderArchive className="w-6 h-6" />
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {fileName
              ? `Tanlangan fayl: ${fileName}`
              : 'Excel (.xlsx) yoki Rasmli Paket (.zip) faylini tanlang'}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Maksimal rasm hajmi: 5 MB (PNG, JPG, WEBP). Barcha ustunlar va javob kalitlari avtomatik tekshiriladi.
          </span>
          <input
            type="file"
            accept=".xlsx,.zip"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>

        {validating && (
          <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
            <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <span>Paket tuzilmasi, savollar va media fayllar tekshirilmoqda...</span>
          </div>
        )}
      </div>

      {/* Step 4 & 5: Validation Summary, Error Report & Question Preview */}
      {validationResult && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              {validationResult.valid ? (
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <XCircle className="w-5 h-5" />
                </div>
              )}
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {validationResult.valid
                    ? '3-Qadam: Validatsiya muvaffaqiyatli — Importga tayyor!'
                    : `Validatsiya xatoligi: ${validationResult.errors.length} ta muammo topildi`}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Test: <strong>{validationResult.assessmentMeta?.title}</strong> •{' '}
                  {validationResult.summary?.totalQuestions || 0} ta savol •{' '}
                  {validationResult.summary?.totalOptions || 0} ta variant •{' '}
                  {validationResult.summary?.totalMedia || 0} ta rasm
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {(validationResult.errors?.length > 0 ||
                validationResult.warnings?.length > 0) && (
                <button
                  type="button"
                  onClick={handleDownloadErrorsCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  Xatoliklar hisoboti (CSV)
                </button>
              )}

              {validationResult.valid && (
                <button
                  type="button"
                  disabled={confirming}
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                >
                  <Check className="w-4 h-4" />
                  {confirming
                    ? 'Saqlanmoqda...'
                    : 'Importni tasdiqlash va Qoralama (Draft) sifatida saqlash'}
                </button>
              )}
            </div>
          </div>

          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
              <p className="text-[11px] text-slate-500">Jami savollar</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {validationResult.summary?.totalQuestions || 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
              <p className="text-[11px] text-slate-500">Tanlovli (Single/Multi)</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {(validationResult.summary?.singleChoiceCount || 0) +
                  (validationResult.summary?.multipleChoiceCount || 0)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
              <p className="text-[11px] text-slate-500">Sonli (Numeric)</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {validationResult.summary?.numericCount || 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
              <p className="text-[11px] text-slate-500">Qisqa / Yozma</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {(validationResult.summary?.shortTextCount || 0) +
                  (validationResult.summary?.longTextCount || 0)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
              <p className="text-[11px] text-slate-500">Rasmlar (Media)</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {validationResult.summary?.totalMedia || 0}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
              <p className="text-[11px] text-slate-500">Xatolar / Ogohlantirish</p>
              <p
                className={`text-lg font-bold ${
                  validationResult.errors?.length > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {validationResult.errors?.length || 0} /{' '}
                {validationResult.warnings?.length || 0}
              </p>
            </div>
          </div>

          {/* Errors & Warnings Table */}
          {(validationResult.errors?.length > 0 ||
            validationResult.warnings?.length > 0) && (
            <div className="space-y-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Qatorlar bo‘yicha tekshiruv hisoboti
              </h5>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Holat</th>
                      <th className="py-2.5 px-3">Varaq (Sheet)</th>
                      <th className="py-2.5 px-3">Qator (Row)</th>
                      <th className="py-2.5 px-3">Ustun (Column)</th>
                      <th className="py-2.5 px-3">Sabab va Tuzatish bo‘yicha ko‘rsatma</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {[
                      ...(validationResult.errors || []),
                      ...(validationResult.warnings || []),
                    ].map((err: any, idx: number) => (
                      <tr key={idx}>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold ${
                              err.severity === 'error'
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {err.severity === 'error' ? 'XATO' : 'OGOHLANTIRISH'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono">{err.sheet}</td>
                        <td className="py-2 px-3 font-mono">{err.row}</td>
                        <td className="py-2 px-3 font-mono">{err.column}</td>
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                          {err.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Question & Image Preview List */}
          {Array.isArray(validationResult.questions) &&
            validationResult.questions.length > 0 && (
              <div className="space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  4-Qadam: Savollar, Javob Kalitlari va Biriktirilgan Rasmlar Oldindan Ko‘rinishi (
                  {validationResult.questions.length} ta)
                </h5>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {validationResult.questions.map((q: QuestionItem, idx: number) => (
                    <div
                      key={q.id || idx}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[11px] font-mono font-bold">
                            #{idx + 1} • {q.code}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium">
                            {QUESTION_TYPE_LABELS[q.type] || q.type}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {q.points || 1} ball • {q.difficulty}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                          Kalit: {q.correctAnswer || '(Rubrika asosida)'}
                          {q.numericTolerance ? ` (±${q.numericTolerance})` : ''}
                        </span>
                      </div>

                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {q.prompt}
                      </p>

                      {q.imageUrl && (
                        <div className="pt-1">
                          <img
                            src={q.imageUrl}
                            alt={q.title || q.code || 'Question illustration'}
                            className="max-h-40 rounded-lg border border-slate-200 dark:border-slate-700 object-contain bg-white p-1"
                          />
                        </div>
                      )}

                      {q.structuredOptions && q.structuredOptions.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {q.structuredOptions.map((opt) => (
                            <div
                              key={opt.key}
                              className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                                opt.isCorrect
                                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-semibold'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <span>
                                <strong>{opt.key}.</strong> {opt.text}
                              </span>
                              {opt.imageUrl && (
                                <img
                                  src={opt.imageUrl}
                                  alt={`Option ${opt.key}`}
                                  className="h-10 w-10 object-contain rounded border bg-white"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {q.rubricText && (
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30 p-2 rounded-lg">
                          <strong>Baholash mezoni (Rubrika):</strong> {q.rubricText}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* Import History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Import Tarixi (Import Batches)
        </h3>
        {importBatches.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            Hozircha Excel yoki ZIP paketlar import qilinmagan. Yuqoridagi rasmiy shablonni yuklab olib sinab ko‘ring.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2.5 pr-4">Sana</th>
                  <th className="py-2.5 pr-4">Fayl</th>
                  <th className="py-2.5 pr-4">Test sarlavhasi</th>
                  <th className="py-2.5 pr-4">Savollar</th>
                  <th className="py-2.5 pr-4">Media</th>
                  <th className="py-2.5 pr-4">Yuklovchi</th>
                  <th className="py-2.5">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {importBatches.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2.5 pr-4 text-slate-500">
                      {new Date(b.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 font-mono">{b.fileName}</td>
                    <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-white">
                      {b.assessmentTitle || 'Savollar bazasi'}
                    </td>
                    <td className="py-2.5 pr-4">{b.questionsCount} ta</td>
                    <td className="py-2.5 pr-4">{b.mediaCount} ta rasm</td>
                    <td className="py-2.5 pr-4">{b.importedByName}</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold">
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const AdvancedQuestionEditorModal: React.FC<{
  initialQuestion?: QuestionItem | null;
  editingQuestion?: QuestionItem | null;
  onClose: () => void;
  onSaved?: (q: QuestionItem) => void;
}> = ({ initialQuestion: initProp, editingQuestion, onClose, onSaved }) => {
  const initialQuestion = initProp ?? editingQuestion ?? null;
  const {
    topics,
    subjects,
    questionRevisions,
    createQuestion,
    updateQuestion,
    uploadMediaFile,
    addToast,
  } = useLearnOS();

  const [code, setCode] = useState(
    initialQuestion?.code || `Q-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [title, setTitle] = useState(initialQuestion?.title || '');
  const [subject, setSubject] = useState(initialQuestion?.subject || 'Matematika');
  const [grade, setGrade] = useState<number>(initialQuestion?.grade || 8);
  const [topicId, setTopicId] = useState(
    initialQuestion?.topicId || topics[0]?.id || 'topic-fractions'
  );
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(
    initialQuestion?.difficulty || 'medium'
  );
  const [qType, setQType] = useState<QuestionType>(
    initialQuestion?.type || 'single_choice'
  );
  const [points, setPoints] = useState<number>(initialQuestion?.points || 1);
  const [prompt, setPrompt] = useState(initialQuestion?.prompt || '');
  const [instructions, setInstructions] = useState(initialQuestion?.instructions || '');
  const [explanation, setExplanation] = useState(initialQuestion?.explanation || '');
  const [imageUrl, setImageUrl] = useState(initialQuestion?.imageUrl || '');
  const [explanationImageUrl, setExplanationImageUrl] = useState(
    initialQuestion?.explanationImageUrl || ''
  );

  // Choice options state
  const [structuredOptions, setStructuredOptions] = useState<QuestionOption[]>(() => {
    if (
      initialQuestion?.structuredOptions &&
      initialQuestion.structuredOptions.length > 0
    ) {
      return initialQuestion.structuredOptions;
    }
    if (initialQuestion?.options && initialQuestion.options.length > 0) {
      return initialQuestion.options.map((text, idx) => {
        const key = String.fromCharCode(65 + idx);
        return {
          key,
          text,
          isCorrect:
            initialQuestion.correctAnswer === text ||
            initialQuestion.correctAnswer === key ||
            Boolean(initialQuestion.correctAnswers?.includes(text)),
        };
      });
    }
    return [
      { key: 'A', text: '', isCorrect: true },
      { key: 'B', text: '', isCorrect: false },
      { key: 'C', text: '', isCorrect: false },
      { key: 'D', text: '', isCorrect: false },
    ];
  });

  // Numeric & Short/Long Text state
  const [correctAnswer, setCorrectAnswer] = useState(
    initialQuestion?.correctAnswer || ''
  );
  const [numericTolerance, setNumericTolerance] = useState<string>(
    initialQuestion?.numericTolerance !== undefined
      ? String(initialQuestion.numericTolerance)
      : '0'
  );
  const [acceptedAnswersText, setAcceptedAnswersText] = useState<string>(() => {
    if (
      initialQuestion?.acceptedAnswers &&
      initialQuestion.acceptedAnswers.length > 0
    ) {
      return initialQuestion.acceptedAnswers.map((a) => a.text).join(', ');
    }
    return initialQuestion?.correctAnswer || '';
  });
  const [gradingMode, setGradingMode] = useState<GradingMode>(
    initialQuestion?.gradingMode || 'auto'
  );
  const [rubricText, setRubricText] = useState(initialQuestion?.rubricText || '');
  const [saving, setSaving] = useState(false);

  const revisionsForQuestion = initialQuestion
    ? questionRevisions.filter((r) => r.questionId === initialQuestion.id)
    : [];

  const insertMathSymbol = (sym: string) => {
    setPrompt((prev) => `${prev}${sym}`);
  };

  const handleUploadImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'question' | 'explanation' | number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = String(reader.result || '');
        const uploaded = await uploadMediaFile({
          fileName: file.name,
          dataUrl,
          questionId: initialQuestion?.id,
        });
        if (target === 'question') {
          setImageUrl(uploaded.dataUrl || uploaded.url || '');
        } else if (target === 'explanation') {
          setExplanationImageUrl(uploaded.dataUrl || uploaded.url || '');
        } else if (typeof target === 'number') {
          setStructuredOptions((prev) =>
            prev.map((o, idx) =>
              idx === target
                ? { ...o, imageUrl: uploaded.dataUrl || uploaded.url || '', mediaId: uploaded.id }
                : o
            )
          );
        }
      } catch (err: any) {
        addToast('error', err?.message || 'Rasm yuklashda xatolik');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      addToast('error', 'Savol matnini kiriting');
      return;
    }

    let finalCorrectAnswer = correctAnswer.trim();
    let finalCorrectAnswers: string[] | undefined;
    let finalOptions: string[] | undefined;
    let finalStructuredOptions: QuestionOption[] | undefined;
    let finalAcceptedAnswers: AcceptedAnswer[] | undefined;

    if (qType === 'single_choice' || qType === 'multiple_choice') {
      const nonEmpty = structuredOptions.filter((o) => o.text.trim().length > 0);
      if (nonEmpty.length < 2) {
        addToast('error', 'Kamida 2 ta javob variantini kiriting');
        return;
      }
      const correctOnes = nonEmpty.filter((o) => o.isCorrect);
      if (qType === 'single_choice' && correctOnes.length !== 1) {
        addToast('error', "Bir tanlovli savolda aniq 1 ta to'g'ri javob belgilanishi shart");
        return;
      }
      if (qType === 'multiple_choice' && correctOnes.length < 2) {
        addToast(
          'error',
          "Ko'p tanlovli savolda kamida 2 ta to'g'ri javob belgilanishi shart"
        );
        return;
      }
      finalStructuredOptions = nonEmpty;
      finalOptions = nonEmpty.map((o) => o.text.trim());
      finalCorrectAnswers = correctOnes.map((o) => o.text.trim());
      finalCorrectAnswer = finalCorrectAnswers.join('|');
    } else if (qType === 'numeric') {
      if (finalCorrectAnswer === '' || Number.isNaN(Number(finalCorrectAnswer))) {
        addToast('error', "Sonli savol uchun to'g'ri son qiymatini kiriting");
        return;
      }
    } else if (qType === 'short_text') {
      const list = acceptedAnswersText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (gradingMode === 'auto' && list.length === 0) {
        addToast('error', 'Qabul qilinadigan qisqa javoblarni vergul bilan kiriting');
        return;
      }
      finalAcceptedAnswers = list.map((text) => ({
        text,
        caseSensitive: false,
        trimWhitespace: true,
      }));
      finalCorrectAnswer = list[0] || finalCorrectAnswer || '(Qo‘lda tekshiriladi)';
    } else if (qType === 'long_text') {
      finalCorrectAnswer = finalCorrectAnswer || '(Rubrika asosida baholanadi)';
    }

    setSaving(true);
    try {
      const payload: Omit<
        QuestionItem,
        'id' | 'institutionId' | 'authorId' | 'createdAt'
      > = {
        code: code.trim().toUpperCase(),
        title: title.trim() || undefined,
        instructions: instructions.trim() || undefined,
        subject,
        grade,
        topicId,
        difficulty,
        type: qType,
        points: Math.max(0.5, Number(points) || 1),
        prompt: prompt.trim(),
        options: finalOptions,
        structuredOptions: finalStructuredOptions,
        correctAnswer: finalCorrectAnswer,
        correctAnswers: finalCorrectAnswers,
        numericTolerance:
          qType === 'numeric' ? Math.max(0, Number(numericTolerance) || 0) : undefined,
        acceptedAnswers: finalAcceptedAnswers,
        gradingMode:
          qType === 'long_text' && gradingMode === 'auto'
            ? 'manual_rubric'
            : gradingMode,
        rubricText: rubricText.trim() || undefined,
        explanation:
          explanation.trim() || 'Yechim qadamlari asosida tekshirildi.',
        imageUrl: imageUrl || undefined,
        explanationImageUrl: explanationImageUrl || undefined,
        status: 'approved',
      };

      if (initialQuestion) {
        await updateQuestion(initialQuestion.id, payload);
        if (onSaved) onSaved({ ...initialQuestion, ...payload });
      } else {
        const created = await createQuestion(payload);
        if (onSaved) onSaved(created);
      }
      onClose();
    } catch (err: any) {
      addToast('error', err?.message || 'Savolni saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {initialQuestion
                ? `Savolni Tahrirlash (${initialQuestion.code || initialQuestion.id})`
                : 'Yangi Kengaytirilgan Savol Yaratish (5 xil tur + Rasm + Formula)'}
            </h3>
            <p className="text-xs text-slate-500">
              Single Choice, Multiple Choice, Numeric, Short Text, Long Text va rasm/formula qo‘llab-quvvatlanadi
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Yopish
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Savol Kodi
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Savol Turi (Question Type)
              </label>
              <select
                value={qType}
                onChange={(e) => {
                  const nextType = e.target.value as QuestionType;
                  setQType(nextType);
                  if (nextType === 'long_text') {
                    setGradingMode('manual_rubric');
                  } else if (nextType === 'single_choice') {
                    setStructuredOptions((prev) =>
                      prev.map((o, idx) => ({ ...o, isCorrect: idx === 0 }))
                    );
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium"
              >
                {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((k) => (
                  <option key={k} value={k}>
                    {QUESTION_TYPE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Ball (Points)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="20"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Fan
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Sinf darajasi
              </label>
              <input
                type="number"
                min={1}
                max={11}
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mavzu (Topic)
              </label>
              <select
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code || t.id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Qiyinlik darajasi
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              >
                <option value="easy">Oson (Easy)</option>
                <option value="medium">O‘rta (Medium)</option>
                <option value="hard">Qiyin (Hard)</option>
              </select>
            </div>
          </div>

          {/* Math / LaTeX Helper Toolbar + Prompt */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Savol Matni va Matematik Ifoda
              </label>
              <div className="flex items-center gap-1">
                {['x²', 'x³', '√(', 'π', '≤', '≥', '≠', '±', '÷', '×', '∠', '△'].map(
                  (sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => insertMathSymbol(sym)}
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-xs font-mono text-slate-700 dark:text-slate-300"
                    >
                      {sym}
                    </button>
                  )
                )}
              </div>
            </div>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Savol matnini yoki matematik formulani kiriting..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
          </div>

          {/* Question Image Attachment */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <ImageIcon className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Savol rasmi / chizmasi (PNG, JPG, WEBP — max 5 MB)
                </p>
                {imageUrl && (
                  <p className="text-[11px] text-emerald-600">Rasm biriktirilgan</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {imageUrl && (
                <>
                  <img
                    src={imageUrl}
                    alt="Question preview"
                    className="h-12 w-16 object-contain rounded border bg-white p-0.5"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    O‘chirish
                  </button>
                </>
              )}
              <label className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-semibold cursor-pointer">
                Rasm yuklash
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => handleUploadImage(e, 'question')}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Type-specific Answer Configuration */}
          {(qType === 'single_choice' || qType === 'multiple_choice') && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Javob Variantlari (
                  {qType === 'single_choice'
                    ? "1 ta to'g'ri javobni belgilang"
                    : "Bir nechta to'g'ri javoblarni belgilang"}
                  )
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setStructuredOptions((prev) => [
                      ...prev,
                      {
                        key: String.fromCharCode(65 + prev.length),
                        text: '',
                        isCorrect: false,
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600"
                >
                  <Plus className="w-3.5 h-3.5" /> Variant qo‘shish
                </button>
              </div>
              {structuredOptions.map((opt, idx) => (
                <div
                  key={opt.key}
                  className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <input
                    type={qType === 'single_choice' ? 'radio' : 'checkbox'}
                    name="correctOptionSelector"
                    checked={opt.isCorrect}
                    onChange={(e) => {
                      if (qType === 'single_choice') {
                        setStructuredOptions((prev) =>
                          prev.map((o, i) => ({ ...o, isCorrect: i === idx }))
                        );
                      } else {
                        setStructuredOptions((prev) =>
                          prev.map((o, i) =>
                            i === idx ? { ...o, isCorrect: e.target.checked } : o
                          )
                        );
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-xs font-bold w-5">{opt.key}.</span>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) =>
                      setStructuredOptions((prev) =>
                        prev.map((o, i) =>
                          i === idx ? { ...o, text: e.target.value } : o
                        )
                      )
                    }
                    placeholder={`${opt.key} varianti matni...`}
                    className="flex-1 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                  {opt.imageUrl && (
                    <img
                      src={opt.imageUrl}
                      alt={opt.key}
                      className="h-8 w-8 object-contain rounded border bg-white"
                    />
                  )}
                  <label className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[11px] cursor-pointer">
                    Rasm
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleUploadImage(e, idx)}
                      className="hidden"
                    />
                  </label>
                  {structuredOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setStructuredOptions((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="text-rose-500 hover:text-rose-700 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {qType === 'numeric' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Aniq Sonli Javob (Numeric Answer)
                </label>
                <input
                  type="number"
                  step="any"
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  placeholder="Masalan: 12.5"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ruxsat etilgan xatolik chegarasi (± Tolerance)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={numericTolerance}
                  onChange={(e) => setNumericTolerance(e.target.value)}
                  placeholder="Masalan: 0.01 yoki 0"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {qType === 'short_text' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Tekshirish Usuli (Grading Mode)
                  </label>
                  <select
                    value={gradingMode}
                    onChange={(e) => setGradingMode(e.target.value as GradingMode)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  >
                    <option value="auto">
                      Avtomatik (Qabul qilinadigan javoblar ro‘yxati bo‘yicha)
                    </option>
                    <option value="manual_rubric">O‘qituvchi tomonidan qo‘lda baholash</option>
                    <option value="ai_assisted_rubric">
                      AI tavsiyasi + O‘qituvchi tasdig‘i
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Qabul qilinadigan javoblar (vergul bilan ajrating)
                  </label>
                  <input
                    type="text"
                    value={acceptedAnswersText}
                    onChange={(e) => setAcceptedAnswersText(e.target.value)}
                    placeholder="Masalan: Pifagor, Pifagor teoremasi"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {qType === 'long_text' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Yozma Javobni Baholash Mezoni (Rubrika)
                </label>
                <textarea
                  rows={2}
                  value={rubricText}
                  onChange={(e) => setRubricText(e.target.value)}
                  placeholder="Masalan: 1 ball — tenglamani to'g'ri tuzish; 1 ball — yakuniy ildizni topish va tekshirish."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>
            </div>
          )}

          {/* Explanation */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Yechim Izohi (Explanation)
            </label>
            <textarea
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="O'quvchi testni topshirgandan keyin ko'rsatiladigan yechim qadamlari..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>

          {/* Question Revision History */}
          {revisionsForQuestion.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <History className="w-3.5 h-3.5 text-blue-600" />
                <span>Savol Versiyalari Tarixi ({revisionsForQuestion.length} ta reviziya)</span>
              </div>
              <div className="space-y-1 max-h-28 overflow-y-auto text-[11px] text-slate-500">
                {revisionsForQuestion.map((rev) => (
                  <div key={rev.id} className="flex items-center justify-between">
                    <span>
                      v{rev.version} • {rev.editedByName} ({rev.reason})
                    </span>
                    <span>{new Date(rev.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold"
            >
              {saving ? 'Saqlanmoqda...' : 'Savolni Saqlash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const WrittenGradingPanel: React.FC<{
  attempt?: AssessmentAttempt;
  attempts?: AssessmentAttempt[];
}> = ({ attempt: singleAttempt, attempts }) => {
  const attempt =
    singleAttempt ||
    attempts?.find(
      (a) =>
        a.status === 'pending_manual_review' ||
        a.answers.some(
          (ans) =>
            ans.questionType === 'long_text' ||
            ans.questionType === 'short_text' ||
            ans.pendingManualReview
        )
    ) ||
    attempts?.[0];
  const { suggestWrittenGrade, confirmWrittenGrade, addToast } = useLearnOS();
  const [pointsInput, setPointsInput] = useState<Record<string, number>>({});
  const [feedbackInput, setFeedbackInput] = useState<Record<string, string>>({});
  const [aiSuggestionMap, setAiSuggestionMap] = useState<Record<string, any>>({});
  const [loadingQId, setLoadingQId] = useState<string | null>(null);

  if (!attempt) return null;

  const writtenAnswers = attempt.answers.filter(
    (ans) =>
      ans.questionType === 'long_text' ||
      ans.questionType === 'short_text' ||
      ans.pendingManualReview
  );

  if (writtenAnswers.length === 0) return null;

  const handleRequestAISuggestion = async (ans: any) => {
    setLoadingQId(ans.questionId);
    try {
      const suggestion = await suggestWrittenGrade({
        prompt: ans.prompt,
        rubricText: ans.explanation,
        studentAnswer: ans.selectedAnswer,
        maxPoints: ans.maxPoints || 2,
      });
      setAiSuggestionMap((prev) => ({ ...prev, [ans.questionId]: suggestion }));
      setPointsInput((prev) => ({
        ...prev,
        [ans.questionId]: suggestion.suggestedPoints,
      }));
      setFeedbackInput((prev) => ({
        ...prev,
        [ans.questionId]: suggestion.feedback,
      }));
      addToast('info', 'AI rubrika tavsiyasi olindi. Tekshirib tasdiqlang.');
    } catch (err: any) {
      addToast('error', err?.message || 'AI tavsiyasini olishda xatolik');
    } finally {
      setLoadingQId(null);
    }
  };

  const handleConfirmGrade = async (ans: any) => {
    const maxPts = ans.maxPoints || 2;
    const pts =
      pointsInput[ans.questionId] !== undefined
        ? pointsInput[ans.questionId]
        : ans.awardedPoints || 0;
    const fb =
      feedbackInput[ans.questionId] !== undefined
        ? feedbackInput[ans.questionId]
        : ans.teacherFeedback || '';
    const aiSug = aiSuggestionMap[ans.questionId];

    setLoadingQId(ans.questionId);
    try {
      await confirmWrittenGrade(attempt.id, {
        questionId: ans.questionId,
        awardedPoints: Math.max(0, Math.min(maxPts, Number(pts))),
        feedback: fb,
        aiSuggestedPoints: aiSug?.suggestedPoints,
        aiSuggestedFeedback: aiSug?.feedback,
      });
    } catch (err: any) {
      addToast('error', err?.message || 'Bahoni saqlashda xatolik');
    } finally {
      setLoadingQId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Yozma va Qisqa Javoblarni Rubrika Asosida Baholash ({writtenAnswers.length} ta)
          </h4>
          <p className="text-xs text-slate-500">
            AI tavsiyasini olishingiz mumkin, biroq yakuniy ball faqat o‘qituvchi/admin tasdig‘idan so‘ng kuchga kiradi.
          </p>
        </div>
        {attempt.status === 'pending_manual_review' && (
          <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-semibold">
            Tekshiruv kutilmoqda ({attempt.pendingManualCount} ta)
          </span>
        )}
      </div>

      <div className="space-y-4">
        {writtenAnswers.map((ans) => {
          const maxPts = ans.maxPoints || 2;
          const currentPts =
            pointsInput[ans.questionId] !== undefined
              ? pointsInput[ans.questionId]
              : ans.awardedPoints ?? 0;
          const currentFb =
            feedbackInput[ans.questionId] !== undefined
              ? feedbackInput[ans.questionId]
              : ans.teacherFeedback || '';
          const aiSug = aiSuggestionMap[ans.questionId];

          return (
            <div
              key={ans.questionId}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  {ans.prompt}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  Maksimal: {maxPts} ball • Joriy: {ans.awardedPoints ?? 0}/{maxPts}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1">
                  O‘quvchi Yozma Javobi:
                </p>
                <div className="text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                  <ExamAnswerContent answer={ans.selectedAnswer || ''}/>
                </div>
              </div>

              {aiSug && (
                <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                      AI Rubrika Tavsiyasi (Yakuniy baho emas — O‘qituvchi tasdig‘i zarur)
                    </span>
                    <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                      Tavsiya: {aiSug.suggestedPoints} / {maxPts} ball
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{aiSug.feedback}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Beriladigan ball (0 – {maxPts})
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={maxPts}
                    value={currentPts}
                    onChange={(e) =>
                      setPointsInput((prev) => ({
                        ...prev,
                        [ans.questionId]: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    O‘qituvchi izohi (Feedback)
                  </label>
                  <input
                    type="text"
                    value={currentFb}
                    onChange={(e) =>
                      setFeedbackInput((prev) => ({
                        ...prev,
                        [ans.questionId]: e.target.value,
                      }))
                    }
                    placeholder="O'quvchi uchun asoslangan izoh..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={loadingQId === ans.questionId}
                    onClick={() => handleRequestAISuggestion(ans)}
                    className="px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Tavsiya
                  </button>
                  <button
                    type="button"
                    disabled={loadingQId === ans.questionId}
                    onClick={() => handleConfirmGrade(ans)}
                    className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Tasdiqlash
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
