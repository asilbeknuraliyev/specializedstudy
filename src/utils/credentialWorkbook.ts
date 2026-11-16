export type CredentialWorkbookRow = {
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
  const sheet = workbook.sheet(0).name('Kirish kodlari');
  const values = [
    ['F.I.Sh.', 'Sinf', 'Fan yoki lavozim', 'Login', 'Boshlang‘ich parol'],
    ...rows.map(row => [
      row.displayName ?? '',
      row.classCode?.toUpperCase() ?? '',
      row.subject || row.position || '',
      row.login,
      row.password,
    ]),
  ];
  sheet.range(1, 1, values.length, values[0].length).value(values);
  sheet.range('A1:E1').style({ bold: true, fill: '1D4ED8', fontColor: 'FFFFFF' });
  [46, 12, 34, 35, 44].forEach((width, index) => sheet.column(index + 1).width(width));
  return workbook.outputAsync({ type: 'blob', password: passphrase });
}
