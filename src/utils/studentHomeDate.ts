export function formatStudentDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {timeZone:'Asia/Tashkent', day:'numeric', month:'numeric'}).formatToParts(date);
  const months = ['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr'];
  const day = parts.find(p=>p.type==='day')?.value || '';
  const month = Number(parts.find(p=>p.type==='month')?.value);
  return `${day}-${months[month-1]}`;
}
