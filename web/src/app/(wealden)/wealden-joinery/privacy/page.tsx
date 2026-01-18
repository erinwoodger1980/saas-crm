import Link from "next/link";

export const metadata = {
  title: "Lignum Windows Privacy",
};

export default function WealdenPrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:px-10">
      <h1 className="text-3xl font-semibold text-slate-900">Privacy Notice</h1>
      <p className="mt-4 text-base leading-relaxed text-slate-600">
        This privacy notice explains, in plain English, how we handle information submitted via
        this website.
      </p>

      <section className="mt-8 space-y-4 text-base leading-relaxed text-slate-600">
        <p>
          <strong>Contact forms:</strong> If you submit an enquiry, we receive the details you
          provide (for example name, email, phone number, and project notes) so we can respond.
        </p>
        <p>
          <strong>Analytics:</strong> We use analytics to understand how visitors use the site and
          to improve performance and content. This may set cookies in your browser.
        </p>
        <p>
          <strong>Data requests:</strong> If you’d like access, correction, or deletion of your
          information, email{" "}
          <a href="mailto:martin@wealdenjoinery.com" className="text-emerald-700 underline">
            martin@wealdenjoinery.com
          </a>
          .
        </p>
      </section>

      <p className="mt-12 text-sm text-slate-500">
        <Link href="/wealden-joinery">Return to the homepage</Link>
      </p>
    </main>
  );
}
