import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createEasySchoolCredential } from '../../server/schoolCredentials';
import { registerAccountRoutes } from '../../server/accountRoutes';

test('easy student credentials use unique seven digit codes and teacher credentials include the given name', () => {
  const used = new Set<string>();
  for (let index = 0; index < 426; index++) {
    const result = createEasySchoolCredential({ role: 'student', login: 'old', displayName: 'Synthetic Student' }, used);
    assert.match(result.login, /^sps[1-9]\d{6}$/);
    assert.equal(result.password, result.login);
  }
  assert.equal(used.size, 426);
  const teacher = createEasySchoolCredential({ role: 'teacher', login: 'synthetic.teacher', displayName: 'Synthetic Teacher' }, used);
  assert.equal(teacher.login, 'synthetic.teacher');
  assert.match(teacher.password, /^Synthetic-\d{6}$/);
});

test('easy credential reset requires genuine session MFA and fresh matching provider proof before any write', async () => {
  const owner = { uid: 'DEMO-owner', institutionId: 'DEMO-school', role: 'platform_owner', status: 'active', emailVerified: true, platformAdmin: true };
  const student = { uid: 'DEMO-student', institutionId: 'DEMO-school', role: 'student', status: 'active', displayName: 'Synthetic Student', login: 'old.student', sourceImport: { batchId: 'DEMO-batch' } };
  const db: any = { users: [owner, student], passwordHashes: { [student.uid]: 'old' }, auditLogs: [], mfaVerifiedSessions: [] };
  let saves = 0, revocations = 0;
  const app = express();
  app.use(express.json());
  registerAccountRoutes(app, {
    authenticate: () => ({ user: owner, db, env: 'test', token: Buffer.from(JSON.stringify({ sid: 'DEMO-session' })).toString('base64url') + '.synthetic' }),
    save: () => { saves++; }, hash: async () => 'new-synthetic-hash', revoke: () => { revocations++; },
    providerProof: async (token: string) => ({ uid: token === 'fresh-owner-proof' ? owner.uid : 'DEMO-other', email_verified: true, auth_time: Date.now() / 1000, firebase: { sign_in_provider: 'google.com' } }),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const send = (idToken: string) => fetch('http://127.0.0.1:' + (server.address() as any).port + '/api/accounts/' + student.uid, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resetPassword: true, credentialFormat: 'easy-school', identityVerified: true, idToken }),
  });
  try {
    assert.equal((await send('fresh-owner-proof')).status, 403);
    db.mfaVerifiedSessions.push({ id: 'DEMO-session', userId: owner.uid, schoolId: owner.institutionId, expiresAt: Date.now() + 60000 });
    assert.equal((await send('wrong-owner-proof')).status, 403);
    assert.equal(saves, 0);
    assert.equal(student.login, 'old.student');
    assert.equal(db.passwordHashes[student.uid], 'old');
    const response = await send('fresh-owner-proof');
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.password, result.login);
    assert.match(result.login, /^sps[1-9]\d{6}$/);
    assert.equal((student as any).mustChangePassword, true);
    assert.equal(db.passwordHashes[student.uid], 'new-synthetic-hash');
    assert.equal(saves, 1);
    assert.equal(revocations, 1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
