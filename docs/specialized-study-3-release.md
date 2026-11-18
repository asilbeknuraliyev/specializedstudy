# Specialized Study 3.0 · staging relizi

2026-11-18. [Tekshirilgan preview](https://specializedstudy-74m6xgil2-asilbeknuraliyev43-langs-projects.vercel.app) · [kod a46a7e1](https://github.com/asilbeknuraliyev/specializedstudy/commit/a46a7e11a190cf19541e640fa5c2ecc63fb83f12). Vercel holati READY, /login va /api/health HTTP 200.

## Hisoblar

Production’da o‘qish so‘rovi profilni Supabase Auth jadvaliga bog‘lab sanadi.

| Rol | Profil | Bog‘langan Auth foydalanuvchisi | Importdan keyin birinchi parolni almashtirish kutilmoqda | Import aktivatsiyasi yakunlangan |
| --- | ---: | ---: | ---: | ---: |
| O‘quvchi | 429 | 427 | 426 | 0 |
| O‘qituvchi | 26 | 24 | 24 | 0 |

Ushbu relizda production’da yaratilgan hisoblar 0. Yigirma o‘quvchi profilida oldingi kirish qaydi bor. Joriy paroli bilan kira oladigan o‘quvchilar soni alohida o‘lchanmagan. Avvalgi tasdiqlangan importga tegishli 450 hisob uchun qayta yaratish talab qilinmaydi. Yangi credential rotatsiyasi va tarqatish uchun owner tasdig‘i kutilmoqda.

Excel eksportida to‘qqiz ustun, sinflar bo‘yicha varaqlar va ustozlar varag‘i bor. Sintetik fayl Chrome’da yaratildi. Office shifrlangan konteyneri, noto‘g‘ri parolning rad etilishi, to‘g‘ri parol bilan ochilishi va ikkita varaqdagi yozuvlar tekshirildi. Faylning o‘zi yuklangandan keyin uni ochishda Office parol so‘raydi. Owner MFA faylni olish vaqtida tekshiriladi. Yuklab olingan nusxani masofadan bekor qilish imkoni yo‘q. Hisobning boshlang‘ich kirishini almashtirish mumkin.

## O‘quv jarayoni va sinovlar

115 fayl, 127 varaq, 14 fan papkasi, 9 493 manba qatori. /admin/curriculum-coverage manba, fan, sinf va parser ogohlantirishlarini ko‘rsatadi. Uchta asl qoralama matematika, fizika va informatikadan. Har biri aniq manba qatoriga bog‘langan. Hisoblangan kalitlar tekshirildi. Qoralamani JSON orqali savollar bankiga yuklash, ustoz tahriri, versiya saqlash va tasdiqlash mavjud. Nashr qilingan pilot savollari 0.

Mashq va formal imtihonning mavjud bir savolli oynasiga bajarilish ko‘rsatkichi qo‘shildi. Mashq natijasi chiqarilgandan keyin izoh qadamlari ochiladi. Algebra pilotida klaviatura yoki sensor bilan grafikdagi nuqtani siljitish mumkin.

- TypeScript, Vite/Express build, 175 unit/API testi, 2 server smoke va 2 lokal PostgreSQL integratsiya testi o‘tdi.
- Chrome sinovi haqiqiy PracticeRunner komponenti va sintetik API bilan 360 px da bir vaqtda bitta savol, keyingi/oldingi tugmalari, javob saqlanishi va refreshni tekshirdi.
- Supabase staging indeksini qo‘llashdan oldin mos loginlar orasida 0 dublikat topildi. Migratsiyadan keyin PostgreSQL indeksni valid va unique deb qaytardi.
- Yangi branchning birinchi deployida login sahifasi ochildi, health HTTP 500 qaytardi. Yakuniy preview mavjud staging branch konfiguratsiyasi orqali tekshirildi.

## Production qarori

Production relizi va credential rotatsiyasi kutilmoqda. Vakolatli operator joriy backup va restore dalilini, import manifestini va mavjud 450 hisob bilan solishtirish natijasini tasdiqlashi kerak. Shundan keyin owner MFA bilan tarqatish amalini bajaradi. Real credential XLSX hozir chiqarilmadi.

Fanlar bo‘yicha to‘liq savol to‘plami, semantik dublikat tahlili, generatsiya ishlarini serverda boshqarish, rol panellarining to‘liq qayta dizayni, tanlangan darslar uchun interaktiv kutubxona hamda yakuniy accessibility, oflayn va unumdorlik auditi ochiq. Mavjud takrorlash, xatolar daftari va o‘zlashtirish modullarining holati roadmapda keltirilgan.
