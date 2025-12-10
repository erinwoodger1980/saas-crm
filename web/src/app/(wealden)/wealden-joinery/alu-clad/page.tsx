import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "../_components/section-heading";
import { getHeroImage, getImagesByHint } from "../_lib/wealdenAiImages";

export const metadata: Metadata = {
  title: "Alu-Clad Timber Windows & Doors | Wealden Joinery",
  description:
    "Timber warmth inside, durable aluminium outside. Low-maintenance alu-clad systems for new builds and exposed locations across the South East.",
};

const heroImg = getHeroImage();
const aluImages = getImagesByHint("alu-clad", 2);
const lifestyleImages = getImagesByHint("lifestyle", 6);
const detailImages = getImagesByHint("detail", 4);

const benefits = [
  {
    title: "Timber warmth inside",
    copy: "Solid timber frames visible from the interior for traditional detailing and natural insulation.",
  },
  {
    title: "Aluminium protection outside",
    copy: "Powder-coated aluminium cladding shields timber from weather, extending life and reducing maintenance.",
  },
  {
    title: "Long-life performance",
    copy: "Factory-bonded aluminium capping eliminates regular external painting and staining cycles.",
  },
  {
    title: "Colour flexibility",
    copy: "Wide RAL colour range for aluminium exterior while keeping timber character inside.",
  },
];

const bestFor = [
  "Contemporary new builds with large glass areas",
  "Exposed coastal or hilltop locations",
  "Low-maintenance requirements for rental or second homes",
  "Slim profiles with maximum daylight",
  "Projects requiring long-life warranties",
];

const comparisonData = [
  {
    system: "Timber",
    pros: ["Heritage character", "Natural insulation", "Easy to repair"],
    cons: ["Regular external maintenance", "8–10 year paint cycles"],
  },
  {
    system: "Alu-Clad Timber",
    pros: ["Low external maintenance", "Timber warmth inside", "Durable cladding"],
    cons: ["Higher initial cost", "Aluminium thermal bridging"],
  },
  {
    system: "uPVC",
    pros: ["Low maintenance", "Cost-effective"],
    cons: ["Lacks timber character", "Limited colour range", "Thermal expansion"],
  },
];

export default function AluCladPage() {
  const aluImg = aluImages[0] || heroImg;
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid items-center gap-10 px-6 py-12 md:px-10 md:py-16 lg:grid-cols-2">
          <div className="space-y-6">
            <p className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">Alu-Clad Systems</p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
              Alu-Clad Timber Windows & Doors
            </h1>
            <p className="text-lg text-slate-600">
              Timber warmth inside, durable aluminium outside. Low-maintenance systems for contemporary builds, exposed
              locations, and projects requiring long-life warranties with minimal upkeep.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/wealden-joinery/contact"
                className="rounded-full bg-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-[1.02] hover:bg-emerald-800"
              >
                Get an Alu-Clad Quote
              </Link>
              <Link
                href="/wealden-joinery"
                className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
              >
                Back to Home
              </Link>
            </div>
          </div>

          {aluImg && (
            <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-lg sm:h-80 lg:h-[400px]">
              <Image
                src={aluImg.publicPath}
                alt={aluImg.caption}
                width={aluImg.width}
                height={aluImg.height}
                className="object-cover"
                priority
              />
            </div>
          )}
        </div>
      </section>

      {/* What is Alu-Clad */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <SectionHeading
          eyebrow="What is Alu-Clad?"
          title="Timber inside, aluminium outside."
          copy="Factory-bonded aluminium capping protects timber from weather while preserving interior character."
        />
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            Alu-clad timber systems combine solid timber frames (visible from the interior) with powder-coated aluminium
            cladding on the exterior. The aluminium is bonded to the timber during manufacture, creating a weather-resistant
            barrier that eliminates the need for regular external painting or staining.
          </p>
          <p>
            Inside, you see and feel timber—natural grain, warmth, and traditional detailing. Outside, durable aluminium
            capping in any RAL colour protects the timber from rain, UV, and coastal exposure.
          </p>
          <p>
            This hybrid approach suits contemporary builds, exposed hilltop or coastal locations, and projects where
            low-maintenance performance is essential without sacrificing timber character.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section>
        <SectionHeading
          eyebrow="Benefits"
          title="Durability, flexibility, and reduced maintenance."
          copy="Alu-clad systems deliver long-life performance with minimal upkeep and design freedom."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <h3 className="text-lg font-semibold text-slate-900">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{benefit.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Where it Works Best */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm md:p-10">
        <SectionHeading
          eyebrow="Where it Works Best"
          title="Contemporary builds, exposed locations, low-maintenance projects."
          copy="Alu-clad systems suit specific project types where durability and reduced upkeep are priorities."
        />
        <ul className="space-y-2 text-sm text-slate-700">
          {bestFor.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-emerald-700">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Design Flexibility */}
      <section>
        <SectionHeading
          eyebrow="Design Flexibility"
          title="Colour options, slim profiles, large glass areas."
          copy="Aluminium cladding offers wide colour choice and structural strength for contemporary designs."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <h4 className="text-base font-semibold text-slate-900">Colour Range</h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Any RAL colour for aluminium exterior. Popular choices include anthracite grey, jet black, and heritage slate.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <h4 className="text-base font-semibold text-slate-900">Slim Profiles</h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Narrow sight lines and large glass areas for contemporary aesthetics and maximum daylight.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <h4 className="text-base font-semibold text-slate-900">Large Openings</h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Structural strength of aluminium supports larger panels for bi-fold and sliding door systems.
            </p>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section>
        <SectionHeading
          title="Contemporary Installations"
          copy="See alu-clad systems in modern homes across the South East."
        />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          {lifestyleImages.map((img) => (
            <div key={img.id} className="relative aspect-[4/3] rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition">
              <Image
                src={img.publicPath}
                alt={img.caption}
                width={img.width}
                height={img.height}
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          title="Detail & Finish Quality"
          copy="Precision engineering and refined detailing throughout."
        />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-2">
          {detailImages.map((img) => (
            <div key={img.id} className="relative aspect-[4/3] rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition">
              <Image
                src={img.publicPath}
                alt={img.caption}
                width={img.width}
                height={img.height}
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Block */}
      <section>
        <SectionHeading
          eyebrow="Comparison"
          title="Timber vs Alu-Clad vs uPVC."
          copy="Each system has strengths. Choose based on property type, maintenance appetite, and budget."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {comparisonData.map((item) => (
            <div
              key={item.system}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <h4 className="text-lg font-semibold text-slate-900">{item.system}</h4>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-emerald-900">Pros:</p>
                  <ul className="mt-1 space-y-1 text-slate-700">
                    {item.pros.map((pro) => (
                      <li key={pro}>• {pro}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-rose-900">Cons:</p>
                  <ul className="mt-1 space-y-1 text-slate-700">
                    {item.cons.map((con) => (
                      <li key={con}>• {con}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-emerald-800 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 p-8 shadow-lg md:p-10 text-white">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <h3 className="text-3xl font-semibold">Interested in alu-clad systems?</h3>
          <p className="text-sm leading-relaxed text-emerald-100">
            Get an instant estimate or book a consultation to discuss your project, colour options, and performance requirements.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm font-semibold">
            <Link
              href="/wealden-joinery/estimate"
              className="rounded-full bg-white px-6 py-3 text-emerald-900 transition hover:scale-[1.02] hover:bg-emerald-50"
            >
              Get an Instant Estimate
            </Link>
            <Link
              href="/wealden-joinery/projects"
              className="rounded-full bg-white/10 px-6 py-3 text-white ring-1 ring-white/30 transition hover:scale-[1.02] hover:bg-white/20"
            >
              View Projects
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
