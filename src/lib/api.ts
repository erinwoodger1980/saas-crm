// API utilities for browser-side data fetching and auth storage

const STORAGE_KEY = "jwt";
const SESSION_SENTINEL = "__cookie_session__";

/** Base API URL (from env or default localhost) */
function sanitizeBase(v?: string | null): string {
  const raw = (v ?? "").trim();
  const val = (raw || "http://localhost:4000").replace(/\/+$/g, "");
  if (!/^https?:\/\//i.test(val)) throw new Error("API base must include http/https");
  return val;
}

export const API_BASE = sanitizeBase(
  (typeof process !== "undefined" &&
    (
      process.env.NEXT_PUBLIC_API_ORIGIN ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE
    )) || "",
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
    // Ignore storage failures
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
      // ignore network failures when clearing cookie
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

export async function apiFetch<T = any>(
  path: string,
  init: Omit<RequestInit, "body"> & { body?: any; json?: unknown } = {},
): Promise<T> {
  const cleanPath = normalizePath(path);
  const isAbsolute = /^https?:/i.test(path);
  const url = isAbsolute ? path : `${API_BASE}${cleanPath}`;

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

  const rawText = await response.text();
  const parsed = rawText ? safeJson(rawText) : null;
  const details = parsed ?? (rawText || null);

  if (response.status === 401) {
    clearJwt({ skipServer: true });
    if (typeof window !== "undefined") {
      const alreadyOnLogin = window.location.pathname.startsWith("/login");
      if (!alreadyOnLogin) {
        window.location.href = "/login";
      }
    }
    const error = new Error(`Unauthorized for ${url}`) as Error & {
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

  if (!response.ok) {
    const message =
      (details && typeof details === "object"
        ? (details as any).error || (details as any).message
        : null) ||
      (typeof details === "string" && details.trim() ? details : null) ||
      `Request failed ${response.status} ${response.statusText}`;
    const error = new Error(`${message} for ${url}`) as Error & {
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
  if (getJwt()) return true;

  const loginResponse = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email: "erin@acme.test", password: "secret12" }),
  }).catch(() => null);

  if (loginResponse && loginResponse.ok) {
    try {
      const data = await loginResponse.json().catch(() => ({}));
      const token = data?.token || data?.jwt || null;
      setJwt(token);
    } catch {
      setJwt();
    }
    return true;
  }

  const seedResponse = await fetch(`${API_BASE}/seed`, {
    method: "POST",
    credentials: "include",
  }).catch(() => null);

  if (seedResponse && seedResponse.ok) {
    try {
      const data = await seedResponse.json().catch(() => ({}));
      const token = data?.token || data?.jwt || null;
      setJwt(token);
    } catch {
      setJwt();
    }
    return true;
  }

  return false;
}
