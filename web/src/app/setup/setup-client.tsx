"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, setJwt } from "@/lib/api";

export default function SetupClient() {
  const params = useSearchParams();
  const router = useRouter();

  // Prefer fresh token from URL, else fall back to sessionStorage.
  const tokenFromUrl = params.get("setup_jwt") || null;
  const [setupJwt, setSetupJwt] = useState<string | null>(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Save token from URL → sessionStorage; or restore from sessionStorage.
  useEffect(() => {
    if (tokenFromUrl) {
      sessionStorage.setItem("setup_jwt", tokenFromUrl);
      setSetupJwt(tokenFromUrl);
    } else if (!setupJwt) {
      const cached = sessionStorage.getItem("setup_jwt");
      if (cached) setSetupJwt(cached);
    }
  }, [tokenFromUrl, setupJwt]);

  const canSubmit = useMemo(
    () => !!setupJwt && password.length >= 8 && password === confirm && !loading,
    [setupJwt, password, confirm, loading]
  );

  async function submit() {
    setErr(null);
    if (!setupJwt) return setErr("Missing setup token. Please return via the thank-you page.");
    if (password.length < 8) return setErr("Password must be at least 8 characters.");
    if (password !== confirm) return setErr("Passwords do not match.");

    setLoading(true);
    try {
      // Your existing backend route
      const { jwt } = await apiFetch<{ jwt: string }>("/auth/setup/complete", {
        method: "POST",
        json: { setup_jwt: setupJwt, password },
      });

      if (!jwt) throw new Error("No token returned");
      setJwt(jwt);
      sessionStorage.removeItem("setup_jwt");
      setOk(true);
      setTimeout(() => router.push("/dashboard"), 700);
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

      {/* Hidden token input for forms / autofill tools (not visible to user) */}
      <input type="hidden" name="setup_jwt" value={setupJwt ?? ""} />

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">New password</label>
          <input
            type="password"
            className="w-full border rounded p-2"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
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
            autoComplete="new-password"
          />
        </div>

        {!setupJwt && (
          <div className="border border-red-300 bg-red-50 text-red-700 p-3 rounded">
            Missing setup token. Please open the “Continue to Setup” link from the thank-you page.
          </div>
        )}

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
          disabled={!canSubmit}
          className={`w-full rounded px-5 py-3 text-white ${
            canSubmit ? "bg-black hover:bg-gray-800" : "bg-black/50 cursor-not-allowed"
          }`}
        >
          {loading ? "Saving…" : "Finish setup"}
        </button>
      </div>
    </main>
  );
}