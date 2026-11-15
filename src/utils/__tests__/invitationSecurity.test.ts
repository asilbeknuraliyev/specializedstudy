import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {generateCryptographicInviteToken} from '../../server/dbEngine';
import {findSecureInvitation,validateSecureInvitation} from '../../server/invitationSecurity';
import {validPassword} from '../passwordPolicy';import {sealSecret,openSecret} from '../../server/secretEnvelope';
test('invites use independent 192-bit tokens, SHA-256 digests, strict expiry and single use; old class codes never enroll',()=>{
 const one=generateCryptographicInviteToken('STU'),two=generateCryptographicInviteToken('STU'),now=Date.now();assert.match(one.rawToken,/^INV-STU-[A-F0-9]{48}$/);assert.notEqual(one.rawToken,two.rawToken);assert.equal(one.tokenHash.length,71);
 const invitation:any={tokenHash:one.tokenHash,status:'pending',createdAt:new Date(now).toISOString(),expiresAt:new Date(now+7*86400000).toISOString()};assert.ok(validateSecureInvitation(one.rawToken,invitation,new Date(now+1).toISOString()).valid);assert.equal(findSecureInvitation([invitation],'SS-8A2-2026'),undefined);invitation.status='accepted';assert.ok(!validateSecureInvitation(one.rawToken,invitation).valid);invitation.status='pending';invitation.expiresAt=new Date(now+14*86400000).toISOString();assert.ok(!validateSecureInvitation(one.rawToken,invitation).valid);
});
test('password policy and encrypted provisioning envelope preserve confidentiality and bind school/purpose',()=>{
 for(const p of ['student123','ALLUPPER1','NoNumbersHere','Aa1'])assert.equal(validPassword(p),false);assert.ok(validPassword('SyntheticPass91'));
 const previous=process.env.SESSION_SECRET;process.env.SESSION_SECRET=crypto.randomBytes(48).toString('hex');try{const sealed=sealSecret({password:'SyntheticPass91'},'DEMO-school:batch-1');assert.ok(!sealed.includes('SyntheticPass91'));assert.deepEqual(openSecret(sealed,'DEMO-school:batch-1'),{password:'SyntheticPass91'});assert.throws(()=>openSecret(sealed,'DEMO-other:batch-1'));}finally{if(previous)process.env.SESSION_SECRET=previous;else delete process.env.SESSION_SECRET;}
});
