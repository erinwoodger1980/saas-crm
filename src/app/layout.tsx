"use client";

import "./globals.css";
import { ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import AppShell from "../components/AppShell";
import FeedbackWidget from "@/components/FeedbackWidget";
import { setJwt } from "@/lib/api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:4000";

function DevAuth() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("jwt")) return;

    // Create demo tenant+user and stash JWT for local dev
    fetch(`${API_BASE}/seed`, { method: "POST", credentials: "include" })
      .then((r) => (r.ok ? r.json().catch(() => ({})) : Promise.reject(r)))
      .then((d) => {
        const token = d?.jwt || d?.token || null;
        setJwt(token);
        location.reload();
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
        <FeedbackWidget />
      </body>
    </html>
  );
}