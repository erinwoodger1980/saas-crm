"use client";

import { useEffect, useState } from "react";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export default function SetupWizard() {
  const [website, setWebsite] = useState("");
  const [connected, setConnected] = useState<"gmail" | "ms365" | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // naive check: did they connect in another tab?
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const token = localStorage.getItem("jwt") || "";
        const res = await fetch(`${API_BASE}/billing/status`, {
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (res.ok) {
          // if gmail/ms365 connection is reflected in your TenantSettings inbox JSON,
          // you could fetch that here and setConnected(...). For now, keep manual.
        }
      } catch {}
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  async function saveBasics() {
    setSaving(true);
    try {
      const token = localStorage.getItem("jwt") || "";
      const res = await fetch(`${API_BASE}/tenant/settings/basic`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ website }),
      });
      if (!res.ok) throw new Error("save_failed");
      setDone(true);
    } catch {
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold mb-6">Let’s get you set up</h1>

      <ol className="space-y-6">
        <li className="rounded-xl border p-4">
          <h2 className="font-medium mb-2">1) Connect your inbox</h2>
          <p className="text-gray-600 mb-3">Choose Gmail or Microsoft 365. We’ll import recent conversations.</p>
          <div className="flex gap-3">
            <a href={`${API_BASE}/gmail/oauth/start`} className="rounded border px-4 py-2">Connect Gmail</a>
            <a href={`${API_BASE}/ms365/start`} className="rounded border px-4 py-2">Connect Microsoft 365</a>
          </div>
        </li>

        <li className="rounded-xl border p-4">
          <h2 className="font-medium mb-2">2) Your website</h2>
          <p className="text-gray-600 mb-3">We’ll pull your logo and contact details for proposals.</p>
          <input className="w-full rounded border p-2" placeholder="https://yourcompany.co.uk" value={website} onChange={e=>setWebsite(e.target.value)} />
          <button onClick={saveBasics} disabled={saving} className="mt-3 rounded bg-black px-4 py-2 text-white">
            {saving ? "Saving…" : "Save"}
          </button>
          {done && <div className="mt-2 text-green-600">Saved.</div>}
        </li>

        <li className="rounded-xl border p-4">
          <h2 className="font-medium mb-2">3) All set</h2>
          <a href="/dashboard" className="rounded bg-black px-4 py-2 text-white">Go to Dashboard</a>
        </li>
      </ol>
    </main>
  );
}