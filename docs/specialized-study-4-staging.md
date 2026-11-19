# 4.0 staging dalillari · 2026-11-19

[Himoyalangan staging preview](https://specializedstudy-kvzexyyml-asilbeknuraliyev43-langs-projects.vercel.app) · [Kontent operatsiyalari](https://specializedstudy-kvzexyyml-asilbeknuraliyev43-langs-projects.vercel.app/admin/content-operations) · [Ustoz savollar banki](https://specializedstudy-kvzexyyml-asilbeknuraliyev43-langs-projects.vercel.app/teacher/topic-bank)

## Kirish

Production `specializedschool.vercel.app` da credentialsiz login POST ilovadan 400 qaytardi. Sessiyasiz state so‘rovi ilovadan 401 `LOGIN_REQUIRED` qaytardi. Himoyalangan preview’da credentialsiz login POST Vercel qatlamida 401 `Protected deployment` qaytaradi. Production’da ikkita faol, tasdiqlangan platforma egasi va alohida admin roli bilan 0 profil topildi.

`c8f6a05` owner va maktab doirasidagi rolni alohida yo‘naltirdi, tasdiqlanmagan admin uchun barqaror kirish holatini qo‘shdi va Supabase callback’ni serverdagi owner konfiguratsiyasi bilan moslashtirdi. Grant asosidagi maktab administratori MFA orqali `/school-admin/dashboard` ga kiradi. Lokal Playwright’da owner, MFA’li maktab administratori, ustoz, o‘quvchi, noto‘g‘ri parol, bevosita admin URL, refresh va logout o‘tdi. Jonli Google callback uchun vakolatli egasi o‘z Google hisobida kirishi kerak. Parol, token va MFA kodini hisobotga kiritmang. Xato bo‘lsa, javob statusi va X-Request-Id yetarli.

## Inventar va taqvim

- Supabase staging’da 115 ish kitobi, 127 varaqqa tegishli 9 493 satr. 7 848 normalizatsiya kaliti va 4 620 o‘qitish mavzusi nomzodi.
- 1 866 satr mavjud fan hamda sinf identifikatorlariga mos tushdi. 13 ta sinf ushbu mosliklarda qatnashdi. 7 627 satrda fan yoki sinf mosligi qolmoqda.
- Rasmiy `Лист1` fayli tasdiqlangan SHA-256 qiymatga mos. 19 sinf, 932 haftalik slot, 612 guruh sloti va 2 to‘qnashuv aniqlandi. Production’da faol sanalangan 2026–2027 paketida 0 occurrence, 2 552 tarixiy dars saqlangan.

## Savollar

Supabase staging `pg_cron` ishchisi matematika, fizika va informatika uchun 3 × 10 savolni taqrizga olib chiqdi. 30 tekshirilgan savoldan 23 tasi yangi, 7 tasi mavjud qoralama bilan bog‘landi. Bank jami 53 savol. Joriy paketlarda xatoli ish 0, ustoz tasdiqlagan 0, nashr qilingan 0. Birinchi maqsad 140, keyingi 100 mavzuli batch boshlanmagan. Navbat muharrir tayyorlagan paketlarni atomar tekshiradi va yozadi. Avtomatik generator ulanganida tekshiruv va sarf nazorati uchun alohida ish kerak.

Kod preview’da `c0cec9dd01d7f2942ff42f3a4b6a5a7add72cd71`. TypeScript, Vite va Express, 178 unit/API sinovi, Vercel handler smoke va lokal PostgreSQL migratsiya sinovlari o‘tdi. Production relizi uchun tasdiqlangan backup/restore, ruxsatli egasi bilan brauzer sinovi, jadval to‘qnashuvlarini ko‘rib chiqish va ustoz taqrizi talab qilinadi.
