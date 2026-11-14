import crypto from 'node:crypto';
import type {Express} from 'express';
import {z} from 'zod';
import {serverSupabase} from './supabaseClient';
import {isAuthorizedAdminEmail} from '../utils/security';
import type {PersistentDatabaseState} from './dbEngine';

export const supabaseAuthEnabled=()=>process.env.AUTH_PROVIDER==='supabase';
export async function verifiedProviderUser(token:string){
 if(token.length>16000||!token.includes('.'))throw Error('Invalid provider token');
 const {data,error}=await serverSupabase().auth.getUser(token);
 if(error||!data.user||!data.user.email||!data.user.email_confirmed_at)throw Error('Unverified provider identity');
 const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));
 if(claims.sub!==data.user.id||claims.exp*1000<=Date.now())throw Error('Invalid provider token');
 const amr=Array.isArray(claims.amr)?claims.amr:[],oauth=amr.filter((v:any)=>v.method==='oauth');
 const google=data.user.identities?.some(v=>v.provider==='google')&&oauth.length>0;
 return{user:data.user,google:!!google,authTime:Math.max(0,...oauth.map((v:any)=>Number(v.timestamp)||0))};
}
export function resolveProviderProfile(db:PersistentDatabaseState,provider:any){
 const matched=db.users.find((u:any)=>u.linkedSupabaseUid===provider.id);
 if(matched)return matched;
 // app_metadata is written only by the trusted migration/admin API; user_metadata is never an authority.
 const legacy=provider.app_metadata?.legacyApplicationUid;
 return legacy?db.users.find(u=>u.uid===legacy&&u.email.toLowerCase()===provider.email?.toLowerCase()):undefined;
}
export async function accountProviderProof(token:string,db:PersistentDatabaseState){
 if(!supabaseAuthEnabled()){
  const {getFirebaseAdminAuth}=await import('./firebaseAdminAuth');return getFirebaseAdminAuth().verifyIdToken(token,true);
 }
 const identity=await verifiedProviderUser(token),profile=resolveProviderProfile(db,identity.user);
 return{uid:profile?.uid||identity.user.id,providerUid:identity.user.id,email:identity.user.email,email_verified:true,auth_time:identity.authTime,firebase:{sign_in_provider:identity.google?'google.com':'other'}};
}
export function registerSupabaseAuthRoutes(app:Express,deps:any){
 app.use('/api/auth/firebase-sync',(_req,res,next)=>supabaseAuthEnabled()?res.status(410).json({error:'Kirish sahifasini yangilang.',code:'AUTH_PROVIDER_CHANGED'}):next());
 app.post('/api/auth/provider-sync',async(req,res)=>{
  if(!supabaseAuthEnabled())return res.status(503).json({error:'Kirish xizmati sozlanmoqda.'});
  const parsed=z.object({idToken:z.string().min(20).max(16000),inviteToken:z.string().max(128).optional()}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:'Kirish javobini tekshiring.'});
  try{
   const identity=await verifiedProviderUser(parsed.data.idToken);
   if(!identity.google)return res.status(403).json({error:'Tasdiqlangan Google kirishi kerak.'});
   const db:PersistentDatabaseState=deps.database('prod'),provider=identity.user,now=new Date().toISOString();
   let user=resolveProviderProfile(db,provider);
   if(user&&user.status!=='active')return res.status(403).json({error:'Hisob faol emas.'});
   if(!user){
    // Never attach a Google login to an existing password account by an untrusted client-supplied email.
    if(db.users.some(u=>u.email.toLowerCase()===provider.email!.toLowerCase()))return res.status(409).json({error:'Avval mavjud hisobga kirib, Google hisobingizni biriktiring.'});
    if(isAuthorizedAdminEmail(provider.email))return res.status(403).json({error:'Administrator hisobi migratsiya reyestrida tasdiqlanishi kerak.'});
    const school=db.institutions[0];if(!school)return res.status(503).json({error:'Maktab sozlamasi tayyor emas.'});
    user={uid:provider.id,linkedSupabaseUid:provider.id,email:provider.email!,emailVerified:true,displayName:String(provider.user_metadata?.full_name||'O‘quvchi').slice(0,120),role:'student',institutionId:school.id,status:'active',createdAt:now} as any;db.users.push(user!);
   }
   const current=user!;
   if(['admin','platform_owner'].includes(current.role)){
    if(!isAuthorizedAdminEmail(provider.email)||provider.app_metadata?.platformAdmin!==true||!current.emailVerified||current.platformAdmin!==true||db.customClaims?.[current.uid]?.platformAdmin!==true)return res.status(403).json({error:'Administrator ruxsati tasdiqlanmadi.'});
   }
   current.linkedSupabaseUid=provider.id;current.lastLoginAt=now;
   db.auditLogs.unshift({id:crypto.randomUUID(),institutionId:current.institutionId,actorUid:current.uid,actorName:current.displayName,actorRole:current.role,action:'Supabase Google orqali kirish',target:'Hisob',recordId:current.uid,createdAt:now});
   deps.save('prod',db);return res.json({user:current,token:deps.issue(current.uid,'prod'),activationStatus:'active'});
  }catch{return res.status(401).json({error:'Google hisobini tekshirib bo‘lmadi. Qayta kiring.',code:'auth/invalid-credential'});}
 });
}
