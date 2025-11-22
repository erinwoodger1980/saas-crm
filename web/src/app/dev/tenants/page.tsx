"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Database } from "lucide-react";

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

export default function TenantsListPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  async function loadTenants() {
    setLoading(true);
    try {
      const data = await apiFetch<{ ok: boolean; tenants: Tenant[] }>("/dev/tenants");
      if (data.ok) setTenants(data.tenants);
    } catch (e: any) {
      console.error("Failed to load tenants:", e);
    } finally {
      setLoading(false);
    }
  }

  async function deleteTestTenants() {
    const testTenants = tenants.filter(t => 
      t.slug.startsWith('test-tenant-') || 
      t.slug.startsWith('dev-tenant-') ||
      t.name.includes('Test Tenant') ||
      t.name.includes('Dev Tenant')
    );

    if (testTenants.length === 0) {
      alert('No test tenants found (looking for slugs starting with test-tenant- or dev-tenant-)');
      return;
    }

    const confirmed = confirm(
      `Delete ${testTenants.length} test tenant(s)?\n\n` +
      testTenants.map(t => `• ${t.name} (${t.slug})`).join('\n') +
      `\n\nThis will permanently delete all their data. Continue?`
    );

    if (!confirmed) return;

    setDeleting(true);
    let deleted = 0;
    const errors: string[] = [];

    for (const tenant of testTenants) {
      try {
        await apiFetch(`/dev/tenants/${tenant.id}`, { method: 'DELETE' });
        deleted++;
      } catch (e: any) {
        errors.push(`${tenant.slug}: ${e?.message || 'Failed'}`);
      }
    }

    setDeleting(false);
    
    if (errors.length > 0) {
      alert(`Deleted ${deleted}/${testTenants.length} tenants.\n\nErrors:\n${errors.join('\n')}`);
    } else {
      alert(`Successfully deleted ${deleted} test tenant(s)`);
    }

    loadTenants();
  }

  useEffect(() => {
    loadTenants();
  }, []);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Database className="w-8 h-8" />
          All Tenants
        </h1>
        <div className="flex gap-2">
          <Button 
            variant="destructive" 
            onClick={deleteTestTenants}
            disabled={deleting || loading}
          >
            {deleting ? 'Deleting...' : '🗑️ Delete Test Tenants'}
          </Button>
          <Button variant="outline" onClick={loadTenants} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading tenants...</div>
      ) : (
        <div className="space-y-3">
          {tenants.map((tenant) => (
            <Link key={tenant.id} href={`/dev/tenants/${tenant.id}`}>
              <Card className="p-4 hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-lg">{tenant.name}</div>
                    <div className="text-sm text-muted-foreground">
                      /{tenant.slug} • Created {new Date(tenant.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-lg">{tenant._count.users}</div>
                      <div className="text-xs text-muted-foreground">Users</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-lg">{tenant._count.leads}</div>
                      <div className="text-xs text-muted-foreground">Leads</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-lg">{tenant._count.opportunities}</div>
                      <div className="text-xs text-muted-foreground">Opportunities</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-lg">{tenant._count.feedbacks}</div>
                      <div className="text-xs text-muted-foreground">Feedback</div>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
