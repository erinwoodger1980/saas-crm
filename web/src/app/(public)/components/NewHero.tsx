"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

type NewHeroProps = {
  onOpenDemo: () => void;
  onCtaClick?: (_source: string) => void;
};

export default function NewHero({ onOpenDemo, onCtaClick }: NewHeroProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const submitInterest = async (payload: { email: string; name: string; company: string; phone: string }) => {
    setError("");
    setLoading(true);

    try {
      const { getApiBase } = await import("@/lib/api-base");
      const apiBase = getApiBase();
      // apiBase is always /api, http://api.example.com/api, or similar
      // Simply append /interest to it
      const endpoint = `${apiBase}/interest`;
      
      console.log("Submitting interest to:", endpoint);
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("Interest response:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("Interest success:", data);
        setSubmitted(true);
        // Use returned email from API or fall back to input
        setEmail(data.email || payload.email);
        onCtaClick?.("hero-trial");
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || "Failed to register interest. Please try again.");
        console.error("Interest failed:", response.status, errorData);
      }
    } catch (err) {
      console.error("Failed to submit:", err);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Ask for details via popup/modal before submitting.
    if (!showDetails) {
      setShowDetails(true);
      return;
    }

    if (!name.trim() || !company.trim() || !phone.trim()) {
      setError("Please enter your name, company name, and phone number.");
      return;
    }

    await submitInterest({
      email: email.trim(),
      name: name.trim(),
      company: company.trim(),
      phone: phone.trim(),
    });
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white">
      {/* Background gradient blobs */}
      <div className="absolute inset-0 opacity-40" aria-hidden>
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-emerald-500 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-cyan-500 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-24 sm:px-8 lg:px-12">
        {/* Nav */}
        <nav className="mb-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">
              JA
            </span>
            <span className="text-lg font-semibold tracking-tight">JoineryAI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Sign in
            </Link>
            <Button asChild variant="outline" className="border-white/20 bg-white/10 hover:bg-white/20">
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        </nav>

        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-3 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold">
              <span className="rounded-full bg-amber-500/90 px-3 py-1 text-xs uppercase tracking-wide text-slate-900">
                February Cohort Full
              </span>
              <span>Now taking interest for March</span>
            </div>

            {/* Main headline */}
            <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
              Quote faster.
              <br />
              Win more jobs.
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Run a smarter workshop.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-white/80 leading-relaxed">
              JoineryAI automates quoting, email follow-ups, and workshop scheduling for UK joinery manufacturers, installers, and showrooms. CRM built for profit.
            </p>

            {/* Key benefits */}
            <div className="space-y-3">
              {[
                "Supplier PDFs → polished quotes in 5 minutes",
                "Email integration captures every lead automatically",
                "Workshop visibility from timesheets to job board",
                "Real job costing: see what you actually made",
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3 text-white/90">
                  <Check className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            {/* CTA section */}
            {!submitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    disabled={loading}
                    className="flex-1 rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-50"
                  />
                  <Button
                    type="submit"
                    size="lg"
                    disabled={loading}
                    className="gap-2"
                  >
                    {loading ? "Registering..." : "Join March Cohort"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-white/60">Our February cohort is full. Register your interest for our March launch.</p>
                {error && (
                  <p className="text-sm text-red-400">{error}</p>
                )}

                {showDetails && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-5 text-white shadow-xl">
                      <div className="text-lg font-semibold">A couple of details</div>
                      <p className="mt-1 text-sm text-white/70">
                        Please add your details so we can contact you with next steps.
                      </p>

                      <div className="mt-4 space-y-3">
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          required
                          disabled={loading}
                          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-50"
                        />
                        <input
                          type="text"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder="Company name"
                          required
                          disabled={loading}
                          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-50"
                        />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Phone number"
                          required
                          disabled={loading}
                          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:opacity-50"
                        />
                      </div>

                      <div className="mt-5 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowDetails(false)}
                          disabled={loading}
                          className="rounded-full px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <Button
                          type="button"
                          size="lg"
                          disabled={loading}
                          onClick={async () => {
                            setError("");
                            if (!name.trim() || !company.trim() || !phone.trim()) {
                              setError("Please enter your name, company name, and phone number.");
                              return;
                            }
                            setShowDetails(false);
                            await submitInterest({
                              email: email.trim(),
                              name: name.trim(),
                              company: company.trim(),
                              phone: phone.trim(),
                            });
                          }}
                          className="gap-2"
                        >
                          Continue
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            ) : (
              <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-6 space-y-3">
                <p className="font-semibold text-emerald-300 text-lg">✓ Thank you for registering!</p>
                <p className="text-white/90">
                  We've sent a confirmation email to <strong>{email}</strong>.
                </p>
                <p className="text-sm text-white/80">
                  Someone from the team will be in touch with next steps.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setEmail("");
                    setName("");
                    setCompany("");
                    setPhone("");
                    setShowDetails(false);
                  }}
                  className="text-sm text-emerald-300 hover:text-emerald-200 underline mt-4"
                >
                  Register another email
                </button>
              </div>
            )}
          </div>

          {/* Right side: feature preview / screenshot would go here */}
          <div className="relative hidden lg:block">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-2xl blur-2xl" />
            <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-8">
              <div className="space-y-4">
                <div className="h-3 w-3/4 rounded-full bg-white/20" />
                <div className="space-y-2">
                  <div className="h-2 w-full rounded-full bg-white/10" />
                  <div className="h-2 w-5/6 rounded-full bg-white/10" />
                </div>
                <div className="pt-4 space-y-2">
                  <div className="h-2 w-full rounded-full bg-emerald-500/30" />
                  <div className="h-2 w-4/5 rounded-full bg-emerald-500/20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
