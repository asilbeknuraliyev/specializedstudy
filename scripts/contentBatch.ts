import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { bankQuestion } from '../src/server/topicEngine';
import { additionalPilot } from './contentPilotExercises';
import { pilot } from './contentPilot';

type Inventory = { sha256: string; worksheets: {file:string; name:string; mapping:{grade?:number;subject?:string}; topics:{id:string; sourceRow:number;kind:string;title:string}[]}[] };
const [input, destination, limitText = '3'] = process.argv.slice(2);
const limit = Number(limitText);
if (!input || !destination || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
  throw Error('Inventar fayli, natija papkasi va 1–100 oralig‘idagi limit kerak.');
}
const source:Inventory = JSON.parse(await readFile(input, 'utf8'));
const topics = new Map(source.worksheets.flatMap(sheet => sheet.topics.map(topic =>
  [topic.id, {file:sheet.file, sheet:sheet.name, row:topic.sourceRow, kind:topic.kind, title:topic.title, grade:sheet.mapping.grade, subject:sheet.mapping.subject}] as const)));
const normalize = (s:string) => s.normalize('NFKC').toLowerCase().replace(/\s+/gu,' ').trim();
const seen = new Set<string>();
const tokens = (text:string)=>new Set(normalize(text).match(/[\p{L}\d]+/gu)||[]);
const acceptedPrompts:string[] = [];
function closeMatch(prompt:string) {
  const a = tokens(prompt);
  return acceptedPrompts.some(other=>{
    const b = tokens(other), shared=[...a].filter(token=>b.has(token)).length;
    return shared/(a.size+b.size-shared)>=0.82;
  });
}
await mkdir(destination, {recursive:true});
let created = 0;
for (const item of [...pilot.map(q=>({...q,kind:'short',options:[],skill:'Modeldan hisoblash'})),...additionalPilot]) {
  const trace = topics.get(item.topic);
  if (!trace || trace.kind !== 'lesson' || !trace.grade || !trace.subject) throw Error('Mavzu manbaga mos kelmadi.');
  const fingerprint = normalize(item.prompt);
  if (seen.has(fingerprint) || closeMatch(item.prompt)) throw Error('Savol takrorlangan.');
  seen.add(fingerprint);
  acceptedPrompts.push(item.prompt);
  const question = bankQuestion.parse({kind:item.kind,options:item.options,prompt:item.prompt,key:item.key,points:1,
    explanation:item.explanation,steps:item.steps,diagram:item.diagram,hint:item.hint,difficulty:item.difficulty});
  if (!item.verify(item.key)) throw Error('Hisoblangan javob kalitga mos kelmadi.');
  const version = 'pilot-3';
  const job = {topicId:item.topic, templateVersion:version, provider:'editorial', cost:0,
    sourceHash:source.sha256, subject:trace.subject, grade:trace.grade, cognitiveSkill:item.skill, trace, validation:'passed', review:'pending', published:false, question};
  const data = JSON.stringify(job, null, 2);
  const id = createHash('sha256').update(data).digest('hex');
  const file = join(destination,id+'.json');
  try {
    if (await readFile(file,'utf8') !== data) throw Error('Saqlangan paket o‘zgargan.');
    continue;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const temporary = file+'.'+randomUUID()+'.tmp';
  try {
    await writeFile(temporary,data,{flag:'wx'});
    await rename(temporary,file);
    created++;
  } finally { await rm(temporary,{force:true}); }
  if (created >= limit) break;
}
console.log(JSON.stringify({created}));

