import type { Metadata } from "next";
import TimberDoorsClient from "./timber-doors-client";

export const metadata: Metadata = {
  title: "Timber Doors | Lignum by Wealden Joinery",
  description:
    "Premium timber doors made and installed in the UK. Entrance, French, sliding, and bi-fold options with secure performance and heritage detailing.",
  alternates: {
    canonical: "https://www.lignumwindows.com/timber-doors",
  },
};

export default function TimberDoorsPage() {
  return <TimberDoorsClient />;
}
