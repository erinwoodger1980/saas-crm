import type { Metadata } from "next";
import TimberWindowsEastSussexClient from "./timber-windows-east-sussex-client";

export const metadata: Metadata = {
  title: "Timber Windows East Sussex | Lignum by Wealden Joinery",
  description:
    "Premium timber windows for East Sussex homes. Heritage sash and flush casement designs with modern performance, security, and finish.",
  alternates: {
    canonical: "https://www.lignumwindows.com/timber-windows-east-sussex",
  },
};

export default function TimberWindowsEastSussexPage() {
  return <TimberWindowsEastSussexClient />;
}
