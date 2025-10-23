// web/src/lib/api.ts

/** Resolve API base from envs (must include http/https) */
// minimal declaration so TS stops complaining without @types/node
declare const process: { env?: Record<string, string | undefined> };
function sanitizeBase(v?: string | null): string {
  const raw = (v ?? "").trim();
  const val = (raw || "http://localhost:4000").replace(/\/+$/g, "");
  if (!/^https?:\/\//i.test(val)) throw new Error("API base must include http/https");
  return val;
}

/**
 * Read at BUILD time so Next can inline the value.
 * Keep all legacy keys for safety.
 */
export const API_BASE = sanitizeBase(
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_ORIGIN ||
  ""
);

// TEMP: log which API the browser will hit (remove when happy)
if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.log("[API_BASE]", API_BASE);
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
  const url = isAbsolute
    ? cleanPath
    : `${API_BASE}${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;

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
    const meRes = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
    if (meRes.ok) {
      const me = await meRes.json().catch(() => null);
      if (me && (me as any).email) return true;
    }
  } catch {}

  // Attempt demo login (cookie will be set by API)
  try {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: "erin@acme.test", password: "Password123!" }),
    });
    if (loginRes.ok) {
      const meRes = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
      if (meRes.ok) return true;
    }
  } catch {}

  return false;
}