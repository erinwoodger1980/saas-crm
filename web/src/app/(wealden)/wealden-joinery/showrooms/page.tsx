import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "../_components/section-heading";
import { getImagesByHint } from "../_lib/wealdenAiImages";

export const metadata: Metadata = {
  title: "Showrooms | Wealden Joinery - Visit Us Nationwide",
  description:
    "Visit Wealden Joinery showrooms across the UK. See our timber windows and doors, discuss your project, and explore samples. Manufacturing headquarters in Crowborough, East Sussex.",
};

const showroomImages = getImagesByHint("workshop", 3);
const lifestyleImages = getImagesByHint("lifestyle", 2);

const showrooms = [
  {
    name: "Crowborough (Headquarters & Manufacturing)",
    address: "Wealden Business Park, Crowborough, East Sussex TN6 3DU",
    phone: "01892 123 456",
    email: "crowborough@wealdenjoinery.co.uk",
    hours: "Mon-Fri: 8am-5pm, Sat: 9am-2pm, Sun: Closed",
    description: "Our manufacturing headquarters and flagship showroom. See our full production facility, meet the craftsmen, and explore our complete range of timber windows and doors.",
    features: ["Full product range", "Manufacturing tours available", "Technical consultations", "Heritage specialists on-site"],
    isHQ: true,
  },
  {
    name: "Tunbridge Wells Showroom",
    address: "The Pantiles, Tunbridge Wells, Kent TN2 5TE",
    phone: "01892 567 890",
    email: "tunbridgewells@wealdenjoinery.co.uk",
    hours: "Mon-Sat: 9am-5pm, Sun: 10am-4pm",
    description: "Located in the heart of Tunbridge Wells, our showroom displays sash and casement windows alongside entrance doors and heritage hardware.",
    features: ["Full product display", "Sample library", "Design consultations", "Listed building advice"],
    isHQ: false,
  },
  {
    name: "Brighton & Hove Showroom",
    address: "North Laine Quarter, Brighton BN1 3EF",
    phone: "01273 456 789",
    email: "brighton@wealdenjoinery.co.uk",
    hours: "Mon-Sat: 9am-5:30pm, Sun: 11am-4pm",
    description: "Our coastal showroom specializing in contemporary designs and alu-clad systems for new builds and renovations.",
    features: ["Contemporary range", "Alu-clad specialists", "Color consultations", "Glazing options display"],
    isHQ: false,
  },
  {
    name: "Sevenoaks Showroom",
    address: "High Street, Sevenoaks, Kent TN13 1LD",
    phone: "01732 234 567",
    email: "sevenoaks@wealdenjoinery.co.uk",
    hours: "Mon-Sat: 9am-5pm, Sun: Closed",
    description: "Serving Kent with expertise in period properties, conservation areas, and bespoke timber joinery.",
    features: ["Heritage specialists", "Conservation area experts", "Sample displays", "Project consultations"],
    isHQ: false,
  },
  {
    name: "London Design Studio",
    address: "Chelsea Harbour Design Centre, London SW10 0XE",
    phone: "020 7351 9876",
    email: "london@wealdenjoinery.co.uk",
    hours: "Mon-Fri: 9am-6pm, Sat: 10am-5pm, Sun: Closed",
    description: "Trade and architect consultations in central London. Working closely with designers and specifiers on high-end residential projects.",
    features: ["Trade professionals", "Architect support", "Specification guidance", "Sample ordering"],
    isHQ: false,
  },
];

const benefits = [
  {
    icon: "🏭",
    title: "Manufacturing Excellence",
    description: "Our Crowborough headquarters houses state-of-the-art CNC machinery alongside traditional hand-finishing workshops.",
  },
  {
    icon: "🤝",
    title: "Partner Network",
    description: "Selected products are crafted by our trusted manufacturing partners, all meeting our exacting quality standards.",
  },
  {
    icon: "🚚",
    title: "Nationwide Service",
    description: "From our showroom network, we coordinate surveys, installations, and aftercare across the UK.",
  },
  {
    icon: "⚒️",
    title: "Expert Guidance",
    description: "Every showroom has trained consultants who understand heritage buildings, modern performance, and design options.",
  },
];

export default function ShowroomsPage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-12 md:px-10 md:py-16">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <p className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Visit Us
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
              Showrooms Across the UK
            </h1>
            <p className="text-lg text-slate-600">
              Visit our showrooms to see timber windows and doors in person, discuss your project with our experts, and explore
              samples of timber, glazing, and finishes. Manufacturing headquarters in Crowborough, East Sussex.
            </p>
          </div>
        </div>
      </section>

      {/* Showroom Locations */}
      <section>
        <SectionHeading
          eyebrow="Our Locations"
          title="Visit a showroom near you"
          copy="From our manufacturing headquarters in Crowborough to showrooms across the Southeast and London, we're here to help with your project."
        />
        <div className="mt-8 space-y-6">
          {showrooms.map((showroom, idx) => {
            const showroomImage = idx < showroomImages.length ? showroomImages[idx] : lifestyleImages[idx % lifestyleImages.length];
            return (
              <article
                key={showroom.name}
                className={`overflow-hidden rounded-xl border shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                  showroom.isHQ ? "border-emerald-700 bg-gradient-to-br from-emerald-50/50 to-white" : "border-slate-200 bg-white"
                }`}
              >
                <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
                  {showroomImage && (
                    <div className="relative h-64 w-full md:h-auto">
                      <Image
                        src={showroomImage.publicPath}
                        alt={showroomImage.caption}
                        width={showroomImage.width}
                        height={showroomImage.height}
                        className="object-cover h-full w-full"
                      />
                      {showroom.isHQ && (
                        <div className="absolute top-4 right-4 rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
                          🏭 HQ & Manufacturing
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-4 p-6">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{showroom.name}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{showroom.description}</p>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="text-slate-400">📍</span>
                        <span className="text-slate-700">{showroom.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">📞</span>
                        <a href={`tel:${showroom.phone.replace(/\s/g, "")}`} className="text-emerald-700 hover:underline">
                          {showroom.phone}
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">✉️</span>
                        <a href={`mailto:${showroom.email}`} className="text-emerald-700 hover:underline">
                          {showroom.email}
                        </a>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-slate-400">🕐</span>
                        <span className="text-slate-700">{showroom.hours}</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-900 mb-2">Available at this location:</h4>
                      <div className="flex flex-wrap gap-2">
                        {showroom.features.map((feature) => (
                          <span
                            key={feature}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(showroom.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                      >
                        Get Directions
                      </a>
                      <a
                        href={`mailto:${showroom.email}?subject=Showroom Visit Enquiry`}
                        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        Book a Visit
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Our Approach */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <SectionHeading
          eyebrow="Our Approach"
          title="Manufacturing excellence, nationwide service"
          copy="Combining in-house craftsmanship with trusted partners to deliver exceptional timber joinery across the UK."
        />
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {benefits.map((benefit) => (
            <article key={benefit.title} className="rounded-xl border border-slate-200 bg-slate-50 p-6">
              <div className="mb-3 text-3xl">{benefit.icon}</div>
              <h3 className="text-base font-semibold text-slate-900">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{benefit.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-emerald-800 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 p-8 text-white shadow-lg md:p-10">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <h3 className="text-3xl font-semibold">Can't visit a showroom?</h3>
          <p className="text-sm leading-relaxed text-emerald-100">
            We offer virtual consultations, sample delivery, and comprehensive project support wherever you are in the UK.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm font-semibold">
            <Link
              href="/wealden-joinery/contact"
              className="rounded-full bg-white px-6 py-3 text-emerald-900 transition hover:scale-[1.02] hover:bg-emerald-50"
            >
              Contact Us
            </Link>
            <Link
              href="/wealden-joinery/estimate"
              className="rounded-full bg-white/10 px-6 py-3 text-white ring-1 ring-white/30 transition hover:scale-[1.02] hover:bg-white/20"
            >
              Get an Estimate
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
