import type { Metadata } from "next";
import Link from "next/link";
import { ImageSlot } from "../_components/image-slot";
import { designSystem, components } from "../_lib/design-system";

export const metadata: Metadata = {
  title: "Timber Entrance & Garden Doors | Wealden Joinery",
  description:
    "Bespoke timber entrance doors, French doors, sliding doors, and bi-folds. Secure cores, premium hardware, and elegant detailing crafted in Sussex.",
};

const doorTypes = [
  {
    title: "Entrance Doors",
    summary: "A front door is the first impression—and the last line of defence. Every entrance door combines engineered timber strength with PAS 24 security certification.",
    keyPoints: [
      "PAS 24:2016 certified—3 minutes forced entry resistance",
      "3-point or 5-point multi-point locking with shootbolts",
      "44mm solid engineered timber core or FD30 fire-rated",
      "Laminated safety glass (6.4mm or 8.8mm)",
      "Traditional 4/6-panel or contemporary flush styles",
      "Hardware: satin brass, bronze, chrome, matt black",
    ],
  },
  {
    title: "French Doors",
    summary: "Traditional elegance for smaller openings. Best for heritage properties, traditional homes, or openings 1.5–2.5m wide.",
    keyPoints: [
      "Best for openings 1.5–2.5m wide",
      "Inward or outward opening",
      "Secure 3-point multi-point locking",
      "Document M compliant low thresholds available",
      "Traditional astragal glazing bars available",
      "Typical cost: £3,500–£6,000 installed",
    ],
  },
  {
    title: "Bifold Doors",
    summary: "Maximum flexibility for large openings. Best for extensions, garden rooms, or openings 2.5–6m wide.",
    keyPoints: [
      "3–7 panels folding left, right, or split",
      "Smooth stainless steel roller operation",
      "Optional traffic door for daily access",
      "Flush threshold or step-down track options",
      "U-value 0.7–1.2 W/m²K",
      "Typical cost: £8,000–£15,000 installed",
    ],
  },
  {
    title: "Sliding Doors (Lift-Slide)",
    summary: "Contemporary clean lines for narrow clearances. Large glass panels slide inline requiring no external space.",
    keyPoints: [
      "Large panels up to 2.5m x 2.5m each",
      "Lift-and-slide mechanism with secure locking",
      "Inline sliding requires no external clearance",
      "Flush threshold options (Document M)",
      "U-value 0.9–1.1 W/m²K",
      "Typical cost: £6,500–£12,000 installed",
    ],
  },
];

const specifications = [
  { 
    title: "Security & Certification", 
    copy: "PAS 24:2016 certified with multi-point locking, internal glazing beads, and laminated safety glass. Secured by Design approved. Complies with Building Regulations Document Q and Document M." 
  },
  { 
    title: "Construction & Longevity", 
    copy: "Solid engineered hardwood core—stable and warp-resistant. Factory-applied microporous paint finish with 10-year guarantee. 30-year warranty against rot (Accoya® 50-year option). Designed to last 60+ years." 
  },
  { 
    title: "Hardware & Ironmongery", 
    copy: "Traditional lever handles, knobs, or contemporary D-pulls in satin brass, antique bronze, chrome, or matt black. All hardware with 10-year mechanical guarantee from trusted UK manufacturers." 
  },
  { 
    title: "Colours & Finishing", 
    copy: "Factory-applied three-coat microporous system. Natural stains, soft neutrals, or bold architectural shades. Farrow & Ball, Little Greene, and RAL ranges available. Dual-colour options available." 
  },
];

const doorsFaqs = [
  {
    q: "Which is better: French doors, bifold, or sliding?",
    a: "French doors: Best for traditional properties and smaller openings (£3,500–£6,000). Bifold: Best for extensions and large openings (£8,000–£15,000). Sliding: Best for contemporary builds with narrow external clearance (£6,500–£12,000). We'll advise during survey.",
  },
  {
    q: "What are typical lead times?",
    a: "Entrance doors: 8–10 weeks. French doors: 10–12 weeks. Bifold/sliding: 10–14 weeks. Fire-rated doors add 1–2 weeks. We'll confirm exact schedule at quotation stage.",
  },
  {
    q: "Can you match existing door styles?",
    a: "Yes. We survey existing doors, photograph details, and measure panel mouldings with laser accuracy. CNC machinery replicates profiles exactly, followed by hand finishing.",
  },
  {
    q: "Do entrance doors meet PAS 24 security?",
    a: "Yes. All entrance doors are PAS 24:2016 certified with multi-point locking, internal glazing beads, laminated safety glass, and Secured by Design approval.",
  },
];

export default function DoorsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className={components.heroSection}>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className={designSystem.typography.caption}>Doors</p>
              <h1 className={designSystem.typography.hero}>
                Timber Entrance
                <br />
                & Garden Doors
              </h1>
              <p className={`${designSystem.typography.body} max-w-xl`}>
                More than a point of entry—your first impression. Combining precision joinery with security, energy efficiency, and the luxurious look of real timber.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link href="/wealden-joinery/contact" className={designSystem.buttons.primary}>
                Get Quote
              </Link>
              <Link href="/wealden-joinery/estimate" className={designSystem.buttons.secondary}>
                AI Estimate
              </Link>
            </div>
          </div>
          <div>
            <ImageSlot
              slotId="doors-hero"
              label="Doors Hero"
              aspectRatio={designSystem.images.portrait}
              size="xl"
            />
          </div>
        </div>
      </section>

      {/* Door Types */}
      <section className={`bg-slate-50 ${components.section}`}>
        <div className="mb-16 space-y-3">
          <p className={designSystem.typography.caption}>Door Types</p>
          <h2 className={designSystem.typography.h2}>
            Entrance, French, sliding, and bi-fold
          </h2>
          <p className={`${designSystem.typography.body} max-w-2xl`}>
            Secure, elegant, and built to last. Every door is crafted to suit the property and perform reliably for decades.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          {doorTypes.map((door, idx) => (
            <div key={door.title} className={`${designSystem.cards.elevated} overflow-hidden`}>
              <ImageSlot
                slotId={`doors-type-${idx}`}
                label={door.title}
                aspectRatio={designSystem.images.landscape}
                overlayPosition="bottom-center"
              />
              <div className="p-6 space-y-4">
                <h3 className={designSystem.typography.h3}>{door.title}</h3>
                <p className={designSystem.typography.bodySmall}>{door.summary}</p>
                <ul className="space-y-2">
                  {door.keyPoints.map((point) => (
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

      {/* Design Guide */}
      <section className={components.section}>
        <div className="mb-16 space-y-3 text-center">
          <p className={designSystem.typography.caption}>Design Guide</p>
          <h2 className={designSystem.typography.h2}>How to Make an Entrance</h2>
        </div>
        <div className={`${designSystem.grid.two} ${designSystem.spacing.cardGap}`}>
          <div className={designSystem.cards.subtle + " p-8 space-y-4"}>
            <h4 className={designSystem.typography.h4}>Complement Your Home</h4>
            <p className={designSystem.typography.bodySmall}>
              Traditional homes often suit classic panelled designs with heritage ironmongery and period details, while modern homes may call for minimalist lines, wide boards, or flush finishes.
            </p>
          </div>
          <div className={designSystem.cards.subtle + " p-8 space-y-4"}>
            <h4 className={designSystem.typography.h4}>Make It Personal With Colour</h4>
            <p className={designSystem.typography.bodySmall}>
              Timber offers the perfect canvas for colour. Whether you opt for a soft heritage shade, dramatic black, or bold red or blue, your choice can instantly elevate kerb appeal.
            </p>
          </div>
        </div>
      </section>

      {/* Door Gallery */}
      <section className={`bg-slate-50 ${components.section}`}>
        <div className="mb-16 text-center space-y-3">
          <p className={designSystem.typography.caption}>Gallery</p>
          <h2 className={designSystem.typography.h2}>Our Timber Doors</h2>
        </div>
        <div className={`${designSystem.grid.four} ${designSystem.spacing.cardGap}`}>
          {["Entrance Door 1", "Entrance Door 2", "French Doors", "Bifold Doors", "Sliding Doors", "Detail Shot 1", "Detail Shot 2", "Detail Shot 3"].map((label, idx) => (
            <ImageSlot
              key={label}
              slotId={`doors-gallery-${idx}`}
              label={label}
              aspectRatio={designSystem.images.portrait}
              size="md"
            />
          ))}
        </div>
      </section>

      {/* Specifications */}
      <section className={components.sectionNarrow}>
        <div className="mb-16 text-center space-y-3">
          <p className={designSystem.typography.caption}>Specifications</p>
          <h2 className={designSystem.typography.h2}>Handles, colours, and security</h2>
        </div>
        <div className="space-y-12">
          {specifications.map((spec) => (
            <div key={spec.title} className="border-b border-slate-100 pb-12 last:border-0 last:pb-0">
              <h3 className={designSystem.typography.h4}>{spec.title}</h3>
              <p className={`${designSystem.typography.bodySmall} mt-3`}>{spec.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className={`bg-slate-50 ${components.sectionNarrow}`}>
        <div className="mb-12 text-center space-y-3">
          <p className={designSystem.typography.caption}>FAQ</p>
          <h2 className={designSystem.typography.h2}>Common questions</h2>
        </div>
        <div className="space-y-8">
          {doorsFaqs.map((item) => (
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
              Ready to start your doors project?
            </h2>
            <p className={`${designSystem.typography.body} max-w-2xl mx-auto text-white/80`}>
              Get an instant estimate or book a consultation to discuss your requirements, security needs, and design options.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/wealden-joinery/estimate" className="border-2 border-white px-10 py-4 text-sm font-medium uppercase tracking-[0.15em] text-white transition hover:bg-white hover:text-slate-900 rounded-full">
              Get Estimate
            </Link>
            <Link href="/wealden-joinery/contact" className="border border-white/20 px-10 py-4 text-sm font-medium uppercase tracking-[0.15em] text-white/70 transition hover:border-white/40 hover:text-white rounded-full">
              Book Consultation
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
