import type { Metadata } from "next";
import LignumWindowsClient from "./lignum-windows-client";

export const metadata: Metadata = {
  title: "Lignum Windows | Lignum by Wealden Joinery",
  description:
    "Premium Lignum timber windows with heritage sash and flush casement options. Crafted in the UK with modern performance and finish.",
  alternates: {
    canonical: "https://www.lignumwindows.com/lignum-windows",
  },
};

export default function LignumWindowsPage() {
  return <LignumWindowsClient />;
}
