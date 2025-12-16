"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Plus, Trash2, Settings, Wand2 } from "lucide-react";
import { TypeSelectorModal } from "./TypeSelectorModal";
import { RAL_COLORS } from "@/lib/ralColors";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

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
  color?: string;
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
  const [showTypeSelector, setShowTypeSelector] = useState<{ itemId: string; key: string } | null>(null);
  const [showAiSearch, setShowAiSearch] = useState<{ itemId: string; key: string } | null>(null);
  const [aiSearchQuery, setAiSearchQuery] = useState<string>("");
  const [aiSearching, setAiSearching] = useState(false);
  const [aiClarifications, setAiClarifications] = useState<
    | null
    | Array<{
        question: string;
        options: Array<{ label: string; category: string; type: string; option: string; hint?: string }>;
      }>
  >(null);
  const { toast } = useToast();

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

  const handleCellClick = (itemId: string, key: string, currentValue: any, column: ColumnConfig) => {
    // If column type is "type", open the type selector modal
    if (column.type === "type") {
      setShowTypeSelector({ itemId, key });
      return;
    }
    setEditingCell({ itemId, key });
    setEditValue(String(currentValue ?? ""));
  };

  const handleTypeSelection = (itemId: string, key: string, selection: { category: string; type: string; option: string }) => {
    const displayValue = `${selection.category === "doors" ? "Door" : "Window"} - ${selection.type} - ${selection.option}`;
    const updatedItems = items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            [key]: displayValue,
            [`${key}_category`]: selection.category,
            [`${key}_type`]: selection.type,
            [`${key}_option`]: selection.option,
          }
        : item
    );
    onItemsChange(updatedItems);
    setShowTypeSelector(null);
    setShowAiSearch(null);
  };

  const handleAiSearch = async () => {
    if (!aiSearchQuery.trim() || !showAiSearch) return;

    setAiSearching(true);
    try {
      const response = await apiFetch<
        | { category: string; type: string; option: string; confidence: number; clarifications?: never }
        | { clarifications: Array<{ question: string; options: Array<{ label: string; category: string; type: string; option: string; hint?: string }> }>; message?: string }
      >("/ml/search-product-type", {
        method: "POST",
        json: { description: aiSearchQuery },
      });

      if ((response as any).clarifications) {
        const data = response as { clarifications: Array<{ question: string; options: any[] }>; message?: string };
        setAiClarifications(data.clarifications);
        if (data.message) {
          toast({ title: "Need more detail", description: data.message });
        }
        return;
      }

      const match = response as { category: string; type: string; option: string; confidence: number };
      if (match.category && match.type && match.option) {
        handleTypeSelection(showAiSearch.itemId, showAiSearch.key, {
          category: match.category,
          type: match.type,
          option: match.option,
        });
        toast({
          title: "Product type found",
          description: `Matched: ${match.category} - ${match.type} - ${match.option}`,
        });
      } else {
        toast({
          title: "No match found",
          description: "Try refining your description",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Search failed",
        description: error.message || "Could not search product types",
        variant: "destructive",
      });
    } finally {
      setAiSearching(false);
    }
  };

  const handleClarificationSelect = (option: { label: string; category: string; type: string; option: string }) => {
    if (!showAiSearch) return;
    handleTypeSelection(showAiSearch.itemId, showAiSearch.key, {
      category: option.category,
      type: option.type,
      option: option.option,
    });
    setAiClarifications(null);
    setShowAiSearch(null);
    toast({
      title: "Product type selected",
      description: `${option.category} - ${option.type} - ${option.option}`,
    });
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

    // Type selector cells
    if (column.type === "type") {
      return (
        <div
          className="w-full h-full px-2 py-1 cursor-pointer truncate hover:bg-sky-50 flex items-center justify-between gap-1"
          onClick={() => handleCellClick(item.id, column.key, value, column)}
        >
          <span className="flex-1 truncate">{value || <span className="text-slate-400">Select type...</span>}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAiSearch({ itemId: item.id, key: column.key });
            }}
            className="flex-shrink-0 p-0.5 hover:bg-sky-100 rounded"
            title="AI Search"
          >
            <Wand2 className="h-3 w-3 text-blue-600" />
          </button>
        </div>
      );
    }

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
      } else if (column.type === "ral-color") {
        return (
          <select
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCellBlur}
            className="w-full h-full px-2 py-1 border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
          >
            <option value="">Select RAL...</option>
            {RAL_COLORS.map((ral) => (
              <option key={ral.code} value={ral.code}>
                {ral.code} - {ral.name}
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
    if (column.type === "ral-color" && value) {
      const ralColor = RAL_COLORS.find(c => c.code === value);
      return (
        <div
          className="w-full h-full flex items-center gap-2 px-2 py-1 cursor-pointer"
          onClick={() => handleCellClick(item.id, column.key, value, column)}
        >
          <div
            className="w-5 h-5 rounded border border-slate-300 flex-shrink-0"
            style={{ backgroundColor: ralColor?.hex || "#ffffff" }}
          />
          <span className="text-xs truncate">{ralColor ? ralColor.code : value}</span>
        </div>
      );
    }

    if (column.type === "color" && value) {
      const bgColor = column.color || value;
      return (
        <div
          className="w-full h-full flex items-center gap-2 px-2 py-1 cursor-pointer"
          onClick={() => handleCellClick(item.id, column.key, value, column)}
        >
          <div
            className="w-6 h-6 rounded border border-slate-300"
            style={{ backgroundColor: bgColor }}
          />
          <span className="text-xs">{value}</span>
        </div>
      );
    }

    return (
      <div
        className="w-full h-full px-2 py-1 cursor-pointer truncate"
        onClick={() => handleCellClick(item.id, column.key, value, column)}
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

      {/* Type Selector Modal */}
      {showTypeSelector && (
        <TypeSelectorModal
          isOpen={true}
          onClose={() => setShowTypeSelector(null)}
          onSelect={(selection) =>
            handleTypeSelection(showTypeSelector.itemId, showTypeSelector.key, selection)
          }
        />
      )}

      {/* AI Product Type Search Modal */}
      {showAiSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">AI Product Type Search</h3>
              <button
                onClick={() => {
                  setShowAiSearch(null);
                  setAiClarifications(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            {!aiClarifications && (
              <>
                <p className="text-sm text-slate-600">
                  Describe the product in plain English, or paste an AI-generated description from a photo.
                </p>
                <textarea
                  value={aiSearchQuery}
                  onChange={(e) => setAiSearchQuery(e.target.value)}
                  placeholder="e.g., 'Double casement window with georgian bars' or paste AI description..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={4}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowAiSearch(null)}
                    disabled={aiSearching}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAiSearch}
                    disabled={!aiSearchQuery.trim() || aiSearching}
                  >
                    {aiSearching ? (
                      <>
                        <Wand2 className="h-4 w-4 mr-2 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Search
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const current = showAiSearch;
                      setShowAiSearch(null);
                      setTimeout(() => setShowTypeSelector(current), 50);
                    }}
                    disabled={aiSearching}
                  >
                    Browse Manually
                  </Button>
                </div>
              </>
            )}

            {aiClarifications && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  We need a bit more detail to pick the right product. Choose an option below.
                </p>
                {aiClarifications.map((clarification, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="font-medium text-slate-900">{clarification.question}</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {clarification.options.map((opt) => (
                        <button
                          key={`${opt.type}-${opt.option}-${opt.label}`}
                          onClick={() => handleClarificationSelect(opt)}
                          className="border rounded-lg p-3 text-left hover:border-blue-500 hover:bg-blue-50 transition"
                        >
                          <div className="font-semibold text-slate-900">{opt.label}</div>
                          <div className="text-xs text-slate-500">{opt.option}</div>
                          {opt.hint && <div className="text-xs text-slate-500 mt-1">{opt.hint}</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAiClarifications(null);
                    }}
                    disabled={aiSearching}
                  >
                    Back
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setAiClarifications(null);
                      setAiSearchQuery("");
                      setShowAiSearch(null);
                    }}
                    disabled={aiSearching}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
