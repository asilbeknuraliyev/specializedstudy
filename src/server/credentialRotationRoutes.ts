import crypto from 'node:crypto';
import type { Express } from 'express';
import { z } from 'zod';
import { asyncRoute } from './asyncRoute';
import { leadershipGrant, mfaVerified } from './leadershipSecurity';
import { accountProviderProof } from './supabaseAuth';
import { createSchoolInitialPassword, createStudentLogin, reservedAccountLogins, schoolCredentialPolicy, studentLoginPattern } from './schoolCredentials';
import { boundedMap } from './boundedMap';
import { getImportPayload, putImportPayload } from './privateImportStore';
import { runtimeNamespace } from './runtimeScope';

const request = z.object({ operationId: z.uuid(), idToken: z.string().min(20).max(16000), confirmed: z.literal(true) });
const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const packetKind = 'rotation-v2';

type RotationRow = {
  uid: string;
  login: string;
  password: string;
  role: 'student' | 'teacher';
  displayName: string;
  classCode?: string;
  subject?: string;
  expectedHash: string;
};
type RotationPacket = { ownerId: string; schoolId: string; rows: RotationRow[] };

export function registerCredentialRotationRoutes(app: Express, deps: any) {
  const access = async (req: any, res: any) => {
    res.set('Cache-Control', 'no-store');
    const context = deps.authenticate(req);
    if (!context) { res.status(401).json({ error: 'Hisobga kiring.' }); return; }
    if (!deps.owner(context.user)) { res.status(403).json({ error: 'Faqat platforma egasiga ruxsat.' }); return; }
    if (!mfaVerified(context)) { res.status(403).json({ code: 'MFA_REQUIRED', error: 'Sessiyani MFA bilan tasdiqlang.' }); return; }
    const parsed = request.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Amalni tasdiqlang va Google orqali qayta kiring.' }); return; }
    try {
      const proof = await accountProviderProof(parsed.data.idToken, context.db);
      const age = Date.now() / 1000 - proof.auth_time;
      if (proof.uid !== context.user.uid || !proof.email_verified || proof.firebase?.sign_in_provider !== 'google.com' || !Number.isFinite(age) || age < 0 || age > 300) throw Error();
    } catch { res.status(403).json({ error: 'Yangi Google tasdig‘i kerak.' }); return; }
    return { ...context, input: parsed.data };
  };
  const audit = (context: any, action: string) => {
    context.db.auditLogs.unshift({ id: crypto.randomUUID(), institutionId: context.user.institutionId, actorUid: context.user.uid, actorName: context.user.displayName, actorRole: context.user.role, action, target: 'Credential rotation', recordId: context.input.operationId, createdAt: new Date().toISOString() });
  };
  app.post('/api/account-credential-rotations', asyncRoute(async (req, res) => {
    const context = await access(req, res);
    if (!context) return;
    const { db, user, input } = context;
    db.accountCredentialRotations ||= [];
    const existing = db.accountCredentialRotations.find((item: any) => item.id === input.operationId);
    if (existing) {
      if (existing.ownerId !== user.uid || existing.schoolId !== user.institutionId) return res.status(403).json({ error: 'Amal boshqa hisobga tegishli.' });
      if (existing.policyVersion !== schoolCredentialPolicy) return res.status(409).json({ error: 'Bu eski paket. Yangilash amalini qayta boshlang.' });
      return res.json({ id: existing.id, students: existing.students, teachers: existing.teachers, committed: true });
    }
    const jobs = (db.schoolImportJobs || []).filter((job: any) => job.institutionId === user.institutionId && job.status === 'committed' && job.committedByUid && ['students', 'teachers'].includes(job.kind));
    const users = db.users.filter((person: any) =>
      person.institutionId === user.institutionId && person.status === 'active' &&
      !(person.role === 'student' && person.lastLoginAt) &&
      person.schoolIdentityProvisioning === 'linked' && person.managedSupabaseIdentityId &&
      !leadershipGrant({db,user:person}) && person.mustChangePassword === true && person.schoolCredentialPolicyVersion !== schoolCredentialPolicy &&
      jobs.some((job: any) => person.sourceImport?.batchId === job.id &&
        job.kind === person.role + 's' && job.createdUsers.includes(person.uid)),
    );
    if (!users.length) return res.status(409).json({ error: 'Yangilanishi kerak bo‘lgan tasdiqlangan hisob topilmadi.' });
    const path = runtimeNamespace() + '/imports/' + encodeURIComponent(user.institutionId) + '/' + input.operationId + '/' + packetKind + '.enc';
    let packet: RotationPacket | undefined;
    try { packet = await getImportPayload(user.institutionId, input.operationId, packetKind, path); } catch { /* Storage writes are immutable. */ }
    if (!packet) {
      const used = reservedAccountLogins(db.users);
      const passwords = new Set<string>();
      const rows = users.map((person: any): RotationRow => {
        const login = person.role === 'student' && !studentLoginPattern.test(person.login)
          ? createStudentLogin(used) : person.login;
        return { login, password: createSchoolInitialPassword(person.role, passwords), uid: person.uid, displayName: person.displayName, role: person.role, classCode: person.classCode, subject: person.subject, expectedHash: digest(db.passwordHashes[person.uid] || '') };
      });
      packet = { ownerId: user.uid, schoolId: user.institutionId, rows };
      await putImportPayload(user.institutionId, input.operationId, packetKind, packet);
    }
    const eligible = new Map<string, any>(users.map((person: any) => [person.uid, person]));
    const reserved = reservedAccountLogins(db.users);
    if (packet.ownerId !== user.uid || packet.schoolId !== user.institutionId ||
        packet.rows.length !== eligible.size || new Set(packet.rows.map(row => row.uid)).size !== eligible.size ||
        packet.rows.some(row => {
          const person = eligible.get(row.uid);
          return !person || row.role !== person.role || digest(db.passwordHashes[row.uid] || '') !== row.expectedHash ||
            (row.login !== person.login && reserved.has(row.login));
        })) {
      return res.status(409).json({ error: 'Hisoblar parallel o‘zgargan. Yangi amal bilan qayta tekshiring.' });
    }
    const hashes = await boundedMap(packet.rows, 2, async row => ({ row, value: await deps.hash(row.password) }));
    const expiresAt = Date.now() + 7 * 86400000;
    for (const { row, value } of hashes) {
      const person = eligible.get(row.uid);
      if (person.role === 'student' && person.login !== row.login) person.loginAliases = [];
      person.login = row.login;
      person.schoolCredentialPolicyVersion = schoolCredentialPolicy;
      person.initialPasswordExpiresAt = expiresAt;
      db.passwordHashes[person.uid] = value;
      deps.revoke(person.uid, context.env);
    }
    const students = packet.rows.filter(row => row.role === 'student').length;
    const teachers = packet.rows.length - students;
    const issuedHashes = Object.fromEntries(hashes.map(({ row, value }) => [row.uid, digest(value)]));
    db.accountCredentialRotations.push({ id: input.operationId, ownerId: user.uid, schoolId: user.institutionId, students, teachers, path, issuedHashes, policyVersion: schoolCredentialPolicy, createdAt: new Date().toISOString(), expiresAt: Date.now() + 86400000 });
    audit(context, packet.rows.length + ' hisobning boshlang‘ich kirishlari almashtirildi');
    deps.save(context.env, db);
    return res.json({ id: input.operationId, students, teachers, committed: true });
  }));
  app.post('/api/account-credential-rotations/claim', asyncRoute(async (req, res) => {
    const context = await access(req, res);
    if (!context) return;
    const job = (context.db.accountCredentialRotations || []).find((item: any) => item.id === context.input.operationId && item.ownerId === context.user.uid && item.schoolId === context.user.institutionId);
    if (!job || job.policyVersion !== schoolCredentialPolicy || job.claimedAt || job.expiresAt <= Date.now()) return res.status(410).json({ error: 'Paket olingan yoki muddati tugagan.' });
    const packet = await getImportPayload<RotationPacket>(context.user.institutionId, job.id, packetKind, job.path);
    const current = new Map<string, any>(context.db.users.map((person: any) => [person.uid, person]));
    const credentials = packet.rows.filter(row => {
      const profile = current.get(row.uid);
      return profile?.institutionId === job.schoolId && profile.status === 'active' && !leadershipGrant({db:context.db,user:profile}) && profile.mustChangePassword &&
        profile.login === row.login && digest(context.db.passwordHashes[row.uid] || '') === job.issuedHashes[row.uid];
    }).map(({ expectedHash, ...row }) => {
      const profile = current.get(row.uid);
      return { ...row, status: profile.status, createdAt: profile.createdAt, mustChangePassword: profile.mustChangePassword };
    });
    job.claimedAt = new Date().toISOString();
    audit(context, 'Yangi kirishlar paketi haqiqiy MFA va Google tasdig‘i bilan bir marta olindi');
    deps.save(context.env, context.db);
    res.json({ credentials });
  }));
}
