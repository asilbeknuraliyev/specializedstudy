import type {SourceLine} from './examExtraction';
export interface HeaderBand {page:number;top:number;bottom:number;}
const normalized=(text:string)=>text.replace(/^\s*\d{7,}\s*(?:e(?:Maktab)?\s*)?/,'').replace(/[‘’ʻ`]/g,"'").trim();
/** Paper identity/variant labels, not ordinary prompts such as “ismini yozing”. */
export function isExamHeaderLine(text:string):boolean {
 const t=normalized(text);
 return /^(?:ism(?:i)?(?:\s+va)?[ ,/–-]*familiy(?:a|asi)|familiy(?:a|asi)(?:\s+va)?[ ,/–-]*ism(?:i)?|фамилия(?:[ ,/]*имя)?|full name|student(?:'s)? name|class|date)\s*[:_].*_{2,}/i.test(t)
  || /F\s*\.\s*I\s*\.\s*(?:SH|O)\b|Ф\s*\.\s*И\s*\.\s*О\b/i.test(t)
  || /^(?:sinf\s*[_:]+|\d+\s*[-–]?\s*[_]{2,}\s*sinf|sana\s*[:_]|o'quvchi\s+to'plagan\s+umumiy\s+ball)/i.test(t)
  || /^(?:[IVX]+|\d+)\s*[-.]?\s*variant\b/i.test(t)
  || /^\d+\s*[-–]\s*sinf\b/i.test(t)
  || /^\d+\s+КЛАСС\b/i.test(t)
  || /^(?:(?:[BБ][SС][BБ]|[CС][HН][SС][BБ])\s*[-–№]?\s*\d+|\d+\s*[-–]\s*(?:BSB|CHSB)|СОР\s*№?\s*\d+)\b/i.test(t)
  || /\bsana\s*:\s*_{2,}/i.test(t);
}
export function findExamHeaderBands(lines:SourceLine[],pageHeights:number[]):HeaderBand[]{
 const bands:HeaderBand[]=[];
 for(let page=1;page<=pageHeights.length;page++){
  const rows=lines.filter(l=>l.page===page).sort((a,b)=>a.y-b.y);
  for(const row of rows.filter(l=>isExamHeaderLine(l.text))){
   const last=bands[bands.length-1];const top=Math.max(0,row.y-5),bottom=Math.min(pageHeights[page-1],row.y+row.height+7);
   if(last?.page===page&&top-last.bottom<90)last.bottom=Math.max(last.bottom,bottom);
   else bands.push({page,top,bottom});
  }
  const first=bands.find(b=>b.page===page);
  // A header at the top includes the preceding school/subject masthead.
  if(first&&first.top<pageHeights[page-1]*.35&&!rows.some(l=>l.y<first.top&&/^\s*\d+[.)]\s*\S/.test(normalized(l.text))))first.top=0;
 }
 return bands;
}
export function isInExamHeader(line:SourceLine,bands:HeaderBand[]):boolean {
 return bands.some(b=>b.page===line.page&&line.y<b.bottom&&line.y+line.height>b.top);
}
export function examContentRanges(page:number,top:number,bottom:number,bands:HeaderBand[]):{top:number;bottom:number}[]{
 let ranges=[{top,bottom}];
 for(const band of bands.filter(b=>b.page===page))ranges=ranges.flatMap(r=>band.bottom<=r.top||band.top>=r.bottom?[r]:[{top:r.top,bottom:Math.min(r.bottom,band.top)},{top:Math.max(r.top,band.bottom),bottom:r.bottom}].filter(r=>r.bottom-r.top>4));
 return ranges.filter(r=>r.bottom-r.top>4);
}
export function cleanExamSourceText(text:string):string{return normalized(text);}
