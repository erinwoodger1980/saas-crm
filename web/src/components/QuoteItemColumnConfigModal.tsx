"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { GripVertical, Plus, X, Search } from "lucide-react";
import { ColumnConfig } from "./QuoteItemsGrid";

interface QuoteItemColumnConfigModalProps {
  open: boolean;
  onClose: () => void;
  availableFields: Array<{
    key: string;
    label: string;
    type: string;
    options?: string[];
  }>;
  currentConfig: ColumnConfig[];
  onSave: (config: ColumnConfig[]) => void;
}

export function QuoteItemColumnConfigModal({
  open,
  onClose,
  availableFields,
  currentConfig,
  onSave,
}: QuoteItemColumnConfigModalProps) {
  const [columns, setColumns] = useState<ColumnConfig[]>(currentConfig);
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setColumns([...currentConfig]);
      setSearchQuery("");
    }
  }, [open, currentConfig]);

  const filteredAvailable = availableFields.filter(
    (field) =>
      !columns.some((col) => col.key === field.key) &&
      field.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddColumn = (field: typeof availableFields[0]) => {
    const newColumn: ColumnConfig = {
      key: field.key,
      label: field.label,
      type: field.type,
      width: 150,
      frozen: false,
      visible: true,
      options: field.options,
    };
    setColumns([...columns, newColumn]);
  };

  const handleRemoveColumn = (key: string) => {
    setColumns(columns.filter((col) => col.key !== key));
  };

  const handleToggleVisible = (key: string) => {
    setColumns(
      columns.map((col) =>
        col.key === key ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const handleToggleFrozen = (key: string) => {
    setColumns(
      columns.map((col) =>
        col.key === key ? { ...col, frozen: !col.frozen } : col
      )
    );
  };

  const handleWidthChange = (key: string, width: number) => {
    setColumns(
      columns.map((col) =>
        col.key === key ? { ...col, width: Math.max(80, width) } : col
      )
    );
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newColumns = [...columns];
    const draggedItem = newColumns[draggedIndex];
    newColumns.splice(draggedIndex, 1);
    newColumns.splice(index, 0, draggedItem);
    setColumns(newColumns);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = () => {
    onSave(columns);
    onClose();
  };

  const handleReset = () => {
    const defaultColumns: ColumnConfig[] = [
      {
        key: "itemNumber",
        label: "Item #",
        type: "number",
        width: 80,
        frozen: true,
        visible: true,
      },
    ];
    setColumns(defaultColumns);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Quote Item Columns</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Columns */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Current Columns
            </h3>
            <div className="space-y-2">
              {columns.map((column, index) => (
                <div
                  key={column.key}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 border rounded-lg bg-white ${
                    draggedIndex === index ? "opacity-50" : ""
                  }`}
                >
                  <GripVertical className="h-5 w-5 text-slate-400 cursor-grab" />
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={column.visible}
                      onCheckedChange={() => handleToggleVisible(column.key)}
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {column.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <Checkbox
                        checked={column.frozen}
                        onCheckedChange={() => handleToggleFrozen(column.key)}
                      />
                      Frozen
                    </label>

                    <Input
                      type="number"
                      value={column.width}
                      onChange={(e) =>
                        handleWidthChange(column.key, parseInt(e.target.value))
                      }
                      className="w-20 h-8 text-xs"
                      min={80}
                    />
                    <span className="text-xs text-slate-500">px</span>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveColumn(column.key)}
                      className="h-8 w-8 p-0 text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Available Fields */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Add Columns
            </h3>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {filteredAvailable.map((field) => (
                <Button
                  key={field.key}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddColumn(field)}
                  className="justify-start"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {field.label}
                </Button>
              ))}
              {filteredAvailable.length === 0 && (
                <div className="col-span-2 text-center py-4 text-sm text-slate-500">
                  No fields available
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={handleReset}>
              Reset to Default
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Configuration</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
