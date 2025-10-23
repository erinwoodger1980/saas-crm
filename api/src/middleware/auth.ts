// saas-crm/api/src/middleware/auth.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";

/** Match the shape you sign in /auth/login */
export interface AuthPayload {
  userId: string;
  tenantId: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/** Augment Express.Request with `auth` */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

/**
 * Require a valid JWT from either:
 * - Authorization: Bearer <token>
 * - Cookie: jauth=<token>
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;

  // `req.cookies` is provided by cookie-parser
  const cookieTok = (req as any).cookies?.jauth as string | undefined;

  const token = bearer || cookieTok;
  if (!token) return res.status(401).json({ error: "unauthorized" });

  try {
    const payload = jwt.verify(token, env.APP_JWT_SECRET) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}