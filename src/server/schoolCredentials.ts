import { randomBytes } from 'node:crypto';

export function createSchoolInitialPassword(role: 'student' | 'teacher', used: Set<string>): string {
  for (;;) {
    const parts = randomBytes(18).toString('base64url').match(/.{6}/g)!;
    const password = role === 'student' ? `sps-${parts.join('')}Aa7` : `${parts.join('-')}-Aa7`;
    if (used.has(password)) continue;
    used.add(password);
    return password;
  }
}
