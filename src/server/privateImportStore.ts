import {serverSupabase} from './supabaseClient';import {runtimeNamespace} from './runtimeScope';import {sealSecret,openSecret} from './secretEnvelope';
export const importPurpose=(school:string,id:string,kind:string)=>runtimeNamespace()+':school-import:'+school+':'+id+':'+kind;
export async function putImportPayload(school:string,id:string,kind:string,value:unknown){
 const path=runtimeNamespace()+'/imports/'+encodeURIComponent(school)+'/'+encodeURIComponent(id)+'/'+kind+'.enc',bytes=Buffer.from(sealSecret(value,importPurpose(school,id,kind)));
 if(bytes.length>20*1024*1024)throw Error('Import ma’lumoti juda katta. Faylni qismlarga ajrating.');
 const {error}=await serverSupabase().storage.from('study-private').upload(path,bytes,{contentType:'application/octet-stream',upsert:false,cacheControl:'0'});
 if(error){if(String((error as any).statusCode)!=='409')throw Error('Yopiq import nusxasi saqlanmadi.');const previous=await getImportPayload(school,id,kind,path);if(JSON.stringify(previous)!==JSON.stringify(value))throw Error('Import nusxasi avval boshqa mazmunda saqlangan.');}return path;
}
export async function getImportPayload<T>(school:string,id:string,kind:string,path:string):Promise<T>{
 const expected=runtimeNamespace()+'/imports/'+encodeURIComponent(school)+'/'+encodeURIComponent(id)+'/'+kind+'.enc';if(path!==expected)throw Error('Import ombori doirasi mos emas.');
 const {data,error}=await serverSupabase().storage.from('study-private').download(path);if(error||!data)throw Error('Import nusxasi o‘qilmadi.');return openSecret<T>(await data.text(),importPurpose(school,id,kind));
}
