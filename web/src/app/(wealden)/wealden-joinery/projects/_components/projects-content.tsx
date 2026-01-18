"use client";

import { useState } from "react";
import Link from "next/link";
import { ImageSlot } from "../../_components/image-slot";

interface Project {
  location: string;
  type: string;
  products: string;
  description: string;
  bullets: string[];
  tags: {
    product: string[];
    property: string[];
    region: string;
  };
  imageIndex: number;
}

const projects: Project[] = [
  {
    location: "Tunbridge Wells, Kent",
    type: "Victorian villa",
    products: "Sash windows & entrance door",
    description: "Complete ground floor replacement with heritage glazing bars and conservation area approval.",
    bullets: [
      "12 sash windows with slim double glazing",
      "Oak entrance door with leaded glass",
      "F&B Railings paint finish",
      "3-day installation"
    ],
    tags: {
      product: ["Sash", "Doors"],
      property: ["Period"],
      region: "Kent"
    },
    imageIndex: 0
  },
  {
    location: "Lewes, East Sussex",
    type: "Georgian townhouse",
    products: "Slimline sash replacements",
    description: "Listed building consent for 18 bespoke sash windows with traditional weight-and-pulley balances.",
    bullets: [
      "18 sash windows across three floors",
      "Heritage glazing bar patterns",
      "Lime putty glazing",
      "Listed building consent obtained"
    ],
    tags: {
      product: ["Sash"],
      property: ["Listed", "Period"],
      region: "Sussex"
    },
    imageIndex: 1
  },
  {
    location: "Sevenoaks, Kent",
    type: "Country home",
    products: "Casement windows & French doors",
    description: "Contemporary flush casements and wide French doors with Accoya timber.",
    bullets: [
      "16 flush casement windows",
      "3-metre French door opening",
      "Accoya 50-year guarantee",
      "Natural oak stain finish"
    ],
    tags: {
      product: ["Casement", "Doors"],
      property: ["Contemporary"],
      region: "Kent"
    },
    imageIndex: 2
  },
  {
    location: "Brighton, East Sussex",
    type: "Coastal apartment",
    products: "Alu-clad sliding doors",
    description: "Large sliding doors with acoustic laminated glazing for coastal performance.",
    bullets: [
      "4-panel sliding system",
      "Acoustic laminated glazing",
      "Anthracite alu-clad with oak interior",
      "Low-maintenance specification"
    ],
    tags: {
      product: ["Alu-clad", "Sliding"],
      property: ["Contemporary", "Coastal"],
      region: "Sussex"
    },
    imageIndex: 3
  },
  {
    location: "Crowborough, East Sussex",
    type: "Arts & Crafts home",
    products: "Casement windows & bi-fold doors",
    description: "Period-appropriate casements with leaded lights and 5-panel bi-fold system.",
    bullets: [
      "20 casement windows with leaded glazing",
      "5-panel bi-fold with brass hardware",
      "Engineered hardwood cores",
      "Heritage green paint finish"
    ],
    tags: {
      product: ["Casement", "Bifold"],
      property: ["Period"],
      region: "Sussex"
    },
    imageIndex: 4
  },
  {
    location: "Rye, East Sussex",
    type: "Medieval cottage",
    products: "Conservation sash windows",
    description: "Grade II listed consent for 8 conservation sash windows with hand-blown glass.",
    bullets: [
      "Slimline double glazing",
      "Hand-blown glass for authenticity",
      "Traditional brass fittings",
      "Listed building consent"
    ],
    tags: {
      product: ["Sash"],
      property: ["Listed", "Period"],
      region: "Sussex"
    },
    imageIndex: 5
  },
  {
    location: "Holiday-let development, Kent",
    type: "Holiday let window replacement",
    products: "Accoya® timber windows & doors — RAL 1013",
    description:
      "A tight early-December programme to replace windows across multiple units while keeping changeovers running and downtime to a minimum.",
    bullets: [
      "Replacement windows and a new doorway formation",
      "Area-by-area ironmongery schedules (multiple styles)",
      "Access-control fixed screen replacing French doors",
      "Delivered on time despite poor weather"
    ],
    tags: {
      product: ["Casement", "Doors"],
      property: ["Contemporary"],
      region: "Kent"
    },
    imageIndex: 6
  }
];

interface ProjectsContentProps {
  projectImages: any[];
  lifestyleImages: any[];
}

export function ProjectsContent({ projectImages, lifestyleImages }: ProjectsContentProps) {
  const [activeFilters, setActiveFilters] = useState<{
    product: string | null;
    property: string | null;
    region: string | null;
  }>({
    product: null,
    property: null,
    region: null
  });

  const toggleFilter = (category: 'product' | 'property' | 'region', value: string) => {
    setActiveFilters(prev => ({
      ...prev,
      [category]: prev[category] === value ? null : value
    }));
  };

  const filteredProjects = projects.filter(project => {
    if (activeFilters.product && !project.tags.product.includes(activeFilters.product)) return false;
    if (activeFilters.property && !project.tags.property.includes(activeFilters.property)) return false;
    if (activeFilters.region && project.tags.region !== activeFilters.region) return false;
    return true;
  });

  const productFilters = ["Sash", "Casement", "Doors", "Alu-clad", "Sliding", "Bifold"];
  const propertyFilters = ["Period", "Listed", "Contemporary", "Coastal"];
  const regionFilters = ["Sussex", "Kent", "South East"];

  return (
    <div className="space-y-32">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="px-6 py-20 md:px-16 md:py-32">
          <div className="mx-auto max-w-4xl space-y-8 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500">
              Case Studies
            </p>
            <h1 className="text-5xl font-light leading-[1.05] tracking-tight text-slate-900 md:text-7xl">
              Recent projects
            </h1>
            <p className="mx-auto max-w-2xl text-lg font-light leading-relaxed text-slate-600">
              Heritage-sensitive replacements and contemporary new installations across Sussex and Kent. Every project engineered for longevity.
            </p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="space-y-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Filter Projects</p>
          
          <div className="space-y-4">
            {/* Product Filters */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Product</p>
              <div className="flex flex-wrap gap-2">
                {productFilters.map(filter => (
                  <button
                    key={filter}
                    onClick={() => toggleFilter('product', filter)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      activeFilters.product === filter
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Property Filters */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Property</p>
              <div className="flex flex-wrap gap-2">
                {propertyFilters.map(filter => (
                  <button
                    key={filter}
                    onClick={() => toggleFilter('property', filter)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      activeFilters.property === filter
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Region Filters */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Region</p>
              <div className="flex flex-wrap gap-2">
                {regionFilters.map(filter => (
                  <button
                    key={filter}
                    onClick={() => toggleFilter('region', filter)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      activeFilters.region === filter
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            {(activeFilters.product || activeFilters.property || activeFilters.region) && (
              <button
                onClick={() => setActiveFilters({ product: null, property: null, region: null })}
                className="text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Project Grid */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="space-y-16">
          {filteredProjects.map((project) => {
            const projectImage = projectImages[project.imageIndex] || projectImages[0];
            return (
              <article
                key={project.location}
                className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-start"
              >
                {/* Image */}
                <ImageSlot
                  slotId={`projects-card-${project.imageIndex}`}
                  label={`${project.location} Hero`}
                  aspectRatio="aspect-[4/3]"
                  size="lg"
                />

                {/* Content */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      {project.location}
                    </p>
                    <h3 className="text-3xl font-light text-slate-900">{project.type}</h3>
                    <p className="text-sm font-medium uppercase tracking-wider text-slate-700">
                      {project.products}
                    </p>
                  </div>

                  <p className="text-lg leading-relaxed text-slate-600">{project.description}</p>

                  <div className="border-l-2 border-slate-200 pl-6 space-y-2">
                    {project.bullets.map((bullet) => (
                      <p key={bullet} className="text-sm text-slate-600">
                        {bullet}
                      </p>
                    ))}
                  </div>

                  <Link
                    href="../contact"
                    className="inline-flex items-center text-sm font-medium text-slate-900 hover:text-slate-600"
                  >
                    Start your project →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {filteredProjects.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-slate-500">No projects match your selected filters.</p>
          </div>
        )}
      </section>

      {/* Curated Gallery */}
      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6 md:px-8">
          <div className="mb-16 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500">More Installs</p>
            <h2 className="mt-4 text-3xl font-light text-slate-900 md:text-4xl">Recent work</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {lifestyleImages.slice(0, 9).map((img, idx) => (
              <div key={idx} className="space-y-3">
                <ImageSlot
                  slotId={`projects-gallery-${idx}`}
                  label={`Gallery ${idx + 1}`}
                  aspectRatio="aspect-[3/4]"
                  size="md"
                />
                <p className="text-sm text-slate-500">Recent installation</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 py-32">
        <div className="mx-auto max-w-3xl space-y-12 px-6 text-center md:px-8">
          <div className="space-y-6">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/60">
              Start Your Project
            </p>
            <h2 className="text-4xl font-light leading-tight text-white md:text-5xl">
              Ready to discuss<br />your project?
            </h2>
            <p className="mx-auto max-w-xl text-lg font-light leading-relaxed text-white/75">
              Book a consultation to discuss heritage constraints, performance requirements, and detailed specifications.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="../contact"
              className="border-2 border-white px-10 py-4 text-sm font-medium uppercase tracking-[0.15em] text-white transition hover:bg-white hover:text-slate-900"
            >
              Book Consultation
            </Link>
            <Link
              href="../estimate"
              className="border border-white/20 px-10 py-4 text-sm font-medium uppercase tracking-[0.15em] text-white/70 transition hover:border-white/40 hover:text-white"
            >
              Request Estimate
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
