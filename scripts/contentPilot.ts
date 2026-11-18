export const pilot = [
  {
    topic:'0263632767aac076b18b7367c627bc36198eb684e2c472b29ca3fd8a7e620aef',
    prompt:'x⁴ − 5x² + 4 = 0 tenglamaning nechta turli haqiqiy ildizi bor?',
    key:'4', difficulty:'medium', hint:'t = x² almashtirishidan foydalaning.',
    explanation:'t² − 5t + 4 = (t − 1)(t − 4). Har ikkala t musbat. x² = 1 dan −1 va 1, x² = 4 dan −2 va 2 kelib chiqadi.',
    verify:(key:string)=>Number(key)===[-2,-1,1,2].filter(x=>x**4-5*x*x+4===0).length
  },{
    topic:'e2fa9a19a64fbcef847e5ba37ddf54674f135a3d9b3367638d5484bcfed3635d',
    prompt:'Bo‘sh idish 60 g, suyuqlik bilan birga 220 g. Suyuqlik hajmi 200 cm³. Zichlikni g/cm³ da yozing (o‘nli nuqta bilan).',
    key:'0.8',difficulty:'medium',hint:'Avval suyuqlikning o‘z massasini toping.',
    explanation:'Idish massasini ayiramiz. Suyuqlik 220 − 60 = 160 g. Zichlik massa va hajm nisbatiga teng, 160 g / 200 cm³ = 0.8 g/cm³.',
    verify:(key:string)=>Number(key)===(220-60)/200
  },{
    topic:'e385a219967ac8840845761fb0e0866fa7160b2fccf9bc9ae5ff289d89fc3407',
    prompt:'Hisoblagich 3 dan boshlanadi. U 12 dan kichik ekan, unga 4 qo‘shiladi. Sikl tugagach, hisoblagich nechaga teng?',
    key:'15',difficulty:'easy',hint:'Har qo‘shishdan keyin shartni yana tekshiring.',
    explanation:'Hisoblagich 3, 7, 11, 15 qiymatlarini oladi. 11 hali 12 dan kichik, shuning uchun oxirgi qo‘shish ham bajariladi.',
    verify:(key:string)=>{let value=3;while(value<12)value+=4;return Number(key)===value;}
  }
];

