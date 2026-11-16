import { useEffect, useRef, useState } from 'react';
import { startGoogleProof, takeGoogleProof } from '../authClient';
import { useExamApi } from '../utils/useExamApi';
import { createCredentialWorkbook, type CredentialWorkbookRow } from '../utils/credentialWorkbook';

export function SchoolCredentialRotation() {
  const api = useExamApi();
  const operationId = useRef(sessionStorage.getItem('ss_school_rotation_id') || crypto.randomUUID());
  const [proof, setProof] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [credentials, setCredentials] = useState<Array<CredentialWorkbookRow & { role: string }>>([]);
  const [exportKey, setExportKey] = useState('');
  useEffect(() => {
    const result = takeGoogleProof('rotation');
    if (result?.idToken) setProof(result.idToken);
    if (result?.error) setMessage(result.error);
  }, []);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try { await action(); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  };
  const rotate = async () => {
    const request = { operationId: operationId.current, idToken: proof, confirmed: true };
    await api('/api/account-credential-rotations', 'POST', request);
    const packet = await api('/api/account-credential-rotations/claim', 'POST', request);
    setCredentials(packet.credentials);
    setProof('');
    sessionStorage.removeItem('ss_school_rotation_id');
    setMessage('426 o‘quvchi va 24 ustozning boshlang‘ich kirishlari almashtirildi. Yangi Excel fayllarini yuklang.');
  };
  const download = async (role: string) => {
    const rows = credentials.filter(row => row.role === role);
    const blob = await createCredentialWorkbook(rows, exportKey);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = role === 'student' ? 'Oquvchilar-yangi-kirishlar.xlsx' : 'Ustozlar-yangi-kirishlar.xlsx';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="my-5 space-y-4 rounded-2xl border border-blue-200 bg-white p-5 dark:bg-slate-900">
    <h2 className="text-lg font-bold">Maktab hisoblarining yangi kirishlari</h2>
    <p className="text-sm leading-6">426 o‘quvchi va 24 ustoz. O‘quvchining login-paroli bir xil — sps va 7 tasodifiy raqam. Ustozning boshlang‘ich paroli ismi va 6 tasodifiy raqamdan tuziladi. Birinchi kirishda parol almashtiriladi.</p>
    {message && <p role="status" className="rounded-xl border p-3 text-sm">{message}</p>}
    {credentials.length ? <>
      <label className="block text-sm">Excel fayllarini ochish uchun alohida parol
        <input className="mt-2 min-h-12 w-full rounded-xl border bg-transparent px-3" type="password" minLength={16} maxLength={256} autoComplete="new-password" value={exportKey} onChange={event => setExportKey(event.target.value)} />
      </label>
      <p className="text-sm">Kamida 16 belgi. Ushbu oynani yopishdan oldin ikkala faylni yuklab oling.</p>
      <div className="flex flex-wrap gap-3">{[['student', '426 o‘quvchi XLSX'], ['teacher', '24 ustoz XLSX']].map(([role, label]) => <button key={role} disabled={busy || exportKey.length < 16} className="ss-primary disabled:opacity-50" onClick={() => void run(() => download(role))}>{label}</button>)}</div>
    </> : <>
      {!proof ? <button disabled={busy} className="ss-primary" onClick={() => void run(async () => {
        sessionStorage.setItem('ss_school_rotation_id', operationId.current);
        await startGoogleProof({ kind: 'rotation' });
      })}>Google bilan almashtirishni tayyorlash</button> : <>
        <label className="flex min-h-12 items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />450 hisobning eski boshlang‘ich parollari va faol sessiyalarini bekor qilib, tanlangan formatga almashtirishni tasdiqlayman.</label>
        <button disabled={busy || !confirmed} className="ss-primary disabled:opacity-50" onClick={() => void run(rotate)}>{busy ? 'Kirishlar almashtirilmoqda…' : '450 hisob kirishlarini almashtirish'}</button>
      </>}
      <p className="text-xs leading-5 text-slate-500">MFA va yangi Google tasdig‘i talab qilinadi. Almashtirish bir necha daqiqa davom etishi mumkin.</p>
    </>}
  </section>;
}
