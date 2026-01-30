"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/lib/use-current-user";
import { ImageSlot } from "../_components/image-slot";
import { wealdenTrack } from "../_components/tracking";
import { components, designSystem } from "../_lib/design-system";

type FormState = {
  name: string;
  email: string;
  phone: string;
  postcode: string;
  projectType: string;
  message: string;
  consent: boolean;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

const projectTypes = [
  "Entrance / front door",
  "French doors",
  "Sliding doors",
  "Bi-fold doors",
  "Garden / patio doors",
  "Heritage / listed building",
  "Other",
];

const trustBullets = [
  "PAS 24 security options for entrance doors",
  "Engineered timber cores for stability",
  "Heritage detailing for period homes",
  "Factory-finished paint for long life",
  "Transparent, itemised quotations",
];

const guaranteeHighlights = [
  { value: "30yr", label: "Rot & Decay" },
  { value: "10yr", label: "Workmanship" },
  { value: "10yr", label: "Hardware" },
];

const certificationLogos = [
  { src: "/wealden/FENSA-Logo.png", alt: "FENSA" },
  { src: "/wealden/Pas-24-Logo.png", alt: "PAS 24" },
  { src: "/wealden/FSC-Logo.png", alt: "FSC" },
  { src: "/wealden/GGF-Logo.png", alt: "GGF" },
];

const faqItems = [
  {
    q: "How much do timber doors cost?",
    a: "Costs depend on the opening size, hardware, glazing, and detailing. We provide a fully itemised quote after survey so you can compare options clearly.",
  },
  {
    q: "What are typical lead times?",
    a: "Most timber door projects are manufactured in 8–12 weeks after survey and specification sign-off. We confirm lead times in writing with your quote.",
  },
  {
    q: "Are your entrance doors secure?",
    a: "Yes. We specify multi-point locking, laminated safety glass, and PAS 24 security options where required.",
  },
  {
    q: "Do you offer low thresholds for accessibility?",
    a: "Yes. We can specify low or flush thresholds to support Part M requirements where appropriate.",
  },
  {
    q: "Can you match existing door styles?",
    a: "Yes. We survey existing details and reproduce profiles to maintain the character of the property.",
  },
  {
    q: "Which door types do you make?",
    a: "We design and manufacture entrance doors, French doors, sliding doors, and bi-fold doors tailored to each opening.",
  },
  {
    q: "How often do timber doors need repainting?",
    a: "Factory-applied microporous finishes typically last 8–10 years before a light recoat, depending on exposure.",
  },
  {
    q: "Do you offer Accoya timber?",
    a: "Yes. Accoya® is highly stable, sustainably sourced, and backed by a 50-year warranty against rot.",
  },
  {
    q: "What does the installation process involve?",
    a: "We survey, manufacture, and install with dedicated teams. Your project manager coordinates access, protection, and aftercare.",
  },
];

export default function TimberDoorsClient() {
  const { user } = useCurrentUser();
  const role = String(user?.role || "").toLowerCase();
  const canEditImages = Boolean(user?.id) && (!role || ["admin", "owner", "editor"].includes(role));

  const [formState, setFormState] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    postcode: "",
    projectType: "",
    message: "",
    consent: false,
  });

  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [postcodeError, setPostcodeError] = useState<string | null>(null);

  const faqJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    }),
    [],
  );

  const validateEmail = (value: string) => {
    if (!value) return null;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(value) ? null : "Please enter a valid email address";
  };

  const validatePostcode = (value: string) => {
    if (!value) return null;
    const regex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;
    return regex.test(value) ? null : "Please enter a valid UK postcode";
  };

  const scrollToForm = () => {
    document.getElementById("timber-doors-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);

    const nextEmailError = validateEmail(formState.email);
    const nextPostcodeError = validatePostcode(formState.postcode);
    setEmailError(nextEmailError);
    setPostcodeError(nextPostcodeError);

    if (!formState.name || !formState.email || !formState.phone || !formState.postcode || !formState.projectType) {
      setSubmitError("Please complete all required fields.");
      return;
    }
    if (nextEmailError || nextPostcodeError) {
      setSubmitError("Please fix validation errors before submitting.");
      return;
    }
    if (!formState.consent) {
      setSubmitError("Please confirm consent so we can respond.");
      return;
    }

    setSubmitState("submitting");

    try {
      const response = await fetch("/api/public/tenant/wealden-joinery/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "PPC Timber Doors",
          name: formState.name,
          email: formState.email,
          phone: formState.phone,
          postcode: formState.postcode,
          projectType: formState.projectType,
          message: formState.message,
          consent: formState.consent,
        }),
      });

      if (!response.ok) throw new Error("Failed to submit");

      setSubmitState("success");
      wealdenTrack.lead({ content_name: "Timber Doors" });
      setFormState({
        name: "",
        email: "",
        phone: "",
        postcode: "",
        projectType: "",
        message: "",
        consent: false,
      });
    } catch (error) {
      console.error("[timber-doors] lead submit failed", error);
      setSubmitState("error");
      setSubmitError("We could not submit your enquiry. Please try again or call us.");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Script src="https://www.googletagmanager.com/gtag/js?id=AW-17600349257" strategy="afterInteractive" />
      <Script
        id="google-ads-tag"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'AW-17600349257');`,
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <section className={components.sectionCompact}>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
          <div className="text-sm font-medium text-slate-700">
            Ready to price your timber doors? Get a fast, itemised quote.
          </div>
          <Button
            type="button"
            className={designSystem.buttons.primary}
            onClick={scrollToForm}
            data-cta="top-cta"
          >
            Get a Quote
          </Button>
        </div>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <div>
                <Image
                  src="/lignum-windows-logo.jpg"
                  alt="Lignum Windows by Wealden Joinery"
                  width={840}
                  height={240}
                  className="h-40 w-auto"
                  priority
                />
              </div>
              <p className={designSystem.typography.caption}>Timber Doors</p>
              <h1 className={designSystem.typography.hero}>Timber Doors</h1>
              <p className={`${designSystem.typography.body} max-w-xl`}>
                Premium timber doors designed, manufactured, and installed in the UK. Secure entrance doors and elegant
                garden doors that balance heritage character with modern performance.
              </p>
              <p className="text-sm text-slate-600 max-w-xl">
                Serving Sussex, Kent & the South East – including Sevenoaks, Brighton, Eastbourne, Tunbridge Wells and
                surrounding areas.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col items-start gap-2">
                <Button
                  type="button"
                  className={designSystem.buttons.primary}
                  onClick={scrollToForm}
                  data-cta="consultation"
                >
                  Book a Timber Door Design Consultation
                </Button>
                <div className="text-xs text-slate-500">Free survey • No obligation • Sussex & Kent</div>
              </div>
              <Button
                type="button"
                className={designSystem.buttons.primary}
                onClick={scrollToForm}
                data-cta="quote"
              >
                Get a Quote
              </Button>
              <Button
                type="button"
                className={designSystem.buttons.secondary}
                onClick={scrollToForm}
                data-cta="showroom"
              >
                Request a Callback
              </Button>
            </div>
            <div className="grid gap-3 pt-6 md:grid-cols-2">
              {trustBullets.map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <ImageSlot
            slotId="timber-doors-hero"
            label="Timber Doors Hero"
            aspectRatio={designSystem.images.portrait}
            size="xl"
            imageContext="hero"
            allowUpload={canEditImages}
          />
        </div>
      </section>

      {/* Qualification */}
      <section className={`${components.contentSection} bg-white`}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8">
          <div className="space-y-4">
            <h2 className={designSystem.typography.h3}>Is Lignum right for you?</h2>
            <p className={designSystem.typography.body}>
              We specialise in bespoke, made-to-measure timber doors for period, heritage and high-quality homes across
              Sussex and Kent.
            </p>
            <ul className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
              <li>• Bespoke, made to measure (not off-the-shelf)</li>
              <li>• Timber doors only (not composite or uPVC)</li>
              <li>• Designed, manufactured and installed</li>
              <li>• Entrance, French, sliding & bi-fold options</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Guarantees + Certifications */}
      <section className={`${components.contentSection} bg-white`}>
        <div className="grid gap-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8">
          <div className="grid gap-6 md:grid-cols-3">
            {guaranteeHighlights.map((item) => (
              <div key={item.label} className="text-center">
                <div className="text-4xl font-light text-slate-900 md:text-5xl">{item.value}</div>
                <div className="mt-2 text-xs uppercase tracking-wider text-slate-500">{item.label}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            {certificationLogos.map((logo) => (
              <div key={logo.alt} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <Image src={logo.src} alt={logo.alt} width={140} height={48} className="h-9 w-auto object-contain" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / Reviews */}
      <section className={`${components.contentSection} bg-slate-50`}>
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <p className={designSystem.typography.caption}>Trusted craftsmanship</p>
            <h2 className={designSystem.typography.h2}>Security, style, and heritage detail</h2>
            <p className={designSystem.typography.body}>
              We design timber doors for listed buildings, conservation areas, and architect-led homes. Every project
              includes detailed surveying, specification guidance, and a dedicated install team.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-900">Reviews</p>
            <p className="mt-2 text-sm text-slate-600">Verified customer feedback from recent timber door projects.</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-800">All round excellence!</div>
                  <div className="text-amber-500" aria-label="5 out of 5 stars">★★★★★</div>
                </div>
                <p className="mt-2">
                  Very pleased with our new front door and French doors; it was so good to be able to have real wood as
                  opposed to uPVC and the talented fitters were friendly and very careful. Everything was delivered and
                  fitted on time as arranged. Many thanks to Martin and the team.
                </p>
                <p className="mt-3 text-xs font-semibold text-slate-700">— Sarah H.</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-800">A Transformation</div>
                  <div className="text-amber-500" aria-label="5 out of 5 stars">★★★★★</div>
                </div>
                <p className="mt-2">
                  Super work carried out by thoughtful and efficient staff. The new porch entrance has transformed the
                  look of the house and greatly improved warmth and reduced traffic noise. We were unsure we would see
                  a real difference, but the results were worth every penny.
                </p>
                <p className="mt-3 text-xs font-semibold text-slate-700">— James R.</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-800">Would definitely recommend</div>
                  <div className="text-amber-500" aria-label="5 out of 5 stars">★★★★★</div>
                </div>
                <p className="mt-2">
                  The new door looks great and was fitted rapidly and professionally. Dealing with Wealden Joinery was a
                  pleasure as they are responsive and do what they say they're going to do.
                </p>
                <p className="mt-3 text-xs font-semibold text-slate-700">— Claire M.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className={components.contentSection}>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm text-slate-600">
            “The door craftsmanship and attention to detail was exceptional. The whole process was professional from
            start to finish.”
          </p>
        </div>
      </section>

      {/* Product Sections */}
      <section className={components.section}>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-4">
            <p className={designSystem.typography.caption}>Entrance Doors</p>
            <h2 className={designSystem.typography.h2}>Timber Entrance Doors</h2>
            <p className={designSystem.typography.body}>
              Statement front doors built with engineered timber cores, secure locking, and heritage or contemporary
              styling to match your home.
            </p>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>• PAS 24 security options</li>
              <li>• Bespoke glazing and panel layouts</li>
              <li>• Factory-finished paint system</li>
            </ul>
          </div>
          <ImageSlot
            slotId="timber-doors-entrance"
            label="Timber Entrance Doors"
            aspectRatio={designSystem.images.portrait}
            size="lg"
            allowUpload={canEditImages}
          />
        </div>
      </section>

      <section className={`${components.section} bg-slate-50`}>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <ImageSlot
            slotId="timber-doors-french"
            label="Timber French Doors"
            aspectRatio={designSystem.images.portrait}
            size="lg"
            allowUpload={canEditImages}
          />
          <div className="space-y-4">
            <p className={designSystem.typography.caption}>French Doors</p>
            <h2 className={designSystem.typography.h2}>Timber French Doors</h2>
            <p className={designSystem.typography.body}>
              Classic double doors with slimline glazing bars, low thresholds, and thermal performance upgrades for
              garden or balcony openings.
            </p>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>• Heritage-friendly sightlines</li>
              <li>• Optional low thresholds</li>
              <li>• Multi-point locking hardware</li>
            </ul>
          </div>
        </div>
      </section>

      <section className={components.section}>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-4">
            <p className={designSystem.typography.caption}>Garden Openings</p>
            <h2 className={designSystem.typography.h2}>Sliding & Bi-fold Doors</h2>
            <p className={designSystem.typography.body}>
              Expansive openings with smooth operation, slim framing, and thermal upgrades. Perfect for extensions,
              garden rooms, and open-plan living.
            </p>
            <ul className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <li>• Large glazed panels</li>
              <li>• Flush threshold options</li>
              <li>• Engineered timber stability</li>
              <li>• Secure multi-point locking</li>
            </ul>
          </div>
          <ImageSlot
            slotId="timber-doors-bifold"
            label="Sliding & Bi-fold Doors"
            aspectRatio={designSystem.images.landscape}
            size="lg"
            allowUpload={canEditImages}
          />
        </div>
      </section>

      <section className={`${components.section} bg-slate-50`}>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <ImageSlot
            slotId="timber-doors-why"
            label="Timber door detail"
            aspectRatio={designSystem.images.portrait}
            size="lg"
            allowUpload={canEditImages}
          />
          <div className="space-y-4">
            <p className={designSystem.typography.caption}>Why timber doors?</p>
            <h2 className={designSystem.typography.h2}>Why timber doors?</h2>
            <p className={designSystem.typography.body}>
              Timber delivers unrivalled aesthetics, repairability, and low embodied carbon. With modern coatings,
              threshold systems, and glazing, timber doors perform at today’s standards while retaining heritage charm.
            </p>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>• Excellent thermal performance</li>
              <li>• Long service life with maintenance</li>
              <li>• Naturally repairable</li>
            </ul>
          </div>
        </div>
      </section>

      <section className={components.section}>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-4">
            <p className={designSystem.typography.caption}>Also available</p>
            <h2 className={designSystem.typography.h2}>Timber Windows</h2>
            <p className={designSystem.typography.body}>
              Pair your doors with matching timber windows, including heritage sash and flush casement profiles.
            </p>
            <div className={designSystem.typography.bodySmall}>Ask about matching timber windows in your enquiry.</div>
            <a href="/timber-windows" className="text-sm text-slate-600 underline underline-offset-4">
              Looking for bespoke timber windows? View our timber windows.
            </a>
          </div>
          <ImageSlot
            slotId="timber-doors-windows"
            label="Timber Windows"
            aspectRatio={designSystem.images.portrait}
            size="lg"
            allowUpload={canEditImages}
          />
        </div>
      </section>

      {/* Service Area */}
      <section className={components.section}>
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <p className={designSystem.typography.caption}>Service area</p>
            <h2 className={designSystem.typography.h2}>Serving projects across the UK</h2>
            <p className={designSystem.typography.body}>
              We work across the South East and wider UK for projects that demand exceptional timber craftsmanship. Tell us
              where your property is located and we’ll advise on next steps.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-900">Typical regions</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>• London & South East</li>
              <li>• Home Counties</li>
              <li>• Select projects across the UK</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Repeat CTA */}
      <section className={components.sectionNarrow}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center shadow-sm md:p-8">
          <Button
            type="button"
            className={designSystem.buttons.primary}
            onClick={scrollToForm}
            data-cta="consultation-repeat"
          >
            Book a Timber Door Design Consultation
          </Button>
        </div>
      </section>

      {/* Lead Form */}
      <section id="timber-doors-form" className={`${components.sectionNarrow} bg-white`}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm md:p-8">
          <div className="space-y-4">
            <p className={designSystem.typography.caption}>Get a Quote</p>
            <h2 className={designSystem.typography.h2}>Request your timber doors quote</h2>
            <p className={designSystem.typography.bodySmall}>
              Share your project details and we will respond with next steps, timings, and a tailored quotation.
            </p>
          </div>

          <form className="mt-8 grid gap-4" onSubmit={handleSubmit} data-form="timber-doors">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={designSystem.typography.label}>Name *</label>
                <Input
                  value={formState.name}
                  onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Your name"
                  required
                />
              </div>
              <div>
                <label className={designSystem.typography.label}>Email *</label>
                <Input
                  value={formState.email}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormState((prev) => ({ ...prev, email: value }));
                    setEmailError(validateEmail(value));
                  }}
                  placeholder="name@email.com"
                  required
                />
                {emailError ? <p className="mt-1 text-xs text-red-600">{emailError}</p> : null}
              </div>
              <div>
                <label className={designSystem.typography.label}>Phone *</label>
                <Input
                  value={formState.phone}
                  onChange={(e) => setFormState((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Contact number"
                  required
                />
              </div>
              <div>
                <label className={designSystem.typography.label}>Postcode *</label>
                <Input
                  value={formState.postcode}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormState((prev) => ({ ...prev, postcode: value }));
                    setPostcodeError(validatePostcode(value));
                  }}
                  placeholder="e.g. TN6 3JE"
                  required
                />
                {postcodeError ? <p className="mt-1 text-xs text-red-600">{postcodeError}</p> : null}
              </div>
            </div>

            <div>
              <label className={designSystem.typography.label}>Project type *</label>
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                value={formState.projectType}
                onChange={(e) => setFormState((prev) => ({ ...prev, projectType: e.target.value }))}
                required
              >
                <option value="" disabled>
                  Select a project type
                </option>
                {projectTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={designSystem.typography.label}>Message</label>
              <Textarea
                value={formState.message}
                onChange={(e) => setFormState((prev) => ({ ...prev, message: e.target.value }))}
                placeholder="Tell us about your property, priorities, or timescales"
                rows={4}
              />
            </div>

            <label className="flex items-start gap-3 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={formState.consent}
                onChange={(e) => setFormState((prev) => ({ ...prev, consent: e.target.checked }))}
                className="mt-1"
                required
              />
              I agree to be contacted about my enquiry. We respect your privacy and never share your details.
            </label>

            {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
            {submitState === "success" ? (
              <p className="text-sm text-emerald-700">
                Thank you — we have received your request and will be in touch shortly.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-4">
              <Button
                type="submit"
                className={designSystem.buttons.primary}
                disabled={submitState === "submitting"}
                data-form="timber-doors"
              >
                {submitState === "submitting" ? "Submitting..." : "Submit enquiry"}
              </Button>
              <a href="tel:+441892852544" className={designSystem.buttons.tertiary}>
                Prefer to call? 01892 852544
              </a>
            </div>
          </form>
        </div>
      </section>

      {/* FAQ */}
      <section className={`${components.sectionNarrow} bg-slate-50`}>
        <div className="mb-10 text-center space-y-3">
          <p className={designSystem.typography.caption}>FAQ</p>
          <h2 className={designSystem.typography.h2}>Timber doors FAQs</h2>
        </div>
        <div className="space-y-6">
          {faqItems.map((item) => (
            <div key={item.q} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className={designSystem.typography.h4}>{item.q}</h3>
              <p className={`${designSystem.typography.bodySmall} mt-2`}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className={`bg-slate-900 text-white ${components.section}`}>
        <div className="text-center space-y-6">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/60">Ready to start?</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight text-white">
            Let’s plan your timber doors
          </h2>
          <p className={`${designSystem.typography.body} max-w-2xl mx-auto text-white/80`}>
            Speak with our team about design options, security upgrades, and timelines.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              type="button"
              className="border-2 border-white px-10 py-4 text-sm font-medium uppercase tracking-[0.15em] text-white transition hover:bg-white hover:text-slate-900 rounded-full"
              onClick={scrollToForm}
              data-cta="quote"
            >
              Get a Quote
            </Button>
            <Button
              type="button"
              className="border border-white/20 px-10 py-4 text-sm font-medium uppercase tracking-[0.15em] text-white/70 transition hover:border-white/40 hover:text-white rounded-full"
              onClick={scrollToForm}
              data-cta="showroom"
            >
              Request a Callback
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
