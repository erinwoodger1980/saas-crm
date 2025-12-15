import type { Metadata } from "next";
import Link from "next/link";
import { DoorConfigurator } from "@/components/publicEstimator/DoorConfigurator";

export const metadata: Metadata = {
  title: "Door Configurator | Wealden Joinery",
  description:
    "Design your perfect entrance door with our interactive configurator. Choose style, size, colors, and see instant pricing with live preview.",
};

export default function EstimatePage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-12 md:px-10 md:py-16">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <p className="inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">Door Configurator</p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl">
              Design Your Perfect Entrance Door
            </h1>
            <p className="text-lg text-slate-600">
              Configure your bespoke timber door with our interactive designer. Choose your style, size, colors, and see instant pricing with a live visual preview. No sales pressure, no obligation.
            </p>
          </div>
        </div>
      </section>

      {/* Why Use the Estimator */}
      {/* Why Use the Configurator */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Why use our door configurator?</h3>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          <li className="flex gap-2 text-sm text-slate-700">
            <span className="text-emerald-700">✓</span>
            <span>
              <strong className="font-semibold text-slate-900">Visual preview</strong> — See your door design in real-time as
              you configure
            </span>
          </li>
          <li className="flex gap-2 text-sm text-slate-700">
            <span className="text-emerald-700">✓</span>
            <span>
              <strong className="font-semibold text-slate-900">Instant pricing</strong> — Live updates as you change style,
              size, and options
            </span>
          </li>
          <li className="flex gap-2 text-sm text-slate-700">
            <span className="text-emerald-700">✓</span>
            <span>
              <strong className="font-semibold text-slate-900">Parametric design</strong> — Stiles and rails stay proportionally
              correct
            </span>
          </li>
          <li className="flex gap-2 text-sm text-slate-700">
            <span className="text-emerald-700">✓</span>
            <span>
              <strong className="font-semibold text-slate-900">Complete entrance</strong> — Add side lights and top lights to
              match
            </span>
          </li>
        </ul>
      </section>

      {/* Door Configurator */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-8 shadow-sm">
        <DoorConfigurator />
      </section>
      {/* FAQ */}
      <section>
        <h3 className="mb-6 text-xl font-semibold text-slate-900">Estimator FAQs</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              q: "How accurate is the estimate?",
              a: "The AI estimator provides a ballpark figure accurate to within 10–15% in most cases. It's trained on real project data but can't account for site-specific complexities. Book a site survey for an exact quote.",
            },
            {
              q: "Do I have to provide my contact details?",
              a: "No—you can run the estimator anonymously to get an indicative price. If you'd like a detailed quote or want to proceed, we'll ask for your details at the end.",
            },
            {
              q: "Can I save my estimate for later?",
              a: "Yes—at the end of the process, you can email yourself a PDF summary with all your selections and the estimated price.",
            },
            {
              q: "What if I need help with the estimator?",
              a: "If you get stuck or have questions, use the 'Contact Us' button or call us directly. We're happy to walk you through it or provide a manual quote instead.",
            },
          ].map((item) => (
            <article key={item.q} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <h4 className="text-base font-semibold text-slate-900">{item.q}</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-emerald-800 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 p-8 shadow-lg md:p-10 text-white">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <h3 className="text-3xl font-semibold">Prefer to speak to someone?</h3>
          <p className="text-sm leading-relaxed text-emerald-100">
            We're always happy to discuss your project over the phone or in person. Call us or use the contact form to arrange a
            free consultation.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm font-semibold">
            <Link
              href="/wealden-joinery/contact"
              className="rounded-full bg-white px-6 py-3 text-emerald-900 transition hover:scale-[1.02] hover:bg-emerald-50"
            >
              Get in Touch
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
