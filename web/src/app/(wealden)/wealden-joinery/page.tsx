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
const windowImages = getImagesByHint("range-windows", 2);
const doorImages = getImagesByHint("range-doors", 2);
const aluImages = getImagesByHint("alu-clad", 1);
const caseStudyImages = getImagesByHint("case-study", 3);
const workshopImage = getImagesByHint("workshop", 1)[0];
const lifestyleImage = getImagesByHint("lifestyle", 1)[0];

const reasons = [
  {
    title: "Craftsmanship that honours heritage",
    copy: "Hand-finished timber windows and doors that respect the character of period homes while upgrading performance.",
  },
  {
    title: "Performance you can feel",
    copy: "Engineered timber, high-spec glazing, and weather seals keep homes warmer, quieter, and secure.",
  },
  {
    title: "Reliable delivery & install",
    copy: "Survey, design, manufacture, and installation handled by one accountable team—no hand-offs or surprises.",
  },
  {
    title: "Aftercare that lasts",
    copy: "Clear guarantees on timber, paint, glazing, and workmanship with responsive local support.",
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
    a: "We outline guarantees on timber stability, paint system, glazing units, and installation workmanship. Detailed terms are provided with every order.",
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
              Heritage-sensitive replacements with modern performance. Manufactured at our Crowborough headquarters with showrooms nationwide. From sash and casement windows to statement entrance doors.
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
              eyebrow="Guarantees"
              title="Assurance on materials, coatings, glazing, and workmanship."
              copy="We specify engineered timber, multi-coat finishes, and premium glazing so our guarantees are meaningful. Full terms provided with every order."
            />
            <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
              <li>• Timber stability and paint system guarantees (years depend on specification). {/* TODO: confirm durations */}</li>
              <li>• Glazing seal warranty and hardware performance guidance.</li>
              <li>• Installation workmanship guarantee with responsive aftercare.</li>
            </ul>
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
