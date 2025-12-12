import type { Metadata } from "next";
import { getImagesByHint } from "../_lib/wealdenAiImages";
import { ChoicesContent } from "./_components/choices-content";

export const metadata: Metadata = {
  title: "Design Choices & Details — Architectural Specification | Lignum by Wealden Joinery",
  description:
    "Comprehensive specification guide: colours, glazing, hardware, and architectural details for timber windows and doors. Heritage to contemporary.",
};

const detailImages = getImagesByHint("detail", 10);

export default function ChoicesPage() {
  return <ChoicesContent detailImages={detailImages} />;
}
