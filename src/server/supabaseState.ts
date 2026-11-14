import crypto from 'node:crypto';
import type {PersistentDatabaseState} from './dbEngine';
import {runtimeNamespace} from './runtimeScope';
import {studyRpc} from './supabaseClient';
import {mergeState} from './mergeState';
import {coalescedRead} from './coalescedRead';
export type StateRow={collection:string;key:string;position:number;data:any};
export function stateRows(state:any){
 const rows:StateRow[]=[],layout:Record<string,string>={};
 for(const [collection,value] of Object.entries(state)){
  if(value===undefined)continue;
  if(!/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(collection))throw Error('Invalid state collection');
  layout[collection]=Array.isArray(value)?'array':value&&typeof value==='object'?'object':'scalar';
  const values=Array.isArray(value)?value:Object.entries(value&&typeof value==='object'?value:{$:value});
  const used=new Set<string>();
  values.forEach((entry:any,position:number)=>{
   let key:string,data:any;
   if(Array.isArray(value)){data=entry;key=String(entry?.id||entry?.uid||'h:'+crypto.createHash('sha256').update(JSON.stringify(entry)).digest('hex'));if(used.has(key))key+=':duplicate:'+position;}
   else [key,data]=entry;
   if(key.length>256||!key)throw Error('Invalid state key');used.add(key);rows.push({collection,key,position,data});
  });
 }
 return{layout,rows};
}
let cache:{revision:string;serialized:string}|undefined;
export const readSupabaseState=coalescedRead(async()=>{
 const namespace=runtimeNamespace(),revision=await studyRpc<string|null>('study_state_version',{p_namespace:namespace});
 if(!revision)throw Error('Supabase state has not been migrated');
 if(cache?.revision===revision)return{state:JSON.parse(cache.serialized) as PersistentDatabaseState,revision};
 const snapshot=await studyRpc<{state:PersistentDatabaseState;revision:string}>('study_read_state',{p_namespace:namespace});
 cache={revision:snapshot.revision,serialized:JSON.stringify(snapshot.state)};
 return{state:structuredClone(snapshot.state),revision:snapshot.revision};
});
export async function writeSupabaseState(state:PersistentDatabaseState,expectedRevision:string|null,baseState?:string,retry=0):Promise<string>{
 const before=stateRows(baseState?JSON.parse(baseState):{}),after=stateRows(state),old=new Map(before.rows.map(r=>[r.collection+'\0'+r.key,r])),next=new Map(after.rows.map(r=>[r.collection+'\0'+r.key,r]));
 const changes:any[]=[];
 for(const [key,row] of next){const prior=old.get(key);if(!prior||prior.position!==row.position||JSON.stringify(prior.data)!==JSON.stringify(row.data))changes.push(row);}
 for(const [key,row] of old)if(!next.has(key))changes.push({collection:row.collection,key:row.key,deleted:true});
 try{
  const revision=await studyRpc<string>('study_write_state',{p_namespace:runtimeNamespace(),p_expected_revision:expectedRevision,p_layout:after.layout,p_changes:changes});
  cache={revision,serialized:JSON.stringify(state)};return revision;
 }catch(error){
  if((error as any).code==='40001'&&baseState&&retry<2){const latest=await readSupabaseState();let merged:PersistentDatabaseState;try{merged=mergeState(JSON.parse(baseState),state,latest.state);}catch{throw Object.assign(Error('PERSISTENCE_CONFLICT'),{code:'40001'});}const revision=await writeSupabaseState(merged,latest.revision,JSON.stringify(latest.state),retry+1);Object.assign(state,merged);return revision;}
  throw error;
 }
}
