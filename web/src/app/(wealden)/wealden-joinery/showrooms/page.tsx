import type { Metadata } from "next";
import { getImagesByHint } from "../_lib/wealdenAiImages";
import { ShowroomsContent } from "./_components/showrooms-content";

export const metadata: Metadata = {
  title: "Showrooms — Visit Us Nationwide | Lignum by Wealden Joinery",
  description:
    "Visit our showrooms across the UK. See timber windows and doors in person, explore samples, and discuss your project. From our Crowborough headquarters to locations across the Southeast.",
  robots: {
    index: false,
    follow: false,
  },
};

const heroImage = getImagesByHint("showroom", 1)[0] || getImagesByHint("lifestyle", 1)[0] || null;
const showroomImages = getImagesByHint("workshop", 6);

export default function ShowroomsPage() {
  return <ShowroomsContent heroImage={heroImage} showroomImages={showroomImages} />;
}
