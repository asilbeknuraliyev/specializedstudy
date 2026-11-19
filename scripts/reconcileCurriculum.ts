import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';

type SourceRow = {
  id:string; sourceRow:number; order:number; title:string; hours:number; quarter:number;
  classwork:string; homework:string; lessonType:string; issues:{code:string;message:string}[];
};
type Sheet = {
  file:string; name:string; sourceHash:string; mapping:{subject?:string;grade?:number;track?:string;area?:string;classCodes:string[]; issues:string[]};
  topics:SourceRow[];
};
const [inventoryPath,destination] = process.argv.slice(2);
if (!inventoryPath || !destination) throw Error('Inventar fayli va natija katalogi talab qilinadi.');
const inventory: {academicYear:string;sha256:string;worksheets:Sheet[]} = JSON.parse(await readFile(inventoryPath,'utf8'));
const digest = (value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalized = (value:string)=>value.normalize('NFKC').toLocaleLowerCase('uz').replace(/[‘’ʻʼ`]/gu,"'").replace(/[\s\u00a0]+/gu,' ').trim();
const marker = (terms:string)=>new RegExp('(?:^|[^\\p{L}])(?:'+terms+')(?=$|[^\\p{L}])','iu');
const categories: Array<[string,RegExp]> = [
  ['chsb',marker('chsb|чсб')], ['bsb',marker('bsb|бсб')],
  ['assessment',/summativ|nazorat ish|контрольная|yakuniy baholash/iu],
  ['exam_preparation',/imtihon.*tayyor|подготовка к экзамен/iu],
  ['laboratory',/laboratoriya|лабораторн/iu],
  ['project',/loyiha|проект/iu],
  ['revision',/takrorlash|mustahkamlash|повторен/iu],
  ['practice',/amaliy mashg|amaliy ish|mashq yech|masalalar yech|практическ/iu],
  ['special',/tadbir|ekskursiya|bayram|экскурси/iu],
];

function classCodes(sheet:Sheet):string[] {
  const grade=sheet.mapping.grade;
  if(!grade) return [];
  // An explicitly labeled legacy class is narrower than a school track.
  const base=sheet.file.split('/').at(-1)||'';
  const explicit=base.match(new RegExp('(?:^|[^0-9])'+grade+'[ _-]*([ABE])[ _-]*(?:sinf|класс)','iu'));
  if(explicit){
    const suffix={a:'a1',b:'a2',e:'t'}[explicit[1].toLowerCase()];
    return suffix&&!(suffix==='t'&&grade<7)?[grade+suffix]:[];
  }
  return sheet.mapping.classCodes.filter(code=>!(grade<7&&code.endsWith('t')));
}

const rows=inventory.worksheets.flatMap(sheet=>{
  if(!/^[a-f0-9]{64}$/.test(sheet.sourceHash||'')) throw Error('Excel faylining SHA-256 qiymati yo‘q.');
  const classes=classCodes(sheet);
  return sheet.topics.map(row=>{
    const classified=categories.find(([,pattern])=>pattern.test(row.lessonType+' '+row.title))?.[0]||'lesson';
    // In informatics, "Takrorlash algoritmi" names iteration itself.
    const loopTopic=sheet.mapping.subject==='Informatika'&&/^takrorlash algoritmi\b/i.test(row.title)&&(!row.lessonType||/^oddiy dars/i.test(row.lessonType));
    const kind=classified==='revision'&&loopTopic?'lesson':classified;
    const title=normalized(row.title);
    const subject=sheet.mapping.subject||null, grade=sheet.mapping.grade||null;
    const area=sheet.mapping.area||null;
    // Standalone topics coalesce across class tracks. Unresolved and repetitive activities retain row identity.
    const eligible=kind==='lesson'&&!!subject&&!!grade&&title.length>=6&&!/^(mavzu|dars|lesson|урок)\s*\d*$/iu.test(title);
    const topicId=digest([inventory.academicYear,subject,grade,area,eligible?title:row.id]);
    return {id:row.id,topicId,eligible,academicYear:inventory.academicYear,
      sourceFile:sheet.file,sourceSheet:sheet.name,sourceRow:row.sourceRow,sourceHash:sheet.sourceHash,
      grade,subject,area,classTrack:sheet.mapping.track||null,classCodes:classes,title:row.title,kind,
      sourceLessonType:row.lessonType,plannedHours:row.hours,quarter:row.quarter||null,classwork:row.classwork,
      homework:row.homework,sequence:row.order,mappingStatus:classes.length&&subject&&grade?'candidate':'unresolved',
      publicationStatus:'draft',issues:[...sheet.mapping.issues,...row.issues.map(issue=>issue.message)]};
  });
});
if(new Set(rows.map(row=>row.id)).size!==rows.length) throw Error('Manba satri identifikatori takrorlangan.');
const report={
  archiveHash:inventory.sha256,sourceRows:rows.length,uniqueRecords:new Set(rows.map(r=>r.topicId)).size,
  teachableCandidates:new Set(rows.filter(r=>r.eligible).map(r=>r.topicId)).size,
  unresolvedRows:rows.filter(r=>r.mappingStatus==='unresolved').length,
  classCodes:[...new Set(rows.flatMap(r=>r.classCodes))].sort(),
  categories:Object.fromEntries(['lesson',...categories.map(([kind])=>kind)].map(kind=>[kind,rows.filter(r=>r.kind===kind).length]))
};
await mkdir(destination,{recursive:true});
let batch=0;
for(let i=0;i<rows.length;i+=160) {
  await writeFile(join(destination,`source-${String(++batch).padStart(3,'0')}.json`),JSON.stringify(rows.slice(i,i+160)));
}
await writeFile(join(destination,'summary.json'),JSON.stringify({...report,batches:batch},null,2));
console.log(JSON.stringify({...report,batches:batch}));
