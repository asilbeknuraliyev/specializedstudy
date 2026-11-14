import crypto from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
type Manifest = {
  revision: string;
  chunks: string[];
  updatedAt: string;
  previousRevision?: string;
};
export function retentionPlan(
  head: Manifest,
  revisions: Manifest[],
  pins: string[] = [],
  now = Date.now(),
) {
  const cutoff = now - 30 * 86400000,
    sorted = [...revisions].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    ),
    keep = new Set([
      head.revision,
      head.previousRevision,
      ...pins,
      ...sorted.slice(0, 14).map((m) => m.revision),
    ]);
  const kept = [
      head,
      ...sorted.filter(
        (m) =>
          keep.has(m.revision) ||
          !Number.isFinite(Date.parse(m.updatedAt)) ||
          Date.parse(m.updatedAt) >= cutoff,
      ),
    ],
    expired = sorted.filter(
      (m) => !kept.some((k) => k.revision === m.revision),
    ),
    live = new Set(kept.flatMap((m) => m.chunks)),
    chunks = [...new Set(expired.flatMap((m) => m.chunks))].filter(
      (id) => !live.has(id),
    );
  return {
    expectedRevision: head.revision,
    keep: kept.map((m) => m.revision),
    deleteRevisions: expired.map((m) => m.revision),
    deleteChunks: chunks,
    policy: {
      days: 30,
      minimumRevisions: 14,
      pinsPreserved: true,
      unknownAgePreserved: true,
      untrackedOrphansPreserved: true,
    },
  };
}
export async function inspectSnapshotRetention(
  db: Firestore,
  root: string,
  pins: string[] = [],
) {
  if (!/^_specialized_(runtime|preview_[a-z0-9_]{1,40})$/.test(root))
    throw Error("Namespace rejected");
  const head = await db.doc(root + "/current").get();
  if (!head.exists) throw Error("Snapshot missing");
  let query = db
      .collection(root + "/revisions/items")
      .orderBy("__name__")
      .limit(500),
    rows: any[] = [],
    cursor: any;
  while (true) {
    const page = await (cursor ? query.startAfter(cursor) : query).get();
    rows.push(...page.docs.map((d) => d.data()));
    if (rows.length > 50000)
      throw Error(
        "Archive manifests before scanning more than 50000 revisions",
      );
    if (page.size < 500) break;
    cursor = page.docs.at(-1);
  }
  return retentionPlan(head.data() as Manifest, rows as Manifest[], pins);
}
export async function applySnapshotRetentionBatch(
  db: Firestore,
  root: string,
  plan: ReturnType<typeof retentionPlan>,
  confirmation: string,
) {
  if (confirmation !== `PRUNE ${root} ${plan.expectedRevision}`)
    throw Error("Exact confirmation required");
  if (plan.deleteRevisions.length + plan.deleteChunks.length > 350)
    throw Error(
      "Review a bounded plan of at most 350 deletions per maintenance batch",
    );
  const fresh = await inspectSnapshotRetention(db, root, plan.keep);
  if (
    fresh.expectedRevision !== plan.expectedRevision ||
    plan.deleteRevisions.some((id) => !fresh.deleteRevisions.includes(id)) ||
    plan.deleteChunks.some((id) => !fresh.deleteChunks.includes(id))
  )
    throw Error("Plan no longer safe; re-run dry-run");
  return db.runTransaction(async (tx) => {
    const ref = db.doc(root + "/current"),
      current = await tx.get(ref);
    if (current.data()?.revision !== plan.expectedRevision)
      throw Error("Snapshot changed; re-run dry-run");
    const fence = crypto.randomUUID();
    // Fence concurrent legacy writers: their CAS must retry and re-persist any chunk collected here.
    tx.set(
      db.doc(root + "/revisions/items/" + plan.expectedRevision),
      current.data()!,
    );
    tx.set(ref, {
      ...current.data(),
      revision: fence,
      previousRevision: plan.expectedRevision,
      maintenanceAt: new Date().toISOString(),
    });
    for (const id of plan.deleteRevisions)
      tx.delete(db.doc(root + "/revisions/items/" + id));
    for (const id of plan.deleteChunks)
      tx.delete(db.doc(root + "/chunks/items/" + id));
    return {
      deletedRevisions: plan.deleteRevisions.length,
      deletedChunks: plan.deleteChunks.length,
      fence,
    };
  });
}
export async function pruneExamSessionChunks(
  db: Firestore,
  root: string,
  key: string,
  apply = false,
  now = Date.now(),
) {
  if (
    !/^_specialized_(runtime|preview_[a-z0-9_]{1,40})_exam_sessions$/.test(
      root,
    ) ||
    !/^[a-f0-9]{64}$/.test(key)
  )
    throw Error("Exam namespace/key rejected");
  const ref = db.doc(root + "/" + key),
    cutoff = now - 7 * 86400000,
    candidates = await ref
      .collection("chunks")
      .where("createdAt", "<", cutoff)
      .limit(250)
      .get();
  return db.runTransaction(async (tx) => {
    const head = await tx.get(ref);
    if (!head.exists)
      throw Error("Missing live head; orphan cleanup needs separate review");
    const rows = candidates.empty
        ? []
        : await tx.getAll(...candidates.docs.map((d) => d.ref)),
      live = new Set(head.data()!.chunks),
      remove = rows.filter(
        (d) => d.exists && !live.has(d.id) && d.data()!.createdAt < cutoff,
      );
    if (apply) for (const d of remove) tx.delete(d.ref);
    return {
      candidates: remove.map((d) => d.id),
      applied: apply,
      headRetained: true,
      receiptRetained: true,
    };
  });
}
