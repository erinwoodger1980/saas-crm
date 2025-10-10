// web/src/lib/api.ts

/** Base API URL (from env or default localhost) */
const API_BASE =
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL) &&
    (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL)!.replace(/\/$/, "")) ||
  "http://localhost:4000";

/** JWT helpers */
export function getJwt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("jwt");
}

export function setJwt(token: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("jwt", token);
  } catch {}
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `jwt=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
}

export function clearJwt() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("jwt");
  } catch {}
  // expire cookie
  document.cookie = `jwt=; Path=/; Max-Age=0; SameSite=Lax`;
}

/**
 * Generic fetch wrapper:
 * - injects JWT
 * - includes cookies
 * - supports `json` (preferred) or raw `body`
 * - parses JSON response (or returns {} when empty)
 * - auto-recovers on 401 by clearing auth and redirecting to /login
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = getJwt();

  const headers = new Headers(init.headers);
  let body: BodyInit | null | undefined = init.body as BodyInit | null | undefined;

  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...init, headers, body, credentials: "include" });

  // Handle 401: clear token and bounce to login
  if (res.status === 401) {
    clearJwt();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
    }
    throw new Error(`Unauthorized for ${url}`);
  }

  if (!res.ok) {
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

  const text = await res.text();
  return (text ? (JSON.parse(text) as T) : ({} as T)) as T;
}

/**
 * ensureDemoAuth()
 * - If no JWT, try login (erin@acme.test / secret12)
 * - If that fails, call /seed to create demo tenant+user
 * - Store JWT and return true when authenticated
 */
export async function ensureDemoAuth(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (getJwt()) return true;

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
  } catch {}

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