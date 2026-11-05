import fs from 'node:fs';
process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT=fs.readFileSync('.data/vercel-service-account.json','utf8');
const {getFirebaseAdminApp}=await import('../src/server/firebaseAdminAuth');
const token=await getFirebaseAdminApp().options.credential!.getAccessToken();
const r=await fetch('https://identitytoolkit.googleapis.com/admin/v2/projects/specialized-study/config',{headers:{Authorization:'Bearer '+token.access_token}});
const data=await r.json();console.log(JSON.stringify({status:r.status,domains:data.authorizedDomains,error:data.error?.message}));
