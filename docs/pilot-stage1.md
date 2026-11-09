# 1-bosqich: kontent va o‘quvchi bosh sahifasi

Faqat `codex/pilot-stage1`. Production branch, production deploy va haqiqiy o‘quvchi yozuvlari o‘zgartirilmagan. 2 va 3-bosqichlar hamda B/C guruhidagi imkoniyatlar boshlanmagan.

## Ishlaydigan oqimlar

- `/admin/content`: ish rejasi va dars jadvali uchun XLSX/CSV importi; 3 MB, 1000 qator, bitta varaq.
- Uchta XLSX shablon: ish rejasi, jadval, savollar. Savollar importi keyingi bosqichga tegishli.
- Yuklash → sinov ko‘rinishi → to‘g‘ri qatorlarni tasdiqlash. Xato va takrorlar asl qator raqami bilan ko‘rsatiladi.
- Qidiruv, sinf/fan/chorak/holat filtrlari, qatorlar va import tarixini sahifalash. Tarix ro‘yxatiga to‘liq fayl qatorlari yuborilmaydi; tafsilot talab qilinganda olinadi.
- Sinf, biriktirilgan ustoz va xona bo‘yicha vaqt to‘qnashuvi. Saqlash va nashr qilishdan oldin qayta tekshiriladi. O‘qituvchi/xona kiritilmasa, aynan shu resurs to‘qnashuvini aniqlash mumkin emas.
- Qoralama → nashr; ish rejalarini arxivlash; importni qaytarish. Qaytarishdan oldin barcha yaratilgan yozuvlarning xeshi va bog‘liqliklari tekshiriladi. Keyin o‘zgartirilgan yozuvga avtomatik undo qo‘llanmaydi. Mavjud darslar ommaviy almashtirilmaydi.
- Har bir yozish/nashr/qaytarishga audit. Immutable snapshotlar oldingi holatni saqlaydi; import manifesti aynan qaysi yozuvlar yaratilganini belgilaydi.
- T sinflariga qo‘shimcha matematika alohida tasdiq bilan ochiladi; sinfning asosiy fanlari almashtirilmaydi.
- `/student/dashboard`: Toshkent vaqtidagi sana, bugungi jadval, muddati yaqin topshiriq/testlar, oxirgi ochilgan dars, mavjud haqiqiy progress va e’lonlar.
- `/student/tasks`: muddati bo‘yicha vazifalar va alohida topshiriq tafsiloti. Mavjud topshirish/test mexanizmlariga o‘tish.
- Beshta asosiy o‘quvchi bo‘limi: Bosh sahifa, Fanlar, Jadval, Vazifalar, Men. Ustoz navigatsiyasi o‘z paneliga olib boradi.

## Saqlash va xavfsizlik

- Preview Firestore maydoni: `_specialized_preview_stage1`; rasm maydoni ham preview bilan ajratilgan. Production maydoniga tushib qolgan preview server ishga tushmaydi.
- Branch uchun alohida shifrlangan SESSION_SECRET va namespace asosida HMAC. Production sessiyasi preview sessiyasi sifatida qabul qilinmaydi.
- API har so‘rovda rol, faol hisob, tasdiqlangan admin, maktab va sinfni tekshiradi. O‘quvchi/ustozga admin importi yopiq.
- Mustaqil imtihon javoblari, uy mashqi qoralamalari va oxirgi dars yozuvlari parallel saqlanganda uch tomonlama birlashtiriladi. Bir yozuvni ikki tomon o‘zgartirsa, 409 saqlanadi; ustidan yozib yuborilmaydi. Umumiy invariantli kontent yozuvlari ehtiyotkor ravishda qayta urinishni talab qiladi.
- XLSX va AI SDK server ishga tushishida emas, kerakli endpoint chaqirilganda yuklanadi. Yangi bosh sahifa katta StudentPages modulini yuklamaydi.

## Tekshiruv dalillari

- To‘liq to‘plam: 63 test o‘tdi. Keyingi sana formatlash tuzatishi uchun tegishli 6 test alohida o‘tdi; ulardan bittasi yangi sana testi.
- Vercel bundle: 2 test o‘tdi. Typecheck va build o‘tdi.
- Haqiqiy alohida preview’da Playwright: 375px va 1440px; admin yuklash/dry-run/xato qator/nashr, XLSX shablonlar, jadval to‘qnashuvi, sinf filtri, o‘quvchi jadvali, serverdagi oxirgi darsga o‘tish va undo tekshirildi. Brauzerda ushlanmagan JavaScript xatosi qayd etilmadi.
- Natijalar va skrinshotlar workspace `outputs/stage1-screens` ichida. Ular sintetik SINOV profillari bilan olingan.

## Chegaralar va keyingi tasdiq

- Firebase Authentication umumiy loyihaga tegishli. Yangi preview domeni authorizedDomains ro‘yxatida yo‘q. Haqiqiy Google orqali preview kirishini ochish uchun faqat preview domenini qo‘shishga foydalanuvchi ruxsati kerak; bu sozlama avtomatik o‘zgartirilmagan.
- Sovuq start uchun og‘ir importlar olib tashlandi. Ishlab turgan production’da qayta tezlik o‘lchovi qilinmadi; Firestore boshlang‘ich holati hali snapshot ko‘rinishida o‘qiladi, shuning uchun sovuq start butunlay yo‘qoldi deb da’vo qilinmaydi.
- Eski testlarning lokal qoralamalari 2-bosqichda savollar banki/mavzu testi bilan birga ko‘chiriladi yoki olib tashlanadi.
- 2-bosqich faqat foydalanuvchi tasdig‘idan keyin boshlanadi. Main/productionga merge yoki promotion qilinmaydi.

## Barqaror production

Majlis uchun production `4122490939d3bb6be21ad2dfa414a3dd7de20668` / `dpl_4ZWW8gTA3JwZPRaUGxFtdixDb42V` holatida qoladi. Pilotdan voz kechilsa, preview branch/deploydan foydalanmaslik yetarli; productionni rollback qilish shart emas.
