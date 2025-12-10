import type { Metadata };
import Image from "next/image";
import Link from "next/link";
import wealdenImageMap from "@/scripts/wealden-image-map.json";
import { SectionHeading } from "../_components/section-heading";

export const metadata: Metadata = {
  title: "Recent Projects Across the South East | Wealden Joinery",
  description:
    "View our recent timber window and door installations across Sussex, Kent, and the South East. Heritage and contemporary projects.",
};

type WealdenImage = {
  originalUrl: string;
  localPath: string;
  alt: string;
  page?: string;
  site?: string;
};

const wealdenImages = (wealdenImageMap as { images: WealdenImage[] }).images ?? [];

const projects = [
  {
    location: "Tunbridge Wells, Kent",
    type: "Victorian villa",
    products: "Sash windows & entrance door",
    description: "Complete ground floor replacement with heritage glazing bars, multi-point locking, and discreet balances. Painted in Farrow & Ball Railings.",
    bullets: [
      "12 sash windows with slim double glazing",
      "Oak entrance door with leaded glass toplights",
      "Conservation area approval obtained",
      "Installation completed in 3 days",
    ],
  },
  {
    location: "Lewes, East Sussex",
    type: "Georgian townhouse",
    products: "Slimline sash replacements",
    description: "Listed building consent for sympathetic replacements with traditional weight-and-pulley balances and hand-blown glass.",
    bullets: [
      "18 bespoke sash windows across three floors",
      "Heritage glazing bar patterns matched to originals",
      "Lime putty glazing for authenticity",
      "Painted in heritage off-white",
    ],
  },
  {
    location: "Sevenoaks, Kent",
    type: "Country home",
    products: "Casement windows & French doors",
    description: "Contemporary flush casements and wide French doors opening onto garden terrace. Accoya timber with micro-porous stain.",
    bullets: [
      "16 flush casement windows with concealed locks",
      "3-metre French door opening with slim stiles",
      "Accoya timber with 50-year guarantee",
      "Natural oak stain finish",
    ],
  },
  {
    location: "Brighton, East Sussex",
    type: "Coastal apartment",
    products: "Alu-clad sliding doors",
    description: "Large sliding doors with anthracite aluminium cladding and oak interior. High-performance glazing for acoustic and thermal comfort.",
    bullets: [
      "4-panel sliding system with concealed drainage",
      "Acoustic laminated glazing for coastal wind",
      "Anthracite aluminium cladding with oak inside",
      "Low-maintenance for rental property",
    ],
  },
  {
    location: "Crowborough, East Sussex",
    type: "Arts & Crafts home",
    products: "Casement windows & bi-fold doors",
    description: "Period-appropriate casements with leaded lights and 5-panel bi-fold opening onto garden. Painted in heritage green.",
    bullets: [
      "20 casement windows with leaded glazing",
      "5-panel bi-fold doors with brass hardware",
      "Engineered hardwood cores for stability",
      "Heritage green paint finish",
    ],
  },
  {
    location: "Rye, East Sussex",
    type: "Medieval cottage",
    products: "Conservation sash windows",
    description: "Grade II listed consent for sympathetic sash replacements with hand-blown glass and traditional ironmongery.",
    bullets: [
      "8 conservation sash windows with slimline double glazing",
      "Hand-blown glass for authenticity",
      "Traditional brass fittings",
      "Listed building consent obtained",
    ],
  },
];

export default function ProjectsPage() {
  const projectImages = wealdenImages.slice(0, projects.length);

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-12 md:px-10 md:py-16">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <p className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">Case Studies</p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
              Recent Projects Across the South East
            </h1>
            <p className="text-lg text-slate-600">
              Heritage-sensitive replacements and contemporary new installs from Sussex to Kent. Every project is crafted to suit
              the property and deliver long-life performance.
            </p>
          </div>
        </div>
      </section>

      {/* Project Grid */}
      <section>
        <div className="grid gap-6">
          {projects.map((project, index) => {
            const projectImage = projectImages[index] ?? projectImages[0];
            return (
              <article
                key={project.location}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
                  {projectImage && (
                    <div className="relative h-64 w-full md:h-auto">
                      <Image
                        src={projectImage.localPath}
                        alt={projectImage.alt || `${project.type} project by Wealden Joinery`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="space-y-5 p-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{project.location}</p>
                      <h3 className="mt-1 text-xl font-semibold text-slate-900">{project.type}</h3>
                      <p className="mt-1 text-sm font-medium text-emerald-700">{project.products}</p>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">{project.description}</p>
                    <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
                      {project.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-2">
                          <span className="text-emerald-700">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/wealden-joinery/contact"
                      className="inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                    >
                      Start your project →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-emerald-800 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 p-8 shadow-lg md:p-10 text-white">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <h3 className="text-3xl font-semibold">Ready to start your project?</h3>
          <p className="text-sm leading-relaxed text-emerald-100">
            Get an instant estimate or book a consultation to discuss your requirements, heritage constraints, and design options.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm font-semibold">
            <Link
              href="/wealden-joinery/estimate"
              className="rounded-full bg-white px-6 py-3 text-emerald-900 transition hover:scale-[1.02] hover:bg-emerald-50"
            >
              Get an Instant Estimate
            </Link>
            <Link
              href="/wealden-joinery/contact"
              className="rounded-full bg-white/10 px-6 py-3 text-white ring-1 ring-white/30 transition hover:scale-[1.02] hover:bg-white/20"
            >
              Book a Consultation
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
