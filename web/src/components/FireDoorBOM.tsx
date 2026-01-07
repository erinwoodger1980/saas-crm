"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Package, ShoppingCart, Boxes, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface Component {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  properties: Record<string, any>;
}

interface BOMData {
  components: {
    manufactured: Component[];
    purchased: Component[];
    assembly: Component[];
  };
  totals: {
    manufactured: number;
    purchased: number;
    assembly: number;
    overall: number;
  };
}

interface FireDoorBOMProps {
  lineItemId: string;
}

export function FireDoorBOM({ lineItemId }: FireDoorBOMProps) {
  const [bom, setBom] = useState<BOMData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const loadBOM = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<BOMData>(`/fire-door-components/${lineItemId}/bom`);
      setBom(data);
    } catch (error: any) {
      // If no components exist, that's OK - user needs to generate
      if (error.message?.includes('404')) {
        setBom(null);
      } else {
        toast({
          title: "Error loading BOM",
          description: error.message || "Failed to load bill of materials",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const generateBOM = async (forceRegenerate = false) => {
    setGenerating(true);
    try {
      const response = await apiFetch<{ success: boolean; componentsGenerated: number; components: Component[] }>(
        `/fire-door-components/generate/${lineItemId}`,
        {
          method: "POST",
          json: { forceRegenerate },
        }
      );

      toast({
        title: "BOM Generated",
        description: `Successfully generated ${response.componentsGenerated} components`,
      });

      // Reload BOM
      await loadBOM();
    } catch (error: any) {
      toast({
        title: "Error generating BOM",
        description: error.message || "Failed to generate components",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    loadBOM();
  }, [lineItemId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-slate-600">Loading BOM...</span>
      </div>
    );
  }

  if (!bom || (bom.components.manufactured.length === 0 && bom.components.purchased.length === 0 && bom.components.assembly.length === 0)) {
    return (
      <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">No BOM Generated</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Generate a bill of materials to automatically create components from this line item's specifications.
          </p>
          <Button
            onClick={() => generateBOM(false)}
            disabled={generating}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate BOM
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800">Bill of Materials</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => loadBOM()}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => generateBOM(true)}
            size="sm"
            disabled={generating}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Regenerate
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Manufactured Components */}
      {bom.components.manufactured.length > 0 && (
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Manufactured Components</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Component</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Dimensions</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Material</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Unit Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {bom.components.manufactured.map((comp, idx) => (
                  <tr key={comp.id} className={`border-b border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{comp.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {comp.properties.width && comp.properties.height ? (
                        <span>{comp.properties.width} × {comp.properties.height} mm</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {comp.properties.material || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-800">{comp.quantity}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-800">
                      £{comp.unitCost?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-green-700">
                      £{comp.totalCost?.toFixed(2) || '0.00'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-semibold">
                  <td colSpan={5} className="px-4 py-3 text-sm text-right text-slate-800">Subtotal:</td>
                  <td className="px-4 py-3 text-sm text-right text-green-700">£{bom.totals.manufactured.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Purchased Components */}
      {bom.components.purchased.length > 0 && (
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Purchased Components</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Component</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Finish</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Unit Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {bom.components.purchased.map((comp, idx) => (
                  <tr key={comp.id} className={`border-b border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{comp.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {comp.properties.type || comp.properties.glassType || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {comp.properties.finish || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-800">{comp.quantity}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-800">
                      £{comp.unitCost?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-green-700">
                      £{comp.totalCost?.toFixed(2) || '0.00'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-semibold">
                  <td colSpan={5} className="px-4 py-3 text-sm text-right text-slate-800">Subtotal:</td>
                  <td className="px-4 py-3 text-sm text-right text-green-700">£{bom.totals.purchased.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Assembly Components */}
      {bom.components.assembly.length > 0 && (
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Assembly Components</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Component</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Details</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Unit Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {bom.components.assembly.map((comp, idx) => (
                  <tr key={comp.id} className={`border-b border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{comp.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {JSON.stringify(comp.properties)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-800">{comp.quantity}</td>
                    <td className="px-4 py-3 text-sm text-right text-slate-800">
                      £{comp.unitCost?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-green-700">
                      £{comp.totalCost?.toFixed(2) || '0.00'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-semibold">
                  <td colSpan={4} className="px-4 py-3 text-sm text-right text-slate-800">Subtotal:</td>
                  <td className="px-4 py-3 text-sm text-right text-green-700">£{bom.totals.assembly.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Grand Total */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl shadow-xl p-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm font-medium opacity-90">Total BOM Cost</div>
            <div className="text-xs opacity-75 mt-1">
              {bom.components.manufactured.length + bom.components.purchased.length + bom.components.assembly.length} components
            </div>
          </div>
          <div className="text-3xl font-bold">
            £{bom.totals.overall.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
