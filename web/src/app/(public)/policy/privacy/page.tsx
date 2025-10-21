import Link from "next/link";

export const metadata = {
  title: "JoineryAI Privacy",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:px-10">
      <h1 className="text-3xl font-semibold text-slate-900">JoineryAI Privacy Notice</h1>
      <p className="mt-4 text-base leading-relaxed text-slate-600">
        We respect your privacy and protect customer data. This placeholder notice summarises
        how production data is processed while the full policy is authored.
      </p>
      <section className="mt-8 space-y-4 text-base leading-relaxed text-slate-600">
        <p>
          <strong>Data collection:</strong> We ingest email, quote and workshop data that you
          connect to JoineryAI to deliver core features.
        </p>
        <p>
          <strong>Storage:</strong> Data is stored in UK/EU data centres with encryption at rest
          and strict access controls.
        </p>
        <p>
          <strong>Usage:</strong> We only use your data to provide the service and support your
          team. We never sell or share it with advertisers.
        </p>
        <p>
          Full privacy information will be added soon. Contact
          {" "}
          <a href="mailto:privacy@joineryai.app" className="text-emerald-600 underline">
            privacy@joineryai.app
          </a>{" "}
          for any requests or deletions.
        </p>
      </section>
      <p className="mt-12 text-sm text-slate-500">
        <Link href="/">Return to the JoineryAI homepage</Link>
      </p>
    </main>
  );
}
