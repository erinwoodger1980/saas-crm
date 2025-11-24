"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

interface FireDoorRow {
  id: string;
  doorRef: string | null;
  location: string | null;
  quantity: number | null;
  fireRating: string | null;
  doorSetType: string | null;
  
  // Leaf dimensions (DATA ENTRY)
  leafHeight: number | null;
  masterLeafWidth: number | null;
  slaveLeafWidth: number | null;
  leafThickness: number | null;
  leafConfiguration: string | null;
  
  // Vision panels (DATA ENTRY)
  visionQtyLeaf1: number | null;
  vp1WidthLeaf1: number | null;
  vp1HeightLeaf1: number | null;
  totalGlazedAreaMaster: number | null;
  
  // Finishes (DATA ENTRY)
  internalColour: string | null;
  externalColour: string | null;
  doorFacing: string | null;
  lippingFinish: string | null;
  frameFinish: string | null;
  
  // Ironmongery (DATA ENTRY)
  ironmongeryPackRef: string | null;
  closerOrFloorSpring: string | null;
  
  // Pricing (CALCULATED)
  unitValue: number | null;
  labourCost: number | null;
  materialCost: number | null;
  lineTotal: number | null;
}

interface FireDoorSpreadsheetProps {
  importId?: string;
  onQuoteCreated?: (quoteId: string) => void;
}

export default function FireDoorSpreadsheet({ importId, onQuoteCreated }: FireDoorSpreadsheetProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FireDoorRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load fire door data from import
  useEffect(() => {
    if (!importId) return;
    
    const loadImport = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<any>(`/fire-doors/imports/${importId}`);
        setRows(data.lineItems || []);
        // Select all rows by default
        setSelectedRows(new Set(data.lineItems.map((r: any) => r.id)));
      } catch (err: any) {
        setError(err.message || "Failed to load import");
      } finally {
        setLoading(false);
      }
    };

    loadImport();
  }, [importId]);

  const handleCellEdit = (rowId: string, field: keyof FireDoorRow, value: any) => {
    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, [field]: value } : row
    ));
  };

  const toggleRowSelection = (rowId: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === rows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(rows.map(r => r.id)));
    }
  };

  const createQuoteFromSelected = async () => {
    if (selectedRows.size === 0) {
      alert("Please select at least one door");
      return;
    }

    setCreatingQuote(true);
    setError(null);

    try {
      // Create quote
      const quote = await apiFetch<{ id: string }>("/quotes", {
        method: "POST",
        json: {
          title: `Fire Door Order - ${selectedRows.size} doors`,
          status: "DRAFT",
        },
      });

      // Add line items for each selected door
      const selectedDoors = rows.filter(r => selectedRows.has(r.id));
      
      for (const door of selectedDoors) {
        await apiFetch(`/quotes/${quote.id}/lines`, {
          method: "POST",
          json: {
            description: `${door.doorRef || "Door"} - ${door.location || ""} (${door.fireRating || ""})`,
            quantity: door.quantity || 1,
            unitPrice: door.unitValue || 0,
            notes: JSON.stringify({
              doorRef: door.doorRef,
              location: door.location,
              fireRating: door.fireRating,
              leafHeight: door.leafHeight,
              masterLeafWidth: door.masterLeafWidth,
              leafConfiguration: door.leafConfiguration,
            }),
          },
        });
      }

      onQuoteCreated?.(quote.id);
      alert(`Quote ${quote.id} created with ${selectedRows.size} doors!`);
    } catch (err: any) {
      setError(err.message || "Failed to create quote");
    } finally {
      setCreatingQuote(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading doors...</div>;
  }

  if (!importId) {
    return <div className="p-4 text-center text-gray-500">Upload a CSV file to view doors</div>;
  }

  if (rows.length === 0) {
    return <div className="p-4 text-center text-gray-500">No doors found in this import</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            {selectedRows.size} of {rows.length} doors selected
          </span>
          <button
            onClick={toggleSelectAll}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            {selectedRows.size === rows.length ? "Deselect all" : "Select all"}
          </button>
        </div>
        <button
          onClick={createQuoteFromSelected}
          disabled={creatingQuote || selectedRows.size === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creatingQuote ? "Creating..." : `Create Quote (${selectedRows.size} doors)`}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Spreadsheet */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={selectedRows.size === rows.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4"
                />
              </th>
              {/* Identification columns */}
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Door Ref</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fire Rating</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              
              {/* Dimensions (EDITABLE) */}
              <th className="px-3 py-2 text-left text-xs font-medium text-blue-600 uppercase" title="Data Entry">Height (mm)</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-blue-600 uppercase" title="Data Entry">M Width (mm)</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-blue-600 uppercase" title="Data Entry">S Width (mm)</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-blue-600 uppercase" title="Data Entry">Thickness</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-blue-600 uppercase" title="Data Entry">Config</th>
              
              {/* Vision panels (EDITABLE) */}
              <th className="px-3 py-2 text-left text-xs font-medium text-blue-600 uppercase" title="Data Entry">Vision Qty</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-blue-600 uppercase" title="Data Entry">Glass Area (m²)</th>
              
              {/* Finishes (EDITABLE) */}
              <th className="px-3 py-2 text-left text-xs font-medium text-blue-600 uppercase" title="Data Entry">Int Colour</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-blue-600 uppercase" title="Data Entry">Ext Colour</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-blue-600 uppercase" title="Data Entry">Facing</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-blue-600 uppercase" title="Data Entry">Lipping</th>
              
              {/* Ironmongery (EDITABLE) */}
              <th className="px-3 py-2 text-left text-xs font-medium text-blue-600 uppercase" title="Data Entry">Ironmongery Pack</th>
              
              {/* Pricing (CALCULATED) */}
              <th className="px-3 py-2 text-left text-xs font-medium text-green-600 uppercase" title="Calculated">Labour</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-green-600 uppercase" title="Calculated">Materials</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-green-600 uppercase" title="Calculated">Unit Price</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-green-600 uppercase" title="Calculated">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row) => (
              <tr key={row.id} className={selectedRows.has(row.id) ? "bg-blue-50" : ""}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(row.id)}
                    onChange={() => toggleRowSelection(row.id)}
                    className="h-4 w-4"
                  />
                </td>
                
                {/* Identification (READ ONLY) */}
                <td className="px-3 py-2 text-sm">{row.doorRef || "-"}</td>
                <td className="px-3 py-2 text-sm">{row.location || "-"}</td>
                <td className="px-3 py-2 text-sm">{row.quantity || 1}</td>
                <td className="px-3 py-2 text-sm">{row.fireRating || "-"}</td>
                <td className="px-3 py-2 text-sm text-xs">{row.doorSetType || "-"}</td>
                
                {/* Dimensions (EDITABLE) */}
                <EditableCell value={row.leafHeight} onChange={(v) => handleCellEdit(row.id, "leafHeight", v)} type="number" />
                <EditableCell value={row.masterLeafWidth} onChange={(v) => handleCellEdit(row.id, "masterLeafWidth", v)} type="number" />
                <EditableCell value={row.slaveLeafWidth} onChange={(v) => handleCellEdit(row.id, "slaveLeafWidth", v)} type="number" />
                <EditableCell value={row.leafThickness} onChange={(v) => handleCellEdit(row.id, "leafThickness", v)} type="number" />
                <EditableCell value={row.leafConfiguration} onChange={(v) => handleCellEdit(row.id, "leafConfiguration", v)} />
                
                {/* Vision panels (EDITABLE) */}
                <EditableCell value={row.visionQtyLeaf1} onChange={(v) => handleCellEdit(row.id, "visionQtyLeaf1", v)} type="number" />
                <EditableCell value={row.totalGlazedAreaMaster} onChange={(v) => handleCellEdit(row.id, "totalGlazedAreaMaster", v)} type="number" step="0.01" />
                
                {/* Finishes (EDITABLE) */}
                <EditableCell value={row.internalColour} onChange={(v) => handleCellEdit(row.id, "internalColour", v)} />
                <EditableCell value={row.externalColour} onChange={(v) => handleCellEdit(row.id, "externalColour", v)} />
                <EditableCell value={row.doorFacing} onChange={(v) => handleCellEdit(row.id, "doorFacing", v)} />
                <EditableCell value={row.lippingFinish} onChange={(v) => handleCellEdit(row.id, "lippingFinish", v)} />
                
                {/* Ironmongery (EDITABLE) */}
                <EditableCell value={row.ironmongeryPackRef} onChange={(v) => handleCellEdit(row.id, "ironmongeryPackRef", v)} />
                
                {/* Pricing (CALCULATED - READONLY) */}
                <td className="px-3 py-2 text-sm text-green-700">
                  {row.labourCost != null ? `£${row.labourCost.toFixed(2)}` : "-"}
                </td>
                <td className="px-3 py-2 text-sm text-green-700">
                  {row.materialCost != null ? `£${row.materialCost.toFixed(2)}` : "-"}
                </td>
                <td className="px-3 py-2 text-sm font-medium text-green-700">
                  {row.unitValue != null ? `£${row.unitValue.toFixed(2)}` : "-"}
                </td>
                <td className="px-3 py-2 text-sm font-semibold text-green-700">
                  {row.lineTotal != null ? `£${row.lineTotal.toFixed(2)}` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold">
            <tr>
              <td colSpan={19} className="px-3 py-2 text-right text-sm">Total Selected:</td>
              <td className="px-3 py-2 text-sm text-green-700">
                £{rows.filter(r => selectedRows.has(r.id)).reduce((sum, r) => sum + (r.lineTotal || 0), 0).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-600 px-4">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-blue-100 border border-blue-300 rounded"></span>
          Data Entry Fields
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-green-100 border border-green-300 rounded"></span>
          Auto-Calculated Fields
        </span>
      </div>
    </div>
  );
}

// Editable cell component
function EditableCell({ 
  value, 
  onChange, 
  type = "text",
  step,
}: { 
  value: string | number | null; 
  onChange: (value: any) => void;
  type?: "text" | "number";
  step?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() || "");

  const handleBlur = () => {
    setEditing(false);
    const parsed = type === "number" ? (draft ? Number(draft) : null) : draft || null;
    onChange(parsed);
  };

  if (editing) {
    return (
      <td className="px-3 py-2">
        <input
          type={type}
          step={step}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleBlur();
            if (e.key === "Escape") {
              setDraft(value?.toString() || "");
              setEditing(false);
            }
          }}
          autoFocus
          className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </td>
    );
  }

  return (
    <td 
      className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50"
      onClick={() => {
        setDraft(value?.toString() || "");
        setEditing(true);
      }}
      title="Click to edit"
    >
      {value != null ? value : <span className="text-gray-400">-</span>}
    </td>
  );
}
