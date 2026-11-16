import { randomBytes, randomInt } from 'node:crypto';

export function createEasySchoolCredential(
  user: { role: 'student' | 'teacher'; login: string; displayName: string },
  usedLogins: Set<string>,
) {
  if (user.role === 'student') {
    for (;;) {
      const login = 'sps' + randomInt(1_000_000, 10_000_000);
      if (usedLogins.has(login)) continue;
      usedLogins.add(login);
      return { login, password: login };
    }
  }
  // Imported teacher logins already contain the transliterated given name.
  const name = user.login.split('.')[0];
  if (!/^[a-z]{2,30}$/.test(name)) {
    throw Error('Ustozning ismli loginini avval tekshiring.');
  }
  return { login: user.login, password: name[0].toUpperCase() + name.slice(1) + '-' + randomInt(100_000, 1_000_000) };
}

export function createSchoolInitialPassword(role: 'student' | 'teacher', used: Set<string>): string {
  for (;;) {
    const parts = randomBytes(18).toString('base64url').match(/.{6}/g)!;
    const password = role === 'student' ? `sps-${parts.join('')}Aa7` : `${parts.join('-')}-Aa7`;
    if (used.has(password)) continue;
    used.add(password);
    return password;
  }
}
