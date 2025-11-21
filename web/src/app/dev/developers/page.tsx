"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, RefreshCw, PlusCircle } from "lucide-react";

type DevUser = {
  id: string;
  email: string;
  isDeveloper: boolean;
  role: string;
  createdAt?: string;
};

export default function DevelopersPage() {
  const [developers, setDevelopers] = useState<DevUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [adding, setAdding] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null); setMessage(null);
    try {
      const data = await apiFetch<{ developers: DevUser[] }>("/developers");
      setDevelopers(data.developers || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load developers");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function validateEmail(v: string) {
    return /.+@.+\..+/.test(v);
  }

  async function addDeveloper(e: React.FormEvent) {
    e.preventDefault();
    if (!validateEmail(email)) { setError("Invalid email format"); return; }
    setAdding(true); setError(null); setMessage(null);
    try {
      const out = await apiFetch<{ message: string; user: DevUser }>("/developers", { method: "POST", json: { email } });
      setMessage(out.message || "Developer added/updated");
      setEmail("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to add developer");
    } finally { setAdding(false); }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Users className="w-7 h-7 text-purple-600" /> Developers</h1>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2"><PlusCircle className="w-5 h-5" /> Add / Promote Developer</h2>
        <form onSubmit={addDeveloper} className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="developer@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={adding}
            className="flex-1"
          />
          <Button type="submit" disabled={adding || !email}> {adding ? "Saving..." : "Save"} </Button>
        </form>
        {message && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{message}</div>}
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
        <p className="text-xs text-slate-500">If the email exists it will be promoted. Otherwise a new user is created with a generated password.</p>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Current Developer Accounts</h2>
        {loading ? <div className="text-sm text-muted-foreground">Loading...</div> : null}
        {!loading && developers.length === 0 && <div className="text-sm text-muted-foreground">No developer accounts yet.</div>}
        <div className="divide-y">
          {developers.map(dev => (
            <div key={dev.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{dev.email}</div>
                <div className="text-xs text-muted-foreground">Role: {dev.role}{dev.createdAt ? ` • Created ${new Date(dev.createdAt).toLocaleDateString()}` : ""}</div>
              </div>
              <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700">Developer</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
