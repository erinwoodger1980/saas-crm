import type { Metadata } from "next";
import EarlyAccessPage from "./client";

export const metadata: Metadata = {
  title: "Early Access Signup — JoineryAI",
  description: "Join JoineryAI as an early adopter and get 30 days free plus exclusive access to new features.",
  robots: {
    index: false, // Don't index the early access page
    follow: false,
  },
};

export default function Page() {
  return <EarlyAccessPage />;
}
