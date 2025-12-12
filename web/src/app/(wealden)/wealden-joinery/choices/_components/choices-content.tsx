"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImagePlaceholder } from "../../_components/image-placeholder";

interface ChoicesContentProps {
  detailImages: Array<{
    id: string;
    publicPath: string;
    caption: string;
    width: number;
    height: number;
  }>;
}

export function ChoicesContent({ detailImages }: ChoicesContentProps) {
  const [activeSection, setActiveSection] = useState("colours");

  useEffect(() => {
    const handleScroll = () => {
      const sections = ["colours", "glazing", "hardware", "bars", "consultation"];
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 150 && rect.bottom >= 150) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 120;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  const navItems = [
    { id: "colours", label: "Colours & Finishes" },
    { id: "glazing", label: "Glazing Options" },
    { id: "hardware", label: "Hardware & Ironmongery" },
    { id: "bars", label: "Bars & Mouldings" },
    { id: "consultation", label: "Book a Consultation" },
  ];

  const colourCategories = [
    {
      name: "Heritage",
      description: "Classic period colours for conservation areas and listed buildings",
      examples: "Railings, Off-Black, Cornforth White, String, Cord",
      brands: "Farrow & Ball, Little Greene",
      swatches: ["#2f3230", "#1c1d21", "#e6dfd0", "#d7cdb0", "#b09877"],
    },
    {
      name: "Contemporary",
      description: "Clean, modern neutrals for new builds and renovations",
      examples: "Pure White, Wimborne White, Mizzle, Down Pipe, RAL 7016",
      brands: "RAL Classic, NCS",
      swatches: ["#ffffff", "#f9f6f2", "#c6c8c0", "#3c3d42", "#383e42"],
    },
    {
      name: "Bespoke",
      description: "Match any colour sample—bring us a swatch and we'll replicate it",
      examples: "RAL, NCS, custom paint matches, manufacturer samples",
      brands: "All systems supported",
      swatches: ["#8b7355", "#4a6670", "#7c8e7e", "#9d8b76", "#5d5d5d"],
    },
    {
      name: "Natural Timber",
      description: "Micro-porous stains and oils that enhance the wood grain",
      examples: "Oak, Teak, Cedar, Walnut, Natural, Ebony tones",
      brands: "Osmo, Sikkens, Teknos",
      swatches: ["#daa520", "#b8733c", "#c19a6b", "#8b6f47", "#4a3728"],
    },
    {
      name: "Dual-Colour",
      description: "Different colours inside and out for maximum design flexibility",
      examples: "Heritage green exterior / White interior, Anthracite/Oak",
      brands: "All colour combinations",
      swatches: ["#2f5233", "#ffffff", "#383e42", "#daa520", "#1c1d21"],
    },
  ];

  const glazingOptions = [
    {
      name: "Heritage Slimline Double",
      bestFor: "Period properties, conservation areas, listed buildings",
      specs: "U-value 1.2–1.4 W/m²K • 14-18mm units • Warm-edge spacers",
      description: "Slim units that replicate historic sight lines without modern bulk",
    },
    {
      name: "Triple Glazing",
      bestFor: "New builds, Passivhaus, exposed coastal/rural locations",
      specs: "U-value 0.7–0.8 W/m²K • 36-44mm units • Argon-filled",
      description: "Maximum thermal and acoustic performance for contemporary projects",
    },
    {
      name: "Acoustic Laminated",
      bestFor: "Urban properties, flight paths, busy roads, coastal wind noise",
      specs: "Rw up to 40dB reduction • Laminated inner panes • 6.4mm+ interlayer",
      description: "Reduce traffic, aircraft, and environmental noise significantly",
    },
    {
      name: "Leaded & Decorative",
      bestFor: "Listed buildings, period authenticity, privacy glazing",
      specs: "Authentic lead came • Hand-blown crown glass • Obscured patterns",
      description: "Traditional leaded lights and heritage glass options",
    },
  ];

  const hardwareCategories = [
    {
      name: "Ironmongery Finishes",
      options: ["Polished Chrome", "Brushed Nickel", "Aged Brass", "Black Iron", "Antique Bronze", "Satin Stainless"],
      note: "All handles, hinges, and locks colour-matched",
    },
    {
      name: "Heritage Fittings",
      options: ["Sash Lifts", "Monkey-Tail Bolts", "Georgian Thumb-Turns", "Period Latches", "Claw Fasteners", "Casement Stays"],
      note: "Sourced from specialist foundries",
    },
    {
      name: "Contemporary Hardware",
      options: ["Concealed Multi-Point", "Flush Espagnolette", "Minimal Handles", "Hidden Hinges", "Tilt-First Systems"],
      note: "Clean lines for modern schemes",
    },
    {
      name: "Security Upgrades",
      options: ["Secured by Design", "Yale Cylinders", "Sash Restrictors", "Key-Locking Handles", "Laminated Glass", "Hinge Bolts"],
      note: "Insurance-compliant options",
    },
  ];

  const barsAndMouldings = [
    {
      name: "Georgian Bars",
      description: "Classic six-over-six or eight-over-eight patterns",
      type: "Traditional",
    },
    {
      name: "Victorian Glazing Bars",
      description: "Two-over-two horns with slim top sash",
      type: "Traditional",
    },
    {
      name: "Margin Lights",
      description: "Side and toplight frames around entrance doors",
      type: "Traditional",
    },
    {
      name: "Astragal Bars",
      description: "External snap-in bars for easy cleaning",
      type: "Practical",
    },
    {
      name: "Integral Bars",
      description: "Between glass panes for authentic shadow lines",
      type: "Heritage",
    },
    {
      name: "Curved & Arched",
      description: "Bespoke shapes for period toplights",
      type: "Bespoke",
    },
    {
      name: "Architraves",
      description: "Internal trim to suit skirting styles",
      type: "Finishing",
    },
    {
      name: "Ovolo Mouldings",
      description: "Traditional curved profiles for sash windows",
      type: "Heritage",
    },
  ];

  return (
    <>
      {/* Sticky Navigation */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-6 py-4 text-xs font-medium md:gap-2 md:text-sm">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 transition ${
                activeSection === item.id
                  ? "bg-emerald-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-32">
        {/* Hero */}
        <section className="space-y-8 pt-12">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Design Specification</p>
            <h1 className="text-5xl font-light leading-tight tracking-tight text-slate-900 md:text-7xl">
              Infinite Design Possibilities
            </h1>
            <p className="text-lg font-light leading-relaxed text-slate-600">
              From heritage colours to contemporary hardware, every detail is yours to choose. This is your comprehensive
              specification guide.
            </p>
          </div>
        </section>

        {/* Colours & Finishes */}
        <section id="colours" className="scroll-mt-32">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Colours & Finishes</p>
            <h2 className="text-4xl font-light tracking-tight text-slate-900 md:text-5xl">
              Match your property's character
            </h2>
            <p className="text-base font-light leading-relaxed text-slate-600">
              Choose from heritage palettes, contemporary neutrals, or bespoke colour matching. We work with Farrow & Ball,
              Little Greene, and all RAL/NCS codes.
            </p>
          </div>

          {/* Decision Helper */}
          <div className="mx-auto mt-8 max-w-2xl rounded-xl border-l-4 border-emerald-700 bg-emerald-50 p-6">
            <p className="text-sm font-semibold text-emerald-900">If you're in a conservation area…</p>
            <p className="mt-2 text-sm leading-relaxed text-emerald-800">
              Heritage colours like Farrow & Ball's Railings or Little Greene's Invisible Green are often pre-approved. We can
              advise on local authority preferences.
            </p>
          </div>

          {/* Colour Categories */}
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {colourCategories.map((category, idx) => (
              <article key={category.name} className="image-slot space-y-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-slate-900">{category.name}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{category.description}</p>
                </div>

                {/* Colour Swatches */}
                <div className="flex gap-2">
                  {category.swatches.map((color, colorIdx) => (
                    <div
                      key={colorIdx}
                      className="h-12 w-12 rounded-lg border border-slate-300 shadow-sm"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>

                <div className="space-y-1 border-t border-slate-100 pt-4 text-xs">
                  <p className="font-semibold text-slate-900">Examples: {category.examples}</p>
                  <p className="text-slate-500">{category.brands}</p>
                </div>

                {/* Upload placeholder for finish photo */}
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
                  {detailImages[idx] ? (
                    <>
                      <Image
                        src={detailImages[idx].publicPath}
                        alt={`${category.name} finish example`}
                        fill
                        className="object-cover"
                      />
                      <div className="image-upload-control absolute top-4 right-4 z-10">
                        <ImagePlaceholder
                          label={`${category.name} Finish`}
                          aspectRatio="aspect-[4/3]"
                          imageUrl={detailImages[idx].publicPath}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <div className="image-upload-control">
                        <ImagePlaceholder label={`${category.name} Finish`} aspectRatio="aspect-[4/3]" />
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>

          {/* Large lifestyle finish image */}
          <div className="image-slot mt-12">
            <div className="relative aspect-[21/9] overflow-hidden rounded-2xl bg-slate-100">
              <div className="flex h-full items-center justify-center">
                <div className="image-upload-control">
                  <ImagePlaceholder label="Colour & Finish Lifestyle" aspectRatio="aspect-[21/9]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Glazing Options */}
        <section id="glazing" className="scroll-mt-32">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Glazing Options</p>
            <h2 className="text-4xl font-light tracking-tight text-slate-900 md:text-5xl">
              Performance meets aesthetics
            </h2>
            <p className="text-base font-light leading-relaxed text-slate-600">
              From heritage slimline units to high-performance triple glazing, we specify glass to suit your property, budget,
              and location.
            </p>
          </div>

          {/* Decision Helper */}
          <div className="mx-auto mt-8 max-w-2xl rounded-xl border-l-4 border-emerald-700 bg-emerald-50 p-6">
            <p className="text-sm font-semibold text-emerald-900">If you're coastal or exposed…</p>
            <p className="mt-2 text-sm leading-relaxed text-emerald-800">
              Consider acoustic laminated glass to reduce wind noise, and marine-grade hardware for salt-air protection. Triple
              glazing offers maximum wind resistance.
            </p>
          </div>

          {/* Glazing Cards */}
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {glazingOptions.map((option, idx) => (
              <article key={option.name} className="image-slot space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-slate-900">{option.name}</h3>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Best for</p>
                  <p className="text-sm leading-relaxed text-slate-600">{option.bestFor}</p>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="text-xs font-mono text-slate-700">{option.specs}</p>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">{option.description}</p>
                </div>

                {/* Detail image placeholder */}
                <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                  <div className="flex h-full items-center justify-center">
                    <div className="image-upload-control">
                      <ImagePlaceholder label={`${option.name} Detail`} aspectRatio="aspect-square" />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Hardware & Ironmongery */}
        <section id="hardware" className="scroll-mt-32">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hardware & Ironmongery</p>
            <h2 className="text-4xl font-light tracking-tight text-slate-900 md:text-5xl">The details that matter</h2>
            <p className="text-base font-light leading-relaxed text-slate-600">
              Choose from heritage brass fittings to sleek contemporary locks. All hardware can be colour-matched to your chosen
              finish.
            </p>
          </div>

          {/* Decision Helper */}
          <div className="mx-auto mt-8 max-w-2xl rounded-xl border-l-4 border-emerald-700 bg-emerald-50 p-6">
            <p className="text-sm font-semibold text-emerald-900">If you want maximum thermal performance…</p>
            <p className="mt-2 text-sm leading-relaxed text-emerald-800">
              Specify concealed multi-point locks and compression seals. Triple glazing with warm-edge spacers delivers U-values
              below 0.8 W/m²K.
            </p>
          </div>

          {/* Hero Hardware Images */}
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="image-slot">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
                <div className="flex h-full items-center justify-center">
                  <div className="image-upload-control">
                    <ImagePlaceholder label="Handle Close-Up" aspectRatio="aspect-[4/3]" />
                  </div>
                </div>
              </div>
            </div>
            <div className="image-slot">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
                <div className="flex h-full items-center justify-center">
                  <div className="image-upload-control">
                    <ImagePlaceholder label="Hinge & Lock Detail" aspectRatio="aspect-[4/3]" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hardware Categories Grid */}
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {hardwareCategories.map((category) => (
              <article key={category.name} className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="space-y-4">
                  <div className="space-y-2 border-b border-slate-100 pb-4">
                    <h3 className="text-xl font-semibold text-slate-900">{category.name}</h3>
                    <p className="text-xs italic text-emerald-700">{category.note}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {category.options.map((option) => (
                      <div key={option} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        {option}
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Ironmongery Finish Swatches */}
          <div className="image-slot mt-12">
            <div className="rounded-xl border border-slate-200 bg-white p-8">
              <h3 className="mb-6 text-xl font-semibold text-slate-900">Ironmongery Finish Samples</h3>
              <div className="grid gap-6 md:grid-cols-3">
                {["Polished Chrome", "Aged Brass", "Black Iron"].map((finish) => (
                  <div key={finish} className="image-slot space-y-3">
                    <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                      <div className="flex h-full items-center justify-center">
                        <div className="image-upload-control">
                          <ImagePlaceholder label={`${finish} Sample`} aspectRatio="aspect-square" />
                        </div>
                      </div>
                    </div>
                    <p className="text-center text-sm font-medium text-slate-700">{finish}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Bars & Mouldings */}
        <section id="bars" className="scroll-mt-32">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bars & Mouldings</p>
            <h2 className="text-4xl font-light tracking-tight text-slate-900 md:text-5xl">Architectural detailing</h2>
            <p className="text-base font-light leading-relaxed text-slate-600">
              Glazing bar patterns, astragals, margin lights, and internal trim—crafted to suit your property's period and
              style.
            </p>
          </div>

          {/* Bars & Mouldings Visual Grid */}
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {barsAndMouldings.map((item) => (
              <article key={item.name} className="image-slot space-y-4 rounded-xl border border-slate-200 bg-white p-6">
                {/* Diagram/Photo placeholder */}
                <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
                  <div className="flex h-full items-center justify-center">
                    <div className="image-upload-control">
                      <ImagePlaceholder label={`${item.name} Diagram`} aspectRatio="aspect-square" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">{item.name}</h3>
                  <p className="text-xs text-slate-600">{item.description}</p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{item.type}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section id="consultation" className="scroll-mt-32 rounded-2xl bg-slate-900 px-8 py-16 text-white md:px-12 md:py-20">
          <div className="mx-auto max-w-3xl space-y-8 text-center">
            <div className="space-y-4">
              <h2 className="text-4xl font-light tracking-tight md:text-5xl">Ready to discuss your project?</h2>
              <p className="text-base font-light leading-relaxed text-slate-300">
                Book a design consultation to explore samples, finishes, and options. We'll help you select the perfect
                specification for your property.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/wealden-joinery/contact"
                className="rounded-full bg-white px-8 py-4 text-sm font-semibold text-slate-900 transition hover:scale-[1.02] hover:bg-slate-100"
              >
                Book a Design Consultation
              </Link>
              <Link
                href="/wealden-joinery/estimate"
                className="rounded-full border-2 border-white/30 bg-white/10 px-8 py-4 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-white/20"
              >
                Request Samples
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
