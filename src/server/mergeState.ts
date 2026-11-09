const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export class MergeConflictError extends Error{}
function atomic(base:any,local:any,remote:any):any{
 if(same(base,local))return remote;if(same(base,remote))return local;
 throw new MergeConflictError('The same record changed concurrently');
}
// Merge disjoint entity changes only. A user, lesson, or session is atomic;
// counters and same-record edits never silently overwrite one another.
export function mergeState(base:any,local:any,remote:any):any{
 const result:any={};
 for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
  const b=base[key],l=local[key],r=remote[key];
  if(same(b,l)){result[key]=r;continue;}if(same(b,r)){result[key]=l;continue;}
  const entityKey=(row:any)=>row&&typeof row==='object'&&(typeof row.id==='string'?row.id:typeof row.uid==='string'?row.uid:null);
  if([b,l,r].every(Array.isArray)&&[b,l,r].every(a=>a.every((v:any)=>entityKey(v))&&new Set(a.map(entityKey)).size===a.length)){
   if(!['examSessions','lessonPracticeResponses','studentLastLessons','auditLogs','notifications'].includes(key))throw new MergeConflictError('Collection invariants require a retry');
   const maps=[b,l,r].map(a=>new Map(a.map((v:any)=>[entityKey(v),v])));
   const ids=new Set([...r.map(entityKey),...l.map(entityKey),...b.map(entityKey)]);
   result[key]=[...ids].map(id=>atomic(...maps.map(m=>m.get(id)) as [any,any,any])).filter(v=>v!==undefined);
  }else if([b,l,r].every(v=>v&&typeof v==='object'&&!Array.isArray(v))){
   const merged:any={};for(const id of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])){const value=atomic(b[id],l[id],r[id]);if(value!==undefined)merged[id]=value;}result[key]=merged;
  }else result[key]=atomic(b,l,r);
 }
 return result;
}
