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
    title: "UK-manufactured with certified quality",
    copy: "Every window and door is manufactured by approved joinery specialists using high-performance timber, industry-leading tooling and certified finishing processes.",
  },
  {
    title: "FSC® certified timber",
    copy: "Sustainably sourced timber with a natural carbon store and the lowest embodied carbon of any window or door frame. Crafted to last for generations.",
  },
  {
    title: "Secure, Part Q and PAS 24 compliant",
    copy: "Engineered for real homes with secure multi-point locking, robust construction, and full compliance with building regulations and Secured by Design systems.",
  },
  {
    title: "Industry leading guarantees",
    copy: "30-year rot and fungal decay warranty, 10-year workmanship, paint finish and hardware guarantees, 15-year glazing warranty.",
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
    <div className="space-y-16">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid items-center gap-10 px-6 py-12 md:px-10 md:py-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <p className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Wealden Joinery
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
              Premium Timber Windows & Doors
            </h1>
            <p className="text-lg text-slate-600">
              Sustainably crafted timber windows and doors built for people who want the character of timber with modern-day performance. Whether restoring a period property, building new or renovating, our products combine traditional craftsmanship with up-to-date standards on energy efficiency, security, and durability.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/wealden-joinery/estimate"
                className="rounded-full bg-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-[1.02] hover:bg-emerald-800"
              >
                Get an Instant Estimate
              </Link>
              <Link
                href="/wealden-joinery/contact"
                className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
              >
                Book a Consultation
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <span>Crowborough HQ & Manufacturing</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                <span>Showrooms Nationwide</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-slate-500" />
                <span>FENSA & PAS 24 Certified</span>
              </div>
            </div>
          </div>

          <div className="relative w-full h-64 sm:h-80 lg:h-[400px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-lg">
            {heroImage && (
              <Image
                src={heroImage.publicPath}
                alt={heroImage.caption}
                width={heroImage.width}
                height={heroImage.height}
                className="object-cover"
                priority
              />
            )}
          </div>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Why Wealden Joinery"
          title="Premium craft, reliable delivery, calm experience."
          copy="Thoughtful design and disciplined installation so homeowners, architects, and contractors can trust every detail."
        />
        <div className="grid gap-5 md:grid-cols-2">
          {reasons.map((reason) => (
            <div
              key={reason.title}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <h3 className="text-lg font-semibold text-slate-900">{reason.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{reason.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Ranges"
          title="Windows & doors tailored to character and performance."
          copy="From conservation-friendly sashes to contemporary alu-clad systems, every range is built to suit the property."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {products.map((product, idx) => {
            // Map products to images
            const productImage = 
              product.name.includes("Sash") || product.name.includes("Casement") 
                ? windowImages[idx % windowImages.length]
                : product.name.includes("Alu-Clad")
                  ? aluImages[0]
                  : doorImages[idx % doorImages.length];

            return (
              <article
                key={product.name}
                className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col transition hover:-translate-y-1 hover:shadow-lg"
              >
                {productImage && (
                  <div className="relative w-full h-48">
                    <Image
                      src={productImage.publicPath}
                      alt={productImage.caption}
                      width={productImage.width}
                      height={productImage.height}
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900">{product.name}</h3>
                    <p className="text-sm leading-relaxed text-slate-600">{product.summary}</p>
                  </div>
                  <Link
                    href={`/wealden-joinery/${product.name.toLowerCase().split(" ")[0] === "timber" ? "windows" : "doors"}`}
                    className="inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    View details →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeading
          title="Premium timber joinery in homes across the region"
          copy="From heritage restorations to contemporary new builds, our work enhances comfort and character."
        />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
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

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm md:p-10">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <SectionHeading
              eyebrow="Industry Leading Guarantees"
              title="Built to last a lifetime with exceptional warranties."
              copy="With over 30 years of experience, we know that lasting quality comes down to the details. That's why Lignum windows and doors are built to stand the test of time."
            />
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="rounded-lg border border-emerald-200 bg-white p-4 text-center">
                <div className="text-3xl font-bold text-emerald-700">30</div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 mt-1">Years</div>
                <div className="text-sm text-slate-700 mt-2">Rot & Fungal Decay</div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-white p-4 text-center">
                <div className="text-3xl font-bold text-emerald-700">10</div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 mt-1">Years</div>
                <div className="text-sm text-slate-700 mt-2">Workmanship</div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-white p-4 text-center">
                <div className="text-3xl font-bold text-emerald-700">10</div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 mt-1">Years</div>
                <div className="text-sm text-slate-700 mt-2">Paint Finish</div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-white p-4 text-center">
                <div className="text-3xl font-bold text-emerald-700">10</div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 mt-1">Years</div>
                <div className="text-sm text-slate-700 mt-2">Hardware</div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-white p-4 text-center col-span-2">
                <div className="text-3xl font-bold text-emerald-700">15</div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 mt-1">Years</div>
                <div className="text-sm text-slate-700 mt-2">Glazing</div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {workshopImage && (
              <div className="relative w-full h-48">
                <Image
                  src={workshopImage.publicPath}
                  alt={workshopImage.caption}
                  width={workshopImage.width}
                  height={workshopImage.height}
                  className="object-cover"
                />
              </div>
            )}
            <div className="p-6">
              <p className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                AI Estimator
              </p>
              <h3 className="mt-3 text-xl font-semibold text-slate-900">Get a tailored estimate in minutes.</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Outline your windows and doors, select styles, and receive an indicative budget range with next steps. No obligation,
                no pushy follow-up.
              </p>
              <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
                <Link
                  href="/wealden-joinery/estimate"
                  className="rounded-full bg-emerald-700 px-6 py-3 text-white transition hover:scale-[1.02] hover:bg-emerald-800"
                >
                  Start the AI Estimator
                </Link>
                <Link
                  href="/wealden-joinery/windows"
                  className="rounded-full border border-slate-300 px-6 py-3 text-slate-700 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  Explore windows first
                </Link>
              </div>
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
