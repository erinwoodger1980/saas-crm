export default function ThankYouPage() {
  return (
    <div className="min-h-[60vh] grid place-items-center p-8">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-semibold">Thanks — we’ve got your details!</h1>
        <p className="text-slate-600">
          Our team will review your information and prepare a quote. If we need anything else,
          we’ll be in touch.
        </p>
        <a
          href="/"
          className="inline-flex items-center rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
        >
          Back to home
        </a>
      </div>
    </div>
  );
}