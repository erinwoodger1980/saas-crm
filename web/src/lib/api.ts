// web/src/lib/api.ts

const STORAGE_KEY = "jwt";
const SESSION_SENTINEL = "__cookie_session__";

/** Sanitize + resolve the API base from envs */
function sanitizeBase(v?: string | null): string {
  const raw = (v ?? "").trim();
  const val = (raw || "http://localhost:4000").replace(/\/+$/g, "");
  if (!/^https?:\/\//i.test(val)) throw new Error("API base must include http/https");
  return val;
}

// Prefer explicit origin envs, then legacy fallbacks, then localhost
export const API_BASE = sanitizeBase(
  (typeof process !== "undefined" &&
    (
      process.env.NEXT_PUBLIC_API_ORIGIN ||
      process.env.NEXT_PUBLIC_API_BASE_URL || // ✅ new primary
      process.env.NEXT_PUBLIC_API_URL ||      // legacy
      process.env.NEXT_PUBLIC_API_BASE        // legacy
    )) || ""
);

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

function storeValue(value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  } catch {
    // Ignore storage failures (Safari private mode, etc.)
  }
}

export function getJwt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setJwt(token?: string | null) {
  const value = token && token.trim() ? token : SESSION_SENTINEL;
  storeValue(value);
  emitJwtChange(value);
}

export function clearJwt(options?: { skipServer?: boolean }) {
  storeValue(null);
  emitJwtChange(null);

  if (options?.skipServer) return;

  if (typeof window !== "undefined") {
    const url = `${API_BASE}/auth/logout`;
    fetch(url, { method: "POST", credentials: "include" }).catch(() => {
      // ignore network issues when clearing the cookie
    });
  }
}

function shouldAttachAuthorization(token: string | null) {
  if (!token) return false;
  if (token === SESSION_SENTINEL) return false;
  return token.includes(".");
}

function normalizePath(path: string) {
  const clean = (path || "").trim();
  if (!clean) return "/";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
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

  if (init.json !== undefined) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }

  const token = getJwt();
  if (shouldAttachAuthorization(token) && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let body: BodyInit | null | undefined = init.body as any;
  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
  }

  const response = await fetch(url, {
    ...init,
    headers,
    body,
    credentials: init.credentials ?? "include",
    mode: init.mode ?? "cors",
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
    error.status = response.status;
    error.details = details;
    error.response = response;
    error.body = rawText || null;
    throw error;
  }

  if (!rawText) return {} as T;
  return (parsed as T) ?? ({} as T);
}

function safeJson(payload: string) {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export async function ensureDemoAuth(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Already have a marker
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
    return true;
  }

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
    return true;
  }

  return false;
}
