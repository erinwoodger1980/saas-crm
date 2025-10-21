export default function ValueProps() {
  const items = [
    {
      title: "AI Quoting from Supplier PDFs",
      description:
        "Parse EUR to GBP, allocate delivery and surcharges, apply your markup, and send a branded quote in minutes.",
    },
    {
      title: "Auto Follow-ups that Learn",
      description:
        "A/B test subject lines, timing, and messaging — JoineryAI optimises follow-ups for each opportunity.",
    },
    {
      title: "Workshop Scheduling & Hours",
      description:
        "10 workshop users log time on tablets while big-screen boards keep fabrication and install teams aligned.",
    },
    {
      title: "Email Integrations",
      description:
        "Deep Gmail and Microsoft 365 ingestion with smart lead capture plus contact enrichment from your inbox.",
    },
    {
      title: "Multi-Tenant CRM",
      description:
        "Track leads, opportunities, and tasks with job-costing, supplier source tracking, and margin protection.",
    },
    {
      title: "Secure & Compliant",
      description: "UK/EU data hosting with encryption and regular compliance audits (details available on request).",
    },
  ];

  return (
    <section className="bg-white py-20">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 sm:px-8 lg:px-12">
        <div className="max-w-3xl space-y-4">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Built for UK joinery manufacturers, showrooms and installers
          </h2>
          <p className="text-lg text-slate-600">
            Automate quoting, follow-ups and workshop coordination so you can focus on the craft.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.title}
              className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
              <p className="text-sm text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
