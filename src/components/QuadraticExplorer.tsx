import {useId,useState} from 'react';

const y=(t:number)=>(t-1)*(t-4);
const xPixel=(t:number)=>24+52*t;
const yPixel=(value:number)=>93-10*value;
const curve=Array.from({length:101},(_,i)=>{
  const t=i/20;
  return `${xPixel(t)},${yPixel(y(t))}`;
}).join(' ');

export function QuadraticExplorer(){
  const [t,setT]=useState(0);
  const id=useId();
  const value=Math.round(y(t)*100)/100;
  return <figure className="my-4 space-y-3 rounded-xl border bg-white p-4 text-slate-900">
    <figcaption className="font-semibold">t² − 5t + 4 grafigi</figcaption>
    <svg viewBox="0 0 305 140" className="w-full max-w-lg" role="img" aria-label="Parabolada tanlangan nuqta">
      <path d="M24 10V125 M12 93H295" stroke="currentColor" fill="none"/>
      <polyline points={curve} fill="none" stroke="#2563eb" strokeWidth="3"/>
      {[0,1,2,3,4,5].map(n=><text key={n} x={xPixel(n)} y="137" textAnchor="middle" fontSize="12">{n}</text>)}
      <circle cx={xPixel(t)} cy={yPixel(value)} r="5" fill="#075985"/>
    </svg>
    <label htmlFor={id}>Nuqtani siljiting. Qaysi t qiymatlarida grafik gorizontal o‘qni kesadi?</label>
    <input id={id} type="range" min="0" max="5" step="0.1" value={t}
      className="block h-11 w-full accent-blue-600" onChange={event=>setT(Number(event.target.value))}/>
    <output htmlFor={id}>t = {t} · t² − 5t + 4 = {value}</output>
  </figure>;
}
