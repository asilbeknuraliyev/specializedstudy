import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  initializeApp as adminApp,
  deleteApp as deleteAdmin,
} from "firebase-admin/app";
import { getFirestore as adminFirestore } from "firebase-admin/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  getDoc,
  setDoc,
  doc,
  terminate,
} from "firebase/firestore";
import {
  FirestoreExamSessionStore,
  examSessionKey,
} from "../src/server/examSessionStore";
import { pruneExamSessionChunks } from "../src/server/snapshotMaintenance";
const project = "demo-specialized-exams",
  root = "_specialized_preview_examtest_exam_sessions";
test("actual Firestore adapter survives concurrent instances and >1MB payload chunks; private session documents deny every web role", async () => {
  assert.ok(
    process.env.FIRESTORE_EMULATOR_HOST,
    "Run only with the Firestore emulator",
  );
  const app = adminApp(
      { projectId: project },
      "exam-emulator-" + crypto.randomUUID(),
    ),
    db = adminFirestore(app),
    store = new FirestoreExamSessionStore(
      () => db,
      "_specialized_preview_examtest",
    ),
    second = new FirestoreExamSessionStore(
      () => db,
      "_specialized_preview_examtest",
    ),
    key = examSessionKey("DEMO", "exam", "student");
  try {
    const base: any = {
      id: "DEMO-session",
      protocol: 2,
      epoch: 1,
      institutionId: "DEMO",
      assessmentId: "exam",
      studentId: "student",
      revision: 0,
      answers: {},
      events: [],
      operations: [],
      reviews: [],
      startedAt: new Date().toISOString(),
      deadlineAt: new Date(Date.now() + 60000).toISOString(),
      pauseAtStart: 0,
    };
    await store.change(key, () => ({ session: base, result: true }));
    await Promise.all(
      [store, second].map((s) =>
        s.change(key, (previous) => {
          const session = previous!;
          session.revision++;
          return { session, result: session.revision };
        }),
      ),
    );
    assert.equal((await second.read(key))!.revision, 2);
    const large = Object.fromEntries(
      Array.from({ length: 7 }, (_, n) => [
        "q" + n,
        crypto.randomBytes(140000).toString("base64"),
      ]),
    );
    await store.change(key, (old) => ({
      session: { ...old!, answers: large },
      result: true,
    }));
    assert.deepEqual((await second.read(key))!.answers, large);
    assert.ok((await db.doc(root + "/" + key).get()).data()!.chunks.length > 1);
    assert.equal((await store.list("DEMO", "exam")).length, 1);
    assert.equal((await store.list("OTHER", "exam")).length, 0);
    for (const role of ["anonymous", "student", "teacher", "platform_owner"]) {
      const web = initializeApp(
          { projectId: project, apiKey: "demo-key" },
          "rules-" + role,
        ),
        client = getFirestore(web);
      connectFirestoreEmulator(
        client,
        "127.0.0.1",
        8787,
        role === "anonymous"
          ? {}
          : {
              mockUserToken: {
                sub: role,
                email: role + "@example.invalid",
                email_verified: true,
                platformAdmin: role === "platform_owner",
              },
            },
      );
      try {
        await assert.rejects(
          getDoc(doc(client, root, key)),
          (e: any) => e.code === "permission-denied",
        );
        await assert.rejects(
          setDoc(doc(client, root, key), { hacked: true }),
          (e: any) => e.code === "permission-denied",
        );
        await assert.rejects(
          getDoc(doc(client, root, key, "chunks", "fake")),
          (e: any) => e.code === "permission-denied",
        );
      } finally {
        await terminate(client);
        await deleteApp(web);
      }
    }
    // Restore a synthetic archived head/chunks into another emulator namespace, then detect corruption.
    const restoredRoot = "_specialized_preview_restoretest_exam_sessions",
      archived = (await db.doc(root + "/" + key).get()).data()!,
      chunkDocs = await db
        .doc(root + "/" + key)
        .collection("chunks")
        .get(),
      archive = chunkDocs.docs.map((d) => ({
        id: d.id,
        bytes: Buffer.from(d.data().bytes).toString("base64"),
        createdAt: d.data().createdAt,
      }));
    for (const part of archive)
      await db
        .doc(restoredRoot + "/" + key + "/chunks/" + part.id)
        .set({
          bytes: Buffer.from(part.bytes, "base64"),
          createdAt: part.createdAt,
        });
    await db.doc(restoredRoot + "/" + key).set(archived);
    const restored = new FirestoreExamSessionStore(
      () => db,
      "_specialized_preview_restoretest",
    );
    assert.deepEqual(await restored.read(key), await store.read(key));
    const orphan = "a".repeat(64),
      old = Date.now() - 8 * 86400000;
    await db
      .doc(restoredRoot + "/" + key + "/chunks/" + orphan)
      .set({ bytes: Buffer.from("orphan"), createdAt: old });
    await db
      .doc(restoredRoot + "/" + key + "/chunks/" + archived.chunks[0])
      .update({ createdAt: old });
    const prune = await pruneExamSessionChunks(db, restoredRoot, key, true);
    assert.deepEqual(prune.candidates, [orphan]);
    assert.deepEqual(await restored.read(key), await store.read(key));
    await db
      .doc(restoredRoot + "/" + key + "/chunks/" + archived.chunks[0])
      .update({ bytes: Buffer.from("corrupted") });
    await assert.rejects(restored.read(key), /integrity/);
    await assert.rejects(restored.deleteFixture("invalid"), /Preview fixture/);
    const production = new FirestoreExamSessionStore(() => db, "_specialized_runtime");
    await assert.rejects(production.deleteFixture(key), /Preview fixture/);
    await restored.deleteFixture(key);
    assert.equal(await restored.read(key), undefined);
    assert.equal((await db.doc(restoredRoot + "/" + key).collection("chunks").get()).size, 0);
    await restored.deleteFixture(key); // Idempotent even after an interrupted prior cleanup.
    const fence=db.doc('_specialized_preview_examtest/current');
    await fence.set({writeFrozen:true});
    await assert.rejects(store.change(key,old=>({session:old!,result:true})),/MIGRATION_IN_PROGRESS/);
    await fence.delete();
  } finally {
    await db.recursiveDelete(db.collection(root));
    await db.recursiveDelete(
      db.collection("_specialized_preview_restoretest_exam_sessions"),
    );
    await db.terminate();
    await deleteAdmin(app);
  }
});
