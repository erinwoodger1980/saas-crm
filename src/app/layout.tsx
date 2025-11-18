"use client";

import "./globals.css";
import { ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import AppShell from "../components/AppShell";
import FeedbackWidget from "@/components/FeedbackWidget";
import { ensureDemoAuth } from "@/lib/api";

function DevAuth() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    // Only try auto-auth on localhost during development
    if (!(host === "localhost" || host === "127.0.0.1")) return;
    if (localStorage.getItem("jwt")) return;

    (async () => {
      try {
        const ok = await ensureDemoAuth();
        if (ok) location.reload();
      } catch (err) {
         
        console.error("ensureDemoAuth failed:", err);
      }
    })();
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
        <FeedbackWidget />
      </body>
    </html>
  );
}