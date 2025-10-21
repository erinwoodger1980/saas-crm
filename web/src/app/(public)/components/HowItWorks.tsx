const STEPS = [
  {
    title: "Connect Gmail or Microsoft 365",
    description:
      "Securely authenticate once to ingest enquiries, supplier replies and showroom inboxes automatically.",
  },
  {
    title: "Paste your company website",
    description:
      "JoineryAI reads your branding, product mix and tone of voice to auto-fill templates, markups and nurture sequences.",
  },
  {
    title: "Send your first AI-assisted quote",
    description:
      "Upload supplier PDFs, let JoineryAI convert currencies, apply delivery and surcharges, then email a polished quote in minutes.",
  },
];

export default function HowItWorks() {
  return (
    <section className="px-6 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-500">
          How it works
        </p>
        <h2 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">
          Go live in under an hour
        </h2>
      </div>
      <ol className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl font-semibold text-emerald-600">
              {index + 1}
            </div>
            <h3 className="mt-4 text-xl font-semibold text-slate-900">{step.title}</h3>
            <p className="mt-3 text-base leading-relaxed text-slate-600">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
