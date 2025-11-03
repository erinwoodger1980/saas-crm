// web/src/lib/auth.ts
export type AuthIds = { tenantId: string; userId: string };

/** Read tenantId/userId from the JWT saved by DevAuth (localStorage 'jwt'). */
export function getAuthIdsFromJwt(): AuthIds | null {
  if (typeof window === "undefined") return null;
  
  try {
    const token = localStorage.getItem("jwt");
    if (!token) {
      console.debug("No JWT token found in localStorage");
      return null;
    }
    
    const parts = token.split(".");
    if (parts.length !== 3) {
      console.warn("Invalid JWT format: expected 3 parts, got", parts.length);
      return null;
    }
    
    const payload = parts[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    
    if (json?.tenantId && json?.userId) {
      return { tenantId: json.tenantId, userId: json.userId };
    } else {
      console.warn("JWT payload missing tenantId or userId:", json);
      return null;
    }
  } catch (error) {
    console.error("Error parsing JWT:", error);
    return null;
  }
}