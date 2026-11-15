import {nameIdentity,normalizedText,schoolClassCode,standardSubject} from '../utils/schoolSourceImport';
import {schoolDigest,type SchoolImportPayload,type PersonImportItem} from './schoolImportEngine';
export type StaffCategory='teacher'|'director'|'academic_deputy'|'leadership'|'staff'|'unresolved';
export type SchoolReview={id:string;jobId:string;itemId:string;revision:number;operationId:string;decision:'approve'|'hold'|'reject';reason:string;by:string;at:string;person?:{displayName?:string;position?:string;category?:StaffCategory;classCode?:string;assignments?:Array<{classCode:string;subject:string}>;matchUid?:string;updateExisting?:boolean;replaceAssignments?:boolean};plan?:{subject:string;classCodes:string[];confirmed:true;confirmAdditionalSubjects:boolean}};
export function proposedStaffCategory(position:string):StaffCategory{
 const v=normalizedText(position).toLowerCase();if(/o.?ibdo|ўибд|учебн/.test(v))return'academic_deputy';if(/mmibdo|ma.nav|zam|зам/.test(v))return'leadership';if(/direktor|директор/.test(v))return'director';if(/kadr|кадр|kutub|кутуб|psix|псих/.test(v))return'staff';if(/o.qituvchi|учител/.test(v))return'teacher';return'unresolved';
}
export function currentSchoolReviews(db:any,jobId:string){const latest=new Map<string,SchoolReview>();for(const r of db.schoolDataReviews||[])if(r.jobId===jobId&&(!latest.has(r.itemId)||latest.get(r.itemId)!.revision<r.revision))latest.set(r.itemId,r);return latest;}
export function reconcileSchoolPerson(row:PersonImportItem,users:any[],school:string){
 const eligible=users.filter(u=>u.institutionId===school&&(row.role==='student'?u.role==='student':['teacher','staff'].includes(u.role))&&u.status!=='archived');
 const source=eligible.filter(u=>u.sourceImport?.sourceHash===row.sourceHash&&u.sourceImport?.sourceSheet===row.sourceSheet&&u.sourceImport?.sourceRow===row.sourceRow);
 const names=eligible.filter(u=>nameIdentity(u.displayName)===nameIdentity(row.displayName));const sameClass=names.filter(u=>row.role!=='student'||u.classCode===row.classCode);const matches=source.length?source:sameClass;
 const match=matches.length===1?matches[0]:undefined;return{source:1,matchUid:match?.uid,existing:!!match,conflict:matches.length>1||!match&&names.length>0,candidates:[...new Set([...matches,...names].map(u=>u.uid))],requiresUpdate:!!match&&(match.displayName!==row.displayName||row.role==='student'&&match.classCode!==row.classCode),reason:source.length?'source_reference':sameClass.length?'normalized_name_and_class':names.length?'same_name_other_class':'new_identity'};
}
export function reviewedSchoolPayload(payload:SchoolImportPayload,db:any,jobId:string,school:string){
 const latest=currentSchoolReviews(db,jobId);const identities=new Map<string,number>();for(const original of payload.people){const r=latest.get(original.id);if(r?.decision==='reject')continue;const key=[original.role,schoolClassCode(r?.person?.classCode||original.classCode),nameIdentity(r?.person?.displayName||original.displayName)].join('|');identities.set(key,(identities.get(key)||0)+1);}return{
  people:payload.people.map(original=>{const review=latest.get(original.id),row:any=structuredClone(original);row.original={displayName:original.displayName,classCode:original.classCode,position:original.position,subjects:original.subjects};row.review=review;row.category=proposedStaffCategory(row.position||'');
   if(review?.person){const p=review.person;row.displayName=p.displayName||row.displayName;row.position=p.position??row.position;row.category=p.category||row.category;if(p.classCode)row.classCode=schoolClassCode(p.classCode);if(p.assignments?.length)row.subjects=[...new Set(p.assignments.map(a=>standardSubject(a.subject)))];}
   row.issues=row.issues.filter((i:any)=>!(i.code==='INVALID_NAME'&&row.displayName.length>=5&&row.displayName.split(/\s+/).length>=2)&&!(i.code==='SUBJECT_MISSING'&&row.subjects.length)&&!(i.code==='CLASS_ASSIGNMENT_REQUIRED'&&review?.person?.assignments?.length));
   const key=[row.role,row.classCode,nameIdentity(row.displayName)].join('|');if((identities.get(key)||0)===1)row.issues=row.issues.filter((i:any)=>i.code!=='DUPLICATE_SOURCE');if((identities.get(key)||0)>1&&!row.issues.some((i:any)=>i.code==='DUPLICATE_SOURCE'))row.issues.push({code:'DUPLICATE_SOURCE',row:row.sourceRow,sheet:row.sourceSheet,message:'Tuzatilgan F.I.Sh./sinf boshqa manba qatori bilan takrorlanmoqda.'});
   row.reconciliation=reconcileSchoolPerson(row,db.users,school);row.existingCandidates=row.reconciliation.candidates;
   return row;
  }),
  plans:payload.plans.map(p=>({...p,review:latest.get(p.id)})),
 };
}
export function schoolReconciliation(payload:ReturnType<typeof reviewedSchoolPayload>,db:any,job:any){
 const counts={source:payload.people.length,existing:0,requiringCreation:0,requiringUpdate:0,conflicts:0,created:0,stillMissing:0,rejected:0,held:0,validatedStaffIdentitiesCreated:0,teachersFullyConfigured:0};
 for(const row of payload.people){const r=row.reconciliation;const created=db.users.find((u:any)=>u.sourceImport?.batchId===job.id&&u.sourceImport?.sourceHash===row.sourceHash&&u.sourceImport?.sourceSheet===row.sourceSheet&&u.sourceImport?.sourceRow===row.sourceRow&&u.status!=='archived');
  if(created){counts.created++;if(row.role==='teacher'){counts.validatedStaffIdentitiesCreated++;if(created.role==='teacher'&&created.status==='active'&&(db.teacherAssignments||[]).some((a:any)=>a.teacherId===created.uid))counts.teachersFullyConfigured++;}}
  else if(r.existing){counts.existing++;if(r.requiresUpdate)counts.requiringUpdate++;}else if(r.conflict)counts.conflicts++;else counts.requiringCreation++;
  if(row.review?.decision==='reject')counts.rejected++;else if(row.review?.decision==='hold'||!row.review&&row.issues.length)counts.held++;if(!created&&!r.existing)counts.stillMissing++;
 }return counts;
}
export function schoolCoverage(db:any,school:string,year:string){
 const classes=db.classes.filter((c:any)=>c.institutionId===school&&c.status!=='archived'),lessons=db.lessons.filter((l:any)=>l.institutionId===school&&l.academicYear===year&&l.status!=='archived'),plans=db.workPlans.filter((p:any)=>p.institutionId===school&&p.academicYear===year&&p.status!=='archived');
 const rows=classes.flatMap((c:any)=>(c.subjectNames||[]).map((subject:string)=>{const mine=lessons.filter((l:any)=>(l.classId===c.id||l.classIds?.includes(c.id))&&(l.subjectName||l.subject)===subject);return{classId:c.id,classCode:c.code,subject,topics:mine.length,published:mine.filter((l:any)=>['published','in_progress','completed'].includes(l.status)).length,plannedHours:mine.reduce((n:number,l:any)=>n+(Number(l.hours)||0),0),missing:mine.length===0};}));
 return{year,classes:classes.length,classesCovered:new Set(rows.filter((r:any)=>r.topics).map((r:any)=>r.classId)).size,workPlans:plans.length,topics:lessons.length,published:lessons.filter((l:any)=>['published','in_progress','completed'].includes(l.status)).length,awaitingReview:lessons.filter((l:any)=>l.status==='draft').length,missingClassSubjects:rows.filter((r:any)=>r.missing).length,subjectsImported:[...new Set(lessons.map((l:any)=>l.subjectName||l.subject))].length,rows};
}
export const reviewRecordId=(job:string,item:string,revision:number)=>'review-'+schoolDigest([job,item,revision]).slice(0,40);
