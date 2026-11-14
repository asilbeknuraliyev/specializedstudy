import type { RequestHandler } from "express";
export function createPrivateApiPreflight(
  verify: (token: string | undefined) => { env: "prod" | "test" } | null,
  token: (req: any) => string | undefined,
): RequestHandler {
  return (req, res, next) => {
    if(!req.path.startsWith('/api/'))return next();
    if(/^\/api\/learning-demo(?:\/|$)/.test(req.path)&&!String(process.env.PERSISTENCE_NAMESPACE||'').startsWith('_specialized_preview_'))return res.status(404).json({error:'Topilmadi.'});
    if(req.path==='/api/test/reset'&&process.env.NODE_ENV!=='test')return res.status(404).json({error:'Topilmadi.'});
    if(/^\/api\/(?:health$|auth\/(?:login|provider-sync|firebase-sync|diagnostics|bootstrap-status|bootstrap|register-with-invite)$|invitations\/preview\/[^/]+$)/.test(req.path)||(req.path==='/api/test/reset'&&process.env.NODE_ENV==='test'))return next();
    const signed = verify(token(req));
    if (!signed || (signed.env === "test" && process.env.NODE_ENV !== "test"))
      return res
        .status(401)
        .json({ code: "LOGIN_REQUIRED", error: "Hisobga kiring." });
    res.locals.signedUid=(signed as any).uid;
    // Signature preflight only: normal handlers still load durable revocation, status and resource permissions.
    next();
  };
}
