import {Link} from 'react-router-dom';
import {useState} from 'react';
import rows from '../data/curriculumCoverage.json';

export default function CurriculumCoverage(){
  const [subject,setSubject]=useState('');
  const [grade,setGrade]=useState('');
  const filtered=rows.filter(row=>(!subject||row.subject===subject)&&(!grade||String(row.grade??'')===grade));
  return <main className="mx-auto max-w-5xl space-y-5 p-4"><Link className="ss-secondary inline-flex" to="/admin/content-operations">Jonli inventar va navbat</Link>
    <h1 className="text-3xl font-bold">Ish rejalari qamrovi</h1>
    <p>2026–2027 o‘quv yili arxivi. Fan va sinf bo‘yicha manba varaqlarini tekshiring.</p>
    <div className="flex flex-wrap gap-4">
      <label>Fan <select className="ss-field" value={subject} onChange={e=>setSubject(e.target.value)}><option value="">Barcha fanlar</option>{[...new Set(rows.map(r=>r.subject))].sort().map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Sinf <select className="ss-field" value={grade} onChange={e=>setGrade(e.target.value)}><option value="">Barcha sinflar</option>{[...new Set(rows.flatMap(r=>r.grade?[r.grade]:[]))].sort((a,b)=>a-b).map(g=><option key={g}>{g}</option>)}</select></label>
    </div>
    <p role="status">{filtered.length} varaq · {filtered.reduce((n,r)=>n+r.topics,0)} mavzu qatori</p>
    {filtered.map(r=><details className="border-b py-3" key={r.file+r.sheet}><summary className="cursor-pointer break-words">{r.file.split('/').at(-1)} · {r.sheet} · {r.topics} qator</summary>
      <p className="mt-2">{r.assessment} baholash qatori · {r.issues} parser ogohlantirishi</p>{r.mapping.map(m=><p key={m}>{m}</p>)}</details>)}
  </main>;
}
