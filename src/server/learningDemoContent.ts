import {bankQuestion,type BankQuestion} from './topicEngine';
export const learningDemoTopics=[
 {subject:'Matematika',title:'Kasrlar va ulushlar',reading:'Bir xil maxrajli kasrlar qo‘shilganda suratlar qo‘shiladi, maxraj saqlanadi. Masalan, 1/8 + 2/8 = 3/8. Kasrni son sifatida qarang; katta maxraj kattaroq ulush degani emas.'},
 {subject:'Matematika',title:'Chiziqli tenglamalar',reading:'Tenglamaning ikki tomoniga bir xil amal qo‘llang. ax + b = c bo‘lsa, avval b ni ayiring, keyin a ga bo‘ling. Yechimni o‘rniga qo‘yib tekshiring.'},
 {subject:'Fizika',title:'Tekis harakat va tezlik',reading:'Tekis harakatda v = s/t. Yo‘l metrda, vaqt sekundda berilsa, tezlik m/s bo‘ladi. Formula tanlashdan oldin birliklarni tekshiring.'},
 {subject:'Fizika',title:'Massa, hajm va zichlik',reading:'Zichlik massa va hajm nisbatidir: rho = m/V. Massa grammda, hajm cm³ bo‘lsa, zichlik g/cm³. Hajm o‘zgarmaganda massa ortsa, zichlik ham ortadi.'},
 {subject:'Ingliz tili',title:'Present Simple',reading:'He/she/it bilan tasdiq gapda fe’lga odatda -s yoki -es qo‘shiladi. I/you/we/they bilan asosiy shakl ishlatiladi. Does qatnashgan savolda asosiy fe’lga -s qo‘shilmaydi.'},
 {subject:'Ingliz tili',title:'Past Simple',reading:'Past Simple tugagan o‘tgan voqeani bildiradi. Regular fe’l -ed oladi; go → went kabi irregular shakllar bor. Did/did not dan keyin fe’lning asosiy shakli keladi.'},
];
const source={title:'Specialized Study DEMO — mualliflik o‘quv mashqlari, 2026',page:''};
const base=(q:any)=>bankQuestion.parse({points:1,difficulty:'medium',source,...q});
export function learningDemoQuestions(topic:number){
 const rows:any[]=[];
 if(topic<4){
  for(let n=1;n<=9;n++){
   let prompt='',key='',explanation='',wrong='',hint='';
   if(topic===0){prompt=`$${n}/16 + 2/16$ yig‘indisini maxraji 16 bo‘lgan kasr ko‘rinishida yozing.`;key=`${n+2}/16`;wrong=`${n+2}/32`;explanation=`Maxrajlar bir xil: faqat suratlar qo‘shiladi. ${n} + 2 = ${n+2}; maxraj 16 bo‘lib qoladi. Natija ${key}.`;hint='Ulushlarning o‘lchami bir xil. Surat va maxrajning vazifasini eslang.';}
   if(topic===1){prompt=`$3x + 2 = ${3*n+2}$ tenglamani yeching.`;key=String(n);wrong=String(n+1);explanation=`Ikki tomondan 2 ayiramiz: 3x = ${3*n}. Keyin 3 ga bo‘lamiz: x = ${n}. O‘rniga qo‘yilganda tenglik bajariladi.`;hint='Avval qo‘shilgan sonni ikki tomondan ayiring, so‘ng koeffitsiyentga bo‘ling.';}
   if(topic===2){prompt=`Jism ${n*12} metrni 4 sekundda bosib o‘tdi. Tezlikni m/s da yozing.`;key=String(n*3);wrong=String(n*48);explanation=`Tezlik yo‘lning vaqtga nisbatidir: v = ${n*12}/4 = ${n*3} m/s. Yo‘lni vaqtga ko‘paytirish boshqa kattalik beradi.`;hint='Bir sekundda qancha yo‘l bosilganini toping.';}
   if(topic===3){prompt=`Massasi ${n*10} g va hajmi 5 cm³ bo‘lgan jism zichligini g/cm³ da yozing.`;key=String(n*2);wrong=String(n*50);explanation=`Zichlik rho = m/V. ${n*10}/5 = ${n*2} g/cm³. Massani hajmga bo‘lish kerak.`;hint='Bir kub santimetrga to‘g‘ri keladigan massani hisoblang.';}
   const kind=n%3===0?'short':n%3===1?'single':'blank';
   rows.push(base({kind,prompt,key,options:kind==='single'?[wrong,key,topic===0?`${n}/18`:String(Number(key)+2)]:[],explanation,hints:[hint,'Kerakli amalni yozing, keyin qiymatlarni joylashtiring.','Hisobdan so‘ng natijani birlik yoki tenglamaga qo‘yish orqali tekshiring.'],wrongFeedback:kind==='single'?{[wrong]:'Bu tanlovda ikkita kattalikning vazifasi aralashgan. Izohdagi amalni tekshiring.'}:{}}));
  }
  const unit=topic===0?['1/2','1/4']:topic===1?['x+1=3','x+2=6']:topic===2?['Yo‘l','Vaqt']:['Massa','Hajm'];
  const matches=topic===0?['0,5','0,25']:topic===1?['2','4']:topic===2?['metr','sekund']:['gramm','cm³'];
  rows.push(base({kind:'matching',prompt:'Har bir atamani mos qiymat yoki birlik bilan juftlang.',labels:unit,options:matches,key:matches.join('|'),explanation:unit.map((v,i)=>`${v} → ${matches[i]}`).join('; ')}));
  rows.push(base({kind:'ordering',prompt:'Yechishning umumiy ketma-ketligini tartiblang.',options:['Hisoblash','Berilganlarni aniqlash','Natijani tekshirish','Kerakli amalni tanlash'],key:'Berilganlarni aniqlash|Kerakli amalni tanlash|Hisoblash|Natijani tekshirish',explanation:'Avval ma’lumot va savol aniqlanadi, keyin amal tanlanib hisoblanadi. Oxirida natija tekshiriladi.'}));
  rows.push(base({kind:'written',prompt:'Shu mavzudagi bitta masalani yechish usulini o‘z so‘zingiz bilan tushuntiring. Nega aynan shu amal tanlanadi?',key:'',points:2,explanation:'Asosiy tushuncha, tanlangan amal sababi va tekshirish usulini yozing. Ustoz mazmun va asoslash bo‘yicha izoh beradi.'}));
 }else{
  const present=[['She ___ to school every day.','goes','go','He/she/it bilan go → goes.'],['They ___ football on Sundays.','play','plays','They bilan asosiy play shakli.'],['He ___ English every evening.','studies','study','Undosh + y: study → studies.'],['I ___ breakfast at seven.','have','has','I bilan have ishlatiladi.'],['Does she ___ here?','work','works','Does dan keyin asosiy work shakli.'],['We ___ in a small town.','live','lives','We bilan live shakli.'],['The sun ___ in the east.','rises','rise','Birlikdagi ega bilan rises.'],['My brother ___ TV after school.','watches','watch','He bilan -ch tugashi -es oladi.'],['You ___ the answer.','know','knows','You bilan know.']];
  const past=[['Yesterday she ___ to school.','went','goes','Go ning Past Simple shakli went.'],['They ___ football last Sunday.','played','play','Tugagan o‘tgan voqea: played.'],['He ___ his homework yesterday.','did','does','Do ning o‘tgan shakli did.'],['I ___ a book last night.','read','reads','Read yozilishi bir xil, talaffuzi o‘tgan zamonda /red/.'],['Did she ___ here last year?','work','worked','Did dan keyin asosiy work shakli.'],['We ___ at home yesterday.','were','was','We bilan were ishlatiladi.'],['She ___ a new pen yesterday.','bought','buys','Buy ning o‘tgan shakli bought.'],['They did not ___ the bus.','miss','missed','Did not dan keyin asosiy miss shakli.'],['He ___ happy after the game.','was','were','He bilan was ishlatiladi.']];
  for(const [prompt,key,wrong,explanation]of topic===4?present:past)rows.push(base({kind:'single',prompt,options:[wrong,key],key,explanation,hints:['Ega va vaqt ko‘rsatkichini toping.','Yordamchi fe’l borligini tekshiring.','Shu zamonning qoidasini qo‘llang.'],wrongFeedback:{[wrong]:'Ega, zamon yoki yordamchi fe’l bilan asosiy fe’l mosligini qayta tekshiring.'}}));
  rows.push(base({kind:'matching',prompt:'Ega va mos shaklni juftlang.',labels:['She','They'],options:topic===4?['works','work']:['was','were'],key:topic===4?'works|work':'was|were',explanation:topic===4?'She works; they work.':'She was; they were.'}));
  rows.push(base({kind:'multiple',prompt:topic===4?'Present Simple uchun mos ikkita vaqt ifodasini tanlang.':'Tugagan o‘tgan voqea uchun mos ikkita vaqt ifodasini tanlang.',options:['every day','usually','yesterday','last week'],key:topic===4?'every day|usually':'yesterday|last week',explanation:topic===4?'Every day va usually odatni bildiradi.':'Yesterday va last week tugagan o‘tgan vaqtni bildiradi.'}));
  rows.push(base({kind:'written',prompt:topic===4?'Kundalik odatingiz haqida ikkita Present Simple gap yozing.':'Kecha qilgan ishingiz haqida ikkita Past Simple gap yozing.',key:'',points:2,explanation:'Ega, fe’l shakli va vaqt ma’nosi mosligini asoslang. Ustoz gaplarni tekshiradi.'}));
 }
 return rows;
}
