import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "../_components/section-heading";
import { getImagesByHint } from "../_lib/wealdenAiImages";
import { ProjectsContent } from "./_components/projects-content";

export const metadata: Metadata = {
  title: "Recent Projects — Heritage & Contemporary | Lignum by Wealden Joinery",
  description:
    "Case studies across Sussex, Kent, and the South East. Listed buildings, conservation areas, and contemporary new builds.",
};

const projectImages = getImagesByHint("case-study", 12);
const lifestyleImages = getImagesByHint("lifestyle", 9); // Increased for curated grid

export default function ProjectsPage() {
  return <ProjectsContent projectImages={projectImages} lifestyleImages={lifestyleImages} />;
}
