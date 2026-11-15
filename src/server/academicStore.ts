import {studyRpc} from './supabaseClient';
import {runtimeNamespace} from './runtimeScope';
import type {DatedLesson} from '../utils/academicPlanning';
export type AcademicQuery={school:string;year:string;from:string;to:string;classes?:string[];teacher?:string;groups?:string[];after?:string;limit?:number};
export interface AcademicStore{
 list(q:AcademicQuery):Promise<{batchId?:string;mutationRevision?:number;total:number;rows:DatedLesson[];next?:string}>;
 get(school:string,year:string,id:string):Promise<DatedLesson|undefined>;
 stage(school:string,year:string,id:string,digest:string,count:number,actor:string):Promise<any>;
 write(school:string,batch:string,rows:DatedLesson[]):Promise<any>;
 activate(school:string,year:string,batch:string,previous:string|undefined,actor:string,previousRevision?:number):Promise<any>;
 transition(school:string,year:string,id:string,revision:number,operation:string,actor:string,patch:Record<string,unknown>):Promise<{row:DatedLesson;before:DatedLesson}>;
 progress(q:Pick<AcademicQuery,'school'|'year'|'classes'|'teacher'|'groups'>):Promise<any[]>;
 replan(school:string,year:string,operation:string,actor:string,reason:string,changes:any[]):Promise<any>;
 preview(school:string,batch:string,page:number,query:string):Promise<any>;
 receipt(school:string,actor:string,operation:string):Promise<any>;
}
export class SupabaseAcademicStore implements AcademicStore{
 list(q:AcademicQuery){return studyRpc<any>('study_academic_list',{p_namespace:runtimeNamespace(),p_school:q.school,p_year:q.year,p_from:q.from,p_to:q.to,p_classes:q.classes??null,p_teacher:q.teacher??null,p_groups:q.groups??null,p_after:q.after||'',p_limit:q.limit||100});}
 get(school:string,year:string,id:string){return studyRpc<any>('study_academic_get',{p_namespace:runtimeNamespace(),p_school:school,p_year:year,p_id:id});}
 stage(school:string,year:string,id:string,digest:string,count:number,actor:string){return studyRpc('study_academic_stage',{p_namespace:runtimeNamespace(),p_school:school,p_year:year,p_id:id,p_digest:digest,p_count:count,p_actor:actor});}
 write(school:string,batch:string,rows:DatedLesson[]){return studyRpc('study_academic_write',{p_namespace:runtimeNamespace(),p_school:school,p_batch:batch,p_rows:rows});}
 activate(school:string,year:string,batch:string,previous:string|undefined,actor:string,previousRevision?:number){return studyRpc('study_academic_activate',{p_namespace:runtimeNamespace(),p_school:school,p_year:year,p_batch:batch,p_previous:previous||null,p_actor:actor,p_previous_revision:previousRevision||0});}
 transition(school:string,year:string,id:string,revision:number,operation:string,actor:string,patch:Record<string,unknown>){return studyRpc<any>('study_academic_transition',{p_namespace:runtimeNamespace(),p_school:school,p_year:year,p_id:id,p_revision:revision,p_operation:operation,p_actor:actor,p_patch:patch});}
 progress(q:Pick<AcademicQuery,'school'|'year'|'classes'|'teacher'|'groups'>){return studyRpc<any[]>('study_academic_progress',{p_namespace:runtimeNamespace(),p_school:q.school,p_year:q.year,p_classes:q.classes??null,p_teacher:q.teacher??null,p_groups:q.groups??null});}
 replan(school:string,year:string,operation:string,actor:string,reason:string,changes:any[]){return studyRpc('study_academic_replan',{p_namespace:runtimeNamespace(),p_school:school,p_year:year,p_operation:operation,p_actor:actor,p_reason:reason,p_changes:changes});}
 preview(school:string,batch:string,page:number,query:string){return studyRpc('study_academic_preview',{p_namespace:runtimeNamespace(),p_school:school,p_batch:batch,p_page:page,p_query:query});}
 receipt(school:string,actor:string,operation:string){return studyRpc('study_academic_receipt',{p_namespace:runtimeNamespace(),p_school:school,p_actor:actor,p_operation:operation});}
}

export function academicAudience(c:any):Pick<AcademicQuery,'classes'|'teacher'|'groups'>{
 if(['platform_owner','admin'].includes(c.user.role)||c.leadership)return{};
 if(c.user.role==='teacher')return{classes:c.user.assignedClassIds||[],teacher:c.user.uid};
 if(c.user.role==='student')return{classes:c.user.classId?[c.user.classId]:[],groups:c.user.teachingGroupIds||[]};return{classes:[]};
}
export function academicRowVisible(c:any,row:DatedLesson){
 if(row.schoolId!==c.user.institutionId)return false;const a=academicAudience(c);
 return(!a.classes||a.classes.includes(row.classId))&&(!a.teacher||a.teacher===row.teacherId)&&(!a.groups||!row.groupId||a.groups.includes(row.groupId));
}
