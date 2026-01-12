import { Zap, Mail, TrendingUp, Clock, PoundSterling, Flame } from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "AI-Powered Quoting",
    description:
      "Upload supplier PDFs. JoineryAI extracts materials, converts EUR→GBP, applies surcharges. Branded quote ready in minutes.",
  },
  {
    icon: Mail,
    title: "Email + Lead Automation",
    description:
      "Gmail or Office 365 integration captures every enquiry automatically. Smart routing, AI follow-ups, zero manual forwarding.",
  },
  {
    icon: TrendingUp,
    title: "CRM + Sales Pipeline",
    description:
      "Kanban-style leads: Enquiry → Info → Quote → Won/Lost. Track value, conversion rates, and profitability across teams.",
  },
  {
    icon: Clock,
    title: "Workshop Operations",
    description:
      "Real-time time tracking, digital job board, process assignments. Fire door QR codes auto-start timers from factory floor.",
  },
  {
    icon: PoundSterling,
    title: "Profitability Intelligence",
    description:
      "See actual job costs: labour + materials + overhead. Compare supplier quotes. Know what you made on every job.",
  },
  {
    icon: Flame,
    title: "Flexible Project Types",
    description:
      "Bespoke or standardised projects. Track custom manufacturing specs, material variants, and project timelines with full visibility.",
  },
];

export default function WhatItDoes() {
  return (
    <section className="px-6 py-20 sm:px-10 lg:px-20 bg-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold text-slate-900 sm:text-5xl mb-4">
            Everything joinery needs
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            From the moment an email lands in your inbox to the day you invoice the job—JoineryAI handles the admin so your team focuses on making.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                className="rounded-lg border border-slate-200 bg-slate-50 p-6 hover:shadow-lg transition hover:-translate-y-1"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">
                  {feature.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
