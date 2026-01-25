"use client";

import { useMemo, useState } from "react";
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
  "Sash windows",
  "Casement / flush casement",
  "Whole-house replacement",
  "Extension / new build",
  "Conservation / listed building",
  "Other",
];

const trustBullets = [
  "Accoya® option with 50-year guarantee",
  "Heritage expertise for conservation approvals",
  "Secure locking options to PAS 24",
  "UK craftsmanship with factory-finished paint",
  "Transparent, itemised quotations",
];

const faqItems = [
  {
    q: "How much do timber windows cost?",
    a: "Costs vary by size, glazing choice, and detailing. We provide an itemised quote after a survey so you can compare options clearly.",
  },
  {
    q: "What are typical lead times?",
    a: "Most projects are manufactured in 8–12 weeks after survey and specification sign-off. We confirm lead times in writing with your quote.",
  },
  {
    q: "Do I need planning or conservation approval?",
    a: "Listed buildings and conservation areas may require consent. We advise on suitable profiles and glazing to maximise approval success.",
  },
  {
    q: "How often do timber windows need repainting?",
    a: "Factory-applied microporous finishes typically last 8–10 years before a light recoat, depending on exposure.",
  },
  {
    q: "Do you offer Accoya timber?",
    a: "Yes. Accoya® is highly stable, sustainably sourced, and backed by a 50-year warranty against rot.",
  },
  {
    q: "Can you use slim or vacuum glazing?",
    a: "Yes. Slimline and vacuum glazing can achieve modern thermal performance while preserving heritage sightlines.",
  },
  {
    q: "Are your windows secure?",
    a: "We specify multi-point locking and hardware to meet PAS 24 when required. Security is built into the design.",
  },
  {
    q: "What does the installation process involve?",
    a: "We survey, manufacture, and install with dedicated teams. Your project manager coordinates access, protection, and aftercare.",
  },
  {
    q: "Can you match existing profiles and glazing bars?",
    a: "Yes. We survey existing details and reproduce profiles to maintain the character of the property.",
  },
];

export default function TimberWindowsClient() {
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
    document.getElementById("timber-windows-form")?.scrollIntoView({ behavior: "smooth" });
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
      const payload = new FormData();
      payload.append("source", "PPC Timber Windows");
      payload.append("tenantId", "wealden-joinery");
      payload.append("name", formState.name);
      payload.append("email", formState.email);
      payload.append("phone", formState.phone);
      payload.append("postcode", formState.postcode);
      payload.append("projectType", formState.projectType);
      payload.append("message", formState.message);
      payload.append("consent", String(formState.consent));

      const response = await fetch("/api/tenant/wealden-joinery/leads", {
        method: "POST",
        body: payload,
      });

      if (!response.ok) throw new Error("Failed to submit");

      setSubmitState("success");
      wealdenTrack.lead({ content_name: "Timber Windows" });
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
      console.error("[timber-windows] lead submit failed", error);
      setSubmitState("error");
      setSubmitError("We could not submit your enquiry. Please try again or call us.");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <section className={components.sectionCompact}>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className={designSystem.typography.caption}>Timber Windows</p>
              <h1 className={designSystem.typography.hero}>Timber Windows</h1>
              <p className={`${designSystem.typography.body} max-w-xl`}>
                Premium timber windows designed, manufactured, and installed in the UK. Heritage craft meets modern
                performance for sash and flush casement projects.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
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
            slotId="timber-windows-hero"
            label="Timber Windows Hero"
            aspectRatio={designSystem.images.portrait}
            size="xl"
            imageContext="hero"
            allowUpload={canEditImages}
          />
        </div>
      </section>

      {/* Trust / Reviews */}
      <section className={`${components.contentSection} bg-slate-50`}>
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <p className={designSystem.typography.caption}>Trusted craftsmanship</p>
            <h2 className={designSystem.typography.h2}>Heritage confidence with modern performance</h2>
            <p className={designSystem.typography.body}>
              We specialise in timber windows for listed buildings, conservation areas, and architect-led homes. Every
              project includes detailed surveying, specification guidance, and a dedicated install team.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-900">Reviews</p>
            <p className="mt-2 text-sm text-slate-600">
              Customer reviews will be added here. For now, this space is reserved for future verified feedback.
            </p>
            <div className="mt-4 space-y-3">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
                  “Review placeholder #{idx}”
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Product Sections */}
      <section className={components.section}>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-4">
            <p className={designSystem.typography.caption}>Sash Windows</p>
            <h2 className={designSystem.typography.h2}>Timber Sash Windows</h2>
            <p className={designSystem.typography.body}>
              Traditional box sash or spring balance profiles, matched to heritage detailing with slimline or vacuum
              glazing options.
            </p>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>• Conservation-friendly sightlines</li>
              <li>• Acoustic and thermal upgrades</li>
              <li>• Optional decorative glazing bars</li>
            </ul>
          </div>
          <ImageSlot
            slotId="timber-windows-sash"
            label="Timber Sash Windows"
            aspectRatio={designSystem.images.portrait}
            size="lg"
            allowUpload={canEditImages}
          />
        </div>
      </section>

      <section className={`${components.section} bg-slate-50`}>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <ImageSlot
            slotId="timber-windows-casement"
            label="Flush Casement Windows"
            aspectRatio={designSystem.images.portrait}
            size="lg"
            allowUpload={canEditImages}
          />
          <div className="space-y-4">
            <p className={designSystem.typography.caption}>Casement</p>
            <h2 className={designSystem.typography.h2}>Timber Casement / Flush Casement</h2>
            <p className={designSystem.typography.body}>
              Clean, flush profiles for contemporary builds or refined period projects. Highly efficient, secure, and
              engineered for longevity.
            </p>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>• PAS 24 security hardware</li>
              <li>• Double or vacuum glazing</li>
              <li>• Factory-applied paint finishes</li>
            </ul>
          </div>
        </div>
      </section>

      <section className={components.section}>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="space-y-4">
            <p className={designSystem.typography.caption}>Why timber?</p>
            <h2 className={designSystem.typography.h2}>Why timber?</h2>
            <p className={designSystem.typography.body}>
              Timber delivers unmatched aesthetics, repairability, and low embodied carbon. With modern coatings and
              glazing, it performs at today’s standards while remaining true to heritage architecture.
            </p>
            <ul className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <li>• Excellent thermal efficiency</li>
              <li>• Long service life with maintenance</li>
              <li>• Naturally repairable</li>
              <li>• Sustainable, renewable material</li>
            </ul>
          </div>
          <ImageSlot
            slotId="timber-windows-why"
            label="Timber detail"
            aspectRatio={designSystem.images.landscape}
            size="lg"
            allowUpload={canEditImages}
          />
        </div>
      </section>

      <section className={`${components.section} bg-slate-50`}>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <ImageSlot
            slotId="timber-windows-doors"
            label="Timber Doors"
            aspectRatio={designSystem.images.landscape}
            size="lg"
            allowUpload={canEditImages}
          />
          <div className="space-y-4">
            <p className={designSystem.typography.caption}>Also available</p>
            <h2 className={designSystem.typography.h2}>Timber Doors</h2>
            <p className={designSystem.typography.body}>
              Complete the façade with matching timber doors, including front doors, bi-folds, and heritage designs.
            </p>
            <div className={designSystem.typography.bodySmall}>Ask about matching timber doors in your enquiry.</div>
          </div>
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

      {/* Lead Form */}
      <section id="timber-windows-form" className={`${components.sectionNarrow} bg-white`}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm md:p-8">
          <div className="space-y-4">
            <p className={designSystem.typography.caption}>Get a Quote</p>
            <h2 className={designSystem.typography.h2}>Request your timber windows quote</h2>
            <p className={designSystem.typography.bodySmall}>
              Share your project details and we will respond with next steps, timings, and a tailored quotation.
            </p>
          </div>

          <form className="mt-8 grid gap-4" onSubmit={handleSubmit} data-form="timber-windows">
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
                data-form="timber-windows"
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
          <h2 className={designSystem.typography.h2}>Timber windows FAQs</h2>
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
            Let’s plan your timber windows
          </h2>
          <p className={`${designSystem.typography.body} max-w-2xl mx-auto text-white/80`}>
            Speak with our team about design options, performance upgrades, and timelines.
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
