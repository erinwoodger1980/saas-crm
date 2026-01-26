import { NextRequest, NextResponse } from "next/server";

// Ensure Node.js runtime so we can safely forward cookies and stream bodies.
export const runtime = "nodejs";

function isAbortError(err: any): boolean {
  const name = String(err?.name || "");
  const msg = String(err?.message || "");
  return name === "AbortError" || /aborted|abort/i.test(msg);
}

function getTimeoutMs(path: string[]): number {
  const p = `/${(path || []).join("/")}`;
  // PDF rendering can be slow (Chromium cold start). Give it more runway.
  if (/\/quotes\/.+\/(render-pdf|render-proposal)\b/i.test(p)) return 180_000;
  // Auth should be fast; if not, fail loudly.
  if (/^\/auth\/(login|me)\b/i.test(p)) return 30_000;
  return 60_000;
}

function pickBackendOrigin(req: NextRequest): string {
  const host = (req.headers.get("host") || "").toLowerCase();

  // Render staging: keep it deterministic and bypass any broken custom DNS.
  if (host.includes("web-staging") && host.endsWith(".onrender.com")) {
    return "https://joineryai-api-staging.onrender.com";
  }

  // Custom staging domains under joineryai.app should still hit staging API.
  if (host.includes("staging") && host.endsWith(".joineryai.app")) {
    return "https://joineryai-api-staging.onrender.com";
  }

  // Production: default to the public API.
  if (host === "joineryai.app" || host === "www.joineryai.app" || host.endsWith(".joineryai.app")) {
    return "https://api.joineryai.app";
  }

  const configured = (process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();

  // Prefer explicit config when it looks reasonable (but only after host-based routing).
  // This prevents a bad env var (e.g. a broken Cloudflare staging domain) from overriding
  // deterministic staging routing.
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/g, "");
  }

  // Local dev fallback.
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    const fallbackPort = Number(process.env.LOCAL_API_PORT || process.env.API_PORT || 4000);
    const fallback = `http://localhost:${Number.isFinite(fallbackPort) ? fallbackPort : 4000}`;
    return (process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE || fallback).replace(/\/+$/g, "");
  }

  // Safe default.
  return "https://api.joineryai.app";
}

function filterResponseHeaders(headers: Headers): Headers {
  const out = new Headers();

  // Pass through a minimal safe set.
  const passthrough = [
    "content-type",
    "cache-control",
    "pragma",
    "expires",
    "location",
    "content-disposition",
    "content-language",
  ];

  for (const key of passthrough) {
    const v = headers.get(key);
    if (v != null) out.set(key, v);
  }

  return out;
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }): Promise<Response> {
  const { path = [] } = await ctx.params;
  const backend = pickBackendOrigin(req);
  const backendBase = backend.replace(/\/+$/g, "");
  const rootBase = backendBase.endsWith("/api") ? backendBase.slice(0, -4) : backendBase;
  const apiBase = rootBase.endsWith("/api") ? rootBase : `${rootBase}/api`;

  const url = new URL(req.nextUrl.toString());
  const apiBaseRoutes = new Set([
    // Routes that are mounted under /api on the backend
    "wealden",
    "scene-state",
    "landing-tenants",
    "aggregate-reviews",
    "admin",
    "interest",
    "early-access",
  ]);
  const firstSegment = path[0] || "";
  // Default to backend root for core app routes (e.g., /tenant, /clients, /analytics)
  // and only use /api for explicitly prefixed routes above.
  const useApiBase = firstSegment ? apiBaseRoutes.has(firstSegment) : true;
  const targetBase = useApiBase ? apiBase : rootBase;
  const target = new URL(`${targetBase}/${path.map(encodeURIComponent).join("/")}`);
  target.search = url.search;

  const method = req.method.toUpperCase();

  // Copy request headers; forward cookies so backend can read HttpOnly session.
  const headers = new Headers();
  const incomingCookie = req.headers.get("cookie");
  if (incomingCookie) headers.set("cookie", incomingCookie);

  const tenantId = req.headers.get("x-tenant-id");
  if (tenantId) headers.set("x-tenant-id", tenantId);
  const userId = req.headers.get("x-user-id");
  if (userId) headers.set("x-user-id", userId);

  const incomingAuth = req.headers.get("authorization");
  if (incomingAuth) headers.set("authorization", incomingAuth);

  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const body = method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  const timeoutMs = getTimeoutMs(path);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      method,
      headers,
      // Use ArrayBuffer directly so this works in both Node and Edge runtimes.
      body: body ? body : undefined,
      redirect: "manual",
      signal: controller.signal,
    });
  } catch (err: any) {
    const pathStr = `/${(path || []).join("/")}`;
    if (isAbortError(err)) {
      console.warn("[web api proxy] upstream timeout", { backend, path: pathStr, timeoutMs });
      return NextResponse.json(
        { ok: false, error: "upstream_timeout", backend, path: pathStr },
        { status: 504 },
      );
    }
    console.error("[web api proxy] upstream fetch failed", { backend, path: pathStr, error: String(err?.message || err) });
    return NextResponse.json(
      { ok: false, error: "upstream_failed", backend, path: pathStr },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const resHeaders = filterResponseHeaders(upstream.headers);

  // Forward Set-Cookie(s) if present.
  // In Node/undici, multiple cookies may be exposed via getSetCookie().
  const anyHeaders = upstream.headers as any;
  const setCookies: string[] =
    typeof anyHeaders.getSetCookie === "function"
      ? (anyHeaders.getSetCookie() as string[])
      : upstream.headers.get("set-cookie")
        ? [String(upstream.headers.get("set-cookie"))]
        : [];

  for (const c of setCookies) {
    if (c) resHeaders.append("set-cookie", c);
  }

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

export async function GET(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function POST(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function PUT(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function PATCH(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function DELETE(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
export async function OPTIONS(req: NextRequest, ctx: any) {
  return proxy(req, ctx);
}
