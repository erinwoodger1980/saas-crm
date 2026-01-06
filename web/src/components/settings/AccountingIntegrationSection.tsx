"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch, API_BASE } from "@/lib/api";
import { CheckCircle2, XCircle, RefreshCw, Link as LinkIcon } from "lucide-react";

interface SageConnectionStatus {
  connected: boolean;
  status?: string;
  businessId?: string;
  lastSyncAt?: string;
  createdAt?: string;
}

export function AccountingIntegrationSection() {
  const { toast } = useToast();
  const [sageStatus, setSageStatus] = useState<SageConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadSageStatus();
  }, []);

  async function loadSageStatus() {
    try {
      const status = await apiFetch<SageConnectionStatus>("/accounting/sage/status");
      setSageStatus(status);
    } catch (error: any) {
      console.error("Failed to load Sage status:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    window.location.href = `${API_BASE}/accounting/sage/connect`;
  }

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect Sage? This will not delete existing synced data.")) {
      return;
    }

    try {
      await apiFetch("/accounting/sage/disconnect", { method: "POST" });
      toast({
        title: "Disconnected",
        description: "Sage Business Cloud Accounting has been disconnected.",
      });
      await loadSageStatus();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect Sage",
        variant: "destructive",
      });
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await apiFetch<{
        success: boolean;
        synced: number;
        autoLinked: number;
        fromDate: string;
        toDate: string;
      }>("/accounting/sage/sync", {
        method: "POST",
        body: JSON.stringify({}),
      });

      toast({
        title: "Sync Complete",
        description: `Synced ${result.synced} documents (${result.autoLinked} auto-linked)`,
      });
      
      await loadSageStatus();
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync Sage data",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accounting Integration</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          Accounting Integration
        </CardTitle>
        <CardDescription>
          Connect to Sage Business Cloud Accounting for WIP tracking and invoice reconciliation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="4" fill="#00DC06" />
                <text x="12" y="17" fontFamily="Arial, sans-serif" fontSize="14" fontWeight="bold" fill="white" textAnchor="middle">
                  S
                </text>
              </svg>
            </div>
            <div>
              <div className="font-medium">Sage Business Cloud Accounting</div>
              <div className="text-sm text-muted-foreground">
                {sageStatus?.connected ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Connected
                    {sageStatus.lastSyncAt && (
                      <span className="ml-2">
                        • Last sync: {new Date(sageStatus.lastSyncAt).toLocaleString()}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-gray-400" />
                    Not connected
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {sageStatus?.connected ? (
              <>
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  variant="outline"
                  size="sm"
                >
                  {syncing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Now
                    </>
                  )}
                </Button>
                <Button onClick={handleDisconnect} variant="outline" size="sm">
                  Disconnect
                </Button>
              </>
            ) : (
              <Button onClick={handleConnect} size="sm">
                Connect Sage
              </Button>
            )}
          </div>
        </div>

        {sageStatus?.connected && (
          <div className="space-y-2 p-4 bg-muted rounded-lg">
            <h4 className="font-medium">What gets synced:</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Sales Invoices → InvoicedToDate</li>
              <li>• Sales Credit Notes → Reduces InvoicedToDate</li>
              <li>• Purchase Invoices → MaterialsInvoicedToDate</li>
              <li>• Purchase Credit Notes → Reduces MaterialsInvoicedToDate</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              Documents are automatically linked to projects using order references in invoice references.
            </p>
          </div>
        )}

        {sageStatus?.connected && (
          <div className="flex items-center gap-2">
            <Button
              variant="link"
              size="sm"
              onClick={() => window.location.href = "/settings/accounting/unlinked"}
            >
              View Unlinked Documents →
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
