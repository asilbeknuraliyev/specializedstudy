export interface ExamDraft {
  key: string;
  scope: string;
  clientId: string;
  answers: Record<string, string>;
  updatedAt: number;
  pending?: any;
  finish?: any;
  events?: any[];
}
function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("ss-private-exam-drafts-v2", 1);
    r.onupgradeneeded = () => {
      const s = r.result.createObjectStore("drafts", { keyPath: "key" });
      s.createIndex("scope", "scope");
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function request<T>(
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("drafts", mode),
        r = action(tx.objectStore("drafts"));
      let result: T;
      r.onsuccess = () => {
        result = r.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export const writeExamDraft = (draft: ExamDraft) =>
  request("readwrite", (s) => s.put(draft));
export const removeExamDraft = (key: string) =>
  request("readwrite", (s) => s.delete(key));
export async function examDrafts(scope: string) {
  const rows = await request<ExamDraft[]>("readonly", (s) =>
    s.index("scope").getAll(scope),
  );
  const threshold = Date.now() - 7 * 86400000;
  for (const r of rows)
    if (r.updatedAt < threshold) await removeExamDraft(r.key);
  return rows
    .filter((r) => r.updatedAt >= threshold)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
