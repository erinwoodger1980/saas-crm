"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { setJwt } from "@/lib/api";

export const dynamic = "force-dynamic";

function ThankYouInner() {
  const params = useSearchParams();
  const sessionId = params.get("session_id") || undefined;
  const setupJwt = params.get("setup_jwt") || undefined;

  // Save setup token for the setup page and API client to use
  useEffect(() => {
    if (setupJwt) {
      sessionStorage.setItem("setup_jwt", setupJwt);
      setJwt(setupJwt);
    }
  }, [setupJwt]);

  return (
    <main className="mx-auto max-w-xl p-6 text-center">
      <h1 className="mb-4 text-3xl font-semibold">🎉 Thank you for signing up!</h1>
      <p className="mb-6 text-gray-700">
        Your 14-day free trial has started. You’ll receive a confirmation email shortly.
      </p>

      {sessionId && (
        <div className="mb-6 text-xs text-gray-400">
          Ref: <code className="break-all">{sessionId}</code>
        </div>
      )}

      <Link
        href="/setup"
        className="inline-block rounded bg-black px-6 py-3 text-white transition hover:bg-gray-800"
      >
        Continue to Setup
      </Link>

      {!setupJwt && (
        <p className="mt-4 text-sm text-gray-500">
          If you’re returning later, click Continue — we’ll locate your setup automatically.
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