import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerCredentialRotationRoutes } from '../../server/credentialRotationRoutes';

test('450-account rotation enforces owner MFA and reauthentication, retries without changing credentials twice, and claims once', async () => {
  process.env.AUTH_PROVIDER = 'supabase';
  process.env.SUPABASE_URL = 'https://synthetic.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-server-key-for-local-test-only';
  process.env.SESSION_SECRET = 'synthetic-encryption-secret-for-local-fixture-only';
  const providerUid = '00000000-0000-4000-8000-000000000001';
  const owner = { uid: 'DEMO-owner', institutionId: 'DEMO-school', role: 'platform_owner', status: 'active', linkedSupabaseUid: providerUid };
  const users = Array.from({ length: 450 }, (_, index) => ({ uid: 'DEMO-user-' + index, institutionId: owner.institutionId, role: index < 426 ? 'student' : 'teacher', displayName: 'Synthetic Person', login: 'teacher.' + index, status: 'active', schoolIdentityProvisioning: 'linked' }));
  const oldProfile = { uid: 'DEMO-existing', login: 'existing', role: 'student', institutionId: owner.institutionId };
  const db: any = { users: [owner, oldProfile, ...users], passwordHashes: Object.fromEntries(users.map(user => [user.uid, 'original-hash'])), schoolImportJobs: [{ institutionId: owner.institutionId, kind: 'students', status: 'committed', createdUsers: users.slice(0, 426).map(user => user.uid) }, { institutionId: owner.institutionId, kind: 'teachers', status: 'committed', createdUsers: users.slice(426).map(user => user.uid) }], auditLogs: [], mfaVerifiedSessions: [] };
  const nativeFetch = globalThis.fetch;
  const objects = new Map<string, string>();
  globalThis.fetch = async (input: any, init?: any) => {
    const url = String(typeof input === 'string' ? input : input.url);
    if (!url.startsWith(process.env.SUPABASE_URL!)) return nativeFetch(input, init);
    if (url.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: providerUid, email: 'synthetic@example.invalid', email_confirmed_at: '2026-01-01T00:00:00Z', identities: [{ provider: 'google' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const path = new URL(url).pathname.replace('/object/authenticated/', '/object/');
    if (init?.method === 'POST') {
      objects.set(path, await new Response(init.body).text());
      return new Response(JSON.stringify({ Key: path }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (!objects.has(path)) return new Response(JSON.stringify({ message: 'not found', statusCode: 404 }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(objects.get(path), { status: 200 });
  };
  let hashes = 0, saves = 0, revoked = 0;
  const app = express();
  app.use(express.json());
  registerCredentialRotationRoutes(app, { authenticate: (req: any) => req.headers.authorization === 'anonymous' ? null : { user: owner, db, env: 'test', token: Buffer.from(JSON.stringify({ sid: 'DEMO-session' })).toString('base64url') + '.fixture' }, owner: () => true, hash: async () => { hashes++; return 'synthetic-new-hash'; }, revoke: () => { revoked++; }, save: () => { saves++; } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const operationId = crypto.randomUUID();
  const claims = { sub: providerUid, exp: Date.now() / 1000 + 600, amr: [{ method: 'oauth', timestamp: Math.floor(Date.now() / 1000) }] };
  const idToken = 'synthetic.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.signature';
  const send = (suffix = '', proof = idToken, authorization = 'owner') => nativeFetch('http://127.0.0.1:' + (server.address() as any).port + '/api/account-credential-rotations' + suffix, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authorization }, body: JSON.stringify({ operationId, idToken: proof, confirmed: true }) });
  try {
    assert.equal((await send('', idToken, 'anonymous')).status, 401);
    assert.equal((await send()).status, 403);
    db.mfaVerifiedSessions.push({ id: 'DEMO-session', userId: owner.uid, schoolId: owner.institutionId, expiresAt: Date.now() + 60000 });
    assert.equal((await send('', 'invalid-token-without-dot')).status, 403);
    assert.equal(hashes, 0);
    const first = await send();
    assert.equal(first.status, 200);
    assert.equal(hashes, 450);
    assert.equal(revoked, 450);
    assert.equal((await send()).status, 200);
    assert.equal(hashes, 450);
    assert.equal(saves, 1);
    const claim = await send('/claim');
    assert.equal(claim.status, 200);
    const rows = (await claim.json()).credentials;
    assert.equal(rows.length, 450);
    assert(rows.slice(0, 426).every((row: any) => row.login === row.password && /^sps[1-9]\d{6}$/.test(row.login)));
    assert.equal(new Set(rows.map((row: any) => row.password)).size, 450);
    assert(rows.every((row: any) => row.expectedHash === undefined));
    assert.equal((await send('/claim')).status, 410);
    assert.equal(oldProfile.login, 'existing');
  } finally {
    globalThis.fetch = nativeFetch;
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
