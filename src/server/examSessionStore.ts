import crypto from "node:crypto";
import { gzip, gunzip } from "node:zlib";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import {
  getFirebaseAdminApp,
  loadFirebaseAppletConfig,
} from "./firebaseAdminAuth";
import { runtimeNamespace } from "./runtimeScope";
import { runtimeMetrics } from "./runtimeMetrics";
import type { DurableExamSession } from "../utils/examReliability";
const zip = promisify(gzip),
  unzip = promisify(gunzip);
export const examSessionKey = (school: string, exam: string, student: string) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify([school, exam, student]))
    .digest("hex");
export interface ExamSessionStore {
  deleteFixture(key: string): Promise<void>;
  read(key: string): Promise<DurableExamSession | undefined>;
  change<T>(
    key: string,
    fn: (previous: DurableExamSession | undefined) => {
      session: DurableExamSession;
      result: T;
    },
  ): Promise<T>;
  list(
    school: string,
    exam: string,
    after?: string,
  ): Promise<Array<{ key: string; session: DurableExamSession }>>;
}
// The test/development port serializes only the same learner; independent learners never share a write lock.
export class LocalExamSessionStore implements ExamSessionStore {
  async deleteFixture(key: string) {
    if (
      !runtimeNamespace().startsWith("_specialized_preview_") ||
      !/^[a-f0-9]{64}$/.test(key)
    )
      throw Error("Preview fixture cleanup only");
    this.data.delete(key);
    if (this.directory)
      try {
        await fs.unlink(path.join(this.directory, key + ".json"));
      } catch (e) {
        if ((e as any).code !== "ENOENT") throw e;
      }
  }
  protected data = new Map<string, DurableExamSession>();
  private locks = new Map<string, Promise<any>>();
  constructor(private directory?: string) {}
  async read(key: string) {
    runtimeMetrics.read();
    if (this.directory) {
      try {
        return JSON.parse(
          await fs.readFile(path.join(this.directory, key + ".json"), "utf8"),
        );
      } catch (e) {
        if ((e as any).code !== "ENOENT") throw e;
      }
    }
    return structuredClone(this.data.get(key));
  }
  async change<T>(
    key: string,
    fn: (previous: DurableExamSession | undefined) => {
      session: DurableExamSession;
      result: T;
    },
  ) {
    const previous = this.locks.get(key) || Promise.resolve();
    const task = previous
      .catch(() => {})
      .then(async () => {
        const { session, result } = fn(await this.read(key));
        if (this.directory) {
          await fs.mkdir(this.directory, { recursive: true });
          const target = path.join(this.directory, key + ".json"),
            temporary = target + "." + crypto.randomUUID();
          await fs.writeFile(temporary, JSON.stringify(session), {
            mode: 0o600,
          });
          await fs.rename(temporary, target);
        }
        this.data.set(key, structuredClone(session));
        return structuredClone(result);
      });
    this.locks.set(key, task);
    try {
      return await task;
    } finally {
      if (this.locks.get(key) === task) this.locks.delete(key);
    }
  }
  async list(school: string, exam: string, after = "") {
    let keys = [...this.data.keys()];
    if (this.directory) {
      try {
        keys = (await fs.readdir(this.directory))
          .filter((n) => n.endsWith(".json"))
          .map((n) => n.slice(0, -5));
      } catch (e) {
        if ((e as any).code !== "ENOENT") throw e;
      }
    }
    const rows = [];
    for (const key of keys.sort()) {
      if (key <= after) continue;
      const session = await this.read(key);
      if (session?.institutionId === school && session.assessmentId === exam)
        rows.push({ key, session });
      if (rows.length === 50) break;
    }
    return rows;
  }
}
export class FirestoreExamSessionStore implements ExamSessionStore {
  async deleteFixture(key: string) {
    if (
      !this.root().startsWith("_specialized_preview_") ||
      !/^[a-f0-9]{64}$/.test(key)
    )
      throw Error("Preview fixture cleanup only");
    const db = this.db(), ref = db.doc(this.root() + "/" + key);
    // A bounded transaction avoids recursive bulk-writer retries in the HTTP cleanup path.
    // Reading the head also fences any concurrent save before deleting its chunks.
    await db.runTransaction(async (tx) => {
      await tx.get(ref);
      const chunks = await tx.get(ref.collection("chunks").limit(351));
      if (chunks.size > 350) throw Error("Preview fixture requires bounded operator cleanup");
      for (const chunk of chunks.docs) tx.delete(chunk.ref);
      tx.delete(ref);
    });
  }
  constructor(
    private provider?: () => Firestore,
    private namespace?: string,
  ) {}
  private db() {
    return this.provider
      ? this.provider()
      : getFirestore(
          getFirebaseAdminApp(),
          loadFirebaseAppletConfig().firestoreDatabaseId,
        );
  }
  private root() {
    return (this.namespace || runtimeNamespace()) + "_exam_sessions";
  }
  private async decode(head: any, reader: (refs: any[]) => Promise<any[]>) {
    if (!head) return;
    const docs = await reader(
      head.chunks.map((hash: string) =>
        this.db().doc(`${this.root()}/${head.key}/chunks/${hash}`),
      ),
    );
    const chunks = docs.map((d) => {
      if (!d.exists) throw Error("Exam chunk missing");
      const bytes = Buffer.from(d.data().bytes);
      if (crypto.createHash("sha256").update(bytes).digest("hex") !== d.id)
        throw Error("Exam integrity mismatch");
      return bytes;
    });
    return JSON.parse(
      (
        await unzip(Buffer.concat(chunks), { maxOutputLength: 8_500_000 })
      ).toString("utf8"),
    ) as DurableExamSession;
  }
  async read(key: string) {
    const db = this.db(),
      head = await db.doc(this.root() + "/" + key).get();
    return this.decode(head.data(), (refs) =>
      db.getAll(...(refs as [any, ...any[]])),
    );
  }
  async change<T>(
    key: string,
    fn: (previous: DurableExamSession | undefined) => {
      session: DurableExamSession;
      result: T;
    },
  ) {
    const db = this.db(),
      ref = db.doc(this.root() + "/" + key);
    return db.runTransaction(async (tx) => {
      const fence=await tx.get(db.doc((this.namespace||runtimeNamespace())+'/current'));
      if(fence.data()?.writeFrozen===true)throw Error('MIGRATION_IN_PROGRESS');
      const head = await tx.get(ref);
      runtimeMetrics.read();
      const previous = await this.decode(head.data(), (refs) =>
        tx.getAll(...(refs as [any, ...any[]])),
      );
      const before = JSON.stringify(previous);
      const { session, result } = fn(previous);
      // Identical retries are read-only. Compress asynchronously; never block the event loop with exam gzip.
      if (previous && before === JSON.stringify(session)) return result;
      const raw = JSON.stringify(session);
      if (Buffer.byteLength(raw) > 8_000_000)
        throw Error("Exam session exceeds safe bound");
      const bytes = await zip(Buffer.from(raw));
      const chunks: string[] = [];
      for (let start = 0; start < bytes.length; start += 350000) {
        const part = bytes.subarray(start, start + 350000),
          hash = crypto.createHash("sha256").update(part).digest("hex");
        chunks.push(hash);
        if (!(head.data()?.chunks || []).includes(hash))
          tx.set(ref.collection("chunks").doc(hash), {
            bytes: part,
            createdAt: Date.now(),
          });
      }
      runtimeMetrics.write(chunks.length + 1);
      tx.set(ref, {
        key,
        chunks,
        examScope: digestScope(session.institutionId, session.assessmentId),
        schoolId: session.institutionId,
        assessmentId: session.assessmentId,
        studentId: session.studentId,
        updatedAt: Date.now(),
        revision: session.revision,
      });
      return result;
    });
  }
  async list(school: string, exam: string, after = "") {
    const { FieldPath } = await import("firebase-admin/firestore");
    let query = this.db()
      .collection(this.root())
      .where("examScope", "==", digestScope(school, exam))
      .orderBy(FieldPath.documentId())
      .limit(50);
    if (after) query = query.startAfter(after);
    const docs = await query.get();
    return Promise.all(
      docs.docs.map(async (d) => ({
        key: d.id,
        session: (await this.read(d.id))!,
      })),
    );
  }
}
function digestScope(school: string, exam: string) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify([school, exam]))
    .digest("hex");
}
let store: ExamSessionStore | undefined;
export function examSessionStore() {
  return (store ||=
    process.env.PERSISTENCE_DRIVER === "firestore"
      ? new FirestoreExamSessionStore()
      : new LocalExamSessionStore(
          path.resolve(".data/exam-sessions", runtimeNamespace()),
        ));
}
