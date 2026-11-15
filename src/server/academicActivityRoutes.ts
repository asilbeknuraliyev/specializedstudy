import type {Express} from 'express';
import crypto from 'node:crypto';
import {z} from 'zod';
import {asyncRoute} from './asyncRoute';
import {hasLeadershipPermission} from './leadershipSecurity';
import {SupabaseAcademicStore} from './academicStore';
import {dateOnly} from '../utils/academicPlanning';
import {schoolDigest} from './schoolImportEngine';

/** Reuses attendance and assignment records; never creates a second gradebook. */
export function registerAcademicActivityRoutes(app:Express,deps:any){
 const store=deps.store||new SupabaseAcademicStore();
 const context=async(req:any,res:any)=>{
  const c=deps.authenticate(req);if(!c){res.status(401).json({error:'Hisobga kiring.'});return;}
  const row=await store.get(c.user.institutionId,'2026-2027',req.params.id);
  if(!row||!(deps.owner(c.user)||hasLeadershipPermission(c,'curriculum.manage')||c.user.role==='teacher'&&row.teacherId===c.user.uid&&c.user.assignedClassIds?.includes(row.classId)&&row.subject===c.user.subject)){res.status(403).json({error:'Bu dars va guruhga ruxsat yo‘q.'});return;}
  const group=row.groupId?(c.db.academicGroups||[]).find((g:any)=>g.id===row.groupId&&g.schoolId===c.user.institutionId&&g.classId===row.classId):undefined;
  const roster=c.db.users.filter((u:any)=>u.institutionId===c.user.institutionId&&u.classId===row.classId&&u.role==='student'&&u.status==='active'&&(!row.groupId||group?.members.includes(u.uid)));
  return{...c,row,roster};
 };
 app.get('/api/academic/occurrences/:id/roster',asyncRoute(async(req,res)=>{const c=await context(req,res);if(!c)return;const session=c.db.attendanceSessions.find((s:any)=>s.occurrenceId===c.row.id);res.json({students:c.roster.map((u:any)=>({id:u.uid,name:u.displayName})),groupId:c.row.groupId,revision:session?.revision||0,records:session?c.db.attendanceRecords.filter((r:any)=>r.sessionId===session.id).map((r:any)=>({studentId:r.studentId,status:r.status})):[],groupMissing:!!c.row.groupId&&!c.roster.length});}));
 app.post('/api/academic/occurrences/:id/attendance',asyncRoute(async(req,res)=>{
  const c=await context(req,res);if(!c)return;const p=z.object({operationId:z.uuid(),revision:z.number().int().nonnegative(),records:z.array(z.object({studentId:z.string().max(160),status:z.enum(['PRESENT','ABSENT','LATE','EXCUSED_ABSENCE'])})).min(1).max(50)}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Davomat yozuvlarini tekshiring.'});
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent'}).format(new Date());
  if(c.row.date>today||['cancelled','postponed','replaced'].includes(c.row.state))return res.status(409).json({error:'Kelajakdagi yoki bekor qilingan darsga davomat yozilmaydi.'});
  const digest=schoolDigest(p.data.records),old=c.db.attendanceSessions.find((s:any)=>s.occurrenceId===c.row.id);
  if(old?.operations?.some((o:any)=>o.id===p.data.operationId)){const receipt=old.operations.find((o:any)=>o.id===p.data.operationId);if(receipt.digest!==digest)return res.status(409).json({error:'Amal raqami boshqa mazmun uchun ishlatilgan.'});return res.json({saved:true,duplicate:true,revision:old.revision});}
  if((old?.revision||0)!==p.data.revision)return res.status(409).json({error:'Davomat boshqa oynada yangilangan.'});
  const ids=new Set(c.roster.map((u:any)=>u.uid));if(ids.size!==p.data.records.length||new Set(p.data.records.map(r=>r.studentId)).size!==ids.size||p.data.records.some(r=>!ids.has(r.studentId)))return res.status(400).json({error:'Faqat ushbu darsning to‘liq tasdiqlangan guruh tarkibi uchun belgilang.'});
  const now=new Date().toISOString(),id=old?.id||'attendance-'+schoolDigest(c.row.id).slice(0,40),counts=(status:string)=>p.data.records.filter(r=>r.status===status).length;
  const session={id,institutionId:c.user.institutionId,classId:c.row.classId,classCode:c.row.classCode,date:c.row.date,academicYear:'2026-2027',occurrenceId:c.row.id,groupId:c.row.groupId,subject:c.row.subject,recordedByUid:c.user.uid,recordedByName:c.user.displayName,totalEnrolled:ids.size,presentCount:counts('PRESENT'),absentCount:counts('ABSENT'),lateCount:counts('LATE'),excusedCount:counts('EXCUSED_ABSENCE'),attendancePercent:Math.round(100*(counts('PRESENT')+counts('LATE'))/ids.size),createdAt:old?.createdAt||now,updatedAt:now,revision:(old?.revision||0)+1,operations:[...(old?.operations||[]),{id:p.data.operationId,digest}]};
  c.db.attendanceSessions=c.db.attendanceSessions.filter((s:any)=>s.id!==id);c.db.attendanceSessions.push(session);c.db.attendanceRecords=c.db.attendanceRecords.filter((r:any)=>r.sessionId!==id);
  c.db.attendanceRecords.push(...p.data.records.map(r=>({id:id+':'+r.studentId,sessionId:id,institutionId:c.user.institutionId,classId:c.row.classId,classCode:c.row.classCode,studentId:r.studentId,studentName:c.roster.find((u:any)=>u.uid===r.studentId).displayName,date:c.row.date,status:r.status,recordedByUid:c.user.uid,recordedByName:c.user.displayName,recordedAt:now,updatedAt:now})));
  c.db.auditLogs.unshift({id:crypto.randomUUID(),institutionId:c.user.institutionId,actorUid:c.user.uid,action:'Dars/guruh davomati saqlandi',recordId:id,createdAt:now});deps.save(c.env,c.db);res.json({saved:true,revision:session.revision});
 }));
 app.post('/api/academic/occurrences/:id/task',asyncRoute(async(req,res)=>{
  const c=await context(req,res);if(!c)return;const p=z.object({operationId:z.uuid(),title:z.string().trim().min(3).max(200),description:z.string().trim().min(3).max(5000),dueDate:z.string().refine(dateOnly),maxScore:z.number().min(0).max(100),publish:z.boolean()}).safeParse(req.body);if(!p.success||p.data.dueDate<c.row.date)return res.status(400).json({error:'Vazifa matni, sana va ballni tekshiring.'});
  if(c.row.groupId&&!c.roster.length)return res.status(409).json({error:'Avval guruh a’zolarini tasdiqlang.'});
  const id='academic-task-'+schoolDigest([c.user.institutionId,c.user.uid,p.data.operationId]).slice(0,40),digest=schoolDigest(p.data),old=c.db.studentAssignments.find((a:any)=>a.id===id);
  if(old){if(old.operationDigest!==digest)return res.status(409).json({error:'Amal raqami boshqa mazmun uchun ishlatilgan.'});return res.json({assignmentId:id,duplicate:true});}
  const now=new Date().toISOString();c.db.studentAssignments.push({id,institutionId:c.user.institutionId,title:p.data.title,description:p.data.description,subject:c.row.subject,subjectName:c.row.subject,classCode:c.row.classCode,targetClassCodes:[c.row.classCode],targetClassIds:[c.row.classId],groupIds:c.row.groupId?[c.row.groupId]:[],relatedLessonId:c.row.topicId,relatedLessonTitle:c.row.topicTitle,occurrenceId:c.row.id,assignedDate:c.row.date,dueDate:p.data.dueDate,maxScore:p.data.maxScore,status:p.data.publish?'published':'draft',createdByUid:c.user.uid,createdByName:c.user.displayName,createdAt:now,updatedAt:now,revision:1,operationDigest:digest,submissionType:'text',allowResubmission:true});
  c.db.auditLogs.unshift({id:crypto.randomUUID(),institutionId:c.user.institutionId,actorUid:c.user.uid,action:'Darsdan guruhga vazifa yaratildi',recordId:id,createdAt:now});deps.save(c.env,c.db);res.json({assignmentId:id,published:p.data.publish});
 }));
}
