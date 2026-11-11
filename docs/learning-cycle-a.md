# O‘quv tsikli — (a) bosqich hisoboti

2026-11-11 · branch `codex/learning-cycle-a` · funksional kod `ade5172b93cf6df9b65aa2ce620308ad6848b18b`.

**Holat: preview ko‘rib chiqishga tayyor.** Ushbu bosqich — mavzu banki/testi, to‘liq ekran, izohli fikr-mulohaza va minimal inson yozma tekshiruvi. Foydalanuvchi yuborgan hujjat har bosqichdan keyin tasdiq kutishni talab qiladi; shu sabab (b), (c), (d) bosqichlar boshlanmadi. Graphify ishlatilmadi, mavjud kontent markazi/jadval/SPA qismlari qayta qurilmadi.

Preview: `https://specializedstudy-git-c-353235-asilbeknuraliyev43-langs-projects.vercel.app`. Ulashish havolasi chatda; vaqtinchalik kirish kodi repozitoriyga yozilmaydi.

## Nima o‘zgardi

- Administrator bilan birga **o‘z sinfi va faniga biriktirilgan ustoz** ham har mavzu uchun bank va testni boshqaradi. Server rol, maktab (`schoolId`/mavjud `institutionId`), sinf va fanni mustaqil tekshiradi. Umumiy parallel sinf mavzusida ustoz testi faqat uning sinflariga beriladi.
- Qoralama → ko‘rib chiqishda → nashr qilingan → arxiv holatlari. Savol tahriri yangi revision yaratadi, tasdiqni bekor qiladi. Savol/test versiyalari alohida o‘zgarmas tarixda saqlanadi. Boshlangan urinishning savollari, balli, sozlamalari va izohi eski nusxaga bog‘liq qoladi.
- Nashrdan oldin **inson tasdig‘i va majburiy izoh** talab qilinadi. Kalit/variant tekshiruvi saqlangan; manba bo‘lmasa alohida ogohlantirish va aniq tasdiq kerak. Import qilingan savollar avtomatik tasdiqlanmaydi. Excel shablon, dry-run, qator xatolari, valid-only kiritish va undo mavjud tizim bilan ishlaydi.
- Savolda 1–3 maslahat, ixtiyoriy noto‘g‘ri variant izohi, manba nomi/sahifasi, qiyinlik va ball saqlanadi. Yetti savol turi, rasm va KaTeX formulalar qayta ishlatiladi. Ustoz/adminning o‘quvchi ko‘rinishi ham umumiy fullscreen komponentida; undagi natija saqlanmaydi.
- Test oldida ixtiyoriy sozlama bilan past/o‘rta/yuqori ishonch so‘raladi. Maslahatlar serverdan bittadan ochiladi; ochilmagan maslahat, kalit va variant izohlari faol test DTO'sida bo‘lmaydi. Maslahat **ballni kamaytirmaydi**, foydalanish esa alohida ko‘rinadi.
- Foydalanuvchining keyingi aniqlashtirishiga ko‘ra, **faqat mavzu testini topshirgach** o‘sha urinishning to‘g‘ri javobi va izohi ko‘rsatiladi. BSB/CHSB javob kalitlari ochilmadi. Natijada mening javobim, to‘g‘ri javob, izoh, tanlangan noto‘g‘ri variant izohi, ishonchli lekin noto‘g‘ri javoblar va manba mavzusiga havola bor.
- Ochiq yozma javob avtomatik baholanmaydi. Alohida ustoz/admin oynasida maksimal ball chegarasida inson balli va izohi qo‘yiladi; takroriy so‘rov qayta hisoblamaydi. O‘quvchi natijasi keyin serverdan yangilanadi. Natija **shaxsiy mashq ko‘rsatkichi**, rasmiy elektron jurnal bahosi emas.
- 375px va kompyuterda bitta savol, kamida 44px tugmalar, mobil navigator, belgi, xulosa, server vaqti va avto-saqlash. Natija uzun bo‘lsa ham chiqish tugmasi yuqorida ko‘rinadi. Mashqdagi tab chiqishi ishni to‘xtatmaydi.

## Uchta ochiq texnik masala

| Masala | Amal va amaliy chegara |
|---|---|
| 409 parallel yozish | Mustaqil yozuvlar merge qilinadi; bir yozuvdagi kelishmovchilik jim bosib yozilmaydi. O‘quvchiga ikkala javob ko‘rsatiladi va uning tanlovi bilan saqlanadi. Ustoz tahriri revision nazoratida. Qayta yuborilgan yaratish/nashr/grade so‘rovlari idempotent. Yuqori parallel yuklamada konfliktning o‘zi butunlay yo‘qolishi va’da qilinmaydi. |
| Eski qoralamalar | Oldingi bosqichdagi eski browser qoralamasini o‘qimaslik/tozalash qoidasi saqlangan. Yangi javoblar serverda; kelishmovchilikdagi lokal nusxa foydalanuvchi tanlaguncha React xotirasida saqlanadi. |
| Sovuq start | Bir paytdagi sovuq snapshot o‘qishlari bir I/O ishiga birlashtiriladi, har so‘rovga alohida nusxa beriladi. Eskirgan ruxsatni TTL bilan ushlab turish yo‘q. Warm chunk kesh va o‘zgarmagan chunklarni qayta yozmaslik saqlangan. Server-Timing qo‘shildi. Vercel sovuq startining o‘zi yo‘qolmadi: birinchi o‘lchov 2,67 s. |

Yangi versiya/import/urinish yozuvlarida `schoolId` bor. Bank sahifasi 25, test/tarix va yozma navbat 20, versiyalar 10 yozuvdan sahifalanadi. Katta snapshotlar mavjud bo‘laklarga ajratilgan saqlash ko‘prigida; bu hali milliy ko‘lam uchun alohida domain kolleksiyalariga to‘liq migratsiya emas.

## Qanday tekshirildi

**19 ta tegishli avtomatik test o‘tdi**: yangi o‘quv tsikli (6), DEMO hayot sikli (1), mavzu banki (2), import/parallel yozish (3), durable cloud commit (3), BSB/CHSB ruxsat va kalit yashirish bo‘yicha tanlangan tekshiruvlar (2), native Node/Vercel paket smoke (2). Typecheck va build o‘tdi. O‘zgarmagan barcha testlar qayta ishlatilmadi.

Playwright, haqiqiy preview:

1. Admin 3 fan, 6 mavzu, har mavzuga 12 tadan **72 ta izohli DEMO savol** va 5 ta vaqtinchalik hisob yaratdi. Savollar mualliflik DEMO mashqlari sifatida belgilangan; rasmiy darslik manbasi deb ko‘rsatilmaydi.
2. Matematika va Ingliz tili ustozlari 375px/1440px da qoralama → ko‘rib chiqish → nashr yo‘lidan o‘tdi. Savol tahriri, inson tasdig‘i, versiya va saqlanmaydigan fullscreen preview ishladi.
3. Begona fan va begona sinf rad etildi. Boshqa maktab va parallel sinf chegarasi avtomatik testda tekshirildi.
4. O‘quvchi ikkala o‘lchamda fullscreen, ishonch, bosqichli maslahat, belgi, navigator, reload, barcha tegishli savol formatlari va topshirish xulosasidan o‘tdi. Faol urinish JSON'ida kalit/izohlar yo‘qligi tekshirildi.
5. Ikkinchi sessiya boshqa javob saqladi: 409 oynasida lokal va server javobi solishtirilib, o‘quvchining tanlovi saqlandi. Natijaga kalit/izoh faqat topshirgach chiqdi.
6. Har ikkala DEMO urinishida ataylab bitta avtomatik xato va bitta yozma javob: 10/13, yozma tekshiruvda. Ustoz 1,5 ball va izoh bergach 11,5/13 bo‘ldi. Bu sun’iy QA holati; o‘quvchilar o‘rtachasi yoki ta’sir ko‘rsatkichi emas.
7. Google popup yangi ruxsat etilgan domendan Google'ga yetib bordi; asosiy sahifa preview'da qoldi. Google hisobiga parol kiritib yakuniy kirish avtomatizatsiyada bajarilmadi.
8. Faol DEMO yozuvlari bitta tugma bilan o‘chirildi. Yangi namespace'dagi private snapshot'ni anonim Firebase mijoz o‘qiy olmasligi `permission-denied` bilan tekshirildi. Brauzer JavaScript exception: 0.

| Bir martalik o‘lchov | 375px | 1440px |
|---|---:|---:|
| Testni ochish | 600 ms | 760 ms |
| Reload va tiklash | 1305 ms | 1299 ms |
| Topshirish va izohli natija | 514 ms | 516 ms |

Ustoz qoralamasini saqlash: 425/417 ms. Birinchi preview holatini o‘qish: 2670 ms. Bu bir martalik QA o‘lchovlari; yuklama testi yoki SLA kafolati emas.

Skrinshotlar va dalillar Codex workspace'dagi `outputs/learning-cycle-a/` papkasida: `browser.json`, `auth-domain.json`, `snapshot-access.json`, `cleanup.json` va HTML galereya.

## DEMO'ni xavfsiz qayta ochish

Google bilan admin kirishi → **O‘quv tsikli DEMO** → **DEMO yaratish**. 3 fan ustozining, asosiy o‘quvchining va begona sinf tekshiruvi uchun o‘quvchining login/parollari faqat o‘sha oynada beriladi. Yopilib qolsa **DEMO parollarini tiklash** yangi parollar yaratadi. Ular repozitoriyga, hisobotga yoki test dalillariga yozilmadi. **DEMO’ni to‘liq o‘chirish** faqat shu to‘plamga bog‘liq faol yozuvlarni tozalaydi.

## Pedagogik qarorlar va halol chegaralar

- Avval mustaqil javob, keyin izoh: qayta o‘qishdan oldin eslab chiqarish uchun sharoit bor.
- Maslahat bir martada hammasini bermaydi. Ball jazosi yo‘q; mustaqil va maslahatli yechimni farqlash uchun foydalanish saqlanadi. Avtomatik savollar to‘liq mos javob uchun ball oladi; yozma qismni inson tekshiradi.
- Ishonchli, lekin noto‘g‘ri javob alohida qayta ko‘rish signali. Ishonch o‘quvchining o‘z hisoboti; fikrlash jarayonining bevosita o‘lchovi emas.
- Savol vaqti brauzerning taxminiy faol vaqti: serverdagi umumiy o‘tgan vaqt bilan chegaralangan, bahoga ta’sir qilmaydi. Uni diqqat yoki tushunish isboti deb bo‘lmaydi.
- Reklama, cheksiz lenta, tasodifiy mukofot va sharmanda qiluvchi reyting qo‘shilmadi. Bilim oshgani hali da’vo qilinmaydi; buning uchun (d) pilot ma’lumoti kerak.

**Keyingi, hali qurilmagan bosqichlar:**

- **(b)** yangi xatolar daftari qoidalari, ikki xil kunda ketma-ket ikki to‘g‘ri javob bilan o‘zlashtirish, 1/3/7/14/30 kunlik takrorlash, fanlar/mavzularni aralashtirish, kunlik chegara va o‘zlashtirish xaritasi. Hozir avvalgi sodda daftar/takrorlash mosligi saqlangan; u yangi qoidalar bajarildi degani emas.
- **(c)** item analysis, kam namunada xulosa bermaslik, variant taqsimoti va yuqori/quyi 27% guruh solishtirmasi, sinf tavsiyasi/filtr/eksport. Hozir sinf uchun statistik tavsiya yoki sun’iy item tahlili ko‘rsatilmaydi.
- **(d)** pilot/taqqoslash guruhlari, oldin/keyin o‘lchov, jamlangan hodisa va hisobotlar, rozilik matni, saqlash muddati va fizik o‘chirish jarayoni. Kichik namunada sabab-natija da’vosi qilinmaydi.

## Xavflar va production chegarasi

- Faol yozuvlarni o‘chirish immutable snapshot tarixining fizik purge'i bilan bir xil emas. Hozirgi o‘chirish aktiv DEMO hisoblari/darslari/testlari/javoblarini tozaladi; eski snapshot/chunk retention va fizik purge (d) da hal qilinadi. Haqiqiy o‘quvchi ma’lumotini o‘chirish to‘liq tayyor deb da’vo qilinmaydi.
- Snapshot ko‘prigi, bepul Firestore kvotasi va milliy yuklamaga tayyorgarlik cheklovlari saqlanadi. Bu bosqichda yangi dependency qo‘shilmadi; oldingi auditdagi moderate tranzitiv bog‘liqliklar bo‘yicha alohida ish qolgan.
- Production va avvalgi preview foydalanuvchilari ko‘chirilmadi/o‘zgartirilmadi. Yangi namespace'da faqat mavjud Firebase claim'i tekshirilgan administrator profili va vaqtinchalik DEMO bo‘ldi. Firebase'ga foydalanuvchi aniq ruxsat bergan **faqat bitta yangi preview domeni** qo‘shildi, avvalgi domenlar saqlandi.
- Production o‘zgarmagan: commit `4122490939d3bb6be21ad2dfa414a3dd7de20668`, deployment `dpl_4ZWW8gTA3JwZPRaUGxFtdixDb42V`. Ruxsatsiz merge yoki production deploy qilinmadi.
- Production uchun to‘liq o‘quv tsikli hali tayyor deb tasdiqlanmaydi: (b)–(d), kontent va pilot tekshiruvi qolgan. Faqat alohida “production’ga chiqar” ruxsatidan keyin production backup/pointer qaydi, rollback yo‘li va tezkor smoke bajariladi.

Asosiy fayllar: `src/server/topicEngine.ts`, `topicRoutes.ts`, `topicGradingRoutes.ts`, `topicImportRoutes.ts`, `learningDemoContent.ts`, `learningDemoRoutes.ts`, `coalescedRead.ts`, `cloudState.ts`, `cloudStateMiddleware.ts`, `mergeState.ts`; `src/components/TopicQuestionEditor.tsx`, `TopicStudentPreview.tsx`, `PracticeRunner.tsx`, `TopicGradingCenter.tsx`, `LearningDemoCenter.tsx`, `TopicBankCenter.tsx`, `ExamWorkspace.tsx`; router/nav, server registratsiyasi, `useTopicMutation.ts`, tegishli testlar va generatsiya qilingan `api/index.js`.
