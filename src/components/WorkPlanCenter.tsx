import {ResponsiveTable} from './ResponsiveTable';
import React, { useState } from 'react';
import { Archive, ArrowRight, BookOpen, CheckCircle2, ChevronDown, FileSpreadsheet, Search, Upload } from 'lucide-react';
import { useLearnOS } from '../context/LearnOSContext';
import { OFFICIAL_19_CLASS_CODES } from '../constants/curriculum';
import type { CurriculumZipImportPreview } from '../types';

type Source = { useOfficialAttachedArchive?: boolean; base64Data?: string; fileName?: string };
export function WorkPlanCenter({ advanced: Advanced }: { advanced: React.ComponentType }) {
  const { institution, workPlans, previewCurriculumZipArchive, confirmCurriculumZipArchive } = useLearnOS();
  const [preview, setPreview] = useState<CurriculumZipImportPreview | null>(null);
  const [source, setSource] = useState<Source>({ useOfficialAttachedArchive: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [year, setYear] = useState(institution.academicYear);
  const [publish, setPublish] = useState(true);
  const [includeT, setIncludeT] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [search, setSearch] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [inspected, setInspected] = useState<string | null>(null);
  const inspect = async (next: Source) => {
    setBusy(true); setError(''); setMessage(''); setPreview(null);
    try { const data = await previewCurriculumZipArchive(next); setSource(next); setPreview(data); }
    catch (e) { setError(e instanceof Error ? e.message : 'Arxivni o‘qib bo‘lmadi.'); }
    finally { setBusy(false); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip') || file.size > 25 * 1024 * 1024 || !file.size) { setError('25 MB gacha bo‘lgan ZIP faylni tanlang.'); return; }
    const reader = new FileReader();
    reader.onerror = () => setError('Faylni o‘qib bo‘lmadi. Qayta tanlang.');
    reader.onload = () => void inspect({ fileName: file.name, base64Data: String(reader.result) });
    reader.readAsDataURL(file);
  };
  const confirm = async () => {
    if (!preview || busy) return;
    setBusy(true); setError('');
    try {
      const result = await confirmCurriculumZipArchive({ ...source, academicYear: year, publishImmediately: publish, tTrackVisibilityApproved: includeT, duplicatePolicy: 'skip_existing' });
      setMessage(`${result.importedLessonsCount} ta yangi dars saqlandi. ${publish ? 'Nashr qilingan darslar tegishli sinf o‘quvchilariga ochildi.' : 'Darslar qoralama sifatida saqlandi.'}`);
      setPreview(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Saqlash amalga oshmadi.'); }
    finally { setBusy(false); }
  };
  const plans = workPlans.filter(p => (!classCode || p.classCode === classCode || p.classCodes?.includes(classCode as any)) && `${p.title} ${p.curriculumArea || ''} ${p.fileName || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">O‘quv dasturi</p><h1 className="mt-2 text-2xl font-bold">Ish rejalari</h1><p className="mt-2 text-sm text-slate-500">Faylni tanlang, darslarni tekshiring va sinflarga oching.</p></div><button type="button" onClick={() => setAdvanced(!advanced)} className="ss-secondary">Alohida fayl va boshqa amallar <ChevronDown size={16}/></button></div>
    {advanced && <Advanced/>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="flex gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18}/>{message}</p>}
    <section className="ss-surface grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) void upload(e.dataTransfer.files[0]); }}>
      <div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Upload size={22}/></span><div><h2 className="font-semibold">Yangi ish reja yuklash</h2><p className="mt-1 text-sm text-slate-500">ZIP arxivni shu yerga tashlang yoki fayl tanlang.</p><p className="mt-2 text-xs text-slate-400">Excel fayllaridan sinf, mavzu, chorak va manba avtomatik ajratiladi.</p></div></div>
      <div className="flex flex-wrap gap-2"><label className={`ss-primary ${busy ? 'pointer-events-none opacity-50' : ''}`}><Upload size={16}/>Fayl tanlash<input type="file" accept=".zip" className="sr-only" disabled={busy} onChange={e => {void upload(e.target.files?.[0]);e.target.value='';}}/></label><button className="ss-secondary" disabled={busy} onClick={() => void inspect({ useOfficialAttachedArchive: true })}><Archive size={16}/>{busy ? 'O‘qilmoqda…' : 'Matematika arxivi'}</button></div>
    </section>
    {preview && <section className="ss-surface space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap justify-between gap-4"><div><p className="text-xs font-semibold text-blue-600">Nashrdan oldin tekshirish</p><h2 className="mt-2 font-semibold break-all">{preview.archiveName}</h2></div><span className="text-sm text-slate-500">{preview.totalWorkbooks} fayl · {preview.totalLessonRecords} dars · {preview.totalHours} soat</span></div>
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">O‘quv yili<input aria-label="O‘quv yili" value={year} onChange={e => setYear(e.target.value)} pattern="[0-9]{4}-[0-9]{4}" className="ss-field mt-2"/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)}/>Tasdiqlash bilan nashr qilish</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeT} onChange={e => setIncludeT(e.target.checked)}/>T sinflariga qo‘shimcha matematika</label></div>
      <div className="max-h-96 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700"><ResponsiveTable className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 dark:bg-slate-800"><tr><th className="p-3">Fayl / sinflar</th><th className="p-3">Darslar</th><th className="p-3">Ko‘rish</th></tr></thead><tbody>{preview.workbooks.map(w => <React.Fragment key={w.workbookKey}><tr className="border-t border-slate-100 dark:border-slate-800"><td className="p-3"><p>{w.fileName}</p><p className="mt-1 text-xs text-blue-600">{w.classCodes.join(', ').toUpperCase()}</p></td><td className="p-3">{w.totalLessons}</td><td className="p-3"><button className="text-blue-600" onClick={() => setInspected(inspected === w.workbookKey ? null : w.workbookKey)}>Darslar</button></td></tr>{inspected === w.workbookKey && <tr><td colSpan={3} className="p-3"><ol className="max-h-64 space-y-2 overflow-y-auto">{w.rows.map((r,i) => <li key={i} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><strong>{r.lessonNumber}. {r.topicName || r.lessonTitle}</strong><p className="mt-1 text-xs text-slate-500">{r.quarter}-chorak · {r.hours} soat · manba qatori: {r.sourceRow || '—'}</p></li>)}</ol></td></tr>}</React.Fragment>)}</tbody></ResponsiveTable></div>
      <p className="text-xs text-slate-500">Mavjud darslar saqlanadi. T sinflari uchun qo‘shimcha reja alohida tasdiqlanadi.</p><div className="flex flex-wrap gap-3"><button className="ss-primary" disabled={busy || !/^\d{4}-\d{4}$/.test(year)} onClick={() => void confirm()}>{busy ? 'Saqlanmoqda…' : publish ? 'Tasdiqlash va nashr qilish' : 'Qoralama saqlash'}<ArrowRight size={16}/></button><button className="ss-secondary" disabled={busy} onClick={() => setPreview(null)}>Bekor qilish</button></div>
    </section>}
    <section className="space-y-4"><div className="flex flex-wrap items-center gap-3"><h2 className="mr-auto font-semibold">Saqlangan rejalar <span className="text-slate-400">{plans.length}</span></h2><select aria-label="Sinf bo‘yicha filtrlash" className="ss-field w-auto" value={classCode} onChange={e => setClassCode(e.target.value)}><option value="">Barcha sinflar</option>{OFFICIAL_19_CLASS_CODES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select><input aria-label="Ish reja qidirish" placeholder="Reja qidirish…" className="ss-field w-auto" value={search} onChange={e => setSearch(e.target.value)}/></div>
      {!plans.length ? <div className="ss-surface p-12 text-center text-sm text-slate-500"><BookOpen className="mx-auto mb-3"/>Bu tanlovda ish reja yo‘q.</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{plans.map(p => <a href={`/admin/lessons?class=${p.classCode || p.classCodes?.[0] || ''}`} key={p.id} className="ss-surface p-5 hover:border-blue-400"><FileSpreadsheet size={22} className="text-blue-600"/><h3 className="mt-4 font-semibold">{p.title}</h3><p className="mt-2 text-xs text-slate-500">{p.academicYear} · {p.totalLessons || p.rows?.length || 0} dars</p><p className="mt-4 text-xs font-semibold text-blue-600">{(p.classCodes || [p.classCode]).filter(Boolean).join(' · ').toUpperCase()}</p></a>)}</div>}
    </section>
  </div>;
}
