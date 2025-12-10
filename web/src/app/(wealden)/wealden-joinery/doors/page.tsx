import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import wealdenImageMap from "@/scripts/wealden-image-map.json";
import { SectionHeading } from "../_components/section-heading";

export const metadata: Metadata = {
  title: "Timber Entrance & Garden Doors | Wealden Joinery",
  description:
    "Bespoke timber entrance doors, French doors, sliding doors, and bi-folds. Secure cores, premium hardware, and elegant detailing crafted in Sussex.",
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

const doorTypes = [
  {
    title: "Entrance Doors",
    summary: "Statement front doors with secure cores, premium hardware, and bespoke detailing.",
    details: [
      "Solid or engineered timber cores for stability",
      "Multi-point locking with secure cylinders",
      "Decorative glazing, sidelights, and toplights",
      "Traditional panel designs or flush contemporary",
      "Letter plates, knockers, and pull handles in brass or chrome",
      "Factory-sprayed multi-coat finishes in heritage or modern colours",
    ],
  },
  {
    title: "French Doors",
    summary: "Classic opening pairs with slim sight lines and elegant mouldings.",
    details: [
      "Flush or rebated pairs with concealed shootbolts",
      "Narrow stiles for maximum glass area",
      "Toughened or laminated safety glazing",
      "Weather-sealed rebates and thresholds",
      "Traditional ironmongery or contemporary handles",
      "Oak, Accoya®, or engineered hardwood options",
    ],
  },
  {
    title: "Sliding & Bi-Fold Doors",
    summary: "Large glass openings with stable engineered timber and high-performance running gear.",
    details: [
      "Stainless steel or anodised tracks for smooth sliding",
      "Multi-panel configurations up to 6 metres wide",
      "High-performance glazing with slim frames",
      "Weather-sealed panels and flush thresholds",
      "Concealed drainage and ventilation channels",
      "Low-maintenance finishes for long-term performance",
    ],
  },
];

const securityPerformance = [
  { title: "Locking Systems", copy: "Multi-point espag locks, secure cylinders with anti-snap protection, and concealed shootbolts on French doors." },
  { title: "Glazing", copy: "Toughened or laminated safety glass, Argon-filled sealed units, and acoustic options for exposed locations." },
  { title: "Weather Seals", copy: "Compression gaskets, brush seals, and weatherbar thresholds for draught exclusion and rain resistance." },
  { title: "Hardware", copy: "Heavy-duty hinges, pull handles, letter plates, knockers, and spy holes in brass, chrome, or matt black finishes." },
];

const doorsFaqs = [
  {
    q: "What are typical lead times for doors?",
    a: "Entrance doors typically take 8–10 weeks from survey to installation. French, sliding, and bi-fold doors may take 10–12 weeks due to larger glass panels and running gear. We'll confirm timelines during survey.",
  },
  {
    q: "Can you match existing door styles or colours?",
    a: "Yes. We survey existing doors, photograph details, and replicate panel mouldings, glazing patterns, and paint colours using our CNC machinery with hand finishing.",
  },
  {
    q: "Do you handle building control for fire-rated doors?",
    a: "Yes. We specify FD30 or FD60 fire-rated cores and provide certification for building control sign-off. We coordinate with your contractor or local authority as needed.",
  },
];

export default function DoorsPage() {
  const doorImg = pickImageByKeyword("door");
  const frenchImg = pickImageByKeyword("french");
  const bifoldImg = pickImageByKeyword("bifold") ?? pickImageByKeyword("sliding");
  const heroImg = doorImg ?? frenchImg ?? bifoldImg;

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid items-center gap-10 px-6 py-12 md:px-10 md:py-16 lg:grid-cols-2">
          <div className="space-y-6">
            <p className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">Timber Doors</p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
              Timber Entrance & Garden Doors
            </h1>
            <p className="text-lg text-slate-600">
              Statement entrance doors, French doors, and large sliding or bi-fold openings. Secure cores, premium hardware,
              and elegant detailing crafted to suit period homes and contemporary builds.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/wealden-joinery/contact"
                className="rounded-full bg-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-[1.02] hover:bg-emerald-800"
              >
                Get a Doors Quote
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
                alt={heroImg.alt || "Timber doors by Wealden Joinery"}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}
        </div>
      </section>

      {/* Door Types */}
      <section>
        <SectionHeading
          eyebrow="Door Types"
          title="Entrance, French, sliding, and bi-fold doors."
          copy="Secure, elegant, and built to last. Every door is crafted to suit the property and perform reliably for decades."
        />
        <div className="space-y-6">
          {doorTypes.map((type, idx) => {
            let typeImg = doorImg;
            if (idx === 1) typeImg = frenchImg ?? doorImg;
            if (idx === 2) typeImg = bifoldImg ?? doorImg;

            return (
              <article
                key={type.title}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
                  {typeImg && (
                    <div className="relative h-64 w-full md:h-auto">
                      <Image
                        src={typeImg.localPath}
                        alt={typeImg.alt || `${type.title} by Wealden Joinery`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="space-y-5 p-6">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{type.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{type.summary}</p>
                    </div>
                    <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
                      {type.details.map((detail) => (
                        <li key={detail} className="flex gap-2">
                          <span className="text-emerald-700">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Security & Performance */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <SectionHeading
          eyebrow="Security & Performance"
          title="Locking systems, glazing, and weather seals."
          copy="Premium specifications so doors perform securely, quietly, and look beautiful for years."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {securityPerformance.map((option) => (
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

      {/* Mini Gallery Strip */}
      <section>
        <SectionHeading
          eyebrow="Recent Installs"
          title="Doors across the South East."
          copy="From heritage townhouses to contemporary new builds, every door is crafted to suit the property."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {[doorImg, frenchImg, bifoldImg].filter(Boolean).map((img, idx) =>
            img ? (
              <div key={idx} className="relative h-48 w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <Image
                  src={img.localPath}
                  alt={img.alt || "Wealden Joinery door installation"}
                  fill
                  className="object-cover"
                />
              </div>
            ) : null
          )}
        </div>
      </section>

      {/* Doors FAQ */}
      <section>
        <SectionHeading
          eyebrow="FAQ"
          title="Common questions about timber doors."
          copy="Practical advice on specifications, planning, and maintenance."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {doorsFaqs.map((item) => (
            <div key={item.q} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <h4 className="text-base font-semibold text-slate-900">{item.q}</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-emerald-800 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 p-8 shadow-lg md:p-10 text-white">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <h3 className="text-3xl font-semibold">Ready to start your doors project?</h3>
          <p className="text-sm leading-relaxed text-emerald-100">
            Get an instant estimate or book a consultation to discuss your requirements, security needs, and design options.
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
