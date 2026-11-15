# Akademik taqvim, jadval va ish reja — 2026–2027

Branch: `codex/final-school-release`. Ushbu hujjat bajarilgan ishni rejalashtirilgan ishdan ajratadi. Production cutover va haqiqiy credential berish oxirgi maktab release topshirig‘idagi alohida tasdiq chegarasida qoladi.

## Tasdiqlangan maktab qarorlari

- Asosiy Excel varag‘i: **Лист1**. `Jadval` muqobil manba sifatida saqlanadi; 227 guruh/dars yozuvidagi farq ko‘rsatiladi.
- I chorak: 2026-09-02–2026-11-03; II: 2026-11-10–2026-12-25.
- III chorak: 2027-01-11–2027-03-19; IV: 2027-03-29–2027-05-25.
- Dushanba–juma. Alohida yopiq kunlar: **2026-10-01, 2026-12-08, 2027-03-08**.
- Hayit, ko‘chirilgan dam olishlar yoki boshqa maktab istisnolari taxmin qilinmaydi.
- Vaqt zonasi Asia/Tashkent; sana arifmetikasi UTC date-only orqali bajariladi.

| Bosqich | Holat | Natija va dalil | Qolgan tekshiruv / tasdiq |
|---|---|---|---|
| 1. Manba inventarizatsiyasi | VERIFIED | Ikki varaq, 19 sinf, 932/937 mashg‘ulot, 612 guruhli yozuv. Hash va katak manbasi saqlanadi; `source-reconciliation.json` | Лист1dagi ikki xona to‘qnashuvining haqiqiy yechimi kerak |
| 2. Taqvim | IMPLEMENTED + UNIT VERIFIED | Tasdiqlangan choraklar va 3 yopiq kun; versiya/revision, tarix, qo‘shimcha kun va sinf/dars istisnolari | Yangi maktab istisnolari kelganda alohida tasdiq |
| 3. Jadval va guruhlar | IMPLEMENTED | Varaq farqlari, amal sanalari, tuzatish tarixi, fan aliasi/sohasi, guruh tarkibi; oddiy o‘quvchiga boshqa guruh yo‘q | Guruh a’zolari manbada yo‘q; taxminiy taqsimlash taqiqlangan |
| 4. Sanalashtirish | IMPLEMENTED + SQL/UNIT VERIFIED | Haqiqiy dars oynalari, ko‘p/yarim soatli mavzular, sig‘im va yetishmovchilik, versiyali preview/publish, tarixni saqlaydigan qayta rejalash | 92 noaniq ish reja mappingi; faqat nashr qilingan mavzu sanaga biriktiriladi |
| 5. Ustoz ishlari | IMPLEMENTED + API VERIFIED | Kun/hafta, haqiqiy mavzu va o‘tildi tasdig‘i, homework/eslatma, ko‘chirish diff/tasdiq, guruhli davomat va vazifa mavjud modelda | Haqiqiy ustoz–fan–sinf biriktirishlari owner tomonidan tasdiqlanadi |
| 6. O‘quvchi va admin UX | IMPLEMENTED; BROWSER QA PENDING | Kun/hafta/oy/yil, rang + matnli holat, roadmap, admin source/conflict/mapping/group oynalari | 375px/tablet/desktop dalili release hisobotiga qo‘shiladi |
| 7. Saqlash va xavfsizlik | SQL VERIFIED; STAGING APPLIED | Mustaqil private occurrence jadvallari, bounded sahifalash, kichik read-only kunlik auth context, service-only RPC, CAS, idempotency, old preview’dan publish rad etiladi | Hosted API/rol/browser QA yakuniy dalili kutilmoqda |
| 8. Release | PREVIEW PREPARATION | Alohida Supabase staging va branch; production haqiqiy ma’lumot manbasi Firebase bo‘lib qoladi | Owner Google credential-claim E2E va yakuniy production tasdig‘i |

## Ma’lumot holati va chegaralar

`approved_source` jadvaldagi barcha ustoz, fan yoki xona mappingi tasdiqlandi degani emas. 932 manba mashg‘ulotidan 63 tasida xodimlar ro‘yxati bilan aniq initials mosligi yo‘q; ular qo‘lda tekshiriladi. Aniq mos kelgan initials ham o‘z-o‘zidan hisobga huquq bermaydi.

Ish rejasini import qilish, darsni rejalash, ustozning darsni o‘tildi deb tasdiqlashi va o‘quvchining o‘zlashtirishi to‘rtta alohida dalildir. O‘tgan sana o‘z-o‘zidan `taught` bo‘lmaydi. Eski rejalangan, ammo tasdiqlanmagan darslar qayta rejalashda saqlanadi va alohida hisoblanadi.

Sanalashtirilgan yozuvlar umumiy runtime snapshot ichiga qo‘shilmaydi. Preview yozuvlari 500 tadan, ko‘rish 50 tadan, kunlik agenda 100 tadan cursor bilan olinadi. Yangi jadvalni nashr qilishda old head va mutation revision tekshiriladi; preview’dan keyingi ustoz o‘zgarishi yo‘qolmaydi. Ko‘chirish actor/schoolga bog‘langan 10 daqiqalik shifrlangan taklifdan atomik bajariladi; eski holat audit eventda qoladi.

## Rollback va foydalanish

Productionga chiqarmasdan preview aliasni oldingi previewga qaytarish mumkin. Faol akademik batch arxivlanadi, yozuvlar o‘chirilmaydi. Yangi davomat, vazifa yoki o‘tildi tasdig‘idan keyin eski batchga ko‘r-ko‘rona qaytish taqiqlanadi: eventlar va ikkala batch saqlanib, forward reconciliation qilinadi.

Maktab manbalari `study-private` yopiq omborida shifrlangan. Vaqtinchalik sintetik QA hisoblari va alohida test batchlari ish oxirida tozalanadi; haqiqiy tekshiruv navbati o‘chirilmaydi. Backup/restore dalili `outputs/school-final-release-2026-11-15/restore-rehearsal.json`da (workspace outputs, gitga qo‘shilmaydi).
