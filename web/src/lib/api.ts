// web/src/lib/api.ts

/** Resolve API base from envs (must include http/https) */
function sanitizeBase(v?: string | null): string {
  const raw = (v ?? "").trim();
  const val = (raw || "http://localhost:4000").replace(/\/+$/g, "");
  if (!/^https?:\/\//i.test(val)) throw new Error("API base must include http/https");
  return val;
}

/** Safe read of env (no Node types needed) */
function readPublicEnv(keys: string[]): string | undefined {
  const g: any = globalThis as any;
  // Next injects env at build; we read via globalThis to keep TS happy without @types/node
  for (const k of keys) {
    const val =
      g?.process?.env?.[k] ??
      (typeof window !== "undefined" ? (window as any)[k] : undefined);
    if (typeof val === "string" && val.trim()) return val;
  }
  return undefined;
}

/** Prefer URL variants, then BASE fallback, then localhost */
export const API_BASE = sanitizeBase(
  readPublicEnv([
    "NEXT_PUBLIC_API_ORIGIN",     // optional
    "NEXT_PUBLIC_API_BASE_URL",   // primary
    "NEXT_PUBLIC_API_URL",        // legacy
    "NEXT_PUBLIC_API_BASE",       // legacy
  ]) || ""
);

// TEMP: log which API the browser will hit (remove when happy)
if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.log("[API_BASE]", API_BASE);
}

/* ------------------------------------------------------------------ */
/* JSON fetch helper (cookie-first: credentials: 'include' by default) */
/* ------------------------------------------------------------------ */

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  // Normalize path for matching and URL building
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

  // Only attach JSON body if caller provided `json`
  let body: BodyInit | null | undefined = init.body as any;
  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }

  // IMPORTANT: include credentials to send/receive HttpOnly cookies (jauth)
  const res = await fetch(url, {
    ...init,
    mode: init.mode ?? "cors",
    credentials: init.credentials ?? "include",
    headers,
    body,
  });

  // Read once, then parse
  const text = await res.text();
  const parsed = text ? safeJson(text) : null;

  // Pick the best error message we can
  const details = parsed ?? (text || null);
  const msg =
    (details && typeof details === "object"
      ? (details as any).error || (details as any).message
      : null) ||
    (typeof details === "string" && details.trim() ? details : null) ||
    `Request failed ${res.status} ${res.statusText}`;

  // Handle auth expiry consistently
  if (res.status === 401) {
    // On client, if `/auth/me` fails, push to /login (prevents loops)
    if (typeof window !== "undefined" && isAuthMeRequest) {
      const alreadyOnLogin = window.location.pathname.startsWith("/login");
      if (!alreadyOnLogin) window.location.href = "/login";
    }

    const error = new Error(`${msg} for ${url}`) as Error & {
      status?: number;
      details?: any;
      response?: Response;
      body?: string | null;
    };
    error.status = res.status;
    error.details = details;
    error.response = res;
    error.body = text || null;
    throw error;
  }

  if (!res.ok) {
    const error = new Error(`${msg} for ${url}`) as Error & {
      status?: number;
      details?: any;
      response?: Response;
      body?: string | null;
    };
    error.status = res.status;
    error.details = details;
    error.response = res;
    error.body = text || null;
    throw error;
  }

  return (parsed as T) ?? ({} as T);
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------- */
/* Dev helper: ensureDemoAuth (cookie-first, no localStorage JWT)  */
/* -------------------------------------------------------------- */

export async function ensureDemoAuth(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // 1) If we already have a valid cookie session, this will pass.
  try {
    const meRes = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
    if (meRes.ok) {
      const me = await meRes.json().catch(() => null);
      if (me && typeof me === "object" && (me as any).email) return true;
    }
  } catch {
    // fall through to attempt login
  }

  // 2) Try a demo login (credentials included so the cookie can be set)
  try {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // 🔑 receive HttpOnly cookie from API
      body: JSON.stringify({ email: "erin@acme.test", password: "Password123!" }),
    });
    if (loginRes.ok) {
      // Verify cookie-based session
      const meRes = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
      if (meRes.ok) return true;
    }
  } catch {
    // ignore
  }

  return false;
}