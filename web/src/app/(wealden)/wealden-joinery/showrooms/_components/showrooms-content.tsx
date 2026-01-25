"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImageSlot } from "../../_components/image-slot";

interface ShowroomsContentProps {
  heroImage: {
    id: string;
    publicPath: string;
    caption: string;
    width: number;
    height: number;
  } | null;
  showroomImages: Array<{
    id: string;
    publicPath: string;
    caption: string;
    width: number;
    height: number;
  }>;
}

interface Showroom {
  id: string;
  name: string;
  shortName: string;
  positioning: string;
  address: string;
  postcode: string;
  region: string;
  phone: string;
  email: string;
  hours: string;
  description: string;
  features: string[];
  isHQ: boolean;
  isTrade: boolean;
  lat?: number;
  lng?: number;
}

export function ShowroomsContent({ heroImage, showroomImages }: ShowroomsContentProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [highlightedShowroom, setHighlightedShowroom] = useState<string | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const showrooms: Showroom[] = [
    {
      id: "rotherfield",
      name: "Rotherfield",
      shortName: "Headquarters",
      positioning: "Manufacturing headquarters and flagship showroom",
      address: "Unit 1 Lews Farm, Sherrifs Lane, Rotherfield, East Sussex",
      postcode: "TN6 3JE",
      region: "Sussex",
      phone: "01892 852544",
      email: "martin@wealdenjoinery.com",
      hours: "Mon-Fri: 8am-5pm, Sat: 9am-2pm",
      description: "Visit our manufacturing facility, meet the craftsmen, and explore our complete range",
      features: ["Full product range", "Manufacturing tours", "Technical consultations", "Heritage specialists"],
      isHQ: true,
      isTrade: false,
    },
    {
      id: "london",
      name: "London Design Studio",
      shortName: "Chelsea Harbour",
      positioning: "Trade and architect consultations",
      address: "Chelsea Harbour Design Centre, London",
      postcode: "SW10 0XE",
      region: "London",
      phone: "020 7351 9876",
      email: "london@wealdenjoinery.co.uk",
      hours: "Mon-Fri: 9am-6pm, Sat: 10am-5pm",
      description: "Working closely with designers and specifiers on high-end residential projects",
      features: ["Architect support", "Specification guidance", "Sample library", "Trade pricing"],
      isHQ: false,
      isTrade: true,
    },
    {
      id: "tunbridge-wells",
      name: "Tunbridge Wells",
      shortName: "The Pantiles",
      positioning: "Heritage windows and period property specialists",
      address: "The Pantiles, Tunbridge Wells, Kent",
      postcode: "TN2 5TE",
      region: "Kent",
      phone: "01892 567 890",
      email: "tunbridgewells@wealdenjoinery.co.uk",
      hours: "Mon-Sat: 9am-5pm, Sun: 10am-4pm",
      description: "Sash and casement windows, entrance doors, and heritage hardware",
      features: ["Full product display", "Listed building advice", "Sample library", "Design consultations"],
      isHQ: false,
      isTrade: false,
    },
    {
      id: "brighton",
      name: "Brighton & Hove",
      shortName: "North Laine",
      positioning: "Contemporary designs and coastal specialists",
      address: "North Laine Quarter, Brighton",
      postcode: "BN1 3EF",
      region: "Sussex",
      phone: "01273 456 789",
      email: "brighton@wealdenjoinery.co.uk",
      hours: "Mon-Sat: 9am-5:30pm, Sun: 11am-4pm",
      description: "Specializing in alu-clad systems and contemporary designs for coastal properties",
      features: ["Contemporary range", "Alu-clad specialists", "Colour consultations", "Glazing options"],
      isHQ: false,
      isTrade: false,
    },
    {
      id: "sevenoaks",
      name: "Sevenoaks",
      shortName: "High Street",
      positioning: "Conservation area and period property experts",
      address: "High Street, Sevenoaks, Kent",
      postcode: "TN13 1LD",
      region: "Kent",
      phone: "01732 234 567",
      email: "sevenoaks@wealdenjoinery.co.uk",
      hours: "Mon-Sat: 9am-5pm",
      description: "Expertise in period properties and conservation areas across Kent",
      features: ["Heritage specialists", "Conservation experts", "Sample displays", "Project consultations"],
      isHQ: false,
      isTrade: false,
    },
  ];

  const filterShowrooms = () => {
    let filtered = showrooms;

    // Apply active filter
    if (activeFilter === "london") {
      filtered = filtered.filter((s) => s.region === "London");
    } else if (activeFilter === "kent") {
      filtered = filtered.filter((s) => s.region === "Kent");
    } else if (activeFilter === "sussex") {
      filtered = filtered.filter((s) => s.region === "Sussex");
    } else if (activeFilter === "hq") {
      filtered = filtered.filter((s) => s.isHQ);
    } else if (activeFilter === "trade") {
      filtered = filtered.filter((s) => s.isTrade);
    }

    // Apply search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.address.toLowerCase().includes(term) ||
          s.postcode.toLowerCase().includes(term) ||
          s.region.toLowerCase().includes(term)
      );
    }

    return filtered;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const filtered = filterShowrooms();
    if (filtered.length > 0) {
      scrollToShowroom(filtered[0].id);
    }
  };

  const scrollToShowroom = (id: string) => {
    const element = document.getElementById(`showroom-${id}`);
    if (element) {
      const offset = 120;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });

      setHighlightedShowroom(id);
      setTimeout(() => setHighlightedShowroom(null), 3000);
    }
  };

  const handleFilterClick = (filter: string) => {
    if (activeFilter === filter) {
      setActiveFilter(null);
    } else {
      setActiveFilter(filter);
      const filtered = showrooms.filter((s) => {
        if (filter === "london") return s.region === "London";
        if (filter === "kent") return s.region === "Kent";
        if (filter === "sussex") return s.region === "Sussex";
        if (filter === "hq") return s.isHQ;
        if (filter === "trade") return s.isTrade;
        return true;
      });
      if (filtered.length > 0) {
        setTimeout(() => scrollToShowroom(filtered[0].id), 100);
      }
    }
  };

  const filteredShowrooms = filterShowrooms();

  return (
    <>
      {/* Sticky Book CTA */}
      <div className="fixed bottom-6 right-6 z-50 md:bottom-8 md:right-8">
        <button
          onClick={() => setShowBookingModal(true)}
          className="rounded-full bg-emerald-700 px-6 py-4 text-sm font-semibold text-white shadow-2xl transition hover:scale-[1.05] hover:bg-emerald-800"
        >
          📅 Book a Visit
        </button>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            <button
              onClick={() => setShowBookingModal(false)}
              className="absolute top-4 right-4 text-2xl text-slate-400 transition hover:text-slate-900"
            >
              ×
            </button>
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-slate-900">Book a Showroom Visit</h3>
                <p className="text-sm text-slate-600">
                  Choose your preferred location and we'll arrange a time to show you samples, discuss your project, and answer
                  questions.
                </p>
              </div>
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Your Name</label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Phone</label>
                  <input
                    type="tel"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                    placeholder="01892 123 456"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Preferred Showroom</label>
                  <select className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20">
                    <option value="">Select a location...</option>
                    {showrooms.map((showroom) => (
                      <option key={showroom.id} value={showroom.id}>
                        {showroom.name} - {showroom.shortName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Message (optional)</label>
                  <textarea
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                    placeholder="Tell us about your project..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-full bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
                >
                  Send Booking Request
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-32">
        {/* Hero */}
        <section className="space-y-8 pt-12">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Visit Us</p>
            <h1 className="text-5xl font-light leading-tight tracking-tight text-slate-900 md:text-7xl">
              Showrooms Across the UK
            </h1>
            <p className="text-lg font-light leading-relaxed text-slate-600">
              Visit our showrooms to see timber windows and doors in person, discuss your project with our experts, and explore
              samples of timber, glazing, and finishes.
            </p>
          </div>

          {/* Hero Image */}
          <ImageSlot
            slotId="showrooms-hero"
            label="Showroom Hero"
            aspectRatio="aspect-[21/9]"
            size="xl"
          />
        </section>

        {/* Find a Showroom */}
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="space-y-2 text-center">
              <h2 className="text-3xl font-light tracking-tight text-slate-900">Find a Showroom</h2>
              <p className="text-sm font-light text-slate-600">Search by postcode, town, or use quick filters below</p>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Enter postcode or town..."
                className="flex-1 rounded-full border border-slate-300 px-6 py-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
              />
              <button
                type="submit"
                className="rounded-full bg-emerald-700 px-8 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                Find Nearest
              </button>
            </form>

            {/* Quick Filters */}
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => handleFilterClick("london")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeFilter === "london"
                    ? "bg-emerald-700 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Near London
              </button>
              <button
                onClick={() => handleFilterClick("kent")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeFilter === "kent" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Kent
              </button>
              <button
                onClick={() => handleFilterClick("sussex")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeFilter === "sussex"
                    ? "bg-emerald-700 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Sussex
              </button>
              <button
                onClick={() => handleFilterClick("hq")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeFilter === "hq" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Headquarters
              </button>
              <button
                onClick={() => handleFilterClick("trade")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeFilter === "trade"
                    ? "bg-emerald-700 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Architect / Trade
              </button>
            </div>
          </div>
        </section>

        {/* What to Expect */}
        <section className="mx-auto max-w-3xl space-y-8">
          <div className="space-y-4 text-center">
            <h2 className="text-4xl font-light tracking-tight text-slate-900">What to Expect</h2>
            <p className="text-base font-light leading-relaxed text-slate-600">
              A typical showroom visit takes 45-90 minutes and includes:
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-900">During Your Visit</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="text-emerald-700">•</span>
                  <span>View full-size product samples and working examples</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-700">•</span>
                  <span>Explore glazing options, hardware finishes, and colours</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-700">•</span>
                  <span>Discuss your project with design consultants</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-700">•</span>
                  <span>Understand next steps: survey, quote, installation</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-700">•</span>
                  <span>Take home sample swatches and brochures</span>
                </li>
              </ul>
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-900">Bring With You</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="text-emerald-700">•</span>
                  <span>Photos of your property (exterior and existing windows)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-700">•</span>
                  <span>Rough measurements (if available)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-700">•</span>
                  <span>Planning constraints or conservation area documents</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-700">•</span>
                  <span>Inspiration images or design references</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-700">•</span>
                  <span>Your budget expectations (helps us guide you)</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Showroom Cards */}
        <section className="space-y-8">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Our Locations</p>
            <h2 className="text-4xl font-light tracking-tight text-slate-900 md:text-5xl">Visit a showroom near you</h2>
            <p className="text-base font-light leading-relaxed text-slate-600">
              {filteredShowrooms.length === showrooms.length
                ? "From our manufacturing headquarters to locations across the Southeast and London"
                : `Showing ${filteredShowrooms.length} location${filteredShowrooms.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="space-y-8">
            {filteredShowrooms.map((showroom, idx) => {
              const showroomImage = showroomImages[idx] || showroomImages[idx % showroomImages.length];
              const isHighlighted = highlightedShowroom === showroom.id;

              return (
                <article
                  key={showroom.id}
                  id={`showroom-${showroom.id}`}
                  className={`image-slot scroll-mt-32 overflow-hidden rounded-2xl border shadow-sm transition ${
                    isHighlighted
                      ? "border-emerald-700 bg-emerald-50/30 ring-4 ring-emerald-700/20"
                      : showroom.isHQ
                      ? "border-emerald-700/30 bg-gradient-to-br from-emerald-50/50 to-white"
                      : "border-slate-200 bg-white hover:shadow-lg"
                  }`}
                >
                  <div className="grid gap-0 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)]">
                    {/* Image */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 md:aspect-auto">
                      <ImageSlot
                        slotId={`showrooms-${showroom.id}`}
                        label={`${showroom.name} Showroom`}
                        aspectRatio="aspect-[4/3]"
                        size="md"
                        overlayPosition="top-right"
                      />
                      {/* HQ Badge */}
                      {showroom.isHQ && (
                        <div className="absolute top-4 left-4 rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
                          Headquarters
                        </div>
                      )}
                      {/* Trade Badge */}
                      {showroom.isTrade && (
                        <div className="absolute top-4 left-4 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
                          Trade & Architects
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="space-y-6 p-8">
                      {/* Header */}
                      <div className="space-y-2 border-b border-slate-100 pb-4">
                        <h3 className="text-2xl font-semibold text-slate-900">{showroom.name}</h3>
                        <p className="text-sm font-medium text-emerald-700">{showroom.positioning}</p>
                        <p className="text-sm leading-relaxed text-slate-600">{showroom.description}</p>
                      </div>

                      {/* Contact Info */}
                      <div className="grid gap-3 text-sm md:grid-cols-2">
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <svg
                              className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                            <div>
                              <p className="text-slate-700">{showroom.address}</p>
                              <p className="text-slate-500">{showroom.postcode}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <svg
                              className="h-4 w-4 flex-shrink-0 text-slate-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                              />
                            </svg>
                            <a
                              href={`tel:${showroom.phone.replace(/\s/g, "")}`}
                              className="text-emerald-700 hover:underline"
                            >
                              {showroom.phone}
                            </a>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <svg
                              className="h-4 w-4 flex-shrink-0 text-slate-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <span className="text-slate-700">{showroom.hours}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <svg
                              className="h-4 w-4 flex-shrink-0 text-slate-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                            <a href={`mailto:${showroom.email}`} className="text-emerald-700 hover:underline">
                              {showroom.email}
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Features */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Available Here</h4>
                        <div className="flex flex-wrap gap-2">
                          {showroom.features.map((feature) => (
                            <span
                              key={feature}
                              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* CTAs */}
                      <div className="flex flex-wrap gap-3 pt-2">
                        <button
                          onClick={() => setShowBookingModal(true)}
                          className="rounded-full bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
                        >
                          Book a Visit
                        </button>
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(showroom.address + " " + showroom.postcode)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border-2 border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-700 hover:text-emerald-700"
                        >
                          Get Directions
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
        <section className="space-y-8">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Our Approach</p>
            <h2 className="text-4xl font-light tracking-tight text-slate-900 md:text-5xl">
              Manufacturing excellence, nationwide service
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-6 text-center">
              <div className="mb-4 flex justify-center">
                <svg className="h-10 w-10 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-900">Manufacturing Excellence</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                CNC machinery and traditional hand-finishing at our Crowborough headquarters
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-6 text-center">
              <div className="mb-4 flex justify-center">
                <svg className="h-10 w-10 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-900">Partner Network</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Trusted manufacturing partners meeting our exacting quality standards
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-6 text-center">
              <div className="mb-4 flex justify-center">
                <svg className="h-10 w-10 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-900">Nationwide Service</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Coordinating surveys, installations, and aftercare across the UK
              </p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-6 text-center">
              <div className="mb-4 flex justify-center">
                <svg className="h-10 w-10 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-slate-900">Expert Guidance</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Trained consultants understanding heritage buildings and modern performance
              </p>
            </article>
          </div>

          {/* Supporting image */}
          <ImageSlot
            slotId="showrooms-manufacturing"
            label="Manufacturing / Workshop"
            aspectRatio="aspect-[21/9]"
            size="xl"
          />
        </section>

        {/* Nationwide Support */}
        <section className="rounded-2xl bg-slate-900 px-8 py-16 text-white md:px-12 md:py-20">
          <div className="mx-auto max-w-3xl space-y-8 text-center">
            <div className="space-y-4">
              <h2 className="text-4xl font-light tracking-tight md:text-5xl">Can't visit a showroom?</h2>
              <p className="text-base font-light leading-relaxed text-slate-300">
                We offer virtual consultations, sample delivery, and comprehensive project support wherever you are in the UK.
                No local showroom? We'll still provide the same expert guidance remotely.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/wealden-joinery/contact"
                className="rounded-full bg-white px-8 py-4 text-sm font-semibold text-slate-900 transition hover:scale-[1.02] hover:bg-slate-100"
              >
                Request a Virtual Consultation
              </Link>
              <Link
                href="/wealden-joinery/contact#enquiry-form"
                className="rounded-full border-2 border-white/30 bg-white/10 px-8 py-4 text-sm font-semibold text-white transition hover:scale-[1.02] hover:bg-white/20"
              >
                Get an Estimate
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
