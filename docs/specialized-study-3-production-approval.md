# 3.0 production tasdiqlash paketi

## Tayyorlangan reliz

Kod `a05e43989ddd46b8fabf20a9fa6c99617bcf609d`. [Staging preview](https://specializedstudy-1aa5wenaz-asilbeknuraliyev43-langs-projects.vercel.app). Kirish sahifasi va health endpoint HTTP 200. TypeScript, build va 175 unit hamda API testi o‘tdi.

PracticeRunner shu tabda qurilmaga qoralama saqlaydi, aloqani tiklaganda yuborishga qayta urinadi va topshirishdan keyin server tasdig‘ini ko‘rsatadi. Boshqa tab serverdagi javobni o‘zgartirganida solishtirish oynasi ochiladi. Staging brauzer testida Vercel login POST so‘roviga `401 Protected deployment` qaytardi. Jonli mashq, formal imtihon, mobil accessibility va to‘liq reliz regressiyasi ochiq.

## Production hisoblari

| Rol | Profil | Bog‘langan Auth hisobi | Birinchi parol kutilmoqda | Import aktivatsiyasi yakunlandi |
| --- | ---: | ---: | ---: | ---: |
| O‘quvchi | 429 | 427 | 426 | 0 |
| O‘qituvchi | 26 | 24 | 24 | 0 |

Tasdiqlangan ikkita manifestning manba digestlari production import yozuvlariga mos. Import bo‘yicha 426 o‘quvchi va 24 ustozning barchasida alohida, mavjud Supabase Auth yozuvi bor. Ilovadagi native login va tashqi Supabase parol loginlari alohida. Barcha import Auth yozuvlarida parol orqali bevosita provayder kirishi bloklangan. Bu `managedSchoolIdentity.ts` dagi import konfiguratsiyasiga mos.

Auth bog‘lanishi yo‘q ikki o‘quvchi faol, ikkisida ham oldingi kirish qaydi yo‘q. Auth bog‘lanishi yo‘q ikki o‘qituvchi to‘xtatilgan va ikkala profilda avvalgi kirish qaydi bor. To‘rttasi ham tasdiqlangan importdan tashqarida. Yetti eski profilga ushbu bulk amal ta’sir qilmaydi.

Kirish qaydi bor 20 o‘quvchidan 19 tasi import tarkibida. Serverga qo‘shilgan himoya ularning kirish ma’lumotlarini ommaviy rotatsiyadan chiqaradi. Agar joriy holat saqlansa, alohida owner tasdig‘idan so‘ng ko‘pi bilan 407 o‘quvchi va 24 ustoz ko‘rib chiqiladi. 19 o‘quvchining birinchi parol amalini shaxsiy kirishi orqali yakunlash yoki individual yordam masalasi alohida tasdiqlanadi.

Ushbu ish doirasida real hisob yaratildi **0**, real credential chiqarildi **0**, yetkazildi **0**. Production’dagi 9 ta yopiq runtime jadvalining barchasida RLS yoqilgan. MFA va yangi Google tasdig‘i lokal regressiyada tekshirildi. Vakolatli owner bilan jonli MFA va credential claim sinovi kutilmoqda.

## Zaxira va tasdiq

2026-11-16 dagi zaxira dalilida 2 969 runtime yozuvining lokal PostgreSQL’ga aynan tiklangani qayd etilgan. Joriy reliz uchun amaldagi backup va Auth hamda yopiq Storage bilan to‘liq restore dalili talab qilinadi.

1. Joriy backup versiyasini tasdiqlash va izolyatsiyalangan muhitga tiklash. Runtime, provayder identifikatorlari va yopiq Storage natijalarini agregat bo‘yicha solishtirish.
2. Vakolatli maktab administratori aniq commit va joriy hisoblar sonini ko‘rib chiqib, rotatsiya hamda eksportni tasdiqlashi.
3. Owner o‘z sessiyasida MFA va yangi Google tasdig‘ini bajarishi, Office-shifrlangan XLSX’ni olishi va har bir hisob egasiga credentialni individual yetkazishi. Fayl parolini alohida xavfsiz kanal orqali yuborishi.
4. Chiqarilgan, yetkazilgan va faollashgan credential sonlarini mustaqil qayd etish. Importdan tashqaridagi yetti profil va avval kirgan o‘quvchilarni qayta solishtirish.

## Kontent

9 493 manba qatori, 115 fayl, 127 varaq va 14 ta fan papkasi inventari saqlangan. Uch fan bo‘yicha uch qoralama tegishli manba qatoriga bog‘langan. Ustoz tasdig‘i va nashrga chiqqan pilot savollar soni 0. To‘liq pilot paketlar, semantik dublikat tahlili va server navbati ishlab chiqilishi kerak.
