// web/src/lib/api.ts

/** Sanitize + resolve the API base from envs */
function sanitizeBase(v?: string | null): string {
  const raw = (v ?? "").trim();                              // remove hidden \n / spaces
  const val = (raw || "http://localhost:4000").replace(/\/+$/g, ""); // strip trailing slashes
  if (!/^https?:\/\//i.test(val)) throw new Error("API base must include http/https");
  return val;
}

// Prefer URL (clean), then BASE as fallback
export const API_BASE = sanitizeBase(
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE)) || ""
);

// TEMP: prove what the browser is using (remove after verifying)
if (typeof window !== "undefined") {
  // Should print: "[API_BASE] \"https://joinery-ai.onrender.com\"" (no \n)
  console.log("[API_BASE]", JSON.stringify(API_BASE));
}

/* ---------------- JWT helpers ---------------- */

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

/* ---------------- JSON fetch helper ---------------- */

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const cleanPath = (path || "").trim();
  const url = cleanPath.startsWith("http")
    ? cleanPath
    : `${API_BASE}${cleanPath.startsWith("/") ? "" : "/"}${cleanPath}`;

  const headers = new Headers(init.headers);
  let body: BodyInit | null | undefined = init.body as any;

  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers, body, credentials: "include" });
  const raw = await res.text();
  const json = raw ? safeJson(raw) : null;

  if (!res.ok) {
    const msg = (json as any)?.error || (json as any)?.message || `Request failed ${res.status}`;
    const e = new Error(`${msg} for ${url}`) as any;
    e.status = res.status;
    e.body = raw;
    throw e;
  }

  return (json as T) ?? ({} as T);
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}