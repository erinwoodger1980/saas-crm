import type { Metadata } from "next";
import TimberWindowsClient from "../(wealden)/wealden-joinery/timber-windows/timber-windows-client";

export const metadata: Metadata = {
  title: "Timber Windows | Lignum by Wealden Joinery",
  description:
    "Premium timber windows made and installed in the UK. Heritage sash and flush casement options with modern performance, security, and finish.",
  alternates: {
    canonical: "https://www.lignumwindows.com/timber-windows",
  },
};

export default function TimberWindowsPage() {
  return <TimberWindowsClient />;
}
