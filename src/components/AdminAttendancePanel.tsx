import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Upload,
  Download,
  Printer,
  Filter,
  Search,
  AlertTriangle,
  RefreshCw,
  Save,
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';
import { useLearnOS } from '../context/LearnOSContext';
import {
  OfficialClassCode,
  AttendanceStatus,
  AttendanceRecord,
  AttendanceImportRowPreview,
} from '../types';
import { OFFICIAL_19_CLASS_CODES } from '../constants/curriculum';
import {
  calculateAttendanceStats,
  buildMonthlyAttendanceGrid,
  validateAttendanceImportRows,
} from '../utils/studentMonitoringEngine';
import * as XLSX from 'xlsx';

export const AdminAttendancePanel: React.FC = () => {
  const {
    users,
    classes,
    attendanceRecords,
    attendanceSessions,
    markAttendance,
    importAttendanceRecords,
    addToast,
  } = useLearnOS();

  // Selection states
  const [selectedClassCode, setSelectedClassCode] = useState<OfficialClassCode>('7a1');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [viewMode, setViewMode] = useState<'register' | 'calendar' | 'import'>('register');

  // Register in-progress marks: Record<studentId, AttendanceStatus>
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Calendar month state
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth() + 1);

  // Filters for historical view
  const [filterStudentQuery, setFilterStudentQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Excel import wizard state
  const [importRows, setImportRows] = useState<AttendanceImportRowPreview[]>([]);
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip_existing' | 'update_existing'>('update_existing');
  const [importing, setImporting] = useState(false);

  // Enrolled students for selected class
  const classStudents = useMemo(() => {
    return users
      .filter(
        (u) =>
          u.role === 'student' &&
          u.status !== 'archived' &&
          u.classCode?.toLowerCase() === selectedClassCode.toLowerCase()
      )
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [users, selectedClassCode]);

  // Existing records for selected class & date
  const existingRecords = useMemo(() => {
    return attendanceRecords.filter(
      (r) =>
        r.classCode.toLowerCase() === selectedClassCode.toLowerCase() &&
        r.date === selectedDate
    );
  }, [attendanceRecords, selectedClassCode, selectedDate]);

  // Sync state when date or class changes
  React.useEffect(() => {
    const initialMap: Record<string, AttendanceStatus> = {};
    const initialReasons: Record<string, string> = {};

    classStudents.forEach((stu) => {
      const rec = existingRecords.find((r) => r.studentId === stu.uid);
      initialMap[stu.uid] = rec ? rec.status : 'PRESENT'; // default to PRESENT
      if (rec?.notes || rec?.reasonCategory) {
        initialReasons[stu.uid] = rec.notes || rec.reasonCategory || '';
      }
    });

    setStatusMap(initialMap);
    setReasonMap(initialReasons);
    setHasUnsavedChanges(false);
  }, [classStudents, existingRecords, selectedClassCode, selectedDate]);

  // Handle single student status change
  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setStatusMap((prev) => ({ ...prev, [studentId]: status }));
    setHasUnsavedChanges(true);
  };

  // Bulk mark all
  const handleBulkMark = (status: AttendanceStatus) => {
    const nextMap: Record<string, AttendanceStatus> = {};
    classStudents.forEach((stu) => {
      nextMap[stu.uid] = status;
    });
    setStatusMap(nextMap);
    setHasUnsavedChanges(true);
    addToast('info', `Barcha o‘quvchilar «${status === 'PRESENT' ? 'Keldi' : 'Kelmagan'}» deb belgilandi`);
  };

  // Save attendance
  const handleSaveAttendance = async () => {
    setSaving(true);
    try {
      const recordsToSave = classStudents.map((stu) => ({
        studentId: stu.uid,
        studentName: stu.displayName,
        status: statusMap[stu.uid] || 'PRESENT',
        notes: reasonMap[stu.uid] || undefined,
      }));

      await markAttendance({
        classCode: selectedClassCode,
        date: selectedDate,
        records: recordsToSave,
      });
      setHasUnsavedChanges(false);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Davomatni saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  // Class historical attendance stats (denominator is strictly recorded sessions only!)
  const classHistoricalRecords = useMemo(() => {
    return attendanceRecords.filter(
      (r) => r.classCode.toLowerCase() === selectedClassCode.toLowerCase()
    );
  }, [attendanceRecords, selectedClassCode]);

  const classStats = useMemo(() => {
    return calculateAttendanceStats(classHistoricalRecords);
  }, [classHistoricalRecords]);

  // Calendar matrix
  const calendarGrid = useMemo(() => {
    return buildMonthlyAttendanceGrid(
      selectedClassCode,
      calendarYear,
      calendarMonth,
      attendanceRecords,
      attendanceSessions
    );
  }, [selectedClassCode, calendarYear, calendarMonth, attendanceRecords, attendanceSessions]);

  // Excel Export
  const handleExportExcel = () => {
    const exportData = classHistoricalRecords.map((r) => ({
      Sana: r.date,
      Sinf: r.classCode.toUpperCase(),
      "O'quvchi": r.studentName,
      Holati:
        r.status === 'PRESENT'
          ? 'Keldi'
          : r.status === 'LATE'
          ? 'Kechikdi'
          : r.status === 'EXCUSED_ABSENCE'
          ? 'Sababli'
          : 'Kelmagan',
      Izoh: r.notes || '',
      Qayd_etuvchi: r.recordedByName || 'Administrator',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Davomat_${selectedClassCode}`);
    XLSX.writeFile(workbook, `SpecializedStudy_Davomat_${selectedClassCode}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    addToast('success', 'Excel davomat hisoboti yuklandi');
  };

  // Print view
  const handlePrint = () => {
    window.print();
  };

  // Parse Excel import file
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const json = XLSX.utils.sheet_to_json<any>(ws);

        const previewRes = validateAttendanceImportRows(json, attendanceRecords, users);
        setImportRows(previewRes.rows);
        setViewMode('import');
      } catch {
        addToast('error', 'Excel faylini o‘qishda xatolik yuz berdi');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Confirm import
  const handleConfirmImport = async () => {
    if (importRows.length === 0) return;
    setImporting(true);
    try {
      await importAttendanceRecords({
        classCode: selectedClassCode,
        date: selectedDate,
        rows: importRows,
        duplicatePolicy,
        confirm: true,
      });
      setViewMode('register');
      setImportRows([]);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Importda xatolik');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Davomat jurnali va nazorati
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            19 ta rasmiy sinf bo‘yicha davomatni belgilash, statistik tahlil va oylik kalendar.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setViewMode('register')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'register'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Jurnal (Register)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Oylik kalendar
            </button>
          </div>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 text-xs font-semibold cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>Excel import</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileImport} className="hidden" />
          </label>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Eksport (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Chop etish</span>
          </button>
        </div>
      </div>

      {/* Class & Date Selector Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Sinfni tanlang:
            </label>
            <select
              value={selectedClassCode}
              onChange={(e) => setSelectedClassCode(e.target.value as OfficialClassCode)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold"
            >
              {OFFICIAL_19_CLASS_CODES.map((code) => (
                <option key={code} value={code}>
                  {code.toUpperCase()} sinf ({code.endsWith('t') ? 'Tabiiy' : 'Aniq'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Sana:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
            />
          </div>
        </div>

        {viewMode === 'register' && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleBulkMark('PRESENT')}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 cursor-pointer"
            >
              Hammasi keldi
            </button>
            <button
              type="button"
              onClick={() => handleBulkMark('ABSENT')}
              className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 cursor-pointer"
            >
              Hammasi kelmagan
            </button>

            <button
              type="button"
              onClick={handleSaveAttendance}
              disabled={saving}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-md animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saqlanmoqda...' : 'Davomatni saqlash'}</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Stats Bar (Denominator is strictly recorded sessions only!) */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 font-semibold">Qayd etilgan darslar</span>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
            {classStats.totalRecordedDays}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
          <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">Keldi</span>
          <p className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
            {classStats.presentDays}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
          <span className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">Kechikdi</span>
          <p className="text-xl font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">
            {classStats.lateArrivals ?? classStats.lateDays ?? 0}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
          <span className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold">Sababli</span>
          <p className="text-xl font-bold font-mono text-blue-700 dark:text-blue-300 mt-1">
            {classStats.excusedAbsences ?? classStats.excusedDays ?? 0}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
          <span className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold">Kelmagan</span>
          <p className="text-xl font-bold font-mono text-rose-700 dark:text-rose-300 mt-1">
            {classStats.absentDays}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
          <span className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold">Davomat foizi</span>
          <p className="text-xl font-bold font-mono text-blue-700 dark:text-blue-300 mt-1">
            {classStats.attendancePercentage ?? classStats.attendancePercent ?? 100}%
          </p>
        </div>
      </div>

      {/* VIEW 1: REGISTER */}
      {viewMode === 'register' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              {selectedClassCode.toUpperCase()} sinfi o‘quvchilari ro‘yxati ({classStudents.length} nafar)
            </h3>
            <span className="text-xs font-mono text-slate-500">
              Sana: <strong>{selectedDate}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">F.I.O. (O‘quvchi)</th>
                  <th className="py-3 px-4">Kod</th>
                  <th className="py-3 px-4 text-center">Davomat holati</th>
                  <th className="py-3 px-4">Sabab / Izoh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {classStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      Ushbu sinfda hozircha o‘quvchilar ro‘yxatga olinmagan.
                    </td>
                  </tr>
                ) : (
                  classStudents.map((stu, idx) => {
                    const currentStatus = statusMap[stu.uid] || 'PRESENT';
                    return (
                      <tr key={stu.uid} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                          {stu.displayName}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">{stu.studentCode || 'STD'}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {[
                              { key: 'PRESENT', label: 'Keldi', color: 'emerald' },
                              { key: 'LATE', label: 'Kechikdi', color: 'amber' },
                              { key: 'EXCUSED_ABSENCE', label: 'Sababli', color: 'blue' },
                              { key: 'ABSENT', label: 'Kelmagan', color: 'rose' },
                            ].map((btn) => {
                              const isSelected = currentStatus === btn.key;
                              return (
                                <button
                                  key={btn.key}
                                  type="button"
                                  onClick={() => handleStatusChange(stu.uid, btn.key as AttendanceStatus)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    isSelected
                                      ? btn.color === 'emerald'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : btn.color === 'amber'
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : btn.color === 'blue'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'bg-rose-600 text-white shadow-xs'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                                  }`}
                                >
                                  {btn.label}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={reasonMap[stu.uid] || ''}
                            onChange={(e) => {
                              setReasonMap((prev) => ({ ...prev, [stu.uid]: e.target.value }));
                              setHasUnsavedChanges(true);
                            }}
                            placeholder="Qo‘shimcha izoh..."
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: MONTHLY CALENDAR */}
      {viewMode === 'calendar' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              {selectedClassCode.toUpperCase()} sinfi — {calendarYear}-yil, {calendarMonth}-oy davomat taqvimi
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (calendarMonth === 1) {
                    setCalendarMonth(12);
                    setCalendarYear((y) => y - 1);
                  } else {
                    setCalendarMonth((m) => m - 1);
                  }
                }}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-xs font-bold px-2">
                {calendarYear} / {calendarMonth}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (calendarMonth === 12) {
                    setCalendarMonth(1);
                    setCalendarYear((y) => y + 1);
                  } else {
                    setCalendarMonth((m) => m + 1);
                  }
                }}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs">
            {['Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan', 'Yak'].map((d) => (
              <span key={d} className="font-bold text-slate-400 py-1">
                {d}
              </span>
            ))}
            {calendarGrid.days.map((day) => (
              <div
                key={day.date}
                className={`p-2.5 rounded-xl border text-left min-h-[75px] flex flex-col justify-between ${
                  day.isCurrentMonth
                    ? day.isRecorded
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    : 'bg-slate-50/40 dark:bg-slate-950/40 border-transparent text-slate-400 opacity-40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-xs">{day.dayNumber}</span>
                  {day.isRecorded && (
                    <span className="text-[10px] font-mono font-bold text-emerald-600">
                      {day.attendancePercent}%
                    </span>
                  )}
                </div>

                {day.isRecorded ? (
                  <div className="text-[10px] text-slate-500 font-mono space-y-0.5">
                    <span className="block text-emerald-600">Keldi: {day.presentCount}</span>
                    <span className="block text-rose-600">K/magan: {day.absentCount}</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Qayd etilmagan</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: EXCEL IMPORT WIZARD */}
      {viewMode === 'import' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Excel davomat faylini tasdiqlash ({importRows.length} qator)
              </h3>
              <p className="text-xs text-slate-500">
                Fayl qatorlari tekshirildi. Takroriy yozuvlar bo‘yicha amalni tanlang.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={duplicatePolicy}
                onChange={(e) => setDuplicatePolicy(e.target.value as any)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              >
                <option value="update_existing">Mavjudlarini yangilash (Update)</option>
                <option value="skip_existing">Mavjudlarini qoldirish (Skip)</option>
              </select>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                {importing ? 'Import qilinmoqda...' : 'Tasdiqlash va saqlash'}
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2 px-3">Qator</th>
                  <th className="py-2 px-3">O‘quvchi</th>
                  <th className="py-2 px-3">Sana</th>
                  <th className="py-2 px-3">Sinf</th>
                  <th className="py-2 px-3">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {importRows.slice(0, 30).map((r) => (
                  <tr key={r.rowNumber}>
                    <td className="py-2 px-3 font-mono">{r.rowNumber}</td>
                    <td className="py-2 px-3 font-medium">{r.rawStudentName}</td>
                    <td className="py-2 px-3 font-mono">{r.rawDate}</td>
                    <td className="py-2 px-3 font-mono uppercase">{r.rawClassCode}</td>
                    <td className="py-2 px-3 font-semibold text-emerald-600">{r.rawStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
