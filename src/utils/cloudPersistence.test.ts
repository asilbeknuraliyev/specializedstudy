import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { encodeState, decodeState, StateConflictError } from '../server/cloudState';
import { createCloudStateMiddleware } from '../server/cloudStateMiddleware';
import { getDbState, saveDbState } from '../server/dbEngine';
import type { PersistentDatabaseState } from '../server/dbEngine';

test('compressed snapshots preserve Uzbek text, large state and validate integrity',()=>{
 const state={title:'O‘quvchi — геометрия',rows:Array.from({length:20000},(_,i)=>({i,text:'Mavzu '+i}))};
 const encoded=encodeState(state);assert.deepEqual(decodeState(encoded.chunks,encoded.digest),state);
 assert.throws(()=>decodeState([{...encoded.chunks[0],data:'eA=='}],encoded.digest),/integrity/);
});

test('API waits for durable commit and returns conflicts/failures without false success',async()=>{
 const original=process.env.PERSISTENCE_DRIVER;process.env.PERSISTENCE_DRIVER='firestore';
 let persisted={counter:0} as unknown as PersistentDatabaseState;let revision='1';let fail=false;
 const app=express();
 app.use(createCloudStateMiddleware({read:async()=>({state:structuredClone(persisted),revision}),write:async(state,expected)=>{await new Promise(r=>setTimeout(r,20));if(fail)throw Error('offline');if(expected!==revision)throw new StateConflictError();persisted=structuredClone(state);revision=String(Number(revision)+1);return revision;}}));
 app.post('/api/change',(_req,res)=>{const state=getDbState();(state as any).counter++;saveDbState('prod',state);res.json({saved:true});});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const port=(server.address() as any).port;
 try {
  const request=()=>fetch(`http://127.0.0.1:${port}/api/change`,{method:'POST'});
  assert.equal((await request()).status,200);assert.equal((persisted as any).counter,1);
  const responses=await Promise.all([request(),request()]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal((persisted as any).counter,2);
  fail=true;const failure=await request();assert.equal(failure.status,503);assert.equal((await failure.json()).saved,undefined);assert.equal((persisted as any).counter,2);
 } finally {await new Promise<void>(r=>server.close(()=>r()));if(original===undefined)delete process.env.PERSISTENCE_DRIVER;else process.env.PERSISTENCE_DRIVER=original;}
});

test('session logout persists across independent request contexts', async()=>{
 const {requestDatabase}=await import('../server/requestDatabase');
 const {issueSessionToken,revokeSessionToken,verifySessionToken}=await import('../server/dbEngine');
 const state={} as PersistentDatabaseState;const token=issueSessionToken('real-session-test','prod');
 requestDatabase.run({state,revision:'1',dirty:false,afterCommit:[]},()=>{assert.ok(verifySessionToken(token));revokeSessionToken(token);assert.equal(verifySessionToken(token),null);});
 requestDatabase.run({state:structuredClone(state),revision:'2',dirty:false,afterCommit:[]},()=>assert.equal(verifySessionToken(token),null));
});
