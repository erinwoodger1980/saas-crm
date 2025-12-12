"use client";

import Image from "next/image";
import Link from "next/link";
import { ImagePlaceholder } from "../../_components/image-placeholder";

interface AboutContentProps {
  heroImage: {
    id: string;
    publicPath: string;
    caption: string;
    width: number;
    height: number;
  } | null;
  storyImages: Array<{
    id: string;
    publicPath: string;
    caption: string;
    width: number;
    height: number;
  }>;
  valuesImage: {
    id: string;
    publicPath: string;
    caption: string;
    width: number;
    height: number;
  } | null;
  showroomImage: {
    id: string;
    publicPath: string;
    caption: string;
    width: number;
    height: number;
  } | null;
}

export function AboutContent({ heroImage, storyImages, valuesImage, showroomImage }: AboutContentProps) {
  const timeline = [
    {
      year: "1990s",
      title: "Founded",
      description: "Small workshop in East Sussex specializing in heritage sash repairs",
    },
    {
      year: "2000s",
      title: "Crowborough HQ",
      description: "Expanded to purpose-built manufacturing facility with CNC machinery",
    },
    {
      year: "2010s",
      title: "Showroom Network",
      description: "Opened locations across Kent, Sussex, and London Design Studio",
    },
    {
      year: "2020s",
      title: "Listed & Conservation",
      description: "Trusted name for heritage consents and conservation areas",
    },
    {
      year: "Today",
      title: "Nationwide Delivery",
      description: "Coordinating surveys, installations, and aftercare across the UK",
    },
  ];

  const trustItems = [
    { label: "30+ Years", sublabel: "Since the 1990s" },
    { label: "Made to Order", sublabel: "Measured on-site" },
    { label: "Heritage Expertise", sublabel: "Listed buildings" },
    { label: "FSC & Accoya", sublabel: "Sustainable timber" },
    { label: "Performance Standards", sublabel: "Security & thermal" },
  ];

  const values = [
    {
      title: "Craftsmanship",
      description:
        "CNC precision meets traditional hand-finishing at our Crowborough headquarters. Trusted partners craft selected ranges to our exacting standards.",
    },
    {
      title: "Reliability",
      description:
        "We turn up when we say we will. Clear communication, honoured quotes, and transparent timelines build trust with homeowners and architects.",
    },
    {
      title: "Respect for Homes",
      description:
        "Every property has a story. Whether Georgian townhouse or contemporary new-build, we tailor our craft to suit the building.",
    },
    {
      title: "Sustainability",
      description:
        "FSC-certified timber, Accoya options, and products built to last decades—reducing waste and embodied carbon over their lifetime.",
    },
  ];

  const regions = [
    {
      name: "East Sussex",
      showrooms: "Crowborough (HQ), Brighton",
      description: "Manufacturing headquarters and coastal specialists",
    },
    {
      name: "Kent",
      showrooms: "Tunbridge Wells, Sevenoaks",
      description: "Heritage specialists and conservation experts",
    },
    {
      name: "London",
      showrooms: "Chelsea Harbour",
      description: "Trade & architect consultations",
    },
    {
      name: "Nationwide",
      showrooms: "Contact us",
      description: "Virtual consultations and UK-wide service",
    },
  ];

  const accreditations = [
    {
      title: "FSC Certified",
      description: "Responsible timber sourcing you can verify",
    },
    {
      title: "Secured by Design",
      description: "Police-approved security standards",
    },
    {
      title: "Listed Building",
      description: "Trusted for heritage consents",
    },
    {
      title: "Conservation Area",
      description: "Pre-approved for sensitive locations",
    },
    {
      title: "Energy Efficient",
      description: "U-values meeting Part L standards",
    },
    {
      title: "Accoya Supplier",
      description: "50-year guarantee timber options",
    },
  ];

  return (
    <div className="space-y-32">
      {/* Hero */}
      <section className="space-y-8 pt-12">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">About Wealden Joinery</p>
          <h1 className="text-5xl font-light leading-tight tracking-tight text-slate-900 md:text-7xl">
            Traditional Craft, Modern Performance
          </h1>
          <p className="text-lg font-light leading-relaxed text-slate-600">
            Since the 1990s, crafting premium timber windows and doors. Made-to-order, measured on-site, built in Crowborough.
            Delivered nationwide through our showroom network.
          </p>
        </div>

        {/* Hero Image */}
        <div className="image-slot">
          <div className="relative aspect-[21/9] overflow-hidden rounded-2xl bg-slate-100">
            {heroImage ? (
              <>
                <Image src={heroImage.publicPath} alt={heroImage.caption} fill className="object-cover" />
                <div className="image-upload-control absolute top-4 right-4 z-10">
                  <ImagePlaceholder label="About Hero" aspectRatio="aspect-[21/9]" imageUrl={heroImage.publicPath} />
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="image-upload-control">
                  <ImagePlaceholder label="About Hero (Craftsman / Workshop)" aspectRatio="aspect-[21/9]" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Trust Strip */}
        <div className="mx-auto grid max-w-4xl gap-6 text-center md:grid-cols-5">
          {trustItems.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <p className="text-lg font-semibold text-slate-900">{item.label}</p>
              <p className="text-xs text-slate-500">{item.sublabel}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Our Story */}
      <section className="space-y-12">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Our Story</p>
          <h2 className="text-4xl font-light tracking-tight text-slate-900 md:text-5xl">Three decades of craftsmanship</h2>
          <p className="text-base font-light leading-relaxed text-slate-600">
            Founded by a small team of joiners who believed traditional skills could meet modern performance standards
          </p>
        </div>

        {/* Story Paragraphs with Images */}
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm leading-relaxed text-slate-700">
                Wealden Joinery started as a small workshop in East Sussex, specialising in heritage sash window repairs and
                replacements. Over three decades, we've grown into a nationwide business with our manufacturing headquarters in
                Crowborough and showrooms across the Southeast and London.
              </p>
              <p className="text-sm leading-relaxed text-slate-700">
                Today, we're a trusted name for Listed building consents, conservation area approvals, and high-end new-builds.
                Our in-house team at Crowborough handles precision manufacturing, while trusted partner workshops produce selected
                ranges to our specifications.
              </p>
            </div>

            {/* Story Image 1 */}
            <div className="image-slot">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                {storyImages[0] ? (
                  <>
                    <Image src={storyImages[0].publicPath} alt="Crowborough facility" fill className="object-cover" />
                    <div className="image-upload-control absolute top-4 right-4 z-10">
                      <ImagePlaceholder
                        label="Crowborough Facility"
                        aspectRatio="aspect-[4/3]"
                        imageUrl={storyImages[0].publicPath}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="image-upload-control">
                      <ImagePlaceholder label="Crowborough Facility Exterior" aspectRatio="aspect-[4/3]" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm leading-relaxed text-slate-700">
                We don't mass-produce. Every window and door is made to order, measured on-site, and tailored to your property.
                Our showroom network ensures expert local service, from initial consultation through to installation and aftercare.
              </p>
              <p className="text-sm font-semibold text-slate-900">
                Manufacturing HQ: Crowborough, East Sussex. Showrooms nationwide—visit us to see our products and meet our team.
              </p>
            </div>

            {/* Story Image 2 */}
            <div className="image-slot">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                {storyImages[1] ? (
                  <>
                    <Image src={storyImages[1].publicPath} alt="Craft detail" fill className="object-cover" />
                    <div className="image-upload-control absolute top-4 right-4 z-10">
                      <ImagePlaceholder label="Craft Detail" aspectRatio="aspect-[4/3]" imageUrl={storyImages[1].publicPath} />
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="image-upload-control">
                      <ImagePlaceholder label="Craft Detail (Hands/Tools/Joints)" aspectRatio="aspect-[4/3]" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h3 className="mb-8 text-center text-xl font-semibold text-slate-900">Our Journey</h3>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-200 md:left-1/2" />

            <div className="space-y-8">
              {timeline.map((item, idx) => (
                <div key={idx} className="relative flex gap-8 md:gap-12">
                  {/* Year badge */}
                  <div className="flex w-16 flex-shrink-0 items-start justify-end md:w-1/2">
                    <span className="relative z-10 rounded-full bg-emerald-700 px-4 py-1 text-xs font-semibold text-white">
                      {item.year}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-8 md:w-1/2">
                    <h4 className="text-base font-semibold text-slate-900">{item.title}</h4>
                    <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Story Image 3 - Finished Install */}
        <div className="image-slot">
          <div className="relative aspect-[21/9] overflow-hidden rounded-2xl bg-slate-100">
            {storyImages[2] ? (
              <>
                <Image src={storyImages[2].publicPath} alt="Finished installation" fill className="object-cover" />
                <div className="image-upload-control absolute top-4 right-4 z-10">
                  <ImagePlaceholder
                    label="Finished Install"
                    aspectRatio="aspect-[21/9]"
                    imageUrl={storyImages[2].publicPath}
                  />
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="image-upload-control">
                  <ImagePlaceholder label="Finished Install (Period or Modern)" aspectRatio="aspect-[21/9]" />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="space-y-12">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Our Values</p>
          <h2 className="text-4xl font-light tracking-tight text-slate-900 md:text-5xl">What we stand for</h2>
          <p className="text-base font-light leading-relaxed text-slate-600">
            Four principles guide every project, from initial consultation to final installation
          </p>
        </div>

        {/* Values Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {values.map((value) => (
            <article key={value.title} className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <svg className="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {value.title === "Craftsmanship" && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
                    />
                  )}
                  {value.title === "Reliability" && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  )}
                  {value.title === "Respect for Homes" && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  )}
                  {value.title === "Sustainability" && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                    />
                  )}
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{value.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{value.description}</p>
            </article>
          ))}
        </div>

        {/* Values Supporting Image */}
        {valuesImage && (
          <div className="image-slot">
            <div className="relative aspect-[21/9] overflow-hidden rounded-2xl bg-slate-100">
              <Image src={valuesImage.publicPath} alt="Our values in action" fill className="object-cover" />
              <div className="image-upload-control absolute top-4 right-4 z-10">
                <ImagePlaceholder label="Values Image" aspectRatio="aspect-[21/9]" imageUrl={valuesImage.publicPath} />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Showroom Network */}
      <section className="space-y-12">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Our Showrooms</p>
          <h2 className="text-4xl font-light tracking-tight text-slate-900 md:text-5xl">Visit us nationwide</h2>
          <p className="text-base font-light leading-relaxed text-slate-600">
            From our Crowborough headquarters to locations across the Southeast and London
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {regions.map((region) => (
            <article
              key={region.name}
              className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:shadow-lg"
            >
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                  <svg className="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-base font-semibold text-slate-900">{region.name}</h3>
              <p className="mt-2 text-xs font-medium text-emerald-700">{region.showrooms}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{region.description}</p>
            </article>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/wealden-joinery/showrooms"
            className="inline-flex rounded-full bg-emerald-700 px-8 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            View All Showrooms & Book a Visit
          </Link>
        </div>

        {/* Showroom Image */}
        <div className="image-slot">
          <div className="relative aspect-[21/9] overflow-hidden rounded-2xl bg-slate-100">
            {showroomImage ? (
              <>
                <Image src={showroomImage.publicPath} alt="Showroom interior" fill className="object-cover" />
                <div className="image-upload-control absolute top-4 right-4 z-10">
                  <ImagePlaceholder
                    label="Showroom Interior"
                    aspectRatio="aspect-[21/9]"
                    imageUrl={showroomImage.publicPath}
                  />
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="image-upload-control">
                  <ImagePlaceholder label="Showroom Interior (Sample Wall/Meeting)" aspectRatio="aspect-[21/9]" />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Accreditations */}
      <section className="space-y-8">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Accreditations & Standards</p>
          <h2 className="text-4xl font-light tracking-tight text-slate-900 md:text-5xl">Trusted credentials</h2>
          <p className="text-base font-light leading-relaxed text-slate-600">
            Certified to industry standards and approved for sensitive heritage projects
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {accreditations.map((accreditation, idx) => (
            <article key={idx} className="image-slot space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              {/* Badge/Logo Placeholder */}
              <div className="relative mx-auto aspect-square w-24 overflow-hidden rounded-lg bg-slate-100">
                <div className="flex h-full items-center justify-center">
                  <div className="image-upload-control">
                    <ImagePlaceholder label={`${accreditation.title} Logo`} aspectRatio="aspect-square" />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900">{accreditation.title}</h3>
                <p className="text-xs text-slate-600">{accreditation.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Final CTA - Next Steps */}
      <section className="rounded-2xl bg-slate-900 px-8 py-16 text-white md:px-12 md:py-20">
        <div className="mx-auto max-w-4xl space-y-12">
          <div className="space-y-4 text-center">
            <h2 className="text-4xl font-light tracking-tight md:text-5xl">Ready to start your project?</h2>
            <p className="text-base font-light leading-relaxed text-slate-300">
              Choose your path: book a showroom consultation or explore recent work
            </p>
          </div>

          {/* Two Paths */}
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-6 rounded-xl border border-white/20 bg-white/5 p-8 backdrop-blur-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-700">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Book a Consultation</h3>
                <p className="text-sm leading-relaxed text-slate-300">
                  Visit a showroom, see samples, discuss your project. We'll guide you through options and next steps.
                </p>
              </div>
              <Link
                href="/wealden-joinery/showrooms"
                className="inline-flex w-full justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Find Your Nearest Showroom
              </Link>
            </div>

            <div className="space-y-6 rounded-xl border border-white/20 bg-white/5 p-8 backdrop-blur-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-700">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">View Recent Projects</h3>
                <p className="text-sm leading-relaxed text-slate-300">
                  Explore case studies from Listed buildings to contemporary new-builds across the Southeast.
                </p>
              </div>
              <Link
                href="/wealden-joinery/projects"
                className="inline-flex w-full justify-center rounded-full border-2 border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Browse Our Portfolio
              </Link>
            </div>
          </div>

          {/* Process Overview */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Our Process</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-slate-300">
              <span className="rounded-full bg-white/10 px-3 py-1">1. Consultation</span>
              <span className="text-slate-500">→</span>
              <span className="rounded-full bg-white/10 px-3 py-1">2. Survey & Measure</span>
              <span className="text-slate-500">→</span>
              <span className="rounded-full bg-white/10 px-3 py-1">3. Drawings & Quote</span>
              <span className="text-slate-500">→</span>
              <span className="rounded-full bg-white/10 px-3 py-1">4. Manufacture</span>
              <span className="text-slate-500">→</span>
              <span className="rounded-full bg-white/10 px-3 py-1">5. Installation</span>
              <span className="text-slate-500">→</span>
              <span className="rounded-full bg-white/10 px-3 py-1">6. Aftercare</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
