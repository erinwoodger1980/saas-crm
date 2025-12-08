"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Database, Users, MessageSquare, GitBranch, TrendingUp, Server, Activity, Calendar } from "lucide-react";
import Link from "next/link";

type Stats = {
  tenantCount: number;
  userCount: number;
  leadCount: number;
  opportunityCount: number;
  feedbackCount: number;
  devTaskCount: number;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  _count: {
    users: number;
    leads: number;
    opportunities: number;
    feedbacks: number;
  };
};

export default function DevDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [statsData, tenantsData] = await Promise.all([
        apiFetch<{ ok: boolean; stats: Stats }>("/dev/stats"),
        apiFetch<{ ok: boolean; tenants: Tenant[] }>("/dev/tenants")
      ]);

      if (statsData.ok) setStats(statsData.stats);
      if (tenantsData.ok) setTenants(tenantsData.tenants);
    } catch (e: any) {
      setError(e?.message || "Failed to load developer dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Developer Dashboard</h1>
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Developer Dashboard</h1>
        <div className="text-red-600 bg-red-50 p-4 rounded-lg">
          <strong>Access Denied:</strong> {error}
          <p className="mt-2 text-sm">
            This dashboard requires developer access. Contact an administrator to enable the developer role on your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Developer Dashboard</h1>
        <Button variant="outline" onClick={loadData}>Refresh</Button>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Database className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.tenantCount}</div>
                <div className="text-sm text-muted-foreground">Total Tenants</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.userCount}</div>
                <div className="text-sm text-muted-foreground">Total Users</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.leadCount}</div>
                <div className="text-sm text-muted-foreground">Total Leads</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.opportunityCount}</div>
                <div className="text-sm text-muted-foreground">Opportunities</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pink-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-pink-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.feedbackCount}</div>
                <div className="text-sm text-muted-foreground">Open Feedback</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <GitBranch className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.devTaskCount}</div>
                <div className="text-sm text-muted-foreground">Active Tasks</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <Link href="/dev/tenants">
            <Button variant="outline" className="w-full">
              <Database className="w-4 h-4 mr-2" />
              Manage Tenants
            </Button>
          </Link>
          <Link href="/dev/feedback">
            <Button variant="outline" className="w-full">
              <MessageSquare className="w-4 h-4 mr-2" />
              Review Feedback
            </Button>
          </Link>
          <Link href="/dev/tasks">
            <Button variant="outline" className="w-full">
              <GitBranch className="w-4 h-4 mr-2" />
              Dev Tasks
            </Button>
          </Link>
          <Link href="/dev/calendar">
            <Button variant="outline" className="w-full">
              <Calendar className="w-4 h-4 mr-2" />
              Dev Calendar
            </Button>
          </Link>
          <Link href="/dev/ml">
            <Button variant="outline" className="w-full">
              <Server className="w-4 h-4 mr-2" />
              ML Status
            </Button>
          </Link>
        </div>
      </Card>

      {/* Tenants List */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">All Tenants</h2>
        <div className="space-y-3">
          {tenants.length === 0 ? (
            <div className="text-sm text-muted-foreground">No tenants found.</div>
          ) : (
            tenants.map((tenant) => (
              <Link key={tenant.id} href={`/dev/tenants/${tenant.id}`}>
                <Card className="p-4 hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{tenant.name}</div>
                      <div className="text-sm text-muted-foreground">
                        /{tenant.slug} • Created {new Date(tenant.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-semibold">{tenant._count.users}</div>
                        <div className="text-xs text-muted-foreground">Users</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold">{tenant._count.leads}</div>
                        <div className="text-xs text-muted-foreground">Leads</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold">{tenant._count.opportunities}</div>
                        <div className="text-xs text-muted-foreground">Opps</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold">{tenant._count.feedbacks}</div>
                        <div className="text-xs text-muted-foreground">Feedback</div>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
