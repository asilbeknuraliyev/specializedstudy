import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp as adminApp,deleteApp as deleteAdmin} from 'firebase-admin/app';
import {getFirestore as adminFirestore} from 'firebase-admin/firestore';
import {initializeApp,deleteApp} from 'firebase/app';
import {getFirestore,connectFirestoreEmulator,doc,setDoc,getDoc,updateDoc,terminate} from 'firebase/firestore';
import {getStorage,connectStorageEmulator,ref,uploadBytes,getBytes} from 'firebase/storage';

test('local legacy rules audit with synthetic identities only',async()=>{
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8787');assert.ok(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
 const project='demo-specialized-security',admin=adminApp({projectId:project},'audit-admin'),db=adminFirestore(admin);
 const web=initializeApp({projectId:project,apiKey:'emulator-only',storageBucket:project+'.appspot.com'},'audit-student'),client=getFirestore(web);
 const token={sub:'DEMO-student-a',email:'student@invalid.example',email_verified:false};
 connectFirestoreEmulator(client,'127.0.0.1',8787,{mockUserToken:token});
 const storage=getStorage(web);connectStorageEmulator(storage,'127.0.0.1',9299,{mockUserToken:token});
 const finding:string[]=[];
 try{
  await db.doc('users/DEMO-student-b').set({uid:'DEMO-student-b',role:'student',classCode:'7a1'});
  await db.doc('lessons/DEMO-private-lesson').set({classId:'DEMO-class-8a2',classCode:'8a2',status:'published',institutionId:'DEMO-other-school',title:'Synthetic lesson'});
  await db.doc('questions/DEMO-key').set({correctAnswer:'SYNTHETIC KEY'});
  await db.doc('mastery_records/DEMO-other-mastery').set({studentId:'DEMO-student-b',accuracy:25});
  await db.doc('_specialized_runtime/current').set({private:true});
  await assert.rejects(getDoc(doc(client,'users/DEMO-student-b')),e=>(e as any).code==='permission-denied');
  await assert.rejects(getDoc(doc(client,'questions/DEMO-key')),e=>(e as any).code==='permission-denied');
  await assert.rejects(getDoc(doc(client,'_specialized_runtime/current')),e=>(e as any).code==='permission-denied');
  const attempt=async(label:string,fn:()=>Promise<unknown>)=>{try{await fn();finding.push(label);}catch(e){if((e as any).code!=='permission-denied'&&(e as any).code!=='storage/unauthorized')throw e;}};
  await attempt('unverified student self-assigns school/class and extra isAdmin field',()=>setDoc(doc(client,'users/DEMO-student-a'),{uid:'DEMO-student-a',displayName:'DEMO Student',email:'student@invalid.example',role:'student',institutionId:'DEMO-other-school',classId:'DEMO-class-8a2',classCode:'8a2',isAdmin:true}));
  await attempt('self-assigned class can read a foreign school lesson',async()=>{const value=await getDoc(doc(client,'lessons/DEMO-private-lesson'));assert.ok(value.exists());});
  await attempt('student creates fabricated 100 percent legacy attempt',()=>setDoc(doc(client,'attempts/DEMO-fabricated'),{assessmentId:'DEMO-assessment',studentId:'DEMO-student-a',scorePercent:100,totalQuestions:1,status:'completed'}));
  await attempt('student takes over another legacy mastery record',()=>updateDoc(doc(client,'mastery_records/DEMO-other-mastery'),{studentId:'DEMO-student-a',accuracy:100}));
  await attempt('unverified student uploads fake PDF under arbitrary school',()=>uploadBytes(ref(storage,'institutions/DEMO-other-school/submissions/DEMO-student-a/fake.pdf'),new TextEncoder().encode('SYNTHETIC plain text, not PDF'),{contentType:'application/pdf'}));
  const other=initializeApp({projectId:project,apiKey:'emulator-only',storageBucket:project+'.appspot.com'},'audit-other');
  const second=getStorage(other);connectStorageEmulator(second,'127.0.0.1',9299,{mockUserToken:{sub:'DEMO-foreign',email:'foreign@example.invalid'}});
  // Seed a public-to-signed-in material using the verified admin fixture allowed by the rules.
  const own=initializeApp({projectId:project,apiKey:'emulator-only',storageBucket:project+'.appspot.com'},'audit-owner'),ownerStore=getStorage(own);
  connectStorageEmulator(ownerStore,'127.0.0.1',9299,{mockUserToken:{sub:'DEMO-owner',email:'asilbeknuraliyev43@gmail.com',email_verified:true,platformAdmin:true}});
  try{await uploadBytes(ref(ownerStore,'institutions/DEMO-school/materials/private.pdf'),new TextEncoder().encode('SYNTHETIC school-private bytes'),{contentType:'application/pdf'});await attempt('foreign signed-in user reads another school material',()=>getBytes(ref(second,'institutions/DEMO-school/materials/private.pdf')));}catch(e){if((e as any).code!=='storage/unauthorized')throw e;}
  await deleteApp(other);await deleteApp(own);
  console.log(JSON.stringify({syntheticOnly:true,productionRequests:0,confirmedLegacyFindings:finding}));
  if(process.env.AUDIT_EXPECT_DENY==='1')assert.deepEqual(finding,[],'Legacy client access must be denied after closure');
  else assert.ok(finding.length>=4,'Baseline audit should reproduce the legacy findings');
 }finally{await terminate(client);await deleteApp(web);await db.terminate();await deleteAdmin(admin);}
});
