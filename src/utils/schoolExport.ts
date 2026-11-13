import { safeExportText } from "./topicAnalysisExport";
export const escapeSchoolHtml = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function schoolExcel(
  title: string,
  headers: string[],
  rows: unknown[][],
) {
  const X = await import("xlsx"),
    wb = X.utils.book_new();
  X.utils.book_append_sheet(
    wb,
    X.utils.aoa_to_sheet([headers, ...rows].map((r) => r.map(safeExportText))),
    "Hisobot",
  );
  const b = X.write(wb, { type: "array", bookType: "xlsx" }),
    url = URL.createObjectURL(
      new Blob([b], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = title + ".xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function schoolPrintHtml(
  title: string,
  body: string,
  status = "Hisobot",
) {
  return (
    '<!doctype html><html lang="uz"><meta charset="utf-8"><title>' +
    escapeSchoolHtml(title) +
    "</title><style>@page{size:A4;margin:18mm}body{font:14px/1.8 system-ui;color:#15233a}h1{font-size:24px}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}.status{border:1px solid #ccd8eb;padding:10px;font-weight:600}footer{margin-top:40px;font-size:11px;color:#567}</style><h1>" +
    escapeSchoolHtml(title) +
    '</h1><p class="status">' +
    escapeSchoolHtml(status) +
    "</p><pre>" +
    escapeSchoolHtml(body) +
    "</pre><footer>Specialized Study · vakolatli foydalanish uchun. Qaror faqat vakolatli xodim tomonidan qabul qilinadi.</footer></html>"
  );
}
export function openSchoolPrint(
  popup: Window | null,
  title: string,
  body: string,
  status?: string,
) {
  if (!popup) throw Error("Hisobot oynasiga ruxsat bering.");
  popup.opener = null;
  popup.document.write(schoolPrintHtml(title, body, status));
  popup.document.close();
  setTimeout(() => popup.print(), 300);
}
export function tashkentInput(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tashkent",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
