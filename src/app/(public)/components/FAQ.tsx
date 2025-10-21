const faqs = [
  {
    question: "Is there really a 14-day free trial?",
    answer: "Yes — explore all features for 14 days. Cancel anytime during the trial without being charged.",
  },
  {
    question: "How does the 60% lifetime discount work?",
    answer: "Use promo code EARLY60 when signing up. The discounted price is locked for as long as you stay subscribed.",
  },
  {
    question: "Do you support Stripe Direct Debit?",
    answer: "Yes. We use Stripe Checkout with Direct Debit so you can pay monthly or annually via bank transfer.",
  },
  {
    question: "Who owns the data we put into JoineryAI?",
    answer: "You do. Export your data anytime. We host in the UK/EU and follow strict GDPR practices.",
  },
  {
    question: "What onboarding support is included?",
    answer: "We run a guided setup call, import your templates, and help you connect Gmail or Microsoft 365.",
  },
  {
    question: "How do we get help if something breaks?",
    answer: "Email and phone support are included. Priority support and dedicated CSM available for larger teams.",
  },
  {
    question: "Can we cancel if JoineryAI isn't the right fit?",
    answer: "Absolutely. Cancel anytime from the billing settings — you'll retain access until the end of the billing period.",
  },
  {
    question: "How do you keep our data secure?",
    answer: "We encrypt data in transit and at rest, enforce SSO for admins, and monitor infrastructure 24/7 in UK/EU regions.",
  },
];

export default function FAQ() {
  return (
    <section className="bg-slate-900 py-20 text-white">
      <div className="mx-auto w-full max-w-6xl space-y-12 px-6 sm:px-8 lg:px-12">
        <div className="space-y-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">FAQ</p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Answers before you go all-in</h2>
          <p className="text-lg text-white/70">
            If you have a question not covered here, email hello@joineryai.app and we’ll respond within one business day.
          </p>
        </div>
        <dl className="grid gap-6 md:grid-cols-2">
          {faqs.map((faq) => (
            <div key={faq.question} className="rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
              <dt className="text-lg font-semibold text-white">{faq.question}</dt>
              <dd className="mt-2 text-sm text-white/70">{faq.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
