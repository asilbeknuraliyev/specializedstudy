import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {readEditorialDraft} from '../src/utils/editorialDraft';
import {bankQuestion} from '../src/server/topicEngine';

const dir = process.argv[2];
if (!dir) throw Error('Pilot qoralamalar papkasini kiriting.');
const inputs = await Promise.all((await readdir(dir)).filter(file=>file.endsWith('.json')).sort()
  .map(async file=>JSON.parse(await readFile(join(dir,file),'utf8'))));
if(inputs.length!==30) throw Error('Paketda aynan 30 savol bo‘lishi kerak.');
const drafts=inputs.map(input=>{
  const draft=readEditorialDraft(input);
  const source=draft.editorialSource;
  if (!source.subject || !source.grade || !source.cognitiveSkill || !source.trace.title)
    throw Error('Fan, sinf, mavzu va ko‘nikma majburiy.');
  const id=createHash('sha256').update(JSON.stringify([source.topicId,draft.prompt])).digest('hex');
  return { ...bankQuestion.parse(draft), id:'pilot30-question-'+id, lessonId:'pilot30-lesson-'+source.topicId };
});
if(new Set(drafts.map(d=>d.id)).size!==drafts.length) throw Error('Takrorlangan savol.');
process.stdout.write(JSON.stringify(drafts));

