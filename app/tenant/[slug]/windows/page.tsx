import Image from 'next/image';
import Link from 'next/link';
import imageMap from '../../../../scripts/wealden-image-map.json';
import { WealdenFooter, WealdenImage, WealdenNav } from '../wealden-shared';

export default function WindowsPage({ params }: { params: { slug: string } }) {
  const images: WealdenImage[] = (imageMap.images as WealdenImage[]) || [];
  const heroImage = images.find((img) => img.localPath.includes('hero')) || images[0];
  const sashImage = images.find((img) => img.localPath.includes('sash')) || heroImage;
  const casementImage = images.find((img) => img.localPath.includes('casement')) || heroImage;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <WealdenNav slug={params.slug} />

      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-green-50/50 to-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Tailored timber windows</p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">
                Timber Windows for Period & Contemporary Homes
              </h1>
              <p className="text-lg text-slate-700 leading-relaxed">
                Smooth-running sash windows and finely detailed casements, made-to-measure for listed properties, heritage homes
                and modern builds across Sussex and Kent.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="#window-quote"
                  className="inline-flex items-center justify-center rounded-full bg-green-800 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-green-800/10 hover:bg-green-900"
                >
                  Get a Windows Quote
                </Link>
                <Link
                  href={`/tenant/${params.slug}/landing`}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-base font-semibold text-slate-800 hover:border-green-700 hover:text-green-800"
                >
                  Back to Home
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="relative w-full h-[260px] sm:h-[360px] lg:h-[460px] overflow-hidden rounded-2xl shadow-lg">
                {heroImage && (
                  <Image
                    src={heroImage.localPath}
                    alt={heroImage.alt || 'Wealden Joinery timber windows'}
                    fill
                    className="object-cover"
                    priority
                  />
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-18 space-y-8">
          <header className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Window types</p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900">Sash and casement windows, built to last</h2>
            <p className="text-lg text-slate-700 leading-relaxed">
              Traditional proportions with modern performance. Wealden Joinery crafts each sash and casement window to match the
              character of your property while delivering excellent thermal and acoustic comfort.
            </p>
          </header>
          <div className="grid md:grid-cols-2 gap-6">
            <article className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:-translate-y-1 hover:shadow-lg transition">
              <div className="relative h-64">
                {sashImage && (
                  <Image src={sashImage.localPath} alt={sashImage.alt || 'Sash windows'} fill className="object-cover" />
                )}
              </div>
              <div className="p-6 space-y-3">
                <h3 className="text-xl font-semibold text-slate-900">Sash Windows</h3>
                <p className="text-slate-700 leading-relaxed">
                  Smooth-running cords or spring balances, fine glazing bars and slim meeting rails maintain authentic heritage
                  proportions. Perfect for Georgian, Victorian and Regency homes, with thoughtful detailing for listed buildings.
                </p>
                <ul className="space-y-2 text-slate-700 text-sm">
                  {[
                    'Make-to-match mouldings, horns and sash profiles',
                    'Slim glazing bars and putty-line aesthetics',
                    'Balanced for easy operation and long-term reliability',
                    'Draft sealing and high-performance glazing for comfort',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:-translate-y-1 hover:shadow-lg transition">
              <div className="relative h-64">
                {casementImage && (
                  <Image src={casementImage.localPath} alt={casementImage.alt || 'Casement windows'} fill className="object-cover" />
                )}
              </div>
              <div className="p-6 space-y-3">
                <h3 className="text-xl font-semibold text-slate-900">Casement Windows</h3>
                <p className="text-slate-700 leading-relaxed">
                  Flush and storm-proof casements combine refined timber sections with secure, modern hardware. Ideal for cottages
                  and contemporary homes seeking character with excellent performance.
                </p>
                <ul className="space-y-2 text-slate-700 text-sm">
                  {[
                    'Multi-point locking and friction stays for security',
                    'Storm-proof or flush fit for the right aesthetic',
                    'Option for traditional peg stays and espagnolette handles',
                    'Factory-finished coatings for durability and low maintenance',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-18 grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-4">
              <h3 className="text-2xl sm:text-3xl font-semibold text-slate-900">Performance & options</h3>
              <p className="text-lg text-slate-700 leading-relaxed">
                Choose the timber, glazing and finishing details that suit your project. We guide you through the options so you
                get the look you want with the comfort you need.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 text-sm text-slate-700">
                {[
                  'Timber choices: European Oak and Accoya® for stability and longevity',
                  'Glazing: double or triple glazed, with acoustic and conservation-friendly options',
                  'Finishes: factory paint or stain, including heritage colour palettes',
                  'Hardware: classic sash lifts, fasteners, casement handles and secure locking',
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="relative h-[320px] sm:h-[380px] rounded-2xl overflow-hidden shadow-lg">
              {casementImage && (
                <Image src={casementImage.localPath} alt={casementImage.alt || 'Timber windows options'} fill className="object-cover" />
              )}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-18 space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-green-800">FAQs</p>
            <h3 className="text-2xl sm:text-3xl font-semibold text-slate-900">Common questions about window projects</h3>
          </div>
          <div className="space-y-4">
            {[
              {
                question: 'Can you match my existing sash windows for a listed property?',
                answer:
                  'Yes. We regularly produce make-to-match sash and casement windows for listed buildings, including slim glazing bars, horns and mouldings that replicate the originals.',
              },
              {
                question: 'Do you install as well as manufacture?',
                answer:
                  'We offer both supply-only and full installation. Our fitting teams are experienced in heritage properties and take great care when working in occupied homes.',
              },
              {
                question: 'What glazing options are available for noise reduction?',
                answer:
                  'We can supply acoustic laminated glazing, specialist spacer bars and draft sealing to improve comfort and reduce outside noise without compromising appearance.',
              },
            ].map((item, index) => (
              <details key={item.question} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" open={index === 0}>
                <summary className="text-lg font-semibold text-slate-900 cursor-pointer">{item.question}</summary>
                <p className="mt-3 text-sm text-slate-700 leading-relaxed">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section
          id="window-quote"
          className="bg-gradient-to-r from-green-50 to-white border-t border-b border-slate-200"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 grid lg:grid-cols-3 gap-8 items-center">
            <div className="lg:col-span-2 space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Start your window project</p>
              <h3 className="text-2xl sm:text-3xl font-semibold text-slate-900">Ready for expert advice?</h3>
              <p className="text-lg text-slate-700 leading-relaxed">
                Tell us about your windows and we&apos;ll share indicative pricing, glazing advice and heritage-friendly details. No
                hard sell – just straightforward guidance.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href={`/tenant/${params.slug}/estimate`}
                  className="inline-flex items-center justify-center rounded-full bg-green-800 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-green-900"
                >
                  Try the Instant Estimator
                </Link>
                <Link
                  href={`/tenant/${params.slug}/contact`}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-base font-semibold text-slate-800 hover:border-green-700 hover:text-green-800"
                >
                  Speak to the team
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Project checklist</div>
              <ul className="space-y-2">
                {[
                  'Upload photos or measurements to speed up pricing',
                  'We advise on glazing bars, horns, and mouldings',
                  'Installation available across East Sussex and Kent',
                  'Work carried out by City & Guilds trained joiners',
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
      </main>

      <WealdenFooter slug={params.slug} />
    </div>
  );
}
