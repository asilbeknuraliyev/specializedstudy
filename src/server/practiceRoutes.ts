import crypto from 'node:crypto';
import {z} from 'zod';
import type {Express} from 'express';
import type {PersistentDatabaseState} from './dbEngine';
import type {UserProfile} from '../types';
type Context={user:UserProfile;db:PersistentDatabaseState;env:'prod'|'test'};
export function registerPracticeRoutes(app:Express,deps:{authenticate:(req:any)=>Context|null;save:(env:'prod'|'test',db:PersistentDatabaseState)=>void}){
 const access=(req:any)=>{
  const c=deps.authenticate(req),lesson=c?.db.lessons.find(l=>l.id===req.params.id);
  if(!c||!lesson||c.user.role!=='student'||c.user.status!=='active'||lesson.institutionId!==c.user.institutionId||lesson.status!=='published'||![lesson.classId,...(lesson.classIds||[])].includes(c.user.classId!)||(lesson.additionalCurriculumAssignment&&lesson.tTrackVisibilityApproved!==true))return null;
  return{...c,lesson};
 };
 app.get('/api/lesson-practice/:id',(req,res)=>{
  const c=access(req);if(!c)return res.status(403).json({error:'Darsga ruxsat yo‘q.'});
  const record=c.db.lessonPracticeResponses?.find(r=>r.studentId===c.user.uid&&r.lessonId===c.lesson.id);
  res.json({savedAnswers:record&&record.status!=='draft'?record.answers:undefined,draftAnswers:record?.status==='draft'?record.answers:undefined,revision:record?.revision||0,title:c.lesson.title,questions:[`«${c.lesson.title}» mavzusidagi asosiy qoida yoki tushunchani o‘z so‘zingiz bilan tushuntiring.`,`Shu mavzuga oid bitta misol keltiring va yechimingizni bosqichma-bosqich izohlang.`],mode:'reflection',notice:'Yozma takrorlash mashqi. Avtomatik baholanmaydi. Qoralama hisobingizga saqlanadi.'});
 });
 const write=(submit:boolean)=>(req:any,res:any)=>{
  const c=access(req);if(!c)return res.status(403).json({error:'Darsga ruxsat yo‘q.'});
  const parsed=z.array(z.string().max(10000)).length(2).safeParse(req.body.answers);
  if(!parsed.success||(submit&&parsed.data.some(a=>a.trim().length<3)))return res.status(400).json({error:'Javoblar shakli yoki uzunligi noto‘g‘ri.'});
  c.db.lessonPracticeResponses||=[];
  let record=c.db.lessonPracticeResponses.find(r=>r.studentId===c.user.uid&&r.lessonId===c.lesson.id);
  if(record&&record.status!=='draft')return res.status(submit?200:409).json(submit?{id:record.id,status:'received'}:{error:'Ish allaqachon topshirilgan.'});
  if((req.body.revision??0)!==(record?.revision||0))return res.status(409).json({error:'Qoralama boshqa oynada yangilangan. Mashqni qayta oching.'});
  if(!record){record={id:crypto.randomUUID(),lessonId:c.lesson.id,studentId:c.user.uid,institutionId:c.user.institutionId,answers:[],status:'draft',revision:0};c.db.lessonPracticeResponses.push(record);}
  record.answers=parsed.data;record.revision=(record.revision||0)+1;record.status=submit?'submitted':'draft';record.updatedAt=new Date().toISOString();if(submit)record.submittedAt=record.updatedAt;
  deps.save(c.env,c.db);res.json({id:record.id,status:submit?'received':'draft',revision:record.revision});
 };
 app.put('/api/lesson-practice/:id',write(false));app.post('/api/lesson-practice/:id',write(true));
}
