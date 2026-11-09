import React, {useEffect, useRef, useState} from 'react';
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
  const revision=useRef(0),lastSaved=useRef(''),queue=useRef(Promise.resolve());
  const saveDraft=(values:string[])=>{
    setDraftStatus('Qoralama serverga saqlanmoqda…');
    queue.current=queue.current.catch(()=>{}).then(async()=>{
      const result=await api(`/api/lesson-practice/${lessonId}`,'PUT',{answers:values,revision:revision.current});
      revision.current=result.revision;lastSaved.current=JSON.stringify(values);
      setDraftStatus('Qoralama hisobingizga saqlandi. Boshqa qurilmada ham ochiladi.');setError('');
    }).catch(e=>{setDraftStatus('Qoralama saqlanmadi.');setError(e.message);throw e;});
    return queue.current;
  };
  useEffect(()=>{
    if(!data||saved||busy||JSON.stringify(answers)===lastSaved.current)return;
    const timer=setTimeout(()=>void saveDraft(answers).catch(()=>{}),1200);
    return()=>clearTimeout(timer);
  },[answers,data,saved,busy]);
  const load = async () => {
    setBusy(true); setError('');
    try {
      const result = await api(`/api/lesson-practice/${lessonId}`);
      let draft: unknown;
      try { draft = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* optional browser copy */ }
      revision.current=result.revision||0;
      let initial=result.savedAnswers||result.draftAnswers||['',''];
      if(result.savedAnswers)setSaved(true);
      else if(!result.draftAnswers&&Array.isArray(draft)&&draft.length===2&&draft.every(v=>typeof v==='string'&&v.length<=10000)){
        // Back up the old browser draft before the explicitly requested migration.
        localStorage.setItem(key+'-migration-backup',JSON.stringify(draft));
        await saveDraft(draft);initial=draft;localStorage.removeItem(key);
      }
      lastSaved.current=JSON.stringify(initial);setAnswers(initial);
      setDraftStatus(result.draftAnswers?'Qoralama serverdan tiklandi.':'');
      setData(result);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    setBusy(true); setError('');
    try {
      await queue.current;
      await api(`/api/lesson-practice/${lessonId}`, 'POST', {answers,revision:revision.current});
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
    {error && <div role="alert" className="text-sm text-rose-600">{error}<button className="ss-secondary ml-3" disabled={busy||saved} onClick={()=>void saveDraft(answers).catch(()=>{})}>Qayta saqlash</button></div>}
  </section>;
}
