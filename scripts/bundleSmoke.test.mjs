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

test('Firebase JWKS dependency resolves RSA signing keys without require(ESM)', async()=>{
 const {createRequire}=await import('node:module');const {generateKeyPairSync,sign,verify}=await import('node:crypto');
 const require=createRequire(import.meta.url);const {retrieveSigningKeys}=require('jwks-rsa/src/utils');
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const keys=await retrieveSigningKeys([{...publicKey.export({format:'jwk'}),kid:'compat-check',alg:'RS256',use:'sig'}]);
 assert.equal(keys.length,1);assert.equal(keys[0].kid,'compat-check');
 const message=Buffer.from('runtime compatibility check');assert.ok(verify('RSA-SHA256',message,keys[0].getPublicKey(),sign('RSA-SHA256',message,privateKey)));
});
