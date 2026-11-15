import {createClient, type SupabaseClient} from '@supabase/supabase-js';
let client:SupabaseClient|undefined;
let identityClient:SupabaseClient|undefined;
export const supabaseEnabled=()=>process.env.PERSISTENCE_DRIVER==='supabase';
export function serverSupabase(){
 if(client)return client;
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key||key.length<30)throw Error('Supabase server configuration missing');
 if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url))throw Error('Invalid Supabase origin');
 return client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
// A staging data key must never be able to administer production identities/data.
// Shared Google login verification needs only the public Auth key plus the user's token.
export function sharedIdentityProvider(){return Boolean(process.env.SUPABASE_AUTH_URL&&process.env.SUPABASE_AUTH_URL!==process.env.SUPABASE_URL);}
export function serverSupabaseIdentity(){
 if(!sharedIdentityProvider())return serverSupabase();
 if(identityClient)return identityClient;
 const url=process.env.SUPABASE_AUTH_URL,key=process.env.SUPABASE_AUTH_PUBLISHABLE_KEY;
 if(!url||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)||!key||!key.startsWith('sb_publishable_'))throw Error('Identity provider configuration missing');
 return identityClient=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function studyRpc<T=any>(name:string,args:Record<string,unknown>):Promise<T>{
 if(!/^study_[a-z_]+$/.test(name))throw Error('Invalid RPC');
 const {data,error}=await serverSupabase().rpc(name,args);
 if(error){const e=Error(error.code==='40001'?'PERSISTENCE_CONFLICT':'Supabase operation failed');Object.assign(e,{code:error.code});throw e;}
 return data as T;
}
