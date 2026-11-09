import {useRef,useState} from 'react';
import {useLearnOS} from '../context/LearnOSContext';
export function useExportAction(){
 const locked=useRef(false);const[busy,setBusy]=useState(false);const{addToast}=useLearnOS();
 const run=async(task:()=>Promise<void>)=>{
  if(locked.current)return;locked.current=true;setBusy(true);
  addToast('info','Excel fayli tayyorlanmoqda…');
  try{await task();}catch{addToast('error','Excel fayli tayyorlanmadi. Qayta urinib ko‘ring.');}
  finally{locked.current=false;setBusy(false);}
 };
 return{run,busy};
}
