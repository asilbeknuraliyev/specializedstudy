# Imtihon ishonchliligi — v2

Asosiy yo‘l: kirish → javob → qurilma nusxasi → server ACK → ustoz tekshiruvi → natija. Yangi modullar `examReliabilityRoutes`, `examSessionStore`, `useReliableExam` va `examDrafts`; `LearnOSContext`ga imtihon outbox'i qo‘shilmagan.

## Aniq qoidalar

- Har saqlashning o‘zgarmas UUID identifikatori, kutilgan javob reviziyasi, oyna identifikatori va epoch'i bor. Yo‘qolgan ACK qayta yuborilganda bir marta yozilgan javob qayta o‘zgarmaydi. Bir UUID boshqa mazmun uchun ishlatilsa 409 qaytadi. Eski operatsiya tarixdan chiqqan bo‘lsa ham eski reviziya yozishni rad etadi.
- IndexedDB faqat shu hisob/imtihon/oyna javoblarini saqlaydi, parol yoki javob kalitini emas. “Qurilmada saqlandi” faqat IndexedDB tranzaksiyasi tugagach, “Serverga saqlandi” faqat server ACK'idan keyin chiqadi. Xotira xatosi alohida ko‘rsatiladi. Qoralamalar 7 kun saqlanadi; qabul qilingan va to‘liq yuborilgan nusxa tozalanadi.
- Shu ochiq sahifada aloqa tiklansa outbox avtomatik qayta yuboriladi. Sahifa qayta ochilganda boshqa mahalliy nusxa topilsa tiklash alohida tanlanadi. To‘liq yopilgan sahifani internetsiz qayta yuklash yoki boshqa qurilmada mahalliy nusxani tiklash kafolatlanmaydi.
- Bir paytda bitta oyna yozadi. Ikkinchisi o‘qish holatida. Boshqaruvni olish va mahalliy yoki server nusxasini tanlash aniq amal; eski oyna yangi javobni yashirincha bosa olmaydi. Mahalliy nusxa serverni tanlash oldidan alohida nusxa sifatida qoladi.
- Muddat serverda hisoblanadi. Aloqa uzilishi uni uzaytirmaydi. Muddatdan keyin faqat muddatgacha server tasdiqlagan javoblar baholanadi. Yuborilmagan mahalliy nusxa avtomatik bahoga qo‘shilmaydi; izoh bilan ustoz ko‘rigiga yuborish mumkin.
- Uchinchi `tab_hidden` hodisasi javobni bloklaydi va ko‘rikni talab qiladi. Bu ko‘chirish hukmi emas va avtomatik topshirish/jazo emas. Ustoz hodisalar va izohni tekshiradi; asos, mas’ul, oldingi/yangi muddat bilan qayta ochishi mumkin. Qayta ochilishdan oldin kuzatilgan kechikkan hodisa yangi davrga jarima sifatida sanalmaydi.
- Yakuniy topshirish alohida, o‘zgarmas kvitansiya (`SS-…`, vaqt, reviziya, javob digest'i) beradi. Kvitansiya va asl topshirish mustaqil omborda saqlanadi. Eski natijalar modeliga proyeksiya muvaffaqiyatsiz bo‘lsa, aynan shu kvitansiya bilan xavfsiz takrorlanadi. Kvitansiya berilgan ish qayta ochilmaydi; rasmiy natijaga tuzatish inson baholashi orqali amalga oshadi.

## Saqlash va o‘tish

Har bir o‘quvchi/imtihon sessiyasi `_specialized_runtime_exam_sessions` dagi mustaqil hujjat boshiga va 350KB gacha bo‘laklarga ega. Yangi autosave umumiy maktab snapshot'iga yozmaydi. Har o‘quvchining tranzaksiyasi alohida; JSON/gzip asinxron. Snapshot katalog, ruxsat tekshiruvi va yakuniy natijalar proyeksiyasi uchun hali ishlatiladi; uning o‘qish xarajati yo‘qoldi deb da’vo qilinmaydi.

Mavjud sessiya birinchi v2 ochilishida muddat va javoblarni saqlagan holda ko‘chiriladi. Migratsiyadan keyin eski sahifa yozishi 426 bilan to‘xtatiladi va yangilash so‘raladi. Eski topshirilgan natijalar saqlanadi. Rollar, fan/sinf va maktab har endpointda tekshiriladi; to‘g‘ridan-to‘g‘ri brauzer SDK kirishi deny-all qoidada qoladi.

Firestore tranzaksiyalari qayta bajarilishi mumkin; tashqi ta’sirlar callback ichida yuborilmaydi. [Rasmiy tranzaksiya qoidalari](https://firebase.google.com/docs/firestore/manage-data/transactions).

## Ekspluatatsiya

- `scripts/snapshotMaintenance.ts` avval dry-run beradi. Standart: 30 kun, kamida 14 reviziya, joriy/oldingi va operator pin'lari saqlanadi. Noma’lum yoshdagi yoki hech bir manifestga tegishli bo‘lmagan bo‘laklar avtomatik o‘chirilmaydi. Qo‘llash aniq namespace/reviziya tasdig‘i va joriy holatni qayta tekshirishni talab qiladi; parallel snapshot yozuvlari fence orqali qayta urinishga majbur qilinadi. Bir qo‘llash 350 o‘chirish bilan cheklangan; katta qarz operator tomonidan oldin arxivlanib, alohida ko‘rib chiqiladi. Dry-run ham Firestore o‘qish sarflaydi. Production’da tozalash avtomatik yoqilmagan.
- Imtihonning faol bosh hujjati va kvitansiyasi saqlanadi. 7 kundan eski, unga ulanmagan bo‘laklar tranzaksiyada tekshirib yig‘iladi. Operator vositasi oddiy API foydalanuvchisiga ochilmagan.
- Emulator sinovi katta javobni arxivdan boshqa test namespace'iga tiklaydi va buzilgan bo‘lakni rad etishni tekshiradi. Bu haqiqiy production'ni ortga qaytarish amaliyoti emas; buning uchun texnik oyna va alohida zaxira kerak.
- Kuzatuv sanagichlari joriy server nusxasiga tegishli; umumiy Firebase billing yoki kvota emas. Pullik rejim yoqilmaydi. Global xarajat ogohlantirishlari va haqiqiy Cloud Monitoring/Billing sozlamalari alohida operatsion ish bo‘lib qoladi.
- `scripts/backupExamSessions.ts` mustaqil sessiya boshlarini va faqat ularga ulangan bo‘laklarni SHA-256 manifesti bilan lokal `.data/backups` ga arxivlaydi. Eski umumiy snapshot zaxirasining o‘zi faol v2 javoblari uchun yetarli emas. Arxivlar maxfiy; repozitoriyga qo‘shilmaydi. DEMO tozalash tugmasi yangi sessiya omborini ham tozalaydi va tashqi qatnashchi topilsa to‘xtaydi.
- Imzosiz yoki noto‘g‘ri sessiya bilan asosiy himoyalangan API'ga kelgan so‘rov Firestore snapshot'ini o‘qishdan oldin rad etiladi. Bu faqat dastlabki tekshiruv; saqlangan revokatsiya va har bir resursga ruxsat odatdagi handlerda yana tekshiriladi.

## Pilot va kengayish

143 ta unit testi, cookie chegarasi, v2 protokol, alohida Firestore emulatori/rules va bundle tekshiruvi ishlatiladi. Brauzer dalillari alohida release hisobotiga yoziladi. Virtual 375px/1440px tekshiruvi haqiqiy telefon qurilmalaridagi foydalanish o‘rnini bosmaydi.

Lokal sintetik HTTP sinovida 50 va 200 bir vaqtdagi saqlash xatosiz o‘tdi; 1000 so‘rov bosqichida `ECONNREFUSED` kuzatildi. U muvaffaqiyat deb belgilanmaydi. Bu memory porti sinovi, Firestore/Vercel yuklama yoki narx o‘lchovi emas. 50 → 200 → 1000 cloud sinovi faqat alohida sintetik muhit, belgilangan xarajat chegarasi va to‘xtatish mezoni bilan o‘tkaziladi.

Haqiqiy kichik pilot: bitta sinf, 1–2 ustoz; kirishga ketgan vaqt, saqlashdagi uzilish, qoralama tiklanishi, ustoz tekshirish vaqti va foydalanuvchi savollari kuzatiladi. Hozirgi 19 rasmiy sinf o‘zgartirilmaydi. Ko‘p maktab konfiguratsiyasi, yopiq obyekt omboriga media ko‘chirish va keng login/import CPU sinovi keyingi o‘lchangan bosqichlardir; ular bajarildi deb ko‘rsatilmaydi.
