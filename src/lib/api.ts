// API utilities for browser-side data fetching and auth storage

/** Base API URL (from env or default localhost) */
const API_BASE =
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL) &&
    (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL)!.replace(/\/$/, "")) ||
  "http://localhost:4000";

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
  init: Omit<RequestInit, "body"> & { body?: any } = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = getJwt();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const body =
    init.body && typeof init.body !== "string"
      ? JSON.stringify(init.body)
      : (init.body as any);

  const res = await fetch(url, {
    ...init,
    headers,
    body,
    credentials: "include", // <-- send cookies with every request
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
    throw new Error(`${msg} for ${url}`);
  }

  // Gracefully handle empty responses
  const text = await res.text();
  return (text ? JSON.parse(text) : ({} as T)) as T;
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

  // 1) Try to log in
  try {
    const login = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: "erin@acme.test", password: "secret12" }),
    });
    if (login.ok) {
      const data = await login.json().catch(() => ({}));
      if (data?.jwt) {
        setJwt(data.jwt);
        return true;
      }
    }
  } catch {
    // fall through
  }

  // 2) Seed a demo tenant+user and store JWT
  try {
    const seeded = await fetch(`${API_BASE}/seed`, {
      method: "POST",
      credentials: "include",
    });
    if (seeded.ok) {
      const data = await seeded.json().catch(() => ({}));
      if (data?.jwt) {
        setJwt(data.jwt);
        return true;
      }
    }
  } catch {
    // ignore
  }

  return false;
}