import crypto from 'node:crypto';import type {Express,RequestHandler} from 'express';import {z} from 'zod';
import {sealSecret,openSecret} from './secretEnvelope';import {asyncRoute} from './asyncRoute';
export type LeadershipRole='director'|'academic_deputy';
export const LEADERSHIP_MATRIX={
 director:['overview.read','roster.read','attendance.read','results.read','reports.read'],
 academic_deputy:['overview.read','roster.read','attendance.read','results.read','reports.read','curriculum.manage','timetable.manage'],
} as const;
export type LeadershipGrant={id:string;userId:string;schoolId:string;designation:LeadershipRole;permissions:string[];approvedBy:string;approvedAt:string;identityVerifiedAt:string;revokedAt?:string};
export type MfaCredential={id:string;userId:string;schoolId:string;pending?:string;pendingUntil?:number;pendingSessionId?:string;secret?:string;enabledAt?:string;lastCounter?:number;recoveryHashes:string[]};
export type MfaSession={id:string;userId:string;schoolId:string;verifiedAt:number;expiresAt:number};
const hash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
export function base32(bytes:Buffer){const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,value=0,out='';for(const b of bytes){value=(value<<8)|b;bits+=8;while(bits>=5){out+=chars[(value>>>(bits-5))&31];bits-=5;}}if(bits)out+=chars[(value<<(5-bits))&31];return out;}
function decode32(secret:string){let bits=0,value=0;const bytes=[];for(const char of secret){const n='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char);if(n<0)throw Error('Invalid MFA secret');value=(value<<5)|n;bits+=5;if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8;}}return Buffer.from(bytes);}
export function totp(secret:string,counter:number){const value=Buffer.alloc(8);value.writeBigUInt64BE(BigInt(counter));const bytes=crypto.createHmac('sha1',decode32(secret)).update(value).digest();const offset=bytes.at(-1)!&15;return String((bytes.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');}
export function validTotp(secret:string,code:string,lastCounter=-1,now=Date.now()){
 if(!/^\d{6}$/.test(code))return undefined;const current=Math.floor(now/30000);for(const counter of [current,current-1,current+1])if(counter>lastCounter&&crypto.timingSafeEqual(Buffer.from(totp(secret,counter)),Buffer.from(code)))return counter;return undefined;
}
export function sessionFamily(token:string){try{return JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString()).sid as string|undefined;}catch{return undefined;}}
export const leadershipGrant=(c:any):LeadershipGrant|undefined=>(c.db.leadershipGrants||[]).find((g:LeadershipGrant)=>g.userId===c.user.uid&&g.schoolId===c.user.institutionId&&!g.revokedAt);
export const mfaVerified=(c:any)=>{const sid=sessionFamily(c.token||'');return !!sid&&(c.db.mfaVerifiedSessions||[]).some((s:MfaSession)=>s.id===sid&&s.userId===c.user.uid&&s.schoolId===c.user.institutionId&&s.expiresAt>Date.now());};
export const hasLeadershipPermission=(c:any,permission:string)=>!!c&&mfaVerified(c)&&!!leadershipGrant(c)?.permissions.includes(permission);
export function createMfaGuard(authenticate:(req:any)=>any):RequestHandler{return(req,res,next)=>{
 if(!req.path.startsWith('/api/')||req.path==='/api/health')return next();const c=authenticate(req);if(!c||!leadershipGrant(c))return next();
 if(/^\/api\/(?:auth\/(?:login|provider-sync|logout|refresh)$|account\/(?:password$|mfa(?:\/|$)|sessions(?:\/|$)))/.test(req.path))return next();
 if(mfaVerified(c))return next();
 return res.status(403).json({code:'MFA_REQUIRED',error:'Boshqaruv uchun autentifikator tasdig‘i kerak.',user:{uid:c.user.uid,displayName:c.user.displayName,role:c.user.role,status:c.user.status,institutionId:c.user.institutionId,mustChangePassword:c.user.mustChangePassword,mfaRequired:true,leadershipDesignation:leadershipGrant(c)!.designation}});
};}
export function registerLeadershipSecurity(app:Express,deps:any){
 const access=(req:any,res:any)=>{const c=deps.authenticate(req);if(!c||c.user.status!=='active'){res.status(401).json({error:'Hisobga kiring.'});return;}return c;};
 const audit=(c:any,action:string,target:string)=>{c.db.auditLogs.unshift({id:crypto.randomUUID(),institutionId:c.user.institutionId,actorUid:c.user.uid,actorName:c.user.displayName,actorRole:c.user.role,action,target:'Xavfsizlik',recordId:target,createdAt:new Date().toISOString()});};
 const credential=(c:any):MfaCredential|undefined=>(c.db.mfaCredentials||[]).find((v:MfaCredential)=>v.userId===c.user.uid&&v.schoolId===c.user.institutionId);
 const stamp=(c:any)=>{const id=sessionFamily(c.token);if(!id)throw Error('Session upgrade required');c.db.mfaVerifiedSessions=(c.db.mfaVerifiedSessions||[]).filter((v:MfaSession)=>v.expiresAt>Date.now()&&v.id!==id);c.db.mfaVerifiedSessions.push({id,userId:c.user.uid,schoolId:c.user.institutionId,verifiedAt:Date.now(),expiresAt:Date.now()+60*60000});};
 const proof=async(c:any,body:any)=>{if(body.password&&await deps.verify(body.password,c.db.passwordHashes[c.user.uid]))return true;if(body.idToken){try{const id=await deps.providerProof(String(body.idToken).slice(0,16000),c.db);return id.uid===c.user.uid&&id.email_verified&&id.firebase?.sign_in_provider==='google.com'&&Date.now()/1000-id.auth_time<=300;}catch{return false;}}return false;};
 app.get('/api/account/mfa/status',(req,res)=>{const c=access(req,res);if(!c)return;res.json({enabled:!!credential(c)?.enabledAt,required:!!leadershipGrant(c),verified:mfaVerified(c)});});
 app.post('/api/account/mfa/enroll',asyncRoute(async(req,res)=>{
  res.set('Cache-Control','no-store');
  const c=access(req,res);if(!c)return;const p=z.object({password:z.string().max(128).optional(),idToken:z.string().max(16000).optional()}).safeParse(req.body);
  if(!p.success||!await proof(c,p.data))return res.status(403).json({error:'Joriy parol yoki yangi Google tasdig‘i kerak.'});
  if(credential(c)?.enabledAt)return res.status(409).json({error:'MFA allaqachon yoqilgan. Almashtirish uchun xavfsiz recovery kerak.'});
  const sessionId=sessionFamily(c.token);
  if(!sessionId)return res.status(409).json({error:'Hisobdan chiqib, qayta kiring.'});
  const secret=base32(crypto.randomBytes(20)),purpose=c.user.institutionId+':mfa:'+c.user.uid;
  c.db.mfaCredentials||=[];let current=credential(c);if(!current){current={id:c.user.uid,userId:c.user.uid,schoolId:c.user.institutionId,recoveryHashes:[]};c.db.mfaCredentials.push(current);}
  current.pending=sealSecret(secret,purpose);current.pendingUntil=Date.now()+10*60000;current.pendingSessionId=sessionId;audit(c,'MFA sozlash boshlandi',c.user.uid);deps.save(c.env,c.db);
  res.json({secret,uri:'otpauth://totp/'+encodeURIComponent('Specialized Study:'+(c.user.login||c.user.uid))+'?secret='+secret+'&issuer=Specialized%20Study&algorithm=SHA1&digits=6&period=30',expiresAt:current.pendingUntil});
 }));
 app.post('/api/account/mfa/confirm',(req,res)=>{
  res.set('Cache-Control','no-store');
  const c=access(req,res);if(!c)return;const current=credential(c);if(!current?.pending||!current.pendingUntil||current.pendingUntil<Date.now()||!current.pendingSessionId||current.pendingSessionId!==sessionFamily(c.token))return res.status(400).json({error:'Shu sessiyada MFA sozlashni qayta boshlang.'});
  const secret=openSecret<string>(current.pending,c.user.institutionId+':mfa:'+c.user.uid),counter=validTotp(secret,String(req.body.code||''));if(counter===undefined)return res.status(400).json({error:'Autentifikator kodi noto‘g‘ri.'});
  const recoveryCodes=Array.from({length:8},()=>crypto.randomBytes(9).toString('hex'));
  current.secret=current.pending;delete current.pending;delete current.pendingUntil;delete current.pendingSessionId;current.enabledAt=new Date().toISOString();current.lastCounter=counter;current.recoveryHashes=recoveryCodes.map(hash);stamp(c);audit(c,'MFA yoqildi',c.user.uid);deps.save(c.env,c.db);return res.json({enabled:true,recoveryCodes});
 });
 app.post('/api/account/mfa/challenge',(req,res)=>{
  const c=access(req,res);if(!c)return;const current=credential(c);if(!current?.secret||!current.enabledAt)return res.status(400).json({error:'Avval MFA sozlang.'});
  const code=String(req.body.code||'').trim();let accepted=false;
  if(/^[a-f0-9]{18}$/.test(code)&&current.recoveryHashes.includes(hash(code))){current.recoveryHashes=current.recoveryHashes.filter(v=>v!==hash(code));accepted=true;}
  else{const counter=validTotp(openSecret<string>(current.secret,c.user.institutionId+':mfa:'+c.user.uid),code,current.lastCounter);if(counter!==undefined){current.lastCounter=counter;accepted=true;}}
  if(!accepted){audit(c,'MFA tasdig‘i rad etildi',c.user.uid);deps.save(c.env,c.db);return res.status(403).json({error:'Kod noto‘g‘ri yoki ishlatilgan.'});}
  stamp(c);audit(c,'MFA orqali sessiya tasdiqlandi',c.user.uid);deps.save(c.env,c.db);return res.json({verified:true});
 });
 app.get('/api/leadership/permissions',(req,res)=>{const c=access(req,res);if(!c)return;const grant=leadershipGrant(c);if(!grant)return res.status(403).json({error:'Rahbariyat huquqi tasdiqlanmagan.'});return res.json({designation:grant.designation,permissions:grant.permissions,mfaRequired:true});});
 app.get('/api/admin/leadership',(req,res)=>{const c=access(req,res);if(!c)return;if(!deps.owner(c.user))return res.status(403).json({error:'Faqat platforma egasiga ruxsat.'});res.json({matrix:LEADERSHIP_MATRIX,grants:(c.db.leadershipGrants||[]).filter((g:LeadershipGrant)=>g.schoolId===c.user.institutionId),candidates:c.db.users.filter((u:any)=>u.institutionId===c.user.institutionId&&['teacher','staff'].includes(u.role)).map((u:any)=>({uid:u.uid,displayName:u.displayName,position:u.position,status:u.status}))});});
 app.post('/api/admin/leadership/:uid/approve',asyncRoute(async(req,res)=>{
  const c=access(req,res);if(!c)return;if(!deps.owner(c.user))return res.status(403).json({error:'Faqat platforma egasiga ruxsat.'});
  const p=z.object({designation:z.enum(['director','academic_deputy']),identityVerified:z.literal(true),reason:z.string().trim().min(12).max(1000),idToken:z.string().max(16000)}).safeParse(req.body);
  if(!p.success||!await proof(c,p.data))return res.status(403).json({error:'Shaxsni alohida tekshiring va yangi Google tasdig‘ini bering.'});
  const user=c.db.users.find((u:any)=>u.uid===req.params.uid&&u.institutionId===c.user.institutionId&&['teacher','staff'].includes(u.role));if(!user)return res.status(404).json({error:'Hisob topilmadi.'});
  c.db.leadershipGrants||=[];const previous=c.db.leadershipGrants.find((g:LeadershipGrant)=>g.userId===user.uid&&g.schoolId===c.user.institutionId&&!g.revokedAt);if(previous)return res.status(409).json({error:'Huquq allaqachon tasdiqlangan.'});
  const now=new Date().toISOString(),grant={id:crypto.randomUUID(),userId:user.uid,schoolId:c.user.institutionId,designation:p.data.designation,permissions:[...LEADERSHIP_MATRIX[p.data.designation]],approvedBy:c.user.uid,approvedAt:now,identityVerifiedAt:now};c.db.leadershipGrants.push(grant);user.leadershipDesignation=p.data.designation;user.status='active';deps.revoke(user.uid);audit(c,'Rahbariyat vakolati tasdiqlandi: '+p.data.reason,user.uid);deps.save(c.env,c.db);return res.json({approved:true,grant,mfaRequired:true});
 }));
 app.post('/api/admin/leadership/:uid/revoke',(req,res)=>{const c=access(req,res);if(!c)return;if(!deps.owner(c.user))return res.status(403).json({error:'Faqat platforma egasiga ruxsat.'});const grant=(c.db.leadershipGrants||[]).find((g:LeadershipGrant)=>g.userId===req.params.uid&&g.schoolId===c.user.institutionId&&!g.revokedAt);if(!grant)return res.status(404).json({error:'Huquq topilmadi.'});grant.revokedAt=new Date().toISOString();deps.revoke(grant.userId);audit(c,'Rahbariyat vakolati bekor qilindi',grant.userId);deps.save(c.env,c.db);return res.json({revoked:true});});
 app.post('/api/admin/leadership/:uid/mfa-recovery',asyncRoute(async(req,res)=>{const c=access(req,res);if(!c)return;if(!deps.owner(c.user)||req.body.identityVerified!==true||String(req.body.reason||'').length<12||!await proof(c,req.body))return res.status(403).json({error:'Shaxsni tekshirish, sabab va yangi Google tasdig‘i talab qilinadi.'});const record=(c.db.mfaCredentials||[]).find((v:MfaCredential)=>v.userId===req.params.uid&&v.schoolId===c.user.institutionId);if(!record)return res.status(404).json({error:'MFA hisobi topilmadi.'});c.db.mfaCredentials=c.db.mfaCredentials.filter((v:MfaCredential)=>v!==record);c.db.mfaVerifiedSessions=(c.db.mfaVerifiedSessions||[]).filter((v:MfaSession)=>v.userId!==record.userId);deps.revoke(record.userId);audit(c,'Shaxs tekshirilgach MFA recovery: '+String(req.body.reason).slice(0,1000),record.userId);deps.save(c.env,c.db);return res.json({reset:true,mfaEnrollmentRequired:true});}));
}
