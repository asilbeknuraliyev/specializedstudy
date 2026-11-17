import { randomInt } from 'node:crypto';

export const schoolCredentialPolicy = 2;
export const studentLoginPattern = /^sps[0-9]{7}$/;

const readable = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const consonants = 'bdfghjklmnprstvz';
const vowels = 'aeiou';

function sample(alphabet: string) {
  return alphabet[randomInt(alphabet.length)];
}

export function reservedAccountLogins(users: Array<{ login?: string; email?: string; loginAliases?: string[] }>) {
  return new Set(users.flatMap(user => [user.login, user.email, ...(user.loginAliases || [])])
    .filter((value): value is string => Boolean(value))
    .map(value => value.toLowerCase()));
}

export function createStudentLogin(used: Set<string>): string {
  for (let attempt = 0; attempt < 64; attempt++) {
    const login = 'sps' + String(randomInt(10_000_000)).padStart(7, '0');
    if (used.has(login)) continue;
    used.add(login);
    return login;
  }
  throw Error('Bo‘sh o‘quvchi loginini ajratib bo‘lmadi.');
}

export function createSchoolInitialPassword(role: 'student' | 'teacher', used: Set<string>): string {
  for (;;) {
    // The 15 readable symbols supply 75 random bits. Teacher phrases use
    // independent syllables and two digits for about 81 random bits.
    const password = role === 'student'
      ? 'sps-' + Array.from({ length: 3 }, () => Array.from({ length: 5 }, () => sample(readable)).join('')).join('-')
      : Array.from({ length: 6 }, () => (
        sample(consonants).toUpperCase() + sample(vowels) + sample(consonants) + sample(vowels)
      )).join('-') + '-' + String(randomInt(100)).padStart(2, '0');
    if (used.has(password)) continue;
    used.add(password);
    return password;
  }
}
