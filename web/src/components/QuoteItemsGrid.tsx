"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Plus, Trash2, Settings } from "lucide-react";

export type QuoteItem = {
  id: string;
  [key: string]: any;
};

export type ColumnConfig = {
  key: string;
  label: string;
  type: string;
  width: number;
  frozen: boolean;
  visible: boolean;
  options?: string[];
};

interface QuoteItemsGridProps {
  items: QuoteItem[];
  columns: ColumnConfig[];
  onItemsChange: (items: QuoteItem[]) => void;
  onColumnConfigOpen?: () => void;
}

export function QuoteItemsGrid({
  items,
  columns,
  onItemsChange,
  onColumnConfigOpen,
}: QuoteItemsGridProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const [editingCell, setEditingCell] = useState<{ itemId: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Sync scroll between header and body
  const handleBodyScroll = () => {
    if (scrollContainerRef.current && headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
    }
  };

  const handleHeaderScroll = () => {
    if (scrollContainerRef.current && headerScrollRef.current) {
      scrollContainerRef.current.scrollLeft = headerScrollRef.current.scrollLeft;
    }
  };

  const visibleColumns = columns.filter((c) => c.visible);
  const frozenColumns = visibleColumns.filter((c) => c.frozen);
  const scrollableColumns = visibleColumns.filter((c) => !c.frozen);

  const handleAddItem = () => {
    const newItem: QuoteItem = {
      id: `item-${Date.now()}`,
      itemNumber: items.length + 1,
    };
    onItemsChange([...items, newItem]);
  };

  const handleDeleteItem = (itemId: string) => {
    onItemsChange(items.filter((item) => item.id !== itemId));
  };

  const handleCellClick = (itemId: string, key: string, currentValue: any) => {
    setEditingCell({ itemId, key });
    setEditValue(String(currentValue ?? ""));
  };

  const handleCellChange = (itemId: string, key: string, value: any) => {
    const updatedItems = items.map((item) =>
      item.id === itemId ? { ...item, [key]: value } : item
    );
    onItemsChange(updatedItems);
    setEditingCell(null);
  };

  const handleCellBlur = () => {
    if (editingCell) {
      handleCellChange(editingCell.itemId, editingCell.key, editValue);
    }
  };

  const renderCell = (item: QuoteItem, column: ColumnConfig) => {
    const value = item[column.key];
    const isEditing = editingCell?.itemId === item.id && editingCell?.key === column.key;

    if (isEditing) {
      if (column.type === "select" && column.options) {
        return (
          <select
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCellBlur}
            className="w-full h-full px-2 py-1 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select...</option>
            {column.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      } else if (column.type === "color") {
        return (
          <input
            type="color"
            autoFocus
            value={editValue || "#ffffff"}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCellBlur}
            className="w-full h-full border-0 cursor-pointer"
          />
        );
      } else if (column.type === "number") {
        return (
          <input
            type="number"
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCellBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCellBlur();
              if (e.key === "Escape") setEditingCell(null);
            }}
            className="w-full h-full px-2 py-1 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
      } else {
        return (
          <input
            type="text"
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCellBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCellBlur();
              if (e.key === "Escape") setEditingCell(null);
            }}
            className="w-full h-full px-2 py-1 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
      }
    }

    // Display value
    if (column.type === "color" && value) {
      return (
        <div
          className="w-full h-full flex items-center gap-2 px-2 py-1 cursor-pointer"
          onClick={() => handleCellClick(item.id, column.key, value)}
        >
          <div
            className="w-6 h-6 rounded border border-slate-300"
            style={{ backgroundColor: value }}
          />
          <span className="text-xs">{value}</span>
        </div>
      );
    }

    return (
      <div
        className="w-full h-full px-2 py-1 cursor-pointer truncate"
        onClick={() => handleCellClick(item.id, column.key, value)}
      >
        {value ?? ""}
      </div>
    );
  };

  const frozenWidth = frozenColumns.reduce((sum, col) => sum + col.width, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Line Items</div>
        <div className="flex gap-2">
          {onColumnConfigOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={onColumnConfigOpen}
              type="button"
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure Columns
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleAddItem} type="button">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg bg-white">
        {/* Outer wrapper with single horizontal scroll */}
        <div className="overflow-x-auto">
          {/* Header */}
          <div className="flex border-b border-slate-200 bg-slate-50">
            {/* Frozen header columns */}
            <div className="flex border-r border-slate-200" style={{ minWidth: frozenWidth }}>
              {frozenColumns.map((column) => (
                <div
                  key={column.key}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 border-r border-slate-200 flex-shrink-0"
                  style={{ width: column.width }}
                >
                  {column.label}
                </div>
              ))}
            </div>

            {/* Scrollable header columns */}
            <div className="flex flex-1">
            {scrollableColumns.map((column) => (
              <div
                key={column.key}
                className="px-3 py-2 text-xs font-semibold text-slate-700 border-r border-slate-200 flex-shrink-0"
                style={{ width: column.width }}
              >
                {column.label}
              </div>
            ))}
            <div className="px-3 py-2 text-xs font-semibold text-slate-700 flex-shrink-0 w-20">
              Actions
            </div>
          </div>
        </div>

        {/* Body */}
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No items yet. Click "Add Item" to get started.
          </div>
        ) : (
          items.map((item, idx) => (
            <div
              key={item.id}
              className={`flex border-b border-slate-200 ${
                idx % 2 === 0 ? "bg-white" : "bg-slate-50"
              }`}
            >
              {/* Frozen columns */}
              <div className="flex border-r border-slate-200" style={{ minWidth: frozenWidth }}>
                {frozenColumns.map((column) => (
                  <div
                    key={column.key}
                    className="border-r border-slate-200 text-sm text-slate-900 flex-shrink-0"
                    style={{ width: column.width }}
                  >
                    {renderCell(item, column)}
                  </div>
                ))}
              </div>

              {/* Scrollable columns */}
              <div className="flex flex-1">
                {scrollableColumns.map((column) => (
                  <div
                    key={column.key}
                    className="border-r border-slate-200 text-sm text-slate-900 flex-shrink-0"
                    style={{ width: column.width }}
                  >
                    {renderCell(item, column)}
                  </div>
                ))}
                <div className="flex items-center justify-center flex-shrink-0 w-20">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteItem(item.id)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
        </div>
      </div>
    </div>
  );
}
