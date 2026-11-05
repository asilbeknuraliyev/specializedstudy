import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseAndValidateCurriculumZipBuffer, applyCurriculumZipPreviewToDatabase, OFFICIAL_MATH_ARCHIVE_REL_PATH } from './mathCurriculumImporter';
import type { WorkPlan, LessonItem, Topic, CurriculumImportJob } from '../types';

test('real mathematics archive keeps source rows, class mappings and repeat imports stable', async () => {
 const preview=await parseAndValidateCurriculumZipBuffer(fs.readFileSync(OFFICIAL_MATH_ARCHIVE_REL_PATH));
 assert.equal(preview.errors.length,0); assert.equal(preview.totalWorkbooks,21); assert.equal(preview.totalLessonRecords,2516);
 const plans:WorkPlan[]=[], lessons:LessonItem[]=[], topics:Topic[]=[], jobs:CurriculumImportJob[]=[];
 const options={academicYear:'2026-2027',publishImmediately:true,tTrackVisibilityApproved:true,duplicatePolicy:'skip_existing' as const};
 applyCurriculumZipPreviewToDatabase(preview,plans,lessons,topics,jobs,options);
 assert.equal(lessons.length,2516);assert.equal(plans.length,21);
 assert.equal(lessons.filter(l=>l.additionalCurriculumAssignment&&l.tTrackVisibilityApproved).length,850);
 for(const w of preview.workbooks){for(let i=0;i<w.rows.length;i++){const r=w.rows[i];const l=lessons.find(l=>l.id===`lesson-${w.workbookKey}-${String(i+1).padStart(3,'0')}`)!;assert.ok(l);assert.equal(l.topicTitle,r.lessonTitle || r.topicName);assert.equal(l.sourceRow,r.sourceRow);assert.deepEqual(l.classCodes,w.classCodes);}}
 lessons[0].title='Admin reviewed title';
 applyCurriculumZipPreviewToDatabase(preview,plans,lessons,topics,jobs,options);
 assert.equal(lessons.length,2516);assert.equal(lessons[0].title,'Admin reviewed title');
 assert.ok(lessons.every(l=>l.status==='published'));
});
