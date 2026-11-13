import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanupDemoExams} from '../../server/cleanupDemoExams';
import {feedbackTemplates} from '../../server/feedbackTemplates';
test('DEMO formal cleanup refuses a real participant before mutation and otherwise preserves unrelated work', () => {
  const db:any={assessments:[{id:'demo',institutionId:'s',teacherId:'dt',questionIds:['dq']},{id:'real',institutionId:'s',teacherId:'rt',questionIds:['rq']}],questions:[{id:'dq'},{id:'rq'}],attempts:[{id:'da',institutionId:'s',assessmentId:'demo',studentId:'real'}]};
  const before=JSON.stringify(db);assert.equal(cleanupDemoExams(db,'s',new Set(['dt','du'])),false);assert.equal(JSON.stringify(db),before);
  db.attempts[0].studentId='du';db.attempts.push({id:'ra',institutionId:'s',assessmentId:'real',studentId:'real'});db.gradingRecords=[{id:'dg',institutionId:'s',attemptId:'da'},{id:'rg',institutionId:'s',attemptId:'ra'}];
  assert.equal(cleanupDemoExams(db,'s',new Set(['dt','du'])),true);assert.deepEqual(db.assessments.map((a:any)=>a.id),['real']);assert.deepEqual(db.questions.map((q:any)=>q.id),['rq']);assert.deepEqual(db.attempts.map((a:any)=>a.id),['ra']);assert.deepEqual(db.gradingRecords.map((a:any)=>a.id),['rg']);
});
test('feedback suggestions stay in school/subject scope and never expose author metadata to learners',()=>{
  const db={feedbackComments:[{id:'ok',institutionId:'s',text:'Next step',createdByUid:'secret'},{id:'other',institutionId:'foreign',text:'PRIVATE'},{id:'subject',institutionId:'s',subject:'Chemistry',text:'OTHER_SUBJECT'}]};
  assert.deepEqual(feedbackTemplates(db,{institutionId:'s',role:'student'}),[]);assert.deepEqual(feedbackTemplates(db,{institutionId:'s',role:'teacher',subject:'Math'}),[{id:'ok',category:undefined,text:'Next step'}]);
});
