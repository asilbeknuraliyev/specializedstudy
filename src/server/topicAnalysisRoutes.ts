import crypto from 'node:crypto';
import {AnalysisCache} from './analysisCache';
import type {Express} from 'express';
import {z} from 'zod';
import {publicQuestion,type TopicSession} from './topicEngine';
import {schoolDay,allowedReviewCatalog} from './spacedReviewEngine';
import {analysisQuestion,cachedAnalysisItems,cohortId,firstAnalysisFacts,inAnalysisRange,itemId,recordTopicAnalysis,type AnalysisCohort,type AnalysisFact,type ItemAnalysis} from './topicAnalysisEngine';

const reportCache=new AnalysisCache<any>();
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;});
const query=z.object({subject:z.string().max(200).default(''),classId:z.string().max(200).default(''),lesson:z.string().max(200).default(''),from:date.optional(),to:date.optional(),view:z.enum(['items','topics','students']).default('items'),page:z.coerce.number().int().min(0).max(10000).default(0)});
export function registerTopicAnalysisRoutes(app:Express,deps:any,guards:any){
 const context=(req:any,res:any)=>{
  const c=guards.access(req,res,true);if(!c)return;
  const parsed=query.safeParse(req.query);if(!parsed.success){res.status(400).json({error:'Filtr, sana yoki sahifa qiymatini tekshiring.'});return;}
  const schoolId=c.user.institutionId,classes=c.db.classes.filter((cl:any)=>cl.institutionId===schoolId&&(c.admin||c.user.assignedClassIds?.includes(cl.id))),classIds=new Set(classes.map((cl:any)=>cl.id));
  const lessons=c.db.lessons.filter((l:any)=>l.institutionId===schoolId&&(!l.schoolId||l.schoolId===schoolId)&&(c.admin||(l.subjectName||l.subject)===c.user.subject)&&[l.classId,...(l.classIds||[])].some(id=>classIds.has(id)));
  const subjects=[...new Set<string>(lessons.map((l:any)=>l.subjectName||l.subject||''))].sort(),d=parsed.data;
  if(d.classId&&!classIds.has(d.classId)||d.subject&&!subjects.includes(d.subject)||d.lesson&&!lessons.some((l:any)=>l.id===d.lesson)){res.status(403).json({error:'Bu sinf, fan yoki mavzu tahliliga ruxsat yo‘q.'});return;}
  const today=schoolDay(new Date()),year=Number(String(c.db.institutions.find((i:any)=>i.id===schoolId)?.academicYear||today).slice(0,4)),from=d.from||`${year}-09-01`,to=d.to||today;
  if(from>to||(Date.parse(to)-Date.parse(from))/86400000>366){res.status(400).json({error:'Davr boshlanishi tugashidan oldin bo‘lsin va 366 kundan oshmasin.'});return;}
  const selectedClasses=classes.filter((cl:any)=>!d.classId||cl.id===d.classId),selectedClassIds=new Set(selectedClasses.map((cl:any)=>cl.id));
  const selectedLessons=lessons.filter((l:any)=>(!d.subject||(l.subjectName||l.subject)===d.subject)&&(!d.lesson||l.id===d.lesson)&&[l.classId,...(l.classIds||[])].some(id=>selectedClassIds.has(id))),lessonIds=new Set(selectedLessons.map((l:any)=>l.id));
  const scoped=(r:any)=>r.schoolId===schoolId&&selectedClassIds.has(r.classId)&&lessonIds.has(r.lessonId)&&(c.admin||r.subject===c.user.subject);
  return{...c,schoolId,filters:{...d,from,to},classes,subjects,lessons,selectedClasses,selectedClassIds,selectedLessons,lessonIds,scoped};
 };
 const report=(c:any)=>{
  const fingerprint=crypto.createHash('sha256').update(JSON.stringify([
   process.env.PERSISTENCE_NAMESPACE,c.env,c.schoolId,c.db.institutions.find((i:any)=>i.id===c.schoolId)?.academicYear,c.user.uid,c.admin,c.user.subject,c.user.assignedClassIds,
   [c.filters.subject,c.filters.classId,c.filters.lesson,c.filters.from,c.filters.to],
   c.selectedClasses.map((v:any)=>[v.id,v.code]),c.selectedLessons.map((v:any)=>[v.id,v.title,v.topicTitle,v.subjectName,v.subject,v.classId,v.classIds,v.status,v.academicYear,v.additionalCurriculumAssignment,v.tTrackVisibilityApproved]),
   (c.db.topicAnalysisCohorts||[]).filter(c.scoped).map((v:any)=>[v.id,v.revision]),
   (c.db.topicAnalysisFacts||[]).filter(c.scoped).map((v:any)=>v.id),
   c.db.users.filter((v:any)=>v.institutionId===c.schoolId&&v.role==='student'&&c.selectedClassIds.has(v.classId)).map((v:any)=>[v.uid,v.displayName,v.classId,v.classCode,v.status]),
   (c.db.topicSessions||[]).filter((v:any)=>v.institutionId===c.schoolId&&c.selectedClassIds.has(v.classId)&&c.lessonIds.has(v.lessonId)).map((v:any)=>[v.id,v.revision,v.startedAt,v.submittedAt,v.pending]),
   (c.db.mistakeRecords||[]).filter((v:any)=>v.schoolId===c.schoolId&&c.lessonIds.has(v.lessonId)).map((v:any)=>[v.id,v.studentId,v.state]),
   (c.db.topicTests||[]).filter((v:any)=>v.institutionId===c.schoolId&&c.lessonIds.has(v.lessonId)).map((v:any)=>[v.id,v.version,v.status,v.classIds]),
   (c.db.topicQuestions||[]).filter((v:any)=>v.institutionId===c.schoolId&&c.lessonIds.has(v.lessonId)).map((v:any)=>[v.id,v.revision])
  ])).digest('hex');
  const cached=reportCache.get(fingerprint);if(cached)return{...cached,filters:c.filters};
  const {db,filters:f}=c,allFacts=(db.topicAnalysisFacts||[]).filter(c.scoped),rangeFacts=allFacts.filter((a:AnalysisFact)=>inAnalysisRange(a.submittedAt,f.from,f.to)),first=firstAnalysisFacts(rangeFacts);
  const definitions=new Map<string,{cohort:AnalysisCohort;questions:any[]}>();
  for(const cohort of (db.topicAnalysisCohorts||[]).filter(c.scoped)){
   const facts=allFacts.filter((a:AnalysisFact)=>cohortId(a)===cohort.id),refs=new Map(facts.flatMap((a:AnalysisFact)=>a.responses.map(r=>[r.questionId+':'+r.revision,analysisQuestion(db,c.schoolId,r.questionId,r.revision)] as const)));
   definitions.set(cohort.id,{cohort,questions:[...refs.values()].filter(Boolean)});
  }
  const activeTests=(db.topicTests||[]).filter((t:any)=>t.institutionId===c.schoolId&&(!t.schoolId||t.schoolId===c.schoolId)&&t.status==='published'&&c.lessonIds.has(t.lessonId));
  const rosterClassIds=new Set<string>();
  for(const t of activeTests){
   const l=c.selectedLessons.find((l:any)=>l.id===t.lessonId),ids=t.classIds||[l.classId,...(l.classIds||[])];
   for(const cl of c.selectedClasses.filter((cl:any)=>ids.includes(cl.id))){
    rosterClassIds.add(cl.id);const id=cohortId({schoolId:c.schoolId,classId:cl.id,testId:t.id,testVersion:t.version});
    if(!definitions.has(id))definitions.set(id,{cohort:{id,schoolId:c.schoolId,classId:cl.id,lessonId:t.lessonId,subject:l.subjectName||l.subject||'',testId:t.id,testVersion:t.version,revision:0,updatedAt:'',items:[],observations:0,meanCorrect:0},questions:t.snapshot.filter((q:any)=>q.kind!=='written'&&q.status==='published'&&q.approval?.revision===q.revision&&q.institutionId===c.schoolId&&(!q.schoolId||q.schoolId===c.schoolId))});
   }
  }
  const items=[...definitions.values()].flatMap(({cohort,questions})=>{
   const facts=allFacts.filter((a:AnalysisFact)=>cohortId(a)===cohort.id),stats=cohort.revision?cachedAnalysisItems(cohort,facts,questions,f.from,f.to,String(c.env)):[];
   return questions.map(q=>{
    const stat:ItemAnalysis=stats.find(s=>s.questionId===q.id&&s.revision===q.revision)||{id:itemId(cohort.id,q.id,q.revision),questionId:q.id,revision:q.revision,n:0,correctRate:null,correctCount:null,assistedCount:0,options:[],flags:[],discrimination:null,groupNotice:'Ma’lumot yetarli emas.'};
    const lesson=c.selectedLessons.find((l:any)=>l.id===cohort.lessonId),current=db.topicQuestions?.find((v:any)=>v.id===q.id&&v.institutionId===c.schoolId);
    return{...stat,classId:cohort.classId,classCode:c.selectedClasses.find((cl:any)=>cl.id===cohort.classId)?.code,lessonId:cohort.lessonId,lessonTitle:lesson?.topicTitle||lesson?.title,subject:cohort.subject,testId:cohort.testId,testVersion:cohort.testVersion,question:publicQuestion(q),historical:!activeTests.some((t:any)=>t.id===cohort.testId&&t.version===cohort.testVersion),latestRevision:current?.revision||q.revision};
   });
  }).sort((a,b)=>Number(!!b.flags.length)-Number(!!a.flags.length)||a.subject.localeCompare(b.subject)||String(a.lessonTitle).localeCompare(String(b.lessonTitle))||a.question.id.localeCompare(b.question.id)||b.testVersion-a.testVersion);
  const topics=c.selectedClasses.flatMap((cl:any)=>c.selectedLessons.filter((l:any)=>[l.classId,...(l.classIds||[])].includes(cl.id)).map((lesson:any)=>{
   const attempts=first.filter(a=>a.classId===cl.id&&a.lessonId===lesson.id),participants=new Set(attempts.map(a=>a.studentId)).size,related=items.filter(i=>i.classId===cl.id&&i.lessonId===lesson.id),weakest=related.filter(i=>i.n>=5).sort((a,b)=>a.correctRate!-b.correctRate!).slice(0,3);
   return{id:cl.id+':'+lesson.id,classId:cl.id,classCode:cl.code,lessonId:lesson.id,subject:lesson.subjectName||lesson.subject,lessonTitle:lesson.topicTitle||lesson.title,observations:attempts.length,participants,meanCorrect:participants>=5?attempts.reduce((n,a)=>n+a.autoCorrect/a.autoTotal,0)/attempts.length:null,weakest:weakest.map(i=>({id:i.id,prompt:i.question.prompt,rate:i.correctRate,revision:i.revision,n:i.n})),hasPublishedTest:activeTests.some((t:any)=>t.lessonId===lesson.id&&(!t.classIds||t.classIds.includes(cl.id)))};
  }));
  const roster=db.users.filter((u:any)=>u.role==='student'&&u.status==='active'&&u.institutionId===c.schoolId&&c.selectedClassIds.has(u.classId)&&rosterClassIds.has(u.classId));
  const sessions=(db.topicSessions||[]).filter((s:TopicSession)=>s.institutionId===c.schoolId&&(!s.schoolId||s.schoolId===c.schoolId)&&c.selectedClassIds.has(s.classId)&&c.lessonIds.has(s.lessonId)&&inAnalysisRange(s.submittedAt||s.startedAt,f.from,f.to));
  const students=roster.map((u:any)=>{
   const currentQuestions=allowedReviewCatalog(db,u);
   const attempts=rangeFacts.filter((a:AnalysisFact)=>a.studentId===u.uid&&a.classId===u.classId).sort((a:AnalysisFact,b:AnalysisFact)=>b.submittedAt.localeCompare(a.submittedAt)),latest=attempts.slice(0,3);
   return{id:u.uid,displayName:u.displayName,classId:u.classId,classCode:u.classCode||c.selectedClasses.find((cl:any)=>cl.id===u.classId)?.code,submissions:attempts.length,state:attempts.length?'submitted':sessions.some((s:TopicSession)=>s.studentId===u.uid&&!s.submittedAt)?'in_progress':sessions.some((s:TopicSession)=>s.studentId===u.uid&&s.submittedAt)?'history_pending':'not_started',openMistakes:(db.mistakeRecords||[]).filter((m:any)=>m.schoolId===c.schoolId&&m.studentId===u.uid&&m.state!=='mastered'&&c.lessonIds.has(m.lessonId)&&currentQuestions.has(m.id)).length,supportSuggested:latest.length===3&&latest.every((a:AnalysisFact)=>a.autoCorrect/a.autoTotal<0.5),latestAt:attempts[0]?.submittedAt};
  }).sort((a:any,b:any)=>a.displayName.localeCompare(b.displayName));
  const pendingWritten=sessions.reduce((n:number,s:TopicSession)=>n+(s.results||[]).filter(r=>r.pending&&s.questions.some(q=>q.id===r.id&&q.kind==='written')).length,0);
  const pendingHistory=sessions.filter((s:TopicSession)=>s.submittedAt&&!db.topicAnalysisFacts?.some((a:AnalysisFact)=>a.id===s.id)&&s.questions.some(q=>q.kind!=='written'&&q.status==='published'&&q.institutionId===c.schoolId&&(!q.schoolId||q.schoolId===c.schoolId)&&q.approval?.revision===q.revision));
  const recommendations=items.filter(i=>i.n>=5&&i.correctRate!<0.6).sort((a,b)=>a.correctRate!-b.correctRate!).slice(0,3).map(i=>({id:i.id,title:i.lessonTitle,text:`${i.classCode?.toUpperCase()} sinfida hisobga olingan ${i.n} nafar o‘quvchining ${Math.round((1-i.correctRate!)*100)}% i ushbu savolda xato qildi. ${i.topWrong?'Ko‘p tanlangan noto‘g‘ri variant: '+i.topWrong+'. ':''}Keyingi darsda qisqa qayta tushuntirish tavsiya etiladi.`,prompt:i.question.prompt}));
  const weakest=topics.filter((t:any)=>t.meanCorrect!==null).sort((a:any,b:any)=>a.meanCorrect-b.meanCorrect)[0];
  const result={items,topics,students,filters:f,options:{classes:c.classes.map((cl:any)=>({id:cl.id,code:cl.code})),subjects:c.subjects,lessons:c.lessons.map((l:any)=>({id:l.id,title:l.topicTitle||l.title,subject:l.subjectName||l.subject,classIds:[l.classId,...(l.classIds||[])]}))},overview:{pendingWritten,reviewItems:items.filter(i=>i.flags.length>0).length,unattempted:students.filter((s:any)=>['not_started','in_progress'].includes(s.state)).length,weakestTopic:weakest?{title:weakest.lessonTitle,rate:weakest.meanCorrect,classCode:weakest.classCode}:null},recommendations,history:{pending:pendingHistory.length,sessionIds:pendingHistory.slice(0,20).map((s:TopicSession)=>s.id)},notice:'Bu mashq tahlili, rasmiy baho yoki sabab-natija isboti emas. 5 nafardan kam o‘quvchida foizli xulosa berilmaydi.',method:'Har sinf/test versiyasida tanlangan davrdagi birinchi topshiriq. Avtomatik savollar; maslahat ishlatilgan javoblar ham hisobga kiradi. Shaxsiy ro‘yxat alifbo bo‘yicha, xatolar soni esa hozirgi holat bo‘yicha.'};
  reportCache.set(fingerprint,result);return result;
 };
 app.get('/api/topic-analysis',(req,res)=>{const c=context(req,res);if(!c)return;const data=report(c),rows=data[c.filters.view as 'items'|'topics'|'students'] as any[];const {items,topics,students,...meta}=data;res.setHeader('Cache-Control','no-store');res.json({...meta,rows:rows.slice(c.filters.page*20,c.filters.page*20+20),total:rows.length});});
 app.get('/api/topic-analysis/export',(req,res)=>{const c=context(req,res);if(!c)return;const data=report(c);if(Math.max(data.items.length,data.topics.length,data.students.length)>1000)return res.status(413).json({error:'Eksport uchun sinf, mavzu yoki davrni toraytiring: har bo‘limda 1000 qatorgacha.'});res.setHeader('Cache-Control','no-store');res.json(data);});
 app.post('/api/topic-analysis/rebuild',(req,res)=>{
  const c=context(req,res);if(!c)return;const p=z.object({operationId:z.uuid(),sessionIds:z.array(z.string().min(1).max(200)).min(1).max(20)}).safeParse(req.body);if(!p.success)return res.status(400).json({error:'Bir martada 20 tagacha aniq ishni tanlang.'});
  const rows=p.data.sessionIds.map(id=>c.db.topicSessions?.find((s:TopicSession)=>s.id===id&&s.institutionId===c.schoolId&&(!s.schoolId||s.schoolId===c.schoolId)&&c.selectedClassIds.has(s.classId)&&c.lessonIds.has(s.lessonId)&&s.submittedAt&&inAnalysisRange(s.submittedAt,c.filters.from,c.filters.to)));
  if(rows.some(r=>!r))return res.status(403).json({error:'Bir yoki bir nechta ishga ruxsat yo‘q.'});
  let created=0;for(const s of rows)if(recordTopicAnalysis(c.db,s!))created++;
  if(created){guards.audit(c,'Mavjud mavzu ishlari tahlilga ulandi',String(created));deps.save(c.env,c.db);}res.json({created,duplicate:created===0});
 });
}
