"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

type UserRow = { id: string; name: string | null; email: string; workshopUsername?: string | null; role?: string; isInstaller?: boolean; isWorkshopUser?: boolean; workshopHoursPerDay?: number | null; workshopProcessCodes?: string[]; holidayAllowance?: number | null; passwordHash?: string | null; firstName?: string | null; lastName?: string | null; emailFooter?: string | null; isEarlyAdopter?: boolean };

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
  const [editingHolidayAllowance, setEditingHolidayAllowance] = useState<Record<string, string>>({});
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

  async function updateUserHolidayAllowance(userId: string, allowance: number) {
    try {
      await apiFetch(`/workshop/users/${userId}/holiday-allowance`, {
        method: "PATCH",
        json: { holidayAllowance: allowance },
      });
      await loadUsers();
      setEditingHolidayAllowance(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch (e: any) {
      setError(e?.message || "Failed to update holiday allowance");
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

  async function toggleWorkshopUser(userId: string, isWorkshopUser: boolean) {
    try {
      await apiFetch(`/workshop/users/${userId}/workshop-user`, {
        method: "PATCH",
        json: { isWorkshopUser },
      });
      await loadUsers();
    } catch (e: any) {
      setError(e?.message || "Failed to update workshop user status");
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
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Manage access, capacity, and workshop processes.</p>
        </div>
        <Button variant="outline" onClick={loadUsers}>Refresh</Button>
      </header>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Invite a user</CardTitle>
          <CardDescription>Create a new account and send an invite (or create a username-only workshop account).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.useUsername}
              onCheckedChange={(checked) =>
                setForm((f) => ({ ...f, useUsername: Boolean(checked), email: "", username: "", password: "" }))
              }
            />
            <span>Create workshop user with username (no email required)</span>
          </label>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
            {form.useUsername ? (
              <>
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Username</div>
                  <Input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="john_smith"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Password</div>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="Min 8 characters"
                  />
                </div>
              </>
            ) : (
              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-medium text-muted-foreground">Email</div>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="name@company.com"
                />
              </div>
            )}
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Role</div>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as any }))}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex md:justify-end">
              <Button
                onClick={onInvite}
                disabled={(!form.email && !form.username) || !form.role || (form.useUsername && !form.password)}
              >
                {form.useUsername ? "Create user" : "Send invite"}
              </Button>
            </div>
          </div>

          {inviteLink && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="text-xs font-medium text-muted-foreground">Invite link</div>
              <a href={inviteLink} className="break-all underline" target="_blank" rel="noreferrer">{inviteLink}</a>
            </div>
          )}
          {error && <div className="text-sm text-destructive">{error}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Current users</CardTitle>
          <CardDescription>Update capacity, permissions, and process access per user.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : users.length === 0 ? (
            <div className="text-sm text-muted-foreground">No users found.</div>
          ) : (
            <div className="space-y-4">
              {users.map((u) => (
                <section key={u.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-base font-semibold">
                          {u.name || u.workshopUsername || u.email}
                        </div>
                        <Badge variant="secondary">{(u.role || "user").toString()}</Badge>
                        {!u.passwordHash && <Badge variant="destructive">Invite not completed</Badge>}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">{u.email}</div>
                      {u.workshopUsername && (
                        <div className="mt-1 text-xs text-muted-foreground">Username: {u.workshopUsername}</div>
                      )}
                      {(u.firstName || u.lastName) && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Email signature: {u.firstName} {u.lastName}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEditingProfile((prev) => ({
                            ...prev,
                            [u.id]: {
                              firstName: u.firstName || "",
                              lastName: u.lastName || "",
                              emailFooter: u.emailFooter || "",
                            },
                          }))
                        }
                      >
                        Edit profile
                      </Button>
                      {!u.passwordHash && (
                        <Button size="sm" variant="outline" onClick={() => resendInvite(u.email)}>
                          Resend invite
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setResetPasswordUserId(u.id);
                          setNewPassword("");
                          setError(null);
                        }}
                      >
                        <KeyRound className="mr-1 h-4 w-4" />
                        Reset password
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
                        <Trash2 className="mr-1 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Access</div>
                      <label className="flex items-center gap-2 text-sm" title="Include this user on the Production board">
                        <Checkbox
                          checked={!!u.isWorkshopUser}
                          onCheckedChange={(checked) => toggleWorkshopUser(u.id, Boolean(checked))}
                        />
                        <span>Workshop user</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm" title="Early adopters can see the feedback button">
                        <Checkbox
                          checked={!!u.isEarlyAdopter}
                          onCheckedChange={(checked) => toggleEarlyAdopter(u.id, Boolean(checked))}
                        />
                        <span>Early adopter</span>
                      </label>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Capacity</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm text-muted-foreground">Workshop hrs/day</div>
                        {editingHours[u.id] !== undefined ? (
                          <>
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              max="24"
                              value={editingHours[u.id]}
                              onChange={(e) => setEditingHours((prev) => ({ ...prev, [u.id]: e.target.value }))}
                              className="h-9 w-24"
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
                              onClick={() =>
                                setEditingHours((prev) => {
                                  const next = { ...prev };
                                  delete next[u.id];
                                  return next;
                                })
                              }
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-medium">
                              {u.workshopHoursPerDay != null ? Number(u.workshopHoursPerDay) : 8}h
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setEditingHours((prev) => ({
                                  ...prev,
                                  [u.id]: String(u.workshopHoursPerDay != null ? Number(u.workshopHoursPerDay) : 8),
                                }))
                              }
                            >
                              Edit
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Holidays</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm text-muted-foreground">Allowance</div>
                        {editingHolidayAllowance[u.id] !== undefined ? (
                          <>
                            <Input
                              type="number"
                              min="0"
                              max="365"
                              value={editingHolidayAllowance[u.id]}
                              onChange={(e) =>
                                setEditingHolidayAllowance((prev) => ({ ...prev, [u.id]: e.target.value }))
                              }
                              className="h-9 w-24"
                            />
                            <Button
                              size="sm"
                              onClick={() => updateUserHolidayAllowance(u.id, Number(editingHolidayAllowance[u.id]))}
                              disabled={!editingHolidayAllowance[u.id] || isNaN(Number(editingHolidayAllowance[u.id]))}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setEditingHolidayAllowance((prev) => {
                                  const next = { ...prev };
                                  delete next[u.id];
                                  return next;
                                })
                              }
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-medium">
                              {u.holidayAllowance != null ? Number(u.holidayAllowance) : 20} days
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setEditingHolidayAllowance((prev) => ({
                                  ...prev,
                                  [u.id]: String(u.holidayAllowance != null ? Number(u.holidayAllowance) : 20),
                                }))
                              }
                            >
                              Edit
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">Allowed processes</div>
                        <div className="text-xs text-muted-foreground">Empty means allow all processes.</div>
                      </div>
                      {editingProcesses[u.id] === undefined && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditingProcesses((prev) => ({
                              ...prev,
                              [u.id]: u.workshopProcessCodes || [],
                            }))
                          }
                        >
                          Edit
                        </Button>
                      )}
                    </div>

                    {editingProcesses[u.id] !== undefined ? (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {processes.map((proc) => {
                            const isChecked = editingProcesses[u.id].includes(proc.code);
                            return (
                              <label
                                key={proc.code}
                                className={cn(
                                  "flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm",
                                  isChecked ? "bg-muted/50" : "hover:bg-muted/30"
                                )}
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    const codes = editingProcesses[u.id];
                                    setEditingProcesses((prev) => ({
                                      ...prev,
                                      [u.id]: Boolean(checked)
                                        ? Array.from(new Set([...codes, proc.code]))
                                        : codes.filter((c) => c !== proc.code),
                                    }));
                                  }}
                                />
                                <span className="min-w-0 truncate">{proc.name}</span>
                              </label>
                            );
                          })}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => updateUserProcesses(u.id, editingProcesses[u.id])}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setEditingProcesses((prev) => {
                                const next = { ...prev };
                                delete next[u.id];
                                return next;
                              })
                            }
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingProcesses((prev) => ({ ...prev, [u.id]: [] }))}
                            className="ml-auto"
                          >
                            Clear all
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(u.workshopProcessCodes?.length ?? 0) === 0 ? (
                          <Badge variant="outline">All processes allowed</Badge>
                        ) : (
                          u.workshopProcessCodes?.map((code) => {
                            const proc = processes.find((p) => p.code === code);
                            return (
                              <Badge key={code} variant="secondary">
                                {proc?.name || code}
                              </Badge>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {resetPasswordUserId === u.id && (
                    <div className="mt-3 rounded-lg border bg-muted/30 p-4">
                      <div className="text-sm font-medium">Reset password</div>
                      <div className="mt-1 text-xs text-muted-foreground">For {u.email}</div>
                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <div className="min-w-[240px] flex-1">
                          <div className="mb-1 text-xs font-medium text-muted-foreground">New password (min 8 characters)</div>
                          <Input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
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

                  {deletingUserId === u.id && (
                    <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                      <div className="text-sm font-medium text-destructive">Delete user</div>
                      <div className="mt-1 text-xs text-muted-foreground">This action cannot be undone.</div>
                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <div className="min-w-[240px] flex-1">
                          <div className="mb-1 text-xs font-medium text-muted-foreground">Type the email to confirm</div>
                          <Input
                            type="text"
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            placeholder={u.email}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteUser(u.id)}
                          disabled={deleteConfirm !== u.email}
                        >
                          Delete
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

                  {editingProfile[u.id] && (
                    <div className="mt-3 rounded-lg border bg-muted/30 p-4">
                      <div className="text-sm font-medium">Edit profile</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        These details are used to personalize AI-generated emails.
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <div className="mb-1 text-xs font-medium text-muted-foreground">First name</div>
                          <Input
                            type="text"
                            value={editingProfile[u.id].firstName}
                            onChange={(e) =>
                              setEditingProfile((prev) => ({
                                ...prev,
                                [u.id]: { ...prev[u.id], firstName: e.target.value },
                              }))
                            }
                            placeholder="John"
                          />
                        </div>
                        <div>
                          <div className="mb-1 text-xs font-medium text-muted-foreground">Last name</div>
                          <Input
                            type="text"
                            value={editingProfile[u.id].lastName}
                            onChange={(e) =>
                              setEditingProfile((prev) => ({
                                ...prev,
                                [u.id]: { ...prev[u.id], lastName: e.target.value },
                              }))
                            }
                            placeholder="Smith"
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="mb-1 text-xs font-medium text-muted-foreground">Email footer / signature</div>
                        <textarea
                          value={editingProfile[u.id].emailFooter}
                          onChange={(e) =>
                            setEditingProfile((prev) => ({
                              ...prev,
                              [u.id]: { ...prev[u.id], emailFooter: e.target.value },
                            }))
                          }
                          placeholder="Best regards,\nJohn Smith\nSales Manager"
                          className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                        />
                        <div className="mt-1 text-xs text-muted-foreground">
                          Appended to AI-generated emails sent by this user.
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => updateUserProfile(u.id, editingProfile[u.id])}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setEditingProfile((prev) => {
                              const next = { ...prev };
                              delete next[u.id];
                              return next;
                            })
                          }
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
