import crypto from 'node:crypto';
import type {Express} from 'express';
import {z} from 'zod';
import {registerTopicImports} from './topicImportRoutes';
import {registerTopicGrading} from './topicGradingRoutes';
import {bankQuestion,gradeQuestion,publicQuestion,publicSession,shuffle,approvalErrors,publicationWarnings,questionHints,type BankQuestion,type TopicSession} from './topicEngine';

export function registerTopicRoutes(app:Express,deps:any){
 const access=(req:any,res:any,author=false)=>{
  const c=deps.authenticate(req);
  if(!c||c.user.status!=='active'){res.status(401).json({error:'Hisobga kiring.'});return null;}
  const admin=['admin','platform_owner'].includes(c.user.role)&&c.user.platformAdmin&&c.user.emailVerified;
  if(author&&!admin&&c.user.role!=='teacher'){res.status(403).json({error:'Ustoz yoki administrator ruxsati kerak.'});return null;}
  return{...c,admin};
 };
 const sameSchool=(c:any,r:any)=>r.institutionId===c.user.institutionId&&(!r.schoolId||r.schoolId===c.user.institutionId);
 const ownLesson=(c:any,id:string)=>c.db.lessons.find((l:any)=>l.id===id&&l.institutionId===c.user.institutionId&&(!l.schoolId||l.schoolId===c.user.institutionId));
 const canAuthor=(c:any,l:any)=>l&&(c.admin||c.user.role==='teacher'&&l.subjectName===c.user.subject&&[l.classId,...(l.classIds||[])].some(id=>c.user.assignedClassIds?.includes(id)));
 const author=(req:any,res:any)=>{const c=access(req,res,true);if(!c)return;const lesson=ownLesson(c,req.params.lesson);if(!canAuthor(c,lesson)){res.status(403).json({error:'Sinf yoki fanga ruxsat yo‘q.'});return;}return{...c,lesson};};
 const canStudy=(c:any,l:any)=>l&&c.user.role==='student'&&l.status==='published'&&[l.classId,...(l.classIds||[])].includes(c.user.classId)&&(!l.additionalCurriculumAssignment||l.tTrackVisibilityApproved);
 const audit=(c:any,action:string,id:string)=>c.db.auditLogs.push({id:crypto.randomUUID(),institutionId:c.user.institutionId,actorUid:c.user.uid,actorName:c.user.displayName,actorRole:c.user.role,action,target:'Mavzu testi',recordId:id,createdAt:new Date().toISOString()});
 const save=(c:any)=>deps.save(c.env,c.db);
 const replay=(c:any,kind:string,body:any,res:any)=>{
  if(!body.operationId)return false;
  const old=c.db.topicWriteOperations?.find((o:any)=>o.id===body.operationId);if(!old)return false;
  const signature=crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  if(old.schoolId!==c.user.institutionId||old.actorUid!==c.user.uid||old.kind!==kind||old.signature!==signature){res.status(409).json({error:'Bir so‘rov identifikatori boshqa amal uchun ishlatilgan.'});return true;}
  if(kind==='questions')res.json({questions:old.refs.map((ref:any)=>c.db.topicQuestionVersions.find((v:any)=>v.schoolId===c.user.institutionId&&v.questionId===ref.id&&v.revision===ref.version)?.question),duplicate:true});
  else res.json({test:c.db.topicTestVersions.find((v:any)=>v.schoolId===c.user.institutionId&&v.testId===old.refs[0].id&&v.version===old.refs[0].version)?.test,duplicate:true});
  return true;
 };
 const remember=(c:any,kind:string,body:any,refs:any[])=>{if(!body.operationId)return;c.db.topicWriteOperations||=[];c.db.topicWriteOperations.push({id:body.operationId,schoolId:c.user.institutionId,actorUid:c.user.uid,kind,signature:crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex'),refs,createdAt:new Date().toISOString()});};
 const questionVersion=(c:any,q:any)=>{c.db.topicQuestionVersions||=[];if(!c.db.topicQuestionVersions.some((v:any)=>v.questionId===q.id&&v.revision===q.revision))c.db.topicQuestionVersions.push({id:q.id+':'+q.revision,schoolId:c.user.institutionId,questionId:q.id,revision:q.revision,question:structuredClone(q),createdAt:new Date().toISOString()});};
 registerTopicImports(app,deps,{access,ownLesson:(c:any,id:string)=>{const l=ownLesson(c,id);return canAuthor(c,l)?l:undefined;},audit,questionVersion});
 registerTopicGrading(app,deps,{access,ownLesson,canAuthor,audit});

 app.get('/api/topic-bank/:lesson',(req,res)=>{
  const c=author(req,res);if(!c)return;
  const page=Math.max(0,Math.floor(Number(req.query.page)||0));
  const all=(c.db.topicQuestions||[]).filter((q:any)=>sameSchool(c,q)&&q.lessonId===c.lesson.id);
  const tests=(c.db.topicTests||[]).filter((t:any)=>sameSchool(c,t)&&t.lessonId===c.lesson.id);
  res.json({questions:all.slice(page*25,page*25+25),total:all.length,page,tests:tests.slice(-20).reverse(),imports:(c.db.topicImportBatches||[]).filter((b:any)=>sameSchool(c,b)&&b.lessonId===c.lesson.id).slice(-10).reverse(),lesson:{id:c.lesson.id,title:c.lesson.title,subject:c.lesson.subjectName}});
 });
 app.post('/api/topic-bank/:lesson/questions',(req,res)=>{
  const c=author(req,res);if(!c)return;
  const p=z.object({questions:z.array(bankQuestion).min(1).max(100),operationId:z.uuid().optional()}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:p.error.issues[0]?.message});
  if(replay(c,'questions',p.data,res))return;
  const ids=p.data.questions.filter(q=>q.id).map(q=>q.id);if(new Set(ids).size!==ids.length)return res.status(400).json({error:'Bir savol paketda takrorlanmasin.'});
  c.db.topicQuestions||=[];
  for(const q of p.data.questions){const old=q.id&&c.db.topicQuestions.find((x:any)=>x.id===q.id&&sameSchool(c,x)&&x.lessonId===c.lesson.id);if(q.id&&!old)return res.status(404).json({error:'Savol topilmadi.'});if(old&&q.revision!==old.revision)return res.status(409).json({error:'Savol boshqa oynada yangilangan. Saqlanmagan matningiz saqlanadi; bankni yangilang.'});}
  const records=p.data.questions.map(q=>{
   const old=q.id&&c.db.topicQuestions.find((x:any)=>x.id===q.id);if(old)questionVersion(c,old);
   const record={...q,id:q.id||crypto.randomUUID(),institutionId:c.user.institutionId,schoolId:c.user.institutionId,lessonId:c.lesson.id,revision:(old?.revision||0)+1,status:'draft',approval:undefined};
   if(old)Object.assign(old,record);else c.db.topicQuestions.push(record);questionVersion(c,record);return record;
  });remember(c,'questions',p.data,records.map((q:any)=>({id:q.id,version:q.revision})));audit(c,'Savolning yangi versiyasi saqlandi',c.lesson.id);save(c);res.json({questions:records});
 });
 app.post('/api/topic-bank/:lesson/approve',(req,res)=>{
  const c=author(req,res);if(!c)return;
  const p=z.object({questions:z.array(z.object({id:z.string(),revision:z.number().int()})).min(1).max(100),acknowledgeWarnings:z.boolean().default(false)}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Tasdiqlash shaklini tekshiring.'});
  const rows=p.data.questions.map(r=>(c.db.topicQuestions||[]).find((q:any)=>q.id===r.id&&q.lessonId===c.lesson.id&&sameSchool(c,q)&&q.revision===r.revision));
  if(rows.some(q=>!q))return res.status(409).json({error:'Savol versiyasi yangilangan. Bankni yangilang.'});
  const errors=rows.flatMap((q:any)=>approvalErrors(q).map(error=>({id:q.id,error})));
  const warnings=rows.flatMap((q:any)=>publicationWarnings(q).map(error=>({id:q.id,error})));
  if(errors.length||warnings.length&&!p.data.acknowledgeWarnings)return res.status(400).json({error:errors.length?'Majburiy izohlarni to‘ldiring.':'Manbasiz savollarni ko‘rib, ogohlantirishni tasdiqlang.',errors,warnings});
  for(const q of rows){q.status='published';q.approval={by:c.user.uid,at:new Date().toISOString(),revision:q.revision};}
  audit(c,'Savollar inson tomonidan tasdiqlandi',c.lesson.id);save(c);res.json({approved:rows.length,warnings});
 });
 app.post('/api/topic-bank/:lesson/test',(req,res)=>{
  const c=author(req,res);if(!c)return;
  const p=z.object({id:z.string().optional(),expectedVersion:z.number().int().optional(),title:z.string().trim().min(3).max(180),questionIds:z.array(z.string()).min(1).max(100),count:z.number().int().min(1).max(60),durationMinutes:z.number().int().min(0).max(180),maxAttempts:z.number().int().min(1).max(10),passPercent:z.number().min(0).max(100),trackExits:z.boolean(),release:z.enum(['immediate','review']),shuffle:z.boolean(),publish:z.boolean().optional(),status:z.enum(['draft','review','published','archived']).optional(),confidenceEnabled:z.boolean().default(false),operationId:z.uuid().optional()}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Test sozlamalarini tekshiring.'});
  if(replay(c,'test',p.data,res))return;
  const d=p.data,status=d.publish===true?'published':d.publish===false?'draft':d.status||'draft';
  const questions=(c.db.topicQuestions||[]).filter((q:any)=>sameSchool(c,q)&&q.lessonId===c.lesson.id&&d.questionIds.includes(q.id));
  if(questions.length!==new Set(d.questionIds).size||d.count>questions.length)return res.status(400).json({error:'Savollar soni yoki bank tanlovi mos emas.'});
  if(status==='published'&&questions.some((q:any)=>q.status!=='published'||q.approval?.revision!==q.revision||approvalErrors(q).length))return res.status(400).json({error:'Nashrdan oldin har bir savolni izohi bilan ko‘rib, tasdiqlang.'});
  c.db.topicTests||=[];c.db.topicTestVersions||=[];
  const old=d.id&&c.db.topicTests.find((t:any)=>t.id===d.id&&sameSchool(c,t)&&t.lessonId===c.lesson.id);
  if(d.id&&!old)return res.status(404).json({error:'Test topilmadi.'});
  if(old&&!c.admin&&(old.classIds||[c.lesson.classId,...(c.lesson.classIds||[])]).some((id:string)=>!c.user.assignedClassIds?.includes(id)))return res.status(403).json({error:'Boshqa sinfga ham biriktirilgan testni tahrirlash o‘rniga yangi qoralama yarating.'});
  if(old&&old.version!==d.expectedVersion)return res.status(409).json({error:'Testning yangi versiyasi bor. Bankni yangilang.'});
  const stamp=(t:any)=>{if(!c.db.topicTestVersions.some((v:any)=>v.testId===t.id&&v.version===t.version))c.db.topicTestVersions.push({id:t.id+':'+t.version,schoolId:c.user.institutionId,testId:t.id,version:t.version,test:structuredClone(t),createdAt:new Date().toISOString()});};
  if(old)stamp(old);
  const {publish,expectedVersion,operationId,...settings}=d;
  const record={...settings,id:old?.id||crypto.randomUUID(),institutionId:c.user.institutionId,schoolId:c.user.institutionId,lessonId:c.lesson.id,classIds:[...new Set([c.lesson.classId,...(c.lesson.classIds||[])])].filter(id=>c.admin||c.user.assignedClassIds?.includes(id)),status,version:(old?.version||0)+1,snapshot:structuredClone(questions),updatedAt:new Date().toISOString(),createdBy:c.user.uid};
  if(old)Object.assign(old,record);else c.db.topicTests.push(record);stamp(record);remember(c,'test',p.data,[{id:record.id,version:record.version}]);audit(c,'Mavzu testi: '+status,record.id);save(c);res.json({test:record});
 });
 app.get('/api/topic-bank/:lesson/test/:test/versions',(req,res)=>{
  const c=author(req,res);if(!c)return;
  const test=c.db.topicTests?.find((t:any)=>t.id===req.params.test&&t.lessonId===c.lesson.id&&sameSchool(c,t));
  if(!test)return res.status(404).json({error:'Test topilmadi.'});
  const page=Math.max(0,Math.floor(Number(req.query.page)||0));
  res.json({versions:(c.db.topicTestVersions||[]).filter((v:any)=>v.schoolId===c.user.institutionId&&v.testId===test.id).slice().reverse().slice(page*10,page*10+10)});
 });
 app.post('/api/topic-bank/:lesson/preview',(req,res)=>{
  const c=author(req,res);if(!c)return;
  const p=z.object({questionIds:z.array(z.string()).min(1).max(100),answers:z.record(z.string(),z.string().max(8000))}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Sinov ma’lumotlarini tekshiring.'});
  const questions=(c.db.topicQuestions||[]).filter((q:any)=>sameSchool(c,q)&&q.lessonId===c.lesson.id&&p.data.questionIds.includes(q.id));
  res.json({score:questions.reduce((n:number,q:BankQuestion)=>n+gradeQuestion(q,p.data.answers[q.id]||''),0),maxScore:questions.reduce((n:number,q:BankQuestion)=>n+q.points,0),pending:questions.some((q:BankQuestion)=>q.kind==='written'),persisted:false});
 });
 app.get('/api/topic-tests',(req,res)=>{
  const c=access(req,res);if(!c)return;if(c.user.role!=='student')return res.status(403).json({error:'Faqat o‘quvchi.'});
  const page=Math.max(0,Math.floor(Number(req.query.page)||0));
  const tests=(c.db.topicTests||[]).filter((t:any)=>sameSchool(c,t)&&t.status==='published'&&(!t.classIds||t.classIds.includes(c.user.classId))&&canStudy(c,ownLesson(c,t.lessonId)));
  const sessions=(c.db.topicSessions||[]).filter((s:any)=>s.studentId===c.user.uid&&sameSchool(c,s)).slice().reverse();
  res.json({tests:tests.slice(page*20,page*20+20).map(({snapshot,...t}:any)=>t),testTotal:tests.length,sessions:sessions.slice(page*20,page*20+20).map((s:any)=>({id:s.id,testId:s.testId,title:s.title,submittedAt:s.submittedAt,startedAt:s.startedAt,score:s.release==='review'&&s.pending?undefined:s.score,maxScore:s.maxScore,pending:s.pending})),sessionTotal:sessions.length,page});
 });
 const sessionAccess=(req:any,res:any)=>{
  const c=access(req,res);if(!c)return;
  const s=c.db.topicSessions?.find((s:any)=>s.id===req.params.id&&s.studentId===c.user.uid&&sameSchool(c,s));
  const test=s&&c.db.topicTests?.find((t:any)=>t.id===s.testId&&sameSchool(c,t));
  if(!s||!test||!canStudy(c,ownLesson(c,s.lessonId||test.lessonId))){res.status(403).json({error:'Sessiya, sinf yoki mavzuga ruxsat yo‘q.'});return;}
  return{...c,s,test};
 };
 const visible=(c:any)=>publicSession(c.s,(c.s.release||c.test.release)==='immediate'||!c.s.pending);
 const submit=(c:any)=>{
  const s:TopicSession=c.s;if(s.submittedAt)return;
  s.results=s.questions.map(q=>({id:q.id,earned:gradeQuestion(q,s.answers[q.id]||''),points:q.points,explanation:q.explanation,pending:q.kind==='written'}));
  s.score=s.results.reduce((n,r)=>n+r.earned,0);s.pending=s.results.some(r=>r.pending);s.submittedAt=new Date().toISOString();
  c.db.topicReviews||=[];
  for(const q of s.questions)if(q.kind!=='written'&&gradeQuestion(q,s.answers[q.id]||'')<q.points){
   const id=s.studentId+':'+q.id,old=c.db.topicReviews.find((r:any)=>r.id===id);
   const record={id,institutionId:s.institutionId,schoolId:s.institutionId,studentId:s.studentId,question:structuredClone(q),answer:s.answers[q.id]||'',dueAt:new Date().toISOString(),streak:0,status:'due'};
   if(old)Object.assign(old,record);else c.db.topicReviews.push(record);
  }
 };
 app.post('/api/topic-tests/:id/start',(req,res)=>{
  const c=access(req,res);if(!c)return;
  const test=c.db.topicTests?.find((t:any)=>t.id===req.params.id&&sameSchool(c,t)&&t.status==='published');
  if(!test||test.classIds&&!test.classIds.includes(c.user.classId)||!canStudy(c,ownLesson(c,test.lessonId)))return res.status(403).json({error:'Bu sinf mavzusiga ruxsat yo‘q.'});
  c.db.topicSessions||=[];
  const old=c.db.topicSessions.find((s:any)=>s.studentId===c.user.uid&&s.testId===test.id&&!s.submittedAt);
  if(old)return res.json({session:publicSession(old),serverNow:Date.now()});
  if(c.db.topicSessions.filter((s:any)=>s.studentId===c.user.uid&&s.testId===test.id).length>=test.maxAttempts)return res.status(409).json({error:'Urinishlar tugagan.'});
  let questions=structuredClone((test.shuffle?shuffle(test.snapshot):test.snapshot).slice(0,test.count));
  for(const q of questions)if(test.shuffle&&['single','multiple'].includes(q.kind))q.options=shuffle(q.options);
  const now=Date.now(),s:TopicSession={id:crypto.randomUUID(),institutionId:c.user.institutionId,schoolId:c.user.institutionId,studentId:c.user.uid,classId:c.user.classId,testId:test.id,version:test.version,lessonId:test.lessonId,title:test.title,subject:ownLesson(c,test.lessonId)?.subjectName,release:test.release,trackExits:test.trackExits,passPercent:test.passPercent,confidenceEnabled:test.confidenceEnabled,questions,answers:{},flags:[],confidence:{},hintsUsed:{},timeSpentMs:{},operations:[],revision:0,startedAt:new Date(now).toISOString(),deadlineAt:test.durationMinutes?new Date(now+test.durationMinutes*60000).toISOString():undefined,maxScore:questions.reduce((n:number,q:BankQuestion)=>n+q.points,0),pending:false,events:[]};
  c.db.topicSessions.push(s);save(c);res.json({session:publicSession(s),serverNow:now});
 });
 app.get('/api/topic-sessions/:id',(req,res)=>{const c=sessionAccess(req,res);if(!c)return;if(c.s.deadlineAt&&Date.now()>=Date.parse(c.s.deadlineAt)&&!c.s.submittedAt){submit(c);save(c);}res.json({session:visible(c),serverNow:Date.now()});});
 app.put('/api/topic-sessions/:id',(req,res)=>{
  const c=sessionAccess(req,res);if(!c)return;
  const p=z.object({revision:z.number().int().min(0),answers:z.record(z.string(),z.string().max(8000)),flags:z.array(z.string()).max(100),submit:z.boolean().optional(),operationId:z.uuid().optional(),confidence:z.record(z.string(),z.enum(['low','medium','high'])).optional(),timeSpentMs:z.record(z.string(),z.number().int().min(0).max(10800000)).optional(),event:z.object({id:z.uuid(),type:z.literal('tab_exit')}).optional()}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Javob shaklini tekshiring.'});
  const s:TopicSession=c.s,d=p.data;
  if(s.submittedAt||d.operationId&&s.operations?.includes(d.operationId))return res.json({session:visible(c)});
  if(s.deadlineAt&&Date.now()>=Date.parse(s.deadlineAt)){submit(c);save(c);return res.json({session:visible(c)});}
  if(s.revision!==d.revision)return res.status(409).json({error:'Boshqa oynada yangi javob bor. Javobingizni yo‘qotmasdan birlashtirish uchun server holatini oching.'});
  const ids=new Set(s.questions.map(q=>q.id));
  if([...Object.keys(d.answers),...d.flags,...Object.keys(d.confidence||{}),...Object.keys(d.timeSpentMs||{})].some(id=>!ids.has(id)))return res.status(400).json({error:'Begona savol.'});
  s.confidence||={};s.timeSpentMs||={};
  for(const [id,value]of Object.entries(d.confidence||{}))if(!s.answers[id])s.confidence[id]=value;
  if(s.confidenceEnabled&&Object.entries(d.answers).some(([id,a])=>a.trim()&&!s.confidence?.[id]))return res.status(400).json({error:'Javobdan oldin ishonch darajasini tanlang.'});
  const elapsed=Math.max(0,Date.now()-Date.parse(s.startedAt));
  let available=Math.max(0,elapsed-Object.values(s.timeSpentMs).reduce((n,v)=>n+v,0));
  for(const [id,value]of Object.entries(d.timeSpentMs||{})){const old=s.timeSpentMs[id]||0,increment=Math.min(available,Math.max(0,value-old));s.timeSpentMs[id]=old+increment;available-=increment;}
  s.answers=d.answers;s.flags=d.flags;s.revision++;
  if((s.trackExits??c.test.trackExits)&&d.event&&!s.events.some(e=>e.id===d.event!.id))s.events=[...s.events,{...d.event,at:new Date().toISOString()}].slice(-500);
  if(d.operationId)s.operations=[...(s.operations||[]),d.operationId].slice(-100);
  if(d.submit)submit(c);save(c);res.json({session:visible(c)});
 });
 app.post('/api/topic-sessions/:id/hint',(req,res)=>{
  const c=sessionAccess(req,res);if(!c)return;
  const p=z.object({questionId:z.string(),operationId:z.uuid(),expectedLevel:z.number().int().min(0).max(3)}).safeParse(req.body);
  if(!p.success||c.s.submittedAt)return res.status(400).json({error:'Maslahat so‘rovini tekshiring.'});
  if(c.s.deadlineAt&&Date.now()>=Date.parse(c.s.deadlineAt))return res.status(409).json({error:'Test vaqti tugagan.'});
  const q=c.s.questions.find((q:BankQuestion)=>q.id===p.data.questionId);if(!q)return res.status(400).json({error:'Begona savol.'});
  c.s.hintsUsed||={};const current=c.s.hintsUsed[q.id]||0;
  if(current===p.data.expectedLevel&&!c.s.operations?.includes(p.data.operationId)){
   c.s.hintsUsed[q.id]=Math.min(questionHints(q).length,current+1);c.s.operations=[...(c.s.operations||[]),p.data.operationId].slice(-100);c.s.revision++;save(c);
  }
  res.json({session:visible(c),hintPolicy:'Maslahat ballni kamaytirmaydi; undan foydalanish alohida qayd etiladi.'});
 });
 // Existing notebook remains compatible; its new scheduling rules are stage (b).
 app.get('/api/topic-review',(req,res)=>{const c=access(req,res);if(!c)return;if(c.user.role!=='student')return res.status(403).json({error:'Faqat o‘quvchi.'});res.json({records:(c.db.topicReviews||[]).filter((r:any)=>r.studentId===c.user.uid&&r.institutionId===c.user.institutionId).map(({question,...r}:any)=>({...r,question:publicQuestion(question)}))});});
 app.post('/api/topic-review/:id',(req,res)=>{const c=access(req,res);if(!c)return;const r=c.db.topicReviews?.find((r:any)=>r.id===req.params.id&&r.studentId===c.user.uid&&r.institutionId===c.user.institutionId);const p=z.object({answer:z.string().max(8000),operationId:z.uuid()}).safeParse(req.body);if(!r||c.user.role!=='student')return res.status(403).json({error:'Yozuvga ruxsat yo‘q.'});if(!p.success)return res.status(400).json({error:'Javobni tekshiring.'});if(r.lastOperation!==p.data.operationId){const correct=gradeQuestion(r.question,p.data.answer)===r.question.points;if(Date.parse(r.dueAt)<=Date.now()){r.streak=correct?r.streak+1:0;r.status=r.streak>=3?'mastered':'due';r.dueAt=new Date(Date.now()+[1,3,7,14][Math.min(3,Math.max(0,r.streak-1))]*86400000).toISOString();}r.lastOperation=p.data.operationId;r.lastCorrect=correct;r.answer=p.data.answer;save(c);}res.json({correct:r.lastCorrect,explanation:r.question.explanation,dueAt:r.dueAt,status:r.status});});
}
