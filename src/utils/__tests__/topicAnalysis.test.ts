import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {calculateItems,firstAnalysisFacts,recordTopicAnalysis,cachedAnalysisItems,inAnalysisRange,cohortId} from '../../server/topicAnalysisEngine';
import {registerTopicRoutes} from '../../server/topicRoutes';
import {analysisExportRows,analysisPrintHtml,safeExportText} from '../topicAnalysisExport';
import {mergeState,MergeConflictError} from '../../server/mergeState';
import {AnalysisCache} from '../../server/analysisCache';
const question=(i=0,extra:any={})=>({id:'q'+i,revision:1,institutionId:'school',schoolId:'school',lessonId:'l',status:'published',approval:{revision:1,by:'t',at:'2026-11-01'},kind:'single',prompt:'DEMO '+i,options:['right','wrong'],key:'right',points:1,explanation:'DEMO explanation',hints:[],...extra}) as any;
function formulaFacts(n=10){return Array.from({length:n},(_,i)=>({id:'s'+i,schoolId:'school',classId:'a',studentId:'u'+i,testId:'t',testVersion:1,lessonId:'l',subject:'Math',title:'DEMO',submittedAt:'2026-11-10T05:00:00Z',autoCorrect:0,autoTotal:10,responses:[{questionId:'q0',revision:1,correct:[1,4,8,9].includes(i),answer:[1,4,8,9].includes(i)?'right':'wrong',assisted:i===1,restScore:i/10}]}));}
test('hand calculation: n=10, p=40%, wrong=60%, ceil(27%)=3, upper 2/3 lower 1/3 difference 1/3',()=>{
 const data=calculateItems(formulaFacts(),[question()],'cohort')[0];assert.equal(data.n,10);assert.equal(data.correctRate,0.4);assert.equal(data.topWrongRate,0.6);assert.equal(data.groups?.size,3);assert.equal(data.groups?.upperCorrect,2/3);assert.equal(data.groups?.lowerCorrect,1/3);assert.equal(data.discrimination,1/3);assert.equal(data.assistedCount,1);
 const facts=formulaFacts();facts.push({...facts[0],id:'later',submittedAt:'2026-11-11T05:00:00Z',responses:[{...facts[0].responses[0],correct:true,answer:'right'}]});assert.equal(firstAnalysisFacts(facts).length,10);assert.equal(calculateItems(facts,[question()],'c')[0].correctRate,0.4);
});
test('fewer than five people hides result counts/rates, ties suppress group ranking, one-question tests have no rest score',()=>{
 const low=calculateItems(formulaFacts(4),[question()],'c')[0];assert.equal(low.correctRate,null);assert.equal(low.correctCount,null);assert.deepEqual(low.options,[]);assert.deepEqual(low.flags,[]);
 const tied=formulaFacts().map(f=>({...f,responses:[{...f.responses[0],restScore:0.5}]}));assert.equal(calculateItems(tied,[question()],'c')[0].discrimination,null);
 tied[0].responses[0].restScore=null as any;assert.match(calculateItems(tied,[question()],'c')[0].groupNotice!,/2 ta/);
});
test('warning thresholds are strict; negative discrimination signals key review and multiple-choice option rates need not sum to 100%',()=>{
 const facts=formulaFacts(20);for(const f of facts){f.responses[0].correct=true;f.responses[0].answer='right';}assert.ok(calculateItems(facts,[question()],'c')[0].flags.includes('very_easy'));
 facts[0].responses[0].correct=false;assert.ok(!calculateItems(facts,[question()],'c')[0].flags.includes('very_easy'));
 facts.forEach((f,i)=>f.responses[0].correct=i<4);assert.ok(!calculateItems(facts,[question()],'c')[0].flags.includes('very_hard'));facts[3].responses[0].correct=false;assert.ok(calculateItems(facts,[question()],'c')[0].flags.includes('very_hard'));
 const reverse=formulaFacts().map((f,i)=>({...f,responses:[{...f.responses[0],correct:i<5,answer:i<5?'right':'wrong'}]}));assert.equal(calculateItems(reverse,[question()],'c')[0].discrimination,-1);assert.ok(calculateItems(reverse,[question()],'c')[0].flags.includes('key_review'));
 const multi=formulaFacts().map(f=>({...f,responses:[{...f.responses[0],answer:'right|wrong|wrong'}]}));const row=calculateItems(multi,[question(0,{kind:'multiple'})],'c')[0];assert.equal(row.options.reduce((n,o)=>n+o.rate,0),2);assert.equal(row.options[1].count,10);
});
function fixture(){
 const admin:any={uid:'admin',role:'admin',institutionId:'school',status:'active',platformAdmin:true,emailVerified:true},teacher:any={uid:'teacher',role:'teacher',institutionId:'school',status:'active',subject:'Math',assignedClassIds:['a']},student:any={uid:'u0',role:'student',status:'active',institutionId:'school',classId:'a',displayName:'DEMO 00'};
 const people:any={admin,teacher,student,otherTeacher:{...teacher,subject:'Physics'},foreign:{...admin,institutionId:'other'},inactive:{...teacher,status:'blocked'}};
 const db:any={institutions:[{id:'school',academicYear:'2026-2027'}],classes:[{id:'a',code:'8a2',institutionId:'school'},{id:'b',code:'7a1',institutionId:'school'},{id:'c',code:'foreign',institutionId:'other'}],lessons:[{id:'l',institutionId:'school',schoolId:'school',classId:'a',classIds:['a','b'],subjectName:'Math',status:'published',title:'DEMO Lesson'}],topicTests:[{id:'t',institutionId:'school',schoolId:'school',lessonId:'l',version:1,status:'published',snapshot:[question(0),question(1),question(2),question(3,{kind:'written'})]}],topicQuestions:[question(0),question(1),question(2)],topicSessions:[],topicAnalysisFacts:[],topicAnalysisCohorts:[],topicQuestionVersions:[],auditLogs:[],users:[admin,teacher,...Array.from({length:12},(_,i)=>({...student,uid:'u'+i,displayName:'DEMO '+String(i).padStart(2,'0')})),{...student,uid:'foreign-student',classId:'b'}]};
 const session=(i:number,extra:any={})=>({id:'s'+i,institutionId:'school',schoolId:'school',classId:'a',lessonId:'l',studentId:'u'+i,testId:'t',version:1,title:'DEMO',subject:'Math',submittedAt:'2026-11-10T05:00:00Z',startedAt:'2026-11-10T04:00:00Z',questions:structuredClone(db.topicTests[0].snapshot),answers:{q0:i<3?'right':'wrong',q1:'right',q2:'wrong',q3:'DEMO written'},confidence:{q0:'high'},hintsUsed:i===1?{q0:1}:{},results:[{id:'q3',pending:true,earned:0}],revision:1,pending:true,maxScore:4,flags:[],events:[],...extra}) as any;
 for(let i=0;i<10;i++){const s=session(i);db.topicSessions.push(s);recordTopicAnalysis(db,s);}const alien=session(99,{id:'foreign-attempt',studentId:'foreign-student',classId:'b'});db.topicSessions.push(alien);recordTopicAnalysis(db,alien);
 return{db,people,session};
}
test('submission facts exclude written answers, ignore repeats, freeze question versions and cache calendar-filtered results',()=>{
 const {db,session}=fixture();assert.equal(db.topicAnalysisFacts.length,11);assert.equal(db.topicAnalysisFacts[0].autoTotal,3);assert.equal(db.topicAnalysisFacts[0].responses.length,3);assert.equal(recordTopicAnalysis(db,session(0)),false);
 db.topicQuestions[0].prompt='New draft';assert.equal(db.topicQuestionVersions.find((q:any)=>q.questionId==='q0').question.prompt,'DEMO 0');
 assert.equal(inAnalysisRange('2026-11-10T20:00:00Z','2026-11-11','2026-11-11'),true);
 const cohort=db.topicAnalysisCohorts[0],facts=db.topicAnalysisFacts.filter((f:any)=>cohortId(f)===cohort.id),qs=db.topicTests[0].snapshot;
 const cached=cachedAnalysisItems(cohort,facts,qs,'2026-11-01','2026-11-30');assert.equal(cached,cohort.items);assert.ok(cachedAnalysisItems(cohort,facts,qs,'2026-11-11','2026-11-11').every(i=>i.n===0));
 const l=structuredClone(db),r=structuredClone(db);l.topicAnalysisCohorts[0].revision++;r.topicAnalysisCohorts[0].observations++;assert.throws(()=>mergeState(db,l,r),MergeConflictError);
});
async function withApi(run:(f:any)=>Promise<void>){const f=fixture();let saves=0;const app=express();app.use(express.json());registerTopicRoutes(app,{authenticate:(req:any)=>f.people[req.headers.authorization]?{user:f.people[req.headers.authorization],db:f.db,env:'test'}:null,save:()=>saves++});const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const call=async(path='',method='GET',body?:any,who='teacher')=>{const r=await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/topic-analysis${path}`,{method,headers:{Authorization:who,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};try{await run({...f,call,saves:()=>saves});}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}}
test('all analysis/export/backfill routes enforce school/class/subject/role and read-only requests do not mutate state',()=>withApi(async({db,call,saves}:any)=>{
 for(const [who,status]of [['missing',401],['inactive',401],['student',403]])for(const path of ['', '/export'])assert.equal((await call(path,'GET',undefined,who)).status,status);
 assert.equal((await call('?classId=b')).status,403);assert.equal((await call('?subject=Physics')).status,403);assert.equal((await call('?lesson=missing')).status,403);assert.equal((await call('?from=2026-02-30')).status,400);assert.equal((await call('?from=2026-11-12&to=2026-11-01')).status,400);assert.equal((await call('?from=2020-01-01&to=2026-11-01')).status,400);
 const before=JSON.stringify(db),r=await call();assert.equal(r.status,200);assert.equal(r.data.rows.length,3);assert.ok(r.data.rows.every((r:any)=>r.n===10&&r.classId==='a'));assert.equal(r.data.overview.pendingWritten,10);assert.equal(r.data.overview.unattempted,2);assert.ok(r.data.recommendations.length);assert.equal(JSON.stringify(db),before);assert.equal(saves(),0);
 const physics=await call('','GET',undefined,'otherTeacher');assert.equal(physics.data.rows.length,0);const foreign=await call('','GET',undefined,'foreign');assert.equal(foreign.data.rows.length,0);
 const exported=await call('/export');assert.ok(exported.data.students.every((s:any)=>s.classId==='a'));assert.equal(exported.data.items[0].question.key,undefined);assert.ok(!JSON.stringify(exported.data).includes('foreign-student'));
 const admin=await call('/export','GET',undefined,'admin');assert.ok(admin.data.items.some((r:any)=>r.classId==='b'&&r.correctRate===null));
}));
test('date filtering uses local dates, first attempt in range; history backfill is scoped, bounded, replay safe, and pending history is not called unattempted',()=>withApi(async({db,call,session}:any)=>{
 const old=session(11,{id:'old',submittedAt:'2026-11-10T20:00:00Z'});db.topicSessions.push(old);
 const pending=await call('?view=students');assert.equal(pending.data.rows.find((s:any)=>s.id==='u11').state,'history_pending');assert.equal(pending.data.overview.unattempted,1);
 assert.equal((await call('/rebuild','POST',{operationId:crypto.randomUUID(),sessionIds:['old','foreign-attempt']})).status,403);assert.ok(!db.topicAnalysisFacts.some((f:any)=>f.id==='old'));
 const body={operationId:crypto.randomUUID(),sessionIds:['old']};assert.equal((await call('/rebuild','POST',body)).data.created,1);assert.equal((await call('/rebuild','POST',body)).data.created,0);assert.equal(db.topicAnalysisFacts.filter((f:any)=>f.id==='old').length,1);
 const justOne=await call('?from=2026-11-11&to=2026-11-11');assert.ok(justOne.data.rows.every((i:any)=>i.n===1&&i.correctRate===null));assert.equal(justOne.data.recommendations.length,0);const justEarlier=await call('?from=2026-11-10&to=2026-11-10');assert.ok(justEarlier.data.rows.every((i:any)=>i.n===10));
}));
test('paging and latest draft revisions preserve the published historical result; students are alphabetic, not ranked',()=>withApi(async({db,call}:any)=>{
 const before=(await call()).data.rows.find((r:any)=>r.questionId==='q0');db.topicQuestions[0].revision=2;db.topicQuestions[0].key='wrong';db.topicQuestions[0].prompt='NEW';const after=(await call()).data.rows.find((r:any)=>r.questionId==='q0');assert.equal(after.latestRevision,2);assert.equal(after.revision,1);assert.equal(after.question.prompt,before.question.prompt);assert.equal(after.correctRate,before.correctRate);
 assert.equal((await call('?page=1')).data.rows.length,0);const pupils=(await call('?view=students')).data.rows;assert.deepEqual(pupils.map((p:any)=>p.displayName),[...pupils].sort((a:any,b:any)=>a.displayName.localeCompare(b.displayName)).map((p:any)=>p.displayName));
}));
test('Excel cells neutralize formulas and PDF HTML escapes untrusted names/prompts',()=>{
 assert.equal(safeExportText(' =HYPERLINK("x")'),'\' =HYPERLINK("x")');assert.equal(safeExportText(-2),-2);
 const data:any={items:[],topics:[],students:[{displayName:'<img src=x onerror=alert(1)>',classCode:'8a2',submissions:1,state:'submitted',openMistakes:0}],filters:{from:'2026-11-01',to:'2026-11-12'},notice:'DEMO',method:'first'};
 const html=analysisPrintHtml(data);assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.equal(analysisExportRows(data)['O‘quvchilar'].length,2);
});
test('private report cache isolates values, expires and bounds entries/bytes; an oversized result is not retained',()=>{
 let time=0;const cache=new AnalysisCache<any>(100,60,2,10,()=>time);cache.set('a',{n:1});cache.get('a').n=99;assert.equal(cache.get('a').n,1);cache.set('b',{n:2});cache.set('c',{n:3});assert.equal(cache.get('a'),undefined);cache.set('large',{value:'x'.repeat(100)});assert.equal(cache.get('large'),undefined);time=11;assert.equal(cache.get('b'),undefined);assert.equal(cache.get('c'),undefined);
});
test('cached report invalidates after written grading, roster changes and current mistake state changes',()=>withApi(async({db,call}:any)=>{
 assert.equal((await call()).data.overview.pendingWritten,10);db.topicSessions[0].results[0].pending=false;db.topicSessions[0].revision++;assert.equal((await call()).data.overview.pendingWritten,9);
 let students=(await call('?view=students')).data.rows;assert.equal(students.find((s:any)=>s.id==='u0').openMistakes,0);db.mistakeRecords=[{id:'m',schoolId:'school',studentId:'u0',lessonId:'l',state:'new'}];students=(await call('?view=students')).data.rows;assert.equal(students.find((s:any)=>s.id==='u0').openMistakes,1);
 db.users.find((u:any)=>u.uid==='u11').classId='b';assert.equal((await call()).data.overview.unattempted,1);
}));
