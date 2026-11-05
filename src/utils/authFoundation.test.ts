import test from 'node:test';
import assert from 'node:assert/strict';
import { getFirebaseAdminAuth, verifyFirebaseIdToken, createIsolatedTestFirebaseIdToken } from '../server/firebaseAdminAuth';
import type { PersistentDatabaseState } from '../server/dbEngine';

const state = { customClaims: { 'admin-uid': { platformAdmin: true } } } as unknown as PersistentDatabaseState;

test('real identity never inherits administrator privileges from local state', async () => {
  const auth = getFirebaseAdminAuth();
  const original = auth.verifyIdToken;
  const calls: unknown[][] = [];
  auth.verifyIdToken = (async (...args: unknown[]) => {
    calls.push(args);
    return { uid: 'admin-uid', email: 'asilbeknuraliyev43@gmail.com', email_verified: true, iat: 1, exp: 9999999999 };
  }) as typeof auth.verifyIdToken;
  try {
    const result = await verifyFirebaseIdToken('valid-firebase-token', 'prod', state);
    assert.equal(result.valid, true);
    if (!result.valid) throw new Error('Identity unexpectedly rejected');
    assert.equal(result.identity?.customClaims.platformAdmin, false);
    assert.equal(calls[0][1], true, 'revocation must be checked');
  } finally { auth.verifyIdToken = original; }
});

test('verification failure cannot fall back to network lookup or local privileges', async () => {
  const auth = getFirebaseAdminAuth();
  const original = auth.verifyIdToken;
  const originalFetch = globalThis.fetch;
  let lookupCalled = false;
  auth.verifyIdToken = (async () => { throw Object.assign(new Error('revoked'), { code: 'auth/id-token-revoked' }); }) as typeof auth.verifyIdToken;
  globalThis.fetch = async () => { lookupCalled = true; throw new Error('unexpected lookup'); };
  try {
    const result = await verifyFirebaseIdToken('revoked-token', 'prod', state);
    assert.equal(result.valid, false);
    assert.equal(lookupCalled, false);
  } finally { auth.verifyIdToken = original; globalThis.fetch = originalFetch; }
});

test('isolated test tokens are rejected by production verification', async () => {
  const auth = getFirebaseAdminAuth();
  const original = auth.verifyIdToken;
  auth.verifyIdToken = (async () => { throw new Error('not a Firebase JWT'); }) as typeof auth.verifyIdToken;
  try {
    const token = createIsolatedTestFirebaseIdToken({ uid: 'admin-uid', email: 'asilbeknuraliyev43@gmail.com', emailVerified: true, customClaims: { platformAdmin: true } });
    assert.equal((await verifyFirebaseIdToken(token, 'prod', state)).valid, false);
  } finally { auth.verifyIdToken = original; }
});

