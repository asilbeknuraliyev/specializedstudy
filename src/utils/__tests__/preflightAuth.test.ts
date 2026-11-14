import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createPrivateApiPreflight } from "../../server/preflightAuth";
test("unsigned private requests never read persistence; valid signatures still require durable authorization and public login remains reachable", async () => {
  const app = express();
  let reads = 0;
  app.use(
    createPrivateApiPreflight(
      (token) => (token === "signed" ? { env: "prod" } : null),
      (req) => req.headers.authorization,
    ),
  );
  app.use((_q, _r, next) => {
    reads++;
    next();
  });
  app.get("/api/exams/demo/session-v2", (_q, r) =>
    r.status(403).json({ error: "durable role denied" }),
  );
  app.post("/api/auth/login", (_q, r) => r.json({ reachable: true }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    assert.equal(
      (await fetch(base + "/api/exams/demo/session-v2")).status,
      401,
    );
    assert.equal(
      (
        await fetch(base + "/api/exams/demo/session-v2", {
          headers: { Authorization: "fake" },
        })
      ).status,
      401,
    );
    assert.equal(reads, 0);
    assert.equal(
      (
        await fetch(base + "/api/exams/demo/session-v2", {
          headers: { Authorization: "signed" },
        })
      ).status,
      403,
    );
    assert.equal(reads, 1);
    assert.equal(
      (await fetch(base + "/api/auth/login", { method: "POST" })).status,
      200,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
