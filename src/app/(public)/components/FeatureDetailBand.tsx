const features = [
  {
    title: "Supplier PDFs → Instant Quotes",
    description:
      "Upload multi-page catalogues and let JoineryAI map product codes, convert currencies, and build customer-ready quotes.",
  },
  {
    title: "Rhythm that wins",
    description:
      "Follow-up sequences learn which subject lines, timings and templates work best for your prospects.",
  },
  {
    title: "Workshop screens",
    description:
      "Display production boards around the workshop so install, spray and fabrication teams stay perfectly in sync.",
  },
];

export default function FeatureDetailBand() {
  return (
    <section className="bg-slate-900 py-20 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 sm:px-8 lg:px-12">
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Purpose-built for busy workshops</h2>
          <p className="max-w-2xl text-lg text-white/70">
            JoineryAI connects quoting, follow-ups, and scheduling so your teams have one trusted source of truth.
          </p>
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/10"
            >
              <div className="h-24 rounded-xl bg-gradient-to-br from-emerald-400/80 to-cyan-400/70" aria-hidden />
              <div>
                <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm text-white/70">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
