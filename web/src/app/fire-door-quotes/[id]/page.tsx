"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Save, ArrowLeft, Download, Send, 
  Plus, Upload
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { FireDoorGrid } from "./fire-door-grid-new";
import { RfiDialog } from "@/components/rfi-dialog";

interface FireDoorLineItem {
  id?: string;
  rowIndex: number;
  [key: string]: any;
}

interface RfiRecord {
  id: string;
  rowId: string | null;
  columnKey: string;
  title?: string | null;
  message: string;
  status: string;
  visibleToClient: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  const [rfis, setRfis] = useState<RfiRecord[]>([]);
  const [rfiDialogOpen, setRfiDialogOpen] = useState(false);
  const [currentRfi, setCurrentRfi] = useState<RfiRecord | null>(null);
  const [rfiContext, setRfiContext] = useState<{ rowId: string | null; columnKey: string; columnName?: string }>({ rowId: null, columnKey: "" });
  const [rfiMode, setRfiMode] = useState<"create" | "edit" | "view">("create");
  
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
      await loadRfis(id);
    } catch (error: any) {
      console.error("Error loading quote:", error);
      
      // If quote not found (404), treat as new quote
      if (error?.status === 404 || error?.message?.includes('not found')) {
        console.log('Quote not found, starting new quote');
        addLineItem();
      } else {
        toast({
          title: "Error",
          description: "Failed to load quote",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadRfis(projectId: string) {
    try {
      const data = await apiFetch<RfiRecord[]>(`/rfis?projectId=${projectId}`);
      setRfis(data || []);
    } catch (error) {
      console.error("Error loading RFIs:", error);
    }
  }

  async function saveQuote() {
    setSaving(true);
    try {
      const endpoint = quote.id ? `/fire-door-quotes/${quote.id}` : "/fire-door-quotes";
      const method = quote.id ? "PUT" : "POST";
      
      const savedQuote = await apiFetch<FireDoorQuote>(endpoint, {
        method,
        json: quote,
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
      doorRef: `DOOR-${quote.lineItems.length + 1}`,
      location: "",
      quantity: 1,
      rating: "FD30",
      doorHeight: 2040,
      masterWidth: 826,
      unitValue: 0,
      lineTotal: 0, // API expects this field
    };
    
    setQuote({
      ...quote,
      lineItems: [...quote.lineItems, newItem],
    });
  }

  function handleLineItemsChange(items: FireDoorLineItem[]) {
    // Re-index items and calculate line totals
    const indexed = items.map((item, idx) => {
      const qty = item.quantity || 0;
      const unitVal = item.unitValue || 0;
      const lineTotal = qty * unitVal;
      return { 
        ...item, 
        rowIndex: idx,
        lineTotal // API expects this field
      };
    });
    
    // Calculate total
    const total = indexed.reduce((sum, item: any) => sum + (item.lineTotal || 0), 0);
    
    setQuote({
      ...quote,
      lineItems: indexed,
      totalValue: total,
    });
  }

  function handleAddRfi(rowId: string | null, columnKey: string) {
    setRfiContext({ rowId, columnKey });
    setCurrentRfi(null);
    setRfiMode("create");
    setRfiDialogOpen(true);
  }

  function handleSelectRfi(rfi: RfiRecord) {
    setCurrentRfi(rfi);
    setRfiContext({ rowId: rfi.rowId, columnKey: rfi.columnKey });
    setRfiMode("edit");
    setRfiDialogOpen(true);
  }

  async function handleSaveRfi(rfiData: Partial<RfiRecord>) {
    try {
      const endpoint = rfiData.id ? `/rfis/${rfiData.id}` : "/rfis";
      const method = rfiData.id ? "PUT" : "POST";
      
      const payload = {
        ...rfiData,
        projectId: quote.id,
      };

      await apiFetch(endpoint, {
        method,
        json: payload,
      });

      toast({
        title: "Success",
        description: `RFI ${rfiData.id ? 'updated' : 'created'} successfully`,
      });

      // Reload RFIs
      if (quote.id) {
        await loadRfis(quote.id);
      }
    } catch (error) {
      console.error("Error saving RFI:", error);
      throw error;
    }
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
                  Fire Door Quote Builder - AG Grid (144 Columns)
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Excel-style editor with 144 columns • {quote.lineItems.length} doors • Range selection • Copy/Paste • Fill-down
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

        {/* AG Grid Spreadsheet */}
        <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-lg overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Door Specifications (144 Columns)</h2>
              <p className="text-xs text-slate-600 mt-1">
                ✓ Excel-like editing • ✓ Range selection • ✓ Copy/Paste • ✓ Fill-down • ✓ Column groups • ✓ Right-click for RFIs
              </p>
            </div>
            <Button
              onClick={addLineItem}
              size="sm"
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Door
            </Button>
          </div>

          <div className="p-4">
            <FireDoorGrid 
              lineItems={quote.lineItems}
              rfis={rfis}
              onLineItemsChange={handleLineItemsChange}
              onAddRfi={handleAddRfi}
              onSelectRfi={handleSelectRfi}
            />
          </div>
        </div>

        {/* Summary */}
        <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Quote Summary</h3>
              <p className="text-sm text-slate-600">
                {quote.lineItems.length} doors • {quote.lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0)} total units
              </p>
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

      {/* RFI Dialog */}
      <RfiDialog
        open={rfiDialogOpen}
        onOpenChange={setRfiDialogOpen}
        rfi={currentRfi}
        rowId={rfiContext.rowId}
        columnKey={rfiContext.columnKey}
        columnName={rfiContext.columnName}
        onSave={handleSaveRfi}
        mode={rfiMode}
      />
    </div>
  );
}
