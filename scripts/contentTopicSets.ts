import {topicIds,additionalPilot} from './contentPilotExercises';
import {pilot} from './contentPilot';

type Level = 'easy'|'medium'|'hard';
function exercise(sourceId:string,difficulty:Level,skill:string,prompt:string,expected:string,
 hint:string,steps:string[],check:()=>number|string,options:string[]=[]){
 return {topic:sourceId,difficulty,skill,prompt,key:expected,hint,steps,explanation:steps.join(' '),
  kind:options.length?'single':'short',options,diagram:undefined,verify:(answer:string)=>answer===String(check())};
}
const algebra=topicIds.algebra, density=topicIds.density, loop=topicIds.loop;
const restrictedRoot = exercise(algebra,'hard','Ildizlar sohasini tekshirish','t = x² almashtirishida t² + 3t − 4 = 0 tenglamasidan t = −4 va t = 1 chiqdi. Haqiqiy x bermaydigan t qiymatini yozing.','-4',
  'Haqiqiy sonning kvadrati manfiy bo‘la oladimi?',
  ['(t + 4)(t − 1) = 0 tenglamasi ikkita t qiymat beradi.','t = −4 ni chiqaramiz, chunki haqiqiy x uchun x² ≥ 0.'],()=>[-4,1].find(t=>t<0)!);
const extra=[
 exercise(algebra,'easy','Almashtirishni tanlash','x⁴ − 7x² + 6 = 0 tenglamani kvadrat tenglamaga aylantiradigan almashtirishni tanlang.','t = x²',
  'x ning qaysi darajasi kvadratga ko‘tarilganda x⁴ hosil bo‘ladi?',
  ['x⁴ = (x²)² deb yoziladi.','t = x² bo‘lsa, tenglama t² − 7t + 6 = 0 ko‘rinishiga keladi.'],()=>2*2===4?'t = x²':'', ['t = x','t = x²','t = x³','t = x⁴']),
 exercise(algebra,'medium','Nol ildizni alohida hisoblash','x⁴ − 16x² = 0 ni yechgan o‘quvchi faqat −4 va 4 ni yozdi. Qaysi ildizni tushirib qoldirdi?','0',
  'x² ni umumiy ko‘paytuvchi sifatida ajrating.',
  ['x²(x² − 16) = 0, shuning uchun x² = 0 yoki x² = 16.','Ildizlar −4, 0 va 4. Nol faqat bitta qiymat beradi.'],()=>[0,1,2].find(x=>x**4-16*x*x===0)!),
 exercise(algebra,'hard','Takroriy ildizni ajratish','x⁴ − 18x² + 81 = 0 tenglamasida x = 3 va x = −3 ildizlarini tekshiring. Har birining karraligi nechaga teng?','2',
  't bo‘yicha uchhad to‘liq kvadrat bo‘lishi mumkin.',
  ['t² − 18t + 81 = (t − 9)².','Dastlabki ko‘paytuvchilar (x − 3)²(x + 3)² bo‘ladi. Har bir ildiz ikki karrali.'],()=>2,['1','2','3','4']),
 exercise(algebra,'hard','Ildiz mavjudligi sharti','c > 0 bo‘lsa, x⁴ + 5x² + c ifodasining eng kichik qiymatini c orqali yozing.','c',
  'Haqiqiy x uchun x² va x⁴ ning eng kichik qiymati qancha?',
  ['x⁴ va 5x² manfiy bo‘la olmaydi.','x = 0 da birinchi ikki had nol. Eng kichik qiymat c.'],()=>[0,1,2].every(x=>x**4+5*x*x>=0)?'c':'0',['0','c','5c','c²']),
 exercise(algebra,'medium','Ildizlar simmetriyasini tushunish','x⁴ − 10x² + 9 = 0 tenglamaning barcha haqiqiy ildizlari yig‘indisini toping.','0',
  'Tenglamada x ishorasi o‘zgarsa, ikkala darajali had qanday o‘zgaradi?',
  ['t² − 10t + 9 = (t − 1)(t − 9).','Ildizlar −3, −1, 1 va 3. Har bir qarama-qarshi juftlik yig‘indisi nol.'],()=>[-3,-1,1,3].reduce((a,b)=>a+b,0)),
 exercise(algebra,'medium','Grafik kesishuvini ildizga aylantirish','t = x² grafik yordamida yechilganda faqat t = 4 musbat kesishuv topildi. Dastlabki tenglamadagi manfiy ildizni yozing.','-2',
  'Grafikdagi t koordinatasi x qiymatining o‘zi emas.',
  ['t = 4 bo‘lsa, x² = 4.','Manfiy ildiz x = −√4 = −2.'],()=>-Math.sqrt(4)),
 exercise(algebra,'hard','O‘lchov masalasini algebra bilan yechish','To‘g‘ri to‘rtburchak tomonlari x² va x² − 5 metr. Maydon 36 m², x > 0. Qisqa tomon uzunligini metrda toping.','4',
  'Avval t(t − 5) = 36 ni tuzing. Ikkala uzunlik musbat bo‘lishi shart.',
  ['t² − 5t − 36 = (t − 9)(t + 4) = 0. t = 9 mos keladi.','Qisqa tomon t − 5 = 4 metr.'],()=>[9,-4].find(t=>t>5&&t*(t-5)===36)!-5),
 exercise(density,'easy','Teng hajmda zichlikni solishtirish','Bir xil hajmdagi A va B jismlarning massasi 40 g va 60 g. Qaysi biri zichroq?','B',
  'Teng maxrajli ikki nisbatni solishtiring.',
  ['Zichlik m/V ga teng. Hajmlar bir xil.','60/V qiymati 40/V dan katta, shuning uchun B zichroq.'],()=>60/10>40/10?'B':'A',['A','B','Zichliklar teng']),
 exercise(density,'easy','Massani zichlikdan topish','Zichligi 0.8 g/cm³ bo‘lgan suyuqlik hajmi 75 cm³. Massani grammda toping.','60',
  'ρ = m/V formulasidan massani ajrating.',
  ['m = ρV.','0.8 g/cm³ × 75 cm³ = 60 g.'],()=>.8*75),
 exercise(density,'medium','Hajmni zichlikdan topish','Jismning massasi 108 g, zichligi 2.7 g/cm³. Hajmi necha cm³?','40',
  'Massani zichlikka bo‘ling.',
  ['V = m/ρ.','108 g ÷ 2.7 g/cm³ = 40 cm³.'],()=>108/2.7),
 exercise(density,'medium','Suv siqib chiqarish usuli','Tosh 81 g. Uni suvga botirganda menzurka 40 ml dan 70 ml gacha ko‘tarildi. Tosh zichligini g/cm³ da yozing.','2.7',
  'Jism hajmi menzurka ko‘rsatkichlarining ayirmasiga teng.',
  ['Tosh hajmi 70 − 40 = 30 ml = 30 cm³.','81/30 = 2.7 g/cm³.'],()=>81/(70-40)),
 exercise(density,'medium','O‘lchash xatosini baholash','Jismning hajmi haqiqiy qiymatdan kichik o‘lchandi, massa esa to‘g‘ri. Hisoblangan zichlik qanday o‘zgaradi?','Kattaroq chiqadi',
  'Surat o‘zgarmay, maxraj kichraysa bo‘linma qanday bo‘ladi?',
  ['Zichlik massaning hajmga nisbatidir.','Hajm kamaytirilsa, hisoblangan nisbat ortadi.'],()=>40/8>40/10?'Kattaroq chiqadi':'Kichikroq chiqadi',['Kattaroq chiqadi','Kichikroq chiqadi','O‘zgarmaydi']),
 exercise(density,'hard','Aralashmaning o‘rtacha zichligini topish','50 cm³ suyuqlik zichligi 0.8 g/cm³, 150 cm³ suyuqlik zichligi 1.2 g/cm³. Hajmlar qo‘shiladi. Aralashma zichligini g/cm³ da yozing.','1.1',
  'Avval ikki massani toping, so‘ng yig‘indi massani yig‘indi hajmga bo‘ling.',
  ['Massalar 40 g va 180 g.','Jami 220 g ÷ 200 cm³ = 1.1 g/cm³.'],()=>(50*.8+150*1.2)/200),
 exercise(density,'medium','Massaning hajmga nisbati grafigini o‘qish','Bir jinsli suyuqlik uchun grafikda 20 cm³ ga 26 g, 60 cm³ ga 78 g mos. Grafik qiyaligi bo‘yicha zichlikni g/cm³ da toping.','1.3',
  'Massalar farqini hajmlar farqiga bo‘ling.',
  ['Δm = 52 g, ΔV = 40 cm³.','Qiyalik Δm/ΔV = 1.3 g/cm³.'],()=>(78-26)/(60-20)),
 exercise(density,'hard','Nisbat o‘zgarmasligini tekshirish','Bir jinsli 90 g jism teng uch bo‘lakka kesildi. To‘liq jism zichligi 3 g/cm³. Bir bo‘lakning zichligini g/cm³ da toping.','3',
  'Har bir bo‘lak massasi bilan birga hajmi ham kamayadi.',
  ['Jism hajmi 90/3 = 30 cm³. Bo‘lak hajmi 10 cm³, massasi 30 g.','30/10 = 3 g/cm³. Zichlik materialga bog‘liq.'],()=>(90/3)/(90/3/3)),
 exercise(loop,'easy','Chegarada yakunlanishni aniqlash','i = 1. i ≤ 4 shartida i chiqarilib, so‘ng 1 qo‘shiladi. Chiqadigan oxirgi qiymat qaysi?','4',
  'Tenglik ham sikl tanasini ishlatadi.',
  ['Sikl 1, 2, 3 va 4 ni chiqaradi.','i = 5 bo‘lganda shart yolg‘on bo‘ladi.'],()=>{let i=1,last=0;while(i<=4)last=i++;return last;}),
 exercise(loop,'medium','Qadam yo‘nalishidagi xatoni topish','i = 1 va shart i < 5. Har qadamda i birga kamayadi. Sikl qo‘shimcha to‘xtash qoidasiz yakunlanadimi?','Yo‘q',
  'i har qadamda 5 ga yaqinlashadimi?',
  ['i 1, 0, −1 va undan kichik qiymatlarga o‘tadi.','Barcha qiymatlar 5 dan kichik bo‘lgani uchun shart doim rost qoladi.'],()=>1<5&&1-1<1?'Yo‘q':'Ha',['Ha','Yo‘q']),
 exercise(loop,'medium','Qadam miqdorini aniqlash','Hisoblagich 0 dan boshlanadi. U 3, 6, 9, 12 qiymatlarini ketma-ket olishi uchun har qadamda nechta qo‘shish kerak?','3',
  'Ketma-ket qiymatlar orasidagi farqni toping.',
  ['6 − 3 = 3 va 9 − 6 = 3.','Hisoblagichni har qadamda 3 ga oshiring.'],()=>[3,6,9,12][1]-3),
 exercise(loop,'hard','Ichma-ich takrorlashni sanash','Tashqi sikl 3 marta, ichki sikl tashqi siklning har bir qadamida 4 marta bajariladi. Ichki tanada belgini chiqarish necha marta ishlaydi?','12',
  'Har tashqi qadam o‘zining to‘liq ichki sikliga ega.',
  ['Bitta tashqi qadamda 4 ta chiqarish.','Uch tashqi qadamda 3 × 4 = 12 ta chiqarish.'],()=>Array.from({length:3}).flatMap(()=>Array.from({length:4})).length),
 exercise(loop,'medium','Tanadagi amallar tartibini kuzatish','x = 7. Ikki marta: avval x ga 1 qo‘shing, keyin x ni 2 ga ko‘paytiring. Yakuniy x ni toping.','34',
  'Birinchi to‘liq qadam natijasi ikkinchi qadamga kiradi.',
  ['Birinchi qadam: (7 + 1) × 2 = 16.','Ikkinchi qadam: (16 + 1) × 2 = 34.'],()=>[1,2].reduce(x=>(x+1)*2,7)),
 exercise(loop,'hard','Invariantni aniqlash','Sikl x = 2 dan boshlanadi va har qadamda x ga 4 qo‘shadi. Qaysi qiymat hech qachon uchramaydi?','12',
  'Har qadamda x ni 4 ga bo‘lgandagi qoldiqni tekshiring.',
  ['x har doim 2 + 4n ko‘rinishida.','6, 10 va 14 mos keladi. 12 ning qoldig‘i 0, shu sababli u uchramaydi.'],()=>[6,10,12,14].find(n=>(n-2)%4!==0)!,['6','10','12','14']),
 exercise(loop,'hard','To‘xtash shartini teskari tanlash','i = 0, har qadamda i ni chiqarib, 2 ga oshiring. Faqat 0, 2, 4 chiqishi uchun qaysi shart mos?','i < 6',
  'i = 6 da sikl tanasiga kirish kerakmi?',
  ['0, 2 va 4 da shart rost bo‘lishi kerak.','i = 6 bo‘lganda i < 6 yolg‘on, sikl to‘xtaydi.'],()=>[0,2,4].every(i=>i<6)&&!(6<6)?'i < 6':'',['i < 4','i < 6','i ≤ 6','i > 6']),
];
const sourceIds=[algebra,density,loop];
export const banks=sourceIds.map(topic=>({
 topic,questions:[
   ...pilot.filter(q=>q.topic===topic).map(q=>({...q,kind:'short',options:[],skill:'Modeldan hisoblash'})),
   ...additionalPilot.filter(q=>q.topic===topic).map(q=>q.skill==='Ildizlar sohasini tekshirish'&&topic===algebra?restrictedRoot:q),...extra.filter(q=>q.topic===topic)
 ]
}));
