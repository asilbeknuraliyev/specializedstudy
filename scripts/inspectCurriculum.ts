import fs from 'node:fs';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import {parseSchoolPlan,inferSchoolPlanTarget} from '../src/utils/schoolSourceImport';

const [source,destination,coverageDestination]=process.argv.slice(2);
if(!source||!destination)throw Error('ZIP manbasi va JSON natija yo‘lini kiriting.');
const bytes=fs.readFileSync(source);
const archive=await JSZip.loadAsync(bytes);
const sheets=[];
for(const [file,entry] of Object.entries(archive.files)){
  if(entry.dir||!file.toLowerCase().endsWith('.xlsx')||file.split('/').pop()?.startsWith('~$'))continue;
  const workbook=XLSX.read(await entry.async('nodebuffer'),{type:'buffer'});
  for(const name of workbook.SheetNames){
    const ws=workbook.Sheets[name];
    const sheet={name,rows:XLSX.utils.sheet_to_json<unknown[]>(ws,{header:1,range:0,blankrows:true,defval:''})};
    const parsed=parseSchoolPlan([sheet]);
    const mapping=inferSchoolPlanTarget(file,sheet);
    const topics=parsed.lessons.map(row=>({
      id:createHash('sha256').update(JSON.stringify(['2026-2027',file,name,row.sourceRow])).digest('hex'),
      ...row, status:'review',kind:/(?:^|[^\p{L}])(?:bsb|chsb|бсб|чсб)(?!\p{L})|summativ/iu.test(row.title)?'assessment':'lesson'
    }));
    sheets.push({file,name,mapping,issues:parsed.issues,topics});
  }
}
const result={academicYear:'2026-2027',sha256:createHash('sha256').update(bytes).digest('hex'),files:new Set(sheets.map(s=>s.file)).size,sheets:sheets.length,topics:sheets.reduce((n,s)=>n+s.topics.length,0),worksheets:sheets};
fs.writeFileSync(destination,JSON.stringify(result));
if (coverageDestination) {
  const coverage=sheets.map(sheet=>{
    const folder=sheet.file.split('/').at(-2)?.replace(/^\[|\]$/g,'') || sheet.mapping.subject || 'Aniqlanmagan';
    return {file:sheet.file,sheet:sheet.name,subject:folder[0].toLocaleUpperCase('uz')+folder.slice(1),
      grade:sheet.mapping.grade??null,topics:sheet.topics.length,assessment:sheet.topics.filter(t=>t.kind==='assessment').length,
      issues:sheet.issues.length,mapping:sheet.mapping.issues};
  });
  fs.writeFileSync(coverageDestination,JSON.stringify(coverage,null,2)+'\n');
}
console.log(JSON.stringify({files:result.files,sheets:result.sheets,topics:result.topics,issues:sheets.reduce((n,s)=>n+s.issues.length,0),sample:sheets[0]?.file}));
