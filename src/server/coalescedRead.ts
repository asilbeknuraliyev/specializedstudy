// Share I/O only while it is in flight. Returned records are never shared between
// request contexts; a later call must observe a fresh revision/revocation.
export function coalescedRead<T>(read:()=>Promise<T>){
 let pending:Promise<T>|undefined;
 return async()=>{
  if(!pending)pending=Promise.resolve().then(read).finally(()=>{pending=undefined;});
  return structuredClone(await pending);
 };
}
