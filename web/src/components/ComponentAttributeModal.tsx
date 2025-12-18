"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

interface AttributeOption {
  value: string;
  label: string;
  priceModifier: number;
  metadata?: any;
}

interface ComponentAttribute {
  id: string;
  componentType: string;
  attributeName: string;
  attributeType: "SELECT" | "CALCULATED" | "TEXT";
  options: AttributeOption[] | null;
  calculationFormula: string | null;
  calculationUnit: string | null;
  isRequired: boolean;
  affectsPrice: boolean;
  affectsBOM: boolean;
  displayOrder: number;
}

interface ComponentAttributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  componentType: string;
  attribute?: ComponentAttribute | null;
}

export default function ComponentAttributeModal({
  isOpen,
  onClose,
  onSave,
  componentType,
  attribute,
}: ComponentAttributeModalProps) {
  const [formData, setFormData] = useState({
    attributeName: "",
    attributeType: "SELECT" as "SELECT" | "CALCULATED" | "TEXT",
    calculationFormula: "",
    calculationUnit: "",
    isRequired: false,
    affectsPrice: false,
    affectsBOM: false,
    displayOrder: 0,
  });

  const [options, setOptions] = useState<AttributeOption[]>([
    { value: "", label: "", priceModifier: 0 },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (attribute) {
      setFormData({
        attributeName: attribute.attributeName,
        attributeType: attribute.attributeType,
        calculationFormula: attribute.calculationFormula || "",
        calculationUnit: attribute.calculationUnit || "",
        isRequired: attribute.isRequired,
        affectsPrice: attribute.affectsPrice,
        affectsBOM: attribute.affectsBOM,
        displayOrder: attribute.displayOrder,
      });
      if (attribute.options && attribute.options.length > 0) {
        setOptions(attribute.options);
      }
    } else {
      // Reset for new attribute
      setFormData({
        attributeName: "",
        attributeType: "SELECT",
        calculationFormula: "",
        calculationUnit: "",
        isRequired: false,
        affectsPrice: false,
        affectsBOM: false,
        displayOrder: 0,
      });
      setOptions([{ value: "", label: "", priceModifier: 0 }]);
    }
    setError("");
  }, [attribute, isOpen]);

  const handleAddOption = () => {
    setOptions([...options, { value: "", label: "", priceModifier: 0 }]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 1) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (
    index: number,
    field: keyof AttributeOption,
    value: any
  ) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.attributeName.trim()) {
      setError("Attribute name is required");
      return;
    }

    if (formData.attributeType === "SELECT") {
      // Validate options
      const validOptions = options.filter(
        (opt) => opt.value.trim() && opt.label.trim()
      );
      if (validOptions.length === 0) {
        setError("At least one option is required for SELECT type");
        return;
      }
    }

    if (formData.attributeType === "CALCULATED") {
      if (!formData.calculationFormula.trim()) {
        setError("Calculation formula is required for CALCULATED type");
        return;
      }
    }

    setSaving(true);

    try {
      const payload: any = {
        componentType,
        attributeName: formData.attributeName,
        attributeType: formData.attributeType,
        isRequired: formData.isRequired,
        affectsPrice: formData.affectsPrice,
        affectsBOM: formData.affectsBOM,
        displayOrder: formData.displayOrder,
      };

      if (formData.attributeType === "SELECT") {
        // Clean up options - only send valid ones
        payload.options = options
          .filter((opt) => opt.value.trim() && opt.label.trim())
          .map((opt) => ({
            value: opt.value.trim(),
            label: opt.label.trim(),
            priceModifier: opt.priceModifier || 0,
            metadata: opt.metadata || null,
          }));
      } else {
        payload.options = null;
      }

      if (formData.attributeType === "CALCULATED") {
        payload.calculationFormula = formData.calculationFormula;
        payload.calculationUnit = formData.calculationUnit || null;
      } else {
        payload.calculationFormula = null;
        payload.calculationUnit = null;
      }

      // Use API client (with auth cookies) and correct base path mounted in api server
      const url = attribute
        ? `/component-attributes/${attribute.id}`
        : "/component-attributes";
      const method = attribute ? "PUT" : "POST";
      await apiFetch(url, { method, json: payload });

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save attribute");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900">
            {attribute ? "Edit Attribute" : "Create Attribute"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Component Type
              </label>
              <input
                type="text"
                value={componentType}
                disabled
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Attribute Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.attributeName}
                onChange={(e) =>
                  setFormData({ ...formData, attributeName: e.target.value })
                }
                placeholder="e.g., Timber Type, Thickness, Width"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Attribute Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.attributeType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    attributeType: e.target.value as any,
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                disabled={!!attribute} // Can't change type after creation
              >
                <option value="SELECT">SELECT - Dropdown with options</option>
                <option value="CALCULATED">CALCULATED - Formula-based</option>
                <option value="TEXT">TEXT - Free text input</option>
              </select>
              {attribute && (
                <p className="mt-1 text-xs text-slate-500">
                  Attribute type cannot be changed after creation
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      displayOrder: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </div>

          {/* Type-specific fields */}
          {formData.attributeType === "SELECT" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  Options <span className="text-red-500">*</span>
                </label>
                <Button
                  type="button"
                  onClick={handleAddOption}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Option
                </Button>
              </div>

              <div className="space-y-3">
                {options.map((option, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Value
                        </label>
                        <input
                          type="text"
                          value={option.value}
                          onChange={(e) =>
                            handleOptionChange(index, "value", e.target.value)
                          }
                          placeholder="OAK"
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Label
                        </label>
                        <input
                          type="text"
                          value={option.label}
                          onChange={(e) =>
                            handleOptionChange(index, "label", e.target.value)
                          }
                          placeholder="Oak"
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          <DollarSign className="h-3 w-3 inline mr-0.5" />
                          Price Modifier (£)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={option.priceModifier}
                          onChange={(e) =>
                            handleOptionChange(
                              index,
                              "priceModifier",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0.00"
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    {options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="mt-6 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {formData.attributeType === "CALCULATED" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Calculation Formula <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.calculationFormula}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      calculationFormula: e.target.value,
                    })
                  }
                  placeholder="e.g., blankThickness or (blankHeight * 2 + blankWidth * 2) / 1000"
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Available variables: blankThickness, blankHeight, blankWidth,
                  doorType
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Unit of Measurement
                </label>
                <input
                  type="text"
                  value={formData.calculationUnit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      calculationUnit: e.target.value,
                    })
                  }
                  placeholder="e.g., mm, m, kg"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          )}

          {/* Settings */}
          <div className="space-y-3 border-t pt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isRequired}
                onChange={(e) =>
                  setFormData({ ...formData, isRequired: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Required Attribute
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.affectsPrice}
                onChange={(e) =>
                  setFormData({ ...formData, affectsPrice: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Affects Price
              </span>
              <span className="text-xs text-slate-500">
                (Price modifiers will be applied)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.affectsBOM}
                onChange={(e) =>
                  setFormData({ ...formData, affectsBOM: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Affects BOM
              </span>
              <span className="text-xs text-slate-500">
                (Different materials/components per option)
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t pt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving..."
                : attribute
                  ? "Update Attribute"
                  : "Create Attribute"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
