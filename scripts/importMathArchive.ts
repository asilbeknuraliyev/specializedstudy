import fs from 'node:fs';
import path from 'node:path';
import { parseAndValidateCurriculumZipBuffer, applyCurriculumZipPreviewToDatabase } from '../src/utils/mathCurriculumImporter';
import { getDbState, saveDbState } from '../src/server/dbEngine';
const source = process.argv[2];
if (!source || !process.argv.includes('--publish')) throw new Error('Usage: node --import tsx scripts/importMathArchive.ts <archive.zip> --publish [--include-t]');
const preview = await parseAndValidateCurriculumZipBuffer(fs.readFileSync(source));
if (preview.errors.length) throw new Error(preview.errors.join('\n'));
const db = getDbState('prod');
const backups = path.resolve('.data/backups'); fs.mkdirSync(backups,{recursive:true});
fs.writeFileSync(path.join(backups,`before-curriculum-${Date.now()}.json`),JSON.stringify(db),{mode:0o600});
const result=applyCurriculumZipPreviewToDatabase(preview,db.workPlans,db.lessons,db.topics,db.curriculumImportJobs,{
 institutionId:db.institutions[0].id, academicYear:db.institutions[0].academicYear,
 actorUid:'local-operator',actorName:'Local curriculum import',publishImmediately:true,
 tTrackVisibilityApproved:process.argv.includes('--include-t'),duplicatePolicy:'update_existing',
});
const expectedIds=new Set(preview.workbooks.flatMap(w=>w.rows.map((_,i)=>'lesson-'+w.workbookKey+'-'+String(i+1).padStart(3,'0'))));
for(const lesson of db.lessons) if(lesson.id.startsWith('lesson-math-wb-') && !expectedIds.has(lesson.id) && !lesson.modificationHistory?.length) { lesson.status='archived'; }
saveDbState('prod',db);
console.log(JSON.stringify({workbooks:preview.totalWorkbooks,sourceLessons:preview.totalLessonRecords,imported:result.importedLessonsCount,preserved:result.skippedDuplicatesCount,published:db.lessons.filter(l=>l.status==='published').length,tApproved:db.lessons.filter(l=>l.additionalCurriculumAssignment&&l.tTrackVisibilityApproved).length}));
