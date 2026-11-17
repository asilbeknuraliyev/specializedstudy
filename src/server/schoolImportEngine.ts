import crypto from 'node:crypto';
import {createStudentLogin} from './schoolCredentials';
import {parsePeople,parseSchoolPlan,inferSchoolPlanTarget,nameIdentity,normalizedText,type SourceSheet,type SchoolPersonRow,type SchoolPlanRow,type SourceIssue} from '../utils/schoolSourceImport';
export const schoolDigest=(value:unknown)=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export type SchoolImportKind='students'|'teachers'|'workplans';
export type SchoolSourceFile={name:string;sourceHash:string;sheets:SourceSheet[]};
export type PersonImportItem=SchoolPersonRow&{id:string;sourceHash:string;existingCandidates:string[]};
export type PlanImportItem={id:string;fileName:string;sourceHash:string;sheetName:string;sourceEvidence?:string[];sourceIssues?:SourceIssue[];lessons:SchoolPlanRow[];suggestion:ReturnType<typeof inferSchoolPlanTarget>;issues:string[]};
export type SchoolImportPayload={people:PersonImportItem[];plans:PlanImportItem[]};
export type SchoolImportJob={id:string;institutionId:string;actorId:string;kind:SchoolImportKind;academicYear:string;sourceDigest:string;files:Array<{name:string;sourceHash:string}>;createdAt:string;status:'review'|'committed'|'undone';publication?:'draft'|'partial'|'published';addedSubjectAssignments?:Array<{classId:string;subjectId:string}>;storagePath:string;summary:{people:number;plans:number;lessons:number;issues:number;duplicates:number};createdUsers:string[];createdLessons:string[];createdPlans:string[];credentialPath?:string;credentialExpiresAt?:number;credentialsClaimedAt?:string;credentialClaimOperationId?:string;identityLinkRequired?:boolean;reviewRevision?:number;reviewOperations?:string[];reviewOperationDigests?:Record<string,string>;committedAt?:string;committedByUid?:string;undoneAt?:string};
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
   const sourceIssues=parsed.issues.filter(i=>!parsed.lessons.some(l=>l.sourceRow===i.row&&l.sourceSheet===i.sheet&&l.issues.some(e=>e.code===i.code)));const issues=[...suggestion.issues,...sourceIssues.map(i=>i.sheet+' · '+i.row+'-qator: '+i.message)];if(!parsed.lessons.length)issues.push('Dars qatorlari topilmadi.');
   plans.push({id:schoolDigest([file.sourceHash,sheet.name]),fileName:file.name,sourceHash:file.sourceHash,sheetName:sheet.name,sourceEvidence:sheet.rows.slice(0,5).map(r=>r.map(normalizedText).join(' | ').slice(0,1200)),sourceIssues,lessons:parsed.lessons,suggestion,issues});
  }
 }
 const seen=new Set<string>();for(const p of people){const key=p.role+'|'+p.classCode+'|'+nameIdentity(p.displayName);if(seen.has(key)&&!p.issues.some(i=>i.code==='DUPLICATE_SOURCE'))p.issues.push({sheet:p.sourceSheet,row:p.sourceRow,code:'DUPLICATE_SOURCE',message:'Fayllar ichida takroriy shaxs qatori.'});seen.add(key);}
 return{people,plans};
}
export function importSummary(payload:SchoolImportPayload){return{people:payload.people.length,plans:payload.plans.length,lessons:payload.plans.reduce((n,p)=>n+p.lessons.length,0),issues:payload.people.reduce((n,p)=>n+p.issues.length,0)+payload.plans.reduce((n,p)=>n+p.issues.length+p.lessons.reduce((v,l)=>v+l.issues.length,0),0),duplicates:payload.people.filter(p=>p.issues.some(i=>i.code==='DUPLICATE_SOURCE')).length};}
const cyrillic: Record<string,string> = {
 а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'j',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'x',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ы:'i',э:'e',ю:'yu',я:'ya',ў:'o',қ:'q',ғ:'g',ҳ:'h',
};
const loginPart=(value:string)=>Array.from(value.normalize('NFKD').toLowerCase(),c=>cyrillic[c]??c).join('').replace(/[^a-z0-9]/g,'');
export function nextPersonLogin(row:Pick<PersonImportItem,'role'|'displayName'>,uid:string,used:Set<string>){
 if(row.role==='student')return createStudentLogin(used);
 const [surname, givenName]=normalizedText(row.displayName).split(/\s+/).map(loginPart);
 const base=[givenName,surname].filter(Boolean).join('.')||'school.staff';
 const plain=base.slice(0,40).replace(/\.$/,'');
 if(!used.has(plain)){used.add(plain);return plain;}
 const suffix=schoolDigest(uid);
 for(let length=8;length<=16;length+=2){
  const login=base.slice(0,39-length).replace(/\.$/,'')+'.'+suffix.slice(0,length);
  if(!used.has(login)){used.add(login);return login;}
 }
 throw Error('Bo‘sh xodim loginini ajratib bo‘lmadi.');
}
