"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, KeyRound } from "lucide-react";

type UserRow = { id: string; name: string | null; email: string; role?: string; workshopHoursPerDay?: number | null; workshopProcessCodes?: string[]; passwordHash?: string | null };

type UsersResponse = { ok: boolean; items: UserRow[] };

type InviteResponse = { ok: true; userId: string; email: string; role: string; setupToken: string; setupLink: string } | { error: string };

type ProcessDef = { code: string; name: string };

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [processes, setProcesses] = useState<ProcessDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ email: string; role: "admin" | "workshop" | "" }>({ email: "", role: "" });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [editingHours, setEditingHours] = useState<Record<string, string>>({});
  const [editingProcesses, setEditingProcesses] = useState<Record<string, string[]>>({});
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string>("");

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

  async function loadProcesses() {
    try {
      const data = await apiFetch<{ ok: boolean; processes: ProcessDef[] }>("/workshop/processes");
      if (data?.ok) setProcesses(data.processes);
    } catch (e: any) {
      console.error("Failed to load processes:", e);
    }
  }

  useEffect(() => { 
    loadUsers(); 
    loadProcesses();
  }, []);

  async function onInvite() {
    setInviteLink(null);
    setError(null);
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

  async function resendInvite(email: string) {
    setInviteLink(null);
    setError(null);
    try {
      // Find user's current role
      const user = users.find(u => u.email === email);
      if (!user) return;
      
      const resp = await apiFetch<InviteResponse>("/auth/invite", {
        method: "POST",
        json: { email, role: user.role || "admin" },
      });
      if ((resp as any)?.setupLink) {
        setInviteLink((resp as any).setupLink);
        await loadUsers();
      }
    } catch (e: any) {
      setError(e?.message || "Resend invite failed");
    }
  }

  async function updateUserHours(userId: string, hoursPerDay: number) {
    try {
      await apiFetch(`/workshop/users/${userId}/hours`, {
        method: "PATCH",
        json: { hoursPerDay },
      });
      await loadUsers();
      setEditingHours(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch (e: any) {
      setError(e?.message || "Failed to update hours");
    }
  }

  async function updateUserProcesses(userId: string, processCodes: string[]) {
    try {
      await apiFetch(`/workshop/users/${userId}/processes`, {
        method: "PATCH",
        json: { processCodes },
      });
      await loadUsers();
      setEditingProcesses(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch (e: any) {
      setError(e?.message || "Failed to update processes");
    }
  }

  async function resetUserPassword(userId: string) {
    if (!newPassword || newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    try {
      await apiFetch("/auth/admin/reset-user-password", {
        method: "POST",
        json: { userId, newPassword },
      });
      setResetPasswordUserId(null);
      setNewPassword("");
      setError(null);
      alert("Password reset successfully");
    } catch (e: any) {
      setError(e?.message || "Failed to reset password");
    }
  }

  async function deleteUser(userId: string) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    if (deleteConfirm !== user.email) {
      setError("Please type the email address to confirm deletion");
      return;
    }

    try {
      await apiFetch(`/auth/admin/delete-user/${userId}`, {
        method: "DELETE",
      });
      setDeletingUserId(null);
      setDeleteConfirm("");
      setError(null);
      await loadUsers();
      alert(`User ${user.email} deleted successfully`);
    } catch (e: any) {
      setError(e?.message || "Failed to delete user");
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
              <div key={u.id} className="py-3">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="flex-1">
                    <div className="font-medium">{u.name || u.email}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                    {!u.passwordHash && (
                      <div className="text-xs text-amber-600 mt-1">⚠️ Password not set - needs to complete setup</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {!u.passwordHash && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resendInvite(u.email)}
                      >
                        Resend Invite
                      </Button>
                    )}
                    <div className="text-xs uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{(u.role || 'user').toString()}</div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">Workshop hrs/day:</label>
                      {editingHours[u.id] !== undefined ? (
                        <>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            value={editingHours[u.id]}
                            onChange={(e) => setEditingHours(prev => ({ ...prev, [u.id]: e.target.value }))}
                            className="w-20 h-8 text-sm"
                          />
                          <Button
                            size="sm"
                            onClick={() => updateUserHours(u.id, Number(editingHours[u.id]))}
                            disabled={!editingHours[u.id] || isNaN(Number(editingHours[u.id]))}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingHours(prev => {
                              const next = { ...prev };
                              delete next[u.id];
                              return next;
                            })}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-medium w-12 text-right">
                            {u.workshopHoursPerDay != null ? Number(u.workshopHoursPerDay) : 8}h
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingHours(prev => ({
                              ...prev,
                              [u.id]: String(u.workshopHoursPerDay != null ? Number(u.workshopHoursPerDay) : 8)
                            }))}
                          >
                            Edit
                          </Button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">Processes:</label>
                      {editingProcesses[u.id] !== undefined ? (
                        <>
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {processes.map(proc => (
                              <label key={proc.code} className="flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded cursor-pointer hover:bg-slate-200">
                                <input
                                  type="checkbox"
                                  checked={editingProcesses[u.id].includes(proc.code)}
                                  onChange={(e) => {
                                    const codes = editingProcesses[u.id];
                                    setEditingProcesses(prev => ({
                                      ...prev,
                                      [u.id]: e.target.checked 
                                        ? [...codes, proc.code]
                                        : codes.filter(c => c !== proc.code)
                                    }));
                                  }}
                                />
                                {proc.name}
                              </label>
                            ))}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => updateUserProcesses(u.id, editingProcesses[u.id])}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingProcesses(prev => {
                              const next = { ...prev };
                              delete next[u.id];
                              return next;
                            })}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm text-muted-foreground">
                            {(u.workshopProcessCodes?.length ?? 0) === 0 
                              ? 'All' 
                              : u.workshopProcessCodes?.map(code => 
                                  processes.find(p => p.code === code)?.name || code
                                ).join(', ')}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingProcesses(prev => ({
                              ...prev,
                              [u.id]: u.workshopProcessCodes || []
                            }))}
                          >
                            Edit
                          </Button>
                        </>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setResetPasswordUserId(u.id);
                        setNewPassword("");
                        setError(null);
                      }}
                    >
                      <KeyRound className="w-4 h-4 mr-1" />
                      Reset Password
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setDeletingUserId(u.id);
                        setDeleteConfirm("");
                        setError(null);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
                
                {/* Reset Password Form */}
                {resetPasswordUserId === u.id && (
                  <div className="mt-2 p-3 bg-slate-50 rounded border">
                    <div className="font-medium text-sm mb-2">Reset password for {u.email}</div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">New Password (min 8 characters)</label>
                        <Input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          className="mt-1"
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => resetUserPassword(u.id)}
                        disabled={!newPassword || newPassword.length < 8}
                      >
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setResetPasswordUserId(null);
                          setNewPassword("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Delete Confirmation Form */}
                {deletingUserId === u.id && (
                  <div className="mt-2 p-3 bg-red-50 rounded border border-red-200">
                    <div className="font-medium text-sm mb-2 text-red-700">⚠️ Delete user {u.email}?</div>
                    <div className="text-xs text-red-600 mb-2">This action cannot be undone. Type the email address to confirm:</div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Input
                          type="text"
                          value={deleteConfirm}
                          onChange={(e) => setDeleteConfirm(e.target.value)}
                          placeholder={u.email}
                          className="mt-1"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteUser(u.id)}
                        disabled={deleteConfirm !== u.email}
                      >
                        Delete User
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDeletingUserId(null);
                          setDeleteConfirm("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
