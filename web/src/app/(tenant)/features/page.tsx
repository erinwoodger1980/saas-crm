"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface FeatureRequest {
  id: string;
  title: string;
  status: string;
  category: string;
  priority: number | null;
  createdAt: string;
}

export default function TenantFeaturesPage() {
  const [tenantId, setTenantId] = useState<string>("");
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ id: string; tenantId: string }>("/auth/me")
      .then((me) => {
        if (me?.tenantId) {
          setTenantId(me.tenantId);
        }
      })
      .catch(() => setTenantId(""));
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    apiFetch<FeatureRequest[]>(`/feature-requests?tenantId=${tenantId}`)
      .then((items) => {
        setRequests(items || []);
        setError(null);
      })
      .catch((err: any) => {
        setError(err?.message || "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [tenantId]);

  const grouped = useMemo(() => {
    const groups = new Map<string, FeatureRequest[]>();
    for (const item of requests) {
      const key = item.status || "OPEN";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return groups;
  }, [requests]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Feature requests</h1>
          <p className="text-sm text-muted-foreground">
            Track requests raised for your tenant and see their status.
          </p>
        </div>
        <Link
          href="/(tenant)/features/new"
          className="inline-flex items-center rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          New request
        </Link>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && !requests.length && (
        <p className="text-sm text-muted-foreground">No requests yet. Submit one to get started.</p>
      )}
      {[...grouped.entries()].map(([status, items]) => (
        <div key={status} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">{status.replace(/_/g, " ")}</h2>
          <ul className="divide-y rounded border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Category: {item.category} · Priority: {item.priority ?? "--"}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">ID: {item.id}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
