import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('editorial worker commits a complete set once, rolls back partial writes and keeps drafts private',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
    create schema study_private;
    create role anon; create role authenticated; create role service_role;
    create table study_private.runtime_namespaces(namespace text primary key,revision uuid,updated_at timestamptz,layout jsonb);
    create table study_private.runtime_records(namespace text,collection text,record_key text,data jsonb,
     institution_id text generated always as (data->>'institutionId') stored,primary key(namespace,collection,record_key));
    insert into study_private.runtime_namespaces values('_specialized_preview_unit',gen_random_uuid(),now(),'{}');
  `);
  await db.exec(await readFile('supabase/migrations/202611190001_curriculum_content_jobs.sql','utf8'));
  await db.exec(await readFile('supabase/migrations/202611190002_content_job_actions.sql','utf8'));
  const namespace='_specialized_preview_unit',year='2026-2027',school='local-school',source='a'.repeat(64);
  const row={subject:'Matematika',grade:10,sourceRow:8,sourceFile:'plan.xlsx'};
  await db.query('insert into study_private.curriculum_source_rows(namespace,school_id,academic_year,source_id,topic_id,archive_hash,eligible,payload) values($1,$2,$3,$4,$4,$4,true,$5)',
   [namespace,school,year,source,row]);
  await db.query('insert into study_private.runtime_records(namespace,collection,record_key,data) values($1,$2,$3,$4)',
   [namespace,'lessons','mapped',{id:'mapped',institutionId:school,academicYear:year,subjectName:row.subject,grade:row.grade,sourceRow:row.sourceRow,sourceFileName:row.sourceFile}]);
  const questions=Array.from({length:10},(_,i)=>({id:'pilot4-question-'+String(i).repeat(64),prompt:'Savol '+i,key:'1',
   explanation:'Sabab va izoh bu bo‘limda yozilgan.',hint:'Eslab ko‘ring.',editorialSource:{topicId:source}}));
  const enqueue=(id:string,data:unknown)=> db.query('insert into study_private.content_jobs(namespace,school_id,academic_year,id,source_id,lesson_id,payload) values($1,$2,$3,$4,$5,$6,$7::jsonb)',
   [namespace,school,year,id,source,'mapped',data===null?null:JSON.stringify(data)]);
  await enqueue('good',questions);
  await enqueue('needs',null);
  await enqueue('bad',questions.map((q,i)=>i===9?{...q,editorialSource:{topicId:'other'}}:{...q,id:'pilot4-question-'+i.toString(16).padStart(64,'f'),prompt:'Boshqa savol '+i}));
  const action=async(action:string,job:string,scope=school)=>(await db.query<{result:{updated:boolean;status?:string}}>(
    'select public.study_content_job_action($1,$2,$3,$4,$5,$6) as result',
    [namespace,scope,year,job,action,'local-owner'])).rows[0].result;
  assert.equal((await action('pause','good','foreign-school')).updated,false);
  assert.deepEqual(await action('pause','good'),{updated:true,status:'paused'});
  assert.deepEqual(await action('resume','good'),{updated:true,status:'pending'});
  const run=()=>db.query<{count:number}>('select study_private.run_editorial_content($1,5) as count',[namespace]);
  assert.equal((await run()).rows[0].count,1);
  assert.equal((await run()).rows[0].count,0);
  const jobs=await db.query<{id:string,status:string,questions:number}>('select id,status,cardinality(question_ids) questions from study_private.content_jobs order by id');
  assert.deepEqual(jobs.rows,[{id:'bad',status:'failed',questions:0},{id:'good',status:'review',questions:10},{id:'needs',status:'needs_source',questions:0}]);
  assert.equal((await db.query<{count:number}>("select count(*)::int count from study_private.runtime_records where collection='topicQuestions' and data->>'status'='draft'")).rows[0].count,10);
  assert.equal((await action('retry','good')).updated,false);
  assert.deepEqual(await action('retry','bad'),{updated:true,status:'pending'});
  assert.equal((await run()).rows[0].count,0);
  await db.exec('set role authenticated');
  await assert.rejects(()=>db.query('select * from study_private.content_jobs'));
  await assert.rejects(()=>db.query("select public.study_content_summary('foo','bar','2026-2027')"));
 }finally{await db.close();}
});
