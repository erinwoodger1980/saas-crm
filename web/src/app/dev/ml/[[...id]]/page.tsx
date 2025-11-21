"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Server, Activity, TrendingUp, Database, AlertCircle } from "lucide-react";
import Link from "next/link";

type MLStatus = {
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  latestInsight: any | null;
  recentEvents: any[];
  dataStats: {
    leadCount: number;
    emailCount: number;
  };
};

type MLSample = {
  id: string;
  messageId: string;
  attachmentId: string;
  url: string;
  quotedAt: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
};

export default function MLStatusPage() {
  const params = useParams();
  const tenantId = params?.id as string | undefined;

  const [statuses, setStatuses] = useState<MLStatus[]>([]);
  const [pendingSamples, setPendingSamples] = useState<MLSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadMLStatus() {
    setLoading(true);
    setError(null);
    try {
      if (tenantId) {
        // Load specific tenant
        const data = await apiFetch<any>(`/dev/ml/status/${tenantId}`);
        if (data.ok) {
          setStatuses([{
            tenant: data.tenant,
            latestInsight: data.insights?.[0] || null,
            recentEvents: data.events || [],
            dataStats: data.dataStats
          }]);
        }
      } else {
        // Load all tenants
        const data = await apiFetch<{ ok: boolean; statuses: MLStatus[] }>("/dev/ml/status");
        if (data.ok) setStatuses(data.statuses);
      }

      // Load pending samples for review
      await loadPendingSamples();
    } catch (e: any) {
      setError(e?.message || "Failed to load ML status");
    } finally {
      setLoading(false);
    }
  }

  async function loadPendingSamples() {
    try {
      const data = await apiFetch<{ ok: boolean; items: MLSample[] }>("/internal/ml/samples?limit=50");
      if (data.ok && data.items) {
        // Filter for pending samples
        const pending = data.items.filter(s => s.status === 'PENDING');
        setPendingSamples(pending);
      }
    } catch (e: any) {
      console.error("Failed to load pending samples:", e);
    }
  }

  async function triggerTraining(tenantId: string) {
    if (!confirm(`Trigger ML training for this tenant?`)) return;
    try {
      await apiFetch(`/dev/ml/train/${tenantId}`, { method: "POST" });
      alert("ML training triggered successfully!");
      loadMLStatus();
    } catch (e: any) {
      alert("Failed to trigger training: " + e.message);
    }
  }

  async function updateSampleStatus(sampleId: string, status: 'APPROVED' | 'REJECTED') {
    try {
      await apiFetch(`/internal/ml/samples/${sampleId}/status`, {
        method: "PATCH",
        json: { status }
      });
      // Reload pending samples
      await loadPendingSamples();
    } catch (e: any) {
      alert("Failed to update sample: " + e.message);
    }
  }

  useEffect(() => {
    loadMLStatus();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-muted-foreground">Loading ML training status...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-600 bg-red-50 p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Server className="w-8 h-8" />
          ML Training Status
        </h1>
        <Button variant="outline" onClick={loadMLStatus}>Refresh</Button>
      </div>

      {/* Pending Samples Section */}
      {pendingSamples.length > 0 && (
        <Card className="p-6 border-yellow-300 bg-yellow-50">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            Pending Quote Samples ({pendingSamples.length})
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Review quotes collected from emails before they're used for ML training.
            Approve quality quotes and reject any that are incomplete or incorrect.
          </p>
          
          <div className="space-y-3">
            {pendingSamples.map((sample) => (
              <Card key={sample.id} className="p-4 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                        {sample.messageId.slice(0, 12)}...
                      </span>
                      {sample.quotedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(sample.quotedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      Attachment: {sample.attachmentId}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Added: {new Date(sample.createdAt).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(sample.url, '_blank')}
                    >
                      View PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => updateSampleStatus(sample.id, 'APPROVED')}
                    >
                      ✓ Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updateSampleStatus(sample.id, 'REJECTED')}
                    >
                      ✗ Reject
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-6">
        {statuses.map((status) => (
          <Card key={status.tenant.id} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">{status.tenant.name}</h2>
                <div className="text-sm text-muted-foreground">/{status.tenant.slug}</div>
              </div>
              <div className="flex gap-2">
                <Link href={`/dev/tenants/${status.tenant.id}`}>
                  <Button variant="outline" size="sm">View Tenant</Button>
                </Link>
                <Button
                  size="sm"
                  onClick={() => triggerTraining(status.tenant.id)}
                >
                  Trigger Training
                </Button>
              </div>
            </div>

            {/* Data Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-4 h-4 text-blue-600" />
                  <div className="text-xs text-muted-foreground">Leads</div>
                </div>
                <div className="text-2xl font-bold">{status.dataStats.leadCount}</div>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-4 h-4 text-green-600" />
                  <div className="text-xs text-muted-foreground">Emails</div>
                </div>
                <div className="text-2xl font-bold">{status.dataStats.emailCount}</div>
              </Card>
            </div>

            {/* Latest Training Insight */}
            {status.latestInsight ? (
              <Card className="p-4 bg-green-50 border-green-200 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <div className="font-medium text-green-900">Latest Training</div>
                </div>
                <div className="text-sm text-green-800">
                  Trained: {new Date(status.latestInsight.trainedAt).toLocaleString()}
                </div>
                {status.latestInsight.accuracy && (
                  <div className="text-sm text-green-800">
                    Accuracy: {(status.latestInsight.accuracy * 100).toFixed(1)}%
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-4 bg-yellow-50 border-yellow-200 mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <div className="text-sm text-yellow-800">No training data available yet</div>
                </div>
              </Card>
            )}

            {/* Recent Training Events */}
            {status.recentEvents.length > 0 && (
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Recent Training Events
                </h3>
                <div className="space-y-2">
                  {status.recentEvents.map((event: any, idx: number) => (
                    <Card key={idx} className="p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {event.status === 'SUCCESS' ? '✅' : event.status === 'FAILED' ? '❌' : '⏳'} 
                            {' '}{event.status}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Started: {new Date(event.startedAt).toLocaleString()}
                          </div>
                          {event.finishedAt && (
                            <div className="text-xs text-muted-foreground">
                              Finished: {new Date(event.finishedAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                        {event.error && (
                          <div className="text-xs text-red-600 max-w-md truncate">
                            Error: {event.error}
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}

        {statuses.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            No ML training data available.
          </Card>
        )}
      </div>
    </div>
  );
}
