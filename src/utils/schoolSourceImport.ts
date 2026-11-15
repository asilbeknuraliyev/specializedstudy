// Pure, deterministic parsers shared by the worker, server and local dry-run.
// Workbook cell content is data; formulas, markup and instructions are never executed.
export type SourceSheet={name:string;rows:unknown[][];startRow?:number};
export type SourceIssue={sheet:string;row:number;code:string;message:string};
export type SchoolPersonRow={sourceRow:number;sourceSheet:string;displayName:string;role:'student'|'teacher';classCode?:string;sourceClass?:string;subjects:string[];position?:string;sourceKey:string;issues:SourceIssue[]};
export const normalizedText=(value:unknown)=>String(value??'').normalize('NFKC').replace(/[‘’ʻʼ`´]/g,"'").replace(/\s+/g,' ').trim();
export const nameIdentity=(value:unknown)=>normalizedText(value).toLowerCase().replace(/[^\p{L}\p{N} ]/gu,'').split(' ').filter(Boolean).sort().join(' ');
export function schoolClassCode(value:unknown):string|undefined{
 const text=normalizedText(value).toLowerCase().replace(/синф|sinf/g,'').replace(/[\s–—-]/g,'');
 const source=/^(5|6|7|8|9|10|11)([abeабе])$/.exec(text);
 const mapped=source?source[1]+({a:'a1',b:'a2',e:'t','а':'a1','б':'a2','е':'t'} as Record<string,string>)[source[2]]:text;
 return /^(?:[5-9]|10|11)a[12]$|^(?:[7-9]|10|11)t$/.test(mapped)?mapped:undefined;
}
const subjectAliases:Record<string,string>={
 'matematika':'Matematika','algebra':'Matematika','geometriya':'Matematika','fizika':'Fizika','biologiya':'Biologiya','kimyo':'Kimyo','ingliz tili':'Ingliz tili',
 'ona tili va adabiyot (o\'zb)':'Ona tili va adabiyot','ona tili va adabiyot':'Ona tili va adabiyot','rus tili va adabiyoti (rus)':'Rus tili va adabiyoti','rus tili':'Rus tili',
 'tarix':'Tarix','jismoniy tarbiya':'Jismoniy tarbiya','informatika':'Informatika','informatika va axborot texnologiyalari':'Informatika','tarbiya':'Tarbiya',
 'huquq':'Huquq','adabiyot':'Adabiyot','ona tili':'Ona tili','chqbt':'Chaqiruvga qadar boshlang‘ich tayyorgarlik','geografiya':'Geografiya',
};
export const standardSubject=(value:unknown)=>{const clean=normalizedText(value);return subjectAliases[clean.toLowerCase()]||clean;};
function issue(sheet:string,row:number,code:string,message:string):SourceIssue{return{sheet,row,code,message};}
export function parsePeople(sheets:SourceSheet[],role:'student'|'teacher'){
 const people:SchoolPersonRow[]=[],issues:SourceIssue[]=[],seen=new Set<string>();let blankRows=0,headerRows=0;
 for(const sheet of sheets){
  let header=-1,nameCol=-1,classCol=-1,positionCol=-1,subjectCol=-1;
  for(let i=0;i<Math.min(sheet.rows.length,30);i++){
   const cells=sheet.rows[i].map(c=>normalizedText(c).toLowerCase());
   const name=cells.findIndex(v=>/полное наименование|фамилия|фио|f\.?i\.?sh|f\.?i\.?o|familiya|full.?name|ism.*sharif/.test(v));
   const cls=cells.findIndex(v=>/sinf|класс/.test(v)),sub=cells.findIndex(v=>/предмет|fan|subject/.test(v));
   if(name>=0&&(role==='student'?cls>=0:sub>=0)){
    header=i;nameCol=name;classCol=cls;subjectCol=sub;positionCol=cells.findIndex(v=>/должност|lavozim|position/.test(v));break;
   }
  }
  if(header<0){issues.push(issue(sheet.name,sheet.startRow||1,'HEADER_NOT_FOUND','F.I.Sh. va sinf/fan ustunlari topilmadi.'));continue;}
  headerRows+=header+1;
  for(let i=header+1;i<sheet.rows.length;i++){
   const raw=sheet.rows[i],row=(sheet.startRow||1)+i;
   if(!raw.some(v=>normalizedText(v))){blankRows++;continue;}
   const displayName=normalizedText(raw[nameCol]),local:SourceIssue[]=[];
   if(!displayName||displayName.length<5||displayName.length>160||displayName.split(' ').length<2)local.push(issue(sheet.name,row,'INVALID_NAME','F.I.Sh. to‘liq emas; bu qator tasdiqsiz kiritilmaydi.'));
   const sourceClass=classCol>=0?normalizedText(raw[classCol]):undefined,classCode=sourceClass?schoolClassCode(sourceClass):undefined;
   if(role==='student'&&!classCode)local.push(issue(sheet.name,row,'UNKNOWN_CLASS','Sinf rasmiy A1/A2/T tuzilmasiga mos emas.'));
   const subjects=role==='teacher'&&subjectCol>=0?normalizedText(raw[subjectCol]).split(/\s*[;\n]\s*/).filter(Boolean).map(standardSubject):[];
   const position=positionCol>=0?normalizedText(raw[positionCol])||undefined:undefined;
   if(role==='teacher'&&!subjects.length)local.push(issue(sheet.name,row,'SUBJECT_MISSING','Fan manbada ko‘rsatilmagan; ustozni biriktirish kutiladi.'));
   if(role==='teacher')local.push(issue(sheet.name,row,'CLASS_ASSIGNMENT_REQUIRED','Manbada sinf biriktirishlari yo‘q. Vakolatli administrator tanlaydi.'));
   if(role==='teacher'&&position&&/direktor|директор|ibdo|kadr|кадр|kutub|кутуб|psix|псих/i.test(position))local.push(issue(sheet.name,row,'STAFF_ROLE_REVIEW','Lavozim alohida tekshiriladi; kutish holatida tayyorlang. Tizim huquqi avtomatik berilmaydi.'));
   const identity=role+'|'+(classCode||'')+'|'+nameIdentity(displayName);
   if(seen.has(identity))local.push(issue(sheet.name,row,'DUPLICATE_SOURCE','Shu sinf/rolda bir xil F.I.Sh. takrorlangan; alohida tekshiring.'));
   seen.add(identity);issues.push(...local);
   people.push({sourceRow:row,sourceSheet:sheet.name,displayName,role,classCode,sourceClass,subjects,position,sourceKey:identity,issues:local});
  }
 }
 return{people,issues,blankRows,headerRows,classCounts:Object.fromEntries([...new Set(people.map(p=>p.classCode).filter(Boolean))].sort().map(c=>[c,people.filter(p=>p.classCode===c).length]))};
}
export type SchoolPlanRow={sourceRow:number;sourceSheet:string;order:number;title:string;hours:number;quarter:number;classwork:string;homework:string;lessonType:string;issues:SourceIssue[]};
export function inferSchoolPlanTarget(path:string,sheet:SourceSheet){
 const parts=path.split('/'),file=normalizedText(parts.at(-1)),folder=normalizedText(parts[1]||parts.at(-2)||'').replace(/[\[\]]/g,'');
 const leading=sheet.rows.slice(0,4).map(r=>r.map(normalizedText).join(' ')).join(' ');
 const grades=[...new Set([...file.matchAll(/(?:^|[^\d])(5|6|7|8|9|10|11)\s*[aAtT]?\s*[-_ ]?\s*(?:sinf|класс)/gi),...leading.matchAll(/(?:^|[^\d])(5|6|7|8|9|10|11)\s*[-_ ]?\s*(?:sinf|класс)/gi)].map(m=>Number(m[1])))];
 const grade=grades.length===1?grades[0]:undefined,lower=file.toLowerCase();
 const explicitT=/tabiiy|tabiy|(?:5|6|7|8|9|10|11)t\s*[-_ ]?sinf/.test(lower),explicitA=/aniq|(?:5|6|7|8|9|10|11)a\s*[-_ ]?sinf/.test(lower);
 const track=explicitA&&!explicitT?'A':explicitT&&!explicitA?'T':grade&&grade<7?'A':undefined;
 let subject=standardSubject(folder),area:string|undefined;
 if(/adabiyot/i.test(file))subject='Adabiyot';else if(/ona[ _]tili/i.test(file))subject='Ona tili';
 if(/tabi[iy]+[ _]fan/i.test(file))subject='Tabiiy fan';
 if(/algebra/i.test(file)){subject='Matematika';area='Algebra';}else if(/geometriya/i.test(file)){subject='Matematika';area='Geometriya';}
 const issues:string[]=[];
 if(!grade)issues.push(grades.length>1?'Fayl va sarlavhada sinflar bir-biriga mos emas.':'Sinf aniq topilmadi.');
 if(!track)issues.push('A yoki T yo‘nalishi aniq ko‘rsatilmagan.');
 if(folder.toUpperCase()==='ART')issues.push('ART fanining maktabdagi nomini tasdiqlang.');
 if(sheet.rows.length&&/kimyo/i.test(sheet.name)&&!/^kimyo$/i.test(subject))issues.push('Varaq nomi boshqa fanga tegishli; manbani tekshiring.');
 if(explicitT&&grade&&grade<7)issues.push('5–6-sinflar uchun T sinfi mavjud emas.');
 return{grade,track,subject,area,classCodes:grade&&track?(track==='A'?[grade+'a1',grade+'a2']:[grade+'t']):[],issues};
}
export function parseSchoolPlan(sheets:SourceSheet[]){
 const lessons:SchoolPlanRow[]=[],issues:SourceIssue[]=[];let blankRows=0;
 for(const sheet of sheets){
  if(!sheet.rows.some(r=>r.some(v=>normalizedText(v))))continue;
  const header=sheet.rows.findIndex(r=>r.some(v=>/mavzu|тема урока/i.test(normalizedText(v)))&&r.some(v=>/soat|час/i.test(normalizedText(v))));
  if(header<0){issues.push(issue(sheet.name,sheet.startRow||1,'PLAN_HEADER_MISSING','Mavzu va soat ustunlari topilmadi.'));continue;}
  const cells=sheet.rows[header].map(v=>normalizedText(v).toLowerCase());const col=(re:RegExp)=>cells.findIndex(v=>re.test(v));
  const titleCol=col(/mavzu|тема урока/),orderCol=col(/tartib|t\/r|^№|^no\.?$/),hoursCol=col(/soat|час/),quarterCol=col(/davr|chorak|четверть/),workCol=col(/sinf\s*ishi|работа в классе|задания в классе/),homeCol=col(/uy.*vazifa|домашнее задание/),typeCol=col(/dars\s*turi|тип урока/);let currentQuarter:number|undefined;
  for(let i=header+1;i<sheet.rows.length;i++){
   const raw=sheet.rows[i],row=(sheet.startRow||1)+i,text=normalizedText(raw[titleCol]);if(!raw.some(v=>normalizedText(v))){blankRows++;continue;}
   const quarterHeading=raw.map(normalizedText).join(' ').match(/(?:^|\s)([1-4])\s*[-–]?\s*chorak(?:\s|$)/i);
   if(quarterHeading&&!Number(raw[orderCol])){currentQuarter=Number(quarterHeading[1]);continue;}
   if(!text){issues.push(issue(sheet.name,row,'TOPIC_MISSING','Mavzu nomi bo‘sh.'));continue;}
   const ordinal=normalizedText(raw[orderCol]).replace(/\s*[-–]?\s*(?:dars|урок)$/i,'');
   const local:SourceIssue[]=[],order=Number(ordinal),hours=Number(normalizedText(raw[hoursCol]).replace(',','.')),quarter=Number(raw[quarterCol])||currentQuarter||0;
   if(!Number.isInteger(order)||order<1||order>2000)local.push(issue(sheet.name,row,'ORDER_INVALID','Dars tartibi topilmadi yoki noto‘g‘ri.'));
   if(!Number.isFinite(hours)||hours<=0||hours>8)local.push(issue(sheet.name,row,'HOURS_INVALID','Dars soati 0 dan katta, 8 dan oshmasin.'));
   if(![1,2,3,4].includes(quarter))local.push(issue(sheet.name,row,'QUARTER_REQUIRED','Chorak aniq ko‘rsatilmagan; taxmin qilinmadi.'));
   if(text.length>1500)local.push(issue(sheet.name,row,'TOPIC_TOO_LONG','Mavzu 1500 belgidan oshgan.'));
   lessons.push({sourceRow:row,sourceSheet:sheet.name,order,title:text,hours,quarter,classwork:normalizedText(raw[workCol]),homework:normalizedText(raw[homeCol]),lessonType:normalizedText(raw[typeCol]),issues:local});issues.push(...local);
  }
 }
 return{lessons,issues,blankRows};
}
