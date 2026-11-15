import crypto from 'node:crypto';
import {parsePeople,parseSchoolPlan,inferSchoolPlanTarget,nameIdentity,normalizedText,type SourceSheet,type SchoolPersonRow,type SchoolPlanRow} from '../utils/schoolSourceImport';
export const schoolDigest=(value:unknown)=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export type SchoolImportKind='students'|'teachers'|'workplans';
export type SchoolSourceFile={name:string;sourceHash:string;sheets:SourceSheet[]};
export type PersonImportItem=SchoolPersonRow&{id:string;sourceHash:string;existingCandidates:string[]};
export type PlanImportItem={id:string;fileName:string;sourceHash:string;sheetName:string;lessons:SchoolPlanRow[];suggestion:ReturnType<typeof inferSchoolPlanTarget>;issues:string[]};
export type SchoolImportPayload={people:PersonImportItem[];plans:PlanImportItem[]};
export type SchoolImportJob={id:string;institutionId:string;actorId:string;kind:SchoolImportKind;academicYear:string;sourceDigest:string;files:Array<{name:string;sourceHash:string}>;createdAt:string;status:'review'|'committed'|'undone';publication?:'draft'|'partial'|'published';addedSubjectAssignments?:Array<{classId:string;subjectId:string}>;storagePath:string;summary:{people:number;plans:number;lessons:number;issues:number;duplicates:number};createdUsers:string[];createdLessons:string[];createdPlans:string[];credentialPath?:string;credentialExpiresAt?:number;credentialsClaimedAt?:string;committedAt?:string;undoneAt?:string};
export function analyzeSchoolFiles(kind:SchoolImportKind,files:SchoolSourceFile[],users:any[],institutionId:string):SchoolImportPayload{
 const people:PersonImportItem[]=[],plans:PlanImportItem[]=[];
 for(const file of files){
  if(kind!=='workplans'){
   const parsed=parsePeople(file.sheets,kind==='students'?'student':'teacher');
   for(const row of parsed.people){
    const key=nameIdentity(row.displayName),existingCandidates=users.filter(u=>u.institutionId===institutionId&&u.role===row.role&&nameIdentity(u.displayName)===key).map(u=>u.uid);
    people.push({...row,id:schoolDigest([file.sourceHash,row.sourceSheet,row.sourceRow,row.sourceKey]),sourceHash:file.sourceHash,existingCandidates});
   }
   if(!parsed.people.length)throw Error('Faylda kiritiladigan F.I.Sh. qatorlari topilmadi.');
  }else for(const sheet of file.sheets){
   if(!sheet.rows.some(r=>r.some(v=>normalizedText(v))))continue;
   const parsed=parseSchoolPlan([sheet]),suggestion=inferSchoolPlanTarget(file.name,sheet);
   const issues=[...suggestion.issues];if(!parsed.lessons.length)issues.push('Dars qatorlari topilmadi.');
   plans.push({id:schoolDigest([file.sourceHash,sheet.name]),fileName:file.name,sourceHash:file.sourceHash,sheetName:sheet.name,lessons:parsed.lessons,suggestion,issues});
  }
 }
 const seen=new Set<string>();for(const p of people){const key=p.role+'|'+p.classCode+'|'+nameIdentity(p.displayName);if(seen.has(key)&&!p.issues.some(i=>i.code==='DUPLICATE_SOURCE'))p.issues.push({sheet:p.sourceSheet,row:p.sourceRow,code:'DUPLICATE_SOURCE',message:'Fayllar ichida takroriy shaxs qatori.'});seen.add(key);}
 return{people,plans};
}
export function importSummary(payload:SchoolImportPayload){return{people:payload.people.length,plans:payload.plans.length,lessons:payload.plans.reduce((n,p)=>n+p.lessons.length,0),issues:payload.people.reduce((n,p)=>n+p.issues.length,0)+payload.plans.reduce((n,p)=>n+p.issues.length+p.lessons.reduce((v,l)=>v+l.issues.length,0),0),duplicates:payload.people.filter(p=>p.issues.some(i=>i.code==='DUPLICATE_SOURCE')).length};}
export function nextPersonLogin(row:Pick<PersonImportItem,'role'|'classCode'|'displayName'>,used:Set<string>){
 let base:string;
 if(row.role==='student')base='st.'+row.classCode;
 else{const parts=normalizedText(row.displayName).toLowerCase().replace(/[‘’']/g,'').split(' ');const translit=(v:string)=>v.normalize('NFKD').replace(/[^a-z0-9]/g,'');base='teacher.'+[translit(parts[1]||''),translit(parts[0]||'')].filter(Boolean).join('.');if(base==='teacher.')base='teacher.staff';base=base.slice(0,34);}
 let n=1,login:string;
 do{login=row.role==='student'?base+'.'+String(n).padStart(3,'0'):base+(n===1?'':'.'+n);n++;}while(used.has(login));used.add(login);return login;
}
