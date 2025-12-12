import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "../_components/section-heading";
import { getHeroImage, getImagesByHint } from "../_lib/wealdenAiImages";

export const metadata: Metadata = {
  title: "Timber Windows — Heritage, Contemporary & System | Lignum by Wealden Joinery",
  description:
    "Precision-engineered timber windows for period properties and contemporary architecture. Heritage sash, flush casement, and wood-aluminium systems manufactured to conservation standards.",
};

// Curated image selection - quality over quantity
const heroImg = getHeroImage();
const detailImages = getImagesByHint("detail", 3); // Reduced to 3 key detail shots
const contextImage = getImagesByHint("lifestyle", 1)[0]; // Single contextual lifestyle shot

// Heritage Windows - For period properties requiring authentic detailing
const heritageWindows = [
  {
    title: "Box Sash Windows",
    category: "Heritage",
    useCase: "For Georgian, Victorian or Edwardian properties requiring full counterweight operation",
    summary: "Traditional pulley and cord sash windows engineered to conservation standards.",
    keyPoints: [
      "Counterweighted operation with pulleys and cords",
      "Slimline vacuum glazing for heritage compliance",
      "Traditional horns and decorative glazing bars",
      "Conservation-approved profiles and detailing"
    ],
  },
  {
    title: "Spring Balance Sash Windows",
    category: "Heritage",
    useCase: "Where full box construction isn't possible — extensions, upper floors, tight reveals",
    summary: "Classic sash appearance with spring mechanisms instead of weights.",
    keyPoints: [
      "Slimmer frame depth (no weight box required)",
      "Smooth spring balance operation",
      "Heritage detailing and slim profiles",
      "Suitable for conservation areas"
    ],
  },
];

// Contemporary Windows - Clean lines for modern or transitional architecture
const contemporaryWindows = [
  {
    title: "Flush Casement Windows",
    category: "Contemporary",
    useCase: "For heritage properties requiring subtle detailing or modern extensions",
    summary: "Sashes sit flush with the frame for a refined, understated appearance.",
    keyPoints: [
      "Flush finish — no projecting sashes",
      "Double or triple vacuum glazing",
      "Discreet friction hinges or traditional butts",
      "PAS 24 security certified"
    ],
  },
  {
    title: "Casement Windows",
    category: "Contemporary",
    useCase: "Versatile system for cottages, Arts & Crafts, or contemporary builds",
    summary: "Side or top-hung casements with slim sightlines and secure locking.",
    keyPoints: [
      "Storm-proof or flush profiles available",
      "Custom glazing bar configurations",
      "Multi-point espagnolette locking",
      "10-year factory paint guarantee"
    ],
  },
];

// System Products - High-performance composite construction
const systemProducts = [
  {
    title: "Wood-Aluminium Windows",
    category: "System",
    useCase: "Exposed coastal locations, contemporary architecture, minimal maintenance requirements",
    summary: "Engineered timber interior with maintenance-free aluminium cladding.",
    keyPoints: [
      "Aluminium external shell (powder-coated, RAL colours)",
      "Timber warmth and aesthetics internally",
      "Superior weather performance",
      "50+ year expected lifespan"
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
          <div className="relative h-[75vh] min-h-[600px] w-full">
            <Image
              src={heroImg.publicPath}
              alt={heroImg.caption}
              width={heroImg.width}
              height={heroImg.height}
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/30 to-transparent" />
            <div className="absolute inset-0 flex items-end">
              <div className="w-full px-6 pb-20 md:px-16 md:pb-32">
                <div className="mx-auto max-w-4xl space-y-6 text-white">
                  <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/70">
                    Lignum by Wealden Joinery
                  </p>
                  <h1 className="text-5xl font-light leading-[1.05] tracking-tight md:text-7xl lg:text-8xl">
                    Timber windows<br />engineered to endure
                  </h1>
                  <p className="max-w-2xl text-lg font-light leading-relaxed text-white/85 md:text-xl">
                    From Georgian townhouses to contemporary builds. Heritage sash, flush casement, and wood-aluminium systems manufactured to conservation standards.
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
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500">
            Why Lignum
          </p>
          <h2 className="text-4xl font-light leading-tight text-slate-900 md:text-5xl">
            Precision. Heritage. Longevity.
          </h2>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600">
            Every window begins with sustainably sourced timber, precision CNC engineering, and hand finishing. We manufacture for listed buildings, conservation areas, and architect-led new builds—combining authentic detailing with modern thermal performance and security.
          </p>
          <div className="mx-auto grid max-w-3xl gap-8 pt-8 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-3xl font-light text-slate-900">30yr</p>
              <p className="text-sm uppercase tracking-wider text-slate-500">Rot & fungal guarantee</p>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-light text-slate-900">10yr</p>
              <p className="text-sm uppercase tracking-wider text-slate-500">Paint & workmanship</p>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-light text-slate-900">FSC</p>
              <p className="text-sm uppercase tracking-wider text-slate-500">Certified timber</p>
            </div>
          </div>
        </div>
      </section>

      {/* Heritage Windows */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="mb-20 space-y-4 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Heritage Windows</p>
          <h2 className="text-4xl font-light text-slate-900 md:text-5xl">For period properties</h2>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600">
            Where authenticity and conservation approval matter. Traditional sash operation with modern thermal performance.
          </p>
        </div>
        <div className="space-y-32">
          {heritageWindows.map((window, idx) => (
            <article key={window.title} className="space-y-8">
              <div className="mx-auto max-w-3xl space-y-6 text-center">
                <h3 className="text-3xl font-light text-slate-900 md:text-4xl">{window.title}</h3>
                <p className="text-xl font-light italic leading-relaxed text-slate-500">
                  {window.useCase}
                </p>
                <p className="text-lg leading-relaxed text-slate-600">{window.summary}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                {window.keyPoints.map((point, i) => (
                  <div key={i} className="border-l-2 border-slate-200 pl-4">
                    <p className="text-sm leading-relaxed text-slate-600">{point}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Contemporary Windows */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="mb-20 space-y-4 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Contemporary Windows</p>
          <h2 className="text-4xl font-light text-slate-900 md:text-5xl">Clean lines, refined details</h2>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600">
            For modern extensions, new builds, or heritage properties requiring subtle detailing.
          </p>
        </div>
        <div className="space-y-32">
          {contemporaryWindows.map((window, idx) => (
            <article key={window.title} className="space-y-8">
              <div className="mx-auto max-w-3xl space-y-6 text-center">
                <h3 className="text-3xl font-light text-slate-900 md:text-4xl">{window.title}</h3>
                <p className="text-xl font-light italic leading-relaxed text-slate-500">
                  {window.useCase}
                </p>
                <p className="text-lg leading-relaxed text-slate-600">{window.summary}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                {window.keyPoints.map((point, i) => (
                  <div key={i} className="border-l-2 border-slate-200 pl-4">
                    <p className="text-sm leading-relaxed text-slate-600">{point}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* System Products */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="mb-20 space-y-4 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">System Products</p>
          <h2 className="text-4xl font-light text-slate-900 md:text-5xl">Engineered composites</h2>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600">
            Timber warmth inside, aluminium protection outside. For exposed locations or minimal maintenance.
          </p>
        </div>
        <div className="space-y-32">
          {systemProducts.map((window, idx) => (
            <article key={window.title} className="space-y-8">
              <div className="mx-auto max-w-3xl space-y-6 text-center">
                <h3 className="text-3xl font-light text-slate-900 md:text-4xl">{window.title}</h3>
                <p className="text-xl font-light italic leading-relaxed text-slate-500">
                  {window.useCase}
                </p>
                <p className="text-lg leading-relaxed text-slate-600">{window.summary}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                {window.keyPoints.map((point, i) => (
                  <div key={i} className="border-l-2 border-slate-200 pl-4">
                    <p className="text-sm leading-relaxed text-slate-600">{point}</p>
                  </div>
                ))}
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

      {/* CTA - Confident, considered */}
      <section className="bg-slate-900 py-32">
        <div className="mx-auto max-w-3xl space-y-12 px-6 text-center md:px-8">
          <div className="space-y-6">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/60">
              Start Your Project
            </p>
            <h2 className="text-4xl font-light leading-tight text-white md:text-5xl">
              Which window system<br />suits your project?
            </h2>
            <p className="mx-auto max-w-xl text-lg font-light leading-relaxed text-white/75">
              Book a consultation to discuss heritage constraints, thermal requirements, and detailed specifications. We'll guide you through timber choices, glazing options, and finishes.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/wealden-joinery/contact"
              className="border-2 border-white px-10 py-4 text-sm font-medium uppercase tracking-[0.15em] text-white transition hover:bg-white hover:text-slate-900"
            >
              Book Consultation
            </Link>
            <Link
              href="/wealden-joinery/estimate"
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
