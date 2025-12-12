import type { Metadata } from "next";
import Link from "next/link";
import { EnhancedImagePlaceholder } from "../_components/enhanced-image-placeholder";
import { designSystem, components } from "../_lib/design-system";

export const metadata: Metadata = {
  title: "Timber Windows — Heritage, Contemporary & System | Lignum by Wealden Joinery",
  description:
    "Precision-engineered timber windows for period properties and contemporary architecture. Heritage sash, flush casement, and wood-aluminium systems manufactured to conservation standards.",
};

const heritageWindows = [
  {
    title: "Box Sash Windows",
    summary: "Full traditional sash operation with hidden counterweights in box frames. Essential for listed buildings requiring authentic 18th/19th century mechanism.",
    keyPoints: [
      "Hidden counterweights with traditional pulleys",
      "75mm slim frames with vacuum glazing (6.15mm thick)",
      "Traditional horns, staff beads, decorative glazing bars",
      "Suitable for Grade I, II*, and II listed buildings",
    ],
  },
  {
    title: "Spring Balance Sash Windows",
    summary: "Classic sash appearance with concealed spiral spring balances. Identical external appearance to box sash with easier operation and narrower frames.",
    keyPoints: [
      "Slimmer 65mm frame depth (no weight box required)",
      "Smooth spiral spring balance operation",
      "Identical external appearance to box sash",
      "Suitable for conservation areas",
    ],
  },
];

const contemporaryWindows = [
  {
    title: "Flush Casement Windows",
    summary: "Sashes sit flush with the frame when closed—no projecting mouldings or visible rebate. Contemporary aesthetic for Georgian, Regency, or modern architecture.",
    keyPoints: [
      "Flush finish—sash and frame align perfectly",
      "58mm slim sightlines with double or vacuum glazing",
      "PAS 24 security with multi-point locking",
      "10-year factory paint finish guarantee",
    ],
  },
  {
    title: "Storm-Proof Casement Windows",
    summary: "Rebated profile with sash sitting proud of frame—visible moulding step creates traditional cottage or Victorian character.",
    keyPoints: [
      "Rebated profile with visible moulding step",
      "68mm frame depth accommodating double glazing",
      "Multi-point espagnolette locking (PAS 24)",
      "Custom glazing bar patterns available",
    ],
  },
];

const performanceOptions = [
  { 
    title: "Timber Selection", 
    copy: "FSC® certified timber from responsibly managed forests. European Oak for durability, Accoya® acetylated softwood with 50-year guarantee, or engineered hardwood cores. Timber stores ~1 tonne of CO₂ per cubic meter—lowest embodied carbon of any window material." 
  },
  { 
    title: "Glazing & Vacuum Glass", 
    copy: "Vacuum glazing achieves U-values as low as 0.49 W/m²K in a slim 6.15mm profile. Reduces external noise by up to 36dB. Essential for conservation areas requiring slim sightlines with modern thermal performance. 15-year sealed unit warranty." 
  },
  { 
    title: "Security & Certification", 
    copy: "PAS 24:2016 certified—tested to resist forced entry for minimum 3 minutes. Multi-point locking with mushroom cam keeps. Secured by Design approved. Complies with Building Regulations Document Q and Document M." 
  },
  { 
    title: "Paint & Finishing", 
    copy: "Factory-applied microporous paint systems. Breathable coatings protect timber while allowing moisture to escape. Available in natural stains, soft neutrals, or bold architectural shades. 10-year guarantee against flaking or peeling." 
  },
  { 
    title: "Hardware & Ironmongery", 
    copy: "Ergonomic designs tested for 10,000+ operations. Finishes include satin brass, antique bronze, polished chrome, matt black, or brushed stainless steel. All hardware with 10-year mechanical guarantee." 
  },
];

const windowFaqs = [
  {
    q: "What's the difference between box sash and spring balance sash windows?",
    a: "Box sash uses hidden weights and pulleys (authentic mechanism, 75mm frames). Spring balance uses concealed spiral springs (identical appearance, easier operation, narrower 65mm frames). Both achieve conservation approval.",
  },
  {
    q: "Is vacuum glazing worth the extra cost?",
    a: "Yes, for listed buildings or conservation areas requiring slim sightlines. Vacuum glazing achieves 0.49 W/m²K in a 6.15mm profile—approved by conservation officers, reduces energy bills by 60–70% vs single glazing.",
  },
  {
    q: "Can you match existing glazing bar patterns?",
    a: "Yes. We survey existing windows, photograph details, and measure bar spacings with laser accuracy. CNC machinery replicates profiles exactly, followed by hand finishing.",
  },
  {
    q: "What guarantees do you offer?",
    a: "30-year timber warranty against rot, 10-year workmanship guarantee, 10-year factory paint finish, 15-year sealed glazing warranty. All guarantees transferable to new property owners.",
  },
];

export default function WindowsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className={components.heroSection}>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className={designSystem.typography.caption}>Windows</p>
              <h1 className={designSystem.typography.hero}>
                Heritage & Contemporary
                <br />
                Timber Windows
              </h1>
              <p className={`${designSystem.typography.body} max-w-xl`}>
                Precision-engineered for listed buildings, conservation areas, and architect-led new builds—combining authentic detailing with modern thermal performance.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-8 pt-4">
              <div className="space-y-2">
                <p className="text-3xl font-light">30yr</p>
                <p className={designSystem.typography.caption}>Rot guarantee</p>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-light">10yr</p>
                <p className={designSystem.typography.caption}>Workmanship</p>
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-light">FSC</p>
                <p className={designSystem.typography.caption}>Certified</p>
              </div>
            </div>
          </div>
          <div>
            <EnhancedImagePlaceholder
              label="Windows Hero"
              aspectRatio={designSystem.images.portrait}
              size="xl"
            />
          </div>
        </div>
      </section>

      {/* Heritage Windows */}
      <section className={`bg-slate-50 ${components.section}`}>
        <div className="mb-16 space-y-3">
          <p className={designSystem.typography.caption}>Heritage</p>
          <h2 className={designSystem.typography.h2}>
            Where authenticity matters
          </h2>
          <p className={`${designSystem.typography.body} max-w-2xl`}>
            Traditional sash operation with modern thermal performance and conservation approval.
          </p>
        </div>
        <div className={`${designSystem.grid.two} ${designSystem.spacing.cardGap}`}>
          {heritageWindows.map((window) => (
            <div key={window.title} className="space-y-6">
              <EnhancedImagePlaceholder
                label={window.title}
                aspectRatio={designSystem.images.portrait}
                size="lg"
              />
              <div className="space-y-4">
                <h3 className={designSystem.typography.h3}>{window.title}</h3>
                <p className={designSystem.typography.bodySmall}>{window.summary}</p>
                <ul className="space-y-2">
                  {window.keyPoints.map((point) => (
                    <li key={point} className={`${designSystem.typography.bodySmall} flex items-start gap-2`}>
                      <span className="text-slate-400 mt-1">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contemporary Windows */}
      <section className={components.section}>
        <div className="mb-16 space-y-3">
          <p className={designSystem.typography.caption}>Contemporary</p>
          <h2 className={designSystem.typography.h2}>
            Refined detailing
          </h2>
          <p className={`${designSystem.typography.body} max-w-2xl`}>
            For modern extensions, new builds, or heritage properties requiring subtle profiles.
          </p>
        </div>
        <div className={`${designSystem.grid.two} ${designSystem.spacing.cardGap}`}>
          {contemporaryWindows.map((window) => (
            <div key={window.title} className="space-y-6">
              <EnhancedImagePlaceholder
                label={window.title}
                aspectRatio={designSystem.images.portrait}
                size="lg"
              />
              <div className="space-y-4">
                <h3 className={designSystem.typography.h3}>{window.title}</h3>
                <p className={designSystem.typography.bodySmall}>{window.summary}</p>
                <ul className="space-y-2">
                  {window.keyPoints.map((point) => (
                    <li key={point} className={`${designSystem.typography.bodySmall} flex items-start gap-2`}>
                      <span className="text-slate-400 mt-1">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Detail Shots */}
      <section className={`bg-slate-50 ${components.section}`}>
        <div className="mb-16 text-center space-y-3">
          <p className={designSystem.typography.caption}>Precision Details</p>
          <h2 className={designSystem.typography.h2}>Engineered to last</h2>
        </div>
        <div className={`${designSystem.grid.three} ${designSystem.spacing.cardGap}`}>
          {["Joinery Detail", "Hardware Close-up", "Glazing Profile"].map((label) => (
            <EnhancedImagePlaceholder
              key={label}
              label={label}
              aspectRatio={designSystem.images.square}
              size="md"
            />
          ))}
        </div>
      </section>

      {/* Context Image */}
      <section className={`${designSystem.spacing.sectionCompact} ${designSystem.layout.maxWideWide} ${designSystem.spacing.containerPadding}`}>
        <EnhancedImagePlaceholder
          label="Windows in Context"
          aspectRatio={designSystem.images.wide}
          size="xl"
        />
      </section>

      {/* Specifications */}
      <section className={components.sectionNarrow}>
        <div className="mb-16 text-center space-y-3">
          <p className={designSystem.typography.caption}>Specifications</p>
          <h2 className={designSystem.typography.h2}>Materials & Performance</h2>
        </div>
        <div className="space-y-12">
          {performanceOptions.map((option) => (
            <div key={option.title} className="border-b border-slate-100 pb-12 last:border-0 last:pb-0">
              <h3 className={designSystem.typography.h4}>{option.title}</h3>
              <p className={`${designSystem.typography.bodySmall} mt-3`}>{option.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className={`bg-slate-50 ${components.sectionNarrow}`}>
        <div className="mb-12 text-center space-y-3">
          <p className={designSystem.typography.caption}>Questions</p>
          <h2 className={designSystem.typography.h2}>Common enquiries</h2>
        </div>
        <div className="space-y-8">
          {windowFaqs.map((item) => (
            <div key={item.q} className="border-b border-slate-100 pb-8 last:border-0 last:pb-0">
              <h3 className={`${designSystem.typography.h4} mb-3`}>{item.q}</h3>
              <p className={designSystem.typography.bodySmall}>{item.a}</p>
            </div>
          ))}
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
              Which window system<br />suits your project?
            </h2>
            <p className={`${designSystem.typography.body} max-w-2xl mx-auto text-white/80`}>
              Book a consultation to discuss heritage constraints, thermal requirements, and detailed specifications.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/wealden-joinery/contact" className="border-2 border-white px-10 py-4 text-sm font-medium uppercase tracking-[0.15em] text-white transition hover:bg-white hover:text-slate-900 rounded-full">
              Book Consultation
            </Link>
            <Link href="/wealden-joinery/estimate" className="border border-white/20 px-10 py-4 text-sm font-medium uppercase tracking-[0.15em] text-white/70 transition hover:border-white/40 hover:text-white rounded-full">
              Request Estimate
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
