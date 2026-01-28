"use client";

/**
 * Fire Door Import Component
 * Allows fire door manufacturers to upload CSV spreadsheets of client orders
 */

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface FireDoorImportSummary {
  id: string;
  totalValue: number;
  currency: string;
  status: string;
  rowCount: number;
  createdAt: string;
}

interface FireDoorLineItemPreview {
  id: string;
  doorRef: string | null;
  location: string | null;
  fireRating: string | null;
  quantity: number | null;
  lineTotal: number | null;
}

interface FireDoorImportResponse {
  import: FireDoorImportSummary;
  lineItems: FireDoorLineItemPreview[];
  totalValue: number;
  rowCount: number;
}

interface ImportListItem {
  id: string;
  sourceName: string;
  status: string;
  totalValue: number;
  currency: string;
  rowCount: number;
  createdAt: string;
}

interface FireDoorImportSectionProps {
  onImportComplete?: (data: FireDoorImportResponse) => void;
}

export default function FireDoorImportSection({ onImportComplete }: FireDoorImportSectionProps) {
  const IGNORE_SENTINEL = "__IGNORE__";

  const [uploading, setUploading] = useState(false);
  const [lastImport, setLastImport] = useState<FireDoorImportResponse | null>(null);
  const [previousImports, setPreviousImports] = useState<ImportListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showPreviousImports, setShowPreviousImports] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showDetailsForm, setShowDetailsForm] = useState(false);
  const [mjsNumber, setMjsNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [netValue, setNetValue] = useState("");

  const [mappingOpen, setMappingOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [missingHeaders, setMissingHeaders] = useState<string[]>([]);
  const [requiredHeaders, setRequiredHeaders] = useState<string[]>([]);
  const [expectedHeaders, setExpectedHeaders] = useState<string[]>([]);
  const [headerMap, setHeaderMap] = useState<Record<string, string>>({});

  const [sheetOpen, setSheetOpen] = useState(false);
  const [excelSheets, setExcelSheets] = useState<string[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>("");

  const normalize = (s: string) =>
    String(s || "")
      .toLowerCase()
      .replace(/\u00a0/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const levenshtein = (a: string, b: string) => {
    const s = a || "";
    const t = b || "";
    const n = s.length;
    const m = t.length;
    if (n === 0) return m;
    if (m === 0) return n;

    const dp = new Array(m + 1);
    for (let j = 0; j <= m; j++) dp[j] = j;
    for (let i = 1; i <= n; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= m; j++) {
        const tmp = dp[j];
        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
        dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
        prev = tmp;
      }
    }
    return dp[m];
  };

  const similarityScore = (expected: string, candidate: string) => {
    const e = normalize(expected);
    const c = normalize(candidate);
    if (!e || !c) return 0;
    if (e === c) return 1;
    if (c.includes(e) || e.includes(c)) return 0.92;

    const eTokens = new Set(e.split(" ").filter(Boolean));
    const cTokens = new Set(c.split(" ").filter(Boolean));
    const inter = [...eTokens].filter((x) => cTokens.has(x)).length;
    const union = new Set([...eTokens, ...cTokens]).size || 1;
    const jaccard = inter / union;

    const dist = levenshtein(e, c);
    const maxLen = Math.max(e.length, c.length) || 1;
    const levSim = 1 - dist / maxLen;

    return 0.55 * jaccard + 0.45 * levSim;
  };

  const guessHeaderMap = (missing: string[], headers: string[]) => {
    const out: Record<string, string> = {};
    const byNorm = new Map<string, string>();
    for (const h of headers) {
      const n = normalize(h);
      if (n && !byNorm.has(n)) byNorm.set(n, h);
    }

    for (const expected of missing) {
      const ne = normalize(expected);
      const direct = byNorm.get(ne);
      if (direct) {
        out[expected] = direct;
        continue;
      }
      // fallback: contains match
      const candidate = headers.find((h) => {
        const nh = normalize(h);
        return nh === ne || nh.includes(ne) || ne.includes(nh);
      });
      if (candidate) out[expected] = candidate;

      // fuzzy fallback
      if (!out[expected]) {
        let best: { h: string; score: number } | null = null;
        for (const h of headers) {
          const score = similarityScore(expected, h);
          if (!best || score > best.score) best = { h, score };
        }
        if (best && best.score >= 0.6) {
          out[expected] = best.h;
        }
      }
    }
    return out;
  };

  const buildInitialHeaderMap = (expected: string[], headers: string[]) => {
    const out: Record<string, string> = {};
    const byNorm = new Map<string, string>();
    const headerSet = new Set(headers);
    for (const h of headers) {
      const n = normalize(h);
      if (n && !byNorm.has(n)) byNorm.set(n, h);
    }

    for (const exp of expected) {
      // Prefer exact match (same display string) when present.
      if (headerSet.has(exp)) {
        out[exp] = exp;
        continue;
      }
      const ne = normalize(exp);
      const directNorm = byNorm.get(ne);
      if (directNorm) {
        out[exp] = directNorm;
        continue;
      }

      let best: { h: string; score: number } | null = null;
      for (const h of headers) {
        const score = similarityScore(exp, h);
        if (!best || score > best.score) best = { h, score };
      }
      if (best && best.score >= 0.6) out[exp] = best.h;
    }

    return out;
  };

  // Load previous imports on mount
  const loadPreviousImports = async () => {
    try {
      const data = await apiFetch<{ imports: ImportListItem[] }>("/fire-doors/imports");
      setPreviousImports(data.imports || []);
      setShowPreviousImports(true);
    } catch (err: any) {
      console.error("Failed to load previous imports:", err);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setShowDetailsForm(true);
    setError(null);
  };

  const handleUploadWithDetails = async (opts?: { headerMap?: Record<string, string>; sheetName?: string }) => {
    if (!selectedFile) return;

    if (!mjsNumber || !customerName || !jobDescription) {
      setError("Please fill in all required fields (MJS Number, Customer Name, Job Description)");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("mjsNumber", mjsNumber);
      formData.append("customerName", customerName);
      formData.append("jobDescription", jobDescription);
      if (netValue) {
        formData.append("netValue", netValue);
      }
      if (opts?.headerMap && Object.keys(opts.headerMap).length > 0) {
        formData.append("headerMap", JSON.stringify(opts.headerMap));
      } else {
        // Ask backend to return the mapping UI payload even if headers already match.
        // This lets the user review/adjust mappings before import.
        formData.append("forceMapping", "1");
      }
      const sheetToSend = (opts?.sheetName || selectedSheetName || "").trim();
      if (sheetToSend) {
        formData.append("sheetName", sheetToSend);
      }

      // Always use same-origin Next.js API route; it proxies to the backend with proper auth.
      const response = await fetch(`/api/fire-doors/import`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        let errorPayload: any = null;
        try {
          errorPayload = await response.json();
        } catch {
          errorPayload = null;
        }

        if (errorPayload?.needsSheetSelection && Array.isArray(errorPayload?.sheets)) {
          const sheets = errorPayload.sheets.map((s: any) => String(s)).filter(Boolean);
          setExcelSheets(sheets);
          setSelectedSheetName(sheets[0] || "");
          setSheetOpen(true);
          return;
        }

        if (errorPayload?.needsMapping && Array.isArray(errorPayload?.missingHeaders) && Array.isArray(errorPayload?.headers)) {
          const missing = errorPayload.missingHeaders.map((s: any) => String(s)).filter(Boolean);
          const headers = errorPayload.headers
            .map((s: any) => String(s))
            .filter(Boolean)
            .sort((a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
          const required = Array.isArray(errorPayload.requiredHeaders)
            ? errorPayload.requiredHeaders.map((s: any) => String(s)).filter(Boolean)
            : [];
          const expected = Array.isArray(errorPayload.expectedHeaders)
            ? errorPayload.expectedHeaders.map((s: any) => String(s)).filter(Boolean)
            : [];

          setCsvHeaders(headers);
          setMissingHeaders(missing);
          setRequiredHeaders(required);
          setExpectedHeaders(expected);
          const expectedAll = (expected && expected.length) ? expected : required;
          const initial = {
            ...buildInitialHeaderMap(expectedAll, headers),
            ...guessHeaderMap(missing, headers),
          };
          setHeaderMap(initial);
          setMappingOpen(true);
          return;
        }

        const message =
          typeof errorPayload === "string"
            ? errorPayload
            : errorPayload?.message || errorPayload?.error || `Upload failed (${response.status})`;

        throw new Error(message);
      }

      const data: FireDoorImportResponse = await response.json();
      setLastImport(data);
      
      // Callback to parent component
      onImportComplete?.(data);

      // Refresh previous imports list
      if (showPreviousImports) {
        await loadPreviousImports();
      }

      // Reset form
      setShowDetailsForm(false);
      setSelectedFile(null);
      setMjsNumber("");
      setCustomerName("");
      setJobDescription("");
      setNetValue("");
      setSelectedSheetName("");
      setExcelSheets([]);
    } catch (err: any) {
      console.error("Import error:", err);
      setError(err.message || "Failed to import CSV file");
    } finally {
      setUploading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = "GBP") => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Import Fire Door Orders from Spreadsheet
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Upload a CSV or Excel export of your fire door orders. Supported format: LAJ/LWG export sheets.
        </p>

        <div className="space-y-4">
          {/* File upload */}
          {!showDetailsForm ? (
            <div>
              <label
                htmlFor="fire-door-csv-upload"
                className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <div className="text-center">
                  <svg
                    className="mx-auto h-8 w-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    {uploading ? "Uploading..." : "Click to upload CSV"}
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    CSV files up to 10MB
                  </span>
                </div>
                <input
                  id="fire-door-csv-upload"
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="border border-gray-300 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-semibold text-gray-900">Order Details</h4>
                <button
                  onClick={() => {
                    setShowDetailsForm(false);
                    setSelectedFile(null);
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Selected file:</strong> {selectedFile?.name}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    MJS Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={mjsNumber}
                    onChange={(e) => setMjsNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 2024-123"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. ABC Construction"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. School refurbishment - Fire doors for main building"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Net Value (£) <span className="text-gray-500 text-xs">(optional)</span>
                </label>
                <input
                  type="number"
                  value={netValue}
                  onChange={(e) => setNetValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 15000.00"
                  step="0.01"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowDetailsForm(false);
                    setSelectedFile(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUploadWithDetails()}
                  disabled={uploading || !mjsNumber || !customerName || !jobDescription}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? "Uploading..." : "Upload & Import"}
                </button>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Import Failed</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Success message with preview */}
          {lastImport && (
            <div className="rounded-md bg-green-50 border border-green-200 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-green-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-green-800">Import Successful</h3>
                  <div className="mt-2 text-sm text-green-700">
                    Imported {lastImport.rowCount} doors with total value of{" "}
                    {formatCurrency(lastImport.totalValue, lastImport.import.currency)}
                  </div>

                  {/* Preview table */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Door Ref
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Location
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Fire Rating
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Qty
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {lastImport.lineItems.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {item.doorRef || "-"}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {item.location || "-"}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {item.fireRating || "-"}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {item.quantity || "-"}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {item.lineTotal
                                ? formatCurrency(item.lineTotal, lastImport.import.currency)
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {lastImport.rowCount > lastImport.lineItems.length && (
                      <p className="mt-2 text-xs text-gray-500 text-center">
                        Showing first {lastImport.lineItems.length} of {lastImport.rowCount} doors
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Previous imports section */}
          <div>
            {!showPreviousImports ? (
              <button
                onClick={loadPreviousImports}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                Show previous imports
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900">Previous Imports</h4>
                  <button
                    onClick={() => setShowPreviousImports(false)}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Hide
                  </button>
                </div>

                {previousImports.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    No previous imports found
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Date
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            File
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Items
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Total Value
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {previousImports.map((imp) => (
                          <tr key={imp.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {formatDate(imp.createdAt)}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {imp.sourceName}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {imp.rowCount}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {formatCurrency(imp.totalValue, imp.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={mappingOpen} onOpenChange={(open) => setMappingOpen(open)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{missingHeaders.length ? 'Match Columns' : 'Review Column Mapping'}</DialogTitle>
            <DialogDescription>
              {missingHeaders.length
                ? 'Your spreadsheet columns don’t match the expected import format. Match columns below.'
                : 'Confirm (or adjust) how your spreadsheet columns map to the import format before importing.'}
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const expectedAll = (expectedHeaders && expectedHeaders.length) ? expectedHeaders : requiredHeaders;
            const systemFields = (expectedAll || [])
              .map((x) => String(x))
              .filter(Boolean)
              .slice()
              .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

            const mappedByCsv: Record<string, string> = {};
            for (const expected of systemFields) {
              const csv = String(headerMap[expected] || "").trim();
              if (csv) mappedByCsv[csv] = expected;
            }

            const sortedCsv = (csvHeaders || [])
              .map((h) => String(h))
              .filter(Boolean)
              .slice()
              .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

            const unmatchedCsv = sortedCsv.filter((h) => !mappedByCsv[h]);
            const matchedCsv = sortedCsv.filter((h) => !!mappedByCsv[h]);
            const orderedCsv = [...unmatchedCsv, ...matchedCsv];

            const missingSystemFields = (missingHeaders || [])
              .map((x) => String(x))
              .filter(Boolean)
              .slice()
              .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

            return (
              <>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-800">
                    Imported columns
                    <span className="text-xs text-slate-600"> (unmatched first)</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Unmatched: {unmatchedCsv.length} / {sortedCsv.length}
                  </div>
                </div>

                <div className="flex-1 overflow-hidden rounded-md border border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 sticky top-0 z-10">
                    <div>Imported column</div>
                    <div>System field</div>
                  </div>
                  <div className="max-h-[55vh] overflow-auto">
                    {orderedCsv.map((csvHeader) => (
                      <div key={csvHeader} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center px-3 py-2 border-t border-slate-100">
                        <div className="text-sm font-medium text-slate-800 break-words">
                          {csvHeader}
                          {!mappedByCsv[csvHeader] ? <span className="text-xs text-orange-600"> (unmatched)</span> : null}
                        </div>
                        <Select
                          value={mappedByCsv[csvHeader] ?? undefined}
                          onValueChange={(val) => {
                            if (val === IGNORE_SENTINEL) {
                              setHeaderMap((prev) => {
                                const next = { ...prev };
                                for (const k of Object.keys(next)) {
                                  if (String(next[k] || "").trim() === csvHeader) delete next[k];
                                }
                                return next;
                              });
                              return;
                            }

                            setHeaderMap((prev) => {
                              const next = { ...prev };

                              // Remove any mapping currently pointing at this imported column
                              for (const k of Object.keys(next)) {
                                if (String(next[k] || "").trim() === csvHeader) delete next[k];
                              }

                              // Ensure the selected system field only maps to one imported column
                              delete next[val];

                              next[val] = csvHeader;
                              return next;
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select system field…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={IGNORE_SENTINEL}>(Ignore)</SelectItem>
                            {systemFields.map((field) => (
                              <SelectItem key={field} value={field}>
                                {field}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 mt-4">
            <Button variant="outline" onClick={() => setMappingOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                // Require required headers to be satisfied (either present in file or mapped)
                for (const expected of requiredHeaders) {
                  const hasDirect = csvHeaders.includes(expected);
                  const mapped = String(headerMap[expected] || "").trim();
                  if (!hasDirect && !mapped) {
                    setError(`Please map: ${expected}`);
                    return;
                  }
                }
                setMappingOpen(false);
                await handleUploadWithDetails({ headerMap, sheetName: selectedSheetName || undefined });
              }}
            >
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sheetOpen} onOpenChange={(open) => setSheetOpen(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Sheet</DialogTitle>
            <DialogDescription>
              This Excel file has multiple sheets. Choose which sheet you want to import.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-800">Sheet</div>
            <Select value={selectedSheetName} onValueChange={(v) => setSelectedSheetName(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a sheet…" />
              </SelectTrigger>
              <SelectContent>
                {excelSheets.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setSheetOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedSheetName.trim()) {
                  setError('Please select a sheet');
                  return;
                }
                setSheetOpen(false);
                await handleUploadWithDetails({ sheetName: selectedSheetName.trim() });
              }}
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
