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
    summary: "You can feel it's a real wood door. Every Lignum entrance door is available in a stunning range of decorative glass options with traditional or designer handles.",
    details: [
      "PAS 24 certified for security",
      "Solid engineered timber construction",
      "Fully sealed and weather-tested",
      "Multi-point locks as standard",
      "Bespoke styles and detailing available",
      "Matching sidelights, toplights and frames",
      "Choose from traditional, contemporary or modern designs",
      "Available in stunning range of decorative glass options",
    ],
  },
  {
    title: "French Doors",
    summary: "Timeless functionality designed for modern life. Ideal for bringing natural light into your living space while maintaining architectural integrity.",
    details: [
      "Inward or outward opening",
      "Secure multi-point locking",
      "High-performance double glazing",
      "Flush or rebated thresholds",
      "Fully finished timber inside and out",
      "Optional glazing bars for traditional or contemporary style",
      "Pair with fixed sidelights or toplights to extend the view",
      "Suitable for both traditional and contemporary homes",
    ],
  },
  {
    title: "Bifold Doors",
    summary: "Flexible living with smooth operation. Designed for modern living, opening up your home to the outdoors with excellent thermal performance.",
    details: [
      "Wide clear openings with minimal frame",
      "Secure multi-point locking and PAS 24 hardware",
      "Smooth operation with robust durability",
      "Double or vacuum glazing options",
      "Thermally efficient and weather-sealed",
      "Ideal for extensions and garden rooms",
      "Bespoke configurations with optional traffic door",
      "Choose track finish, threshold type and ironmongery",
    ],
  },
];

const securityPerformance = [
  { 
    title: "Handles & Ironmongery", 
    copy: "Handles that match the craftsmanship. Easy-to-operate ergonomic designs in satin brass, antique bronze, polished chrome or black finishes. The finishing touch that combines understated elegance with durable functionality. Handles, letterplates, knockers, and hinges are the jewellery of your front door." 
  },
  { 
    title: "Colours & Finishes", 
    copy: "Customized to your décor with rich, durable finishes. Breathable microporous coatings protect timber and enhance grain. Choose from natural wood tones, soft neutrals or bold architectural shades. Dual-colour options allow clean white or natural stain interior with contrasting external colour. 10-year paint finish guarantee." 
  },
  { 
    title: "Decorative Glazing", 
    copy: "Glazing isn't just functional—it becomes a defining feature. From classic leaded or stained glass to sleek sandblasted or reeded styles, filter light, enhance privacy, or introduce decorative motifs. Available in stunning range of options including acoustic glass for noise reduction." 
  },
  { 
    title: "Security & Performance", 
    copy: "PAS 24 certified with secure multi-point locking systems. Fully sealed and weather-tested construction. Toughened or laminated safety glass. Engineered timber with 30-year rot and fungal decay warranty. High-performance glazing for thermal efficiency and comfort." 
  },
];

const doorsFaqs = [
  {
    q: "What are typical lead times for doors?",
    a: "Entrance doors typically take 8–10 weeks from survey to installation. French, sliding, and bi-fold doors may take 10–12 weeks due to larger glass panels and running gear. We'll confirm timelines during survey.",
  },
  {
    q: "Can you match existing door styles or colours?",
    a: "Yes. We survey existing doors, photograph details, and replicate panel mouldings, glazing patterns, and paint colours using our CNC machinery with hand finishing.",
  },
  {
    q: "Do you handle building control for fire-rated doors?",
    a: "Yes. We specify FD30 or FD60 fire-rated cores and provide certification for building control sign-off. We coordinate with your contractor or local authority as needed.",
  },
];

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
