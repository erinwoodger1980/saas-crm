"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

// Accept an invite via token in query string: /accept-invite?token=XYZ
// Flow:
// 1. Validate token -> fetch invite context (email, role, company)
// 2. Prompt user to set password
// 3. POST to /auth/setup/complete with token + password
// 4. Redirect to app root on success

// Minimal context — if you later add an endpoint to fetch invite metadata, extend here.
interface InviteContext {
  email?: string;
  role?: string;
  companyName?: string;
}

export default function AcceptInvitePage() {
  const [token, setToken] = useState<string | null>(null);
  const [ctx, setCtx] = useState<InviteContext | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") || params.get("setup_jwt");
    if (!t) {
      setError("missing_token");
      return;
    }
    setToken(t);
    // If you implement an invite context endpoint later, fetch it here.
  }, []);

  async function submit() {
    if (!token) return;
    if (password.length < 8) {
      setError("password_too_short");
      return;
    }
    if (password !== confirm) {
      setError("passwords_do_not_match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/auth/setup/complete`, {
        method: "POST",
        json: { setup_jwt: token, password },
      });
      setDone(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    } catch (e: any) {
      setError(e?.message || "setup_failed");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold mb-2">Accept Invitation</h1>
      <p className="text-sm text-gray-600 mb-6">Set a password to activate your account.</p>
      {error && (
        <div className="mb-4 border border-red-300 bg-red-50 text-red-700 p-3 rounded text-sm">
          {error}
        </div>
      )}
      {done && (
        <div className="mb-4 border border-green-300 bg-green-50 text-green-800 p-3 rounded text-sm">
          Account activated. Redirecting…
        </div>
      )}
      {!done && (
        <div className="space-y-4">
          <div className="text-sm">
            <div><span className="font-medium">Email:</span> {ctx?.email || "…"}</div>
            <div><span className="font-medium">Role:</span> {ctx?.role || "…"}</div>
            {ctx?.companyName && (
              <div><span className="font-medium">Company:</span> {ctx.companyName}</div>
            )}
          </div>
          <input
            type="password"
            className="w-full border p-2 rounded"
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            className="w-full border p-2 rounded"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button
            type="button"
            disabled={loading || !token}
            onClick={submit}
            className="bg-black text-white rounded px-5 py-3 w-full"
          >
            {loading ? "Setting up…" : "Activate Account"}
          </button>
        </div>
      )}
    </main>
  );
}