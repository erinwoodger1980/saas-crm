"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Save, ArrowLeft, FileText, Download, Send, 
  Plus, Trash2, Copy, Upload
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface FireDoorLineItem {
  id?: string;
  rowIndex: number;
  // Core
  itemType?: string;
  code?: string;
  quantity?: number;
  // Door identification
  doorRef?: string;
  location?: string;
  doorSetType?: string;
  fireRating?: string;
  acousticRatingDb?: number;
  handing?: string;
  // Colors
  internalColour?: string;
  externalColour?: string;
  frameFinish?: string;
  // Geometry
  leafHeight?: number;
  masterLeafWidth?: number;
  slaveLeafWidth?: number;
  leafThickness?: number;
  leafConfiguration?: string;
  // Finishes
  doorFinishSide1?: string;
  doorFinishSide2?: string;
  doorFacing?: string;
  lippingFinish?: string;
  // Vision panels
  visionQtyLeaf1?: number;
  vp1WidthLeaf1?: number;
  vp1HeightLeaf1?: number;
  // Ironmongery
  ironmongeryPackRef?: string;
  closerOrFloorSpring?: string;
  // Pricing
  unitValue?: number;
  lineTotal?: number;
  [key: string]: any;
}

interface FireDoorQuote {
  id?: string;
  tenantId?: string;
  leadId?: string;
  title: string;
  clientName?: string;
  projectReference?: string;
  siteAddress?: string;
  deliveryAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  poNumber?: string;
  dateRequired?: string;
  status?: string;
  totalValue?: number;
  lineItems: FireDoorLineItem[];
  notes?: string;
}

export default function FireDoorQuoteBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [quote, setQuote] = useState<FireDoorQuote>({
    title: "New Fire Door Quote",
    clientName: "",
    projectReference: "",
    siteAddress: "",
    deliveryAddress: "",
    contactEmail: "",
    contactPhone: "",
    poNumber: "",
    dateRequired: "",
    status: "DRAFT",
    totalValue: 0,
    lineItems: [],
    notes: "",
  });

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (params?.id && params.id !== "new") {
      loadQuote(params.id as string);
    } else {
      // Start with one blank line
      addLineItem();
    }
  }, [params?.id]);

  async function loadQuote(id: string) {
    setLoading(true);
    try {
      const data = await apiFetch<FireDoorQuote>(`/fire-door-quotes/${id}`);
      setQuote(data);
    } catch (error) {
      console.error("Error loading quote:", error);
      toast({
        title: "Error",
        description: "Failed to load quote",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveQuote() {
    setSaving(true);
    try {
      const endpoint = quote.id ? `/fire-door-quotes/${quote.id}` : "/fire-door-quotes";
      const method = quote.id ? "PUT" : "POST";
      
      const savedQuote = await apiFetch<FireDoorQuote>(endpoint, {
        method,
        body: JSON.stringify(quote),
      });

      setQuote(savedQuote);
      
      toast({
        title: "Success",
        description: "Quote saved successfully",
      });

      if (!quote.id) {
        router.push(`/fire-door-quotes/${savedQuote.id}`);
      }
    } catch (error) {
      console.error("Error saving quote:", error);
      toast({
        title: "Error",
        description: "Failed to save quote",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function addLineItem() {
    const newItem: FireDoorLineItem = {
      rowIndex: quote.lineItems.length,
      itemType: "Product",
      quantity: 1,
      doorRef: `DOOR-${quote.lineItems.length + 1}`,
      fireRating: "FD30",
      leafHeight: 2040,
      masterLeafWidth: 826,
      leafThickness: 44,
    };
    
    setQuote({
      ...quote,
      lineItems: [...quote.lineItems, newItem],
    });
  }

  function removeLineItem(index: number) {
    const updated = [...quote.lineItems];
    updated.splice(index, 1);
    // Re-index remaining items
    updated.forEach((item, idx) => {
      item.rowIndex = idx;
    });
    setQuote({ ...quote, lineItems: updated });
  }

  function duplicateLineItem(index: number) {
    const original = quote.lineItems[index];
    const duplicate: FireDoorLineItem = {
      ...original,
      id: undefined, // New item, no ID
      rowIndex: quote.lineItems.length,
      doorRef: `${original.doorRef}-COPY`,
    };
    
    setQuote({
      ...quote,
      lineItems: [...quote.lineItems, duplicate],
    });
  }

  function updateLineItem(index: number, field: string, value: any) {
    const updated = [...quote.lineItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate lineTotal if quantity or unitValue changes
    if (field === "quantity" || field === "unitValue") {
      const qty = field === "quantity" ? value : updated[index].quantity || 0;
      const unit = field === "unitValue" ? value : updated[index].unitValue || 0;
      updated[index].lineTotal = qty * unit;
    }
    
    setQuote({ ...quote, lineItems: updated });
    calculateTotal(updated);
  }

  function calculateTotal(items: FireDoorLineItem[]) {
    const total = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
    setQuote(prev => ({ ...prev, totalValue: total }));
  }

  function toggleRowExpanded(index: number) {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="backdrop-blur-sm bg-white/50"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Fire Door Quote Builder
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Spreadsheet-style editor • {quote.lineItems.length} doors
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" className="backdrop-blur-sm bg-white/50">
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
              <Button variant="outline" className="backdrop-blur-sm bg-white/50">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button
                onClick={saveQuote}
                disabled={saving}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save Quote"}
              </Button>
              <Button variant="outline" className="bg-green-600 text-white hover:bg-green-700">
                <Send className="w-4 h-4 mr-2" />
                Send to Client
              </Button>
            </div>
          </div>
        </div>

        {/* Client Details */}
        <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-lg p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Client & Project Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Quote Title</label>
              <Input
                value={quote.title}
                onChange={(e) => setQuote({ ...quote, title: e.target.value })}
                placeholder="e.g., Hospital Fire Doors Q4"
                className="bg-white/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Client Name</label>
              <Input
                value={quote.clientName}
                onChange={(e) => setQuote({ ...quote, clientName: e.target.value })}
                placeholder="Company or contact name"
                className="bg-white/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Project Reference</label>
              <Input
                value={quote.projectReference}
                onChange={(e) => setQuote({ ...quote, projectReference: e.target.value })}
                placeholder="PO or project code"
                className="bg-white/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Date Required</label>
              <Input
                type="date"
                value={quote.dateRequired}
                onChange={(e) => setQuote({ ...quote, dateRequired: e.target.value })}
                className="bg-white/50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700 mb-1 block">Site Address</label>
              <Input
                value={quote.siteAddress}
                onChange={(e) => setQuote({ ...quote, siteAddress: e.target.value })}
                placeholder="Installation site address"
                className="bg-white/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Contact Email</label>
              <Input
                type="email"
                value={quote.contactEmail}
                onChange={(e) => setQuote({ ...quote, contactEmail: e.target.value })}
                placeholder="client@example.com"
                className="bg-white/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Contact Phone</label>
              <Input
                type="tel"
                value={quote.contactPhone}
                onChange={(e) => setQuote({ ...quote, contactPhone: e.target.value })}
                placeholder="+44 7700 900000"
                className="bg-white/50"
              />
            </div>
          </div>
        </div>

        {/* Spreadsheet Table */}
        <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-lg overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
            <h2 className="text-lg font-semibold text-slate-900">Door Specifications</h2>
            <Button
              onClick={addLineItem}
              size="sm"
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Door
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600 sticky top-0">
                <tr>
                  <th className="px-2 py-3 text-left w-10">#</th>
                  <th className="px-2 py-3 text-left min-w-[120px]">Door Ref</th>
                  <th className="px-2 py-3 text-left min-w-[120px]">Location</th>
                  <th className="px-2 py-3 text-left w-16">Qty</th>
                  <th className="px-2 py-3 text-left min-w-[100px]">Fire Rating</th>
                  <th className="px-2 py-3 text-left min-w-[100px]">Door Set Type</th>
                  <th className="px-2 py-3 text-left min-w-[100px]">Handing</th>
                  <th className="px-2 py-3 text-left w-24">Height (mm)</th>
                  <th className="px-2 py-3 text-left w-24">Width (mm)</th>
                  <th className="px-2 py-3 text-left w-24">Thickness</th>
                  <th className="px-2 py-3 text-left min-w-[120px]">Internal Colour</th>
                  <th className="px-2 py-3 text-left min-w-[120px]">External Colour</th>
                  <th className="px-2 py-3 text-left min-w-[140px]">Ironmongery Pack</th>
                  <th className="px-2 py-3 text-left w-28">Unit Price (£)</th>
                  <th className="px-2 py-3 text-left w-28">Line Total (£)</th>
                  <th className="px-2 py-3 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quote.lineItems.map((item, index) => (
                  <tr
                    key={index}
                    className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="px-2 py-2 text-slate-600 font-medium">{index + 1}</td>
                    <td className="px-2 py-2">
                      <Input
                        value={item.doorRef || ""}
                        onChange={(e) => updateLineItem(index, "doorRef", e.target.value)}
                        className="h-8 text-xs bg-white"
                        placeholder="DOOR-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={item.location || ""}
                        onChange={(e) => updateLineItem(index, "location", e.target.value)}
                        className="h-8 text-xs bg-white"
                        placeholder="Ground floor"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        value={item.quantity || ""}
                        onChange={(e) => updateLineItem(index, "quantity", parseInt(e.target.value) || 0)}
                        className="h-8 text-xs bg-white"
                        min="1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Select
                        value={item.fireRating || ""}
                        onValueChange={(val) => updateLineItem(index, "fireRating", val)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FD30">FD30</SelectItem>
                          <SelectItem value="FD60">FD60</SelectItem>
                          <SelectItem value="FD90">FD90</SelectItem>
                          <SelectItem value="FD120">FD120</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <Select
                        value={item.doorSetType || ""}
                        onValueChange={(val) => updateLineItem(index, "doorSetType", val)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SINGLE">Single</SelectItem>
                          <SelectItem value="DOUBLE">Double</SelectItem>
                          <SelectItem value="DOUBLE_UNEQUAL">Double Unequal</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <Select
                        value={item.handing || ""}
                        onValueChange={(val) => updateLineItem(index, "handing", val)}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LH">Left Hand</SelectItem>
                          <SelectItem value="RH">Right Hand</SelectItem>
                          <SelectItem value="LH_RISING">LH Rising</SelectItem>
                          <SelectItem value="RH_RISING">RH Rising</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        value={item.leafHeight || ""}
                        onChange={(e) => updateLineItem(index, "leafHeight", parseInt(e.target.value) || 0)}
                        className="h-8 text-xs bg-white"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        value={item.masterLeafWidth || ""}
                        onChange={(e) => updateLineItem(index, "masterLeafWidth", parseInt(e.target.value) || 0)}
                        className="h-8 text-xs bg-white"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        value={item.leafThickness || ""}
                        onChange={(e) => updateLineItem(index, "leafThickness", parseInt(e.target.value) || 0)}
                        className="h-8 text-xs bg-white"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={item.internalColour || ""}
                        onChange={(e) => updateLineItem(index, "internalColour", e.target.value)}
                        className="h-8 text-xs bg-white"
                        placeholder="RAL 9016"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={item.externalColour || ""}
                        onChange={(e) => updateLineItem(index, "externalColour", e.target.value)}
                        className="h-8 text-xs bg-white"
                        placeholder="RAL 9016"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={item.ironmongeryPackRef || ""}
                        onChange={(e) => updateLineItem(index, "ironmongeryPackRef", e.target.value)}
                        className="h-8 text-xs bg-white"
                        placeholder="Pack A"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unitValue || ""}
                        onChange={(e) => updateLineItem(index, "unitValue", parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs bg-white font-mono"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-mono text-sm font-semibold text-slate-900">
                        £{(item.lineTotal || 0).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => duplicateLineItem(index)}
                          className="h-7 w-7 p-0"
                          title="Duplicate"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(index)}
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {quote.lineItems.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">No doors added yet. Click "Add Door" to start building your quote.</p>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Quote Summary</h3>
              <p className="text-sm text-slate-600">{quote.lineItems.length} doors • {quote.lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0)} total units</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-600">Total Value</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                £{(quote.totalValue || 0).toFixed(2)}
              </p>
            </div>
          </div>
          
          <div className="mt-4">
            <label className="text-sm font-medium text-slate-700 mb-2 block">Internal Notes</label>
            <Textarea
              value={quote.notes || ""}
              onChange={(e) => setQuote({ ...quote, notes: e.target.value })}
              placeholder="Add any internal notes or special requirements..."
              rows={3}
              className="bg-white/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
