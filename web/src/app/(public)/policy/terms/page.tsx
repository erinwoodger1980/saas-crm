import Link from "next/link";

export const metadata = {
  title: "JoineryAI Terms",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:px-10">
      <h1 className="text-3xl font-semibold text-slate-900">JoineryAI Terms of Service</h1>
      <p className="mt-4 text-base leading-relaxed text-slate-600">
        These terms outline how JoineryAI provides access to our quoting and workshop
        platform. They are placeholders while the full legal copy is prepared.
      </p>
      <section className="mt-8 space-y-4 text-base leading-relaxed text-slate-600">
        <p>
          <strong>Use of service:</strong> JoineryAI grants you a non-transferable licence to
          access the platform for your organisation. Please do not share credentials outside
          your team.
        </p>
        <p>
          <strong>Data:</strong> You retain ownership of your data. We store it securely in UK/EU
          data centres and only process it to deliver the service.
        </p>
        <p>
          <strong>Billing:</strong> Subscriptions renew automatically until cancelled in your
          billing settings.
        </p>
        <p>
          Full legal wording will be available soon. In the meantime contact
          {" "}
          <a href="mailto:legal@joineryai.app" className="text-emerald-600 underline">
            legal@joineryai.app
          </a>{" "}
          with any questions.
        </p>
      </section>
      <p className="mt-12 text-sm text-slate-500">
        <Link href="/">Return to the JoineryAI homepage</Link>
      </p>
    </main>
  );
}
