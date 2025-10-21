const VALUE_PROPS = [
  {
    title: "AI Quoting from Supplier PDFs",
    description:
      "Parse supplier price lists in EUR, convert to GBP, allocate delivery and surcharges automatically, then output a branded quote in minutes.",
  },
  {
    title: "Auto Follow-ups that Learn",
    description:
      "Adaptive cadences that A/B test subject lines, timings and copy so every opportunity receives the nudge it needs.",
  },
  {
    title: "Workshop Scheduling & Hours",
    description:
      "Ten workshop users can log time, update job boards and broadcast priorities to display screens in the factory.",
  },
  {
    title: "Email Integrations",
    description:
      "Gmail and Microsoft 365 ingestion captures every lead and routes them to the right playbook with zero forwarding rules.",
  },
  {
    title: "Multi-Tenant CRM",
    description:
      "Manage leads, opportunities, tasks and true job profitability across showrooms, workshop and installation teams.",
  },
  {
    title: "Secure & Compliant",
    description:
      "UK and EU data residency with encrypted backups, audit trails and role-based access by workshop, office and display users.",
  },
];

export default function ValueProps() {
  return (
    <section className="relative px-6 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-500">
          Why JoineryAI
        </p>
        <h2 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">
          Built to win every quote and keep your workshop flowing
        </h2>
        <p className="mt-4 text-lg text-slate-600">
          Automate the admin, delight clients and give your team clarity across sales,
          surveying and production in one platform designed for UK joiners.
        </p>
      </div>
      <div className="mx-auto mt-12 grid max-w-6xl gap-6 md:grid-cols-2 xl:grid-cols-3">
        {VALUE_PROPS.map((item) => (
          <div
            key={item.title}
            className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-within:-translate-y-1 focus-within:shadow-lg"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <span className="text-xl font-semibold">•</span>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-3 text-base leading-relaxed text-slate-600">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
