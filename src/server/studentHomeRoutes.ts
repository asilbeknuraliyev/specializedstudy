import type {Express} from 'express';
import type {PersistentDatabaseState} from './dbEngine';
import type {UserProfile,LessonItem} from '../types';
import {canTakeExam,examCanStart} from '../utils/examPolicy';
export function ownLesson(user:UserProfile,lesson:LessonItem,year:string){return lesson.institutionId===user.institutionId&&lesson.status==='published'&&lesson.academicYear===year&&Boolean((user.classId&&[lesson.classId,...(lesson.classIds||[])].includes(user.classId))||(user.classCode&&[lesson.classCode,...(lesson.classCodes||[])].includes(user.classCode as any)))&&(!lesson.additionalCurriculumAssignment||lesson.tTrackVisibilityApproved===true);}
export function studentHomeData(db:PersistentDatabaseState,user:UserProfile,now=new Date()){
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const weekday=new Date(now.getTime()+5*3600000).getUTCDay();
 const inst=db.institutions.find(i=>i.id===user.institutionId);
 const tables=(db.timetables||[]).filter(t=>t.institutionId===user.institutionId&&t.status==='active'&&(!t.academicYear||t.academicYear===inst?.academicYear)&&(t.classId===user.classId||t.classCode===user.classCode)&&t.effectiveFrom<=date&&(!t.effectiveTo||t.effectiveTo>=date)).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom)||b.version-a.version);
 const selected=tables[0];
 const timetable=(db.timetableEntries||[]).filter(e=>selected&&e.timetableId===selected.id&&e.institutionId===user.institutionId&&e.weekdayIndex===weekday).sort((a,b)=>a.startTime.localeCompare(b.startTime));
 const tasks:Array<{id:string;title:string;subject:string;due:string;kind:'assignment'|'exam';href:string;ready:boolean}>=[];
 for(const a of db.studentAssignments||[]){if(a.institutionId!==user.institutionId||a.status!=='published')continue;const codes=a.targetClassCodes||[],ids=a.targetClassIds||[];if(codes.length||ids.length){if(!codes.includes(user.classCode as any)&&!ids.includes(user.classId||''))continue;}else if(!user.classId)continue;
 const submitted=(db.assignmentSubmissions||[]).some(s=>s.studentId===user.uid&&s.assignmentId===a.id&&Boolean(s.submittedAt||s.submissionDate)&&s.status!=='Qaytarildi');if(!submitted)tasks.push({id:a.id,title:a.title,subject:a.subjectName||a.subject,due:a.dueDate,kind:'assignment',href:'/student/assignments',ready:true});}
 for(const e of db.assessments){if(e.status!=='published'||!canTakeExam(user,e)||!['open','scheduled','paused'].includes(e.examState||'')||Date.parse(e.dueDate)<now.getTime()||db.attempts.some(a=>a.studentId===user.uid&&a.assessmentId===e.id))continue;const ready=examCanStart(e,now.getTime());tasks.push({id:e.id,title:e.title,subject:e.subject||'',due:e.dueDate,kind:'exam',href:ready?`/student/assessments/${e.id}`:'/student/assessments',ready});}
 const demo=db.demoLabs?.find(l=>l.studentId===user.uid);if(demo)for(const e of demo.exams)if(Date.parse(e.due)>now.getTime()&&!demo.responses.some(r=>r.examId===e.id&&r.submittedAt))tasks.push({id:e.id,title:e.title,subject:e.subject,due:e.due,kind:'exam',href:'/student/demo?exam='+e.id,ready:true});
 tasks.sort((a,b)=>a.due.localeCompare(b.due));
 const last=(db.studentLastLessons||[]).find(r=>r.studentId===user.uid&&r.institutionId===user.institutionId);
 const lesson=last&&db.lessons.find(l=>l.id===last.lessonId&&ownLesson(user,l,inst?.academicYear||''));
 return {date,weekday,timetable,tasks,lastLesson:lesson?{id:lesson.id,title:lesson.topicTitle||lesson.title,subject:lesson.subjectName,quarter:lesson.quarter}:null};
}
export function registerStudentHomeRoutes(app:Express,deps:{authenticate:(req:any)=>{user:UserProfile;db:PersistentDatabaseState;env:'prod'|'test'}|null;save:(env:'prod'|'test',db:PersistentDatabaseState)=>void}){
 const student=(req:any,res:any)=>{const c=deps.authenticate(req);if(!c){res.status(401).json({error:'Hisobga kiring.'});return null;}if(c.user.role!=='student'||c.user.status!=='active'){res.status(403).json({error:'Faqat faol o‘quvchi.'});return null;}return c;};
 app.get('/api/student-home',(req,res)=>{const c=student(req,res);if(c)res.json(studentHomeData(c.db,c.user));});
 app.post('/api/student-home/last-open',(req,res)=>{const c=student(req,res);if(!c)return;const year=c.db.institutions.find(i=>i.id===c.user.institutionId)?.academicYear||'';const lesson=c.db.lessons.find(l=>l.id===req.body.lessonId&&ownLesson(c.user,l,year));if(!lesson)return res.status(404).json({error:'Dars topilmadi.'});c.db.studentLastLessons||=[];const last=c.db.studentLastLessons.find(l=>l.studentId===c.user.uid);const now=new Date().toISOString();if(last?.lessonId===lesson.id&&Date.now()-Date.parse(last.openedAt)<60000)return res.json({saved:true});const record={id:c.user.uid,institutionId:c.user.institutionId,studentId:c.user.uid,lessonId:lesson.id,openedAt:now};if(last)Object.assign(last,record);else c.db.studentLastLessons.push(record);deps.save(c.env,c.db);res.json({saved:true});});
}
