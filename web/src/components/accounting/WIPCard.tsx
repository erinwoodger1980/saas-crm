"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { TrendingUp, TrendingDown, DollarSign, Package, RefreshCw } from "lucide-react";

interface WIPData {
  opportunityId: string;
  contractValue: number;
  invoicedToDate: number;
  materialsInvoicedToDate: number;
  marginToDate: number;
  salesDocuments: number;
  purchaseDocuments: number;
}

interface WIPCardProps {
  opportunityId: string;
  percentComplete?: number; // From existing % complete logic
  contractValue?: number;
}

export function WIPCard({ opportunityId, percentComplete = 0, contractValue = 0 }: WIPCardProps) {
  const [wipData, setWipData] = useState<WIPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWIPData();
  }, [opportunityId]);

  async function loadWIPData() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<WIPData>(`/accounting/sage/wip/${opportunityId}`);
      setWipData(data);
    } catch (err: any) {
      // If Sage not connected, don't show error - just hide the card
      if (err.message?.includes("not connected")) {
        setError(null);
      } else {
        console.error("Failed to load WIP data:", err);
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return null; // Don't show loading state to avoid layout shift
  }

  if (error || !wipData) {
    return null; // Don't show if no data or error
  }

  // Calculate under/over billing
  const earnedValue = (contractValue * percentComplete) / 100;
  const underOverBilled = wipData.invoicedToDate - earnedValue;
  const isOverBilled = underOverBilled > 0;

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Work in Progress (WIP)
          <Badge variant="outline" className="ml-auto text-xs">Sage</Badge>
        </CardTitle>
        <CardDescription>Financial tracking from Sage Business Cloud</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Invoiced to Date */}
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="text-sm text-blue-700 font-medium mb-1">Invoiced to Date</div>
            <div className="text-2xl font-bold text-blue-900">
              {formatCurrency(wipData.invoicedToDate)}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              {wipData.salesDocuments} document{wipData.salesDocuments !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Materials Invoiced */}
          <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
            <div className="text-sm text-orange-700 font-medium mb-1">Materials Cost</div>
            <div className="text-2xl font-bold text-orange-900">
              {formatCurrency(wipData.materialsInvoicedToDate)}
            </div>
            <div className="text-xs text-orange-600 mt-1">
              {wipData.purchaseDocuments} document{wipData.purchaseDocuments !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Margin to Date */}
          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="text-sm text-green-700 font-medium mb-1">Margin to Date</div>
            <div className="text-2xl font-bold text-green-900">
              {formatCurrency(wipData.marginToDate)}
            </div>
            <div className="text-xs text-green-600 mt-1">
              {((wipData.marginToDate / wipData.invoicedToDate) * 100).toFixed(1)}% margin
            </div>
          </div>

          {/* Under/Over Billed */}
          <div
            className={`p-3 rounded-lg border ${
              isOverBilled
                ? "bg-emerald-50 border-emerald-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            <div
              className={`text-sm font-medium mb-1 ${
                isOverBilled ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              {isOverBilled ? "Over Billed" : "Under Billed"}
            </div>
            <div
              className={`text-2xl font-bold flex items-center gap-1 ${
                isOverBilled ? "text-emerald-900" : "text-amber-900"
              }`}
            >
              {isOverBilled ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
              {formatCurrency(Math.abs(underOverBilled))}
            </div>
            <div
              className={`text-xs mt-1 ${
                isOverBilled ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              vs {percentComplete.toFixed(0)}% complete (£{earnedValue.toFixed(0)})
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-xs text-muted-foreground">
            Contract Value: {formatCurrency(contractValue)} • {percentComplete.toFixed(0)}% Complete
          </div>
          <button
            onClick={loadWIPData}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
