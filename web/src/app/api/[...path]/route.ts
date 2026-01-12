import { NextRequest, NextResponse } from "next/server";

function pickBackendOrigin(req: NextRequest): string {
  const configured = (process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();

  // Prefer explicit config when it looks reasonable.
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/g, "");
  }

  const host = (req.headers.get("host") || "").toLowerCase();

  // Render staging: keep it deterministic and bypass any broken custom DNS.
  if (host.includes("web-staging") && host.endsWith(".onrender.com")) {
    return "https://joineryai-api-staging.onrender.com";
  }

  // Production: default to the public API.
  if (host === "joineryai.app" || host === "www.joineryai.app" || host.endsWith(".joineryai.app")) {
    return "https://api.joineryai.app";
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

  const url = new URL(req.nextUrl.toString());
  const target = new URL(`${backend}/${path.map(encodeURIComponent).join("/")}`);
  target.search = url.search;

  const method = req.method.toUpperCase();

  // Copy request headers; forward cookies so backend can read HttpOnly session.
  const headers = new Headers();
  const incomingCookie = req.headers.get("cookie");
  if (incomingCookie) headers.set("cookie", incomingCookie);

  const incomingAuth = req.headers.get("authorization");
  if (incomingAuth) headers.set("authorization", incomingAuth);

  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const body = method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  const upstream = await fetch(target.toString(), {
    method,
    headers,
    body: body ? Buffer.from(body) : undefined,
    redirect: "manual",
  });

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
