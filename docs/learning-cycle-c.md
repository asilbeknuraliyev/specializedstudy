# (c) — Ustozning o‘quv tahlili

## Chegara

Tasdiqlangan C bosqich: mavzu mashqlarining savol, mavzu/sinf va o‘quvchi kesimi, keyingi dars tavsiyasi, ustozning e’tibor kartalari, Excel va chop etish/PDF. BSB/CHSB kalit siyosati va rasmiy baholar o‘zgarmaydi. Bu platforma rasmiy elektron jurnal o‘rnini bosmaydi. Pilot, rozilik, umumiy analytics events va retention/purge — hali tasdiqlanmagan D bosqichi.

`codex/learning-cycle-a` mavjud alohida preview branch davom ettirilgan. C uchun yangi `_specialized_preview_cycle_c` Firestore namespace ishlatilgan. Session imzosi shu namespace bilan HMAC orqali ajratiladi. Avvalgi A/B preview namespace’lari va production ma’lumotlari ko‘chirilmaydi/o‘zgartirilmaydi. Google uchun allaqachon tasdiqlangan o‘sha preview domeni ishlatiladi; Firebase authorizedDomains qayta o‘zgartirilmagan. Ulashish havolasi ruxsat etilgan 23 soatlik muddat bilan yangilanadi. Graphify yoki tashqi semantik provayderga kod yuborish ishlatilmagan.

## Qayerdan ochiladi

- `/teacher/dashboard`: “Bugun e’tibor talab qiladi” — yozma javoblar, tekshirish signali bor savol satrlari, davrda ish topshirmaganlar, yetarli namunadagi eng past o‘rtacha mavzu.
- `/teacher/topic-analysis` yoki `/admin/topic-analysis`: fan, sinf, mavzu va davr filtrlari; “Savollar”, “Mavzu va sinf”, “O‘quvchilar” ko‘rinishlari. Har biri 20 tadan sahifalanadi.
- Savol panelida variantlar taqsimoti, yuqori/quyi guruh farqi, namuna cheklovi va mavjud savollar bankiga havola. Mavjud bankda ustoz yangi tahrirni tasdiqlab nashr qiladi. Eski versiya natijasi o‘zgarmaydi.
- Eski topshirilgan ishlar bo‘lsa, “Oldingi natijalarni ulash”: tanlangan aniq 20 tagacha ishni bir marta hisobga oladi. Javoblar yoki baholar tahrirlanmaydi; qayta so‘rov qo‘shib hisoblamaydi.
- Excel: 5 varaq — Savollar, Variantlar, Mavzular, O‘quvchilar, Izoh. PDF: chop etish oynasida “PDF sifatida saqlash”. Eksport amaldagi filtrdagi barcha satrlar uchun, sahifadagi 20 satr bilangina cheklanmaydi; har bo‘lim 1000 satrdan oshsa filtrni toraytirish so‘raladi.

## Namuna va foiz

1. Hisob birligi: **maktab + sinf + test ID + test versiyasi + savol ID/versiyasi**. Turli sinf yoki test versiyalari bitta savol foiziga yashirin qo‘shilmaydi.
2. Tanlangan mahalliy sana oralig‘ida har o‘quvchining har test/sinf/versiya uchun birinchi topshirilgan ishi olinadi. Takror yechib to‘g‘rilash foizni sun’iy oshirmaydi. Sana filtri o‘zgarsa o‘sha davr ichidagi birinchi urinish olinadi.
3. Tasodifiy tanlangan testda savolni ko‘rmaganlar shu savol maxrajiga kirmaydi. Javobsiz qoldirilgan, ammo testga tushgan savol noto‘g‘ri hisoblanadi.
4. **Kamida 5 nafar o‘quvchi** bo‘lmasa to‘g‘ri ulush, to‘g‘ri javob soni, variant taqsimoti, guruh farqi, ogohlantirish yoki tavsiya berilmaydi. Namuna soni va “Ma’lumot yetarli emas” ko‘rsatiladi. 5 nafar — faqat ko‘rsatish chegarasi, statistik ishonchlilik kafolati emas.
5. `p = to‘liq to‘g‘ri javoblar / shu savolni olgan birinchi urinishlar`. Qisqa javob/juftlash/tartiblash mavjud server grader bilan to‘liq tekshiriladi. Subyektiv yozma javoblar statistikaga kirmaydi. Yozma ishlar alohida inson tekshiruviga qoladi.
6. Variant tanlanish ulushi ham shu `n` maxrajdan. Ko‘p javobli savolda bir kishi bir nechta variant tanlay oladi: yig‘indi 100% dan oshishi mumkin. Eng ko‘p noto‘g‘ri variantlar teng bo‘lsa teng variantlarning barchasi ko‘rsatiladi. Juftlash/tartiblash/qisqa savolda oddiy variant ulushi qo‘llanmaydi.
7. Maslahat ishlatilgan javoblar ham foizga kiradi, ularning soni alohida ko‘rsatiladi. Foizni mustaqil uzoq muddatli o‘zlashtirish ko‘rsatkichi deb talqin qilish mumkin emas.

## Yuqori/quyi 27% farqi

Har ishtirokchining **target savol chiqarib tashlangan** qolgan avtomatik savollardagi to‘g‘ri ulushi hisoblanadi. Kamida 2 ta qolgan savol kerak. Shu natija bo‘yicha bir sinf/test versiyasi ichida tartiblanadi. Har guruh hajmi `ceil(n × 0.27)`; o‘rta guruh hisobga kirmaydi.

`D = yuqori guruh target-to‘g‘ri ulushi − quyi guruh target-to‘g‘ri ulushi`.

Masalan: `n=10`, har guruh 3 kishi, yuqorida 2/3, quyida 1/3 to‘g‘ri → `D=1/3`, ekranda taxminan **33 foiz punkt**. Umumiy 4/10 to‘g‘ri bo‘lsa p=40%, bitta noto‘g‘ri variant 6/10 tanlansa uning ulushi 60%.

Yuqori guruhning eng past qolgan balli quyi guruhning eng yuqori ballidan katta bo‘lmasa, chegara tengliklari sabab guruhlar ajratilmaydi. O‘quvchi ID yoki ism bo‘yicha teng ballni sun’iy ajratish yo‘q. Guruh qiymati yo‘qligi nol farq degani emas. Bu sodda ko‘rsatkich; IRT, validatsiyalangan psixometrik shkala yoki o‘quvchiga doimiy qobiliyat yorlig‘i emas.

## Tekshirish signallari

- `p > 95%`: juda oson; `p < 20%`: qiyin. Chegaraning o‘zi (95% yoki 20%) signal bermaydi.
- Mazmunli yuqori/quyi ajratish mavjud bo‘lsa, `D < 0` yoki yuqori guruhda bir noto‘g‘ri variant tanlash ulushi to‘liq to‘g‘ri javob ulushidan katta: **kalitni tekshirish signali**.
- Kamida 10 o‘quvchi, `20% ≤ p ≤ 95%`, mazmunli guruhlar va `|D| < 0.10`: **ajratish past — matnni tekshiring**.
- Bular matn/kalitni tekshirish uchun signallar. Savol noto‘g‘ri tuzilganini isbotlamaydi; tizim kalit, ball yoki nashrni o‘zicha o‘zgartirmaydi.

## Mavzu, tavsiya va shaxsiy ko‘rinish

Mavzu/sinf o‘rtachasi — o‘sha davr ichidagi test-versiya bo‘yicha birinchi urinishlar avtomatik to‘g‘ri ulushlarining o‘rtachasi. Bir nechta versiyada bir o‘quvchi qatnashishi mumkin; “urinishlar” va alohida “ishtirokchilar” soni shu sabab ajratilgan. Mavzu o‘rtachasi va “eng past mavzu” uchun kamida 5 alohida o‘quvchi kerak. Uchta eng past savol ham faqat yetarli namunadan tanlanadi.

Keyingi dars tavsiyasi savol namunasida n≥5 va p<60% bo‘lsagina tuziladi. Matn “hisobga olingan N nafar” deydi; qatnashmagan o‘quvchilar yoki butun sinfga asossiz foiz yoyilmaydi. Namuna yo‘qligida tavsiya yo‘qligi bilim mukammalligini anglatmaydi.

Shaxsiy ro‘yxat joriy faol va test biriktirilgan sinf o‘quvchilaridan, **alifbo tartibida**. Kamida bitta mos ish topshirgan bo‘lsa “Topshirgan”; hali boshlagan bo‘lsa “Davom etmoqda”; topshirilgan eski ish hali indekslanmagan bo‘lsa “Oldingi ish tahlilga ulanmagan”, bunday odam “Boshlamagan”ga qo‘shilmaydi. Sana davridagi oxirgi 3 mashqning barchasida avtomatik to‘g‘ri ulush <50% bo‘lsa, hukmsiz qayta tushuntirish signali chiqadi. Bu diagnoz yoki o‘quvchi reytingi emas.

Ochiq xatolar soni — tegishli fan/mavzulardagi **hozirgi** xatolar daftari holati; tarixiy sana filtriga bog‘lanmagan. Shaxsiy ro‘yxat joriy sinf ro‘yxati, o‘tgan davrdagi to‘liq tarixiy roster rekonstruksiyasi emas. Tarixiy sinf almashgan o‘quvchining eski natijasi o‘sha sinf agregatida qolishi mumkin; joriy shaxsiy ro‘yxatda boshqa sinf o‘quvchisi ko‘rsatilmaydi.

## Saqlash va ruxsatlar

`topicAnalysisFacts`: topshirilgan mashq bo‘yicha server baholagan avtomatik javob, savol versiyasi, test/sinf konteksti, ichki studentId, ishonch va maslahat. Kalit va rasm nusxalanmaydi; izoh/kalit o‘zgarmas savol versiyasida serverga yopiq qoladi.

`topicAnalysisCohorts`: har maktab/sinf/test versiyasi uchun birinchi urinishlardan yig‘ilgan hisob. Topshirish yoki ruxsatli tarixiy qayta indekslashda yangilanadi. GET javoblarni qayta baholamaydi va Firestore’ga yozmaydi. Davr filtri uchun tayyor factlardan hisob birinchi marta qurilib, 40 yozuvli/5 daqiqalik server keshi bilan qayta ishlatiladi; cohort revision o‘zgarsa kesh bekor bo‘ladi. Davr-savol keshi 4 MB, bitta yozuv 1 MB bilan cheklangan. To‘liq mavzu/sinf/o‘quvchi hisobotining alohida server keshi 20 yozuv, jami 8 MB, bitta hisobot 2 MB va 5 daqiqa bilan cheklangan. Kalit namespace/environment, maktab, rol va foydalanuvchi scope, filtrlar, cohort revision, roster, yozma ish revision/pending holati, joriy xatolar holati va savol/test versiyalarini o‘z ichiga oladi. Shu sabab yangi topshirish, yozma tekshiruv, sinf/ism/status, ochiq xato yoki nashr o‘zgarishi keyingi so‘rovdayoq yangilanadi. O‘qish ajratilgan JSON nusxasini qaytaradi; haddan katta hisobot keshga olinmaydi. GET yangi snapshotning yengil metama’lumotidan kalit tuzadi, lekin bir xil filtr va holatda agregatni qayta qurmaydi.

Har endpoint faol foydalanuvchi, ustoz yoki emaili tasdiqlangan platform admin rolini tekshiradi. Ustoz sinfi joriy assignedClassIds va maktab sinflari bilan, fani joriy subject va tegishli mavzu bilan cheklanadi. Umumiy mavzuda ham boshqa sinf statistikasi, ismi yoki eksporti chiqmaydi. Admin faqat o‘z maktabini ko‘radi. O‘quvchiga GET, eksport va backfill — 403. Yangi kolleksiyalar oddiy `/api/state`ga qo‘shilmagan. Javoblar `Cache-Control: no-store`.

Statistika fakt ID’si session ID; qayta topshirish yoki backfill bir ishni ikki marta qo‘shmaydi. Bir cohort parallel yangilansa snapshot CAS/uch tomonli merge 409 beradi, bir statistika boshqa yozuvni yashirin bosmaydi. Foydalanuvchi tahrirlagan savolning yangi versiyasi yangi tahlil kontekstini boshlaydi; eski fakt/kalit/foiz qayta yozilmaydi.

Excel matnlari formula sifatida talqin qilinmasligi uchun zararsizlantiriladi. Chop etish HTML’ida barcha foydalanuvchi matnlari escape qilinadi; skript/havola sifatida ishlamaydi. Eksport ham oddiy ko‘rinish bilan bir xil server ruxsat/filtr tekshiruvidan o‘tadi.

## DEMO va qabul sinovi

3 fan, 6 mavzu, 72 mazmunli savoldan mavjud preview DEMO yaratiladi. C sinovi uchun bir necha DEMO o‘quvchi, ikki sinf, oldingi mashqlar, takroriy past natija va eski indekslanmagan ish **sun’iy** tayyorlanadi. Har hisob va ish DEMO deb belgilanadi; bu o‘rganish samarasi haqidagi dalil emas. Asosiy ustozlar va o‘quvchi haqiqiy native login oqimi bilan kiradi; qo‘shimcha statistik fixture o‘quvchilari kirish uchun parolsiz sun’iy profillar, haqiqiy foydalanuvchilar emas.

Tegishli testlar: qo‘lda formula, minimal n, teng ball, qat’iy chegaralar, ko‘p variant, yozma chiqarilishi, ruxsat/sinf/fan/maktab, sana, readonly, idempotent backfill, eski versiya, parallel cohort CAS va eksport escape. TypeScript/build/bundle va o‘zgargan submit/DEMO testlari ham bajariladi. Real preview Playwright 375px/1440px oqimi, haqiqiy XLSX va PDF fayllari, konsol xatolari alohida lokal hisobotda.

Oxirida DEMO bir tugma bilan tozalanadi: yangi fact/cohort yozuvlari ham ketadi, oldindan mavjud test fixturelari saqlanishi unit testda tekshiriladi. **Faol yozuv o‘chirilishi o‘zgarmas snapshot/chunklar jismoniy yo‘q qilinganini anglatmaydi; bu D retention/purge ishidir.**

## Qolgan cheklovlar

- Arxitektura hanuz Firestore snapshot ko‘prigi. Yirik maktab/yuklama uchun indekslangan alohida kolleksiyalarga o‘tish va yuklama sinovi kelajak ishi. Fakt/sessiya tarixini saqlash hajmi vaqt bilan oshadi; saqlash muddati D’da hal qilinadi.
- Barcha kontekst satrlari server xotirasida yig‘iladi, javoblar sahifalangan. Filtr hisobi tayyor fact/keshdan, qayta grader ishlatilmaydi. Sovuq start va global tarmoq uchun 1 soniyalik SLA kafolatlanmaydi; bir martalik kuzatuvlar hisobotda ko‘rsatiladi.
- Eski ishda sinf yoki tasdiqlangan o‘zgarmas savol snapshoti bo‘lmasa taxminiy tarix yaratilmaydi. Bunday legacy ma’lumot alohida tekshirish/migratsiya talab etadi.
- Kichik namuna va shu mashqdagi maslahatlar, variantlar, takror tashriflar ko‘rsatkichni cheklaydi. Natijani pedagogik yoki sabab-natija samarasi deb ko‘rsatish mumkin emas.
- Oldingi bundle-size ogohlantirishi va transitive moderate bog‘liqliklar ushbu bosqichda o‘zgartirilmagan. Yangi paket qo‘shilmadi.
- Production release va haqiqiy maktab qabul sinovi hali bajarilmagan. Alohida ruxsat, zaxira/rollback yo‘li va tezkor release tekshiruvlarisiz production’ga chiqarilmaydi. C tugagach D uchun tasdiq kutiladi.
