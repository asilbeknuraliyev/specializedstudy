import {useCallback,useRef} from 'react';
import {useExamApi} from './useExamApi';
// A lost response can be retried with the same ID. A confirmed action clears its
// entry, so deliberately creating another identical question remains possible.
export function useTopicMutation(){
 const api=useExamApi(),pending=useRef(new Map<string,string>());
 return useCallback(async(path:string,body:any)=>{
  const signature=JSON.stringify([path,body]);let id=pending.current.get(signature);
  if(!id){id=crypto.randomUUID();pending.current.set(signature,id);}
  const data=await api(path,'POST',{...body,operationId:id});pending.current.delete(signature);return data;
 },[api]);
}
