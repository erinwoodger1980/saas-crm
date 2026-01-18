"use client";

// Tracking helpers for the Wealden Joinery marketing section.
// TODO: Replace GTM_ID and META_PIXEL_ID with live identifiers before launch.

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const GTM_ID = "TODO_GTM_ID";
const META_PIXEL_ID = "TODO_META_PIXEL_ID";
const GA4_MEASUREMENT_ID = "G-PCBG93RTMY";

const ALLOWED_HOSTNAMES = new Set(["lignumwindows.com", "www.lignumwindows.com"]);

const shouldLoadGtm = GTM_ID !== "TODO_GTM_ID";
const shouldLoadMetaPixel = META_PIXEL_ID !== "TODO_META_PIXEL_ID";
const shouldLoadGa4 = GA4_MEASUREMENT_ID !== "TODO_GA4_MEASUREMENT_ID";

export type TrackingPayload = {
  value?: number;
  currency?: string;
  content_name?: string;
  content_category?: string;
  [key: string]: unknown;
};

function pushToDataLayer(event: string, payload?: TrackingPayload) {
  if (typeof window === "undefined") return;
  const dataLayer = (window as typeof window & { dataLayer?: unknown[] }).dataLayer;
  if (!dataLayer) return;
  dataLayer.push({
    event,
    brand: "Wealden Joinery",
    ...payload,
  });
}

function fbTrack(event: string, payload?: TrackingPayload) {
  if (typeof window === "undefined") return;
  const fbq = (window as typeof window & { fbq?: (...args: unknown[]) => void }).fbq;
  if (!fbq) return;
  fbq("track", event, payload);
}

export function TrackingScripts() {
  const pathname = usePathname();
  const [hostname, setHostname] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHostname(window.location.hostname);
  }, []);

  const shouldLoadOnThisHost = useMemo(() => {
    if (!hostname) return false;
    return ALLOWED_HOSTNAMES.has(hostname);
  }, [hostname]);

  // Fire GA4 page_view on client-side navigation (Next.js App Router).
  useEffect(() => {
    if (!shouldLoadGa4 || !shouldLoadOnThisHost) return;
    if (typeof window === "undefined") return;

    const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (!gtag) return;

    const page_path = `${window.location.pathname}${window.location.search ?? ""}`;

    gtag("config", GA4_MEASUREMENT_ID, { page_path });
  }, [pathname, shouldLoadOnThisHost]);

  return (
    <>
      {shouldLoadGa4 && shouldLoadOnThisHost && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="wealden-ga4" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA4_MEASUREMENT_ID}');
            `}
          </Script>
        </>
      )}

      {shouldLoadGtm && (
        <Script id="wealden-gtm" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){
              w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
              var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
              j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
              f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${GTM_ID}');
          `}
        </Script>
      )}

      {shouldLoadMetaPixel && (
        <Script id="wealden-meta-pixel" strategy="afterInteractive">
          {`
            !(function(f,b,e,v,n,t,s){
              if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)
            })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}

export const wealdenTrack = {
  lead(payload?: TrackingPayload) {
    pushToDataLayer("wealden_lead", payload);
    fbTrack("Lead", payload);
  },
  viewContent(payload?: TrackingPayload) {
    pushToDataLayer("wealden_view_content", payload);
    fbTrack("ViewContent", payload);
  },
  estimatorStarted(payload?: TrackingPayload) {
    pushToDataLayer("wealden_estimator_started", payload);
    fbTrack("StartTrial", payload);
  },
  estimatorCompleted(payload?: TrackingPayload) {
    pushToDataLayer("wealden_estimator_completed", payload);
    fbTrack("CompleteRegistration", payload);
  },
  consultationBooked(payload?: TrackingPayload) {
    pushToDataLayer("wealden_consultation_booked", payload);
    fbTrack("Contact", payload);
  },
};
