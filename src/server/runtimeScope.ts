export function runtimeNamespace(env:NodeJS.ProcessEnv=process.env){
 const name=env.PERSISTENCE_NAMESPACE||'_specialized_runtime';
 if(name!=='_specialized_runtime'&&!/^_specialized_preview_[a-z0-9_]{1,40}$/.test(name))throw Error('Invalid persistence namespace');
 if(env.VERCEL_ENV==='preview'&&name==='_specialized_runtime')throw Error('Preview must use an isolated Firestore namespace');
 if(env.VERCEL_ENV==='production'&&name!=='_specialized_runtime')throw Error('Production namespace cannot be overridden');
 return name;
}
