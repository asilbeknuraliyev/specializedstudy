import {runtimeMetrics,quotaExhausted} from './runtimeMetrics';
import {sessionBody} from './sessionCookies';
import type { RequestHandler } from 'express';
import { requestDatabase } from './requestDatabase';
import { readCloudState, writeCloudState, StateConflictError } from './cloudState';
import {readSupabaseState,writeSupabaseState} from './supabaseState';
import {supabaseEnabled} from './supabaseClient';

export function createCloudStateMiddleware(store = { read: () => supabaseEnabled()?readSupabaseState():readCloudState(), write: (state:any,revision:string,base:string) => supabaseEnabled()?writeSupabaseState(state,revision,base):writeCloudState(state,revision,base) }): RequestHandler {
return async (req,res,next) => {
 if(!['firestore','supabase'].includes(process.env.PERSISTENCE_DRIVER||'')||!req.path.startsWith('/api/')||req.path==='/api/health')return next();
 try {
   const began=performance.now();
   const snapshot=await store.read();
   const readMs=performance.now()-began;
   const baseState=JSON.stringify(snapshot.state);
   const context={...snapshot,dirty:false,afterCommit:[] as Array<()=>void>};
   const json=res.json.bind(res);
   let sending=false;
   res.json=((body:unknown)=>{
     if(sending)return res;
     sending=true;
     void (async()=>{
       try {
         const commitBegan=performance.now();
         if(context.dirty) await store.write(context.state,context.revision,baseState);
         for(const action of context.afterCommit)action();
         res.setHeader('Server-Timing',`state;dur=${readMs.toFixed(1)}, commit;dur=${(performance.now()-commitBegan).toFixed(1)}`);
         json(sessionBody(res,body));
       } catch(error) {runtimeMetrics.failure(quotaExhausted(error)?'quota_exhausted':error instanceof StateConflictError?'conflict':'write_failed');
         const conflict=error instanceof StateConflictError||(error as any)?.code==='40001';
         res.status(conflict?409:503);
         json({code:quotaExhausted(error)?'QUOTA_EXHAUSTED':conflict?'PERSISTENCE_CONFLICT':'TEMPORARY',error:conflict?'Ma’lumot yangilangan. Sahifani yangilab, qayta urinib ko‘ring.':'Ma’lumot saqlanmadi. Keyinroq qayta urinib ko‘ring.'});
       }
     })();
     return res;
   }) as typeof res.json;
   requestDatabase.run(context,next);
 } catch(error) {runtimeMetrics.failure(quotaExhausted(error)?'quota_exhausted':'read_failed');
   res.status(503).json({code:quotaExhausted(error)?'QUOTA_EXHAUSTED':'TEMPORARY',error:'Ma’lumotlar bazasi hozircha tayyor emas. Administratorga murojaat qiling.'});
 }
};

}
export const cloudStateMiddleware = createCloudStateMiddleware();
