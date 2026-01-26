"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ImageSlot } from "../../_components/image-slot";

interface ContactContentProps {
  heroImage: { src: string; alt: string } | null;
}

export function ContactContent({ heroImage }: ContactContentProps) {
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    postcode: "",
    projectType: "",
    message: "",
    preferredContact: "email",
    preferredTime: "",
    budgetRange: "",
    consent: false,
  });

  // Customer photo uploads (separate from placeholder uploads)
  const [customerPhotos, setCustomerPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);

  // Validation state
  const [emailError, setEmailError] = useState("");
  const [postcodeError, setPostcodeError] = useState("");

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Validate email
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError("");
    }
  };

  // Validate UK postcode
  const validatePostcode = (postcode: string) => {
    const postcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;
    if (postcode && !postcodeRegex.test(postcode)) {
      setPostcodeError("Please enter a valid UK postcode");
    } else {
      setPostcodeError("");
    }
  };

  // Handle customer photo uploads
  const handleCustomerPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
      return validTypes.includes(file.type) && file.size < 10 * 1024 * 1024; // 10MB max
    });

    if (validFiles.length > 0) {
      const newPhotos = [...customerPhotos, ...validFiles].slice(0, 10); // Max 10 photos
      setCustomerPhotos(newPhotos);

      // Generate preview URLs
      const newPreviewUrls = validFiles.map(file => URL.createObjectURL(file));
      setPhotoPreviewUrls([...photoPreviewUrls, ...newPreviewUrls].slice(0, 10));
    }
  };

  // Remove customer photo
  const removeCustomerPhoto = (index: number) => {
    const newPhotos = customerPhotos.filter((_, i) => i !== index);
    const newPreviewUrls = photoPreviewUrls.filter((_, i) => i !== index);
    
    // Revoke object URL to prevent memory leaks
    URL.revokeObjectURL(photoPreviewUrls[index]);
    
    setCustomerPhotos(newPhotos);
    setPhotoPreviewUrls(newPreviewUrls);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Final validation
    if (emailError || postcodeError) {
      setSubmitError("Please fix validation errors before submitting");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const photoNote = customerPhotos.length
        ? `\n\nCustomer attached ${customerPhotos.length} photo(s): ${customerPhotos.map((photo) => photo.name).join(", ")}`
        : "";

      const response = await fetch("/api/public/tenant/wealden-joinery/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "contact_form",
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          postcode: formData.postcode,
          projectType: formData.projectType,
          message: `${formData.message}${photoNote}`,
          preferredContact: formData.preferredContact,
          preferredTime: formData.preferredTime,
          budgetRange: formData.budgetRange,
          consent: formData.consent,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit enquiry");
      }

      setSubmitSuccess(true);
      // Reset form
      setFormData({
        name: "",
        email: "",
        phone: "",
        postcode: "",
        projectType: "",
        message: "",
        preferredContact: "email",
        preferredTime: "",
        budgetRange: "",
        consent: false,
      });
      setCustomerPhotos([]);
      setPhotoPreviewUrls([]);
    } catch (error) {
      console.error("Form submission error:", error);
      setSubmitError("Failed to submit enquiry. Please try again or call us directly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trust items for hero strip
  const trustItems = [
    { label: "Reply within 24 hours", sublabel: "Every enquiry" },
    { label: "Free site survey", sublabel: "No obligation" },
    { label: "Detailed quote with options", sublabel: "Transparent pricing" },
  ];

  // Timeline steps - comprehensive process
  const timelineSteps = [
    { 
      number: 1, 
      title: "Enquiry Response (Within 24 Hours)", 
      description: "We acknowledge your enquiry and arrange initial phone call to discuss project scope, property type, timescales, and provisional appointment for site survey." 
    },
    { 
      number: 2, 
      title: "Free Site Survey (1–2 Hours On-Site)", 
      description: "Our surveyor visits to measure openings with laser accuracy, photograph existing details, assess structural constraints, and advise on conservation/planning requirements. You receive measured drawings and technical recommendations." 
    },
    { 
      number: 3, 
      title: "Detailed Quotation (5–7 Days After Survey)", 
      description: "Comprehensive quotation with itemized pricing, alternative options (vacuum glazing, dual-colour finishes), thermal performance data (U-values), lead time (typically 10–14 weeks), payment terms, and full guarantee terms. Quotations valid for 90 days." 
    },
    { 
      number: 4, 
      title: "Design Refinement & Order", 
      description: "Adjust glazing bar patterns, paint colours, hardware finishes after reviewing samples. We provide physical samples, CAD elevation drawings, and alternative quotations if needed. Order confirmation includes manufacture schedule and installation appointment." 
    },
    { 
      number: 5, 
      title: "Manufacture (8–12 Weeks)", 
      description: "Precision CNC machining, hand finishing, factory paint application (3-coat system), glazing with sealed units, and quality inspection. We send progress photos at key milestones." 
    },
    { 
      number: 6, 
      title: "Installation (1–5 Days)", 
      description: "Dust sheet protection, careful removal of existing windows/doors, installation with correct fixing and sealing, adjustment for smooth operation, waste removal, glass cleaning, and demonstration. Building Control inspection arranged if required." 
    },
    { 
      number: 7, 
      title: "Aftercare (Lifetime Relationship)", 
      description: "6-week check-in call, 12-month inspection, maintenance guide provided, lifetime technical support. Guarantees remain valid for life of property—transferable to new owners." 
    },
  ];

  return (
    <div className="space-y-16">
      {/* Hero with Trust Strip */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-12 md:px-10 md:py-16">
          <div className="mx-auto max-w-4xl space-y-8">
            {/* Hero Content */}
            <div className="space-y-6 text-center">
              <p className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Get in Touch
              </p>
              <h1 className="text-4xl font-light leading-tight tracking-tight text-slate-900 md:text-6xl">
                Contact Wealden Joinery
              </h1>
              <p className="text-lg leading-relaxed text-slate-600">
                We reply within 24 hours and can arrange a free site survey.
              </p>
            </div>

            {/* Optional Hero Image */}
            <div className="relative mx-auto max-w-2xl">
              <ImageSlot
                slotId="contact-hero"
                label="Contact Hero Image"
                aspectRatio="aspect-[21/9]"
                size="lg"
              />
            </div>

            {/* Trust Strip */}
            <div className="grid gap-6 border-t border-slate-200 pt-8 text-center md:grid-cols-3">
              {trustItems.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <p className="text-base font-semibold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-600">{item.sublabel}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Two-Column Layout: Details + Form */}
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        {/* Left Column: Contact Details + What Happens Next */}
        <div className="space-y-6">
          {/* Contact Details */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Contact Details</h3>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="font-semibold text-slate-900">Phone</p>
                <a
                  href="tel:+441892852544"
                  className="text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  01892 852544
                </a>
                <p className="mt-1 text-xs text-slate-600">Mon–Fri 8am–5pm, Sat 9am–1pm</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Email</p>
                <a
                  href="mailto:martin@wealdenjoinery.com"
                  className="text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  martin@wealdenjoinery.com
                </a>
                <p className="mt-1 text-xs text-slate-600">We respond within 24 hours</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Headquarters</p>
                <address className="not-italic text-slate-700">
                  Wealden Joinery
                  <br />
                  Unit 1 Lews Farm, Sherrifs Lane
                  <br />
                  Rotherfield, East Sussex TN6 3JE
                </address>
              </div>
            </div>
          </div>

          {/* Visit Showrooms */}
          <div className="rounded-xl border border-emerald-700 bg-emerald-50 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Visit Our Showrooms</h3>
            <p className="mt-2 text-sm text-slate-700">
              See our products in person at one of our showrooms across the UK. From Crowborough to London.
            </p>
            <Link
              href="/wealden-joinery/showrooms"
              className="mt-4 inline-flex rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              View All Showrooms
            </Link>
          </div>

          {/* What Happens Next Timeline */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">What happens next?</h3>
            <div className="mt-6 space-y-4">
              {timelineSteps.map((step) => (
                <div key={step.number} className="flex gap-4">
                  {/* Number Badge */}
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-semibold text-white">
                    {step.number}
                  </div>
                  {/* Content */}
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                    <p className="text-xs text-slate-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Contact Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h3 className="mb-6 text-xl font-semibold text-slate-900">Send us a message</h3>

          {submitSuccess ? (
            <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-700">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-slate-900">Thank you!</h4>
              <p className="text-sm text-slate-700">
                We've received your enquiry and will respond within 24 hours.
              </p>
              <button
                onClick={() => setSubmitSuccess(false)}
                className="text-sm text-emerald-700 hover:underline"
              >
                Send another enquiry
              </button>
            </div>
          ) : (
            <form id="enquiry-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Name & Email */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="name">
                    Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Your full name"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="email">
                    Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      validateEmail(e.target.value);
                    }}
                    onBlur={(e) => validateEmail(e.target.value)}
                    placeholder="your@email.com"
                    className={`w-full rounded-lg border ${
                      emailError ? "border-red-500" : "border-slate-300"
                    } bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100`}
                  />
                  {emailError && <p className="text-xs text-red-600">{emailError}</p>}
                </div>
              </div>

              {/* Phone & Postcode */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="phone">
                    Phone <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="01234 567890"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="postcode">
                    Postcode <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="postcode"
                    name="postcode"
                    required
                    value={formData.postcode}
                    onChange={(e) => {
                      setFormData({ ...formData, postcode: e.target.value });
                      validatePostcode(e.target.value);
                    }}
                    onBlur={(e) => validatePostcode(e.target.value)}
                    placeholder="TN6 3XX"
                    className={`w-full rounded-lg border ${
                      postcodeError ? "border-red-500" : "border-slate-300"
                    } bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100`}
                  />
                  {postcodeError && <p className="text-xs text-red-600">{postcodeError}</p>}
                </div>
              </div>

              {/* Project Type */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-800" htmlFor="projectType">
                  What do you need help with? <span className="text-red-600">*</span>
                </label>
                <select
                  id="projectType"
                  name="projectType"
                  required
                  value={formData.projectType}
                  onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Select an option</option>
                  <option value="Sash Windows">Sash Windows</option>
                  <option value="Casement Windows">Casement Windows</option>
                  <option value="Entrance Doors">Entrance Doors</option>
                  <option value="French Doors">French Doors</option>
                  <option value="Sliding / Bi-fold Doors">Sliding / Bi-fold Doors</option>
                  <option value="Alu-Clad Systems">Alu-Clad Systems</option>
                  <option value="Fire Doors">Fire Doors</option>
                  <option value="Mixed / Not Sure">Mixed / Not Sure</option>
                </select>
              </div>

              {/* Preferred Contact Method & Time */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="preferredContact">
                    Preferred contact method <span className="text-slate-500">(optional)</span>
                  </label>
                  <select
                    id="preferredContact"
                    name="preferredContact"
                    value={formData.preferredContact}
                    onChange={(e) => setFormData({ ...formData, preferredContact: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="either">Either</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="preferredTime">
                    Preferred appointment time <span className="text-slate-500">(optional)</span>
                  </label>
                  <select
                    id="preferredTime"
                    name="preferredTime"
                    value={formData.preferredTime}
                    onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Any time</option>
                    <option value="morning">Morning (9am–12pm)</option>
                    <option value="afternoon">Afternoon (12pm–5pm)</option>
                    <option value="weekend">Weekend</option>
                  </select>
                </div>
              </div>

              {/* Budget Range */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-800" htmlFor="budgetRange">
                  Budget range <span className="text-slate-500">(optional, helps us tailor options)</span>
                </label>
                <select
                  id="budgetRange"
                  name="budgetRange"
                  value={formData.budgetRange}
                  onChange={(e) => setFormData({ ...formData, budgetRange: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Prefer not to say</option>
                  <option value="under-10k">Under £10,000</option>
                  <option value="10k-25k">£10,000 – £25,000</option>
                  <option value="25k-50k">£25,000 – £50,000</option>
                  <option value="50k-100k">£50,000 – £100,000</option>
                  <option value="over-100k">Over £100,000</option>
                </select>
              </div>

              {/* Message */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-800" htmlFor="message">
                  Message / project details <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Tell us about your project, property type, timescales, any heritage constraints..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              {/* Customer Photo Upload */}
              <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <label className="text-sm font-semibold text-slate-800">
                  Add photos <span className="text-slate-500">(optional — helps us quote faster)</span>
                </label>
                <p className="text-xs text-slate-600">
                  Upload photos of your current windows/doors, property, or sketches. Max 10 images (JPG, PNG, WEBP, HEIC).
                </p>
                
                <input
                  type="file"
                  id="customerPhotos"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  multiple
                  onChange={handleCustomerPhotoUpload}
                  className="hidden"
                />
                
                <label
                  htmlFor="customerPhotos"
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Choose Photos ({customerPhotos.length}/10)
                </label>

                {/* Photo Previews */}
                {photoPreviewUrls.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {photoPreviewUrls.map((url, idx) => (
                      <div key={idx} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200">
                        <Image
                          src={url}
                          alt={`Upload ${idx + 1}`}
                          fill
                          className="object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeCustomerPhoto(idx)}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white opacity-0 transition group-hover:opacity-100"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Consent */}
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="consent"
                  required
                  checked={formData.consent}
                  onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                  className="mt-1 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                />
                <span>
                  I consent to Wealden Joinery storing my details to respond to this enquiry. We will never share your data.
                  See our{" "}
                  <Link href="/wealden-joinery/privacy" className="text-emerald-700 underline">
                    privacy policy
                  </Link>
                  .
                </span>
              </label>

              {/* Privacy Note */}
              <p className="text-center text-xs text-slate-600">
                No spam. Your details are only used to respond to your enquiry.
              </p>

              {/* Submit Error */}
              {submitError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {submitError}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !!emailError || !!postcodeError}
                className="w-full rounded-full bg-emerald-700 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-700/10 transition hover:scale-[1.02] hover:bg-emerald-800 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSubmitting ? "Sending..." : "Send Enquiry"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Estimator CTA - Secondary Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
            <svg className="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-2xl font-semibold text-slate-900">Prefer to start with an estimate?</h3>
          <p className="text-sm leading-relaxed text-slate-600">
            Ballpark pricing in minutes. Use our AI-powered estimator to get an instant figure tailored to your property and spec.
          </p>
          <Link
            href="/wealden-joinery/estimate"
            className="inline-flex rounded-full bg-emerald-700 px-6 py-3 text-base font-semibold text-white transition hover:scale-[1.02] hover:bg-emerald-800"
          >
            Get an Instant Estimate
          </Link>
        </div>
      </section>
    </div>
  );
}
