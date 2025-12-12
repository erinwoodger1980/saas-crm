import type { Metadata } from "next";
import Link from "next/link";
import { ImageSlot } from "./_components/image-slot";
import { designSystem, components } from "./_lib/design-system";

export const metadata: Metadata = {
  title: "Wealden Joinery | Premium Timber Windows & Doors",
  description:
    "Precision-engineered timber windows and doors. Sustainably sourced, manufactured to exacting standards, engineered to last generations.",
};

const reasons = [
  {
    title: "UK-Manufactured to Certified Standards",
    copy: "Every window and door is manufactured at our Crowborough facility using precision CNC machinery, hand finishing, and factory-applied microporous coatings. Certifications: BSI ISO 9001, PAS 24:2016, Secured by Design, BS 6375, FSC® Chain of Custody.",
  },
  {
    title: "Forest to Frame: Sustainable Timber Sourcing",
    copy: "FSC®-certified forests with responsible forestry practices. Timber locks away ~1 tonne of CO₂ per cubic meter. Lowest embodied carbon: 60 kgCO₂/m² vs uPVC (120) vs aluminium (180). Designed to last 60+ years with routine maintenance.",
  },
  {
    title: "Security That Meets Police Standards",
    copy: "PAS 24:2016 testing simulates real burglary attempts. Multi-point locking with 3-minute minimum resistance. Laminated safety glass. Secured by Design approved. Document Q compliant for new builds.",
  },
  {
    title: "Industry-Leading Guarantees",
    copy: "30-year timber warranty, 10-year workmanship guarantee, 15-year sealed glazing warranty, 10-year hardware operation. All guarantees transferable to new property owners.",
  },
];

const products = [
  { name: "Sash Windows", href: "/wealden-joinery/windows" },
  { name: "Casement Windows", href: "/wealden-joinery/windows" },
  { name: "Entrance Doors", href: "/wealden-joinery/doors" },
  { name: "French Doors", href: "/wealden-joinery/doors" },
  { name: "Alu-Clad Systems", href: "/wealden-joinery/alu-clad" },
];

const steps = [
  { title: "Enquiry", detail: "Share your project aims and property type" },
  { title: "Survey", detail: "On-site measurements and design options" },
  { title: "Manufacture", detail: "Precision CNC with hand finishing" },
  { title: "Installation", detail: "Clean, considerate site fitting" },
  { title: "Aftercare", detail: "Maintenance guidance and support" },
];

export default function WealdenHomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero - Calm, architectural */}
      <section className={`${designSystem.spacing.sectionLarge} ${designSystem.layout.maxWidth} ${designSystem.spacing.containerPadding}`}>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className={designSystem.typography.caption}>
                Lignum by Wealden Joinery
              </p>
              <h1 className={designSystem.typography.hero}>
                Precision-Engineered
                <br />
                Timber Windows
                <br />
                & Doors
              </h1>
              <p className={`${designSystem.typography.body} max-w-xl`}>
                For heritage and contemporary architecture. Sustainably sourced, manufactured to exacting standards, engineered to last generations.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link href="/wealden-joinery/contact" className={designSystem.buttons.primary}>
                Book Consultation
              </Link>
              <Link href="/wealden-joinery/windows" className={designSystem.buttons.secondary}>
                View Windows
              </Link>
            </div>
          </div>
          <div>
            <ImageSlot
              slotId="home-hero"
              label="Hero Image"
              aspectRatio={designSystem.images.portrait}
              size="xl"
              imageContext="hero"
            />
          </div>
        </div>
      </section>

      {/* Brand Pillars */}
      <section className={`bg-slate-50 ${designSystem.spacing.section} ${designSystem.layout.maxWidth} ${designSystem.spacing.containerPadding}`}>
        <div className="text-center mb-16 space-y-3">
          <p className={designSystem.typography.caption}>Why Lignum</p>
          <h2 className={designSystem.typography.h2}>
            Engineered for longevity
          </h2>
        </div>
        <div className={`${designSystem.grid.two} ${designSystem.spacing.cardGap}`}>
          {reasons.map((reason) => (
            <div key={reason.title} className="space-y-4">
              <h3 className={designSystem.typography.h4}>{reason.title}</h3>
              <p className={designSystem.typography.bodySmall}>{reason.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Product Systems */}
      <section className={components.section}>
        <div className="text-center mb-16 space-y-3">
          <p className={designSystem.typography.caption}>Systems</p>
          <h2 className={designSystem.typography.h2}>Five product ranges</h2>
        </div>
        <div className={`${designSystem.grid.three} ${designSystem.spacing.cardGap}`}>
          {products.slice(0, 3).map((product, idx) => (
            <div key={product.name} className="group space-y-4">
              <ImageSlot
                slotId={`home-product-${idx}`}
                label={product.name}
                aspectRatio="aspect-[3/4]"
                size="lg"
                imageContext="card"
              />
              <Link href={product.href} className="block">
                <h3 className={`${designSystem.typography.h4} group-hover:text-slate-600 transition-colors`}>
                  {product.name}
                </h3>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Single Lifestyle Image */}
      <section className={`${designSystem.spacing.sectionCompact} ${designSystem.layout.maxWideWide} ${designSystem.spacing.containerPadding}`}>
        <ImageSlot
          slotId="home-lifestyle"
          label="Lifestyle Context"
          aspectRatio={designSystem.images.wide}
          size="xl"
          imageContext="hero"
        />
      </section>

      {/* Process */}
      <section className={`bg-slate-50 ${components.section}`}>
        <div className="text-center mb-16 space-y-3">
          <p className={designSystem.typography.caption}>How it works</p>
          <h2 className={designSystem.typography.h2}>
            A calm, accountable process
          </h2>
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-5 gap-6`}>
          {steps.map((step, idx) => (
            <div key={step.title} className={designSystem.cards.subtle + " p-6 space-y-3"}>
              <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-light">
                {idx + 1}
              </div>
              <h4 className={designSystem.typography.h4}>{step.title}</h4>
              <p className={designSystem.typography.bodySmall}>{step.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Case Studies Grid */}
      <section className={components.section}>
        <div className="text-center mb-16 space-y-3">
          <p className={designSystem.typography.caption}>Case Studies</p>
          <h2 className={designSystem.typography.h2}>Recent projects</h2>
        </div>
        <div className={`${designSystem.grid.three} ${designSystem.spacing.cardGap}`}>
          {["Victorian Villa, Kent", "Georgian Townhouse, Sussex", "Country Home, Kent"].map((title, idx) => (
            <div key={title} className={designSystem.cards.elevated}>
              <ImageSlot
                slotId={`home-case-study-${idx}`}
                label={title}
                aspectRatio={designSystem.images.landscape}
                overlayPosition="bottom-center"
                imageContext="card"
              />
              <div className="p-6 space-y-2">
                <h3 className={designSystem.typography.h4}>{title}</h3>
                <Link href="/wealden-joinery/projects" className="text-sm font-medium text-slate-900 hover:underline inline-flex items-center gap-1">
                  View project
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Guarantees */}
      <section className={`bg-slate-900 text-white ${designSystem.spacing.section} ${designSystem.layout.maxWidth} ${designSystem.spacing.containerPadding}`}>
        <div className="text-center mb-16 space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">Guarantees</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight text-white">
            Built to last a lifetime
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div className="space-y-2">
            <div className="text-5xl md:text-6xl font-light">30yr</div>
            <p className="text-sm uppercase tracking-wider text-slate-400">Rot & Decay</p>
          </div>
          <div className="space-y-2">
            <div className="text-5xl md:text-6xl font-light">10yr</div>
            <p className="text-sm uppercase tracking-wider text-slate-400">Workmanship</p>
          </div>
          <div className="space-y-2">
            <div className="text-5xl md:text-6xl font-light">15yr</div>
            <p className="text-sm uppercase tracking-wider text-slate-400">Glazing</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={components.section}>
        <div className={`${designSystem.cards.bordered} p-12 text-center space-y-6`}>
          <h2 className={designSystem.typography.h2}>Ready to start your project?</h2>
          <p className={`${designSystem.typography.body} max-w-2xl mx-auto`}>
            Book a consultation to discuss your requirements, or use our AI estimator for an instant indicative quote.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/wealden-joinery/contact" className={designSystem.buttons.primary}>
              Book Consultation
            </Link>
            <Link href="/wealden-joinery/estimate" className={designSystem.buttons.secondary}>
              Get AI Estimate
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
