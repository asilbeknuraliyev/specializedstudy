import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {registerTopicRoutes} from '../../server/topicRoutes';import {learningDemoQuestions,learningDemoTopics} from '../../server/learningDemoContent';import {coalescedRead} from '../../server/coalescedRead';

async function fixture(run:(f:any)=>Promise<void>){
 const admin={uid:'admin',role:'admin',status:'active',institutionId:'s',emailVerified:true,platformAdmin:true},teacher={uid:'teacher',role:'teacher',status:'active',institutionId:'s',assignedClassIds:['c1'],subject:'Matematika'},student={uid:'student',role:'student',status:'active',institutionId:'s',classId:'c1'};
 const people:any={admin,teacher,student,foreign:{...student,uid:'foreign',classId:'c2'},physics:{...teacher,uid:'physics',subject:'Fizika'},otherSchool:{...admin,uid:'other-admin',institutionId:'else'}};
 const db:any={users:Object.values(people),lessons:[{id:'l',classId:'c1',classIds:['c1'],subjectName:'Matematika',institutionId:'s',schoolId:'s',status:'published'},{id:'shared',classId:'c1',classIds:['c1','c2'],subjectName:'Matematika',institutionId:'s',schoolId:'s',status:'published'}],auditLogs:[],topicQuestions:[],topicTests:[],topicSessions:[],topicReviews:[]};
 const app=express();app.use(express.json());registerTopicRoutes(app,{authenticate:(req:any)=>people[String(req.headers.authorization)]?{user:people[String(req.headers.authorization)],db,env:'test'}:null,save:()=>{}});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const call=async(path:string,method='GET',data?:any,who='teacher')=>{const r=await fetch(`http://127.0.0.1:${(server.address() as any).port}/api${path}`,{method,headers:{Authorization:who,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return{status:r.status,data:await r.json()};};
 const questions=[{kind:'single',prompt:'DEMO: 2 + 2 = ?',options:['3','4'],key:'4',explanation:'Ikki va ikki yig‘indisi to‘rt.',wrongFeedback:{'3':'Bu tanlovda bitta birlik hisobga olinmagan.'},hints:['Birliklarni sanang.','Ikkita guruhni birlashtiring.','Yig‘indini tekshiring.'],source:{title:'DEMO mualliflik mashqi'},points:1},{kind:'written',prompt:'DEMO: Yechish yo‘lini tushuntiring.',key:'',explanation:'Ikki guruhning yig‘indisini asoslang.',source:{title:'DEMO mualliflik mashqi'},points:2}];
 const publish=async(lesson='l',extra:any={})=>{
  const q=(await call('/topic-bank/'+lesson+'/questions','POST',{questions})).data.questions;
  assert.equal((await call('/topic-bank/'+lesson+'/approve','POST',{questions:q.map((q:any)=>({id:q.id,revision:q.revision}))})).status,200);
  const body={title:'DEMO mavzu testi',questionIds:q.map((q:any)=>q.id),count:2,durationMinutes:1,maxAttempts:3,passPercent:70,trackExits:true,release:'immediate',shuffle:true,confidenceEnabled:true,publish:true,...extra};
  const t=await call('/topic-bank/'+lesson+'/test','POST',body);assert.equal(t.status,200);return{q,test:t.data.test,body};
 };
 try{await run({call,db,publish,questions});}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
}
test('teacher authoring checks school/class/subject, human approval and immutable versions; retried creates are idempotent',()=>fixture(async({call,db,questions}:any)=>{
 assert.equal((await call('/topic-bank/l','GET',undefined,'student')).status,403);assert.equal((await call('/topic-bank/l','GET',undefined,'physics')).status,403);assert.equal((await call('/topic-bank/l','GET',undefined,'otherSchool')).status,403);assert.equal((await call('/topic-bank/l','GET',undefined,'missing')).status,401);
 const op=crypto.randomUUID(),body={questions,operationId:op};const first=await call('/topic-bank/l/questions','POST',body);assert.equal(first.status,200);const replay=await call('/topic-bank/l/questions','POST',body);assert.equal(replay.data.duplicate,true);assert.equal(db.topicQuestions.length,2);assert.equal(db.topicQuestionVersions.length,2);
 const config={title:'DEMO mavzu testi',questionIds:first.data.questions.map((q:any)=>q.id),count:2,durationMinutes:0,maxAttempts:2,passPercent:70,trackExits:false,release:'immediate',shuffle:false,publish:true,operationId:crypto.randomUUID()};
 assert.equal((await call('/topic-bank/l/test','POST',config)).status,400);
 assert.equal((await call('/topic-bank/l/approve','POST',{questions:first.data.questions.map((q:any)=>({id:q.id,revision:1}))})).status,200);
 const published=await call('/topic-bank/l/test','POST',config);assert.equal(published.status,200);assert.equal((await call('/topic-bank/l/test','POST',config)).data.duplicate,true);assert.equal(db.topicTestVersions.length,1);
 const oldVersion=JSON.stringify(db.topicTestVersions[0]);const q=structuredClone(db.topicQuestions[0]);const edit=await call('/topic-bank/l/questions','POST',{questions:[{...q,key:'3',explanation:'DEMO: yangi tahrir.',revision:1}]});assert.equal(edit.status,200);assert.equal(db.topicQuestions[0].status,'draft');assert.equal(db.topicQuestionVersions[0].question.key,'4');assert.equal(JSON.stringify(db.topicTestVersions[0]),oldVersion);
 const draft=await call('/topic-bank/l/test','POST',{...config,operationId:crypto.randomUUID(),id:published.data.test.id,expectedVersion:1,publish:false});assert.equal(draft.data.test.version,2);assert.equal(db.topicTestVersions[0].test.status,'published');assert.equal(db.topicTestVersions[0].test.snapshot[0].key,'4');
}));
test('confidence, incremental hints, wrong-answer feedback and human written grading are scoped and idempotent',()=>fixture(async({call,db,publish}:any)=>{
 const {q,test}=await publish();const start=await call('/topic-tests/'+test.id+'/start','POST',{},'student');assert.equal(start.status,200);const s=start.data.session,id=s.id;
 const raw=JSON.stringify(s);assert.ok(!raw.includes('key'));assert.ok(!raw.includes('Birliklarni sanang.'));assert.ok(!raw.includes('Bu tanlovda'));assert.equal(s.questions[0].explanation,undefined);
 assert.equal((await call('/topic-tests/'+test.id+'/start','POST',{},'foreign')).status,403);
 assert.equal((await call('/topic-sessions/'+id,'PUT',{revision:0,answers:{[q[0].id]:'3'},flags:[]},'student')).status,400);
 const firstHint={questionId:q[0].id,operationId:crypto.randomUUID(),expectedLevel:0};const hint=await call('/topic-sessions/'+id+'/hint','POST',firstHint,'student');assert.equal(hint.data.session.hintsUsed[q[0].id],1);assert.deepEqual(hint.data.session.revealedHints[q[0].id],['Birliklarni sanang.']);assert.equal((await call('/topic-sessions/'+id+'/hint','POST',firstHint,'student')).data.session.hintsUsed[q[0].id],1);
 const submitBody={operationId:crypto.randomUUID(),revision:1,answers:{[q[0].id]:'3',[q[1].id]:'Ikkita guruhni qo‘shaman.'},confidence:{[q[0].id]:'high',[q[1].id]:'medium'},timeSpentMs:{[q[0].id]:999999},flags:[],submit:true};
 const result=await call('/topic-sessions/'+id,'PUT',submitBody,'student');assert.equal(result.status,200);assert.equal(result.data.session.results.find((r:any)=>r.id===q[0].id).correctAnswer,'4');assert.equal(result.data.session.results[0].key,undefined);assert.equal(result.data.session.results.find((r:any)=>r.id===q[0].id).confidentWrong,true);assert.equal(result.data.session.results.find((r:any)=>r.id===q[0].id).wrongFeedback[0],'Bu tanlovda bitta birlik hisobga olinmagan.');assert.equal(result.data.session.pending,true);assert.equal(result.data.session.score,0);assert.ok(result.data.session.timeSpentMs[q[0].id]<999999);
 await call('/topic-sessions/'+id,'PUT',submitBody,'student');assert.equal(db.mistakeRecords.length,1);assert.equal((await call('/topic-grading','GET',undefined,'student')).status,403);assert.equal((await call('/topic-grading','GET',undefined,'physics')).data.total,0);
 const grading={questionId:q[1].id,revision:result.data.session.revision,earned:1.5,comment:'Asoslash to‘g‘ri, misol bilan tekshirish yetishmaydi.',operationId:crypto.randomUUID()};
 assert.equal((await call('/topic-grading/'+id,'POST',grading,'physics')).status,403);const grade=await call('/topic-grading/'+id,'POST',grading);assert.equal(grade.status,200);assert.equal(grade.data.row.pending,false);assert.equal((await call('/topic-grading/'+id,'POST',grading)).data.duplicate,true);
 const updated=(await call('/topic-sessions/'+id,'GET',undefined,'student')).data.session;assert.equal(updated.score,1.5);assert.equal(updated.pending,false);assert.equal(updated.results.find((r:any)=>r.id===q[1].id).teacherComment,grading.comment);
}));
test('shared lesson tests remain assigned only to the teacher’s own classes',()=>fixture(async({call,publish}:any)=>{
 const {test}=await publish('shared');assert.deepEqual(test.classIds,['c1']);assert.equal((await call('/topic-tests/'+test.id+'/start','POST',{},'foreign')).status,403);assert.equal((await call('/topic-tests','GET',undefined,'foreign')).data.tests.length,0);
}));
test('missing explanation blocks approval and missing source requires explicit acknowledgement',()=>fixture(async({call,questions}:any)=>{
 const empty=(await call('/topic-bank/l/questions','POST',{questions:[{...questions[0],explanation:''}]})).data.questions[0];assert.equal((await call('/topic-bank/l/approve','POST',{questions:[{id:empty.id,revision:1}],acknowledgeWarnings:true})).status,400);
 const noSource=(await call('/topic-bank/l/questions','POST',{questions:[{...questions[0],source:undefined}]})).data.questions[0];assert.equal((await call('/topic-bank/l/approve','POST',{questions:[{id:noSource.id,revision:1}]})).status,400);assert.equal((await call('/topic-bank/l/approve','POST',{questions:[{id:noSource.id,revision:1}],acknowledgeWarnings:true})).status,200);
}));
test('DEMO corpus has six topics, three subjects and twelve validated, explained questions per topic',()=>{
 assert.equal(new Set(learningDemoTopics.map(t=>t.subject)).size,3);assert.equal(learningDemoTopics.length,6);
 for(let i=0;i<6;i++){const rows=learningDemoQuestions(i);assert.equal(rows.length,12);assert.ok(rows.every(q=>q.explanation.trim()&&q.source?.title));}
});
test('overlapping cold reads share I/O, isolate mutable snapshots and do not cache a later revision',async()=>{
 let reads=0,release:()=>void=()=>{};const gate=new Promise<void>(r=>release=r);const read=coalescedRead(async()=>{reads++;await gate;return{revision:reads,state:{users:[{id:'a'}]}};});
 const left=read(),right=read();release();const [a,b]=await Promise.all([left,right]);assert.equal(reads,1);a.state.users[0].id='mutated';assert.equal(b.state.users[0].id,'a');const c=await read();assert.equal(c.revision,2);
});
