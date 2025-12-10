import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "./_components/section-heading";

export const metadata: Metadata = {
  title: "Wealden Joinery | Beautiful Timber Windows & Doors, Crafted in Sussex",
  description:
    "Discover Wealden Joinery’s premium timber windows and doors. Heritage-friendly replacements with modern performance, crafted and installed across the South East.",
};

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
      <section className="overflow-hidden rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-amber-100/60 shadow-sm">
        <div className="grid gap-10 px-4 py-10 md:grid-cols-2 md:px-8 md:py-14">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-900/80">Wealden Joinery</p>
            <h1 className="text-3xl font-semibold leading-tight text-slate-900 md:text-4xl">
              Beautiful Timber Windows & Doors, Crafted in Sussex.
            </h1>
            <p className="text-lg text-slate-700">
              Heritage-sensitive replacements with modern performance. From sash and casement windows to statement entrance doors,
              we design, make, and install everything in-house.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/wealden-joinery/estimate"
                className="rounded-full bg-amber-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-900"
              >
                Get an Instant Estimate
              </Link>
              <Link
                href="/wealden-joinery/contact"
                className="rounded-full border border-amber-800 px-5 py-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-50"
              >
                Book a Consultation
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 shadow-sm">
                <span className="text-amber-700">★★★★★</span> 4.9/5 from recent homeowners
              </div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-amber-900/80">
                <span className="h-8 w-8 rounded-full bg-amber-100" />
                <span>FENSA · BM TRADA · FSC® (placeholders)</span>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-6 rounded-3xl bg-gradient-to-br from-amber-200/50 via-white to-amber-50 blur-3xl" />
            <div className="relative h-full rounded-3xl border border-amber-100 bg-white/70 p-4 shadow-lg">
              <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_20%_20%,#fcd34d_0,#fde68a_20%,transparent_40%),radial-gradient(circle_at_80%_30%,#bfdbfe_0,#bfdbfe_18%,transparent_38%),linear-gradient(135deg,#0f172a,#1e293b)]">
                <div className="flex h-full items-end justify-between bg-gradient-to-t from-black/60 to-black/0 p-6 text-white">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-amber-100">Sussex workshop</p>
                    <p className="text-lg font-semibold">Precision-made timber frames</p>
                  </div>
                  <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase">AI Estimator ready</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Why Wealden Joinery"
          title="Premium craft, reliable delivery, calm experience."
          copy="Thoughtful design and disciplined installation so homeowners, architects, and contractors can trust every detail."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {reasons.map((reason) => (
            <div
              key={reason.title}
              className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="text-lg font-semibold text-slate-900">{reason.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{reason.copy}</p>
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
          {products.map((product) => (
            <div key={product.name} className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{product.name}</h3>
                  <p className="mt-2 text-sm text-slate-600">{product.summary}</p>
                </div>
                <Link
                  href={`/wealden-joinery/${product.name.toLowerCase().split(" ")[0] === "timber" ? "windows" : "doors"}`}
                  className="text-sm font-semibold text-amber-900 hover:underline"
                >
                  View details
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-amber-100 bg-white/80 p-6 shadow-sm md:p-8">
        <SectionHeading
          eyebrow="How it works"
          title="A calm, accountable process from first enquiry to aftercare."
          copy="Clarity at every step so you know who is onsite, what’s next, and when your installation will complete."
        />
        <div className="grid gap-4 md:grid-cols-5">
          {steps.map((step, idx) => (
            <div key={step.title} className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 text-sm">
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-800 text-sm font-semibold text-white">
                {idx + 1}
              </div>
              <h4 className="text-base font-semibold text-slate-900">{step.title}</h4>
              <p className="mt-1 text-slate-600">{step.detail}</p>
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
        <div className="grid gap-4 md:grid-cols-3">
          {caseStudies.map((project) => (
            <div key={project.location} className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
              <div className="aspect-[4/3] rounded-xl bg-[radial-gradient(circle_at_30%_30%,#fef3c7,transparent_50%),linear-gradient(135deg,#0f172a,#1f2937)]" />
              <div className="mt-4 space-y-1 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-900/80">{project.location}</p>
                <p className="text-base font-semibold text-slate-900">{project.type}</p>
                <p>{project.products}</p>
              </div>
              <Link href="/wealden-joinery/projects" className="mt-3 inline-flex text-sm font-semibold text-amber-900 hover:underline">
                View project
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-amber-100 bg-amber-50/70 p-6 shadow-sm md:p-8">
        <div className="grid gap-6 md:grid-cols-2 md:items-center">
          <div>
            <SectionHeading
              eyebrow="Guarantees"
              title="Assurance on materials, coatings, glazing, and workmanship."
              copy="We specify engineered timber, multi-coat finishes, and premium glazing so our guarantees are meaningful. Full terms provided with every order."
            />
            <ul className="space-y-2 text-sm text-slate-700">
              <li>• Timber stability and paint system guarantees (years depend on specification). {/* TODO: confirm durations */}</li>
              <li>• Glazing seal warranty and hardware performance guidance.</li>
              <li>• Installation workmanship guarantee with responsive aftercare.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-900/80">AI Estimator</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Get a tailored estimate in minutes.</h3>
            <p className="mt-2 text-sm text-slate-700">
              Outline your windows and doors, select styles, and receive an indicative budget range with next steps. No obligation,
              no pushy follow-up.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
              <Link
                href="/wealden-joinery/estimate"
                className="rounded-full bg-amber-800 px-5 py-3 text-white transition hover:bg-amber-900"
              >
                Start the AI Estimator
              </Link>
              <Link
                href="/wealden-joinery/windows"
                className="rounded-full border border-amber-800 px-5 py-3 text-amber-900 transition hover:bg-amber-50"
              >
                Explore windows first
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm md:p-8">
        <SectionHeading
          eyebrow="FAQs"
          title="Answers to common questions."
          copy="More detail on planning, specifications, and how to get started."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map((item) => (
            <div key={item.q} className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5">
              <h4 className="text-base font-semibold text-slate-900">{item.q}</h4>
              <p className="mt-2 text-sm text-slate-700">{item.a}</p>
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
          <div className="rounded-2xl border border-white/20 bg-white/5 p-6 shadow-inner">
            <p className="text-sm font-semibold text-amber-100">What you’ll get</p>
            <ul className="mt-3 space-y-2 text-sm text-amber-50">
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
