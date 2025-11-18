// web/src/app/reset-password/reset-inner.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();

  const tokenFromUrl = params.get("token") || "";
  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tokenFromUrl) setToken(tokenFromUrl);
  }, [tokenFromUrl]);

  async function submit() {
    setErr(null);

    if (!token) return setErr("Missing reset token. Use the link from your email.");
    if (!password || password.length < 8) return setErr("Password must be at least 8 characters.");
    if (password !== confirm) return setErr("Passwords do not match.");

    setLoading(true);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        json: { token, password },
      });
      setOk(true);
      // brief success, then send to login
      setTimeout(() => router.push("/login?reset=ok"), 900);
    } catch (e: any) {
      setErr(e?.message || "Failed to reset password");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-2">Set a new password</h1>
      <p className="text-gray-600 mb-6">
        Enter your new password below.
      </p>

      {/* Only show manual token box if user navigated here without the link */}
      {!tokenFromUrl && (
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">Reset token</label>
          <input
            className="w-full border rounded p-2 font-mono"
            placeholder="Paste token from your email"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">New password</label>
          <input
            type="password"
            className="w-full border rounded p-2"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Confirm password</label>
          <input
            type="password"
            className="w-full border rounded p-2"
            placeholder="Re-enter password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {err && (
          <div className="border border-red-300 bg-red-50 text-red-700 p-3 rounded">
            {err}
          </div>
        )}
        {ok && (
          <div className="border border-green-300 bg-green-50 text-green-800 p-3 rounded">
            Password updated — redirecting to login…
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="w-full bg-black text-white rounded px-5 py-3"
        >
          {loading ? "Saving…" : "Update password"}
        </button>
      </div>
    </main>
  );
}