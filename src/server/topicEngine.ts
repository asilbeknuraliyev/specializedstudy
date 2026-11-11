import crypto from 'node:crypto';
import {z} from 'zod';

export const bankQuestion=z.object({
 id:z.string().max(100).optional(),revision:z.number().int().optional(),
 kind:z.enum(['single','multiple','short','matching','ordering','blank','written']),
 prompt:z.string().trim().min(3).max(12000),options:z.array(z.string().trim().min(1).max(1000)).max(20).default([]),
 labels:z.array(z.string().trim().max(1000)).max(12).default([]),key:z.string().max(8000),
 accepted:z.array(z.string().max(1000)).max(20).default([]),explanation:z.string().max(5000).default(''),
 hint:z.string().max(2000).default(''),hints:z.array(z.string().trim().min(1).max(2000)).max(3).default([]),
 wrongFeedback:z.record(z.string().max(1000),z.string().max(1000)).default({}),
 source:z.object({title:z.string().trim().max(300),page:z.string().trim().max(40).default('')}).optional(),
 points:z.number().min(0.5).max(100),difficulty:z.enum(['easy','medium','hard']).default('medium'),
 sourceImages:z.array(z.string().max(700000).regex(/^data:image\/(png|jpeg);base64,[a-zA-Z0-9+/=]+$/)).max(10).default([]),
 image:z.string().max(700000).refine(s=>!s||/^data:image\/(png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(s)).default(''),
}).superRefine((q,c)=>{
 const issue=(message:string)=>c.addIssue({code:'custom',message});
 if(q.options.some(o=>o.includes('|')))issue('Variant ichida | belgisi ishlatilmasin.');
 if(new Set(q.options.map(norm)).size!==q.options.length)issue('Variantlar takrorlanmasin.');
 if(['single','multiple','ordering','matching'].includes(q.kind)&&q.options.length<2)issue('Kamida ikki variant kiriting.');
 if(q.kind!=='written'&&!q.key.trim())issue('Javob kaliti majburiy.');
 if(q.kind==='single'&&!q.options.includes(q.key))issue('To‘g‘ri javob variantlardan bo‘lsin.');
 if(['multiple','matching','ordering'].includes(q.kind)&&q.key.split('|').some(k=>!q.options.includes(k)))issue('Kalit variantlarga mos bo‘lsin.');
 if(q.kind==='matching'&&(q.labels.length<2||q.key.split('|').length!==q.labels.length))issue('Har bir juftlik uchun kalit kiriting.');
 if(q.kind==='ordering'&&(q.key.split('|').length!==q.options.length||new Set(q.key.split('|')).size!==q.options.length))issue('Tartib kaliti barcha variantlarni o‘z ichiga olsin.');
 if(Object.keys(q.wrongFeedback).length>20||Object.keys(q.wrongFeedback).some(o=>!q.options.includes(o)))issue('Noto‘g‘ri variant izohi mavjud variantga tegishli bo‘lsin.');
});
export type PublicationStatus='draft'|'review'|'published'|'archived';
export type BankQuestion=z.infer<typeof bankQuestion>&{
 id:string;institutionId:string;schoolId?:string;lessonId:string;revision:number;status:PublicationStatus;
 approval?:{by:string;at:string;revision:number};
};
export type TopicTest={
 id:string;institutionId:string;schoolId?:string;lessonId:string;classIds?:string[];title:string;status:PublicationStatus;version:number;
 questionIds:string[];snapshot:BankQuestion[];count:number;durationMinutes:number;maxAttempts:number;passPercent:number;
 trackExits:boolean;release:'immediate'|'review';shuffle:boolean;confidenceEnabled?:boolean;updatedAt?:string;createdBy?:string;
};
export type TopicQuestionVersion={id:string;schoolId:string;questionId:string;revision:number;question:BankQuestion;createdAt:string};
export type TopicTestVersion={id:string;schoolId:string;testId:string;version:number;test:TopicTest;createdAt:string};
export type Confidence='low'|'medium'|'high';
export type TopicResult={id:string;earned:number;points:number;explanation:string;pending:boolean;teacherComment?:string;gradedBy?:string;gradedAt?:string};
export type TopicSession={
 id:string;institutionId:string;schoolId?:string;studentId:string;classId?:string;testId:string;version:number;lessonId?:string;
 title?:string;subject?:string;release?:string;trackExits?:boolean;passPercent?:number;confidenceEnabled?:boolean;
 questions:BankQuestion[];answers:Record<string,string>;flags:string[];revision:number;startedAt:string;deadlineAt?:string;
 submittedAt?:string;score?:number;maxScore:number;pending:boolean;results?:TopicResult[];
 confidence?:Record<string,Confidence>;hintsUsed?:Record<string,number>;timeSpentMs?:Record<string,number>;
 operations?:string[];events:Array<{id:string;type:string;at:string}>;
};
export type ReviewRecord={id:string;institutionId:string;schoolId?:string;studentId:string;question:BankQuestion;answer:string;dueAt:string;streak:number;status:'due'|'mastered';lastOperation?:string;lastCorrect?:boolean};
export function norm(s:string){return s.trim().toLowerCase().replace(/\s+/g,' ');}
export function gradeQuestion(q:BankQuestion,answer:string){
 if(q.kind==='written')return 0;
 if(q.kind==='multiple'){const list=(s:string)=>[...new Set(s.split('|').map(norm).filter(Boolean))].sort().join('|');return list(answer)===list(q.key)?q.points:0;}
 return[q.key,...(q.accepted||[])].some(a=>norm(a)===norm(answer))?q.points:0;
}
export function shuffle<T>(list:T[]){const a=[...list];for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function questionHints(q:BankQuestion){return q.hints?.length?q.hints:q.hint?[q.hint]:[];}
export function publicationWarnings(q:BankQuestion){return q.source?.title?.trim()?[]:['Manba ko‘rsatilmagan.'];}
export function approvalErrors(q:BankQuestion){return q.explanation.trim()?[]:['Izoh / yechim majburiy.'];}

// Never spread a private question into a student DTO. Distractor explanations and
// unrevealed hints may reveal a solution as surely as a field named "key".
export function publicQuestion(q:BankQuestion){return{
 id:q.id,revision:q.revision,kind:q.kind,prompt:q.prompt,options:q.options,labels:q.labels,points:q.points,
 difficulty:q.difficulty,image:q.image,sourceImages:q.sourceImages,hintCount:questionHints(q).length,
 };}
export function publicSession(s:TopicSession,release=true){
 const feedback=s.submittedAt&&release?s.results?.map(r=>{
  const q=s.questions.find(q=>q.id===r.id)!;
  const chosen=s.answers[q.id]||'';
  const selected=q.kind==='multiple'?chosen.split('|'):[chosen];
  return{...r,prompt:q.prompt,kind:q.kind,yourAnswer:chosen,correctAnswer:q.kind==='written'?undefined:q.key,
   wrongFeedback:r.earned<r.points?selected.filter(v=>q.wrongFeedback?.[v]).map(v=>q.wrongFeedback[v]):[],
   source:q.source,lessonId:s.lessonId||q.lessonId,sourceHref:'/student/lessons?lesson='+encodeURIComponent(s.lessonId||q.lessonId),
   confidence:s.confidence?.[q.id],confidentWrong:q.kind!=='written'&&r.earned<r.points&&s.confidence?.[q.id]==='high',
   hintsUsed:s.hintsUsed?.[q.id]||0,timeSpentMs:s.timeSpentMs?.[q.id]||0,
  };
 }):undefined;
 return{id:s.id,testId:s.testId,version:s.version,title:s.title,subject:s.subject,lessonId:s.lessonId,
  questions:s.questions.map(publicQuestion),answers:s.answers,flags:s.flags,revision:s.revision,startedAt:s.startedAt,
  deadlineAt:s.deadlineAt,submittedAt:s.submittedAt,score:s.submittedAt&&release?s.score:undefined,maxScore:s.maxScore,
  pending:s.pending,confidenceEnabled:s.confidenceEnabled,confidence:s.confidence||{},hintsUsed:s.hintsUsed||{},
  revealedHints:Object.fromEntries(s.questions.map(q=>[q.id,questionHints(q).slice(0,s.hintsUsed?.[q.id]||0)])),
  timeSpentMs:s.timeSpentMs||{},results:feedback,events:s.events,
 };
}
