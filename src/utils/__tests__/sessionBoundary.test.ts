import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { localSessionResponse, sessionBody } from "../../server/sessionCookies";
import { roleNavigation } from "../roleNavigation";
test("cookie boundary strips token from JSON, sets secure flags, blocks cross-origin mutation and permits same-origin retry", async () => {
  const old = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const app = express();
  app.use(localSessionResponse);
  app.post("/save", (_q, r) =>
    r.json(
      sessionBody(r, {
        token: "test-not-a-real-session",
        user: { uid: "DEMO" },
      }),
    ),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const bad = await fetch(base + "/save", {
      method: "POST",
      headers: {
        Cookie: "__Host-ss_session=DEMO",
        Origin: "https://foreign.invalid",
      },
    });
    assert.equal(bad.status, 403);
    const good = await fetch(base + "/save", {
      method: "POST",
      headers: { Cookie: "__Host-ss_session=DEMO", Origin: base },
    });
    assert.equal(good.status, 200);
    assert.equal((await good.json()).token, "cookie");
    const cookie = good.headers.get("set-cookie")!;
    for (const flag of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/"])
      assert.ok(cookie.includes(flag));
  } finally {
    if (old === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = old;
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
test("every active role has exactly five unique primary destinations and students have the agreed daily navigation", () => {
  for (const role of ["student", "teacher", "admin", "platform_owner"]) {
    const rows = roleNavigation(role);
    assert.equal(rows.length, 5);
    assert.equal(new Set(rows.map((r) => r[0])).size, 5);
  }
  assert.deepEqual(
    roleNavigation("student").map((r) => r[1]),
    ["Bugun", "Darslar", "Vazifalar", "Natijalar", "Men"],
  );
});
