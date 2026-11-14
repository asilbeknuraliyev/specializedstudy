import {runtimeNamespace} from './runtimeScope';
import {studyRpc} from './supabaseClient';
import type {ExamSessionStore} from './examSessionStore';
import type {DurableExamSession} from '../utils/examReliability';
export class SupabaseExamSessionStore implements ExamSessionStore{
 constructor(private rpc:typeof studyRpc=studyRpc){}
 async read(key:string){return(await this.head(key))?.session;}
 private head(key:string){return this.rpc<{session:DurableExamSession;version:number}|null>('study_read_exam',{p_namespace:runtimeNamespace(),p_key:key});}
 async change<T>(key:string,fn:(previous:DurableExamSession|undefined)=>{session:DurableExamSession;result:T}):Promise<T>{
  for(let retry=0;retry<8;retry++){
   const head=await this.head(key),before=JSON.stringify(head?.session),{session,result}=fn(head?.session);
   if(head&&before===JSON.stringify(session))return result;
   if(Buffer.byteLength(JSON.stringify(session))>8_000_000)throw Error('Exam exceeds safe bound');
   try{await this.rpc('study_write_exam',{p_namespace:runtimeNamespace(),p_key:key,p_expected_version:head?.version||0,p_session:session});return result;}
   catch(error){if((error as any).code!=='40001'||retry===7)throw error;await new Promise(r=>setTimeout(r,Math.min(100,10*2**retry)));}
  }
  throw Error('Exam save retry limit');
 }
 list(school:string,exam:string,after=''){return this.rpc<Array<{key:string;session:DurableExamSession}>>('study_list_exams',{p_namespace:runtimeNamespace(),p_school:school,p_exam:exam,p_after:after});}
 async deleteFixture(key:string){if(!runtimeNamespace().startsWith('_specialized_preview_')||!/^[a-f0-9]{64}$/.test(key))throw Error('Preview fixture cleanup only');await this.rpc('study_delete_exam_fixture',{p_namespace:runtimeNamespace(),p_key:key});}
}
