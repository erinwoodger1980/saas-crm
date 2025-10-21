const steps = [
  {
    title: "Connect Gmail or Microsoft 365",
    description: "Securely ingest quotes, emails and leads from the inboxes your team already uses.",
  },
  {
    title: "Paste your company website",
    description: "We auto-fill branding, addresses, currencies and defaults so you're ready in minutes.",
  },
  {
    title: "Send your first AI-assisted quote",
    description: "Let JoineryAI handle pricing, markup and presentation — then track progress automatically.",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 sm:px-8 lg:px-12">
        <div className="max-w-2xl space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">How it works</p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Three steps and you’re ready to quote
          </h2>
          <p className="text-lg text-slate-600">
            Guided onboarding connects your email, imports your brand and helps you send your first quote without friction.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="flex h-full flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-6 shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-lg font-semibold text-emerald-700">
                {index + 1}
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-900">{step.title}</h3>
                <p className="text-sm text-slate-600">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
