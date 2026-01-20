import type { Metadata } from "next";
import { ProjectsContent } from "./_components/projects-content";

export const metadata: Metadata = {
  title: "Recent Projects — Heritage & Contemporary | Lignum by Wealden Joinery",
  description:
    "Case studies across Sussex, Kent, and the South East. Listed buildings, conservation areas, and contemporary new builds.",
};

export default function ProjectsPage() {
  return <ProjectsContent />;
}
