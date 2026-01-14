import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { FormulaWizard } from "./FormulaWizard";
import { Sparkles } from "lucide-react";

export type FireDoorColumnInputType = "text" | "number" | "dropdown" | "formula";

export interface FireDoorColumnConfig {
  inputType?: FireDoorColumnInputType;
  lookupTable?: string | null;
  formula?: string | null;
  componentLink?: string | null; // hinges, locks, glass, doorBlank
  required?: boolean;
}

interface ColumnHeaderModalProps {
  isOpen: boolean;
  fieldName: string;
  currentConfig: FireDoorColumnConfig | null;
  onClose: () => void;
  onSave: (config: FireDoorColumnConfig) => void;
  availableLookupTables?: Array<{ id: string; tableName: string; category?: string }>;
  availableComponents?: Array<{ id: string; code: string; name: string }>;
  availableFields?: Array<{ name: string; type: string }>;
}

export function ColumnHeaderModal({
  isOpen,
  fieldName,
  currentConfig,
  onClose,
  onSave,
  availableLookupTables = [],
  availableComponents = [],
  availableFields = [],
}: ColumnHeaderModalProps) {
  const [formData, setFormData] = useState<FireDoorColumnConfig>(
    currentConfig || { inputType: "text", lookupTable: null, formula: null, componentLink: null, required: false }
  );
  const [showAdvanced, setShowAdvanced] = useState(!!currentConfig?.componentLink);
  const [showFormulaWizard, setShowFormulaWizard] = useState(false);
  const [formulaInput, setFormulaInput] = useState<string>(currentConfig?.formula || "");

  useEffect(() => {
    setFormData(
      currentConfig || { inputType: "text", lookupTable: null, formula: null, componentLink: null, required: false }
    );
    setFormulaInput(currentConfig?.formula || "");
  }, [currentConfig, fieldName]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Field: {fieldName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Input Type</label>
            <Select
              value={formData.inputType || "text"}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, inputType: value as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text Input</SelectItem>
                <SelectItem value="number">Number Input</SelectItem>
                <SelectItem value="dropdown">Lookup Table</SelectItem>
                <SelectItem value="formula">Formula (Read-only)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.inputType === "dropdown" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Lookup Table</label>
                {availableLookupTables.length > 0 ? (
                  <Select
                    value={formData.lookupTable || ""}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, lookupTable: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a lookup table..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLookupTables.map((table) => (
                        <SelectItem key={table.id} value={table.tableName}>
                          {table.tableName} {table.category ? `(${table.category})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="e.g., Timber, Glass, Hinges"
                    value={formData.lookupTable || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, lookupTable: e.target.value }))}
                  />
                )}
              </div>

              <div className="border-t pt-4">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  {showAdvanced ? '▼' : '▶'} Component Linking (Advanced)
                </button>
                
                {showAdvanced && (
                  <div className="mt-3 space-y-3 bg-blue-50 p-3 rounded">
                    <div>
                      <label className="block text-sm font-medium mb-1">Component Link</label>
                      <Select
                        value={formData.componentLink || ""}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, componentLink: value || null }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          <SelectItem value="hinges">Hinges</SelectItem>
                          <SelectItem value="locks">Locks</SelectItem>
                          <SelectItem value="glass">Vision Glass</SelectItem>
                          <SelectItem value="doorBlank">Door Blank</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">When this field is filled, a component can be auto-created.</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Formula input section */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium">Formula (Optional)</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowFormulaWizard(true)}
                className="gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Formula Wizard
              </Button>
            </div>
            <Input
              placeholder="e.g., ${masterWidth} * 2 + ${trim}"
              value={formulaInput}
              onChange={(e) => setFormulaInput(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-gray-500">
              Use ${'{fieldName}'} to reference other fields, or use the wizard to build formulas visually
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`required-${fieldName}`}
              className="rounded"
              checked={!!formData.required}
              onChange={(e) => setFormData((prev) => ({ ...prev, required: e.target.checked }))}
            />
            <label htmlFor={`required-${fieldName}`} className="text-sm text-slate-700">Required field</label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSave({
                  ...formData,
                  // If a formula is set, ensure the field is treated as formula/read-only
                  inputType: formulaInput ? "formula" : (formData.inputType || "text"),
                  formula: formulaInput ? formulaInput : null,
                  // lookupTable only makes sense for dropdown
                  lookupTable: (formData.inputType === "dropdown") ? (formData.lookupTable || null) : null,
                });
              }}
            >
              Save Configuration
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Formula Wizard Modal */}
      <FormulaWizard
        isOpen={showFormulaWizard}
        onClose={() => setShowFormulaWizard(false)}
        onSave={(formula) => {
          setFormulaInput(formula);
          setShowFormulaWizard(false);
        }}
        availableFields={availableFields}
        availableLookupTables={availableLookupTables}
      />
    </Dialog>
  );
}

// Dropdown cell renderer
export function DropdownCell({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger className="w-full border-0">
        <SelectValue placeholder="Select..." />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ColumnHeaderModal is consumed by FireDoorSpreadsheet.
