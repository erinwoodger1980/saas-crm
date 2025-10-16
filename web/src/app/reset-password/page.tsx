// web/src/app/reset-password/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        json: { token, password },
      });
      setOk(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (e: any) {
      setErr(e?.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-2">Set a new password</h1>
      {!token && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800 mb-4">
          Missing or invalid token. Please use the link from your email.
        </div>
      )}

      {ok ? (
        <div className="rounded border border-green-300 bg-green-50 p-3 text-green-800">
          Password updated! Redirecting to login…
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            required
            minLength={8}
            placeholder="New password"
            className="w-full rounded border p-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!token}
          />
          {err && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
              {err}
            </div>
          )}
          <button
            type="submit"
            disabled={!token || loading}
            className="w-full rounded bg-black px-5 py-3 text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      )}

      <div className="mt-6 text-sm text-gray-600">
        <Link href="/login" className="underline">
          Back to login
        </Link>
      </div>
    </main>
  );
}