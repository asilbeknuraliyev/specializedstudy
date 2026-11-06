import {findExamHeaderBands,isInExamHeader,examContentRanges,cleanExamSourceText} from './examSourceLayout';
import type { ExamSourceQuestion, ExamField } from '../examTypes';
import {findQuestionBoundaries,sourcePoints,type SourceLine} from './examExtraction';
export interface ExamImportPreview {questions:ExamSourceQuestion[];contextImages:string[];fileName:string;sourceHash:string;warnings:string[];}
const MAX_FILE=12*1024*1024;
function image(canvas:HTMLCanvasElement){return canvas.toDataURL('image/jpeg',.78);}
function crop(canvas:HTMLCanvasElement,top:number,bottom:number){const c=document.createElement('canvas');c.width=canvas.width;c.height=Math.max(1,Math.ceil(bottom-top));c.getContext('2d')!.drawImage(canvas,0,top,canvas.width,c.height,0,0,c.width,c.height);return image(c);}
export async function importExamDocument(file:File,progress:(message:string)=>void):Promise<ExamImportPreview>{
 if(!file.size||file.size>MAX_FILE)throw Error('12 MB gacha PDF yoki DOCX faylni tanlang.');
 const bytes=await file.arrayBuffer();const header=new Uint8Array(bytes);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const lines:SourceLine[]=[];const pages:HTMLCanvasElement[]=[];const pageImages:string[]=[];
 let wordText='';
 if(file.name.toLowerCase().endsWith('.pdf')&&String.fromCharCode(...header.slice(0,5))==='%PDF-'){
  const pdfjs=await import('pdfjs-dist');const worker=await import('pdfjs-dist/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
  const task=pdfjs.getDocument({data:bytes,useSystemFonts:true});const doc=await task.promise;
  try{if(doc.numPages>20)throw Error('Bir importda ko‘pi bilan 20 sahifa.');
  for(let n=1;n<=doc.numPages;n++){
   progress(`${n}/${doc.numPages}-sahifa o‘qilmoqda…`);const page=await doc.getPage(n),viewport=page.getViewport({scale:1.45});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   await page.render({canvas,viewport}).promise;pages.push(canvas);
   const content=await page.getTextContent();const grouped=new Map<number,{text:string;x:number;y:number;width:number;height:number}[]>();
   for(const item of content.items){if(!('str' in item)||!item.str.trim()||/eMaktab|^\d{7,}(?:\s*e)?$|^e$/.test(item.str.trim()))continue;const [x,y]=viewport.convertToViewportPoint(item.transform[4],item.transform[5]);const height=Math.max(10,Math.abs(item.height)*1.45);const key=Math.round(y/3)*3;const row=grouped.get(key)||[];row.push({text:item.str,x,y:y-height,width:item.width*1.45,height});grouped.set(key,row);}
   for(const [,items]of [...grouped].sort((a,b)=>a[0]-b[0])){items.sort((a,b)=>a.x-b.x);lines.push({text:items.map(i=>i.text).join(' '),page:n,x:items[0].x,y:Math.min(...items.map(i=>i.y)),width:Math.max(...items.map(i=>i.x+i.width))-items[0].x,height:Math.max(...items.map(i=>i.height))});}
  }}finally{await task.destroy();}
 }else if(/\.docx$/i.test(file.name)&&header[0]===0x50&&header[1]===0x4b){
  const {default:JSZip}=await import('jszip');const zip=await JSZip.loadAsync(bytes);let expanded=0;
  for(const entry of Object.values(zip.files)){expanded+=(entry as any)._data?.uncompressedSize||0;if(expanded>30*1024*1024)throw Error('Word fayli ochilganda juda katta.');if(entry.name.endsWith('.rels')&&/TargetMode="External"[^>]*Type="[^"]*image|Type="[^"]*image"[^>]*TargetMode="External"/.test(await entry.async('text')))throw Error('Tashqi rasmlar ulangan Word faylini PDF sifatida yuklang.');}
  const xml=new DOMParser().parseFromString(await zip.file('word/document.xml')!.async('text'),'application/xml');wordText=Array.from(xml.getElementsByTagNameNS('*','p')).map(p=>Array.from(p.getElementsByTagNameNS('*','t')).map(t=>t.textContent).join('')).join('\n');
  const {renderAsync}=await import('docx-preview');const {toJpeg}=await import('html-to-image');const container=document.createElement('div');container.style.cssText='position:fixed;left:-12000px;top:0;width:900px;background:white;color:black;';document.body.append(container);
  try{progress('Word sahifalari tayyorlanmoqda…');await renderAsync(bytes,container,undefined,{inWrapper:true,renderHeaders:false,renderFooters:false,ignoreLastRenderedPageBreak:false});await document.fonts.ready;const sections=Array.from(container.querySelectorAll('section.docx')) as HTMLElement[];if(sections.length>20)throw Error('Bir importda ko‘pi bilan 20 sahifa.');for(const section of sections){
 const url=await toJpeg(section,{quality:.8,pixelRatio:1.3,backgroundColor:'#ffffff'});pageImages.push(url);
 const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url;});
 const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;canvas.getContext('2d')!.drawImage(img,0,0);pages.push(canvas);
 const rect=section.getBoundingClientRect(),scale=canvas.width/rect.width;
 for(const paragraph of Array.from(section.querySelectorAll('p'))){const text=paragraph.textContent?.trim();if(!text)continue;const r=paragraph.getBoundingClientRect();lines.push({text,page:pages.length,x:(r.left-rect.left)*scale,y:(r.top-rect.top)*scale,width:r.width*scale,height:r.height*scale});}
 }}
  finally{container.remove();}
 }else throw Error('Fayl tarkibi PDF yoki DOCX formatiga mos emas.');
 const headerBands=findExamHeaderBands(lines,pages.map(p=>p.height));
 const contentLines=lines.filter(l=>!isInExamHeader(l,headerBands));
 const ranges=(page:number,top:number,bottom:number)=>examContentRanges(page,top,bottom,headerBands);
 const hasInk=(canvas:HTMLCanvasElement,top:number,bottom:number)=>{const y=Math.max(0,Math.floor(top)),height=Math.min(canvas.height-y,Math.ceil(bottom-top));if(height<5)return false;const pixels=canvas.getContext('2d')!.getImageData(0,y,canvas.width,height).data;let count=0;for(let i=0;i<pixels.length;i+=16)if(pixels[i]<170&&pixels[i+1]<170&&pixels[i+2]<170&&++count>12)return true;return false;};
 const warnings:string[]=[];const contextImages:string[]=[];const boundaries=findQuestionBoundaries(lines);const questions:ExamSourceQuestion[]=[];
 if(pages.length && boundaries.length){
  const first=lines[boundaries[0].index];
  if(contentLines.some(l=>l.page<first.page||(l.page===first.page&&l.y<first.y-6))){
   for(let p=1;p<=first.page;p++)for(const r of ranges(p,0,p===first.page?first.y-6:pages[p-1].height))if(hasInk(pages[p-1],r.top,r.bottom))contextImages.push(crop(pages[p-1],r.top,r.bottom));
   if(contextImages.length)warnings.push('Savollardan oldingi umumiy matn alohida saqlandi.');
  }
  for(let i=0;i<boundaries.length;i++){
   const boundary=boundaries[i],start=lines[boundary.index],next=boundaries[i+1]?lines[boundaries[i+1].index]:null;const end=next?.page||pages.length;const images:string[]=[];const fields:ExamField[]=[];const sourcePages:number[]=[];
   for(let p=start.page;p<=end;p++){
    const canvas=pages[p-1],top=p===start.page?Math.max(0,start.y-5):0,bottom=p===next?.page?Math.max(0,next.y-6):canvas.height;
    for(const range of ranges(p,top,bottom)){const top=range.top,bottom=range.bottom;
    if(!hasInk(canvas,top,bottom))continue;const imgIndex=images.length;images.push(crop(canvas,top,bottom));sourcePages.push(p);
    for(const l of contentLines.filter(l=>l.page===p&&l.y>=top&&l.y<bottom))for(const match of l.text.matchAll(/_{3,}/g)){
      fields.push({id:`q${i}-f${fields.length}`,label:`Javob ${fields.length+1}`,imageIndex:imgIndex,x:Math.max(0,Math.min(.95,(l.x+l.width*(match.index!/l.text.length))/canvas.width)),y:Math.max(0,(l.y-top)/(bottom-top)),width:Math.min(.96,(l.width*match[0].length/l.text.length)/canvas.width),height:Math.max(.025,l.height*1.3/(bottom-top))});
    }
    }
   }
   const block=lines.slice(boundary.index,boundaries[i+1]?.index??lines.length).filter(l=>!isInExamHeader(l,headerBands)).map(l=>cleanExamSourceText(l.text)).join('\n');
   const options=[...block.matchAll(/(?:^|\s)([ABCD])[.)]\s+([^]+?)(?=\s[ABCD][.)]\s|$)/g)].slice(0,4).map(m=>m[2].trim());
   questions.push({sourceNumber:boundary.number,variant:boundary.variant,prompt:block,sourcePages,sourceImages:images,fields:options.length>=2?[]:fields.slice(0,40),points:sourcePoints(block),type:options.length>=2?'single_choice':'written_open',options,correctAnswer:'',rubricText:''});
  }
 }else{
  const text=contentLines.map(l=>cleanExamSourceText(l.text)).join('\n')||wordText;if(!text.trim())throw Error('Matn ajratilmadi. Skan PDF uchun OCR hali ulanmagan; matnli PDF yoki DOCX yuklang.');
  warnings.push('Raqamlangan savollar ishonchli ajratilmadi. Hujjat yaxlit topshiriq sifatida saqlandi; tarkibini tekshiring.');
  const sourceImages:string[]=[],sourcePages:number[]=[];for(let p=1;p<=pages.length;p++)for(const r of ranges(p,0,pages[p-1].height))if(hasInk(pages[p-1],r.top,r.bottom)){sourceImages.push(crop(pages[p-1],r.top,r.bottom));sourcePages.push(p);}
  questions.push({sourceNumber:1,variant:'I',prompt:text,sourcePages,sourceImages,fields:[],points:sourcePoints(text),type:'written_open',options:[],correctAnswer:'',rubricText:''});
 }
 if(questions.length>60)throw Error('Bir nazorat ishida ko‘pi bilan 60 savol.');
 if(questions.some(q=>q.points===0))warnings.push('Ayrim savollarning bali manbadan aniqlanmadi. Nashrdan oldin ularning balini va barcha baholash mezonlarini kiriting.');
 return {questions,contextImages,fileName:file.name,sourceHash:hash,warnings};
}
