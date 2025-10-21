const FAQ_ITEMS = [
  {
    question: "Do I really get 14 days free?",
    answer:
      "Yes. Your team can explore JoineryAI with full features for 14 days. No card is required until you choose a plan.",
  },
  {
    question: "How long does the EARLY60 discount last?",
    answer:
      "The 60% lifetime discount is applied to your account permanently as long as you sign up before the countdown expires.",
  },
  {
    question: "Can we pay by Stripe Direct Debit?",
    answer:
      "Absolutely. The checkout button launches a secure Stripe Direct Debit flow with invoicing for your records.",
  },
  {
    question: "Who owns our data?",
    answer:
      "You remain the owner of all customer, quote and production data. You can export it at any time from settings.",
  },
  {
    question: "What onboarding help do you provide?",
    answer:
      "Early adopters receive a guided onboarding call plus tailored setup of quoting templates and workshop boards.",
  },
  {
    question: "Is support included?",
    answer:
      "Yes, chat and phone support are available on weekdays with emergency support for urgent workshop issues.",
  },
  {
    question: "How do cancellations work?",
    answer:
      "You can cancel from billing settings. Your workspace remains active until the end of the billing period with full export access.",
  },
  {
    question: "Is JoineryAI secure?",
    answer:
      "We host in UK/EU data centres with encryption at rest, SSO, audit logs and granular permissions for office, workshop and display users.",
  },
];

export default function FAQ() {
  return (
    <section className="bg-slate-100 px-6 py-20 sm:px-10 lg:px-20">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-600">
          FAQ
        </p>
        <h2 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">
          Answers for operations and sales teams
        </h2>
      </div>
      <div className="mx-auto mt-10 max-w-4xl space-y-4">
        {FAQ_ITEMS.map((item) => (
          <details
            key={item.question}
            className="group rounded-2xl border border-slate-200 bg-white px-6 py-4 text-left shadow-sm"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-lg font-semibold text-slate-900 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500">
              {item.question}
              <span className="text-emerald-500 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-base leading-relaxed text-slate-600">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
