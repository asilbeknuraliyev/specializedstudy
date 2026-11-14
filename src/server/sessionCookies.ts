import type {Request,Response,RequestHandler} from 'express';
const secure=()=>process.env.NODE_ENV==='production'||Boolean(process.env.VERCEL);
export const sessionCookieName=()=>secure()?'__Host-ss_session':'ss_session';
export function cookieToken(req:Request){const pair=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(sessionCookieName()+'='));if(!pair)return;try{return decodeURIComponent(pair.slice(pair.indexOf('=')+1));}catch{return;}}
export function clearSessionCookie(res:Response){res.clearCookie(sessionCookieName(),{httpOnly:true,secure:secure(),sameSite:'strict',path:'/'});}
export function sessionBody(res:Response,body:any){if(body&&typeof body.token==='string'&&body.user){res.cookie(sessionCookieName(),body.token,{httpOnly:true,secure:secure(),sameSite:'strict',path:'/',maxAge:7*86400000});return{...body,token:'cookie'};}return body;}
export const localSessionResponse:RequestHandler=(req,res,next)=>{if(!['firestore','supabase'].includes(process.env.PERSISTENCE_DRIVER||'')){const json=res.json.bind(res);res.json=(body:any)=>json(sessionBody(res,body));}if(['POST','PUT','PATCH','DELETE'].includes(req.method)&&cookieToken(req)&&req.headers.origin){let same=false;try{same=new URL(req.headers.origin).host===req.get('host');}catch{}if(!same)return res.status(403).json({error:'So‘rov manbasi mos emas.'});}next();};
