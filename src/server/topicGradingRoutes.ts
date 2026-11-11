import type {Express} from 'express';
import {z} from 'zod';
import {publicQuestion,type TopicSession} from './topicEngine';

export function registerTopicGrading(app:Express,deps:any,guards:any){
 const {access,ownLesson,canAuthor,audit}=guards;
 const allowed=(c:any,s:TopicSession)=>{
  const test=c.db.topicTests?.find((t:any)=>t.id===s.testId&&t.institutionId===c.user.institutionId);
  const student=c.db.users.find((u:any)=>u.uid===s.studentId&&u.institutionId===c.user.institutionId);
  return s.institutionId===c.user.institutionId&&(!s.schoolId||s.schoolId===c.user.institutionId)&&canAuthor(c,ownLesson(c,s.lessonId||test?.lessonId))&&(c.admin||student&&c.user.assignedClassIds?.includes(student.classId));
 };
 const dto=(c:any,s:TopicSession)=>({id:s.id,title:s.title,subject:s.subject,lessonId:s.lessonId,revision:s.revision,submittedAt:s.submittedAt,pending:s.pending,student:c.db.users.filter((u:any)=>u.uid===s.studentId).map((u:any)=>({displayName:u.displayName,classCode:u.classCode}))[0],questions:s.questions.filter(q=>q.kind==='written').map(q=>({...publicQuestion(q),answer:s.answers[q.id]||'',result:s.results?.find(r=>r.id===q.id)}))});
 app.get('/api/topic-grading',(req,res)=>{
  const c=access(req,res,true);if(!c)return;
  const page=Math.max(0,Math.floor(Number(req.query.page)||0));
  const rows=(c.db.topicSessions||[]).filter((s:TopicSession)=>s.submittedAt&&s.pending&&allowed(c,s)&&(!req.query.lesson||s.lessonId===req.query.lesson));
  res.json({rows:rows.slice(page*20,page*20+20).map((s:TopicSession)=>dto(c,s)),total:rows.length,page});
 });
 app.post('/api/topic-grading/:id',(req,res)=>{
  const c=access(req,res,true);if(!c)return;
  const s:TopicSession|undefined=c.db.topicSessions?.find((s:TopicSession)=>s.id===req.params.id);
  if(!s||!allowed(c,s))return res.status(403).json({error:'Bu sinf yoki fan yozma ishiga ruxsat yo‘q.'});
  const p=z.object({questionId:z.string(),earned:z.number().min(0).max(100),comment:z.string().trim().min(3).max(4000),revision:z.number().int(),operationId:z.uuid()}).safeParse(req.body);
  if(!p.success||!s.submittedAt)return res.status(400).json({error:'Ball va asoslangan izoh kiriting.'});
  if(s.operations?.includes(p.data.operationId))return res.json({row:dto(c,s),duplicate:true});
  if(s.revision!==p.data.revision)return res.status(409).json({error:'Yozma ish boshqa oynada tekshirilgan. Ro‘yxatni yangilang.'});
  const q=s.questions.find(q=>q.id===p.data.questionId&&q.kind==='written'),result=s.results?.find(r=>r.id===p.data.questionId);
  if(!q||!result||p.data.earned>q.points)return res.status(400).json({error:'Ball savolning maksimal ballidan oshmasin; faqat yozma javob baholanadi.'});
  Object.assign(result,{earned:p.data.earned,pending:false,teacherComment:p.data.comment,gradedBy:c.user.uid,gradedAt:new Date().toISOString()});
  s.score=s.results!.reduce((n,r)=>n+r.earned,0);s.pending=s.results!.some(r=>r.pending);s.revision++;
  s.operations=[...(s.operations||[]),p.data.operationId].slice(-100);
  audit(c,'Mavzu yozma javobi inson tomonidan tekshirildi',s.id);deps.save(c.env,c.db);res.json({row:dto(c,s)});
 });
}
