"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, Search, CheckCircle2, AlertCircle, FileText, 
  Calendar, DollarSign, ArrowRight, Package
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface FireDoorImport {
  id: string;
  sourceName?: string;
  rowCount?: number;
  totalValue?: number;
  currency?: string;
  orderId?: string;
  projectId?: string;
  createdAt?: string;
}

export default function FireDoorImportsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [imports, setImports] = useState<FireDoorImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [converting, setConverting] = useState<string | null>(null);

  useEffect(() => {
    loadImports();
  }, []);

  async function loadImports() {
    try {
      const data = await apiFetch<{ imports: FireDoorImport[] }>("/fire-doors/imports");
      setImports(data.imports || []);
    } catch (error: any) {
      console.error("Failed to load imports:", error);
      toast({
        title: "Error",
        description: "Failed to load imports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleConvert(importRecord: FireDoorImport) {
    if (importRecord.orderId) {
      // Already converted, navigate to quote
      router.push(`/fire-door-quotes/${importRecord.orderId}`);
      return;
    }

    setConverting(importRecord.id);

    try {
      const result = await apiFetch<{ id: string; leadId: string; message: string }>(
        `/fire-door-quotes/from-import/${importRecord.id}`,
        {
          method: "POST",
          body: JSON.stringify({
            title: `Fire Door Quote - ${importRecord.sourceName}`,
            clientName: "Fire Door Customer",
          }),
        }
      );

      toast({
        title: "Success",
        description: result.message || "Import converted to quote",
      });

      // Navigate to the new quote
      router.push(`/fire-door-quotes/${result.id}`);
    } catch (error: any) {
      console.error("Failed to convert import:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to convert import",
        variant: "destructive",
      });
    } finally {
      setConverting(null);
    }
  }

  const filteredImports = imports.filter(
    (imp) =>
      !searchTerm ||
      (imp.sourceName || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-xl p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Fire Door CSV Imports
              </h1>
              <p className="text-slate-600 mt-2">
                Convert CSV imports into quotes and leads
              </p>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="backdrop-blur-sm bg-white/50"
                onClick={() => router.push("/fire-door-schedule")}
              >
                <Package className="w-4 h-4 mr-2" />
                View Schedule
              </Button>
              <Button 
                onClick={() => router.push("/fire-doors/import")}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl transition-all"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload CSV
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-6 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder="Search by file name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 backdrop-blur-sm bg-white/50 border-white/20"
            />
          </div>
        </div>

        {/* Imports List */}
        {loading ? (
          <div className="text-center py-12 text-slate-600">Loading imports...</div>
        ) : filteredImports.length === 0 ? (
          <div className="backdrop-blur-xl bg-white/70 rounded-2xl border border-white/20 shadow-xl p-12 text-center">
            <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No imports found</h3>
            <p className="text-slate-600 mb-6">
              Upload a fire door CSV file to get started
            </p>
            <Button onClick={() => router.push("/fire-doors/import")}>
              <Upload className="w-4 h-4 mr-2" />
              Upload CSV
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredImports.map((importRecord) => {
              const isConverted = !!importRecord.orderId;
              const isConverting = converting === importRecord.id;

              return (
                <div
                  key={importRecord.id}
                  className="backdrop-blur-xl bg-white/70 rounded-xl border border-white/20 shadow-lg hover:shadow-xl transition-all p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-slate-900">
                          {importRecord.sourceName || "Unnamed Import"}
                        </h3>
                        {isConverted ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Converted
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Not Converted
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Package className="w-4 h-4" />
                          <span>{importRecord.rowCount || 0} door{importRecord.rowCount !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <DollarSign className="w-4 h-4" />
                          <span>
                            {importRecord.currency || "GBP"}{" "}
                            {(importRecord.totalValue || 0).toLocaleString("en-GB", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {importRecord.createdAt
                              ? new Date(importRecord.createdAt).toLocaleDateString("en-GB")
                              : "Unknown date"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Button
                        onClick={() => handleConvert(importRecord)}
                        disabled={isConverting}
                        className={
                          isConverted
                            ? "bg-slate-600 hover:bg-slate-700"
                            : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        }
                      >
                        {isConverting ? (
                          <>
                            <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Converting...
                          </>
                        ) : isConverted ? (
                          <>
                            View Quote
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        ) : (
                          <>
                            Convert to Quote
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
