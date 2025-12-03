"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import DataGrid, { Column, SelectColumn } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import { Button } from "@/components/ui/button";

interface FireDoorRow {
  id: string;
  rowIndex: number;
  itemType: string | null;
  code: string | null;
  quantity: number | null;
  doorRef: string | null;
  location: string | null;
  doorSetType: string | null;
  rating: string | null;
  acousticRatingDb: number | null;
  internalColour: string | null;
  externalColour: string | null;
  frameFinish: string | null;
  leafHeight: number | null;
  masterLeafWidth: number | null;
  slaveLeafWidth: number | null;
  leafThickness: number | null;
  leafConfiguration: string | null;
  ifSplitMasterSize: string | null;
  doorFinishSide1: string | null;
  doorFinishSide2: string | null;
  doorFacing: string | null;
  lippingFinish: string | null;
  doorEdgeProtType: string | null;
  doorEdgeProtPos: string | null;
  doorUndercut: string | null;
  doorUndercutMm: number | null;
  visionQtyLeaf1: number | null;
  vp1WidthLeaf1: number | null;
  vp1HeightLeaf1: number | null;
  vp2WidthLeaf1: number | null;
  vp2HeightLeaf1: number | null;
  visionQtyLeaf2: number | null;
  vp1WidthLeaf2: number | null;
  vp1HeightLeaf2: number | null;
  vp2WidthLeaf2: number | null;
  vp2HeightLeaf2: number | null;
  totalGlazedAreaMaster: number | null;
  fanlightSidelightGlz: string | null;
  glazingTape: string | null;
  ironmongeryPackRef: string | null;
  closerOrFloorSpring: string | null;
  spindleFacePrep: string | null;
  cylinderFacePrep: string | null;
  flushBoltSupplyPrep: string | null;
  flushBoltQty: number | null;
  fingerProtection: string | null;
  fireSignage: string | null;
  fireSignageQty: number | null;
  fireSignageFactoryFit: string | null;
  fireIdDisc: string | null;
  fireIdDiscQty: number | null;
  doorViewer: string | null;
  doorViewerPosition: string | null;
  doorViewerPrepSize: string | null;
  doorChain: string | null;
  doorViewersQty: number | null;
  doorChainFactoryFit: string | null;
  doorViewersFactoryFit: string | null;
  additionNote1: string | null;
  additionNote1Qty: number | null;
  unitValue: number | null;
  labourCost: number | null;
  materialCost: number | null;
  lineTotal: number | null;
  [key: string]: any;
}

interface FireDoorSpreadsheetProps {
  importId?: string;
  onQuoteCreated?: (quoteId: string) => void;
}

// Define all 144 columns for the fire door spreadsheet
const COLUMNS: Column<FireDoorRow>[] = [
  { key: "rowIndex", name: "#", width: 60, frozen: true },
  { key: "itemType", name: "Item Type", width: 100 },
  { key: "code", name: "Code", width: 120 },
  { key: "quantity", name: "Qty", width: 70, editable: true },
  { key: "doorRef", name: "Door Ref", width: 120, editable: true },
  { key: "location", name: "Location", width: 150, editable: true },
  { key: "doorSetType", name: "Doorset Type", width: 120 },
  { key: "rating", name: "Fire Rating", width: 100 },
  { key: "acousticRatingDb", name: "Acoustic (dB)", width: 110, editable: true },
  { key: "internalColour", name: "Internal Colour", width: 140, editable: true },
  { key: "externalColour", name: "External Colour", width: 140, editable: true },
  { key: "frameFinish", name: "Frame Finish", width: 130, editable: true },
  { key: "leafHeight", name: "Leaf Height", width: 110, editable: true },
  { key: "masterLeafWidth", name: "Master Width", width: 120, editable: true },
  { key: "slaveLeafWidth", name: "Slave Width", width: 110, editable: true },
  { key: "leafThickness", name: "Thickness", width: 100, editable: true },
  { key: "leafConfiguration", name: "Configuration", width: 130, editable: true },
  { key: "ifSplitMasterSize", name: "Split Master", width: 110 },
  { key: "doorFinishSide1", name: "Finish Side 1", width: 130, editable: true },
  { key: "doorFinishSide2", name: "Finish Side 2", width: 130, editable: true },
  { key: "doorFacing", name: "Door Facing", width: 120, editable: true },
  { key: "lippingFinish", name: "Lipping Finish", width: 130, editable: true },
  { key: "doorEdgeProtType", name: "Edge Prot Type", width: 140 },
  { key: "doorEdgeProtPos", name: "Edge Prot Pos", width: 130 },
  { key: "doorUndercut", name: "Undercut", width: 100 },
  { key: "doorUndercutMm", name: "Undercut (mm)", width: 120, editable: true },
  { key: "visionQtyLeaf1", name: "Vision Qty L1", width: 120, editable: true },
  { key: "vp1WidthLeaf1", name: "VP1 W L1", width: 100, editable: true },
  { key: "vp1HeightLeaf1", name: "VP1 H L1", width: 100, editable: true },
  { key: "vp2WidthLeaf1", name: "VP2 W L1", width: 100, editable: true },
  { key: "vp2HeightLeaf1", name: "VP2 H L1", width: 100, editable: true },
  { key: "visionQtyLeaf2", name: "Vision Qty L2", width: 120, editable: true },
  { key: "vp1WidthLeaf2", name: "VP1 W L2", width: 100, editable: true },
  { key: "vp1HeightLeaf2", name: "VP1 H L2", width: 100, editable: true },
  { key: "vp2WidthLeaf2", name: "VP2 W L2", width: 100, editable: true },
  { key: "vp2HeightLeaf2", name: "VP2 H L2", width: 100, editable: true },
  { key: "totalGlazedAreaMaster", name: "Glazed Area", width: 120 },
  { key: "fanlightSidelightGlz", name: "Fanlight/Side Glz", width: 150 },
  { key: "glazingTape", name: "Glazing Tape", width: 120 },
  { key: "ironmongeryPackRef", name: "Ironmongery Ref", width: 150, editable: true },
  { key: "closerOrFloorSpring", name: "Closer/Spring", width: 140, editable: true },
  { key: "spindleFacePrep", name: "Spindle Prep", width: 120 },
  { key: "cylinderFacePrep", name: "Cylinder Prep", width: 120 },
  { key: "flushBoltSupplyPrep", name: "Flush Bolt Prep", width: 140 },
  { key: "flushBoltQty", name: "Flush Bolt Qty", width: 120, editable: true },
  { key: "fingerProtection", name: "Finger Prot", width: 120 },
  { key: "fireSignage", name: "Fire Signage", width: 120 },
  { key: "fireSignageQty", name: "Signage Qty", width: 110, editable: true },
  { key: "fireSignageFactoryFit", name: "Signage Factory", width: 140 },
  { key: "fireIdDisc", name: "Fire ID Disc", width: 120 },
  { key: "fireIdDiscQty", name: "ID Disc Qty", width: 110, editable: true },
  { key: "doorViewer", name: "Door Viewer", width: 120 },
  { key: "doorViewerPosition", name: "Viewer Pos", width: 110 },
  { key: "doorViewerPrepSize", name: "Viewer Size", width: 110 },
  { key: "doorChain", name: "Door Chain", width: 110 },
  { key: "doorViewersQty", name: "Viewers Qty", width: 110, editable: true },
  { key: "doorChainFactoryFit", name: "Chain Factory", width: 130 },
  { key: "doorViewersFactoryFit", name: "Viewers Factory", width: 140 },
  { key: "additionNote1", name: "Additional Note", width: 200, editable: true },
  { key: "additionNote1Qty", name: "Note Qty", width: 100, editable: true },
  { key: "labourCost", name: "Labour £", width: 100, cellClass: "font-semibold text-green-700" },
  { key: "materialCost", name: "Materials £", width: 110, cellClass: "font-semibold text-green-700" },
  { key: "unitValue", name: "Unit Price £", width: 120, cellClass: "font-semibold text-green-700" },
  { key: "lineTotal", name: "Line Total £", width: 120, frozen: true, cellClass: "font-bold text-green-700" },
];

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

  const handleRowsChange = useCallback((newRows: FireDoorRow[]) => {
    setRows(newRows);
  }, []);

  const columns = useMemo((): readonly Column<FireDoorRow>[] => {
    return [
      SelectColumn,
      ...COLUMNS.map(col => ({
        ...col,
        renderCell: (props: any) => {
          const value = props.row[col.key];
          if (value === null || value === undefined) return <div className="px-2">-</div>;
          
          // Format currency columns
          if (['labourCost', 'materialCost', 'unitValue', 'lineTotal'].includes(col.key)) {
            return <div className="px-2 font-semibold text-green-700">£{Number(value).toFixed(2)}</div>;
          }
          
          return <div className="px-2">{value}</div>;
        },
      })),
    ];
  }, []);

  const selectedRowsSet = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(row => {
      if (selectedRows.has(row.id)) {
        set.add(row.id);
      }
    });
    return set;
  }, [selectedRows, rows]);

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
    return <div className="p-4 text-center text-gray-500">Select an import in the Project Overview tab to view line items.</div>;
  }

  if (rows.length === 0) {
    return <div className="p-4 text-center text-gray-500">No doors found in this import</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white/60 backdrop-blur-sm p-4 rounded-lg shadow border border-white/20">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-slate-700">
            {selectedRows.size} of {rows.length} doors selected
          </span>
        </div>
        <Button
          onClick={createQuoteFromSelected}
          disabled={creatingQuote || selectedRows.size === 0}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          {creatingQuote ? "Creating..." : `Create Quote (${selectedRows.size} doors)`}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* DataGrid with 144 columns */}
      <div className="h-[600px] bg-white rounded-lg shadow border border-white/20">
        <DataGrid
          columns={columns}
          rows={rows}
          rowKeyGetter={(row) => row.id}
          selectedRows={selectedRowsSet}
          onSelectedRowsChange={setSelectedRows}
          onRowsChange={handleRowsChange}
          className="fill-grid"
          style={{ height: '100%' }}
          rowHeight={35}
          headerRowHeight={40}
          enableVirtualization
        />
      </div>

      {/* Summary */}
      <div className="bg-white/60 backdrop-blur-sm p-4 rounded-lg shadow border border-white/20">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-700">Total Selected:</span>
          <span className="text-lg font-bold text-green-700">
            £{rows.filter(r => selectedRows.has(r.id)).reduce((sum, r) => sum + (Number(r.lineTotal) || 0), 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
