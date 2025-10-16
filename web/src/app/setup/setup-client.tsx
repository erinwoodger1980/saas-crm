"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, setJwt } from "@/lib/api";

export default function SetupClient() {
  const params = useSearchParams();
  const router = useRouter();

  // From thank-you page redirect: /setup?setup_jwt=...
  const tokenFromUrl = params.get("setup_jwt") || "";

  const [setupJwt, setSetupJwt] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (tokenFromUrl) setSetupJwt(tokenFromUrl);
  }, [tokenFromUrl]);

  async function submit() {
    setErr(null);

    if (!setupJwt) return setErr("Missing setup token. Open the link from the thank-you page.");
    if (!password || password.length < 8) {
      return setErr("Password must be at least 8 characters.");
    }
    if (password !== confirm) {
      return setErr("Passwords do not match.");
    }

    setLoading(true);
    try {
      const { jwt } = await apiFetch<{ jwt: string }>("/auth/setup/complete", {
        method: "POST",
        json: { setup_jwt: setupJwt, password },
      });

      if (!jwt) throw new Error("No token returned");
      setJwt(jwt);
      setOk(true);
      setTimeout(() => router.push("/dashboard"), 900);
    } catch (e: any) {
      setErr(e?.message || "Failed to complete setup");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-2">Create your password</h1>
      <p className="text-gray-600 mb-6">
        Finish setting up your account by creating a password.
      </p>

      {/* If for any reason the user hit /setup directly, allow pasting the token */}
      {!tokenFromUrl && (
        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1">Setup token</label>
          <input
            className="w-full border rounded p-2 font-mono"
            placeholder="Paste setup_jwt"
            value={setupJwt}
            onChange={(e) => setSetupJwt(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            You get this automatically when coming from the Stripe success page.
          </p>
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
            Password saved. Redirecting…
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading}
          className="w-full bg-black text-white rounded px-5 py-3"
        >
          {loading ? "Saving…" : "Finish setup"}
        </button>
      </div>
    </main>
  );
}