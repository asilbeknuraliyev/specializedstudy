import React from 'react';import {Link} from 'react-router-dom';import {useLearnOS} from '../context/LearnOSContext';import {Card} from './DesignSystem';
export function HelpPage(){const {currentUser}=useLearnOS(),role=currentUser?.role,staff=role==='teacher',admin=['admin','platform_owner'].includes(role||'');const guides=admin?[
 ['Hisob va biriktirish','Hisoblar bo‘limida bitta yoki Excel orqali ko‘p hisob yarating. Kirish kartochkalarini kerakli odamga bering. Profil va biriktirish oynasida sinf va ustoz fanini boshqaring.'],
 ['Kontent va jadval','Kontent markazida shablonni yuklang. Avval sinov ko‘rinishidagi xatolarni qator raqami bo‘yicha tekshiring; to‘g‘ri qatorlarni alohida kiritish mumkin. Nashrdan oldin sinf va fanni tasdiqlang.'],
 ['BSB / CHSB','PDF yoki DOCX importidagi savol, rasm, ball, mezon va javob kalitini tekshiring. Import avtomatik nashr qilinmaydi. Ko‘rib chiqilgach rejalashtiring yoki boshlang.'],
 ['Adolatli intizom','Maktab siyosati, sanalar va mas’ullarni vakolatli tartibda tasdiqlang. Ball faqat tasdiqlangan hodisadan hisoblanadi. Chegara avtomatik jazo emas. E’tiroz va hujjatlar inson qarori bilan ko‘riladi.'],
 ['Audit va zaxira','Boshqaruv markazida o‘zgarishlar tarixini ko‘ring. JSON eksporti boshqaruv ma’lumotidir; to‘liq server snapshoti alohida saqlanadi. Tiklashdan oldin joriy zaxira tekshiriladi.'],
 ['Pilot va ma’lumot so‘rovlari','Ixtiyoriy roziliksiz pilot faollashmaydi. Kamida 5 juft kuzatuv bo‘lganda guruh natijalari ochiladi. O‘chirish sinov ko‘rinishi va aniq tasdiqdan keyin bajariladi.']
 ]:staff?[
 ['Bugungi dars','Bugungi ishlar oynasi jadvaldagi hozirgi va keyingi darsni ko‘rsatadi. Sinf tanlang; Fanlarim, Ish rejalari va Mavzular orqali material yoki savollar bankiga o‘ting.'],
 ['Davomat','Bitta sinf, sana va dars raqamini tanlang. «Hammasi qatnashdi» tugmasidan keyin istisnolarni tekshiring va saqlang. Kechikish intizom ballini avtomatik qo‘shmaydi.'],
 ['Vazifa va tekshiruv','Vazifani bir nechta sinfga biriktirish yoki nusxasidan qoralama yaratish mumkin. Tekshirishda maksimal ball doirasida baho va aniq keyingi qadam yozing. Hisobot o‘z sinflaringizni qamrab oladi.'],
 ['Mavzu testi va nazorat','Savollar bankida izoh va javoblarni tekshirib, testni nashr qiling. BSB/CHSB markazida o‘zingiz yaratgan, o‘z faningiz va sinflaringizdagi nazoratni boshqaring.'],
 ['Qayd va yordam','Holatni xolis izoh bilan qayd eting. Yordam talab qiladigan vaziyatda pedagogik yordam rejasini tanlang. Xato bosilgan yangi qaydni 5 soniya ichida bekor qilishni boshlash mumkin.'],
 ['Parallel o‘zgarish va xabar','409 chiqsa, yozganlaringizni server holati bilan solishtiring. Boshqa odamning ishini bilmasdan almashtirmang. Xabarlar qo‘ng‘iroqcha markazida; chiqish profil menyusida.']
 ]:[
 ['Hisobga kirish','Login va birinchi parolni administrator beradi. Birinchi kirishda yangi parol qo‘ying. Google orqali ham kirish mumkin. Parolni unutgan bo‘lsangiz, administratorga murojaat qiling.'],
 ['Bugungi rejam','Besh bo‘lim: Bosh sahifa, Fanlar, Jadval, Vazifalar va Men. Navbatdagi o‘quv ishingizni bosh sahifada tanlang. Shaxsiy intizom ma’lumotlari Men bo‘limida.'],
 ['Mavzu testi va BSB/CHSB','Mavzu mashqidan keyin yechim va izohni o‘qing. BSB/CHSB javob kalitlari ochilmaydi. Nazoratda uchinchi tab chiqishida server ishni to‘xtatadi. To‘liq ekran qurilmaga qarab farq qilishi mumkin.'],
 ['Yozma vazifa','Javobni qoralama sifatida saqlash mumkin. Topshirish belgisini yoqsangiz ustozga yuboriladi. Keyin ustoz fikrini vazifa yonida ko‘rasiz. Saqlash xatosida sahifadan chiqmay qayta urinib ko‘ring.'],
 ['Xatolar va qisqa mashq','Xatolar daftari va takrorlash tushunmagan joyingizga qaytishga yordam beradi. Flashcards va o‘quv o‘yinlari rasmiy baho emas. Qisqa mashqdan keyin tanaffus qiling.'],
 ['Shaxsiy qayd va rozilik','Men bo‘limida davomat, yordam va o‘z qaydlaringizni ko‘ring. Rozi bo‘lmasangiz asosli e’tiroz yuboring. Ichki pilot ixtiyoriy; rozilikni bekor qilish baho yoki darsga kirishga ta’sir qilmaydi.']
 ];const home=currentUser?admin?'/admin/operations':staff?'/teacher/dashboard':'/student/dashboard':'/login';return <main className="mx-auto max-w-3xl space-y-5 p-4"><h1 className="text-3xl font-bold">{admin?'Administrator uchun yordam':staff?'Ustoz uchun yordam':'Yordam'}</h1>{guides.map(([title,body],i)=><Card key={title}><h2 className="font-semibold">{i+1}. {title}</h2><p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{body}</p></Card>)}<Link to={home} className="ss-secondary">{currentUser?'Ish oynasiga qaytish':'Kirish sahifasi'}</Link></main>;}
