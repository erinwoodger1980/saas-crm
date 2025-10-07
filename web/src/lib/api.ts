// web/src/lib/api.ts

/** Base API URL (from env or default localhost) */
const API_BASE =
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL) &&
    (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL)!.replace(/\/$/, "")) ||
  "http://localhost:4000";

/** Read/write JWT in localStorage (browser only) */
export function getJwt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("jwt");
}

export function setJwt(token: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("jwt", token);
  } catch {}

  // Also set a cookie so the API (and Next middleware) can read it
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  // 30 days, SameSite=Lax keeps it on normal navigations
  document.cookie = `jwt=${encodeURIComponent(
    token
  )}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
}

/**
 * Generic fetch wrapper:
 * - injects JWT
 * - includes cookies
 * - supports `json` (preferred) or raw `body`
 * - parses JSON response (or returns {} when empty)
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = getJwt();

  const headers = new Headers(init.headers);

  // Only set Content-Type automatically if we're sending JSON
  let body: BodyInit | null | undefined = init.body as BodyInit | null | undefined;
  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    body,
    credentials: "include", // send cookies with every request
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
  return (text ? (JSON.parse(text) as T) : ({} as T)) as T;
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