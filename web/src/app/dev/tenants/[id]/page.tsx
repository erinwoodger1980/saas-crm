"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Mail, FileText, BarChart3, MessageSquare } from "lucide-react";
import Link from "next/link";

type TenantDetails = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  subscriptionStatus: string | null;
  plan: string | null;
  users: Array<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: string;
    signupCompleted: boolean;
  }>;
  _count: {
    leads: number;
    opportunities: number;
    quotes: number;
    feedbacks: number;
    tasks: number;
    emailMessages: number;
  };
};

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.id as string;

  const [tenant, setTenant] = useState<TenantDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function markUserComplete(userId: string) {
    try {
      const data = await apiFetch<{ ok: boolean }>(
        `/dev/users/${userId}/complete`,
        { method: "POST" }
      );
      
      if (data.ok) {
        // Reload tenant data to reflect the change
        loadTenant();
      }
    } catch (e: any) {
      alert("Failed to mark user complete: " + (e?.message || "Unknown error"));
    }
  }

  async function deleteTenant() {
    if (!tenantId || !tenant) return;
    
    const confirmed = confirm(
      `⚠️ DELETE TENANT: ${tenant.name}?\n\n` +
      `This will permanently delete:\n` +
      `• ${tenant.users.length} users\n` +
      `• ${tenant._count.leads} leads\n` +
      `• ${tenant._count.opportunities} opportunities\n` +
      `• ${tenant._count.quotes} quotes\n` +
      `• ${tenant._count.feedbacks} feedback items\n` +
      `• ${tenant._count.tasks} tasks\n` +
      `• ${tenant._count.emailMessages} emails\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Type the tenant slug "${tenant.slug}" to confirm:`
    );
    
    if (!confirmed) return;
    
    const slugConfirm = prompt(`Type "${tenant.slug}" to confirm deletion:`);
    if (slugConfirm !== tenant.slug) {
      alert("Slug does not match. Deletion cancelled.");
      return;
    }
    
    setDeleting(true);
    try {
      const data = await apiFetch<{ ok: boolean; message: string }>(
        `/dev/tenants/${tenantId}`,
        { method: "DELETE" }
      );
      
      if (data.ok) {
        alert("Tenant deleted successfully");
        router.push("/dev/tenants");
      }
    } catch (e: any) {
      alert("Failed to delete tenant: " + (e?.message || "Unknown error"));
    } finally {
      setDeleting(false);
    }
  }

  async function impersonate() {
    if (!tenantId) return;
    
    const confirmed = confirm(
      `Login as ${tenant?.name}?\n\nYou will be logged in as the tenant owner. This session will last 8 hours.`
    );
    
    if (!confirmed) return;
    
    setImpersonating(true);
    try {
      const data = await apiFetch<{ 
        ok: boolean; 
        token: string;
        user: any;
        tenant: any;
      }>(`/dev/tenants/${tenantId}/impersonate`, { method: "POST" });
      
      if (data.ok && data.token) {
        // Clear ALL auth-related storage
        localStorage.removeItem("jwt");
        localStorage.removeItem("jauth");
        
        // Clear existing cookies by setting them to expire immediately
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        const domain = window.location.hostname.includes('joineryai.app') ? '; domain=.joineryai.app' : '';
        
        // Delete old cookies
        document.cookie = `jauth=; path=/; max-age=0; SameSite=Lax${secure}${domain}`;
        document.cookie = `jid=; path=/; max-age=0; SameSite=Lax${secure}${domain}`;
        document.cookie = `jwt=; path=/; max-age=0; SameSite=Lax${secure}${domain}`;
        
        // Wait a moment for cookies to clear
        setTimeout(() => {
          // Set the NEW impersonation token
          const maxAge = 8 * 60 * 60; // 8 hours in seconds
          document.cookie = `jauth=${data.token}; path=/; max-age=${maxAge}; SameSite=Lax${secure}${domain}`;
          
          // Force full page reload to clear all state and use new session
          window.location.href = "/dashboard";
        }, 100);
      }
    } catch (e: any) {
      alert("Failed to impersonate: " + (e?.message || "Unknown error"));
    } finally {
      setImpersonating(false);
    }
  }

  async function loadTenant() {
    if (!tenantId) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ ok: boolean; tenant: TenantDetails }>(`/dev/tenants/${tenantId}`);
      if (data.ok) {
        setTenant(data.tenant);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load tenant");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTenant();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-muted-foreground">Loading tenant details...</div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="p-8">
        <div className="text-red-600 bg-red-50 p-4 rounded-lg">
          {error || "Tenant not found"}
        </div>
        <Button variant="outline" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{tenant.name}</h1>
            <div className="text-sm text-muted-foreground">
              /{tenant.slug} • Created {new Date(tenant.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={impersonate} 
            disabled={impersonating || deleting}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {impersonating ? "Logging in..." : "🔐 Login as Tenant"}
          </Button>
          <Button 
            onClick={deleteTenant}
            disabled={deleting || impersonating}
            variant="destructive"
          >
            {deleting ? "Deleting..." : "🗑️ Delete Tenant"}
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-600" />
            <div className="text-xs text-muted-foreground">Users</div>
          </div>
          <div className="text-2xl font-bold">{tenant.users.length}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-green-600" />
            <div className="text-xs text-muted-foreground">Leads</div>
          </div>
          <div className="text-2xl font-bold">{tenant._count.leads}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-purple-600" />
            <div className="text-xs text-muted-foreground">Opportunities</div>
          </div>
          <div className="text-2xl font-bold">{tenant._count.opportunities}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-orange-600" />
            <div className="text-xs text-muted-foreground">Quotes</div>
          </div>
          <div className="text-2xl font-bold">{tenant._count.quotes}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-pink-600" />
            <div className="text-xs text-muted-foreground">Feedback</div>
          </div>
          <div className="text-2xl font-bold">{tenant._count.feedbacks}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-4 h-4 text-indigo-600" />
            <div className="text-xs text-muted-foreground">Emails</div>
          </div>
          <div className="text-2xl font-bold">{tenant._count.emailMessages}</div>
        </Card>
      </div>

      {/* Subscription Info */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Subscription</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Status</div>
            <div className="font-medium">
              {tenant.subscriptionStatus || "No subscription"}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Plan</div>
            <div className="font-medium">{tenant.plan || "N/A"}</div>
          </div>
        </div>
      </Card>

      {/* Users List */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Users ({tenant.users.length})</h2>
        <div className="space-y-3">
          {tenant.users.length === 0 ? (
            <div className="text-sm text-muted-foreground">No users found.</div>
          ) : (
            tenant.users.map((user) => (
              <Card key={user.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{user.name || user.email}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                    {!user.signupCompleted && (
                      <div className="text-xs text-amber-600 mt-1">
                        ⚠️ Setup incomplete
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {!user.signupCompleted && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markUserComplete(user.id)}
                        className="text-xs"
                      >
                        ✓ Mark Complete
                      </Button>
                    )}
                    <div className="text-xs uppercase bg-slate-100 text-slate-700 px-2 py-1 rounded">
                      {user.role}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex gap-3">
          <Link href={`/dev/ml/${tenant.id}`}>
            <Button variant="outline">View ML Training Status</Button>
          </Link>
          <Link href={`/dev/feedback?tenantId=${tenant.id}`}>
            <Button variant="outline">View Feedback</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
