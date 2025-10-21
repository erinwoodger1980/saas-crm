"use client";

import "./globals.css";
import { ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/toaster";
import AppShell from "./components/AppShell";
import { TasksButton } from "@/components/tasks/TasksButton";

// Keep your existing env usage for DevAuth
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:4000";

function DevAuth() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("jwt")) return;

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

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith("/login");
  const isPublicQuestionnaire = pathname?.startsWith("/q/");
  const isPublicThankYou = pathname === "/thank-you" || pathname?.startsWith("/q/thank-you");
  const isMarketingRoute = pathname === "/" || pathname?.startsWith("/policy");
  const shouldUseShell = !(isAuthRoute || isPublicQuestionnaire || isPublicThankYou || isMarketingRoute);
  const shouldRunDevAuth = !(isPublicQuestionnaire || isPublicThankYou || isMarketingRoute);

  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {shouldRunDevAuth && <DevAuth />}

        {shouldUseShell ? (
          // ✅ Use the shared AppShell (sidebar + header + logos, no max-width cap)
          <AppShell>{children}</AppShell>
        ) : (
          children
        )}

        {shouldUseShell && <TasksButton />}

        <Toaster />
      </body>
    </html>
  );
}