import { Users, Building2, Briefcase, Globe } from "lucide-react";

const SEGMENTS = [
  {
    icon: Building2,
    name: "Joinery Manufacturers",
    description: "Cabinet makers, door manufacturers, bespoke joinery workshops. Scale from solo to multi-team operations with real visibility into profitability.",
  },
  {
    icon: Users,
    name: "Installers & Fitters",
    description: "Installation teams managing multiple sites. Track projects, assign work, log time, manage subcontractors. Know who's where and why.",
  },
  {
    icon: Briefcase,
    name: "Showrooms",
    description: "Retail and design showrooms taking enquiries. Capture leads from email, manage quote pipeline, coordinate with workshop and delivery teams.",
  },
  {
    icon: Globe,
    name: "Multi-Branch Operations",
    description: "Multiple showrooms, workshops, or installation teams. Role-based access controls. Each location sees only their data, but owners see everything.",
  },
];

export default function WhoItsFor() {
  return (
    <section className="px-6 py-20 sm:px-10 lg:px-20 bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold text-slate-900 sm:text-5xl mb-4">
            Built for joinery
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Whether you're a one-person operation or managing multiple teams, JoineryAI scales with you.
          </p>
        </div>

        {/* Segments grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {SEGMENTS.map((segment, i) => {
            const Icon = segment.icon;
            return (
              <div
                key={i}
                className="rounded-lg border border-slate-200 bg-white p-8 hover:shadow-lg transition hover:-translate-y-1"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">
                  {segment.name}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {segment.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
