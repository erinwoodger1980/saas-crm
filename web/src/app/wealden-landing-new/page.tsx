import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTenantStatic, TenantData } from '@/data/tenants';
import wealdenContent from '../../../content/wealden.json';

type HeroSection = {
  title: string;
  subtitle: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  image: string;
  highlights?: string[];
};

type ProductCategory = {
  title: string;
  description: string;
  image: string;
  bullets?: string[];
};

type CaseStudy = {
  title: string;
  summary: string;
  cta?: string;
  image: string;
};

type AboutSection = {
  heading: string;
  body: string;
  points?: string[];
};

type GalleryImage = {
  src: string;
  alt: string;
};

type ContactSection = {
  heading: string;
  body: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  address?: string;
  email?: string;
  phone?: string;
};

type WealdenContent = {
  heroSections: HeroSection[];
  productCategories: ProductCategory[];
  caseStudies: CaseStudy[];
  aboutSections: AboutSection[];
  galleryImages: GalleryImage[];
  contactSections: ContactSection[];
};

const content = wealdenContent as WealdenContent;

export const metadata: Metadata = {
  title: 'Wealden Joinery | Bespoke Timber Windows & Doors',
  description:
    'Hand-crafted oak and Accoya windows, doors, and joinery from Wealden Joinery in Rotherfield. Conservation-friendly, warranty backed, and built for period homes across East Sussex and Kent.',
};

function SectionHeader({ title, eyebrow, description }: { title: string; eyebrow?: string; description?: string }) {
  return (
    <div className="text-center max-w-3xl mx-auto mb-12">
      {eyebrow ? <p className="text-sm font-semibold tracking-[0.2em] uppercase text-amber-600 mb-3">{eyebrow}</p> : null}
      <h2 className="text-3xl md:text-4xl font-bold text-stone-900 mb-3">{title}</h2>
      {description ? <p className="text-lg text-stone-600">{description}</p> : null}
    </div>
  );
}

function Hero({ hero, tenant }: { hero: HeroSection; tenant: TenantData }) {
  const accent = tenant.brand?.accent || '#C9A14A';

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900 text-white">
      <div className="absolute inset-0">
        <Image
          src={hero.image}
          alt={hero.title}
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-900/70 to-stone-900/40" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-20 lg:py-28">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/30 bg-white/10 backdrop-blur-sm text-sm mb-6">
          <span className="font-semibold">Wealden Joinery</span>
          <span className="text-white/70">•</span>
          <span className="text-white/80">Rotherfield workshop</span>
        </div>

        <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-10 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4 drop-shadow-lg">{hero.title}</h1>
            <p className="text-lg md:text-xl text-amber-50/90 mb-8 max-w-2xl">{hero.subtitle}</p>

            <div className="flex flex-wrap gap-3 mb-8">
              {hero.highlights?.map(item => (
                <span
                  key={item}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 border border-white/20 text-sm"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
                  {item}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              {hero.primaryCta ? (
                <Link
                  href={hero.primaryCta.href}
                  className="px-6 py-3 rounded-md text-lg font-semibold shadow-lg"
                  style={{ backgroundColor: accent, color: '#1f2937' }}
                >
                  {hero.primaryCta.label}
                </Link>
              ) : null}
              {hero.secondaryCta ? (
                <Link
                  href={hero.secondaryCta.href}
                  className="px-6 py-3 rounded-md border border-white/30 text-white hover:bg-white/10 transition"
                >
                  {hero.secondaryCta.label}
                </Link>
              ) : null}
            </div>
          </div>

          <div className="bg-white/10 border border-white/20 backdrop-blur-md rounded-2xl p-6 lg:p-8 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Tenant profile</h3>
            <p className="text-sm text-amber-50/80 mb-4">
              Content below is auto-loaded through tenant settings to keep colours and contact details in sync.
            </p>
            <dl className="space-y-3 text-sm text-amber-50/90">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-amber-100">Workshop</dt>
                <dd className="text-right text-white/90">{tenant.address || 'East Sussex, United Kingdom'}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-amber-100">Phone</dt>
                <dd className="text-right">
                  <a href={`tel:${tenant.phone || ''}`} className="hover:underline">
                    {tenant.phone || '01892 770123'}
                  </a>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-amber-100">Email</dt>
                <dd className="text-right">
                  <a href={`mailto:${tenant.email || ''}`} className="hover:underline">
                    {tenant.email || 'info@wealdenjoinery.com'}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

function CategoryGrid({ categories, accent }: { categories: ProductCategory[]; accent: string }) {
  return (
    <section className="py-16 lg:py-20 bg-stone-50" id="services">
      <SectionHeader
        eyebrow="What we build"
        title="Timber windows, doors, and bespoke joinery"
        description="Tailored to period properties with modern weather, security, and energy performance."
      />

      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-8">
        {categories.map(category => (
          <article key={category.title} className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden flex flex-col">
            <div className="relative h-56">
              <Image
                src={category.image}
                alt={category.title}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 33vw, 100vw"
              />
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <h3 className="text-xl font-semibold text-stone-900 mb-2">{category.title}</h3>
              <p className="text-stone-600 mb-4 flex-1">{category.description}</p>
              {category.bullets ? (
                <ul className="space-y-2 text-sm text-stone-700">
                  {category.bullets.map(point => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-[6px] h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CaseStudies({ items, accent }: { items: CaseStudy[]; accent: string }) {
  return (
    <section className="py-16 lg:py-20 bg-gradient-to-b from-white to-stone-50" id="case-studies">
      <SectionHeader
        eyebrow="Recent projects"
        title="Highlights from local installations"
        description="A glimpse at how Wealden joinery looks once fitted into period homes across East Sussex and Kent."
      />

      <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-8">
        {items.map(item => (
          <article key={item.title} className="relative overflow-hidden rounded-2xl shadow-lg border border-stone-200">
            <div className="relative h-72">
              <Image src={item.image} alt={item.title} fill className="object-cover" sizes="(min-width: 1024px) 50vw, 100vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 to-stone-900/10" />
            </div>
            <div className="absolute inset-0 p-6 flex flex-col justify-end text-white">
              <p className="text-sm uppercase tracking-[0.2em] text-amber-200">Case study</p>
              <h3 className="text-2xl font-semibold mb-2">{item.title}</h3>
              <p className="text-white/90 mb-4 max-w-xl">{item.summary}</p>
              {item.cta ? (
                <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: accent }}>
                  {item.cta}
                  <span aria-hidden>→</span>
                </span>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AboutSections({ sections, accent }: { sections: AboutSection[]; accent: string }) {
  return (
    <section className="py-16 lg:py-20 bg-stone-900 text-white" id="about">
      <SectionHeader
        eyebrow="About the workshop"
        title="Built by City & Guilds trained craftsmen"
        description="Responsive service, careful surveys, and joinery that respects your architecture."
      />

      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-8">
        {sections.map(section => (
          <article key={section.heading} className="bg-white/5 border border-white/10 rounded-2xl p-6 lg:p-8 shadow-lg">
            <h3 className="text-xl font-semibold mb-3" style={{ color: accent }}>
              {section.heading}
            </h3>
            <p className="text-white/90 mb-4">{section.body}</p>
            {section.points ? (
              <ul className="space-y-3 text-sm text-amber-50/90">
                {section.points.map(point => (
                  <li key={point} className="flex gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function Gallery({ images, accent }: { images: GalleryImage[]; accent: string }) {
  return (
    <section className="py-16 lg:py-20 bg-white" id="gallery">
      <SectionHeader
        eyebrow="Gallery"
        title="Joinery crafted for light, warmth, and longevity"
        description="High-resolution photos imported from the Wealden library to showcase finish quality and detailing."
      />

      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-6">
        {images.map(image => (
          <figure
            key={image.src}
            className="overflow-hidden rounded-xl border border-stone-200 shadow-sm bg-stone-50"
            style={{ boxShadow: `0 10px 30px -12px ${accent}22` }}
          >
            <div className="relative h-64">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 33vw, 100vw"
              />
            </div>
            <figcaption className="p-4 text-sm text-stone-700">{image.alt}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Contact({
  contact,
  tenant,
  accent,
  backgroundImage,
}: {
  contact: ContactSection;
  tenant: TenantData;
  accent: string;
  backgroundImage?: string;
}) {
  const phone = contact.phone || tenant.phone || '01892 770123';
  const email = contact.email || tenant.email || 'info@wealdenjoinery.com';
  const address = contact.address || tenant.address || 'East Sussex, United Kingdom';

  return (
    <section className="py-16 lg:py-20 bg-stone-50" id="contact">
      <div className="max-w-5xl mx-auto px-6">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden">
          <div className="grid md:grid-cols-[1.2fr,0.8fr]">
            <div className="p-8 lg:p-10">
              <p className="text-sm uppercase tracking-[0.2em] font-semibold text-amber-700 mb-3">Plan your survey</p>
              <h3 className="text-3xl font-bold text-stone-900 mb-4">{contact.heading}</h3>
              <p className="text-stone-600 mb-6">{contact.body}</p>

              <div className="space-y-3 text-stone-700 mb-6">
                <div>
                  <p className="font-semibold">Call</p>
                  <a href={`tel:${phone}`} className="hover:text-amber-700">
                    {phone}
                  </a>
                </div>
                <div>
                  <p className="font-semibold">Email</p>
                  <a href={`mailto:${email}`} className="hover:text-amber-700">
                    {email}
                  </a>
                </div>
                <div>
                  <p className="font-semibold">Workshop</p>
                  <p>{address}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {contact.primaryCta ? (
                  <Link
                    href={contact.primaryCta.href}
                    className="px-5 py-3 rounded-md text-white font-semibold"
                    style={{ backgroundColor: accent }}
                  >
                    {contact.primaryCta.label}
                  </Link>
                ) : null}
                {contact.secondaryCta ? (
                  <Link
                    href={contact.secondaryCta.href}
                    className="px-5 py-3 rounded-md border border-stone-300 text-stone-800 hover:border-stone-400"
                  >
                    {contact.secondaryCta.label}
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="relative bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900 text-white p-8 lg:p-10">
              {backgroundImage ? (
                <div className="absolute inset-0 opacity-20">
                  <Image src={backgroundImage} alt="Workshop detail" fill className="object-cover" />
                </div>
              ) : null}
              <div className="relative">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-200 mb-3">Next steps</p>
                <ul className="space-y-4 text-amber-50">
                  <li className="flex gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
                    Share photos, drawings, or inspiration with the team.
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
                    We schedule a survey and confirm materials and profiles.
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
                    Receive a clear quotation with timelines and installation plan.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function WealdenLandingNewPage() {
  const tenant = getTenantStatic('wealden');

  if (!tenant) {
    notFound();
  }

  const hero = content.heroSections[0];
  const contact = content.contactSections[0];
  const accent = tenant.brand?.accent || '#C9A14A';
  const backgroundImage = content.galleryImages[0]?.src || content.heroSections[0]?.image;

  return (
    <div className="bg-stone-50 text-stone-900">
      <Hero hero={hero} tenant={tenant} />
      <CategoryGrid categories={content.productCategories} accent={accent} />
      <CaseStudies items={content.caseStudies} accent={accent} />
      <AboutSections sections={content.aboutSections} accent={accent} />
      <Gallery images={content.galleryImages} accent={accent} />
      <Contact contact={contact} tenant={tenant} accent={accent} backgroundImage={backgroundImage} />
    </div>
  );
}
