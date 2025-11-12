"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type UserRow = { id: string; name: string | null; email: string; role?: string };

type UsersResponse = { ok: boolean; items: UserRow[] };

type InviteResponse = { ok: true; userId: string; email: string; role: string; setupToken: string; setupLink: string } | { error: string };

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ email: string; role: "admin" | "workshop" | "" }>({ email: "", role: "" });
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<UsersResponse>("/workshop/users");
      if ((data as any)?.ok) setUsers(data.items);
    } catch (e: any) {
      setError(e?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  async function onInvite() {
    setInviteLink(null);
    if (!form.email || !form.role) return;
    try {
      const resp = await apiFetch<InviteResponse>("/auth/invite", {
        method: "POST",
        json: { email: form.email, role: form.role },
      });
      if ((resp as any)?.setupLink) {
        setInviteLink((resp as any).setupLink);
        await loadUsers();
        setForm({ email: "", role: "" });
      }
    } catch (e: any) {
      setError(e?.message || "Invite failed");
    }
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Button variant="outline" onClick={loadUsers}>Refresh</Button>
      </div>

      <Card className="p-4">
        <h2 className="font-medium mb-3">Invite a user</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Email</label>
            <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@company.com" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Role</label>
            <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v as any }))}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="workshop">Workshop</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Button onClick={onInvite} disabled={!form.email || !form.role}>Send Invite</Button>
          </div>
        </div>
        {inviteLink && (
          <div className="text-xs text-green-700 mt-3 break-all">
            Invite link created: <a href={inviteLink} className="underline" target="_blank" rel="noreferrer">{inviteLink}</a>
          </div>
        )}
        {error && (
          <div className="text-xs text-red-600 mt-2">{error}</div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="font-medium mb-3">Current users</h2>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : users.length === 0 ? (
          <div className="text-sm text-muted-foreground">No users found.</div>
        ) : (
          <div className="divide-y">
            {users.map((u) => (
              <div key={u.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-medium">{u.name || u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
                <div className="text-xs uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{(u.role || 'user').toString()}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
