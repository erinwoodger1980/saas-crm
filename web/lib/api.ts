// web/lib/api.ts

function sanitizeBase(raw?: string): string {
  const v = (raw ?? "").trim();                 // <-- kill hidden \n or spaces
  const base = (v || "http://localhost:4000").replace(/\/+$/g, ""); // strip trailing slashes
  if (!/^https?:\/\//i.test(base)) {
    throw new Error("NEXT_PUBLIC_API_URL must include http/https");
  }
  return base;
}

const API_BASE = sanitizeBase(process.env.NEXT_PUBLIC_API_URL);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function getJwt(): string | null {
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

  // ensure leading slash and trim accidental whitespace
  const cleanPath = (path || "").trim();
  const url =
    cleanPath.startsWith("http")
      ? cleanPath
      : `${API_BASE}${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;

  const headers: Record<string, string> = { ...(opts.headers || {}) };

  if (opts.body !== undefined && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: opts.method || "GET",
    headers,
    body:
      opts.body === undefined || opts.body instanceof FormData
        ? (opts.body as any)
        : JSON.stringify(opts.body),
    credentials: "include",
  });

  const raw = await res.text();
  const maybeJson = safeJson(raw);

  if (res.status === 401) {
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