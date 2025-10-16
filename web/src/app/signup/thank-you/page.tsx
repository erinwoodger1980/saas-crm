// web/src/app/signup/thank-you/page.tsx
"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function ThankYouInner() {
  const params = useSearchParams();
  const router = useRouter();

  const sessionId = params.get("session_id") || "";
  const setupJwt = params.get("setup_jwt") || "";

  useEffect(() => {
    if (setupJwt) {
      try {
        sessionStorage.setItem("setup_jwt", setupJwt);
      } catch {}
      // Forward immediately with the token in the URL to be explicit.
      router.replace(`/setup?setup_jwt=${encodeURIComponent(setupJwt)}`);
    }
  }, [setupJwt, router]);

  return (
    <main className="mx-auto max-w-xl p-6 text-center">
      <h1 className="text-3xl font-semibold mb-4">🎉 Thank you for signing up!</h1>
      <p className="text-gray-700 mb-6">
        Your 14-day free trial has started. You’ll receive a confirmation email shortly.
      </p>

      {sessionId && (
        <p className="text-sm text-gray-500 mb-6">
          Stripe Session: <code className="break-all">{sessionId}</code>
        </p>
      )}

      {/* Fallback button in case the auto-redirect is delayed */}
      {setupJwt && (
        <Link
          href={`/setup?setup_jwt=${encodeURIComponent(setupJwt)}`}
          className="inline-block bg-black text-white rounded px-6 py-3 hover:bg-gray-800 transition"
        >
          Continue to Setup
        </Link>
      )}
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