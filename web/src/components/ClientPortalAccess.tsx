"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Key, UserPlus, Eye, EyeOff, Trash2, RefreshCw, ExternalLink } from "lucide-react";

interface PortalUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface PortalAccessData {
  hasAccess: boolean;
  clientAccount: {
    id: string;
    users: PortalUser[];
  } | null;
}

interface ClientPortalAccessProps {
  clientId: string;
  authHeaders: Record<string, string>;
}

export function ClientPortalAccess({ clientId, authHeaders }: ClientPortalAccessProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [portalData, setPortalData] = useState<PortalAccessData | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
  });

  useEffect(() => {
    loadPortalAccess();
  }, [clientId]);

  async function loadPortalAccess() {
    try {
      setLoading(true);
      const response = await fetch(`/api/clients/${clientId}/portal-access`, {
        headers: authHeaders,
      });

      if (response.ok) {
        const data = await response.json();
        setPortalData(data);
      } else {
        console.error("Failed to load portal access");
      }
    } catch (error) {
      console.error("Error loading portal access:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAccess() {
    if (!createForm.email || !createForm.password) {
      toast({
        title: "Validation error",
        description: "Email and password are required",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/portal-access`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create portal access");
      }

      toast({
        title: "Success",
        description: "Portal access created successfully",
      });

      setShowCreateDialog(false);
      setCreateForm({ email: "", password: "", firstName: "", lastName: "" });
      await loadPortalAccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create portal access",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleResetPassword() {
    if (!selectedUserId || !passwordForm.newPassword) {
      toast({
        title: "Validation error",
        description: "New password is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/clients/${clientId}/portal-access/${selectedUserId}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: passwordForm.newPassword }),
      });

      if (!response.ok) {
        throw new Error("Failed to reset password");
      }

      toast({
        title: "Success",
        description: "Password reset successfully",
      });

      setShowPasswordDialog(false);
      setPasswordForm({ newPassword: "" });
      setSelectedUserId(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset password",
        variant: "destructive",
      });
    }
  }

  async function handleToggleActive(userId: string, currentlyActive: boolean) {
    try {
      const response = await fetch(`/api/clients/${clientId}/portal-access/${userId}`, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !currentlyActive }),
      });

      if (!response.ok) {
        throw new Error("Failed to update user status");
      }

      toast({
        title: "Success",
        description: currentlyActive ? "User deactivated" : "User activated",
      });

      await loadPortalAccess();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("Are you sure you want to delete this portal user? This cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/clients/${clientId}/portal-access/${userId}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error("Failed to delete user");
      }

      toast({
        title: "Success",
        description: "Portal user deleted successfully",
      });

      await loadPortalAccess();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete portal user",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-slate-200 rounded w-1/4" />
        <div className="h-24 bg-slate-200 rounded" />
      </div>
    );
  }

  const portalUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/customer-portal/login`
    : "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Customer Portal Access</h3>
        </div>
        {portalData?.hasAccess && (
          <Button
            onClick={() => setShowCreateDialog(true)}
            size="sm"
            variant="outline"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        )}
      </div>

      {!portalData?.hasAccess ? (
        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="text-slate-600">
              This client does not have portal access yet.
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Create Portal Access
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Portal URL */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-900 mb-1">Portal Login URL</div>
                <code className="text-xs text-blue-700">{portalUrl}</code>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(portalUrl);
                  toast({ title: "Copied to clipboard" });
                }}
              >
                Copy
              </Button>
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="outline">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </Card>

          {/* Portal Users */}
          <div className="space-y-2">
            {portalData.clientAccount?.users.map((user) => (
              <Card key={user.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{user.email}</span>
                      {!user.isActive && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    {(user.firstName || user.lastName) && (
                      <div className="text-sm text-slate-600">
                        {[user.firstName, user.lastName].filter(Boolean).join(" ")}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 mt-1">
                      {user.lastLoginAt
                        ? `Last login: ${new Date(user.lastLoginAt).toLocaleDateString()}`
                        : "Never logged in"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setShowPasswordDialog(true);
                      }}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Reset Password
                    </Button>
                    <Button
                      size="sm"
                      variant={user.isActive ? "outline" : "default"}
                      onClick={() => handleToggleActive(user.id, user.isActive)}
                    >
                      {user.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Create Portal Access Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Portal Access</DialogTitle>
            <DialogDescription>
              Create login credentials for this client to access the customer portal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email *
              </label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm({ ...createForm, email: e.target.value })
                }
                placeholder="client@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password *
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, password: e.target.value })
                  }
                  placeholder="••••••••"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  First Name
                </label>
                <Input
                  value={createForm.firstName}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, firstName: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Last Name
                </label>
                <Input
                  value={createForm.lastName}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, lastName: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  setCreateForm({ email: "", password: "", firstName: "", lastName: "" });
                }}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateAccess} disabled={creating}>
                {creating ? "Creating..." : "Create Access"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter a new password for this portal user
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                New Password
              </label>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({ newPassword: e.target.value })
                }
                placeholder="••••••••"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordDialog(false);
                  setPasswordForm({ newPassword: "" });
                  setSelectedUserId(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleResetPassword}>
                Reset Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
