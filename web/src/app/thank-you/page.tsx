"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function ThankYouInner() {
  const params = useSearchParams();
  const sessionId = params.get("session_id") || undefined;
  const setupJwt = params.get("setup_jwt") || undefined;

  // Save setup token for the setup page to read silently
  useEffect(() => {
    if (setupJwt) {
      sessionStorage.setItem("setup_jwt", setupJwt);
    }
  }, [setupJwt]);

  return (
    <main className="mx-auto max-w-xl p-6 text-center">
      <h1 className="text-3xl font-semibold mb-4">🎉 Thank you for signing up!</h1>
      <p className="text-gray-700 mb-6">
        Your 14-day free trial has started. You’ll receive a confirmation email shortly.
      </p>

      {/* optional: you can show session id for debugging, or remove this entirely */}
      {sessionId && (
        <div className="text-xs text-gray-400 mb-6">
          Ref: <code className="break-all">{sessionId}</code>
        </div>
      )}

      <Link
        href="/setup"
        className="inline-block bg-black text-white rounded px-6 py-3 hover:bg-gray-800 transition"
      >
        Continue to Setup
      </Link>

      {!setupJwt && (
        <p className="mt-4 text-sm text-gray-500">
          If you’re returning to this page later, click Continue and we’ll find your setup.
        </p>
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