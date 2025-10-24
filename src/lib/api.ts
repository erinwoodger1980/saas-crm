// API utilities for browser-side data fetching and auth storage

// minimal declaration so TS stops complaining without @types/node
declare const process: { env?: Record<string, string | undefined> };

/**
 * Single source of truth for the browser app to know the API base.
 * Rules:
 * - Prefer NEXT_PUBLIC_API_BASE (set per environment)
 * - If not set and running on localhost, use http://localhost:4000 (dev convenience only)
 * - Otherwise, empty string so fetches go to same-origin "/api" via rewrites/proxy
 */
export const API_BASE = (() => {
  const fromEnv = (typeof process !== "undefined" && process?.env?.NEXT_PUBLIC_API_BASE) ||
                  (typeof process !== "undefined" && process?.env?.NEXT_PUBLIC_API_URL);
  if (fromEnv) return String(fromEnv).replace(/\/+$/g, "");
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:4000";
    }
  }
  return "";
})();

export const AUTH_COOKIE_NAME = "jid";
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

/** Read/write JWT in localStorage (browser only) */
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

  token = extract(AUTH_COOKIE_NAME) || extract("jwt");

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

  // Also set a cookie so the API (and Next middleware) can read it
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  // 30 days, SameSite=Lax keeps it on normal navigations
  const cookieValue = encodeURIComponent(token);
  const commonAttributes = `Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
  document.cookie = `${AUTH_COOKIE_NAME}=${cookieValue}; ${commonAttributes}`;
  // Maintain legacy cookie for any downstream services still expecting "jwt"
  document.cookie = `jwt=${cookieValue}; ${commonAttributes}`;
}

export function clearJwt() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("jwt");
  } catch {}
  lastCookieJwt = null;
  emitJwtChange(null);
  document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0`;
  document.cookie = "jwt=; Path=/; Max-Age=0";
}

/** Generic fetch wrapper that injects JWT, includes cookies, and handles JSON */
export async function apiFetch<T = any>(
  path: string,
  init: (RequestInit & { json?: unknown }) | Omit<RequestInit, "body"> & { body?: any } = {}
): Promise<T> {
  const cleanPath = (path || "").trim();
  const isAbsolute = /^https?:/i.test(cleanPath);
  const base = API_BASE || "/api";
  const url = isAbsolute
    ? cleanPath
    : `${base}${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;
  const token = getJwt();

  const headers = new Headers(init.headers as any);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | null | undefined = (init as any).body;
  if ((init as any).json !== undefined) {
    body = JSON.stringify((init as any).json);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  } else if (body && typeof body !== "string" && !(body instanceof FormData)) {
    // Back-compat: allow plain objects via body
    try { body = JSON.stringify(body); } catch {}
  }

  const res = await fetch(url, {
    ...(init as RequestInit),
    mode: (init as RequestInit).mode ?? "cors",
    credentials: (init as RequestInit).credentials ?? "include",
    headers,
    body,
  });

  if (!res.ok) {
    // Try to extract a helpful error body
    let details: any = null;
    try {
      details = await res.json();
    } catch {
      try {
        details = await res.text();
      } catch {
        details = null;
      }
    }
    const msg =
      (details && (details.error || details.message)) ||
      `Request failed ${res.status} ${res.statusText}`;

    const error = new Error(`${msg} for ${url}`) as Error & {
      status?: number;
      details?: any;
      response?: Response;
    };
    error.status = res.status;
    error.details = details;
    error.response = res;
    throw error;
  }

  // Gracefully handle empty responses
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : ({} as T)) as T;
  } catch {
    return ({} as T);
  }
}

/**
 * ensureDemoAuth()
 * - If no JWT, try login (erin@acme.test / secret12)
 * - If that fails, call /seed to create demo tenant+user
 * - Store JWT (localStorage + cookie) and return true when authenticated
 */
export async function ensureDemoAuth(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (getJwt()) return true;

  // 1) Try login
  try {
    const data = await apiFetch<any>("/auth/login", {
      method: "POST",
      json: { email: "erin@acme.test", password: "secret12" },
    });
    if (data?.jwt) {
      setJwt(data.jwt);
      return true;
    }
  } catch {}

  // 2) Seed and store JWT
  try {
    const data = await apiFetch<any>("/seed", { method: "POST" });
    if (data?.jwt) {
      setJwt(data.jwt);
      return true;
    }
  } catch {}

  // 3) Dev login fallback
  try {
    const out = await apiFetch<any>("/auth/dev-login", { method: "POST", json: { email: "erin@acme.test" } });
    if (out?.token) {
      setJwt(out.token);
      const me = await apiFetch<any>("/auth/me");
      if (me?.email) return true;
    }
  } catch {}

  return false;
}