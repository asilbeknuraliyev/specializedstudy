import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { getFirestore, FieldPath } from "firebase-admin/firestore";
import { runtimeNamespace } from "../src/server/runtimeScope";
import {
  getFirebaseAdminApp,
  loadFirebaseAppletConfig,
} from "../src/server/firebaseAdminAuth";
const root = runtimeNamespace() + "_exam_sessions",
  db = getFirestore(
    getFirebaseAdminApp(),
    loadFirebaseAppletConfig().firestoreDatabaseId,
  ),
  directory = path.resolve(".data/backups"),
  filename = path.resolve(
    directory,
    "exams-" + new Date().toISOString().replace(/[:.]/g, "-") + ".jsonl",
  );
if (!filename.startsWith(directory + path.sep))
  throw Error("Backup path rejected");
await fs.mkdir(directory, { recursive: true });
const file = await fs.open(filename, "wx", 0o600),
  digest = crypto.createHash("sha256");
let cursor: any,
  count = 0,
  chunkCount = 0;
try {
  while (true) {
    let query = db.collection(root).orderBy(FieldPath.documentId()).limit(100);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    for (const doc of page.docs) {
      const head = doc.data();
      if (head.key !== doc.id || !Array.isArray(head.chunks))
        throw Error("Bad session head");
      const parts = await db.getAll(
        ...head.chunks.map((id: string) =>
          doc.ref.collection("chunks").doc(id),
        ),
      );
      const chunks = parts.map((d) => {
        const bytes = Buffer.from(d.data()?.bytes || []);
        if (
          !d.exists ||
          crypto.createHash("sha256").update(bytes).digest("hex") !== d.id
        )
          throw Error("Incomplete session backup");
        return { id: d.id, bytes: bytes.toString("base64") };
      });
      const line =
        JSON.stringify({
          schema: 1,
          namespace: root,
          key: doc.id,
          head,
          chunks,
        }) + "\n";
      const buffer=Buffer.from(line);let offset=0;while(offset<buffer.length){const written=await file.write(buffer,offset,buffer.length-offset);if(!written.bytesWritten)throw Error('Incomplete backup write');offset+=written.bytesWritten;}
      digest.update(line);
      count++;
      chunkCount += chunks.length;
    }
    if (page.size < 100) break;
    cursor = page.docs.at(-1);
  }
} finally {
  await file.close();
}
const manifest = {
  schema: 1,
  namespace: root,
  createdAt: new Date().toISOString(),
  sessions: count,
  chunks: chunkCount,
  sha256: digest.digest("hex"),
  sourceWrites: false,
};
await fs.writeFile(
  filename + ".manifest.json",
  JSON.stringify(manifest, null, 2),
  { mode: 0o600 },
);
console.log(
  JSON.stringify({ ...manifest, file: filename.replace(process.cwd(), ".") }),
);
