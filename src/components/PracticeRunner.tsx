import React,{useEffect,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useExamApi} from '../utils/useExamApi';
import {ExamViewport,ExamHeader,QuestionNavigator} from './ExamWorkspace';
import {QuestionInput,RichQuestionText} from './QuestionInput';
import {Card,Button,Modal} from './DesignSystem';

export function PracticeRunner({id,demo=false}:{id:string;demo?:boolean}){
 const api=useExamApi(),navigate=useNavigate();
 const [session,setSession]=useState<any>(),[info,setInfo]=useState<any>(),[answers,setAnswers]=useState<Record<string,string>>({}),[flags,setFlags]=useState<string[]>([]),[confidence,setConfidence]=useState<Record<string,string>>({});
 const [index,setIndex]=useState(0),[saving,setSaving]=useState('Saqlandi'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[seconds,setSeconds]=useState<number>(),[offset,setOffset]=useState(0),[conflict,setConflict]=useState<any>(),[choices,setChoices]=useState<Record<string,string>>({});
 const revision=useRef(0),answersRef=useRef(answers),flagsRef=useRef(flags),confidenceRef=useRef(confidence),sessionRef=useRef(session),baseAnswers=useRef<Record<string,string>>({}),timeSpent=useRef<Record<string,number>>({}),enteredAt=useRef(Date.now()),activeQuestion=useRef(''),queue=useRef(Promise.resolve()),dirty=useRef(false),lock=useRef(false),conflicted=useRef(false),retry=useRef<{signature:string;operationId:string}|undefined>(undefined);
 answersRef.current=answers;flagsRef.current=flags;confidenceRef.current=confidence;sessionRef.current=session;
 const get=()=>demo?`/api/demo/session/${id}`:`/api/topic-sessions/${id}`;
 const install=(s:any,replace=false)=>{
  setSession(s);sessionRef.current=s;if(!s)return;revision.current=s.revision;baseAnswers.current={...s.answers};
  if(replace){setAnswers(s.answers||{});answersRef.current=s.answers||{};setFlags(s.flags||[]);flagsRef.current=s.flags||[];setConfidence(s.confidence||{});confidenceRef.current=s.confidence||{};timeSpent.current=s.timeSpentMs||{};enteredAt.current=Date.now();}
 };
 useEffect(()=>{let active=true;api(get()).then(d=>{if(!active)return;install(d.session,true);setInfo(d.exam||{title:d.title});if(d.serverNow)setOffset(d.serverNow-Date.now());}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[api,id,demo]);
 const captureTime=()=>{if(activeQuestion.current){const elapsed=document.hidden?0:Date.now()-enteredAt.current;timeSpent.current[activeQuestion.current]=(timeSpent.current[activeQuestion.current]||0)+Math.max(0,elapsed);}enteredAt.current=Date.now();};
 useEffect(()=>{captureTime();activeQuestion.current=session?.questions?.[index]?.id||'';},[index,session?.id]);
 const save=(submit=false,event?:any)=>{
  if(!sessionRef.current||sessionRef.current.submittedAt||conflicted.current)return queue.current;
  captureTime();const captured={...answersRef.current},marked=[...flagsRef.current],certainty={...confidenceRef.current},timings={...timeSpent.current};dirty.current=false;
  const signature=JSON.stringify({answers:captured,flags:marked,confidence:certainty,submit,event});
  if(retry.current?.signature!==signature)retry.current={signature,operationId:crypto.randomUUID()};const operationId=retry.current.operationId;
  queue.current=queue.current.catch(()=>{}).then(async()=>{
   if(conflicted.current)throw Error('Avval parallel javoblarni solishtiring.');
   setSaving('Saqlanmoqda…');
   try{
    const d=await api(demo?`/api/demo/responses/${id}`:get(),'PUT',{revision:revision.current,answers:captured,flags:marked,confidence:certainty,timeSpentMs:timings,operationId,submit,event});
    const s=demo?{...sessionRef.current,...d.response,pending:d.response.writtenScore===undefined}:d.session;
    install(s);setSaving('Saqlandi');setError('');
   }catch(e){
    dirty.current=true;setSaving('Saqlanmadi');setError((e as Error).message);
    if(!demo&&(e as any).status===409){
     conflicted.current=true;
     try{const remote=await api(get());setConflict({remote:remote.session,base:{...baseAnswers.current}});setChoices({});}catch{}
    }
    throw e;
   }
  });return queue.current;
 };
 useEffect(()=>{if(!dirty.current||session?.submittedAt||busy||conflict)return;const t=setTimeout(()=>void save().catch(()=>{}),700);return()=>clearTimeout(t);},[answers,flags,confidence,busy,conflict]);
 useEffect(()=>{
  if(!session?.startedAt||session.submittedAt)return;
  const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
  const visibility=()=>{if(document.hidden)void save(false,{id:crypto.randomUUID(),type:'tab_exit'}).catch(()=>{});else enteredAt.current=Date.now();};
  window.addEventListener('beforeunload',unload);document.addEventListener('visibilitychange',visibility);
  return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('visibilitychange',visibility);};
 },[session?.startedAt,session?.submittedAt]);
 useEffect(()=>{
  if(!session?.deadlineAt||session.submittedAt)return;
  const tick=()=>{const n=Math.max(0,Math.ceil((Date.parse(session.deadlineAt)-Date.now()-offset)/1000));setSeconds(n);if(!n&&!lock.current&&!conflicted.current){lock.current=true;void save(true).catch(()=>{}).finally(()=>{lock.current=false;});}};
  tick();const t=setInterval(tick,1000);return()=>clearInterval(t);
 },[session?.deadlineAt,session?.submittedAt,offset]);
 const start=async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{await document.documentElement.requestFullscreen().catch(()=>{});const d=await api(`/api/demo/start/${id}`,'POST',{});install(d.session,true);setOffset(d.serverNow-Date.now());}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}};
 const exit=async()=>{if(lock.current)return;lock.current=true;try{if(conflicted.current){setError('Avval parallel javoblarni solishtiring.');return;}if(!session?.submittedAt&&dirty.current)await save();else await queue.current;if(document.fullscreenElement)await document.exitFullscreen();navigate(demo?'/student/demo':'/student/topic-tests');}catch(e){setError((e as Error).message);}finally{lock.current=false;}};
 const hint=async(q:any)=>{
  if(lock.current||conflicted.current)return;lock.current=true;setBusy(true);
  try{if(dirty.current)await save();else await queue.current;const d=await api(get()+'/hint','POST',{questionId:q.id,expectedLevel:sessionRef.current.hintsUsed?.[q.id]||0,operationId:crypto.randomUUID()});install(d.session);setError('');}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
 };
 if(session===undefined)return error?<Card role="alert"><h1 className="text-xl font-bold">Mashq ochilmadi</h1><p className="mt-3">{error}</p><Button className="mt-4" onClick={()=>window.location.reload()}>Qayta urinish</Button></Card>:<div role="status" className="ss-surface h-40 animate-pulse p-6">Mashq yuklanmoqda…</div>;
 if(!session||demo&&!session.startedAt)return <Card><h1 className="text-2xl font-bold">{info?.title||'Mavzu mashqi'}</h1><p className="mt-4 text-sm">Javoblar hisobingizga saqlanadi. Tabdan chiqish mashqni to‘xtatmaydi.</p>{error&&<p role="alert">{error}</p>}<Button className="mt-5" busy={busy} onClick={()=>void start()}>Mashqni boshlash</Button></Card>;
 if(session.submittedAt)return <ExamViewport><Card><h1 className="text-2xl font-bold">Natija va tushuntirish</h1><p className="mt-3 text-sm text-slate-500">Bu shaxsiy o‘rganish ko‘rsatkichi. Rasmiy elektron jurnal bahosi emas.</p><p className="mt-4 text-lg font-semibold">{session.score===undefined?'Natija ustoz tekshiruvidan keyin ko‘rinadi.':`Ball: ${session.score}/${session.maxScore}`}</p>{session.pending&&<p className="mt-3">Yozma javob: Tekshiruvda</p>}
  {session.results?.some((r:any)=>r.confidentWrong)&&<p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Ishonchli, lekin noto‘g‘ri javoblar: {session.results.filter((r:any)=>r.confidentWrong).length} ta. Shu tushunchalarni izoh yordamida qayta ko‘rib chiqing.</p>}
  {session.results?.map((r:any,n:number)=><Card key={r.id} className="mt-4 space-y-3"><h2 className="font-semibold">{n+1}-savol · {r.pending?'Tekshiruvda':`${r.earned}/${r.points}`}</h2>{r.prompt&&<RichQuestionText text={r.prompt}/>}<p className="whitespace-pre-wrap text-sm"><strong>Sizning javobingiz:</strong> {r.yourAnswer||answers[r.id]||'Javob berilmagan.'}</p>{r.correctAnswer&&<p className="whitespace-pre-wrap text-sm text-emerald-700"><strong>To‘g‘ri javob:</strong> <RichQuestionText text={r.correctAnswer}/></p>}<div className="rounded-xl bg-blue-50 p-4 text-sm text-slate-800 dark:bg-blue-950 dark:text-slate-100"><RichQuestionText text={r.explanation||'Ustoz izohi kutilmoqda.'}/></div>{r.wrongFeedback?.map((text:string,i:number)=><p key={i} className="text-sm text-amber-800"><RichQuestionText text={text}/></p>)}{r.teacherComment&&<p className="whitespace-pre-wrap text-sm"><strong>Ustoz izohi:</strong> {r.teacherComment}</p>}{r.hintsUsed>0&&<p className="text-xs text-slate-500">{r.hintsUsed} maslahat ishlatilgan. Ball kamaytirilmagan.</p>}{r.source?.title&&<p className="text-xs text-slate-500">Manba: {r.source.title}{r.source.page?` · ${r.source.page}-sahifa`:''}</p>}{r.sourceHref&&<Link className="ss-secondary inline-flex" to={r.sourceHref} onClick={()=>void document.exitFullscreen().catch(()=>{})}>Shu mavzuni qayta o‘qi</Link>}</Card>)}
  <Button className="mt-5" onClick={()=>void exit()}>Chiqish</Button></Card></ExamViewport>;
 const questions=session.questions||[],q=questions[index],answered=questions.filter((x:any)=>Boolean(answers[x.id]?.replaceAll('|','').trim())).length;
 const overlaps=conflict?questions.filter((q:any)=>answers[q.id]!==conflict.base[q.id]&&conflict.remote.answers[q.id]!==conflict.base[q.id]&&answers[q.id]!==conflict.remote.answers[q.id]):[];
 return <ExamViewport><ExamHeader title={session.title||info?.title||'Mavzu testi'} subject={session.subject||'Mavzu mashqi'} seconds={seconds} saving={saving} busy={busy} onExit={()=>void exit()} onSubmit={()=>setConfirm(true)}/>
  {error&&<div role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-800">{error}{!conflict&&<button className="ss-secondary ml-3" onClick={()=>void save().catch(()=>{})}>Qayta saqlash</button>}</div>}
  <QuestionNavigator questions={questions} index={index} answers={answers} flags={flags} onChange={setIndex}/>
  <Card><p className="mb-4 text-sm text-slate-500">{index+1}-savol · {q?.points} ball</p>
   {session.confidenceEnabled&&<fieldset disabled={busy||!!answers[q.id]} className="mb-5 rounded-xl border border-blue-100 p-4"><legend className="px-1 text-sm font-semibold">Javobdan oldin: qanchalik ishonchingiz komil?</legend><div className="mt-2 flex flex-wrap gap-3">{[['low','Past'],['medium','O‘rta'],['high','Yuqori']].map(([v,t])=><label key={v} className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm"><input type="radio" name="confidence" value={v} checked={confidence[q.id]===v} onChange={()=>{dirty.current=true;setConfidence(c=>({...c,[q.id]:v}));}}/>{t}</label>)}</div></fieldset>}
   {q&&<QuestionInput question={q} value={answers[q.id]||''} disabled={busy||!!conflict||session.confidenceEnabled&&!confidence[q.id]} onChange={v=>{dirty.current=true;setAnswers(a=>({...a,[q.id]:v}));}}/>}
   {!demo&&q?.hintCount>0&&<section className="mt-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><p className="text-xs text-slate-500">Maslahat ballni kamaytirmaydi. Undan foydalanish alohida qayd etiladi.</p>{session.revealedHints?.[q.id]?.map((h:string,n:number)=><p key={n} className="mt-3 text-sm"><strong>{n+1}-maslahat:</strong> <RichQuestionText text={h}/></p>)}<Button className="mt-3" busy={busy} disabled={(session.hintsUsed?.[q.id]||0)>=q.hintCount} onClick={()=>void hint(q)}>Keyingi maslahatni ochish</Button></section>}
   <div className="mt-6 flex flex-wrap justify-between gap-3"><button className="ss-secondary" disabled={!index} onClick={()=>setIndex(i=>i-1)}>Oldingi</button><button className="ss-secondary" aria-pressed={flags.includes(q.id)} onClick={()=>{dirty.current=true;setFlags(a=>a.includes(q.id)?a.filter(x=>x!==q.id):[...a,q.id]);}}>★ Keyinroq qaytaman</button><button className="ss-primary" disabled={index===questions.length-1} onClick={()=>setIndex(i=>i+1)}>Keyingi</button></div>
  </Card>
  {confirm&&<Modal title="Topshirish xulosasi" onClose={()=>{if(!busy)setConfirm(false);}}><p>{answered} ta javob berilgan · {questions.length-answered} ta qolgan · {flags.length} ta belgilangan.</p><Button className="mt-5" busy={busy} disabled={!!conflict} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{await save(true);setConfirm(false);}catch{}finally{setBusy(false);lock.current=false;}}}>Tasdiqlash va topshirish</Button></Modal>}
  {conflict&&<Modal title="Parallel javoblarni solishtirish" onClose={()=>{}}><p className="text-sm">Javoblaringiz shu oynada saqlanib turibdi. Boshqa oynadagi holat bilan solishtiring. Bir xil savolda ikki xil javob bo‘lsa, tanlovni o‘zingiz qilasiz.</p>{overlaps.map((item:any)=><fieldset key={item.id} className="mt-4 rounded-xl border p-4"><legend className="text-sm">{item.prompt}</legend>{[['local','Shu oynadagi javob',answers[item.id]],['remote','Serverdagi javob',conflict.remote.answers[item.id]]].map(([v,t,a])=><label key={v} className="mt-2 flex min-h-11 items-start gap-3 break-words text-sm"><input type="radio" name={item.id} checked={choices[item.id]===v} onChange={()=>setChoices(c=>({...c,[item.id]:v}))}/><span>{t}: {a||'Bo‘sh'}</span></label>)}</fieldset>)}<Button className="mt-4" disabled={overlaps.some((q:any)=>!choices[q.id])} onClick={()=>{
   const merged={...conflict.remote.answers};for(const item of questions)if(answers[item.id]!==conflict.base[item.id]&&choices[item.id]!=='remote')merged[item.id]=answers[item.id]||'';
   revision.current=conflict.remote.revision;baseAnswers.current={...conflict.remote.answers};answersRef.current=merged;setAnswers(merged);const allFlags=[...new Set([...flags,...conflict.remote.flags])];flagsRef.current=allFlags;setFlags(allFlags);confidenceRef.current={...conflict.remote.confidence,...confidence};setConfidence(confidenceRef.current);conflicted.current=false;setConflict(undefined);retry.current=undefined;dirty.current=true;setError('');void save().catch(()=>{});
  }}>Tanlangan javoblarni birlashtirib saqlash</Button><Button className="mt-3" onClick={()=>{install(conflict.remote,true);conflicted.current=false;setConflict(undefined);dirty.current=false;setError('');setSaving('Saqlandi');}}>Faqat serverdagi holatni olish</Button></Modal>}
 </ExamViewport>;
}
