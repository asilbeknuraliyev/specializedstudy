import fs from "node:fs/promises";
import { getFirestore } from "firebase-admin/firestore";
import {
  getFirebaseAdminApp,
  loadFirebaseAppletConfig,
} from "../src/server/firebaseAdminAuth";
import { runtimeNamespace } from "../src/server/runtimeScope";
import {
  inspectSnapshotRetention,
  applySnapshotRetentionBatch,
} from "../src/server/snapshotMaintenance";
const root = runtimeNamespace(),
  db = getFirestore(
    getFirebaseAdminApp(),
    loadFirebaseAppletConfig().firestoreDatabaseId,
  ),
  pins = process.env.SNAPSHOT_PIN_REVISIONS?.split(",").filter(Boolean) || [],
  plan = await inspectSnapshotRetention(db, root, pins);
await fs.mkdir(".data/maintenance", { recursive: true });
await fs.writeFile(
  ".data/maintenance/snapshot-plan.json",
  JSON.stringify({ root, ...plan }, null, 2),
  { mode: 0o600 },
);
if (process.argv.includes("--apply")) {
  if (!process.env.MAINTENANCE_CONFIRMATION)
    throw Error("Use dry-run first and provide exact MAINTENANCE_CONFIRMATION");
  console.log(
    JSON.stringify(
      await applySnapshotRetentionBatch(
        db,
        root,
        plan,
        process.env.MAINTENANCE_CONFIRMATION,
      ),
    ),
  );
} else
  console.log(
    JSON.stringify({
      dryRun: true,
      root,
      protectedRevisions: plan.keep.length,
      expiredRevisions: plan.deleteRevisions.length,
      collectableChunks: plan.deleteChunks.length,
      manifest: ".data/maintenance/snapshot-plan.json",
      productionWrites: false,
    }),
  );
