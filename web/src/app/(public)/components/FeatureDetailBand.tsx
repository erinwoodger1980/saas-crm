const DETAILS = [
  {
    title: "Workshop command centre",
    description:
      "Real-time job boards show cut lists, CNC files and install calendars with a single tap on the display app.",
  },
  {
    title: "Quote intelligence",
    description:
      "Margin guardrails, supplier lead times and stock levels surface automatically before you send a proposal.",
  },
  {
    title: "Customer-ready documents",
    description:
      "Generate branded quotes, manufacturing packs and O&M handovers with consistent pricing and imagery every time.",
  },
];

function Illustration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 80"
      className="h-24 w-full text-emerald-200"
      role="img"
    >
      <rect x="5" y="10" width="110" height="60" rx="10" fill="currentColor" opacity="0.18" />
      <rect x="18" y="23" width="84" height="12" rx="6" fill="currentColor" opacity="0.45" />
      <rect x="18" y="41" width="60" height="12" rx="6" fill="currentColor" opacity="0.3" />
      <circle cx="40" cy="41" r="3" fill="currentColor" opacity="0.7" />
      <circle cx="52" cy="41" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="64" cy="41" r="3" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

export default function FeatureDetailBand() {
  return (
    <section className="bg-slate-900 px-6 py-20 text-white sm:px-10 lg:px-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 lg:flex-row lg:items-center">
        <div className="max-w-xl space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
            Designed for joinery teams
          </p>
          <h2 className="text-3xl font-semibold sm:text-4xl">
            Connect office, workshop and installers without extra spreadsheets
          </h2>
          <p className="text-lg text-white/80">
            JoineryAI unifies quoting, production planning and installation updates so the
            whole team shares the same live schedule. Each workspace is tailored to joiners,
            not generic SaaS templates.
          </p>
        </div>
        <div className="grid flex-1 gap-6 md:grid-cols-3">
          {DETAILS.map((detail) => (
            <div
              key={detail.title}
              className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-6 text-left shadow-lg backdrop-blur transition hover:border-emerald-300/60 hover:shadow-xl"
            >
              <Illustration />
              <h3 className="mt-6 text-xl font-semibold text-white">{detail.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/75">{detail.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
