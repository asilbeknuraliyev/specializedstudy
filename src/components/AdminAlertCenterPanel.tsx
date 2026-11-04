import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Search,
  Check,
  X,
  RefreshCw,
  Eye,
  FileText,
  User,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react';
import { useLearnOS } from '../context/LearnOSContext';
import { StudentAlert, StudentAlertSeverity, StudentAlertStatus } from '../types';
import { OFFICIAL_19_CLASS_CODES } from '../constants/curriculum';

export const AdminAlertCenterPanel: React.FC<{
  onInspectStudent?: (studentId: string) => void;
}> = ({ onInspectStudent }) => {
  const {
    studentAlerts,
    generateRiskAlerts,
    acknowledgeAlert,
    resolveAlert,
    addToast,
  } = useLearnOS();

  const [analyzing, setAnalyzing] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Resolve Modal State
  const [resolvingAlert, setResolvingAlert] = useState<StudentAlert | null>(null);
  const [actionTakenInput, setActionTakenInput] = useState('');
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [submittingResolve, setSubmittingResolve] = useState(false);

  const filteredAlerts = useMemo(() => {
    return studentAlerts.filter((a) => {
      const matchSeverity = severityFilter === 'ALL' || a.severity === severityFilter;
      const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
      const matchClass =
        classFilter === 'ALL' || a.classCode.toLowerCase() === classFilter.toLowerCase();
      const matchSearch =
        !searchQuery.trim() ||
        a.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.evidence.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSeverity && matchStatus && matchClass && matchSearch;
    });
  }, [studentAlerts, severityFilter, statusFilter, classFilter, searchQuery]);

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    try {
      const generated = await generateRiskAlerts();
      addToast('success', `${generated.length} ta ta’limiy ogohlantirish qayta tahlil qilindi`);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Tahlil qilishda xatolik');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeAlert(id);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Tasdiqlashda xatolik');
    }
  };

  const handleOpenResolveModal = (alert: StudentAlert) => {
    setResolvingAlert(alert);
    setActionTakenInput('');
    setAdminNoteInput('');
  };

  const handleConfirmResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingAlert || !actionTakenInput.trim()) {
      addToast('error', 'Iltimos, ko‘rilgan chorani kiriting.');
      return;
    }

    setSubmittingResolve(true);
    try {
      await resolveAlert(resolvingAlert.id, {
        actionTaken: actionTakenInput.trim(),
        adminNote: adminNoteInput.trim() || undefined,
      });
      setResolvingAlert(null);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Hal etishda xatolik');
    } finally {
      setSubmittingResolve(false);
    }
  };

  const openCount = studentAlerts.filter((a) => a.status === 'open').length;
  const acknowledgedCount = studentAlerts.filter((a) => a.status === 'acknowledged').length;
  const highSeverityCount = studentAlerts.filter(
    (a) => a.severity === 'high' && a.status !== 'resolved'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Smart ogohlantirish markazi (Alert Center)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Xolis ta’limiy dalillarga asoslangan monitoring: davomat, vazifalar va akademik natijalar nazorati.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunAnalysis}
          disabled={analyzing}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
          <span>{analyzing ? 'Tahlil qilinmoqda...' : 'Barcha sinflarni qayta tahlil qilish'}</span>
        </button>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-500">Ochiq ogohlantirishlar</span>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
            {openCount}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
          <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
            Yuqori darajadagi (High)
          </span>
          <p className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-300 mt-1">
            {highSeverityCount}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            Ko‘rib chiqilmoqda
          </span>
          <p className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">
            {acknowledgedCount}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            Hal etilganlar (Resolved)
          </span>
          <p className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
            {studentAlerts.filter((a) => a.status === 'resolved').length}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="O‘quvchi ismi yoki dalil bo‘yicha qidirish..."
            className="w-full text-xs bg-transparent border-none focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
          >
            <option value="open">Ochiq holatdagilar</option>
            <option value="acknowledged">Ko‘rib chiqilganlar</option>
            <option value="resolved">Hal etilganlar</option>
            <option value="ALL">Barcha holatlar</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
          >
            <option value="ALL">Barcha darajalar</option>
            <option value="high">Yuqori (High)</option>
            <option value="medium">O‘rta (Medium)</option>
            <option value="low">Past (Low)</option>
          </select>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
          >
            <option value="ALL">Barcha sinflar</option>
            {OFFICIAL_19_CLASS_CODES.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()} sinf
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Faol ogohlantirishlar topilmadi
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Barcha o‘quvchilar belgilangan ta’limiy me’yorlarda harakat qilmoqda.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isHigh = alert.severity === 'high';
            const isMedium = alert.severity === 'medium';
            return (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all ${
                  alert.status === 'resolved'
                    ? 'bg-slate-50/60 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800 opacity-60'
                    : isHigh
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/80'
                    : isMedium
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/80'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isHigh
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : isMedium
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {alert.severity}
                    </span>

                    <span className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase">
                      {alert.classCode}
                    </span>

                    <button
                      type="button"
                      onClick={() => onInspectStudent?.(alert.studentId)}
                      className="font-bold text-sm text-slate-900 dark:text-white hover:text-blue-600 underline-offset-2 hover:underline cursor-pointer"
                    >
                      {alert.studentName}
                    </button>

                    <span className="text-slate-400 text-xs">·</span>
                    <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                      {alert.title}
                    </span>
                  </div>

                  {/* Strictly objective, evidence-based description */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-mono">
                    {alert.evidence}
                  </p>

                  {alert.actionTaken && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                      <strong>Ko‘rilgan chora:</strong> {alert.actionTaken}
                    </p>
                  )}

                  {alert.adminNote && (
                    <p className="text-[11px] text-slate-500 italic">
                      <strong>Admin izohi:</strong> {alert.adminNote}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {alert.status === 'open' && (
                    <button
                      type="button"
                      onClick={() => handleAcknowledge(alert.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                    >
                      Ko‘rib chiqildi
                    </button>
                  )}

                  {alert.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() => handleOpenResolveModal(alert)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Hal etildi deb belgilash
                    </button>
                  )}

                  {alert.status === 'resolved' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <Check className="w-3.5 h-3.5" /> Hal etilgan
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Resolve Alert with Recorded Action Taken */}
      {resolvingAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Ogohlantirishni hal etish
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  {resolvingAlert.studentName} ({resolvingAlert.classCode.toUpperCase()})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setResolvingAlert(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmResolve} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Ko‘rilgan pedagogik chora:
                </label>
                <textarea
                  rows={2}
                  value={actionTakenInput}
                  onChange={(e) => setActionTakenInput(e.target.value)}
                  placeholder="Masalan: O‘quvchi bilan yakka tartibda suhbatlashildi va amaliy topshiriq tayinlandi."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Maxfiy administrator izohi (ixtiyoriy):
                </label>
                <textarea
                  rows={2}
                  value={adminNoteInput}
                  onChange={(e) => setAdminNoteInput(e.target.value)}
                  placeholder="Qo‘shimcha kuzatuvlar..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResolvingAlert(null)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={submittingResolve}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                >
                  {submittingResolve ? 'Saqlanmoqda...' : 'Tasdiqlash va yopish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
