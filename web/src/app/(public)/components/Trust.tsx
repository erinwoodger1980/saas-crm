import { Lock, Database, Users, FileCheck } from "lucide-react";

const TRUST_POINTS = [
  {
    icon: Lock,
    title: "End-to-End Encrypted",
    description: "Your data is encrypted in transit and at rest. Supplier PDFs, customer emails, job details—all secured.",
  },
  {
    icon: Database,
    title: "UK/EU Data Residency",
    description: "Your data never leaves UK or EU infrastructure. GDPR compliant. Your customers' data stays local.",
  },
  {
    icon: Users,
    title: "Role-Based Access",
    description: "Control who sees what. Workshop staff see only their jobs. Office staff see only their leads. Owners see everything.",
  },
  {
    icon: FileCheck,
    title: "Audit Trails & Backups",
    description: "Every change is logged with timestamps and user info. Automated encrypted backups. Compliance-ready.",
  },
];

export default function Trust() {
  return (
    <section className="px-6 py-20 sm:px-10 lg:px-20 bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold text-slate-900 sm:text-5xl mb-4">
            Enterprise-grade security
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Your business data is your business. We protect it like it's ours.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TRUST_POINTS.map((point, i) => {
            const Icon = point.icon;
            return (
              <div
                key={i}
                className="rounded-lg border border-slate-200 bg-white p-6 hover:shadow-lg transition hover:-translate-y-1"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-slate-900">
                  {point.title}
                </h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  {point.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-8">
          {[
            { label: "GDPR Compliant", icon: "📋" },
            { label: "SOC 2 Ready", icon: "✓" },
            { label: "ISO 27001", icon: "🔐" },
            { label: "UK Data Act", icon: "🇬🇧" },
          ].map((badge, i) => (
            <div key={i} className="flex items-center gap-2 text-slate-600 text-sm font-semibold">
              <span className="text-lg">{badge.icon}</span>
              {badge.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
