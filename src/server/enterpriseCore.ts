import crypto from 'node:crypto';
import {schoolDay} from './spacedReviewEngine';
export class SchoolError extends Error{constructor(public status:number,message:string){super(message);}}
export type SchoolContext={db:any;user:any;env:string;now:Date};
export const schoolAdmin=(u:any)=>u?.status==='active'&&['admin','platform_owner'].includes(u.role)&&u.platformAdmin===true&&u.emailVerified===true;
export function schoolClasses(c:SchoolContext){return c.db.classes.filter((v:any)=>v.institutionId===c.user.institutionId&&(schoolAdmin(c.user)||c.user.role==='teacher'&&c.user.assignedClassIds?.includes(v.id)||c.user.role==='student'&&v.id===c.user.classId));}
export function schoolStudent(c:SchoolContext,id:string){const s=c.db.users.find((u:any)=>u.uid===id&&u.institutionId===c.user.institutionId&&u.role==='student'&&u.status==='active');if(!s||!schoolClasses(c).some((cl:any)=>cl.id===s.classId))throw new SchoolError(403,'Bu o‘quvchiga ruxsat yo‘q.');return s;}
export const schoolKey=(...values:unknown[])=>values.map(v=>encodeURIComponent(String(v))).join(':');
export const digest=(value:unknown)=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function ensureRows(db:any,key:string){return db[key]||(db[key]=[]);}
export function pageRows(rows:any[],page=0,size=20){return{rows:rows.slice(page*size,page*size+size),total:rows.length,page};}
function auditValue(value:any):any{if(value==null)return null;if(value instanceof Date)return value.toISOString();if(typeof value==='string'&&value.startsWith('data:image/'))return{digest:digest(value),bytes:Buffer.byteLength(value)};if(Array.isArray(value))return value.map(auditValue);if(typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,auditValue(v)]));return value;}
export function schoolAudit(c:SchoolContext,action:string,entityId:string,before:unknown,after:unknown){
 const rows=ensureRows(c.db,'schoolAuditEvents'),previous=rows.filter((a:any)=>a.schoolId===c.user.institutionId).at(-1)?.hash||'genesis';
 const event={id:crypto.randomUUID(),schoolId:c.user.institutionId,actorId:c.user.uid,actorName:c.user.displayName,action,entityId,at:c.now.toISOString(),before:auditValue(before),after:auditValue(after),previous};const hash=digest(event);rows.push({...event,hash});
 c.db.auditLogs.push({id:event.id,institutionId:c.user.institutionId,actorUid:c.user.uid,actorName:c.user.displayName,actorRole:c.user.role,action,target:'Maktab boshqaruvi',recordId:entityId,createdAt:event.at});return event.id;
}
export function operation(c:SchoolContext,id:string,kind:string,body:unknown){const existing=(c.db.schoolOperations||[]).find((v:any)=>v.id===schoolKey(c.user.institutionId,c.user.uid,id));if(existing&&(existing.kind!==kind||existing.signature!==digest(body)))throw new SchoolError(409,'So‘rov identifikatori boshqa amal uchun ishlatilgan.');return existing;}
export function remember(c:SchoolContext,id:string,kind:string,body:unknown,refs:string[]){ensureRows(c.db,'schoolOperations').push({id:schoolKey(c.user.institutionId,c.user.uid,id),schoolId:c.user.institutionId,actorId:c.user.uid,kind,signature:digest(body),refs,at:c.now.toISOString()});}
export function notifySchool(c:SchoolContext,userId:string,title:string,href:string,source:string){
 const id=schoolKey(c.user.institutionId,userId,source);const rows=ensureRows(c.db,'notifications');if(!rows.some((v:any)=>v.id===id))rows.push({id,institutionId:c.user.institutionId,schoolId:c.user.institutionId,recipientUid:userId,title,message:'Shaxsiy bo‘limingizni ochib, tafsilotlarni ko‘ring.',link:href,createdAt:c.now.toISOString(),read:false});
}
export const localDate=schoolDay;
export function validDate(value:string){const d=new Date(value+'T12:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
export function checkRevision(actual:number,expected:number){if(actual!==expected)throw new SchoolError(409,'Ma’lumot boshqa oynada yangilangan. Yozganlaringizni saqlab, server holati bilan solishtiring.');}
