import {coalescedRead} from './coalescedRead';
import crypto from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp, loadFirebaseAppletConfig } from './firebaseAdminAuth';
import type { PersistentDatabaseState } from './dbEngine';
import {runtimeNamespace} from './runtimeScope';
import {mergeState} from './mergeState';

// Compatibility bridge for the existing synchronous domain services. Immutable,
// compressed snapshots plus a CAS pointer prevent partial writes and lost updates.
// Existing Firestore collections are not replaced or modified by this store.
const ROOT = runtimeNamespace();
const CHUNK_BYTES = 350_000;
const MAX_STATE_BYTES = 64 * 1024 * 1024;
export class StateConflictError extends Error { constructor() { super('State changed concurrently'); } }
export function encodeState(value: unknown) {
 const raw=Buffer.from(JSON.stringify(value));
 if(raw.length>MAX_STATE_BYTES)throw new Error('State exceeds configured size limit');
 // Independent gzip members preserve schema-1 compatibility: concatenating and
 // gunzipping them produces the exact original JSON. A session edit no longer
 // rewrites unchanged curriculum bytes. Array slices retain their original order.
 const parts:string[]=[];
 if(value&&typeof value==='object'&&!Array.isArray(value)){
   const entries=Object.entries(value).filter(([,v])=>JSON.stringify(v)!==undefined);
   entries.forEach(([key,v],i)=>{
     const prefix=(i?',':'{')+JSON.stringify(key)+':';
     if(Array.isArray(v)&&v.length>64){
       for(let start=0;start<v.length;start+=64)parts.push((start?',':prefix+'[')+v.slice(start,start+64).map(item=>JSON.stringify(item)??'null').join(',')+(start+64>=v.length?']':''));
     }else parts.push(prefix+JSON.stringify(v));
   });
   if(!entries.length)parts.push('{');
   parts[parts.length-1]+='}';
 }else parts.push(raw.toString('utf8'));
 const chunks:Array<{id:string;data:string}>=[];
 for(const part of parts){const compressed=gzipSync(Buffer.from(part));for(let offset=0;offset<compressed.length;offset+=CHUNK_BYTES){const bytes=compressed.subarray(offset,offset+CHUNK_BYTES);chunks.push({id:crypto.createHash('sha256').update(bytes).digest('hex'),data:bytes.toString('base64')});}}
 return {chunks,digest:crypto.createHash('sha256').update(raw).digest('hex')};
}
export function decodeState(chunks: Array<{id:string;data:string}>, digest:string): PersistentDatabaseState {
 const compressed=Buffer.concat(chunks.map(c=>{const b=Buffer.from(c.data,'base64');if(crypto.createHash('sha256').update(b).digest('hex')!==c.id)throw Error('Snapshot chunk integrity failure');return b;}));
 const raw=gunzipSync(compressed,{maxOutputLength:MAX_STATE_BYTES});
 if(crypto.createHash('sha256').update(raw).digest('hex')!==digest)throw Error('Snapshot integrity failure');
 return JSON.parse(raw.toString('utf8'));
}
let cache:{revision:string;serialized:string;chunks:string[]}|null=null;
const chunkCache=new Map<string,string>();
let cachedBytes=0;
function remember(id:string,data:string){if(chunkCache.has(id))return;chunkCache.set(id,data);cachedBytes+=data.length;while(cachedBytes>32*1024*1024){const key=chunkCache.keys().next().value!;cachedBytes-=chunkCache.get(key)!.length;chunkCache.delete(key);}}
function database(){return getFirestore(getFirebaseAdminApp(),loadFirebaseAppletConfig().firestoreDatabaseId);}
async function readCloudStateOnce():Promise<{state:PersistentDatabaseState;revision:string}> {
 const db=database();const head=await db.doc(`${ROOT}/current`).get();
 if(!head.exists)throw Error('Cloud state has not been migrated');
 const manifest=head.data()!;
 if(manifest.schema!==1||!Array.isArray(manifest.chunks))throw Error('Unsupported state schema');
 const currentCache=cache;
 if(currentCache && currentCache.revision===manifest.revision)return {state:JSON.parse(currentCache.serialized),revision:currentCache.revision};
 const contents=new Map<string,string>();
 for(const id of manifest.chunks)if(chunkCache.has(id))contents.set(id,chunkCache.get(id)!);
 const missing=[...new Set<string>(manifest.chunks)].filter(id=>!contents.has(id));
 if(missing.length){const docs=await db.getAll(...missing.map(id=>db.doc(`${ROOT}/chunks/items/${id}`)));docs.forEach((d,i)=>{if(!d.exists)throw Error('Snapshot incomplete');contents.set(missing[i],d.data()!.data);remember(missing[i],d.data()!.data);});}
 const state=decodeState(manifest.chunks.map((id:string)=>({id,data:contents.get(id)!})),manifest.digest);
 state.disciplinePeriods||=[];state.disciplinePolicies||=[];state.disciplineTypes||=[];state.disciplineRecords||=[];state.disciplineTotals||=[];state.disciplineCases||=[];state.disciplineAppeals||=[];state.warningLetters||=[];state.disciplineCorrections||=[];state.schoolAuditEvents||=[];state.schoolOperations||=[];state.topicAnalysisFacts||=[];state.topicAnalysisCohorts||=[];state.mistakeRecords||=[];state.spacedReviewQueue||=[];state.spacedReviewSessions||=[];state.spacedReviewAnswers||=[];state.reviewDailyUsage||=[];state.studentTopicProgress||=[];state.topicWriteOperations||=[];state.learningDemos||=[];state.topicQuestionVersions||=[];state.topicTestVersions||=[];state.topicImportBatches||=[];state.topicQuestions||=[];state.topicTests||=[];state.topicSessions||=[];state.topicReviews||=[];
 cache={revision:manifest.revision,serialized:JSON.stringify(state),chunks:manifest.chunks};
 return {state,revision:manifest.revision};
}
export const readCloudState=coalescedRead(readCloudStateOnce);
export async function writeCloudState(state:PersistentDatabaseState,expectedRevision:string|null,baseState?:string,retry=0):Promise<string> {
 const db=database();const encoded=encodeState(state);const revision=crypto.randomUUID();
 const previous=cache?.revision===expectedRevision?cache.chunks:[];
 const reused=new Set(previous);
 const changed=encoded.chunks.filter((chunk,i,all)=>!reused.has(chunk.id)&&all.findIndex(c=>c.id===chunk.id)===i);
 // Stage immutable chunks before publishing the pointer. An interrupted write leaves
 // only unreachable chunks; readers continue to use the preceding complete revision.
 for(let offset=0;offset<changed.length;){const batch=db.batch();let size=0,count=0;while(offset<changed.length&&count<400&&size+changed[offset].data.length+256<6*1024*1024){const chunk=changed[offset++];batch.set(db.doc(`${ROOT}/chunks/items/${chunk.id}`),{data:chunk.data});size+=chunk.data.length+256;count++;}await batch.commit();}
 try{await db.runTransaction(async tx=>{const ref=db.doc(`${ROOT}/current`);const head=await tx.get(ref);if((head.exists?head.data()!.revision:null)!==expectedRevision)throw new StateConflictError();if(head.exists)tx.set(db.doc(`${ROOT}/revisions/items/${head.data()!.revision}`),head.data()!);tx.set(ref,{schema:1,revision,chunks:encoded.chunks.map(c=>c.id),digest:encoded.digest,previousRevision:expectedRevision,updatedAt:new Date().toISOString()});});}
 catch(error){if(error instanceof StateConflictError&&baseState&&retry<2){const latest=await readCloudState();let merged:PersistentDatabaseState;try{merged=mergeState(JSON.parse(baseState),state,latest.state);}catch{throw new StateConflictError();}const saved=await writeCloudState(merged,latest.revision,JSON.stringify(latest.state),retry+1);Object.assign(state,merged);return saved;}throw error;}
 for(const chunk of encoded.chunks)remember(chunk.id,chunk.data);
 cache={revision,serialized:JSON.stringify(state),chunks:encoded.chunks.map(c=>c.id)};return revision;
}
