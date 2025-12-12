import type { Metadata } from "next";
import { getImagesByHint } from "../_lib/wealdenAiImages";
import { AboutContent } from "./_components/about-content";

export const metadata: Metadata = {
  title: "About — Traditional Craft, Modern Performance | Lignum by Wealden Joinery",
  description:
    "Since the 1990s, crafting premium timber windows and doors. Made-to-order at our Crowborough headquarters, delivered nationwide through our showroom network.",
};

const heroImage = getImagesByHint("craftsman", 1)[0] || getImagesByHint("workshop", 1)[0] || null;
const storyImages = getImagesByHint("workshop", 3);
const valuesImage = getImagesByHint("lifestyle", 1)[0] || null;
const showroomImage = getImagesByHint("showroom", 1)[0] || getImagesByHint("lifestyle", 1)[1] || null;

export default function AboutPage() {
  return <AboutContent heroImage={heroImage} storyImages={storyImages} valuesImage={valuesImage} showroomImage={showroomImage} />;
}
