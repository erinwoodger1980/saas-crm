import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "../_components/section-heading";
import { getHeroImage, getImagesByHint } from "../_lib/wealdenAiImages";
import { WindowSection } from "../_components/window-section";
import { ImagePlaceholder } from "../_components/image-placeholder";
import { HeroSection } from "../_components/hero-section";

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
    useCase: "For Georgian, Victorian or Edwardian properties requiring authentic vertical sliding operation with concealed counterweights",
    summary: "Full traditional sash operation with hidden counterweights in box frames. Essential for listed buildings requiring authentic 18th/19th century mechanism.",
    keyPoints: [
      "Hidden counterweights with traditional pulleys and cords visible on opening",
      "75mm slim frames with vacuum glazing (6.15mm thick) for heritage compliance",
      "Traditional horns, staff beads, and decorative glazing bars to conservation officer standards",
      "Draught-sealed meeting rails with concealed weather seals",
      "Hand-finished mouldings and period-correct detailing",
      "Suitable for Grade I, II*, and II listed buildings—approved by most planning authorities",
      "When to specify: Original sash windows in poor condition, full property restoration, conservation area compliance required"
    ],
  },
  {
    title: "Spring Balance Sash Windows",
    category: "Heritage",
    useCase: "Authentic sash appearance with concealed spring mechanisms—ideal where box frames can't fit (extensions, upper floors, tight reveals, or flat conversions)",
    summary: "Classic sash appearance with concealed spiral spring balances instead of counterweights. Identical external appearance to box sash with easier operation and narrower frames.",
    keyPoints: [
      "Slimmer 65mm frame depth (no weight box required—saves 10mm vs box sash)",
      "Smooth spiral spring balance operation—easier than traditional cords, no re-cording needed",
      "Identical external appearance to box sash (horns, glazing bars, profiles match exactly)",
      "Vacuum or slimline double glazing options for heritage compliance",
      "Draught-sealed and weather-tested to BS 6375 standards",
      "Suitable for conservation areas (approved by most planning authorities—not always for Grade I listed)",
      "When to specify: Modern extensions matching period property, upper floor installations, where full box construction isn't feasible"
    ],
  },
];

// Contemporary Windows - Clean lines for modern or transitional architecture
const contemporaryWindows = [
  {
    title: "Flush Casement Windows",
    category: "Contemporary",
    useCase: "For heritage properties requiring discreet replacement or modern extensions with refined detailing",
    summary: "Sashes sit flush with the frame when closed—no projecting mouldings or visible rebate. Contemporary aesthetic for Georgian, Regency, or modern architecture.",
    keyPoints: [
      "Flush finish—sash and frame align perfectly with no visible step (refined, minimal appearance)",
      "58mm slim sightlines with double or vacuum glazing (U-value 0.49–0.9 W/m²K)",
      "Discreet friction stay hinges or traditional butt hinges",
      "PAS 24 security: multi-point locking with shootbolts and concealed keeps",
      "Suitable for conservation areas (approved flush profile maintains period character)",
      "10-year factory paint finish guarantee",
      "When to specify: Listed buildings requiring discreet replacement, Georgian or Regency properties (where flush was original style), modern extensions requiring refined detailing"
    ],
  },
  {
    title: "Storm-Proof Casement Windows",
    category: "Contemporary",
    useCase: "Traditional rebated casements for cottages, Arts & Crafts homes, Victorian villas, or contemporary builds",
    summary: "Rebated profile with sash sitting proud of frame—visible moulding step creates traditional cottage or Victorian character.",
    keyPoints: [
      "Rebated profile—sash sits proud of frame with visible moulding step (more traditional appearance)",
      "68mm frame depth accommodating double or vacuum glazing",
      "Side-hung, top-hung, or fixed configurations",
      "Multi-point espagnolette locking with concealed keeps (PAS 24 certified)",
      "Custom glazing bar patterns—period or contemporary layouts",
      "Decorative ovolo or chamfered mouldings to match existing property details",
      "10-year factory paint finish and hardware guarantee",
      "When to specify: Victorian cottages, Arts & Crafts homes, barn conversions, new builds requiring traditional character, anywhere flush profiles aren't required"
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
  { 
    title: "Timber Selection", 
    copy: "Sustainably sourced FSC® certified timber from responsibly managed forests. European Oak for durability and beautiful grain, Accoya® acetylated softwood with 50-year above-ground rot guarantee, or engineered hardwood cores for stability in large doors and bi-folds. Timber stores approximately 1 tonne of CO₂ per cubic meter—lowest embodied carbon of any window material (60 kgCO₂/m² vs uPVC 120 kgCO₂/m² vs aluminium 180 kgCO₂/m²). Designed to last 60+ years with routine maintenance—repairable, refinishable, and renewable." 
  },
  { 
    title: "Glazing & Vacuum Glass Performance", 
    copy: "Industry-leading vacuum glazing achieves U-values as low as 0.49 W/m²K—more than twice as efficient as standard 1.2 W/m²K double glazing, matching triple glazing performance in a slim 6.15mm profile (vs 44mm triple glazing thickness). Reduces external noise by up to 36dB for quiet, comfortable living—essential for urban locations, flight paths, or busy roads. Critical for conservation areas requiring slim sightlines with modern thermal performance. Standard heritage double glazing achieves 0.9 W/m²K, acoustic laminated glass up to 42dB reduction. All glazing units manufactured to BS EN 1279 standards with 15-year sealed unit warranty. Complies with Building Regulations Part L (thermal performance). Vacuum glazing adds approximately £200–£400 per m² premium over standard double glazing—justified by heritage compliance and superior performance." 
  },
  { 
    title: "Security & Certification", 
    copy: "PAS 24:2016 security certified—tested to resist forced entry for minimum 3 minutes including lock picking, glass attack, and jemmy resistance. Multi-point espagnolette locking with mushroom cam keeps, shootbolts, and internal glazing beads (cannot be removed from outside). Secured by Design approved for Police-preferred specification. Laminated safety glass options for impact resistance. Complies with Building Regulations Document Q (security for new builds and extensions) and Document M (accessibility with easy-grip handles). All hardware tested to 10,000+ operation cycles with 10-year mechanical guarantee." 
  },
  { 
    title: "Paint & Finishing Systems", 
    copy: "Factory-applied microporous paint systems in three-coat process: primer, undercoat, and UV-resistant topcoat. Breathable coatings protect timber while allowing moisture to escape—prevents blistering and delamination. Available in natural wood stains (oak, walnut, mahogany tones), soft neutrals (white, cream, stone), or bold architectural shades (anthracite grey, slate blue, heritage green). Farrow & Ball, Little Greene, and RAL colour ranges available. Dual-colour options allow clean white or natural stain internally with contrasting external colour. Factory finishing ensures consistent coverage and durability. 10-year guarantee against flaking, peeling, or cracking—significantly outlasting site-applied paint." 
  },
  { 
    title: "Hardware & Ironmongery", 
    copy: "Handles that match the craftsmanship. Ergonomic designs tested for 10,000+ operations with smooth, reliable action. Finishes include satin brass, antique bronze, polished chrome, matt black, or brushed stainless steel—coordinated with your chosen paint colours. Concealed friction stay hinges for casements, traditional butt hinges for heritage projects, or stainless steel pivots for heavy sash windows. All hardware supplied by trusted UK manufacturers (Securistyle, Maco, Roto) with 10-year mechanical guarantee. Espagnolette locks with key operation or thumbturn for fire escape compliance." 
  },
];

const windowFaqs = [
  {
    q: "What's the difference between box sash and spring balance sash windows?",
    a: "Box sash uses hidden weights and pulleys (authentic 18th/19th century mechanism with 75mm frame depth). Spring balance uses concealed spiral springs (identical appearance, easier operation, narrower 65mm frames). Both achieve conservation approval\u2014box sash is essential for listed buildings requiring authentic mechanisms; spring balance works for most conservation areas and modern extensions matching period properties.",
  },
  {
    q: "What's the difference between flush and storm-proof casement windows?",
    a: "Flush casements sit level with the frame when closed (refined, minimal\u2014no visible step). Storm-proof casements have a visible moulding step where the sash sits proud of the frame (traditional cottage/Victorian look). Both achieve conservation approval and PAS 24 security\u2014choice depends on property style. Flush suits Georgian/Regency/modern; storm-proof suits Victorian cottages/Arts & Crafts.",
  },
  {
    q: "Is vacuum glazing worth the extra cost for heritage properties?",
    a: "Yes, for listed buildings or conservation areas requiring slim sightlines. Vacuum glazing achieves 0.49 W/m\u00b2K (better than triple glazing) in a 6.15mm profile\u201475% thinner than standard 24mm double glazing. Approved by conservation officers, reduces energy bills by 60\u201370% vs single glazing, and cuts noise by up to 36dB. Premium of \u00a3200\u2013\u00a3400/m\u00b2 justified by heritage compliance and performance. Most conservation projects require it for planning approval.",
  },
  {
    q: "Can you match existing glazing bar patterns or mouldings?",
    a: "Yes. We survey existing windows, photograph details, and measure bar spacings with laser accuracy. CNC machinery replicates profiles exactly, followed by hand finishing for period-correct detailing. We can provide 1:20 scale drawings and physical samples for conservation officer approval before manufacture.",
  },
  {
    q: "What guarantees do you offer and are they transferable?",
    a: "30-year timber warranty against rot and fungal decay (Accoya\u00ae 50-year option), 10-year workmanship guarantee covering joinery defects and hardware failure, 10-year factory paint finish against flaking/peeling/cracking, 15-year sealed glazing unit warranty against seal failure. All guarantees are transferable to new property owners\u2014adds value if you sell. Comprehensive terms provided with every quotation.",
  },
  {
    q: "Do your windows meet Building Regulations and security standards?",
    a: "Yes. All windows comply with Document Q (security), Document L (thermal performance U-values), and Document M (accessibility handles). PAS 24:2016 certified\u2014tested to resist forced entry for minimum 3 minutes. Secured by Design approved for Police-preferred specification. BS 6375 weather-tested for air permeability, watertightness, and wind resistance. We provide U-value certificates and compliance documentation for Building Control submission.",
  },
];

export default function WindowsPage() {
  return (
    <div className="space-y-32">
      {/* Hero - Full width, calm, architectural */}
      <HeroSection heroImg={heroImg} />

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
      <WindowSection
        windows={heritageWindows}
        category="Heritage"
        title="Heritage Windows"
        description="Where authenticity and conservation approval matter. Traditional sash operation with modern thermal performance."
      />

      {/* Contemporary Windows */}
      <WindowSection
        windows={contemporaryWindows}
        category="Contemporary"
        title="Contemporary Windows"
        description="For modern extensions, new builds, or heritage properties requiring subtle detailing."
      />

      {/* System Products */}
      <WindowSection
        windows={systemProducts}
        category="System"
        title="System Products"
        description="Timber warmth inside, aluminium protection outside. For exposed locations or minimal maintenance."
      />

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
