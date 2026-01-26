"use client";

// Note: Chrome may log "The resource ...css was preloaded using link preload but not used..."
// This is a Next.js optimization warning, not an error. Next.js preloads CSS for faster page loads.
// It occurs when CSS is preloaded but the route/component using it hasn't rendered yet.
// Safe to ignore - does not break functionality.

import "./globals.css";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/toaster";
import AppShell from "./components/AppShell";
import FeedbackWidget from "@/components/FeedbackWidget";
import { setJwt, apiFetch } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";
import Script from "next/script";

const JOINERY_GA4_MEASUREMENT_ID = "G-LL7W6BJ0C2";
const LIGNUM_GA4_MEASUREMENT_ID = String(
  (process as any)?.env?.NEXT_PUBLIC_LIGNUM_GA4_MEASUREMENT_ID || "",
).trim();
const JOINERY_ALLOWED_HOSTNAMES = new Set(["joineryai.app", "www.joineryai.app"]);
const WEALDEN_MARKETING_HOSTNAMES = new Set(["lignumwindows.com", "www.lignumwindows.com"]);
const WEALDEN_MARKETING_CLEAN_PATHS = new Set([
  "/",
  "/windows",
  "/doors",
  "/alu-clad",
  "/projects",
  "/choices",
  "/showrooms",
  "/about",
  "/contact",
  "/estimate",
  "/timber-windows",
  "/timber-windows-east-sussex",
  "/lignum-windows",
  "/privacy",
]);

function GlobalNumericSelectAll() {
  useEffect(() => {
    const handler = (e: FocusEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.disabled || target.readOnly) return;

      const isNumeric =
        target.type === "number" ||
        target.inputMode === "decimal" ||
        target.inputMode === "numeric";
      if (!isNumeric) return;

      // Defer so the browser's default caret placement doesn't override selection.
      requestAnimationFrame(() => {
        try {
          target.select();
        } catch {
          // noop
        }
      });
    };

    window.addEventListener("focusin", handler, true);
    return () => window.removeEventListener("focusin", handler, true);
  }, []);

  return null;
}

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
  const [hostname, setHostname] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHostname(window.location.hostname);
  }, []);

  const isJoineryHost = useMemo(() => {
    if (!hostname) return false;
    return JOINERY_ALLOWED_HOSTNAMES.has(hostname);
  }, [hostname]);

  const isWealdenMarketingHost = useMemo(() => {
    if (!hostname) return false;
    return WEALDEN_MARKETING_HOSTNAMES.has(hostname);
  }, [hostname]);

  const isAuthRoute = pathname?.startsWith("/login");
  const isPublicQuestionnaire = pathname?.startsWith("/q/");
  const isPublicThankYou =
    pathname === "/thank-you" || pathname?.startsWith("/q/thank-you");
  const isWealdenMarketingPath = WEALDEN_MARKETING_CLEAN_PATHS.has(pathname || "");
  const isMarketingRoute =
    pathname === "/" ||
    pathname?.startsWith("/policy") ||
    pathname?.startsWith("/wealden-landing") ||
    pathname?.startsWith("/wealden-joinery") ||
    (isWealdenMarketingHost && isWealdenMarketingPath) ||
    (!hostname && isWealdenMarketingPath);
  const isPublicEstimatorRoute =
    pathname === "/estimate" ||
    pathname?.startsWith("/estimate-demo") ||
    Boolean(pathname?.match(/^\/tenant\/[^/]+\/estimate(\/|$)/));
  const isTenantLandingPage = pathname?.match(/^\/tenant\/[^/]+\/landing(\/|$)/);
  const isVanityTenantLandingPage = pathname?.match(/^\/[A-Za-z0-9-]+\/landing(\/|$)/);
  const isEarlyAccessRoute = pathname?.startsWith("/early-access");
  const isWorkshopRoute = pathname === "/workshop";
  const isDevConsole = pathname?.startsWith("/dev");
  const isCustomerPortalRoute = pathname?.startsWith("/customer-portal");
  const isQuotePortalRoute = pathname?.startsWith("/portal");

  const shouldFetchUser = !(
    isAuthRoute ||
    isPublicQuestionnaire ||
    isPublicThankYou ||
    isMarketingRoute ||
    isPublicEstimatorRoute ||
    isTenantLandingPage ||
    isVanityTenantLandingPage ||
    isEarlyAccessRoute ||
    isCustomerPortalRoute ||
    isQuotePortalRoute
  );

  const { user } = useCurrentUser({ enabled: shouldFetchUser });
  const isWorkshopOnly = user?.role === 'workshop';

  const shouldUseShell = !(
    isAuthRoute ||
    isPublicQuestionnaire ||
    isPublicThankYou ||
    isMarketingRoute ||
    isPublicEstimatorRoute ||
    isTenantLandingPage ||
    isVanityTenantLandingPage ||
    isEarlyAccessRoute ||
    (isWorkshopRoute && isWorkshopOnly) ||
    isDevConsole ||
    isCustomerPortalRoute ||
    isQuotePortalRoute
  );
  
  const shouldShowTasks = shouldFetchUser && !(
    isAuthRoute ||
    isPublicQuestionnaire ||
    isPublicThankYou ||
    isMarketingRoute ||
    isPublicEstimatorRoute ||
    isTenantLandingPage ||
    isVanityTenantLandingPage ||
    isEarlyAccessRoute
  );
  const shouldRunDevAuth = !(
    isPublicQuestionnaire ||
    isPublicThankYou ||
    isMarketingRoute ||
    isPublicEstimatorRoute ||
    isTenantLandingPage ||
    isVanityTenantLandingPage ||
    isEarlyAccessRoute ||
    isCustomerPortalRoute ||
    isQuotePortalRoute
  );
  const shouldLoadAnalytics = !(
    isEarlyAccessRoute
  );

  const siteTitle = isWealdenMarketingHost ? "Lignum Windows" : "Joineryai.app";

  // GA4 SPA pageview tracking for joineryai.app only.
  useEffect(() => {
    if (!shouldLoadAnalytics || !isJoineryHost) return;
    if (typeof window === "undefined") return;
    const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (!gtag) return;
    const page_path = `${window.location.pathname}${window.location.search ?? ""}`;
    gtag("config", JOINERY_GA4_MEASUREMENT_ID, { page_path });
  }, [pathname, shouldLoadAnalytics, isJoineryHost]);

  // GA4 SPA pageview tracking for lignumwindows.com only.
  useEffect(() => {
    if (!shouldLoadAnalytics || !isWealdenMarketingHost) return;
    if (!LIGNUM_GA4_MEASUREMENT_ID) return;
    if (typeof window === "undefined") return;
    const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (!gtag) return;
    const page_path = `${window.location.pathname}${window.location.search ?? ""}`;
    gtag("config", LIGNUM_GA4_MEASUREMENT_ID, { page_path });
  }, [pathname, shouldLoadAnalytics, isWealdenMarketingHost]);

  return (
    <html lang="en" className="h-full">
      <head>
        <title>{siteTitle}</title>
        {shouldLoadAnalytics && (
          <>
            {/* GA4 for joineryai.app only */}
            <Script id="joinery-ga4-loader" strategy="afterInteractive">
              {`
                (function() {
                  try {
                    var host = window.location && window.location.hostname;
                    if (host !== 'joineryai.app' && host !== 'www.joineryai.app') return;

                    var id = '${JOINERY_GA4_MEASUREMENT_ID}';
                    var existing = document.querySelector('script[src*="googletagmanager.com/gtag/js?id=' + id + '"]');
                    if (!existing) {
                      var s = document.createElement('script');
                      s.async = true;
                      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
                      document.head.appendChild(s);
                    }

                    window.dataLayer = window.dataLayer || [];
                    function gtag(){window.dataLayer.push(arguments);}
                    window.gtag = window.gtag || gtag;
                    window.gtag('js', new Date());
                    window.gtag('config', id);
                  } catch (e) {
                    // noop
                  }
                })();
              `}
            </Script>

            {/* GA4 for lignumwindows.com only (requires NEXT_PUBLIC_LIGNUM_GA4_MEASUREMENT_ID) */}
            <Script id="lignum-ga4-loader" strategy="afterInteractive">
              {`
                (function() {
                  try {
                    var host = window.location && window.location.hostname;
                    if (host !== 'lignumwindows.com' && host !== 'www.lignumwindows.com') return;

                    var id = '${LIGNUM_GA4_MEASUREMENT_ID}';
                    if (!id) return;
                    var existing = document.querySelector('script[src*="googletagmanager.com/gtag/js?id=' + id + '"]');
                    if (!existing) {
                      var s = document.createElement('script');
                      s.async = true;
                      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
                      document.head.appendChild(s);
                    }

                    window.dataLayer = window.dataLayer || [];
                    function gtag(){window.dataLayer.push(arguments);}
                    window.gtag = window.gtag || gtag;
                    window.gtag('js', new Date());
                    window.gtag('config', id);
                  } catch (e) {
                    // noop
                  }
                })();
              `}
            </Script>

            <Script id="google-ads-gtag-loader" strategy="afterInteractive">
              {`
                (function() {
                  try {
                    var host = window.location && window.location.hostname;
                    if (host === 'lignumwindows.com' || host === 'www.lignumwindows.com') return;

                    var id = 'AW-17711287541';
                    var existing = document.querySelector('script[src*="googletagmanager.com/gtag/js?id=' + id + '"]');
                    if (!existing) {
                      var s = document.createElement('script');
                      s.async = true;
                      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
                      document.head.appendChild(s);
                    }

                    window.dataLayer = window.dataLayer || [];
                    function gtag(){window.dataLayer.push(arguments);}
                    window.gtag = window.gtag || gtag;
                    window.gtag('js', new Date());
                    window.gtag('config', id);
                  } catch (e) {
                    // noop
                  }
                })();
              `}
            </Script>
          </>
        )}
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {shouldRunDevAuth && <DevAuth />}
        <GlobalNumericSelectAll />

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