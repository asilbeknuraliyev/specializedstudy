import type {UserProfile} from '../types';
// Navigation only. Every server API independently checks private grants.
export const canShowAdminUi=(user:UserProfile|null)=>!!user&&user.status==='active'&&user.emailVerified===true&&user.platformAdmin===true&&['admin','platform_owner'].includes(user.role);

export function authenticatedHome(user:UserProfile): string {
  if (user.mustChangePassword || user.mfaRequired) return '/account/security';
  if (user.leadershipDesignation) return user.leadershipDesignation==='school_administrator' ? '/school-admin/dashboard' : '/leadership/dashboard';
  if (canShowAdminUi(user)) return '/admin/dashboard';
  if (user.role==='student') return '/student/dashboard';
  if (user.role==='teacher') return '/teacher/dashboard';
  if (user.role==='staff') return '/account/security';
  return '/account/access';
}
