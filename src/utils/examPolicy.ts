import type { Assessment, UserProfile } from '../types';
import type { ExamSession } from '../examTypes';
export function canTakeExam(user:UserProfile,exam:Assessment):boolean {
 if(user.role!=='student'||user.status!=='active'||user.institutionId!==exam.institutionId)return false;
 return Boolean((user.classId && [exam.classId,...(exam.assignedClassIds||[])].includes(user.classId)) || (user.classCode && [exam.classCode,...(exam.assignedClassCodes||[])].includes(user.classCode as any)));
}
export function examDeadline(exam:Assessment,session:ExamSession,now=Date.now()):number {
 const extension=(exam.totalPausedMs||0)-session.pauseAtStart+(exam.examState==='paused'&&exam.pausedAt?Math.max(0,now-Date.parse(exam.pausedAt)):0);
 return Math.min(Date.parse(session.deadlineAt)+extension,Date.parse(exam.dueDate));
}
export function examCanStart(exam:Assessment,now=Date.now()):boolean {
 return exam.status==='published' && (exam.examState==='open'||exam.examState==='scheduled') && now>=Date.parse(exam.availableFrom||exam.createdAt) && now<Date.parse(exam.dueDate);
}
export function validateExamForPublish(exam:Assessment):string[] {
 const errors:string[]=[];const questions=exam.questionSnapshot||[];
 if(!questions.length)errors.push('Savollar yo‘q.');
 if(!Number.isFinite(Date.parse(exam.availableFrom||''))||!Number.isFinite(Date.parse(exam.dueDate))||Date.parse(exam.availableFrom!)>=Date.parse(exam.dueDate))errors.push('Boshlanish va tugash vaqtini tekshiring.');
 if(!exam.assignedClassCodes?.length)errors.push('Kamida bitta sinf tanlang.');
 for(const [i,q] of questions.entries()){
  if(!q.prompt.trim()||!q.points||q.points<=0)errors.push(`${i+1}-savol matni yoki bali noto‘g‘ri.`);
  if(q.type==='single_choice') {if((q.options?.length||0)<2||!q.options?.includes(q.correctAnswer))errors.push(`${i+1}-savolning variantlari va javob kalitini tekshiring.`);}
  else if(!q.rubricText?.trim())errors.push(`${i+1}-savolga baholash mezonini yozing.`);
  if(exam.examKind==='CHSB'&&q.type!=='single_choice')errors.push('CHSB savollari variantli bo‘lishi kerak.');
 }
 return errors;
}
export function sanitizeExamQuestion<T extends Record<string,any>>(q:T):T {
 return {...q,correctAnswer:'',correctAnswers:undefined,acceptedAnswers:undefined,rubricText:undefined,explanation:'',optionItems:q.optionItems?.map((o:any)=>({...o,isCorrect:false})),structuredOptions:q.structuredOptions?.map((o:any)=>({...o,isCorrect:false}))};
}
