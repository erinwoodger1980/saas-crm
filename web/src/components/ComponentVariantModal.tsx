"use client";

import { useState, useEffect } from "react";
import { X, DollarSign, Package, Truck, TrendingUp } from "lucide-react";
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

interface Component {
  id: string;
  code: string;
  name: string;
  componentType: string;
  basePrice: number;
  unitOfMeasure: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface ComponentVariant {
  id: string;
  variantCode: string;
  variantName: string;
  attributeValues: Record<string, any>;
  dimensionFormulas: Record<string, any> | null;
  priceModifier: number;
  unitPrice: number | null;
  supplierId: string | null;
  supplierSKU: string | null;
  leadTimeDays: number | null;
  minimumOrderQty: number | null;
  isActive: boolean;
  isStocked: boolean;
  stockLevel: number | null;
}

interface ComponentVariantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  component: Component;
  attributes: ComponentAttribute[];
  suppliers: Supplier[];
  variant?: ComponentVariant | null;
}

export default function ComponentVariantModal({
  isOpen,
  onClose,
  onSave,
  component,
  attributes,
  suppliers,
  variant,
}: ComponentVariantModalProps) {
  const [formData, setFormData] = useState({
    variantCode: "",
    variantName: "",
    priceModifier: 0,
    unitPrice: null as number | null,
    supplierId: "",
    supplierSKU: "",
    leadTimeDays: null as number | null,
    minimumOrderQty: 1,
    isActive: true,
    isStocked: false,
    stockLevel: null as number | null,
  });

  const [attributeValues, setAttributeValues] = useState<Record<string, any>>({});
  const [calculatedPrice, setCalculatedPrice] = useState<number>(component.basePrice);
  const [priceBreakdown, setPriceBreakdown] = useState<Array<{ attribute: string; modifier: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (variant) {
      setFormData({
        variantCode: variant.variantCode,
        variantName: variant.variantName,
        priceModifier: variant.priceModifier,
        unitPrice: variant.unitPrice,
        supplierId: variant.supplierId || "",
        supplierSKU: variant.supplierSKU || "",
        leadTimeDays: variant.leadTimeDays,
        minimumOrderQty: variant.minimumOrderQty || 1,
        isActive: variant.isActive,
        isStocked: variant.isStocked,
        stockLevel: variant.stockLevel,
      });
      setAttributeValues(variant.attributeValues || {});
    } else {
      // Reset for new variant
      setFormData({
        variantCode: "",
        variantName: "",
        priceModifier: 0,
        unitPrice: null,
        supplierId: "",
        supplierSKU: "",
        leadTimeDays: null,
        minimumOrderQty: 1,
        isActive: true,
        isStocked: false,
        stockLevel: null,
      });
      setAttributeValues({});
    }
    setError("");
  }, [variant, isOpen]);

  // Calculate price whenever attribute values or price modifier changes
  useEffect(() => {
    calculatePrice();
  }, [attributeValues, formData.priceModifier, formData.unitPrice]);

  const calculatePrice = async () => {
    if (formData.unitPrice !== null) {
      setCalculatedPrice(formData.unitPrice);
      setPriceBreakdown([{ attribute: "Unit Price Override", modifier: formData.unitPrice - component.basePrice }]);
      return;
    }

    // Calculate from base price + attribute modifiers + manual modifier
    let totalModifier = formData.priceModifier;
    const breakdown: Array<{ attribute: string; modifier: number }> = [];

    if (formData.priceModifier !== 0) {
      breakdown.push({ attribute: "Manual Adjustment", modifier: formData.priceModifier });
    }

    // Add price modifiers from SELECT attributes
    attributes
      .filter(attr => attr.attributeType === 'SELECT' && attr.affectsPrice && attr.options)
      .forEach(attr => {
        const selectedValue = attributeValues[attr.attributeName];
        if (selectedValue && attr.options) {
          const option = attr.options.find((o: AttributeOption) => o.value === selectedValue);
          if (option && option.priceModifier !== 0) {
            totalModifier += option.priceModifier;
            breakdown.push({ attribute: attr.attributeName, modifier: option.priceModifier });
          }
        }
      });

    setCalculatedPrice(component.basePrice + totalModifier);
    setPriceBreakdown(breakdown);
  };

  const generateVariantCode = () => {
    // Auto-generate variant code from attribute values
    const parts = [component.code.split('-')[0]]; // e.g., "LIP" from "LIPPING-BASE"
    
    attributes
      .filter(attr => attr.attributeType === 'SELECT')
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .forEach(attr => {
        const value = attributeValues[attr.attributeName];
        if (value) {
          parts.push(value);
        }
      });

    return parts.join('-');
  };

  const handleAttributeChange = (attributeName: string, value: any) => {
    const newValues = { ...attributeValues, [attributeName]: value };
    setAttributeValues(newValues);

    // Auto-generate variant code if not manually set
    if (!variant && !formData.variantCode) {
      const newCode = generateVariantCode();
      setFormData(prev => ({ ...prev, variantCode: newCode }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.variantCode.trim()) {
      setError("Variant code is required");
      return;
    }

    if (!formData.variantName.trim()) {
      setError("Variant name is required");
      return;
    }

    // Check required attributes
    const missingRequired = attributes.filter(
      attr => attr.isRequired && !attributeValues[attr.attributeName]
    );
    if (missingRequired.length > 0) {
      setError(`Missing required attributes: ${missingRequired.map(a => a.attributeName).join(', ')}`);
      return;
    }

    setSaving(true);

    try {
      const payload: any = {
        componentLookupId: component.id,
        variantCode: formData.variantCode,
        variantName: formData.variantName,
        attributeValues,
        priceModifier: formData.priceModifier,
        unitPrice: formData.unitPrice,
        supplierId: formData.supplierId || null,
        supplierSKU: formData.supplierSKU || null,
        leadTimeDays: formData.leadTimeDays,
        minimumOrderQty: formData.minimumOrderQty,
        isActive: formData.isActive,
        isStocked: formData.isStocked,
        stockLevel: formData.isStocked ? formData.stockLevel : null,
      };

      if (variant) {
        await apiFetch(`/component-variants/${variant.id}`, {
          method: 'PUT',
          json: payload
        });
      } else {
        await apiFetch('/component-variants', {
          method: 'POST',
          json: payload
        });
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save variant");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const selectAttributes = attributes.filter(attr => attr.attributeType === 'SELECT').sort((a, b) => a.displayOrder - b.displayOrder);
  const calculatedAttributes = attributes.filter(attr => attr.attributeType === 'CALCULATED').sort((a, b) => a.displayOrder - b.displayOrder);
  const textAttributes = attributes.filter(attr => attr.attributeType === 'TEXT').sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900">
            {variant ? "Edit Variant" : "Create Variant"}
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

          {/* Component Info */}
          <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Base Component</p>
                <p className="text-lg font-semibold text-slate-900">{component.name}</p>
                <p className="text-xs text-slate-500">Code: {component.code}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600">Base Price</p>
                <p className="text-2xl font-bold text-blue-600">£{component.basePrice.toFixed(2)}</p>
                <p className="text-xs text-slate-500">per {component.unitOfMeasure}</p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 border-b pb-2">Variant Details</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Variant Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.variantCode}
                  onChange={(e) => setFormData({ ...formData, variantCode: e.target.value })}
                  placeholder="e.g., LIP-OAK-10MM"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Variant Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.variantName}
                  onChange={(e) => setFormData({ ...formData, variantName: e.target.value })}
                  placeholder="e.g., Oak Lipping 10mm"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>
            </div>
          </div>

          {/* Attribute Values */}
          {(selectAttributes.length > 0 || textAttributes.length > 0) && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 border-b pb-2">Attribute Configuration</h3>
              
              <div className="grid grid-cols-2 gap-4">
                {selectAttributes.map(attr => (
                  <div key={attr.id}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {attr.attributeName}
                      {attr.isRequired && <span className="text-red-500 ml-1">*</span>}
                      {attr.affectsPrice && <span className="ml-1 text-xs text-green-600">(affects price)</span>}
                    </label>
                    <select
                      value={attributeValues[attr.attributeName] || ""}
                      onChange={(e) => handleAttributeChange(attr.attributeName, e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      required={attr.isRequired}
                    >
                      <option value="">-- Select --</option>
                      {attr.options?.map((opt: AttributeOption) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                          {opt.priceModifier !== 0 && ` (+£${opt.priceModifier.toFixed(2)})`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}

                {textAttributes.map(attr => (
                  <div key={attr.id}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {attr.attributeName}
                      {attr.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <input
                      type="text"
                      value={attributeValues[attr.attributeName] || ""}
                      onChange={(e) => handleAttributeChange(attr.attributeName, e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      required={attr.isRequired}
                    />
                  </div>
                ))}
              </div>

              {calculatedAttributes.length > 0 && (
                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <p className="text-sm font-medium text-slate-700 mb-2">Calculated Attributes (auto-generated at BOM creation):</p>
                  <div className="space-y-2">
                    {calculatedAttributes.map(attr => (
                      <div key={attr.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{attr.attributeName}:</span>
                        <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-700">
                          {attr.calculationFormula} {attr.calculationUnit && `(${attr.calculationUnit})`}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 border-b pb-2">Pricing</h3>
            
            <div className="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-4 border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-slate-700">Calculated Price</p>
                  {priceBreakdown.length > 0 && (
                    <div className="mt-1 space-y-1">
                      <p className="text-xs text-slate-600">Base: £{component.basePrice.toFixed(2)}</p>
                      {priceBreakdown.map((item, idx) => (
                        <p key={idx} className="text-xs text-slate-600">
                          {item.attribute}: {item.modifier >= 0 ? '+' : ''}£{item.modifier.toFixed(2)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-green-600">£{calculatedPrice.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">per {component.unitOfMeasure}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <DollarSign className="inline h-4 w-4 mr-1" />
                  Price Modifier (£)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.priceModifier}
                  onChange={(e) => setFormData({ ...formData, priceModifier: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="mt-1 text-xs text-slate-500">Added to calculated price</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <TrendingUp className="inline h-4 w-4 mr-1" />
                  Unit Price Override (£)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.unitPrice || ""}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Leave empty to use calculated"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="mt-1 text-xs text-slate-500">Overrides all calculations</p>
              </div>
            </div>
          </div>

          {/* Supplier & Inventory */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 border-b pb-2">Supplier & Inventory</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Package className="inline h-4 w-4 mr-1" />
                  Supplier
                </label>
                <select
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">-- None --</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Supplier SKU
                </label>
                <input
                  type="text"
                  value={formData.supplierSKU}
                  onChange={(e) => setFormData({ ...formData, supplierSKU: e.target.value })}
                  placeholder="Supplier's product code"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Truck className="inline h-4 w-4 mr-1" />
                  Lead Time (days)
                </label>
                <input
                  type="number"
                  value={formData.leadTimeDays || ""}
                  onChange={(e) => setFormData({ ...formData, leadTimeDays: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Leave empty for component default"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Minimum Order Qty
                </label>
                <input
                  type="number"
                  value={formData.minimumOrderQty}
                  onChange={(e) => setFormData({ ...formData, minimumOrderQty: parseInt(e.target.value) || 1 })}
                  min="1"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isStocked}
                  onChange={(e) => setFormData({ ...formData, isStocked: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Track Stock Level</span>
              </label>

              {formData.isStocked && (
                <div className="ml-6">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Current Stock Level
                  </label>
                  <input
                    type="number"
                    value={formData.stockLevel || ""}
                    onChange={(e) => setFormData({ ...formData, stockLevel: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="0"
                    className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Active (available for selection)</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t pt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving..."
                : variant
                  ? "Update Variant"
                  : "Create Variant"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
