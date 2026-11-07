import fs from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, getDocFromServer, doc, terminate } from 'firebase/firestore';
const c=JSON.parse(fs.readFileSync('firebase-applet-config.json','utf8'));
const db=getFirestore(initializeApp(c),c.firestoreDatabaseId);
try { await getDocFromServer(doc(db,'_specialized_runtime','current'));console.log('UNSAFE: anonymous snapshot access allowed');process.exitCode=1; }
catch(e:any){console.log('Anonymous access result:',e.code);if(e.code!=='permission-denied')process.exitCode=1;}
finally { await terminate(db); }
