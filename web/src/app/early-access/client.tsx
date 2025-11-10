"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function EarlyAccessPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
      const response = await fetch(`${apiBase}/api/early-access/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, company, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      console.log("Early adopter account created:", data);
      
      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
      <div className="absolute inset-0 opacity-40" aria-hidden>
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-emerald-500 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-cyan-500 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-8 lg:px-12">
        <nav className="mb-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">
              JA
            </span>
            <span className="text-lg font-semibold tracking-tight">JoineryAI</span>
          </Link>
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Already have an account? Sign in
          </Link>
        </nav>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-white">
                <span className="rounded-full bg-emerald-500/90 px-3 py-1 text-xs uppercase tracking-wide text-slate-900">
                  Early Access
                </span>
                <span>30 Days Free</span>
              </div>
              <h1 className="text-4xl font-semibold text-white">
                Join as an Early Adopter
              </h1>
              <p className="mt-3 text-lg text-white/70">
                Get exclusive access, 30 days free, and shape the future of JoineryAI
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="company" className="mb-2 block text-sm font-medium text-white/90">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    placeholder="Acme Joinery Ltd"
                  />
                </div>

                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-medium text-white/90">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    placeholder="John Smith"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-white/90">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    placeholder="john@acmejoinery.co.uk"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-white/90">
                    Password *
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-white/90">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                    placeholder="Re-enter password"
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-3">
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Creating Account..." : "Create Early Access Account"}
                </Button>

                <div className="space-y-3 rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-4 text-sm text-white/80">
                  <p className="font-semibold text-emerald-300">What you get:</p>
                  <ul className="space-y-1.5 pl-5 text-xs">
                    <li>• 30 days completely free — no credit card required</li>
                    <li>• Full access to all features including Google Ads integration</li>
                    <li>• Pre-configured with proven workflows from Wealden Joinery</li>
                    <li>• Priority support and direct feedback channel</li>
                    <li>• Special early adopter pricing when you subscribe</li>
                  </ul>
                </div>
              </form>
            </div>

            <p className="mt-6 text-center text-sm text-white/60">
              By signing up, you agree to our{" "}
              <Link href="/policy/terms" className="text-emerald-400 hover:text-emerald-300">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/policy/privacy" className="text-emerald-400 hover:text-emerald-300">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
