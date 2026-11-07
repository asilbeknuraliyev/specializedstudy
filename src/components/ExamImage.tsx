import React,{useEffect,useState} from 'react';
import {useLearnOS} from '../context/LearnOSContext';
export function ExamImage({src,alt,className=''}:{src:string;alt:string;className?:string}){
 const {sessionToken}=useLearnOS();const [url,setUrl]=useState(src.startsWith('data:')?src:''),[error,setError]=useState(false);
 useEffect(()=>{if(src.startsWith('data:')){setUrl(src);return;}if(!src.startsWith('/api/exams/')){setError(true);return;}const controller=new AbortController();let objectUrl='';fetch(src,{headers:{Authorization:`Bearer ${sessionToken}`},signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Rasm yuklanmadi');return r.blob();}).then(b=>{objectUrl=URL.createObjectURL(b);setUrl(objectUrl);}).catch(e=>{if(e.name!=='AbortError')setError(true);});return()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};},[src,sessionToken]);
 return error?<p role="alert" className="p-4 text-sm text-rose-600">Savol tasviri yuklanmadi. Internetni tekshirib, sahifani yangilang.</p>:url?<img src={url} alt={alt} className={className}/>:<div role="status" className="p-8 text-center text-sm text-slate-400">Tasvir yuklanmoqda…</div>;
}
