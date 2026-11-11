import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {registerSpacedReviewRoutes} from '../../server/spacedReviewRoutes';
import {allowedReviewCatalog,applyReviewAnswer,cachedProgress,dailyUsage,nextReviewDate,recordTopicLearning,reviewSummary,schoolDay,selectReviewItems} from '../../server/spacedReviewEngine';
import {mergeState,MergeConflictError} from '../../server/mergeState';

function fixture(count=24){
 const student:any={uid:'student',institutionId:'school',classId:'8a2',role:'student',status:'active'};
 const questions:any[]=Array.from({length:count},(_,i)=>({id:'q'+i,revision:1,institutionId:'school',schoolId:'school',lessonId:'l'+i%3,status:'published',approval:{revision:1,by:'teacher'},kind:'single',prompt:'DEMO '+i,options:['wrong','right'],key:'right',explanation:'PRIVATE EXPLANATION '+i,hints:['FIRST HINT','SECOND HINT'],points:1}));
 const db:any={institutions:[{id:'school',academicYear:'2026'}],lessons:Array.from({length:3},(_,i)=>({id:'l'+i,institutionId:'school',classId:'8a2',academicYear:'2026',status:'published',subjectName:['Math','Physics','English'][i],title:'Topic '+i})),topicTests:Array.from({length:3},(_,i)=>({id:'t'+i,institutionId:'school',lessonId:'l'+i,status:'published',classIds:['8a2'],snapshot:questions.filter(q=>q.lessonId==='l'+i)})),spacedReviewSessions:[],spacedReviewAnswers:[],reviewDailyUsage:[]};
 const initial:any={id:'test-attempt',questions,answers:Object.fromEntries(questions.map(q=>[q.id,'wrong'])),confidence:{q0:'high'},submittedAt:'2026-11-09T05:00:00Z'};
 recordTopicLearning(db,student,initial,new Date(initial.submittedAt));
 return{db,student,questions,initial};
}
const session:any={id:'r',hintsUsed:{}};
test('Tashkent calendar boundaries, year and leap-day scheduling are server controlled',()=>{
 assert.equal(schoolDay(new Date('2026-11-10T18:59:59Z')),'2026-11-10');assert.equal(schoolDay(new Date('2026-11-10T19:00:00Z')),'2026-11-11');
 assert.equal(nextReviewDate(new Date('2026-12-31T20:00:00Z'),1),'2027-01-02T09:00:00+05:00');
 assert.equal(nextReviewDate(new Date('2028-02-28T10:00:00Z'),1),'2028-02-29T09:00:00+05:00');
});
test('wrong automatic responses enter notebook once; written questions and unapproved snapshots never do',()=>{
 const {db,student,initial}=fixture();recordTopicLearning(db,student,initial);assert.equal(db.mistakeRecords.length,24);assert.equal(db.spacedReviewQueue.length,24);
 const q={...initial.questions[0],id:'written',kind:'written'};db.topicTests[0].snapshot.push(q);initial.questions.push(q);delete initial.reviewRecordedAt;recordTopicLearning(db,student,initial);assert.equal(db.mistakeRecords.length,24);
 db.topicTests[0].snapshot[0].approval.revision=2;assert.equal(allowedReviewCatalog(db,student).size,23);
});
test('only current approved publication in own school/class/year is eligible; new published revision supersedes old',()=>{
 const {db,student,questions}=fixture();assert.equal(allowedReviewCatalog(db,{...student,classId:'other'}).size,0);assert.equal(allowedReviewCatalog(db,{...student,institutionId:'other'}).size,0);
 db.topicTests[0].snapshot.push({...questions[0],revision:2,approval:{revision:2}});const cat=allowedReviewCatalog(db,student);assert.equal(cat.size,24);assert.ok([...cat.values()].find(e=>e.question.id==='q0')?.question.revision===2);
 db.lessons[0].additionalCurriculumAssignment=true;assert.equal(allowedReviewCatalog(db,student).size,16);db.lessons[0].tTrackVisibilityApproved=true;assert.equal(allowedReviewCatalog(db,student).size,24);
 db.lessons[0].academicYear='2025';assert.equal(allowedReviewCatalog(db,student).size,16);
});
test('due independent recall follows 1/3/7/14/30; two dates master and a later error reopens',()=>{
 const {db,student,questions}=fixture(3),q=db.spacedReviewQueue.find((q:any)=>q.questionId==='q0');let now=new Date('2026-11-10T05:00:00Z');
 for(const [i,days]of [3,7,14,30,30].entries()){
  const a=applyReviewAnswer(db,student,q,questions[0],'right',{...session,id:'s'+i},crypto.randomUUID(),'high',0,now);assert.equal(a.independent,true);assert.equal(a.nextDueAt,nextReviewDate(now,days));assert.equal(q.correctDays.length,Math.min(2,i+1));if(i>=1)assert.equal(a.mistakeState,'mastered');now=new Date(q.dueAt);
 }
 const wrong=applyReviewAnswer(db,student,q,questions[0],'wrong',session,crypto.randomUUID(),'high',0,now);assert.equal(wrong.mistakeState,'working');assert.equal(q.level,0);assert.deepEqual(q.correctDays,[]);assert.equal(q.dueAt,nextReviewDate(now,1));assert.equal(q.highConfidenceError,true);
});
test('same-day, hints and solution views do not earn independent credit; early answers do not advance a box',()=>{
 const {db,student,questions}=fixture(3),q=db.spacedReviewQueue[0],day=new Date('2026-11-09T06:00:00Z');
 assert.equal(applyReviewAnswer(db,student,q,questions[0],'right',session,'a',undefined,0,day).independent,false);assert.equal(q.level,0);assert.deepEqual(q.correctDays,[]);
 const tomorrow=new Date('2026-11-10T05:00:00Z');assert.equal(applyReviewAnswer(db,student,q,questions[0],'right',session,'b',undefined,1,tomorrow).independent,false);
 q.assistedDay='2026-11-11';assert.equal(applyReviewAnswer(db,student,q,questions[0],'right',session,'c',undefined,0,new Date('2026-11-11T05:00:00Z')).independent,false);
 q.dueAt='2026-11-30T09:00:00+05:00';const early=applyReviewAnswer(db,student,q,questions[0],'right',session,'d',undefined,0,new Date('2026-11-12T05:00:00Z'));assert.equal(early.independent,true);assert.equal(q.level,0);assert.equal(q.dueAt,'2026-11-30T09:00:00+05:00');
});
test('selection mixes topics, respects subject/seen/due limits and progress needs 80% of at least three questions',()=>{
 const {db,student}=fixture(15),cat=allowedReviewCatalog(db,student),now=new Date('2026-11-11T05:00:00Z'),rows=selectReviewItems(db.spacedReviewQueue,cat,[],now,10);
 assert.equal(rows.length,10);assert.ok(rows.every((r:any,i:number)=>i===0||r.lessonId!==rows[i-1].lessonId));assert.equal(rows[0].questionId,'q0');
 assert.ok(selectReviewItems(db.spacedReviewQueue,cat,[rows[0].id],now,5,'Math').every(r=>r.subject==='Math'&&r.id!==rows[0].id));
 for(const q of db.spacedReviewQueue.filter((q:any)=>q.lessonId==='l0').slice(0,4)){q.correctDays=['2026-11-10','2026-11-11'];db.mistakeRecords.find((m:any)=>m.id===q.id).state='mastered';}
 cachedProgress(db,student,cat,'l0',now);assert.equal(db.studentTopicProgress[0].state,'in_progress');db.mistakeRecords.find((m:any)=>m.lessonId==='l0'&&m.state!=='mastered').state='mastered';cachedProgress(db,student,cat,'l0',now);assert.equal(db.studentTopicProgress[0].state,'secure');
 const small=fixture(3);for(const q of small.db.spacedReviewQueue){q.correctDays=['a','b'];small.db.mistakeRecords.find((m:any)=>m.id===q.id).state='mastered';}cachedProgress(small.db,small.student,allowedReviewCatalog(small.db,small.student),'l0',now);assert.equal(small.db.studentTopicProgress[0].state,'in_progress');
});
async function apiFixture(run:(f:any)=>Promise<void>){
 const f=fixture(30);let now=new Date('2026-11-11T05:00:00Z');const people:any={student:f.student,teacher:{...f.student,uid:'t',role:'teacher'},foreign:{...f.student,uid:'x'},classChanged:{...f.student,classId:'other'},inactive:{...f.student,status:'blocked'}};let saves=0;
 const app=express();app.use(express.json());registerSpacedReviewRoutes(app,{now:()=>now,authenticate:(req:any)=>people[req.headers.authorization]?{db:f.db,user:people[req.headers.authorization],env:'test'}:null,save:()=>saves++});const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const call=async(path:string,method='GET',body?:any,who='student')=>{const r=await fetch(`http://127.0.0.1:${(server.address() as any).port}/api${path}`,{method,headers:{Authorization:who,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
 try{await run({...f,call,setNow:(d:string)=>now=new Date(d),saves:()=>saves});}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
}
test('review routes enforce roles, ownership, draft CAS, idempotence, answer privacy and exact daily cap',()=>apiFixture(async({db,call}:any)=>{
 for(const [who,status]of [['missing',401],['inactive',401],['teacher',403]])assert.equal((await call('/spaced-review/summary','GET',undefined,who)).status,status);
 const before=JSON.stringify(db);await call('/spaced-review/summary');assert.equal(JSON.stringify(db),before,'GET does not write');
 const start={operationId:crypto.randomUUID(),limit:10};let s=(await call('/spaced-review/sessions','POST',start)).data.session;assert.equal((await call('/spaced-review/sessions','POST',start)).data.session.id,s.id);assert.equal((await call('/spaced-review/sessions','POST',{...start,limit:5})).status,409);
 assert.equal(s.current.question.key,undefined);assert.equal(s.current.question.explanation,undefined);assert.ok(!JSON.stringify(s).includes('PRIVATE EXPLANATION'));assert.equal((await call('/spaced-review/sessions/'+s.id,'GET',undefined,'foreign')).status,403);assert.equal((await call('/spaced-review/sessions/'+s.id,'GET',undefined,'classChanged')).status,403);
 const draft={operationId:crypto.randomUUID(),revision:0,queueId:s.current.queueId,answer:'right',confidence:'high'};
 s=(await call('/spaced-review/sessions/'+s.id+'/draft','PUT',draft)).data.session;assert.equal(s.revision,1);assert.equal((await call('/spaced-review/sessions/'+s.id+'/draft','PUT',draft)).data.session.revision,1);assert.equal((await call('/spaced-review/sessions/'+s.id+'/draft','PUT',{...draft,operationId:crypto.randomUUID()})).status,409);assert.equal((await call('/spaced-review/sessions/'+s.id)).data.session.draft.answer,'right');
 for(let i=0;i<20;i++){
  if(s.status!=='active')s=(await call('/spaced-review/sessions','POST',{operationId:crypto.randomUUID(),limit:10})).data.session;
  const body={operationId:crypto.randomUUID(),queueId:s.current.queueId,revision:s.revision,answer:'right',now:'2100-01-01',correct:true};const result=await call('/spaced-review/sessions/'+s.id+'/answers','POST',body);assert.equal(result.status,200);assert.equal(result.data.feedback.correctAnswer,'right');assert.equal(result.data.feedback.independent,true);assert.equal((await call('/spaced-review/sessions/'+s.id+'/answers','POST',body)).data.duplicate,true);s=result.data.session;
 }
 assert.equal(db.spacedReviewAnswers.length,20);assert.equal(db.reviewDailyUsage[0].answered,20);assert.equal(new Set(db.reviewDailyUsage[0].seen).size,20);assert.equal((await call('/spaced-review/sessions','POST',{operationId:crypto.randomUUID(),limit:10})).data.session,null);assert.equal((await call('/spaced-review/summary')).data.today,0);assert.equal((await call('/topic-review/q0','POST',{},'teacher')).status,403);assert.equal((await call('/topic-review/q0','POST',{})).status,410);
}));
test('hints replay once, notebook solution makes later recall assisted, stale sessions reject next-day answers',()=>apiFixture(async({db,call,setNow}:any)=>{
 const m=db.mistakeRecords[0];assert.equal((await call('/mistakes/'+encodeURIComponent(m.id)+'/feedback','POST',{operationId:crypto.randomUUID()},'foreign')).status,403);
 await call('/mistakes/'+encodeURIComponent(m.id)+'/feedback','POST',{operationId:crypto.randomUUID()});let s=(await call('/spaced-review/sessions','POST',{operationId:crypto.randomUUID(),mode:'mistake',mistakeId:m.id,limit:5})).data.session;
 const hint={operationId:crypto.randomUUID(),queueId:s.current.queueId,expectedLevel:0};s=(await call('/spaced-review/sessions/'+s.id+'/hint','POST',hint)).data.session;assert.equal(s.current.usedHints,1);assert.equal((await call('/spaced-review/sessions/'+s.id+'/hint','POST',hint)).data.session.current.usedHints,1);
 const done=await call('/spaced-review/sessions/'+s.id+'/answers','POST',{operationId:crypto.randomUUID(),queueId:s.current.queueId,revision:s.revision,answer:'right'});assert.equal(done.data.feedback.assisted,true);assert.equal(done.data.feedback.independent,false);
 s=(await call('/spaced-review/sessions','POST',{operationId:crypto.randomUUID(),limit:5})).data.session;setNow('2026-11-12T05:00:00Z');assert.equal((await call('/spaced-review/sessions/'+s.id)).data.session.status,'stale');assert.equal((await call('/spaced-review/sessions/'+s.id+'/answers','POST',{operationId:crypto.randomUUID(),queueId:s.current.queueId,revision:s.revision,answer:'right'})).status,409);
 assert.equal((await call('/mistakes?state=mastered')).data.total,0);assert.equal((await call('/mistakes')).data.records.length,20);assert.equal((await call('/mistakes?page=1')).data.records.length,10);
 db.topicTests[0].status='archived';assert.equal((await call('/mistakes?subject=Math')).data.total,0);
}));
test('parallel starts, grading, and daily ledger increments conflict instead of dropping a write',()=>{
 const base:any={spacedReviewSessions:[],reviewDailyUsage:[]},left=structuredClone(base),right=structuredClone(base);left.spacedReviewSessions.push({id:'a',schoolId:'s',studentId:'u',status:'active'});right.spacedReviewSessions.push({id:'b',schoolId:'s',studentId:'u',status:'active'});assert.throws(()=>mergeState(base,left,right),MergeConflictError);
 const b={reviewDailyUsage:[{id:'s:u:day',answered:19,seen:['a']}]};assert.throws(()=>mergeState(b,{reviewDailyUsage:[{id:'s:u:day',answered:20,seen:['a','b']}]},{reviewDailyUsage:[{id:'s:u:day',answered:20,seen:['a','c']}]}),MergeConflictError);
 const b2={spacedReviewSessions:[{id:'a',index:0,revision:0}]};assert.throws(()=>mergeState(b2,{spacedReviewSessions:[{id:'a',index:1,revision:1}]},{spacedReviewSessions:[{id:'a',index:0,revision:1}]}),MergeConflictError);
});
