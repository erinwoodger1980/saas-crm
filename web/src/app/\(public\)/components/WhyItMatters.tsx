import { Lightbulb, Zap, Target, BarChart3 } from "lucide-react";

const ROI_POINTS = [
  {
    icon: Zap,
    metric: "5×",
    description: "Faster quote generation. From PDF to branded quote in 5 minutes instead of 30+.",
  },
  {
    icon: Target,
    metric: "100%",
    description: "Lead capture. Every email inquiry automatically logged. Zero missed leads.",
  },
  {
    icon: BarChart3,
    metric: "40%",
    description: "Admin time saved. Quoting, follow-ups, scheduling—all automated.",
  },
  {
    icon: Lightbulb,
    metric: "Clear",
    description: "Profitability. See actual costs per job. Fix pricing. Win more margin.",
  },
];

export default function WhyItMatters() {
  return (
    <section className="px-6 py-20 sm:px-10 lg:px-20 bg-white">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold text-slate-900 sm:text-5xl mb-4">
            Why it matters
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Real results for joinery manufacturers.
          </p>
        </div>

        {/* ROI grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {ROI_POINTS.map((point, i) => {
            const Icon = point.icon;
            return (
              <div
                key={i}
                className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center hover:shadow-md transition"
              >
                <div className="mb-4 flex justify-center">
                  <Icon className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="mb-2 text-3xl font-bold text-emerald-600">
                  {point.metric}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {point.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Benefit bullets */}
        <div className="mt-16 rounded-lg bg-emerald-50 border border-emerald-200 p-8">
          <h3 className="text-lg font-bold text-slate-900 mb-6">
            What this means for your business
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              "Respond to quotes faster than competitors",
              "Capture leads that currently slip through",
              "Stop underpricing jobs",
              "Workshop knows priorities before they ask",
              "Reduce admin overhead",
              "Make data-driven pricing decisions",
            ].map((benefit, i) => (
              <div key={i} className="flex gap-3">
                <div className="text-emerald-600 font-bold">✓</div>
                <span className="text-slate-700">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
