import Image from 'next/image';
import Link from 'next/link';
import imageMap from '../../../../scripts/wealden-image-map.json';
import { WealdenFooter, WealdenImage, WealdenNav } from '../wealden-shared';

export default function DoorsPage({ params }: { params: { slug: string } }) {
  const images: WealdenImage[] = (imageMap.images as WealdenImage[]) || [];
  const heroImage = images.find((img) => img.localPath.includes('door')) || images[0];
  const frenchImage = images.find((img) => img.localPath.includes('casement')) || heroImage;
  const workshopImage = images.find((img) => img.localPath.includes('workshop')) || heroImage;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <WealdenNav slug={params.slug} />

      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-green-50/50 to-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Entrance & garden doors</p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">Timber Entrance & Garden Doors</h1>
              <p className="text-lg text-slate-700 leading-relaxed">
                Statement front doors with beautiful detailing, plus light-filled, secure back doors that connect your home to the
                garden.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href={`/tenant/${params.slug}/contact`}
                  className="inline-flex items-center justify-center rounded-full bg-green-800 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-green-800/10 hover:bg-green-900"
                >
                  Get a Doors Quote
                </Link>
                <Link
                  href={`/tenant/${params.slug}/estimate`}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-base font-semibold text-slate-800 hover:border-green-700 hover:text-green-800"
                >
                  Try the Instant Estimate
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="relative w-full h-[260px] sm:h-[360px] lg:h-[460px] overflow-hidden rounded-2xl shadow-lg">
                {heroImage && (
                  <Image src={heroImage.localPath} alt={heroImage.alt || 'Timber entrance door'} fill className="object-cover" priority />
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-18 grid lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Entrance doors</p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900">Bespoke entrance door sets</h2>
            <p className="text-lg text-slate-700 leading-relaxed">
              Solid timber and engineered door sets designed for kerb appeal, security and longevity. From traditional four-panel
              designs to modern flush doors, each set is made-to-measure with premium ironmongery and secure cores.
            </p>
            <ul className="space-y-2 text-slate-700 text-sm">
              {[
                'Engineered cores for stability with oak or Accoya® skins',
                'PAS 24 compliant locking options and quality hinges',
                'Fanlights, sidelights and bespoke mouldings to suit your façade',
                'Factory finishing for consistent, durable coatings',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative h-[320px] sm:h-[380px] rounded-2xl overflow-hidden shadow-lg">
            {heroImage && <Image src={heroImage.localPath} alt={heroImage.alt || 'Front door'} fill className="object-cover" />}
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-18 space-y-8">
            <header className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Garden doors</p>
              <h3 className="text-3xl sm:text-4xl font-semibold text-slate-900">French, Sliding & Bi-Fold doors</h3>
              <p className="text-lg text-slate-700 leading-relaxed">
                Open up your living spaces with beautifully detailed doors that glide smoothly, seal tightly and keep your home
                secure.
              </p>
            </header>
            <div className="grid md:grid-cols-3 gap-6">
              {[{ title: 'French Doors', description: 'Classic double doors with slender stiles, multi-point locking and low thresholds for easy access.' }, { title: 'Sliding / Patio Doors', description: 'Effortless operation with stable timber sections, great for wide openings and slim sightlines.' }, { title: 'Bi-Fold Doors', description: 'Smooth folding stacks, weather-sealed tracks and top-quality hardware for long-life performance.' }].map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:-translate-y-1 hover:shadow-lg transition space-y-3"
                >
                  <h4 className="text-xl font-semibold text-slate-900">{item.title}</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 text-sm text-slate-700">
            <div className="text-xl font-semibold text-slate-900">Security & performance</div>
            <ul className="space-y-2">
              {[
                'High-spec multi-point locking, security cylinders and robust hinges',
                'Toughened and laminated glazing for security and acoustic performance',
                'Draught seals, insulated cores and weather bars for reliable weathering',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[heroImage, frenchImage, workshopImage, images.find((img) => img.localPath.includes('sash')) || heroImage]
              .filter(Boolean)
              .map((img, idx) => (
                <div key={idx} className="relative h-40 sm:h-44 rounded-xl overflow-hidden shadow-sm">
                  <Image src={(img as WealdenImage).localPath} alt={(img as WealdenImage).alt || 'Door project'} fill className="object-cover" />
                </div>
              ))}
          </div>
        </section>

        <section className="bg-gradient-to-r from-green-50 to-white border-t border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Next steps</p>
              <h3 className="text-2xl sm:text-3xl font-semibold text-slate-900">Let&apos;s plan your new doors</h3>
              <p className="text-lg text-slate-700 leading-relaxed">
                Share a few details and we&apos;ll propose options for your front, French or sliding doors with clear pricing.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/tenant/${params.slug}/contact`}
                className="inline-flex items-center justify-center rounded-full bg-green-800 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-green-900"
              >
                Contact Wealden
              </Link>
              <Link
                href={`/tenant/${params.slug}/estimate`}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-base font-semibold text-slate-800 hover:border-green-700 hover:text-green-800"
              >
                Launch Estimator
              </Link>
            </div>
          </div>
        </section>
      </main>

      <WealdenFooter slug={params.slug} />
    </div>
  );
}
