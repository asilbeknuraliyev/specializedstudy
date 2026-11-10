import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {registerTopicRoutes} from '../../server/topicRoutes';import {mergeState} from '../../server/mergeState';
test('question import validates numbered rows, inserts valid rows once and protects undo after editing',async()=>{
 const db:any={lessons:[{id:'l',institutionId:'school'}],topicQuestions:[],topicTests:[],auditLogs:[]},user={uid:'admin',role:'admin',status:'active',platformAdmin:true,emailVerified:true,institutionId:'school'};
 const app=express();app.use(express.json());registerTopicRoutes(app,{authenticate:()=>({user,db,env:'test'}),save:()=>{}});const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const call=async(path:string,data:any)=>{const r=await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/topic-bank/l${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return{status:r.status,data:await r.json()};};
 try{
  const payload={operationId:crypto.randomUUID(),dryRun:true,questions:[{kind:'single',prompt:'2+2 nechaga teng?',options:['3','4'],key:'4',points:1},{kind:'single',prompt:'Xato savol',options:['1','2'],key:'3',points:1}]};
  const dry=await call('/import',payload);assert.equal(dry.status,200);assert.equal(dry.data.valid,1);assert.equal(dry.data.errors[0].row,3);assert.equal(db.topicQuestions.length,0);
  assert.equal((await call('/import',{...payload,dryRun:false})).status,400);
  assert.equal((await call('/import',{...payload,dryRun:false,validOnly:true})).data.created,1);
  assert.equal((await call('/import',{...payload,dryRun:false,validOnly:true})).data.duplicate,true);assert.equal(db.topicQuestions.length,1);
  db.topicQuestions[0].revision=2;assert.equal((await call('/import/'+payload.operationId+'/undo',{})).status,409);
  db.topicQuestions[0].revision=1;assert.equal((await call('/import/'+payload.operationId+'/undo',{})).data.undone,true);assert.equal(db.topicQuestions.length,0);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
test('parallel independent bank edits merge; duplicate starts for one learner require retry',()=>{
 assert.equal(mergeState({topicQuestions:[]},{topicQuestions:[{id:'a'}]},{topicQuestions:[{id:'b'}]}).topicQuestions.length,2);
 assert.throws(()=>mergeState({topicSessions:[]},{topicSessions:[{id:'a',studentId:'s',testId:'t'}]},{topicSessions:[{id:'b',studentId:'s',testId:'t'}]}),/Concurrent starts/);
 assert.equal(mergeState({topicSessions:[]},{topicSessions:[{id:'a',studentId:'s1',testId:'t'}]},{topicSessions:[{id:'b',studentId:'s2',testId:'t'}]}).topicSessions.length,2);
});
test('different users may log in concurrently while login identities stay unique',()=>{
 const base={users:[{uid:'a',login:'alice'},{uid:'b',login:'bob'}]};
 const merged=mergeState(base,{users:[{...base.users[0],lastLoginAt:'today'},base.users[1]]},{users:[base.users[0],{...base.users[1],lastLoginAt:'today'}]});
 assert.ok(merged.users.every((u:any)=>u.lastLoginAt==='today'));
 assert.throws(()=>mergeState({users:[]},{users:[{uid:'a',login:'same'}]},{users:[{uid:'b',login:'same'}]}),/unique/);
});
