import crypto from 'node:crypto';
import type {Express,Request,Response} from 'express';
import {getDbState,saveDbState,issueSessionToken} from './dbEngine';
export type RefreshSession={id:string;userId:string;institutionId:string;tokenHash:string;issuedAt:number;expiresAt:number;lastUsedAt:number;revokedAt?:number};
export const refreshCookieName=()=>process.env.NODE_ENV==='production'||process.env.VERCEL?'__Host-ss_refresh':'ss_refresh';
const options=()=>({httpOnly:true,secure:process.env.NODE_ENV==='production'||Boolean(process.env.VERCEL),sameSite:'strict' as const,path:'/'});
export const refreshHash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
export function rawRefresh(req:Pick<Request,'headers'>){const pair=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(refreshCookieName()+'='));if(!pair)return;const raw=pair.slice(pair.indexOf('=')+1);return /^[a-f0-9]{64}$/.test(raw)?raw:undefined;}
export function validRefresh(db:any,raw:string|undefined,now=Date.now()){
 const record:RefreshSession|undefined=raw?(db.refreshSessions||[]).find((s:RefreshSession)=>s.tokenHash===refreshHash(raw)):undefined;
 const user=record&&db.users.find((u:any)=>u.uid===record.userId&&u.institutionId===record.institutionId&&u.status==='active');
 return record&&user&&!record.revokedAt&&record.expiresAt>now&&record.issuedAt>(db.revokedBeforeByUser?.[record.userId]||0)?{record,user}:undefined;
}
export function createRefreshSession(uid:string,env:'prod'|'test',res:Response){
 const db=getDbState(env),user=db.users.find(u=>u.uid===uid);if(!user)throw Error('Session identity missing');
 const now=Math.max(Date.now(),(db.revokedBeforeByUser?.[uid]||0)+1),raw=crypto.randomBytes(32).toString('hex');
 const record:RefreshSession={id:crypto.randomUUID(),userId:uid,institutionId:user.institutionId,tokenHash:refreshHash(raw),issuedAt:now,lastUsedAt:now,expiresAt:now+7*86400000};
 db.refreshSessions=(db.refreshSessions||[]).filter(s=>s.expiresAt>now&&!s.revokedAt);db.refreshSessions.push(record);saveDbState(env,db);
 return{access:issueSessionToken(uid,env,15*60000,record.id),commit:()=>res.cookie(refreshCookieName(),raw,{...options(),maxAge:7*86400000})};
}
export function clearRefreshCookie(res:Response){res.clearCookie(refreshCookieName(),options());}
export function revokeCurrentRefresh(req:Request,db:any){const raw=rawRefresh(req);if(!raw)return;const record=(db.refreshSessions||[]).find((r:RefreshSession)=>r.tokenHash===refreshHash(raw));if(record)record.revokedAt=Date.now();}
export function registerRefreshRoutes(app:Express,deps:any){
 app.post('/api/auth/refresh',(req,res)=>{
  const db=deps.database('prod'),current=validRefresh(db,rawRefresh(req));
  if(!current){clearRefreshCookie(res);return res.status(401).json({code:'LOGIN_REQUIRED',error:'Hisobga qayta kiring.'});}
  current.record.lastUsedAt=Date.now();deps.save('prod',db);res.locals.refreshOnly=true;
  return res.json({user:current.user,token:deps.issue(current.user.uid,'prod',15*60000,current.record.id)});
 });
 app.get('/api/account/sessions',(req,res)=>{const c=deps.authenticate(req);if(!c)return res.status(401).json({error:'Hisobga kiring.'});const raw=rawRefresh(req),current=raw&&refreshHash(raw);res.json({sessions:(c.db.refreshSessions||[]).filter((s:RefreshSession)=>s.userId===c.user.uid&&!s.revokedAt&&s.expiresAt>Date.now()).map((s:RefreshSession)=>({id:s.id,issuedAt:s.issuedAt,expiresAt:s.expiresAt,lastUsedAt:s.lastUsedAt,current:s.tokenHash===current}))});});
 app.delete('/api/account/sessions/:id',(req,res)=>{const c=deps.authenticate(req);if(!c)return res.status(401).json({error:'Hisobga kiring.'});const record=(c.db.refreshSessions||[]).find((s:RefreshSession)=>s.id===req.params.id&&s.userId===c.user.uid);if(!record)return res.status(404).json({error:'Sessiya topilmadi.'});record.revokedAt=Date.now();deps.save(c.env,c.db);if(record.tokenHash===refreshHash(rawRefresh(req)||''))clearRefreshCookie(res);return res.json({revoked:true});});
}
