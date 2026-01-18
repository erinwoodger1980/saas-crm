import React from "react";
import Script from "next/script";

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Google tag (gtag.js) */}
      <Script id="gtag-aw-17711287541" strategy="afterInteractive">
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
      {children}
    </>
  );
}
