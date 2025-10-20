// web/src/lib/auth.ts
export type AuthIds = { tenantId: string; userId: string };

/** Read tenantId/userId from the JWT saved by DevAuth (localStorage 'jwt'). */
export function getAuthIdsFromJwt(): AuthIds | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("jwt");
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (json?.tenantId && json?.userId) {
      return { tenantId: json.tenantId, userId: json.userId };
    }
  } catch {}
  return null;
}