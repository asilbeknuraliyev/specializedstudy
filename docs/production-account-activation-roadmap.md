# Production hisoblarini faollashtirish

2026-yil 16-noyabr. Ish branch’i `codex/production-account-activation`. Production bazasi `bktrtjghtvkacybxegtd`, amaldagi reliz `d19dc7d1935e5e66c99978d23e75b5387a8f7f0f`.

| Bosqich | Holat | Dalil, xatar va keyingi amal |
|---|---|---|
| A. Production tekshiruvi | VERIFIED | Supabase’da 7 profil, 19 sinf, 2 552 dars, 3 imtihon va 1 topshirish. 3 Supabase Auth identifikatori mavjud profillarga mos. |
| B. Manbani solishtirish | VERIFIED / REVIEW | 426 o‘quvchi 19 sinfga mos. Aniqlangan dublikat 0. Xodimlar manbasi 51 qator, 50 tasi F.I.Sh. shaklidan o‘tdi. 44 ustoz belgisi dastlabki tasnif. Fan va sinf vakolatlari alohida tasdiqlanadi. |
| C. Credential tayyorlash | TESTED | 426 sintetik o‘quvchi va 51 sintetik xodim paroli noyob. `sps-` prefiksi va CSPRNG. Haqiqiy credentiallar faqat tasdiqlangan yozuvdan keyin yaratiladi. |
| D. Staging | TESTED | Alohida loyiha bitta sintetik Auth identifikatorini yaratdi, qayta urinish mavjud IDni qaytardi, test identifikatori tozalandi. Express testida MFA, pending profil, link va claim tekshirildi. To‘liq 426 profilni hostingda sinash alohida dalil talab qiladi. |
| E. Xavfsizlik | TESTED | 9/9 yopiq jadvalda RLS. Brauzer rollari uchun ochiq `study_*` RPC 0. Tasdiqlangan review versiyasi, MFA va yangi Google isboti. Native username paroli serverda xeshlanadi. Supabase’dagi boshqariladigan aliasga parol berilmaydi va alias band holatda saqlanadi. |
| F. Tasdiq | PENDING | 426 o‘quvchi yozuvining egasi tasdiqlanadi. Xodimlarning fan/sinf vakolatlari va rahbariyat shaxsi alohida tekshiriladi. |
| G. Production yaratish | PENDING | Tasdiqlangan import. Avval faollashtirish kutiladigan profil va shifrlangan paket saqlanadi. Auth link alohida 12 tadan yuradi. Takroriy so‘rov bir xil Auth ID bilan ishlaydi. |
| H. Tarqatish | PENDING | Owner MFA va 5 daqiqadan yangi Google isboti bilan bir martalik paketni oladi. Paket 24 soat. Birinchi parol 7 kun. Shaxs tekshirilgach reset avvalgi sessiyalarni bekor qiladi. |
| I. Haqiqiy kirish | PENDING | Owner o‘z Google/MFA oqimini, tasdiqlangan foydalanuvchilar esa o‘z hisoblarini tekshiradi. |
| J. Yakuniy tayyorlik | PENDING | Aktivatsiya sonlari, sinf topshiriqlari, jadval va nashr qilingan mavzular haqiqiy profillar bilan tekshiriladi. 9 493 mavzu ko‘rib chiqish navbatida. |

O‘quvchi loginlari `st.<sinf>.<raqam>` shaklida. Xodimlar uchun ism, familiya va kerak bo‘lsa raqamli qo‘shimcha ishlatiladi. Har bir profil source reference va deterministik UID orqali importiga bog‘langan. Auth link mavjud bo‘lmaguncha native kirish bloklanadi. Link’dan keyin birinchi parol o‘zgartirilganda aktivatsiya bajarilgan hisoblanadi.

Obid Quldoshev va Shodiyev Navruzbek ismlarining manba bo‘yicha to‘liq mosligi topilmadi. Lavozimga mos qatorlar mavjud. Rahbariyat vakolati shaxs dalili va alohida owner tasdig‘idan keyin tayinlanadi.

Xavfsiz qaytish uchun tasdiqlangan batchgina arxivlanadi va sessiyalar bekor qilinadi. Hisobdan foydalanish yoki topshiriq bor bo‘lsa, arxiv amali akademik tarixni saqlaydigan alohida ko‘rib chiqishga o‘tadi. Auth yozuvining bekor qilingan aliasi kirishga yopiq qoladi. Mavjud 7 profil va imtihon tarixiga amallar alohida saqlanadi.

Sonlar dalili `outputs/account-activation-2026-11-16/production-readiness.json` faylida. Qayta tiklash dalili faqat mustaqil PostgreSQL taqqoslovi muvaffaqiyatli ishlagandan keyin qo‘shiladi. Release commit va deploy identifikatori faqat tekshirilgan build uchun hisobotga kiritiladi.
