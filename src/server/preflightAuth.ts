import type { RequestHandler } from "express";
export function createPrivateApiPreflight(
  verify: (token: string | undefined) => { env: "prod" | "test" } | null,
  token: (req: any) => string | undefined,
): RequestHandler {
  return (req, res, next) => {
    if (
      !/^\/api\/(?:state(?:\/|$)|exams(?:\/|$)|assessments\/submit$|workspace(?:\/|$)|school-admin(?:\/|$)|topic[-/]|spaced-review(?:\/|$)|learning-privacy(?:\/|$)|accounts(?:\/|$)|ai(?:\/|$)|events$)/.test(
        req.path,
      )
    )
      return next();
    const signed = verify(token(req));
    if (!signed || (signed.env === "test" && process.env.NODE_ENV !== "test"))
      return res
        .status(401)
        .json({ code: "LOGIN_REQUIRED", error: "Hisobga kiring." });
    // Signature preflight only: normal handlers still load durable revocation, status and resource permissions.
    next();
  };
}
