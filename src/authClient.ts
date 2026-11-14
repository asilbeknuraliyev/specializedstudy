import {createClient,type Session,type User as ProviderUser} from '@supabase/supabase-js';
import config from '../supabase-public-config.json';
export interface User {uid:string;email:string|null;emailVerified:boolean;displayName:string|null;photoURL:string|null;getIdToken:(refresh?:boolean)=>Promise<string>}
const memory=new Map<string,string>();
// Only the one-time PKCE verifier survives a redirect. Provider access/refresh tokens stay in memory.
const storage={getItem:(key:string)=>key.endsWith('-code-verifier')?window.sessionStorage.getItem(key):memory.get(key)||null,setItem:(key:string,value:string)=>{if(key.endsWith('-code-verifier'))window.sessionStorage.setItem(key,value);else memory.set(key,value);},removeItem:(key:string)=>{memory.delete(key);window.sessionStorage.removeItem(key);}};
export const providerClient=createClient(config.url,config.publishableKey,{auth:{flowType:'pkce',persistSession:true,storage,autoRefreshToken:false,detectSessionInUrl:false}});
let accessToken='';
export const auth:{currentUser:User|null}={currentUser:null};
function mapped(user:ProviderUser,token:string):User{accessToken=token;return auth.currentUser={uid:user.id,email:user.email||null,emailVerified:!!user.email_confirmed_at,displayName:user.user_metadata?.full_name||user.user_metadata?.name||null,photoURL:user.user_metadata?.avatar_url||null,getIdToken:async()=>token};}
export class GoogleAuthProvider {setCustomParameters(_parameters:Record<string,string>){} }
export const createGoogleAuthProvider=()=>new GoogleAuthProvider();
export const getIdToken=async(_user:User,_refresh=false)=>accessToken;
export const getIdTokenResult=async(_user:User,_refresh=false)=>({claims:{provider:'supabase'}});
export function onAuthStateChanged(_auth:typeof auth,listener:(user:User|null)=>unknown){const {data}=providerClient.auth.onAuthStateChange((_event,session)=>{if(session){mapped(session.user,session.access_token);void listener(auth.currentUser);}else{auth.currentUser=null;void listener(null);}});return()=>data.subscription.unsubscribe();}
let redirectResult:Promise<{user:User}|null>|undefined;
export function getRedirectResult(_auth:typeof auth){return redirectResult||=(async()=>{
 const url=new URL(window.location.href);if(window.opener||url.pathname!=='/auth/callback')return null;
 const code=url.searchParams.get('code');if(!code)return null;
 window.history.replaceState({},'',url.pathname);
 const {data,error}=await providerClient.auth.exchangeCodeForSession(code);if(error||!data.session)throw Error('Google kirishini tasdiqlab bo‘lmadi.');
 return{user:mapped(data.user,data.session.access_token)};
})();}
async function authorizeUrl(redirectTo:string){const {data,error}=await providerClient.auth.signInWithOAuth({provider:'google',options:{redirectTo,skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});if(error||!data.url)throw Error('Google kirishi sozlanmagan.');const url=new URL(data.url);if(url.origin!==config.url||url.pathname!=='/auth/v1/authorize')throw Error('Kirish manzili rad etildi.');return data.url;}
export async function signInWithRedirect(_auth:typeof auth,_provider:GoogleAuthProvider){window.location.assign(await authorizeUrl(window.location.origin+'/auth/callback'));}
export async function signInWithPopup(_auth:typeof auth,_provider:GoogleAuthProvider):Promise<{user:User}>{
 const nonce=crypto.randomUUID();window.sessionStorage.setItem('ss_oauth_popup_nonce',nonce);
 const popup=window.open('about:blank','ss-google-'+nonce,'popup,width=520,height=720');
 window.sessionStorage.removeItem('ss_oauth_popup_nonce');
 if(!popup)throw Object.assign(Error('Kirish oynasiga ruxsat bering.'),{code:'auth/popup-blocked'});
 try{
  const url=await authorizeUrl(window.location.origin+'/auth/callback');
  const code=await new Promise<string>((resolve,reject)=>{
   let done=false;const finish=(error?:Error,value?:string)=>{if(done)return;done=true;window.removeEventListener('message',received);clearInterval(poll);clearTimeout(timeout);if(error)reject(error);else resolve(value!);};
   const received=(event:MessageEvent)=>{if(event.origin!==window.location.origin||event.source!==popup||event.data?.type!=='ss-oauth-code'||event.data.nonce!==nonce)return;if(typeof event.data.code!=='string'||event.data.code.length>4000)return finish(Error('Kirish javobi rad etildi.'));finish(undefined,event.data.code);};
   const poll=setInterval(()=>{if(popup.closed)finish(Object.assign(Error('Kirish oynasi yopildi.'),{code:'auth/popup-closed-by-user'}));},500),timeout=setTimeout(()=>finish(Error('Kirish vaqti tugadi.')),180000);
   window.addEventListener('message',received);popup.location.assign(url);
  });
  const {data,error}=await providerClient.auth.exchangeCodeForSession(code);if(error||!data.session)throw Error('Google sessiyasini tekshirib bo‘lmadi.');return{user:mapped(data.user,data.session.access_token)};
 }finally{popup.close();}
}
export async function signOut(_auth:typeof auth){await providerClient.auth.signOut({scope:'local'});accessToken='';auth.currentUser=null;memory.clear();}
export const getRuntimeAuthDomainDiagnostics=()=>({origin:window.location.origin,hostname:window.location.hostname,protocol:window.location.protocol,projectId:new URL(config.url).hostname.split('.')[0],authDomain:new URL(config.url).hostname,appId:'supabase',isLocalhost:['localhost','127.0.0.1'].includes(window.location.hostname),isVercelDomain:window.location.hostname.endsWith('.vercel.app'),isVercelPreviewDomain:window.location.hostname.includes('-git-'),isFirebaseHostedDomain:false,isCloudRunDomain:false,recommendedAuthorizedDomains:[window.location.origin+'/auth/callback']});
