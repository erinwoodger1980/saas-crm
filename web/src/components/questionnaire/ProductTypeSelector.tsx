"use client";

import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

type ProductCategory = {
  id: string;
  label: string;
  types: ProductType[];
};

type ProductType = {
  type: string;
  label: string;
  options: ProductOption[];
};

type ProductOption = {
  id: string;
  label: string;
};

interface ProductTypeSelectorProps {
  selectedProductTypes?: string[];
  onChange: (productTypes: string[]) => void;
  onClose: () => void;
}

export function ProductTypeSelector({ selectedProductTypes = [], onChange, onClose }: ProductTypeSelectorProps) {
  const [products, setProducts] = useState<ProductCategory[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedProductTypes));

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await apiFetch<{ productTypes?: ProductCategory[] }>("/tenant/settings");
      if (data.productTypes) {
        setProducts(data.productTypes);
      }
    } catch (err) {
      console.error("Failed to load product types:", err);
    }
  };

  const toggleCategory = (categoryId: string) => {
    const category = products.find(c => c.id === categoryId);
    if (!category) return;

    const categoryTypeIds = category.types.map(t => `${categoryId}-${t.type}`);
    const allSelected = categoryTypeIds.every(id => selected.has(id));

    const newSelected = new Set(selected);
    if (allSelected) {
      // Deselect all
      categoryTypeIds.forEach(id => newSelected.delete(id));
    } else {
      // Select all
      categoryTypeIds.forEach(id => newSelected.add(id));
    }
    setSelected(newSelected);
  };

  const toggleType = (categoryId: string, typeId: string) => {
    const fullId = `${categoryId}-${typeId}`;
    const newSelected = new Set(selected);
    if (selected.has(fullId)) {
      newSelected.delete(fullId);
    } else {
      newSelected.add(fullId);
    }
    setSelected(newSelected);
  };

  const handleSave = () => {
    onChange(Array.from(selected));
    onClose();
  };

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-600">
        Select which product types this question applies to. Leave empty to show for all products.
      </div>

      <div className="max-h-96 overflow-y-auto space-y-2 border rounded-lg p-3 bg-slate-50">
        {products.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">No product types configured yet.</p>
        ) : (
          products.map((category) => {
            const categoryTypeIds = category.types.map(t => `${category.id}-${t.type}`);
            const allSelected = categoryTypeIds.every(id => selected.has(id));
            const someSelected = categoryTypeIds.some(id => selected.has(id));

            return (
              <div key={category.id} className="bg-white rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={() => toggleCategory(category.id)}
                    className="h-4 w-4 rounded"
                  />
                  <span className="font-semibold text-slate-900">{category.label}</span>
                  <span className="text-xs text-slate-500">({category.types.length} types)</span>
                </div>
                <div className="ml-6 space-y-1">
                  {category.types.map((type) => {
                    const fullId = `${category.id}-${type.type}`;
                    return (
                      <label key={type.type} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected.has(fullId)}
                          onChange={() => toggleType(category.id, type.type)}
                          className="h-3.5 w-3.5 rounded"
                        />
                        <span className="text-slate-700">{type.label}</span>
                        <span className="text-xs text-slate-400">({type.options.length} options)</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          <X className="h-4 w-4 inline mr-1" />
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
        >
          <Check className="h-4 w-4 inline mr-1" />
          Save Selection
        </button>
      </div>
    </div>
  );
}
