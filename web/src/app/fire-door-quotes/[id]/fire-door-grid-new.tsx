"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import DataGrid, { Column, RenderEditCellProps, SelectColumn } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import { apiFetch } from "@/lib/api";

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

// Dropdown editor component
function SelectEditor<TRow>({ 
  row, 
  column, 
  onRowChange, 
  onClose,
  options 
}: RenderEditCellProps<TRow> & { options: string[] }) {
  return (
    <select
      className="w-full h-full border-0 outline-none px-2"
      autoFocus
      value={row[column.key as keyof TRow] as string || ''}
      onChange={(e) => {
        onRowChange({ ...row, [column.key]: e.target.value }, true);
        onClose(true);
      }}
      onBlur={() => onClose(false)}
    >
      <option value="">--</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
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

  const doorsetTypeOptions = ['Single', 'Double', 'Single with sidelight', 'Double with sidelight'];
  const ratingOptions = ['FD30', 'FD60', 'FD90', 'FD120'];

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
        row.slaveWidthReduced = (row.slaveWidth || 0) - (row.top || 0) - (row.btm || 0) 
          - (row.hinge || 0) - (row.safeHinge || 0) - (row.pf || 0) 
          + (row.trim || 0) + (row.extra || 0);
      }
      
      if (row.doorHeight !== undefined) {
        row.doorHeightReduced = (row.doorHeight || 0) - (row.top || 0) - (row.btm || 0) 
          - (row.pf || 0) + (row.trim || 0) + (row.extra || 0);
      }

      // Calculate line total
      row.lineTotal = (row.quantity || 0) * (row.unitValue || 0);
      
      return row;
    });

    setRows(updatedRows);
    onLineItemsChange(updatedRows);
  }, [onLineItemsChange]);

  // Build RFI maps for highlighting
  const cellRfiMap = useMemo(() => {
    const map: Record<string, RfiRecord[]> = {};
    rfis.filter(r => r.rowId).forEach(r => {
      const key = `${r.rowId}:${r.columnKey}`;
      map[key] = map[key] || [];
      map[key].push(r);
    });
    return map;
  }, [rfis]);

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

  // Context menu handler for RFI
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!onAddRfi) return;
    
    e.preventDefault();
    const target = e.target as HTMLElement;
    const cell = target.closest('.rdg-cell');
    if (!cell) return;

    const columnKey = cell.getAttribute('data-column-key');
    const rowIdx = cell.getAttribute('data-row-idx');
    
    if (!columnKey) return;

    const rowId = rowIdx ? rows[parseInt(rowIdx)]?.id || `row-${rowIdx}` : null;
    
    const menu = document.createElement('div');
    menu.className = 'absolute bg-white border border-gray-300 shadow-lg rounded-md z-50';
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
    
    const cellOption = document.createElement('button');
    cellOption.className = 'block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm';
    cellOption.textContent = rowId ? 'Add RFI for this cell' : 'Add RFI for this column';
    cellOption.onclick = () => {
      onAddRfi(rowId, columnKey);
      document.body.removeChild(menu);
    };
    
    menu.appendChild(cellOption);
    document.body.appendChild(menu);
    
    const closeMenu = () => {
      if (document.body.contains(menu)) {
        document.body.removeChild(menu);
      }
      document.removeEventListener('click', closeMenu);
    };
    
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }, [onAddRfi, rows]);

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
      renderEditCell: (props) => <SelectEditor {...props} options={doorsetTypeOptions} />,
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
      renderEditCell: (props) => <SelectEditor {...props} options={coreOptions} />,
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
      renderEditCell: (props) => <SelectEditor {...props} options={ratingOptions} />,
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
  ], [coreOptions, doorsetTypeOptions, ratingOptions]);

  return (
    <div className="h-[600px] w-full" onContextMenu={handleContextMenu}>
      <DataGrid
        columns={columns}
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
