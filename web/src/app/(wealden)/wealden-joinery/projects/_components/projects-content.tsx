"use client";

import Link from "next/link";
import { ImageSlot } from "../../_components/image-slot";
import { wealdenProjects } from "../_lib/projects";

export function ProjectsContent() {
  const projects = wealdenProjects;

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

      {/* Project Grid */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="space-y-16">
          {projects.map((project) => {
            return (
              <article
                key={project.slug}
                className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-start"
              >
                {/* Image */}
                <ImageSlot
                  slotId={project.imageSlotId}
                  label={`${project.title} Hero`}
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
                    {project.products ? (
                      <p className="text-sm font-medium uppercase tracking-wider text-slate-700">
                        {project.products}
                      </p>
                    ) : null}
                  </div>

                  {project.description ? (
                    <p className="text-lg leading-relaxed text-slate-600">{project.description}</p>
                  ) : null}

                  {project.bullets?.length ? (
                    <div className="border-l-2 border-slate-200 pl-6 space-y-2">
                      {project.bullets.map((bullet) => (
                        <p key={bullet} className="text-sm text-slate-600">
                          {bullet}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  <Link
                    href={`/wealden-joinery/projects/${project.slug}`}
                    className="inline-flex items-center text-sm font-medium text-slate-900 hover:text-slate-600"
                  >
                    View project →
                  </Link>
                </div>
              </article>
            );
          })}
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
