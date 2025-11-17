"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchQuote, normalizeQuestionnaireFields } from "@/lib/api/quotes";
import { apiFetch } from "@/lib/api";
import type { QuoteDto, QuestionnaireField } from "@/lib/api/quotes";

export default function QuotePrintPage() {
  const params = useParams();
  const router = useRouter();
  const quoteId = String(params?.id ?? "");
  
  const [quote, setQuote] = useState<QuoteDto | null>(null);
  const [lead, setLead] = useState<any>(null);
  const [questionnaireFields, setQuestionnaireFields] = useState<QuestionnaireField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!quoteId) return;
      
      try {
        setLoading(true);
        
        // Fetch quote
        const quoteData = await fetchQuote(quoteId);
        setQuote(quoteData);
        
        // Fetch questionnaire fields
        if (quoteData.tenantId) {
          const settings = await apiFetch<any>("/tenant/settings");
          const fields = normalizeQuestionnaireFields(settings?.questionnaire);
          setQuestionnaireFields(fields);
        }
        
        // Fetch lead
        if (quoteData.leadId) {
          const leadRes = await apiFetch<{ lead: any }>(`/leads/${quoteData.leadId}`);
          setLead(leadRes?.lead ?? null);
        }
      } catch (err) {
        console.error("Failed to load quote data:", err);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [quoteId]);

  const handlePrint = () => {
    window.print();
  };

  const questionnaireAnswers = lead?.custom || {};
  const items = Array.isArray(questionnaireAnswers?.items) ? questionnaireAnswers.items : [];
  
  // Filter to public questionnaire fields
  const publicFields = questionnaireFields.filter(
    (f) => f.askInQuestionnaire !== false && !f.internalOnly
  ).sort((a, b) => {
    const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : 999;
    const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : 999;
    return orderA - orderB;
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mx-auto" />
          <p className="text-muted-foreground">Loading quote details...</p>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Quote not found</p>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .no-print {
            display: none !important;
          }
          
          .print-page-break {
            page-break-after: always;
          }
          
          .print-avoid-break {
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Screen-only controls */}
      <div className="no-print sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Quote
          </Button>
          <Button onClick={handlePrint} size="sm" className="gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Printable content */}
      <div className="mx-auto max-w-[210mm] bg-white p-8">
        {/* Header */}
        <div className="mb-8 border-b pb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {quote.title || "Quote Information Sheet"}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
            {quote.tenant?.name && (
              <div>
                <span className="font-medium">Company:</span> {quote.tenant.name}
              </div>
            )}
            {quote.createdAt && (
              <div>
                <span className="font-medium">Date:</span>{" "}
                {new Date(quote.createdAt).toLocaleDateString()}
              </div>
            )}
            {quote.status && (
              <div>
                <span className="font-medium">Status:</span>{" "}
                <span className="capitalize">{quote.status.toLowerCase()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Customer Information */}
        {lead && (
          <section className="mb-8 print-avoid-break">
            <h2 className="mb-4 text-xl font-bold text-gray-900 border-b pb-2">
              Customer Information
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {lead.contactName && (
                <div>
                  <span className="font-medium text-gray-700">Contact Name:</span>
                  <div className="mt-0.5 text-gray-900">{lead.contactName}</div>
                </div>
              )}
              {(lead.email || lead.contactEmail) && (
                <div>
                  <span className="font-medium text-gray-700">Email:</span>
                  <div className="mt-0.5 text-gray-900">{lead.email || lead.contactEmail}</div>
                </div>
              )}
              {(lead.phone || lead.contactPhone) && (
                <div>
                  <span className="font-medium text-gray-700">Phone:</span>
                  <div className="mt-0.5 text-gray-900">{lead.phone || lead.contactPhone}</div>
                </div>
              )}
              {(lead.location || lead.address) && (
                <div>
                  <span className="font-medium text-gray-700">Location:</span>
                  <div className="mt-0.5 text-gray-900">{lead.location || lead.address}</div>
                </div>
              )}
              {lead.capturedAt && (
                <div>
                  <span className="font-medium text-gray-700">Enquiry Date:</span>
                  <div className="mt-0.5 text-gray-900">
                    {new Date(lead.capturedAt).toLocaleDateString()}
                  </div>
                </div>
              )}
              {lead.status && (
                <div>
                  <span className="font-medium text-gray-700">Lead Status:</span>
                  <div className="mt-0.5 text-gray-900 capitalize">
                    {lead.status.toLowerCase().replace(/_/g, " ")}
                  </div>
                </div>
              )}
            </div>
            {lead.description && (
              <div className="mt-4">
                <span className="font-medium text-gray-700">Description:</span>
                <div className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                  {lead.description}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Questionnaire Responses */}
        {items.length > 0 && publicFields.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-gray-900 border-b pb-2">
              Project Requirements
            </h2>
            <div className="space-y-6">
              {items.map((item: any, itemIdx: number) => (
                <div key={itemIdx} className="print-avoid-break">
                  {items.length > 1 && (
                    <h3 className="mb-3 font-semibold text-gray-800">
                      Item {itemIdx + 1}
                    </h3>
                  )}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    {publicFields.map((field) => {
                      const value = item[field.key];
                      if (!value || (typeof value === 'string' && !value.trim())) {
                        return null;
                      }
                      
                      return (
                        <div key={field.key}>
                          <span className="font-medium text-gray-700">
                            {field.label}:
                          </span>
                          <div className="mt-0.5 text-gray-900 break-words">
                            {Array.isArray(value) ? value.join(", ") : String(value)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Supplier Files */}
        {quote.supplierFiles && quote.supplierFiles.length > 0 && (
          <section className="mb-8 print-avoid-break">
            <h2 className="mb-4 text-xl font-bold text-gray-900 border-b pb-2">
              Supplier Files
            </h2>
            <div className="space-y-2 text-sm">
              {quote.supplierFiles.map((file, idx) => (
                <div key={file.id} className="flex items-start gap-2">
                  <span className="text-gray-600">{idx + 1}.</span>
                  <div>
                    <div className="font-medium text-gray-900">{file.name}</div>
                    {file.sizeBytes && (
                      <div className="text-xs text-gray-600">
                        {formatBytes(file.sizeBytes)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Client Quote Files */}
        {quote.clientQuoteFiles && quote.clientQuoteFiles.length > 0 && (
          <section className="mb-8 print-avoid-break">
            <h2 className="mb-4 text-xl font-bold text-gray-900 border-b pb-2">
              Client Quote Files (JoinerySoft, etc.)
            </h2>
            <div className="space-y-2 text-sm">
              {quote.clientQuoteFiles.map((file, idx) => (
                <div key={file.id} className="flex items-start gap-2">
                  <span className="text-gray-600">{idx + 1}.</span>
                  <div>
                    <div className="font-medium text-gray-900">{file.name}</div>
                    {file.uploadedAt && (
                      <div className="text-xs text-gray-600">
                        Uploaded: {new Date(file.uploadedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quote Lines */}
        {quote.lines && quote.lines.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-gray-900 border-b pb-2">
              Quote Lines ({quote.lines.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="py-2 px-2 text-left font-semibold text-gray-700">
                      Description
                    </th>
                    <th className="py-2 px-2 text-right font-semibold text-gray-700 w-20">
                      Qty
                    </th>
                    <th className="py-2 px-2 text-right font-semibold text-gray-700 w-24">
                      Unit Price
                    </th>
                    <th className="py-2 px-2 text-right font-semibold text-gray-700 w-24">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lines.map((line, idx) => (
                    <tr key={line.id} className="border-b border-gray-200">
                      <td className="py-2 px-2 text-gray-900">
                        {line.description || "—"}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-900">
                        {line.qty != null ? Number(line.qty).toFixed(2) : "—"}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-900">
                        {line.unitPrice != null
                          ? formatCurrency(Number(line.unitPrice), line.currency || quote.currency)
                          : "—"}
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-gray-900">
                        {line.meta?.lineTotalGBP != null
                          ? formatCurrency(Number(line.meta.lineTotalGBP), "GBP")
                          : line.sellTotal != null
                          ? formatCurrency(Number(line.sellTotal), line.currency || quote.currency)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Quote Totals */}
        {(quote.totalGBP != null || (quote.meta as any)?.lastEstimate) && (
          <section className="mb-8 print-avoid-break">
            <h2 className="mb-4 text-xl font-bold text-gray-900 border-b pb-2">
              Quote Summary
            </h2>
            <div className="space-y-2 text-sm">
              {quote.totalGBP != null && (
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Total:</span>
                  <span className="font-bold text-gray-900">
                    {formatCurrency(Number(quote.totalGBP), quote.currency || "GBP")}
                  </span>
                </div>
              )}
              {(quote.meta as any)?.lastEstimate?.predictedTotal != null && (
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">ML Estimate:</span>
                  <span className="text-gray-900">
                    {formatCurrency(
                      Number((quote.meta as any).lastEstimate.predictedTotal),
                      (quote.meta as any).lastEstimate.currency || quote.currency || "GBP"
                    )}
                  </span>
                </div>
              )}
              {(quote.meta as any)?.lastEstimate?.confidence != null && (
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Confidence:</span>
                  <span className="text-gray-900">
                    {Math.round(Number((quote.meta as any).lastEstimate.confidence) * 100)}%
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Notes */}
        {quote.notes && (
          <section className="mb-8 print-avoid-break">
            <h2 className="mb-4 text-xl font-bold text-gray-900 border-b pb-2">
              Notes
            </h2>
            <div className="text-sm text-gray-900 whitespace-pre-wrap">
              {quote.notes}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t text-center text-xs text-gray-500">
          Generated: {new Date().toLocaleString()} | Quote ID: {quote.id}
        </div>
      </div>
    </>
  );
}

function formatCurrency(value: number, currency?: string | null): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(value);
  } catch {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(value);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
