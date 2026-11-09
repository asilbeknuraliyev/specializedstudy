import {useExportAction} from '../utils/useExportAction';
import React, { useState } from 'react';
import { useLearnOS } from '../context/LearnOSContext';
import {
  FileSpreadsheet,
  Download,
  Printer,
  TrendingUp,
  Users,
  Award,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { AcademicReportType } from '../types';


import {OFFICIAL_19_CLASS_CODES} from '../constants/curriculum';
const CLASS_CODES = ['All', ...OFFICIAL_19_CLASS_CODES];

const SUBJECTS = ['All', 'Matematika', 'Ingliz tili', 'Fizika', 'Biologiya', 'Kimyo'];

const REPORT_TYPES: { value: AcademicReportType; label: string }[] = [
  { value: 'class_report', label: 'Sinf hisoboti (Class Report)' },
  { value: 'individual_student', label: "O'quvchi hisoboti (Student Report)" },
  { value: 'subject_results', label: 'Fan natijalari (Subject Report)' },
  { value: 'class_attendance', label: 'Davomat hisoboti (Attendance Report)' },
  { value: 'assignment_report', label: 'Topshiriqlar hisoboti (Assignment Report)' },
  { value: 'assessment_completion', label: 'Baholashlar hisoboti (Assessment Report)' },
  { value: 'curriculum_progress', label: "O'quv reja va O'tilgan darslar (Curriculum Progress)" },
  { value: 'quarter', label: 'Choraklik yakuniy hisobot (Quarter Summary)' },
];

export const AdminReportsPanel: React.FC = () => {
  const {
    academicReports,
    generateAcademicReport,
    users,
    masteryRecords,
    attempts,
    assignmentSubmissions,
    lessonDeliveryRecords,
    lessons,
  } = useLearnOS();

  const [reportType, setReportType] = useState<AcademicReportType>('class_report');
  const [classCode, setClassCode] = useState('All');
  const [subject, setSubject] = useState('All');
  const [quarter, setQuarter] = useState<string>('All');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [isBusy, setIsBusy] = useState(false);

  const students = users.filter((u) => u.role === 'student' && u.status !== 'archived');

  const handleGenerate = async () => {
    setIsBusy(true);
    try {
      const labelObj = REPORT_TYPES.find((t) => t.value === reportType);
      const title = `${labelObj?.label || 'Akademik Hisobot'} — ${
        classCode === 'All' ? 'Barcha sinflar' : classCode.toUpperCase()
      }${subject !== 'All' ? ` (${subject})` : ''}`;

      await generateAcademicReport({
        reportType,
        title,
        targetId: classCode === 'All' ? 'all' : classCode,
        classCode: classCode === 'All' ? undefined : classCode,
        subject: subject === 'All' ? undefined : subject,
        quarter: quarter === 'All' ? undefined : Number(quarter),
        period,
      });
    } finally {
      setIsBusy(false);
    }
  };

  const extractMetrics = (report: (typeof academicReports)[0]) => {
    const sd = (report.summaryData || {}) as Record<string, any>;
    return {
      averageMastery: Number(report.metrics?.averageMastery ?? sd.averageMastery ?? sd.overallAverageScore ?? 0),
      attendanceRate: Number(report.metrics?.attendanceRate ?? sd.attendanceRate ?? sd.attendancePercentage ?? 0),
      assessmentsCompleted: Number(report.metrics?.assessmentsCompleted ?? sd.assessmentsCompleted ?? sd.totalAttempts ?? 0),
      assignmentsCompleted: Number(report.metrics?.assignmentsCompleted ?? sd.assignmentsCompleted ?? 0),
      plannedLessonsCount: Number(report.metrics?.plannedLessonsCount ?? sd.plannedLessonsCount ?? lessons.length),
      deliveredLessonsCount: Number(report.metrics?.deliveredLessonsCount ?? sd.deliveredLessonsCount ?? 0),
      atRiskStudents: Number(report.metrics?.atRiskStudents ?? sd.atRiskStudents ?? sd.openAlertsCount ?? 0),
      topPerformers: Number(report.metrics?.topPerformers ?? sd.topPerformers ?? 0),
    };
  };

  const handleExportCSV = (reportId: string) => {
    window.open(`/api/reports/${reportId}/export?format=csv`, '_blank');
  };

  const handleExportXLSXAction=useExportAction();
  const handleExportXLSX = async (report: (typeof academicReports)[0]) => handleExportXLSXAction.run(async()=>{
    const XLSX=await import('xlsx');
    const m = extractMetrics(report);
    const rows = [
      { Ko_rsatkich: 'Hisobot sarlavhasi', Qiymat: report.title },
      { Ko_rsatkich: 'Hisobot turi', Qiymat: report.reportType || report.type || 'class_report' },
      { Ko_rsatkich: 'Davr', Qiymat: report.period },
      { Ko_rsatkich: 'Sinf', Qiymat: report.classCode ? report.classCode.toUpperCase() : 'Barcha sinflar' },
      { Ko_rsatkich: 'Fan', Qiymat: report.subject || 'Barcha fanlar' },
      { Ko_rsatkich: "O'rtacha o'zlashtirish (%)", Qiymat: m.averageMastery },
      { Ko_rsatkich: 'Davomat (%)', Qiymat: m.attendanceRate },
      { Ko_rsatkich: 'Topshirilgan testlar', Qiymat: m.assessmentsCompleted },
      { Ko_rsatkich: 'Topshirilgan vazifalar', Qiymat: m.assignmentsCompleted },
      { Ko_rsatkich: 'Rejalashtirilgan darslar', Qiymat: m.plannedLessonsCount },
      { Ko_rsatkich: "O'tilgan darslar", Qiymat: m.deliveredLessonsCount },
      { Ko_rsatkich: "Xavf guruhidagi o'quvchilar", Qiymat: m.atRiskStudents },
      { Ko_rsatkich: "Yuqori natijali o'quvchilar", Qiymat: m.topPerformers },
      { Ko_rsatkich: 'Metodologiya', Qiymat: report.methodology || 'Haqiqiy Firestore yozuvlari asosida' },
    ];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hisobot');
    XLSX.writeFile(workbook, `hisobot-${report.id}.xlsx`);
  });

  const handlePrint = () => {
    window.print();
  };

  const filteredStudents =
    classCode === 'All'
      ? students
      : students.filter((s) => (s.classCode || '').toLowerCase() === classCode.toLowerCase());

  const avgMastery = masteryRecords.length
    ? Math.round(
        masteryRecords.reduce((acc, m) => acc + (m.accuracy || 0), 0) / masteryRecords.length
      )
    : 0;

  const filteredDeliveries = lessonDeliveryRecords.filter((r) => {
    const matchClass =
      classCode === 'All' || r.classCode.toLowerCase() === classCode.toLowerCase();
    const matchSubj = subject === 'All' || r.subject === subject;
    return matchClass && matchSubj;
  });
  const deliveredCount = filteredDeliveries.filter((r) => r.deliveryStatus === "O'tildi").length;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">
              Maktab Ko'rsatkichlari va Analitik Hisobotlar
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Haqiqiy Firestore ma'lumotlari asosida sinf, o'quvchi, fan, davomat, topshiriq va o'quv reja hisobotlari (CSV, XLSX, PDF/Chop etish)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as AcademicReportType)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
          >
            {REPORT_TYPES.map((rt) => (
              <option key={rt.value} value={rt.value}>
                {rt.label}
              </option>
            ))}
          </select>

          <select
            value={classCode}
            onChange={(e) => setClassCode(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
          >
            {CLASS_CODES.map((c) => (
              <option key={c} value={c}>
                {c === 'All' ? 'Barcha sinflar' : `${c.toUpperCase()} sinf`}
              </option>
            ))}
          </select>

          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? 'Barcha fanlar' : s}
              </option>
            ))}
          </select>

          <select
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
          >
            <option value="All">Barcha choraklar</option>
            <option value="1">1-chorak</option>
            <option value="2">2-chorak</option>
            <option value="3">3-chorak</option>
            <option value="4">4-chorak</option>
          </select>

          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
          />

          <button
            onClick={handleGenerate}
            disabled={isBusy}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
          >
            Hisobot shakllantirish
          </button>

          <button
            onClick={handlePrint}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="PDF / Chop etish"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Live Snapshot KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Qamrab olingan o'quvchilar</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white">{filteredStudents.length} nafar</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>O'rtacha o'zlashtirish</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{avgMastery}%</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Topshirilgan testlar</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">{attempts.length} ta</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Topshirilgan vazifalar</span>
            <FileText className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {assignmentSubmissions.filter((s) => s.status !== 'Jarayonda').length} ta
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>O'tilgan darslar</span>
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {deliveredCount} / {lessons.length}
          </div>
        </div>
      </div>

      {/* Saved Reports List */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white">
          Shakllantirilgan Rasmiy Hisobotlar ({academicReports.length})
        </h3>

        {academicReports.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Hozircha saqlangan hisobotlar yo'q. Yuqoridagi tugma orqali yangi hisobot shakllantiring.
          </div>
        ) : (
          <div className="space-y-3">
            {academicReports.map((report) => {
              const m = extractMetrics(report);
              const genDate = report.generatedAt || report.createdAt;
              return (
                <div
                  key={report.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                        {report.reportType || report.type || 'class_report'}
                      </span>
                      <h4 className="text-sm font-bold text-white">{report.title}</h4>
                    </div>
                    <p className="text-xs text-slate-400">
                      Davr: {report.period} • Sinf:{' '}
                      {report.classCode ? report.classCode.toUpperCase() : 'Barchasi'} • Fan:{' '}
                      {report.subject || 'Barchasi'} • Shakllantirildi:{' '}
                      {genDate ? new Date(genDate).toLocaleString('uz-UZ') : ''}
                    </p>
                    {report.methodology && (
                      <p className="text-[11px] text-slate-500 italic">
                        Metodologiya: {report.methodology}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="grid grid-cols-4 gap-3 text-center text-xs">
                      <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                        <div className="text-slate-400">O'zlashtirish</div>
                        <div className="font-bold text-emerald-400">{m.averageMastery}%</div>
                      </div>
                      <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                        <div className="text-slate-400">Davomat</div>
                        <div className="font-bold text-indigo-400">{m.attendanceRate}%</div>
                      </div>
                      <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                        <div className="text-slate-400">Dars (Reja/Amal)</div>
                        <div className="font-bold text-purple-400">
                          {m.deliveredLessonsCount}/{m.plannedLessonsCount}
                        </div>
                      </div>
                      <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                        <div className="text-slate-400">Xavf guruhi</div>
                        <div className="font-bold text-rose-400">{m.atRiskStudents} ta</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExportCSV(report.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        CSV
                      </button>
                      <button
                        onClick={() => handleExportXLSX(report)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-medium text-emerald-300 transition-colors"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                        XLSX
                      </button>
                      <button
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-xs font-medium text-indigo-300 transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5 text-indigo-400" />
                        PDF
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
