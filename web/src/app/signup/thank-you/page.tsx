// web/src/app/signup/thank-you/page.tsx
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// Disable static prerender so we can always read the query string
export const dynamic = "force-dynamic";

function ThankYouInner() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const setupJwt = params.get("setup_jwt");

  return (
    <main className="mx-auto max-w-xl p-6 text-center">
      <h1 className="text-3xl font-semibold mb-4">🎉 Thank you for signing up!</h1>
      <p className="text-gray-700 mb-6">
        Your 14-day free trial has started. You’ll receive a confirmation email shortly.
      </p>

      {sessionId && (
        <div className="text-sm text-gray-500 mb-2">
          Stripe Session ID: <code className="break-all">{sessionId}</code>
        </div>
      )}
      {setupJwt && (
        <div className="text-sm text-gray-500 mb-6">
          Setup Token (JWT): <code className="break-all">{setupJwt}</code>
        </div>
      )}

      <Link
        href="/setup"
        className="inline-block bg-black text-white rounded px-6 py-3 hover:bg-gray-800 transition"
      >
        Continue to Setup
      </Link>
    </main>
  );
}

export default function ThankYouPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-xl p-6">Loading…</main>}>
      <ThankYouInner />
    </Suspense>
  );
}