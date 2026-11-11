import crypto from 'node:crypto';
import type {Express} from 'express';
import {runtimeNamespace} from './runtimeScope';
import {learningDemoTopics,learningDemoQuestions} from './learningDemoContent';
export type LearningDemo={id:string;schoolId:string;ownerId:string;userIds:string[];lessonIds:string[];createdAt:string};
export function registerLearningDemoRoutes(app:Express,deps:any){
 const access=(req:any,res:any)=>{
  if(!runtimeNamespace().startsWith('_specialized_preview_')){res.status(404).json({error:'Bu DEMO faqat preview uchun.'});return;}
  const c=deps.authenticate(req);if(!c||c.user.status!=='active'){res.status(401).json({error:'Hisobga kiring.'});return;}
  if(!['admin','platform_owner'].includes(c.user.role)||!c.user.platformAdmin||!c.user.emailVerified){res.status(403).json({error:'Faqat administrator.'});return;}
  return c;
 };
 const own=(c:any)=>(c.db.learningDemos||[]).find((d:LearningDemo)=>d.ownerId===c.user.uid&&d.schoolId===c.user.institutionId);
 const summary=(d:LearningDemo)=>({id:d.id,topics:d.lessonIds.length,questions:d.lessonIds.length*12,subjects:3,accounts:d.userIds.length});
 app.get('/api/learning-demo',(req,res)=>{const c=access(req,res);if(!c)return;const d=own(c);res.json({demo:d?summary(d):null});});
 app.post('/api/learning-demo',(req,res)=>{
  const c=access(req,res);if(!c)return;
  if(own(c))return res.status(409).json({error:'DEMO mavjud. Parollarini tiklang yoki avval o‘chiring.'});
  const cls=c.db.classes.find((cl:any)=>cl.code==='8a2'&&cl.institutionId===c.user.institutionId);if(!cls)return res.status(400).json({error:'DEMO uchun 8A2 sinfi kerak.'});
  const id='learning-demo-'+crypto.randomUUID(),now=new Date().toISOString(),schoolId=c.user.institutionId,inst=c.db.institutions.find((i:any)=>i.id===schoolId);
  const subjects=['Matematika','Fizika','Ingliz tili'];
  const otherClass=c.db.classes.find((cl:any)=>cl.code==='7a1'&&cl.institutionId===c.user.institutionId);
  const definitions=[{role:'student',displayName:'DEMO O‘quvchi',classId:cls.id,classCode:cls.code},...subjects.map(subject=>({role:'teacher',displayName:'DEMO Ustoz · '+subject,subject,assignedClassIds:[cls.id]})),...(otherClass?[{role:'student',displayName:'DEMO Boshqa sinf',classId:otherClass.id,classCode:otherClass.code}]:[])];
  const accounts=definitions.map((d:any)=>{
   const uid=id+'-'+crypto.randomUUID(),login=(d.role==='student'?'demo_st_':'demo_tc_')+crypto.randomBytes(5).toString('hex'),password=crypto.randomBytes(18).toString('base64url');
   const user={...d,uid,login,email:login+'@accounts.specialized.invalid',institutionId:schoolId,schoolId,status:'active',mustChangePassword:false,createdAt:now};c.db.users.push(user);c.db.passwordHashes[uid]=deps.hash(password);
   return{uid,login,password,displayName:d.displayName,role:d.role,subject:d.subject};
  });
  c.db.topicQuestions||=[];c.db.topicTests||=[];c.db.topicQuestionVersions||=[];c.db.topicTestVersions||=[];
  const lessonIds=learningDemoTopics.map((topic,n)=>{
   const lessonId=id+'-lesson-'+n;
   c.db.lessons.push({id:lessonId,institutionId:schoolId,schoolId,title:'DEMO · '+topic.title,topicTitle:'DEMO · '+topic.title,subjectName:topic.subject,subject:topic.subject,curriculumArea:topic.subject,classId:cls.id,classIds:[cls.id],classCode:cls.code,classCodes:[cls.code],academicYear:inst.academicYear,quarter:2,orderIndex:n+1,lessonNumber:n+1,status:'published',classwork:topic.reading,homework:'Mavzu testini ishlang va izohni o‘z so‘zingiz bilan ayting.',schoolDeliveredAt:now,createdAt:now,updatedAt:now});
   const questions=learningDemoQuestions(n).map((q:any)=>({...q,id:crypto.randomUUID(),schoolId,institutionId:schoolId,lessonId,revision:1,status:'published',approval:{by:c.user.uid,at:now,revision:1}}));
   c.db.topicQuestions.push(...questions);for(const q of questions)c.db.topicQuestionVersions.push({id:q.id+':1',schoolId,questionId:q.id,revision:1,question:structuredClone(q),createdAt:now});
   const test={id:crypto.randomUUID(),institutionId:schoolId,schoolId,lessonId,title:'DEMO · '+topic.title+' · mavzu testi',status:'published',version:1,questionIds:questions.map((q:any)=>q.id),snapshot:structuredClone(questions),count:12,durationMinutes:0,maxAttempts:5,passPercent:70,trackExits:true,release:'immediate',shuffle:true,confidenceEnabled:true,updatedAt:now,createdBy:c.user.uid};
   c.db.topicTests.push(test);c.db.topicTestVersions.push({id:test.id+':1',schoolId,testId:test.id,version:1,test:structuredClone(test),createdAt:now});
   return lessonId;
  });
  const demo:LearningDemo={id,schoolId,ownerId:c.user.uid,userIds:accounts.map(a=>a.uid),lessonIds,createdAt:now};c.db.learningDemos||=[];c.db.learningDemos.push(demo);deps.save(c.env,c.db);res.status(201).json({demo:summary(demo),accounts});
 });
 app.post('/api/learning-demo/credentials',(req,res)=>{
  const c=access(req,res);if(!c)return;const d=own(c);if(!d)return res.status(404).json({error:'DEMO topilmadi.'});
  const accounts=d.userIds.map((uid:string)=>{const u=c.db.users.find((u:any)=>u.uid===uid),password=crypto.randomBytes(18).toString('base64url');c.db.passwordHashes[uid]=deps.hash(password);deps.revoke(uid,c.env);return{uid,login:u.login,password,displayName:u.displayName,role:u.role,subject:u.subject};});
  deps.save(c.env,c.db);res.json({accounts});
 });
 app.delete('/api/learning-demo',(req,res)=>{
  const c=access(req,res);if(!c)return;const d=own(c);if(!d)return res.json({deleted:true});
  const users=new Set(d.userIds),lessons=new Set(d.lessonIds),questions=new Set(c.db.topicQuestions.filter((q:any)=>lessons.has(q.lessonId)).map((q:any)=>q.id)),tests=new Set(c.db.topicTests.filter((t:any)=>lessons.has(t.lessonId)).map((t:any)=>t.id));
  c.db.users=c.db.users.filter((u:any)=>!users.has(u.uid));for(const uid of d.userIds){delete c.db.passwordHashes[uid];if(c.db.revokedBeforeByUser)delete c.db.revokedBeforeByUser[uid];}
  c.db.lessons=c.db.lessons.filter((l:any)=>!lessons.has(l.id));c.db.topicQuestions=c.db.topicQuestions.filter((q:any)=>!lessons.has(q.lessonId));c.db.topicTests=c.db.topicTests.filter((t:any)=>!lessons.has(t.lessonId));
  c.db.topicQuestionVersions=c.db.topicQuestionVersions.filter((v:any)=>!questions.has(v.questionId)&&!lessons.has(v.question.lessonId));c.db.topicTestVersions=c.db.topicTestVersions.filter((v:any)=>!tests.has(v.testId));
  c.db.topicSessions=(c.db.topicSessions||[]).filter((s:any)=>!users.has(s.studentId)&&!tests.has(s.testId));c.db.topicReviews=(c.db.topicReviews||[]).filter((r:any)=>!users.has(r.studentId));c.db.topicImportBatches=(c.db.topicImportBatches||[]).filter((b:any)=>!lessons.has(b.lessonId));
  for(const name of ['mistakeRecords','spacedReviewQueue','spacedReviewSessions','spacedReviewAnswers','reviewDailyUsage','studentTopicProgress'])c.db[name]=(c.db[name]||[]).filter((r:any)=>!users.has(r.studentId));
  c.db.topicWriteOperations=(c.db.topicWriteOperations||[]).filter((o:any)=>!users.has(o.actorUid)&&!o.refs.some((r:any)=>questions.has(r.id)||tests.has(r.id)));
  c.db.auditLogs=c.db.auditLogs.filter((a:any)=>!users.has(a.actorUid)&&!lessons.has(a.recordId)&&!questions.has(a.recordId)&&!tests.has(a.recordId));
  c.db.learningDemos=c.db.learningDemos.filter((r:any)=>r.id!==d.id);deps.save(c.env,c.db);res.json({deleted:true});
 });
}
