export type CredentialWorkbookRow = {
  uid?: string;
  role?: string;
  createdAt?: string;
  status?: string;
  mustChangePassword?: boolean;
  displayName?: string;
  login: string;
  password: string;
  classCode?: string;
  subject?: string;
  position?: string;
};

export async function createCredentialWorkbook(rows: CredentialWorkbookRow[], passphrase: string) {
  if (!rows.length || rows.length > 1000) throw Error('Eksport uchun kirish kartochkalari topilmadi.');
  if (passphrase.length < 16 || passphrase.length > 256) {
    throw Error('Excel fayli uchun 16–256 belgili alohida parol kiriting.');
  }
  const { default: xlsx } = await import('xlsx-populate/browser/xlsx-populate.min.js');
  const workbook = await xlsx.fromBlankAsync();
  const groups = new Map<string, CredentialWorkbookRow[]>();
  for (const row of rows) {
    const name = row.classCode ? row.classCode.toUpperCase() : row.role === 'teacher' ? 'O‘qituvchilar' : 'Xodimlar';
    const group = groups.get(name) ?? [];
    group.push(row);
    groups.set(name, group);
  }
  let first = true;
  for (const [name, group] of [...groups].sort(([a], [b]) => a.localeCompare(b, 'uz', {numeric:true}))) {
    const sheet = first ? workbook.sheet(0).name(name) : workbook.addSheet(name);
    first = false;
    const values = [
      ['ID', 'F.I.Sh.', 'Sinf', 'Rol', 'Login', 'Boshlang‘ich parol', 'Hisob holati', 'Faollashtirish holati', 'Yaratilgan sana'],
      ...group.map(row => [row.uid ?? '', row.displayName ?? '', row.classCode?.toUpperCase() ?? '',
        row.role === 'teacher' ? 'O‘qituvchi' : row.classCode ? 'O‘quvchi' : 'Xodim', row.login, row.password,
        row.status === 'active' ? 'Faol' : row.status ?? '', row.mustChangePassword ? 'Birinchi kirish kutilmoqda' : '', row.createdAt ?? '']),
    ];
    sheet.range(1, 1, values.length, 9).value(values);
    sheet.range('A1:I1').style({bold:true,fill:'1D4ED8',fontColor:'FFFFFF'});
    [45,42,12,18,32,48,22,30,28].forEach((width,i)=>sheet.column(i+1).width(width));
  }
  return workbook.outputAsync({ type: 'blob', password: passphrase });
}
