import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import wealdenImageMap from "@/scripts/wealden-image-map.json";
import { SectionHeading } from "../_components/section-heading";

export const metadata: Metadata = {
  title: "Timber Windows for Period & Contemporary Homes | Wealden Joinery",
  description:
    "Sash and casement windows crafted in Sussex. Heritage glazing bars, high performance, secure locking, and sympathetic designs for listed buildings.",
};

type WealdenImage = {
  originalUrl: string;
  localPath: string;
  alt: string;
  page?: string;
  site?: string;
};

const wealdenImages = (wealdenImageMap as { images: WealdenImage[] }).images ?? [];

function pickImageByKeyword(keyword: string): WealdenImage | undefined {
  const lower = keyword.toLowerCase();
  return wealdenImages.find(
    (img) =>
      (img.alt && img.alt.toLowerCase().includes(lower)) ||
      img.localPath.toLowerCase().includes(lower) ||
      img.originalUrl.toLowerCase().includes(lower),
  );
}

const windowTypes = [
  {
    title: "Sash Windows",
    summary: "Smooth-running, heritage-friendly sashes with discreet balances and slim glazing bars.",
    details: [
      "Spiral or traditional weight-and-pulley balances",
      "Single or double glazing with slimline units",
      "Georgian, Victorian, or contemporary bar patterns",
      "Multi-coat paint or micro-porous stain finishes",
      "Brass or chrome fittings, meeting rail locks",
      "Ideal for listed buildings and conservation areas",
    ],
  },
  {
    title: "Casement Windows",
    summary: "Flush or storm-proof frames with secure multi-point locking and elegant mouldings.",
    details: [
      "Flush casement for heritage properties",
      "Storm-proof for exposed locations and modern builds",
      "High-performance weatherseals and draught exclusion",
      "Concealed shootbolt or espag locks",
      "Fixed lights, sidelights, or top-hung vents",
      "Oak, Accoya®, or engineered timber cores",
    ],
  },
];

const performanceOptions = [
  { title: "Timber", copy: "Oak (air-dried, kiln-dried, or European), Accoya® with 50-year anti-rot guarantee, or engineered hardwood." },
  { title: "Glazing", copy: "Slimline double glazing, acoustic laminate, or toughened safety glass. Sealed units with Argon fill and warm-edge spacers." },
  { title: "Paint & Stain", copy: "Multi-coat factory spray (RAL or heritage colours) or micro-porous stain with UV stabilisers. 8–10 year re-coat cycles typical." },
  { title: "Hardware", copy: "Brass, chrome, or matt black handles, hinges, and locks. Concealed friction stays, shootbolts, or traditional espag locks." },
];

const windowFaqs = [
  {
    q: "How do I know if sash or casement suits my home?",
    a: "Sash windows suit Georgian, Victorian, or Edwardian properties where vertical sliding is traditional. Casement windows work well in cottages, Arts & Crafts, or contemporary builds. We'll advise during survey.",
  },
  {
    q: "Can you match existing bar patterns or mouldings?",
    a: "Yes. We survey existing windows, measure bar spacings, and replicate profile details using our CNC machinery with hand finishing.",
  },
  {
    q: "What about conservation area approvals?",
    a: "We prepare sympathetic designs with heritage glazing bar layouts, period ironmongery, and paint colours that align with local planning requirements. We can support your application with drawings and specifications.",
  },
];

export default function WindowsPage() {
  const sashImg = pickImageByKeyword("sash") ?? pickImageByKeyword("window");
  const casementImg = pickImageByKeyword("casement");
  const heroImg = sashImg ?? casementImg ?? pickImageByKeyword("front");

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid items-center gap-10 px-6 py-12 md:px-10 md:py-16 lg:grid-cols-2">
          <div className="space-y-6">
            <p className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Timber Windows
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
              Timber Windows for Period & Contemporary Homes
            </h1>
            <p className="text-lg text-slate-600">
              Sash and casement windows crafted with heritage detailing and modern performance. From conservation-friendly
              replacements to contemporary new builds, every window is made to suit the property and last for decades.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/wealden-joinery/contact"
                className="rounded-full bg-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-[1.02] hover:bg-emerald-800"
              >
                Get a Windows Quote
              </Link>
              <Link
                href="/wealden-joinery"
                className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
              >
                Back to Home
              </Link>
            </div>
          </div>

          {heroImg && (
            <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-lg sm:h-80 lg:h-[400px]">
              <Image
                src={heroImg.localPath}
                alt={heroImg.alt || "Timber windows by Wealden Joinery"}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}
        </div>
      </section>

      {/* Window Types */}
      <section>
        <SectionHeading
          eyebrow="Window Types"
          title="Sash and casement options for every style."
          copy="Heritage-sensitive designs with high-performance glazing, secure locking, and long-life timber."
        />
        <div className="grid gap-6 md:grid-cols-2">
          {windowTypes.map((type, idx) => {
            const typeImg = idx === 0 ? sashImg : casementImg;
            return (
              <article
                key={type.title}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                {typeImg && (
                  <div className="relative h-56 w-full">
                    <Image
                      src={typeImg.localPath}
                      alt={typeImg.alt || `${type.title} by Wealden Joinery`}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="space-y-4 p-6">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{type.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{type.summary}</p>
                  </div>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {type.details.map((detail) => (
                      <li key={detail} className="flex gap-2">
                        <span className="text-emerald-700">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Performance & Options */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <SectionHeading
          eyebrow="Performance & Options"
          title="Materials, glazing, finishes, and hardware."
          copy="Premium specifications so windows perform quietly, securely, and look beautiful for years."
        />
        <div className="grid gap-5 md:grid-cols-2">
          {performanceOptions.map((option) => (
            <div
              key={option.title}
              className="rounded-xl border border-slate-200 bg-slate-50 p-6"
            >
              <h4 className="text-base font-semibold text-slate-900">{option.title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{option.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Windows FAQ */}
      <section>
        <SectionHeading
          eyebrow="FAQ"
          title="Common questions about timber windows."
          copy="Practical advice on specifications, planning, and maintenance."
        />
        <div className="grid gap-5 md:grid-cols-2">
          {windowFaqs.map((item) => (
            <div key={item.q} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h4 className="text-base font-semibold text-slate-900">{item.q}</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-emerald-800 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 p-8 text-white shadow-lg md:p-10">
        <div className="mx-auto max-w-2xl text-center space-y-4">
          <h3 className="text-3xl font-semibold">Ready to start your windows project?</h3>
          <p className="text-sm leading-relaxed text-emerald-50">
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
