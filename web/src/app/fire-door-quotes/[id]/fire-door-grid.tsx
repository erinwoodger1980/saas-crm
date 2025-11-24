"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ColDef,
  ColGroupDef,
  GridApi,
  GridReadyEvent,
  CellValueChangedEvent,
  GetContextMenuItemsParams,
  MenuItemDef,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

interface FireDoorLineItem {
  id?: string;
  rowIndex: number;
  
  // SECTION 1: CERTIFICATION & INITIAL SPEC (A-J)
  certification?: string;
  doorsetType?: string;
  lajRef?: string;
  doorRef?: string;
  masterWidth?: number;
  slaveWidth?: number;
  doorHeight?: number;
  core?: string;
  rating?: string;
  coreType?: string;
  
  // SECTION 2: EDGE DIMENSIONS (K-S)
  top?: number;
  btm?: number;
  hinge?: number;
  me?: number;
  daExposed?: number;
  trim?: number;
  safeHinge?: number;
  pf?: number;
  extra?: number;
  
  // SECTION 3: REDUCED DIMENSIONS - CALCULATED (T-W)
  masterReduced?: number;
  slaveWidthReduced?: number;
  doorHeightReduced?: number;
  coreReduced?: string;
  
  // SECTION 4: NOTES (X-Y)
  notes1?: string;
  notes2?: string;
  
  // SECTION 5: LIPPING (Z-AO)
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
  
  // SECTION 6: EDGING / 2T (AP-AY)
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
  
  // SECTION 7: FACING / CALIBRATION (AZ-BS)
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
  
  // SECTION 8: FINISH / IRONMONGERY (BT-CX)
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
  
  // SECTION 9: SECONDARY IRONMONGERY (CZ-DN)
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
  
  // SECTION 10: FINAL SPEC & FRAME (DR-EN)
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
  
  // Legacy fields
  location?: string;
  quantity?: number;
  unitValue?: number;
  lineTotal?: number;
  [key: string]: any;
}

interface FireDoorGridProps {
  lineItems: FireDoorLineItem[];
  onLineItemsChange: (items: FireDoorLineItem[]) => void;
  onAddRfi?: (rowId: string | null, columnKey: string) => void;
}

export function FireDoorGrid({ lineItems, onLineItemsChange, onAddRfi }: FireDoorGridProps) {
  const gridRef = useRef<AgGridReact>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const updatedData = event.api.getModel().getRowNode(String(event.node.rowIndex))?.data;
    if (!updatedData) return;

    // Auto-calculate reduced dimensions when edge dimensions change
    const edgeFields = ['top', 'btm', 'hinge', 'safeHinge', 'pf', 'trim', 'extra'];
    if (edgeFields.includes(event.colDef.field || '')) {
      const data = updatedData;
      
      // Master Reduced = masterWidth - top - btm - hinge - safeHinge - pf + trim + extra
      if (data.masterWidth !== undefined) {
        data.masterReduced = (data.masterWidth || 0) - (data.top || 0) - (data.btm || 0) 
          - (data.hinge || 0) - (data.safeHinge || 0) - (data.pf || 0) 
          + (data.trim || 0) + (data.extra || 0);
      }
      
      // Slave Width Reduced = slaveWidth - top - btm - hinge - safeHinge - pf + trim + extra
      if (data.slaveWidth !== undefined) {
        data.slaveWidthReduced = (data.slaveWidth || 0) - (data.top || 0) - (data.btm || 0) 
          - (data.hinge || 0) - (data.safeHinge || 0) - (data.pf || 0) 
          + (data.trim || 0) + (data.extra || 0);
      }
      
      // Door Height Reduced = doorHeight - top - btm - pf + trim + extra
      if (data.doorHeight !== undefined) {
        data.doorHeightReduced = (data.doorHeight || 0) - (data.top || 0) - (data.btm || 0) 
          - (data.pf || 0) + (data.trim || 0) + (data.extra || 0);
      }
      
      event.node.setData(data);
    }

    // Auto-calculate line total
    if (event.colDef.field === 'quantity' || event.colDef.field === 'unitValue') {
      const qty = updatedData.quantity || 0;
      const unit = updatedData.unitValue || 0;
      updatedData.lineTotal = qty * unit;
      event.node.setData(updatedData);
    }

    // Collect all updated data
    const allRowData: FireDoorLineItem[] = [];
    gridApi?.forEachNode((node) => {
      if (node.data) allRowData.push(node.data);
    });
    onLineItemsChange(allRowData);
  }, [gridApi, onLineItemsChange]);

  const getContextMenuItems = useCallback((params: GetContextMenuItemsParams): (string | MenuItemDef)[] => {
    const result: (string | MenuItemDef)[] = [
      'copy',
      'copyWithHeaders',
      'paste',
      'separator',
    ];

    // Add RFI menu items
    if (onAddRfi) {
      if (params.column) {
        result.push({
          name: 'Add RFI for this column',
          icon: '<span class="ag-icon ag-icon-pin"></span>',
          action: () => {
            onAddRfi(null, params.column!.getColId());
          },
        });
      }

      if (params.node) {
        result.push({
          name: 'Add RFI for this cell',
          icon: '<span class="ag-icon ag-icon-pin"></span>',
          action: () => {
            const rowId = params.node!.data?.id || `row-${params.node!.rowIndex}`;
            onAddRfi(rowId, params.column!.getColId());
          },
        });
      }

      result.push('separator');
    }

    result.push('export');
    
    return result;
  }, [onAddRfi]);

  // Column definitions organized by sections
  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => [
    // Pinned identifier columns
    {
      headerName: '#',
      field: 'rowIndex',
      pinned: 'left',
      width: 60,
      editable: false,
      cellStyle: { backgroundColor: '#f8fafc', fontWeight: '600' },
      valueGetter: (params) => params.node?.rowIndex !== undefined ? params.node.rowIndex + 1 : '',
    },
    {
      headerName: 'Door Ref',
      field: 'doorRef',
      pinned: 'left',
      width: 140,
      editable: true,
      cellStyle: { backgroundColor: '#f8fafc' },
    },
    {
      headerName: 'Location',
      field: 'location',
      pinned: 'left',
      width: 140,
      editable: true,
      cellStyle: { backgroundColor: '#f8fafc' },
    },

    // SECTION 1: CERTIFICATION & INITIAL SPEC
    {
      headerName: 'Section 1: Certification & Initial Spec',
      headerClass: 'ag-header-group-blue',
      children: [
        { field: 'certification', headerName: 'Certification', width: 130, editable: true },
        { field: 'doorsetType', headerName: 'Doorset Type', width: 130, editable: true },
        { field: 'lajRef', headerName: 'LAJ Ref', width: 110, editable: true },
        { field: 'masterWidth', headerName: 'Master Width (mm)', width: 140, editable: true, type: 'numericColumn' },
        { field: 'slaveWidth', headerName: 'Slave Width (mm)', width: 140, editable: true, type: 'numericColumn' },
        { field: 'doorHeight', headerName: 'Door Height (mm)', width: 140, editable: true, type: 'numericColumn' },
        { field: 'core', headerName: 'Core', width: 120, editable: true },
        { field: 'rating', headerName: 'Rating', width: 100, editable: true },
        { field: 'coreType', headerName: 'Core Type', width: 120, editable: true },
      ],
    },

    // SECTION 2: EDGE DIMENSIONS
    {
      headerName: 'Section 2: Edge Dimensions & Adjustments',
      headerClass: 'ag-header-group-green',
      children: [
        { field: 'top', headerName: 'Top', width: 100, editable: true, type: 'numericColumn' },
        { field: 'btm', headerName: 'Bottom', width: 100, editable: true, type: 'numericColumn' },
        { field: 'hinge', headerName: 'Hinge', width: 100, editable: true, type: 'numericColumn' },
        { field: 'me', headerName: 'M/E', width: 100, editable: true, type: 'numericColumn' },
        { field: 'daExposed', headerName: 'D/A Exposed', width: 120, editable: true, type: 'numericColumn' },
        { field: 'trim', headerName: 'Trim', width: 100, editable: true, type: 'numericColumn' },
        { field: 'safeHinge', headerName: 'Safe Hinge', width: 120, editable: true, type: 'numericColumn' },
        { field: 'pf', headerName: 'P/F', width: 100, editable: true, type: 'numericColumn' },
        { field: 'extra', headerName: 'Extra', width: 100, editable: true, type: 'numericColumn' },
      ],
    },

    // SECTION 3: REDUCED DIMENSIONS (CALCULATED)
    {
      headerName: 'Section 3: Reduced Dimensions (Calculated)',
      headerClass: 'ag-header-group-purple',
      children: [
        { 
          field: 'masterReduced', 
          headerName: 'Master (R)', 
          width: 130, 
          editable: false,
          type: 'numericColumn',
          cellStyle: { backgroundColor: '#fef3c7', fontWeight: '600' },
          valueGetter: (params) => {
            const data = params.data;
            if (!data) return null;
            return (data.masterWidth || 0) - (data.top || 0) - (data.btm || 0) 
              - (data.hinge || 0) - (data.safeHinge || 0) - (data.pf || 0) 
              + (data.trim || 0) + (data.extra || 0);
          },
        },
        { 
          field: 'slaveWidthReduced', 
          headerName: 'Slave Width (R)', 
          width: 140, 
          editable: false,
          type: 'numericColumn',
          cellStyle: { backgroundColor: '#fef3c7', fontWeight: '600' },
          valueGetter: (params) => {
            const data = params.data;
            if (!data || !data.slaveWidth) return null;
            return (data.slaveWidth || 0) - (data.top || 0) - (data.btm || 0) 
              - (data.hinge || 0) - (data.safeHinge || 0) - (data.pf || 0) 
              + (data.trim || 0) + (data.extra || 0);
          },
        },
        { 
          field: 'doorHeightReduced', 
          headerName: 'Door Height (R)', 
          width: 140, 
          editable: false,
          type: 'numericColumn',
          cellStyle: { backgroundColor: '#fef3c7', fontWeight: '600' },
          valueGetter: (params) => {
            const data = params.data;
            if (!data) return null;
            return (data.doorHeight || 0) - (data.top || 0) - (data.btm || 0) 
              - (data.pf || 0) + (data.trim || 0) + (data.extra || 0);
          },
        },
        { field: 'coreReduced', headerName: 'Core', width: 120, editable: true },
      ],
    },

    // SECTION 4: NOTES
    {
      headerName: 'Section 4: Notes',
      headerClass: 'ag-header-group-gray',
      children: [
        { field: 'notes1', headerName: 'Notes 1', width: 200, editable: true },
        { field: 'notes2', headerName: 'Notes 2', width: 200, editable: true },
      ],
    },

    // SECTION 5: LIPPING
    {
      headerName: 'Section 5: Lipping',
      headerClass: 'ag-header-group-blue',
      children: [
        { field: 'lajRefLipping', headerName: 'LAJ Ref', width: 110, editable: true },
        { field: 'doorRefLipping', headerName: 'Door Ref', width: 120, editable: true },
        { field: 'masterWidthLipping', headerName: 'Master Width', width: 130, editable: true, type: 'numericColumn' },
        { field: 'slaveWidthLipping', headerName: 'Slave Width', width: 130, editable: true, type: 'numericColumn' },
        { field: 'doorHeightLipping', headerName: 'Door Height', width: 130, editable: true, type: 'numericColumn' },
        { field: 'coreLipping', headerName: 'Core', width: 120, editable: true },
        { field: 'ratingLipping', headerName: 'Rating', width: 100, editable: true },
        { field: 'coreTypeLipping', headerName: 'Core Type', width: 120, editable: true },
        { field: 'material', headerName: 'Material', width: 130, editable: true },
        { field: 'topLipping', headerName: 'Top', width: 100, editable: true, type: 'numericColumn' },
        { field: 'btmLipping', headerName: 'Bottom', width: 100, editable: true, type: 'numericColumn' },
        { field: 'hingeLipping', headerName: 'Hinge', width: 100, editable: true, type: 'numericColumn' },
        { field: 'meLipping', headerName: 'M/E', width: 100, editable: true, type: 'numericColumn' },
        { field: 'daExposedLipping', headerName: 'D/A Exposed', width: 120, editable: true, type: 'numericColumn' },
        { field: 'lippingDetail', headerName: 'Lipping Detail', width: 150, editable: true },
        { field: 'masterWidthLipping2', headerName: 'Master Width 2', width: 140, editable: true, type: 'numericColumn' },
      ],
    },

    // SECTION 6: EDGING / 2T
    {
      headerName: 'Section 6: Edging / 2T',
      headerClass: 'ag-header-group-green',
      children: [
        { field: 'slaveWidthEdging', headerName: 'Slave Width', width: 130, editable: true, type: 'numericColumn' },
        { field: 'doorHeightEdging', headerName: 'Door Height', width: 130, editable: true, type: 'numericColumn' },
        { field: 'coreEdging', headerName: 'Core', width: 120, editable: true },
        { field: 'masterWidth2T', headerName: 'Master Width (2T)', width: 150, editable: true, type: 'numericColumn' },
        { field: 'slaveWidth2T', headerName: 'Slave Width (2T)', width: 150, editable: true, type: 'numericColumn' },
        { field: 'doorHeight2T', headerName: 'Door Height (2T)', width: 150, editable: true, type: 'numericColumn' },
        { field: 'core2T', headerName: 'Core (2T)', width: 120, editable: true },
        { field: 'doorType', headerName: 'Door Type', width: 130, editable: true },
        { field: 'note1Edge', headerName: 'Note 1', width: 150, editable: true },
        { field: 'note2Edge', headerName: 'Note 2', width: 150, editable: true },
      ],
    },

    // SECTION 7: FACING / CALIBRATION
    {
      headerName: 'Section 7: Facing / Calibration',
      headerClass: 'ag-header-group-purple',
      children: [
        { field: 'lajRefFacing', headerName: 'LAJ Ref', width: 110, editable: true },
        { field: 'doorRefFacing', headerName: 'Door Ref', width: 120, editable: true },
        { field: 'masterWidthFacing', headerName: 'Master Width', width: 130, editable: true, type: 'numericColumn' },
        { field: 'slaveWidthFacing', headerName: 'Slave Width', width: 130, editable: true, type: 'numericColumn' },
        { field: 'doorHeightFacing', headerName: 'Door Height', width: 130, editable: true, type: 'numericColumn' },
        { field: 'coreFacing', headerName: 'Core', width: 120, editable: true },
        { field: 'coreTypeFacing', headerName: 'Core Type', width: 120, editable: true },
        { field: 'materialFacing', headerName: 'Material', width: 130, editable: true },
        { field: 'topFacing', headerName: 'Top', width: 100, editable: true, type: 'numericColumn' },
        { field: 'btmFacing', headerName: 'Bottom', width: 100, editable: true, type: 'numericColumn' },
        { field: 'hingeFacing', headerName: 'Hinge', width: 100, editable: true, type: 'numericColumn' },
        { field: 'meFacing', headerName: 'M/E', width: 100, editable: true, type: 'numericColumn' },
        { field: 'daExposedFacing', headerName: 'D/A Exposed', width: 120, editable: true, type: 'numericColumn' },
        { field: 'calibratedSize', headerName: 'Calibrated Size', width: 140, editable: true },
        { field: 'masterDoor', headerName: 'Master Door', width: 130, editable: true },
        { field: 'slaveDoor', headerName: 'Slave Door', width: 130, editable: true },
        { field: 'bookMatching', headerName: 'Book Matching', width: 140, editable: true },
        { field: 'topFinal', headerName: 'Top (Final)', width: 110, editable: true, type: 'numericColumn' },
        { field: 'btmFinal', headerName: 'Bottom (Final)', width: 120, editable: true, type: 'numericColumn' },
        { field: 'hingeFinal', headerName: 'Hinge (Final)', width: 120, editable: true, type: 'numericColumn' },
      ],
    },

    // SECTION 8: FINISH / IRONMONGERY (30 fields)
    {
      headerName: 'Section 8: Finish / Ironmongery',
      headerClass: 'ag-header-group-orange',
      children: [
        { field: 'finishFacing', headerName: 'Finish Facing', width: 140, editable: true },
        { field: 'materialFinish', headerName: 'Material', width: 130, editable: true },
        { field: 'topFinish', headerName: 'Top', width: 100, editable: true, type: 'numericColumn' },
        { field: 'btmFinish', headerName: 'Bottom', width: 100, editable: true, type: 'numericColumn' },
        { field: 'hingeFinish', headerName: 'Hinge', width: 100, editable: true, type: 'numericColumn' },
        { field: 'meFinish', headerName: 'M/E', width: 100, editable: true, type: 'numericColumn' },
        { field: 'daExposedFinish', headerName: 'D/A Exposed', width: 120, editable: true, type: 'numericColumn' },
        { field: 'masterWidthFinish', headerName: 'Master Width', width: 130, editable: true, type: 'numericColumn' },
        { field: 'slaveWidthFinish', headerName: 'Slave Width', width: 130, editable: true, type: 'numericColumn' },
        { field: 'doorHeightFinish', headerName: 'Door Height', width: 130, editable: true, type: 'numericColumn' },
        { field: 'coreFinish', headerName: 'Core', width: 120, editable: true },
        { field: 'handingFinish', headerName: 'Handing', width: 120, editable: true },
        { field: 'lippingFinish', headerName: 'Lipping Finish', width: 140, editable: true },
        { field: 'doorFinish', headerName: 'Door Finish', width: 130, editable: true },
        { field: 'beadType', headerName: 'Bead Type', width: 120, editable: true },
        { field: 'glassType', headerName: 'Glass Type', width: 120, editable: true },
        { field: 'vpType', headerName: 'VP Type', width: 120, editable: true },
        { field: 'vpWidth', headerName: 'VP Width', width: 110, editable: true, type: 'numericColumn' },
        { field: 'vpHeight', headerName: 'VP Height', width: 110, editable: true, type: 'numericColumn' },
        { field: 'cassetteType', headerName: 'Cassette Type', width: 130, editable: true },
        { field: 'intumescentStrip', headerName: 'Intumescent Strip', width: 150, editable: true },
        { field: 'smokeStrip', headerName: 'Smoke Strip', width: 120, editable: true },
        { field: 'dropSeal', headerName: 'Drop Seal', width: 120, editable: true },
        { field: 'hingeQty', headerName: 'Hinge Qty', width: 110, editable: true, type: 'numericColumn' },
        { field: 'hingeType', headerName: 'Hinge Type', width: 130, editable: true },
        { field: 'lockType', headerName: 'Lock Type', width: 130, editable: true },
        { field: 'latchType', headerName: 'Latch Type', width: 130, editable: true },
        { field: 'cylinderType', headerName: 'Cylinder Type', width: 130, editable: true },
        { field: 'keeperType', headerName: 'Keeper Type', width: 130, editable: true },
      ],
    },

    // SECTION 9: SECONDARY IRONMONGERY (16 fields)
    {
      headerName: 'Section 9: Secondary Ironmongery',
      headerClass: 'ag-header-group-red',
      children: [
        { field: 'handleType', headerName: 'Handle Type', width: 130, editable: true },
        { field: 'pullHandleType', headerName: 'Pull Handle Type', width: 150, editable: true },
        { field: 'pullHandleQty', headerName: 'Pull Handle Qty', width: 140, editable: true, type: 'numericColumn' },
        { field: 'flushBoltType', headerName: 'Flush Bolt Type', width: 140, editable: true },
        { field: 'flushBoltQty', headerName: 'Flush Bolt Qty', width: 130, editable: true, type: 'numericColumn' },
        { field: 'coordinatorType', headerName: 'Coordinator Type', width: 150, editable: true },
        { field: 'selectorType', headerName: 'Selector Type', width: 130, editable: true },
        { field: 'letterPlateType', headerName: 'Letter Plate Type', width: 150, editable: true },
        { field: 'numeralType', headerName: 'Numeral Type', width: 130, editable: true },
        { field: 'knockerType', headerName: 'Knocker Type', width: 130, editable: true },
        { field: 'spyholeType', headerName: 'Spyhole Type', width: 130, editable: true },
        { field: 'chainType', headerName: 'Chain Type', width: 120, editable: true },
        { field: 'closerType', headerName: 'Closer Type', width: 130, editable: true },
        { field: 'closerQty', headerName: 'Closer Qty', width: 120, editable: true, type: 'numericColumn' },
        { field: 'floorSpringType', headerName: 'Floor Spring Type', width: 150, editable: true },
        { field: 'pivotType', headerName: 'Pivot Type', width: 120, editable: true },
      ],
    },

    // SECTION 10: FINAL SPEC & FRAME (22 fields)
    {
      headerName: 'Section 10: Final Spec & Frame',
      headerClass: 'ag-header-group-indigo',
      children: [
        { field: 'masterLeafFinal', headerName: 'Master Leaf (Final)', width: 150, editable: true, type: 'numericColumn' },
        { field: 'slaveLeafFinal', headerName: 'Slave Leaf (Final)', width: 150, editable: true, type: 'numericColumn' },
        { field: 'leafHeightFinal', headerName: 'Leaf Height (Final)', width: 150, editable: true, type: 'numericColumn' },
        { field: 'masterFrameWidth', headerName: 'Master Frame Width', width: 160, editable: true, type: 'numericColumn' },
        { field: 'slaveFrameWidth', headerName: 'Slave Frame Width', width: 160, editable: true, type: 'numericColumn' },
        { field: 'frameHeight', headerName: 'Frame Height', width: 130, editable: true, type: 'numericColumn' },
        { field: 'frameDepth', headerName: 'Frame Depth', width: 130, editable: true, type: 'numericColumn' },
        { field: 'sillType', headerName: 'Sill Type', width: 120, editable: true },
        { field: 'thresholdType', headerName: 'Threshold Type', width: 140, editable: true },
        { field: 'weatherSeal', headerName: 'Weather Seal', width: 130, editable: true },
        { field: 'architraveType', headerName: 'Architrave Type', width: 140, editable: true },
        { field: 'architraveWidth', headerName: 'Architrave Width', width: 140, editable: true, type: 'numericColumn' },
        { field: 'wallType', headerName: 'Wall Type', width: 120, editable: true },
        { field: 'fixingType', headerName: 'Fixing Type', width: 130, editable: true },
        { field: 'handingFinal', headerName: 'Handing (Final)', width: 140, editable: true },
        { field: 'frameFinish', headerName: 'Frame Finish', width: 130, editable: true },
        { field: 'frameColour', headerName: 'Frame Colour', width: 130, editable: true },
        { field: 'plugType', headerName: 'Plug Type', width: 120, editable: true },
        { field: 'qMarkPlug', headerName: 'Q-Mark Plug', width: 130, editable: true },
      ],
    },

    // Pricing columns (pinned right)
    {
      headerName: 'Pricing',
      headerClass: 'ag-header-group-cyan',
      children: [
        { 
          field: 'quantity', 
          headerName: 'Qty', 
          width: 80, 
          editable: true, 
          type: 'numericColumn',
          pinned: 'right',
          cellStyle: { backgroundColor: '#f0f9ff' },
        },
        { 
          field: 'unitValue', 
          headerName: 'Unit Price (£)', 
          width: 130, 
          editable: true, 
          type: 'numericColumn',
          pinned: 'right',
          cellStyle: { backgroundColor: '#f0f9ff' },
          valueFormatter: (params) => params.value ? `£${params.value.toFixed(2)}` : '',
        },
        { 
          field: 'lineTotal', 
          headerName: 'Line Total (£)', 
          width: 140, 
          editable: false, 
          type: 'numericColumn',
          pinned: 'right',
          cellStyle: { backgroundColor: '#dbeafe', fontWeight: '600' },
          valueGetter: (params) => {
            const data = params.data;
            if (!data) return 0;
            return (data.quantity || 0) * (data.unitValue || 0);
          },
          valueFormatter: (params) => `£${(params.value || 0).toFixed(2)}`,
        },
      ],
    },
  ], []);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    editable: true,
    minWidth: 100,
  }), []);

  return (
    <div className="ag-theme-alpine" style={{ height: '600px', width: '100%' }}>
      <AgGridReact
        ref={gridRef}
        rowData={lineItems}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onGridReady={onGridReady}
        onCellValueChanged={onCellValueChanged}
        getContextMenuItems={getContextMenuItems}
        enableRangeSelection={true}
        enableFillHandle={true}
        undoRedoCellEditing={true}
        undoRedoCellEditingLimit={20}
        enableCellChangeFlash={true}
        suppressRowClickSelection={false}
        rowSelection="multiple"
        sideBar={{
          toolPanels: [
            {
              id: 'columns',
              labelDefault: 'Columns',
              labelKey: 'columns',
              iconKey: 'columns',
              toolPanel: 'agColumnsToolPanel',
              toolPanelParams: {
                suppressRowGroups: true,
                suppressValues: true,
                suppressPivots: true,
                suppressPivotMode: true,
              },
            },
          ],
          defaultToolPanel: '',
        }}
        animateRows={true}
        pagination={false}
      />
    </div>
  );
}
