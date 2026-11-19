import test from 'node:test';
import assert from 'node:assert/strict';
import type {UserProfile} from '../../types';
import {authenticatedHome,canShowAdminUi} from '../uiPermissions';

test('an active account without platform claims has a stable access page instead of the login loop',()=>{
  const profile={uid:'qa',role:'admin',status:'active',emailVerified:true} as UserProfile;
  assert.equal(canShowAdminUi(profile),false);
  assert.equal(authenticatedHome(profile),'/account/access');
  assert.equal(authenticatedHome({...profile,platformAdmin:true}),'/admin/dashboard');
});

test('school grants and MFA route separately from platform administration',()=>{
  const profile={uid:'qa',role:'staff',status:'active',leadershipDesignation:'school_administrator'} as UserProfile;
  assert.equal(authenticatedHome(profile),'/school-admin/dashboard');
  assert.equal(canShowAdminUi(profile),false);
  assert.equal(authenticatedHome({...profile,mfaRequired:true}),'/account/security');
  assert.equal(authenticatedHome({...profile,leadershipDesignation:'director'}),'/leadership/dashboard');
  assert.equal(authenticatedHome({...profile,leadershipDesignation:'academic_deputy'}),'/leadership/dashboard');
});
