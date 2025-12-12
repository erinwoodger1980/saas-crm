import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "../_components/section-heading";
import { getHeroImage, getImagesByHint } from "../_lib/wealdenAiImages";

export const metadata: Metadata = {
  title: "Timber Entrance & Garden Doors | Wealden Joinery",
  description:
    "Bespoke timber entrance doors, French doors, sliding doors, and bi-folds. Secure cores, premium hardware, and elegant detailing crafted in Sussex.",
};

const heroImg = getHeroImage();
const doorTypeImages = getImagesByHint("range-doors", 8);
const lifestyleImages = getImagesByHint("lifestyle", 8);
const detailImages = getImagesByHint("detail", 6);

const doorTypes = [
  {
    title: "Entrance Doors",
    summary: "A front door is the first impression—and the last line of defence. Every entrance door combines engineered timber strength with PAS 24 security certification, multi-point locking, and decorative glazing that filters light while maintaining privacy.",
    details: [
      "PAS 24:2016 certified—tested to resist forced entry for minimum 3 minutes (lock picking, glass attack, jemmy resistance)",
      "Secured by Design approved (Police-preferred specification)",
      "3-point or 5-point multi-point locking with shootbolts, hooks, and deadlocks",
      "Internal glazing beads (cannot be removed from outside)",
      "44mm solid engineered timber core or optional FD30 fire-rated core for flats/conversions",
      "Laminated safety glass (6.4mm or 8.8mm) for toughened impact protection",
      "Complies with Building Regulations Document Q (security) and Document M (accessibility)",
      "Traditional 4/6-panel, contemporary flush, or modern composite styles with bespoke panel configurations",
      "Decorative glass options: leaded, stained, sandblasted, reeded, or obscure patterns",
      "Matching sidelights, toplights, and decorative fanlights",
      "Hardware: lever handles, knobs, or D-pulls in satin brass, bronze, chrome, or matt black",
      "Dual-colour options: natural stain or white internally, bold external colour (Farrow & Ball, Little Greene, RAL)",
      "30-year timber warranty, 10-year paint/workmanship guarantee, 15-year glazing warranty",
    ],
  },
  {
    title: "French Doors",
    summary: "Traditional elegance for smaller openings. Best for heritage properties, traditional homes, or openings 1.5–2.5m wide. Inward or outward opening with secure multi-point locking.",
    details: [
      "Best for: Traditional properties, smaller openings (1.5–2.5m wide), heritage compliance",
      "Inward or outward opening (conservation areas often require outward for authenticity)",
      "Secure 3-point multi-point locking with hook bolts",
      "Flush or rebated threshold options (Document M compliant low thresholds available)",
      "Traditional astragal glazing bars or contemporary plain glazing",
      "Pair with fixed sidelights to extend opening without operational panels",
      "Thermal performance: U-value 1.0–1.2 W/m²K (double glazed), 0.7 W/m²K (vacuum glazed)",
      "Typical cost: £3,500–£6,000 installed (2.4m wide pair)",
      "Suitable for both traditional and contemporary homes",
      "When to specify: Heritage properties, traditional character required, smaller openings, best value option",
    ],
  },
  {
    title: "Bifold Doors",
    summary: "Maximum flexibility for large openings. Best for extensions, garden rooms, or openings 2.5–6m wide. Panels fold back to create wide clear opening with minimal frame obstruction.",
    details: [
      "Best for: Extensions, garden rooms, large openings (2.5–6m wide), maximizing clear opening",
      "3–7 panels folding left, right, or split configuration",
      "Smooth roller operation with robust stainless steel track",
      "Flush threshold or aluminium step-down track options",
      "Optional traffic door (single door for daily access without folding full set)",
      "Secure multi-point locking and PAS 24 hardware available",
      "Double or vacuum glazing options for thermal performance",
      "Thermal performance: U-value 1.0–1.2 W/m²K (double glazed), 0.7 W/m²K (vacuum glazed)",
      "Typical cost: £8,000–£15,000 installed (4m wide, 5-panel set)",
      "Ideal for extensions and garden rooms connecting indoor/outdoor living",
      "When to specify: Large openings, contemporary aesthetic, maximum flexibility, higher budget available",
    ],
  },
  {
    title: "Sliding Doors (Lift-Slide)",
    summary: "Contemporary clean lines for narrow clearances. Best for modern builds or where external clearance is limited. Large glass panels slide inline (parallel to wall) requiring no external space.",
    details: [
      "Best for: Contemporary builds, narrow external clearance, minimal maintenance",
      "Large glass panels (up to 2.5m x 2.5m per panel) with slim 68mm sightlines",
      "Lift-and-slide mechanism—smooth operation with secure locking when closed",
      "Inline sliding (parallel to wall) requires no external clearance",
      "Flush threshold options for step-free access (Document M compliant)",
      "Thermal performance: U-value 0.9–1.1 W/m²K (double glazed)",
      "PAS 24 security with multi-point locking when closed",
      "Typical cost: £6,500–£12,000 installed (3.5m wide, 2-panel)",
      "Clean contemporary aesthetic with minimal frame",
      "When to specify: Modern architecture, narrow external space, clean lines required, mid-cost option",
    ],
  },
];

const securityPerformance = [
  { 
    title: "Security Testing & Certification", 
    copy: "PAS 24:2016 certified—tested to resist forced entry for minimum 3 minutes including lock picking, glass attack, and jemmy resistance. Secured by Design approved for Police-preferred specification. Multi-point locking (3-point or 5-point) with shootbolts, hooks, and deadlocks. Internal glazing beads cannot be removed from outside. Laminated safety glass (6.4mm or 8.8mm) for impact resistance. Concealed hinges or hinge bolts prevent removal. Complies with Building Regulations Document Q (security) and Document M (accessibility). All hardware tested to 10,000+ operation cycles." 
  },
  { 
    title: "Construction & Longevity", 
    copy: "Solid engineered hardwood core—stable, warp-resistant, dimensionally accurate even in wide door formats. Factory-applied microporous paint finish cured in controlled conditions (10-year guarantee against flaking/peeling/cracking). Fully weather-sealed with compression gaskets and storm-proof threshold options. 30-year warranty against rot and fungal decay (Accoya® 50-year option available). Optional FD30 or FD60 fire-rated cores for flats, conversions, or Building Regulations compliance. Designed to last 60+ years with routine maintenance—repairable, refinishable, renewable." 
  },
  { 
    title: "Handles & Ironmongery", 
    copy: "Traditional lever handles, knobs, or contemporary D-pulls in satin brass, antique bronze, polished chrome, or matt black. Ergonomic designs tested for smooth, reliable operation. Coordinated letterplates, knockers, numerals, and escutcheons. Concealed hinges or decorative strap hinges for cottage/barn conversions. All hardware supplied by trusted UK manufacturers (Securistyle, Maco, Hoppe) with 10-year mechanical guarantee. Key-operated or thumbturn locks for fire escape compliance. The finishing touch—handles, letterplates, and knockers are the jewellery of your front door." 
  },
  { 
    title: "Colours & Finishing Systems", 
    copy: "Factory-applied three-coat microporous system: primer, undercoat, UV-resistant topcoat. Breathable coatings protect timber while allowing moisture to escape. Natural wood stains (oak, walnut, mahogany tones), soft neutrals (white, cream, stone), or bold architectural shades (anthracite grey, slate blue, heritage green). Farrow & Ball, Little Greene, and RAL colour ranges available. Dual-colour options allow clean white or natural stain internally with contrasting external colour. Factory finishing ensures consistent coverage and durability—significantly outlasts site-applied paint. 10-year guarantee against flaking, peeling, or cracking." 
  },
  { 
    title: "Decorative Glazing Options", 
    copy: "Glazing becomes a defining feature. Classic leaded or stained glass for traditional character, sandblasted or reeded patterns for contemporary privacy, obscure textures for light diffusion without compromising security. Acoustic laminated glass reduces noise by up to 42dB for urban locations or busy roads. Toughened safety glass for impact resistance. Low-iron glass for clarity without green tint. Triple or vacuum glazing for maximum thermal performance (U-value 0.7–0.9 W/m²K). All glazing manufactured to BS EN 1279 standards with 15-year sealed unit warranty. Complies with Building Regulations Part L (thermal performance)." 
  },
];

const doorsFaqs = [
  {
    q: "Which is better for my project: French doors, bifold doors, or sliding doors?",
    a: "French doors: Best for traditional properties, smaller openings (1.5–2.5m wide), heritage compliance. Cost: £3,500–£6,000. Bifold doors: Best for extensions, garden rooms, large openings (2.5–6m wide), maximum clear opening. Cost: £8,000–£15,000. Sliding doors: Best for contemporary builds, narrow external clearance, clean lines. Cost: £6,500–£12,000. All three achieve PAS 24 security and similar thermal performance (U-value 0.7–1.2 W/m²K)—choice depends on opening width, architecture style, and budget. We'll advise during survey based on your property and requirements.",
  },
  {
    q: "What are typical lead times for doors?",
    a: "Entrance doors: 8–10 weeks from survey to installation. French doors: 10–12 weeks. Bifold/sliding doors: 10–14 weeks due to larger glass panels, running gear, and more complex weathersealing. Fire-rated doors (FD30/FD60) add 1–2 weeks for certification testing. Lead times may extend during peak season (March–June). We'll confirm exact schedule at quotation stage and send progress photos during manufacture.",
  },
  {
    q: "Can you match existing door styles, panel mouldings, or colours?",
    a: "Yes. We survey existing doors, photograph details, and measure panel mouldings with laser accuracy. CNC machinery replicates profiles exactly, followed by hand finishing for period-correct detailing. We can match any paint colour (Farrow & Ball, Little Greene, RAL, or custom colour matching). We provide physical samples of panel mouldings and paint finishes for approval before manufacture.",
  },
  {
    q: "Do your entrance doors meet PAS 24 security standards?",
    a: "Yes. All entrance doors are PAS 24:2016 certified—tested to resist forced entry for minimum 3 minutes including lock picking, glass attack, and jemmy resistance. Multi-point locking (3-point or 5-point) with shootbolts, hooks, and deadlocks. Internal glazing beads cannot be removed from outside. Laminated safety glass for impact resistance. Secured by Design approved for Police-preferred specification. Complies with Building Regulations Document Q (security for new builds and extensions).",
  },
  {
    q: "Do you handle building control for fire-rated doors?",
    a: "Yes. We specify FD30 (30-minute fire resistance) or FD60 (60-minute) cores with appropriate intumescent seals and self-closing mechanisms. Provide full certification documentation for building control sign-off including fire test certificates and installation instructions. Coordinate with your contractor, architect, or local authority as needed. FD30 typically required for flats, conversions, or new builds; FD60 for commercial or high-rise residential.",
  },
  {
    q: "What guarantees do you offer on doors?",
    a: "30-year timber warranty against rot and fungal decay (Accoya® 50-year option), 10-year workmanship guarantee covering joinery defects and hardware failure, 10-year factory paint finish against flaking/peeling/cracking, 15-year sealed glazing unit warranty against seal failure. All guarantees transferable to new property owners. Fire-rated doors include certification valid for building lifetime. Comprehensive terms provided with every quotation.",
  },
]

export default function DoorsPage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid items-center gap-10 px-6 py-12 md:px-10 md:py-16 lg:grid-cols-2">
          <div className="space-y-6">
            <p className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">Timber Doors</p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
              Timber Entrance & Garden Doors
            </h1>
            <p className="text-lg text-slate-600">
              Handcrafted timber doors that set the tone for your entire home. More than a point of entry—your first impression, your welcome, and a way to express personal style. Combining precision joinery with security, energy efficiency, and the luxurious look and feel of real wood.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/wealden-joinery/contact"
                className="rounded-full bg-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-[1.02] hover:bg-emerald-800"
              >
                Get a Doors Quote
              </Link>
              <Link
                href="/wealden-joinery"
                className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
              >
                Back to Home
              </Link>
            </div>
          </div>

          {heroImg && (
            <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-lg sm:h-80 lg:h-[400px]">
              <Image
                src={heroImg.publicPath}
                alt={heroImg.caption}
                width={heroImg.width}
                height={heroImg.height}
                className="object-cover"
                priority
              />
            </div>
          )}
        </div>
      </section>

      {/* Door Types */}
      <section>
        <SectionHeading
          eyebrow="Door Types"
          title="Entrance, French, sliding, and bi-fold doors."
          copy="Secure, elegant, and built to last. Every door is crafted to suit the property and perform reliably for decades."
        />
        <div className="space-y-6">
          {doorTypes.map((type, idx) => {
            const typeImg = doorTypeImages[idx % doorTypeImages.length];
            return (
              <article
                key={type.title}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
                  {typeImg && (
                    <div className="relative h-64 w-full md:h-auto">
                      <Image
                        src={typeImg.publicPath}
                        alt={typeImg.caption}
                        width={typeImg.width}
                        height={typeImg.height}
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="space-y-5 p-6">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{type.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{type.summary}</p>
                    </div>
                    <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
                      {type.details.map((detail) => (
                        <li key={detail} className="flex gap-2">
                          <span className="text-emerald-700">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* How to Make an Entrance */}
      <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50 p-6 shadow-sm md:p-10">
        <SectionHeading
          eyebrow="Design Guide"
          title="How to Make an Entrance"
          copy="Designing a statement front door that reflects your style and complements your home."
        />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-white bg-white p-6 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-900 mb-3">Choose a Style That Complements Your Home</h4>
            <p className="text-sm leading-relaxed text-slate-700 mb-3">
              Traditional homes often suit classic panelled door designs with heritage ironmongery and period details, while modern or contemporary homes may call for minimalist lines, wide boards, or flush finishes.
            </p>
            <p className="text-sm leading-relaxed text-slate-700">
              For transitional properties blending old and new, look to updated traditional designs with a fresh twist: clean mouldings, bold colour, or a natural wood finish.
            </p>
          </div>
          <div className="rounded-xl border border-white bg-white p-6 shadow-sm">
            <h4 className="text-lg font-semibold text-slate-900 mb-3">Make It Personal With Colour</h4>
            <p className="text-sm leading-relaxed text-slate-700 mb-3">
              Timber offers the perfect canvas for colour. Whether you opt for a soft heritage shade, a dramatic black, or a bold red or blue, your choice can instantly elevate kerb appeal.
            </p>
            <p className="text-sm leading-relaxed text-slate-700">
              You can contrast your door colour with the frame or glazing bars for a bespoke touch. Contrasting a stained door with a painted frame in a bold colour makes the natural wood pop out!
            </p>
          </div>
        </div>
      </section>

      {/* Bifolds vs French Doors */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <SectionHeading
          eyebrow="Choosing the Right Style"
          title="Timber Bifolds or French Doors: Which is right for your home?"
          copy="Both offer charm, warmth and long-lasting performance when made from sustainably sourced timber."
        />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-slate-900">Open Up With Bifolds</h4>
            <p className="text-sm leading-relaxed text-slate-700">
              Timber bifold doors are ideal for larger openings and contemporary living spaces. Individual panels fold back and stack neatly to one or both sides, creating a wide, uninterrupted connection between indoors and out.
            </p>
            <p className="text-sm leading-relaxed text-slate-700">
              If you're designing a kitchen diner or open plan area leading to a patio or garden, bifolds help bring the outside in with maximum impact. Available in configurations from two to six panels with optional traffic door for everyday access.
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex gap-2"><span className="text-emerald-700">✓</span><span>Large openings and flexible layouts</span></li>
              <li className="flex gap-2"><span className="text-emerald-700">✓</span><span>Open plan living and seamless garden access</span></li>
              <li className="flex gap-2"><span className="text-emerald-700">✓</span><span>Maximum impact for modern living</span></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-slate-900">Keep It Classic with French Doors</h4>
            <p className="text-sm leading-relaxed text-slate-700">
              If your project calls for a more traditional or compact solution, French doors are a timeless choice. Featuring two symmetrical doors that open outward or inward, they work beautifully in smaller openings or side returns.
            </p>
            <p className="text-sm leading-relaxed text-slate-700">
              Timber French doors offer excellent thermal performance, especially when paired with high performance glazing. Style with feature bars or panel detailing to complement a Georgian, Edwardian or cottage aesthetic.
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex gap-2"><span className="text-emerald-700">✓</span><span>Classic proportions and compact spaces</span></li>
              <li className="flex gap-2"><span className="text-emerald-700">✓</span><span>Period styling and heritage properties</span></li>
              <li className="flex gap-2"><span className="text-emerald-700">✓</span><span>Timeless elegance and thermal comfort</span></li>
            </ul>
          </div>
        </div>
      </section>

      {/* Security & Performance */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm md:p-10">
        <SectionHeading
          eyebrow="Specifications & Finishes"
          title="Handles, colours, glazing, and security."
          copy="Premium specifications and finishing touches so doors perform securely, quietly, and look beautiful for years."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {securityPerformance.map((option) => (
            <div
              key={option.title}
              className="rounded-xl border border-slate-200 bg-slate-50 p-6"
            >
              <h4 className="text-base font-semibold text-slate-900">{option.title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{option.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Door Gallery */}
      <section>
        <SectionHeading
          title="Our Timber Doors"
          copy="From grand entrance doors to bi-fold garden doors, all crafted for security and style."
        />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {doorTypeImages.map((img) => (
            <div key={img.id} className="relative aspect-[3/4] rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition">
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

      {/* Lifestyle Gallery */}
      <section>
        <SectionHeading
          eyebrow="Recent Installs"
          title="Doors across the South East"
          copy="From heritage townhouses to contemporary new builds, every door is crafted to suit the property."
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

      {/* Detail Gallery */}
      <section>
        <SectionHeading
          title="Craftsmanship Details"
          copy="Premium hardware, elegant mouldings, and refined finishing touches."
        />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          {detailImages.map((img) => (
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

      {/* Doors FAQ */}
      <section>
        <SectionHeading
          eyebrow="FAQ"
          title="Common questions about timber doors."
          copy="Practical advice on specifications, planning, and maintenance."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {doorsFaqs.map((item) => (
            <div key={item.q} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <h4 className="text-base font-semibold text-slate-900">{item.q}</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-emerald-800 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 p-8 shadow-lg md:p-10 text-white">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <h3 className="text-3xl font-semibold">Ready to start your doors project?</h3>
          <p className="text-sm leading-relaxed text-emerald-100">
            Get an instant estimate or book a consultation to discuss your requirements, security needs, and design options.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm font-semibold">
            <Link
              href="/wealden-joinery/estimate"
              className="rounded-full bg-white px-6 py-3 text-emerald-900 transition hover:scale-[1.02] hover:bg-emerald-50"
            >
              Get an Instant Estimate
            </Link>
            <Link
              href="/wealden-joinery/contact"
              className="rounded-full bg-white/10 px-6 py-3 text-white ring-1 ring-white/30 transition hover:scale-[1.02] hover:bg-white/20"
            >
              Book a Consultation
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
