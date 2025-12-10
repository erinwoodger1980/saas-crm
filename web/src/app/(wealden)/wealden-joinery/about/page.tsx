import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "../_components/section-heading";
import { getImagesByHint } from "../_lib/wealdenAiImages";

export const metadata: Metadata = {
  title: "About Wealden Joinery | Traditional Timber Windows & Doors",
  description:
    "Founded in the 1990s, Wealden Joinery combines in-house craftsmanship at our Crowborough headquarters with a network of showrooms nationwide, delivering premium timber windows and doors across the UK.",
};

const workshopImages = getImagesByHint("workshop", 2);
const teamImages = getImagesByHint("team", 1);

const values = [
  {
    title: "Craftsmanship",
    description:
      "Our Crowborough headquarters combines traditional hand-finishing with modern CNC precision. Some products are crafted by trusted manufacturing partners, all meeting our exacting quality standards.",
    icon: "⚒️",
  },
  {
    title: "Reliability",
    description:
      "We turn up when we say we will. We communicate clearly. We honour our quotes and timelines. Building trust with homeowners and architects is as important as building great joinery.",
    icon: "🤝",
  },
  {
    title: "Respect for Homes",
    description:
      "We understand that every property has a story. Whether it's a Listed Georgian townhouse or a contemporary new-build, we tailor our craft to suit the building, not the other way around.",
    icon: "🏡",
  },
  {
    title: "Sustainability",
    description:
      "We source FSC-certified timber and Accoya where appropriate. Our windows and doors are built to last decades, not years—reducing waste and embodied carbon over their lifetime.",
    icon: "🌳",
  },
];

const showroomLocations = [
  {
    region: "East Sussex",
    showrooms: "Crowborough (HQ & Manufacturing), Brighton & Hove",
    coverage: "Lewes, Brighton, Uckfield, Crowborough, Heathfield, Hailsham, Eastbourne, Hastings",
  },
  {
    region: "Kent",
    showrooms: "Tunbridge Wells, Sevenoaks",
    coverage: "Tunbridge Wells, Sevenoaks, Tonbridge, Maidstone, Ashford, Canterbury",
  },
  {
    region: "London",
    showrooms: "Chelsea Design Studio",
    coverage: "Central London, South London, West London — serving architects and trade professionals",
  },
  {
    region: "Nationwide Service",
    showrooms: "Contact us for your area",
    coverage: "We coordinate surveys, installations, and aftercare across the UK through our showroom network",
  },
];

export default function AboutPage() {
  const workshopImage = workshopImages[0];
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-12 md:px-10 md:py-16">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <p className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">About Us</p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
              Traditional Craft, Modern Performance
            </h1>
            <p className="text-lg text-slate-600">
              Since the 1990s, Wealden Joinery has been crafting premium timber windows and doors. From our Crowborough manufacturing headquarters and showroom network, we serve homeowners, architects, and heritage specialists nationwide.
            </p>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section>
        <SectionHeading
          eyebrow="Our Story"
          title="Three decades of craftsmanship"
          copy="Founded in the 1990s by a small team of joiners who believed traditional skills could meet modern performance standards."
        />
        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          {workshopImage && (
            <div className="relative h-64 w-full overflow-hidden rounded-2xl md:h-auto">
              <Image
                src={workshopImage.publicPath}
                alt={workshopImage.caption}
                width={workshopImage.width}
                height={workshopImage.height}
                className="object-cover"
              />
            </div>
          )}
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <p className="text-sm text-slate-700">
              Wealden Joinery started as a small workshop in East Sussex, specialising in heritage sash window repairs and replacements. Over three decades, we've grown into a nationwide business with our manufacturing headquarters in Crowborough and showrooms across the Southeast and London.
            </p>
            <p className="text-sm text-slate-700">
              Today, we're a trusted name for Listed building consents, conservation area approvals, and high-end new-builds. Our in-house team at Crowborough handles precision manufacturing, while trusted partner workshops produce selected ranges to our specifications. Every product, regardless of origin, meets our exacting quality standards.
            </p>
            <p className="text-sm text-slate-700">
              We don't mass-produce. Every window and door is made to order, measured on-site, and tailored to your property. Our showroom network ensures expert local service, from initial consultation through to installation and aftercare.
            </p>
            <p className="text-sm text-slate-700">
              <strong className="font-semibold text-slate-900">Manufacturing HQ: Crowborough, East Sussex.</strong> Showrooms nationwide—visit us to see our products and meet our team.
            </p>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section>
        <SectionHeading
          eyebrow="Our Values"
          title="What we stand for"
          copy="Four principles guide every project we undertake, from initial consultation to final installation."
        />
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {values.map((value) => (
            <article key={value.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-3 text-3xl">{value.icon}</div>
              <h3 className="text-lg font-semibold text-slate-900">{value.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{value.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Showroom Network */}
      <section>
        <SectionHeading
          eyebrow="Our Showrooms"
          title="Visit us nationwide"
          copy="From our Crowborough headquarters to showrooms across the Southeast and London, we're here to help with your project."
        />
        <div className="mt-8 space-y-4">
          {showroomLocations.map((location) => (
            <article key={location.region} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-slate-900">{location.region}</h3>
                <p className="text-sm text-emerald-700">
                  <strong>Showrooms:</strong> {location.showrooms}
                </p>
                <p className="text-sm leading-relaxed text-slate-600">
                  <strong className="text-slate-700">Coverage:</strong> {location.coverage}
                </p>
              </div>
            </article>
          ))}
          <div className="text-center pt-4">
            <Link
              href="/wealden-joinery/showrooms"
              className="inline-flex rounded-full bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-emerald-800"
            >
              View All Showrooms & Locations
            </Link>
          </div>
        </div>
      </section>

      {/* Accreditations & Memberships */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <h3 className="text-center text-lg font-semibold text-slate-900">Accreditations & Memberships</h3>
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-center text-sm text-slate-700">
          <span className="rounded-full bg-white px-4 py-2 shadow-sm">FSC Certified Timber Supplier</span>
          <span className="rounded-full bg-white px-4 py-2 shadow-sm">Secured by Design Approved</span>
          <span className="rounded-full bg-white px-4 py-2 shadow-sm">Listed Building Specialists</span>
          <span className="rounded-full bg-white px-4 py-2 shadow-sm">Conservation Area Approved</span>
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-emerald-800 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 p-8 shadow-lg md:p-10 text-white">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <h3 className="text-3xl font-semibold">Ready to work with us?</h3>
          <p className="text-sm leading-relaxed text-emerald-100">
            Get in touch to discuss your project. We'll visit your property, understand your requirements, and provide a detailed
            quote with no obligation.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm font-semibold">
            <Link
              href="/wealden-joinery/contact"
              className="rounded-full bg-white px-6 py-3 text-emerald-900 transition hover:scale-[1.02] hover:bg-emerald-50"
            >
              Get in Touch
            </Link>
            <Link
              href="/wealden-joinery/projects"
              className="rounded-full bg-white/10 px-6 py-3 text-white ring-1 ring-white/30 transition hover:scale-[1.02] hover:bg-white/20"
            >
              View Recent Projects
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
