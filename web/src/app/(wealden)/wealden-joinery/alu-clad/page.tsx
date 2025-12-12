import type { Metadata } from "next";
import Link from "next/link";
import { EnhancedImagePlaceholder } from "../_components/enhanced-image-placeholder";
import { designSystem, components } from "../_lib/design-system";

export const metadata: Metadata = {
  title: "Alu-Clad Timber Systems — Low Maintenance, High Performance | Lignum by Wealden Joinery",
  description:
    "Timber warmth inside, maintenance-free aluminium outside. Engineered for contemporary architecture, exposed locations, and long-life performance.",
};

const benefits = [
  {
    title: "Timber warmth inside",
    copy: "Solid timber frames visible from the interior for traditional detailing and natural insulation.",
  },
  {
    title: "Aluminium protection outside",
    copy: "Powder-coated aluminium cladding shields timber from weather, extending life and reducing maintenance.",
  },
  {
    title: "Long-life performance",
    copy: "Factory-bonded aluminium capping eliminates regular external painting and staining cycles.",
  },
  {
    title: "Colour flexibility",
    copy: "Wide RAL colour range for aluminium exterior while keeping timber character inside.",
  },
];

const bestFor = [
  "Coastal exposure—salt spray, high winds, driving rain",
  "South-facing elevations—intense UV exposure",
  "Rental or second homes—low maintenance requirements",
  "Contemporary architecture—powder-coated RAL colours",
  "Large sliding/bi-fold systems—aluminium strength",
  "50+ year lifespan projects—zero external maintenance",
];

const choosePureTimber = [
  "Heritage buildings—conservation approval required",
  "Traditional architecture—authentic timber character",
  "Owner-occupied homes—capable of routine maintenance",
  "Lower initial budget—20–30% cost saving",
  "Repairable detailing—individual component replacement",
];

const comparisonData = [
  {
    system: "Pure Timber",
    pros: ["Heritage character", "Natural insulation", "Easy to repair", "Lower initial cost"],
    cons: ["External painting every 8–10 years", "Higher maintenance", "Less suited to coastal exposure"],
    specs: "U-value: 1.0–1.2 W/m²K | 60+ year lifespan | £1,200–£1,800 per window",
  },
  {
    system: "Alu-Clad Timber",
    pros: ["Zero external maintenance", "Excellent coastal durability", "Timber warmth inside", "80+ year lifespan"],
    cons: ["Higher initial cost (+30%)", "Slight thermal bridging", "Lower repairability", "Rarely approved for listed buildings"],
    specs: "U-value: 1.1–1.3 W/m²K | 80+ year lifespan | £1,800–£2,600 per window",
  },
  {
    system: "uPVC",
    pros: ["Low maintenance", "Cost-effective initially", "Widely available"],
    cons: ["Lacks timber character", "Limited colours", "Thermal expansion issues", "20–30 year lifespan"],
    specs: "U-value: 1.2–1.4 W/m²K | 20–30 year lifespan | £800–£1,200 per window",
  },
];

export default function AluCladPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className={components.heroSection}>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className={designSystem.typography.caption}>System Products</p>
              <h1 className={designSystem.typography.hero}>
                Alu-clad
                <br />
                Timber Systems
              </h1>
              <p className={`${designSystem.typography.body} max-w-xl`}>
                Timber warmth inside, maintenance-free aluminium outside. Engineered for contemporary architecture and exposed locations.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link href="/wealden-joinery/contact" className={designSystem.buttons.primary}>
                Get Quote
              </Link>
              <Link href="/wealden-joinery/windows" className={designSystem.buttons.secondary}>
                View Windows
              </Link>
            </div>
          </div>
          <div>
            <EnhancedImagePlaceholder
              label="Alu-Clad Hero"
              aspectRatio={designSystem.images.portrait}
              size="xl"
            />
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className={components.sectionNarrow}>
        <div className="text-center space-y-6">
          <p className={designSystem.typography.caption}>The System</p>
          <h2 className={designSystem.typography.h2}>
            Timber inside. Aluminium outside.
          </h2>
          <p className={`${designSystem.typography.body} max-w-2xl mx-auto`}>
            Factory-bonded aluminium cladding protects timber from weather while preserving natural warmth and character internally. No external painting. No staining cycles.
          </p>
        </div>
      </section>

      {/* System Explanation */}
      <section className={`bg-slate-50 ${components.section}`}>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <div className="space-y-6">
            <h3 className={designSystem.typography.h3}>How it works</h3>
            <div className={`${designSystem.typography.bodySmall} space-y-4`}>
              <p>
                Alu-clad systems combine solid timber frames with powder-coated aluminium cladding. The aluminium is bonded to the timber during manufacture, creating a weather-resistant barrier.
              </p>
              <p>
                Inside, you see and feel timber—natural grain, warmth, traditional detailing. Outside, durable aluminium in any RAL colour protects the timber from rain, UV, and coastal exposure.
              </p>
              <p>
                Ideal for contemporary builds, exposed locations, and projects where low-maintenance performance is essential.
              </p>
            </div>
          </div>
          <div>
            <EnhancedImagePlaceholder
              label="System Detail"
              aspectRatio={designSystem.images.landscape}
              size="lg"
            />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className={components.section}>
        <div className="mb-16 text-center space-y-3">
          <p className={designSystem.typography.caption}>Benefits</p>
          <h2 className={designSystem.typography.h2}>Long-life performance</h2>
        </div>
        <div className={`${designSystem.grid.four} ${designSystem.spacing.cardGap}`}>
          {benefits.map((benefit) => (
            <div key={benefit.title} className="space-y-3">
              <h3 className={designSystem.typography.h4}>{benefit.title}</h3>
              <p className={designSystem.typography.bodySmall}>{benefit.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Applications */}
      <section className={`bg-slate-50 ${components.sectionNarrow}`}>
        <div className="space-y-12">
          <div className="space-y-4 text-center">
            <p className={designSystem.typography.caption}>Applications</p>
            <h2 className={designSystem.typography.h2}>Where it works best</h2>
          </div>
          <div className="space-y-3 border-l-2 border-slate-200 pl-6">
            {bestFor.map((item) => (
              <p key={item} className={`${designSystem.typography.bodySmall} flex items-start gap-2`}>
                <span className="text-slate-400">•</span>
                <span>{item}</span>
              </p>
            ))}
          </div>
          <div className="space-y-4 pt-8">
            <h3 className={designSystem.typography.h4}>When to choose pure timber</h3>
            <div className="space-y-3 border-l-2 border-slate-200 pl-6">
              {choosePureTimber.map((item) => (
                <p key={item} className={`${designSystem.typography.bodySmall} flex items-start gap-2`}>
                  <span className="text-slate-400">•</span>
                  <span>{item}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className={components.section}>
        <div className="mb-16 text-center space-y-3">
          <p className={designSystem.typography.caption}>Comparison</p>
          <h2 className={designSystem.typography.h2}>Timber vs Alu-Clad vs uPVC</h2>
        </div>
        <div className={`${designSystem.grid.three} ${designSystem.spacing.cardGap}`}>
          {comparisonData.map((item) => (
            <div key={item.system} className={designSystem.cards.elevated + " p-6 space-y-6"}>
              <h3 className={designSystem.typography.h3}>{item.system}</h3>
              <div className="space-y-4">
                <div>
                  <h4 className={`${designSystem.typography.bodySmall} font-medium mb-2`}>Pros</h4>
                  <ul className="space-y-1">
                    {item.pros.map((pro) => (
                      <li key={pro} className={`${designSystem.typography.bodySmall} flex items-start gap-2`}>
                        <span className="text-green-600">+</span>
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className={`${designSystem.typography.bodySmall} font-medium mb-2`}>Cons</h4>
                  <ul className="space-y-1">
                    {item.cons.map((con) => (
                      <li key={con} className={`${designSystem.typography.bodySmall} flex items-start gap-2`}>
                        <span className="text-slate-400">−</span>
                        <span>{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <p className={`${designSystem.typography.caption} leading-relaxed`}>{item.specs}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Gallery */}
      <section className={`bg-slate-50 ${components.section}`}>
        <div className="mb-16 text-center space-y-3">
          <p className={designSystem.typography.caption}>Gallery</p>
          <h2 className={designSystem.typography.h2}>Alu-Clad Examples</h2>
        </div>
        <div className={`${designSystem.grid.three} ${designSystem.spacing.cardGap}`}>
          {["Detail Shot 1", "Detail Shot 2", "Detail Shot 3"].map((label) => (
            <EnhancedImagePlaceholder
              key={label}
              label={label}
              aspectRatio={designSystem.images.square}
              size="md"
            />
          ))}
        </div>
        <div className="mt-8">
          <EnhancedImagePlaceholder
            label="Lifestyle Context"
            aspectRatio={designSystem.images.wide}
            size="xl"
          />
        </div>
      </section>

      {/* CTA */}
      <section className={`bg-slate-900 text-white ${components.section}`}>
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/60">
              Start Your Project
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight text-white">
              Is alu-clad right for your project?
            </h2>
            <p className={`${designSystem.typography.body} max-w-2xl mx-auto text-white/80`}>
              Book a consultation to discuss exposure levels, maintenance expectations, and system recommendations.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/wealden-joinery/contact" className="border-2 border-white px-10 py-4 text-sm font-medium uppercase tracking-[0.15em] text-white transition hover:bg-white hover:text-slate-900 rounded-full">
              Book Consultation
            </Link>
            <Link href="/wealden-joinery/windows" className="border border-white/20 px-10 py-4 text-sm font-medium uppercase tracking-[0.15em] text-white/70 transition hover:border-white/40 hover:text-white rounded-full">
              View Windows
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
