"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import DataGrid, { Column, RenderEditCellProps, SelectColumn } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

interface FireDoorLineItem {
  id?: string;
  rowIndex: number;
  doorRef?: string;
  location?: string;
  
  // SECTION 1: CERTIFICATION & INITIAL SPEC
  certification?: string;
  doorsetType?: string;
  lajRef?: string;
  masterWidth?: number;
  slaveWidth?: number;
  doorHeight?: number;
  core?: string;
  rating?: string;
  coreType?: string;
  
  // SECTION 2: EDGE DIMENSIONS
  top?: number;
  btm?: number;
  hinge?: number;
  me?: number;
  daExposed?: number;
  trim?: number;
  safeHinge?: number;
  pf?: number;
  extra?: number;
  
  // SECTION 3: REDUCED DIMENSIONS
  masterReduced?: number;
  slaveWidthReduced?: number;
  doorHeightReduced?: number;
  coreReduced?: string;
  
  // SECTION 4: NOTES
  notes1?: string;
  notes2?: string;
  
  // SECTION 5: LIPPING
  lajRefLipping?: string;
  doorRefLipping?: string;
  masterWidthLipping?: number;
  slaveWidthLipping?: number;
  doorHeightLipping?: number;
  coreLipping?: string;
  ratingLipping?: string;
  coreTypeLipping?: string;
  material?: string;
  topLipping?: number;
  btmLipping?: number;
  hingeLipping?: number;
  meLipping?: number;
  daExposedLipping?: number;
  lippingDetail?: string;
  masterWidthLipping2?: number;
  
  // SECTION 6: EDGING / 2T
  slaveWidthEdging?: number;
  doorHeightEdging?: number;
  coreEdging?: string;
  masterWidth2T?: number;
  slaveWidth2T?: number;
  doorHeight2T?: number;
  core2T?: string;
  doorType?: string;
  note1Edge?: string;
  note2Edge?: string;
  
  // SECTION 7: FACING / CALIBRATION
  lajRefFacing?: string;
  doorRefFacing?: string;
  masterWidthFacing?: number;
  slaveWidthFacing?: number;
  doorHeightFacing?: number;
  coreFacing?: string;
  coreTypeFacing?: string;
  materialFacing?: string;
  topFacing?: number;
  btmFacing?: number;
  hingeFacing?: number;
  meFacing?: number;
  daExposedFacing?: number;
  calibratedSize?: string;
  masterDoor?: string;
  slaveDoor?: string;
  bookMatching?: string;
  topFinal?: number;
  btmFinal?: number;
  hingeFinal?: number;
  
  // SECTION 8: FINISH / IRONMONGERY
  finishFacing?: string;
  materialFinish?: string;
  topFinish?: number;
  btmFinish?: number;
  hingeFinish?: number;
  meFinish?: number;
  daExposedFinish?: number;
  masterWidthFinish?: number;
  slaveWidthFinish?: number;
  doorHeightFinish?: number;
  coreFinish?: string;
  handingFinish?: string;
  lippingFinish?: string;
  doorFinish?: string;
  beadType?: string;
  glassType?: string;
  vpType?: string;
  vpWidth?: number;
  vpHeight?: number;
  cassetteType?: string;
  intumescentStrip?: string;
  smokeStrip?: string;
  dropSeal?: string;
  hingeQty?: number;
  hingeType?: string;
  lockType?: string;
  latchType?: string;
  cylinderType?: string;
  keeperType?: string;
  
  // SECTION 9: SECONDARY IRONMONGERY
  handleType?: string;
  pullHandleType?: string;
  pullHandleQty?: number;
  flushBoltType?: string;
  flushBoltQty?: number;
  coordinatorType?: string;
  selectorType?: string;
  letterPlateType?: string;
  numeralType?: string;
  knockerType?: string;
  spyholeType?: string;
  chainType?: string;
  closerType?: string;
  closerQty?: number;
  floorSpringType?: string;
  pivotType?: string;
  
  // SECTION 10: FINAL SPEC & FRAME
  masterLeafFinal?: number;
  slaveLeafFinal?: number;
  leafHeightFinal?: number;
  masterFrameWidth?: number;
  slaveFrameWidth?: number;
  frameHeight?: number;
  frameDepth?: number;
  sillType?: string;
  thresholdType?: string;
  weatherSeal?: string;
  architraveType?: string;
  architraveWidth?: number;
  wallType?: string;
  fixingType?: string;
  handingFinal?: string;
  frameFinish?: string;
  frameColour?: string;
  plugType?: string;
  qMarkPlug?: string;
  
  // Pricing
  quantity?: number;
  unitValue?: number;
  lineTotal?: number;
  
  [key: string]: any;
}

interface RfiRecord {
  id: string;
  rowId: string | null;
  columnKey: string;
  message: string;
  status: string;
}

interface FireDoorGridProps {
  lineItems: FireDoorLineItem[];
  onLineItemsChange: (items: FireDoorLineItem[]) => void;
  rfis?: RfiRecord[];
  onAddRfi?: (rowId: string | null, columnKey: string) => void;
  onSelectRfi?: (rfi: RfiRecord) => void;
}

// Dropdown editor factory - creates an editor component for a set of options
function createSelectEditor(options: string[]) {
  return function SelectEditor<TRow>({ 
    row, 
    column, 
    onRowChange, 
    onClose
  }: RenderEditCellProps<TRow>) {
    return (
      <select
        className="w-full h-full border-0 outline-none px-2 bg-white"
        autoFocus
        value={row[column.key as keyof TRow] as string || ''}
        onChange={(e) => {
          onRowChange({ ...row, [column.key]: e.target.value }, true);
          onClose(true);
        }}
        onBlur={() => onClose(false)}
      >
        <option value="">--</option>
        {options.map((opt: string) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  };
}

export function FireDoorGrid({
  lineItems,
  onLineItemsChange,
  rfis = [],
  onAddRfi,
  onSelectRfi,
}: FireDoorGridProps) {
  const [rows, setRows] = useState<FireDoorLineItem[]>(lineItems);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [doorCores, setDoorCores] = useState<any[]>([]);
  const [ironmongeryItems, setIronmongeryItems] = useState<any[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [highlightedColumn, setHighlightedColumn] = useState<string | null>(null);
  const [fillDownMode, setFillDownMode] = useState<{ columnKey: string; sourceRowIdx: number } | null>(null);
  const [showColumnManager, setShowColumnManager] = useState(false);

  // Sync with parent
  useEffect(() => {
    setRows(lineItems);
  }, [lineItems]);

  // Fetch lookup data
  useEffect(() => {
    async function fetchLookups() {
      try {
        const [coresData, ironmongeryData] = await Promise.all([
          apiFetch('/door-cores').catch(() => []),
          apiFetch('/ironmongery-items').catch(() => [])
        ]);
        setDoorCores(Array.isArray(coresData) ? coresData : []);
        setIronmongeryItems(Array.isArray(ironmongeryData) ? ironmongeryData : []);
      } catch (error) {
        console.error('Error fetching lookups:', error);
      }
    }
    fetchLookups();
  }, []);

  // Build dropdown options
  const coreOptions = useMemo(() => 
    doorCores.map(c => c.code || c.name).filter(Boolean),
    [doorCores]
  );

  const coreTypeOptions = useMemo(() => 
    [...new Set(doorCores.map(c => c.coreType).filter(Boolean))],
    [doorCores]
  );

  const materialOptions = useMemo(() => 
    [...new Set(doorCores.map(c => c.material).filter(Boolean))],
    [doorCores]
  );

  const hingeTypeOptions = useMemo(() =>
    [...new Set(ironmongeryItems.filter(i => i.category === 'hinge').map(i => i.name))],
    [ironmongeryItems]
  );

  const lockTypeOptions = useMemo(() =>
    [...new Set(ironmongeryItems.filter(i => i.category === 'lock').map(i => i.name))],
    [ironmongeryItems]
  );

  const handleTypeOptions = useMemo(() =>
    [...new Set(ironmongeryItems.filter(i => i.category === 'handle').map(i => i.name))],
    [ironmongeryItems]
  );

  const doorsetTypeOptions = ['Single', 'Double', 'Single with sidelight', 'Double with sidelight'];
  const ratingOptions = ['FD30', 'FD60', 'FD90', 'FD120'];

  // Build RFI maps for highlighting (must be before columns definition)
  const cellRfiMap = useMemo(() => {
    const map: Record<string, RfiRecord[]> = {};
    rfis.filter(r => r.rowId).forEach(r => {
      const key = `${r.rowId}:${r.columnKey}`;
      map[key] = map[key] || [];
      map[key].push(r);
    });
    return map;
  }, [rfis]);

  // Handle row updates with auto-calculations
  const handleRowsChange = useCallback((newRows: FireDoorLineItem[]) => {
    // Auto-calculate reduced dimensions and line totals
    const updatedRows = newRows.map(row => {
      // Calculate reduced dimensions
      if (row.masterWidth !== undefined) {
        row.masterReduced = (row.masterWidth || 0) - (row.top || 0) - (row.btm || 0) 
          - (row.hinge || 0) - (row.safeHinge || 0) - (row.pf || 0) 
          + (row.trim || 0) + (row.extra || 0);
      }
      
      if (row.slaveWidth !== undefined) {
        row.slaveReduced = (row.slaveWidth || 0) - (row.top || 0) - (row.btm || 0) 
          - (row.safe || 0) - (row.pf || 0) 
          + (row.trim || 0) + (row.extra || 0);
      }
      
      if (row.doorHeight !== undefined) {
        row.heightReduced = (row.doorHeight || 0) - (row.head || 0) - (row.sill || 0);
      }
      
      // Calculate line total if all pricing fields exist
      if (row.doorCost !== undefined && row.frameLabourCost !== undefined && 
          row.otherCost !== undefined && row.lippingCost !== undefined) {
        row.lineTotal = (row.doorCost || 0) + (row.frameLabourCost || 0) + 
                        (row.otherCost || 0) + (row.lippingCost || 0);
      }
      
      return row;
    });
    
    setRows(updatedRows);
    onLineItemsChange(updatedRows);
  }, [onLineItemsChange]);

  // Column definitions
  const columns = useMemo<Column<FireDoorLineItem>[]>(() => [
    SelectColumn,
    {
      key: 'rowIndex',
      name: '#',
      width: 60,
      frozen: true,
      renderCell: ({ rowIdx }) => rowIdx + 1,
    },
    {
      key: 'doorRef',
      name: 'Door Ref',
      width: 140,
      frozen: true,
      editable: true,
      cellClass: (row) => {
        const rowId = row.id || `row-${row.rowIndex}`;
        const hasRfi = cellRfiMap[`${rowId}:doorRef`];
        return hasRfi ? 'bg-orange-50 border-l-4 border-l-orange-400' : '';
      },
    },
    {
      key: 'location',
      name: 'Location',
      width: 140,
      frozen: true,
      editable: true,
    },
    
    // SECTION 1: Certification & Initial Spec
    { 
      key: 'certification', 
      name: 'Certification', 
      width: 130, 
      editable: true,
      cellClass: (row) => {
        const rowId = row.id || `row-${row.rowIndex}`;
        return cellRfiMap[`${rowId}:certification`] ? 'bg-orange-50' : '';
      },
    },
    { 
      key: 'doorsetType', 
      name: 'Doorset Type', 
      width: 150, 
      editable: true,
      renderEditCell: createSelectEditor(doorsetTypeOptions),
      cellClass: (row) => {
        const rowId = row.id || `row-${row.rowIndex}`;
        return cellRfiMap[`${rowId}:doorsetType`] ? 'bg-orange-50' : '';
      },
    },
    { key: 'lajRef', name: 'LAJ Ref', width: 110, editable: true },
    { 
      key: 'masterWidth', 
      name: 'Master Width (mm)', 
      width: 150, 
      editable: true,
      cellClass: (row) => {
        const rowId = row.id || `row-${row.rowIndex}`;
        return cellRfiMap[`${rowId}:masterWidth`] ? 'bg-orange-50' : '';
      },
    },
    { 
      key: 'slaveWidth', 
      name: 'Slave Width (mm)', 
      width: 150, 
      editable: true,
      cellClass: (row) => {
        const rowId = row.id || `row-${row.rowIndex}`;
        return cellRfiMap[`${rowId}:slaveWidth`] ? 'bg-orange-50' : '';
      },
    },
    { 
      key: 'doorHeight', 
      name: 'Door Height (mm)', 
      width: 150, 
      editable: true,
      cellClass: (row) => {
        const rowId = row.id || `row-${row.rowIndex}`;
        return cellRfiMap[`${rowId}:doorHeight`] ? 'bg-orange-50' : '';
      },
    },
    { 
      key: 'core', 
      name: 'Core', 
      width: 150, 
      editable: true,
      renderEditCell: createSelectEditor(coreOptions),
      cellClass: (row) => {
        const rowId = row.id || `row-${row.rowIndex}`;
        return cellRfiMap[`${rowId}:core`] ? 'bg-orange-50' : '';
      },
    },
    { 
      key: 'rating', 
      name: 'Rating', 
      width: 100, 
      editable: true,
      renderEditCell: createSelectEditor(ratingOptions),
      cellClass: (row) => {
        const rowId = row.id || `row-${row.rowIndex}`;
        return cellRfiMap[`${rowId}:rating`] ? 'bg-orange-50' : '';
      },
    },
    { 
      key: 'coreType', 
      name: 'Core Type', 
      width: 120, 
      editable: true,
      cellClass: (row) => {
        const rowId = row.id || `row-${row.rowIndex}`;
        return cellRfiMap[`${rowId}:coreType`] ? 'bg-orange-50' : '';
      },
    },
    
    // SECTION 2: Edge Dimensions
    { key: 'top', name: 'Top', width: 80, editable: true },
    { key: 'btm', name: 'Bottom', width: 80, editable: true },
    { key: 'hinge', name: 'Hinge', width: 80, editable: true },
    { key: 'me', name: 'M/E', width: 80, editable: true },
    { key: 'daExposed', name: 'D/A Exposed', width: 120, editable: true },
    { key: 'trim', name: 'Trim', width: 80, editable: true },
    { key: 'safeHinge', name: 'Safe Hinge', width: 110, editable: true },
    { key: 'pf', name: 'P/F', width: 80, editable: true },
    { key: 'extra', name: 'Extra', width: 80, editable: true },
    
    // SECTION 3: Reduced Dimensions (calculated)
    { 
      key: 'masterReduced', 
      name: 'Master (R)', 
      width: 120, 
      editable: false,
      cellClass: 'bg-gray-50',
    },
    { 
      key: 'slaveWidthReduced', 
      name: 'Slave Width (R)', 
      width: 140, 
      editable: false,
      cellClass: 'bg-gray-50',
    },
    { 
      key: 'doorHeightReduced', 
      name: 'Door Height (R)', 
      width: 140, 
      editable: false,
      cellClass: 'bg-gray-50',
    },
    
    // SECTION 4: Notes
    { 
      key: 'notes1', 
      name: 'Notes 1', 
      width: 200, 
      editable: true,
      cellClass: (row) => {
        const rowId = row.id || `row-${row.rowIndex}`;
        return cellRfiMap[`${rowId}:notes1`] ? 'bg-orange-50' : '';
      },
    },
    { 
      key: 'notes2', 
      name: 'Notes 2', 
      width: 200, 
      editable: true,
      cellClass: (row) => {
        const rowId = row.id || `row-${row.rowIndex}`;
        return cellRfiMap[`${rowId}:notes2`] ? 'bg-orange-50' : '';
      },
    },
    
    // SECTION 5: LIPPING (16 fields)
    { key: 'lajRefLipping', name: 'LAJ Ref (Lipping)', width: 130, editable: true },
    { key: 'doorRefLipping', name: 'Door Ref (Lipping)', width: 140, editable: true },
    { key: 'masterWidthLipping', name: 'Master Width (Lipping)', width: 160, editable: true },
    { key: 'slaveWidthLipping', name: 'Slave Width (Lipping)', width: 160, editable: true },
    { key: 'doorHeightLipping', name: 'Door Height (Lipping)', width: 160, editable: true },
    { key: 'coreLipping', name: 'Core (Lipping)', width: 130, editable: true, renderEditCell: createSelectEditor(coreOptions) },
    { key: 'ratingLipping', name: 'Rating (Lipping)', width: 120, editable: true, renderEditCell: createSelectEditor(ratingOptions) },
    { key: 'coreTypeLipping', name: 'Core Type (Lipping)', width: 150, editable: true, renderEditCell: createSelectEditor(coreTypeOptions) },
    { key: 'material', name: 'Material', width: 130, editable: true, renderEditCell: createSelectEditor(materialOptions) },
    { key: 'topLipping', name: 'Top (Lipping)', width: 110, editable: true },
    { key: 'btmLipping', name: 'Bottom (Lipping)', width: 120, editable: true },
    { key: 'hingeLipping', name: 'Hinge (Lipping)', width: 120, editable: true },
    { key: 'meLipping', name: 'M/E (Lipping)', width: 110, editable: true },
    { key: 'daExposedLipping', name: 'D/A Exposed (Lipping)', width: 150, editable: true },
    { key: 'lippingDetail', name: 'Lipping Detail', width: 150, editable: true },
    { key: 'masterWidthLipping2', name: 'Master Width 2 (Lipping)', width: 170, editable: true },
    
    // SECTION 6: EDGING / 2T (10 fields)
    { key: 'slaveWidthEdging', name: 'Slave Width (Edging)', width: 150, editable: true },
    { key: 'doorHeightEdging', name: 'Door Height (Edging)', width: 150, editable: true },
    { key: 'coreEdging', name: 'Core (Edging)', width: 130, editable: true },
    { key: 'masterWidth2T', name: 'Master Width (2T)', width: 140, editable: true },
    { key: 'slaveWidth2T', name: 'Slave Width (2T)', width: 140, editable: true },
    { key: 'doorHeight2T', name: 'Door Height (2T)', width: 140, editable: true },
    { key: 'core2T', name: 'Core (2T)', width: 120, editable: true },
    { key: 'doorType', name: 'Door Type', width: 130, editable: true },
    { key: 'note1Edge', name: 'Note 1 (Edge)', width: 150, editable: true },
    { key: 'note2Edge', name: 'Note 2 (Edge)', width: 150, editable: true },
    
    // SECTION 7: FACING / CALIBRATION (20 fields)
    { key: 'lajRefFacing', name: 'LAJ Ref (Facing)', width: 140, editable: true },
    { key: 'doorRefFacing', name: 'Door Ref (Facing)', width: 140, editable: true },
    { key: 'masterWidthFacing', name: 'Master Width (Facing)', width: 160, editable: true },
    { key: 'slaveWidthFacing', name: 'Slave Width (Facing)', width: 160, editable: true },
    { key: 'doorHeightFacing', name: 'Door Height (Facing)', width: 160, editable: true },
    { key: 'coreFacing', name: 'Core (Facing)', width: 130, editable: true },
    { key: 'coreTypeFacing', name: 'Core Type (Facing)', width: 140, editable: true },
    { key: 'materialFacing', name: 'Material (Facing)', width: 140, editable: true },
    { key: 'topFacing', name: 'Top (Facing)', width: 110, editable: true },
    { key: 'btmFacing', name: 'Bottom (Facing)', width: 120, editable: true },
    { key: 'hingeFacing', name: 'Hinge (Facing)', width: 120, editable: true },
    { key: 'meFacing', name: 'M/E (Facing)', width: 110, editable: true },
    { key: 'daExposedFacing', name: 'D/A Exposed (Facing)', width: 150, editable: true },
    { key: 'calibratedSize', name: 'Calibrated Size', width: 140, editable: true },
    { key: 'masterDoor', name: 'Master Door', width: 130, editable: true },
    { key: 'slaveDoor', name: 'Slave Door', width: 130, editable: true },
    { key: 'bookMatching', name: 'Book Matching', width: 130, editable: true },
    { key: 'topFinal', name: 'Top (Final)', width: 110, editable: true },
    { key: 'btmFinal', name: 'Bottom (Final)', width: 120, editable: true },
    { key: 'hingeFinal', name: 'Hinge (Final)', width: 120, editable: true },
    
    // SECTION 8: FINISH / IRONMONGERY (29 fields)
    { key: 'finishFacing', name: 'Finish Facing', width: 140, editable: true },
    { key: 'materialFinish', name: 'Material (Finish)', width: 140, editable: true },
    { key: 'topFinish', name: 'Top (Finish)', width: 110, editable: true },
    { key: 'btmFinish', name: 'Bottom (Finish)', width: 120, editable: true },
    { key: 'hingeFinish', name: 'Hinge (Finish)', width: 120, editable: true },
    { key: 'meFinish', name: 'M/E (Finish)', width: 110, editable: true },
    { key: 'daExposedFinish', name: 'D/A Exposed (Finish)', width: 150, editable: true },
    { key: 'masterWidthFinish', name: 'Master Width (Finish)', width: 160, editable: true },
    { key: 'slaveWidthFinish', name: 'Slave Width (Finish)', width: 160, editable: true },
    { key: 'doorHeightFinish', name: 'Door Height (Finish)', width: 160, editable: true },
    { key: 'coreFinish', name: 'Core (Finish)', width: 130, editable: true },
    { key: 'handingFinish', name: 'Handing (Finish)', width: 130, editable: true },
    { key: 'lippingFinish', name: 'Lipping Finish', width: 140, editable: true },
    { key: 'doorFinish', name: 'Door Finish', width: 130, editable: true },
    { key: 'beadType', name: 'Bead Type', width: 120, editable: true },
    { key: 'glassType', name: 'Glass Type', width: 120, editable: true },
    { key: 'vpType', name: 'VP Type', width: 120, editable: true },
    { key: 'vpWidth', name: 'VP Width', width: 110, editable: true },
    { key: 'vpHeight', name: 'VP Height', width: 110, editable: true },
    { key: 'cassetteType', name: 'Cassette Type', width: 130, editable: true },
    { key: 'intumescentStrip', name: 'Intumescent Strip', width: 150, editable: true },
    { key: 'smokeStrip', name: 'Smoke Strip', width: 120, editable: true },
    { key: 'dropSeal', name: 'Drop Seal', width: 120, editable: true },
    { key: 'hingeQty', name: 'Hinge Qty', width: 100, editable: true },
    { key: 'hingeType', name: 'Hinge Type', width: 130, editable: true, renderEditCell: createSelectEditor(hingeTypeOptions) },
    { key: 'lockType', name: 'Lock Type', width: 130, editable: true, renderEditCell: createSelectEditor(lockTypeOptions) },
    { key: 'latchType', name: 'Latch Type', width: 130, editable: true },
    { key: 'cylinderType', name: 'Cylinder Type', width: 130, editable: true },
    { key: 'keeperType', name: 'Keeper Type', width: 130, editable: true },
    
    // SECTION 9: SECONDARY IRONMONGERY (16 fields)
    { key: 'handleType', name: 'Handle Type', width: 130, editable: true, renderEditCell: createSelectEditor(handleTypeOptions) },
    { key: 'pullHandleType', name: 'Pull Handle Type', width: 150, editable: true },
    { key: 'pullHandleQty', name: 'Pull Handle Qty', width: 140, editable: true },
    { key: 'flushBoltType', name: 'Flush Bolt Type', width: 140, editable: true },
    { key: 'flushBoltQty', name: 'Flush Bolt Qty', width: 130, editable: true },
    { key: 'coordinatorType', name: 'Coordinator Type', width: 150, editable: true },
    { key: 'selectorType', name: 'Selector Type', width: 130, editable: true },
    { key: 'letterPlateType', name: 'Letter Plate Type', width: 150, editable: true },
    { key: 'numeralType', name: 'Numeral Type', width: 130, editable: true },
    { key: 'knockerType', name: 'Knocker Type', width: 130, editable: true },
    { key: 'spyholeType', name: 'Spyhole Type', width: 130, editable: true },
    { key: 'chainType', name: 'Chain Type', width: 120, editable: true },
    { key: 'closerType', name: 'Closer Type', width: 130, editable: true },
    { key: 'closerQty', name: 'Closer Qty', width: 120, editable: true },
    { key: 'floorSpringType', name: 'Floor Spring Type', width: 150, editable: true },
    { key: 'pivotType', name: 'Pivot Type', width: 120, editable: true },
    
    // SECTION 10: FINAL SPEC & FRAME (19 fields)
    { key: 'masterLeafFinal', name: 'Master Leaf (Final)', width: 150, editable: true },
    { key: 'slaveLeafFinal', name: 'Slave Leaf (Final)', width: 150, editable: true },
    { key: 'leafHeightFinal', name: 'Leaf Height (Final)', width: 150, editable: true },
    { key: 'masterFrameWidth', name: 'Master Frame Width', width: 160, editable: true },
    { key: 'slaveFrameWidth', name: 'Slave Frame Width', width: 160, editable: true },
    { key: 'frameHeight', name: 'Frame Height', width: 130, editable: true },
    { key: 'frameDepth', name: 'Frame Depth', width: 130, editable: true },
    { key: 'sillType', name: 'Sill Type', width: 120, editable: true },
    { key: 'thresholdType', name: 'Threshold Type', width: 140, editable: true },
    { key: 'weatherSeal', name: 'Weather Seal', width: 130, editable: true },
    { key: 'architraveType', name: 'Architrave Type', width: 140, editable: true },
    { key: 'architraveWidth', name: 'Architrave Width', width: 140, editable: true },
    { key: 'wallType', name: 'Wall Type', width: 120, editable: true },
    { key: 'fixingType', name: 'Fixing Type', width: 130, editable: true },
    { key: 'handingFinal', name: 'Handing (Final)', width: 140, editable: true },
    { key: 'frameFinish', name: 'Frame Finish', width: 130, editable: true },
    { key: 'frameColour', name: 'Frame Colour', width: 130, editable: true },
    { key: 'plugType', name: 'Plug Type', width: 120, editable: true },
    { key: 'qMarkPlug', name: 'Q-Mark Plug', width: 130, editable: true },
    
    // PRICING (pinned right)
    { 
      key: 'quantity', 
      name: 'Qty', 
      width: 80, 
      editable: true,
      frozen: true,
      cellClass: (row) => {
        const rowId = row.id || `row-${row.rowIndex}`;
        return cellRfiMap[`${rowId}:quantity`] ? 'bg-orange-50' : '';
      },
    },
    { 
      key: 'unitValue', 
      name: 'Unit Price (£)', 
      width: 130, 
      editable: true,
      frozen: true,
      renderCell: ({ row }) => row.unitValue ? `£${row.unitValue.toFixed(2)}` : '',
    },
    { 
      key: 'lineTotal', 
      name: 'Line Total (£)', 
      width: 140, 
      editable: false,
      frozen: true,
      cellClass: 'bg-blue-50 font-semibold',
      renderCell: ({ row }) => `£${(row.lineTotal || 0).toFixed(2)}`,
    },
  ], [coreOptions, doorsetTypeOptions, ratingOptions, coreTypeOptions, materialOptions, hingeTypeOptions, lockTypeOptions, handleTypeOptions, cellRfiMap]);

  // Cell click handler for RFI
  const handleCellClick = useCallback((args: { row: FireDoorLineItem; column: Column<FireDoorLineItem> }) => {
    if (!onSelectRfi) return;
    const rowId = args.row.id || `row-${args.row.rowIndex}`;
    const cellKey = `${rowId}:${args.column.key}`;
    const cellRfis = cellRfiMap[cellKey];
    if (cellRfis && cellRfis.length > 0) {
      onSelectRfi(cellRfis[0]);
    }
  }, [cellRfiMap, onSelectRfi]);

  // Filter columns based on hidden columns and add highlighting
  const visibleColumns = useMemo(
    () => columns
      .filter(col => !hiddenColumns.has(col.key as string))
      .map(col => ({
        ...col,
        headerCellClass: highlightedColumn === col.key ? 'bg-blue-100 font-bold' : col.headerCellClass,
        cellClass: (row: FireDoorLineItem) => {
          const baseClass = typeof col.cellClass === 'function' ? col.cellClass(row) : col.cellClass || '';
          const highlightClass = highlightedColumn === col.key ? 'bg-blue-50' : '';
          return [baseClass, highlightClass].filter(Boolean).join(' ');
        },
      })),
    [columns, hiddenColumns, highlightedColumn]
  );

  // Handle header click for column highlighting
  const handleHeaderClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const headerCell = target.closest('[role="columnheader"]');
    if (!headerCell) return;
    
    const colIndex = headerCell.getAttribute('aria-colindex');
    if (!colIndex) return;
    
    const colIdx = parseInt(colIndex) - 1;
    if (colIdx < 0 || colIdx >= visibleColumns.length) return;
    
    const column = visibleColumns[colIdx];
    if (!column || !column.key) return;
    
    setHighlightedColumn(prev => prev === column.key ? null : column.key as string);
  }, [visibleColumns]);

  // Toggle column visibility
  const toggleColumnVisibility = useCallback((columnKey: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
  }, []);

  // Fill down handler
  const handleFillDown = useCallback(() => {
    if (!fillDownMode) return;
    
    const { columnKey, sourceRowIdx } = fillDownMode;
    const sourceValue = rows[sourceRowIdx][columnKey as keyof FireDoorLineItem];
    
    const updatedRows = rows.map((row, idx) => {
      if (idx > sourceRowIdx) {
        return { ...row, [columnKey]: sourceValue };
      }
      return row;
    });
    
    handleRowsChange(updatedRows);
    setFillDownMode(null);
  }, [fillDownMode, rows, handleRowsChange]);

  // Keyboard handler for fill-down (Cmd+D / Ctrl+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        handleFillDown();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFillDown]);

  // Context menu handler for RFI
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!onAddRfi) return;
    
    e.preventDefault();
    const target = e.target as HTMLElement;
    const cell = target.closest('[role="gridcell"]');
    if (!cell) return;

    // Extract aria-colindex and row index from DOM
    const colIndex = cell.getAttribute('aria-colindex');
    const rowElement = cell.closest('[role="row"]');
    const rowIndex = rowElement?.getAttribute('aria-rowindex');
    
    if (!colIndex || !rowIndex) return;

    const rowIdx = parseInt(rowIndex) - 2; // Subtract header rows
    const colIdx = parseInt(colIndex) - 1;
    
    if (colIdx < 0 || colIdx >= columns.length) return;
    
    const column = columns[colIdx];
    if (!column || !column.key) return;
    
    // Determine if this is a valid data row or header
    const isDataRow = rowIdx >= 0 && rowIdx < rows.length;
    const row = isDataRow ? rows[rowIdx] : null;
    const rowId = row ? (row.id || `row-${rowIdx}`) : null;
    
    const menu = document.createElement('div');
    menu.className = 'fixed bg-white border border-gray-300 shadow-lg rounded-md z-[9999] p-1';
    
    // Position menu near cursor with boundary checks
    const menuWidth = 250; // estimated menu width
    const menuHeight = 200; // estimated menu height
    let left = e.clientX;
    let top = e.clientY;
    
    // Check right boundary
    if (left + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - 10;
    }
    
    // Check bottom boundary
    if (top + menuHeight > window.innerHeight) {
      top = window.innerHeight - menuHeight - 10;
    }
    
    // Ensure minimum position
    left = Math.max(10, left);
    top = Math.max(10, top);
    
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    
    // Option for cell-specific RFI
    if (isDataRow) {
      const cellOption = document.createElement('button');
      cellOption.className = 'block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm rounded whitespace-nowrap';
      cellOption.textContent = 'Add RFI for this cell';
      cellOption.onclick = () => {
        onAddRfi(rowId, column.key as string);
        if (document.body.contains(menu)) {
          document.body.removeChild(menu);
        }
      };
      menu.appendChild(cellOption);
    }
    
    // Option for column-wide RFI
    const columnOption = document.createElement('button');
    columnOption.className = 'block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm rounded whitespace-nowrap';
    columnOption.textContent = `Add RFI for column "${column.name}"`;
    columnOption.onclick = () => {
      onAddRfi(null, column.key as string);
      if (document.body.contains(menu)) {
        document.body.removeChild(menu);
      }
    };
    menu.appendChild(columnOption);

    // Option for fill-down (only for data rows)
    if (isDataRow) {
      const fillDownOption = document.createElement('button');
      fillDownOption.className = 'block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm rounded whitespace-nowrap border-t border-gray-200 mt-1 pt-2';
      fillDownOption.textContent = `Fill down "${column.name}"`;
      fillDownOption.onclick = () => {
        setFillDownMode({ columnKey: column.key as string, sourceRowIdx: rowIdx });
        if (document.body.contains(menu)) {
          document.body.removeChild(menu);
        }
      };
      menu.appendChild(fillDownOption);
    }

    // Option for hiding column
    const hideColumnOption = document.createElement('button');
    hideColumnOption.className = 'block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm rounded whitespace-nowrap border-t border-gray-200 mt-1 pt-2';
    hideColumnOption.textContent = `Hide column "${column.name}"`;
    hideColumnOption.onclick = () => {
      toggleColumnVisibility(column.key as string);
      if (document.body.contains(menu)) {
        document.body.removeChild(menu);
      }
    };
    menu.appendChild(hideColumnOption);
    
    document.body.appendChild(menu);
    
    const closeMenu = (event: MouseEvent) => {
      if (!menu.contains(event.target as Node)) {
        if (document.body.contains(menu)) {
          document.body.removeChild(menu);
        }
        document.removeEventListener('click', closeMenu);
      }
    };
    
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }, [onAddRfi, rows, columns, setFillDownMode, toggleColumnVisibility]);

  return (
    <div className="space-y-2">
      {/* Column Management Toolbar */}
      <div className="flex items-center gap-2 pb-2 border-b">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowColumnManager(!showColumnManager)}
          className="flex items-center gap-2"
        >
          <Eye className="h-4 w-4" />
          Manage Columns
        </Button>
        {fillDownMode && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-blue-600 font-medium">
              Fill-down mode active for column "{fillDownMode.columnKey}"
            </span>
            <Button
              size="sm"
              onClick={handleFillDown}
            >
              Apply Fill Down
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFillDownMode(null)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Column Visibility Manager */}
      {showColumnManager && (
        <div className="bg-white border rounded-lg p-4 max-h-[300px] overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {columns.filter(col => col.key !== 'select-row' && col.key !== 'rowIndex').map(col => (
              <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={!hiddenColumns.has(col.key as string)}
                  onChange={() => toggleColumnVisibility(col.key as string)}
                  className="rounded"
                />
                <span className="text-sm">{col.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Grid Container */}
      <div className="h-[600px] w-full" onContextMenu={handleContextMenu} onClick={handleHeaderClick}>
        <DataGrid
          columns={visibleColumns}
          rows={rows}
          onRowsChange={handleRowsChange}
          rowKeyGetter={(row: FireDoorLineItem) => row.id || `row-${row.rowIndex}`}
          selectedRows={selectedRows}
          onSelectedRowsChange={setSelectedRows}
          onCellClick={handleCellClick}
          className="rdg-light fill-grid"
          style={{ height: '100%' }}
          enableVirtualization
          rowHeight={35}
          headerRowHeight={40}
        />
      </div>
      
      <style jsx global>{`
        .rdg {
          border: 1px solid #e2e8f0;
          font-size: 13px;
        }
        .rdg-cell {
          border-right: 1px solid #e2e8f0;
          padding: 0 8px;
          display: flex;
          align-items: center;
        }
        .rdg-header-row {
          background: #f8fafc;
          font-weight: 600;
          border-bottom: 2px solid #cbd5e1;
        }
        .rdg-row:hover {
          background: #f1f5f9;
        }
        .rdg-cell-frozen {
          background: #f8fafc;
        }
        .rdg-cell-frozen:hover {
          background: #f1f5f9;
        }
        .bg-gray-50 {
          background: #f9fafb !important;
        }
        .bg-blue-50 {
          background: #eff6ff !important;
        }
        .bg-orange-50 {
          background: #fff7ed !important;
          border-left: 3px solid #fb923c !important;
        }
        .border-l-4 {
          border-left-width: 4px !important;
        }
        .border-l-orange-400 {
          border-left-color: #fb923c !important;
        }
        .font-semibold {
          font-weight: 600;
        }
        .fill-grid {
          block-size: 100%;
        }
      `}</style>
    </div>
  );
}
