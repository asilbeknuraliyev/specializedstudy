import crypto from 'node:crypto';
export type ImportKind='workplan'|'timetable';
export type ImportRow={rowNumber:number;raw:Record<string,string>;errors:string[];status:'valid'|'error'|'duplicate';key:string};
export interface ContentImportJob{id:string;institutionId:string;actorId:string;kind:ImportKind;year:string;fileName:string;createdAt:string;status:'review'|'committed'|'undone';rows:ImportRow[];created?:Array<{collection:string;id:string;digest:string}>;mode?:'draft'|'publish'|'archive';committedAt?:string;undoneAt?:string;}
export const contentHash=(value:unknown)=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const days=['','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
export const templates={workplan:['sinf','fan','chorak','tartib','mavzu','soat','sinf_ishi','uy_vazifasi'],timetable:['sinf','kun','dars','boshlanish','tugash','fan','oqituvchi','xona'],questions:['sinf','fan','chorak','mavzu','tur','savol','A','B','C','D','javob','ball','izoh']};
const minute=(s:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s)?Number(s.slice(0,2))*60+Number(s.slice(3)):NaN;
export function validateContentRows(kind:ImportKind,input:Array<Record<string,string>>,db:any,institutionId:string,year:string):ImportRow[]{
 const seen=new Set<string>(),accepted:any[]=[];
 const active=new Set((db.timetables||[]).filter((t:any)=>t.institutionId===institutionId&&t.status!=='archived'&&(t.academicYear||db.institutions?.find((i:any)=>i.id===institutionId)?.academicYear||year)===year).map((t:any)=>t.id));
 const existing=(db.timetableEntries||[]).filter((e:any)=>e.institutionId===institutionId&&active.has(e.timetableId));
 return input.map((raw,index)=>{
  const rowNumber=Number(raw.__row)||index+2;const errors:string[]=[];if(Object.values(raw).some(v=>v.length>10000))errors.push('Katak matni 10000 belgidan oshmasin.');const code=(raw.sinf||'').toLowerCase().trim();
  const cls=db.classes.find((c:any)=>c.institutionId===institutionId&&c.code===code);
  if(!cls)errors.push('Rasmiy sinf topilmadi.');if(!raw.fan||raw.fan.length<2||raw.fan.length>100)errors.push('Fan nomini kiriting.');
  let key:string;
  if(kind==='workplan'){
   if(![1,2,3,4].includes(Number(raw.chorak)))errors.push('Chorak 1–4 bo‘lsin.');
   if(!Number.isInteger(Number(raw.tartib))||Number(raw.tartib)<1||Number(raw.tartib)>1000)errors.push('Tartib 1–1000 oralig‘idagi butun son bo‘lsin.');
   if(!raw.mavzu||raw.mavzu.length>1000)errors.push('Mavzu kiritilsin (1000 belgigacha).');
   if(!(Number(raw.soat)>0&&Number(raw.soat)<=8))errors.push('Soat 0 dan katta, 8 dan oshmasin.');
   key=contentHash([institutionId,kind,year,code,raw.fan,Number(raw.chorak),Number(raw.tartib)]);
  }else{
   const day=days.findIndex(d=>d.toLowerCase()===String(raw.kun).toLowerCase());const start=minute(raw.boshlanish||''),end=minute(raw.tugash||'');
   if(day<1)errors.push('Kun Dushanba–Shanba bo‘lsin.');if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)errors.push('Vaqt HH:mm shaklida va tugash boshlanishdan keyin bo‘lsin.');
   if(!Number.isInteger(Number(raw.dars))||Number(raw.dars)<1||Number(raw.dars)>12)errors.push('Dars tartibi 1–12 bo‘lsin.');
   const matches=(db.users||[]).filter((u:any)=>u.institutionId===institutionId&&u.role==='teacher'&&u.status==='active'&&(u.email?.toLowerCase()===raw.oqituvchi?.toLowerCase()||u.displayName?.toLowerCase()===raw.oqituvchi?.toLowerCase()));
   if(raw.oqituvchi&&matches.length!==1)errors.push('O‘qituvchi aniq topilmadi. Avval hisob yarating yoki emailidan foydalaning.');
   const teacher=matches[0];if(teacher&&cls&&(!teacher.assignedClassIds?.includes(cls.id)||teacher.subject!==raw.fan))errors.push('O‘qituvchi ushbu sinf/fanga biriktirilmagan.');
   raw={...raw,__teacherId:teacher?.uid||'',__teacherName:teacher?.displayName||'',__day:String(day)};
   key=contentHash([institutionId,kind,year,code,day,raw.boshlanish,raw.tugash,raw.fan,raw.oqituvchi||'',raw.xona||'']);
   const conflicts=[...existing,...accepted].filter((e:any)=>Number(e.weekdayIndex)===day&&start<minute(e.endTime)&&end>minute(e.startTime));
   if(conflicts.some((e:any)=>e.classCode===code&&e.sourceRecordHash!==key))errors.push('Sinf bir vaqtda ikki darsda.');
   if(teacher&&conflicts.some((e:any)=>e.teacherId===teacher.uid&&e.sourceRecordHash!==key))errors.push('O‘qituvchi bir vaqtda ikki sinfda.');
   if(raw.xona&&conflicts.some((e:any)=>e.room?.trim().toLowerCase()===raw.xona.trim().toLowerCase()&&e.sourceRecordHash!==key))errors.push('Xona band.');
   if(!errors.length)accepted.push({classCode:code,weekdayIndex:day,startTime:raw.boshlanish,endTime:raw.tugash,teacherId:teacher?.uid,room:raw.xona,sourceRecordHash:key});
  }
  const duplicate=seen.has(key!)||(kind==='workplan'?(db.lessons||[]):existing).some((r:any)=>r.institutionId===institutionId&&(r.sourceRecordHash===key!||r.id==='content-'+key!));
  if(kind==='workplan'&&!duplicate&&(db.lessons||[]).some((r:any)=>r.institutionId===institutionId&&r.academicYear===year&&(r.classCode===code||r.classCodes?.includes(code))&&(r.subjectName||r.subject)===raw.fan&&r.quarter===Number(raw.chorak)&&r.lessonNumber===Number(raw.tartib)))errors.push('Shu tartibdagi mavzu mavjud. Mavjud darsni tahrirlang.');if(!errors.length)seen.add(key!);
  return{rowNumber,raw:{...raw,sinf:code},errors,status:errors.length?'error':duplicate?'duplicate':'valid',key:key!};
 });
}
