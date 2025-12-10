import Link from 'next/link';
import { WealdenFooter, WealdenNav } from '../wealden-shared';

export default function ChoicesPage({ params }: { params: { slug: string } }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <WealdenNav slug={params.slug} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-12">
        <section className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Design guidance</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">Design Choices & Details</h1>
          <p className="text-lg text-slate-700 leading-relaxed">
            We help you choose finishes, glazing and ironmongery that respect your property&apos;s character while delivering the
            comfort and security you need.
          </p>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <h2 className="text-2xl font-semibold text-slate-900">Colour & finishes</h2>
            <p className="text-slate-700 leading-relaxed">
              Heritage-inspired paint shades or crisp modern tones, factory applied for durability. For oak projects we can oil
              or stain to showcase the grain.
            </p>
            <div className="grid grid-cols-4 gap-3">
              {['bg-green-800', 'bg-amber-700', 'bg-slate-500', 'bg-white border border-slate-200'].map((tone) => (
                <div key={tone} className={`h-12 rounded-lg shadow-inner ${tone}`} />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <h2 className="text-2xl font-semibold text-slate-900">Glazing</h2>
            <p className="text-slate-700 leading-relaxed">
              Toughened or laminated for safety, acoustic glass for quieter homes, and a range of obscure or decorative options
              suitable for bathrooms and doors. We also advise on conservation-friendly glazing.
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              {[
                'Double and triple glazing with warm edge spacers',
                'Acoustic laminates for busy roads or flight paths',
                'Obscure, etched and decorative glass for privacy',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <h3 className="text-xl font-semibold text-slate-900">Hardware & ironmongery</h3>
            <p className="text-slate-700 leading-relaxed">
              Choose from traditional brass and bronze finishes or sleek contemporary handles, hinges, letter plates, knockers and
              stays.
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              {['Classic period hardware suites', 'Multi-point locking handles', 'Sliding and bi-fold hardware with smooth action'].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <h3 className="text-xl font-semibold text-slate-900">Bars & mouldings</h3>
            <p className="text-slate-700 leading-relaxed">
              Glazing bars can be slim and delicate or more pronounced to suit your property. Profiles can be ovolo, chamfered or
              square for the right heritage or contemporary feel.
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              {['Slim putty-line bars for heritage sashes', 'Applied or integral bars depending on glazing needs', 'Ovolo or chamfer details matched to existing joinery'].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <h3 className="text-xl font-semibold text-slate-900">Project guidance</h3>
            <p className="text-slate-700 leading-relaxed">
              We&apos;ll guide you through every decision, provide samples and agree details before we go to manufacture.
            </p>
            <Link
              href={`/tenant/${params.slug}/contact`}
              className="inline-flex items-center justify-center rounded-full bg-green-800 px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-green-900"
            >
              Book a choices consultation
            </Link>
          </div>
        </section>
      </main>

      <WealdenFooter slug={params.slug} />
    </div>
  );
}
