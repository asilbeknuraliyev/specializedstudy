import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('editorial release checks scope, question integrity and publication versions', async () => {
 const db = new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  for (const file of ['202611140001_private_runtime.sql','202611190001_curriculum_content_jobs.sql','202611190003_editorial_practice_publication.sql']) {
   await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
  }
  const namespace='_specialized_preview_test', school='test-school', year='2026-2027';
  await db.query('insert into study_private.runtime_namespaces(namespace) values($1)',[namespace]);
  const put=(collection:string,id:string,data:object)=>db.query(
   'insert into study_private.runtime_records(namespace,collection,record_key,data) values($1,$2,$3,$4)',
   [namespace,collection,id,{id,institutionId:school,...data}]);
  await put('institutions',school,{academicYear:year});
  await put('classes','class-8a2',{code:'8a2',grade:8,status:'active'});
  const prompts=['Hajmni qaysi asbob bilan o‘lchaymiz?', 'Massaning birligini tanlang.', 'Chizg‘ichning ostida nima bor?',
   'Qancha vaqt ketganini yozing.', 'Aravachaning kuch yo‘nalishini belgilang.', 'Taxta qirralari sonini toping.',
   'Nima maqsadda ikki xil idish ishlatiladi?', 'Amalni teskari hisobda tekshiring.', 'Maydon chegarasidagi xatoni tushuntiring.',
   'Qizil buyumlar natijalari bo‘yicha xulosa yozing.'];
  const addSet=async(id:string,kind:string,invalid=false)=>{
   const source=(id==='good'?'a':id[0]).repeat(64), lessonId='pilot30-lesson-'+source, subject='Fizika';
   const fields={subject,grade:8,kind,sourceRow:3,sourceFile:'plan.xlsx',sourceSheet:'Sheet',sourceHash:source,issues:[],title:'O‘lchov mavzusi'};
   await db.query(`insert into study_private.curriculum_source_rows(namespace,school_id,academic_year,source_id,topic_id,archive_hash,eligible,subject_id,class_ids,payload)
     values($1,$2,$3,$4,$4,$4,true,'physics',$5,$6)`,[namespace,school,year,source,['class-8a2'],fields]);
   await put('lessons',lessonId,{status:'draft',academicYear:year,subjectName:subject,subjectId:'physics',classIds:['class-8a2'],
     grade:8,sourceRow:3,sourceFileName:'plan.xlsx',sourceWorksheet:'Sheet',sourceHash:source});
   const questions=prompts.map((prompt,i)=>({id:source+i,prompt,key:'1',kind:'short',difficulty:['easy','medium','hard'][i%3],
    explanation:'Birinchi va keyingi qadam izohi.',hint:'Qoidadan foydalaning.',
    steps:['Birinchi qadamni ko‘ring.','Ikkinchi qadamni hisoblang.'],
    editorialSource:{topicId:source,sourceHash:source,subject,grade:8,cognitiveSkill:'Ko‘nikma '+i,
     trace:{file:'plan.xlsx',sheet:'Sheet',row:3,kind:'lesson'}}}));
   for (const [i,q] of questions.entries()) await put('topicQuestions',q.id,{
    ...q,status:'draft',revision:1,schoolId:school,lessonId,...(invalid&&i===0?{key:'2'}:{})});
   await db.query(`insert into study_private.content_jobs(namespace,school_id,academic_year,id,source_id,lesson_id,status,payload,question_ids)
    values($1,$2,$3,$4,$5,$6,'review',$7::jsonb,$8)`,[namespace,school,year,'editorial-confirmed-'+id,source,lessonId,
     JSON.stringify(questions),questions.map(q=>q.id)]);
  };
  await addSet('good','lesson');
  await addSet('bad','lesson',true);
  await addSet('formal','bsb');
  const release=async(publish:boolean)=>(await db.query<{outcome:string}>(
   'select outcome from study_private.publish_editorial_practice($1,$2,$3,$4)',[
    namespace,school,['editorial-confirmed-good','editorial-confirmed-bad','editorial-confirmed-formal'],publish
   ])).rows.map(r=>r.outcome);
  assert.deepEqual(await release(false),['QUESTION_QUALITY_REVIEW_REQUIRED','CURRICULUM_REVIEW_REQUIRED','READY']);
  assert.equal((await db.query("select * from study_private.runtime_records where collection='topicTests'")).rows.length,0);
  assert.equal((await release(true)).at(-1),'PUBLISHED');
  assert.equal((await release(true)).at(-1),'ALREADY_PUBLISHED');
  const [{data}]=(await db.query<{data:any}>("select data from study_private.runtime_records where collection='topicTests'")).rows;
  assert.equal(data.snapshot.length,10);
  assert.equal(data.snapshot[0].revision,2);
  assert.equal(data.snapshot[0].practiceQuality.revision,2);
  assert.equal(data.snapshot[0].approval,undefined);
  assert.deepEqual(data.classIds,['class-8a2']);
  assert.equal(data.hintsAfterSubmission,true);
  await db.exec('set role authenticated');
  await assert.rejects(()=>release(true));
 } finally { await db.close(); }
});
