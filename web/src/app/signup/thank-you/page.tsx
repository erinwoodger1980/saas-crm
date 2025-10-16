"use client";

import { useEffect, Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { setJwt } from "@/lib/api";

// Disable static prerender so we can always read the query string
export const dynamic = "force-dynamic";

function ThankYouInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  const setupJwt = params.get("setup_jwt");

  useEffect(() => {
    if (!setupJwt) return;
    try {
      setJwt(setupJwt);
      setRedirecting(true);
      // Redirect after short delay so user sees confirmation
      const timer = setTimeout(() => {
        router.push("/setup");
      }, 2000);
      return () => clearTimeout(timer);
    } catch (err) {
      console.warn("Failed to store setup JWT:", err);
    }
  }, [setupJwt, router]);

  return (
    <main className="mx-auto max-w-xl p-6 text-center">
      <h1 className="text-3xl font-semibold mb-4">🎉 Thank you for signing up!</h1>
      <p className="text-gray-700 mb-6">
        Your 14-day free trial has started. You’ll receive a confirmation email shortly.
      </p>

      <div className="flex justify-center mb-8">
        {!redirecting ? (
          <div className="text-green-600 font-medium animate-pulse">
            Setting up your account...
          </div>
        ) : (
          <div className="text-gray-500 text-sm">Redirecting to setup...</div>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-4">
        If you’re not redirected automatically, click below.
      </p>
      <button
        onClick={() => router.push("/setup")}
        className="bg-black text-white rounded px-6 py-3 hover:bg-gray-800 transition"
      >
        Continue to Setup
      </button>
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