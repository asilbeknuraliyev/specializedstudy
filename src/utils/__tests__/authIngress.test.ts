import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';import express from 'express';
import {authenticationBucket,clientIpFingerprint} from '../../server/authIngress';
test('production ignores attacker-selected test buckets and forwarded IPs; native failed-login limit cannot be reset by headers',async()=>{
 process.env.NODE_ENV='production';process.env.VERCEL='1';process.env.SESSION_SECRET=crypto.randomBytes(48).toString('hex');
 const first:any={headers:{'x-forwarded-for':'203.0.113.1','x-test-client-id':'a'},socket:{remoteAddress:'127.0.0.1'},body:{login:'DEMO-unknown'}};
 const second:any={...first,headers:{'x-forwarded-for':'203.0.113.2','x-test-client-id':'b'}};
 assert.equal(clientIpFingerprint(first),clientIpFingerprint(second));assert.equal(authenticationBucket(first,'login'),authenticationBucket(second,'login'));
 const {app}=await import('../../../server');const {requestDatabase}=await import('../../server/requestDatabase');const {createEmptyDatabaseState}=await import('../../server/dbEngine');
 const state=createEmptyDatabaseState(),outer=express();outer.use((_q,_r,next)=>requestDatabase.run({state,revision:'fixture',dirty:false,afterCommit:[]},next));outer.use(app);
 const server=outer.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
 try{const statuses:number[]=[];for(let i=0;i<8;i++){const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-Test-Client-Id':'qa-'+i,'X-Forwarded-For':'203.0.113.'+(i+1)},body:JSON.stringify({login:'demo_unknown',password:'Synthetic!123'})});statuses.push(response.status);}assert.deepEqual(statuses.slice(0,5),[401,401,401,401,401]);assert.ok(statuses.slice(5).every(n=>n===429));}
 finally{await new Promise<void>(r=>server.close(()=>r()));}
});
