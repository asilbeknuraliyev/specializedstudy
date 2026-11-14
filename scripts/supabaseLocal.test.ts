import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {stateRows} from '../src/server/supabaseState';
import {SupabaseExamSessionStore} from '../src/server/supabaseExamStore';
import {examSessionKey} from '../src/server/examSessionStore';

test('local PostgreSQL migration: exact state roundtrip, server-only access, CAS, independent exam saves and preview deletion guard',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
  await db.exec(await fs.readFile('supabase/migrations/202611140001_private_runtime.sql','utf8'));
  const rpc=async<T=any>(name:string,args:Record<string,unknown>):Promise<T>=>{
   assert.match(name,/^study_[a-z_]+$/);
   const entries=Object.entries(args);for(const [key]of entries)assert.match(key,/^p_[a-z_]+$/);
   const result=await db.query<{result:T}>(`select public.${name}(${entries.map(([key],i)=>key+' => $'+(i+1)).join(',')}) as result`,entries.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v));return result.rows[0].result;
  };
  const namespace='_specialized_preview_supabase',state={users:[{uid:'DEMO-only',role:'student',institutionId:'DEMO-school'}],lessons:[{id:'DEMO-lesson',title:'Lokal sinov'}],passwordHashes:{'DEMO-only':'SYNTHETIC-NONCREDENTIAL'},empty:[],nullable:null,flag:false};
  const encoded=stateRows(state),revision=await rpc('study_write_state',{p_namespace:namespace,p_expected_revision:null,p_layout:encoded.layout,p_changes:encoded.rows});
  assert.deepEqual((await rpc('study_read_state',{p_namespace:namespace})).state,state);
  await assert.rejects(rpc('study_write_state',{p_namespace:namespace,p_expected_revision:null,p_layout:encoded.layout,p_changes:[]}),e=>(e as any).code==='40001');
  assert.equal(await rpc('study_state_version',{p_namespace:namespace}),revision);
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   await assert.rejects(db.query('select * from study_private.runtime_records'),e=>(e as any).code==='42501');
   await assert.rejects(rpc('study_read_state',{p_namespace:namespace}),e=>(e as any).code==='42501');
   await assert.rejects(rpc('study_write_exam',{p_namespace:namespace,p_key:'a'.repeat(64),p_expected_version:0,p_session:{}}),e=>(e as any).code==='42501');
   await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.deepEqual((await rpc('study_read_state',{p_namespace:namespace})).state,state);
  process.env.PERSISTENCE_NAMESPACE=namespace;
  const first=new SupabaseExamSessionStore(rpc),second=new SupabaseExamSessionStore(rpc),key=examSessionKey('DEMO-school','DEMO-exam','DEMO-only');
  const base:any={institutionId:'DEMO-school',assessmentId:'DEMO-exam',studentId:'DEMO-only',revision:0,answers:{},status:'active'};
  await first.change(key,()=>({session:base,result:true}));
  await Promise.all([first,second].map((store,i)=>store.change(key,old=>{old!.revision++;old!.answers['q'+i]='DEMO-answer';return{session:old!,result:true};})));
  const saved=await first.read(key);assert.equal(saved!.revision,2);assert.equal(Object.keys(saved!.answers).length,2);
  assert.equal((await first.list('DEMO-school','DEMO-exam')).length,1);
  assert.equal((await first.list('other-school','DEMO-exam')).length,0);
  await first.change(key,old=>({session:old!,result:true}));
  assert.equal((await rpc('study_read_exam',{p_namespace:namespace,p_key:key})).version,3,'identical retries are read-only');
  await assert.rejects(rpc('study_delete_exam_fixture',{p_namespace:'_specialized_runtime',p_key:key}),/Preview fixture/);
  await first.deleteFixture(key);assert.equal(await first.read(key),undefined);
  await db.exec('reset role');
 }finally{await db.close();}
});
