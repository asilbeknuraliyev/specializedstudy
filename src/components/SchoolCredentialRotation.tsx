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
    try {
      await api('/api/account-credential-rotations', 'POST', request);
    } catch (error) {
      if ((error as Error).message.includes('Yangi Google tasdig‘i kerak')) {
        setProof('');
      } else if ((error as Error).message.includes('Yangi amal bilan') || (error as Error).message.includes('Bu eski paket')) {
        operationId.current = crypto.randomUUID();
        sessionStorage.setItem('ss_school_rotation_id', operationId.current);
        setConfirmed(false);
      }
      throw error;
    }
    let packet;
    try {
      packet = await api('/api/account-credential-rotations/claim', 'POST', request);
    } catch (error) {
      setProof('');
      throw error;
    }
    setCredentials(packet.credentials);
    setProof('');
    setConfirmed(false);
    sessionStorage.removeItem('ss_school_rotation_id');
    operationId.current = crypto.randomUUID();
    setMessage(packet.credentials.length
      ? packet.credentials.length + ' ta amaldagi kirish yozuvi tayyor. Shifrlangan Excel faylini yuklang.'
      : 'Ushbu paketda amaldagi boshlang‘ich parol qolmagan.');
  };
  const download = async () => {
    const rows = credentials;
    const blob = await createCredentialWorkbook(rows, exportKey);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Specialized_Study_Initial_Credentials.xlsx';
    link.click();
    setCredentials([]);
    setExportKey('');
    setMessage('Shifrlangan fayl yuklashga berildi. Fayl parolini alohida kanal orqali yetkazing.');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="my-5 space-y-4 rounded-2xl border border-blue-200 bg-white p-5 dark:bg-slate-900">
    <h2 className="text-lg font-bold">Maktab hisoblarining yangi kirishlari</h2>
    <p className="text-sm leading-6">Tasdiqlangan importdagi eski boshlang‘ich kirishlarni yangilang. O‘quvchi logini sps va 7 tasodifiy raqamdan iborat. Boshlang‘ich parollar alohida yaratiladi va birinchi kirishda almashtiriladi.</p>
    {message && <p role="status" className="rounded-xl border p-3 text-sm">{message}</p>}
    {credentials.length ? <>
      <label className="block text-sm">Excel faylini ochish uchun alohida parol
        <input className="mt-2 min-h-12 w-full rounded-xl border bg-transparent px-3" type="password" minLength={16} maxLength={256} autoComplete="new-password" value={exportKey} onChange={event => setExportKey(event.target.value)} />
      </label>
      <p className="text-sm">Kamida 16 belgi. Ushbu oynani yopishdan oldin faylni yuklab oling.</p>
      <button disabled={busy || exportKey.length < 16} className="ss-primary" onClick={() => void run(download)}>Shifrlangan Excel faylini yuklash</button>
      <p className="text-sm">Fayl parolini alohida xavfsiz kanal orqali yetkazing.</p>
    </> : <>
      {!proof ? <button disabled={busy} className="ss-primary" onClick={() => void run(async () => {
        sessionStorage.setItem('ss_school_rotation_id', operationId.current);
        await startGoogleProof({ kind: 'rotation' });
      })}>Google bilan almashtirishni tayyorlash</button> : <>
        <label className="flex min-h-12 items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Tasdiqlangan hisoblarning eski boshlang‘ich parollari va faol sessiyalarini bekor qilishga roziman.</label>
        <button disabled={busy || !confirmed} className="ss-primary disabled:opacity-50" onClick={() => void run(rotate)}>{busy ? 'Kirishlar almashtirilmoqda…' : 'Boshlang‘ich kirishlarni almashtirish'}</button>
      </>}
      <p className="text-xs leading-5 text-slate-500">MFA va yangi Google tasdig‘i talab qilinadi. Almashtirish bir necha daqiqa davom etishi mumkin.</p>
    </>}
  </section>;
}
