import fs from 'node:fs';
process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT=fs.readFileSync('.data/vercel-service-account.json','utf8');
const {readCloudState}=await import('../src/server/cloudState');
const data=await readCloudState();console.log(JSON.stringify({remoteRevision:data.revision,lessons:data.state.lessons.filter(l=>l.status==='published').length,workPlans:data.state.workPlans.length,tLessons:data.state.lessons.filter(l=>l.status==='published'&&l.additionalCurriculumAssignment&&l.tTrackVisibilityApproved).length}));
