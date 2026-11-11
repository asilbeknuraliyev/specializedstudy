import crypto from 'node:crypto';
import type {PersistentDatabaseState} from './dbEngine';
import type {UserProfile} from '../types';
import {gradeQuestion,type BankQuestion,type Confidence,type TopicSession} from './topicEngine';

// Calendar days in the school timezone, not elapsed browser hours. A new item is
// due tomorrow at 09:00. Due, independent successes advance one box. Early or
// assisted answers never advance a box. Wrong answers reset to the first box.
// Two independent correct local dates establish notebook mastery; review continues
// after mastery. No points, rewards, loss of streak, or overdue "debt" is added.
export const REVIEW_INTERVALS=[1,3,7,14,30] as const;
export const DAILY_REVIEW_LIMIT=20;
export type MistakeState='new'|'working'|'mastered';
export type MistakeRecord={id:string;schoolId:string;studentId:string;lessonId:string;subject:string;questionId:string;questionRevision:number;state:MistakeState;lastWrongAnswer:string;firstWrongAt:string;lastWrongAt:string;errorType:string;sourceId:string;updatedAt:string};
export type ReviewQueueItem={id:string;schoolId:string;studentId:string;lessonId:string;subject:string;questionId:string;questionRevision:number;level:number;dueAt:string;correctDays:string[];lastExposureDay:string;lastErrorDay?:string;lastAnsweredAt?:string;assistedDay?:string;highConfidenceError:boolean;createdAt:string};
export type ReviewDailyUsage={id:string;schoolId:string;studentId:string;day:string;answered:number;seen:string[]};
export type ReviewSession={id:string;schoolId:string;studentId:string;classId?:string;day:string;subject?:string;mode:'review'|'mistake';items:string[];index:number;revision:number;status:'active'|'completed'|'stopped';startedAt:string;closedAt?:string;startOperationId:string;startSignature:string;draft:{answer:string;confidence?:Confidence};hintsUsed:Record<string,number>;operations:string[]};
export type ReviewAnswer={id:string;operationId:string;schoolId:string;studentId:string;sessionId:string;queueId:string;questionId:string;questionRevision:number;lessonId:string;answer:string;correct:boolean;confidence?:Confidence;assisted:boolean;hintsUsed:number;independent:boolean;day:string;answeredAt:string;nextDueAt:string;level:number;mistakeState?:MistakeState};
export type StudentTopicProgress={id:string;schoolId:string;studentId:string;lessonId:string;subject:string;catalogSignature:string;pool:number;attempted:number;retained:number;unresolved:number;state:'not_started'|'in_progress'|'secure';updatedAt:string};
export type CatalogEntry={question:BankQuestion;lessonId:string;title:string;subject:string};
export type ReviewCatalog=Map<string,CatalogEntry>;
export const reviewId=(schoolId:string,studentId:string,questionId:string,revision:number)=>[schoolId,studentId,questionId,revision].map(String).map(encodeURIComponent).join(':');
export function schoolDay(now:Date){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function nextReviewDate(now:Date,days:number){const d=new Date(schoolDay(now)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)+'T09:00:00+05:00';}
export function allowedReviewCatalog(db:PersistentDatabaseState,user:UserProfile):ReviewCatalog{
 const school=user.institutionId,year=(db.institutions||[]).find(i=>i.id===school)?.academicYear;
 const lessons=new Map(db.lessons.filter(l=>l.institutionId===school&&(!(l as any).schoolId||(l as any).schoolId===school)&&l.status==='published'&&(!year||l.academicYear===year)&&[l.classId,...(l.classIds||[])].includes(user.classId||'')&&(!l.additionalCurriculumAssignment||l.tTrackVisibilityApproved===true)).map(l=>[l.id,l]));
 const result:ReviewCatalog=new Map();
 for(const t of db.topicTests||[]){
  const lesson=lessons.get(t.lessonId);if(!lesson||t.status!=='published'||t.institutionId!==school||t.schoolId&&t.schoolId!==school||t.classIds&&!t.classIds.includes(user.classId||''))continue;
  for(const q of t.snapshot)if(q.kind!=='written'&&q.status==='published'&&q.approval?.revision===q.revision&&q.institutionId===school&&(!q.schoolId||q.schoolId===school)&&q.lessonId===lesson.id){
   const id=reviewId(school,user.uid,q.id,q.revision);result.set(id,{question:q,lessonId:lesson.id,title:lesson.topicTitle||lesson.title,subject:lesson.subjectName||lesson.subject||''});
  }
 }
 const latest=new Map<string,number>();for(const {question:q}of result.values())latest.set(q.id,Math.max(latest.get(q.id)||0,q.revision));
 for(const [id,{question:q}]of result)if(q.revision!==latest.get(q.id))result.delete(id);
 return result;
}
export function dailyUsage(db:PersistentDatabaseState,user:UserProfile,now:Date,create=false){
 const day=schoolDay(now),id=[user.institutionId,user.uid,day].map(encodeURIComponent).join(':');
 let record=db.reviewDailyUsage?.find(r=>r.id===id&&r.schoolId===user.institutionId&&r.studentId===user.uid);
 if(!record){record={id,schoolId:user.institutionId,studentId:user.uid,day,answered:0,seen:[]};if(create){db.reviewDailyUsage||=[];db.reviewDailyUsage.push(record);}}
 return record;
}
export function errorType(q:BankQuestion,answer:string){if(!answer.replaceAll('|','').trim())return 'unanswered';return ['single','multiple'].includes(q.kind)?'choice':q.kind==='matching'?'matching':q.kind==='ordering'?'ordering':'short_answer';}
function ensureQuestionVersion(db:PersistentDatabaseState,q:BankQuestion,now:Date){
 db.topicQuestionVersions||=[];if(!db.topicQuestionVersions.some(v=>v.schoolId===q.institutionId&&v.questionId===q.id&&v.revision===q.revision))db.topicQuestionVersions.push({id:q.id+':'+q.revision,schoolId:q.institutionId,questionId:q.id,revision:q.revision,question:structuredClone(q),createdAt:now.toISOString()});
}
export function cachedProgress(db:PersistentDatabaseState,user:UserProfile,catalog:ReviewCatalog,lessonId:string,now:Date){
 const entries=[...catalog.entries()].filter(([,e])=>e.lessonId===lessonId);if(!entries.length)return;
 const ids=new Set(entries.map(([id])=>id));
 const queue=(db.spacedReviewQueue||[]).filter(q=>q.schoolId===user.institutionId&&q.studentId===user.uid&&ids.has(q.id));
 const unresolved=(db.mistakeRecords||[]).filter(m=>m.schoolId===user.institutionId&&m.studentId===user.uid&&ids.has(m.id)&&m.state!=='mastered').length;
 const retained=queue.filter(q=>q.correctDays.length>=2).length;
 const record:StudentTopicProgress={id:[user.institutionId,user.uid,lessonId].map(encodeURIComponent).join(':'),schoolId:user.institutionId,studentId:user.uid,lessonId,subject:entries[0][1].subject,catalogSignature:catalogSignature(entries.map(([id])=>id)),pool:entries.length,attempted:queue.length,retained,unresolved,state:queue.length===0?'not_started':entries.length>=3&&retained/entries.length>=0.8&&unresolved===0?'secure':'in_progress',updatedAt:now.toISOString()};
 db.studentTopicProgress||=[];const old=db.studentTopicProgress.find(p=>p.id===record.id);if(old)Object.assign(old,record);else db.studentTopicProgress.push(record);
}
export function catalogSignature(ids:string[]){return crypto.createHash('sha256').update([...ids].sort().join('\n')).digest('hex');}
export function recordTopicLearning(db:PersistentDatabaseState,user:UserProfile,session:TopicSession,now=new Date()){
 if(session.reviewRecordedAt||!session.submittedAt)return;
 const catalog=allowedReviewCatalog(db,user),touched=new Set<string>(),day=schoolDay(now);
 db.spacedReviewQueue||=[];db.mistakeRecords||=[];
 for(const q of session.questions){
  const id=reviewId(user.institutionId,user.uid,q.id,q.revision),entry=catalog.get(id);if(!entry)continue;
  ensureQuestionVersion(db,q,now);touched.add(entry.lessonId);
  let item=db.spacedReviewQueue.find(r=>r.id===id);
  if(!item){item={id,schoolId:user.institutionId,studentId:user.uid,lessonId:entry.lessonId,subject:entry.subject,questionId:q.id,questionRevision:q.revision,level:0,dueAt:nextReviewDate(now,1),correctDays:[],lastExposureDay:day,highConfidenceError:false,createdAt:now.toISOString()};db.spacedReviewQueue.push(item);}
  item.lastExposureDay=day;
  if(gradeQuestion(q,session.answers[q.id]||'')<q.points){
   item.correctDays=[];item.level=0;item.dueAt=nextReviewDate(now,1);item.lastErrorDay=day;item.highConfidenceError=session.confidence?.[q.id]==='high';
   const old=db.mistakeRecords.find(m=>m.id===id);
   const record:MistakeRecord={id,schoolId:user.institutionId,studentId:user.uid,lessonId:entry.lessonId,subject:entry.subject,questionId:q.id,questionRevision:q.revision,state:old?.state==='new'?'new':old?'working':'new',lastWrongAnswer:session.answers[q.id]||'',firstWrongAt:old?.firstWrongAt||now.toISOString(),lastWrongAt:now.toISOString(),errorType:errorType(q,session.answers[q.id]||''),sourceId:session.id,updatedAt:now.toISOString()};
   if(old)Object.assign(old,record);else db.mistakeRecords.push(record);
  }
 }
 for(const lessonId of touched)cachedProgress(db,user,catalog,lessonId,now);
 session.reviewRecordedAt=now.toISOString();
}
export function selectReviewItems(items:ReviewQueueItem[],catalog:ReviewCatalog,seen:string[],now:Date,limit:number,subject?:string){
 const eligible=items.filter(i=>catalog.has(i.id)&&!seen.includes(i.id)&&Date.parse(i.dueAt)<=now.getTime()&&(!subject||i.subject===subject));
 // Importance is bounded: a month of absence is not a month of "debt". Round
 // robin by topic interleaves subjects where possible without promising an
 // impossible alternation when just one topic remains.
 eligible.sort((a,b)=>Number(b.highConfidenceError)-Number(a.highConfidenceError)||Math.min(14,Math.floor((now.getTime()-Date.parse(b.dueAt))/86400000))-Math.min(14,Math.floor((now.getTime()-Date.parse(a.dueAt))/86400000))||a.dueAt.localeCompare(b.dueAt)||a.id.localeCompare(b.id));
 const buckets=new Map<string,ReviewQueueItem[]>();for(const item of eligible){const key=item.subject+':'+item.lessonId;const b=buckets.get(key)||[];b.push(item);buckets.set(key,b);}
 const chosen:ReviewQueueItem[]=[],keys=[...buckets.keys()];let previous='';
 while(chosen.length<limit){const candidates=keys.filter(k=>buckets.get(k)!.length);if(!candidates.length)break;const key=candidates.find(k=>k!==previous)||candidates[0];chosen.push(buckets.get(key)!.shift()!);previous=key;keys.splice(keys.indexOf(key),1);keys.push(key);}
 return chosen;
}
export function reviewSummary(db:PersistentDatabaseState,user:UserProfile,now=new Date(),catalog=allowedReviewCatalog(db,user)){
 const usage=dailyUsage(db,user,now),queue=(db.spacedReviewQueue||[]).filter(q=>q.schoolId===user.institutionId&&q.studentId===user.uid&&catalog.has(q.id));
 const available=queue.filter(q=>Date.parse(q.dueAt)<=now.getTime()&&!usage.seen.includes(q.id));
 const remaining=Math.max(0,DAILY_REVIEW_LIMIT-usage.answered);
 const mistakes=(db.mistakeRecords||[]).filter(m=>m.schoolId===user.institutionId&&m.studentId===user.uid&&catalog.has(m.id));
 return{day:schoolDay(now),today:Math.min(remaining,available.length),dailyDone:usage.answered,dailyLimit:DAILY_REVIEW_LIMIT,remaining,mistakes:mistakes.filter(m=>m.state!=='mastered').length,mastered:mistakes.filter(m=>m.state==='mastered').length,subjects:[...new Set([...catalog.values()].map(e=>e.subject))].sort(),activeSessionId:db.spacedReviewSessions?.find(s=>s.schoolId===user.institutionId&&s.studentId===user.uid&&s.classId===user.classId&&s.status==='active'&&s.day===schoolDay(now))?.id,nextDueAt:queue.filter(q=>Date.parse(q.dueAt)>now.getTime()).sort((a,b)=>a.dueAt.localeCompare(b.dueAt))[0]?.dueAt};
}
export function applyReviewAnswer(db:PersistentDatabaseState,user:UserProfile,item:ReviewQueueItem,q:BankQuestion,answer:string,session:ReviewSession,operationId:string,confidence:Confidence|undefined,hintsUsed:number,now:Date):ReviewAnswer{
 const day=schoolDay(now),correct=gradeQuestion(q,answer)===q.points,assisted=hintsUsed>0||item.assistedDay===day||item.lastExposureDay===day;
 const independent=correct&&!assisted&&!item.correctDays.includes(day),wasDue=Date.parse(item.dueAt)<=now.getTime();
 if(!correct){item.correctDays=[];item.level=0;item.dueAt=nextReviewDate(now,1);item.lastErrorDay=day;item.highConfidenceError=confidence==='high';}
 else if(independent){item.correctDays=[...item.correctDays,day].slice(-2);if(wasDue){item.level=Math.min(REVIEW_INTERVALS.length-1,item.level+1);item.dueAt=nextReviewDate(now,REVIEW_INTERVALS[item.level]);}item.highConfidenceError=false;}
 else if(assisted)item.dueAt=nextReviewDate(now,1);
 item.lastExposureDay=day;item.lastAnsweredAt=now.toISOString();
 db.mistakeRecords||=[];let mistake=db.mistakeRecords.find(m=>m.id===item.id);
 if(!correct){if(!mistake){mistake={id:item.id,schoolId:user.institutionId,studentId:user.uid,lessonId:item.lessonId,subject:item.subject,questionId:q.id,questionRevision:q.revision,state:'new',lastWrongAnswer:answer,firstWrongAt:now.toISOString(),lastWrongAt:now.toISOString(),errorType:errorType(q,answer),sourceId:session.id,updatedAt:now.toISOString()};db.mistakeRecords.push(mistake);}Object.assign(mistake,{state:'working',lastWrongAnswer:answer,lastWrongAt:now.toISOString(),errorType:errorType(q,answer),sourceId:session.id,updatedAt:now.toISOString()});}
 else if(mistake){mistake.state=item.correctDays.length>=2?'mastered':'working';mistake.updatedAt=now.toISOString();}
 const record:ReviewAnswer={id:session.id+':'+item.id,operationId,schoolId:user.institutionId,studentId:user.uid,sessionId:session.id,queueId:item.id,questionId:q.id,questionRevision:q.revision,lessonId:item.lessonId,answer,correct,confidence,assisted,hintsUsed,independent,day,answeredAt:now.toISOString(),nextDueAt:item.dueAt,level:item.level,mistakeState:mistake?.state};
 db.spacedReviewAnswers||=[];db.spacedReviewAnswers.push(record);return record;
}
