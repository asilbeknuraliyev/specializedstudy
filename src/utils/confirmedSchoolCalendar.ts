import type {AcademicCalendar} from './academicPlanning';

/** Owner-confirmed school decisions, not inferred national holiday dates. */
export function confirmedSchoolCalendar(schoolId:string,approvedBy:string):AcademicCalendar {
 return {id:'calendar-2026-2027',schoolId,academicYear:'2026-2027',start:'2026-09-02',end:'2027-05-25',weekdays:[1,2,3,4,5],
  terms:[{number:1,start:'2026-09-02',end:'2026-11-03'},{number:2,start:'2026-11-10',end:'2026-12-25'},{number:3,start:'2027-01-11',end:'2027-03-19'},{number:4,start:'2027-03-29',end:'2027-05-25'}],
  exceptions:['2026-10-01','2026-12-08','2027-03-08'].map(date=>({id:'owner-closed-'+date,date,kind:'closed' as const,reason:'Maktab egasi chatda dars bo‘lmaydigan kun sifatida tasdiqlagan.'})),
  status:'approved',revision:1,source:'Maktab egasi tasdiqlagan 2026–2027 choraklari, dushanba–juma va uch istisno kuni. Boshqa istisnolar tasdiqlangach kiritiladi.',approvedBy,approvedAt:new Date().toISOString()};
}
