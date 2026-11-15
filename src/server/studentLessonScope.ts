import type {UserProfile,LessonItem,ClassRoom} from '../types';
export function studentCanAccessLesson(user:UserProfile,lesson:LessonItem,classes:ClassRoom[]){
 if(user.role!=='student'||user.status!=='active'||lesson.institutionId!==user.institutionId||!['published','in_progress','completed'].includes(lesson.status))return false;
 const own=classes.find(c=>c.institutionId===user.institutionId&&c.status!=='archived'&&(c.id===user.classId||!!user.classCode&&c.code.toLowerCase()===user.classCode.toLowerCase()));
 if(!own||lesson.additionalCurriculumAssignment&&lesson.tTrackVisibilityApproved!==true)return false;
 return lesson.classId===own.id||lesson.classIds?.includes(own.id)||lesson.classCode?.toLowerCase()===own.code.toLowerCase()||!!lesson.classCodes?.some(c=>c.toLowerCase()===own.code.toLowerCase());
}
