import fs from 'node:fs';
process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT=fs.readFileSync('.data/vercel-service-account.json','utf8');
const { getFirebaseAdminAuth }=await import('../src/server/firebaseAdminAuth');
const { getDbState }=await import('../src/server/dbEngine');
const { writeCloudState }=await import('../src/server/cloudState');
const auth=getFirebaseAdminAuth();const state=getDbState('prod');
// Preserve records already written to the existing profile collection.
const {getFirestore}=await import('firebase-admin/firestore');
const {getFirebaseAdminApp,loadFirebaseAppletConfig}=await import('../src/server/firebaseAdminAuth');
const db=getFirestore(getFirebaseAdminApp(),loadFirebaseAppletConfig().firestoreDatabaseId);
const existingProfiles=await db.collection('users').get();
for(const doc of existingProfiles.docs){const profile=doc.data();if(profile.uid && profile.email && !state.users.some(u=>u.uid===profile.uid))state.users.push(profile as any);}
for(const email of ['asilbeknuraliyev43@gmail.com','bahodirboliqulov3@gmail.com']){
 try{const user=await auth.getUserByEmail(email);if(!user.emailVerified||user.disabled)continue;await auth.setCustomUserClaims(user.uid,{...user.customClaims,platformAdmin:true});
 const existing=state.users.find(u=>u.uid===user.uid);const profile={...existing,uid:user.uid,email:user.email!,displayName:user.displayName||existing?.displayName||user.email!,emailVerified:true,platformAdmin:true,platformOwner:true,role:'platform_owner' as const,institutionId:state.institutions[0].id,status:'active' as const,createdAt:existing?.createdAt||new Date(user.metadata.creationTime).toISOString(),updatedAt:new Date().toISOString()};
 state.users=state.users.filter(u=>u.uid!==user.uid);state.users.push(profile);state.customClaims||={};state.customClaims[user.uid]={...user.customClaims,platformAdmin:true};
 console.log('Verified admin claim provisioned:',email);
 }catch(e:any){if(e.code!=='auth/user-not-found')throw e;console.log('Admin must first sign in with Google:',email);}
}
const revision=await writeCloudState(state,null);
console.log(JSON.stringify({migrated:true,revision,lessons:state.lessons.filter(l=>l.status==='published').length,workPlans:state.workPlans.length,existingProfilesPreserved:existingProfiles.size}));
