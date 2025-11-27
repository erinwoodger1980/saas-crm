// web/src/components/ColumnConfigModal.tsx
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { GripVertical, X, Search } from "lucide-react";

type ColumnConfig = {
  field: string;
  label: string;
  visible: boolean;
  width?: number;
  frozen?: boolean;
};

type ColumnConfigModalProps = {
  open: boolean;
  onClose: () => void;
  availableFields: Array<{ field: string; label: string; type?: string }>;
  currentConfig: ColumnConfig[];
  onSave: (config: ColumnConfig[]) => void;
  tabName?: string;
};

export function ColumnConfigModal({
  open,
  onClose,
  availableFields,
  currentConfig,
  onSave,
  tabName,
}: ColumnConfigModalProps) {
  const [columns, setColumns] = useState<ColumnConfig[]>(currentConfig);
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    setColumns(currentConfig);
  }, [currentConfig, open]);

  const filteredFields = availableFields.filter((f) =>
    f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.field.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleVisible = (field: string) => {
    setColumns((prev) =>
      prev.map((c) => (c.field === field ? { ...c, visible: !c.visible } : c))
    );
  };

  const handleToggleFrozen = (field: string) => {
    setColumns((prev) =>
      prev.map((c) => (c.field === field ? { ...c, frozen: !c.frozen } : c))
    );
  };

  const handleAddColumn = (field: string) => {
    const existing = columns.find((c) => c.field === field);
    if (existing) {
      setColumns((prev) =>
        prev.map((c) => (c.field === field ? { ...c, visible: true } : c))
      );
    } else {
      const fieldDef = availableFields.find((f) => f.field === field);
      setColumns((prev) => [
        ...prev,
        {
          field,
          label: fieldDef?.label || field,
          visible: true,
          width: 150,
          frozen: false,
        },
      ]);
    }
  };

  const handleRemoveColumn = (field: string) => {
    setColumns((prev) => prev.filter((c) => c.field !== field));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newColumns = [...columns];
    const [removed] = newColumns.splice(draggedIndex, 1);
    newColumns.splice(index, 0, removed);
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
    // Reset to default columns
    const defaults: ColumnConfig[] = availableFields.slice(0, 5).map((f) => ({
      field: f.field,
      label: f.label,
      visible: true,
      width: 150,
      frozen: false,
    }));
    setColumns(defaults);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Configure Columns {tabName && `- ${tabName}`}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Current Columns */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-slate-700">Active Columns</h3>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset to Default
              </Button>
            </div>
            <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
              {columns.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  No columns configured. Add columns from the list below.
                </p>
              ) : (
                columns.map((col, index) => (
                  <div
                    key={col.field}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 cursor-move hover:shadow-md transition-shadow ${
                      draggedIndex === index ? "opacity-50" : ""
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-700 truncate block">
                        {col.label}
                      </span>
                      <span className="text-xs text-slate-500">{col.field}</span>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={col.visible}
                          onCheckedChange={() => handleToggleVisible(col.field)}
                        />
                        <span className="text-xs text-slate-600">Visible</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={col.frozen || false}
                          onCheckedChange={() => handleToggleFrozen(col.field)}
                        />
                        <span className="text-xs text-slate-600">Frozen</span>
                      </label>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveColumn(col.field)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Available Fields */}
          <div>
            <h3 className="font-semibold text-sm text-slate-700 mb-3">Add Columns</h3>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded-lg p-3 bg-slate-50">
              {filteredFields.map((field) => {
                const inConfig = columns.some((c) => c.field === field.field);
                return (
                  <Button
                    key={field.field}
                    variant={inConfig ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => handleAddColumn(field.field)}
                    className="justify-start text-left"
                    disabled={inConfig && columns.find((c) => c.field === field.field)?.visible}
                  >
                    <span className="truncate">{field.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
