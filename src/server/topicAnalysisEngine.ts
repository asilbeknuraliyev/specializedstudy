import {AnalysisCache} from './analysisCache';
import crypto from 'node:crypto';
import type {PersistentDatabaseState} from './dbEngine';
import {gradeQuestion,type BankQuestion,type TopicSession} from './topicEngine';

export type AnalysisResponse={questionId:string;revision:number;correct:boolean;answer:string;confidence?:string;assisted:boolean;restScore:number|null};
export type AnalysisFact={id:string;schoolId:string;studentId:string;classId:string;lessonId:string;subject:string;testId:string;testVersion:number;title:string;submittedAt:string;autoCorrect:number;autoTotal:number;responses:AnalysisResponse[]};
export type ItemAnalysis={id:string;questionId:string;revision:number;n:number;correctCount:number|null;correctRate:number|null;assistedCount:number;options:Array<{label:string;count:number;rate:number;correct:boolean}>;topWrong?:string;topWrongRate?:number;discrimination:number|null;groups?:{size:number;upperCorrect:number;lowerCorrect:number};groupNotice?:string;flags:string[]};
export type AnalysisCohort={id:string;schoolId:string;classId:string;lessonId:string;subject:string;testId:string;testVersion:number;revision:number;updatedAt:string;items:ItemAnalysis[];observations:number;meanCorrect:number};
export const MIN_ANALYSIS_STUDENTS=5;
export const cohortId=(f:Pick<AnalysisFact,'schoolId'|'classId'|'testId'|'testVersion'>)=>[f.schoolId,f.classId,f.testId,f.testVersion].map(String).map(encodeURIComponent).join(':');
export const itemId=(context:string,qid:string,revision:number)=>[context,encodeURIComponent(qid),revision].join(':');
export function firstAnalysisFacts(facts:AnalysisFact[]){
 const first=new Map<string,AnalysisFact>();
 for(const f of [...facts].sort((a,b)=>a.submittedAt.localeCompare(b.submittedAt)||a.id.localeCompare(b.id))){const key=cohortId(f)+':'+encodeURIComponent(f.studentId);if(!first.has(key))first.set(key,f);}
 return [...first.values()];
}
export function analysisQuestion(db:PersistentDatabaseState,schoolId:string,id:string,revision:number){return db.topicQuestionVersions?.find(v=>v.schoolId===schoolId&&v.questionId===id&&v.revision===revision)?.question;}
// Compare first submissions only, within one class/test-version. The target item
// is excluded from the rest score. Tied cutoffs do not produce a spurious split.
export function calculateItems(facts:AnalysisFact[],questions:BankQuestion[],context:string):ItemAnalysis[]{
 const selected=firstAnalysisFacts(facts);
 return questions.filter(q=>q.kind!=='written').map(q=>{
  const responses=selected.flatMap(f=>f.responses.filter(r=>r.questionId===q.id&&r.revision===q.revision));
  const n=responses.length,correctCount=responses.filter(r=>r.correct).length,enough=n>=MIN_ANALYSIS_STUDENTS;
  const result:ItemAnalysis={id:itemId(context,q.id,q.revision),questionId:q.id,revision:q.revision,n,correctCount:enough?correctCount:null,correctRate:enough?correctCount/n:null,assistedCount:responses.filter(r=>r.assisted).length,options:[],discrimination:null,flags:[]};
  if(!enough){result.groupNotice='Kamida 5 nafar o‘quvchi kerak.';return result;}
  const keys=q.key.split('|'),isChoice=['single','multiple'].includes(q.kind);
  if(isChoice){
   result.options=q.options.map(label=>{const count=responses.filter(r=>r.answer.split('|').includes(label)).length;return{label,count,rate:count/n,correct:keys.includes(label)};});
   const wrong=result.options.filter(o=>!o.correct&&o.count>0).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label));
   if(wrong[0]){result.topWrong=wrong.filter(o=>o.count===wrong[0].count).map(o=>o.label).join(' / ');result.topWrongRate=wrong[0].rate;}
  }
  const sorted=[...responses].filter(r=>r.restScore!==null).sort((a,b)=>a.restScore!-b.restScore!),size=Math.ceil(n*0.27);
  if(sorted.length!==n)result.groupNotice='Qolgan kamida 2 ta avtomatik savol bo‘yicha natija kerak.';
  else if(sorted[n-size].restScore!<=sorted[size-1].restScore!)result.groupNotice='Chegara ballari teng: yuqori/quyi guruhni ishonchli ajratib bo‘lmadi.';
  else{
   const upper=sorted.slice(-size),lower=sorted.slice(0,size),upperCorrect=upper.filter(r=>r.correct).length/size,lowerCorrect=lower.filter(r=>r.correct).length/size;
   result.discrimination=upperCorrect-lowerCorrect;result.groups={size,upperCorrect,lowerCorrect};
   if(isChoice&&result.options.filter(o=>!o.correct).some(o=>upper.filter(r=>r.answer.split('|').includes(o.label)).length/size>upperCorrect))result.flags.push('key_review');
   if(result.discrimination<0&&!result.flags.includes('key_review'))result.flags.push('key_review');
   if(n>=10&&Math.abs(result.discrimination)<0.1&&result.correctRate!>=0.2&&result.correctRate!<=0.95)result.flags.push('clarity_review');
  }
  if(result.correctRate!>0.95)result.flags.push('very_easy');
  if(result.correctRate!<0.2)result.flags.push('very_hard');
  return result;
 });
}
export function recordTopicAnalysis(db:PersistentDatabaseState,s:TopicSession,now=new Date()){
 if(!s.submittedAt||db.topicAnalysisFacts?.some(f=>f.id===s.id))return false;
 const lesson=db.lessons.find(l=>l.id===(s.lessonId||s.questions[0]?.lessonId)&&l.institutionId===s.institutionId);
 const classId=s.classId;if(!lesson||!classId||s.schoolId&&s.schoolId!==s.institutionId)return false;
 const questions=s.questions.filter(q=>q.kind!=='written'&&q.institutionId===s.institutionId&&(!q.schoolId||q.schoolId===s.institutionId)&&q.status==='published'&&q.approval?.revision===q.revision);
 if(!questions.length)return false;
 const correctness=new Map(questions.map(q=>[q.id,gradeQuestion(q,s.answers[q.id]||'')===q.points])),autoCorrect=[...correctness.values()].filter(Boolean).length;
 db.topicQuestionVersions||=[];
 for(const q of questions)if(!analysisQuestion(db,s.institutionId,q.id,q.revision))db.topicQuestionVersions.push({id:q.id+':'+q.revision,schoolId:s.institutionId,questionId:q.id,revision:q.revision,question:structuredClone(q),createdAt:now.toISOString()});
 const f:AnalysisFact={id:s.id,schoolId:s.institutionId,studentId:s.studentId,classId,lessonId:lesson.id,subject:lesson.subjectName||lesson.subject||'',testId:s.testId,testVersion:s.version,title:s.title||'Mavzu testi',submittedAt:s.submittedAt,autoCorrect,autoTotal:questions.length,responses:questions.map(q=>({questionId:q.id,revision:q.revision,answer:s.answers[q.id]||'',correct:correctness.get(q.id)!,confidence:s.confidence?.[q.id],assisted:!!s.hintsUsed?.[q.id],restScore:questions.length>=3?(autoCorrect-Number(correctness.get(q.id)))/(questions.length-1):null}))};
 db.topicAnalysisFacts||=[];db.topicAnalysisFacts.push(f);
 const id=cohortId(f),facts=db.topicAnalysisFacts.filter(f=>cohortId(f)===id),first=firstAnalysisFacts(facts),qrefs=new Map(facts.flatMap(f=>f.responses.map(r=>[r.questionId+':'+r.revision,analysisQuestion(db,f.schoolId,r.questionId,r.revision)!] as const)));
 db.topicAnalysisCohorts||=[];const old=db.topicAnalysisCohorts.find(c=>c.id===id);
 const report:AnalysisCohort={id,schoolId:f.schoolId,classId,lessonId:f.lessonId,subject:f.subject,testId:f.testId,testVersion:f.testVersion,revision:(old?.revision||0)+1,updatedAt:now.toISOString(),items:calculateItems(facts,[...qrefs.values()].filter(Boolean),id),observations:first.length,meanCorrect:first.reduce((n,f)=>n+f.autoCorrect/f.autoTotal,0)/first.length};
 if(old)Object.assign(old,report);else db.topicAnalysisCohorts.push(report);return true;
}
// Bounded cache for date-filtered first-attempt statistics. Grades and all-time
// cohort summaries are persisted when submitting, not recalculated by GET.
const filteredCache=new AnalysisCache<ItemAnalysis[]>(4*1024*1024,1024*1024,40);
export function cachedAnalysisItems(cohort:AnalysisCohort,facts:AnalysisFact[],questions:BankQuestion[],from:string,to:string,salt=''){
 const allInRange=facts.every(f=>inAnalysisRange(f.submittedAt,from,to));
 if(allInRange)return cohort.items;
 const key=crypto.createHash('sha256').update(JSON.stringify([process.env.PERSISTENCE_NAMESPACE,salt,cohort.id,cohort.revision,from,to])).digest('hex'),old=filteredCache.get(key);
 if(old)return old;
 const items=calculateItems(facts.filter(f=>inAnalysisRange(f.submittedAt,from,to)),questions,cohort.id);
 filteredCache.set(key,items);return items;
}
export function inAnalysisRange(timestamp:string,from:string,to:string){const d=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(timestamp));return d>=from&&d<=to;}
