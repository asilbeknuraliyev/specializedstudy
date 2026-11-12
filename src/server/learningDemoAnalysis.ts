import crypto from 'node:crypto';
import type {PersistentDatabaseState} from './dbEngine';
import type {LearningDemo} from './learningDemoRoutes';
import {gradeQuestion,type TopicSession} from './topicEngine';
import {recordTopicLearning} from './spacedReviewEngine';
import {recordTopicAnalysis} from './topicAnalysisEngine';

// Explicitly synthetic teaching/demo data. Only a fresh, owner-created preview
// lab is eligible. No existing attempt or real account is overwritten.
export function seedLearningDemoAnalysis(db:PersistentDatabaseState,d:LearningDemo,now=new Date()){
 if(d.analysisSeededAt)return{created:false,students:13,attempts:62};
 const lessons=db.lessons.filter(l=>d.lessonIds.includes(l.id)&&l.institutionId===d.schoolId),tests=(db.topicTests||[]).filter(t=>d.lessonIds.includes(t.lessonId)&&t.institutionId===d.schoolId&&t.status==='published');
 const primary=db.users.find(u=>d.userIds.includes(u.uid)&&u.displayName==='DEMO O‘quvchi'&&u.role==='student'&&u.institutionId===d.schoolId);
 if(!primary||lessons.length!==6||tests.length!==6||new Set(tests.map(t=>t.lessonId)).size!==6||tests.some(t=>t.snapshot.length!==12||t.snapshot.some(q=>q.status!=='published'||q.approval?.revision!==q.revision)))throw Error('Avval yangi, tasdiqlangan DEMO yarating.');
 if(db.topicSessions?.some(s=>d.lessonIds.includes(s.lessonId||'')||d.userIds.includes(s.studentId)))throw Error('Bu DEMO’da ish boshlangan. Uni tozalab, yangi DEMO yarating.');
 const profiles=[primary,...Array.from({length:11},(_,i)=>({...primary,uid:d.id+'-synthetic-'+crypto.randomUUID(),login:'demo_st_'+crypto.randomBytes(5).toString('hex'),email:'demo-synthetic-'+crypto.randomUUID()+'@accounts.specialized.invalid',displayName:'DEMO O‘quvchi '+String(i+2).padStart(2,'0'),createdAt:now.toISOString()}))];
 db.users.push(...profiles.slice(1));d.userIds.push(...profiles.slice(1).map(u=>u.uid));db.topicSessions||=[];
 const make=(test:typeof tests[number],i:number,repeat=false)=>{
  let needed=Math.min(i+1,9);const answers:Record<string,string>={};
  for(const [n,q]of test.snapshot.entries()){
   if(q.kind==='written'){answers[q.id]='DEMO: Yechimni izohlab yozdim. Bu sun’iy namoyish javobi.';continue;}
   const correct=n!==0&&n!==2&&needed>0;if(correct)needed--;
   answers[q.id]=correct?q.key:['single','multiple'].includes(q.kind)?q.options.find(o=>!q.key.split('|').includes(o))||'':q.kind==='ordering'?[...q.key.split('|')].reverse().join('|'):'DEMO xato';
  }
  const at=new Date(now.getTime()+(repeat?1:0)).toISOString();
  const s:TopicSession={id:crypto.randomUUID(),institutionId:d.schoolId,schoolId:d.schoolId,studentId:profiles[i].uid,classId:primary.classId,lessonId:test.lessonId,testId:test.id,version:test.version,title:'DEMO · Sun’iy tahlil · '+test.title,subject:lessons.find(l=>l.id===test.lessonId)?.subjectName,questions:structuredClone(test.snapshot),answers,flags:[],revision:1,startedAt:at,submittedAt:at,maxScore:test.snapshot.reduce((n,q)=>n+q.points,0),pending:true,events:[],confidence:{[test.snapshot[0].id]:'high'},hintsUsed:i===5?{[test.snapshot[0].id]:1}:{},release:'immediate'};
  s.results=s.questions.map(q=>({id:q.id,earned:gradeQuestion(q,answers[q.id]),points:q.points,explanation:q.explanation,pending:q.kind==='written'}));s.score=s.results.reduce((n,r)=>n+r.earned,0);s.pending=s.results.some(r=>r.pending);
  db.topicSessions!.push(s);recordTopicLearning(db,profiles[i],s,new Date(at));recordTopicAnalysis(db,s,now);
 };
 for(const t of tests)for(let i=0;i<10;i++)make(t,i);
 for(const i of [1,2])make(tests[0],i,true);
 d.analysisSeededAt=now.toISOString();return{created:true,students:13,attempts:62};
}
