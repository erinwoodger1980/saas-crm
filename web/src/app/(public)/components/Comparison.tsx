const COMPARISON = [
  {
    feature: "Quote generation time",
    spreadsheets: "30–60 minutes per quote",
    genericCRM: "Still manual, requires plugins",
    joineryAI: "5 minutes (auto-extract, convert, format)",
  },
  {
    feature: "Lead capture",
    spreadsheets: "Manual email forwarding",
    genericCRM: "Basic email sync, manual routing",
    joineryAI: "Auto-capture, smart routing, zero config",
  },
  {
    feature: "Workshop visibility",
    spreadsheets: "Email updates, job board chaos",
    genericCRM: "Not built for production tracking",
    joineryAI: "Real-time job board, timers, QR codes",
  },
  {
    feature: "Profitability tracking",
    spreadsheets: "Spreadsheet math, often wrong",
    genericCRM: "Not a feature",
    joineryAI: "Automatic labour + material costing",
  },
  {
    feature: "Custom project specs",
    spreadsheets: "Spreadsheet columns",
    genericCRM: "Generic fields, not joinery-specific",
    joineryAI: "Built for bespoke manufacturing workflows",
  },
  {
    feature: "Follow-up automation",
    spreadsheets: "Impossible",
    genericCRM: "Basic email sequences, not AI-optimized",
    joineryAI: "AI A/B testing, adaptive cadences",
  },
];

export default function Comparison() {
  return (
    <section className="px-6 py-20 sm:px-10 lg:px-20 bg-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold text-slate-900 sm:text-5xl mb-4">
            Why JoineryAI, not spreadsheets or generic CRMs
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Built for joinery. From quote to workshop to profit.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                  Feature
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Spreadsheets
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">
                  Generic CRM
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-emerald-600">
                  JoineryAI
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {COMPARISON.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                    {row.feature}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {row.spreadsheets}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {row.genericCRM}
                  </td>
                  <td className="px-6 py-4 text-sm text-emerald-600 font-semibold">
                    {row.joineryAI}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
