import crypto from 'node:crypto';
import type {Express} from 'express';
import {z} from 'zod';
import {bankQuestion} from './topicEngine';

// Import is a separate operation: validate every source row before any mutation.
export function registerTopicImports(app:Express,deps:any,guards:any) {
 const {access,ownLesson,audit}=guards;
 app.post('/api/topic-bank/:lesson/import',(req,res)=>{
  const c=access(req,res,true);if(!c)return;
  if(!ownLesson(c,req.params.lesson))return res.status(404).json({error:'Mavzu topilmadi.'});
  const p=z.object({operationId:z.uuid(),questions:z.array(z.unknown()).min(1).max(100),dryRun:z.boolean(),validOnly:z.boolean().default(false)}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Import shaklini tekshiring.'});
  const valid:any[]=[],errors:Array<{row:number;error:string}>=[];
  p.data.questions.forEach((raw,i)=>{
   const parsed=bankQuestion.safeParse(raw);
   if(!parsed.success)errors.push({row:i+2,error:parsed.error.issues.map(e=>e.message).join(' ')});
   else if(parsed.data.id)errors.push({row:i+2,error:'Import faqat yangi savol qo‘shadi. ID ustunini olib tashlang.'});
   else valid.push(parsed.data);
  });
  if(p.data.dryRun)return res.json({dryRun:true,valid:valid.length,errors});
  c.db.topicImportBatches||=[];
  const old=c.db.topicImportBatches.find((b:any)=>b.id===p.data.operationId);
  if(old){if(old.institutionId!==c.user.institutionId||old.schoolId&&old.schoolId!==c.user.institutionId||old.lessonId!==req.params.lesson)return res.status(409).json({error:'Paket identifikatori band.'});return res.json({id:old.id,created:old.questions.length,duplicate:true,undone:old.undone,errors});}
  if(errors.length&&!p.data.validOnly)return res.status(400).json({error:'Xato qatorlarni tuzating yoki to‘g‘ri qismini alohida kiriting.',errors});
  if(!valid.length)return res.status(400).json({error:'Kiritish uchun to‘g‘ri savol yo‘q.',errors});
  c.db.topicQuestions||=[];
  const questions=valid.map(q=>({...q,id:crypto.randomUUID(),institutionId:c.user.institutionId,schoolId:c.user.institutionId,lessonId:req.params.lesson,revision:1,status:'draft'}));
  c.db.topicQuestions.push(...questions);
  for(const q of questions)guards.questionVersion?.(c,q);
  const batch={id:p.data.operationId,institutionId:c.user.institutionId,schoolId:c.user.institutionId,lessonId:req.params.lesson,questions:questions.map(q=>q.id),createdAt:new Date().toISOString(),undone:false};
  c.db.topicImportBatches.push(batch);audit(c,'Savollar paketi import qilindi',batch.id);deps.save(c.env,c.db);
  res.json({id:batch.id,created:questions.length,errors});
 });
 app.post('/api/topic-bank/:lesson/import/:batch/undo',(req,res)=>{
  const c=access(req,res,true);if(!c)return;
  if(!ownLesson(c,req.params.lesson))return res.status(403).json({error:'Bu mavzu importiga ruxsat yo‘q.'});
  const batch=c.db.topicImportBatches?.find((b:any)=>b.id===req.params.batch&&b.institutionId===c.user.institutionId&&b.lessonId===req.params.lesson);
  if(!batch)return res.status(404).json({error:'Paket topilmadi.'});
  if(batch.undone)return res.json({undone:true});
  const ids=new Set(batch.questions);
  if(c.db.topicQuestions.some((q:any)=>ids.has(q.id)&&q.revision!==1)||c.db.topicTests?.some((t:any)=>t.questionIds.some((id:string)=>ids.has(id))))return res.status(409).json({error:'Savollar tahrirlangan yoki testga qo‘shilgan. Qaytarish bekor qilindi.'});
  c.db.topicQuestions=c.db.topicQuestions.filter((q:any)=>!ids.has(q.id));batch.undone=true;
  audit(c,'Savollar importi qaytarildi',batch.id);deps.save(c.env,c.db);res.json({undone:true});
 });
}
