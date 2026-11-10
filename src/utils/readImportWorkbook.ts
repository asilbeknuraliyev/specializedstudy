// Bound compressed input and declared expansion before SheetJS reads workbook XML.
export async function readImportWorkbook(file:File,rows:number) {
 if(file.size>1_000_000)throw Error('Excel/CSV fayli 1 MB dan oshmasin.');
 const bytes=await file.arrayBuffer();
 if(/\.xlsx$/i.test(file.name)){
  const {default:JSZip}=await import('jszip');const zip=await JSZip.loadAsync(bytes);
  const files=Object.values(zip.files);
  const expanded=files.reduce((n,f)=>n+Number((f as any)._data?.uncompressedSize||0),0);
  if(files.length>300||expanded>12_000_000)throw Error('Excel ichidagi ma’lumot juda katta. Faylni kichik qismlarga ajrating.');
 }
 const X=await import('xlsx');
 return{X,wb:X.read(bytes,{type:'array',sheetRows:rows,cellFormula:false,cellHTML:false})};
}
