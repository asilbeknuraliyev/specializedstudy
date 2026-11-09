# 1.5-bosqich: preview tekshiruvi

Production branch/deployga o‘zgarish yuborilmadi. Ish branchi: `codex/pilot-stage1`.

## O‘lchovlar

Bosishdan birinchi ko‘rinadigan natijagacha, Chrome/Playwright. Oldin mavjud bo‘lmagan yangi oqimlarga oldingi vaqt to‘qilmadi. Bir martalik o‘lchovlar, kafolatlangan tezlik mezoni emas.

| Amal | Oldin, ms | Keyin, ms | Sabab / yechim |
|---|---:|---:|---|
| Admin: kontent markaziga oâ€˜tish | Yangi | 1419 | Lazy modul va React render |
| Ustoz: tezkor qidiruv | Yangi | 987 | 200 ms debounce va sinf boâ€˜yicha cheklangan server qidiruvi |
| Oâ€˜quvchi: bugungi mashqni ochish | Yangi | 901 | Lazy DEMO modul va mavjud Firestore mashqini oâ€˜qish |
| Admin: DEMO yaratish | Yangi | 898 | 3 fan, 6 mavzu, 72 savol va parol xeshlarini saqlash |
| Admin: qidiruv oynasi | 144 | 593 | Mahalliy interfeys holati |
| Admin: DEMO o‘chirish | Yangi | 497 | DEMO yozuvlarini olib tashlash va Firestore commit |
| Ustoz: ballni saqlash | Yangi | 458 | Bitta server yozuvi; ortiqcha GET olib tashlangan |
| Oâ€˜quvchi: topshirish va natija | Yangi | 440 | Server baholashi va Firestore commit |
| Oâ€˜quvchi: ustoz natijasini olish | Yangi | 433 | Yangi qurilma kontekstidan Firestore oâ€˜qish |
| Admin: profil menyusi | Yangi | 298 | Mahalliy interfeys holati |

Oddiy o‘lchangan amallar: 101–987 ms. Birinchi kontent sahifasiga o‘tish: 1419 ms (oldin 1099 ms); qidiruv oynasi 593 ms (oldin 144 ms). Bu ikki amalda tezlashish da’vo qilinmaydi; ikkalasi ham belgilangan 1–2 s / 1 s chegarasida.

## Tekshirildi

- Uch rol, 375px va 1440px. Profil yuqorida, ustozning sinfi menyuda ko‘rinadi; SPA headeri bo‘limlar orasida saqlanadi. Chiqish tasdiqsiz ishlaydi.
- Brauzer orqaga tugmasida ro‘yxat filtri va skroll holati saqlanishi tekshirildi.
- Qoralama ikkinchi qurilma kontekstida Firestore’dan o‘qildi.
- Telefonda va kompyuterda mashq topshirildi: avtomatik 10/10, yozma ish Tekshiruvda.
- Ustoz 2/2 qo‘ydi va izoh o‘quvchida ko‘rindi.
- DEMO o‘chirish jonli tekshirildi; QA natijalari tozalandi. Hozir 12 ta yangi, javoblari bo‘sh DEMO mashq qoldirilgan.
- Brauzerda ushlanmagan JavaScript xatosi: 0.

## Xavfsiz kirish

O‘z tasdiqlangan Google hisobingiz bilan preview’ga kiring. Admin → DEMO sinf → **DEMO parollarini yangilash**. Login va yangi parollar faqat shu himoyalangan oynada ko‘rsatiladi; parollar hisobot yoki GitHubga yozilmagan. `demo-accounts.json` faylida faqat login nomlari bor. Parolni yangilash eski DEMO sessiyalarini bekor qiladi.

## Chegaralar

- Yozma tekshiruvning bu turi faqat DEMO uchun. Haqiqiy ustoz yozma ish moduli umumiy 3-bosqichga tegishli.
- Umumiy savollar banki, haqiqiy mavzu testi va takrorlash tizimi boshlanmadi.
- Fullscreen nazorat sessiyasi va PDF/Word import tekshiruvi alohida murakkab ekran sifatida saqlandi. Oddiy bo‘limlar React Router orqali ochiladi.
- Import fayllari, rasmli savolning koordinatalari va real imtihon mexanizmi ushbu UI ishida qayta qurilmadi.
- Asosiy sahifalar tekshirildi; barcha eski sahifalarda piksel darajasida to‘liq vizual audit o‘tkazildi deb da’vo qilinmaydi.

## Skrinshotlar

Mahalliy Codex workspace’da `outputs/stage15/review.html` barcha rasmlarni va vaqtlar jadvalini bir joyda ochadi. Rasmlar GitHub repozitoriyiga yuklanmagan.

| Rol | Telefon | Kompyuter |
|---|---|---|
| Admin | `admin-main-375.png` | `admin-main-1440.png` |
| Ustoz | `teacher-main-375.png` | `teacher-main-1440.png` |
| O‘quvchi | `student-main-375.png` | `student-main-1440.png` |

2-bosqich faqat foydalanuvchi alohida ruxsat berganda boshlanadi.
## Kod va tekshiruvlar

Asosiy kod commit: `0fccb22`. 10 ta tegishli test (yangi DEMO/jadval testlari va o‘zgargan bosh sahifa/import chegaralari), 2 ta server bundle tekshiruvi, typecheck va build o‘tdi.

O‘zgargan asosiy qismlar: AppShell/PanelNavigation, DesignSystem/ResponsiveTable, sakkizta eski jadval ekrani, usePageState/useRouteScroll, DemoPanel, demoRoutes/demoLabEngine, institutionView va studentHomeRoutes.
