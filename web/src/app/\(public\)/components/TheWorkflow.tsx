import { Mail, FileText, Briefcase, Zap, DollarSign, CheckCircle } from "lucide-react";

const WORKFLOW_STEPS = [
  {
    icon: Mail,
    title: "Lead Lands",
    description: "Customer enquiry hits Gmail or Outlook. JoineryAI captures it automatically. No manual forwarding.",
  },
  {
    icon: FileText,
    title: "Quote Created",
    description: "Upload supplier PDFs. AI extracts pricing, converts currencies, calculates delivery. Branded quote in 5 minutes.",
  },
  {
    icon: CheckCircle,
    title: "Quote Sent",
    description: "Email goes out. JoineryAI tracks opens, clicks, replies. Auto follow-ups if no response.",
  },
  {
    icon: Briefcase,
    title: "Deal Won",
    description: "Customer accepts. Project appears in workshop calendar with all specs and dates.",
  },
  {
    icon: Zap,
    title: "Workshop Tracks Time",
    description: "Team logs hours via timers or QR codes. Job board updates in real time. Boss sees live status.",
  },
  {
    icon: DollarSign,
    title: "Know Your Profit",
    description: "Job completes. Dashboard shows actual cost vs. quote. Learn what worked. Improve next quote.",
  },
];

export default function TheWorkflow() {
  return (
    <section className="px-6 py-20 sm:px-10 lg:px-20 bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold text-slate-900 sm:text-5xl mb-4">
            From email to profit
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            How JoineryAI connects your entire operation—from the first enquiry to the final invoice.
          </p>
        </div>

        {/* Workflow timeline */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {WORKFLOW_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="relative">
                <div className="rounded-lg border border-slate-200 bg-white p-6 h-full">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="mb-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    Step {i + 1}
                  </div>
                  <h3 className="mb-2 text-xl font-bold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
                {/* Arrow between steps */}
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className="hidden lg:flex absolute top-1/2 -right-4 transform -translate-y-1/2 text-slate-300">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
