import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findExamHeaderBands,isExamHeaderLine,isInExamHeader,examContentRanges,cleanExamSourceText} from './examSourceLayout';
import type {SourceLine} from './examExtraction';
const row=(text:string,y:number,page=1):SourceLine=>({text,y,page,x:50,width:700,height:18});
test('variant identity block never becomes question content on the following page',()=>{
 const lines=[row('10. Quote and question',700,2),row('D) Correctly delimited option',900,2),row('8-SINF. O‘ZBEKISTON TARIXI',70,3),row('CHSB-1.',100,3),row('II variant  Sana: ______________',160,3),row('Sinf ______ O‘quvchining F.I.SH.________________',190,3),row('1. Next variant first question (Bilish – 2,5 ball)',240,3)];
 const bands=findExamHeaderBands(lines,[1200,1200,1200]);assert.deepEqual(bands,[{page:3,top:0,bottom:215}]);
 assert.equal(isInExamHeader(lines[5],bands),true);assert.equal(isInExamHeader(lines[6],bands),false);
 const q10=lines.slice(0,6).filter(l=>!isInExamHeader(l,bands)).map(l=>l.text).join('\n');assert.ok(q10.includes('D)'));assert.ok(!q10.includes('F.I.SH'));assert.ok(!q10.includes('II variant'));
 assert.ok(examContentRanges(3,0,234,bands).every(r=>r.top>=215));
});
test('reading passage before first task is retained while paper identity blanks are excluded',()=>{
 const lines=[row('6-sinf Tabiiy fan',80),row('Sinf ______ Sana: __________',130),row('O‘quvchining F.I.SH.________________',160),row('Kitobxonlik va bilim',230),row('Umumiy o‘qish matni davom etadi.',260),row('1-topshiriq. Matn asosida javob bering.',650),row('Javob: ____________________',700)];
 const bands=findExamHeaderBands(lines,[1200]);assert.equal(isInExamHeader(lines[2],bands),true);for(const i of [3,4,5,6])assert.equal(isInExamHeader(lines[i],bands),false);
 assert.ok(examContentRanges(1,0,644,bands).some(r=>r.top<230&&r.bottom>260));
});
test('blank diagram continuation pages stay available and ordinary task blanks are preserved',()=>{
 assert.deepEqual(examContentRanges(2,0,1200,[]),[{top:0,bottom:1200}]);
 for(const text of ['Javob: ____________','1)___________________ (1 ball)','Ushbu olimning ismini yozing: ________','Имя: __________________','5. Sana nimani ifodalaydi?','2. Sinf o‘quvchilari misolini yeching.'])assert.equal(isExamHeaderLine(text),false,text);
 assert.equal(cleanExamSourceText('1000007299594 e 1.Chiziqlarni to‘ldiring.'),'1.Chiziqlarni to\'ldiring.');
});
test('same-page variant masthead is subtracted without deleting earlier question content',()=>{
 const lines=[row('9. Earlier question',40),row('D) Last option',180),row('8-SINF. TARIX',500),row('II variant Sana: __________',550),row('Sinf ______ O‘quvchining F.I.SH.______',580),row('1. New question',640)];
 const bands=findExamHeaderBands(lines,[1200]);assert.ok(!isInExamHeader(lines[0],bands));assert.deepEqual(examContentRanges(1,35,634,bands),[{top:35,bottom:495},{top:605,bottom:634}]);
});

test('explicit identity labels in paper headers are recognized',()=>{
 for(const text of ['Ism va familiya: ______________','Familiyasi ismi: __________','Full name: __________','Student name: __________','Class: __________','Date: __________'])assert.ok(isExamHeaderLine(text),text);
});
