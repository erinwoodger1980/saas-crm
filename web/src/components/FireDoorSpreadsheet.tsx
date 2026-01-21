"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import DataGrid, { Column, SelectColumn, RenderEditCellProps } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { Settings, Download, MessageSquare } from "lucide-react";
import { ColumnHeaderModal } from "@/components/FireDoorGridConfig";
import { RfiDialog } from "@/components/rfi-dialog";

type RfiRecord = {
  id: string;
  rowId: string | null;
  columnKey: string;
  title?: string | null;
  message: string;
  status: string;
  visibleToClient: boolean;
};

function DefaultEditCell({
  row,
  column,
  onRowChange,
  onClose,
  inputType,
}: RenderEditCellProps<FireDoorRow> & { inputType?: string }) {
  const initial = row[column.key];
  const [draft, setDraft] = useState<string>(initial == null ? "" : String(initial));

  useEffect(() => {
    const next = row[column.key];
    setDraft(next == null ? "" : String(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, column.key]);

  const commit = useCallback(() => {
    const trimmed = draft;
    let nextValue: any = trimmed;
    if (!trimmed) nextValue = null;
    if (inputType === "number") {
      if (!trimmed) {
        nextValue = null;
      } else {
        const n = Number(trimmed);
        nextValue = Number.isFinite(n) ? n : null;
      }
    }
    onRowChange({ ...row, [column.key]: nextValue }, true);
    try {
      (onClose as any)?.(true);
    } catch {
      // ignore
    }
  }, [draft, inputType, onRowChange, row, column.key, onClose]);

  return (
    <input
      className="w-full h-full px-2 border-0 outline-none bg-white"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Tab") {
          // react-data-grid may close the editor on Tab before blur fires.
          // Commit here so tabbing behaves like clicking out.
          commit();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          try {
            (onClose as any)?.(false);
          } catch {
            // ignore
          }
        }
      }}
      autoFocus
    />
  );
}

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
  onComponentCreated?: () => void;
}

function normalizeHeaderKey(input: string): string {
  return String(input || "")
    .toLowerCase()
    .replace(/\u00a0/g, " ") // nbsp
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*-\s*/g, "-")
    .trim();
}

function maybeParseNumber(value: any): any {
  if (typeof value !== "string") return value;
  const v = value.trim();
  if (!v) return value;
  // Basic numeric coercion for formula support (keeps non-numeric strings as-is)
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return value;
}

function hydrateImportRow(item: any, columns: ReadonlyArray<Column<any>>): any {
  const row: any = { ...(item || {}) };
  const raw = item?.rawRowJson && typeof item.rawRowJson === "object" ? item.rawRowJson : {};

  // Persisted edits for non-DB columns are stored here (keyed by grid column key)
  const persistedGrid = (raw && typeof raw === "object" && (raw as any).__grid && typeof (raw as any).__grid === "object")
    ? (raw as any).__grid
    : {};

  // Keep persisted grid metadata around for UI logic (e.g. formula override flags)
  row.__gridMeta = persistedGrid;

  const rawByNorm = new Map<string, any>();
  for (const [k, v] of Object.entries(raw)) {
    rawByNorm.set(normalizeHeaderKey(k), v);
  }

  // Map grid column keys (UI) to stored DB keys when they differ.
  const alias: Record<string, string> = {
    doorsetLeafFrame: "doorsetType",
    acousticRating: "acousticRatingDb",
    fanlightSidelightGlazing: "fanlightSidelightGlz",
    doorEdgeProtPosition: "doorEdgeProtPos",
    visionPanelQtyLeaf1: "visionQtyLeaf1",
    visionPanelQtyLeaf2: "visionQtyLeaf2",
    leaf1Aperture1Width: "vp1WidthLeaf1",
    leaf1Aperture1Height: "vp1HeightLeaf1",
    leaf1Aperture2Width: "vp2WidthLeaf1",
    leaf1Aperture2Height: "vp2HeightLeaf1",
    leaf2Aperture1Width: "vp1WidthLeaf2",
    leaf2Aperture1Height: "vp1HeightLeaf2",
    leaf2Aperture2Width: "vp2WidthLeaf2",
    leaf2Aperture2Height: "vp2HeightLeaf2",
    addition1: "additionNote1",
    addition1Qty: "additionNote1Qty",
    closersFloorsprings: "closerOrFloorSpring",
    closerType: "closerOrFloorSpring",
    mLeafWidth: "masterLeafWidth",
    sLeafWidth: "slaveLeafWidth",
    priceEa: "unitValue",
    linePrice: "lineTotal",
  };

  for (const col of columns) {
    const key = (col as any)?.key;
    if (!key || typeof key !== "string") continue;

    // 0) Apply persisted grid overrides (take precedence)
    if (Object.prototype.hasOwnProperty.call(persistedGrid, key)) {
      row[key] = persistedGrid[key];
    }

    // 1) Alias from DB field
    if ((row[key] === undefined || row[key] === null) && alias[key] && row[alias[key]] != null) {
      row[key] = row[alias[key]];
    }

    // 2) Fall back to raw CSV value by matching the displayed header name
    const colName = typeof (col as any)?.name === "string" ? (col as any).name : "";
    if ((row[key] === undefined || row[key] === null) && colName) {
      const rawVal = rawByNorm.get(normalizeHeaderKey(colName));
      if (rawVal !== undefined) {
        row[key] = maybeParseNumber(rawVal);
      }
    }

    // 3) Ensure the field exists for consistent grid behavior
    if (row[key] === undefined) row[key] = null;
  }

  return row;
}

function getFormulaOverrideFlag(row: any, colKey: string): boolean {
  const meta = row && typeof row === "object" ? (row as any).__gridMeta : null;
  const k = `__override:${colKey}`;
  return !!(meta && typeof meta === "object" && (meta as any)[k]);
}

function setFormulaOverrideFlag(row: any, colKey: string, value: boolean | null) {
  if (!row || typeof row !== "object") return;
  const k = `__override:${colKey}`;
  const meta =
    (row as any).__gridMeta && typeof (row as any).__gridMeta === "object"
      ? { ...(row as any).__gridMeta }
      : {};

  if (value === null) {
    delete (meta as any)[k];
  } else {
    (meta as any)[k] = value;
  }
  (row as any).__gridMeta = meta;
}

// Define all columns matching the exact order and names provided (223 columns total)
const COLUMNS: Column<FireDoorRow>[] = [
  { key: "rowIndex", name: "#", width: 60, frozen: true },
  { key: "sequence", name: "Sequence", width: 100, editable: true },
  { key: "batchPhase", name: "Batch / Phase", width: 120, editable: true },
  { key: "doorRef", name: "Door Ref", width: 120, editable: true, frozen: true },
  { key: "location", name: "Location", width: 150, editable: true },
  { key: "doorsetLeafFrame", name: "Doorset / Leaf  / Frame", width: 160, editable: true },
  { key: "type", name: "Type", width: 100, editable: true },
  { key: "quantity", name: "Quantity", width: 90, editable: true },
  { key: "rating", name: "Fire Rating", width: 110, editable: true },
  { key: "acousticRating", name: "Acoustic Rating", width: 130, editable: true },
  { key: "bottomSealReq", name: "Bottom Seal Requirement", width: 180, editable: true },
  { key: "bottomSealType", name: "Bottom Seal Type", width: 150, editable: true },
  { key: "leadLiningCode", name: "Lead Lining Code", width: 140, editable: true },
  { key: "numLeavesIncOverpanel", name: "Number of Leaves inc solid overpanel", width: 260, editable: true },
  { key: "leafConfiguration", name: "Leaf Configuration", width: 150, editable: true },
  { key: "ifSplitMasterSize", name: "If split, Master leaf size", width: 180, editable: true },
  { key: "action", name: "Action", width: 100, editable: true },
  { key: "handing", name: "Handing", width: 100, editable: true },
  { key: "hingeSupplyType", name: "Hinge Supply Type", width: 150, editable: true },
  { key: "hingeQty", name: "Hinge Qty", width: 100, editable: true },
  { key: "hingeType", name: "Hinge Type", width: 120, editable: true },
  { key: "hingeConfiguration", name: "Hinge Configuration", width: 160, editable: true },
  { key: "lockPrep", name: "Lock Prep", width: 120, editable: true },
  { key: "lockSupplyType", name: "Lock Supply Type", width: 150, editable: true },
  { key: "lockType1", name: "Lock Type 1", width: 140, editable: true },
  { key: "lockHeight", name: "Lock Height", width: 120, editable: true },
  { key: "spindleFacePrep", name: "Spindle face prep", width: 150, editable: true },
  { key: "cylinderFacePrep", name: "Cylinder Face Prep", width: 160, editable: true },
  { key: "lockType2", name: "Lock Type 2", width: 140, editable: true },
  { key: "lockHeight2", name: "Lock Height 2", width: 130, editable: true },
  { key: "spindleFacePrep2", name: "Spindle face prep - Lock 2", width: 190, editable: true },
  { key: "cylinderFacePrep2", name: "Cylinder Face Prep - Lock 2", width: 200, editable: true },
  { key: "flushBoltSupplyPrep", name: "Flush Bolt Supply/prep", width: 170, editable: true },
  { key: "flushBoltQty", name: "Flush bolt qty", width: 130, editable: true },
  { key: "leversHandles", name: "Levers & pull handles", width: 170, editable: true },
  { key: "escutcheons", name: "Escutcheons/bathroom turn", width: 190, editable: true },
  { key: "cylinderLock1", name: "Cylinder Lock 1", width: 140, editable: true },
  { key: "cylinderLock2", name: "Cylinder lock 2", width: 140, editable: true },
  { key: "fingerPlates", name: "Finger Plates", width: 130, editable: true },
  { key: "kickPlates", name: "Kick Plates", width: 120, editable: true },
  { key: "kickPlatePosition", name: "Kick plate position", width: 160, editable: true },
  { key: "bumpPlate", name: "Bump Plate", width: 120, editable: true },
  { key: "fireSignage", name: "Fire Signage", width: 130, editable: true },
  { key: "additionalSignage", name: "Additional signage", width: 150, editable: true },
  { key: "letterPlate", name: "Letter Plate", width: 120, editable: true },
  { key: "letterPlatePosition", name: "Letter plate position", width: 170, editable: true },
  { key: "doorViewer", name: "Door viewer", width: 120, editable: true },
  { key: "doorViewerPosition", name: "Door viewer position", width: 170, editable: true },
  { key: "doorViewerPrepSize", name: "Door viewer hole prep size", width: 200, editable: true },
  { key: "doorChain", name: "Door Chain", width: 120, editable: true },
  { key: "fingerProtection", name: "Finger Protection", width: 150, editable: true },
  { key: "fireIdDisc", name: "Fire ID Disc", width: 130, editable: true },
  { key: "factoryFitHinges", name: "Factory Fit Hinges", width: 160, editable: true },
  { key: "factoryFitLocks", name: "Factory Fit Locks", width: 160, editable: true },
  { key: "factoryFitFlushBolts", name: "Factory Fit Flush Bolts", width: 180, editable: true },
  { key: "ironmongeryPackRef", name: "Ironmongery Pack REF", width: 170, editable: true },
  { key: "comments", name: "Comments", width: 200, editable: true },
  { key: "closerType", name: "Closer type", width: 130, editable: true },
  { key: "closersFloorsprings", name: "Closers/floorsprings", width: 170, editable: true },
  { key: "antiBarricade", name: "anti barricade / emergency stop", width: 220, editable: true },
  { key: "wiringPrep", name: "Wiring prep", width: 130, editable: true },
  { key: "cableLoop", name: "Cable loop", width: 120, editable: true },
  { key: "addition1", name: "Addition 1 / Note 1", width: 170, editable: true },
  { key: "addition1Qty", name: "Addition 1 Qty", width: 140, editable: true },
  { key: "addition2", name: "Addition 2 / Note 2", width: 170, editable: true },
  { key: "addition2Qty", name: "Addition 2 Qty", width: 140, editable: true },
  { key: "addition3", name: "Addition 3 / Note 3", width: 170, editable: true },
  { key: "addition3Qty", name: "Addition 3 Qty", width: 140, editable: true },
  { key: "soWidth", name: "S/O Width", width: 110, editable: true },
  { key: "soHeight", name: "S/O Height", width: 110, editable: true },
  { key: "soWallThickness", name: "S/O Wall thickness", width: 160, editable: true },
  { key: "extensionMaterial", name: "Extension Material", width: 160, editable: true },
  { key: "extensionLiningWidthVisible", name: "Extension lining width visible", width: 220, editable: true },
  { key: "extensionLiningWidthActual", name: "Extension lining width actual size", width: 240, editable: true },
  { key: "overpanelDetails", name: "Overpanel details", width: 160, editable: true },
  { key: "screenDetails", name: "Screen details", width: 150, editable: true },
  { key: "fanlightOverpanelQty", name: "Fanlight / Overpanel Qty", width: 190, editable: true },
  { key: "fanlightFrameThickness", name: "Fanlight Frame Thickness (Production)", width: 260, editable: true },
  { key: "fanlightOverpanelHeight", name: "Fanlight / Overpanel height", width: 200, editable: true },
  { key: "fanlightOverpanelWidth", name: "Fanlight / Overpanel Width", width: 200, editable: true },
  { key: "numSidelight1", name: "Number of Sidelight 1", width: 180, editable: true },
  { key: "sidelight1Width", name: "Sidelight 1 Width", width: 150, editable: true },
  { key: "sidelight1Height", name: "Sidelight 1 Height", width: 160, editable: true },
  { key: "numSidelight2", name: "Number of Sidelight 2", width: 180, editable: true },
  { key: "sidelight2Width", name: "Sidelight 2 Width", width: 150, editable: true },
  { key: "sidelight2Height", name: "Sidelight 2 Height", width: 160, editable: true },
  { key: "numSidelight3", name: "Number of Sidelight 3", width: 180, editable: true },
  { key: "sidelight3Width", name: "Sidelight 3 Width", width: 150, editable: true },
  { key: "sidelight3Height", name: "Sidelight 3 Height", width: 160, editable: true },
  { key: "numSidelight4", name: "Number of Sidelight 4", width: 180, editable: true },
  { key: "sidelight4Width", name: "Sidelight 4 Width", width: 150, editable: true },
  { key: "sidelight4Height", name: "Sidelight 4 Height", width: 160, editable: true },
  { key: "fanlightSidelightGlazing", name: "Fanlight / Sidelight Glazing", width: 200, editable: true },
  { key: "ofWidthDoorset", name: "O/F Width (doorset)", width: 160, editable: true },
  { key: "ofHeightDoorset", name: "O/F Height (doorset)", width: 170, editable: true },
  { key: "frameThickness", name: "Frame Thickness", width: 150, editable: true },
  { key: "frameMaterial", name: "Frame Material", width: 150, editable: true },
  { key: "frameMaterialProduction", name: "Frame Material (Production)", width: 210, editable: true },
  { key: "liningThicknessJambs", name: "Lining Thickness - Jambs", width: 190, editable: true },
  { key: "jambProfileHanging", name: "Jamb Profile - Hanging Edge", width: 210, editable: true },
  { key: "jambProfileLeading", name: "Jamb Profile - Leading Edge Edge", width: 240, editable: true },
  { key: "liningThicknessHeads", name: "Lining Thickness - Heads", width: 190, editable: true },
  { key: "frameFinish", name: "Frame Finish", width: 140, editable: true },
  { key: "frameType", name: "Frame Type", width: 130, editable: true },
  { key: "stopMaterial", name: "Stop Material", width: 140, editable: true },
  { key: "stopMaterialProduction", name: "Stop Material (Production)", width: 210, editable: true },
  { key: "rebateStopWidth", name: "Rebate / Stop Width", width: 170, editable: true },
  { key: "rebateStopDepth", name: "Rebate / Stop Depth", width: 170, editable: true },
  { key: "arcMaterial", name: "Arc Material", width: 140, editable: true },
  { key: "arcDetail", name: "Arc Detail", width: 130, editable: true },
  { key: "arcWidth", name: "Arc Width", width: 110, editable: true },
  { key: "arcDepth", name: "Arc Depth", width: 110, editable: true },
  { key: "mLeafWidth", name: "M Leaf Width", width: 130, editable: true },
  { key: "sLeafWidth", name: "S Leaf Width", width: 130, editable: true },
  { key: "leafHeight", name: "Leaf Height", width: 120, editable: true },
  { key: "leafThickness", name: "Leaf Thickness", width: 140, editable: true },
  { key: "coreType", name: "Core Type", width: 130, editable: true },
  { key: "leafStyle", name: "Leaf Style", width: 130, editable: true },
  { key: "visionPanelQtyLeaf1", name: "Vision Panel Qty, Leaf 1", width: 190, editable: true },
  { key: "leaf1Aperture1Width", name: "Leaf Aperture 1 Width", width: 180, editable: true },
  { key: "leaf1Aperture1Height", name: "Leaf Aperture 1 Height", width: 190, editable: true },
  { key: "leaf1Aperture1WidthProduction", name: "Leaf Aperture 1 Width (Production)", width: 260, editable: true },
  { key: "leaf1Aperture1HeightProduction", name: "Leaf Aperture 1 Height (Production)", width: 270, editable: true },
  { key: "aperturePosition1", name: "Aperture Position 1", width: 170, editable: true },
  { key: "leaf1Aperture2Width", name: "Leaf 1 Aperture 2 Width", width: 190, editable: true },
  { key: "leaf1Aperture2Height", name: "Leaf 1 Aperture 2 Height", width: 200, editable: true },
  { key: "leaf1Aperture2WidthProduction", name: "Leaf 1 Aperture 2 Width (Production)", width: 270, editable: true },
  { key: "leaf1Aperture2HeightProduction", name: "Leaf 1 Aperture 2 Height (Production)", width: 280, editable: true },
  { key: "aperturePosition2", name: "Aperture Position 2", width: 170, editable: true },
  { key: "airTransferGrilleReq", name: "Air Transfer grille requirement", width: 230, editable: true },
  { key: "airTransferGrilleQty", name: "Air Transfer Grille Qty", width: 190, editable: true },
  { key: "airTransferGrilleSize", name: "Air Transfer grille Size", width: 190, editable: true },
  { key: "airTransferGrillePosition", name: "Air Transfer grille Position", width: 220, editable: true },
  { key: "visionPanelQtyLeaf2", name: "Vision Panel Qty, Leaf 2", width: 190, editable: true },
  { key: "leaf2Aperture1Width", name: "Leaf 2 Cutout Aperture 1 Width", width: 240, editable: true },
  { key: "leaf2Aperture1Height", name: "Leaf 2 Cutout Aperture 1 Height", width: 250, editable: true },
  { key: "leaf2Aperture1WidthProduction", name: "Leaf 2 Aperture 1 Width (Production)", width: 280, editable: true },
  { key: "leaf2Aperture1HeightProduction", name: "Leaf 2 Aperture 1 Height (Production)", width: 290, editable: true },
  { key: "leaf2Aperture2Width", name: "Leaf 2 Cutout Aperture 2 Width", width: 240, editable: true },
  { key: "leaf2Aperture2Height", name: "Leaf 2 Cutout Aperture 2 Height", width: 250, editable: true },
  { key: "leaf2Aperture2WidthProduction", name: "Leaf 2 Aperture 2 Width (Production)", width: 280, editable: true },
  { key: "leaf2Aperture2HeightProduction", name: "Leaf 2 Aperture 2 Height (Production)", width: 290, editable: true },
  { key: "visionPanelSizeDetail", name: "Vision Panel Size Detail", width: 200, editable: true },
  { key: "tempGlassCheck", name: "Temp Glass Check", width: 160, editable: true },
  { key: "glassConcat", name: "Glass Concat", width: 140, editable: true },
  { key: "glassType", name: "Glass Type", width: 130, editable: true },
  { key: "beadType", name: "Bead Type", width: 130, editable: true },
  { key: "beadMaterial", name: "Bead Material", width: 140, editable: true },
  { key: "beadMaterialProduction", name: "Bead Material (Production)", width: 210, editable: true },
  { key: "totalGlazedAreaMaster", name: "Total Glazed Area Master Leaf (msq)", width: 270, editable: true },
  { key: "glazingTape", name: "Glazing Tape", width: 140, editable: true },
  { key: "maxPermittedGlazedArea", name: "Max Permitted Glazed Area (Based on Strebord)", width: 320, editable: true },
  { key: "doorFacing", name: "Door Facing", width: 140, editable: true },
  { key: "doorFinishSide1", name: "Door Finish - Side 1 (Push)", width: 210, editable: true },
  { key: "doorFinishSide2", name: "Door Finish - Side 2 (Pull)", width: 210, editable: true },
  { key: "doorColour", name: "Door Colour", width: 140, editable: true },
  { key: "lippingMaterial", name: "Lipping Material", width: 160, editable: true },
  { key: "lippingMaterialProduction", name: "Lipping Material (Production)", width: 230, editable: true },
  { key: "lippingStyle", name: "Lipping Style", width: 140, editable: true },
  { key: "lippingThickness", name: "Lipping Thickness", width: 160, editable: true },
  { key: "lippingFinish", name: "Lipping Finish", width: 150, editable: true },
  { key: "doorEdgeProtType", name: "Door Edge Protection Type", width: 210, editable: true },
  { key: "doorEdgeProtPosition", name: "Door Edge Protection Position", width: 230, editable: true },
  { key: "pvcFaceProtection", name: "PVC Face Protection", width: 180, editable: true },
  { key: "pvcColour", name: "PVC Colour", width: 130, editable: true },
  { key: "doorUndercut", name: "Door Undercut", width: 140, editable: true },
  { key: "certification", name: "Certification", width: 140, editable: true },
  { key: "qMarkPlugOuterColour", name: "Q Mark Plug Outer Colour", width: 210, editable: true },
  { key: "qMarkTreeColour", name: "Q Mark Tree Colour", width: 180, editable: true },
  { key: "qMarkVisionPanelPlug", name: "Q Mark Vision Panel Plug", width: 210, editable: true },
  { key: "materialSustainability", name: "Material Sustainability", width: 190, editable: true },
  { key: "doorRef7", name: "Door Ref7", width: 130, editable: true },
  { key: "priceEa", name: "Price Ea", width: 110, editable: true },
  { key: "qty2", name: "Qty2", width: 90, editable: true },
  { key: "linePrice", name: "Line Price", width: 120, editable: true, frozen: true },
  { key: "importantNotes", name: "Important notes for Fire Rating", width: 240, editable: true },
  { key: "clientNotes1", name: "Client Notes 1", width: 160, editable: true },
  { key: "clientNotes2", name: "Client Notes 2", width: 160, editable: true },
  { key: "clientNotes3", name: "Client Notes 3", width: 160, editable: true },
  { key: "clientNotes4", name: "Client Notes 4", width: 160, editable: true },
  { key: "testCertificateUsed", name: "Test Certificate Used", width: 180, editable: true },
  { key: "associatedDocument", name: "Associated Document", width: 180, editable: true },
  { key: "masterLeafWeight", name: "Master Leaf Weight (Approx) kg", width: 230, editable: true },
  { key: "fireRating2", name: "Fire Rating2", width: 130, editable: true },
  { key: "latchedUnlatched", name: "Latched/Unlatched", width: 160, editable: true },
  { key: "singleDoubleAction", name: "Single Action / Double Action", width: 240, editable: true },
  { key: "singleDoubleDoor", name: "Single Door / Double Door", width: 200, editable: true },
  { key: "doorLeafType", name: "Door Leaf Type", width: 150, editable: true },
  { key: "wizardoorerRef", name: "Wizardoorer Ref (If used)", width: 210, editable: true },
  { key: "leafConcat", name: "Leaf Concat", width: 140, editable: true },
  { key: "masterLeafArea", name: "Master Leaf Area", width: 160, editable: true },
  { key: "slaveLeafArea", name: "Slave Leaf Area", width: 150, editable: true },
  { key: "leafWeightCode", name: "Leaf Weight Code", width: 160, editable: true },
  { key: "leafWeightMsq", name: "Leaf Weight msq", width: 150, editable: true },
  { key: "slaveLeafWeight", name: "Slave Leaf Weight (Approx) kg", width: 230, editable: true },
  { key: "liningVolume", name: "Lining Volume", width: 150, editable: true },
  { key: "liningMaterial", name: "Lining Material", width: 160, editable: true },
  { key: "liningMaterialWeightMsq", name: "Lining Material Weight msq", width: 210, editable: true },
  { key: "liningWeight", name: "Lining Weight (Approx) kg", width: 210, editable: true },
  { key: "stopVolume", name: "Stop Volume", width: 140, editable: true },
  { key: "stopMaterial2", name: "Stop Material2", width: 160, editable: true },
  { key: "stopMaterialDensity", name: "Stop Material Density", width: 190, editable: true },
  { key: "stopWeight", name: "Stop Weight (Approx) kg", width: 200, editable: true },
  { key: "arcVolume", name: "Arc Volume", width: 130, editable: true },
  { key: "arcMaterial3", name: "Arc Material3", width: 150, editable: true },
  { key: "arcMaterialDensity", name: "Arc Material Density", width: 190, editable: true },
  { key: "arcWeight", name: "Arc Weight (Approx) kg", width: 200, editable: true },
  { key: "fanlight", name: "Fanlight", width: 120, editable: true },
  { key: "screen", name: "Screen", width: 110, editable: true },
  { key: "frameWeight", name: "Frame Weight (Approx) kg", width: 200, editable: true },
  { key: "doorsetWeight", name: "Doorset Weight (Approx) kg - Ironmongery not allowed for", width: 380, editable: true },
];

const GRID_KEYS: string[] = Array.from(new Set(COLUMNS.map((c) => String((c as any).key || "")).filter(Boolean)));

export default function FireDoorSpreadsheet({ importId, onQuoteCreated, onComponentCreated }: FireDoorSpreadsheetProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FireDoorRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [activeCell, setActiveCell] = useState<{ rowIdx: number; colKey: string } | null>(null);
  const [selection, setSelection] = useState<{ anchor: { rowIdx: number; colKey: string }; focus: { rowIdx: number; colKey: string } } | null>(null);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configModalColumn, setConfigModalColumn] = useState<string>("");
  const [gridConfig, setGridConfig] = useState<Record<string, any>>({});
  const [lookupOptions, setLookupOptions] = useState<Record<string, Array<{value: string; label: string}>>>({});
  const [error, setError] = useState<string | null>(null);
  const [availableLookupTables, setAvailableLookupTables] = useState<Array<{ id: string; tableName?: string; name?: string; category?: string; columns?: string[]; rows?: Array<Record<string, any>> }>>([]);
  const [availableComponents, setAvailableComponents] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [availableFields, setAvailableFields] = useState<Array<{ name: string; type: string }>>([]);

  const [mutatingRows, setMutatingRows] = useState(false);

  const [rfis, setRfis] = useState<RfiRecord[]>([]);
  const [rfiDialogOpen, setRfiDialogOpen] = useState(false);
  const [rfiMode, setRfiMode] = useState<"create" | "edit" | "view">("create");
  const [currentRfi, setCurrentRfi] = useState<RfiRecord | null>(null);
  const [rfiContext, setRfiContext] = useState<{ rowId: string | null; columnKey: string; columnName?: string } | null>(null);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [columnWidthsLoaded, setColumnWidthsLoaded] = useState(false);

  const rowsRef = useRef<FireDoorRow[]>([]);
  const saveTimersRef = useRef<Map<string, any>>(new Map());
  const bomTimerRef = useRef<any>(null);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  const stableStringifyObject = useCallback((obj: Record<string, any>) => {
    const keys = Object.keys(obj || {}).sort();
    const ordered: Record<string, any> = {};
    for (const k of keys) ordered[k] = (obj as any)[k];
    return JSON.stringify(ordered);
  }, []);

  const lastSavedColumnWidthsRef = useRef<string>("{}");

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const loadImport = useCallback(async (opts?: { selectAll?: boolean }) => {
    if (!importId) return;
    const selectAll = !!opts?.selectAll;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<any>(`/fire-doors/imports/${importId}`);
      const hydrated = (data.lineItems || []).map((item: any) => hydrateImportRow(item, COLUMNS));
      setRows(hydrated);
      if (selectAll) {
        setSelectedRows(new Set((data.lineItems || []).map((r: any) => r.id)));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load import");
    } finally {
      setLoading(false);
    }
  }, [importId]);

  // Load fire door data from import
  useEffect(() => {
    loadImport({ selectAll: true });
  }, [loadImport]);

  const bulkCreateRows = useCallback(async (count: number) => {
    if (!importId) return [] as any[];
    const n = Number(count);
    if (!Number.isFinite(n) || n <= 0) return [] as any[];
    const res = await apiFetch<{ ok: boolean; items: any[] }>(`/fire-doors/line-items/bulk-create`, {
      method: 'POST',
      json: { fireDoorImportId: importId, count: n },
    });
    const items = Array.isArray(res?.items) ? res.items : [];
    return items;
  }, [importId]);

  const coerceDefaultValue = useCallback((cfg: any): any => {
    const v = (cfg && typeof cfg === 'object') ? (cfg as any).defaultValue : null;
    if (v == null) return null;
    const inputType = String((cfg as any)?.inputType || '').toLowerCase();
    if (inputType === 'number') {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return String(v);
  }, []);

  const bulkDeleteRows = useCallback(async (ids: string[]) => {
    const clean = Array.from(new Set((ids || []).map((x) => String(x || '').trim()).filter(Boolean)));
    if (!clean.length) return;
    await apiFetch(`/fire-doors/line-items/bulk-delete`, {
      method: 'POST',
      json: { ids: clean },
    });
  }, []);

  // Load and persist column widths per tenant (Excel-like drag resize)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{ ok: boolean; columnWidths?: Record<string, number> }>(
          `/fire-doors/order-grid/column-widths`
        );
        const widths = res?.columnWidths && typeof res.columnWidths === "object" ? res.columnWidths : {};
        if (cancelled) return;
        setColumnWidths(widths);
        lastSavedColumnWidthsRef.current = stableStringifyObject(widths as any);
      } catch {
        // ignore (fall back to defaults)
      } finally {
        if (!cancelled) setColumnWidthsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stableStringifyObject]);

  useEffect(() => {
    if (!columnWidthsLoaded) return;
    const sig = stableStringifyObject(columnWidths || {});
    if (sig === lastSavedColumnWidthsRef.current) return;

    const t = window.setTimeout(async () => {
      try {
        await apiFetch(`/fire-doors/order-grid/column-widths`, {
          method: "POST",
          json: { columnWidths: columnWidths || {} },
        });
        lastSavedColumnWidthsRef.current = sig;
      } catch {
        // ignore
      }
    }, 250);

    return () => window.clearTimeout(t);
  }, [columnWidths, columnWidthsLoaded, stableStringifyObject]);

  const loadRfis = useCallback(async () => {
    if (!importId) return;
    try {
      const res = await apiFetch<{ ok: boolean; items: RfiRecord[] }>(
        `/rfis?projectId=${encodeURIComponent(importId)}`
      );
      if (res?.ok) setRfis(Array.isArray(res.items) ? res.items : []);
    } catch (err) {
      console.error('[fire-door-grid] Failed to load RFIs', err);
    }
  }, [importId]);

  useEffect(() => {
    loadRfis();
  }, [loadRfis]);

  const { rfiColumns, rfiCells } = useMemo(() => {
    const cols = new Set<string>();
    const cells = new Set<string>();
    for (const rfi of rfis) {
      const colKey = String(rfi?.columnKey || '').trim();
      if (!colKey) continue;
      if (rfi?.rowId) {
        cells.add(`${rfi.rowId}::${colKey}`);
      } else {
        cols.add(colKey);
      }
    }
    return { rfiColumns: cols, rfiCells: cells };
  }, [rfis]);

  const openRfiDialog = useCallback((rowId: string | null, columnKey: string, columnName?: string) => {
    const colKey = String(columnKey || '').trim();
    const rid = rowId ? String(rowId).trim() : null;
    const existing = rfis.find((r) => {
      const rCol = String((r as any)?.columnKey || '').trim();
      if (!rCol || rCol !== colKey) return false;
      const rRow = (r as any)?.rowId ? String((r as any).rowId).trim() : null;
      return (rid ? rRow === rid : rRow == null);
    }) || null;

    setRfiContext({ rowId: rid, columnKey: colKey, columnName });
    setCurrentRfi(existing);
    setRfiMode(existing ? 'edit' : 'create');
    setRfiDialogOpen(true);
  }, [rfis]);

  const handleSaveRfi = useCallback(async (rfiData: Partial<RfiRecord>) => {
    if (!importId) return;
    if (!rfiData.message || !String(rfiData.message).trim()) {
      alert('RFI message is required');
      return;
    }

    const endpoint = rfiData.id ? `/rfis/${rfiData.id}` : '/rfis';
    const method = rfiData.id ? 'PUT' : 'POST';

    const payload = {
      projectId: importId,
      rowId: rfiData.rowId ?? null,
      columnKey: String(rfiData.columnKey || ''),
      title: (rfiData.title ?? null) ? String(rfiData.title).trim() || null : null,
      message: String(rfiData.message).trim(),
      status: rfiData.status || 'open',
      visibleToClient: rfiData.visibleToClient !== undefined ? rfiData.visibleToClient : false,
    };

    await apiFetch(endpoint, {
      method,
      json: payload,
    });

    await loadRfis();
  }, [importId, loadRfis]);

  const editableKeySet = useMemo(() => {
    const s = new Set<string>();
    for (const col of COLUMNS) {
      const cfg = gridConfig[col.key];
      const hasFormula = !!cfg?.formula || cfg?.inputType === 'formula';
      const allowOverride = !!cfg?.allowFormulaOverride;
      const editable = !!col.editable && (!hasFormula || allowOverride);
      if (editable) s.add(col.key);
    }
    return s;
  }, [gridConfig]);

  const getSelectableColumns = useCallback((gridCols: readonly Column<FireDoorRow>[]) => {
    return gridCols
      .map((c: any) => String(c?.key || ''))
      .filter((k) => k && k !== 'select-row');
  }, []);

  const bulkPersist = useCallback(async (updates: Array<{ id: string; changes: Record<string, any> }>) => {
    if (!updates.length) return;
    try {
      await apiFetch(`/fire-doors/line-items/bulk`, {
        method: 'PATCH',
        json: { updates },
      });
    } catch (err: any) {
      console.error('[fire-door-grid] Bulk save failed:', err);
      setError(err?.message || 'Failed to save changes');
    }
  }, []);

  const ensureRowCount = useCallback(async (minRowCount: number) => {
    if (!importId) return;
    const current = rowsRef.current;
    const need = Math.max(0, Math.floor(minRowCount) - current.length);
    if (need <= 0) return;

    const created = await bulkCreateRows(need);
    if (!created.length) return;

    const hydratedNew = created.map((item) => hydrateImportRow(item, COLUMNS));

    // Apply default values to newly created rows (only where the cell is currently empty)
    const updates: Array<{ id: string; changes: Record<string, any> }> = [];
    const hydratedWithDefaults = hydratedNew.map((row: any) => {
      const patch: Record<string, any> = {};
      for (const [k, cfg] of Object.entries(gridConfig || {})) {
        const key = String(k || '').trim();
        if (!key) continue;
        const isCalculated = !!(cfg as any)?.formula || String((cfg as any)?.inputType || '').toLowerCase() === 'formula';
        if (isCalculated) continue;

        const cur = row[key];
        if (!(cur == null || cur === '')) continue;
        const dv = coerceDefaultValue(cfg);
        if (dv == null || dv === '') continue;
        row[key] = dv;
        patch[key] = dv;
      }
      if (Object.keys(patch).length) updates.push({ id: row.id, changes: patch });
      return row;
    });
    const merged = [...current, ...hydratedWithDefaults].sort((a: any, b: any) => {
      const ai = Number((a as any)?.rowIndex ?? 0);
      const bi = Number((b as any)?.rowIndex ?? 0);
      return ai - bi;
    });

    setRows(merged);
    rowsRef.current = merged;

    if (updates.length) {
      await bulkPersist(updates);
    }
  }, [importId, bulkCreateRows, bulkPersist, coerceDefaultValue, gridConfig]);

  const selectionRange = useMemo(() => {
    if (!selection) return null;

    const gridCols = [SelectColumn, ...COLUMNS] as unknown as readonly Column<FireDoorRow>[];
    const keys = getSelectableColumns(gridCols);
    const idx = new Map<string, number>();
    keys.forEach((k, i) => idx.set(k, i));

    const aCol = idx.get(selection.anchor.colKey);
    const fCol = idx.get(selection.focus.colKey);
    if (aCol == null || fCol == null) return null;

    const startRow = Math.min(selection.anchor.rowIdx, selection.focus.rowIdx);
    const endRow = Math.max(selection.anchor.rowIdx, selection.focus.rowIdx);
    const startColIdx = Math.min(aCol, fCol);
    const endColIdx = Math.max(aCol, fCol);

    return { startRow, endRow, startColIdx, endColIdx, keys };
  }, [selection, getSelectableColumns]);

  const isCellInSelection = useCallback((rowIdx: number, colKey: string) => {
    if (!selectionRange) return false;
    const colIdx = selectionRange.keys.indexOf(colKey);
    if (colIdx < 0) return false;
    return (
      rowIdx >= selectionRange.startRow &&
      rowIdx <= selectionRange.endRow &&
      colIdx >= selectionRange.startColIdx &&
      colIdx <= selectionRange.endColIdx
    );
  }, [selectionRange]);

  const buildTsvFromSelection = useCallback((): string | null => {
    if (!selectionRange) return null;
    const { startRow, endRow, startColIdx, endColIdx, keys } = selectionRange;
    const currentRows = rowsRef.current;

    const lines: string[] = [];
    for (let r = startRow; r <= endRow; r++) {
      const row = currentRows[r];
      if (!row) continue;
      const vals: string[] = [];
      for (let c = startColIdx; c <= endColIdx; c++) {
        const key = keys[c];
        const v = (row as any)[key];
        vals.push(v == null ? '' : String(v));
      }
      lines.push(vals.join('\t'));
    }
    return lines.join('\n');
  }, [selectionRange]);

  const applyPasteTsv = useCallback(async (tsv: string) => {
    let currentRows = rowsRef.current;

    const start = activeCell || (selection?.anchor ?? null);
    if (!start) return;

    const gridCols = [SelectColumn, ...COLUMNS] as unknown as readonly Column<FireDoorRow>[];
    const keys = getSelectableColumns(gridCols);
    const idx = new Map<string, number>();
    keys.forEach((k, i) => idx.set(k, i));

    const startColIdx = idx.get(start.colKey);
    if (startColIdx == null) return;

    const rowsText = tsv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    // ignore trailing empty line from many clipboards
    while (rowsText.length > 0 && rowsText[rowsText.length - 1] === '') rowsText.pop();
    if (rowsText.length === 0) return;

    // Auto-create missing line items when pasting extends beyond current row count.
    const requiredRowCount = start.rowIdx + rowsText.length;
    if (requiredRowCount > currentRows.length) {
      try {
        setMutatingRows(true);
        await ensureRowCount(requiredRowCount);
        currentRows = rowsRef.current;
      } catch (err: any) {
        console.error('[fire-door-grid] Failed to create rows for paste:', err);
        setError(err?.message || 'Failed to create new rows for paste');
        return;
      } finally {
        setMutatingRows(false);
      }
    }

    const nextRows = currentRows.map((r) => ({ ...r }));
    const updates: Array<{ id: string; changes: Record<string, any> }> = [];
    const changedById = new Map<string, Record<string, any>>();

    let willTouchCalculated = false;

    for (let rOff = 0; rOff < rowsText.length; rOff++) {
      const targetRowIdx = start.rowIdx + rOff;
      if (targetRowIdx < 0 || targetRowIdx >= nextRows.length) break;
      const targetRow = nextRows[targetRowIdx];
      const prevRow = currentRows[targetRowIdx];
      const cells = rowsText[rOff].split('\t');

      for (let cOff = 0; cOff < cells.length; cOff++) {
        const targetColIdx = startColIdx + cOff;
        if (targetColIdx < 0 || targetColIdx >= keys.length) break;
        const key = keys[targetColIdx];

        const cfg = gridConfig[key];
        const isCalculated = !!cfg?.formula || cfg?.inputType === 'formula';
        const allowOverride = !!cfg?.allowFormulaOverride;

        // Never paste into calculated fields unless overwrite is enabled
        if (isCalculated && !allowOverride) continue;

        if (!editableKeySet.has(key)) continue;

        const rawVal = cells[cOff];
        const nextVal = maybeParseNumber(rawVal);
        if (Object.is((prevRow as any)[key], nextVal)) continue;
        (targetRow as any)[key] = nextVal === '' ? null : nextVal;

        if (isCalculated && allowOverride) willTouchCalculated = true;

        if (isCalculated && allowOverride) {
          if ((targetRow as any)[key] == null || (targetRow as any)[key] === '') {
            setFormulaOverrideFlag(targetRow as any, key, null);
          } else {
            setFormulaOverrideFlag(targetRow as any, key, true);
          }
        }

        const patch = changedById.get(targetRow.id) || {};
        patch[key] = (targetRow as any)[key];

        if (isCalculated && allowOverride) {
          patch[`__override:${key}`] = getFormulaOverrideFlag(targetRow as any, key) ? true : null;
        }
        changedById.set(targetRow.id, patch);
      }
    }

    if (willTouchCalculated) {
      const ok = window.confirm(
        'This paste includes calculated (formula) fields. Do you want to overwrite the formulas for the pasted cells?'
      );
      if (!ok) {
        // Drop calculated-field changes; keep the rest.
        for (const [id, patch] of changedById.entries()) {
          for (const k of Object.keys({ ...patch })) {
            const cfg = gridConfig[k];
            const isCalculated = !!cfg?.formula || cfg?.inputType === 'formula';
            const allowOverride = !!cfg?.allowFormulaOverride;
            if (isCalculated && allowOverride) {
              delete (patch as any)[k];
              delete (patch as any)[`__override:${k}`];
            }
          }
          if (Object.keys(patch).length === 0) changedById.delete(id);
        }
      }
    }

    for (const [id, changes] of changedById.entries()) {
      updates.push({ id, changes });
    }

    if (updates.length === 0) return;
    setRows(nextRows);
    rowsRef.current = nextRows;

    await bulkPersist(updates);
  }, [activeCell, selection, bulkPersist, getSelectableColumns, editableKeySet, gridConfig, ensureRowCount]);

  const handleRowsChange = useCallback((newRows: FireDoorRow[]) => {
    const oldRows = rowsRef.current;
    const oldById = new Map<string, FireDoorRow>();
    for (const r of oldRows) oldById.set(r.id, r);

    setRows(newRows);

    // Debounced persistence: only send the changed keys for each changed row.
    const persistRowPatch = async (rowId: string, patch: Record<string, any>) => {
      try {
        await apiFetch(`/fire-doors/line-items/${encodeURIComponent(rowId)}`, {
          method: "PATCH",
          json: { changes: patch },
        });
      } catch (err: any) {
        console.error("[fire-door-grid] Failed to save row:", err);
        setError(err?.message || "Failed to save changes");
      }
    };

    for (const row of newRows) {
      const prev = oldById.get(row.id);
      if (!prev) continue;

      const patch: Record<string, any> = {};
      for (const key of GRID_KEYS) {
        if (key === "rowIndex" || key === "id") continue;
        if (!Object.is((prev as any)[key], (row as any)[key])) {
          patch[key] = (row as any)[key];

          const cfg = gridConfig[key];
          const isCalculated = !!cfg?.formula || cfg?.inputType === 'formula';
          const allowOverride = !!cfg?.allowFormulaOverride;
          if (isCalculated && allowOverride) {
            const flagKey = `__override:${key}`;
            if ((row as any)[key] == null || (row as any)[key] === '') {
              setFormulaOverrideFlag(row as any, key, null);
              patch[flagKey] = null;
            } else {
              setFormulaOverrideFlag(row as any, key, true);
              patch[flagKey] = true;
            }
          }
        }
      }

      if (Object.keys(patch).length === 0) continue;

      const existingTimer = saveTimersRef.current.get(row.id);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        persistRowPatch(row.id, patch);
        saveTimersRef.current.delete(row.id);
      }, 600);

      saveTimersRef.current.set(row.id, timer);
    }

    // Auto-generate BOMs for all rows
    const batchGenerateBOMs = async () => {
      try {
        const bomRows = newRows.map(row => ({
          id: row.id,
          fieldValues: {
            height: row.leafHeight,
            width: row.masterLeafWidth || row.mLeafWidth,
            fireRating: row.rating,
            location: row.location,
            doorRef: row.doorRef,
            coreType: row.coreType,
            leafCount: row.leafConfiguration?.includes('Double') ? 2 : 1,
          },
        }));

        // Only batch generate if we have valid data
        if (bomRows.some(r => r.fieldValues.height && r.fieldValues.width)) {
          await fetch('/fire-door-bom/batch-generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('jwt')}`,
            },
            body: JSON.stringify({ rows: bomRows }),
          });
        }
      } catch (err) {
        console.error('Failed to auto-generate BOMs:', err);
      }
    };

    // Debounce BOM generation
    if (bomTimerRef.current) clearTimeout(bomTimerRef.current);
    bomTimerRef.current = setTimeout(batchGenerateBOMs, 1000);
    return;

    // Check for component creation triggers
    newRows.forEach((newRow, index) => {
      const oldRow = rows[index];
      if (!oldRow) return;

      // Check each field with a component link
      Object.entries(gridConfig).forEach(([fieldName, config]: [string, any]) => {
        if (config.componentLink && newRow[fieldName as keyof FireDoorRow] && !oldRow[fieldName as keyof FireDoorRow]) {
          // Field was just filled - trigger component creation
          createComponentForField(newRow.id, fieldName, String(newRow[fieldName as keyof FireDoorRow]), config.componentLink)
            .catch(err => console.error('Failed to create component:', err));
        }
      });
    });
  }, [rows, gridConfig]);

  // Load grid field configurations
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const configs = await apiFetch('/api/grid-config/all');
        if (configs && Array.isArray(configs)) {
          const configMap: Record<string, any> = {};
          configs.forEach((cfg: any) => {
            configMap[cfg.fieldName] = cfg;
          });
          setGridConfig(configMap);
        }
      } catch (err) {
        console.log('No grid configs found, using defaults');
      }
    };
    loadConfigs();
  }, []);

  // Load available lookup tables for the configure modal
  useEffect(() => {
    const loadLookupTables = async () => {
      try {
        // Use flexible-fields lookup tables endpoint (includes `columns`)
        const tables = await apiFetch('/flexible-fields/lookup-tables');
        if (Array.isArray(tables)) {
          setAvailableLookupTables(tables);
        }
      } catch (err) {
        console.log('No lookup tables found');
      }
    };
    loadLookupTables();
  }, []);

  // Load available components for the configure modal
  useEffect(() => {
    const loadComponents = async () => {
      try {
        const components = await apiFetch('/api/components');
        if (Array.isArray(components)) {
          setAvailableComponents(
            components.map((comp: any) => ({
              id: comp.id,
              code: comp.code,
              name: comp.name,
            }))
          );
        }
      } catch (err) {
        console.log('No components found');
      }
    };
    loadComponents();
  }, []);

  // Load available fields (questionnaire fields) for the configure modal
  useEffect(() => {
    const loadFields = async () => {
      try {
        // Get all questionnaire fields for the tenant
        const fields = await apiFetch('/api/questionnaire-fields');
        const fieldList = Array.isArray(fields) ? fields : [];
        
        // Combine API fields with fire door grid columns
        const apiFields = fieldList.map((field: any) => ({
          name: field.key || field.name,
          type: field.type || 'text',
        }));
        
        // Add all fire door columns as available fields for formulas
        const columnFields = COLUMNS.map((col) => ({
          name: col.key,
          type: 'text',
        }));
        
        // Merge and deduplicate by name
        const allFields = [...apiFields];
        for (const colField of columnFields) {
          if (!allFields.some(f => f.name === colField.name)) {
            allFields.push(colField);
          }
        }
        
        setAvailableFields(allFields);
      } catch (err) {
        // Fallback: add all fire door columns
        setAvailableFields(COLUMNS.map((col) => ({
          name: col.key,
          type: 'text',
        })));
      }
    };
    loadFields();
  }, []);

  const createComponentForField = async (lineItemId: string, fieldName: string, fieldValue: string, componentType: string) => {
    try {
      // Map field names to component property mappings
      const propertyMappings: Record<string, Record<string, string>> = {
        hinges: {hingeType: 'hingeType', hingeQuantity: 'quantity'},
        locks: {lockType: 'lockType', lockQuantity: 'quantity'},
        glass: {glassType: 'glassType', glassArea: 'area'},
        doorBlank: {doorBlankType: 'doorBlankType'},
      };

      const componentMapping: Record<string, string> = {
        hinges: 'Hinges',
        locks: 'Locks',
        glass: 'Vision Glass',
        doorBlank: 'Door Blank',
      };

      await apiFetch(`/api/fire-door-components/${lineItemId}/generate`, {
        method: 'POST',
        json: {
          componentType: componentMapping[componentType],
          triggerField: fieldName,
          triggerValue: fieldValue,
          propertyMap: propertyMappings[componentType] || {},
        },
      });

      // Refresh BOM if available
      onComponentCreated?.();
    } catch (err) {
      console.error(`Failed to create ${componentType} component:`, err);
    }
  };

  // Load lookup table options dynamically based on grid config
  useEffect(() => {
    const loadLookupOptions = async () => {
      try {
        // Load all flexible lookup tables
        const tables = await apiFetch('/api/flexible-fields/lookup-tables');
        if (tables && Array.isArray(tables)) {
          const optionsMap: Record<string, Array<{value: string; label: string}>> = {};
          
          tables.forEach((table: any) => {
            if (table.rows && Array.isArray(table.rows)) {
              const tableName = String(table.tableName || table.name || '').trim();
              if (!tableName) return;

              const cols = Array.isArray(table.columns) ? table.columns.map((c: any) => String(c)).filter(Boolean) : [];
              const firstCol = cols.length ? cols[0] : null;

              const opts = table.rows
                .map((row: any) => {
                  const raw = firstCol ? row?.[firstCol] : (row?.value ?? row?.label ?? row?.name ?? row?.description ?? row?.id);
                  const v = raw == null ? '' : String(raw).trim();
                  if (!v) return null;
                  return { value: v, label: v };
                })
                .filter(Boolean) as Array<{ value: string; label: string }>;

              // Keep options sorted for better UX
              opts.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

              optionsMap[tableName] = opts;
            }
          });
          
          setLookupOptions(optionsMap);
        }

        // Also load legacy pricing tables
        const hinges = await apiFetch('/api/ironmongery-prices?type=hinge');
        if (hinges && Array.isArray(hinges)) {
          setLookupOptions(prev => ({
            ...prev,
            hinges: hinges.map((h: any) => ({value: h.id, label: h.description || h.name}))
          }));
        }

        const locks = await apiFetch('/api/ironmongery-prices?type=lock');
        if (locks && Array.isArray(locks)) {
          setLookupOptions(prev => ({
            ...prev,
            locks: locks.map((l: any) => ({value: l.id, label: l.description || l.name}))
          }));
        }

        const glass = await apiFetch('/api/glass-prices');
        if (glass && Array.isArray(glass)) {
          setLookupOptions(prev => ({
            ...prev,
            glass: glass.map((g: any) => ({value: g.id, label: g.description || g.name}))
          }));
        }
      } catch (err) {
        console.error('Failed to load lookup options:', err);
      }
    };
    loadLookupOptions();
  }, [gridConfig]);

  // Dropdown cell component
  const DropdownCell = ({ row, column, onRowChange }: RenderEditCellProps<FireDoorRow>) => {
    const fieldConfig = gridConfig[column.key];
    const options = fieldConfig?.lookupTable ? lookupOptions[fieldConfig.lookupTable] || [] : [];

    const currentValue = row[column.key];
    const currentValueStr = currentValue == null ? '' : String(currentValue);

    return (
      <select
        className="w-full h-full px-2 border-0 outline-none bg-white"
        value={currentValueStr}
        onChange={(e) => {
          const newValue = e.target.value;
          onRowChange({ ...row, [column.key]: newValue }, true);
          
          // Trigger component creation if configured
          if (fieldConfig?.componentLink && newValue) {
            createComponentForField(row.id, column.key, newValue, fieldConfig.componentLink);
          }
        }}
        autoFocus
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  };

  // Save column configuration
  const saveColumnConfig = async (fieldName: string, config: any) => {
    try {
      await apiFetch(`/api/grid-config/${fieldName}`, {
        method: 'POST',
        json: config,
      });
      
      // Reload configs
      setGridConfig(prev => ({
        ...prev,
        [fieldName]: config,
      }));
      
      setConfigModalOpen(false);
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  };

  // Evaluate formulas
  const lookupTablesByName = useMemo(() => {
    const m = new Map<string, any>();
    for (const t of availableLookupTables as any[]) {
      const name = String(t?.tableName || t?.name || '').trim();
      if (!name) continue;
      m.set(name, t);
    }
    return m;
  }, [availableLookupTables]);

  const unquote = (s: string) => {
    const t = String(s || '').trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    return t;
  };

  const splitTopLevelArgs = (s: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let depth = 0;
    let quote: '"' | "'" | null = null;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (quote) {
        cur += ch;
        if (ch === quote && s[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        cur += ch;
        continue;
      }
      if (ch === '(') {
        depth++;
        cur += ch;
        continue;
      }
      if (ch === ')') {
        depth = Math.max(0, depth - 1);
        cur += ch;
        continue;
      }
      if (ch === ',' && depth === 0) {
        out.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };

  const valuesEqual = (a: any, b: any) => {
    if (a == null && b == null) return true;
    const as = String(a ?? '').trim();
    const bs = String(b ?? '').trim();
    const an = Number(as);
    const bn = Number(bs);
    const aNumOk = as !== '' && Number.isFinite(an);
    const bNumOk = bs !== '' && Number.isFinite(bn);
    if (aNumOk && bNumOk) return an === bn;
    return as.localeCompare(bs, undefined, { sensitivity: 'accent' }) === 0;
  };

  const resolveLookup = (tableName: string, conditions: string, returnField: string, row: FireDoorRow) => {
    const table = lookupTablesByName.get(tableName);
    const rows = Array.isArray(table?.rows) ? (table.rows as Array<Record<string, any>>) : [];
    if (!rows.length) return null;

    const condStr = String(conditions || '').replace(/\$\{([^}]+)\}/g, (_m, keyRaw) => {
      const key = String(keyRaw || '').trim();
      const v = (row as any)[key];
      return v == null ? '' : String(v);
    });

    const conds: Array<{ key: string; value: string }> = [];
    for (const part of condStr.split('&')) {
      const p = String(part || '').trim();
      if (!p) continue;
      const eq = p.indexOf('=');
      if (eq < 0) continue;
      const k = p.slice(0, eq).trim();
      const v = p.slice(eq + 1).trim();
      if (!k) continue;
      conds.push({ key: k, value: unquote(v) });
    }

    const ret = String(returnField || '').trim();
    if (!ret) return null;

    const found = rows.find((r) => {
      if (r && r.isActive === false) return false;
      for (const c of conds) {
        if (!valuesEqual((r as any)[c.key], c.value)) return false;
      }
      return true;
    });

    if (!found) return null;
    const v = (found as any)[ret];
    return v == null ? null : v;
  };

  const replaceLookupCalls = (input: string, row: FireDoorRow): string => {
    let out = String(input || '');
    if (!out.includes('LOOKUP(')) return out;

    let guard = 0;
    while (out.includes('LOOKUP(') && guard++ < 25) {
      const start = out.indexOf('LOOKUP(');
      if (start < 0) break;
      let i = start + 'LOOKUP('.length;
      let depth = 1;
      let quote: '"' | "'" | null = null;
      for (; i < out.length; i++) {
        const ch = out[i];
        if (quote) {
          if (ch === quote && out[i - 1] !== '\\') quote = null;
          continue;
        }
        if (ch === '"' || ch === "'") {
          quote = ch;
          continue;
        }
        if (ch === '(') depth++;
        if (ch === ')') {
          depth--;
          if (depth === 0) break;
        }
      }
      if (depth !== 0) break;

      const call = out.slice(start, i + 1);
      const inner = call.slice('LOOKUP('.length, -1);
      const args = splitTopLevelArgs(inner);
      const tableName = unquote(args[0] || '');
      const conditions = unquote(args[1] || '');
      const returnField = unquote(args[2] || '');
      const resolved = resolveLookup(tableName, conditions, returnField, row);

      let replacement = 'null';
      if (typeof resolved === 'number' && Number.isFinite(resolved)) replacement = String(resolved);
      else if (typeof resolved === 'boolean') replacement = resolved ? 'true' : 'false';
      else if (resolved != null) replacement = JSON.stringify(String(resolved));

      out = out.slice(0, start) + replacement + out.slice(i + 1);
    }
    return out;
  };

  const evaluateFormula = (formula: string, row: FireDoorRow): any => {
    try {
      let expression = String(formula || '');

      // Resolve LOOKUP(...) calls first, using loaded flexible lookup tables.
      expression = replaceLookupCalls(expression, row);

      // Primary syntax: ${fieldName}
      expression = expression.replace(/\$\{([^}]+)\}/g, (_m, fieldRaw) => {
        const key = String(fieldRaw || '').trim();
        const value = (row as any)[key];
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
        if (value == null || value === '') return '0';
        return JSON.stringify(String(value));
      });

      // Back-compat: replace bare identifiers for numeric fields
      for (const key of Object.keys(row)) {
        const value = (row as any)[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
          expression = expression.replace(new RegExp(`\\b${key}\\b`, 'g'), String(value));
        }
      }

      const AND = (...args: any[]) => args.every((x) => !!x);
      const OR = (...args: any[]) => args.some((x) => !!x);
      const IF = (cond: any, truthy: any, falsy: any) => (cond ? truthy : falsy);
      const SUM = (...args: any[]) => args.reduce((s, v) => s + (Number(v) || 0), 0);
      const MULTIPLY = (...args: any[]) => args.reduce((p, v) => p * (Number(v) || 0), 1);
      const DIVIDE = (a: any, b: any) => {
        const na = Number(a);
        const nb = Number(b);
        if (!Number.isFinite(na) || !Number.isFinite(nb) || nb === 0) return 0;
        return na / nb;
      };
      const SUBTRACT = (a: any, b: any) => (Number(a) || 0) - (Number(b) || 0);
      const MAX = (...args: any[]) => Math.max(...args.map((v) => (Number(v) || 0)));
      const MIN = (...args: any[]) => Math.min(...args.map((v) => (Number(v) || 0)));
      const ROUND = (n: any, decimals: any = 0) => {
        const nn = Number(n);
        const d = Number(decimals);
        if (!Number.isFinite(nn) || !Number.isFinite(d)) return 0;
        const f = Math.pow(10, Math.max(0, Math.floor(d)));
        return Math.round(nn * f) / f;
      };
      const CEIL = (n: any) => Math.ceil(Number(n) || 0);
      const FLOOR = (n: any) => Math.floor(Number(n) || 0);
      const CONCAT = (...args: any[]) => args.map((v) => (v == null ? '' : String(v))).join('');
      const LENGTH = (v: any) => (v == null ? 0 : String(v).length);

      // eslint-disable-next-line no-new-func
      return new Function(
        'AND',
        'OR',
        'IF',
        'SUM',
        'MULTIPLY',
        'DIVIDE',
        'SUBTRACT',
        'MAX',
        'MIN',
        'ROUND',
        'CEIL',
        'FLOOR',
        'CONCAT',
        'LENGTH',
        'return ' + expression
      )(
        AND,
        OR,
        IF,
        SUM,
        MULTIPLY,
        DIVIDE,
        SUBTRACT,
        MAX,
        MIN,
        ROUND,
        CEIL,
        FLOOR,
        CONCAT,
        LENGTH
      );
    } catch (err) {
      console.error('Formula evaluation error:', err);
      return null;
    }
  };

  const columns = useMemo((): readonly Column<FireDoorRow>[] => {
    return [
      SelectColumn,
      ...COLUMNS.map(col => {
        const fieldConfig = gridConfig[col.key];
        const baseInputType = fieldConfig?.inputType || 'text';
        const inputType = String(baseInputType).toLowerCase();
        const isDropdown = (inputType === 'dropdown' || inputType === 'lookup') && fieldConfig?.lookupTable;
        const isCalculated = !!fieldConfig?.formula || fieldConfig?.inputType === 'formula';
        const allowOverride = !!fieldConfig?.allowFormulaOverride;
        
        const resizedWidth = columnWidths[col.key];
        const columnHasRfi = rfiColumns.has(col.key);

        return {
          ...col,
          width: typeof resizedWidth === 'number' && Number.isFinite(resizedWidth) ? resizedWidth : col.width,
          resizable: true,
          editable: isCalculated ? (allowOverride ? !!col.editable : false) : col.editable,
          headerCellClass: clsx(
            "cursor-pointer hover:bg-blue-50 transition-colors",
            columnHasRfi && 'bg-yellow-100'
          ),
          renderHeaderCell: (props: any) => (
            <div 
              className="relative flex items-center h-full px-2 group"
              onClick={(e) => {
                e.stopPropagation();
                setConfigModalColumn(col.key);
                setConfigModalOpen(true);
              }}
            >
              <span
                className="min-w-0 flex-1 whitespace-normal break-words leading-tight line-clamp-2"
                title={typeof col.name === 'string' ? col.name : ''}
              >
                {typeof col.name === 'string' ? col.name : 'Column'}
              </span>
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  className={clsx(
                    'transition-opacity text-slate-500 hover:text-slate-700',
                    columnHasRfi ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                  title={columnHasRfi ? 'Open RFI for this column' : 'Add RFI for this column'}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openRfiDialog(null, col.key, typeof col.name === 'string' ? col.name : undefined);
                  }}
                >
                  <MessageSquare className="w-3 h-3" />
                </button>
                <Settings className="w-3 h-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          ),
          renderEditCell: isDropdown
            ? DropdownCell
            : col.editable
              ? (p: RenderEditCellProps<FireDoorRow>) => (
                  <DefaultEditCell {...p} inputType={inputType} />
                )
              : undefined,
          renderCell: (props: any) => {
            const row = props.row;
            const rowIdx = props.rowIdx as number;

            // Display row number starting at 1 (not 0)
            if (col.key === 'rowIndex') {
              const inSelection = isCellInSelection(rowIdx, col.key);
              const isActive = activeCell?.rowIdx === rowIdx && activeCell?.colKey === col.key;
              return (
                <div
                  className={clsx(
                    'px-2 text-slate-700',
                    inSelection && 'bg-blue-50',
                    isActive && 'ring-2 ring-blue-500 ring-inset'
                  )}
                >
                  {rowIdx + 1}
                </div>
              );
            }

            const overrideActive = allowOverride && getFormulaOverrideFlag(row, col.key);
            let value = overrideActive ? row[col.key] : row[col.key];
            const inSelection = isCellInSelection(rowIdx, col.key);
            const isActive = activeCell?.rowIdx === rowIdx && activeCell?.colKey === col.key;

            const cellHasRfi =
              (row?.id ? rfiCells.has(`${row.id}::${col.key}`) : false) || rfiColumns.has(col.key);
            const baseClass = clsx(
              'px-2 group relative h-full w-full',
              cellHasRfi && 'bg-yellow-100',
              inSelection && 'bg-blue-50',
              isActive && 'ring-2 ring-blue-500 ring-inset',
              // Highlight cells that are overriding a column formula
              overrideActive && 'border border-blue-300 bg-white'
            );
            
            // Evaluate formula if configured and not overridden
            if (isCalculated && fieldConfig?.formula && !overrideActive) {
              value = evaluateFormula(fieldConfig.formula, row);
            }
            
            if (value === null || value === undefined) return <div className={clsx(baseClass, 'text-gray-400')}>-</div>;
            
            // Format currency columns
            if (['labourCost', 'materialCost', 'unitValue', 'lineTotal', 'priceEa', 'linePrice'].includes(col.key)) {
              return <div className={clsx(baseClass, 'font-semibold text-green-700')}>£{Number(value).toFixed(2)}</div>;
            }
            
            // Show lookup label if configured
            if (isDropdown && fieldConfig?.lookupTable) {
              const options = lookupOptions[fieldConfig.lookupTable] || [];
              const valueStr = value == null ? '' : String(value).trim();
              const option = valueStr
                ? (
                    options.find((opt) => String(opt.value).trim() === valueStr) ||
                    (() => {
                      const asNum = Number(valueStr);
                      if (!Number.isFinite(asNum)) return undefined;
                      return options.find((opt) => {
                        const optNum = Number(String(opt.value).trim());
                        return Number.isFinite(optNum) && optNum === asNum;
                      });
                    })() ||
                    options.find((opt) => String(opt.label).trim() === valueStr)
                  )
                : undefined;

              const hasTypedValue = valueStr !== '';
              const isInvalidDropdownValue = hasTypedValue && !option;

              return (
                <div className={clsx(baseClass, isInvalidDropdownValue && !cellHasRfi && 'bg-orange-100')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{option?.label || valueStr}</span>
                    {isActive && (
                      <button
                        type="button"
                        className="opacity-60 hover:opacity-100 text-slate-600"
                        title={cellHasRfi ? 'Open RFI for this cell' : 'Add RFI for this cell'}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openRfiDialog(row.id, col.key, typeof col.name === 'string' ? col.name : undefined);
                        }}
                      >
                        <MessageSquare className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            }
            
            // Formula indicator (only when the formula is in effect)
            if (isCalculated && !overrideActive) {
              return <div className={clsx(baseClass, 'text-blue-700 font-mono text-xs')}>{value}</div>;
            }

            // When a formula override is active, show a reset control to return this cell to the column formula.
            if (isCalculated && overrideActive) {
              return (
                <div className={clsx(baseClass, 'flex items-center justify-between gap-2')}>
                  <span className="truncate">{value}</span>
                  {isActive && (
                    <button
                      type="button"
                      className="text-[11px] text-slate-600 hover:text-slate-800"
                      title={cellHasRfi ? 'Open RFI for this cell' : 'Add RFI for this cell'}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openRfiDialog(row.id, col.key, typeof col.name === 'string' ? col.name : undefined);
                      }}
                    >
                      <MessageSquare className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-[11px] text-blue-600 hover:text-blue-700 underline-offset-2 hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      const nextRow: any = { ...row, [col.key]: null };
                      setFormulaOverrideFlag(nextRow, col.key, null);
                      props.onRowChange(nextRow, true);
                    }}
                    title="Return this cell to the column formula"
                  >
                    Reset
                  </button>
                </div>
              );
            }

            return (
              <div className={baseClass}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{value}</span>
                  {isActive && (
                    <button
                      type="button"
                      className="opacity-60 hover:opacity-100 text-slate-600"
                      title={cellHasRfi ? 'Open RFI for this cell' : 'Add RFI for this cell'}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openRfiDialog(row.id, col.key, typeof col.name === 'string' ? col.name : undefined);
                      }}
                    >
                      <MessageSquare className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          },
        };
      }),
    ];
  }, [gridConfig, lookupOptions, activeCell, isCellInSelection, columnWidths, openRfiDialog, rfiCells, rfiColumns]);

  const handleColumnResize = useCallback((colOrIdx: any, widthMaybe: any) => {
    let colKey: string | null = null;
    let nextWidth: number | null = null;

    if (typeof colOrIdx === 'number') {
      const c = (columns as any[])?.[colOrIdx];
      colKey = c?.key ? String(c.key) : null;
      nextWidth = Number(widthMaybe);
    } else {
      colKey = colOrIdx?.key ? String(colOrIdx.key) : null;
      nextWidth = Number(widthMaybe);
    }

    if (!colKey || colKey === 'select-row') return;
    if (!Number.isFinite(nextWidth)) return;

    const clamped = Math.max(60, Math.min(800, Math.round(nextWidth)));
    setColumnWidths((prev) => ({ ...prev, [colKey as string]: clamped }));
  }, [columns]);

  const handleCellClick = useCallback((args: any, event: any) => {
    try {
      const colKey = String(args?.column?.key || '').trim();
      if (!colKey || colKey === 'select-row') return;

      // If this is a dropdown/lookup-configured column, open the editor on single click.
      // react-data-grid only enters edit mode on double click by default.
      const cfg = gridConfig[colKey];
      const inputType = String(cfg?.inputType || '').toLowerCase();
      const isDropdown = (inputType === 'dropdown' || inputType === 'lookup') && !!cfg?.lookupTable;
      if (isDropdown && !event?.shiftKey && !event?.metaKey && !event?.ctrlKey && typeof args?.selectCell === 'function') {
        try {
          args.selectCell(true);
        } catch {
          // ignore
        }
      }

      const rowId = String(args?.row?.id || '').trim();
      if (!rowId) return;
      const rowIdx = rowsRef.current.findIndex((r) => r.id === rowId);
      if (rowIdx < 0) return;

      const next = { rowIdx, colKey };
      setActiveCell(next);
      if (event?.shiftKey && selection?.anchor) {
        setSelection({ anchor: selection.anchor, focus: next });
      } else {
        setSelection({ anchor: next, focus: next });
      }

      // Ensure copy/paste handlers can fire via container capture
      gridContainerRef.current?.focus?.();
    } catch {
      // no-op
    }
  }, [selection, gridConfig]);

  const handleCopyCapture = useCallback((e: React.ClipboardEvent) => {
    const tsv = buildTsvFromSelection();
    if (!tsv) return;
    try {
      e.clipboardData.setData('text/plain', tsv);
      e.preventDefault();
    } catch {
      // ignore
    }
  }, [buildTsvFromSelection]);

  const handlePasteCapture = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    // Only handle multi-cell paste when we have an active cell/selection.
    if (!activeCell && !selection) return;
    e.preventDefault();
    applyPasteTsv(text);
  }, [applyPasteTsv, activeCell, selection]);

  const handleKeyDownCapture = useCallback((e: React.KeyboardEvent) => {
    // Fill-down (Ctrl/Cmd + D)
    if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
      if (!selectionRange) return;
      e.preventDefault();

      const { startRow, endRow, startColIdx, endColIdx, keys } = selectionRange;
      if (endRow <= startRow) return;

      const currentRows = rowsRef.current;
      const nextRows = currentRows.map((r) => ({ ...r }));
      const changedById = new Map<string, Record<string, any>>();

      // Copy values from the top row of the selection downwards within the selection.
      const sourceRow = currentRows[startRow];
      if (!sourceRow) return;

      for (let r = startRow + 1; r <= endRow; r++) {
        const target = nextRows[r];
        const prev = currentRows[r];
        if (!target || !prev) continue;

        for (let c = startColIdx; c <= endColIdx; c++) {
          const key = keys[c];
          // only fill editable cells
          const colDef = columns.find((cc: any) => String(cc?.key || '') === key);
          if (!(colDef as any)?.editable) continue;

          const nextVal = (sourceRow as any)[key];
          if (Object.is((prev as any)[key], nextVal)) continue;
          (target as any)[key] = nextVal;
          const patch = changedById.get(target.id) || {};
          patch[key] = nextVal;
          changedById.set(target.id, patch);
        }
      }

      const updates = Array.from(changedById.entries()).map(([id, changes]) => ({ id, changes }));
      if (!updates.length) return;

      setRows(nextRows);
      rowsRef.current = nextRows;
      bulkPersist(updates);
    }
  }, [selectionRange, columns, bulkPersist]);

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

  const currentColumnConfig = configModalColumn ? COLUMNS.find(c => c.key === configModalColumn) : null;

  return (
    <div className="space-y-4">
      {/* Column Configuration Modal */}
      {configModalOpen && currentColumnConfig && configModalColumn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{currentColumnConfig.name}</h2>
              <p className="text-xs text-slate-500 mt-1">{currentColumnConfig.key}</p>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Input Type</label>
                <select 
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  value={gridConfig[configModalColumn]?.inputType || 'text'}
                  onChange={(e) => setGridConfig(prev => ({
                    ...prev,
                    [configModalColumn]: {...(prev[configModalColumn] || {}), inputType: e.target.value}
                  }))}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="dropdown">Dropdown</option>
                  <option value="formula">Formula</option>
                  <option value="date">Date</option>
                </select>
              </div>

              {gridConfig[configModalColumn]?.inputType === 'dropdown' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Lookup Table</label>
                  <select 
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    value={gridConfig[configModalColumn]?.lookupTable || ''}
                    onChange={(e) => setGridConfig(prev => ({
                      ...prev,
                      [configModalColumn]: {...(prev[configModalColumn] || {}), lookupTable: e.target.value}
                    }))}
                  >
                    <option value="">Select a lookup table...</option>
                    <option value="hinges">Hinges (IronmongeryPrices)</option>
                    <option value="locks">Locks (IronmongeryPrices)</option>
                    <option value="glass">Glass Types (GlassPrices)</option>
                    <option value="doorCore">Door Core (DoorCorePrices)</option>
                  </select>
                </div>
              )}

              {gridConfig[configModalColumn]?.inputType === 'formula' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Formula</label>
                  <textarea 
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono"
                    rows={3}
                    placeholder="e.g., =leafHeight * masterLeafWidth"
                    value={gridConfig[configModalColumn]?.formula || ''}
                    onChange={(e) => setGridConfig(prev => ({
                      ...prev,
                      [configModalColumn]: {...(prev[configModalColumn] || {}), formula: e.target.value}
                    }))}
                  />
                  <p className="text-xs text-slate-500 mt-1">Use field names with = prefix</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Link to Component</label>
                <select 
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  value={gridConfig[configModalColumn]?.componentLink || ''}
                  onChange={(e) => setGridConfig(prev => ({
                    ...prev,
                    [configModalColumn]: {...(prev[configModalColumn] || {}), componentLink: e.target.value}
                  }))}
                >
                  <option value="">None</option>
                  <option value="hinges">Hinges Component</option>
                  <option value="locks">Locks Component</option>
                  <option value="glass">Vision Glass Component</option>
                  <option value="doorBlank">Door Blank Component</option>
                </select>
                {gridConfig[configModalColumn]?.componentLink && (
                  <p className="text-xs text-blue-600 mt-2">✓ Component will be auto-created when filled</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id={`required-${configModalColumn}`}
                  className="rounded"
                  checked={gridConfig[configModalColumn]?.required || false}
                  onChange={(e) => setGridConfig(prev => ({
                    ...prev,
                    [configModalColumn]: {...(prev[configModalColumn] || {}), required: e.target.checked}
                  }))}
                />
                <label htmlFor={`required-${configModalColumn}`} className="text-sm text-slate-700">Required field</label>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <button 
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-sm font-semibold text-slate-700"
                onClick={() => {
                  setConfigModalOpen(false);
                  setConfigModalColumn('');
                }}
              >
                Close
              </button>
              <button 
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold text-white"
                onClick={() => {
                  // Save configuration to database
                  apiFetch(`/api/grid-config/${configModalColumn}`, {
                    method: 'POST',
                    json: gridConfig[configModalColumn] || {}
                  }).catch(err => console.error('Failed to save config:', err));
                  
                  setConfigModalOpen(false);
                  setConfigModalColumn('');
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white/60 backdrop-blur-sm p-4 rounded-lg shadow border border-white/20">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-slate-700">
            {selectedRows.size} of {rows.length} doors selected
          </span>
          <Button
            variant="outline"
            disabled={mutatingRows}
            onClick={async () => {
              try {
                setMutatingRows(true);
                await ensureRowCount(rowsRef.current.length + 1);
              } catch (err: any) {
                setError(err?.message || 'Failed to add row');
              } finally {
                setMutatingRows(false);
              }
            }}
          >
            {mutatingRows ? 'Working…' : 'Add Row'}
          </Button>
          <Button
            variant="outline"
            disabled={mutatingRows || selectedRows.size === 0}
            onClick={async () => {
              const ids = Array.from(selectedRows || []);
              if (!ids.length) return;
              const ok = window.confirm(`Delete ${ids.length} row${ids.length === 1 ? '' : 's'}? This cannot be undone.`);
              if (!ok) return;
              try {
                setMutatingRows(true);
                setSelectedRows(new Set());
                await bulkDeleteRows(ids);
                await loadImport({ selectAll: false });
              } catch (err: any) {
                setError(err?.message || 'Failed to delete rows');
              } finally {
                setMutatingRows(false);
              }
            }}
          >
            Delete Row{selectedRows.size === 1 ? '' : 's'}
          </Button>
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
      <div
        ref={gridContainerRef}
        tabIndex={0}
        onCopyCapture={handleCopyCapture}
        onPasteCapture={handlePasteCapture}
        onKeyDownCapture={handleKeyDownCapture}
        className="h-[600px] bg-white rounded-lg shadow border border-white/20 outline-none"
        onMouseDown={() => gridContainerRef.current?.focus()}
      >
        <DataGrid
          columns={columns}
          rows={rows}
          rowKeyGetter={(row) => row.id}
          selectedRows={selectedRowsSet}
          onSelectedRowsChange={setSelectedRows}
          onRowsChange={handleRowsChange}
          onCellClick={handleCellClick}
          onColumnResize={handleColumnResize as any}
          className="rdg-light fill-grid"
          style={{ height: '100%' }}
          rowHeight={35}
          headerRowHeight={56}
          enableVirtualization
        />
      </div>

      <RfiDialog
        open={rfiDialogOpen}
        onOpenChange={setRfiDialogOpen}
        rfi={currentRfi}
        rowId={rfiContext?.rowId ?? null}
        columnKey={rfiContext?.columnKey ?? ''}
        columnName={rfiContext?.columnName}
        onSave={handleSaveRfi}
        mode={rfiMode}
      />

      {/* Summary */}
      <div className="bg-white/60 backdrop-blur-sm p-4 rounded-lg shadow border border-white/20">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-700">Total Selected:</span>
          <span className="text-lg font-bold text-green-700">
            £{rows.filter(r => selectedRows.has(r.id)).reduce((sum, r) => sum + (Number(r.lineTotal) || 0), 0).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Column Configuration Modal */}
      <ColumnHeaderModal
        isOpen={configModalOpen}
        fieldName={configModalColumn}
        currentConfig={gridConfig[configModalColumn]}
        onClose={() => setConfigModalOpen(false)}
        onSave={(config) => saveColumnConfig(configModalColumn, config)}
        availableLookupTables={availableLookupTables}
        availableComponents={availableComponents}
        availableFields={availableFields}
      />
    </div>
  );
}
