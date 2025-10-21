import type { Metadata } from "next";
import LandingPage from "./(public)/components/LandingPage";

const title = "JoineryAI — Faster Quotes, Smarter Workshops";
const description =
  "JoineryAI helps UK joinery manufacturers automate quoting, follow-ups and workshop scheduling with a 14-day free trial.";

export const metadata: Metadata = {
  metadataBase: new URL("https://joineryai.app"),
  title,
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    url: "https://joineryai.app",
    siteName: "JoineryAI",
    images: [
      {
        url: "https://joineryai.app/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "JoineryAI platform preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["https://joineryai.app/og-image.jpg"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function Page() {
  return <LandingPage />;
}
