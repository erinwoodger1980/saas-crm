// web/src/app/billing/page.tsx
"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

const FOUNDERS_CODE = process.env.NEXT_PUBLIC_FOUNDERS_PROMO_CODE || "";

export default function BillingPage() {
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");
  const [useFounders, setUseFounders] = useState<boolean>(!!FOUNDERS_CODE);
  const [customCode, setCustomCode] = useState<string>(FOUNDERS_CODE);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const promoToSend = useMemo(() => {
    if (!useFounders) return undefined;
    return (customCode || "").trim() || undefined;
  }, [useFounders, customCode]);

  // (Optional) example pricing display
  const display = useMemo(() => {
    const rrpMonthly = 625;
    const rrpAnnualMonthly = 468.75; // per-month equivalent when billed yearly
    const foundersPct = 0.6; // 60% off
    const payPct = useFounders && promoToSend ? 1 - foundersPct : 1;

    return {
      monthlyNow: Math.round(rrpMonthly * payPct * 100) / 100,
      annualNowMonthly: Math.round(rrpAnnualMonthly * payPct * 100) / 100,
      annualNowTotal: Math.round(rrpAnnualMonthly * 12 * payPct * 100) / 100,
    };
  }, [useFounders, promoToSend]);

  async function goCheckout() {
    setLoading(true);
    setErr(null);
    try {
      const { url } = await apiFetch<{ url: string }>("/billing/checkout", {
        method: "POST",
        json: {
          plan,
          // Send the code explicitly; server can also auto-apply if applicable
          promotionCode: promoToSend,
        },
      });
      if (!url) throw new Error("No checkout URL returned");
      window.location.href = url;
    } catch (e: any) {
      setErr(e?.message || String(e));
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Choose your plan</h1>

      <section className="mb-6 grid grid-cols-2 gap-3">
        <button
          onClick={() => setPlan("monthly")}
          className={`rounded-2xl border p-4 text-left ${
            plan === "monthly" ? "border-black" : "border-gray-300"
          }`}
        >
          <div className="text-lg font-medium">Monthly</div>
          <div className="mt-1 text-sm text-gray-600">
            RRP £625 / mo
            {useFounders && promoToSend ? (
              <div className="mt-1">
                <span className="inline-block rounded-full border px-2 py-0.5 text-xs">
                  Founders: £{display.monthlyNow.toFixed(2)} / mo
                </span>
              </div>
            ) : null}
          </div>
        </button>

        <button
          onClick={() => setPlan("annual")}
          className={`rounded-2xl border p-4 text-left ${
            plan === "annual" ? "border-black" : "border-gray-300"
          }`}
        >
          <div className="text-lg font-medium">Annual</div>
          <div className="mt-1 text-sm text-gray-600">
            RRP £468.75 / mo (billed yearly)
            {useFounders && promoToSend ? (
              <div className="mt-1">
                <span className="inline-block rounded-full border px-2 py-0.5 text-xs">
                  Founders: £{display.annualNowMonthly.toFixed(2)} / mo (£
                  {display.annualNowTotal.toFixed(2)} / yr)
                </span>
              </div>
            ) : null}
          </div>
        </button>
      </section>

      <section className="mb-6 rounded-2xl border border-gray-200 p-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useFounders}
            onChange={(e) => setUseFounders(e.target.checked)}
          />
        </label>
        <span className="ml-2">Apply founders discount</span>

        <div className="mt-3">
          <label className="text-sm text-gray-600">Promotion code</label>
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 p-2"
            placeholder="e.g., FOUNDERS60"
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value)}
            disabled={!useFounders}
          />
          <p className="mt-1 text-xs text-gray-500">
            You can change or remove the code; Stripe will validate it at checkout.
          </p>
        </div>
      </section>

      {err ? (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <button
        onClick={goCheckout}
        disabled={loading}
        className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-60"
      >
        {loading
          ? "Redirecting…"
          : plan === "annual"
          ? "Continue with Annual"
          : "Continue with Monthly"}
      </button>
    </main>
  );
}