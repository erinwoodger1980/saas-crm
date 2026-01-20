import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageSlot } from "../../_components/image-slot";
import { getWealdenProjectBySlug } from "../_lib/projects";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getWealdenProjectBySlug(slug);
  if (!project) return {};

  return {
    title: `${project.title} — Lignum by Wealden Joinery`,
    description: project.description,
  };
}

export default async function WealdenProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const project = getWealdenProjectBySlug(slug);
  if (!project) notFound();

  return (
    <div className="space-y-20">
      <section className="mx-auto max-w-6xl px-6 pt-12 md:px-10">
        <div className="space-y-6">
          <Link href="/wealden-joinery/projects" className="text-sm font-medium text-slate-500 hover:text-slate-900">
            ← Back to projects
          </Link>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{project.location}</p>
            <h1 className="text-4xl font-light tracking-tight text-slate-900 md:text-6xl">{project.type}</h1>
            {project.products ? (
              <p className="text-sm font-medium uppercase tracking-wider text-slate-700">{project.products}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 md:px-10">
        <ImageSlot
          slotId={project.imageSlotId}
          label={`${project.title} Hero`}
          aspectRatio="aspect-[16/9]"
          size="xl"
          imageContext="hero"
          overlayPosition="bottom-center"
        />
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-24 md:grid-cols-[1fr_0.9fr] md:px-10">
        <div className="space-y-8">
          {project.description ? (
            <div className="space-y-3">
              <h2 className="text-2xl font-light text-slate-900">Overview</h2>
              <p className="text-lg leading-relaxed text-slate-600">{project.description}</p>
            </div>
          ) : null}

          {project.bullets?.length ? (
            <div className="space-y-3">
              <h2 className="text-2xl font-light text-slate-900">What we delivered</h2>
              <div className="border-l-2 border-slate-200 pl-6 space-y-2">
                {project.bullets.map((bullet) => (
                  <p key={bullet} className="text-sm text-slate-600">
                    {bullet}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4 rounded-2xl border border-slate-200 p-8">
          <h3 className="text-lg font-medium text-slate-900">Next steps</h3>
          <p className="text-sm leading-relaxed text-slate-600">
            If you have a similar property (or a conservation requirement), we can advise on profiles, glazing, finishes, and approvals.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/wealden-joinery/contact"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              Book a consultation
            </Link>
            <Link
              href="/wealden-joinery/estimate"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-medium text-slate-900 hover:border-slate-400"
            >
              Get an estimate
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
