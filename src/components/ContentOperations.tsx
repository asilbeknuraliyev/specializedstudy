import {useEffect,useState} from 'react';
import {useExamApi} from '../utils/useExamApi';
import {schoolExcel} from '../utils/schoolExport';

type Source = {subject:string|null;grade:string|null;rows:number;candidates:number;unresolved:number};
type Job = {status:string;jobs:number; delivered:number; questions:number; approved:number; published:number; cost_cents:number};
type Missing = {id:string;title:string;subject?:string;grade?:number;file:string;sheet:string;row:number;issues:string[]};
type ContentResponse = {year?:string;sources:Source[];jobs:Job[];missing:{total:number;rows:Missing[]};
 entries?:Array<{id:string;status:string;attempts:number;error_code?:string;subject?:string;topic:string}>;canManage?:boolean};
const jobLabels:Record<string,string>={pending:'Navbatda',validating:'Tekshirilmoqda',review:'Ustoz tekshiruviga tayyor',
 paused:'Pauzada',failed:'Xato',needs_source:'Qo‘shimcha manba kerak'};

export default function ContentOperations(){
 const api=useExamApi();
 const [data,setData]=useState<ContentResponse>();
 const [error,setError]=useState('');
 const [subject,setSubject]=useState('');
 const [page,setPage]=useState(0);
 const [revision,reload]=useState(0);
 const [busy,setBusy]=useState('');
 useEffect(()=>{
   let active=true;
   setError('');
   api('/api/content-operations?'+new URLSearchParams({subject,page:String(page)}))
    .then(result=>{if(active)setData(result);})
    .catch((issue:Error)=>{if(active)setError(issue.message);});
   return()=>{active=false;};
 },[api,page,subject,revision]);
 async function manage(id:string,action:string){
   setBusy(id);setError('');
   try{await api('/api/content-operations/jobs/'+encodeURIComponent(id),'POST',{action});reload(value=>value+1);}
   catch(issue){setError((issue as Error).message);}
   finally{setBusy('');}
 }
 const bounds=data?.jobs.reduce((totals,job)=>({sets:totals.sets+job.delivered,questions:totals.questions+job.questions,
   approved:totals.approved+job.approved,published:totals.published+job.published}),{sets:0,questions:0,approved:0,published:0});
 const template='rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900';
 return <main className="mx-auto max-w-7xl space-y-5 pb-12">
  <header className="rounded-3xl border border-blue-100 bg-blue-50 p-6 dark:border-slate-700 dark:bg-slate-900">
   <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{data?.year||'2026–2027'}</p>
   <h1 className="mt-2 text-3xl font-semibold tracking-tight">O‘quv rejasi va savollar nazorati</h1>
   <p className="mt-2 text-sm">Manbalarni solishtiring, moslanmagan satrlarni ko‘ring va savollar navbatini kuzating.</p>
  </header>
  {error&&<p role="alert" className={template}>{error}</p>}
  {!data&&!error&&<p role="status">O‘quv rejalari yuklanmoqda…</p>}
  {data&&<>
   <section aria-label="Savollar ko‘rsatkichlari" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {[[bounds?.sets,'10 savolli paket'],[bounds?.questions,'Paketdagi savollar'],[bounds?.approved,'Ustoz tasdiqlagan'],[bounds?.published,'Nashr qilingan']].map(([n,t])=>
      <article className={template} key={t}><strong className="text-2xl text-blue-700 dark:text-blue-300">{n}</strong><p className="text-sm">{t}</p></article>)}
   </section>
   <section className={template}><h2 className="text-xl font-semibold">Kontent navbati</h2>
    {data.jobs.length?<ul className="mt-3 divide-y text-sm">{data.jobs.map(job=><li key={job.status} className="flex justify-between gap-3 py-3"><span>{jobLabels[job.status]||job.status}</span><span>{job.jobs} ta · ${(job.cost_cents/100).toFixed(2)} USD</span></li>)}</ul>:<p className="mt-3 text-sm">Navbatda ish yo‘q.</p>}
    {data.entries?.length ? <ul className="mt-4 space-y-2">{data.entries.map(job=>{
      const action=job.status==='pending'?'pause':job.status==='paused'?'resume':job.status==='failed'&&job.attempts<3?'retry':null;
      return <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm">
        <div><p className="font-medium">{job.topic}</p><p>{job.subject} · {jobLabels[job.status]} · Urinish {job.attempts}/3</p></div>
        {data.canManage&&action&&<button className="ss-secondary" disabled={!!busy} onClick={()=>void manage(job.id,action)}>{{pause:'Pauza',resume:'Davom ettirish',retry:'Qayta urinish'}[action]}</button>}
      </li>;
    })}</ul>:null}
   </section>
   <section className={template}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Fan va sinf bo‘yicha manba</h2>
    <button className="ss-secondary" disabled={!data.sources.length} onClick={()=>void schoolExcel('Curriculum-2026-2027',
      ['Fan','Sinf','Manba satrlari','Mavzu nomzodlari','Moslash kutilmoqda'],data.sources.map(r=>[r.subject||'—',r.grade||'—',r.rows,r.candidates,r.unresolved])).catch(()=>setError('XLSX eksporti bajarilmadi.'))}>XLSX eksport</button></div>
    <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
     <thead><tr><th className="py-2">Fan</th><th>Sinf</th><th>Satrlar</th><th>Nomzod mavzular</th><th>Moslanmagan</th></tr></thead>
     <tbody>{data.sources.map(row=><tr key={String(row.subject)+':'+row.grade} className="border-t"><td className="py-2">{row.subject||'Aniqlanmagan'}</td><td>{row.grade||'—'}</td><td>{row.rows}</td><td>{row.candidates}</td><td>{row.unresolved}</td></tr>)}</tbody>
    </table></div>
    {!data.sources.length&&<p className="py-3 text-sm">Bu muhitda manba inventari yuklanmagan.</p>}
   </section>
   <section className={template}><h2 className="text-xl font-semibold">Moslash kutilayotgan satrlar</h2>
    <label className="mt-4 block text-sm">Fan<select className="ss-field mt-2 block" value={subject} onChange={e=>{setPage(0);setSubject(e.target.value);}}><option value="">Barcha fanlar</option>{[...new Set(data.sources.map(row=>row.subject).filter(Boolean))].map(name=><option key={name} value={name||''}>{name}</option>)}</select></label>
    <p className="mt-3 text-sm" role="status">{data.missing.total} ta satr</p>
    <ul className="mt-3 divide-y">{data.missing.rows.map(row=><li className="py-3" key={row.id}>
      <h3 className="font-medium">{row.title}</h3>
      <p className="break-words text-xs">{row.file} · {row.sheet} · {row.row}-qator</p>
      {row.issues.length>0&&<p className="mt-1 text-sm">{row.issues.join(' ')}</p>}
    </li>)}</ul>
    <div className="mt-3 flex gap-3"><button className="ss-secondary" disabled={!page} onClick={()=>setPage(n=>n-1)}>Oldingi</button><button className="ss-secondary" disabled={(page+1)*25>=data.missing.total} onClick={()=>setPage(n=>n+1)}>Keyingi</button></div>
   </section>
  </>}
 </main>;
}
