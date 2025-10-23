"use client";

import { useEffect, useState } from "react";
import { apiFetch, setJwt } from "@/lib/api";

type Status = {
  name: string;
  subscriptionStatus: string | null;
  plan: "monthly" | "annual" | null;
  trialEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  discountCodeUsed: string | null;
};

export default function SuccessClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // capture ?setup_jwt=... after Stripe redirect
    try {
      const urlJwt = new URLSearchParams(window.location.search).get("setup_jwt");
      if (urlJwt) setJwt(urlJwt);
    } catch {}

    (async () => {
      try {
        const j = await apiFetch<Status>("/billing/status", { cache: "no-store" });
        setStatus(j);
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const trialText =
    status?.trialEndsAt ? new Date(status.trialEndsAt).toLocaleDateString() : null;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">🎉 You’re all set!</h1>
      <p className="mb-6 text-gray-600">
        Thanks for subscribing to <strong>Joinery AI</strong>.
      </p>

      {loading && <div className="rounded-lg border p-4">Checking subscription…</div>}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}

      {status && (
        <div className="rounded-xl border p-4">
          <div className="mb-2"><span className="text-gray-500">Tenant:</span> {status.name}</div>
          <div className="mb-2"><span className="text-gray-500">Status:</span> {status.subscriptionStatus ?? "—"}</div>
          <div className="mb-2"><span className="text-gray-500">Plan:</span> {status.plan ?? "—"}</div>
          <div className="mb-2"><span className="text-gray-500">Trial ends:</span> {trialText ?? "—"}</div>
          {status.discountCodeUsed && (
            <div className="mb-2"><span className="text-gray-500">Promotion:</span> {status.discountCodeUsed}</div>
          )}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <a href="/dashboard" className="rounded-xl bg-black px-5 py-3 text-white">Go to Dashboard</a>
        <a href="/setup" className="rounded-xl border px-5 py-3">Continue Setup</a>
      </div>
    </main>
  );
}