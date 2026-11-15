import crypto from 'node:crypto';
import type {Invitation} from '../types';
export const secureInviteShape=(raw:string)=>/^INV-[A-Z0-9]{1,3}-[A-F0-9]{48}$/.test(raw);
export const INVITATION_TTL_MS=72*60*60*1000;
export const invitationDigest=(raw:string)=>'sha256:'+crypto.createHash('sha256').update(raw.trim().toUpperCase()).digest('hex');
export function findSecureInvitation(invitations:Invitation[],raw:string){const token=raw.trim().toUpperCase();return secureInviteShape(token)?invitations.find(v=>v.tokenHash===invitationDigest(token)):undefined;}
export function validateSecureInvitation(raw:string,invitation:Invitation|undefined,now=new Date().toISOString()){
 const valid=!!invitation&&secureInviteShape(raw)&&invitation.tokenHash===invitationDigest(raw)&&invitation.status==='pending'&&Number.isFinite(Date.parse(invitation.expiresAt))&&Date.parse(invitation.expiresAt)>Date.parse(now)&&Date.parse(invitation.expiresAt)<=Date.parse(invitation.createdAt)+INVITATION_TTL_MS+1000;
 return{valid,error:valid?undefined:'Taklif kodi yaroqsiz, ishlatilgan yoki muddati tugagan.'};
}
