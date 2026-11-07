import crypto from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp, loadFirebaseAppletConfig } from './firebaseAdminAuth';
import type { PersistentDatabaseState } from './dbEngine';

// Compatibility bridge for the existing synchronous domain services. Immutable,
// compressed snapshots plus a CAS pointer prevent partial writes and lost updates.
// Existing Firestore collections are not replaced or modified by this store.
const ROOT = '_specialized_runtime';
const CHUNK_BYTES = 350_000;
const MAX_STATE_BYTES = 64 * 1024 * 1024;
export class StateConflictError extends Error { constructor() { super('State changed concurrently'); } }
export function encodeState(value: unknown) {
 const raw=Buffer.from(JSON.stringify(value));
 if(raw.length>MAX_STATE_BYTES)throw new Error('State exceeds configured size limit');
 const compressed=gzipSync(raw);
 const chunks:Array<{id:string;data:string}>=[];
 for(let offset=0;offset<compressed.length;offset+=CHUNK_BYTES){const bytes=compressed.subarray(offset,offset+CHUNK_BYTES);chunks.push({id:crypto.createHash('sha256').update(bytes).digest('hex'),data:bytes.toString('base64')});}
 return {chunks,digest:crypto.createHash('sha256').update(raw).digest('hex')};
}
export function decodeState(chunks: Array<{id:string;data:string}>, digest:string): PersistentDatabaseState {
 const compressed=Buffer.concat(chunks.map(c=>{const b=Buffer.from(c.data,'base64');if(crypto.createHash('sha256').update(b).digest('hex')!==c.id)throw Error('Snapshot chunk integrity failure');return b;}));
 const raw=gunzipSync(compressed,{maxOutputLength:MAX_STATE_BYTES});
 if(crypto.createHash('sha256').update(raw).digest('hex')!==digest)throw Error('Snapshot integrity failure');
 return JSON.parse(raw.toString('utf8'));
}
let cache:{revision:string;serialized:string}|null=null;
function database(){return getFirestore(getFirebaseAdminApp(),loadFirebaseAppletConfig().firestoreDatabaseId);}
export async function readCloudState():Promise<{state:PersistentDatabaseState;revision:string}> {
 const db=database();const head=await db.doc(`${ROOT}/current`).get();
 if(!head.exists)throw Error('Cloud state has not been migrated');
 const manifest=head.data()!;
 if(manifest.schema!==1||!Array.isArray(manifest.chunks))throw Error('Unsupported state schema');
 const currentCache=cache;
 if(currentCache && currentCache.revision===manifest.revision)return {state:JSON.parse(currentCache.serialized),revision:currentCache.revision};
 const docs=await db.getAll(...manifest.chunks.map((id:string)=>db.doc(`${ROOT}/chunks/items/${id}`)));
 const state=decodeState(docs.map((d,i)=>{if(!d.exists)throw Error('Snapshot incomplete');return {id:manifest.chunks[i],data:d.data()!.data};}),manifest.digest);
 cache={revision:manifest.revision,serialized:JSON.stringify(state)};
 return {state,revision:manifest.revision};
}
export async function writeCloudState(state:PersistentDatabaseState,expectedRevision:string|null):Promise<string> {
 const db=database();const encoded=encodeState(state);const revision=crypto.randomUUID();
 // Stage immutable chunks before publishing the pointer. An interrupted write leaves
 // only unreachable chunks; readers continue to use the preceding complete revision.
 for(let offset=0;offset<encoded.chunks.length;offset+=8){const batch=db.batch();for(const chunk of encoded.chunks.slice(offset,offset+8))batch.set(db.doc(`${ROOT}/chunks/items/${chunk.id}`),{data:chunk.data});await batch.commit();}
 await db.runTransaction(async tx=>{const ref=db.doc(`${ROOT}/current`);const head=await tx.get(ref);if((head.exists?head.data()!.revision:null)!==expectedRevision)throw new StateConflictError();if(head.exists)tx.set(db.doc(`${ROOT}/revisions/items/${head.data()!.revision}`),head.data()!);tx.set(ref,{schema:1,revision,chunks:encoded.chunks.map(c=>c.id),digest:encoded.digest,previousRevision:expectedRevision,updatedAt:new Date().toISOString()});});
 cache={revision,serialized:JSON.stringify(state)};return revision;
}
