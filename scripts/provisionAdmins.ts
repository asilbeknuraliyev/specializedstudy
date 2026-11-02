import { getDbState } from '../src/server/dbEngine';
import {
  provisionAuthorizedAdmins,
  loadFirebaseAppletConfig,
} from '../src/server/firebaseAdminAuth';

async function main() {
  const cfg = loadFirebaseAppletConfig();
  const db = getDbState('prod');
  const result = await provisionAuthorizedAdmins('prod', db);

  console.log('==============================================================');
  console.log('SPECIALIZED STUDY — ADMIN CUSTOM CLAIM PROVISIONING REPORT');
  console.log('==============================================================');
  console.log(`Firebase Project ID : ${cfg.projectId}`);
  console.log(`Auth Domain         : ${cfg.authDomain}`);
  console.log(`Firestore DB ID     : ${cfg.firestoreDatabaseId}`);
  console.log(`Timestamp           : ${result.timestamp}`);
  console.log('--------------------------------------------------------------');
  for (const adm of result.admins) {
    console.log(`Admin Email         : ${adm.email}`);
    console.log(`Exists              : ${adm.existsInFirebaseOrDb}`);
    console.log(`Firebase UID        : ${adm.uid || 'NOT_YET_AUTHENTICATED'}`);
    console.log(`Email Verified      : ${adm.emailVerified}`);
    console.log(`platformAdmin Claim : ${adm.platformAdminClaimAssigned}`);
    console.log(`Preserved Claims    : ${JSON.stringify(adm.preservedCustomClaims)}`);
    console.log(`Status              : ${adm.status}`);
    console.log(`Message             : ${adm.message}`);
    console.log('--------------------------------------------------------------');
  }
}

main().catch((err) => {
  console.error('Admin provisioning script error:', err);
  process.exit(1);
});
