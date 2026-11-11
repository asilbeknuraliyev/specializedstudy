import {sessionBody} from './sessionCookies';
import type { RequestHandler } from 'express';
import { requestDatabase } from './requestDatabase';
import { readCloudState, writeCloudState, StateConflictError } from './cloudState';

export function createCloudStateMiddleware(store = { read: readCloudState, write: writeCloudState }): RequestHandler {
return async (req,res,next) => {
 if(process.env.PERSISTENCE_DRIVER!=='firestore'||!req.path.startsWith('/api/')||req.path==='/api/health')return next();
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
       } catch(error) {
         res.status(error instanceof StateConflictError?409:503);
         json({error:error instanceof StateConflictError?'Ma’lumot yangilangan. Sahifani yangilab, qayta urinib ko‘ring.':'Ma’lumot saqlanmadi. Keyinroq qayta urinib ko‘ring.'});
       }
     })();
     return res;
   }) as typeof res.json;
   requestDatabase.run(context,next);
 } catch {
   res.status(503).json({error:'Ma’lumotlar bazasi hozircha tayyor emas. Administratorga murojaat qiling.'});
 }
};

}
export const cloudStateMiddleware = createCloudStateMiddleware();
