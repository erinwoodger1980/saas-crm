"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { Upload, Trash2, Plus, Wand2, ChevronRight, ChevronDown, Loader2, Box, Sparkles, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { ProductConfigurator3D } from "@/components/configurator/ProductConfigurator3D";
import { ProductTypeEditModal } from "./ProductTypeEditModal";
import { normalizeSceneConfig, createDefaultSceneConfig } from "@/lib/scene/config-validation";
import { getAssignedComponents, getAvailableComponents, assignComponent, deleteAssignment, updateAssignment } from "@/lib/api/product-type-components";
import { ComponentPickerDialog } from "./ComponentPickerDialog";
import { parametricToSceneConfig } from "@/lib/scene/parametricToSceneConfig";
import type { ProductParams } from "@/types/parametric-builder";

const DEFAULT_SVG_PROMPT =
  "Provide a detailed elevation with correct timber/glass fills, rails, stiles, panels, muntins, and dimension lines (800mm top, 2025mm left).";

/**
 * Get sensible default dimensions for product types
 * Returns { widthMm, heightMm } based on product category and type
 */
function getDefaultDimensions(category: string, type: string, option: string): { widthMm: number; heightMm: number } {
  // Doors - standard UK door sizes
  if (category === 'doors') {
    if (type === 'entrance') {
      return option.includes('double') 
        ? { widthMm: 1800, heightMm: 2100 } // Double entrance door
        : { widthMm: 900, heightMm: 2100 };  // Single entrance door
    }
    if (type === 'bifold') {
      if (option.includes('2-panel')) return { widthMm: 1800, heightMm: 2100 };
      if (option.includes('3-panel')) return { widthMm: 2700, heightMm: 2100 };
      if (option.includes('4-panel')) return { widthMm: 3600, heightMm: 2100 };
      return { widthMm: 2400, heightMm: 2100 }; // Default bifold
    }
    if (type === 'sliding') {
      return option.includes('double')
        ? { widthMm: 2400, heightMm: 2100 } // Double slider
        : { widthMm: 1200, heightMm: 2100 }; // Single slider
    }
    if (type === 'french') {
      return { widthMm: 1800, heightMm: 2100 }; // Standard French doors (pair)
    }
    // Default door
    return { widthMm: 914, heightMm: 2032 };
  }
  
  // Windows - standard UK window sizes
  if (category === 'windows') {
    if (type === 'sash-cord' || type === 'sash-spring') {
      return option.includes('double')
        ? { widthMm: 1200, heightMm: 1800 } // Double hung sash
        : { widthMm: 800, heightMm: 1400 };  // Single sash
    }
    if (type === 'casement') {
      return option.includes('double')
        ? { widthMm: 1500, heightMm: 1200 } // Double casement
        : { widthMm: 900, heightMm: 1200 };  // Single casement
    }
    if (type === 'bay') {
      return { widthMm: 3000, heightMm: 1500 }; // Bay window
    }
    // Default window
    return { widthMm: 1200, heightMm: 1200 };
  }
  
  // Default fallback for any product type
  return { widthMm: 1000, heightMm: 2000 };
}

type ProductOption = {
  id: string;
  label: string;
  imagePath?: string;
  imageDataUrl?: string;
  svg?: string;
  sceneConfig?: any; // Saved 3D configuration with components
  productParams?: ProductParams;
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
  const [svgPreview, setSvgPreview] = useState<string | null>(null);
  const [previewGenerating, setPreviewGenerating] = useState(false);
  
  // New unified edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalData, setEditModalData] = useState<{
    categoryId: string;
    typeIdx: number;
    optionId: string;
    label: string;
    type: string;
  } | null>(null);
  
  // Legacy states - keeping for backward compatibility during transition
  const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(false);
  const [mount3D, setMount3D] = useState(false); // Canvas only mounts when true
  const [capturedConfig, setCapturedConfig] = useState<any>(null);
  const [capturedLineItem, setCapturedLineItem] = useState<any>(null);
  const [capturedDialogInfo, setCapturedDialogInfo] = useState<{
    categoryId: string;
    typeIdx: number;
    optionId: string;
    label: string;
    type: string;
  } | null>(null);
  
  // Stable key - set ONCE per dialog open, never changes during render
  const [configuratorKey, setConfiguratorKey] = useState<string>('');
  
  // Debounce timer for auto-save
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Handle dialog state changes in useEffect to prevent render-time setState
  useEffect(() => {
    if (isConfiguratorOpen && capturedDialogInfo) {
      // Dialog opened - capture and normalize config
      const option = products
        .find(c => c.id === capturedDialogInfo.categoryId)
        ?.types[capturedDialogInfo.typeIdx]
        ?.options.find(o => o.id === capturedDialogInfo.optionId);

      const rawConfig = option?.sceneConfig;
      const normalizedConfig = normalizeSceneConfig(rawConfig);

      let finalConfig = normalizedConfig;

      if (!finalConfig && option?.productParams) {
        finalConfig = parametricToSceneConfig({
          tenantId: 'settings',
          entityType: 'productTemplate',
          entityId: `${capturedDialogInfo.categoryId}-${capturedDialogInfo.type}-${capturedDialogInfo.optionId}`,
          productParams: option.productParams,
        });
      }

      if (!finalConfig) {
        finalConfig = createDefaultSceneConfig(
          capturedDialogInfo.categoryId,
          800, 2100, 45
        );
      }
      
      setCapturedConfig(finalConfig);
      
      // Create line item for preview
      const lineItem = {
        id: capturedDialogInfo.optionId,
        description: capturedDialogInfo.label,
        configuredProduct: {
          productType: {
            category: capturedDialogInfo.categoryId,
            type: capturedDialogInfo.type,
            option: capturedDialogInfo.optionId,
          },
        },
      lineStandard: getDefaultDimensions(capturedDialogInfo.categoryId, capturedDialogInfo.type, capturedDialogInfo.optionId),
        meta: {
          depthMm: capturedDialogInfo.categoryId === 'doors' ? 45 : 100,
        },
      };
      setCapturedLineItem(lineItem);
      
      // Mount Canvas after next frame to ensure clean context creation
      requestAnimationFrame(() => {
        setMount3D(true);
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[ProductTypesSection] Dialog opened, config captured, Canvas will mount');
      }
    } else if (!isConfiguratorOpen) {
      // Dialog closing - unmount Canvas FIRST, then clear state
      setMount3D(false);
      
      // Clear state on next tick to ensure Canvas unmounts cleanly
      setTimeout(() => {
        setCapturedConfig(null);
        setCapturedLineItem(null);
        setCapturedDialogInfo(null);
        if (process.env.NODE_ENV === 'development') {
          console.log('[ProductTypesSection] Dialog closed, Canvas unmounted, state cleared');
        }
      }, 0);
    }
  }, [isConfiguratorOpen, capturedDialogInfo, products]);

  
  const [aiEstimateDialog, setAiEstimateDialog] = useState<{
    categoryId: string;
    typeIdx: number;
    optionId: string;
    label: string;
    type: string;
  } | null>(null);
  const [aiDescription, setAiDescription] = useState("");
  const [aiImage, setAiImage] = useState<File | null>(null);
  const [aiImagePreview, setAiImagePreview] = useState<string | null>(null);
  const [aiEstimating, setAiEstimating] = useState(false);

  // Assigned components per product option (keyed by option.id)
  const [assignedComponents, setAssignedComponents] = useState<Record<string, Array<{ id: string; code: string; name: string; componentType: string }>>>({});
  const [loadingAssigned, setLoadingAssigned] = useState<Record<string, boolean>>({});
  const [addByCode, setAddByCode] = useState<Record<string, string>>({});
  const [componentPickerOpen, setComponentPickerOpen] = useState(false);
  const [componentPickerOptionId, setComponentPickerOptionId] = useState<string>('');

  async function loadAssignedForOption(optionId: string) {
    try {
      setLoadingAssigned((prev) => ({ ...prev, [optionId]: true }));
      const items = await apiFetch<Array<{ id: string; code: string; name: string; componentType: string }>>(`/components?productType=${encodeURIComponent(optionId)}`);
      setAssignedComponents((prev) => ({ ...prev, [optionId]: items }));
    } catch (err) {
      console.error('Failed to load assigned components for', optionId, err);
      setAssignedComponents((prev) => ({ ...prev, [optionId]: [] }));
    } finally {
      setLoadingAssigned((prev) => ({ ...prev, [optionId]: false }));
    }
  }

  async function assignExistingComponentToOption(optionId: string, codeOrId: string) {
    try {
      // Resolve by code (preferred) or treat as id
      let comp: any | null = null;
      try {
        comp = await apiFetch<any>(`/components/code/${encodeURIComponent(codeOrId)}`);
      } catch {
        // Fallback to fetching by id
        try {
          comp = await apiFetch<any>(`/components/${encodeURIComponent(codeOrId)}`);
        } catch {
          comp = null;
        }
      }
      if (!comp?.id) {
        toast({ title: 'Not found', description: `Component '${codeOrId}' not found`, variant: 'destructive' });
        return;
      }

      const current = Array.isArray(comp.productTypes) ? comp.productTypes : [];
      if (current.includes(optionId)) {
        toast({ title: 'Already assigned', description: `${comp.code} is already linked to this product type.` });
        return;
      }
      const next = [...current, optionId];
      await apiFetch(`/components/${encodeURIComponent(comp.id)}`, {
        method: 'PUT',
        json: { productTypes: next }
      });
      toast({ title: 'Assigned', description: `Linked ${comp.code} to ${optionId}` });
      await loadAssignedForOption(optionId);
      setAddByCode((prev) => ({ ...prev, [optionId]: '' }));
    } catch (err: any) {
      toast({ title: 'Assign failed', description: err?.message || 'Could not assign component', variant: 'destructive' });
    }
  }

  async function unlinkExistingComponentFromOption(optionId: string, componentId: string) {
    try {
      const comp = await apiFetch<any>(`/components/${encodeURIComponent(componentId)}`);
      if (!comp?.id) return;
      const current = Array.isArray(comp.productTypes) ? comp.productTypes : [];
      if (!current.includes(optionId)) return;
      const next = current.filter((pt: string) => pt !== optionId);
      await apiFetch(`/components/${encodeURIComponent(comp.id)}`, {
        method: 'PUT',
        json: { productTypes: next }
      });
      toast({ title: 'Removed', description: `Unlinked ${comp.code} from ${optionId}` });
      await loadAssignedForOption(optionId);
    } catch (err: any) {
      toast({ title: 'Remove failed', description: err?.message || 'Could not unlink component', variant: 'destructive' });
    }
  }

  const handleComponentSelected = async (component: any) => {
    if (!componentPickerOptionId) return;
    
    try {
      const current = Array.isArray(component.productTypes) ? component.productTypes : [];
      if (current.includes(componentPickerOptionId)) {
        toast({ title: 'Already assigned', description: `${component.code} is already linked to this product type.` });
        return;
      }
      const next = [...current, componentPickerOptionId];
      await apiFetch(`/components/${encodeURIComponent(component.id)}`, {
        method: 'PUT',
        json: { productTypes: next }
      });
      toast({ title: 'Assigned', description: `Linked ${component.code} to this product type` });
      await loadAssignedForOption(componentPickerOptionId);
    } catch (err: any) {
      toast({ title: 'Assign failed', description: err?.message || 'Could not assign component', variant: 'destructive' });
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await apiFetch<{ productTypes?: ProductCategory[] }>("/tenant/settings");
      console.log("[ProductTypesSection] Loaded settings data:", data);
      console.log("[ProductTypesSection] productTypes from API:", data.productTypes);
      if (data.productTypes) {
        console.log("[ProductTypesSection] Setting products to:", data.productTypes);
        setProducts(data.productTypes);
      } else {
        console.warn("[ProductTypesSection] No productTypes in response");
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

  // Debounced save to prevent heavy writes on every configurator change
  const debouncedSaveProducts = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveProducts();
    }, 800); // 800ms debounce
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

  const generateSvgPreview = async (description: string) => {
    if (!description.trim()) {
      toast({
        title: "Description required",
        description: "Please enter a description",
        variant: "destructive",
      });
      return;
    }

    setPreviewGenerating(true);
    try {
      const response = await apiFetch<{ svg: string }>("/ml/generate-product-svg", {
        method: "POST",
        json: {
          description: description.trim(),
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

      setSvgPreview(svg);
    } catch (err: any) {
      toast({
        title: "Generation failed",
        description: err.message || "Could not generate SVG",
        variant: "destructive",
      });
    } finally {
      setPreviewGenerating(false);
    }
  };

  const saveSvgToOption = (categoryId: string, typeIdx: number, optionId: string) => {
    if (!svgPreview) return;

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
                        opt.id === optionId ? { ...opt, svg: svgPreview, imageDataUrl: undefined, imagePath: undefined } : opt
                      ),
                    }
                  : type
              ),
            }
          : cat
      )
    );

    toast({
      title: "SVG saved to product",
      description: "Diagram linked to option",
    });

    setSvgDialog(null);
    setSvgDescription("");
    setSvgPreview(null);
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

  const handleAiImageUpload = (file: File) => {
    setAiImage(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setAiImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const estimateComponentsWithAI = async () => {
    if (!aiEstimateDialog) return;
    if (!aiDescription && !aiImage) {
      toast({
        title: "Input required",
        description: "Please provide a description or upload an image",
        variant: "destructive",
      });
      return;
    }

    setAiEstimating(true);
    console.log('[AI Estimation] Starting with:', {
      hasImage: !!aiImage,
      hasDescription: !!aiDescription,
      aiEstimateDialog,
    });
    
    try {
      const dims = getDefaultDimensions(
        aiEstimateDialog.categoryId,
        aiEstimateDialog.type,
        aiEstimateDialog.optionId
      );

      console.log('[AI Estimation] Dimensions:', dims);

      const formData = new FormData();
      formData.append('data', JSON.stringify({
        productType: {
          category: aiEstimateDialog.categoryId,
          type: aiEstimateDialog.type,
          option: aiEstimateDialog.optionId,
        },
        dimensions: {
          widthMm: dims.widthMm,
          heightMm: dims.heightMm,
          depthMm: aiEstimateDialog.categoryId === 'doors' ? 45 : 100,
        },
        description: aiDescription || undefined,
      }));

      if (aiImage) {
        formData.append('image', aiImage);
        console.log('[AI Estimation] Image attached, size:', aiImage.size);
      }

      console.log('[AI Estimation] Sending request to /api/ai/estimate-components...');

      // Use parametric API response format
      const result = await fetch('/api/ai/estimate-components', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: 'current', // TODO: get from session
          description: aiDescription || 'Product from image',
          productType: {
            category: aiEstimateDialog.categoryId,
            type: aiEstimateDialog.type,
            option: aiEstimateDialog.optionId,
          },
          existingDimensions: {
            widthMm: dims.widthMm,
            heightMm: dims.heightMm,
            thicknessMm: aiEstimateDialog.categoryId === 'doors' ? 45 : 100,
          },
        }),
      });

      if (!result.ok) {
        const errorText = await result.text();
        console.error('[AI Estimation] API error:', errorText);
        throw new Error(`API error: ${result.statusText}`);
      }

      const aiData = await result.json();
      console.log('[AI Estimation] Result:', {
        hasParamsPatch: !!aiData.suggestedParamsPatch,
        addedPartsCount: aiData.suggestedAddedParts?.length || 0,
        rationale: aiData.rationale,
      });

      // Convert AI result to canonical ProductParams
      const { getBuilder } = require('@/lib/scene/builder-registry');
      const builder = getBuilder(aiEstimateDialog.categoryId);
      const baseParams = builder.getDefaults(
        {
          category: aiEstimateDialog.categoryId,
          type: aiEstimateDialog.type,
          option: aiEstimateDialog.optionId,
        },
        {
          width: dims.widthMm,
          height: dims.heightMm,
          depth: aiData.suggestedParamsPatch?.construction?.thickness || (aiEstimateDialog.categoryId === 'doors' ? 45 : 100),
        }
      );

      const mergedParams: ProductParams = {
        ...baseParams,
        ...aiData.suggestedParamsPatch,
        productType: aiData.suggestedParamsPatch?.productType || baseParams.productType,
        dimensions: baseParams.dimensions,
        construction: {
          ...baseParams.construction,
          ...aiData.suggestedParamsPatch?.construction,
        },
        addedParts: aiData.suggestedAddedParts || [],
      };

      const sceneConfig = parametricToSceneConfig({
        tenantId: 'settings',
        entityType: 'productTemplate',
        entityId: `${aiEstimateDialog.categoryId}-${aiEstimateDialog.type}-${aiEstimateDialog.optionId}`,
        productParams: mergedParams,
      });

      // Update the product option with the estimated scene config
      setProducts((prev) =>
        prev.map((cat) =>
          cat.id === aiEstimateDialog.categoryId
            ? {
                ...cat,
                types: cat.types.map((t, idx) =>
                  idx === aiEstimateDialog.typeIdx
                    ? {
                        ...t,
                        options: t.options.map((opt) =>
                          opt.id === aiEstimateDialog.optionId
                            ? { ...opt, sceneConfig, productParams: mergedParams }
                            : opt
                        ),
                      }
                    : t
                ),
              }
            : cat
        )
      );

      const componentCount = sceneConfig?.components?.length || 0;
      toast({
        title: "Product generated!",
        description: `Created ${componentCount} components from AI estimation`,
      });

      // Close AI dialog and open configurator to refine and save
      setAiEstimateDialog(null);
      setAiDescription("");
      setAiImage(null);
      setAiImagePreview(null);
      
      // Open configurator to refine and save the estimated components
      const dialogInfo = {
        categoryId: aiEstimateDialog.categoryId,
        typeIdx: aiEstimateDialog.typeIdx,
        optionId: aiEstimateDialog.optionId,
        label: aiEstimateDialog.label,
        type: aiEstimateDialog.type,
      };
      setCapturedDialogInfo(dialogInfo);
      setConfiguratorKey(`${aiEstimateDialog.categoryId}-${aiEstimateDialog.type}-${aiEstimateDialog.optionId}`);
      setIsConfiguratorOpen(true);
    } catch (error: any) {
      console.error('[AI Estimation] Error:', error);
      console.error('[AI Estimation] Error stack:', error.stack);
      console.error('[AI Estimation] Error details:', {
        message: error.message,
        response: error.response,
        status: error.status,
      });
      toast({
        title: "Estimation failed",
        description: error.message || "Could not estimate components",
        variant: "destructive",
      });
    } finally {
      setAiEstimating(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  const toggleType = (key: string) => {
    setExpandedTypes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <p className="text-sm text-slate-600">
            Manage your product catalog. Images are used in the type selector modal and feed into ML training for automated quote detection.
          </p>
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-medium mb-1">
              💡 3D Component Building
            </p>
            <p className="text-xs text-blue-700">
              Click <strong>"Build 3D Components"</strong> on any product option to open the component builder. 
              Add rails, stiles, panels, glass, and other components, then arrange them in 3D space. 
              Your configuration will be saved as the default template for this product type.
            </p>
          </div>
        </div>
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
                                <div className="flex items-center gap-2 mb-2">
                                  <Input
                                    value={option.label}
                                    onChange={(e) =>
                                      updateOptionLabel(category.id, typeIdx, option.id, e.target.value)
                                    }
                                    placeholder="Option name"
                                  />
                                  {option.sceneConfig && (
                                    <div className="flex-shrink-0 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                                      ✓ 3D Config
                                    </div>
                                  )}
                                </div>
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
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => {
                                      setEditModalData({
                                        categoryId: category.id,
                                        typeIdx,
                                        optionId: option.id,
                                        label: option.label,
                                        type: type.type,
                                      });
                                      setEditModalOpen(true);
                                    }}
                                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                                  >
                                    <Box className="h-3 w-3 mr-1" />
                                    {option.sceneConfig ? 'Configure Product' : 'Create Product'}
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
                            {/* Assigned components to this option */}
                            <div className="mt-3 p-3 bg-slate-50 rounded border">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-medium text-slate-700">Components assigned to this product option</div>
                                <Button size="sm" variant="outline" onClick={() => loadAssignedForOption(option.id)} disabled={loadingAssigned[option.id] === true}>
                                  {loadingAssigned[option.id] ? 'Loading…' : 'Refresh'}
                                </Button>
                              </div>
                              <div className="space-y-1">
                                {(assignedComponents[option.id] || []).length === 0 ? (
                                  <div className="text-xs text-slate-500">No components linked yet.</div>
                                ) : (
                                  (assignedComponents[option.id] || []).map((c) => (
                                    <div key={c.id} className="text-xs text-slate-700 flex items-center gap-2">
                                      <span className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-800">{c.componentType}</span>
                                      <span className="font-mono">{c.code}</span>
                                      <span className="opacity-70">— {c.name}</span>
                                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => unlinkExistingComponentFromOption(option.id, c.id)}>Remove</Button>
                                    </div>
                                  ))
                                )}
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setComponentPickerOptionId(option.id);
                                    setComponentPickerOpen(true);
                                  }}
                                  className="w-full"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Component
                                </Button>
                              </div>
                            </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl my-8">
            <div className="mb-2 text-lg font-semibold">
              {svgPreview ? "Preview & Refine SVG" : "Generate SVG Diagram"}
            </div>

            {!svgPreview ? (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  Include panels, rails, stiles, muntins, glass areas, and dimensions. Colors should be fills, not just outlines.
                </p>
                <textarea
                  className="w-full rounded-md border p-2 text-sm mb-3"
                  rows={5}
                  value={svgDescription}
                  onChange={(e) => setSvgDescription(e.target.value)}
                  placeholder="e.g., Single casement window with 2x2 muntins grid, timber frame, glass panes..."
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSvgDialog(null);
                      setSvgDescription("");
                      setSvgPreview(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() =>
                      generateSvgPreview(
                        svgDescription.trim() || `${svgDialog?.label || "Product"}. ${DEFAULT_SVG_PROMPT}`
                      )
                    }
                    disabled={previewGenerating || !svgDescription.trim()}
                  >
                    {previewGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating Preview...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Generate Preview
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Preview</label>
                  <div className="border rounded-lg p-4 bg-slate-50 flex items-center justify-center min-h-64">
                    <div
                      dangerouslySetInnerHTML={{ __html: svgPreview }}
                      className="w-full flex items-center justify-center"
                      style={{ maxWidth: "280px" }}
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Description</label>
                  <textarea
                    className="w-full rounded-md border p-2 text-sm"
                    rows={3}
                    value={svgDescription}
                    onChange={(e) => setSvgDescription(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSvgPreview(null);
                    }}
                    disabled={previewGenerating}
                  >
                    Refine Description
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSvgDialog(null);
                      setSvgDescription("");
                      setSvgPreview(null);
                    }}
                  >
                    Discard
                  </Button>
                  <Button
                    onClick={() => {
                      if (!svgDialog) return;
                      saveSvgToOption(svgDialog.categoryId, svgDialog.typeIdx, svgDialog.optionId);
                    }}
                  >
                    Save to Product
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 3D Configurator Modal */}
      {isConfiguratorOpen && capturedDialogInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-6xl rounded-lg bg-white p-6 shadow-xl my-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">3D Component Builder - {capturedDialogInfo.label}</h2>
                <p className="text-sm text-muted-foreground">
                  Build and arrange components for this product template. Changes are saved automatically.
                </p>
              </div>
              <button
                onClick={() => setIsConfiguratorOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="mb-4 rounded-lg border bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-slate-700">Wizard steps:</span>
                <span className="rounded-full bg-white px-2 py-0.5">1. Dimensions</span>
                <span className="rounded-full bg-white px-2 py-0.5">2. Layout (rails/panels)</span>
                <span className="rounded-full bg-white px-2 py-0.5">3. Materials</span>
                <span className="rounded-full bg-white px-2 py-0.5">4. Hardware (later)</span>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30">
              {capturedConfig && mount3D ? (
                <ProductConfigurator3D
                  key={configuratorKey}
                  tenantId="settings"
                  entityType="productTemplate"
                  entityId={`${capturedDialogInfo.categoryId}-${capturedDialogInfo.type}-${capturedDialogInfo.optionId}`}
                  initialConfig={capturedConfig}
                  lineItem={capturedLineItem}
                  productType={{
                    category: capturedDialogInfo.categoryId,
                    type: capturedDialogInfo.type,
                    option: capturedDialogInfo.optionId,
                  }}
                  settingsPreview={false}
                  renderQuality="low"
                  onChange={(sceneConfig) => {
                    // Update the option's sceneConfig as user makes changes
                    const params = sceneConfig?.customData as ProductParams | undefined;
                    setProducts((prev) =>
                    prev.map((cat) =>
                      cat.id === capturedDialogInfo.categoryId
                        ? {
                            ...cat,
                            types: cat.types.map((t, idx) =>
                              idx === capturedDialogInfo.typeIdx
                                ? {
                                    ...t,
                                    options: t.options.map((opt) =>
                                      opt.id === capturedDialogInfo.optionId
                                        ? { ...opt, sceneConfig, productParams: params || opt.productParams }
                                        : opt
                                    ),
                                  }
                                : t
                            ),
                          }
                        : cat
                    )
                  );
                  
                  // Auto-save to backend (debounced to avoid heavy writes)
                  debouncedSaveProducts();
                }}
                onClose={() => setIsConfiguratorOpen(false)}
                height="70vh"
                heroMode={false}
              />
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                  <Box className="h-16 w-16 text-muted-foreground/40" />
                  <div>
                    <h3 className="text-lg font-medium text-muted-foreground">Config Unavailable</h3>
                    <p className="text-sm text-muted-foreground/80 mt-1">
                      The 3D configuration is missing or invalid. Click below to create a default configuration.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      const { getBuilder } = require('@/lib/scene/builder-registry');
                      const builder = getBuilder(capturedDialogInfo.categoryId);
                      const dims = getDefaultDimensions(
                        capturedDialogInfo.categoryId,
                        capturedDialogInfo.type,
                        capturedDialogInfo.optionId
                      );
                      const defaultParams = builder?.getDefaults(
                        {
                          category: capturedDialogInfo.categoryId,
                          type: capturedDialogInfo.type,
                          option: capturedDialogInfo.optionId,
                        },
                        {
                          width: dims.widthMm,
                          height: dims.heightMm,
                          depth: capturedDialogInfo.categoryId === 'doors' ? 45 : 100,
                        }
                      );
                      const defaultConfig = defaultParams
                        ? parametricToSceneConfig({
                            tenantId: 'settings',
                            entityType: 'productTemplate',
                            entityId: `${capturedDialogInfo.categoryId}-${capturedDialogInfo.type}-${capturedDialogInfo.optionId}`,
                            productParams: defaultParams,
                          })
                        : createDefaultSceneConfig(
                            capturedDialogInfo.categoryId,
                            800, 2100, 45
                          );
                      // Save default config + params
                      setProducts((prev) =>
                        prev.map((cat) =>
                          cat.id === capturedDialogInfo.categoryId
                            ? {
                                ...cat,
                                types: cat.types.map((t, idx) =>
                                  idx === capturedDialogInfo.typeIdx
                                    ? {
                                        ...t,
                                        options: t.options.map((opt) =>
                                          opt.id === capturedDialogInfo.optionId
                                            ? { ...opt, sceneConfig: defaultConfig, productParams: defaultParams || opt.productParams }
                                            : opt
                                        ),
                                      }
                                    : t
                                ),
                              }
                            : cat
                        )
                      );
                      setCapturedConfig(defaultConfig);
                      debouncedSaveProducts();
                    }}
                  >
                    Create Default Configuration
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Estimate Dialog */}
      {aiEstimateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                ✨ AI Component Estimation - {aiEstimateDialog.label}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Upload an image or describe the product, and AI will estimate components, sizes, profiles, and positions
              </p>
            </div>

            <div className="space-y-4">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium mb-2">Upload Image (Optional)</label>
                {aiImagePreview ? (
                  <div className="relative">
                    <img
                      src={aiImagePreview}
                      alt="Preview"
                      className="w-full h-48 object-contain border rounded-lg bg-slate-50"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2 bg-white/90 hover:bg-white"
                      onClick={() => {
                        setAiImage(null);
                        setAiImagePreview(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-purple-300 hover:bg-purple-50/50 transition-colors">
                    <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Click to upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAiImageUpload(file);
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Description (Optional if image provided)
                </label>
                <Textarea
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  placeholder="e.g., Six panel traditional door with raised panels, or Double hung sash window with 2x2 muntins..."
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Describe the component layout, materials, and any specific details
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAiEstimateDialog(null);
                    setAiDescription("");
                    setAiImage(null);
                    setAiImagePreview(null);
                  }}
                  disabled={aiEstimating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={estimateComponentsWithAI}
                  disabled={aiEstimating || (!aiDescription && !aiImage)}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {aiEstimating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Estimate Components
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Component Picker Dialog */}
      <ComponentPickerDialog
        isOpen={componentPickerOpen}
        onClose={() => {
          setComponentPickerOpen(false);
          setComponentPickerOptionId('');
        }}
        onSelect={handleComponentSelected}
        productTypeId={componentPickerOptionId}
      />

      {/* New unified product type edit modal */}
      {editModalData && (
        <ProductTypeEditModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditModalData(null);
          }}
          onSave={async (configData) => {
            // Update the products state with the new configuration
            setProducts((prev) =>
              prev.map((cat) =>
                cat.id === editModalData.categoryId
                  ? {
                      ...cat,
                      types: cat.types.map((t, idx) =>
                        idx === editModalData.typeIdx
                          ? {
                              ...t,
                              options: t.options.map((opt) =>
                                opt.id === editModalData.optionId
                                  ? { 
                                      ...opt, 
                                      label: configData.label,
                                      sceneConfig: configData.sceneConfig 
                                    }
                                  : opt
                              ),
                            }
                          : t
                      ),
                    }
                  : cat
              )
            );

            // TODO: Save to API/database
            console.log('Product type configuration saved:', configData);
          }}
          initialData={editModalData}
          defaultDimensions={getDefaultDimensions(
            editModalData.categoryId,
            editModalData.type,
            editModalData.optionId
          )}
        />
      )}
    </div>
  );
}
