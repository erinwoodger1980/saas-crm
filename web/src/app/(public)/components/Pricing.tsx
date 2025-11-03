"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { appendReferralParam } from "@/lib/referral";
import {
  BillingCadence,
  buildSignupUrl,
  describeSeats,
  formatGBP,
  getBasePrice,
  getDiscountMultiplier,
  getDiscountedPrice,
} from "@/lib/price";

type PricingProps = {
  referral?: string;
  onCtaClick?: (source: string) => void;
};

const PROMO_CODE = "EARLY60";

export default function Pricing({ referral, onCtaClick }: PricingProps) {
  const [billing, setBilling] = useState<BillingCadence>("monthly");
  const discountMultiplier = getDiscountMultiplier();

  const basePrice = useMemo(() => getBasePrice(billing), [billing]);
  const discountedPrice = useMemo(() => getDiscountedPrice(billing), [billing]);

  const signupHref = appendReferralParam(buildSignupUrl(billing), referral);
  const rawStripeUrl =
    billing === "monthly"
      ? process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_MONTHLY ?? ""
      : process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL_ANNUAL ?? "";
  const stripeCheckoutHref = rawStripeUrl
    ? appendReferralParam(rawStripeUrl, referral)
    : "#";

  const handleTrialClick = () => onCtaClick?.(`pricing-${billing}-trial`);
  const handleStripeClick = () => onCtaClick?.(`pricing-${billing}-stripe`);

  return (
    <section className="bg-slate-900 px-6 py-20 text-white sm:px-10 lg:px-20">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
          Pricing
        </p>
        <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
          One plan with everything Joinery teams need
        </h2>
        <p className="mt-4 text-lg text-white/75">
          Choose monthly flexibility or annual savings. Early adopters lock in a 60% lifetime
          discount with promo code <span className="font-semibold">{PROMO_CODE}</span>.
        </p>
      </div>

      <div className="mx-auto mt-10 flex max-w-md items-center justify-center rounded-full bg-white/10 p-1 text-sm">
        {([
          { label: "Monthly", value: "monthly" as BillingCadence },
          { label: "Annual", value: "annual" as BillingCadence },
        ] as const).map((option) => {
          const isActive = billing === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setBilling(option.value)}
              className={`flex-1 rounded-full px-4 py-2 font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                isActive ? "bg-white text-slate-900" : "text-white/70 hover:text-white"
              }`}
              aria-pressed={isActive}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mx-auto mt-10 max-w-4xl rounded-3xl border border-white/20 bg-white/5 p-10 text-left shadow-xl backdrop-blur">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3 text-white">
            <h3 className="text-2xl font-semibold">
              {billing === "monthly" ? "Monthly" : "Annual"} billing
            </h3>
            <p className="text-white/70">{describeSeats()}.</p>
            <p className="text-sm text-white/60">
              Pay via secure Stripe Direct Debit checkout. Switch plans or cancel any time.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm uppercase tracking-widest text-emerald-200">Lock in EARLY60</p>
            <div className="flex items-end justify-end gap-4">
              <span className="text-2xl text-white/60 line-through">
                {formatGBP(basePrice)}
                <span className="text-base text-white/50">
                  /mo {billing === "annual" ? "(billed annually)" : ""}
                </span>
              </span>
              <div>
                <p className="text-4xl font-semibold text-white">
                  {formatGBP(discountedPrice)}
                  <span className="text-lg font-normal text-white/70">
                    /mo {billing === "annual" ? "(billed annually)" : ""}
                  </span>
                </p>
                <p className="text-xs text-white/60">
                  {Math.round(discountMultiplier * 100)}% of standard pricing applied for life
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <a
              href={signupHref}
              onClick={handleTrialClick}
            >
              Start 14-Day Free Trial
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-900">
                {PROMO_CODE}
              </span>
            </a>
          </Button>
          <a
            href={stripeCheckoutHref}
            onClick={handleStripeClick}
            className="flex w-full items-center justify-center rounded-full border border-white/30 px-8 py-3 text-base font-semibold text-white transition hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
            aria-disabled={!rawStripeUrl}
          >
            Secure Direct Debit Checkout
          </a>
        </div>
      </div>
    </section>
  );
}
