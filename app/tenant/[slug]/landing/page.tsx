import Image from 'next/image';
import Link from 'next/link';
import imageMap from '../../../../scripts/wealden-image-map.json';

type WealdenImage = {
  originalUrl: string;
  localPath: string;
  alt: string;
  page?: string;
};

const navItems = [
  { label: 'Windows', href: '#windows' },
  { label: 'Doors', href: '#doors' },
  { label: 'Heritage & Listed', href: '#heritage' },
  { label: 'Trade', href: '#trade' },
  { label: 'Gallery', href: '#projects' },
];

export default function LandingPage({ params }: { params: { slug: string } }) {
  const tenant = {
    id: params.slug,
    name: 'Wealden Joinery',
    phone: '01892 852544',
  };

  const images: WealdenImage[] = (imageMap.images as WealdenImage[]) || [];
  const usedImages = new Set<string>();

  const getRemainingImages = (count: number) => {
    const available = images.filter((img) => !usedImages.has(img.localPath));
    const selection = available.slice(0, count);
    selection.forEach((img) => usedImages.add(img.localPath));
    return selection;
  };

  const getFirstMatchingImage = (keyword: string) => {
    const lower = keyword.toLowerCase();
    const found = images.find(
      (img) =>
        !usedImages.has(img.localPath) &&
        ((img.alt && img.alt.toLowerCase().includes(lower)) || img.localPath.toLowerCase().includes(lower)),
    );

    if (found) {
      usedImages.add(found.localPath);
      return found;
    }

    return getRemainingImages(1)[0];
  };

  const heroImage = getFirstMatchingImage('hero');
  const frontDoorImage = getFirstMatchingImage('door');
  const sashImage = getFirstMatchingImage('sash');
  const casementImage = getFirstMatchingImage('casement');
  const genericImages = getRemainingImages(3);
  const projectImages = [frontDoorImage, sashImage, casementImage, ...getRemainingImages(3)]
    .filter(Boolean)
    .slice(0, 3) as WealdenImage[];
  const materialsImage =
    getFirstMatchingImage('joinery') || getFirstMatchingImage('oak') || projectImages[0] || genericImages[0];
  const projectContent = [
    { title: 'Tunbridge Wells – Oak Sash Windows' },
    { title: 'Mayfield – Accoya Front Door' },
    { title: 'Crowborough – Cottage Casement Windows' },
  ];
  const displayProjectImages = (projectImages.length ? projectImages : genericImages).slice(0, 3);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur lg:sticky lg:top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="text-2xl font-semibold tracking-tight text-slate-900">{tenant.name}</div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-700">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href} className="hover:text-green-800 transition-colors">
                {item.label}
              </Link>
            ))}
            <Link
              href="#quote"
              className="inline-flex items-center rounded-full bg-green-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-900 transition-colors"
            >
              Get a Quote
            </Link>
          </div>
          <details className="md:hidden relative group">
            <summary className="list-none cursor-pointer rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="block w-5 h-0.5 bg-slate-900" />
              <span className="block w-5 h-0.5 bg-slate-900" />
              <span className="block w-5 h-0.5 bg-slate-900" />
            </summary>
            <div className="absolute right-0 mt-3 w-56 rounded-lg border border-slate-200 bg-white shadow-lg p-4 flex flex-col gap-3 z-20">
              {navItems.map((item) => (
                <Link key={item.label} href={item.href} className="text-sm font-medium text-slate-800 hover:text-green-800">
                  {item.label}
                </Link>
              ))}
              <Link
                href="#quote"
                className="inline-flex items-center justify-center rounded-full bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-900"
              >
                Get a Quote
              </Link>
            </div>
          </details>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-gradient-to-b from-green-50/50 to-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 lg:pt-16 lg:pb-20 grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <div className="text-sm font-semibold uppercase tracking-wide text-green-800">Handcrafted timber windows & doors</div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-slate-900 leading-tight">
                Wealden Joinery – Timber Windows & Doors for Sussex & Kent
              </h1>
              <p className="text-lg text-slate-700 leading-relaxed">
                Beautiful, made-to-measure oak and Accoya® windows and doors, crafted in our Rotherfield workshop and installed in homes across East Sussex and Kent.
              </p>
              <ul className="space-y-2 text-slate-700">
                {[
                  'Period-correct designs for heritage and listed buildings',
                  'High-performance glazing for warmth, comfort and quiet',
                  'Expert installation team who treat your home with care',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="#quote"
                  className="inline-flex items-center justify-center rounded-full bg-green-800 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-green-800/10 hover:bg-green-900"
                >
                  Get My Free Quote
                </Link>
                <Link
                  href={`tel:${tenant.phone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-base font-semibold text-slate-800 hover:border-green-700 hover:text-green-800"
                >
                  Call {tenant.phone}
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="relative w-full h-[260px] sm:h-[360px] lg:h-[480px] overflow-hidden rounded-2xl shadow-lg">
                {heroImage && (
                  <Image
                    src={heroImage.localPath}
                    alt={heroImage.alt || 'Wealden Joinery timber windows and doors'}
                    fill
                    className="object-cover"
                    priority
                  />
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-slate-200 bg-white/70 backdrop-blur">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-slate-700">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-6">
                <span>5.0 rating from local customers</span>
                <span className="hidden sm:inline-block">•</span>
                <span>Serving East Sussex & Kent</span>
              </div>
              <div className="flex items-center gap-4">
                {["FENSA", "PAS 24", "Accoya"].map((label) => (
                  <div
                    key={label}
                    className="h-10 w-20 rounded-md border border-slate-200 bg-white flex items-center justify-center text-xs font-semibold text-slate-600"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20 space-y-4">
          <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900">High-quality joinery from our Rotherfield workshop</h2>
          <div className="space-y-4 text-lg text-slate-700 leading-relaxed">
            <p>
              Since 1994, Wealden Joinery has been designing, making and fitting fine quality timber windows and doors for homes across the South East. All of our joinery is made-to-measure in our Rotherfield workshop by City & Guilds qualified craftsmen, using high-grade European oak, Accoya® and carefully selected timbers.
            </p>
            <p>
              Whether you’re restoring a Victorian townhouse, updating a country cottage, or building something new, we’ll help you choose designs that feel right for your property – and perform beautifully for decades.
            </p>
          </div>
        </section>

        <section className="bg-slate-50 py-14 lg:py-18" id="windows">
          <div id="doors" className="sr-only" aria-hidden />
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: 'Timber Windows',
                  description:
                    'Sash, casement and shaped windows made to match your home’s period and details – from slim glazing bars to traditional horns and arches.',
                },
                {
                  title: 'Timber Doors',
                  description:
                    'Front doors, French doors and patio doors that make a statement, with secure locking and beautiful ironmongery.',
                },
                {
                  title: 'Heritage & Listed',
                  description:
                    'Specialists in make-to-match and listed building work, with thoughtful glazing advice for conservation areas and heritage properties.',
                },
                {
                  title: 'Trade & Developers',
                  description:
                    'Reliable supply of high-quality timber windows and doors for contractors and developers, with realistic lead times and clear communication.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:-translate-y-1 hover:shadow-md transition">
                  <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-sm text-slate-700 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20 space-y-8" id="heritage">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900">Trusted by homeowners and builders across the South East</h2>
            <Link
              href="#projects"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-800 hover:border-green-700 hover:text-green-800"
            >
              View Recent Projects
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote:
                  'I have been using Wealden Joinery since we started in 2007. The quality has always been high and the joinery has always been on time – even on the tightest deadlines.',
                name: 'Tony Palmer',
                role: 'Harlequin Building Company, East Sussex',
              },
              {
                quote:
                  'Excellent craftsmanship and attention to detail. Our oak windows are beautiful and were installed perfectly. Martin and his team were professional throughout.',
                name: 'Sarah Thompson',
                role: 'Tunbridge Wells',
              },
              {
                quote:
                  'We needed period-accurate windows for our listed building. Wealden Joinery delivered exactly what we needed, with expert advice on glazing requirements.',
                name: 'James Harrison',
                role: 'Crowborough',
              },
            ].map((item) => (
              <div key={item.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-700 leading-relaxed">“{item.quote}”</p>
                <div className="mt-4 font-semibold text-slate-900">{item.name}</div>
                <div className="text-sm text-slate-600">{item.role}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white" id="projects">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20 space-y-8">
            <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900">Recent projects</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayProjectImages.map((img, idx) => (
                <article
                  key={idx}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative w-full h-48">
                    <Image
                      src={img.localPath}
                      alt={img.alt || 'Wealden Joinery project'}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="p-4 text-sm font-semibold text-slate-900 group-hover:text-green-800 transition">
                    {projectContent[idx]?.title || 'Wealden Joinery project'}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20 grid lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900">Oak & Accoya® – built to last, designed to age beautifully</h2>
              <p className="text-lg text-slate-700 leading-relaxed">
                We specify super prime and prime grade European oak for long life and reduced movement, and Accoya® for outstanding stability and durability. All timber is FSC-certified and responsibly sourced, including local timber from the High Weald.
              </p>
              <ul className="space-y-2 text-slate-700">
                {[
                  'Low maintenance with the right coatings and detailing',
                  'Outstanding stability – less swelling, shrinking and sticking',
                  'Sustainably sourced from FSC-certified suppliers',
                  'Perfect for paint finishes in heritage colours or crisp modern tones',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {materialsImage && (
              <div className="relative w-full h-64 md:h-80 rounded-2xl overflow-hidden shadow-md">
                <Image
                  src={materialsImage.localPath}
                  alt={materialsImage.alt || 'Oak and Accoya timber windows and doors'}
                  fill
                  className="object-cover"
                />
              </div>
            )}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20 space-y-8">
          <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900">How it works</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Discovery call',
                description:
                  'Share a few details about your property and what needs replacing. We’ll give initial guidance and arrange a survey if we’re a good fit.',
              },
              {
                title: 'Site survey',
                description:
                  'We visit your home, take detailed measurements and talk through design options, glazing, ironmongery and finishes.',
              },
              {
                title: 'Design, craft & finish',
                description:
                  'Your windows and doors are made-to-measure in our Rotherfield workshop, using carefully selected oak or Accoya® and high-performance glazing.',
              },
              {
                title: 'Installation & aftercare',
                description:
                  'Our fitting team installs your joinery with care, minimising disruption and protecting your home. We remain on hand for any aftercare questions.',
              },
            ].map((item, index) => (
              <div key={item.title} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="absolute -top-3 left-4 h-8 w-8 rounded-full bg-green-800 text-white flex items-center justify-center text-sm font-bold shadow-md">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm text-slate-700 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-50" id="trade">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
            <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900">What you can expect from Wealden Joinery</h2>
            <div className="mt-6 grid lg:grid-cols-2 gap-10">
              <ul className="space-y-3 text-slate-700 leading-relaxed">
                {[
                  '50-year anti-rot guarantee on Accoya® timber',
                  'Super prime and prime grade European oak – longer life, less shrinkage',
                  'All craftsmen are City & Guilds qualified',
                  'FSC-certified sustainable timber from the High Weald',
                  'Listed building and period property specialists',
                  'Made-to-measure in our Rotherfield workshop',
                  'Expert glazing advice and installation',
                  'Excellent on-time delivery record',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-slate-700 leading-relaxed">
                  <span className="font-semibold">Risk-free promise:</span> If your initial design or quote isn’t quite right, we’ll refine it with you – no pressure, no obligation.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20 space-y-8">
          <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900">Timber vs uPVC</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-3 bg-slate-100 text-sm font-semibold text-slate-800">
              <div className="px-4 py-3">Feature</div>
              <div className="px-4 py-3">High-quality timber (Wealden)</div>
              <div className="px-4 py-3">uPVC</div>
            </div>
            {[
              {
                feature: 'Lifespan',
                timber: 'Designed for decades with the right care',
                upvc: 'Typically 20–30 years',
              },
              {
                feature: 'Appearance',
                timber: 'Natural grain, heritage proportions, authentic detail',
                upvc: 'Plastic look, bulkier frames',
              },
              {
                feature: 'Thermal performance',
                timber: 'Excellent with modern double/triple glazing',
                upvc: 'Good, but less character',
              },
              {
                feature: 'Sustainability',
                timber: 'Renewable, responsibly sourced timber',
                upvc: 'Plastic-based materials',
              },
              {
                feature: 'Repair & refinishing',
                timber: 'Can be repaired and refinished over time',
                upvc: 'Often replaced rather than repaired',
              },
            ].map((row, index) => (
              <div
                key={row.feature}
                className={`grid grid-cols-3 text-sm text-slate-700 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
              >
                <div className="px-4 py-3 font-semibold text-slate-900">{row.feature}</div>
                <div className="px-4 py-3">{row.timber}</div>
                <div className="px-4 py-3">{row.upvc}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-50" id="faq">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20 space-y-8">
            <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900">Frequently asked questions</h2>
            <div className="space-y-4">
              {[
                {
                  question: 'How long do timber windows last?',
                  answer:
                    'We specify Accoya® with a 50-year anti-rot guarantee and design our timber windows to perform for many decades with the right coatings and care.',
                },
                {
                  question: 'Can you work on listed buildings and conservation areas?',
                  answer:
                    'Yes. We regularly work on listed homes and conservation areas, creating make-to-match joinery and advising on glazing requirements.',
                },
                {
                  question: 'Do you install as well as supply?',
                  answer:
                    'We supply-only and offer a full installation service. We also manufacture reliably for trade and contractor clients.',
                },
              ].map((item, index) => (
                <details
                  key={item.question}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  open={index === 0}
                >
                  <summary className="text-lg font-semibold text-slate-900 cursor-pointer">{item.question}</summary>
                  <p className="mt-3 text-sm text-slate-700 leading-relaxed">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20" id="quote">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 overflow-hidden grid lg:grid-cols-2">
            <div className="p-8 lg:p-10 space-y-4 bg-gradient-to-br from-white to-green-50">
              <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Start your project</p>
              <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900">Start your project with Wealden Joinery</h2>
              <p className="text-lg text-slate-700 leading-relaxed">
                Tell us a little about your home and we’ll come back with friendly, expert advice – not a hard sell.
              </p>
              <div className="text-sm text-slate-600">Takes 2 minutes • No obligation • Expert advice</div>
              <div className="text-sm text-slate-700">
                Or call us on{' '}
                <Link href={`tel:${tenant.phone.replace(/\s+/g, '')}`} className="font-semibold text-green-800">
                  {tenant.phone}
                </Link>
              </div>
            </div>
            <div className="p-8 lg:p-10 bg-white">
              <form action="/api/leads" method="POST" className="space-y-4">
                <input type="hidden" name="tenantId" value={tenant.id} />
                <input type="hidden" name="source" value="landing" />
                <input type="hidden" name="gclid" />
                <input type="hidden" name="gbraid" />
                <input type="hidden" name="wbraid" />
                <input type="hidden" name="fbclid" />
                <input type="hidden" name="utm_source" />
                <input type="hidden" name="utm_medium" />
                <input type="hidden" name="utm_campaign" />
                <input type="hidden" name="utm_term" />
                <input type="hidden" name="utm_content" />

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-slate-800" htmlFor="name">
                      Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-slate-800" htmlFor="email">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-slate-800" htmlFor="phone">
                      Phone
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold text-slate-800" htmlFor="postcode">
                      Postcode
                    </label>
                    <input
                      id="postcode"
                      name="postcode"
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-100"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="projectType">
                    What are you interested in?
                  </label>
                  <select
                    id="projectType"
                    name="projectType"
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-100"
                  >
                    <option value="">Select an option</option>
                    <option value="Sash Windows">Sash Windows</option>
                    <option value="Casement Windows">Casement Windows</option>
                    <option value="Front Doors">Front Doors</option>
                    <option value="Bi-fold Doors">Bi-fold Doors</option>
                    <option value="Conservatory">Conservatory</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="message">
                    Message / project details
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-100"
                  />
                </div>

                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="consent"
                    required
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-green-800 focus:ring-green-700"
                  />
                  <span>I consent to Wealden Joinery storing my details for this quote. See our privacy policy.</span>
                </label>

                <button
                  type="submit"
                  className="w-full rounded-full bg-green-800 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-green-800/10 hover:bg-green-900"
                >
                  Get My Free Quote
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid md:grid-cols-3 gap-8 text-sm text-slate-700">
          <div className="space-y-2">
            <div className="text-lg font-semibold text-slate-900">Wealden Joinery</div>
            <p>Rotherfield, East Sussex</p>
            <p>
              Phone:{' '}
              <Link href={`tel:${tenant.phone.replace(/\s+/g, '')}`} className="font-semibold text-green-800">
                {tenant.phone}
              </Link>
            </p>
            <p>
              Email:{' '}
              <Link href="mailto:martin@wealdenjoinery.com" className="font-semibold text-green-800">
                martin@wealdenjoinery.com
              </Link>
            </p>
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-900">Service areas</div>
            <p className="mt-2 leading-relaxed">
              East Sussex, Kent, Rotherfield, Tunbridge Wells, Crowborough, Uckfield, Heathfield, Mayfield, Wadhurst, Frant.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-lg font-semibold text-slate-900">Links</div>
            <div className="flex flex-col gap-2">
              <Link href="#quote" className="hover:text-green-800">
                Get a Quote
              </Link>
              <Link href="/privacy" className="hover:text-green-800">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-green-800">
                Terms & Conditions
              </Link>
            </div>
            <p className="pt-4 text-xs text-slate-500">© 2025 Wealden Joinery. All rights reserved.</p>
            <p className="text-xs text-slate-500">Campaign powered by Joinery AI</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
