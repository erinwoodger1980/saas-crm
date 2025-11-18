import type { NextRequest } from "next/server";

export type AuthContext = {
  tenantId: string;
  userId?: string | null;
  role?: string | null;
  impersonating?: boolean;
};

type JwtPayload = {
  tenantId?: string;
  userId?: string;
  role?: string;
  impersonating?: boolean;
  tenant?: { id?: string; tenantId?: string } | null;
  sub?: string;
  uid?: string;
};

function decodeJwt(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getCookieValue(header: string | null | undefined, name: string) {
  if (!header) return null;
  return header
    .split(";")
    .map((part) => part.trim())
    .map((part) => part.split("="))
    .find(([key]) => key === name)?.[1] || null;
}

function extractTokenFromRequest(req?: NextRequest | Request) {
  if (!req) return null;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.get("cookie");
  return (
    getCookieValue(cookieHeader, "jauth") ||
    getCookieValue(cookieHeader, "jid") ||
    getCookieValue(cookieHeader, "jwt")
  );
}

export function resolveAuthContext(req: NextRequest | Request): AuthContext | null {
  const manualTenant = req.headers.get("x-tenant-id")?.trim() || null;
  const manualUser = req.headers.get("x-user-id")?.trim() || null;

  const token = extractTokenFromRequest(req);
  const payload = token ? decodeJwt(token) : null;

  const tenantId =
    manualTenant ||
    payload?.tenantId ||
    payload?.tenant?.tenantId ||
    payload?.tenant?.id ||
    null;

  if (!tenantId) {
    return null;
  }

  const userId = manualUser || payload?.userId || payload?.uid || payload?.sub || null;

  return {
    tenantId,
    userId,
    role: payload?.role ?? null,
    impersonating: payload?.impersonating ?? false,
  };
}
