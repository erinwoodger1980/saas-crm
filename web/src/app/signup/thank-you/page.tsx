// web/src/app/signup/thank-you/page.tsx
"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function Inner() {
  const params = useSearchParams();
  const sessionId = params.get("session_id") || "";
  const setupJwt = params.get("setup_jwt") || "";

  const setupHref = setupJwt ? `/setup?setup_jwt=${encodeURIComponent(setupJwt)}` : "/setup";

  return (
    <main className="mx-auto max-w-xl p-6 text-center">
      <h1 className="text-3xl font-semibold mb-4">🎉 Thank you for signing up!</h1>
      <p className="text-gray-700 mb-6">Your 14-day free trial has started.</p>

      <Link
        href={setupHref}
        className="inline-block bg-black text-white rounded px-6 py-3 hover:bg-gray-800 transition"
      >
        Continue to Setup
      </Link>

      {!setupJwt && (
        <p className="mt-4 text-sm text-amber-600">
          (We couldn’t find a setup token. If you reached this page manually,
          please return from the Stripe success page.)
        </p>
      )}
    </main>
  );
}

export default function ThankYouPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-xl p-6">Loading…</main>}>
      <Inner />
    </Suspense>
  );
}