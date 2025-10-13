export default function BillingCancelPage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Checkout cancelled</h1>
      <p className="text-gray-600">
        No problem—your card hasn’t been charged. You can try again anytime.
      </p>
      <div className="mt-6">
        <a href="/billing" className="rounded-xl bg-black px-5 py-3 text-white">
          Back to Billing
        </a>
      </div>
    </main>
  );
}