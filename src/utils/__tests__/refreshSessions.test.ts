import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {createEmptyDatabaseState,getDbState,saveDbState,issueSessionToken,verifySessionToken} from '../../server/dbEngine';
import {createCloudStateMiddleware} from '../../server/cloudStateMiddleware';
import {registerRefreshRoutes} from '../../server/refreshSessions';
test('short access sessions renew through private refresh cookies, revoke durably and never acknowledge cookies before commit',async()=>{
 process.env.PERSISTENCE_DRIVER='supabase';process.env.NODE_ENV='production';
 let state=createEmptyDatabaseState(),failed=false,revision=0;state.users=[{uid:'DEMO-learner',institutionId:'DEMO-school',role:'student',status:'active',email:'demo@example.invalid',displayName:'DEMO Learner',createdAt:new Date().toISOString()}];
 const app=express();app.use(createCloudStateMiddleware({read:async()=>({state:structuredClone(state),revision:String(revision)}),write:async(value:any)=>{if(failed)throw Error('synthetic storage outage');state=structuredClone(value);return String(++revision);}}));
 const authenticate=(req:any)=>{const value=verifySessionToken(req.headers.cookie?.split(';').map((v:string)=>v.trim()).find((v:string)=>v.startsWith('__Host-ss_session='))?.split('=')[1]);return value?{user:getDbState('prod').users[0],db:getDbState('prod'),env:'prod'}:null;};
 app.post('/api/login-fixture',(_q,r)=>r.json({user:getDbState('prod').users[0],token:issueSessionToken('DEMO-learner','prod')}));registerRefreshRoutes(app,{database:getDbState,save:saveDbState,issue:issueSessionToken,authenticate});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
 try{
  const login=await fetch(base+'/api/login-fixture',{method:'POST'});assert.equal(login.status,200);assert.equal((await login.json()).token,'cookie');const cookies=login.headers.getSetCookie();assert.equal(cookies.length,2);for(const cookie of cookies){assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);}const access=cookies.find(v=>v.startsWith('__Host-ss_session='))!.split(';')[0],refresh=cookies.find(v=>v.startsWith('__Host-ss_refresh='))!.split(';')[0];
  const payload=JSON.parse(Buffer.from(access.split('=')[1].split('.')[0],'base64url').toString());assert.equal(payload.exp-payload.iat,15*60000);assert.ok(payload.sid);assert.equal(state.refreshSessions?.length,1);assert.ok(!JSON.stringify(state).includes(refresh.split('=')[1]));
  const renewed=await fetch(base+'/api/auth/refresh',{method:'POST',headers:{Cookie:refresh}});assert.equal(renewed.status,200);assert.equal(renewed.headers.getSetCookie().length,1);assert.equal((await renewed.json()).token,'cookie');
  const sessions=await fetch(base+'/api/account/sessions',{headers:{Cookie:access+'; '+refresh}});const body=await sessions.json();assert.equal(body.sessions.length,1);assert.ok(body.sessions[0].current);assert.equal(body.sessions[0].tokenHash,undefined);
  const revoke=await fetch(base+'/api/account/sessions/'+body.sessions[0].id,{method:'DELETE',headers:{Cookie:access+'; '+refresh}});assert.equal(revoke.status,200);assert.equal((await fetch(base+'/api/auth/refresh',{method:'POST',headers:{Cookie:refresh}})).status,401);assert.equal((await fetch(base+'/api/account/sessions',{headers:{Cookie:access}})).status,401);
  failed=true;const outage=await fetch(base+'/api/login-fixture',{method:'POST'});assert.equal(outage.status,503);assert.equal(outage.headers.getSetCookie().length,0);
 }finally{await new Promise<void>(r=>server.close(()=>r()));delete process.env.PERSISTENCE_DRIVER;}
});
