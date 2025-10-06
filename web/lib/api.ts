// web/lib/api.ts
const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function getJwt(): string | null {
  // prefer cookie (middleware sees it), fall back to localStorage
  const fromCookie = readCookie("jwt");
  if (fromCookie) return fromCookie;
  try {
    return localStorage.getItem("jwt");
  } catch {
    return null;
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem("jwt");
  } catch {}
  // expire cookie
  if (typeof document !== "undefined") {
    document.cookie = `jwt=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}

/**
 * apiFetch<T> — JSON helper that always sends Authorization header.
 * Redirects to /login on 401 with ?next=<current-path>.
 */
export async function apiFetch<T>(
  path: string,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<T> {
  const token = getJwt();
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    ...(opts.headers || {}),
  };

  if (opts.body !== undefined && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: opts.method || "GET",
    headers,
    // only stringify plain bodies; let FormData pass through
    body:
      opts.body === undefined || opts.body instanceof FormData
        ? (opts.body as any)
        : JSON.stringify(opts.body),
    // CORS: we don’t **need** credentials when using Authorization header,
    // but leaving it ‘include’ is safe locally too.
    credentials: "include",
  });

  // Try to parse text -> json for better errors
  const raw = await res.text();
  const maybeJson = raw ? safeJson(raw) : null;

  if (res.status === 401) {
    // unauthorised: nuke auth and bounce to login
    try {
      clearAuth();
      if (typeof window !== "undefined") {
        const here = window.location.pathname + window.location.search;
        window.location.href = `/login?next=${encodeURIComponent(here)}`;
      }
    } catch {}
    throw new Error("unauthorized");
  }

  if (!res.ok) {
    const msg =
      (maybeJson as any)?.error ||
      (maybeJson as any)?.message ||
      `Request failed ${res.status}`;
    const e = new Error(msg) as any;
    e.status = res.status;
    e.body = raw;
    throw e;
  }

  return (maybeJson as T) ?? ({} as T);
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}