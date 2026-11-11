import React,{useState} from 'react';
import {Button,Drawer,Input,Select} from './DesignSystem';
export function TopicQuestionEditor({initial,busy,onClose,onSave}:{initial:any;busy:boolean;onClose:()=>void;onSave:(q:any)=>Promise<void>}){
 const [q,setQ]=useState(()=>({...initial,hints:initial.hints?.length?initial.hints:initial.hint?[initial.hint]:[],wrongFeedback:initial.wrongFeedback||{},source:initial.source||{title:'',page:''}}));
 const [error,setError]=useState('');const update=(key:string,value:any)=>setQ((q:any)=>({...q,[key]:value}));
 const kinds={single:'Bitta javob',multiple:'Ko‘p javob',short:'Qisqa javob',matching:'Juftlash',ordering:'Tartiblash',blank:'Bo‘shliq to‘ldirish',written:'Yozma javob'};
 return <Drawer title="Savol tahriri" onClose={onClose}>
  <p className="mb-4 text-sm text-slate-500">Saqlash yangi versiya yaratadi. Oldingi urinishlarning savollari va ballari o‘zgarmaydi.</p>
  {error&&<p role="alert" className="my-4 text-rose-700">{error}</p>}
  <label className="block text-sm">Savol turi<Select value={q.kind} onChange={e=>update('kind',e.target.value)}>{Object.entries(kinds).map(([v,t])=><option key={v} value={v}>{t}</option>)}</Select></label>
  <label className="mt-4 block text-sm">Savol matni (formulalar $...$ ichida)<textarea className="ss-field mt-2 min-h-32" value={q.prompt} onChange={e=>update('prompt',e.target.value)}/></label>
  {['options','labels','accepted'].map(key=><label key={key} className="mt-4 block text-sm">{key==='options'?'Variantlar — har qatorda bittadan':key==='labels'?'Juftlashning chap atamalari':'Qabul qilinadigan qo‘shimcha javoblar — qatorma-qator'}<textarea className="ss-field mt-2" value={q[key]?.join('\n')||''} onChange={e=>update(key,e.target.value.split('\n'))}/></label>)}
  <label className="mt-4 block text-sm">Kalit (ko‘p javob / juftlash / tartiblash: | bilan ajrating)<Input value={q.key} onChange={e=>update('key',e.target.value)}/></label>
  <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm">Ball<Input type="number" min="0.5" max="100" step="0.5" value={q.points} onChange={e=>update('points',Number(e.target.value))}/></label><label className="text-sm">Qiyinlik<Select value={q.difficulty||'medium'} onChange={e=>update('difficulty',e.target.value)}><option value="easy">Oson</option><option value="medium">O‘rta</option><option value="hard">Qiyin</option></Select></label></div>
  <label className="mt-4 block text-sm">Izoh / yechim — tasdiqlash uchun majburiy<textarea className="ss-field mt-2 min-h-28" value={q.explanation} onChange={e=>update('explanation',e.target.value)}/></label>
  <h3 className="mt-6 font-semibold">Bosqichma-bosqich maslahat</h3><p className="mt-2 text-sm text-slate-500">Javobni darhol aytish o‘rniga yo‘l ko‘rsating. O‘quvchi bittadan ochadi. Ball kamaymaydi, foydalanish qayd etiladi.</p>
  {[0,1,2].map(n=><label key={n} className="mt-3 block text-sm">{n+1}-maslahat<textarea className="ss-field mt-2" value={q.hints[n]||''} onChange={e=>update('hints',[0,1,2].map(i=>i===n?e.target.value:q.hints[i]||''))}/></label>)}
  <h3 className="mt-6 font-semibold">Noto‘g‘ri variantga izoh (ixtiyoriy)</h3>
  {q.options.filter((o:string)=>o&&o!==q.key).map((o:string)=><label key={o} className="mt-3 block break-words text-sm">{o}<textarea className="ss-field mt-2" placeholder="Bu tanlovdagi tushunmovchilik va uni tuzatish yo‘li…" value={q.wrongFeedback[o]||''} onChange={e=>update('wrongFeedback',{...q.wrongFeedback,[o]:e.target.value})}/></label>)}
  <label className="mt-5 block text-sm">Manba (darslik / muallif / o‘quv materiali)<Input value={q.source.title} onChange={e=>update('source',{...q.source,title:e.target.value})}/></label>
  <label className="mt-4 block text-sm">Sahifa<Input value={q.source.page} onChange={e=>update('source',{...q.source,page:e.target.value})}/></label>
  <label className="mt-4 block text-sm">Rasm (PNG/JPEG, 500 KB)<input type="file" accept="image/png,image/jpeg" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>500000){setError('Rasm 500 KB dan oshmasin.');return;}const r=new FileReader();r.onload=()=>update('image',String(r.result));r.readAsDataURL(f);}}/></label>
  {q.image&&<img src={q.image} alt="Savol rasmi" className="mt-4 max-h-64 max-w-full"/>}
  <Button className="mt-6" busy={busy} onClick={async()=>{setError('');try{await onSave({...q,options:q.options.filter(Boolean),labels:q.labels.filter(Boolean),accepted:q.accepted.filter(Boolean),hints:q.hints.filter((h:string)=>h.trim()),hint:'',wrongFeedback:Object.fromEntries(Object.entries(q.wrongFeedback).filter(([o,v])=>q.options.includes(o)&&v))});}catch(e){setError((e as Error).message);}}}>Savolni saqlash</Button>
 </Drawer>;
}
