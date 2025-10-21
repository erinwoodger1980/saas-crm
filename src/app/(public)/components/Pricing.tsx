"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BillingCadence,
  buildSignupUrl,
  describeSeats,
  formatGBP,
  getBasePrice,
  getDiscountedPrice,
} from "@/lib/price";
import { appendReferralParam } from "@/lib/referral";

const PROMO_CODE = "EARLY60";

const CHECKOUT_URLS: Record<BillingCadence, string | undefined> = {
  monthly: process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_MONTHLY,
  annual: process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_ANNUAL,
};

type PricingProps = {
  referral?: string;
  onCtaClick?: (source: string) => void;
};

type Tab = {
  id: BillingCadence;
  label: string;
};

const TABS: Tab[] = [
  { id: "monthly", label: "Monthly" },
  { id: "annual", label: "Annual" },
];

export default function Pricing({ referral, onCtaClick }: PricingProps) {
  const [cadence, setCadence] = useState<BillingCadence>("monthly");

  const basePrice = useMemo(() => getBasePrice(cadence), [cadence]);
  const discountedPrice = useMemo(() => getDiscountedPrice(cadence), [cadence]);
  const formattedBase = useMemo(() => formatGBP(basePrice), [basePrice]);
  const formattedDiscounted = useMemo(() => formatGBP(discountedPrice), [discountedPrice]);

  const signupUrl = useMemo(
    () => appendReferralParam(buildSignupUrl(cadence), referral),
    [cadence, referral],
  );

  const checkoutUrl = CHECKOUT_URLS[cadence];

  const handleCta = (source: string) => {
    onCtaClick?.(source);
  };

  return (
    <section id="pricing" className="bg-slate-50 py-20">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 sm:px-8 lg:px-12">
        <div className="space-y-4 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Pricing with a 60% lifetime discount for early adopters
          </h2>
          <p className="text-lg text-slate-600">
            Pay monthly or annually via Stripe Direct Debit. Cancel anytime during the 14-day trial.
          </p>
        </div>
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6 rounded-3xl border border-slate-100 bg-white p-8 shadow-xl">
          <div className="inline-flex self-center rounded-full bg-slate-100 p-1 text-sm font-semibold text-slate-600">
            {TABS.map((tab) => {
              const active = tab.id === cadence;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCadence(tab.id)}
                  className={`rounded-full px-5 py-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 ${
                    active ? "bg-white text-slate-900 shadow" : "text-slate-500"
                  }`}
                  aria-pressed={active}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="space-y-4 text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Promo code {PROMO_CODE}</p>
            <div className="flex flex-col items-center gap-2">
              <div className="text-4xl font-semibold text-slate-900">
                {formattedDiscounted}
                <span className="text-base font-normal text-slate-500">/mo</span>
              </div>
              <div className="text-sm text-slate-500">
                Standard price {formattedBase}/mo · {cadence === "annual" ? "Billed annually" : "Billed monthly"}
              </div>
            </div>
            <p className="text-sm text-slate-600">{describeSeats()}</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href={signupUrl}
              onClick={() => handleCta(`pricing-signup-${cadence}`)}
              className="flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-base font-semibold text-slate-900 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              Start 14-Day Free Trial
            </Link>
            {checkoutUrl && (
              <Link
                href={appendReferralParam(checkoutUrl, referral)}
                target="_blank"
                rel="noreferrer"
                onClick={() => handleCta(`pricing-checkout-${cadence}`)}
                className="flex items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-base font-semibold text-slate-700 transition hover:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
              >
                Go to Stripe Checkout
              </Link>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Prices shown exclude VAT. Discount locks in for the lifetime of your subscription when you apply {PROMO_CODE}.
          </p>
        </div>
      </div>
    </section>
  );
}
