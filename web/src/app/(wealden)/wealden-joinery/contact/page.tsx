import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact Wealden Joinery | Get in Touch",
  description:
    "Contact Wealden Joinery for timber windows and doors. Call, email, or use our online form. Based in Rotherfield, serving Sussex, Kent, and the South East.",
};

export default function ContactPage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-12 md:px-10 md:py-16">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <p className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">Get in Touch</p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">Contact Wealden Joinery</h1>
            <p className="text-lg text-slate-600">
              Ready to discuss your project? Call us, send an email, or use the form below. We'll respond within 24 hours to
              arrange a site survey and initial consultation.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Details & Form Grid */}
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        {/* Contact Details */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900">Contact Details</h3>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="font-semibold text-slate-900">Phone</p>
                <a href="tel:+441892123456" className="text-emerald-700 hover:text-emerald-800 hover:underline">
                  01892 123 456
                </a>
                <p className="mt-1 text-xs text-slate-600">Mon–Fri 8am–5pm, Sat 9am–1pm</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Email</p>
                <a href="mailto:hello@wealdenjoinery.co.uk" className="text-emerald-700 hover:text-emerald-800 hover:underline">
                  hello@wealdenjoinery.co.uk
                </a>
                <p className="mt-1 text-xs text-slate-600">We respond within 24 hours</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Workshop</p>
                <address className="not-italic text-slate-700">
                  Wealden Joinery
                  <br />
                  Rotherfield, East Sussex
                  <br />
                  TN6 (Full address on request)
                </address>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">What happens next?</h3>
            <ol className="mt-4 space-y-3 text-sm text-slate-700">
              <li className="flex gap-2">
                <span className="font-semibold text-emerald-700">1.</span>
                <span>We'll confirm receipt within 24 hours</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-emerald-700">2.</span>
                <span>Arrange a free site survey at your convenience</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-emerald-700">3.</span>
                <span>Provide a detailed quote with options</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-emerald-700">4.</span>
                <span>Answer questions, refine spec, and book installation</span>
              </li>
            </ol>
          </div>
        </div>

        {/* Contact Form - reusing tenant landing form logic */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h3 className="mb-6 text-xl font-semibold text-slate-900">Send us a message</h3>
          <form action="/api/tenant/wealden-joinery/leads" method="POST" className="space-y-4">
            <input type="hidden" name="source" value="contact_form" />
            <input type="hidden" name="tenantId" value="wealden-joinery" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-800" htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  placeholder="Your name"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
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
                  placeholder="your@email.com"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
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
                  placeholder="01234 567890"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
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
                  placeholder="TN6 3XX"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-slate-800" htmlFor="projectType">
                What do you need help with?
              </label>
              <select
                id="projectType"
                name="projectType"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Select an option</option>
                <option value="Sash Windows">Sash Windows</option>
                <option value="Casement Windows">Casement Windows</option>
                <option value="Entrance Doors">Entrance Doors</option>
                <option value="French Doors">French Doors</option>
                <option value="Sliding / Bi-fold Doors">Sliding / Bi-fold Doors</option>
                <option value="Alu-Clad Systems">Alu-Clad Systems</option>
                <option value="Mixed / Not Sure">Mixed / Not Sure</option>
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
                placeholder="Tell us about your project, property type, timescales, any heritage constraints..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                name="consent"
                required
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
              />
              <span>
                I consent to Wealden Joinery storing my details for this quote. We'll only use your information to respond to
                your enquiry. See our <Link href="/wealden-joinery" className="underline">privacy policy</Link>.
              </span>
            </label>

            <button
              type="submit"
              className="w-full rounded-full bg-emerald-700 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-700/10 transition hover:scale-[1.02] hover:bg-emerald-800"
            >
              Send Enquiry
            </button>
          </form>
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-emerald-800 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 p-8 shadow-lg md:p-10 text-white">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <h3 className="text-3xl font-semibold">Prefer to start with an estimate?</h3>
          <p className="text-sm leading-relaxed text-emerald-100">
            Use our AI-powered estimator to get an instant ballpark figure for your windows and doors, tailored to your property
            and spec.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm font-semibold">
            <Link
              href="/wealden-joinery/estimate"
              className="rounded-full bg-white px-6 py-3 text-emerald-900 transition hover:scale-[1.02] hover:bg-emerald-50"
            >
              Get an Instant Estimate
            </Link>
            <Link
              href="/wealden-joinery"
              className="rounded-full bg-white/10 px-6 py-3 text-white ring-1 ring-white/30 transition hover:scale-[1.02] hover:bg-white/20"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
