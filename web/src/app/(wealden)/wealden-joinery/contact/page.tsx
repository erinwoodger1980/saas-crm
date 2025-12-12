import type { Metadata } from "next";
import { getImagesByHint } from "../_lib/wealdenAiImages";
import { ContactContent } from "./_components/contact-content";

export const metadata: Metadata = {
  title: "Contact Wealden Joinery | Get in Touch",
  description:
    "Contact Wealden Joinery for timber windows and doors. Visit our Crowborough HQ or showrooms nationwide. Call, email, or use our online form.",
};

// Optional hero image - convert to expected format
const img = getImagesByHint("showroom", 1)[0] || getImagesByHint("workshop", 1)[0];
const heroImage = img ? { src: img.publicPath, alt: img.caption } : null;

export default function ContactPage() {
  return <ContactContent heroImage={heroImage} />;
}
