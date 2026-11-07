export interface SourceLine { text:string;page:number;x:number;y:number;width:number;height:number; }
export interface SourceBoundary {number:number;variant:string;index:number;}
export function findQuestionBoundaries(lines:SourceLine[]):SourceBoundary[] {
 const explicit=lines.some(l=>/^\s*\d+\s*-\s*topshiriq/i.test(l.text));
 const candidates=lines.flatMap((l,index)=>{
  const m=l.text.replace(/^\s*\d{7,}\s*(?:e(?:Maktab)?\s*)?/, '').match(explicit?/^\s*(\d{1,2})\s*-\s*topshiriq/i:/^\s*(\d(?:\s?\d)?)\s*[.)](?!\d)\s*\S/);
  return m?[{number:Number(m[1].replace(/\s/g,'')),index}]:[];
 });
 const scored=!explicit && lines.filter(l=>/\bball\b/i.test(l.text)).length>=3;
 let expected=1,variant='I';const result:SourceBoundary[]=[];
 for(let i=0;i<candidates.length;i++){
  const c=candidates[i];const before=lines.slice(i?candidates[i-1].index:0,c.index).map(l=>l.text).join(' ');
  const detected=before.match(/\b(III|II|IV|I)\s*variant\b/i);if(detected)variant=detected[1].toUpperCase();
  const text=lines.slice(c.index,candidates[i+1]?.index??lines.length).map(l=>l.text).join(' ');
  if(scored&&!/(?:Bilish|Qo[‘’ʻ']llash|Mulohaza)[^]{0,100}?ball/i.test(text.slice(0,2000)))continue;
  if(c.number===1&&expected>2){expected=1;variant=detected?.[1]?.toUpperCase()||String(result.filter(r=>r.number===1).length+1);}
  if(c.number!==expected)continue;
  result.push({...c,variant});expected++;
 }
 return result;
}
export function sourcePoints(text:string):number {
 const m=text.match(/(?:[–—-]\s*|\(\s*)(\d+(?:[.,]\d+)?)\s*ball/i);
 return m?Number(m[1].replace(',','.')):0;
}
