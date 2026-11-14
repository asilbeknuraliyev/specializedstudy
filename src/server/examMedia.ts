import {getFirestore} from 'firebase-admin/firestore';
import crypto from 'node:crypto';
import {runtimeNamespace} from './runtimeScope';
const mediaRoot=runtimeNamespace()==='_specialized_runtime'?'_specialized_exam_media':runtimeNamespace()+'_media';
import {getFirebaseAdminApp,loadFirebaseAppletConfig} from './firebaseAdminAuth';
import {supabaseEnabled} from './supabaseClient';
import {storeSupabaseExamImage,readSupabaseExamImage} from './supabaseMedia';
export async function storeExamImage(institutionId:string,examId:string,dataUrl:string):Promise<string>{
 const match=dataUrl.match(/^data:image\/(jpeg|png);base64,(.+)$/);if(!match)throw Error('Image format rejected');const bytes=Buffer.from(match[2],'base64');
 if(bytes.length>500000||bytes.length<8)throw Error('Image size rejected');
 const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!(match[1]==='png'?png:jpeg))throw Error('Image signature rejected');
 const hash=crypto.createHash('sha256').update(institutionId).update(bytes).digest('hex');
 if(supabaseEnabled()){await storeSupabaseExamImage(hash,institutionId,`image/${match[1]}`,bytes);return `/api/exams/${examId}/media/${hash}`;}
 const db=getFirestore(getFirebaseAdminApp(),loadFirebaseAppletConfig().firestoreDatabaseId);
 await db.doc(`${mediaRoot}/${hash}`).set({institutionId,data:match[2],mime:`image/${match[1]}`,createdAt:new Date().toISOString()});
 return `/api/exams/${examId}/media/${hash}`;
}
export async function readExamImage(hash:string){if(supabaseEnabled())return readSupabaseExamImage(hash);const db=getFirestore(getFirebaseAdminApp(),loadFirebaseAppletConfig().firestoreDatabaseId);const doc=await db.doc(`${mediaRoot}/${hash}`).get();return doc.exists?doc.data():null;}
