import { NextResponse, NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/leads", "/opportunities", "/workshop", "/reports", "/account"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only guard protected routes
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const jwt = req.cookies.get("jwt")?.value;
  if (jwt) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname || "/");
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico).*)"],
};
