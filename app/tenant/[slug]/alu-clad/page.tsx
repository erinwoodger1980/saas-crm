import Image from 'next/image';
import Link from 'next/link';
import imageMap from '../../../../scripts/wealden-image-map.json';
import { WealdenFooter, WealdenImage, WealdenNav } from '../wealden-shared';

export default function AluCladPage({ params }: { params: { slug: string } }) {
  const images: WealdenImage[] = (imageMap.images as WealdenImage[]) || [];
  const heroImage = images.find((img) => img.localPath.includes('casement')) || images[0];
  const workshopImage = images.find((img) => img.localPath.includes('workshop')) || heroImage;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <WealdenNav slug={params.slug} />

      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-green-50/50 to-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Hybrid performance</p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">Alu-Clad Timber Windows & Doors</h1>
              <p className="text-lg text-slate-700 leading-relaxed">
                Timber warmth inside, aluminium durability outside. Perfect for contemporary architecture and exposed locations
                that need low maintenance.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href={`/tenant/${params.slug}/contact`}
                  className="inline-flex items-center justify-center rounded-full bg-green-800 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-green-800/10 hover:bg-green-900"
                >
                  Discuss an Alu-Clad Project
                </Link>
                <Link
                  href={`/tenant/${params.slug}/estimate`}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-base font-semibold text-slate-800 hover:border-green-700 hover:text-green-800"
                >
                  Get an Instant Estimate
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="relative w-full h-[260px] sm:h-[360px] lg:h-[460px] overflow-hidden rounded-2xl shadow-lg">
                {heroImage && <Image src={heroImage.localPath} alt={heroImage.alt || 'Alu-clad windows'} fill className="object-cover" priority />}
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-18 space-y-8">
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-green-800">What is alu-clad?</p>
              <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900">Best of both materials</h2>
              <p className="text-lg text-slate-700 leading-relaxed">
                Alu-clad joinery combines a timber core with an external aluminium skin. Inside you enjoy the warmth and beauty of
                oak or painted timber; outside, the aluminium shields the frame from weather while offering crisp, modern lines.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 text-sm text-slate-700">
              <div className="text-xl font-semibold text-slate-900">Where alu-clad excels</div>
              <ul className="space-y-2">
                {[
                  'New builds and contemporary extensions needing slim sightlines',
                  'Coastal or exposed sites where extra weather protection is valuable',
                  'Low-maintenance projects wanting fewer repainting cycles',
                  'Large glazed areas where structural stability matters',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-18 grid lg:grid-cols-2 gap-10 items-center">
            <div className="relative h-[320px] sm:h-[380px] rounded-2xl overflow-hidden shadow-lg">
              {workshopImage && <Image src={workshopImage.localPath} alt={workshopImage.alt || 'Workshop fabrication'} fill className="object-cover" />}
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl sm:text-3xl font-semibold text-slate-900">Design flexibility</h3>
              <p className="text-lg text-slate-700 leading-relaxed">
                Dual-colour finishes let you choose a durable external powder coat and a warm internal timber tone. Slim profiles
                support generous glass areas and can be tailored with contemporary or softly rounded detailing.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 text-sm text-slate-700">
                {[
                  'Powder-coated aluminium in a wide RAL palette outdoors',
                  'Timber inside with paint or clear finishes to match interiors',
                  'Compatible with tilt-and-turn, casement and door configurations',
                  'Integrated trickle vents, security glazing and acoustic upgrades',
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-18 space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Compare options</p>
            <h3 className="text-2xl sm:text-3xl font-semibold text-slate-900">Timber vs Alu-Clad vs uPVC</h3>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-4 text-sm font-semibold text-slate-900 bg-slate-50">
              <div className="px-4 py-3">Feature</div>
              <div className="px-4 py-3">Timber</div>
              <div className="px-4 py-3">Alu-Clad</div>
              <div className="px-4 py-3">uPVC</div>
            </div>
            {[
              {
                feature: 'Aesthetics',
                timber: 'Natural grain, heritage detail, painted or stained',
                alu: 'Crisp external lines, warm timber internally',
                upvc: 'Bulkier frames, fewer bespoke options',
              },
              {
                feature: 'Maintenance',
                timber: 'Periodic repainting or oiling as needed',
                alu: 'Minimal upkeep; external powder coat protects',
                upvc: 'Low maintenance but limited refinishing',
              },
              {
                feature: 'Longevity',
                timber: 'Decades with the right detailing and coatings',
                alu: 'Excellent durability even in exposed locations',
                upvc: 'Typically replaced rather than refurbished',
              },
              {
                feature: 'Sustainability',
                timber: 'Renewable material, repairable over time',
                alu: 'Long-lasting, recyclable external cladding',
                upvc: 'Plastic-based with limited refurbishment',
              },
            ].map((row, index) => (
              <div key={row.feature} className={`grid grid-cols-4 text-sm text-slate-700 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                <div className="px-4 py-3 font-semibold text-slate-900">{row.feature}</div>
                <div className="px-4 py-3">{row.timber}</div>
                <div className="px-4 py-3">{row.alu}</div>
                <div className="px-4 py-3">{row.upvc}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-gradient-to-r from-green-50 to-white border-t border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Next steps</p>
                <h3 className="text-2xl sm:text-3xl font-semibold text-slate-900">Explore alu-clad for your project</h3>
                <p className="text-lg text-slate-700 leading-relaxed">
                  Share your plans and we&apos;ll advise where alu-clad makes sense, including detailing for large openings and
                  exposed sites.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href={`/tenant/${params.slug}/projects`}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-base font-semibold text-slate-800 hover:border-green-700 hover:text-green-800"
                >
                  View recent projects
                </Link>
                <Link
                  href={`/tenant/${params.slug}/contact`}
                  className="inline-flex items-center justify-center rounded-full bg-green-800 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-green-900"
                >
                  Talk to Wealden
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <WealdenFooter slug={params.slug} />
    </div>
  );
}
