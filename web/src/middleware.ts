import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "jid";
const APP_HOME_PATH = "/dashboard";

const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/signin",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/thank-you",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
]);

const PUBLIC_PREFIXES = ["/_next", "/api", "/policy", "/public", "/assets"];

const PROTECTED_PREFIXES = [
  "/app",
  "/dashboard",
  "/leads",
  "/opportunities",
  "/tasks",
  "/settings",
  "/billing",
  "/q",
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
  const authToken = req.cookies.get(AUTH_COOKIE_NAME)?.value;

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
