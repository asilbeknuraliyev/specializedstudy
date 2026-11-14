import {serverSupabase,studyRpc} from './supabaseClient';
import {runtimeNamespace} from './runtimeScope';
export async function storeSupabaseExamImage(hash:string,schoolId:string,mime:string,bytes:Buffer){
 const path=`${runtimeNamespace()}/exams/${encodeURIComponent(schoolId)}/${hash}`;
 const {error}=await serverSupabase().storage.from('study-private').upload(path,bytes,{contentType:mime,upsert:false,cacheControl:'0'});
 if(error&&String((error as any).statusCode)!=='409')throw Error('Private media upload failed');
 await studyRpc('study_media_index',{p_namespace:runtimeNamespace(),p_id:hash,p_data:{schoolId,mime,path,size:bytes.length}});
}
export async function readSupabaseExamImage(hash:string){
 const index=await studyRpc<any>('study_media_index',{p_namespace:runtimeNamespace(),p_id:hash});if(!index)return null;
 const {data,error}=await serverSupabase().storage.from('study-private').download(index.path);
 if(error||!data)throw Error('Private media download failed');
 return{institutionId:index.institutionId,mime:index.mime,data:Buffer.from(await data.arrayBuffer()).toString('base64')};
}
