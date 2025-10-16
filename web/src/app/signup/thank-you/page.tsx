"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ThankYouPage() {
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
        <div className="text-sm text-gray-500 mb-6">
          Stripe Session ID: <code>{sessionId}</code>
        </div>
      )}
      {setupJwt && (
        <div className="text-sm text-gray-500 mb-6">
          Setup Token: <code>{setupJwt}</code>
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