import test from "node:test";
import assert from "node:assert/strict";
import { retentionPlan } from "../../server/snapshotMaintenance";
test("retention preserves current/previous, pinned, newest fourteen, unknown age and all referenced chunks", () => {
  const now = Date.now(),
    old = new Date(now - 60 * 86400000).toISOString(),
    head = {
      revision: "head",
      previousRevision: "previous",
      chunks: ["live"],
      updatedAt: old,
    },
    rows = Array.from({ length: 20 }, (_, n) => ({
      revision: "r" + n,
      chunks: ["shared", "c" + n],
      updatedAt: new Date(now - (60 + n) * 86400000).toISOString(),
    }));
  rows.push(
    { revision: "previous", chunks: ["old-but-live"], updatedAt: old },
    { revision: "pin", chunks: ["pinned"], updatedAt: old },
    { revision: "unknown", chunks: ["unknown"], updatedAt: "not-a-date" },
  );
  const p = retentionPlan(head, rows, ["pin"], now);
  assert.ok(
    p.keep.includes("head") &&
      p.keep.includes("previous") &&
      p.keep.includes("pin") &&
      p.keep.includes("unknown"),
  );
  assert.ok(p.deleteRevisions.length > 0);
  assert.ok(
    !p.deleteChunks.includes("shared") &&
      !p.deleteChunks.includes("old-but-live") &&
      !p.deleteChunks.includes("pinned") &&
      !p.deleteChunks.includes("unknown"),
  );
  assert.deepEqual(
    p.deleteChunks.sort(),
    p.deleteRevisions.map((r) => "c" + r.slice(1)).sort(),
  );
});
