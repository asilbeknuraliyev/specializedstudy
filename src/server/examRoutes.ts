import { storeExamImage, readExamImage } from './examMedia';
import crypto from 'node:crypto';
import { z } from 'zod';
import type { Express } from 'express';
import type { Assessment, QuestionItem, UserProfile } from '../types';
import type { PersistentDatabaseState } from './dbEngine';
import { canTakeExam, examCanStart, examDeadline, validateExamForPublish } from '../utils/examPolicy';
const image=z.string().max(650000).refine(v=>/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(v),'Faqat JPEG/PNG tasvirlari.');
const question=z.object({sourceNumber:z.number().int().positive(),variant:z.string().max(12),prompt:z.string().min(3).max(18000),sourcePages:z.array(z.number().int().positive()).max(20),sourceImages:z.array(image).max(20),fields:z.array(z.object({id:z.string().max(80),label:z.string().max(120),imageIndex:z.number().int().min(0),x:z.number().min(0).max(1),y:z.number().min(0).max(1),width:z.number().min(.01).max(1),height:z.number().min(.01).max(1)})).max(40),points:z.number().min(0).max(100),type:z.enum(['written_open','single_choice']),options:z.array(z.string().max(4000)).max(8),correctAnswer:z.string().max(4000),rubricText:z.string().max(12000)});
const draftSchema=z.object({title:z.string().min(3).max(200),examKind:z.enum(['BSB','CHSB']),examNumber:z.number().int().min(1).max(2),quarter:z.number().int().min(1).max(4),academicYear:z.string().regex(/^\d{4}-\d{4}$/),subject:z.string().min(2).max(100),classCodes:z.array(z.string()).min(1).max(19),durationMinutes:z.number().int().min(1).max(180),availableFrom:z.string().datetime(),dueDate:z.string().datetime(),sourceFileName:z.string().max(200),sourceHash:z.string().regex(/^[a-f0-9]{64}$/),contextImages:z.array(image).max(20),questions:z.array(question).min(1).max(60)});
interface Context {user:UserProfile;env:'prod'|'test';db:PersistentDatabaseState;token:string;}
export function registerExamRoutes(app:Express,deps:{authenticate:(req:any)=>Context|null;save:(env:'prod'|'test',db:PersistentDatabaseState)=>void;notify:(env:'prod'|'test',institutionId:string,event:string)=>void}) {
 const admin=(req:any,res:any)=>{const c=deps.authenticate(req);if(!c){res.status(401).json({error:'Hisobga kiring.'});return null;}if(!['admin','platform_owner'].includes(c.user.role)||c.user.platformAdmin!==true||c.user.emailVerified!==true){res.status(403).json({error:'Faqat administrator.'});return null;}return c;};
 app.post('/api/exams/drafts',async(req,res)=>{
  const c=admin(req,res);if(!c)return;const parsed=draftSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:parsed.error.issues[0]?.message||'Ma’lumot noto‘g‘ri.'});const data=parsed.data;
  if(Buffer.byteLength(JSON.stringify(data))>3200000)return res.status(413).json({error:'Tasvirlar hajmi 3 MB dan oshdi. Faylni qismlarga ajrating.'});
  if(data.examKind==='CHSB'&&data.examNumber!==1)return res.status(400).json({error:'Bir chorakda bitta CHSB bo‘ladi.'});
  const classes=c.db.classes.filter(cls=>cls.institutionId===c.user.institutionId&&data.classCodes.includes(cls.code));
  if(classes.length!==new Set(data.classCodes).size||new Set(classes.map(cls=>cls.grade)).size!==1)return res.status(400).json({error:'Bir bosqichdagi haqiqiy sinflarni tanlang.'});
  if(data.questions.some(q=>q.fields.some(f=>f.imageIndex>=q.sourceImages.length)))return res.status(400).json({error:'Javob maydoni manba sahifasiga mos emas.'});
  if(Date.parse(data.availableFrom)>=Date.parse(data.dueDate))return res.status(400).json({error:'Vaqt oralig‘ini tekshiring.'});
  const existing=c.db.assessments.find(a=>a.institutionId===c.user.institutionId&&a.sourceHash===data.sourceHash&&a.title===data.title&&a.examKind===data.examKind&&a.academicYear===data.academicYear&&a.examNumber===data.examNumber&&a.quarter===data.quarter&&JSON.stringify(a.assignedClassCodes)===JSON.stringify(data.classCodes));
  if(existing)return res.json({assessment:existing,replayed:true});
  const now=new Date().toISOString(),id='exam-'+crypto.randomUUID();
  try {
    for(const q of data.questions) q.sourceImages=await Promise.all(q.sourceImages.map(image=>storeExamImage(c.user.institutionId,id,image)));
    data.contextImages=await Promise.all(data.contextImages.map(image=>storeExamImage(c.user.institutionId,id,image)));
  } catch { return res.status(503).json({error:'Manba tasvirlarini saqlab bo‘lmadi. Qoralama saqlanmadi; qayta urinib ko‘ring.'}); }

  const qs:QuestionItem[]=data.questions.map((q,i)=>({id:id+'-q'+(i+1),institutionId:c.user.institutionId,authorId:c.user.uid,subject:data.subject,grade:classes[0].grade,topicId:'',difficulty:'mixed',type:q.type,points:q.points,prompt:q.prompt,options:q.options,correctAnswer:q.correctAnswer,gradingMode:q.type==='single_choice'?'automatic':'manual_rubric',rubricText:q.rubricText,sourceImages:q.sourceImages,sourcePages:q.sourcePages,answerFields:q.fields,explanation:'',status:'draft',createdAt:now}));
  const assessment:Assessment={id,title:data.title,subject:data.subject,grade:classes[0].grade,examKind:data.examKind,examNumber:data.examNumber,examState:'draft',academicYear:data.academicYear,quarter:data.quarter as 1|2|3|4,classId:classes[0].id,classCode:classes[0].code,assignedClassIds:classes.map(c=>c.id),assignedClassCodes:classes.map(c=>c.code as any),durationMinutes:data.durationMinutes,availableFrom:data.availableFrom,dueDate:data.dueDate,sourceFileName:data.sourceFileName,sourceHash:data.sourceHash,contextImages:data.contextImages,topicIds:[],questionIds:qs.map(q=>q.id),questionSnapshot:qs,teacherId:c.user.uid,institutionId:c.user.institutionId,status:'draft',source:'manual',createdAt:now,totalPoints:qs.reduce((sum,q)=>sum+(q.points||0),0),totalPausedMs:0};
  c.db.questions.push(...qs);c.db.assessments.unshift(assessment);deps.save(c.env,c.db);deps.notify(c.env,c.user.institutionId,'EXAM_DRAFT_CREATED');res.status(201).json({assessment});
 });
 app.patch('/api/exams/:id/draft',(req,res)=>{
  const c=admin(req,res);if(!c)return;const exam=c.db.assessments.find(a=>a.id===req.params.id&&a.examKind&&a.institutionId===c.user.institutionId);
  if(!exam||exam.examState!=='draft')return res.status(409).json({error:'Faqat nashr qilinmagan qoralamani tahrirlash mumkin.'});
  const edit=draftSchema.omit({sourceHash:true,sourceFileName:true,contextImages:true,questions:true}).extend({questions:z.array(question.omit({sourceImages:true}).extend({sourceImages:z.array(z.string().max(180)).max(20)})).min(1).max(60)}).safeParse(req.body);
  if(!edit.success)return res.status(400).json({error:edit.error.issues[0]?.message});const d=edit.data;
  const classes=c.db.classes.filter(cls=>cls.institutionId===c.user.institutionId&&d.classCodes.includes(cls.code));
  if(classes.length!==new Set(d.classCodes).size||new Set(classes.map(cls=>cls.grade)).size!==1||Date.parse(d.availableFrom)>=Date.parse(d.dueDate)||(d.examKind==='CHSB'&&d.examNumber!==1))return res.status(400).json({error:'Sinf, nazorat raqami yoki vaqtni tekshiring.'});
  const allowed=(exam.questionSnapshot||[]).flatMap(q=>q.sourceImages||[]);
  if(d.questions.some(q=>q.sourceImages.some(src=>!allowed.includes(src))||q.fields.some(f=>f.imageIndex>=q.sourceImages.length)))return res.status(400).json({error:'Manba tasviri yoki maydon noto‘g‘ri.'});
  const now=new Date().toISOString();const qs:QuestionItem[]=d.questions.map((q,i)=>({id:exam.id+'-q'+(i+1),institutionId:c.user.institutionId,authorId:c.user.uid,subject:d.subject,grade:classes[0].grade,topicId:'',difficulty:'mixed',type:q.type,points:q.points,prompt:q.prompt,options:q.options,correctAnswer:q.correctAnswer,gradingMode:q.type==='single_choice'?'automatic':'manual_rubric',rubricText:q.rubricText,sourceImages:q.sourceImages,sourcePages:q.sourcePages,answerFields:q.fields,explanation:'',status:'draft',createdAt:now}));
  c.db.questions=c.db.questions.filter(q=>!exam.questionIds.includes(q.id));c.db.questions.push(...qs);
  Object.assign(exam,{title:d.title,subject:d.subject,examKind:d.examKind,examNumber:d.examNumber,quarter:d.quarter,academicYear:d.academicYear,durationMinutes:d.durationMinutes,availableFrom:d.availableFrom,dueDate:d.dueDate,grade:classes[0].grade,classId:classes[0].id,classCode:classes[0].code,assignedClassIds:classes.map(cls=>cls.id),assignedClassCodes:classes.map(cls=>cls.code),questionSnapshot:qs,questionIds:qs.map(q=>q.id),totalPoints:qs.reduce((n,q)=>n+(q.points||0),0),updatedAt:now});
  deps.save(c.env,c.db);deps.notify(c.env,c.user.institutionId,'EXAM_DRAFT_UPDATED');res.json({assessment:exam});
 });
 app.delete('/api/exams/:id/draft',(req,res)=>{const c=admin(req,res);if(!c)return;const exam=c.db.assessments.find(a=>a.id===req.params.id&&a.examKind&&a.institutionId===c.user.institutionId);if(!exam||exam.examState!=='draft')return res.status(409).json({error:'Faqat qoralamani o‘chirish mumkin.'});c.db.assessments=c.db.assessments.filter(a=>a.id!==exam.id);c.db.questions=c.db.questions.filter(q=>!exam.questionIds.includes(q.id));deps.save(c.env,c.db);deps.notify(c.env,c.user.institutionId,'EXAM_DRAFT_DELETED');res.json({ok:true});});
 app.get('/api/exams/:id/media/:hash',async(req,res)=>{
  const c=deps.authenticate(req);if(!c)return res.status(401).json({error:'Hisobga kiring.'});const exam=c.db.assessments.find(a=>a.id===req.params.id&&a.institutionId===c.user.institutionId&&a.examKind);
  if(!exam||!(/^[a-f0-9]{64}$/.test(req.params.hash))||(!['admin','platform_owner'].includes(c.user.role)&&!(exam.status==='published'&&canTakeExam(c.user,exam))))return res.status(403).json({error:'Rasmga ruxsat yo‘q.'});
  const path='/api/exams/'+exam.id+'/media/'+req.params.hash;
  if(![...(exam.contextImages||[]),...(exam.questionSnapshot||[]).flatMap(q=>q.sourceImages||[])].includes(path))return res.status(404).json({error:'Rasm topilmadi.'});
  try{const image=await readExamImage(req.params.hash);if(!image||image.institutionId!==c.user.institutionId)return res.status(404).end();res.setHeader('Cache-Control','private, max-age=300');res.type(image.mime).send(Buffer.from(image.data,'base64'));}catch{res.status(503).json({error:'Rasm yuklanmadi.'});}
 });
 app.get('/api/exams/:id/monitor',(req,res)=>{const c=admin(req,res);if(!c)return;const exam=c.db.assessments.find(a=>a.id===req.params.id&&a.examKind&&a.institutionId===c.user.institutionId);if(!exam)return res.status(404).json({error:'Nazorat topilmadi.'});const sessions=(c.db.examSessions||[]).filter(s=>s.assessmentId===exam.id&&s.institutionId===c.user.institutionId).map(s=>({id:s.id,studentName:c.db.users?.find(u=>u.uid===s.studentId)?.displayName||s.studentId,startedAt:s.startedAt,deadline:examDeadline(exam,s),revision:s.revision,submitted:!!s.submittedAttemptId,events:s.events}));res.json({sessions,serverNow:Date.now()});});
 app.post('/api/exams/:id/control',(req,res)=>{
  const c=admin(req,res);if(!c)return;const exam=c.db.assessments.find(a=>a.id===req.params.id&&a.institutionId===c.user.institutionId&&a.examKind);if(!exam)return res.status(404).json({error:'Nazorat ishi topilmadi.'});const action=req.body.action;const now=new Date().toISOString();
  if(action==='schedule'||action==='start'){
   if(!['draft','scheduled','closed'].includes(exam.examState||''))return res.status(409).json({error:'Joriy holatda bu amal mumkin emas.'});
   const errors=validateExamForPublish(exam);if(errors.length||req.body.reviewed!==true)return res.status(400).json({error:errors.join(' ')||'Savollar ko‘rib chiqilganini tasdiqlang.'});
   if(Date.parse(exam.dueDate)<=Date.now())return res.status(400).json({error:'Imtihon muddati o‘tgan. Yangi qoralama yarating.'});
   const duplicate=c.db.assessments.some(a=>a.id!==exam.id&&a.institutionId===exam.institutionId&&a.examKind===exam.examKind&&a.examNumber===exam.examNumber&&a.quarter===exam.quarter&&a.subject===exam.subject&&a.academicYear===exam.academicYear&&a.status==='published'&&a.assignedClassCodes?.some(code=>exam.assignedClassCodes?.includes(code)));
   if(duplicate)return res.status(409).json({error:'Shu chorak, fan va sinf uchun bu nazorat allaqachon nashr qilingan.'});
   exam.status='published';exam.examState=action==='start'?'open':'scheduled';if(action==='start')exam.availableFrom=now;exam.reviewedAt=now;
  }else if(action==='pause'&&['open','scheduled'].includes(exam.examState||'')){exam.examState='paused';exam.pausedAt=now;}
  else if(action==='resume'&&exam.examState==='paused'){exam.totalPausedMs=(exam.totalPausedMs||0)+Date.now()-Date.parse(exam.pausedAt!);exam.pausedAt=undefined;exam.examState='open';}
  else if(action==='stop'&&exam.examState!=='draft'){exam.examState='closed';exam.closedAt=now;}
  else return res.status(409).json({error:'Holat o‘zgargan. Sahifani yangilang.'});
  exam.updatedAt=now;deps.save(c.env,c.db);deps.notify(c.env,c.user.institutionId,'EXAM_STATE_CHANGED');res.json({assessment:exam});
 });
 app.post('/api/exams/:id/start',(req,res)=>{
  const c=deps.authenticate(req);if(!c)return res.status(401).json({error:'Hisobga kiring.'});const exam=c.db.assessments.find(a=>a.id===req.params.id&&a.examKind);if(!exam||!canTakeExam(c.user,exam))return res.status(403).json({error:'Nazorat ishi sinfingizga biriktirilmagan.'});c.db.examSessions||=[];
  let session=c.db.examSessions.find(s=>s.assessmentId===exam.id&&s.studentId===c.user.uid);
  if(!session){if(!examCanStart(exam))return res.status(409).json({error:'Nazorat ishi boshlanmagan yoki yopilgan.'});if(c.db.attempts.some(a=>a.assessmentId===exam.id&&a.studentId===c.user.uid))return res.status(409).json({error:'Nazorat ishi allaqachon topshirilgan.'});session={id:crypto.randomUUID(),assessmentId:exam.id,studentId:c.user.uid,institutionId:c.user.institutionId,startedAt:new Date().toISOString(),deadlineAt:new Date(Date.now()+exam.durationMinutes*60000).toISOString(),pauseAtStart:exam.totalPausedMs||0,revision:0,answers:{},events:[]};c.db.examSessions.push(session);deps.save(c.env,c.db);}
  res.json({session,serverNow:Date.now(),deadline:examDeadline(exam,session),state:exam.examState});
 });
 app.get('/api/exams/:id/session',(req,res)=>{
  const c=deps.authenticate(req);if(!c)return res.status(401).json({error:'Hisobga kiring.'});const exam=c.db.assessments.find(a=>a.id===req.params.id&&a.examKind);const session=c.db.examSessions?.find(s=>s.assessmentId===req.params.id&&s.studentId===c.user.uid);if(!exam||!session||!canTakeExam(c.user,exam))return res.status(404).json({error:'Sessiya topilmadi.'});res.json({session,serverNow:Date.now(),deadline:examDeadline(exam,session),state:exam.examState});
 });
 app.put('/api/exams/:id/session',(req,res)=>{
  const c=deps.authenticate(req);if(!c)return res.status(401).json({error:'Hisobga kiring.'});const exam=c.db.assessments.find(a=>a.id===req.params.id&&a.examKind);const session=c.db.examSessions?.find(s=>s.assessmentId===req.params.id&&s.studentId===c.user.uid);if(!exam||!session||!canTakeExam(c.user,exam))return res.status(404).json({error:'Sessiya topilmadi.'});
  if(session.submittedAttemptId)return res.status(409).json({error:'Ish topshirilgan.'});
  if(req.body.revision!==session.revision)return res.status(409).json({error:'Javoblar boshqa oynada yangilangan. Sahifani yangilang.'});
  if(exam.examState==='paused'||exam.examState==='closed'||Date.now()>examDeadline(exam,session))return res.status(409).json({error:'Nazorat to‘xtatilgan yoki vaqti tugagan.'});
  const incoming=z.record(z.string(),z.string().max(250000)).safeParse(req.body.answers);if(!incoming.success||Buffer.byteLength(JSON.stringify(incoming.data))>1800000)return res.status(400).json({error:'Javoblar hajmi yoki shakli noto‘g‘ri.'});
  if(Object.keys(incoming.data).some(id=>!exam.questionIds.includes(id)))return res.status(400).json({error:'Noma’lum savol.'});session.answers=incoming.data;session.revision++;
  if(['fullscreen_exit','tab_hidden','fullscreen_unavailable'].includes(req.body.event)&&session.events.length<100)session.events.push({type:req.body.event,at:new Date().toISOString()});
  deps.save(c.env,c.db);res.json({revision:session.revision,savedAt:new Date().toISOString(),deadline:examDeadline(exam,session),serverNow:Date.now()});
 });
}
