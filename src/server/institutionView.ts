export function scopeInstitutionResponse(body:any,state:any,institutionId:string){
 const users=new Set(state.users.filter((u:any)=>u.institutionId===institutionId).map((u:any)=>u.uid));
 const result={...body};for(const [key,value] of Object.entries(result))if(Array.isArray(value))result[key]=value.filter((row:any)=>{
  if(!row||typeof row!=='object')return true;
  if(key==='institutions')return row.id===institutionId;
  if(row.institutionId&&row.institutionId!=='global')return row.institutionId===institutionId;
  if(row.studentId)return users.has(row.studentId);
  if(row.uid)return users.has(row.uid);
  return true;
 });return result;
}
