"use client";

import { useRef, useState } from "react";

interface ColumnConfig {
  field: string;
  label: string;
  visible: boolean;
  width?: number;
  frozen?: boolean;
  type?: 'text' | 'date' | 'dropdown' | 'number' | 'email' | 'phone' | 'currency' | 'boolean' | 'progress';
  dropdownOptions?: string[];
  dropdownColors?: Record<string, string>;
}

interface CustomizableGridProps {
  data: any[];
  columns: ColumnConfig[];
  onRowClick?: (row: any) => void;
  onCellChange?: (rowId: string, field: string, value: any) => void;
  rowIdField?: string;
  onEditColumnOptions?: (field: string) => void;
  customColors?: Record<string, { bg: string; text: string }>;
  customDropdownOptions?: Record<string, string[]>;
}

export function CustomizableGrid({
  data,
  columns,
  onRowClick,
  onCellChange,
  rowIdField = 'id',
  customDropdownOptions = {},
  onEditColumnOptions,
  customColors = {},
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

  const getProgressColor = (progress?: number): string => {
    if (!progress) return "from-gray-400 to-gray-500";
    if (progress < 30) return "from-red-400 to-red-500";
    if (progress < 60) return "from-orange-400 to-orange-500";
    if (progress < 90) return "from-blue-400 to-blue-500";
    return "from-green-400 to-green-500";
  };

  const renderCell = (row: any, column: ColumnConfig) => {
    const value = row[column.field];
    const rowId = row[rowIdField];

    if (column.type === 'progress') {
      // Get process percentage from processPercentages object
      const percentage = row.processPercentages?.[column.field] || 0;
      
      return (
        <div className="flex items-center gap-2 px-3">
          <div className="w-16 h-2 bg-slate-100 rounded overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getProgressColor(percentage)}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-700 w-8">{percentage}%</span>
        </div>
      );
    }

    if (column.type === 'dropdown' && onCellChange) {
      // Use custom dropdown options if available, otherwise fall back to column options
      const options = customDropdownOptions[column.field] || column.dropdownOptions || [];
      
      // Get color from custom colors or fallback to column colors
      const customColorKey = `${column.field}:${value}`;
      const customColor = customColors[customColorKey];
      const colorClass = customColor 
        ? `${customColor.bg} ${customColor.text}`
        : column.dropdownColors?.[value] || 'bg-slate-100 text-slate-600';
      
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
          {options.map((opt) => (
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
                className="border-r last:border-r-0 px-3 py-2 font-semibold text-sm text-slate-700 flex items-center justify-between"
                style={{ width: column.width || 150 }}
              >
                <span>{column.label}</span>
                {column.type === 'dropdown' && onEditColumnOptions && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditColumnOptions(column.field);
                    }}
                    className="ml-2 p-1 hover:bg-slate-200 rounded"
                    title="Edit options & colors"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
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
                className="border-r last:border-r-0 px-3 py-2 font-semibold text-sm text-slate-700 flex items-center justify-between flex-shrink-0"
                style={{ width: column.width || 150 }}
              >
                <span>{column.label}</span>
                {column.type === 'dropdown' && onEditColumnOptions && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditColumnOptions(column.field);
                    }}
                    className="ml-2 p-1 hover:bg-slate-200 rounded"
                    title="Edit options & colors"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
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
