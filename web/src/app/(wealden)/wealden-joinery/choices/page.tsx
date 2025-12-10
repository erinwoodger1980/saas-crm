import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "../_components/section-heading";
import { getImagesByHint } from "../_lib/wealdenAiImages";

export const metadata: Metadata = {
  title: "Design Choices & Details | Wealden Joinery",
  description:
    "Explore colours, glazing, hardware, and architectural details for your timber windows and doors. Infinite design possibilities.",
};

const detailImages = getImagesByHint("detail", 2);

const colourOptions = [
  {
    name: "Heritage & Traditional",
    description: "Classic colours for period properties—Railings, Off-Black, Cornforth White, String, Cord.",
    examples: "Farrow & Ball, Little Greene, bespoke RAL matches",
  },
  {
    name: "Contemporary & Modern",
    description: "Crisp whites, soft greys, charcoals, and anthracites for clean, modern schemes.",
    examples: "Pure White, Wimborne White, Mizzle, Down Pipe, RAL 7016",
  },
  {
    name: "Bespoke Colours",
    description: "We can match any RAL, NCS, or paint sample. Bring us a swatch and we'll colour-match it.",
    examples: "RAL Classic, RAL Design, NCS, custom mixes",
  },
  {
    name: "Natural Timber Finishes",
    description: "Micro-porous stains and oils that enhance the grain—Oak, Teak, Cedar, Walnut tones.",
    examples: "Osmo, Sikkens, Teknos, bespoke stain mixes",
  },
];

const glazingOptions = [
  {
    name: "Heritage Slimline Double Glazing",
    description: "Slim 14mm or 18mm units with warm-edge spacers. Low U-values without modern bulk.",
    specs: "U-value 1.2–1.4 W/m²K, heritage sight lines",
  },
  {
    name: "Triple Glazing",
    description: "Maximum thermal and acoustic performance for contemporary builds or exposed locations.",
    specs: "U-value 0.7–0.8 W/m²K, 36mm+ units",
  },
  {
    name: "Acoustic Laminated Glass",
    description: "Reduce traffic, aircraft, or wind noise with laminated panes. Popular in urban or coastal settings.",
    specs: "Rw up to 40dB reduction",
  },
  {
    name: "Leaded & Decorative Glass",
    description: "Traditional leaded lights, obscured patterns, or hand-blown heritage glass for listed properties.",
    specs: "Authentic lead came, textured glass options",
  },
];

const hardwareOptions = [
  {
    name: "Ironmongery Finishes",
    description: "Polished chrome, brushed nickel, aged brass, black iron, antique bronze, satin stainless.",
    note: "All handles, hinges, and locks can be colour-matched",
  },
  {
    name: "Heritage Fittings",
    description: "Traditional sash lifts, monkey-tail bolts, Georgian thumb-turns, and period latches.",
    note: "Sourced from specialist foundries for authenticity",
  },
  {
    name: "Contemporary Hardware",
    description: "Concealed multi-point locks, flush espagnolette bolts, minimal exposed ironmongery.",
    note: "Clean lines for modern schemes",
  },
  {
    name: "Security Upgrades",
    description: "Yale cylinders, Secured by Design locks, sash restrictors, and key-locking handles.",
    note: "Insurance-compliant options available",
  },
];

const barsAndMouldings = [
  "**Georgian bars** — Classic six-over-six or eight-over-eight patterns",
  "**Victorian glazing bars** — Two-over-two horns with slim top sash",
  "**Margin lights** — Side and toplight frames around entrance doors",
  "**Astragal bars** — External snap-in bars for easy cleaning",
  "**Integral bars** — Between glass panes for authentic shadow lines",
  "**Curved & arched toplights** — Bespoke shapes for period properties",
  "**Moulded architraves** — Internal trim to suit skirting and cornice styles",
];

export default function ChoicesPage() {
  const hardwareImage = detailImages[0];
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-12 md:px-10 md:py-16">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <p className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">Design Choices</p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
              Infinite Design Possibilities
            </h1>
            <p className="text-lg text-slate-600">
              From heritage colours to contemporary hardware, every detail is yours to choose. We guide you through finishes,
              glazing, ironmongery, and architectural detailing.
            </p>
          </div>
        </div>
      </section>

      {/* Colours & Finishes */}
      <section>
        <SectionHeading
          eyebrow="Colours & Finishes"
          title="Match your property's character"
          copy="Choose from heritage palettes, contemporary neutrals, or bespoke colour matching. We work with Farrow & Ball, Little Greene, and all RAL/NCS codes."
        />
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {colourOptions.map((opt) => (
            <article key={opt.name} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <h3 className="text-base font-semibold text-slate-900">{opt.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{opt.description}</p>
              <p className="mt-2 text-xs text-emerald-700">
                <strong>Examples:</strong> {opt.examples}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Glazing Options */}
      <section>
        <SectionHeading
          eyebrow="Glazing Options"
          title="Performance meets aesthetics"
          copy="From heritage slimline units to high-performance triple glazing, we specify glass to suit your property, budget, and location."
        />
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {glazingOptions.map((opt) => (
            <article key={opt.name} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <h3 className="text-base font-semibold text-slate-900">{opt.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{opt.description}</p>
              <p className="mt-2 text-xs text-emerald-700">
                <strong>Specs:</strong> {opt.specs}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Hardware & Ironmongery */}
      <section>
        <SectionHeading
          eyebrow="Hardware & Ironmongery"
          title="The details that matter"
          copy="Choose from heritage brass fittings to sleek contemporary locks. All hardware can be colour-matched to your chosen finish."
        />
        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          {hardwareImage && (
            <div className="relative h-64 w-full overflow-hidden rounded-2xl md:h-auto">
              <Image
                src={hardwareImage.publicPath}
                alt={hardwareImage.caption}
                width={hardwareImage.width}
                height={hardwareImage.height}
                className="object-cover"
              />
            </div>
          )}
          <div className="space-y-4">
            {hardwareOptions.map((opt) => (
              <article key={opt.name} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <h3 className="text-base font-semibold text-slate-900">{opt.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{opt.description}</p>
                <p className="mt-2 text-xs italic text-emerald-700">{opt.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Bars & Mouldings */}
      <section>
        <SectionHeading
          eyebrow="Bars & Mouldings"
          title="Architectural detailing"
          copy="Glazing bar patterns, astragals, margin lights, and internal trim—crafted to suit your property's period and style."
        />
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ul className="grid gap-3 md:grid-cols-2">
            {barsAndMouldings.map((item) => {
              const parts = item.split(" — ");
              const title = parts[0]?.replace(/\*\*/g, "") ?? item;
              const desc = parts[1] ?? "";
              return (
                <li key={item} className="flex gap-2 text-sm">
                  <span className="text-emerald-700">•</span>
                  <div>
                    <strong className="font-semibold text-slate-900">{title}</strong>
                    {desc && <span className="leading-relaxed text-slate-600"> — {desc}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-emerald-800 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 p-8 shadow-lg md:p-10 text-white">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <h3 className="text-3xl font-semibold">Need help choosing?</h3>
          <p className="text-sm leading-relaxed text-emerald-100">
            Book a design consultation to explore samples, finishes, and options. We'll help you select the perfect specification for
            your property.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm font-semibold">
            <Link
              href="/wealden-joinery/contact"
              className="rounded-full bg-white px-6 py-3 text-emerald-900 transition hover:scale-[1.02] hover:bg-emerald-50"
            >
              Book a Consultation
            </Link>
            <Link
              href="/wealden-joinery"
              className="rounded-full bg-white/10 px-6 py-3 text-white ring-1 ring-white/30 transition hover:scale-[1.02] hover:bg-white/20"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
