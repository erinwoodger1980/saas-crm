// web/lib/api.ts

const STORAGE_KEY = "jwt";
const SESSION_SENTINEL = "__cookie_session__";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_ORIGIN ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000"
).replace(/\/+$/g, "");

export function getJwt(): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

export function setJwt(token?: string | null) {
  const value = token && token.trim() ? token : SESSION_SENTINEL;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {}
  }
}

export function clearAuth(options?: { skipServer?: boolean }) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
  if (options?.skipServer) return;
  fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
}

type ApiFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  json?: any;
};

function shouldAttachAuthorization(token: string | null) {
  return !!(token && token !== SESSION_SENTINEL && token.includes("."));
}

export async function apiFetch<T>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const token = getJwt();
  const url = path.startsWith("http") ? path : `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = new Headers(opts.headers);
  const hasJsonBody = Object.prototype.hasOwnProperty.call(opts, "json");
  if (hasJsonBody && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  if (shouldAttachAuthorization(token) && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let body: BodyInit | null | undefined = null;
  if (hasJsonBody) {
    body = JSON.stringify(opts.json);
  } else if (opts.body instanceof FormData || typeof opts.body === "string") {
    body = opts.body as any;
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, {
    method: opts.method || "GET",
    headers,
    body,
    credentials: "include",
  });

  const raw = await res.text();
  const maybeJson = raw ? safeJson(raw) : null;

  if (res.status === 401) {
    clearAuth({ skipServer: true });
    if (typeof window !== "undefined") {
      const here = window.location.pathname + window.location.search;
      window.location.href = `/login?next=${encodeURIComponent(here)}`;
    }
    throw Object.assign(new Error("unauthorized"), { status: 401, body: raw });
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
