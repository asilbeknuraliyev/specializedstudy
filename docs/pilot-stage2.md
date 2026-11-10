# Specialized Study — 2-bosqich preview hisoboti

Sana: 2026-11-10. Branch: `codex/pilot-stage1`. Funksional kod commit: `7340b177850d27517bff72c2ef40daa3cfa5e85a`.

Faqat alohida Vercel preview va Firestore `_specialized_preview_stage1` ishlatildi. Production'ga merge, deploy yoki haqiqiy bazaga yozish bajarilmadi. Graphify grafigi lokal AST orqali yangilandi; manba kodi va o‘quvchi ma’lumotlari semantik xizmatga yuborilmadi.

## Tayyor imkoniyatlar

- Admin: Hisoblar — bitta/Excel/CSV hisob yaratish, avtomatik yoki belgilangan login va dastlabki parol, birinchi kirishda almashtirish, qidirish, tiklash, to‘xtatish/faollashtirish. Parollar scrypt xesh; yaratilgan parollar faqat shu javob/oynada ko‘rinadi. Har bir o‘quvchiga alohida chop etiladigan kartochka, brauzer orqali PDF saqlash. Kartochkalarda faqat `https://specializedstudy.vercel.app`.
- `st131344`: Asilbek Nuraliyev, o‘quvchi, **8A2**, preview Firestore'da. Birinchi parolni o‘zgartirish majburiy. Berilgan dastlabki parol saqlandi, ochiq matni repozitoriyga yoki hisobotga yozilmadi. Production hisobi hali yaratilmagan.
- Kirish: username yoki eski email-login; Google ham saqlangan. HttpOnly, Secure, SameSite=Strict, host doirasidagi cookie. Brauzer storage'ida sessiya kaliti o‘rniga faqat `cookie` belgisi. Kirish auditi, noto‘g‘ri urinishlarda vaqtinchalik bloklash, parol/reset/suspend/logout'da sessiya bekor qilish. Boshqa origin'dan cookie bilan yozish taqiqlanadi.
- Profil: parolni almashtirish, ixtiyoriy Google biriktirish, Google orqali o‘z shaxsiy loginini yoqish. Tasdiqlangan Google shaxsi va yangi tasdiqlash talab qilinadi; email o‘xshashligi bilan hisoblar avtomatik qo‘shilmaydi.
- Mavzu banki: har mavzuga alohida bank; bitta/ko‘p javob, qisqa javob, juftlash, tartiblash, bo‘shliq, yozma savollar; ball, maslahat, izoh, qo‘shimcha qabul qilinadigan javoblar, rasm va KaTeX formulalar. Tahrir, qoralama va versiya bilan nashr; savol hovuzi, aralashtirish, vaqt, urinishlar va o‘tish foizi.
- Word/PDF import mavjud hujjat o‘quvchisini qayta ishlatadi; avtomatik topilgan savollarni admin tekshiradi. Excel/CSV shablon, server dry-run, xato qatori raqami, to‘g‘ri qismini kiritish, idempotent paket va undo. Tahrirlangan/testga ishlatilgan savollarni undo o‘chirmaydi. XLSX hajmi va deklaratsiya qilingan ochilgan hajmi chegaralangan.
- Mavzu testi: BSB/CHSB bilan umumiy to‘liq ekran komponentlari; bitta savol, katta variantlar, navigator, belgi, mobil pastdan ochiladigan navigator, server vaqti, xulosa/tasdiqlash, natija va yozma ish uchun “Tekshiruvda”. DEMO ham shu ekranda. Menyu va yon panel test davomida yashiriladi.
- Javob/belgilar serverga saqlanadi; yangilash va boshqa sessiyada tiklanadi. Mavzu testida tab chiqishi faqat sozlamaga qarab qayd etiladi va ishni to‘xtatmaydi. BSB/CHSB dagi mavjud ikki chiqish qoidasi saqlangan.
- Javob kaliti va qabul qilinadigan javoblar student DTO'lariga kiritilmaydi. Baholash serverda, yakunlangan urinish savollari va sozlamalari muzlatilgan nusxa orqali tekshiriladi; bank tahriri eski natijani o‘zgartirmaydi.
- Mening natijalarim, xatolar daftari, bir mashqda 5 tagacha savol bilan takrorlash; 1/3/7/14 kunlik reja. Muddatidan oldin qayta ko‘rish takrorlash hisobini sun’iy oshirmaydi.
- Mustaqil foydalanuvchi/savol/sessiya yozuvlari birlashtiriladi. Bir yozuvning parallel tahriri 409; bir o‘quvchining ikki parallel starti ikki urinish yaratmaydi. Eski imtihon browser qoralamalari o‘qilmaydi va tegishli storage kalitlari tozalanadi; yangi mavzu testi faqat server holatiga tayanadi.

## Tanlangan kichik qo‘shimchalar

Hajm — nisbiy ish ko‘lami, sarflangan vaqt va’dasi emas.

| Qo‘shimcha | Foydasi | Hajm |
|---|---|---|
| Parolni o‘zgartirish va majburiy birinchi almashtirish | Oddiy dastlabki parolni doimiy ishlatishni cheklaydi | Kichik |
| Test tarixi | O‘quvchi urinish va tekshiruv holatini topadi | Kichik |
| Saqlash holati, chiqish ogohlantirishi, tarmoq xabari | Javob yo‘qolishini kamaytiradi | Kichik |
| 404 va qisqa Yordam | Xato havoladan davom etish va foydalanish yo‘lini beradi | Kichik |
| Ustoz ro‘yxatida login/faollik holati | O‘z sinfidagi hisob muammosini aniqlaydi, parolni ko‘rsatmaydi | Kichik |
| Katta monitoring, yangi backup boshqaruvi, ustozning umumiy natijalar jadvali | Qo‘shimcha ruxsat va jarayon talab qiladi; bu relizga kiritilmadi | O‘rta, keyingi ish |

## Tekshiruv

26 ta tegishli avtomatik test muvaffaqiyatli o‘tdi: hisob/cookie (2), native login sikli (1), mavzu banki/test (2), import/parallel yozish (3), o‘zgargan nazorat oqimi (9), DEMO (4), cloud commit/persistence (3), Node/Vercel paket smoke (2). Typecheck va build muvaffaqiyatli. Avvalgi barcha testlar boshidan takrorlanmadi.

Haqiqiy preview brauzer sinovlari:

- 375px va 1440px mavzu testi: fullscreen, 7 savol turi, belgi/navigator, saqlash, reload, boshqa sessiyada tiklash, tab hodisasi, xulosa va server natijasi. Tekshiruvda ataylab bitta xato va bitta yozma javob: 5/7 ball, yozma kutishda.
- `st131344` haqiqiy login: 8A2, birinchi parol oynasi, HttpOnly cookie va admin API 403. Dastlabki parol QA davomida o‘zgartirilmadi.
- Boshqa sinfga test starti 403; teacher username paneli; eski teacher email-login va bloklash avtomatik testda.
- Admin bank tahriri/409, mobil ko‘rinish, dry-run'dagi 3-qator xatosi, to‘g‘ri qism importi va undo.
- DEMO umumiy fullscreen'da va topshirish natijasida; Google popup `accounts.google.com`'ga yetib bordi, asosiy sahifa preview'da qoldi. Google hisobiga parol kiritib yakuniy kirish QA’da bajarilmadi.
- Hisoblarni CSV'dan ommaviy yaratish, 2 ta kartochka va PDF generatsiyasi. PDF xotirada tekshirildi, parollar yozilgan fayl saqlanmadi.
- Profil menyusidan chiqish; brauzer JavaScript xatolari qayd etilmadi.

| Bir martalik o‘lchov | 375px | 1440px |
|---|---:|---:|
| Testni ochish | 0,93 s | 0,96 s |
| Reload va holatni tiklash | 2,81 s | 2,02 s |
| Topshirish va natija | 0,97 s | 0,50 s |

`st131344` kirishi va majburiy parol oynasi: 1,83 s. Bu bitta QA muhiti o‘lchovlari; yuklama yoki SLA ko‘rsatkichi emas.

Skrinshotlar va JSON dalillar Codex workspace'dagi `outputs/stage2/` ichida. `evidence.json` — brauzer tekshiruvlari/vaqtlar, `cleanup.json` — tozalash dalili. Skrinshotlarda vaqtinchalik QA topshiriqlari ko‘rinadi; ular bazadan tozalangan. DEMO uchun 12 mashq, 6 dars va alohida hisoblar namoyish maqsadida saqlanadi; uning QA javoblari tozalandi. Asilbek hisobi saqlanadi.

## Chegaralar va keyingi qadam

1. Ustozning haqiqiy yozma ishlarni tekshirishi va kontent yetishmovchiligi oynasi **3-bosqich** vazifasi; hozir qurilmadi. Haqiqiy yozma mavzu javobi tekshiruvda qoladi. DEMO’da mavjud namoyish baholashi bor.
2. Google shaxsni tekshirish sahifasini o‘z domenimizda joylashtirib bo‘lmaydi; tashqi Google popup zarur. Popup asosiy sahifani boshqa manzilga o‘tkazmaydi. Production authDomain va auth proxy canonical manzilga moslangan, production yakuniy smoke ruxsatdan keyin bajariladi.
3. `npm audit --omit=dev`: 4 ta moderate tranzitiv bog‘liqlik (`glob`, `minimatch`, `rimraf`, `google-gax`); high/critical 0. Ular ushbu ishda majburan yangilanmadi. Bu tekshiruv mutlaq buzib kirib bo‘lmaslik kafolati emas.
4. Firestore bepul kvotasi tugasa global yozish vaqtincha ishlamaydi; API saqlanmagan yozuvga muvaffaqiyat deb javob bermaydi. Pullik reja yoqilmadi.
5. Hujjat importi inson tekshiruvini almashtirmaydi. OCR/import uchun isbotlanmagan “98% aniqlik” va’dasi berilmaydi.
6. Cookie sessiyasiga o‘tishda oldingi browser tokeni bo‘lgan foydalanuvchilar qayta kirishi kerak bo‘lishi mumkin.

Preview ko‘rib chiqishga tayyor. Production'ga chiqish uchun foydalanuvchining aniq **“production’ga chiqar”** ruxsati kutiladi. 3-bosqich ham alohida tasdiqdan keyin boshlanadi.

Production holati o‘zgarmadi: `4122490939d3bb6be21ad2dfa414a3dd7de20668`, deployment `dpl_4ZWW8gTA3JwZPRaUGxFtdixDb42V`.

Ruxsatdan keyingi tartib: production pointer/revision va to‘liq Firestore runtime nusxasini himoyalangan lokal backup'ga saqlash, faqat ko‘rib chiqilgan commitni chiqarish, native/Google kirish, student bosh sahifa/test va admin smoke. Muammo bo‘lsa Vercel'ni yuqoridagi deployment'ga qaytarish. Ma’lumot backup'ini tiklashdan oldin relizdan keyingi yozuvlar solishtiriladi; eski nusxa yangi ishlar ustidan ko‘r-ko‘rona yozilmaydi. Production backup hozir yaratilmagan, chunki bu bosqichga hali ruxsat berilmagan.

Asosiy o‘zgarishlar: `server.ts`, `src/server/{accountRoutes,sessionCookies,topicEngine,topicRoutes,topicImportRoutes,mergeState,cloudState,cloudStateMiddleware,dbEngine,demoRoutes,studentHomeRoutes}.ts`; `src/components/{AccountsCenter,ExamWorkspace,PracticeRunner,QuestionInput,TopicBankCenter,TopicStudyPages,MathExpression,HelpPages}.tsx`; router, profil navigatsiyasi, auth/context va curriculum integratsiyasi; tegishli testlar; Vercel uchun generatsiya qilingan `api/index.js`.
