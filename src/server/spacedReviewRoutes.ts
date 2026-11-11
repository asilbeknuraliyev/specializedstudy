import crypto from 'node:crypto';
import type {Express} from 'express';
import {z} from 'zod';
import type {PersistentDatabaseState} from './dbEngine';
import {publicQuestion,questionHints,type BankQuestion} from './topicEngine';
import {allowedReviewCatalog,applyReviewAnswer,cachedProgress,catalogSignature,dailyUsage,reviewSummary,schoolDay,selectReviewItems,DAILY_REVIEW_LIMIT,type ReviewSession,type ReviewAnswer} from './spacedReviewEngine';

export function registerSpacedReviewRoutes(app:Express,deps:any){
 const clock=()=>deps.now?new Date(deps.now()):new Date();
 const student=(req:any,res:any)=>{const c=deps.authenticate(req);if(!c||c.user.status!=='active'){res.status(401).json({error:'Hisobga kiring.'});return;}if(c.user.role!=='student'){res.status(403).json({error:'Faqat o‘quvchi.'});return;}return c;};
 const own=(c:any,r:any)=>r.schoolId===c.user.institutionId&&r.studentId===c.user.uid;
 const save=(c:any)=>deps.save(c.env,c.db);
 const historyQuestion=(db:PersistentDatabaseState,schoolId:string,id:string,revision:number)=>db.topicQuestionVersions?.find(v=>v.schoolId===schoolId&&v.questionId===id&&v.revision===revision)?.question;
 const feedback=(c:any,a:ReviewAnswer)=>{
  const q=historyQuestion(c.db,a.schoolId,a.questionId,a.questionRevision);if(!q)return{id:a.id,correct:a.correct,unavailable:true};
  const selected=q.kind==='multiple'?a.answer.split('|'):[a.answer];
  return{id:a.id,queueId:a.queueId,prompt:q.prompt,yourAnswer:a.answer,correct:a.correct,correctAnswer:q.key,explanation:q.explanation,wrongFeedback:a.correct?[]:selected.filter(v=>q.wrongFeedback?.[v]).map(v=>q.wrongFeedback[v]),source:q.source,sourceHref:'/student/lessons?lesson='+encodeURIComponent(a.lessonId),independent:a.independent,assisted:a.assisted,hintsUsed:a.hintsUsed,nextDueAt:a.nextDueAt,mistakeState:a.mistakeState};
 };
 const sessionView=(c:any,s:ReviewSession)=>{
  const now=clock(),catalog=allowedReviewCatalog(c.db,c.user),queueId=s.items[s.index],entry=catalog.get(queueId),stale=s.day!==schoolDay(now);
  const responses=(c.db.spacedReviewAnswers||[]).filter((a:ReviewAnswer)=>own(c,a)&&a.sessionId===s.id);
  return{id:s.id,revision:s.revision,status:stale?'stale':s.status,mode:s.mode,index:s.index,total:s.items.length,subject:s.subject,draft:s.draft,startedAt:s.startedAt,closedAt:s.closedAt,current:s.status==='active'&&!stale&&entry?{queueId,question:publicQuestion(entry.question),lessonTitle:entry.title,subject:entry.subject,hintCount:questionHints(entry.question).length,usedHints:s.hintsUsed[queueId]||0,revealedHints:questionHints(entry.question).slice(0,s.hintsUsed[queueId]||0)}:undefined,unavailable:s.status==='active'&&!stale&&!entry,answers:responses.map((a:ReviewAnswer)=>feedback(c,a)),summary:reviewSummary(c.db,c.user,now,catalog)};
 };
 const session=(req:any,res:any)=>{const c=student(req,res);if(!c)return;const s=c.db.spacedReviewSessions?.find((s:ReviewSession)=>s.id===req.params.id&&own(c,s)&&s.classId===c.user.classId);if(!s){res.status(403).json({error:'Bu seansga ruxsat yo‘q.'});return;}return{...c,s};};
 const active=(c:any,res:any)=>{if(c.s.status!=='active'||c.s.day!==schoolDay(clock())){res.status(409).json({error:'Bu seans tugagan. Bugungi bo‘limni qayta oching.'});return;}const queueId=c.s.items[c.s.index],entry=allowedReviewCatalog(c.db,c.user).get(queueId),item=c.db.spacedReviewQueue?.find((q:any)=>q.id===queueId&&own(c,q));if(!entry||!item){res.status(409).json({error:'Savol yangilangan yoki nashrdan olingan. Seansni yakunlab, yangi savollarni oching.'});return;}return{queueId,entry,item};};
 const summaryRoute=(req:any,res:any)=>{const c=student(req,res);if(c)res.json(reviewSummary(c.db,c.user,clock()));};
 app.get('/api/spaced-review/summary',summaryRoute);
 app.get('/api/mistakes',(req,res)=>{
  const c=student(req,res);if(!c)return;const catalog=allowedReviewCatalog(c.db,c.user),page=Math.max(0,Math.floor(Number(req.query.page)||0)),subject=String(req.query.subject||''),lesson=String(req.query.lesson||''),state=String(req.query.state||'');
  if(state&&!['new','working','mastered'].includes(state))return res.status(400).json({error:'Holat filtrini tekshiring.'});
  const all=(c.db.mistakeRecords||[]).filter((m:any)=>own(c,m)&&catalog.has(m.id));
  const rows=all.filter((m:any)=>(!subject||m.subject===subject)&&(!lesson||m.lessonId===lesson)&&(!state||m.state===state)).sort((a:any,b:any)=>b.lastWrongAt.localeCompare(a.lastWrongAt));
  res.json({records:rows.slice(page*20,page*20+20).map((m:any)=>{const entry=catalog.get(m.id)!,q=c.db.spacedReviewQueue?.find((q:any)=>q.id===m.id&&own(c,q));return{id:m.id,lessonId:m.lessonId,lessonTitle:entry.title,subject:m.subject,state:m.state,lastWrongAnswer:m.lastWrongAnswer,lastWrongAt:m.lastWrongAt,errorType:m.errorType,question:publicQuestion(entry.question),correctDays:q?.correctDays||[],dueAt:q?.dueAt};}),total:rows.length,page,subjects:[...new Set(all.map((m:any)=>m.subject))],lessons:[...new Map(all.map((m:any)=>[m.lessonId,{id:m.lessonId,title:catalog.get(m.id)!.title,subject:m.subject}])).values()],summary:reviewSummary(c.db,c.user,clock(),catalog)});
 });
 app.post('/api/mistakes/:id/feedback',(req,res)=>{
  const c=student(req,res);if(!c)return;const m=c.db.mistakeRecords?.find((m:any)=>m.id===req.params.id&&own(c,m)),entry=allowedReviewCatalog(c.db,c.user).get(req.params.id);
  if(!m||!entry)return res.status(403).json({error:'Bu xato yoki savolga ruxsat yo‘q.'});
  const p=z.object({operationId:z.uuid()}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'So‘rov identifikatorini tekshiring.'});
  const item=c.db.spacedReviewQueue?.find((q:any)=>q.id===m.id&&own(c,q)),day=schoolDay(clock());if(!item)return res.status(409).json({error:'Takrorlash yozuvi yangilangan. Daftarni qayta oching.'});if(item.assistedDay!==day){item.assistedDay=day;save(c);}
  res.json({yourAnswer:m.lastWrongAnswer,correctAnswer:entry.question.key,explanation:entry.question.explanation,source:entry.question.source,sourceHref:'/student/lessons?lesson='+encodeURIComponent(entry.lessonId),notice:'Bugun izoh ko‘rilgan. Bugungi to‘g‘ri qayta yechish mustaqil eslash deb hisoblanmaydi.'});
 });
 app.post('/api/spaced-review/sessions',(req,res)=>{
  const c=student(req,res);if(!c)return;
  const p=z.object({operationId:z.uuid(),mode:z.enum(['review','mistake']).default('review'),subject:z.string().max(100).optional(),limit:z.union([z.literal(5),z.literal(10)]).default(5),mistakeId:z.string().max(600).optional()}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'5 yoki 10 savollik seansni tanlang.'});
  const d=p.data,now=clock(),day=schoolDay(now),signature=JSON.stringify({mode:d.mode,subject:d.subject,limit:d.limit,mistakeId:d.mistakeId});c.db.spacedReviewSessions||=[];
  const previous=c.db.spacedReviewSessions.find((s:ReviewSession)=>own(c,s)&&s.startOperationId===d.operationId);
  if(previous){if(previous.startSignature!==signature)return res.status(409).json({error:'So‘rov identifikatori boshqa seansga tegishli.'});return res.json({session:sessionView(c,previous),resumed:true});}
  const catalog=allowedReviewCatalog(c.db,c.user),usage=dailyUsage(c.db,c.user,now),remaining=Math.max(0,DAILY_REVIEW_LIMIT-usage.answered);
  const ongoing=c.db.spacedReviewSessions.find((s:ReviewSession)=>own(c,s)&&s.status==='active'&&s.day===day&&s.classId===c.user.classId);
  if(ongoing)return res.json({session:sessionView(c,ongoing),resumed:true});
  if(!remaining)return res.json({session:null,message:'Bugun yetarli. Kunlik 20 savol bajarildi. Dam oling; ertaga davom etishingiz mumkin.',summary:reviewSummary(c.db,c.user,now,catalog)});
  const queue=(c.db.spacedReviewQueue||[]).filter((q:any)=>own(c,q));let chosen;
  if(d.mode==='mistake'){
   const m=c.db.mistakeRecords?.find((m:any)=>m.id===d.mistakeId&&own(c,m));const item=m&&queue.find((q:any)=>q.id===m.id&&catalog.has(q.id));
   if(!m||!item)return res.status(403).json({error:'Bu xato savoliga ruxsat yo‘q.'});
   if(usage.seen.includes(item.id))return res.json({session:null,message:'Bu savol bugun ishlangan. Izohini ko‘rishingiz yoki boshqa kuni mustaqil qaytishingiz mumkin.',summary:reviewSummary(c.db,c.user,now,catalog)});
   chosen=[item];
  }else chosen=selectReviewItems(queue,catalog,usage.seen,now,Math.min(d.limit,remaining),d.subject);
  if(!chosen.length)return res.json({session:null,message:'Bugun uchun takrorlash yetarli. Yangi savollar muddatida ko‘rinadi.',summary:reviewSummary(c.db,c.user,now,catalog)});
  for(const old of c.db.spacedReviewSessions.filter((s:ReviewSession)=>own(c,s)&&s.status==='active'))Object.assign(old,{status:'stopped',closedAt:now.toISOString()});
  const s:ReviewSession={id:crypto.randomUUID(),schoolId:c.user.institutionId,studentId:c.user.uid,classId:c.user.classId,day,subject:d.subject,mode:d.mode,items:chosen.map((q:any)=>q.id),index:0,revision:0,status:'active',startedAt:now.toISOString(),startOperationId:d.operationId,startSignature:signature,draft:{answer:''},hintsUsed:{},operations:[]};
  c.db.spacedReviewSessions.push(s);save(c);res.json({session:sessionView(c,s),resumed:false});
 });
 app.get('/api/spaced-review/sessions/:id',(req,res)=>{const c=session(req,res);if(c)res.json({session:sessionView(c,c.s)});});
 app.put('/api/spaced-review/sessions/:id/draft',(req,res)=>{
  const c=session(req,res);if(!c)return;const a=active(c,res);if(!a)return;
  const p=z.object({revision:z.number().int(),operationId:z.uuid(),queueId:z.string().max(600),answer:z.string().max(8000),confidence:z.enum(['low','medium','high']).optional()}).safeParse(req.body);
  if(!p.success||p.data.queueId!==a.queueId)return res.status(400).json({error:'Joriy savol shaklini tekshiring.'});
  if(c.s.operations.includes(p.data.operationId))return res.json({session:sessionView(c,c.s)});
  if(c.s.revision!==p.data.revision)return res.status(409).json({error:'Boshqa oynada yangi qoralama bor. Seansni serverdan tiklang.'});
  c.s.draft={answer:p.data.answer,confidence:p.data.confidence};c.s.revision++;c.s.operations=[...c.s.operations,p.data.operationId].slice(-100);save(c);res.json({session:sessionView(c,c.s)});
 });
 app.post('/api/spaced-review/sessions/:id/hint',(req,res)=>{
  const c=session(req,res);if(!c)return;const a=active(c,res);if(!a)return;
  const p=z.object({operationId:z.uuid(),queueId:z.string().max(600),expectedLevel:z.number().int().min(0).max(3)}).safeParse(req.body);
  if(!p.success||p.data.queueId!==a.queueId)return res.status(400).json({error:'Maslahat so‘rovini tekshiring.'});
  const used=c.s.hintsUsed[a.queueId]||0;
  if(used===p.data.expectedLevel&&!c.s.operations.includes(p.data.operationId)&&used<questionHints(a.entry.question).length){c.s.hintsUsed[a.queueId]=used+1;c.s.operations=[...c.s.operations,p.data.operationId].slice(-100);a.item.assistedDay=schoolDay(clock());c.s.revision++;save(c);}
  res.json({session:sessionView(c,c.s)});
 });
 app.post('/api/spaced-review/sessions/:id/answers',(req,res)=>{
  const c=session(req,res);if(!c)return;
  const p=z.object({operationId:z.uuid(),revision:z.number().int(),queueId:z.string().max(600),answer:z.string().max(8000),confidence:z.enum(['low','medium','high']).optional()}).safeParse(req.body);
  if(!p.success)return res.status(400).json({error:'Javob shaklini tekshiring.'});
  const existing=c.db.spacedReviewAnswers?.find((a:ReviewAnswer)=>own(c,a)&&a.sessionId===c.s.id&&a.operationId===p.data.operationId);
  if(existing)return res.json({session:sessionView(c,c.s),feedback:feedback(c,existing),duplicate:true});
  const a=active(c,res);if(!a)return;
  if(a.queueId!==p.data.queueId||c.s.revision!==p.data.revision)return res.status(409).json({error:'Savol boshqa oynada tekshirilgan. Seansni serverdan tiklang.'});
  const now=clock(),usage=dailyUsage(c.db,c.user,now,true);
  if(usage.answered>=DAILY_REVIEW_LIMIT)return res.status(409).json({error:'Bugun yetarli. Kunlik chegara bajarilgan.'});
  if(usage.seen.includes(a.queueId))return res.status(409).json({error:'Bu savol bugun tekshirilgan. Seansni yakunlang.'});
  const result=applyReviewAnswer(c.db,c.user,a.item,a.entry.question,p.data.answer,c.s,p.data.operationId,p.data.confidence,c.s.hintsUsed[a.queueId]||0,now);
  usage.answered++;usage.seen.push(a.queueId);c.s.index++;c.s.revision++;c.s.draft={answer:''};if(c.s.index>=c.s.items.length){c.s.status='completed';c.s.closedAt=now.toISOString();}
  cachedProgress(c.db,c.user,allowedReviewCatalog(c.db,c.user),a.entry.lessonId,now);save(c);res.json({session:sessionView(c,c.s),feedback:feedback(c,result)});
 });
 app.post('/api/spaced-review/sessions/:id/finish',(req,res)=>{
  const c=session(req,res);if(!c)return;if(!z.object({operationId:z.uuid()}).safeParse(req.body).success)return res.status(400).json({error:'So‘rovni tekshiring.'});
  if(c.s.status==='active'){c.s.status='stopped';c.s.closedAt=clock().toISOString();c.s.revision++;save(c);}res.json({session:sessionView(c,c.s)});
 });
 app.get('/api/student-topic-progress',(req,res)=>{
  const c=student(req,res);if(!c)return;const catalog=allowedReviewCatalog(c.db,c.user),byLesson=new Map<string,Array<[string,any]>>();
  for(const entry of catalog){const list=byLesson.get(entry[1].lessonId)||[];list.push(entry);byLesson.set(entry[1].lessonId,list);}
  const page=Math.max(0,Math.floor(Number(req.query.page)||0)),all=[...byLesson.entries()].map(([lessonId,entries])=>{const cached=c.db.studentTopicProgress?.find((p:any)=>own(c,p)&&p.lessonId===lessonId),same=cached?.catalogSignature===catalogSignature(entries.map(([id])=>id));return{lessonId,title:entries[0][1].title,subject:entries[0][1].subject,pool:entries.length,attempted:same?cached.attempted:0,retained:same?cached.retained:0,state:same?cached.state:cached?'in_progress':'not_started',updated:!!cached&&!same,updatedAt:cached?.updatedAt};});
  res.json({topics:all.slice(page*20,page*20+20),total:all.length,page,notice:'Bu shaxsiy mashq ko‘rsatkichi. Rasmiy baho yoki butun mavzu o‘zlashtirilganining isboti emas.',masteryRule:'Kamida 3 savollik joriy bankning 80% ida ikki xil kunda mustaqil to‘g‘ri javob va hal qilinmagan xato yo‘q.'});
 });
 // Old practice clients must not bypass the day limit or independent-recall rule.
 app.get('/api/topic-review',summaryRoute);
 app.post('/api/topic-review/:id',(req,res)=>{if(student(req,res))res.status(410).json({error:'Qayta ishlashni Xatolar daftari yoki Takrorlash seansidan boshlang.'});});
}
