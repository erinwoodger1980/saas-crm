// web/src/app/forgot-password/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      // Call your API (implement backend endpoint later)
      await apiFetch("/auth/forgot-password", {
        method: "POST",
        json: { email },
      });
      setSent(true);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-2">Forgot your password?</h1>
      <p className="text-gray-600 mb-6">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      {sent ? (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-green-800 mb-6">
          If an account exists for <b>{email}</b>, you’ll receive a reset link shortly.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="you@company.com"
            className="w-full rounded border p-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {err && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-black px-5 py-3 text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <div className="mt-6 text-sm text-gray-600">
        Remembered it?{" "}
        <Link href="/login" className="underline">
          Back to login
        </Link>
      </div>
    </main>
  );
}