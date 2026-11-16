import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { runtimeNamespace } from './runtimeScope';
import { serverSupabase } from './supabaseClient';

async function retryAuthRead<T extends {error?: {status?:number;name?:string} | null}>(read: () => Promise<T>): Promise<T> {
  for (let attempt=0; ; attempt++) {
    const result=await read();
    const status=result.error?.status;
    const transient=status===429||status===0||(status!==undefined&&status>=500)||result.error?.name==='AuthRetryableFetchError';
    if(!transient||attempt===2)return result;
    await delay(250*2**attempt);
  }
}

/** The school username and hashed password remain authoritative in the application. */
export async function ensureManagedSchoolIdentity(schoolId: string, uid: string): Promise<string> {
  const hex = createHash('sha256').update(JSON.stringify([runtimeNamespace(), schoolId, uid])).digest('hex');
  const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
  const email = `school-${hex.slice(0,40)}@accounts.specialized.invalid`;
  const admin = serverSupabase().auth.admin;
  const read = () => retryAuthRead(() => admin.getUserById(id));
  let result = await read();
  for (let attempt=0; result.error?.status===404&&attempt<3; attempt++) {
    const created = await admin.createUser({
      id, email, email_confirm: false, ban_duration: '876000h',
      app_metadata: { schoolManagedIdentity: true, schoolId, applicationUid: uid },
    });
    // A duplicate or ambiguous network result is safe only when read-back matches our identity.
    if(!created.error){result=created;break;}
    result=await read();
    const status=created.error.status;
    if(status!==429&&status!==0&&!(status!==undefined&&status>=500)&&created.error.name!=='AuthRetryableFetchError')break;
    if(result.error?.status===404&&attempt<2)await delay(250*2**attempt);
  }
  const identity = result.data?.user;
  const bannedUntil = Date.parse((identity as {banned_until?:string} | undefined)?.banned_until || '');
  if (result.error || !identity || identity.id !== id || identity.email !== email ||
      identity.app_metadata?.schoolManagedIdentity !== true || identity.app_metadata.schoolId !== schoolId ||
      identity.app_metadata.applicationUid !== uid || identity.email_confirmed_at ||
      !(bannedUntil > Date.now())) {
    throw new Error('Managed school identity could not be verified');
  }
  return identity.id;
}
