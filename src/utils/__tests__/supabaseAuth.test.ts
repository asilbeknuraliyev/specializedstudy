import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {registerSupabaseAuthRoutes} from '../../server/supabaseAuth';
test('Supabase provider sync preserves immutable application IDs and trusts only server metadata and existing grants',async()=>{
 process.env.AUTH_PROVIDER='supabase';
 const adminEmail='asilbeknuraliyev43@gmail.com';
 const db:any={institutions:[{id:'DEMO-school'}],users:[{uid:'legacy-admin',email:adminEmail,emailVerified:true,platformAdmin:true,role:'platform_owner',status:'active',institutionId:'DEMO-school'},{uid:'native-learner',email:'native@example.invalid',role:'student',status:'active',institutionId:'DEMO-school'}],customClaims:{'legacy-admin':{platformAdmin:true}},auditLogs:[]};
 let identity:any={google:true,user:{id:'provider-admin',email:adminEmail,email_confirmed_at:'2026-01-01',app_metadata:{legacyApplicationUid:'legacy-admin',platformAdmin:true},user_metadata:{role:'student'}}};
 const app=express();app.use(express.json());registerSupabaseAuthRoutes(app,{database:()=>db,verifyIdentity:async()=>identity,save:()=>{},issue:(uid:string)=>'synthetic-session-'+uid});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
 const sync=async(body:any={})=>{const r=await fetch(base+'/api/auth/provider-sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:'synthetic-provider-token',...body})});return{status:r.status,body:await r.json()};};
 try{
  const original=await sync({uid:'attacker-chosen',role:'admin',customClaims:{platformAdmin:true}});assert.equal(original.status,200);assert.equal(original.body.user.uid,'legacy-admin');assert.equal(db.users[0].linkedSupabaseUid,'provider-admin');
  identity.user.app_metadata.platformAdmin=false;assert.equal((await sync({customClaims:{platformAdmin:true}})).status,403);
  identity={google:true,user:{id:'new-provider',email:'new@example.invalid',app_metadata:{},user_metadata:{role:'platform_owner',platformAdmin:true}}};
  const newUser=await sync({role:'teacher',classId:'DEMO-secret-class'});assert.equal(newUser.status,200);assert.equal(newUser.body.user.role,'student');assert.equal(newUser.body.user.classId,undefined);assert.ok(!newUser.body.user.platformAdmin);
  identity={google:true,user:{id:'foreign-provider',email:'native@example.invalid',app_metadata:{},user_metadata:{}}};assert.equal((await sync()).status,409,'email alone never attaches a native account');
  identity.google=false;assert.equal((await sync()).status,403);
  assert.equal((await fetch(base+'/api/auth/firebase-sync',{method:'POST'})).status,410);
 }finally{await new Promise<void>(r=>server.close(()=>r()));delete process.env.AUTH_PROVIDER;}
});
