import Link from 'next/link';
import { WealdenFooter, WealdenNav, tenantProfile } from '../wealden-shared';

export default function ContactPage({ params }: { params: { slug: string } }) {
  const tenantId = params.slug;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <WealdenNav slug={params.slug} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-10">
        <section className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Get in touch</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">Contact Wealden Joinery</h1>
          <p className="text-lg text-slate-700 leading-relaxed">
            The best way to start is to share a few details about your project. We&apos;ll respond promptly with friendly, expert
            advice – no hard sell.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 text-sm text-slate-700">
            <Link href={`tel:${tenantProfile.phone.replace(/\s+/g, '')}`} className="font-semibold text-green-800">
              Call {tenantProfile.phone}
            </Link>
            <span className="hidden sm:inline">•</span>
            <Link href={`mailto:${tenantProfile.email}`} className="font-semibold text-green-800">
              {tenantProfile.email}
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 overflow-hidden grid lg:grid-cols-2">
          <div className="p-8 lg:p-10 space-y-4 bg-gradient-to-br from-white to-green-50">
            <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Start your project</p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900">Tell us about your windows and doors</h2>
            <p className="text-lg text-slate-700 leading-relaxed">
              Share a few details and we&apos;ll respond within 1–2 working days with next steps. We can arrange a survey visit if
              helpful.
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              {[
                'Specialists in sash, casement and entrance doors',
                'Respectful of heritage details and conservation requirements',
                'Installation teams covering East Sussex and Kent',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="text-sm text-slate-600">No hard sell – just clear guidance and pricing.</div>
          </div>
          <div className="p-8 lg:p-10 bg-white">
            <form action="/api/leads" method="POST" className="space-y-4">
              <input type="hidden" name="tenantId" value={tenantId} />
              <input type="hidden" name="source" value="contact" />
              <input type="hidden" name="gclid" />
              <input type="hidden" name="gbraid" />
              <input type="hidden" name="wbraid" />
              <input type="hidden" name="fbclid" />
              <input type="hidden" name="utm_source" />
              <input type="hidden" name="utm_medium" />
              <input type="hidden" name="utm_campaign" />
              <input type="hidden" name="utm_term" />
              <input type="hidden" name="utm_content" />

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="name">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-100"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-100"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-100"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-100"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-800" htmlFor="propertyType">
                  Property type
                </label>
                <select
                  id="propertyType"
                  name="propertyType"
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-100"
                >
                  <option value="">Select an option</option>
                  <option value="Victorian / Edwardian">Victorian / Edwardian</option>
                  <option value="Georgian / Regency">Georgian / Regency</option>
                  <option value="Cottage">Cottage</option>
                  <option value="Modern">Modern</option>
                  <option value="New build">New build</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-800" htmlFor="projectType">
                  What do you need help with?
                </label>
                <select
                  id="projectType"
                  name="projectType"
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-100"
                >
                  <option value="">Select an option</option>
                  <option value="Sash windows">Sash windows</option>
                  <option value="Casement windows">Casement windows</option>
                  <option value="Front door">Front door</option>
                  <option value="French / garden doors">French / garden doors</option>
                  <option value="Sliding / bi-fold">Sliding / bi-fold doors</option>
                  <option value="Alu-clad project">Alu-clad project</option>
                  <option value="Other joinery">Other joinery</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-slate-800" htmlFor="message">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-green-700 focus:outline-none focus:ring-2 focus:ring-green-100"
                />
              </div>

              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="consent"
                  required
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-green-800 focus:ring-green-700"
                />
                <span>I consent to Wealden Joinery storing my details for this enquiry.</span>
              </label>

              <button
                type="submit"
                className="w-full rounded-full bg-green-800 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-green-800/10 hover:bg-green-900"
              >
                Send enquiry
              </button>
            </form>
          </div>
        </section>
      </main>

      <WealdenFooter slug={params.slug} />
    </div>
  );
}
