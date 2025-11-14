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
        <Button variant="outline" onClick={loadTenants}>Refresh</Button>
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
