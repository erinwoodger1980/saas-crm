import { NextRequest, NextResponse } from "next/server";

// Prefer HttpOnly `jauth` when available, but allow legacy `jid/jwt` cookies
// (set client-side by `setJwt()`), which is critical for staging on onrender.com
// where sharing a cookie across sibling subdomains may be blocked.
const AUTH_COOKIE_NAMES = ["jauth", "jid", "jwt"] as const;
const APP_HOME_PATH = "/dashboard";

const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/signin",
  "/signup",
  "/accept-invite",
  "/forgot-password",
  "/reset-password",
  "/thank-you",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
]);

const PUBLIC_PREFIXES = ["/_next", "/api", "/policy", "/public", "/assets", "/q"];

const PROTECTED_PREFIXES = [
  "/app",
  "/dashboard",
  "/leads",
  "/opportunities",
  "/tasks",
  "/settings",
  "/billing",
  "/setup",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function requiresAuth(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authToken = AUTH_COOKIE_NAMES.map((n) => req.cookies.get(n)?.value).find(Boolean);

  // Guard against accidental relative navigations creating nested paths like /login/dashboard.
  // If a user is already authenticated, send them home; otherwise normalize to /login.
  if (pathname.startsWith("/login/") || pathname.startsWith("/signin/")) {
    const url = req.nextUrl.clone();
    url.pathname = authToken ? APP_HOME_PATH : "/login";
    return NextResponse.redirect(url);
  }
  // Extract role from a lightweight JWT (no verification here) to gate workshop-only users
  let role: string | null = null;
  if (authToken) {
    try {
      const payloadPart = authToken.split('.')[1];
      if (payloadPart) {
        const json = JSON.parse(Buffer.from(payloadPart, 'base64').toString('utf8'));
        role = typeof json.role === 'string' ? json.role : null;
      }
    } catch {}
  }

  if (pathname === "/") {
    if (authToken) {
      const url = req.nextUrl.clone();
      url.pathname = APP_HOME_PATH;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!authToken && requiresAuth(pathname)) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    if (pathname) {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Restrict workshop-only role: allow ONLY /workshop, /login, and public paths
  if (authToken && role === 'workshop') {
    const allowedPrefixes = ['/workshop'];
    const isAllowed = isPublicPath(pathname) || allowedPrefixes.some(p => pathname === p || pathname.startsWith(p + '/'));
    if (!isAllowed) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = '/workshop';
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
