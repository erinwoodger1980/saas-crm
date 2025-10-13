"use client";
import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
const FOUNDERS = process.env.NEXT_PUBLIC_FOUNDERS_PROMO_CODE || "";

export default function SignupPage() {
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");
  const [promo, setPromo] = useState(FOUNDERS);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`${API_BASE}/public/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, email, plan, promotionCode: promo || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `status ${res.status}`);
      window.location.href = j.url;
    } catch (e: any) {
      setErr(e?.message || String(e));
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Start your 14-day free trial</h1>
      <div className="space-y-4">
        <input className="w-full border p-2 rounded" placeholder="Company name" value={company} onChange={e=>setCompany(e.target.value)} />
        <input className="w-full border p-2 rounded" placeholder="Work email" value={email} onChange={e=>setEmail(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <button onClick={()=>setPlan("monthly")} className={`border rounded p-3 text-left ${plan==="monthly"?"border-black":"border-gray-300"}`}>
            <div className="font-medium">Monthly</div><div className="text-sm text-gray-600">£625 / mo</div>
          </button>
          <button onClick={()=>setPlan("annual")} className={`border rounded p-3 text-left ${plan==="annual"?"border-black":"border-gray-300"}`}>
            <div className="font-medium">Annual</div><div className="text-sm text-gray-600">£468.75 / mo (billed yearly)</div>
          </button>
        </div>
        <div>
          <label className="text-sm text-gray-600">Promotion code</label>
          <input className="mt-1 w-full border p-2 rounded" value={promo} onChange={e=>setPromo(e.target.value)} placeholder="Optional" />
        </div>
        {err && <div className="border border-red-300 bg-red-50 text-red-700 p-3 rounded">{err}</div>}
        <button onClick={submit} disabled={loading} className="bg-black text-white rounded px-5 py-3">
          {loading ? "Redirecting…" : `Continue with ${plan === "annual" ? "Annual" : "Monthly"}`}
        </button>
      </div>
    </main>
  );
}