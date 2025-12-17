"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, KeyRound } from "lucide-react";

type UserRow = { id: string; name: string | null; email: string; workshopUsername?: string | null; role?: string; workshopHoursPerDay?: number | null; workshopProcessCodes?: string[]; passwordHash?: string | null; firstName?: string | null; lastName?: string | null; emailFooter?: string | null; isEarlyAdopter?: boolean };

type UsersResponse = { ok: boolean; items: UserRow[] };

type InviteResponse = { ok: true; userId: string; email: string; workshopUsername?: string; role: string; setupToken: string; setupLink: string; passwordSet?: boolean } | { error: string };

type ProcessDef = { code: string; name: string };

export default function UsersSettingsPage() {
  const { user: currentUser, mutate: mutateCurrentUser } = useCurrentUser();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [processes, setProcesses] = useState<ProcessDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ email: string; username: string; password: string; role: "admin" | "workshop" | ""; useUsername: boolean }>({ email: "", username: "", password: "", role: "", useUsername: false });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [editingHours, setEditingHours] = useState<Record<string, string>>({});
  const [editingProcesses, setEditingProcesses] = useState<Record<string, string[]>>({});
  const [editingProfile, setEditingProfile] = useState<Record<string, { firstName: string; lastName: string; emailFooter: string }>>({});
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
      const data = await apiFetch<ProcessDef[]>("/workshop-processes");
      if (Array.isArray(data)) {
        setProcesses(data);
      }
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
    
    // Validate: need either email or username, and role
    if ((!form.email && !form.username) || !form.role) {
      setError("Please provide email or username, and select a role");
      return;
    }
    
    // If using username, password is required
    if (form.useUsername && form.username && !form.password) {
      setError("Password is required for username-based accounts");
      return;
    }
    
    try {
      const payload: any = { role: form.role };
      
      if (form.useUsername && form.username) {
        payload.username = form.username;
        payload.password = form.password;
      } else if (form.email) {
        payload.email = form.email;
      }
      
      const resp = await apiFetch<InviteResponse>("/auth/invite", {
        method: "POST",
        json: payload,
      });
      
      if ((resp as any)?.ok) {
        const response = resp as any;
        if (response.passwordSet) {
          setInviteLink(null);
          setError(null);
          alert(`User created successfully! They can now log in with username: ${response.workshopUsername || form.username}`);
        } else {
          setInviteLink(response.setupLink);
        }
        await loadUsers();
        setForm({ email: "", username: "", password: "", role: "", useUsername: false });
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

  async function updateUserProfile(userId: string, profile: { firstName: string; lastName: string; emailFooter: string }) {
    try {
      await apiFetch(`/workshop/users/${userId}/profile`, {
        method: "PATCH",
        json: {
          firstName: profile.firstName || null,
          lastName: profile.lastName || null,
          emailFooter: profile.emailFooter || null,
        },
      });
      await loadUsers();
      
      // If the current user edited their own profile, refresh the AppShell
      if (currentUser?.id === userId) {
        await mutateCurrentUser();
      }
      
      setEditingProfile(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch (e: any) {
      setError(e?.message || "Failed to update profile");
    }
  }

  async function toggleEarlyAdopter(userId: string, isEarlyAdopter: boolean) {
    try {
      await apiFetch(`/workshop/users/${userId}/early-adopter`, {
        method: "PATCH",
        json: { isEarlyAdopter },
      });
      await loadUsers();
      
      // If the current user toggled their own status, refresh the AppShell
      if (currentUser?.id === userId) {
        await mutateCurrentUser();
      }
    } catch (e: any) {
      setError(e?.message || "Failed to update early adopter status");
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
        
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.useUsername}
              onChange={(e) => setForm(f => ({ ...f, useUsername: e.target.checked, email: "", username: "", password: "" }))}
              className="h-4 w-4"
            />
            <span>Create workshop user with username (no email required)</span>
          </label>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          {form.useUsername ? (
            <>
              <div>
                <label className="text-xs text-muted-foreground">Username</label>
                <Input 
                  type="text" 
                  value={form.username} 
                  onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))} 
                  placeholder="john_smith" 
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Password</label>
                <Input 
                  type="password" 
                  value={form.password} 
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} 
                  placeholder="Min 8 characters" 
                />
              </div>
            </>
          ) : (
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Email</label>
              <Input 
                type="email" 
                value={form.email} 
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} 
                placeholder="name@company.com" 
              />
            </div>
          )}
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
            <Button 
              onClick={onInvite} 
              disabled={(!form.email && !form.username) || !form.role || (form.useUsername && !form.password)}
            >
              {form.useUsername ? "Create User" : "Send Invite"}
            </Button>
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
                    <div className="font-medium">{u.name || u.workshopUsername || u.email}</div>
                    {u.workshopUsername && (
                      <div className="text-xs text-muted-foreground">Username: {u.workshopUsername}</div>
                    )}
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                    {(u.firstName || u.lastName) && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Email signature: {u.firstName} {u.lastName}
                      </div>
                    )}
                    {!u.passwordHash && (
                      <div className="text-xs text-amber-600 mt-1">⚠️ Password not set - needs to complete setup</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingProfile(prev => ({
                        ...prev,
                        [u.id]: {
                          firstName: u.firstName || '',
                          lastName: u.lastName || '',
                          emailFooter: u.emailFooter || ''
                        }
                      }))}
                    >
                      Edit Profile
                    </Button>
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
                    <label className="flex items-center gap-2 text-xs cursor-pointer" title="Early adopters can see the feedback button">
                      <input
                        type="checkbox"
                        checked={!!u.isEarlyAdopter}
                        onChange={(e) => toggleEarlyAdopter(u.id, e.target.checked)}
                        className="h-4 w-4"
                      />
                      <span className="text-muted-foreground">Early Adopter</span>
                    </label>
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
                    <div className="flex items-start gap-2">
                      <label className="text-xs text-muted-foreground whitespace-nowrap mt-2">Processes:</label>
                      {editingProcesses[u.id] !== undefined ? (
                        <div className="flex-1">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                            {processes.map(proc => (
                              <label key={proc.code} className="flex items-center gap-2 text-sm bg-slate-50 px-3 py-2 rounded border cursor-pointer hover:bg-slate-100 hover:border-slate-400 transition-colors">
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
                                  className="rounded"
                                />
                                <span className="font-medium">{proc.name}</span>
                              </label>
                            ))}
                          </div>
                          <div className="flex gap-2">
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
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm text-muted-foreground mt-1">
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

                {/* Profile Editing Form */}
                {editingProfile[u.id] && (
                  <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                    <div className="font-medium text-sm mb-3">Edit Profile for {u.email}</div>
                    <div className="text-xs text-muted-foreground mb-3">
                      These details will be used to personalize AI-generated emails
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-muted-foreground">First Name</label>
                        <Input
                          type="text"
                          value={editingProfile[u.id].firstName}
                          onChange={(e) => setEditingProfile(prev => ({
                            ...prev,
                            [u.id]: { ...prev[u.id], firstName: e.target.value }
                          }))}
                          placeholder="John"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Last Name</label>
                        <Input
                          type="text"
                          value={editingProfile[u.id].lastName}
                          onChange={(e) => setEditingProfile(prev => ({
                            ...prev,
                            [u.id]: { ...prev[u.id], lastName: e.target.value }
                          }))}
                          placeholder="Smith"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="text-xs text-muted-foreground">Email Footer / Signature</label>
                      <textarea
                        value={editingProfile[u.id].emailFooter}
                        onChange={(e) => setEditingProfile(prev => ({
                          ...prev,
                          [u.id]: { ...prev[u.id], emailFooter: e.target.value }
                        }))}
                        placeholder="Best regards,&#10;John Smith&#10;Sales Manager&#10;Phone: (555) 123-4567"
                        className="mt-1 w-full min-h-[100px] px-3 py-2 text-sm border rounded-md"
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        This will be appended to all AI-generated emails sent by this user
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => updateUserProfile(u.id, editingProfile[u.id])}
                      >
                        Save Profile
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingProfile(prev => {
                          const next = { ...prev };
                          delete next[u.id];
                          return next;
                        })}
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
