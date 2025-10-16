// web/src/lib/api.ts

/** Sanitize + resolve the API base from envs */
function sanitizeBase(v?: string | null): string {
  const raw = (v ?? "").trim();
  const val = (raw || "http://localhost:4000").replace(/\/+$/g, "");
  if (!/^https?:\/\//i.test(val)) throw new Error("API base must include http/https");
  return val;
}

// Prefer URL (clean), then BASE as fallback
export const API_BASE = sanitizeBase(
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE)) || ""
);

// TEMP: prove what the browser is using (remove after verifying)
if (typeof window !== "undefined") {
  console.log("[API_BASE]", JSON.stringify(API_BASE));
}

/* ---------------- JWT helpers ---------------- */

export function getJwt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("jwt");
  } catch {
    return null;
  }
}

export function setJwt(token: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("jwt", token);
  } catch {}
  // Cookie is not used cross-domain, but keep it for localhost/subdomain cases
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `jwt=${encodeURIComponent(
    token
  )}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
}

export function clearJwt() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("jwt");
  } catch {}
  document.cookie = `jwt=; Path=/; Max-Age=0; SameSite=Lax`;
}

/* ---------------- JSON fetch helper ---------------- */

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const cleanPath = (path || "").trim();
  const url = cleanPath.startsWith("http")
    ? cleanPath
    : `${API_BASE}${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;

  const headers = new Headers(init.headers);
  // Always send JSON unless caller overrides
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  // Attach JWT as Bearer (critical for cross-domain API on Render)
  const token = getJwt();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let body: BodyInit | null | undefined = init.body as any;
  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }

  // Cookies are irrelevant cross-domain; leaving include is harmless
  const res = await fetch(url, { ...init, headers, body, credentials: "include" });
  const raw = await res.text();
  const json = raw ? safeJson(raw) : null;

  if (!res.ok) {
    const msg = (json as any)?.error || (json as any)?.message || `Request failed ${res.status}`;
    const e = new Error(`${msg} for ${url}`) as any;
    e.status = res.status;
    e.body = raw;
    throw e;
  }
  return (json as T) ?? ({} as T);
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/* ---------------- Dev helper: ensureDemoAuth ---------------- */

export async function ensureDemoAuth(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (getJwt()) return true;

  // Try real login first (works if demo user exists)
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: "erin@acme.test", password: "secret12" }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data?.jwt) {
        setJwt(data.jwt);
        return true;
      }
    }
  } catch {}

  // Fallback: ask API to create demo tenant/user and return a token
  try {
    const seeded = await fetch(`${API_BASE}/seed`, { method: "POST", credentials: "include" });
    if (seeded.ok) {
      const data = await seeded.json().catch(() => ({}));
      if (data?.jwt) {
        setJwt(data.jwt);
        return true;
      }
    }
  } catch {}

  return false;
}