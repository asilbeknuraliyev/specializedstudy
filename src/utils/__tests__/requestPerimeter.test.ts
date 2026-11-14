import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {isTrustedCorsOrigin} from '../security';
import {apiErrorHandler} from '../../server/apiErrorHandler';
test('CORS accepts exact current origin and rejects unowned hosting siblings, opaque origins and changed ports',()=>{
 assert.equal(isTrustedCorsOrigin('https://school.example','school.example'),true);
 for(const origin of ['https://foreign.vercel.app','null','https://school.example:444','http://school.example'])assert.equal(isTrustedCorsOrigin(origin,'school.example'),false);
 assert.equal(isTrustedCorsOrigin('http://localhost:3000','localhost:3000'),true);
 assert.equal(isTrustedCorsOrigin('http://localhost:4000','localhost:3000'),false);
});
test('API JSON errors expose neither submitted credentials nor stack traces',async()=>{
 const app=express();app.use(express.json({limit:'100b'}));app.post('/',(_q,r)=>r.json({ok:true}));app.use(apiErrorHandler);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try{const base='http://127.0.0.1:'+(server.address() as any).port;
 for(const [body,status] of [['{"password":"synthetic-private",',400],[JSON.stringify({value:'x'.repeat(150)}),413]] as const){
 const result=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body});assert.equal(result.status,status);const text=await result.text();assert.ok(!text.includes('synthetic-private'));assert.ok(!text.includes('SyntaxError'));}
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
