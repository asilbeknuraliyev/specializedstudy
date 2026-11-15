import {normalizedText,schoolClassCode} from './schoolSourceImport';

export type PlanningIssue={code:string;severity:'error'|'review';records:string[];message:string};
export type TimetableSlot={id:string;academicYear:string;versionId:string;weekday:number;classId:string;classCode:string;period:number;startTime:string;endTime:string;subject:string;curriculumArea?:string;teacherId?:string;teacherDisplayName:string;room?:string;groupNumber?:number;groupId?:string;sourceSheet:string;sourceCell:string;sourceHash:string;sourceValue:string;status:'draft'|'approved';effectiveFrom:string;effectiveTo?:string};
export type AcademicTerm={number:number;start:string;end:string};
export type CalendarException={id:string;date:string;kind:'closed'|'extra_day'|'cancelled'|'replacement';reason:string;classId?:string;slotId?:string;weekday?:number;replacementDate?:string};
export type AcademicCalendar={id:string;schoolId:string;academicYear:string;start:string;end:string;weekdays:number[];terms:AcademicTerm[];exceptions:CalendarException[];status:'provisional'|'approved';revision:number;source:string;approvedBy?:string;approvedAt?:string};
export type DatedLesson={id:string;schoolId:string;batchId:string;slotId:string;classId:string;classCode:string;subject:string;curriculumArea?:string;teacherId?:string;teacherDisplayName:string;groupId?:string;groupNumber?:number;room?:string;date:string;originalDate:string;startTime:string;endTime:string;period:number;quarter:number;state:'planned'|'awaiting_confirmation'|'confirmed'|'taught'|'postponed'|'cancelled'|'replaced'|'needs_review';topicId?:string;topicTitle?:string;topicPart?:number;topicHours?:number;allocatedHours:number;homework?:string;actualTopic?:string;note?:string;revision:number;source:{slotCell:string;sheet:string;planId?:string;topicRow?:number};allocations?:Array<{topicId:string;title:string;hours:number;part:number;totalHours:number;planId:string;sourceRow?:number}>;taughtAt?:string;taughtBy?:string};
export type PlanningTopic={id:string;workPlanId:string;classIds:string[];subject:string;curriculumArea?:string;quarter:number;order:number;hours:number;title:string;homework?:string;sourceRow?:number};
export const dateOnly=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
export const weekdayOf=(v:string)=>new Date(v+'T00:00:00Z').getUTCDay();
export const addDays=(v:string,n:number)=>new Date(Date.parse(v+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export const timeMinute=(v:string)=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v)?Number(v.slice(0,2))*60+Number(v.slice(3)):NaN;
const dayNames=['yakshanba','dushanba','seshanba','chorshanba','payshanba','juma','shanba'];
const label=(v:unknown)=>normalizedText(v).toLowerCase().replace(/[ʻʼ‘’`]/g,"'");

/** Reads only supplied cell values; never resolves ambiguous teacher/subject identities. */
export function parseSchoolTimetable(sheets:Array<{name:string;rows:unknown[][]}>,sourceHash:string,classes:Array<{id:string;code:string}>,year='2026-2027'){
 const versions:Array<{sheet:string;slots:TimetableSlot[];issues:PlanningIssue[]}>=[];
 for(const sheet of sheets){
  const header=sheet.rows.findIndex(r=>r.filter(v=>schoolClassCode(normalizedText(v))).length>=10);const issues:PlanningIssue[]=[],slots:TimetableSlot[]=[];
  if(header<0){issues.push({code:'HEADER_MISSING',severity:'error',records:[],message:'Rasmiy sinflar sarlavhasi topilmadi.'});versions.push({sheet:sheet.name,slots,issues});continue;}
  const columns=sheet.rows[header].map((v,i)=>({i,code:schoolClassCode(normalizedText(v))})).filter(v=>v.code);let weekday=-1,period=0;
  for(let r=header+1;r<sheet.rows.length;r++){
   const raw=sheet.rows[r],day=dayNames.indexOf(label(raw[0]));if(day>=0){weekday=day;period=0;}
   const time=normalizedText(raw[1]).replace(/\s/g,'').match(/^(\d{1,2}:\d{2})[–—-](\d{1,2}:\d{2})$/);if(!time||weekday<0)continue;period++;
   for(const col of columns){const text=String(raw[col.i]??'').replace(/\r/g,'').trim();if(!text)continue;const cls=classes.find(c=>c.code===col.code);let letters='',num=col.i+1;while(num){letters=String.fromCharCode(65+(num-1)%26)+letters;num=Math.floor((num-1)/26);}const cell=letters+(r+1),lines=text.split('\n').map(v=>v.trim()).filter(Boolean),chunks:Array<{group?:number;lines:string[]}>=[];
    for(const line of lines){const group=line.match(/^(\d)\s*[-–]?\s*guruh\s+(.+)$/i);if(group)chunks.push({group:Number(group[1]),lines:[group[2]]});else{if(!chunks.length)chunks.push({lines:[]});chunks.at(-1)!.lines.push(line);}}
    for(const chunk of chunks){const id=sourceHash+':'+sheet.name+':'+cell+':'+(chunk.group||0),teacher=chunk.lines[1]||'',room=chunk.lines.slice(2).join(' / ');const subject=normalizedText(chunk.lines[0]);
     if(!cls||!subject||chunk.lines.length>3)issues.push({code:!cls?'CLASS_UNKNOWN':!subject?'SUBJECT_MISSING':'CELL_REVIEW',severity:'error',records:[id],message:cell+': sinf yoki katak tarkibini tekshiring.'});
     if(!teacher||/vakant|bo.sh|вакан/i.test(teacher))issues.push({code:'TEACHER_UNASSIGNED',severity:'review',records:[id],message:cell+': ustoz biriktirilmagan yoki vakant.'});
     slots.push({id,academicYear:year,versionId:sourceHash+':'+sheet.name,weekday,classId:cls?.id||'',classCode:col.code!,period,startTime:time[1].padStart(5,'0'),endTime:time[2].padStart(5,'0'),subject,teacherDisplayName:teacher,room:room||undefined,groupNumber:chunk.group,sourceSheet:sheet.name,sourceCell:cell,sourceHash,sourceValue:text,status:'draft',effectiveFrom:year.slice(0,4)+'-09-01'});
    }
   }
  }
  versions.push({sheet:sheet.name,slots,issues});
 }
 const diffs:Array<{key:string;left?:TimetableSlot;right?:TimetableSlot;changed:string[]}>=[];
 if(versions.length>=2){const key=(s:TimetableSlot)=>[s.weekday,s.classCode,s.startTime,s.groupNumber||0].join('|'),a=new Map(versions[0].slots.map(s=>[key(s),s])),b=new Map(versions[1].slots.map(s=>[key(s),s]));
  for(const k of new Set([...a.keys(),...b.keys()])){const left=a.get(k),right=b.get(k),changed=left&&right?(['subject','teacherDisplayName','room','endTime','period'] as const).filter(f=>label(left[f])!==label(right[f])):[left?'missing':'added'];if(changed.length)diffs.push({key:k,left,right,changed});}
 }
 return{versions,diffs};
}

export function validateCalendar(calendar:AcademicCalendar){
 const errors:string[]=[];if(!/^\d{4}-\d{4}$/.test(calendar.academicYear)||calendar.start<calendar.academicYear.slice(0,4)+'-01-01'||calendar.end>calendar.academicYear.slice(-4)+'-12-31')errors.push('Sanalar o‘quv yiliga mos emas.');if(!dateOnly(calendar.start)||!dateOnly(calendar.end)||calendar.start>calendar.end)errors.push('O‘quv yili sanalari noto‘g‘ri.');
 if(!calendar.weekdays.length||calendar.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6))errors.push('Hafta kunlarini tanlang.');
 const sorted=[...calendar.terms].sort((a,b)=>a.start.localeCompare(b.start));for(let i=0;i<sorted.length;i++){const t=sorted[i];if(!dateOnly(t.start)||!dateOnly(t.end)||t.start>t.end||t.start<calendar.start||t.end>calendar.end||t.number<1||t.number>4||i&&sorted[i-1].end>=t.start)errors.push('Chorak chegarasi yoki ustma-ust kelishi noto‘g‘ri.');}
 if(new Set(sorted.map(t=>t.number)).size!==sorted.length)errors.push('Chorak raqami takrorlangan.');
 for(const e of calendar.exceptions)if(!dateOnly(e.date)||!e.reason.trim()||e.date<calendar.start||e.date>calendar.end||e.replacementDate&&!dateOnly(e.replacementDate))errors.push('Istisno sanasi yoki asosi noto‘g‘ri.');return errors;
}
export function instructionalDate(calendar:AcademicCalendar,date:string,slot?:TimetableSlot){
 const term=calendar.terms.find(t=>t.start<=date&&t.end>=date);if(!term||date<calendar.start||date>calendar.end)return undefined;
 const exceptions=calendar.exceptions.filter(e=>e.date===date&&(!e.classId||e.classId===slot?.classId)&&(!e.slotId||e.slotId===slot?.id));if(exceptions.some(e=>e.kind==='closed'||e.kind==='cancelled'))return undefined;
 const extra=exceptions.find(e=>e.kind==='extra_day');const weekday=extra?.weekday??weekdayOf(date);if(!extra&&!calendar.weekdays.includes(weekday))return undefined;return{quarter:term.number,weekday};
}
export function timetableConflicts(slots:TimetableSlot[]){
 const issues:PlanningIssue[]=[];for(let i=0;i<slots.length;i++){const a=slots[i];if(!Number.isFinite(timeMinute(a.startTime))||!Number.isFinite(timeMinute(a.endTime))||timeMinute(a.endTime)<=timeMinute(a.startTime))issues.push({code:'INVALID_TIME',severity:'error',records:[a.id],message:'Dars vaqti noto‘g‘ri.'});
  for(let n=0;n<i;n++){const b=slots[n];if(a.weekday!==b.weekday||a.effectiveTo&&a.effectiveTo<b.effectiveFrom||b.effectiveTo&&b.effectiveTo<a.effectiveFrom||timeMinute(a.startTime)>=timeMinute(b.endTime)||timeMinute(a.endTime)<=timeMinute(b.startTime))continue;
   const groupCompatible=a.classId===b.classId&&a.groupNumber&&b.groupNumber&&a.groupNumber!==b.groupNumber;
   if(a.classId===b.classId&&!groupCompatible)issues.push({code:'CLASS_OVERLAP',severity:'error',records:[a.id,b.id],message:'Sinf yoki bir guruh bir vaqtda ikkita darsga qo‘yilgan.'});
   if(a.teacherDisplayName&&label(a.teacherDisplayName)===label(b.teacherDisplayName)&&!/vakant/i.test(a.teacherDisplayName))issues.push({code:'TEACHER_OVERLAP',severity:'error',records:[a.id,b.id],message:'Ustoz bir vaqtda ikki mashg‘ulotga qo‘yilgan.'});
   if(a.room&&b.room&&label(a.room)===label(b.room))issues.push({code:'ROOM_OVERLAP',severity:'error',records:[a.id,b.id],message:'Xona bir vaqtda ikki mashg‘ulotga qo‘yilgan; birgalikdagi foydalanish alohida tasdiq talab qiladi.'});
  }
 }return issues;
}

export function allocateAcademicLessons(calendar:AcademicCalendar,slots:TimetableSlot[],topics:PlanningTopic[],schoolId:string,batchId:string,history?:{from:string;rows:DatedLesson[]}){
 const errors=validateCalendar(calendar);if(errors.length)throw Error(errors.join(' '));const occurrences:DatedLesson[]=[],issues:PlanningIssue[]=[];
 if(Date.parse(calendar.end)-Date.parse(calendar.start)>370*86400000)throw Error('Bitta o‘quv yili 370 kundan oshmasin.');
 const protectedKeys=new Set((history?.rows||[]).filter(r=>['taught','cancelled','replaced'].includes(r.state)).map(r=>[r.date,r.classId,r.startTime,r.groupId||r.groupNumber||''].join('|')));
 for(let date=history?.from||calendar.start;date<=calendar.end;date=addDays(date,1))for(const slot of slots){const day=instructionalDate(calendar,date,slot);if(!day||day.weekday!==slot.weekday||date<slot.effectiveFrom||slot.effectiveTo&&date>slot.effectiveTo||protectedKeys.has([date,slot.classId,slot.startTime,slot.groupId||slot.groupNumber||''].join('|')))continue;
  occurrences.push({id:schoolId+':'+slot.id+':'+date,schoolId,batchId,slotId:slot.id,classId:slot.classId,classCode:slot.classCode,subject:slot.subject,curriculumArea:slot.curriculumArea,teacherId:slot.teacherId,teacherDisplayName:slot.teacherDisplayName,groupId:slot.groupId,groupNumber:slot.groupNumber,room:slot.room,date,originalDate:date,startTime:slot.startTime,endTime:slot.endTime,period:slot.period,quarter:day.quarter,state:calendar.status==='approved'&&slot.status==='approved'?'planned':'awaiting_confirmation',allocatedHours:0,revision:1,source:{slotCell:slot.sourceCell,sheet:slot.sourceSheet}});
 }
 const lanes=new Map<string,DatedLesson[]>();for(const row of occurrences){const lane=[row.classId,row.subject,row.curriculumArea||'',row.groupId||row.groupNumber||'',row.quarter].join('|');if(!lanes.has(lane))lanes.set(lane,[]);lanes.get(lane)!.push(row);}
 const preserved=(history?.rows||[]).filter(r=>r.date<history!.from||['taught','cancelled','replaced'].includes(r.state));
 const allocated=new Set<string>();for(const rows of lanes.values()){rows.sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime));const sample=rows[0];const prior=preserved.filter(r=>r.classId===sample.classId&&r.subject===sample.subject&&r.curriculumArea===sample.curriculumArea&&(r.groupId||r.groupNumber)===(sample.groupId||sample.groupNumber)&&r.quarter===sample.quarter);const used=new Map<string,number>();for(const r of prior)for(const a of r.allocations|| (r.topicId?[{topicId:r.topicId,hours:r.allocatedHours}]:[]))used.set(a.topicId,(used.get(a.topicId)||0)+a.hours);const plan=topics.filter(t=>t.classIds.includes(sample.classId)&&t.subject===sample.subject&&(t.curriculumArea||'')===(sample.curriculumArea||'')&&t.quarter===sample.quarter).map(t=>({...t,hours:Math.max(0,t.hours-(used.get(t.id)||0))})).filter(t=>t.hours>1e-8).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));let n=0;
  for(const topic of plan){if(!Number.isFinite(topic.hours)||topic.hours<=0||topic.hours>8){issues.push({code:'HOURS_REVIEW',severity:'review',records:[topic.id],message:'Mavzu soatlari noto‘g‘ri.'});continue;}let remaining=topic.hours,part=0;while(remaining>1e-8&&n<rows.length){const row=rows[n],take=Math.min(1-row.allocatedHours,remaining);part+=take;remaining-=take;row.allocations||=[];row.allocations.push({topicId:topic.id,title:topic.title,hours:take,part,totalHours:topic.hours,planId:topic.workPlanId,sourceRow:topic.sourceRow});if(!row.topicId)Object.assign(row,{topicId:topic.id,topicHours:topic.hours,source:{...row.source,planId:topic.workPlanId,topicRow:topic.sourceRow}});row.topicTitle=[...new Set(row.allocations.map(v=>v.title))].join(' · ');row.topicPart=part;row.allocatedHours+=take;if(topic.homework&&!row.homework?.includes(topic.homework))row.homework=[row.homework,topic.homework].filter(Boolean).join('\n');allocated.add(topic.id);if(row.allocatedHours>=1-1e-8)n++;}if(remaining>1e-8)issues.push({code:'INSUFFICIENT_SLOTS',severity:'error',records:[topic.id],message:'Mavzu soatlari uchun chorakdagi darslar yetmaydi.'});}

  for(const row of rows.filter(r=>!r.topicId)){row.state='needs_review';issues.push({code:'CURRICULUM_MISSING',severity:'review',records:[row.id],message:'Dars bor, tasdiqlangan o‘quv reja/mavzu biriktirilmagan.'});}
 }
 for(const r of preserved)for(const id of r.allocations?.map(a=>a.topicId)|| (r.topicId?[r.topicId]:[]))allocated.add(id);
 for(const t of topics)if(!allocated.has(t.id))issues.push({code:'TOPIC_UNSCHEDULED',severity:'review',records:[t.id],message:'Mavzu uchun mos jadval yoki tasdiqlangan fan/soha mappingi topilmadi.'});
 if(history){const ids=new Set(preserved.map(r=>r.id));const closedKeys=new Set(preserved.map(r=>[r.date,r.classId,r.startTime,r.groupId||r.groupNumber||''].join('|')));for(let i=occurrences.length-1;i>=0;i--)if(ids.has(occurrences[i].id)||closedKeys.has([occurrences[i].date,occurrences[i].classId,occurrences[i].startTime,occurrences[i].groupId||occurrences[i].groupNumber||''].join('|')))occurrences.splice(i,1);occurrences.push(...preserved.map(r=>({...r,batchId})));}
 return{occurrences,issues,summary:{occurrences:occurrences.length,allocatedHours:occurrences.reduce((n,v)=>n+v.allocatedHours,0),unmappedSlots:occurrences.filter(v=>!v.topicId).length,topics:topics.length,scheduledTopics:new Set(occurrences.flatMap(r=>r.allocations?.map(a=>a.topicId)|| (r.topicId?[r.topicId]:[]))).size,confirmedDates:calendar.status==='approved'?occurrences.filter(v=>v.state==='planned').length:0,taught:occurrences.filter(r=>r.state==='taught').length,preservedHistory:preserved.length,unconfirmedPast:preserved.filter(r=>r.date<(history?.from||'')&&!['taught','cancelled','replaced'].includes(r.state)).length}};
}

/** Read-only proposal; completed history cannot enter the shifting queue. */
export function proposePostponement(rows:DatedLesson[],id:string,nextDate:string,reason:string){
 if(!dateOnly(nextDate)||reason.trim().length<8)throw Error('Yangi sana va asos kerak.');const target=rows.find(v=>v.id===id);if(!target||nextDate<=target.date||!target.topicId||['taught','cancelled','replaced'].includes(target.state))throw Error('Ko‘chirish kelajakdagi sana uchun; o‘tilgan yoki mavzusiz dars tarixini o‘zgartirish mumkin emas.');
 const lane=rows.filter(v=>v.classId===target.classId&&v.subject===target.subject&&v.curriculumArea===target.curriculumArea&&(v.groupId||v.groupNumber)===(target.groupId||target.groupNumber)&&v.quarter===target.quarter&&v.date>=target.date&&!['taught','cancelled','replaced'].includes(v.state)).sort((a,b)=>a.date.localeCompare(b.date)||a.period-b.period);const slots=lane.filter(v=>v.date>=nextDate);if(slots.length<lane.filter(v=>v.topicId).length)throw Error('Ko‘chirish uchun yetarli bo‘sh dars yo‘q. Qo‘shimcha dars yoki reja tasdig‘i kerak.');
 return{reason,originalId:id,changes:lane.filter(v=>v.topicId).map((v,i)=>({fromId:v.id,toId:slots[i].id,fromDate:v.date,toDate:slots[i].date,topicId:v.topicId,revision:v.revision,targetRevision:slots[i].revision})),historyPreserved:true};
}
