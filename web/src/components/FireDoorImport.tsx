"use client";

/**
 * Fire Door Import Component
 * Allows fire door manufacturers to upload CSV spreadsheets of client orders
 */

import { useState } from "react";
import { apiFetch } from "@/lib/api";

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

export default function FireDoorImportSection() {
  const [uploading, setUploading] = useState(false);
  const [lastImport, setLastImport] = useState<FireDoorImportResponse | null>(null);
  const [previousImports, setPreviousImports] = useState<ImportListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showPreviousImports, setShowPreviousImports] = useState(false);

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/fire-doors/import`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || "Upload failed");
      }

      const data: FireDoorImportResponse = await response.json();
      setLastImport(data);

      // Refresh previous imports list
      if (showPreviousImports) {
        await loadPreviousImports();
      }
    } catch (err: any) {
      console.error("Import error:", err);
      setError(err.message || "Failed to import CSV file");
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = "";
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
          Upload a CSV export of your fire door orders. Supported format: LAJ/LWG export sheets.
        </p>

        <div className="space-y-4">
          {/* File upload */}
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
                accept=".csv,text/csv,application/vnd.ms-excel"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>

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
    </div>
  );
}
