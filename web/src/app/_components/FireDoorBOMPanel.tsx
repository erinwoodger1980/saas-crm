'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface BOMLineItem {
  id: string;
  componentName: string;
  componentCode: string;
  materialName: string;
  materialCode: string;
  quantity: number;
  quantityUnit: string;
  costPerUnit: number;
  markup: number;
  totalCost: number;
  texture?: string;
  colorHex?: string;
}

interface GeneratedBOM {
  productTypeId: string;
  lineItems: BOMLineItem[];
  totalMaterialCost: number;
  totalMarkup: number;
  totalPrice: number;
}

interface FireDoorBOMPanelProps {
  fireDoorId: string;
  fireDoorRowData?: Record<string, any>;
  onBOMGenerated?: (bom: GeneratedBOM) => void;
}

export function FireDoorBOMPanel({
  fireDoorId,
  fireDoorRowData,
  onBOMGenerated,
}: FireDoorBOMPanelProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch BOM summary
  const { data: summary, mutate: refetchSummary } = useSWR(
    fireDoorId ? `/fire-door-bom/${fireDoorId}/summary` : null,
    (url) =>
      fetch(url).then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      }),
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  );

  // Fetch full BOM
  const { data: fullBOM } = useSWR(
    showDetails && fireDoorId ? `/fire-door-bom/${fireDoorId}` : null,
    (url) =>
      fetch(url).then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
  );

  // Generate BOM
  const handleGenerateBOM = useCallback(async () => {
    if (!fireDoorId || !fireDoorRowData) return;

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/fire-door-bom/generate/${fireDoorId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldValues: fireDoorRowData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate BOM');
      }

      const result = await response.json();
      refetchSummary();
      onBOMGenerated?.(result.bomData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  }, [fireDoorId, fireDoorRowData, refetchSummary, onBOMGenerated]);

  // Auto-generate when row data changes (optional, can be controlled)
  useEffect(() => {
    // You can enable auto-generation here if desired
    // if (fireDoorRowData?.isComplete) handleGenerateBOM();
  }, [fireDoorRowData]);

  if (!summary) {
    return (
      <Card className="p-4 bg-gray-50">
        <Button onClick={handleGenerateBOM} disabled={generating || !fireDoorRowData} size="sm">
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate BOM'
          )}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {/* Summary Card */}
      <Card className="p-3 bg-blue-50 border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900">BOM Generated</p>
            <div className="grid grid-cols-3 gap-3 mt-2 text-xs">
              <div>
                <p className="text-blue-600 font-medium">{summary.itemCount}</p>
                <p className="text-blue-700">Items</p>
              </div>
              <div>
                <p className="text-blue-600 font-medium">£{summary.totalCost?.toFixed(2)}</p>
                <p className="text-blue-700">Total Cost</p>
              </div>
              <div>
                <p className="text-blue-600 font-medium">{summary.topComponents?.length || 0}</p>
                <p className="text-blue-700">Main Components</p>
              </div>
            </div>

            {/* Top components summary */}
            {summary.topComponents && summary.topComponents.length > 0 && (
              <div className="mt-2 pt-2 border-t border-blue-200 text-xs space-y-1">
                {summary.topComponents.map((comp: any, idx: number) => (
                  <p key={idx} className="text-blue-700">
                    {comp.code}: £{comp.cost?.toFixed(2)}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 ml-3">
            <Button
              onClick={() => setShowDetails(!showDetails)}
              variant="outline"
              size="sm"
              className="h-8 px-2"
            >
              {showDetails ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <Button
              onClick={handleGenerateBOM}
              disabled={generating}
              variant="outline"
              size="sm"
              className="h-8 px-2"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>BOM Details</DialogTitle>
          </DialogHeader>

          {fullBOM?.bomData?.lineItems ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-3 p-3 bg-gray-100 rounded">
                <div>
                  <p className="text-xs text-gray-600">Items</p>
                  <p className="text-lg font-bold">{fullBOM.bomData.lineItems.length}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Material Cost</p>
                  <p className="text-lg font-bold">
                    £{fullBOM.bomData.totalMaterialCost?.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Markup</p>
                  <p className="text-lg font-bold">
                    £{fullBOM.bomData.totalMarkup?.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total</p>
                  <p className="text-lg font-bold text-blue-600">
                    £{fullBOM.bomData.totalPrice?.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Line items table */}
              <div className="border rounded overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-100">
                      <TableHead className="text-xs">Component</TableHead>
                      <TableHead className="text-xs">Material</TableHead>
                      <TableHead className="text-xs text-right">Qty</TableHead>
                      <TableHead className="text-xs text-right">Unit Cost</TableHead>
                      <TableHead className="text-xs text-right">Markup</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fullBOM.bomData.lineItems.map((item: BOMLineItem) => (
                      <TableRow key={item.id} className="hover:bg-gray-50">
                        <TableCell className="text-xs font-medium">
                          <div>{item.componentName}</div>
                          <div className="text-gray-500">{item.componentCode}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>{item.materialName}</div>
                          <div className="text-gray-500">{item.materialCode}</div>
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {item.quantity} {item.quantityUnit}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          £{item.costPerUnit?.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          £{item.markup?.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs text-right font-semibold">
                          £{item.totalCost?.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-4 bg-yellow-50 rounded border border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <p className="text-sm text-yellow-700">No BOM data available</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
