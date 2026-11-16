import type {SupabaseClient,User as ProviderUser} from '@supabase/supabase-js';
import config from '../supabase-public-config.json';
export interface User {uid:string;email:string|null;emailVerified:boolean;displayName:string|null;photoURL:string|null;getIdToken:(refresh?:boolean)=>Promise<string>}
const memory=new Map<string,string>();
// Only the one-time PKCE verifier survives a redirect. Provider access/refresh tokens stay in memory.
const storage={getItem:(key:string)=>key.endsWith('-code-verifier')?window.sessionStorage.getItem(key):memory.get(key)||null,setItem:(key:string,value:string)=>{if(key.endsWith('-code-verifier'))window.sessionStorage.setItem(key,value);else memory.set(key,value);},removeItem:(key:string)=>{memory.delete(key);window.sessionStorage.removeItem(key);}};
const listeners=new Set<(user:User|null)=>unknown>();
let providerPromise:Promise<SupabaseClient>|undefined;
async function getProviderClient(){return providerPromise||=(import('@supabase/supabase-js').then(({createClient})=>{const client=createClient(config.url,config.publishableKey,{auth:{flowType:'pkce',persistSession:true,storage,autoRefreshToken:false,detectSessionInUrl:false}});client.auth.onAuthStateChange((_event,session)=>{if(window.location.pathname==='/auth/callback'&&getGoogleProofIntent())return;if(session)mapped(session.user,session.access_token);else auth.currentUser=null;if(window.location.pathname!=='/auth/callback')for(const listener of listeners)void listener(auth.currentUser);});return client;}));}
let accessToken='';
export const auth:{currentUser:User|null}={currentUser:null};
function mapped(user:ProviderUser,token:string):User{accessToken=token;return auth.currentUser={uid:user.id,email:user.email||null,emailVerified:!!user.email_confirmed_at,displayName:user.user_metadata?.full_name||user.user_metadata?.name||null,photoURL:user.user_metadata?.avatar_url||null,getIdToken:async()=>token};}
export class GoogleAuthProvider {setCustomParameters(_parameters:Record<string,string>){} }
export const createGoogleAuthProvider=()=>new GoogleAuthProvider();
export const getIdToken=async(_user:User,_refresh=false)=>accessToken;
export const getIdTokenResult=async(_user:User,_refresh=false)=>({claims:{provider:'supabase'}});
export function onAuthStateChanged(_auth:typeof auth,listener:(user:User|null)=>unknown){listeners.add(listener);return()=>{listeners.delete(listener);};}
let redirectResult:Promise<{user:User}|null>|undefined;
type GoogleProofIntent = { kind: 'mfa' } | { kind: 'credentials'; jobId: string };
const proofStorageKey = 'ss_google_proof_intent';
const proofLifetime = 5 * 60_000;
let callbackIntent: GoogleProofIntent | null | undefined;
let proofReply: { idToken?: string; error?: string; intent: GoogleProofIntent } | undefined;

export function getGoogleProofIntent(): GoogleProofIntent | null {
 if (window.location.pathname !== '/auth/callback') return null;
 if (callbackIntent !== undefined) return callbackIntent;
 callbackIntent = null;
 try {
  const intent = JSON.parse(sessionStorage.getItem(proofStorageKey) || 'null');
  sessionStorage.removeItem(proofStorageKey);
  if (!intent || !Number.isFinite(intent.expiresAt) || Date.now() >= intent.expiresAt) return null;
  if (intent.kind === 'mfa') callbackIntent = { kind: 'mfa' };
  if (intent.kind === 'credentials' && /^school-[a-f0-9]{40}$/.test(intent.jobId)) {
   callbackIntent = { kind: 'credentials', jobId: intent.jobId };
  }
 } catch { /* Invalid local data is ignored. */ }
 return callbackIntent;
}

export function takeGoogleProof(kind: GoogleProofIntent['kind']) {
 if (proofReply?.intent.kind !== kind) return undefined;
 const reply = proofReply;
 proofReply = undefined;
 return reply;
}

async function exchangeGoogleCode(code:string) {
 if(code.length>4000)throw Error('Google tasdig‘i yaroqsiz.');
 const {data,error}=await (await getProviderClient()).auth.exchangeCodeForSession(code);
 if(error||!data.session)throw Error('Google kirishini tasdiqlab bo‘lmadi.');
 return data.session;
}

let proofCompletion:Promise<string>|undefined;
export function completeGoogleProof(intent:GoogleProofIntent) {
 return proofCompletion||=(async()=>{
  const url=new URL(window.location.href);
  const code=url.searchParams.get('code');
  window.history.replaceState(window.history.state,'',url.pathname);
  try {
   if(!code||url.searchParams.has('error'))throw Error('Google tasdig‘i yakunlanmadi.');
   const session=await exchangeGoogleCode(code);
   proofReply={intent,idToken:session.access_token};
  } catch {
   proofReply={intent,error:'Google tasdig‘i yakunlanmadi. Qayta urinib ko‘ring.'};
  }
  return intent.kind==='mfa'?'/account/security':'/admin/school-imports';
 })();
}

export function getRedirectResult(_auth:typeof auth){return redirectResult||=(async()=>{
 const url=new URL(window.location.href);if(window.opener||window.sessionStorage.getItem('ss_oauth_popup_nonce')||url.pathname!=='/auth/callback'||getGoogleProofIntent())return null;
 const code=url.searchParams.get('code');if(!code)return null;
 window.history.replaceState(window.history.state,'',url.pathname);
 const session=await exchangeGoogleCode(code);
 return {user:mapped(session.user,session.access_token)};
})();}
async function authorizeUrl(redirectTo:string){const {data,error}=await (await getProviderClient()).auth.signInWithOAuth({provider:'google',options:{redirectTo,skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});if(error||!data.url)throw Error('Google kirishi sozlanmagan.');const url=new URL(data.url);if(url.origin!==config.url||url.pathname!=='/auth/v1/authorize')throw Error('Kirish manzili rad etildi.');return data.url;}
export async function signInWithRedirect(_auth:typeof auth,_provider:GoogleAuthProvider){sessionStorage.removeItem(proofStorageKey);window.location.assign(await authorizeUrl(window.location.origin+'/auth/callback'));}
export async function startGoogleProof(intent:GoogleProofIntent) {
 const url=await authorizeUrl(window.location.origin+'/auth/callback');
 sessionStorage.setItem(proofStorageKey,JSON.stringify({...intent,expiresAt:Date.now()+proofLifetime}));
 window.location.assign(url);
}
export async function signInWithPopup(_auth:typeof auth,_provider:GoogleAuthProvider):Promise<{user:User}>{
 const nonce=crypto.randomUUID();window.sessionStorage.setItem('ss_oauth_popup_nonce',nonce);
 const popup=window.open('about:blank','ss-google-'+nonce,'popup,width=520,height=720');
 window.sessionStorage.removeItem('ss_oauth_popup_nonce');
 if(!popup)throw Object.assign(Error('Kirish oynasiga ruxsat bering.'),{code:'auth/popup-blocked'});
 try{
  const url=await authorizeUrl(window.location.origin+'/auth/callback');
  const code=await new Promise<string>((resolve,reject)=>{
   // OAuth providers may sever window.opener through COOP. The same-origin channel
   // is scoped by a one-time random nonce; the resulting code still requires our PKCE verifier.
   const channel=typeof BroadcastChannel==='undefined'?undefined:new BroadcastChannel('ss-oauth-'+nonce);
   let done=false;const finish=(error?:Error,value?:string)=>{if(done)return;done=true;window.removeEventListener('message',received);channel?.close();clearInterval(poll);clearTimeout(timeout);if(error)reject(error);else resolve(value!);};
   const received=(event:MessageEvent)=>{if(event.origin!==window.location.origin||event.source!==popup||event.data?.type!=='ss-oauth-code'||event.data.nonce!==nonce)return;if(typeof event.data.code!=='string'||event.data.code.length>4000)return finish(Error('Kirish javobi rad etildi.'));finish(undefined,event.data.code);};
   if(channel)channel.onmessage=(event)=>{if(event.origin!==window.location.origin||event.data?.type!=='ss-oauth-code'||event.data.nonce!==nonce)return;if(typeof event.data.code!=='string'||event.data.code.length>4000)return finish(Error('Kirish javobi rad etildi.'));finish(undefined,event.data.code);};
   const poll=setInterval(()=>{if(!channel&&popup.closed)finish(Object.assign(Error('Kirish oynasi yopildi.'),{code:'auth/popup-closed-by-user'}));},500),timeout=setTimeout(()=>finish(Error('Kirish vaqti tugadi.')),180000);
   window.addEventListener('message',received);popup.location.assign(url);
  });
  const {data,error}=await (await getProviderClient()).auth.exchangeCodeForSession(code);if(error||!data.session)throw Error('Google sessiyasini tekshirib bo‘lmadi.');return{user:mapped(data.user,data.session.access_token)};
 }finally{popup.close();}
}
export async function signOut(_auth:typeof auth){await (await getProviderClient()).auth.signOut({scope:'local'});accessToken='';auth.currentUser=null;memory.clear();}
export const getRuntimeAuthDomainDiagnostics=()=>({origin:window.location.origin,hostname:window.location.hostname,protocol:window.location.protocol,projectId:new URL(config.url).hostname.split('.')[0],authDomain:new URL(config.url).hostname,appId:'supabase',isLocalhost:['localhost','127.0.0.1'].includes(window.location.hostname),isVercelDomain:window.location.hostname.endsWith('.vercel.app'),isVercelPreviewDomain:window.location.hostname.includes('-git-'),isFirebaseHostedDomain:false,isCloudRunDomain:false,recommendedAuthorizedDomains:[window.location.origin+'/auth/callback']});
