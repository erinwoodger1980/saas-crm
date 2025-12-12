import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "../_components/section-heading";
import { getHeroImage, getImagesByHint } from "../_lib/wealdenAiImages";

export const metadata: Metadata = {
  title: "Timber Windows | Lignum by Wealden Joinery",
  description:
    "Precision-engineered timber windows for heritage and contemporary architecture. Box sash, casement, and wood-aluminium systems.",
};

// Curated image selection - quality over quantity
const heroImg = getHeroImage();
const detailImages = getImagesByHint("detail", 3); // Reduced to 3 key detail shots
const contextImage = getImagesByHint("lifestyle", 1)[0]; // Single contextual lifestyle shot

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
    <div className="space-y-32">
      {/* Hero - Full width, calm, architectural */}
      <section className="relative overflow-hidden">
        {heroImg && (
          <div className="relative h-[70vh] min-h-[500px] w-full">
            <Image
              src={heroImg.publicPath}
              alt={heroImg.caption}
              width={heroImg.width}
              height={heroImg.height}
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/20 to-transparent" />
            <div className="absolute inset-0 flex items-end">
              <div className="w-full px-6 pb-16 md:px-16 md:pb-24">
                <div className="mx-auto max-w-4xl space-y-6 text-white">
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/80">
                    Timber Windows
                  </p>
                  <h1 className="text-5xl font-light leading-[1.1] tracking-tight md:text-7xl">
                    Precision-Engineered<br />Timber Windows
                  </h1>
                  <p className="max-w-2xl text-lg font-light leading-relaxed text-white/90">
                    For heritage and contemporary architecture. Box sash, casement, and wood-aluminium systems crafted to last generations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Introduction - Clear, confident, understated */}
      <section className="mx-auto max-w-4xl px-6 md:px-8">
        <div className="space-y-8 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Lignum by Wealden Joinery
          </p>
          <h2 className="text-4xl font-light leading-tight text-slate-900 md:text-5xl">
            Engineered for longevity.<br />Detailed for authenticity.
          </h2>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600">
            Every window is manufactured to exacting standards using sustainably sourced timber, precision CNC machinery, and hand finishing. From listed Georgian townhouses to contemporary new builds, we engineer windows that respect architectural intent while meeting modern performance requirements.
          </p>
        </div>
      </section>

      {/* Window Systems - Clean, organized, premium feel */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="mb-16 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Window Systems</p>
          <h2 className="mt-4 text-3xl font-light text-slate-900 md:text-4xl">Five engineered systems</h2>
        </div>
        <div className="space-y-24">
          {windowTypes.map((type, idx) => (
            <article
              key={type.title}
              className={`grid gap-12 lg:grid-cols-2 lg:items-center ${idx % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}
            >
              <div className={`space-y-6 ${idx % 2 === 1 ? 'lg:order-2' : ''}`}>
                <h3 className="text-3xl font-light text-slate-900">{type.title}</h3>
                <p className="text-lg leading-relaxed text-slate-600">{type.summary}</p>
                <div className="border-l-2 border-slate-200 pl-6 space-y-3">
                  {type.details.slice(0, 4).map((detail) => (
                    <p key={detail} className="text-sm leading-relaxed text-slate-600">
                      {detail}
                    </p>
                  ))}
                </div>
              </div>
              <div className={`${idx % 2 === 1 ? 'lg:order-1' : ''}`}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
                  {/* Placeholder for high-quality product image */}
                  <div className="flex h-full items-center justify-center text-slate-400">
                    <div className="text-center space-y-2">
                      <p className="text-sm font-medium uppercase tracking-wider">High-Quality Image</p>
                      <p className="text-xs">{type.title}</p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Craftsmanship Details - 3 key detail shots only */}
      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6 md:px-8">
          <div className="mb-16 text-center">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Precision Details</p>
            <h2 className="mt-4 text-3xl font-light text-slate-900 md:text-4xl">Engineered to last</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {detailImages.slice(0, 3).map((img) => (
              <div key={img.id} className="space-y-4">
                <div className="relative aspect-square overflow-hidden rounded-lg bg-white">
                  <Image
                    src={img.publicPath}
                    alt={img.caption}
                    width={img.width}
                    height={img.height}
                    className="object-cover"
                  />
                </div>
                <p className="text-center text-sm font-medium text-slate-600">{img.caption}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Context Image - Single lifestyle shot */}
      {contextImage && (
        <section className="mx-auto max-w-7xl px-6 md:px-8">
          <div className="relative aspect-[21/9] overflow-hidden rounded-lg">
            <Image
              src={contextImage.publicPath}
              alt={contextImage.caption}
              width={contextImage.width}
              height={contextImage.height}
              className="object-cover"
            />
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">{contextImage.caption}</p>
        </section>
      )}

      {/* Specifications - Clean, organized */}
      <section className="mx-auto max-w-4xl px-6 md:px-8">
        <div className="mb-12 space-y-4 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Specifications</p>
          <h2 className="text-3xl font-light text-slate-900 md:text-4xl">Materials & Performance</h2>
        </div>
        <div className="space-y-12">
          {performanceOptions.map((option) => (
            <div key={option.title} className="border-b border-slate-100 pb-12 last:border-0 last:pb-0">
              <h3 className="mb-4 text-xl font-medium text-slate-900">{option.title}</h3>
              <p className="leading-relaxed text-slate-600">{option.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Compact FAQ */}
      <section className="mx-auto max-w-3xl px-6 md:px-8">
        <div className="mb-12 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Questions</p>
          <h2 className="mt-4 text-3xl font-light text-slate-900">Common enquiries</h2>
        </div>
        <div className="space-y-8">
          {windowFaqs.map((item) => (
            <div key={item.q} className="border-b border-slate-100 pb-8 last:border-0 last:pb-0">
              <h3 className="mb-3 text-lg font-medium text-slate-900">{item.q}</h3>
              <p className="leading-relaxed text-slate-600">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA - Understated, confident */}
      <section className="bg-slate-900 py-24">
        <div className="mx-auto max-w-3xl px-6 text-center md:px-8">
          <h2 className="text-4xl font-light text-white md:text-5xl">Discuss your project</h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-300">
            Book a consultation to discuss requirements, heritage constraints, and specifications.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/wealden-joinery/contact"
              className="border border-white px-8 py-4 text-sm font-medium uppercase tracking-wider text-white transition hover:bg-white hover:text-slate-900"
            >
              Book Consultation
            </Link>
            <Link
              href="/wealden-joinery/estimate"
              className="border border-white/30 px-8 py-4 text-sm font-medium uppercase tracking-wider text-white/80 transition hover:border-white hover:text-white"
            >
              Request Estimate
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
