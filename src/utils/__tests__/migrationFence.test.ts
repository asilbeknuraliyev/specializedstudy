import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {createCloudStateMiddleware} from '../../server/cloudStateMiddleware';
test('migration fence blocks mutations before handlers while keeping reads available',async()=>{
 process.env.PERSISTENCE_DRIVER='firestore';let writes=0,calls=0;
 const app=express();app.use(createCloudStateMiddleware({read:async()=>({state:{} as any,revision:'fixture',writesFrozen:true}),write:async()=>{writes++;return'next';}}));
 app.all('/api/fixture',(_req,res)=>{calls++;res.json({ok:true});});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const url='http://127.0.0.1:'+(server.address() as any).port+'/api/fixture';
 try{const denied=await fetch(url,{method:'POST'});assert.equal(denied.status,503);assert.equal((await denied.json()).code,'MIGRATION_IN_PROGRESS');assert.equal(calls,0);assert.equal((await fetch(url)).status,200);assert.equal(calls,1);assert.equal(writes,0);}finally{await new Promise<void>(r=>server.close(()=>r()));delete process.env.PERSISTENCE_DRIVER;}
});
