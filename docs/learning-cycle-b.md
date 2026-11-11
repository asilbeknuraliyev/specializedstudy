# O‘quv sikli — (b) xatolar daftari va takrorlash

## Chegara va joylashuv

Ish `codex/learning-cycle-a` alohida preview branchida davom etadi. (a) bosqichning avvalgi commit/deploymentlari saqlanadi. (b) uchun yangi `_specialized_preview_cycle_b` namespace va alohida session secret ishlatiladi. Avvalgi preview ma’lumotlari va production o‘zgartirilmaydi. Production’ga chiqarish, (c) ustoz tahlili va (d) pilot/retention ishlari alohida tasdiq kutadi. Graphify va tashqi semantik provayderga kod yuborish ishlatilmagan.

## O‘quvchi oqimi

- Bosh sahifada xatolar soni, bugungi takrorlash, 5 savoldan bir bosishda boshlash/davom ettirish.
- Xatolar daftarida fan/mavzu/holat filtri; savol, avvalgi xato javob, sana, xato turi, mustaqil to‘g‘ri javob sanalari va keyingi sana. Ro‘yxatlar 20 tadan sahifalanadi.
- Oldingi xato izohi alohida ochiladi; undan keyingi shu kundagi yechish yordam bilan bajarilgan mashq sifatida qayd etiladi.
- 5 yoki 10 tagacha savol, tanlangan fan yoki barcha fanlardan aralash mavzular. Savollar yetmasa mavjudlari olinadi. Bitta mavzu qolsa ketma-ket kelishi mumkin.
- Javob va ixtiyoriy ishonch darajasi serverga avtomatik saqlanadi; reload tiklaydi. Parallel tahrir 409 bilan aniq tanlov oynasini ochadi, lokal javobni tashlab yubormaydi.
- Tekshirishdan keyin o‘z javobi, to‘g‘ri javob, izoh, mavjud noto‘g‘ri variant izohi va mavzuga havola. Reload izohni tiklaydi. Javob kaliti joriy javobsiz savol DTO’siga kiritilmaydi.
- Seans yakunida “Bugun yetarli”, avtomatik keyingi seans yo‘q. Erta tugatish javobsiz savollarni xato qilib yozmaydi. Chiqish qoralamani saqlab, seansni keyin davom ettirishga qoldiradi.
- Shaxsiy o‘sish xaritasi va mavzu testi tarixi; rasmiy baho yoki boshqa o‘quvchilar reytingi emas.

## Oddiy algoritm

Maktab kuni `Asia/Tashkent` bo‘yicha serverda aniqlanadi. Brauzerning sanasi/javob to‘g‘riligi qabul qilinmaydi. Kun qo‘shish kalendar bo‘yicha; navbatdagi sana mahalliy 09:00 da ochiladi.

1. Topshirilgan mavzu testining joriy tasdiqlangan, avtomatik tekshiriladigan savollari ertaga navbatga qo‘yiladi. Noto‘g‘ri javoblar xatolar daftariga ham tushadi. Subyektiv yozma savollar avtomatik baholanmaydi va daftarga kiritilmaydi.
2. Dastlabki interval 1 kun. Muddatida, yordamsiz va boshqa kuni to‘g‘ri eslash keyingi qutiga o‘tkazadi: **3 → 7 → 14 → 30 kun**, keyin 30 kunda qoladi.
3. Ikki xil mahalliy kundagi ketma-ket mustaqil to‘g‘ri javob xatoni “O‘zlashtirildi” qiladi. Oddiy mavzu testini takror topshirish bunday kredit bermaydi. O‘zlashtirilgan savol ham uzoq intervalda navbatda qoladi.
4. Shu kunning o‘zida ko‘rilgan savol, maslahat yoki yechim bilan ishlash mustaqil eslash hisoblanmaydi; qaytish ertaga. Erta mustaqil javob sana kreditini berishi mumkin, ammo interval qutisini oshirmaydi.
5. Xato barcha mustaqil sana kreditlarini tozalaydi, intervalni 1 kunga tushiradi va xatoni qayta ishlash holatiga qaytaradi.
6. Kuniga ko‘pi bilan **20 ta tekshirilgan savol**, daftar orqali erta yechish ham shu limitga kiradi. Har savol kuniga bir marta tekshiriladi. Takroriy so‘rovlar qo‘shib hisoblamaydi. Bu yuqori chegara, majburiy maqsad emas.
7. Yuqori ishonchdagi xatoga ustuvorlik, kechikish ustuvorligiga 14 kunlik chegara; mavzular navbat bilan aralashtiriladi. Kechikkan savollar yo‘qolmaydi, ammo ekranga kunlik limitdan ortiq majburiyat chiqarilmaydi.

## O‘sish xaritasi mezoni

Joriy bankda kamida 3 ta mos avtomatik savol bo‘lsa, ularning kamida 80% ida ikki xil kunda mustaqil eslash va hal qilinmagan xato yo‘qligi “Mustahkam — mashqlar bo‘yicha” holatini beradi. Qolganlari “Jarayonda” yoki “Boshlanmagan”. Bu cheklangan savollar asosidagi mashq ko‘rsatkichi; butun mavzuni o‘zlashtirishning isboti emas.

Hisob topshirish/javob berish paytida yangilanib saqlanadi. Har GET’da barcha urinishlar qayta baholanmaydi. Nashr qilingan joriy savollar to‘plami o‘zgarsa, eski “Mustahkam” holati darhol ko‘rsatilmaydi; yangi mashqda hisob yangilanadi. Bankdagi eng yangi nashr qilingan savol versiyasi ishlatiladi. Faqat qoralamani tahrirlash hali amaldagi nashrni bekor qilmaydi; nashrdan olingan test/mavzu mashqqa chiqmaydi.

## Model va xavfsizlik

`mistakeRecords`, `spacedReviewQueue`, `spacedReviewSessions`, `spacedReviewAnswers`, `reviewDailyUsage`, `studentTopicProgress`. Har yozuv `schoolId` va `studentId` bilan. Navbat savol/versiyaga ishora qiladi; rasmlar va kalit nusxalanmaydi. Tarixdagi javob izohi serverdagi o‘zgarmas `topicQuestionVersions`dan olinadi.

Yangi endpointlar faqat faol o‘quvchi uchun. Har GET/mutatsiyada maktab va shaxs, seansda joriy sinf, amaldagi katalogda fan/mavzu/sinf/nashr tekshiriladi. Boshqa o‘quvchi ID’si bilan seans yoki yechim ochilmaydi. Oddiy `/api/state`ga yangi maxfiy kolleksiyalar qo‘shilmagan. BSB/CHSB javoblarini ko‘rsatish qoidasi o‘zgarmagan.

Operatsiya ID, qoralama revision CAS, bir o‘quvchiga bitta faol seans va kunlik yagona ledger ishlatiladi. Umumiy snapshot CAS/uch tomonli merge bir xil seans, savol yoki kunlik sanagich parallel o‘zgarsa 409 beradi; yo‘qotilgan yozish yoki limitni yashirin oshirishga yo‘l qo‘ymaydi. Seansning kun almashuvidan keyingi javobi rad etiladi.

## DEMO va tekshirish

Adminning mavjud DEMO yaratish/tiklash/o‘chirish oynasi ishlatiladi: 3 fan, 6 mavzu, 72 savol va 5 hisob. (b) tekshiruv uchun 66 avtomatik savoldan navbat hamda 6 xato, o‘tgan kunlar uchun **sun’iy tarix** faqat shu DEMO o‘quvchisiga tayyorlanadi. Bu haqiqiy o‘quvchi natijasi yoki o‘rganish samarasi haqidagi dalil emas. Kalendar algoritmi alohida boshqariladigan server soati bilan unit testda tekshiriladi; mahsulot API’sida vaqtni o‘zgartiruvchi yo‘l yo‘q.

Parollar faqat bir marta admin UI’da ko‘rinadi; Git/hisobotga yozilmaydi. Test oxirida faol DEMO va yangi olti kolleksiyadagi DEMO yozuvlari o‘chiriladi. **O‘zgarmas snapshot tarixi/jismoniy chunklarni tozalash bundan alohida; retention/purge (d) bosqichida hal qilinadi.**

Tekshiruvlar: yangi interval/kalendar/mastery va ruxsat/CAS/limit testlari, o‘zgargan mavzu testi va DEMO tozalash testlari, tegishli home testlari, TypeScript, build, bundling smoke. Real preview’da 375px va 1440px Playwright oqimi hamda skrinshotlar lokal `outputs/learning-cycle-b`da.

## Ochiq cheklovlar

- Hozirgi arxitektura Firestore snapshot ko‘prigidan foydalanadi; to‘liq DB ichidagi indekslangan so‘rovlar emas. Katalog/ro‘yxat filtrlari server xotirasida, ko‘rinishlar sahifalangan. Katta maktab miqyosidagi yuklama sinovi bajarilmagan.
- Sovuq start/Firestore tarmog‘i uchun 1 soniyadan kam server javobi kafolatlanmaydi. UI darhol bosish/yuklanish holatini beradi; kuzatilgan bir martalik vaqtlar alohida hisobotda, SLA emas.
- Mavjud chunk-size build ogohlantirishi qoladi. Oldingi auditdagi transitive moderate bog‘liqliklar ushbu bosqich doirasida yangilanmagan; yangi paket kiritilmagan.
- Ustoz item/class tahlili, pilot, statistik hodisa/rozilik/retention siyosati keyingi (c)/(d) tasdiqlarini kutadi. Diagnostika ixtiyoriy bo‘lib bu bosqichga qo‘shilmagan.
- Production’da haqiqiy o‘quvchi bilan qabul sinovi va release hali qilinmagan. Alohida ruxsat, zaxira va rollback rejasisiz production’ga chiqarilmaydi.
