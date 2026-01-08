"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import DataGrid, { Column, SelectColumn, RenderEditCellProps } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import { Button } from "@/components/ui/button";
import { Settings, Download } from "lucide-react";
import { ColumnHeaderModal } from "@/components/FireDoorGridConfig";

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

export default function FireDoorSpreadsheet({ importId, onQuoteCreated, onComponentCreated }: FireDoorSpreadsheetProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FireDoorRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configModalColumn, setConfigModalColumn] = useState<string>("");
  const [gridConfig, setGridConfig] = useState<Record<string, any>>({});
  const [lookupOptions, setLookupOptions] = useState<Record<string, Array<{value: string; label: string}>>>({});
  const [error, setError] = useState<string | null>(null);
  const [gridConfig, setGridConfig] = useState<Record<string, any>>({});
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configModalColumn, setConfigModalColumn] = useState<string | null>(null);
  const [lookupOptions, setLookupOptions] = useState<Record<string, Array<{value: string, label: string}>>>({});

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
              optionsMap[table.tableName] = table.rows.map((row: any) => ({
                value: row.value || row.id || '',
                label: row.label || row.name || row.description || row.value || ''
              }));
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

    return (
      <select
        className="w-full h-full px-2 border-0 outline-none bg-white"
        value={row[column.key] || ''}
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
  const evaluateFormula = (formula: string, row: FireDoorRow): any => {
    try {
      // Simple formula evaluation - replace field names with values
      let expression = formula;
      Object.keys(row).forEach(key => {
        const value = row[key];
        if (typeof value === 'number') {
          expression = expression.replace(new RegExp(`\\b${key}\\b`, 'g'), String(value));
        }
      });
      
      // Evaluate using Function constructor (safe in this context)
      return new Function('return ' + expression)();
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
        const isDropdown = fieldConfig?.inputType === 'dropdown' && fieldConfig?.lookupTable;
        const isFormula = fieldConfig?.inputType === 'formula';
        
        return {
          ...col,
          editable: isFormula ? false : col.editable,
          headerCellClass: "cursor-pointer hover:bg-blue-50 transition-colors",
          renderHeaderCell: (props: any) => (
            <div 
              className="flex items-center justify-between gap-1 h-full px-2 group"
              onClick={(e) => {
                e.stopPropagation();
                setConfigModalColumn(col.key);
                setConfigModalOpen(true);
              }}
            >
              <span className="truncate" title={col.name}>{col.name}</span>
              <Settings className="w-3 h-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ),
          renderEditCell: isDropdown ? DropdownCell : undefined,
          renderCell: (props: any) => {
            const row = props.row;
            let value = row[col.key];
            
            // Evaluate formula if configured
            if (isFormula && fieldConfig?.formula) {
              value = evaluateFormula(fieldConfig.formula, row);
            }
            
            if (value === null || value === undefined) return <div className="px-2 text-gray-400">-</div>;
            
            // Format currency columns
            if (['labourCost', 'materialCost', 'unitValue', 'lineTotal', 'priceEa', 'linePrice'].includes(col.key)) {
              return <div className="px-2 font-semibold text-green-700">£{Number(value).toFixed(2)}</div>;
            }
            
            // Show lookup label if configured
            if (isDropdown && fieldConfig?.lookupTable) {
              const options = lookupOptions[fieldConfig.lookupTable] || [];
              const option = options.find(opt => opt.value === value);
              return <div className="px-2">{option?.label || value}</div>;
            }
            
            // Formula indicator
            if (isFormula) {
              return <div className="px-2 bg-blue-50 text-blue-700 font-mono text-xs">{value}</div>;
            }
          
            return <div className="px-2">{value}</div>;
          },
        };
      }),
    ];
  }, [gridConfig, lookupOptions]);

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
                  setConfigModalColumn(null);
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
                  setConfigModalColumn(null);
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

      {/* Column Configuration Modal */}
      <ColumnHeaderModal
        isOpen={configModalOpen}
        fieldName={configModalColumn}
        currentConfig={gridConfig[configModalColumn]}
        onClose={() => setConfigModalOpen(false)}
        onSave={(config) => saveColumnConfig(configModalColumn, config)}
      />
    </div>
  );
}
