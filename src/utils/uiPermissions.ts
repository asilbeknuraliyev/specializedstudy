import type {UserProfile} from '../types';
// Navigation only. Every server API independently checks private grants.
export const canShowAdminUi=(user:UserProfile|null)=>!!user&&user.status==='active'&&user.emailVerified===true&&user.platformAdmin===true&&['admin','platform_owner'].includes(user.role);
