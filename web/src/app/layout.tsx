"use client";

// Note: Chrome may log "The resource ...css was preloaded using link preload but not used..."
// This is a Next.js optimization warning, not an error. Next.js preloads CSS for faster page loads.
// It occurs when CSS is preloaded but the route/component using it hasn't rendered yet.
// Safe to ignore - does not break functionality.

import "./globals.css";
import { ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/toaster";
import AppShell from "./components/AppShell";
import FeedbackWidget from "@/components/FeedbackWidget";
import { setJwt, apiFetch } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";
import Script from "next/script";

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
    pathname === "/" ||
    pathname?.startsWith("/policy") ||
    pathname?.startsWith("/wealden-landing") ||
    pathname?.startsWith("/wealden-joinery");
  const isTenantLandingPage = pathname?.match(/^\/tenant\/[^/]+\/landing(\/|$)/);
  const isVanityTenantLandingPage = pathname?.match(/^\/[A-Za-z0-9-]+\/landing(\/|$)/);
  const isEarlyAccessRoute = pathname?.startsWith("/early-access");
  const isWorkshopRoute = pathname === "/workshop";
  const isDevConsole = pathname?.startsWith("/dev");

  const shouldFetchUser = !(
    isAuthRoute ||
    isPublicQuestionnaire ||
    isPublicThankYou ||
    isMarketingRoute ||
    isTenantLandingPage ||
    isVanityTenantLandingPage ||
    isEarlyAccessRoute
  );

  const { user } = useCurrentUser({ enabled: shouldFetchUser });
  const isWorkshopOnly = user?.role === 'workshop';

  const shouldUseShell = !(
    isAuthRoute ||
    isPublicQuestionnaire ||
    isPublicThankYou ||
    isMarketingRoute ||
    isTenantLandingPage ||
    isVanityTenantLandingPage ||
    isEarlyAccessRoute ||
    (isWorkshopRoute && isWorkshopOnly) ||
    isDevConsole
  );
  
  const shouldShowTasks = shouldFetchUser && !(
    isAuthRoute ||
    isPublicQuestionnaire ||
    isPublicThankYou ||
    isMarketingRoute ||
    isTenantLandingPage ||
    isVanityTenantLandingPage ||
    isEarlyAccessRoute
  );
  const shouldRunDevAuth = !(
    isPublicQuestionnaire ||
    isPublicThankYou ||
    isMarketingRoute ||
    isTenantLandingPage ||
    isVanityTenantLandingPage ||
    isEarlyAccessRoute
  );
  const shouldLoadAnalytics = !(
    isEarlyAccessRoute
  );

  return (
    <html lang="en" className="h-full">
      <head>
        {shouldLoadAnalytics && (
          <>
            <Script
              async
              src="https://www.googletagmanager.com/gtag/js?id=AW-17711287541"
            />
            <Script id="google-gtag" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', 'AW-17711287541');
              `}
            </Script>
          </>
        )}
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {shouldRunDevAuth && <DevAuth />}

        {shouldUseShell ? (
          <AppShell>{children}</AppShell>
        ) : (
          children
        )}

  {/* TasksButton removed: Task Center accessible via main navigation */}
  {shouldUseShell && <FeedbackWidget />}

        <Toaster />
      </body>
    </html>
  );
}