// web/src/lib/api.ts
/** ------------------------------------------------------------
 * API helper utilities for the Joinery AI web app
 * ------------------------------------------------------------ */

/** Sanitize + resolve API base from env */
function sanitizeBase(v?: string | null): string {
  const raw = (v ?? "").trim();                     // kill hidden \n / spaces
  const val = (raw || "http://localhost:4000").replace(/\/+$/g, ""); // strip trailing slashes
  if (!/^https?:\/\//i.test(val)) {
    throw new Error("NEXT_PUBLIC_API_URL/BASE must include http/https");
  }
  return val;
}

export const API_BASE = sanitizeBase(
  (typeof process !== "undefined" && (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL)) || ""
);

/* -------------------------------------------------------------
 * JWT helpers
 * ------------------------------------------------------------- */

export function getJwt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("jwt");
  } catch {
    return null;
  }
}

export function setJwt(token: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("jwt", token);
  } catch {}
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `jwt=${encodeURIComponent(
    token
  )}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
}

export function clearJwt() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("jwt");
  } catch {}
  document.cookie = `jwt=; Path=/; Max-Age=0; SameSite=Lax`;
}

/* -------------------------------------------------------------
 * apiFetch()
 * ------------------------------------------------------------- */

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const token = getJwt();

  // ensure path is trimmed and has a single leading slash
  const cleanPath = (path || "").trim();
  const url =
    cleanPath.startsWith("http")
      ? cleanPath
      : `${API_BASE}${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;

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

  if (res.status === 401) {
    let msg = "Unauthorized";
    try {
      const t = await res.text();
      if (t) msg = t;
    } catch {}
    throw new Error(msg);
  }

  const raw = await res.text();
  const maybeJson = safeJson(raw);

  if (!res.ok) {
    const msg =
      (maybeJson as any)?.error ||
      (maybeJson as any)?.message ||
      `Request failed ${res.status} ${res.statusText}`;
    const e = new Error(`${msg} for ${url}`) as any;
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

/* -------------------------------------------------------------
 * ensureDemoAuth()
 * Only runs locally; never hit /seed in production.
 * ------------------------------------------------------------- */

export async function ensureDemoAuth(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (getJwt()) return true;

  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (!isLocal) return false; // ⛔️ don’t run in prod

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