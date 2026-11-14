import crypto from 'node:crypto';
import {isIP} from 'node:net';
import type {Request,RequestHandler} from 'express';
import {studyRpc,supabaseEnabled} from './supabaseClient';
import {runtimeNamespace} from './runtimeScope';
const salt=process.env.SESSION_SECRET||crypto.randomBytes(32).toString('hex');
export function clientIpFingerprint(req:Pick<Request,'headers'|'socket'>){
 const platform=process.env.VERCEL?String(req.headers['x-vercel-forwarded-for']||'').split(',')[0].trim():'';
 const ip=isIP(platform)?platform:String(req.socket.remoteAddress||'unknown');
 return crypto.createHmac('sha256',salt).update(ip).digest('hex');
}
export function authenticationBucket(req:Request,scope:string){
 const account=scope==='login'?crypto.createHash('sha256').update(String(req.body?.login||req.body?.email||'').trim().toLowerCase()).digest('hex'):'';
 const test=process.env.NODE_ENV==='test'?String(req.headers['x-test-client-id']||'').slice(0,80):'';
 return `${scope}:${clientIpFingerprint(req)}:${account}:${test}`;
}
export const authIngress:RequestHandler=async(req,res,next)=>{
 const publicLogin=['/api/auth/login','/api/auth/provider-sync','/api/auth/firebase-sync','/api/auth/register-with-invite'].includes(req.path),sensitive=['/api/account/password','/api/account/native-credentials','/api/account/google-link'].includes(req.path);
 if(req.method!=='POST'||(!publicLogin&&!sensitive)||!supabaseEnabled())return next();
 try{
  const key=sensitive?crypto.createHmac('sha256',salt).update(req.path+':'+String(res.locals.signedUid||'anonymous')+':'+clientIpFingerprint(req)).digest('hex'):clientIpFingerprint(req);
  const allowed=await studyRpc<boolean>('study_auth_rate_limit',{p_namespace:runtimeNamespace(),p_key:key,p_limit:sensitive?10:600,p_window_ms:sensitive?900000:60000});
  if(!allowed)return res.status(429).set('Retry-After','60').json({code:'RATE_LIMITED',error:'Kirish so‘rovlari ko‘paydi. Bir daqiqadan keyin qayta urining.'});
  next();
 }catch{return res.status(503).json({code:'TEMPORARY',error:'Kirish xizmati vaqtincha tayyor emas.'});}
};
