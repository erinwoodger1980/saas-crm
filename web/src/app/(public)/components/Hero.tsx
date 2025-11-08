"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { appendReferralParam } from "@/lib/referral";
import { buildSignupUrl, describeSeats, formatGBP, getBasePrice } from "@/lib/price";

type HeroProps = {
  referral?: string;
  onOpenDemo: () => void;
  /** 
   * Callback to track CTA clicks. The 'source' param is used internally. 
   */
  onCtaClick?: (_source: string) => void;
};

type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const PROMO_CODE = "EARLY60";
const DEADLINE_FALLBACK = "2026-03-31T23:59:59Z";

function formatCountdown(value: number) {
  return value.toString().padStart(2, "0");
}

function getCountdown(deadline: Date): Countdown {
  const total = Math.max(deadline.getTime() - Date.now(), 0);
  const seconds = Math.floor(total / 1000);
  return {
    days: Math.floor(seconds / (60 * 60 * 24)),
    hours: Math.floor((seconds / (60 * 60)) % 24),
    minutes: Math.floor((seconds / 60) % 60),
    seconds: seconds % 60,
  };
}

export default function Hero({ referral, onOpenDemo, onCtaClick }: HeroProps) {
  const deadline = useMemo(() => {
    const value = process.env.NEXT_PUBLIC_DISCOUNT_DEADLINE ?? DEADLINE_FALLBACK;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, []);

  const [countdown, setCountdown] = useState<Countdown | null>(() =>
    deadline ? getCountdown(deadline) : null,
  );
  const [isExpired, setIsExpired] = useState(() =>
    deadline ? deadline.getTime() <= Date.now() : true,
  );

  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const data = getCountdown(deadline);
      setCountdown(data);
      if (
        deadline.getTime() <= Date.now() ||
        (data.days === 0 && data.hours === 0 && data.minutes === 0 && data.seconds === 0)
      ) {
        setIsExpired(true);
      } else {
        setIsExpired(false);
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [deadline]);

  const signupHref = appendReferralParam(buildSignupUrl("monthly"), referral);

  const handlePrimaryClick = () => {
    onCtaClick?.("hero-primary");
  };

  const handleDemoClick = () => {
    onCtaClick?.("hero-demo");
    onOpenDemo();
  };

  const promoPillClassName = isExpired
    ? "rounded-full bg-white/30 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white/70"
    : "rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-900";

  return (
    <header className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white">
      <div className="absolute inset-0 opacity-40" aria-hidden>
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-emerald-500 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-cyan-500 blur-3xl" />
      </div>
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 pb-24 pt-10 sm:px-8 lg:px-12">
        <nav className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">
              JA
            </span>
            <span className="text-lg font-semibold tracking-tight">JoineryAI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Sign in
            </Link>
            <Button asChild>
              <Link
                href={signupHref}
                onClick={handlePrimaryClick}
              >
                Start 14-Day Free Trial
              </Link>
            </Button>
          </div>
        </nav>

        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold">
              <span className="rounded-full bg-emerald-500/90 px-3 py-1 text-xs uppercase tracking-wide text-slate-900">
                60% lifetime discount
              </span>
              {deadline && !isExpired && countdown ? (
                <span aria-live="polite">
                  Offer ends in {countdown.days}d {formatCountdown(countdown.hours)}h
                  :{formatCountdown(countdown.minutes)}m
                  :{formatCountdown(countdown.seconds)}s
                </span>
              ) : (
                <span aria-live="polite">Offer ended — check availability</span>
              )}
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Quote faster. Win more jobs. Run a smarter workshop.
            </h1>
            <p className="text-lg text-white/80 sm:text-xl">
              JoineryAI helps UK joinery manufacturers, showrooms and installers automate
              quoting, follow-ups and workshop scheduling.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link
                  href={signupHref}
                  onClick={handlePrimaryClick}
                >
                  Start Free Trial
                  <span className={promoPillClassName} aria-disabled={isExpired}>
                    {PROMO_CODE}
                  </span>
                </Link>
              </Button>
              <button
                type="button"
                onClick={handleDemoClick}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-white/30 px-8 py-3 text-base font-semibold text-white transition hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
              >
                See a Demo
              </button>
            </div>
            <div className="space-y-2 text-sm text-white/70">
              <p>14-day free trial · Cancel anytime · No credit card required.</p>
              <p>
                {isExpired ? "Standard pricing from " : "Standard pricing "}
                {formatGBP(getBasePrice("monthly"))}/mo · {describeSeats()}.
              </p>
            </div>
          </div>
          <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
            <div className="space-y-5 text-left text-sm text-white/80">
              <p className="text-base font-semibold uppercase tracking-widest text-emerald-200">
                Setup wizard snapshot
              </p>
              <ul className="space-y-3 text-sm leading-relaxed">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
                  Connect Gmail or Microsoft 365 in minutes.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
                  Paste your company website and we auto-fill your branding, pricing rules and
                  follow-up cadence.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
                  Invite 5 office, 10 workshop and 2 display users instantly.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
                  Stripe Direct Debit checkout ready whenever you are.
                </li>
              </ul>
            </div>
            {!isExpired && countdown && (
              <div className="mt-8 grid grid-cols-4 gap-2 rounded-2xl border border-white/15 bg-black/20 p-4 text-center">
                {[
                  { label: "Days", value: countdown.days },
                  { label: "Hours", value: countdown.hours },
                  { label: "Mins", value: countdown.minutes },
                  { label: "Secs", value: countdown.seconds },
                ].map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="text-2xl font-semibold text-white">
                      {formatCountdown(item.value)}
                    </div>
                    <div className="text-xs uppercase tracking-wide text-white/60">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isExpired && (
              <div className="mt-8 rounded-2xl border border-white/15 bg-black/20 p-4 text-center text-sm text-white/70">
                The EARLY60 offer has ended. Speak to our team for the next release.
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
