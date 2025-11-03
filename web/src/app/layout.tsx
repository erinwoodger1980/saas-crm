"use client";

import "./globals.css";
import { ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/toaster";
import AppShell from "./components/AppShell";
import { TasksButton } from "@/components/tasks/TasksButton";
import FeedbackWidget from "@/components/FeedbackWidget";
import { API_BASE, setJwt, apiFetch } from "@/lib/api";

function DevAuth() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "development") return; // Only run in development
    if (localStorage.getItem("jwt")) return;

    // use apiFetch so credentials and API_BASE are resolved consistently
    (async () => {
      try {
  const d = await apiFetch<any>("/seed", { method: "POST", credentials: "omit" });
        const token = d?.token || d?.jwt;
        if (token) {
          setJwt(token);
          location.reload();
        }
      } catch (err) {
        console.error("Auto-seed failed:", err);
      }
    })();
  }, []);
  return null;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isAuthRoute = pathname?.startsWith("/login");
  const isPublicQuestionnaire = pathname?.startsWith("/q/");
  const isPublicThankYou =
    pathname === "/thank-you" || pathname?.startsWith("/q/thank-you");
  const isMarketingRoute =
    pathname === "/" || pathname?.startsWith("/policy");

  const shouldUseShell = !(
    isAuthRoute ||
    isPublicQuestionnaire ||
    isPublicThankYou ||
    isMarketingRoute
  );
  const shouldRunDevAuth = !(
    isPublicQuestionnaire ||
    isPublicThankYou ||
    isMarketingRoute
  );

  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {shouldRunDevAuth && <DevAuth />}

        {shouldUseShell ? (
          <AppShell>{children}</AppShell>
        ) : (
          children
        )}

  {shouldUseShell && <TasksButton />}
  {shouldUseShell && <FeedbackWidget />}

        <Toaster />
      </body>
    </html>
  );
}