import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "../_components/section-heading";
import { getHeroImage, getImagesByHint } from "../_lib/wealdenAiImages";

export const metadata: Metadata = {
  title: "Timber Windows for Period & Contemporary Homes | Wealden Joinery",
  description:
    "Sash and casement windows crafted in Sussex. Heritage glazing bars, high performance, secure locking, and sympathetic designs for listed buildings.",
};

const heroImg = getHeroImage();
const windowTypeImages = getImagesByHint("range-windows", 8);
const detailImages = getImagesByHint("detail", 6);
const lifestyleImages = getImagesByHint("lifestyle", 6);

const windowTypes = [
  {
    title: "Box Sash Windows",
    summary: "Engineered to replicate traditional sash designs while meeting today's security, energy efficiency and practical living standards.",
    details: [
      "Pulley and cord operation with counterweights",
      "Slimline double or acoustic glazing",
      "Conservation-approved profiles",
      "Low air leakage and strong thermal performance",
      "Optional traditional horns and decorative bars",
      "Ideal for Georgian, Victorian or Edwardian properties",
    ],
  },
  {
    title: "Spring Balance Sash Windows",
    summary: "Designed for homes that can't accommodate full box sashes, offering a slimmer frame while keeping the classic sash look.",
    details: [
      "Classic vertical sliding appearance",
      "Spring balance system for smooth opening",
      "Slimmer frame depth for tight reveals",
      "Double-glazed with heritage detailing",
      "Lower maintenance with full timber finish",
      "Ideal for extensions or upper floors",
    ],
  },
  {
    title: "Flush Casement Windows",
    summary: "Effortless elegance with flush timber sashes that sit level with the frame, creating a clean, understated look.",
    details: [
      "Flush finish for a refined look",
      "Energy-efficient double or triple glazing",
      "Discreet friction hinges or traditional butt hinges",
      "PAS 24 security compliance",
      "Made to measure, finished to order",
      "Ideal for heritage homes and modern extensions",
    ],
  },
  {
    title: "Casement Windows",
    summary: "Timeless timber design with slim sightlines, fully sealed joints and high-spec glazing, made to order for a tailored fit.",
    details: [
      "Side or top-hung options",
      "High security locks as standard",
      "Custom glazing bars and mouldings",
      "Factory-finished timber with 10-year paint guarantee",
      "Suitable for conservation and contemporary homes",
      "Single or multi-light layouts available",
    ],
  },
  {
    title: "Wood-Aluminium Windows",
    summary: "The beauty of timber with added protection. Engineered timber frame with durable aluminium outer shell for all-weather performance.",
    details: [
      "Timber-aluminium composite construction",
      "Maintenance-free powder-coated external finish",
      "Engineered timber interior",
      "Full system performance with enhanced durability",
      "Perfect for exposed locations or low-maintenance living",
      "Ideal for contemporary or high-spec applications",
    ],
  },
];

const performanceOptions = [
  { title: "Timber", copy: "Sustainably sourced FSC® certified timber, engineered for strength and stability. Oak, Accoya® with 50-year anti-rot guarantee, or engineered hardwood cores." },
  { 
    title: "Glazing & Vacuum Glass", 
    copy: "Industry-leading vacuum glazing with U-values as low as 0.49 W/m²K—more than twice as efficient as standard double glazing. Reduces noise by up to 36dB with slim 6.15mm profiles. Also available: slimline heritage double glazing, laminated acoustic glass, and decorative obscure styles. 15-year glazing warranty." 
  },
  { title: "Paint & Stain", copy: "Long-life microporous coatings in natural wood tones, soft neutrals or bold architectural shades. UV-resistant and low maintenance. Dual-colour options available. 10-year paint finish guarantee." },
  { title: "Hardware", copy: "Handles that match the craftsmanship. Easy-to-operate ergonomic designs in satin, bronze, or matte black finishes. Coordinated with your chosen colours and finishes. 10-year hardware guarantee." },
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
                src={heroImg.publicPath}
                alt={heroImg.caption}
                width={heroImg.width}
                height={heroImg.height}
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
          title="Comprehensive range for every style and application."
          copy="From traditional box sash to contemporary wood-aluminium systems, all engineered for lasting performance with modern standards."
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {windowTypes.map((type, idx) => {
            const typeImg = windowTypeImages[idx % windowTypeImages.length];
            return (
              <article
                key={type.title}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                {typeImg && (
                  <div className="relative h-56 w-full">
                    <Image
                      src={typeImg.publicPath}
                      alt={typeImg.caption}
                      width={typeImg.width}
                      height={typeImg.height}
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

      {/* Gallery */}
      <section>
        <SectionHeading
          title="Our Timber Windows"
          copy="From heritage sash windows to contemporary casements, all crafted for lasting performance."
        />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {windowTypeImages.map((img) => (
            <div key={img.id} className="relative aspect-[3/4] rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition">
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
          title="In Period & Contemporary Homes"
          copy="See how our windows enhance character and comfort in properties across the South East."
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
