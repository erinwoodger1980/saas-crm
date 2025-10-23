// web/src/lib/api.ts

/** Sanitize + resolve the API base from envs */
function sanitizeBase(v?: string | null): string {
  const raw = (v ?? "").trim();
  const val = (raw || "http://localhost:4000").replace(/\/+$/g, "");
  if (!/^https?:\/\//i.test(val)) throw new Error("API base must include http/https");
  return val;
}

// Prefer URL variants, then BASE fallback, then localhost
export const API_BASE = sanitizeBase(
  (typeof process !== "undefined" &&
    (
      process.env.NEXT_PUBLIC_API_ORIGIN ||
      process.env.NEXT_PUBLIC_API_BASE_URL || // ✅ new primary
      process.env.NEXT_PUBLIC_API_URL ||      // legacy
      process.env.NEXT_PUBLIC_API_BASE        // legacy
    )) || ""
);

// TEMP: prove what the browser is using (remove after verifying)
if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.log("[API_BASE]", API_BASE);
}

/* ---------------- JWT helpers (kept) ---------------- */

export const JWT_EVENT_NAME = "joinery:jwt-change";

function emitJwtChange(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    const event = new CustomEvent(JWT_EVENT_NAME, { detail: { token } });
    window.dispatchEvent(event);
  } catch {
    // Ignore environments where CustomEvent is unavailable
  }
}

let lastCookieJwt: string | null = null;

export function getJwt(): string | null {
  if (typeof window === "undefined") return null;
  let token: string | null = null;

  try {
    token = localStorage.getItem("jwt");
  } catch {
    token = null;
  }

  if (token) return token;

  const cookie = typeof document !== "undefined" ? document.cookie : "";

  const extract = (name: string) => {
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  };

  token = extract("jid") || extract("jwt");

  if (token) {
    try {
      localStorage.setItem("jwt", token);
    } catch {
      // Ignore write failures (private mode, disabled storage, etc.)
    }
    return token;
  }

  return null;
}

export function setJwt(token: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("jwt", token);
  } catch {}
  lastCookieJwt = token;
  emitJwtChange(token);

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const cookieValue = encodeURIComponent(token);
  const attributes = `Path=/; Max-Age=2592000; SameSite=Lax${secure}`;

  // Primary cookie used by middleware
  document.cookie = `jid=${cookieValue}; ${attributes}`;
  // Legacy cookie kept for backwards compatibility with API clients expecting "jwt"
  document.cookie = `jwt=${cookieValue}; ${attributes}`;
}

export function clearJwt() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("jwt");
  } catch {}
  lastCookieJwt = null;
  emitJwtChange(null);

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const attributes = `Path=/; Max-Age=0; SameSite=Lax${secure}`;
  document.cookie = `jid=; ${attributes}`;
  document.cookie = `jwt=; ${attributes}`;
}

/* ---------------- JSON fetch helper ---------------- */

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const cleanPath = (path || "").trim();
  const normalizedForMatch = (() => {
    if (!cleanPath) return "";
    try {
      const asUrl = new URL(cleanPath);
      return ((asUrl.pathname || "/").replace(/\/$/, "")) || "/";
    } catch {
      const withoutQuery = cleanPath.split("?")[0];
      const prefixed = withoutQuery.startsWith("/")
        ? withoutQuery
        : `/${withoutQuery}`;
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

  // Attach JWT as Bearer if present (optional)
  const token = getJwt();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let body: BodyInit | null | undefined = init.body as any;
  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }

  // 🔑 Key change: do NOT include credentials by default (prevents CORS failures)
  const res = await fetch(url, {
    ...init,
    mode: init.mode ?? "cors",
    credentials: init.credentials ?? "omit",
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
      if (!alreadyOnLogin) {
        window.location.href = "/login";
      }
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

/* ---------------- Dev helper: ensureDemoAuth ---------------- */

export async function ensureDemoAuth(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (getJwt()) return true;

  // Try real login first (works if demo user exists)
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit", // 🔒 omit for cross-origin
      body: JSON.stringify({ email: "erin@acme.test", password: "secret12" }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const token = data?.token || data?.jwt;
      if (token) {
        setJwt(token);
        return true;
      }
    }
  } catch {}

  // Fallback: ask API to create demo tenant/user and return a token
  try {
    const seeded = await fetch(`${API_BASE}/seed`, { method: "POST", credentials: "omit" });
    if (seeded.ok) {
      const data = await seeded.json().catch(() => ({}));
      const token = data?.token || data?.jwt;
      if (token) {
        setJwt(token);
        return true;
      }
    }
  } catch {}

  return false;
}