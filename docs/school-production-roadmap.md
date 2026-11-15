# Specialized Study — maktab production roadmap

Boshlanish: 2026-11-15. Branch: `codex/final-school-release`. Tasdiqlangan bazaviy commit: `fe5fea98e3eb6fe479830736deb269db7e825cce`.

Production haqiqat manbasi hozir Firebase; Supabase nusxasi va preview production o‘rnini bosmaydi. Haqiqiy credential berish, rahbariyat vakolati va production cutover alohida explicit tasdiqqacha bajarilmaydi.

| Bosqich | Holat | Rejalashtirilgan / amalga oshirilgan | Test va tekshiruv | Bog‘liqlik / xavf | Tasdiq va rollback |
|---|---|---|---|---|---|
| A — baseline | VERIFIED | Repository toza, oldingi SHA va preview mos; alohida branch ochildi | Oldingi 160 test va API/browser dalillari saqlangan | Production eski Firebase deploy | Oldingi branch/SHA saqlanadi |
| B — manbalar | IN PROGRESS | 426 o‘quvchi, 51 xodim, 115 fayl; deterministic production reconciliation tayyorlanmoqda | Oldingi manba hash/row hisobotlari qayta ishlatiladi | 39-qator F.I.Sh.; fan/sinf biriktirishlari, 92 varaq noaniq | Faqat authoritative correction; manbani qayta yozmaslik |
| C — hisoblar | IN PROGRESS | Tuzatish/reject/merge review queue, noyob login va xavfsiz paket | Synthetic account sinovlari; real hisob hali 0 | Owner credential-claim E2E, real import tasdig‘i | Foydalanilmagan yangi hisobni arxivlash; old UID/hash saqlanadi |
| D — o‘quv reja | IN PROGRESS | Mapping evidence, xavfsiz bulk approve, draft va coverage reconciliation | Oldingi draft/publish/undo sinovlari bor | 92 noaniq mapping; 9 bo‘sh mavzu | Noaniq yozuv nashr qilinmaydi; eski dars/natijalar saqlanadi |
| E — rahbariyat | IN PROGRESS | Direktor/O‘IBDO‘ matrix va MFA mavjud; identity review | Synthetic MFA va scope sinovlari o‘tgan | Owner hisob egalarini alohida tasdiqlaydi | Grant revoke + barcha sessiyalar revoke |
| F — baza | IN PROGRESS | Alohida staging loyiha `keobmngxrcrgsyxusytf`; backup/restore rehearsal bajarildi, hash va exact read-back tasdiqlandi | Fresh Firebase revision b27fcda8; 7 profil/19 sinf/2552 mavzu exact staging read-back | Shared Google identity, alohida data server key; production write fence hali yo‘q | Faqat rehearsal; actual freeze/cutover alohida tasdiq |
| G — UX/integratsiya | IN PROGRESS | Markaziy maktab ma’lumotlari, review dashboard, timetable tekshiruvi | Mobil 375px va asosiy role oqimlari qayta tekshiriladi | Dars jadvali berildi: Лист1 tanlangan; 2 xona to‘qnashuvi, guruhlar va ustoz initials mappingi tekshiruvda | Soxta jadval/natijalar qo‘yilmaydi |
| H — security/QA | IN PROGRESS | Preview SSO yoqilgan; vaqtinchalik share bekor; secret/rate/rules/CSP nazorati | Targeted → integration → release testlari | Google Branding tashqi verifikatsiya; 5 dev audit ogohlantirishi | Production konfiguratsiyasi tasdiqqacha saqlanadi |
| I — production | NOT STARTED | Code freeze → backup/restore → reconciliation → approval package | Final SHA va restore dalili bo‘lmaguncha release yo‘q | Explicit owner authorization zarur | Oldingi deploy, source va forward recovery rejasi |
| J — live tasdiq | NOT STARTED | Haqiqiy login/count/curriculum/exam va monitoring | Faqat approved release’dan keyin | I bosqichiga bog‘liq | Yangi yozuvlar reconcile qilinmasdan rollback qilinmaydi |

Har bosqichda acceptance: source → approved decision → DB counter → role ko‘rinishi mos kelishi; jim ma’lumot yo‘qolishi va dublikatga yo‘l qo‘yilmasligi. Dalillar va commitlar yakuniy release hisobotiga bog‘lanadi.

2026-11-15 yangilanish: alohida stagingda 426 o‘quvchi va 51 xodimning manbalari, 121 mazmunli varaqdagi 9493 mavzu yopiq review navbatiga joylandi. Haqiqiy yangi hisoblar 0, berilgan credentiallar 0. Лист1 va tasdiqlangan choraklar + uch yopiq kun stagingda saqlandi. `docs/academic-calendar-roadmap.md` bog‘liq ishlarning alohida acceptance ro‘yxatidir.
