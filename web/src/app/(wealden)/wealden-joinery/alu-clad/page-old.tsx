import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "../_components/section-heading";
import { getHeroImage, getImagesByHint } from "../_lib/wealdenAiImages";
import { ImagePlaceholder } from "../_components/image-placeholder";
import { HeroSection } from "../_components/hero-section";

export const metadata: Metadata = {
  title: "Alu-Clad Timber Systems — Low Maintenance, High Performance | Lignum by Wealden Joinery",
  description:
    "Timber warmth inside, maintenance-free aluminium outside. Engineered for contemporary architecture, exposed locations, and long-life performance.",
};

const heroImg = getHeroImage();
const aluImages = getImagesByHint("alu-clad", 2);
const lifestyleImages = getImagesByHint("lifestyle", 3); // Reduced from 6
const detailImages = getImagesByHint("detail", 3); // Reduced from 4

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
  "✓ Coastal exposure—salt spray, high winds, driving rain (aluminium protects timber from moisture cycling)",
  "✓ South-facing elevations—intense UV exposure degrades external paint (aluminium requires no repainting)",
  "✓ Rental or second homes—absentee owners can't maintain 8–10 year external paint cycles",
  "✓ Contemporary architecture—powder-coated RAL colours (anthracite grey, jet black, slate blue) suit modern aesthetics",
  "✓ Large sliding/bi-fold systems—aluminium frame strength handles heavy glass panels without sagging",
  "✓ Budget for 50+ year lifespan—higher initial cost justified by zero external maintenance and long-life performance",
];

const choosePureTimber = [
  "✓ Heritage buildings—conservation officers prefer authentic timber externally",
  "✓ Traditional architecture—natural timber character suits period properties better than powder-coated aluminium",
  "✓ Owner-occupied homes—capable of routine external painting every 8–10 years",
  "✓ Lower initial budget—pure timber costs 20–30% less than alu-clad",
  "✓ Repairable detailing—damaged timber mouldings can be replaced; aluminium cladding must be fully replaced",
];

const comparisonData = [
  {
    system: "Pure Timber",
    pros: ["Heritage character and authenticity", "Natural insulation (no thermal bridging)", "Easy to repair (individual components)", "Lower initial cost (20–30% less)"],
    cons: ["External painting every 8–10 years", "Lifetime maintenance cost ~£600 over 60 years", "Not ideal for extreme coastal exposure"],
    uValue: "1.0–1.2 W/m²K",
    lifespan: "60+ years (well-maintained)",
    cost: "£1,200–£1,800 per window (2.4m x 1.2m casement)",
  },
  {
    system: "Alu-Clad Timber",
    pros: ["Zero external maintenance (no painting)", "Excellent coastal durability", "Timber warmth inside (identical to pure timber)", "80+ year lifespan (no moisture cycling)"],
    cons: ["Higher initial cost (+30% vs pure timber)", "Slight thermal bridging (aluminium conducts heat 1,000x faster)", "Lower repairability (cladding bonded to timber)", "Rarely approved for listed buildings"],
    uValue: "1.1–1.3 W/m²K (0.1–0.2 W/m²K penalty vs pure timber)",
    lifespan: "80+ years (no moisture cycling)",
    cost: "£1,800–£2,600 per window (2.4m x 1.2m casement)",
  },
  {
    system: "uPVC",
    pros: ["Low maintenance", "Cost-effective initially", "Widely available"],
    cons: ["Lacks timber character and warmth", "Limited colour range (white/cream/woodgrain foil)", "Thermal expansion issues (gaps in summer, tightness in winter)", "20–30 year lifespan then landfill", "Not repairable or refinishable"],
    uValue: "1.2–1.4 W/m²K",
    lifespan: "20–30 years (then landfill)",
    cost: "£800–£1,200 per window",
  },
];

export default function AluCladPage() {
  const aluImg = aluImages[0] || heroImg;
  return (
    <div className="space-y-32">
      {/* Hero - Full width, architectural */}
      <section className="relative overflow-hidden">
        {aluImg ? (
          <div className="relative h-[75vh] min-h-[600px] w-full">
            <Image
              src={aluImg.publicPath}
              alt={aluImg.caption}
              width={aluImg.width}
              height={aluImg.height}
              className="object-cover"
              priority
            />
            <div className="image-upload-control absolute top-4 right-4 z-20">
              <ImagePlaceholder label="Alu-Clad Hero" aspectRatio="aspect-[21/9]" imageUrl={aluImg.publicPath} />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/30 to-transparent" />
            <div className="absolute inset-0 flex items-end">
              <div className="w-full px-6 pb-20 md:px-16 md:pb-32">
                <div className="mx-auto max-w-4xl space-y-6 text-white">
                  <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/70">
                    System Products
                  </p>
                  <h1 className="text-5xl font-light leading-[1.05] tracking-tight md:text-7xl lg:text-8xl">
                    Alu-clad timber<br />systems
                  </h1>
                  <p className="max-w-2xl text-lg font-light leading-relaxed text-white/85 md:text-xl">
                    Timber warmth inside, maintenance-free aluminium outside. Engineered for contemporary architecture and exposed locations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="image-upload-control">
            <ImagePlaceholder label="Alu-Clad Hero" aspectRatio="h-[75vh] min-h-[600px]" />
          </div>
        )}
      </section>

      {/* Introduction */}
      <section className="mx-auto max-w-4xl px-6 md:px-8">
        <div className="space-y-8 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500">
            The System
          </p>
          <h2 className="text-4xl font-light leading-tight text-slate-900 md:text-5xl">
            Timber inside.<br />Aluminium outside.
          </h2>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600">
            Factory-bonded aluminium cladding protects timber from weather while preserving natural warmth and character internally. No external painting. No staining cycles. Engineered for longevity.
          </p>
        </div>
      </section>

      {/* System Explanation with Image */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <h3 className="text-3xl font-light text-slate-900">How it works</h3>
            <div className="space-y-4 text-slate-600">
              <p>
                Alu-clad systems combine solid timber frames with powder-coated aluminium cladding. The aluminium is bonded to the timber during manufacture, creating a weather-resistant barrier that eliminates regular external maintenance.
              </p>
              <p>
                Inside, you see and feel timber—natural grain, warmth, traditional detailing. Outside, durable aluminium in any RAL colour protects the timber from rain, UV, and coastal exposure.
              </p>
              <p>
                Ideal for contemporary builds, exposed locations, and projects where low-maintenance performance is essential without sacrificing timber character.
              </p>
            </div>
          </div>
          <div className="image-upload-control">
            <ImagePlaceholder 
              label="System Detail" 
              aspectRatio="aspect-[4/3]"
            />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6 md:px-8">
          <div className="mb-16 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500">Benefits</p>
            <h2 className="mt-4 text-3xl font-light text-slate-900 md:text-4xl">Long-life performance</h2>
          </div>
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="space-y-3">
                <h3 className="text-lg font-medium text-slate-900">{benefit.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{benefit.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Where it Works Best */}
      <section className="mx-auto max-w-4xl px-6 md:px-8">
        <div className="space-y-8">
          <div className="space-y-4 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500">Applications</p>
            <h2 className="text-3xl font-light text-slate-900 md:text-4xl">Where it works best</h2>
          </div>
          <div className="space-y-3 border-l-2 border-slate-200 pl-6">
            {bestFor.map((item) => (
              <p key={item} className="text-slate-600">
                {item}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Design Flexibility with Images */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="mb-16 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500">Design Freedom</p>
          <h2 className="mt-4 text-3xl font-light text-slate-900 md:text-4xl">Contemporary configurations</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            Wide RAL colour range, slim profiles, and structural strength for large glass areas and modern architecture.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-4">
            <div className="image-upload-control">
              <ImagePlaceholder label="Colour Options" aspectRatio="aspect-square" />
            </div>
            <h4 className="text-lg font-medium text-slate-900">Colour Range</h4>
            <p className="text-sm leading-relaxed text-slate-600">
              Any RAL colour for aluminium exterior. Anthracite grey, jet black, slate blue.
            </p>
          </div>
          <div className="space-y-4">
            <div className="image-upload-control">
              <ImagePlaceholder label="Slim Profiles" aspectRatio="aspect-square" />
            </div>
            <h4 className="text-lg font-medium text-slate-900">Slim Profiles</h4>
            <p className="text-sm leading-relaxed text-slate-600">
              Narrow sight lines and large glass areas for maximum daylight.
            </p>
          </div>
          <div className="space-y-4">
            <div className="image-upload-control">
              <ImagePlaceholder label="Large Openings" aspectRatio="aspect-square" />
            </div>
            <h4 className="text-lg font-medium text-slate-900">Large Openings</h4>
            <p className="text-sm leading-relaxed text-slate-600">
              Structural strength supports bi-fold and sliding door systems.
            </p>
          </div>
        </div>
      </section>

      {/* Contemporary Installations */}
      <section className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="mb-16 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500">Installations</p>
          <h2 className="mt-4 text-3xl font-light text-slate-900 md:text-4xl">Contemporary projects</h2>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {lifestyleImages.slice(0, 3).map((img, idx) => (
            <div key={img.id} className="space-y-3">
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-slate-100">
                <Image
                  src={img.publicPath}
                  alt={img.caption}
                  width={img.width}
                  height={img.height}
                  className="object-cover"
                />
                <div className="image-upload-control absolute top-4 right-4 z-10">
                  <ImagePlaceholder 
                    label={`Installation ${idx + 1}`}
                    aspectRatio="aspect-[3/4]"
                    imageUrl={img.publicPath}
                  />
                </div>
              </div>
              <p className="text-sm text-slate-500">{img.caption}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Detail & Finish Quality */}
      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6 md:px-8">
          <div className="mb-16 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500">Precision Details</p>
            <h2 className="mt-4 text-3xl font-light text-slate-900 md:text-4xl">Engineered to last</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {detailImages.slice(0, 3).map((img, idx) => (
              <div key={img.id} className="space-y-4">
                <div className="relative aspect-square overflow-hidden rounded-lg bg-white">
                  <Image
                    src={img.publicPath}
                    alt={img.caption}
                    width={img.width}
                    height={img.height}
                    className="object-cover"
                  />
                  <div className="image-upload-control absolute top-4 right-4 z-10">
                    <ImagePlaceholder 
                      label={`Detail ${idx + 1}`}
                      aspectRatio="aspect-square"
                      imageUrl={img.publicPath}
                    />
                  </div>
                </div>
                <p className="text-center text-sm font-medium text-slate-600">{img.caption}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* When to Choose Alu-Clad vs Pure Timber */}
      <section className="mx-auto max-w-6xl px-6 md:px-8">
        <div className="mb-12 space-y-4 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500">Decision Guide</p>
          <h2 className="text-3xl font-light text-slate-900 md:text-4xl">When to specify alu-clad (vs pure timber)</h2>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4 rounded-xl border-2 border-emerald-700 bg-emerald-50 p-8">
            <h3 className="text-xl font-semibold text-slate-900">Choose Alu-Clad When:</h3>
            <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
              {bestFor.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-4 rounded-xl border-2 border-slate-300 bg-white p-8">
            <h3 className="text-xl font-semibold text-slate-900">Choose Pure Timber When:</h3>
            <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
              {choosePureTimber.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-8 rounded-xl bg-slate-50 p-6 text-center">
          <p className="text-sm font-medium text-slate-900">
            Cost Comparison (Typical 2.4m x 1.2m Casement Window)
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Pure Timber: £1,200–£1,800 installed + £600 lifetime maintenance (60 years) = £1,800–£2,400 total<br />
            Alu-Clad: £1,800–£2,600 installed + £0 lifetime maintenance = £1,800–£2,600 total<br />
            <span className="font-medium text-slate-900">Total cost of ownership: Similar over lifespan</span>
          </p>
        </div>
      </section>

      {/* Comparison Block */}
      <section className="mx-auto max-w-6xl px-6 md:px-8">
        <div className="mb-12 space-y-4 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500">Performance Comparison</p>
          <h2 className="text-3xl font-light text-slate-900 md:text-4xl">System performance data</h2>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600">
            Each system has strengths. Choose based on property type, maintenance requirements, and budget.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 font-medium text-slate-900">System</th>
                <th className="px-6 py-4 font-medium text-slate-900">U-Value</th>
                <th className="px-6 py-4 font-medium text-slate-900">Lifespan</th>
                <th className="px-6 py-4 font-medium text-slate-900">Cost</th>
                <th className="px-6 py-4 font-medium text-slate-900">Key Strengths</th>
                <th className="px-6 py-4 font-medium text-slate-900">Considerations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {comparisonData.map((item) => (
                <tr key={item.system} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{item.system}</td>
                  <td className="px-6 py-4 text-slate-600">{item.uValue}</td>
                  <td className="px-6 py-4 text-slate-600">{item.lifespan}</td>
                  <td className="px-6 py-4 text-slate-600">{item.cost}</td>
                  <td className="px-6 py-4 text-slate-600">
                    <ul className="space-y-1">
                      {item.pros.slice(0, 2).map((pro) => (
                        <li key={pro}>• {pro}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    <ul className="space-y-1">
                      {item.cons.slice(0, 2).map((con) => (
                        <li key={con}>• {con}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-8 rounded-xl bg-amber-50 p-6">
          <h4 className="text-sm font-semibold text-slate-900">Thermal Bridge Note:</h4>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Aluminium conducts heat 1,000x faster than timber. Alu-clad systems have slight thermal bridging at frame edges—typically 0.1–0.2 W/m²K higher U-value than pure timber. For Passivhaus projects, specify thermally broken aluminium cladding or pure timber with external cladding panels to reduce thermal bridge.
          </p>
        </div>
        <div className="mt-6 text-center">
          <p className="text-sm font-medium text-slate-900">
            Recommendation: For most UK homes, pure timber offers best value and heritage compliance. Specify alu-clad for exposed coastal locations, contemporary new builds, or where long-term maintenance is impractical.
          </p>
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
              Discuss your<br />alu-clad project
            </h2>
            <p className="mx-auto max-w-xl text-lg font-light leading-relaxed text-white/75">
              Book a consultation to discuss exposed location requirements, colour options, and long-life specifications.
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
