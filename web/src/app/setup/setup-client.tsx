// web/src/app/setup/setup-client.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, setJwt } from "@/lib/api";

export default function SetupClient() {
  const params = useSearchParams();
  const router = useRouter();

  // Prefer URL param, else sessionStorage
  const tokenFromUrl = params.get("setup_jwt") || "";
  const tokenFromStorage = useMemo(() => {
    try {
      return sessionStorage.getItem("setup_jwt") || "";
    } catch {
      return "";
    }
  }, []);

  const initialToken = tokenFromUrl || tokenFromStorage;

  const [setupJwt, setSetupJwt] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Keep state in sync if the URL param arrives late
  useEffect(() => {
    if (tokenFromUrl && tokenFromUrl !== setupJwt) setSetupJwt(tokenFromUrl);
  }, [tokenFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    setErr(null);

    const token = setupJwt?.trim();
    if (!token) {
      setErr('Missing setup token. Please open the “Continue to Setup” link from the thank-you page.');
      return;
    }
    if (!password || password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { jwt } = await apiFetch<{ jwt: string }>("/auth/setup/complete", {
        method: "POST",
        json: { setup_jwt: token, password },
      });

      if (!jwt) throw new Error("No token returned");
      setJwt(jwt);

      // Cleanup the one-time token
      try {
        if (sessionStorage.getItem("setup_jwt")) {
          sessionStorage.removeItem("setup_jwt");
        }
      } catch {}

      setOk(true);
      setTimeout(() => router.push("/dashboard"), 600);
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
          className="w-full bg-black text-white rounded px-5 py-3 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Finish setup"}
        </button>
      </div>
    </main>
  );
}