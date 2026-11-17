# Specialized Study 2.0

## Sprint 1 — production hisoblari

2026-yil 17-noyabrda Vercel production relizi `977b48a815960224c250e108b613f909c32614e2` sifatida aniqlandi. `/api/health` 200 qaytardi. Ish amaldagi production branch’ining `7fd975dd3dbbb4308ff693e79bc41f2c6b4a06ee` uchidan boshlangan.

| Ko‘rsatkich | Production auditi |
| --- | --- |
| O‘quvchi profillari | 429 ta. 426 ta tasdiqlangan import va 3 ta oldingi profil. |
| Supabase Auth identifikatori bor o‘quvchilar | 427 ta, jumladan import qilingan 426 ta. |
| O‘quvchi logini | 428 ta profil serverdagi parol xeshi va hisob holati bo‘yicha native kirishga mos. 20 ta profilda ilovaga kirish yozuvi bor, jumladan import qilingan 19 ta. Parol sinovi izolyatsiyalangan muhitda bajariladi. |
| O‘qituvchi profillari va identifikatorlari | 26 ta profil, 24 ta tasdiqlangan va bog‘langan Auth identifikatori. 2 ta oldingi profil to‘xtatilgan. |
| Yangi hisoblar holati | Oldingi tasdiqlangan importda 450 ta hisob yaratilgan. 450 tasi birinchi parol almashtirilishini kutmoqda. 0 tasi bu bosqichni tugatgan. |
| Xodimlar manbasi | 51 qator, 24 ta hisob ochilgan. Qolgan 27 satr bo‘yicha shaxs, rol, fan va sinf qarori alohida tekshiriladi. |
| Avvalgi ma’lumotlar | 7 ta oldingi profil, 19 ta sinf, 2 552 ta dars (2 516 nashr, 36 arxiv), 3 ta imtihon (1 nashr, 2 qoralama), 1 ta topshirish. |
| O‘quv dasturi | 21 ta tasdiqlangan ish rejasi, 93 ta faol mavzu, tasdiqlangan jadval manbasi va taqvim. Yangi ish rejalari importida 121 varaq va 9 493 mavzu ko‘rib chiqishga tayyor, 117 muammo qayd qilingan. |

Production’da o‘quvchi va o‘qituvchi manifestlari tasdiqlangan, ikkala shifrlangan kirish paketi uchun bir martalik claim qaydi bor. Import Auth bog‘lash bosqichidan o‘tgan. Ochiq ish — eski o‘quvchi loginlarini yangi formatga o‘tkazish, xavfsiz boshlang‘ich parollarni yetkazish va birinchi almashtirishni yakunlash. Audit paytida `sps` va 7 raqam formatidagi o‘quvchi loginlari 0 ta edi. Student va teacher kirishi ilovaning native login oqimi orqali amalga oshadi. Supabase’dagi boshqariladigan aliaslar bog‘lovchi identifikator bo‘lib, parol bilan bevosita kirish yopiq.

### Tayyorlangan o‘zgarishlar

- Tasdiqlangan yangi import o‘quvchi uchun kriptografik tasodifiy 10 belgili login, alohida `sps-` prefiksli boshlang‘ich parol yaratadi. Bir xil ism-familiyaga ega o‘qituvchilarga profil ID’siga bog‘langan barqaror qo‘shimcha qo‘yiladi. O‘qituvchi boshlang‘ich paroli mustaqil tasodifiy bo‘g‘inlardan tuziladi.
- Owner uchun eski boshlang‘ich kirishlarni almashtirish faqat tasdiqlangan importdagi bog‘langan, hali birinchi parolini almashtirmagan profillarni qamrab oladi. Amalga sessiya MFA’si va 5 daqiqalik yangi Google isboti kerak. Profil va Auth ID saqlanadi, avvalgi sessiyalar bekor qilinadi va avval tayinlangan yangi formatdagi login qayta tiklashda saqlanadi.
- Shifrlangan bir martalik paketda joriy parol xeshiga mos yozuvlargina beriladi. Yangi parol muddati 7 kun, paket muddati 24 soat. Birinchi parol almashtirilguncha API shaxsiy sessiya profilini qaytaradi va maktab ma’lumotlariga kirishni to‘sadi.
- Mavjud PostgreSQL schema va rollar ishlatildi. Production SQL auditida 9 yopiq jadvalning hammasida RLS yoqilgan, brauzer rollariga ochiq `study_*` RPC soni 0, fayl ombori yopiq. Production ma’lumotlari testga ko‘chirilmadi.

### Sinov dalillari

- TypeScript, Vite va Express production build, 174 ta unit va izolyatsiyalangan API testi, 2 ta Vercel handler smoke testi va 2 ta PostgreSQL integratsiya testi o‘tdi. Production dependency auditida 0 ta topilma. Build ba’zi yirik JS fayllari va XLSX kutubxonasidagi `eval` haqida ogohlantirdi.
- Chrome’da sintetik hisoblar bilan birinchi kirish, parolni almashtirish, eski parol va sessiyani rad etish, o‘quvchi sinfi, ustozning fan-sinf doirasi va 360 px’da klaviatura navigatsiyasi tekshirildi.

### Production uchun qolgan amallar

1. Operator production uchun amaldagi zaxira va tiklash dalilini tasdiqlaydi. Manifestlarning joriy versiyasi, 450 ta kutilayotgan profil va rollar qayta sanaladi.
2. Owner ushbu branch’dan production relizi va mavjud hisoblarning boshlang‘ich kirishlarini almashtirishni tasdiqlaydi. Ilovada MFA va yangi Google tasdig‘ini bajaradi.
3. Operator bir martalik shifrlangan XLSX paketlarini alohida saqlaydi va har bir hisob egasiga faqat o‘z kirishini xavfsiz yetkazadi.
4. Relizdan keyin Auth va profil bog‘lanishlari, oldingi 7 hisob, darslar va imtihonlar agregat orqali qayta solishtiriladi. Birinchi parol o‘zgarishidan keyin faollashgan hisoblar qayta sanaladi.

## Sprint 2 — dizayn tizimi va «Mening maktab kunim»

Mavjud navigatsiya va sahifa komponentlaridan foydalanib rang, shrift, interval, harakat va fokus tokenlarini birlashtirish. O‘quvchi bosh sahifasida sana, tasdiqlangan guruh va `Лист1` darslari, mavzu, uy vazifasi, nazorat va takrorlashni ko‘rsatish. Chiqish mezoni — rollar bo‘yicha navigatsiya, 360 px, klaviatura, rang kontrasti va ma’lumot holatlari sinovdan o‘tadi.

## Sprint 3 — interaktiv ta’lim MVP

8-sinf «Kvadrat tenglamalar» darsida vizual muammo, interaktiv yechim, izoh va mini-test. Qayta ishlatiladigan mashqlar kutubxonasi moslashtirish, bo‘sh joy, ketma-ketlik, son o‘qi, tenglama balansi, geometriya, grafik, ko‘p bosqichli masala, kartochka va yo‘naltirilgan izohni qamrab oladi. Chiqish mezoni — klaviatura va sensor orqali bajarilgan urinishlar serverda saqlanadi, o‘quvchi darsni davom ettira oladi.

## Sprint 4 — shaxsiylashtirish

Mavjud topshiriq, o‘zlashtirish va interval asosidagi takrorlash oqimlarini real urinishlarga bog‘lash. Prerekvizitlarni izohlanadigan qoidalar asosida tavsiya qilish. Ustoz panelidagi mavzu, savol, topshiriq va yordam guruhlari tasdiqlangan fan-sinf juftligi bilan chegaralanadi. Chiqish mezoni — diagnostika va takroriy urinish tavsiyani yangilaydi, ustoz tavsiyaning asosini ko‘ra oladi.

## Sprint 5 — reliz sifati

School Pulse uchun manbasi tasdiqlangan davomat, dars rejasi, nazorat, tekshirilmagan ish, o‘sish va xavfsizlik ko‘rsatkichlarini ulash. Staging’da regressiya, brauzer, accessibility, ishlash, RLS va zaxiradan tiklash dalillarini yig‘ish. AI mentor keyingi bosqichda, serverdagi provider interfeysi va feature flag orqali tayyorlanadi. Chiqish mezoni — tasdiqlashga tayyor preview, sinov dalillari va production cutover tartibi.
