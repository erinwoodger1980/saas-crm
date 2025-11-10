import React from "react";
import Script from "next/script";

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Google tag (gtag.js) */}
      <Script
        async
        src="https://www.googletagmanager.com/gtag/js?id=AW-17711287541"
        strategy="afterInteractive"
      />
      <Script id="gtag-aw-17711287541" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-17711287541');
        `}
      </Script>
      {children}
    </>
  );
}
