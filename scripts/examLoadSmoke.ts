import fs from "node:fs/promises";
import express from "express";
import { registerExamReliabilityRoutes } from "../src/server/examReliabilityRoutes";
import { LocalExamSessionStore } from "../src/server/examSessionStore";
if (process.env.PERSISTENCE_DRIVER === "firestore" || process.env.VERCEL)
  throw Error(
    "Local synthetic load smoke only; never run against a cloud project",
  );
const exam: any = {
    id: "DEMO-load",
    examKind: "BSB",
    institutionId: "DEMO",
    subject: "Math",
    classId: "c",
    classCode: "8a2",
    assignedClassIds: ["c"],
    assignedClassCodes: ["8a2"],
    questionIds: ["q"],
    questionSnapshot: [],
    durationMinutes: 60,
    dueDate: new Date(Date.now() + 7200000).toISOString(),
    availableFrom: new Date(Date.now() - 1000).toISOString(),
    createdAt: new Date().toISOString(),
    status: "published",
    examState: "open",
  },
  app = express(),
  store = new LocalExamSessionStore();
app.use(express.json());
registerExamReliabilityRoutes(app, {
  examStore: store,
  authenticate: (req: any) => ({
    user: {
      uid: String(req.headers.authorization),
      institutionId: "DEMO",
      role: "student",
      status: "active",
      classId: "c",
      classCode: "8a2",
    },
    db: {
      assessments: [exam],
      examSessions: [],
      attempts: [],
      topics: [],
      questions: [],
    },
  }),
  save: () => {
    throw Error("Autosave must not write a global snapshot");
  },
});
const server = app.listen({ port: 0, host: "127.0.0.1", backlog: 2048 });
await new Promise<void>((r) => server.once("listening", r));
const base = `http://127.0.0.1:${(server.address() as any).port}/api/exams/DEMO-load`,
  report: any = {
    environment: "local synthetic in-memory HTTP",
    cloudLoadTest: false,
    passwordLoginBenchmark: false,
    billingEstimate: null,
    stages: [],
  };
try {
  for (const n of [50, 200, 1000]) {
    const actors = Array.from({ length: n }, (_, i) => ({
      uid: `DEMO-${n}-${i}`,
      clientId: crypto.randomUUID(),
      epoch: 0,
    }));
    for (let i = 0; i < actors.length; i += 50)
      await Promise.all(
        actors.slice(i, i + 50).map(async (a) => {
          const r = await fetch(base + "/start-v2", {
            method: "POST",
            headers: {
              Authorization: a.uid,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              clientId: a.clientId,
              operationId: crypto.randomUUID(),
            }),
          });
          if (!r.ok) throw Error("Start failed " + r.status);
          a.epoch = (await r.json()).session.epoch;
        }),
      );
    const times: number[] = [],
      errors: number[] = [],
      cpu = process.cpuUsage(),
      start = performance.now();
    await Promise.all(
      actors.map(async (a) => {
        const began = performance.now();
        const r = await fetch(base + "/session-v2", {
          method: "PUT",
          headers: { Authorization: a.uid, "Content-Type": "application/json" },
          body: JSON.stringify({
            operationId: crypto.randomUUID(),
            clientId: a.clientId,
            epoch: a.epoch,
            revision: 0,
            answers: { q: "DEMO response " + ".".repeat(1000) },
          }),
        });
        await r.json();
        times.push(performance.now() - began);
        if (!r.ok) errors.push(r.status);
      }),
    );
    times.sort((a, b) => a - b);
    const usage = process.cpuUsage(cpu),
      row = {
        simultaneousSaveRequests: n,
        payloadBytes: 1000,
        elapsedMs: Math.round(performance.now() - start),
        p50Ms: Math.round(times[Math.floor(n * 0.5)]),
        p95Ms: Math.round(times[Math.floor(n * 0.95)]),
        p99Ms: Math.round(times[Math.floor(n * 0.99)]),
        errors,
        cpuMs: Math.round((usage.user + usage.system) / 1000),
        rssMB: Math.round(process.memoryUsage().rss / 1048576),
      };
    report.stages.push(row);
    console.log(JSON.stringify(row));
    if (errors.length) throw Error("Local load errors observed");
  }
  await fs.mkdir(".data/reliability", { recursive: true });
  await fs.writeFile(
    ".data/reliability/load-smoke.json",
    JSON.stringify(report, null, 2),
  );
} catch (error) {
  report.failure = {
    phase:
      report.stages.length === 2
        ? "1000 simultaneous loopback requests"
        : "local load",
    code: (error as any)?.cause?.code || (error as Error).message,
  };
  process.exitCode = 1;
  console.log(JSON.stringify(report.failure));
} finally {
  await fs.mkdir(".data/reliability", { recursive: true });
  await fs.writeFile(
    ".data/reliability/load-smoke.json",
    JSON.stringify(report, null, 2),
  );
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
}
