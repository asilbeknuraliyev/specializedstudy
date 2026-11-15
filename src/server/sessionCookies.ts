import type {Request,Response,RequestHandler} from 'express';
import {verifySessionToken} from './dbEngine';
import {createRefreshSession,clearRefreshCookie} from './refreshSessions';
const secure=()=>process.env.NODE_ENV==='production'||Boolean(process.env.VERCEL);
export const sessionCookieName=()=>secure()?'__Host-ss_session':'ss_session';
export function cookieToken(req:Request){const pair=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(sessionCookieName()+'='));if(!pair)return;try{return decodeURIComponent(pair.slice(pair.indexOf('=')+1));}catch{return;}}
export function clearSessionCookie(res:Response){res.clearCookie(sessionCookieName(),{httpOnly:true,secure:secure(),sameSite:'strict',path:'/'});clearRefreshCookie(res);}
export function prepareSessionBody(res:Response,body:any){
 if(!body||typeof body.token!=='string'||!body.user)return{body,commit:()=>{}};
 let token=body.token,commitRefresh=()=>{};const verified=verifySessionToken(token);
 if(verified&&verified.uid===body.user.uid&&!res.locals.refreshOnly){const refresh=createRefreshSession(verified.uid,verified.env,res);token=refresh.access;commitRefresh=refresh.commit;}
 return{body:{...body,token:'cookie'},commit:()=>{res.cookie(sessionCookieName(),token,{httpOnly:true,secure:secure(),sameSite:'strict',path:'/',maxAge:15*60000});commitRefresh();}};
}
export function sessionBody(res:Response,body:any){const response=prepareSessionBody(res,body);response.commit();return response.body;}
export const localSessionResponse:RequestHandler=(req,res,next)=>{if(!['firestore','supabase'].includes(process.env.PERSISTENCE_DRIVER||'')){const json=res.json.bind(res);res.json=(body:any)=>json(sessionBody(res,body));}if(['POST','PUT','PATCH','DELETE'].includes(req.method)&&(cookieToken(req)||String(req.headers.cookie||'').includes('ss_refresh='))&&req.headers.origin){let same=false;try{same=new URL(req.headers.origin).host===req.get('host');}catch{}if(!same)return res.status(403).json({error:'So‘rov manbasi mos emas.'});}next();};
