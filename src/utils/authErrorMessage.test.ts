import test from 'node:test';
import assert from 'node:assert/strict';
import { mapFirebaseAuthError } from './firebaseAuthErrors';
test('backend outage is distinct from a Google connection error',()=>{
 const server=mapFirebaseAuthError({code:'auth/server-unavailable'});
 assert.match(server.userMessage,/serveri/);assert.doesNotMatch(server.userMessage,/Internet/);
 assert.match(mapFirebaseAuthError({code:'auth/network-request-failed'}).userMessage,/Internet/);
});
