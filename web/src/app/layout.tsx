"use client";

import "./globals.css";
import { ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import AppShell from "../components/AppShell";
import { Toaster } from "@/components/ui/toaster";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:4000";

function DevAuth() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("jwt")) return;

    // Create demo tenant+user and stash JWT for local dev
    fetch(`${API_BASE}/seed`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.jwt) {
          localStorage.setItem("jwt", d.jwt);
          location.reload();
        }
      })
      .catch((err) => console.error("Auto-seed failed:", err));
  }, []);

  return null;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith("/login");
  const isPublicQuestionnaire = pathname?.startsWith("/q/");
  const isPublicThankYou = pathname === "/thank-you";

  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {/* Only run DevAuth inside the app (never on public pages) */}
        {!(isPublicQuestionnaire || isPublicThankYou) && <DevAuth />}

        {(isAuthRoute || isPublicQuestionnaire || isPublicThankYou) ? (
          children
        ) : (
          <AppShell>{children}</AppShell>
        )}

        <Toaster />
      </body>
    </html>
  );
}