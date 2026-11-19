import {useState} from 'react';
import {Link} from 'react-router-dom';
import {LearningDashboardHeader} from './LearningDashboardHeader';
import {QuadraticExplorer} from './QuadraticExplorer';

export default function BiquadraticLesson(){
  const [answer,setAnswer]=useState('');
  const [checked,setChecked]=useState(false);
  const correct=checked&&answer==='4';
  return <main className="mx-auto max-w-5xl space-y-6 px-2 pb-12">
    <LearningDashboardHeader eyebrow="10-sinf · Algebra" title="Bikvadrat tenglamaning ildizlari"
      subtitle="x⁴ − 5x² + 4 = 0 tenglamasini almashtirish va grafik yordamida yeching."
      links={[{label:'O‘quv paneli',to:'/student/dashboard'},{label:'Darslar',to:'/student/lessons'},{label:'Mavzu mashqlari',to:'/student/topic-tests'}]}/>
    <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
      <section className="ss-surface p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Grafikdan t ildizlarini toping</h2>
        <p className="mt-2 text-sm leading-6">t = x² deb olamiz. Endi (t − 1)(t − 4) = 0. Nuqtani grafik bo‘ylab siljiting va qiymat nolga teng bo‘ladigan joylarni toping.</p>
        <QuadraticExplorer/>
      </section>
      <form className="ss-surface space-y-5 p-5 sm:p-7" onSubmit={event=>{event.preventDefault();setChecked(true);}}>
        <h2 className="text-xl font-semibold">Ildizlarni sanang</h2>
        <p className="text-sm leading-6">Har bir musbat t qiymatini x² = t ga qo‘ying. Dastlabki tenglamaning nechta turli haqiqiy ildizi bor?</p>
        <label className="block text-sm font-medium">Ildizlar soni<input type="number" min={0} max={8} required value={answer} onChange={event=>{setAnswer(event.target.value);setChecked(false);}} className="ss-field mt-2 w-full" /></label>
        <button className="ss-primary" type="submit">Javobni tekshirish</button>
        <details className="border-y border-slate-200 py-3 dark:border-slate-700"><summary className="cursor-pointer font-medium">Maslahat</summary><p className="mt-2 text-sm">x² = 4 bo‘lganda x = 2 va x = −2. x² = 1 uchun ham ikkita yechim bormi?</p></details>
        {checked&&<p role="status" className={correct?'font-semibold text-emerald-700 dark:text-emerald-300':'font-medium text-rose-700 dark:text-rose-300'}>{correct?'To‘g‘ri. Ildizlar −2, −1, 1 va 2.':'Har bir musbat t uchun x ning ikkala ishorasini hisoblang.'}</p>}
      </form>
    </div>
    <section className="ss-surface p-5 sm:p-7">
      <h2 className="text-xl font-semibold">Xulosa</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">
        <li>x⁴ ni (x²)² shaklida ko‘rib, t = x² bilan kvadrat tenglama hosil qiling.</li>
        <li>Topilgan t ildizlaridan manfiylarini chiqarib tashlang.</li>
        <li>Har bir musbat t uchun ±√t ni oling. t = 0 faqat bitta ildiz beradi.</li>
      </ol>
      <p className="mt-5 text-sm text-slate-600 dark:text-slate-300">Manba mavzusi: «Yuqori darajali (bikvadrat, kvadrat tenglamaga keltiriladigan) ratsional tenglamalarni yechish». 10-sinf algebra ish rejasi, Calendar Plan, 52-qator.</p>
    </section>
  </main>;
}

