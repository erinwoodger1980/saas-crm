"use client";

import { ImagePlaceholder } from "./image-placeholder";

interface WindowSectionProps {
  windows: Array<{
    title: string;
    category: string;
    useCase: string;
    summary: string;
    keyPoints: string[];
  }>;
  category: "Heritage" | "Contemporary" | "System";
  title: string;
  description: string;
}

export function WindowSection({ windows, category, title, description }: WindowSectionProps) {
  return (
    <section className="mx-auto max-w-7xl px-6 md:px-8">
      <div className="mb-20 space-y-4 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">{title}</p>
        <h2 className="text-4xl font-light text-slate-900 md:text-5xl">{category === "Heritage" ? "For period properties" : category === "Contemporary" ? "Clean lines, refined details" : "Engineered composites"}</h2>
        <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600">
          {description}
        </p>
      </div>
      <div className="space-y-32">
        {windows.map((window, idx) => (
          <article key={window.title} className="space-y-8">
            <div className="mx-auto max-w-3xl space-y-6 text-center">
              <h3 className="text-3xl font-light text-slate-900 md:text-4xl">{window.title}</h3>
              <p className="text-xl font-light italic leading-relaxed text-slate-500">
                {window.useCase}
              </p>
              <p className="text-lg leading-relaxed text-slate-600">{window.summary}</p>
            </div>

            {/* Hero Image */}
            <div className="mb-8">
              <ImagePlaceholder 
                label={`${window.title} Hero`}
                aspectRatio="aspect-[21/9]"
              />
            </div>

            {/* Detail Images */}
            <div className="grid gap-6 md:grid-cols-3 mb-8">
              <ImagePlaceholder 
                label={`${window.title} Detail 1`}
                aspectRatio="aspect-square"
              />
              <ImagePlaceholder 
                label={`${window.title} Detail 2`}
                aspectRatio="aspect-square"
              />
              <ImagePlaceholder 
                label={`${window.title} Detail 3`}
                aspectRatio="aspect-square"
              />
            </div>

            {/* Key Points */}
            <div className="grid gap-4 md:grid-cols-4">
              {window.keyPoints.map((point, i) => (
                <div key={i} className="border-l-2 border-slate-200 pl-4">
                  <p className="text-sm leading-relaxed text-slate-600">{point}</p>
                </div>
              ))}
            </div>

            {/* Context Image */}
            <div className="mt-8">
              <ImagePlaceholder 
                label={`${window.title} Context`}
                aspectRatio="aspect-[21/9]"
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
