"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type PreLaunchHeroProps = {
  onOpenDemo: () => void;
  onCtaClick?: (_source: string) => void;
};

export default function PreLaunchHero({ onOpenDemo, onCtaClick }: PreLaunchHeroProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { API_BASE: apiBase } = await import("@/src/lib/api-base");
      const response = await fetch(`${apiBase}/api/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to register interest");
      }

      setSubmitted(true);
      onCtaClick?.("hero-waitlist");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
            <Button asChild variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20">
              <Link href="/early-access">
                Early Access
              </Link>
            </Button>
          </div>
        </nav>

        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold">
              <span className="rounded-full bg-emerald-500/90 px-3 py-1 text-xs uppercase tracking-wide text-slate-900">
                Coming Soon
              </span>
              <span>Launching Q1 2026</span>
            </div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Quote faster. Win more jobs. Run a smarter workshop.
            </h1>
            <p className="text-lg text-white/80 sm:text-xl">
              JoineryAI helps UK joinery manufacturers, showrooms and installers automate
              quoting, follow-ups and workshop scheduling with AI-powered tools.
            </p>

            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email address"
                    required
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name (optional)"
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-300">{error}</p>
                )}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={loading}
                    className="w-full sm:w-auto"
                  >
                    {loading ? "Submitting..." : "Join the Waitlist"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      onCtaClick?.("hero-demo");
                      onOpenDemo();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-white/30 px-8 py-3 text-base font-semibold text-white transition hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
                  >
                    See a Demo
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-4">
                  <p className="text-lg font-semibold text-emerald-300">✓ You're on the list!</p>
                  <p className="mt-1 text-white/80">
                    We'll notify you when JoineryAI launches. Check your inbox for confirmation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onCtaClick?.("hero-demo");
                    onOpenDemo();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-white/30 px-8 py-3 text-base font-semibold text-white transition hover:border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
                >
                  See a Demo
                </button>
              </div>
            )}

            <div className="space-y-2 text-sm text-white/70">
              <p>Be the first to know when we launch</p>
              <p>Early adopters get 30 days free + exclusive access</p>
            </div>
          </div>

          <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
            <div className="space-y-5 text-left text-sm text-white/80">
              <p className="text-base font-semibold uppercase tracking-widest text-emerald-200">
                What's Coming
              </p>
              <ul className="space-y-3 text-sm leading-relaxed">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
                  <strong>Google Ads Integration:</strong> Auto-optimize campaigns based on lead quality and conversion rates
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
                  <strong>AI-Powered Landing Pages:</strong> Generate SEO-optimized pages with intelligent headline suggestions
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
                  <strong>Smart Email Integration:</strong> Connect Gmail or Microsoft 365 and let AI handle lead extraction and follow-ups
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
                  <strong>Workshop Scheduling:</strong> Automated capacity planning and task management for your team
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
                  <strong>Intelligent Quoting:</strong> PDF parsing and automated quote generation from customer specs
                </li>
              </ul>
            </div>
            <div className="mt-8 rounded-2xl border border-white/15 bg-black/20 p-4 text-center">
              <p className="text-sm font-semibold text-emerald-300">Built for Joinery Professionals</p>
              <p className="mt-1 text-xs text-white/70">
                Developed with real UK joinery manufacturers to solve real workflow challenges
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
