"use client";

import "./globals.css";
import { ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import AppShell from "../components/AppShell";
import { setJwt } from "@/lib/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:4000";

function DevAuth() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("jwt")) return;

    // Create demo tenant+user and stash JWT for local dev
    fetch(`${API_BASE}/seed`, { method: "POST" })
      .then(r => r.json())
      .then(d => {
        if (d?.jwt) {
          setJwt(d.jwt);
          location.reload();
        }
      })
      .catch(err => console.error("Auto-seed failed:", err));
  }, []);

  return null;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith("/login") || pathname?.startsWith("/signin") || pathname?.startsWith("/signup");
  const isMarketingRoute = pathname === "/" || pathname?.startsWith("/policy");
  const shouldWrapWithShell = !isAuthRoute && !isMarketingRoute;

  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <DevAuth />
        {shouldWrapWithShell ? <AppShell>{children}</AppShell> : children}
      </body>
    </html>
  );
}