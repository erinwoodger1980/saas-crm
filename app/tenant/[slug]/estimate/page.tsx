'use client';

import { PublicEstimatorStepper } from '@/components/publicEstimator/PublicEstimatorStepper';
import { WealdenFooter, WealdenNav } from '../wealden-shared';

export default function EstimatePage({ params }: { params: { slug: string } }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <WealdenNav slug={params.slug} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-10">
        <section className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-green-800">Instant pricing</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight">Get a Tailored Estimate in Minutes</h1>
          <ul className="space-y-2 text-slate-700 text-lg leading-relaxed">
            {["Outline your windows and doors", "Choose styles and options", "Receive an indicative budget range and next steps"].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-6 lg:p-8 shadow-inner space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-4 sm:p-6 lg:p-8">
            <PublicEstimatorStepper tenantSlug={params.slug} />
          </div>
          <div className="grid lg:grid-cols-3 gap-4 text-sm text-slate-700">
            {[{ title: 'What happens after I submit?', detail: 'We review your estimate and follow up to discuss details, arrange a survey if helpful, and confirm timescales.' }, { title: 'Is this a final quote?', detail: 'The estimator gives an indicative range. Final pricing follows a survey and agreed specification.' }, { title: 'Can you visit my home?', detail: 'Yes. After the online estimate we can arrange a site visit to check measurements and finalise designs.' }].map((item) => (
              <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                <div className="font-semibold text-slate-900">{item.title}</div>
                <p className="leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <WealdenFooter slug={params.slug} />
    </div>
  );
}
