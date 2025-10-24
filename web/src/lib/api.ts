// web/src/lib/api.ts

/** Resolve API base from envs (must include http/https) */
// --- Safe env access without Node typings ---

// minimal declaration so TS stops complaining without @types/node
declare const process: { env?: Record<string, string | undefined> };

/**
 * Single source of truth for the browser app to know the API base.
 * Keep empty string as a safe fallback (prevents accidentally hitting localhost in prod).
 */
export const API_BASE = (typeof process !== "undefined" && process?.env?.NEXT_PUBLIC_API_BASE
  ? String(process.env.NEXT_PUBLIC_API_BASE)
  : "").replace(/\/+$/g, "");

if (!API_BASE && typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.warn("API_BASE is empty; set NEXT_PUBLIC_API_BASE in your env.");
}

/* ------------------------------------------------------------------ */
/* Back-compat JWT helpers (some code still imports these)             */
/* We use HttpOnly cookie for auth now; these are best-effort helpers. */
/* ------------------------------------------------------------------ */

export const JWT_EVENT_NAME = "joinery:jwt-change";

function emitJwtChange(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    const ev = new CustomEvent(JWT_EVENT_NAME, { detail: { token } });
    window.dispatchEvent(ev);
  } catch {}
}

/** Try to read a non-HttpOnly jwt from localStorage/cookies (legacy) */
export function getJwt(): string | null {
  if (typeof window === "undefined") return null;

  // 1) localStorage (legacy)
  try {
    const v = localStorage.getItem("jwt");
    if (v) return v;
  } catch {}

  // 2) Non-HttpOnly cookies (legacy names: jid/jwt)
  try {
    const cookie = document.cookie || "";
    const rx = (name: string) => new RegExp(`(?:^|;\\s*)${name}=([^;]+)`);
    const m1 = cookie.match(rx("jid"));
    if (m1) return decodeURIComponent(m1[1]);
    const m2 = cookie.match(rx("jwt"));
    if (m2) return decodeURIComponent(m2[1]);
  } catch {}

  return null;
}

/** Keep writing the legacy non-HttpOnly cookie for any old code paths */
export function setJwt(token: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("jwt", token);
  } catch {}
  emitJwtChange(token);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const attrs = `Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
  document.cookie = `jid=${encodeURIComponent(token)}; ${attrs}`;
  document.cookie = `jwt=${encodeURIComponent(token)}; ${attrs}`;
}

export function clearJwt() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("jwt");
  } catch {}
  emitJwtChange(null);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const attrs = `Path=/; Max-Age=0; SameSite=Lax${secure}`;
  document.cookie = `jid=; ${attrs}`;
  document.cookie = `jwt=; ${attrs}`;
}

/* ------------------------------------------------------------------ */
/* JSON fetch helper (cookie-first: credentials: 'include' by default) */
/* ------------------------------------------------------------------ */

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  // Normalize for matching and URL building
  const cleanPath = (path || "").trim();
  const normalizedForMatch = (() => {
    if (!cleanPath) return "";
    try {
      const asUrl = new URL(cleanPath);
      return ((asUrl.pathname || "/").replace(/\/$/, "")) || "/";
    } catch {
      const withoutQuery = cleanPath.split("?")[0];
      const prefixed = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
      return prefixed.replace(/\/$/, "") || "/";
    }
  })();
  const isAuthMeRequest = normalizedForMatch === "/auth/me";

  const isAbsolute = /^https?:/i.test(cleanPath);
  // Prefer configured API_BASE; fall back to "/api" which is rewired in next.config.ts during dev
  const base = API_BASE || "/api";
  const url = isAbsolute
    ? cleanPath
    : `${base}${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;

  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  // Optional: attach legacy Bearer if caller set one elsewhere
  const legacy = getJwt();
  if (legacy && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${legacy}`);
  }

  let body: BodyInit | null | undefined = init.body as any;
  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }

  // Include cookies so HttpOnly `jauth` flows
  const res = await fetch(url, {
    ...init,
    mode: init.mode ?? "cors",
    credentials: init.credentials ?? "include",
    headers,
    body,
  });

  const text = await res.text();
  const parsed = text ? safeJson(text) : null;

  const details = parsed ?? (text || null);
  const msg =
    (details && typeof details === "object"
      ? (details as any).error || (details as any).message
      : null) ||
    (typeof details === "string" && details.trim() ? details : null) ||
    `Request failed ${res.status} ${res.statusText}`;

  if (res.status === 401) {
    clearJwt();
    if (typeof window !== "undefined" && isAuthMeRequest) {
      const alreadyOnLogin = window.location.pathname.startsWith("/login");
      if (!alreadyOnLogin) window.location.href = "/login";
    }
    const error = new Error(`${msg} for ${url}`) as Error & {
      status?: number; details?: any; response?: Response; body?: string | null;
    };
    error.status = res.status; error.details = details; error.response = res; error.body = text || null;
    throw error;
  }

  if (!res.ok) {
    const error = new Error(`${msg} for ${url}`) as Error & {
      status?: number; details?: any; response?: Response; body?: string | null;
    };
    error.status = res.status; error.details = details; error.response = res; error.body = text || null;
    throw error;
  }

  return (parsed as T) ?? ({} as T);
}

function safeJson(t: string) {
  try { return JSON.parse(t); } catch { return null; }
}

/* -------------------------------------------------------------- */
/* Dev helper: ensureDemoAuth (cookie-first)                       */
/* -------------------------------------------------------------- */
export async function ensureDemoAuth(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Already logged in?
  try {
    const me = await apiFetch<any>('/auth/me');
    if (me && me.email) return true;
  } catch {}

  // Attempt demo login (cookie will be set by API)
  try {
    await apiFetch('/auth/login', { method: 'POST', json: { email: 'erin@acme.test', password: 'Password123!' } });
    const me = await apiFetch<any>('/auth/me');
    if (me && me.email) return true;
  } catch {}

  return false;
}