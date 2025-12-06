"use client";

import { useRef, useState } from "react";

interface ColumnConfig {
  field: string;
  label: string;
  visible: boolean;
  width?: number;
  frozen?: boolean;
  type?: 'text' | 'date' | 'dropdown' | 'number' | 'email' | 'phone' | 'currency' | 'boolean';
  dropdownOptions?: string[];
  dropdownColors?: Record<string, string>;
}

interface CustomizableGridProps {
  data: any[];
  columns: ColumnConfig[];
  onRowClick?: (row: any) => void;
  onCellChange?: (rowId: string, field: string, value: any) => void;
  rowIdField?: string;
}

export function CustomizableGrid({
  data,
  columns,
  onRowClick,
  onCellChange,
  rowIdField = 'id',
}: CustomizableGridProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const visibleColumns = columns.filter(col => col.visible);
  const frozenColumns = visibleColumns.filter(col => col.frozen);
  const scrollableColumns = visibleColumns.filter(col => !col.frozen);

  const frozenWidth = frozenColumns.reduce((sum, col) => sum + (col.width || 150), 0);

  const formatCellValue = (value: any, column: ColumnConfig) => {
    if (value === null || value === undefined) return '-';

    switch (column.type) {
      case 'date':
        try {
          const date = new Date(value);
          return date.toLocaleDateString('en-GB');
        } catch {
          return value;
        }
      case 'currency':
        return new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
        }).format(Number(value) || 0);
      case 'number':
        return Number(value).toLocaleString();
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'email':
      case 'phone':
      case 'text':
      default:
        return String(value);
    }
  };

  const renderCell = (row: any, column: ColumnConfig) => {
    const value = row[column.field];
    const rowId = row[rowIdField];

    if (column.type === 'dropdown' && column.dropdownOptions && onCellChange) {
      const colorClass = column.dropdownColors?.[value] || 'bg-slate-100 text-slate-600';
      return (
        <select
          value={value || ''}
          onChange={(e) => {
            e.stopPropagation();
            onCellChange(rowId, column.field, e.target.value);
          }}
          className={`w-full px-2 py-1 rounded text-xs font-medium ${colorClass} border-0 focus:ring-1 focus:ring-blue-500`}
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">-</option>
          {column.dropdownOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    return (
      <span className="truncate block px-3">
        {formatCellValue(value, column)}
      </span>
    );
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No data to display
      </div>
    );
  }

  return (
    <div className="relative border rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="flex bg-slate-50 border-b sticky top-0 z-20">
        {/* Frozen Headers */}
        {frozenColumns.length > 0 && (
          <div
            className="flex-shrink-0 flex border-r bg-slate-100"
            style={{ width: frozenWidth }}
          >
            {frozenColumns.map((column) => (
              <div
                key={column.field}
                className="border-r last:border-r-0 px-3 py-2 font-semibold text-sm text-slate-700 flex items-center"
                style={{ width: column.width || 150 }}
              >
                {column.label}
              </div>
            ))}
          </div>
        )}

        {/* Scrollable Headers */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="flex">
            {scrollableColumns.map((column) => (
              <div
                key={column.field}
                className="border-r last:border-r-0 px-3 py-2 font-semibold text-sm text-slate-700 flex items-center flex-shrink-0"
                style={{ width: column.width || 150 }}
              >
                {column.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-[600px] overflow-y-auto">
        {data.map((row, rowIndex) => {
          const rowId = row[rowIdField];
          const isHovered = hoveredRow === rowId;

          return (
            <div
              key={rowId || rowIndex}
              className={`flex border-b last:border-b-0 hover:bg-slate-50 transition-colors ${
                onRowClick ? 'cursor-pointer' : ''
              } ${isHovered ? 'bg-slate-50' : ''}`}
              onClick={() => onRowClick?.(row)}
              onMouseEnter={() => setHoveredRow(rowId)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              {/* Frozen Cells */}
              {frozenColumns.length > 0 && (
                <div
                  className="flex-shrink-0 flex border-r bg-white"
                  style={{ width: frozenWidth }}
                >
                  {frozenColumns.map((column) => (
                    <div
                      key={column.field}
                      className="border-r last:border-r-0 py-2 text-sm flex items-center"
                      style={{ width: column.width || 150 }}
                    >
                      {renderCell(row, column)}
                    </div>
                  ))}
                </div>
              )}

              {/* Scrollable Cells */}
              <div
                className="flex-1 overflow-x-auto"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
                onScroll={(e) => {
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
                  }
                }}
              >
                <div className="flex">
                  {scrollableColumns.map((column) => (
                    <div
                      key={column.field}
                      className="border-r last:border-r-0 py-2 text-sm flex items-center flex-shrink-0"
                      style={{ width: column.width || 150 }}
                    >
                      {renderCell(row, column)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
