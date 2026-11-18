# Specialized Study 3.0

2026-11-18. Ishchi branch `codex/specialized-study-3`. [Staging preview](https://specializedstudy-74m6xgil2-asilbeknuraliyev43-langs-projects.vercel.app). Ushbu deployment kodi `a46a7e1`. Quyidagi mezonlar production uchun ham bajarilganda bosqich yopiladi.

| Bosqich va holat | Qabul mezoni | Sinov va commit | To‘siq va navbatdagi amal |
| --- | --- | --- | --- |
| A · qisman | Har bir tasdiqlangan yozuv bitta Auth identifikatoriga bog‘langan, eksport va birinchi parol almashishi tekshirilgan | 450 hisobli sintetik rotatsiya, MFA, takroriy claim va idempotentlik. `2a8123e` | 426 o‘quvchi va 24 o‘qituvchi birinchi parolni yangilashni kutmoqda. Operator manifestni qayta solishtiradi, zaxiradan tiklashni va relizni tasdiqlaydi. |
| B · qisman | Har safar bitta savol, tiklanadigan javoblar, topshirish tasdig‘i | Mavjud formal va mashq playerlari, revision va autosave API sinovlari. Umumiy progress `42ca19b` | Staging brauzerida ikki tab, oflayn yozish, refresh va yakuniy receiptni bir oqimda tekshirish. |
| C · qisman | Har bir varaq hisobga olingan, savol va izoh manbaga bog‘langan, ustoz tasdiqlaydi | Parser va uchta savolning javob tekshiruvi. `42ca19b`, `44ea846` | Ustoz tanlangan dars savollar bankiga pilot JSON faylini yuklaydi, manba mosligini tekshiradi va tasdiqlaydi. |
| D · qisman | O‘quvchi, ustoz va admin asosiy vazifalarini mobil va klaviatura orqali bajaradi | Mavjud StudentHome, TopicQuestionEditor va yangi admin qamrov sahifasi. `42ca19b` | 360 px da rollar bo‘yicha yangilangan interfeysni sinash. Interaktiv dars kutubxonasi to‘liq tayyorlanishi kerak. |
| E · mavjud modullar | Xato va qayta urinish tavsiyani o‘zgartiradi | Mavjud spacedReview, xatolar daftari va topic-progress. Unit sinovlari o‘tdi. Alohida yangi commit yo‘q. | Diagnostikadan tavsiyagacha bo‘lgan oqimni brauzerda tekshirish. |
| F · pilot | Fan mutaxassisi tasdiqlagan paket savollar xilma-xilligi va mazmunini saqlaydi | Mahalliy pilot ketma-ket 1, 2 va 0 ta yangi qoralama berdi. `42ca19b`, `44ea846` | Uch qoralamani ustozga taqdim etish. Semantik dublikatlar, kvotalar va masofaviy ish navbati keyingi bosqichda. |
| G · qisman | Restore, izolyatsiya, unumdorlik, accessibility va E2E dalillari yig‘ilgan | TypeScript, build, 175 unit/API (pilot bilan), 2 server smoke va 2 PostgreSQL testi o‘tdi. `a46a7e1` | Yangi buildning to‘liq brauzer regressiyasi, zaxira va release approval kutilmoqda. |

## Manbalar va qayta ishlash

Berilgan `Ish rejalar 2026-2027.zip` SHA-256 qiymati `c9a9330c231c7a08d065fd0606b58bf261ca7eb467785d0bdf5eadeb0a23f4d7`. 14 asosiy fan papkasi, 115 XLSX, 127 varaq va 9 493 ajratilgan mavzu qatori bor. 6 ta varaqdan mavzu chiqmadi, parser 9 ta ogohlantirish berdi. Yo‘nalish va sinfga bog‘lash masalalari har varaqda alohida qayd etilgan. Qamrov sahifasi `/admin/curriculum-coverage` da. U arxiv versiyasidagi manba qatorlarini sanaydi. Uch sinov savoli matematika, fizika va informatikaga tegishli. Ustoz tasdiqlagan yoki nashrga chiqqan pilot savollar soni 0.

```sh
npx --no-install tsx scripts/inspectCurriculum.ts "<manba.zip>" "<inventar.json>" src/data/curriculumCoverage.json
npx --no-install tsx scripts/contentBatch.ts "<inventar.json>" "<qoralamalar-papkasi>" 3
```

Bir xil inventar va shablon qayta ishlanganda oldingi savol takror yaratilmaydi. O‘quvchi va xodimlar manbalarining aynan so‘ralgan `o'quvchilar.xlsx` va `ustozlar.xlsx` nusxalari Downloads ichidan topilmadi. Jadval fayli mavjud. Yangi hisob yaratish uchun avvalgi importning tasdiqlangan manifestlari va joriy identifikatorlar qayta solishtiriladi.

## Release holati

Production’da bu ish doirasida yaratilgan, qayta faollashtirilgan yoki credentiali almashtirilgan hisoblar soni 0. Real credential fayli chiqarilmadi. Yangi indeks migratsiyasi lokal PostgreSQL sinovidan o‘tdi va Supabase staging bazasida qo‘llanib, qayta tekshirildi. Owner MFA va yangi Google tasdig‘i orqali olinadigan eksport o‘quvchilarni sinf bo‘yicha, ustozlarni alohida varaqqa joylaydi. Faol rahbariyat vakolatidagi hisoblar umumiy paketdan chiqariladi. Rahbariyat uchun yangi alohida eksport hali tayyorlanmagan.

Oldingi production auditining tafsilotlari `docs/specialized-study-2-roadmap.md` da. Uch fan bo‘yicha pilot natijalari, shifrlangan sinf eksporti va qamrov sahifasi shu relizning o‘zgarishlaridir. Pullik provayder ishlatilmadi.


[Reliz hisoboti](./specialized-study-3-release.md)
