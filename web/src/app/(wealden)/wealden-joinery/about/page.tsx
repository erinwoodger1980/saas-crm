import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "../_components/section-heading";
import { getImagesByHint } from "../_lib/wealdenAiImages";

export const metadata: Metadata = {
  title: "About Wealden Joinery | Traditional Timber Windows & Doors",
  description:
    "Founded in the 1990s, Wealden Joinery is a family-run workshop in Rotherfield, crafting bespoke timber windows and doors for heritage and contemporary properties across Sussex and Kent.",
};

const workshopImages = getImagesByHint("workshop", 2);
const teamImages = getImagesByHint("team", 1);

const values = [
  {
    title: "Craftsmanship",
    description:
      "Every window and door is made by hand in our Rotherfield workshop. We use mortice-and-tenon joinery, engineered cores, and time-tested techniques that guarantee long life.",
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

const regions = [
  "East Sussex — Lewes, Brighton, Uckfield, Crowborough, Rotherfield, Heathfield, Hailsham, Rye",
  "West Sussex — Horsham, Haywards Heath, Burgess Hill, Chichester",
  "Kent — Tunbridge Wells, Sevenoaks, Tonbridge, Maidstone, Ashford",
  "Surrey — Redhill, Reigate, Dorking, Guildford",
  "South London — Bromley, Croydon, Dulwich, Greenwich",
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
              Wealden Joinery has been crafting bespoke timber windows and doors since the 1990s. From our Rotherfield workshop, we
              serve homeowners, architects, and heritage specialists across the South East.
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
              Wealden Joinery started as a small workshop in Rotherfield, East Sussex, specialising in heritage sash window repairs
              and replacements. Over time, we expanded into contemporary casements, entrance doors, and alu-clad systems—always
              maintaining the same commitment to hand-crafted quality.
            </p>
            <p className="text-sm text-slate-700">
              Today, we're a trusted name for Listed building consents, conservation area approvals, and high-end new-builds. Our
              team of skilled joiners, finishers, and installers work on projects from small cottage sash replacements to
              multi-thousand-square-foot contemporary homes.
            </p>
            <p className="text-sm text-slate-700">
              We don't mass-produce. Every window and door is made to order, measured on-site, and tailored to your property. That
              approach takes longer, but it's the only way to deliver joinery that lasts.
            </p>
            <p className="text-sm text-slate-700">
              <strong className="font-semibold text-slate-900">Based in Rotherfield, East Sussex.</strong> Serving Sussex, Kent,
              Surrey, and South London.
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

      {/* Region Served */}
      <section>
        <SectionHeading
          eyebrow="Where We Work"
          title="Serving the South East"
          copy="We install across Sussex, Kent, Surrey, and South London. If you're outside these areas, get in touch—we may still be able to help."
        />
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ul className="space-y-3">
            {regions.map((region) => {
              const parts = region.split(" — ");
              const county = parts[0];
              const towns = parts[1];
              return (
                <li key={region} className="text-sm">
                  <strong className="font-semibold text-slate-900">{county}</strong>
                  {towns && <span className="text-slate-700"> — {towns}</span>}
                </li>
              );
            })}
          </ul>
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
