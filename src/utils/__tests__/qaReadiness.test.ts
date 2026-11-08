import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {registerTeachingRoutes,deliveredForClass} from '../../server/teachingRoutes';
import {getDbState,saveDbState} from '../../server/dbEngine';

test('Firestore mode never silently reads or writes ephemeral local JSON',()=>{
 const original=process.env.PERSISTENCE_DRIVER;process.env.PERSISTENCE_DRIVER='firestore';
 try{assert.throws(()=>getDbState(),/isolated request/);assert.throws(()=>saveDbState('prod',{} as any),/cannot fall back/);}
 finally{if(original===undefined)delete process.env.PERSISTENCE_DRIVER;else process.env.PERSISTENCE_DRIVER=original;}
});

test('teacher can undo delivery including global quarter mark only for own class',async()=>{
 const lesson:any={id:'lesson',institutionId:'s',classId:'a',classIds:['a','b'],subjectName:'Matematika',schoolDeliveredAt:new Date().toISOString()};
 const db:any={classes:[{id:'a',institutionId:'s'},{id:'b',institutionId:'s'}],lessons:[lesson]};
 const teacher:any={uid:'t',role:'teacher',institutionId:'s',assignedClassIds:['a'],subject:'Matematika'};
 const app=express();app.use(express.json());registerTeachingRoutes(app,{authenticate:()=>({user:teacher,db,env:'test'}),save:()=>{},hash:()=>'',revoke:()=>{}});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const post=async(body:any)=>fetch(`http://127.0.0.1:${(server.address() as any).port}/api/teaching/lessons/lesson/delivered`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  assert.equal((await post({delivered:false})).status,200);assert.equal(deliveredForClass(lesson,'a'),false);assert.equal(deliveredForClass(lesson,'b'),true);
  assert.equal((await post({delivered:true})).status,200);assert.equal(deliveredForClass(lesson,'a'),true);
  assert.equal((await post({delivered:'false'})).status,400);
  teacher.assignedClassIds=['foreign'];assert.equal((await post({delivered:false})).status,403);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
