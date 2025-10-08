"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL =
  (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL)?.replace(/\/$/, "") ||
  "http://localhost:4000";

function pickToken(json: any): string | null {
  return (
    json?.jwt ||
    json?.token ||
    json?.accessToken ||
    json?.data?.jwt ||
    json?.data?.token ||
    null
  );
}

/** Store token both in localStorage (for client fetches) and as a cookie (for middleware). */
function storeAuth(token: string) {
  try {
    localStorage.setItem("jwt", token);
  } catch {}
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  // 30 days, SameSite=Lax so regular navigations carry it
  document.cookie = `jwt=${encodeURIComponent(
    token
  )}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`;
}

export default function LoginPage() {
  const [email, setEmail] = useState("erin@acme.test");
  const [password, setPassword] = useState("secret12");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [debugBody, setDebugBody] = useState<string | null>(null);

  const next = useMemo(() => {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get("next") || "/leads";
    } catch {
      return "/leads";
    }
  }, []);

  /** 1) Handle MS365 (and any provider) redirect: /login?jwt=... */
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const jwt = url.searchParams.get("jwt");
      if (jwt) {
        storeAuth(jwt);
        // Clean the URL then send user along
        const go = url.searchParams.get("next") || "/leads";
        window.location.replace(go);
      }
    } catch {
      /* ignore */
    }
  }, []);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setDebugBody(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {}
      const token = pickToken(json);

      if (!res.ok || !token) {
        setErr(
          json?.error ||
            json?.message ||
            `Login failed (${res.status}) — see response below`
        );
        setDebugBody(text || "(empty response)");
        setLoading(false);
        return;
      }

      storeAuth(token);
      window.location.href = next;
    } catch (e: any) {
      setErr(e?.message || "Network error");
      setLoading(false);
    }
  }

  /** Handy dev escape hatch — /seed always returns { jwt } */
  async function useDevSeed() {
    setErr(null);
    setDebugBody(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/seed`, { method: "POST" });
      const json = await res.json();
      const token = pickToken(json);
      if (!res.ok || !token) {
        setErr(json?.error || `Seed failed (${res.status})`);
        setDebugBody(JSON.stringify(json, null, 2));
        setLoading(false);
        return;
      }
      storeAuth(token);
      window.location.href = next;
    } catch (e: any) {
      setErr(e?.message || "Network error");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-6">
      <form
        onSubmit={doLogin}
        className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold mb-4">Log in to Joinery CRM</h1>

        <label className="block text-sm mb-3">
          <span className="text-slate-600">Email</span>
          <input
            type="email"
            className="mt-1 w-full rounded-md border p-2 outline-none focus:ring-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="block text-sm mb-4">
          <span className="text-slate-600">Password</span>
          <input
            type="password"
            className="mt-1 w-full rounded-md border p-2 outline-none focus:ring-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {err && (
          <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        )}
        {debugBody && (
          <pre className="mb-3 max-h-40 overflow-auto rounded-md bg-slate-50 p-2 text-[11px] text-slate-700 border">
            {debugBody}
          </pre>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        {/* 2) Microsoft 365 OAuth button */}
        <a
          href={`${API_URL}/integrations/ms365/login`}
          className="mt-3 inline-flex w-full items-center justify-center rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
        >
          Sign in with Microsoft 365
        </a>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Dev account: <code>erin@acme.test</code> / <code>secret12</code>
          </p>
          <button
            type="button"
            onClick={useDevSeed}
            disabled={loading}
            className="text-xs text-blue-700 underline"
            title="Call /seed and store the returned jwt"
          >
            Use dev seed
          </button>
        </div>
      </form>
    </div>
  );
}