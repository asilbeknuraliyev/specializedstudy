import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {bankQuestion} from '../src/server/topicEngine';
import {banks} from './contentTopicSets';

type Sheet = {
 file:string;name:string;sourceHash:string;
 mapping:{grade:number;subject:string};topics:{id:string;title:string;sourceRow:number;kind:string}[];
};
const [inventoryPath,outputPath]=process.argv.slice(2);
if(!inventoryPath||!outputPath) throw Error('Manba inventari va paket yo‘li kerak.');
const inventory:{worksheets:Sheet[]}=JSON.parse(await readFile(inventoryPath,'utf8'));
const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
const words=(text:string)=>new Set(text.normalize('NFKC').toLowerCase().replace(/\d+(?:\.\d+)?/g,'#').match(/[\p{L}#]+/gu)||[]);

const jobs=banks.map(bank=>{
 const sheet=inventory.worksheets.find(ws=>ws.topics.some(row=>row.id===bank.topic));
 const source=sheet?.topics.find(row=>row.id===bank.topic);
 if(!sheet||!source||source.kind!=='lesson'||!sheet.mapping.grade||!sheet.mapping.subject||!sheet.sourceHash)
  throw Error('Qoralama tasdiqlash uchun manba satriga bog‘lanmagan.');
 if(bank.questions.length!==10||new Set(bank.questions.map(q=>q.skill)).size!==10)
  throw Error(sheet.mapping.subject+' bo‘yicha 10 xil maqsadli savol kerak.');
 const seen:Array<{tokens:Set<string>;prompt:string}>=[];
 const questions=bank.questions.map(item=>{
   if(!item.verify(item.key))throw Error('Javob deterministik tekshiruvdan o‘tmadi: '+item.prompt);
   if(item.options.some(option=>option!==item.key&&item.verify(option)))throw Error('Bir nechta javob to‘g‘ri.');
   const prompt=item.prompt.normalize('NFKC').trim().toLowerCase();
   const tokens=words(prompt);
   for(const old of seen){
     const shared=[...tokens].filter(token=>old.tokens.has(token)).length;
     if(old.prompt===prompt||shared/(tokens.size+old.tokens.size-shared)>=.91)
       throw Error('Savol o‘xshashlik tekshiruvida qolgan: '+item.prompt);
   }
   seen.push({prompt,tokens});
   return bankQuestion.parse({...item,id:'pilot4-question-'+digest(bank.topic+'\0'+prompt),points:1,
     source:{title:sheet.name,page:String(source.sourceRow)},
     editorialSource:{topicId:source.id,sourceHash:sheet.sourceHash,templateVersion:'editorial-4.0',
     subject:sheet.mapping.subject,grade:sheet.mapping.grade,cognitiveSkill:item.skill,
     trace:{file:sheet.file,sheet:sheet.name,row:source.sourceRow,kind:'lesson',title:source.title}}
   });
 });
 return {id:'pilot4-job-'+source.id,sourceId:source.id,lessonId:'pilot30-lesson-'+source.id,
   subject:sheet.mapping.subject, grade:sheet.mapping.grade, questions};
});
await writeFile(outputPath,JSON.stringify(jobs));
console.log(JSON.stringify(jobs.map(j=>({subject:j.subject,grade:j.grade,questions:j.questions.length}))));
