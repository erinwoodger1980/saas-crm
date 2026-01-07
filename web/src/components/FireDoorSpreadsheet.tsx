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

// Define all 223 columns organized into logical groups
const COLUMNS: Column<FireDoorRow>[] = [
  // SECTION 1: CORE IDENTIFICATION (frozen for reference)
  { key: "rowIndex", name: "#", width: 60, frozen: true },
  { key: "doorRef", name: "Door Ref", width: 120, editable: true, frozen: true },
  { key: "location", name: "Location", width: 150, editable: true },
  
  // SECTION 2: BASIC SPECS
  { key: "certification", name: "Certification", width: 120 },
  { key: "doorsetType", name: "Doorset Type", width: 120 },
  { key: "rating", name: "Fire Rating", width: 100 },
  { key: "itemType", name: "Item Type", width: 100 },
  { key: "code", name: "Code", width: 120 },
  { key: "quantity", name: "Qty", width: 70, editable: true },
  
  // SECTION 3: CORE DIMENSIONS
  { key: "lajRef", name: "LAJ Ref", width: 100 },
  { key: "masterWidth", name: "Master Width", width: 110 },
  { key: "slaveWidth", name: "Slave Width", width: 110 },
  { key: "doorHeight", name: "Door Height", width: 110 },
  { key: "core", name: "Core", width: 120 },
  { key: "coreType", name: "Core Type", width: 120 },
  
  // SECTION 4: EDGE DIMENSIONS
  { key: "top", name: "Top Edge", width: 90 },
  { key: "btm", name: "Bottom Edge", width: 100 },
  { key: "hinge", name: "Hinge Edge", width: 100 },
  { key: "me", name: "M/E", width: 80 },
  { key: "daExposed", name: "DA Exposed", width: 100 },
  { key: "trim", name: "Trim", width: 80 },
  { key: "safeHinge", name: "Safe Hinge", width: 100 },
  { key: "pf", name: "PF", width: 70 },
  { key: "extra", name: "Extra", width: 80 },
  
  // SECTION 5: REDUCED DIMENSIONS
  { key: "masterReduced", name: "Master Reduced", width: 130 },
  { key: "slaveWidthReduced", name: "Slave Reduced", width: 130 },
  { key: "doorHeightReduced", name: "Height Reduced", width: 130 },
  { key: "coreReduced", name: "Core Reduced", width: 120 },
  
  // SECTION 6: NOTES
  { key: "notes1", name: "Notes 1", width: 200, editable: true },
  { key: "notes2", name: "Notes 2", width: 200, editable: true },
  
  // SECTION 7: LIPPING
  { key: "lajRefLipping", name: "LAJ Ref (Lipping)", width: 140 },
  { key: "doorRefLipping", name: "Door Ref (Lipping)", width: 150 },
  { key: "masterWidthLipping", name: "Master W (Lipping)", width: 150 },
  { key: "slaveWidthLipping", name: "Slave W (Lipping)", width: 140 },
  { key: "doorHeightLipping", name: "Height (Lipping)", width: 140 },
  { key: "coreLipping", name: "Core (Lipping)", width: 130 },
  { key: "ratingLipping", name: "Rating (Lipping)", width: 130 },
  { key: "coreTypeLipping", name: "Core Type (Lipping)", width: 150 },
  { key: "material", name: "Material", width: 130, editable: true },
  { key: "topLipping", name: "Top (Lipping)", width: 110 },
  { key: "btmLipping", name: "Bottom (Lipping)", width: 120 },
  { key: "hingeLipping", name: "Hinge (Lipping)", width: 120 },
  { key: "meLipping", name: "M/E (Lipping)", width: 110 },
  { key: "daExposedLipping", name: "DA Exp (Lipping)", width: 130 },
  { key: "lippingDetail", name: "Lipping Detail", width: 150, editable: true },
  { key: "masterWidthLipping2", name: "Master W Lipping 2", width: 150 },
  
  // SECTION 8: EDGING / 2T
  { key: "slaveWidthEdging", name: "Slave W (Edging)", width: 140 },
  { key: "doorHeightEdging", name: "Height (Edging)", width: 130 },
  { key: "coreEdging", name: "Core (Edging)", width: 130 },
  { key: "masterWidth2T", name: "Master W (2T)", width: 130 },
  { key: "slaveWidth2T", name: "Slave W (2T)", width: 130 },
  { key: "doorHeight2T", name: "Height (2T)", width: 120 },
  { key: "core2T", name: "Core (2T)", width: 110 },
  { key: "doorType", name: "Door Type", width: 120 },
  { key: "note1Edge", name: "Note 1 (Edge)", width: 150, editable: true },
  { key: "note2Edge", name: "Note 2 (Edge)", width: 150, editable: true },
  
  // SECTION 9: FACING / CALIBRATION
  { key: "lajRefFacing", name: "LAJ Ref (Facing)", width: 140 },
  { key: "doorRefFacing", name: "Door Ref (Facing)", width: 150 },
  { key: "masterWidthFacing", name: "Master W (Facing)", width: 150 },
  { key: "slaveWidthFacing", name: "Slave W (Facing)", width: 140 },
  { key: "doorHeightFacing", name: "Height (Facing)", width: 140 },
  { key: "coreFacing", name: "Core (Facing)", width: 130 },
  { key: "coreTypeFacing", name: "Core Type (Facing)", width: 150 },
  { key: "materialFacing", name: "Material (Facing)", width: 150, editable: true },
  { key: "topFacing", name: "Top (Facing)", width: 110 },
  { key: "btmFacing", name: "Bottom (Facing)", width: 120 },
  { key: "hingeFacing", name: "Hinge (Facing)", width: 120 },
  { key: "meFacing", name: "M/E (Facing)", width: 110 },
  { key: "daExposedFacing", name: "DA Exp (Facing)", width: 130 },
  { key: "calibratedSize", name: "Calibrated Size", width: 140 },
  { key: "masterDoor", name: "Master Door", width: 130 },
  { key: "slaveDoor", name: "Slave Door", width: 120 },
  { key: "bookMatching", name: "Book Matching", width: 130 },
  { key: "chamferRequired", name: "Chamfer Required", width: 140 },
  { key: "notes1Cal", name: "Notes 1 (Cal)", width: 150, editable: true },
  { key: "note2Cal", name: "Notes 2 (Cal)", width: 150, editable: true },
  
  // SECTION 10: FINISH SPECS
  { key: "lajRefFinish", name: "LAJ Ref (Finish)", width: 140 },
  { key: "doorRefFinish", name: "Door Ref (Finish)", width: 150 },
  { key: "masterWidthFinish", name: "Master W (Finish)", width: 150 },
  { key: "slaveWidthFinish", name: "Slave W (Finish)", width: 140 },
  { key: "doorHeightFinish", name: "Height (Finish)", width: 140 },
  { key: "coreFinish", name: "Core (Finish)", width: 130 },
  { key: "coreTypeFinish", name: "Core Type (Finish)", width: 150 },
  { key: "doorFinish", name: "Door Finish", width: 130, editable: true },
  { key: "fireRatingFinish", name: "Fire Rating (Finish)", width: 150 },
  { key: "handingFinish", name: "Handing", width: 110, editable: true },
  { key: "position", name: "Position", width: 110 },
  
  // SECTION 11: PRIMARY IRONMONGERY
  { key: "qtyOfHinges", name: "Qty Hinges", width: 100, editable: true },
  { key: "hingeType", name: "Hinge Type", width: 150, editable: true },
  { key: "groovesForMe", name: "Grooves for M/E", width: 130 },
  { key: "lockType", name: "Lock Type", width: 150, editable: true },
  { key: "spindlePrep", name: "Spindle Prep", width: 120 },
  { key: "cylinderPrep", name: "Cylinder Prep", width: 120 },
  { key: "lockHeight", name: "Lock Height", width: 110, editable: true },
  { key: "flushBolt", name: "Flush Bolt", width: 120 },
  { key: "uc", name: "UC", width: 70 },
  { key: "hingeInt", name: "Hinge Int", width: 100 },
  { key: "lockInt", name: "Lock Int", width: 100 },
  { key: "flushboltInt", name: "Flush Bolt Int", width: 120 },
  
  // SECTION 12: VISION PANELS
  { key: "vpType", name: "VP Type", width: 120 },
  { key: "visionPanelMaster", name: "VP Master", width: 130 },
  { key: "visionPanelSlave", name: "VP Slave", width: 120 },
  { key: "beadType", name: "Bead Type", width: 120 },
  { key: "vpPosition", name: "VP Position", width: 120 },
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
  
  // SECTION 13: ADDITIONAL IRONMONGERY
  { key: "dropseal", name: "Drop Seal", width: 120 },
  { key: "additionalIronmongery1", name: "Additional Iron 1", width: 150, editable: true },
  { key: "additionalIronmongery2", name: "Additional Iron 2", width: 150, editable: true },
  { key: "doorRefSecondary", name: "Door Ref (Secondary)", width: 160 },
  { key: "lockType2", name: "Lock Type 2", width: 130 },
  { key: "spindlePrep2", name: "Spindle Prep 2", width: 130 },
  { key: "cylinderPrep2", name: "Cylinder Prep 2", width: 140 },
  { key: "lockHeight2", name: "Lock Height 2", width: 120 },
  { key: "concealedDoorCloser", name: "Concealed Closer", width: 150 },
  { key: "atgSize", name: "ATG Size", width: 100 },
  { key: "atgPosition", name: "ATG Position", width: 120 },
  { key: "safehingSureclose", name: "Safehing Sureclose", width: 150 },
  { key: "safehingeStandardPivot", name: "Safehing Pivot", width: 150 },
  { key: "safehingeRhinoBolts", name: "Safehing Rhino", width: 140 },
  { key: "doorViewer", name: "Door Viewer", width: 120 },
  { key: "letterbox", name: "Letterbox", width: 120 },
  { key: "flushPulls", name: "Flush Pulls", width: 120 },
  { key: "cableway", name: "Cableway", width: 120 },
  
  // SECTION 14: FINAL SPECS
  { key: "lajRefFinal", name: "LAJ Ref (Final)", width: 130 },
  { key: "doorRefFinal", name: "Door Ref (Final)", width: 140 },
  { key: "master", name: "Master (Final)", width: 130 },
  { key: "slave", name: "Slave (Final)", width: 120 },
  { key: "height", name: "Height (Final)", width: 120 },
  { key: "coreFinal", name: "Core (Final)", width: 120 },
  { key: "fireRatingFinal", name: "Fire Rating (Final)", width: 150 },
  { key: "doorFinishFinal", name: "Door Finish (Final)", width: 150 },
  { key: "fireSealsInMe", name: "Fire Seals in M/E", width: 140 },
  
  // SECTION 15: GLAZING SYSTEM
  { key: "glazingSystem", name: "Glazing System", width: 140 },
  { key: "vpSize", name: "VP Size", width: 110 },
  { key: "glassType", name: "Glass Type", width: 140, editable: true },
  { key: "cassetteType", name: "Cassette Type", width: 140 },
  { key: "totalGlazedAreaMaster", name: "Glazed Area", width: 140 },
  { key: "fanlightSidelightGlz", name: "Fanlight/Side Glz", width: 150 },
  { key: "glazingTape", name: "Glazing Tape", width: 120 },
  { key: "dropSeal", name: "Drop Seal", width: 110 },
  
  // SECTION 16: FINAL IRONMONGERY
  { key: "hinges", name: "Hinges (Final)", width: 130 },
  { key: "handingFinal", name: "Handing (Final)", width: 130 },
  { key: "lock", name: "Lock (Final)", width: 130 },
  { key: "lockHeightOnDoor", name: "Lock Height on Door", width: 150 },
  { key: "keep", name: "Keep", width: 100 },
  { key: "flushBolts", name: "Flush Bolts (Final)", width: 140 },
  { key: "fittedInFrame", name: "Fitted in Frame", width: 140 },
  { key: "hingeLockFlushboltIntum", name: "Hinge/Lock/FB Intum", width: 160 },
  { key: "qMarkPlug", name: "Q-Mark Plug", width: 120 },
  
  // SECTION 17: LEAF SPECS
  { key: "leafHeight", name: "Leaf Height", width: 110, editable: true },
  { key: "masterLeafWidth", name: "Master Leaf Width", width: 140, editable: true },
  { key: "slaveLeafWidth", name: "Slave Leaf Width", width: 140, editable: true },
  { key: "leafThickness", name: "Leaf Thickness", width: 120, editable: true },
  { key: "leafConfiguration", name: "Leaf Configuration", width: 150, editable: true },
  { key: "ifSplitMasterSize", name: "If Split Master Size", width: 150 },
  
  // SECTION 18: FINISH & COLOURS
  { key: "acousticRatingDb", name: "Acoustic (dB)", width: 120, editable: true },
  { key: "internalColour", name: "Internal Colour", width: 140, editable: true },
  { key: "externalColour", name: "External Colour", width: 140, editable: true },
  { key: "frameFinish", name: "Frame Finish", width: 130, editable: true },
  { key: "doorFinishSide1", name: "Finish Side 1", width: 130, editable: true },
  { key: "doorFinishSide2", name: "Finish Side 2", width: 130, editable: true },
  { key: "doorFacing", name: "Door Facing", width: 120, editable: true },
  { key: "lippingFinish", name: "Lipping Finish", width: 130, editable: true },
  
  // SECTION 19: EDGE PROTECTION & UNDERCUT
  { key: "doorEdgeProtType", name: "Edge Prot Type", width: 140 },
  { key: "doorEdgeProtPos", name: "Edge Prot Pos", width: 130 },
  { key: "doorUndercut", name: "Undercut", width: 100 },
  { key: "doorUndercutMm", name: "Undercut (mm)", width: 120, editable: true },
  
  // SECTION 20: ADDITIONAL FEATURES
  { key: "ironmongeryPackRef", name: "Ironmongery Ref", width: 150, editable: true },
  { key: "closerOrFloorSpring", name: "Closer/Spring", width: 140, editable: true },
  { key: "spindleFacePrep", name: "Spindle Face Prep", width: 140 },
  { key: "cylinderFacePrep", name: "Cylinder Face Prep", width: 150 },
  { key: "flushBoltSupplyPrep", name: "Flush Bolt Prep", width: 140 },
  { key: "flushBoltQty", name: "Flush Bolt Qty", width: 120, editable: true },
  { key: "fingerProtection", name: "Finger Protection", width: 140 },
  { key: "fireSignage", name: "Fire Signage", width: 120 },
  { key: "fireSignageQty", name: "Signage Qty", width: 110, editable: true },
  { key: "fireSignageFactoryFit", name: "Signage Factory Fit", width: 160 },
  { key: "fireIdDisc", name: "Fire ID Disc", width: 120 },
  { key: "fireIdDiscQty", name: "ID Disc Qty", width: 110, editable: true },
  { key: "doorViewerPosition", name: "Viewer Position", width: 140 },
  { key: "doorViewerPrepSize", name: "Viewer Prep Size", width: 140 },
  { key: "doorChain", name: "Door Chain", width: 110 },
  { key: "doorViewersQty", name: "Viewers Qty", width: 110, editable: true },
  { key: "doorChainFactoryFit", name: "Chain Factory Fit", width: 150 },
  { key: "doorViewersFactoryFit", name: "Viewers Factory Fit", width: 160 },
  { key: "additionNote1", name: "Additional Note", width: 200, editable: true },
  { key: "additionNote1Qty", name: "Note Qty", width: 100, editable: true },
  
  // SECTION 21: CNC & CALCULATED FIELDS
  { key: "cncBlankWidth", name: "CNC Blank Width", width: 140 },
  { key: "cncBlankHeight", name: "CNC Blank Height", width: 140 },
  { key: "cncTrimWidth", name: "CNC Trim Width", width: 130 },
  { key: "cncTrimHeight", name: "CNC Trim Height", width: 130 },
  { key: "totalLinearMeters", name: "Total Linear M", width: 130 },
  { key: "totalSquareMeters", name: "Total Square M", width: 130 },
  { key: "lippingLinearMeters", name: "Lipping Linear M", width: 140 },
  { key: "facingSquareMeters", name: "Facing Square M", width: 140 },
  { key: "fullReference", name: "Full Reference", width: 150 },
  { key: "calculatedField1", name: "Calculated 1", width: 130 },
  { key: "calculatedField2", name: "Calculated 2", width: 130 },
  { key: "calculatedField3", name: "Calculated 3", width: 130 },
  { key: "calculatedField4", name: "Calculated 4", width: 130 },
  { key: "calculatedField5", name: "Calculated 5", width: 130 },
  
  // SECTION 22: PRICING (frozen on right)
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
