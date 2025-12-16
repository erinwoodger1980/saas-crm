"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { Upload, Trash2, Plus, Wand2, ChevronRight, ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const DEFAULT_SVG_PROMPT =
  "Provide a detailed elevation with correct timber/glass fills, rails, stiles, panels, muntins, and dimension lines (800mm top, 2025mm left).";

type ProductOption = {
  id: string;
  label: string;
  imagePath?: string;
  imageDataUrl?: string;
  svg?: string;
};

type ProductType = {
  type: string;
  label: string;
  options: ProductOption[];
};

type ProductCategory = {
  id: string;
  label: string;
  types: ProductType[];
};

const INITIAL_PRODUCTS: ProductCategory[] = [
  {
    id: "doors",
    label: "Doors",
    types: [
      {
        type: "entrance",
        label: "Entrance Door",
        options: [
          { id: "entrance-single", label: "Single Door", imagePath: "/diagrams/doors/entrance-single.svg" },
          { id: "entrance-double", label: "Double Door", imagePath: "/diagrams/doors/entrance-double.svg" },
        ],
      },
      {
        type: "bifold",
        label: "Bi-fold",
        options: [
          { id: "bifold-2-panel", label: "2 Panel", imagePath: "/diagrams/doors/bifold-2.svg" },
          { id: "bifold-3-panel", label: "3 Panel", imagePath: "/diagrams/doors/bifold-3.svg" },
          { id: "bifold-4-panel", label: "4 Panel", imagePath: "/diagrams/doors/bifold-4.svg" },
        ],
      },
      {
        type: "sliding",
        label: "Sliding",
        options: [
          { id: "sliding-single", label: "Single Slider", imagePath: "/diagrams/doors/sliding-single.svg" },
          { id: "sliding-double", label: "Double Slider", imagePath: "/diagrams/doors/sliding-double.svg" },
        ],
      },
      {
        type: "french",
        label: "French Door",
        options: [
          { id: "french-standard", label: "Standard French", imagePath: "/diagrams/doors/french-standard.svg" },
          { id: "french-extended", label: "Extended French", imagePath: "/diagrams/doors/french-extended.svg" },
        ],
      },
    ],
  },
  {
    id: "windows",
    label: "Windows",
    types: [
      {
        type: "sash-cord",
        label: "Sash (Cord)",
        options: [
          { id: "sash-cord-single", label: "Single Hung", imagePath: "/diagrams/windows/sash-cord-single.svg" },
          { id: "sash-cord-double", label: "Double Hung", imagePath: "/diagrams/windows/sash-cord-double.svg" },
        ],
      },
      {
        type: "sash-spring",
        label: "Sash (Spring)",
        options: [
          { id: "sash-spring-single", label: "Single Hung", imagePath: "/diagrams/windows/sash-spring-single.svg" },
          { id: "sash-spring-double", label: "Double Hung", imagePath: "/diagrams/windows/sash-spring-double.svg" },
        ],
      },
      {
        type: "casement",
        label: "Casement",
        options: [
          { id: "casement-single", label: "Single Casement", imagePath: "/diagrams/windows/casement-single.svg" },
          { id: "casement-double", label: "Double Casement", imagePath: "/diagrams/windows/casement-double.svg" },
        ],
      },
      {
        type: "stormproof",
        label: "Stormproof",
        options: [
          { id: "stormproof-single", label: "Single Stormproof", imagePath: "/diagrams/windows/stormproof-single.svg" },
          { id: "stormproof-double", label: "Double Stormproof", imagePath: "/diagrams/windows/stormproof-double.svg" },
        ],
      },
      {
        type: "alu-clad",
        label: "Alu-Clad",
        options: [
          { 
            id: "alu-clad-casement", 
            label: "Casement", 
            imagePath: "/diagrams/windows/alu-clad.svg",
            svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <rect x="16" y="16" width="68" height="68" rx="2"/>
  <rect x="20" y="20" width="60" height="60" rx="2" stroke-width="2"/>
  <rect x="24" y="24" width="52" height="52" rx="1"/>
</svg>`
          },
          { id: "alu-clad-tilt-turn", label: "Tilt & Turn", imagePath: "/diagrams/windows/alu-clad-tilt-turn.svg" },
        ],
      },
    ],
  },
];

export default function ProductTypesSection() {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductCategory[]>(INITIAL_PRODUCTS);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [generatingSvg, setGeneratingSvg] = useState<string | null>(null);
  const [svgDialog, setSvgDialog] = useState<{
    categoryId: string;
    typeIdx: number;
    optionId: string;
    label: string;
  } | null>(null);
  const [svgDescription, setSvgDescription] = useState<string>("");

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

  const saveProducts = async () => {
    setSaving(true);
    try {
      await apiFetch("/tenant/settings", {
        method: "PATCH",
        json: { productTypes: products },
      });
      
      // Train ML model with updated product types
      await apiFetch("/ml/train-product-types", {
        method: "POST",
        json: { productTypes: products },
      });

      toast({
        title: "Products saved",
        description: "Product types updated and ML model trained",
      });
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err.message || "Could not save products",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (categoryId: string, typeIdx: number, optionId: string, file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setProducts((prev) =>
          prev.map((cat) =>
            cat.id === categoryId
              ? {
                  ...cat,
                  types: cat.types.map((type, idx) =>
                    idx === typeIdx
                      ? {
                          ...type,
                          options: type.options.map((opt) =>
                            opt.id === optionId
                              ? { ...opt, imageDataUrl: dataUrl, imagePath: dataUrl, svg: undefined }
                              : opt
                          ),
                        }
                      : type
                  ),
                }
              : cat
          )
        );
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast({
        title: "Upload failed",
        description: "Could not upload image",
        variant: "destructive",
      });
    }
  };

  const generateSvg = async (
    categoryId: string,
    typeIdx: number,
    optionId: string,
    label: string,
    description: string,
  ) => {
    setGeneratingSvg(optionId);
    try {
      const response = await apiFetch<{ svg: string }>("/ml/generate-product-svg", {
        method: "POST",
        json: {
          category: categoryId,
          type: products.find((c) => c.id === categoryId)?.types[typeIdx]?.type,
          option: label,
          description,
        },
      });

      const svg = response.svg?.trim();
      if (!svg || !svg.startsWith("<svg")) {
        throw new Error("Invalid SVG returned");
      }
      if (!svg.includes('viewBox="0 0 140 170"')) {
        throw new Error("SVG missing required viewBox 0 0 140 170");
      }
      if (svg.includes("<script")) {
        throw new Error("SVG contains forbidden script tag");
      }

      setProducts((prev) =>
        prev.map((cat) =>
          cat.id === categoryId
            ? {
                ...cat,
                types: cat.types.map((type, idx) =>
                  idx === typeIdx
                    ? {
                        ...type,
                        options: type.options.map((opt) =>
                          opt.id === optionId ? { ...opt, svg, imageDataUrl: undefined, imagePath: undefined } : opt
                        ),
                      }
                    : type
                ),
              }
            : cat
        )
      );

      toast({
        title: "SVG generated",
        description: "AI-generated diagram created",
      });
    } catch (err: any) {
      toast({
        title: "Generation failed",
        description: err.message || "Could not generate SVG",
        variant: "destructive",
      });
    } finally {
      setGeneratingSvg(null);
    }
  };

  const addCategory = () => {
    setProducts((prev) => [
      ...prev,
      {
        id: `category-custom-${Date.now()}`,
        label: "New Category",
        types: [
          {
            type: `type-${Date.now()}`,
            label: "New Type",
            options: [{ id: `option-${Date.now()}`, label: "New Option" }],
          },
        ],
      },
    ]);
  };

  const addType = (categoryId: string) => {
    setProducts((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              types: [
                ...cat.types,
                {
                  type: `type-${Date.now()}`,
                  label: "New Type",
                  options: [{ id: `option-${Date.now()}`, label: "New Option" }],
                },
              ],
            }
          : cat
      )
    );
  };

  const addOption = (categoryId: string, typeIdx: number) => {
    setProducts((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              types: cat.types.map((type, idx) =>
                idx === typeIdx
                  ? {
                      ...type,
                      options: [
                        ...type.options,
                        {
                          id: `${type.type}-custom-${Date.now()}`,
                          label: "New Option",
                        },
                      ],
                    }
                  : type
              ),
            }
          : cat
      )
    );
  };

  const deleteCategory = (categoryId: string) => {
    setProducts((prev) => prev.filter((cat) => cat.id !== categoryId));
  };

  const deleteType = (categoryId: string, typeIdx: number) => {
    setProducts((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? { ...cat, types: cat.types.filter((_, idx) => idx !== typeIdx) }
          : cat
      )
    );
  };

  const deleteOption = (categoryId: string, typeIdx: number, optionId: string) => {
    setProducts((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              types: cat.types.map((type, idx) =>
                idx === typeIdx
                  ? {
                      ...type,
                      options: type.options.filter((opt) => opt.id !== optionId),
                    }
                  : type
              ),
            }
          : cat
      )
    );
  };

  const updateCategoryLabel = (categoryId: string, label: string) => {
    setProducts((prev) =>
      prev.map((cat) =>
        cat.id === categoryId ? { ...cat, label } : cat
      )
    );
  };

  const updateTypeLabel = (categoryId: string, typeIdx: number, label: string) => {
    setProducts((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              types: cat.types.map((type, idx) =>
                idx === typeIdx ? { ...type, label } : type
              ),
            }
          : cat
      )
    );
  };

  const updateOptionLabel = (categoryId: string, typeIdx: number, optionId: string, label: string) => {
    setProducts((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              types: cat.types.map((type, idx) =>
                idx === typeIdx
                  ? {
                      ...type,
                      options: type.options.map((opt) =>
                        opt.id === optionId ? { ...opt, label } : opt
                      ),
                    }
                  : type
              ),
            }
          : cat
      )
    );
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  const toggleType = (key: string) => {
    setExpandedTypes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-600">
          Manage your product catalog. Images are used in the type selector modal and feed into ML training for automated quote detection.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addCategory}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
          <Button onClick={saveProducts} disabled={saving}>
            {saving ? "Saving..." : "Save Products"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {products.map((category, categoryIdx) => (
          <div key={category.id} className="border rounded-lg bg-white">
            {expandedCategories[category.id] ? (
              <div className="border-b p-4 space-y-2 bg-slate-50">
                <label className="block text-xs font-semibold text-slate-600">Category Name</label>
                <Input
                  value={category.label}
                  onChange={(e) => updateCategoryLabel(category.id, e.target.value)}
                  className="mb-2"
                  placeholder="Category name"
                />
              </div>
            ) : null}
            <div className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
              <button
                onClick={() => toggleCategory(category.id)}
                className="flex-1 flex items-center gap-2"
              >
                {expandedCategories[category.id] ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="font-semibold text-slate-900">{category.label}</span>
                <span className="text-xs text-slate-500">
                  {category.types.reduce((sum, t) => sum + t.options.length, 0)} options
                </span>
              </button>
              <div className="flex gap-2">
                {expandedCategories[category.id] && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addType(category.id)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Type
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteCategory(category.id)}
                  className="text-red-600 hover:text-red-700"
                  title="Delete category"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {expandedCategories[category.id] && (
              <div className="border-t p-4 space-y-4">
                {category.types.map((type, typeIdx) => {
                  const typeKey = `${category.id}-${type.type}`;
                  return (
                    <div key={type.type} className="border rounded-lg bg-slate-50">
                      {expandedTypes[typeKey] ? (
                        <div className="border-b p-3 space-y-2 bg-white">
                          <label className="block text-xs font-semibold text-slate-600">Type Name</label>
                          <Input
                            value={type.label}
                            onChange={(e) => updateTypeLabel(category.id, typeIdx, e.target.value)}
                            className="mb-2"
                            placeholder="Type name"
                          />
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between p-3 hover:bg-slate-100 transition-colors">
                        <button
                          onClick={() => toggleType(typeKey)}
                          className="flex-1 flex items-center gap-2"
                        >
                          {expandedTypes[typeKey] ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          <span className="text-sm font-medium text-slate-800">{type.label}</span>
                          <span className="text-xs text-slate-500">{type.options.length} options</span>
                        </button>
                        <div className="flex gap-2">
                          {expandedTypes[typeKey] && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                addOption(category.id, typeIdx);
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Option
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteType(category.id, typeIdx)}
                            className="text-red-600 hover:text-red-700"
                            title="Delete type"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {expandedTypes[typeKey] && (
                        <div className="border-t p-3 space-y-3">
                          {type.options.map((option) => (
                            <div
                              key={option.id}
                              className="flex items-start gap-3 p-3 bg-white rounded border"
                            >
                              {/* Preview */}
                              <div className="flex-shrink-0 w-20 h-20 border rounded flex items-center justify-center bg-slate-100">
                                {option.svg ? (
                                  <div
                                    dangerouslySetInnerHTML={{ __html: option.svg }}
                                    className="w-16 h-16"
                                  />
                                ) : option.imageDataUrl ? (
                                  <img
                                    src={option.imageDataUrl}
                                    alt={option.label}
                                    className="w-full h-full object-contain"
                                  />
                                ) : option.imagePath ? (
                                  <img
                                    src={option.imagePath}
                                    alt={option.label}
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <span className="text-3xl text-slate-400">
                                    {category.id === "doors" ? "🚪" : "🪟"}
                                  </span>
                                )}
                              </div>

                              {/* Label */}
                              <div className="flex-1">
                                <Input
                                  value={option.label}
                                  onChange={(e) =>
                                    updateOptionLabel(category.id, typeIdx, option.id, e.target.value)
                                  }
                                  className="mb-2"
                                  placeholder="Option name"
                                />
                                <div className="flex gap-2">
                                  <label className="cursor-pointer">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          handleImageUpload(category.id, typeIdx, option.id, file);
                                        }
                                      }}
                                    />
                                    <Button size="sm" variant="outline" asChild>
                                      <span>
                                        <Upload className="h-3 w-3 mr-1" />
                                        Upload
                                      </span>
                                    </Button>
                                  </label>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSvgDialog({
                                        categoryId: category.id,
                                        typeIdx,
                                        optionId: option.id,
                                        label: option.label,
                                      });
                                      setSvgDescription(`${option.label}. ${DEFAULT_SVG_PROMPT}`);
                                    }}
                                    disabled={generatingSvg === option.id}
                                  >
                                    <Wand2 className="h-3 w-3 mr-1" />
                                    {generatingSvg === option.id ? "Generating..." : "Generate SVG"}
                                  </Button>
                                </div>
                              </div>

                              {/* Delete */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteOption(category.id, typeIdx, option.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {svgDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-xl">
            <div className="mb-2 text-lg font-semibold">Describe the SVG</div>
            <p className="mb-3 text-sm text-muted-foreground">
              Include panels, rails, stiles, muntins, glass areas, and dimensions. Colors should be fills, not just outlines.
            </p>
            <textarea
              className="w-full rounded-md border p-2 text-sm"
              rows={5}
              value={svgDescription}
              onChange={(e) => setSvgDescription(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setSvgDialog(null);
                  setSvgDescription("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!svgDialog) return;
                  generateSvg(
                    svgDialog.categoryId,
                    svgDialog.typeIdx,
                    svgDialog.optionId,
                    svgDialog.label,
                    svgDescription.trim() || `${svgDialog.label}. ${DEFAULT_SVG_PROMPT}`,
                  );
                  setSvgDialog(null);
                }}
                disabled={generatingSvg === svgDialog.optionId}
              >
                {generatingSvg === svgDialog.optionId ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
