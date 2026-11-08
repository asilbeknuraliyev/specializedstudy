import React, {useEffect, useState} from 'react';
import {useExamApi} from '../utils/useExamApi';
import {useLearnOS} from '../context/LearnOSContext';

export function LessonPractice({lessonId}: {lessonId: string}) {
  const api = useExamApi();
  const {currentUser} = useLearnOS();
  const key = `ss-practice-${currentUser?.uid}-${lessonId}`;
  const [data, setData] = useState<any>(null);
  const [answers, setAnswers] = useState(['', '']);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  useEffect(() => {
    if (!data || saved) return;
    try {
      localStorage.setItem(key, JSON.stringify(answers));
      setDraftStatus('Qoralama shu brauzerda saqlandi. Yakuniy javobni serverga yuboring.');
    } catch {
      setDraftStatus('Brauzer qoralamani saqlay olmadi. Javoblarni serverga yuboring.');
    }
  }, [answers, data, saved, key]);
  const load = async () => {
    setBusy(true); setError('');
    try {
      const result = await api(`/api/lesson-practice/${lessonId}`);
      let draft: unknown;
      try { draft = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* optional browser copy */ }
      if (result.savedAnswers) { setAnswers(result.savedAnswers); setSaved(true); }
      else if (Array.isArray(draft) && draft.length === 2 && draft.every(v => typeof v === 'string' && v.length <= 10000)) { setAnswers(draft); }
      setData(result);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    setBusy(true); setError('');
    try {
      await api(`/api/lesson-practice/${lessonId}`, 'POST', {answers});
      setSaved(true);
      try { localStorage.removeItem(key); } catch { /* server copy is durable */ }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4 rounded-2xl border border-blue-100 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
    <h3 className="font-bold">Mavzuni mustahkamlash</h3>
    {!data ? <button disabled={busy} className="ss-primary" onClick={() => void load()}>{busy ? 'Tayyorlanmoqda…' : 'Takrorlash mashqini ochish'}</button> : <>
      <p className="text-xs leading-6 text-slate-500">{data.notice}</p>
      {data.questions.map((q: string, i: number) => <label key={i} className="block text-sm font-medium">{i + 1}. {q}
        <textarea disabled={saved || busy} maxLength={10000} className="ss-field mt-2 min-h-28" value={answers[i]} onChange={e => setAnswers(a => a.map((v, n) => n === i ? e.target.value : v))}/>
      </label>)}
      <p role="status" className="text-xs text-slate-500">{saved ? 'Javoblar serverga saqlandi. Bu mashq avtomatik baholanmaydi.' : draftStatus}</p>
      <button disabled={saved || busy || answers.some(a => a.trim().length < 3)} className="ss-primary" onClick={() => void submit()}>{saved ? 'Javoblar saqlandi' : busy ? 'Saqlanmoqda…' : 'Javoblarni saqlash'}</button>
    </>}
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
  </section>;
}
