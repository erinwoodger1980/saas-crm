// Enhanced Fire Door Grid with Dropdown/Lookup Support
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { FormulaWizard } from "./FormulaWizard";
import { Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface FieldDropdownConfig {
  field: string;
  lookupTableName: string;
  displayField: string;
  valueField: string;
  options?: Array<{ id: string; label: string }>;
}

interface FieldComponentLink {
  field: string;
  componentId: string;
  triggerFields: string[];
  propertyMappings: Record<string, string>;
}

export interface FireDoorGridConfig {
  dropdownFields: Record<string, FieldDropdownConfig>;
  componentLinks: FieldComponentLink[];
  formulas: Record<string, string>;
}

const DEFAULT_GRID_CONFIG: FireDoorGridConfig = {
  dropdownFields: {
    hingeType: {
      field: 'hingeType',
      lookupTableName: 'IronmongeryPrices',
      displayField: 'description',
      valueField: 'id',
    },
    lockType: {
      field: 'lockType',
      lookupTableName: 'IronmongeryPrices',
      displayField: 'description',
      valueField: 'id',
    },
    glassType: {
      field: 'glassType',
      lookupTableName: 'GlassPrices',
      displayField: 'glassType',
      valueField: 'id',
    },
  },
  componentLinks: [
    {
      field: 'hingeType',
      componentId: 'hinges-component',
      triggerFields: ['hingeType', 'qtyOfHinges'],
      propertyMappings: {
        'hingeType': 'hingeType',
        'qtyOfHinges': 'quantity',
      },
    },
    {
      field: 'glassType',
      componentId: 'glass-component',
      triggerFields: ['glassType', 'totalGlazedAreaMaster'],
      propertyMappings: {
        'glassType': 'glassType',
        'totalGlazedAreaMaster': 'area',
      },
    },
  ],
  formulas: {
    'cncBlankWidth': 'masterWidth + (trim * 2)',
    'lineTotal': '(materialCost + labourCost) * quantity',
  },
};

interface ColumnHeaderModalProps {
  isOpen: boolean;
  fieldName: string;
  currentConfig: FieldDropdownConfig | null;
  onClose: () => void;
  onSave: (config: FieldDropdownConfig) => void;
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
  const [formData, setFormData] = useState<Partial<FieldDropdownConfig & { componentId?: string; triggerFields?: string }>>(
    currentConfig || { field: fieldName }
  );
  const [showAdvanced, setShowAdvanced] = useState(!!currentConfig?.valueField);
  const [showFormulaWizard, setShowFormulaWizard] = useState(false);
  const [formulaInput, setFormulaInput] = useState<string>("");

  useEffect(() => {
    if (currentConfig) {
      setFormData(currentConfig);
    } else {
      setFormData({ field: fieldName });
    }
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
            <Select defaultValue={currentConfig ? 'lookup' : 'text'}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text Input</SelectItem>
                <SelectItem value="number">Number Input</SelectItem>
                <SelectItem value="dropdown">Fixed Dropdown</SelectItem>
                <SelectItem value="lookup">Lookup Table</SelectItem>
                <SelectItem value="formula">Formula (Read-only)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.field && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Lookup Table</label>
                {availableLookupTables.length > 0 ? (
                  <Select value={formData.lookupTableName || ''} onValueChange={(value) => setFormData({ ...formData, lookupTableName: value })}>
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
                    value={formData.lookupTableName || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, lookupTableName: e.target.value })
                    }
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Display Field (shows to user)</label>
                <Input
                  placeholder="e.g., label"
                  value={formData.displayField || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, displayField: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Value Field (stored in grid)</label>
                <Input
                  placeholder="e.g., value"
                  value={formData.valueField || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, valueField: e.target.value })
                  }
                />
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
                      <label className="block text-sm font-medium mb-1">Component ID</label>
                      {availableComponents.length > 0 ? (
                        <Select
                          value={(formData as any).componentId || ''}
                          onValueChange={(value) =>
                            setFormData({ ...formData, componentId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a component..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableComponents.map((comp) => (
                              <SelectItem key={comp.id} value={comp.id}>
                                {comp.name} ({comp.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          placeholder="e.g., hinges-component"
                          value={(formData as any).componentId || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, componentId: e.target.value })
                          }
                        />
                      )}
                      <p className="text-xs text-gray-500 mt-1">Leave empty to disable component linking</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Trigger Field Names</label>
                      {availableFields.length > 0 ? (
                        <Select
                          value={(formData as any).triggerFields || ''}
                          onValueChange={(value) =>
                            setFormData({ ...formData, triggerFields: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select fields (comma-separated)..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableFields.map((field) => (
                              <SelectItem key={field.name} value={field.name}>
                                {field.name} ({field.type})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          placeholder="e.g., hingeType, hingeQuantity"
                          value={(formData as any).triggerFields || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, triggerFields: e.target.value })
                          }
                        />
                      )}
                      <p className="text-xs text-gray-500 mt-1">Fields that will trigger component creation when filled</p>
                    </div>

                    <p className="text-xs text-gray-600">When the lookup field is filled, a component will be automatically created with the selected configuration.</p>
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

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (formData.field && formData.lookupTableName && formData.displayField && formData.valueField) {
                  onSave({
                    ...formData as FieldDropdownConfig,
                    formulaExpression: formulaInput || undefined,
                  } as any);
                }
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

export { DEFAULT_GRID_CONFIG };
export type { FireDoorGridConfig, FieldDropdownConfig, FieldComponentLink };
