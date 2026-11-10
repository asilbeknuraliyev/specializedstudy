import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';

test('native login uses durable lockout, mandatory change, cookie sessions and revokes on password change/logout/suspension', async()=>{
 process.env.VERCEL='1';process.env.NODE_ENV='production';process.env.SESSION_SECRET=crypto.randomBytes(48).toString('hex');
 const {app}=await import('../../../server');
 const {requestDatabase}=await import('../../server/requestDatabase');
 const {createEmptyDatabaseState,hashPassword}=await import('../../server/dbEngine');
 const db=createEmptyDatabaseState(),institutionId=db.institutions[0].id;
 const cls=db.classes.find(c=>c.code==='8a2')!;
 const users=[{uid:'qa-native',login:'qa_native',email:'qa@accounts.specialized.invalid',displayName:'QA Learner',role:'student',classId:cls.id,classCode:cls.code,mustChangePassword:true,status:'active',institutionId},{uid:'qa-lock',login:'qa_lock',email:'lock@accounts.specialized.invalid',displayName:'QA Lock',role:'student',status:'active',institutionId},{uid:'qa-teacher',email:'qa_teacher@example.invalid',displayName:'QA Teacher',role:'teacher',subject:'Matematika',assignedClassIds:[cls.id],status:'active',institutionId}] as any[];
 db.users.push(...users);for(const u of users)db.passwordHashes[u.uid]=hashPassword('Initial!9pass');
 const outer=express();outer.use((_,__,next)=>requestDatabase.run({state:db,revision:'test',dirty:false,afterCommit:[]},next));outer.use(app);
 const server=outer.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${(server.address() as any).port}`;
 const call=async(path:string,method='GET',body?:any,cookie?:string)=>{const r=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 try{
  for(let i=0;i<5;i++)assert.equal((await call('/auth/login','POST',{login:'qa_lock',password:'bad'})).status,401);
  assert.equal((await call('/auth/login','POST',{login:'qa_lock',password:'Initial!9pass'})).status,429);
  const login=await call('/auth/login','POST',{login:'qa_native',password:'Initial!9pass'});assert.equal(login.status,200);assert.equal(login.data.token,'cookie');assert.ok(login.cookie?.startsWith('__Host-ss_session='));
  assert.equal((await call('/topic-tests','GET',undefined,login.cookie)).status,403);
  const change=await call('/account/password','POST',{oldPassword:'Initial!9pass',password:'Changed!password9'},login.cookie);assert.equal(change.status,200);assert.equal(change.data.user.mustChangePassword,false);
  assert.equal((await call('/state','GET',undefined,login.cookie)).status,401);
  assert.equal((await call('/accounts','GET',undefined,change.cookie)).status,403);
  assert.equal((await call('/state','GET',undefined,change.cookie)).data.user.classCode,'8a2');
  await call('/auth/logout','POST',{},change.cookie);assert.equal((await call('/state','GET',undefined,change.cookie)).status,401);
  const teacher=await call('/auth/login','POST',{email:'qa_teacher@example.invalid',password:'Initial!9pass'});assert.equal(teacher.status,200);assert.equal(teacher.data.user.role,'teacher');
  assert.equal((await call('/accounts','GET',undefined,teacher.cookie)).status,403);
  db.users.find(u=>u.uid==='qa-teacher')!.status='suspended';assert.equal((await call('/state','GET',undefined,teacher.cookie)).status,401);
  assert.ok(db.auditLogs.some(l=>l.action.includes('Muvaffaqiyatsiz')));assert.ok(!JSON.stringify(db).includes('Changed!password9'));
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
