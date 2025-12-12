import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "./_components/section-heading";
import { getHeroImage, getImagesByHint, getFallbackImages } from "./_lib/wealdenAiImages";

export const metadata: Metadata = {
  title: "Wealden Joinery | Premium Timber Windows & Doors — Nationwide Showrooms",
  description:
    "Premium timber windows and doors from our Crowborough manufacturing HQ. Visit our showrooms nationwide for heritage and contemporary joinery solutions.",
};

// Use AI-processed images
const heroImage = getHeroImage();
const windowImages = getImagesByHint("range-windows", 6);
const doorImages = getImagesByHint("range-doors", 6);
const aluImages = getImagesByHint("alu-clad", 2);
const caseStudyImages = getImagesByHint("case-study", 6);
const lifestyleImages = getImagesByHint("lifestyle", 8);
const workshopImage = getImagesByHint("workshop", 1)[0];
const lifestyleImage = getImagesByHint("lifestyle", 1)[0];

const reasons = [
  {
    title: "UK-Manufactured to Certified Standards",
    copy: "Every window and door is manufactured at our Crowborough facility using precision CNC machinery, hand finishing, and factory-applied microporous coatings. Approved suppliers to architects, main contractors, and conservation specialists. Certifications: BSI ISO 9001 quality management, PAS 24:2016 security, Secured by Design approved, BS 6375 weather performance tested, FSC® Chain of Custody certified. Building Regulations compliant (Document Q security, Document L thermal, Document M accessibility).",
  },
  {
    title: "Forest to Frame: Sustainable Timber Sourcing",
    copy: "Sourced from FSC®-certified forests with responsible forestry practices. Timber is a natural carbon store—every cubic meter locks away ~1 tonne of CO₂. Engineered cores use 100% of the log with no waste. Lowest embodied carbon of any window material: timber (60 kgCO₂/m²) vs uPVC (120 kgCO₂/m²) vs aluminium (180 kgCO₂/m²). Designed to last 60+ years with routine maintenance—repairable, refinishable, renewable. European Oak for durability and grain, Accoya® with 50-year above-ground rot guarantee, or engineered hardwood for stability.",
  },
  {
    title: "Security That Meets Police Standards",
    copy: "PAS 24:2016 testing simulates real burglary attempts—forced entry, lock picking, glass attack. Multi-point locking with shootbolts, hooks, and deadlocks tested for minimum 3-minute resistance. Internal glazing beads cannot be removed from outside. Laminated safety glass for impact resistance. Secured by Design (Police-preferred specification)—all hardware meets SBD requirements, frame construction resists jemmy attacks, concealed hinges or hinge bolts fitted. Complies with Document Q for new builds and extensions.",
  },
  {
    title: "Industry-Leading Guarantees (Transferable)",
    copy: "30-year timber warranty against rot and fungal decay (Accoya® 50-year option available). 10-year workmanship guarantee covering joinery defects, hardware failure, and factory paint finish (flaking, peeling, cracking—not vague wording). 15-year sealed glazing unit warranty against seal failure and internal condensation. 10-year hardware mechanical operation (handles, hinges, locks). All guarantees transferable to new property owners—adds value if you sell. Comprehensive terms provided with quotation, no small print surprises.",
  },
];

const products = [
  {
    name: "Timber Sash Windows",
    summary: "Slim, smooth-running sashes with heritage glazing bars and discreet balances.",
  },
  {
    name: "Timber Casement Windows",
    summary: "Flush and storm-proof options with secure multi-point locking and elegant mouldings.",
  },
  {
    name: "Entrance Doors",
    summary: "Statement front doors with premium hardware, secure cores, and bespoke detailing.",
  },
  {
    name: "French, Sliding & Bi-Fold Doors",
    summary: "Light-filled openings with stable engineered timber and high-performance glazing.",
  },
  {
    name: "Alu-Clad Systems",
    summary: "Timber warmth inside, durable aluminium outside—ideal for contemporary, low-maintenance projects.",
  },
];

const steps = [
  { title: "Enquiry", detail: "Share your project aims, property type, and timing." },
  { title: "Survey & Design", detail: "On-site survey, measured drawings, and options for profiles, glazing, and colours." },
  { title: "Manufacture", detail: "Precision CNC machining with hand finishing for crisp details and robust coatings." },
  { title: "Installation / Delivery", detail: "Clean, considerate fitting or delivery to site with clear sequencing." },
  { title: "Aftercare", detail: "Friendly support, maintenance guidance, and scheduled check-ins." },
];

const caseStudies = [
  { location: "Tunbridge Wells, Kent", type: "Victorian villa", products: "Sash windows & entrance door" },
  { location: "Lewes, East Sussex", type: "Georgian townhouse", products: "Slimline sash replacements" },
  { location: "Sevenoaks, Kent", type: "Country home", products: "Casement windows & French doors" },
];

const faqs = [
  {
    q: "Can you handle listed buildings or conservation areas?",
    a: "Yes. We prepare sympathetic designs, glazing bar layouts, and paint finishes that align with local conservation requirements.",
  },
  {
    q: "What are typical lead times?",
    a: "Survey to installation is typically 10–14 weeks depending on project size and approvals. We’ll confirm timelines up front.",
  },
  {
    q: "What budgets should I allow?",
    a: "Most full-house window projects start from £18k–£25k. Entrance doors typically start from £3.5k installed. The AI Estimator gives a tailored range instantly.",
  },
  {
    q: "What guarantees do you offer?",
    a: "Industry-leading warranties: 30 years on rot and fungal decay, 10 years on workmanship, paint finish and hardware, 15 years on glazing. Detailed terms provided with every order.",
  },
];

export default function WealdenHomePage() {
  return (
    <div className="space-y-32">
      {/* Hero - Full width, architectural, calm */}
      <section className="relative overflow-hidden">
        {heroImage && (
          <div className="relative h-[75vh] min-h-[600px] w-full">
            <Image
              src={heroImage.publicPath}
              alt={heroImage.caption}
              width={heroImage.width}
              height={heroImage.height}
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/30 to-transparent" />
            <div className="absolute inset-0 flex items-end">
              <div className="w-full px-6 pb-20 md:px-16 md:pb-32">
                <div className="mx-auto max-w-5xl space-y-8 text-white">
                  <p className="text-sm font-medium uppercase tracking-[0.25em] text-white/70">
                    Lignum by Wealden Joinery
                  </p>
                  <h1 className="max-w-4xl text-5xl font-light leading-[1.08] tracking-tight md:text-7xl lg:text-8xl">
                    Precision-Engineered<br />Timber Windows & Doors
                  </h1>
                  <p className="max-w-2xl text-lg font-light leading-relaxed text-white/90">
                    For heritage and contemporary architecture. Sustainably sourced, manufactured to exacting standards, engineered to last generations.
                  </p>
                  <div className="flex flex-wrap gap-4 pt-4">
                    <Link
                      href="/wealden-joinery/contact"
                      className="border border-white px-8 py-4 text-sm font-medium uppercase tracking-wider text-white transition hover:bg-white hover:text-slate-900"
                    >
                      Book Consultation
                    </Link>
                    <Link
                      href="/wealden-joinery/windows"
                      className="border border-white/30 px-8 py-4 text-sm font-medium uppercase tracking-wider text-white/80 transition hover:border-white hover:text-white"
                    >
                      View Windows
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Brand Pillars - Clean, confident */}
      <section className="mx-auto max-w-6xl px-6 md:px-8">
        <div className="mb-16 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Why Lignum</p>
          <h2 className="mt-4 text-3xl font-light text-slate-900 md:text-4xl">
            Engineered for longevity. Certified for quality.
          </h2>
        </div>
        <div className="grid gap-12 md:grid-cols-2">
          {reasons.map((reason) => (
            <div key={reason.title} className="space-y-3">
              <h3 className="text-xl font-medium text-slate-900">{reason.title}</h3>
              <p className="leading-relaxed text-slate-600">{reason.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Product Systems - Minimal, clean */}
      <section className="mx-auto max-w-6xl px-6 md:px-8">
        <div className="mb-16 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Systems</p>
          <h2 className="mt-4 text-3xl font-light text-slate-900 md:text-4xl">Five product ranges</h2>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {products.slice(0, 3).map((product) => (
            <Link
              key={product.name}
              href={`/wealden-joinery/${product.name.toLowerCase().split(" ")[0] === "timber" ? "windows" : "doors"}`}
              className="group space-y-4"
            >
              <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-slate-100">
                <div className="flex h-full items-center justify-center text-slate-400">
                  <p className="text-sm font-medium uppercase tracking-wider">{product.name}</p>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-slate-900 group-hover:text-slate-600 transition">{product.name}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{product.summary}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Single Hero Context Image */}
      {lifestyleImages[0] && (
        <section className="mx-auto max-w-7xl px-6 md:px-8">
          <div className="relative aspect-[21/9] overflow-hidden rounded-lg">
            <Image
              src={lifestyleImages[0].publicPath}
              alt={lifestyleImages[0].caption}
              width={lifestyleImages[0].width}
              height={lifestyleImages[0].height}
              className="object-cover"
            />
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <SectionHeading
          eyebrow="How it works"
          title="A calm, accountable process from first enquiry to aftercare."
          copy="Clarity at every step so you know who is onsite, what's next, and when your installation will complete."
        />
        <div className="grid gap-5 md:grid-cols-5">
          {steps.map((step, idx) => (
            <div key={step.title} className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-700 text-sm font-semibold text-white shadow-sm">
                {idx + 1}
              </div>
              <h4 className="text-base font-semibold text-slate-900">{step.title}</h4>
              <p className="mt-2 leading-relaxed text-slate-600">{step.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Case studies"
          title="Recent projects across the South East."
          copy="Regional installs with the right balance of heritage detail and modern comfort. Full stories coming soon."
        />
        <div className="grid gap-5 md:grid-cols-3">
          {caseStudies.map((project, index) => (
            <div key={project.location} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition hover:-translate-y-1 hover:shadow-lg">
              {caseStudyImages[index] && (
                <div className="relative w-full h-48">
                  <Image
                    src={caseStudyImages[index].publicPath}
                    alt={caseStudyImages[index].caption}
                    width={caseStudyImages[index].width}
                    height={caseStudyImages[index].height}
                    className="object-cover"
                  />
                </div>
              )}
              <div className="p-6 space-y-2 text-sm text-slate-700">
                <p className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {project.location}
                </p>
                <p className="text-base font-semibold text-slate-900">{project.type}</p>
                <p className="text-slate-600">{project.products}</p>
                <Link href="/wealden-joinery/projects" className="mt-3 inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">
                  View project →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Guarantees - Clean, architectural */}
      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-4xl px-6 text-center md:px-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Guarantees</p>
          <h2 className="mt-4 text-3xl font-light text-slate-900 md:text-4xl">Built to last a lifetime</h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-600">
            Industry-leading warranties reflect our confidence in materials, manufacturing, and finishing processes.
          </p>
          <div className="mt-12 grid gap-8 text-left md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-4xl font-light text-slate-900">30yr</div>
              <p className="text-sm font-medium uppercase tracking-wider text-slate-600">Rot & Fungal Decay</p>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-light text-slate-900">10yr</div>
              <p className="text-sm font-medium uppercase tracking-wider text-slate-600">Workmanship, Paint, Hardware</p>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-light text-slate-900">15yr</div>
              <p className="text-sm font-medium uppercase tracking-wider text-slate-600">Glazing Performance</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <SectionHeading
          eyebrow="FAQs"
          title="Answers to common questions."
          copy="More detail on planning, specifications, and how to get started."
        />
        <div className="grid gap-5 md:grid-cols-2">
          {faqs.map((item) => (
            <div key={item.q} className="rounded-xl border border-slate-200 bg-slate-50 p-6">
              <h4 className="text-base font-semibold text-slate-900">{item.q}</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-blue-50 p-6 shadow-sm md:p-10">
        <SectionHeading
          eyebrow="The Benefits"
          title="Why Lignum Timber Windows & Doors Perform So Well"
          copy="With over 30 years of experience in crafting timber windows and doors, we know that lasting quality comes down to the details."
        />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-white bg-white p-6 shadow-sm">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h4 className="text-base font-semibold text-slate-900">Exceptional Energy Efficiency</h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">High-performance glazing and insulated frames reduce heat loss and keep your home comfortable year-round.</p>
          </div>
          <div className="rounded-xl border border-white bg-white p-6 shadow-sm">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h4 className="text-base font-semibold text-slate-900">Outstanding Durability</h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Engineered timber with fully sealed joints resists warping, twisting and swelling for decades of reliable performance.</p>
          </div>
          <div className="rounded-xl border border-white bg-white p-6 shadow-sm">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <h4 className="text-base font-semibold text-slate-900">Low Maintenance Design</h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Engineered timber frames with smooth profiles shed rain naturally, finished with factory-applied microporous coatings for long-lasting weather protection.</p>
          </div>
          <div className="rounded-xl border border-white bg-white p-6 shadow-sm">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h4 className="text-base font-semibold text-slate-900">Secure by Design</h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Multi-point locking and robust construction offer superior protection for your home, PAS 24 certified and Secured by Design approved.</p>
          </div>
          <div className="rounded-xl border border-white bg-white p-6 shadow-sm">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h4 className="text-base font-semibold text-slate-900">Quiet Comfort</h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Advanced glazing reduces external noise by up to 36dB, creating a calmer indoor environment with excellent acoustic insulation.</p>
          </div>
          <div className="rounded-xl border border-white bg-white p-6 shadow-sm">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h4 className="text-base font-semibold text-slate-900">Sustainable Choice</h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Responsibly sourced FSC® timber with a lower carbon footprint than aluminium or PVC-U. Natural carbon store, renewable and recyclable, crafted to last for generations.</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-900 via-amber-800 to-stone-900 p-8 text-white shadow-sm">
        <div className="grid gap-6 md:grid-cols-2 md:items-center">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200">Download</p>
            <h3 className="text-2xl font-semibold">Inspiration brochure & colour guide</h3>
            <p className="text-sm text-amber-50">
              Explore colour palettes, glazing details, and recent installs. We’ll email the PDF instantly and follow up with a calm, helpful call if requested.
            </p>
            <div className="flex flex-wrap gap-3 text-sm font-semibold">
              <Link
                href="#"
                className="rounded-full bg-white/10 px-5 py-3 text-white ring-1 ring-white/30 transition hover:bg-white/15"
              >
                Download brochure (PDF)
              </Link>
              <Link
                href="/wealden-joinery/contact"
                className="rounded-full bg-white px-5 py-3 text-amber-900 transition hover:bg-amber-100"
              >
                Request a call back
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/5 p-6 shadow-inner backdrop-blur-sm">
            {lifestyleImage && (
              <div className="relative mb-4 w-full h-40 overflow-hidden rounded-xl border border-white/20">
                <Image
                  src={lifestyleImage.publicPath}
                  alt={lifestyleImage.caption}
                  width={lifestyleImage.width}
                  height={lifestyleImage.height}
                  className="object-cover"
                />
              </div>
            )}
            <p className="text-sm font-semibold text-emerald-100">What you'll get</p>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-emerald-50">
              <li>• Colour inspiration for heritage and contemporary homes</li>
              <li>• Timber, glazing, and hardware options explained</li>
              <li>• Case studies with before/after shots</li>
              <li>• Checklist to prepare for survey and installation</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
