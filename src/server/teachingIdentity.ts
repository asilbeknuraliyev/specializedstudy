import type {UserProfile,TeacherAssignment} from '../types';
// Legacy single-subject accounts retain their existing scope. Imported multi-subject
// accounts use explicit class/subject pairs; choosing a subject never widens class access.
export function projectTeachingIdentity(user:UserProfile,assignments:TeacherAssignment[],requested?:string):UserProfile|undefined{
 if(user.role!=='teacher'||!user.sourceImport)return user;
 const mine=assignments.filter(a=>a.teacherId===user.uid&&a.institutionId===user.institutionId);
 if(!mine.length)return requested?undefined:{...user,assignedClassIds:[]};
 const subject=requested||mine.find(a=>a.subject===user.subject)?.subject||mine[0].subject;
 const approved=mine.filter(a=>a.subject===subject);if(!approved.length)return undefined;
 return{...user,subject,subjects:[...new Set(mine.map(a=>a.subject))],assignedClassIds:[...new Set(approved.map(a=>a.classId))]};
}
