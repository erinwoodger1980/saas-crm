import type { Metadata } from "next";
import NewHomepage from "./(public)/components/NewHomepage";

const title = "JoineryAI — Quote Faster. Win More Jobs. Run a Smarter Workshop.";
const description =
  "AI-powered quoting, email automation, CRM, and workshop management for UK joinery manufacturers. Try free for 14 days.";

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
  return <NewHomepage />;
}
