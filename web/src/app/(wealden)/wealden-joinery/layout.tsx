import type { Metadata } from "next";
import Script from "next/script";
import { ReactNode } from "react";
import { WealdenFooter } from "./_components/footer";
import { WealdenNavbar } from "./_components/navbar";
import { TrackingScripts } from "./_components/tracking";

// Layout shell for all Wealden Joinery marketing pages.
export const metadata: Metadata = {
  title: "Wealden Joinery | Timber Windows & Doors crafted in Sussex",
  description:
    "Premium timber windows and doors designed, manufactured, and installed by Wealden Joinery. Heritage expertise, high performance, and attentive aftercare.",
  openGraph: {
    title: "Wealden Joinery | Timber Windows & Doors crafted in Sussex",
    description:
      "Beautiful, high-performance timber windows and doors from Sussex joinery specialists. Explore sash, casement, doors, and alu-clad options.",
    url: "https://joineryai.app/wealden-joinery",
    siteName: "Wealden Joinery",
    type: "website",
  },
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Wealden Joinery',
  description: 'Sussex-based specialists in timber windows, doors, and alu-clad systems with heritage expertise.',
  url: 'https://joineryai.app/wealden-joinery',
  telephone: '+44 0 0000 0000', // TODO: replace with real contact number
  email: 'martin@wealdenjoinery.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'TBD',
    addressLocality: 'East Sussex',
    addressRegion: 'East Sussex',
    postalCode: 'TBD',
    addressCountry: 'GB',
  },
  areaServed: ['London', 'South East', 'South East England'],
  openingHours: 'Mo-Fr 09:00-17:00',
};

export default function WealdenLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TrackingScripts />
      <Script id="wealden-localbusiness" type="application/ld+json">
        {JSON.stringify(localBusinessSchema)}
      </Script>
      <WealdenNavbar />
      <main className="mx-auto max-w-7xl px-4 md:px-8">{children}</main>
      <WealdenFooter />
    </div>
  );
}
