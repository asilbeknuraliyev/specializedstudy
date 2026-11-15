import * as X from 'xlsx';import JSZip from 'jszip';
const worker=self as any;
const safePath=(value:string)=>!value.startsWith('/')&&!/^[a-z]:/i.test(value)&&!value.split(/[\\/]/).includes('..')&&!value.includes('\0');
const digest=async(bytes:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))).map(v=>v.toString(16).padStart(2,'0')).join('');
async function workbook(bytes:Uint8Array,name:string){
 if(bytes.length>3*1024*1024||bytes[0]!==0x50||bytes[1]!==0x4b)throw Error('Faqat 3 MB gacha bo‘lgan haqiqiy XLSX faylni tanlang.');
 const zip=await JSZip.loadAsync(bytes);const entries=Object.values(zip.files);let size=0;
 for(const e of entries){if(!safePath(e.name)||!safePath((e as any).unsafeOriginalName||e.name))throw Error('Excel ichidagi yo‘l xavfsiz emas.');size+=Number((e as any)._data?.uncompressedSize||0);if(/vbaProject\.bin|^xl\/(?:embeddings|externalLinks)\//i.test(e.name))throw Error('Makros, biriktirilgan obyekt yoki tashqi havolali Excel qabul qilinmaydi.');}
 if(entries.length>500||size>25*1024*1024)throw Error('Excel ichidagi kengaytirilgan hajm chegaradan oshgan.');
 const wb=X.read(bytes,{type:'array',sheetRows:3001,cellFormula:false,cellHTML:false,bookVBA:false});if(wb.SheetNames.length>20)throw Error('Bitta faylda 20 varaqdan oshmasin.');
 const sheets=wb.SheetNames.map(sheetName=>{const s=wb.Sheets[sheetName];if(!s['!ref'])return{name:sheetName,startRow:1,rows:[]};const full=X.utils.decode_range(s['!fullref']||s['!ref']);if(full.e.r-full.s.r>=3000||full.e.c-full.s.c>=40)throw Error('Varaq 3000 qator yoki 40 ustundan oshgan.');return{name:sheetName,startRow:X.utils.decode_range(s['!ref']).s.r+1,rows:X.utils.sheet_to_json<any[]>(s,{header:1,defval:'',raw:false,blankrows:true}).map(r=>r.map(v=>String(v??'')))};});
 return{name,sourceHash:await digest(bytes),sheets};
}
worker.onmessage=async(event:MessageEvent<{kind:string;files:File[]}>)=>{
 try{const {kind,files}=event.data;const result:any[]=[],ignored:string[]=[];let total=files.length,done=0;
 for(const file of files){
  if(/\.zip$/i.test(file.name)){
   if(kind!=='workplans'||file.size>25*1024*1024)throw Error('ZIP faqat ish rejalari uchun; 25 MB dan oshmasin.');const bytes=await file.arrayBuffer();
   const zip=await JSZip.loadAsync(bytes,{decodeFileName:(data)=>{const encoded=Uint8Array.from(data as any);try{return new TextDecoder('utf-8',{fatal:true}).decode(encoded);}catch{return new TextDecoder('ibm866').decode(encoded);}}});
   const entries=Object.values(zip.files);if(entries.length>1000)throw Error('ZIP ichida 1000 obyekt chegarasi oshgan.');let expanded=0;const workbooks=entries.filter(e=>!e.dir&&/\.xlsx$/i.test(e.name));total+=workbooks.length-1;
   for(const e of entries){if(!safePath(e.name)||!safePath((e as any).unsafeOriginalName||e.name))throw Error('Arxivda xavfsiz bo‘lmagan yo‘l topildi.');expanded+=Number((e as any)._data?.uncompressedSize||0);if(!e.dir&&!/\.xlsx$/i.test(e.name))ignored.push(e.name);}
   if(expanded>60*1024*1024||workbooks.length>150)throw Error('ZIP ochilgan hajmi 60 MB yoki 150 Excel chegarasidan oshgan.');
   for(const entry of workbooks){result.push(await workbook(await entry.async('uint8array'),entry.name));done++;worker.postMessage({type:'progress',done,total,file:entry.name});}
  }else{if(!/\.xlsx$/i.test(file.name))throw Error('Faqat XLSX yoki ish rejalari ZIP fayli qabul qilinadi.');result.push(await workbook(new Uint8Array(await file.arrayBuffer()),file.name));done++;worker.postMessage({type:'progress',done,total,file:file.name});}
 }
 if(!result.length)throw Error('Arxivda XLSX topilmadi.');worker.postMessage({type:'done',files:result,ignored});
 }catch(error){worker.postMessage({type:'error',message:error instanceof Error?error.message:'Fayl o‘qilmadi.'});}
};
