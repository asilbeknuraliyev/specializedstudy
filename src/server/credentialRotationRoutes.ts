import crypto from 'node:crypto';
import type { Express } from 'express';
import { z } from 'zod';
import { asyncRoute } from './asyncRoute';
import { mfaVerified } from './leadershipSecurity';
import { accountProviderProof } from './supabaseAuth';
import { createEasySchoolCredential } from './schoolCredentials';
import { boundedMap } from './boundedMap';
import { getImportPayload, putImportPayload } from './privateImportStore';
import { runtimeNamespace } from './runtimeScope';

const request = z.object({ operationId: z.uuid(), idToken: z.string().min(20).max(16000), confirmed: z.literal(true) });
const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

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
      return res.json({ id: existing.id, students: existing.students, teachers: existing.teachers, committed: true });
    }
    const jobs = (db.schoolImportJobs || []).filter((job: any) => job.institutionId === user.institutionId && job.status === 'committed' && ['students', 'teachers'].includes(job.kind));
    const ids = new Set(jobs.flatMap((job: any) => job.createdUsers));
    const users = db.users.filter((person: any) => ids.has(person.uid) && person.institutionId === user.institutionId && ['student', 'teacher'].includes(person.role));
    if (users.filter((person: any) => person.role === 'student').length !== 426 || users.filter((person: any) => person.role === 'teacher').length !== 24 || users.some((person: any) => person.schoolIdentityProvisioning !== 'linked' || person.status !== 'active')) {
      return res.status(409).json({ error: '426 o‘quvchi va 24 ustoz ro‘yxatini qayta tekshiring.' });
    }
    const path = runtimeNamespace() + '/imports/' + encodeURIComponent(user.institutionId) + '/' + input.operationId + '/rotation.enc';
    let packet: any;
    try { packet = await getImportPayload(user.institutionId, input.operationId, 'rotation', path); } catch { /* An immutable write below detects conflicting or unreadable existing packets. */ }
    if (!packet) {
      const used = new Set<string>(db.users.flatMap((person: any) => [person.login, person.email, ...(person.loginAliases || [])]).filter(Boolean).map((value: string) => value.toLowerCase()));
      const passwords = new Set<string>();
      const rows = users.map((person: any) => {
        let credential;
        do { credential = createEasySchoolCredential(person, used); } while (passwords.has(credential.password));
        passwords.add(credential.password);
        return { ...credential, uid: person.uid, displayName: person.displayName, role: person.role, classCode: person.classCode, subject: person.subject, expectedHash: digest(db.passwordHashes[person.uid] || '') };
      });
      packet = { ownerId: user.uid, schoolId: user.institutionId, rows };
      await putImportPayload(user.institutionId, input.operationId, 'rotation', packet);
    }
    if (packet.ownerId !== user.uid || packet.schoolId !== user.institutionId || packet.rows.length !== 450 || new Set(packet.rows.map((row: any) => row.uid)).size !== 450 || packet.rows.some((row: any) => !ids.has(row.uid) || digest(db.passwordHashes[row.uid] || '') !== row.expectedHash)) {
      return res.status(409).json({ error: 'Hisoblar parallel o‘zgargan. Yangi amal bilan qayta tekshiring.' });
    }
    const hashes = await boundedMap(packet.rows, 2, async (row: any) => ({ uid: row.uid, value: await deps.hash(row.password) }));
    const expiresAt = Date.now() + 7 * 86400000;
    for (const row of packet.rows) {
      const person = users.find((value: any) => value.uid === row.uid);
      person.login = row.login;
      if (person.role === 'student') person.loginAliases = [];
      person.mustChangePassword = true;
      person.initialPasswordExpiresAt = expiresAt;
      db.passwordHashes[person.uid] = hashes.find(value => value.uid === person.uid)!.value;
      deps.revoke(person.uid, context.env);
    }
    db.accountCredentialRotations.push({ id: input.operationId, ownerId: user.uid, schoolId: user.institutionId, students: 426, teachers: 24, path, createdAt: new Date().toISOString(), expiresAt: Date.now() + 86400000 });
    audit(context, '450 hisob boshlang‘ich kirishlari MFA va yangi Google tasdig‘i bilan almashtirildi');
    deps.save(context.env, db);
    return res.json({ id: input.operationId, students: 426, teachers: 24, committed: true });
  }));
  app.post('/api/account-credential-rotations/claim', asyncRoute(async (req, res) => {
    const context = await access(req, res);
    if (!context) return;
    const job = (context.db.accountCredentialRotations || []).find((item: any) => item.id === context.input.operationId && item.ownerId === context.user.uid && item.schoolId === context.user.institutionId);
    if (!job || job.claimedAt || job.expiresAt <= Date.now()) return res.status(410).json({ error: 'Paket olingan yoki muddati tugagan.' });
    const packet: any = await getImportPayload(context.user.institutionId, job.id, 'rotation', job.path);
    job.claimedAt = new Date().toISOString();
    audit(context, 'Yangi kirishlar paketi haqiqiy MFA va Google tasdig‘i bilan bir marta olindi');
    deps.save(context.env, context.db);
    res.json({ credentials: packet.rows.map(({ expectedHash, ...row }: any) => row) });
  }));
}
