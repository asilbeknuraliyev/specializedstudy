import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
process.env.VERCEL='1';process.env.NODE_ENV='production';process.env.SESSION_SECRET=randomBytes(48).toString('hex');
const {default:app}=await import('../api/index.js');
test('native Node loads the bundled Vercel handler and serves health without a TS loader',async()=>{
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 try{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/health`);assert.equal(r.status,200);assert.equal((await r.json()).status,'ok');}
 finally{await new Promise(resolve=>server.close(resolve));}
});
