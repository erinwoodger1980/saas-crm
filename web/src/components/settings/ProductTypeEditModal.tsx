'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Sparkles, Image as ImageIcon, Trash2, Plus, Box, Package, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ProductConfigurator3D } from '@/components/configurator/ProductConfigurator3D';
import { createDefaultSceneConfig } from '@/lib/scene/config-validation';
import { ProductPlanV1, createFallbackDoorPlan, createFallbackWindowPlan } from '@/types/product-plan';
import { compileProductPlanToProductParams } from '@/lib/scene/plan-compiler';
import { parametricToSceneConfig } from '@/lib/scene/parametricToSceneConfig';
import type { ProductParams } from '@/types/parametric-builder';
import { ComponentPickerDialog } from './ComponentPickerDialog';
import { apiFetch } from '@/lib/api';

interface ProductTypeOption {
  id: string;
  label: string;
  sceneConfig?: any;
  imagePath?: string;
  imageDataUrl?: string;
  svg?: string;
}

interface ProductTypeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: any) => Promise<void>;
  initialData?: {
    categoryId: string;
    typeIdx: number;
    optionId: string;
    label: string;
    type: string;
    description?: string;
    sceneConfig?: any;
    productParams?: ProductParams;
  };
  defaultDimensions?: { widthMm: number; heightMm: number };
}

export function ProductTypeEditModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  defaultDimensions = { widthMm: 800, heightMm: 2000 },
}: ProductTypeEditModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [isSaving, setIsSaving] = useState(false);

  const lastInitKeyRef = useRef<string | null>(null);
  
  // Overview tab state
  const [optionLabel, setOptionLabel] = useState(initialData?.label || '');
  const [optionDescription, setOptionDescription] = useState(initialData?.description || '');
  
  // AI Generation tab state
  const [aiDescription, setAiDescription] = useState('');
  const [aiImage, setAiImage] = useState<File | null>(null);
  const [aiImagePreview, setAiImagePreview] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  
  // ProductPlan state (new)
  const [productPlan, setProductPlan] = useState<ProductPlanV1 | null>(null);
  const [planVariables, setPlanVariables] = useState<Record<string, number>>({});
  const [aiNotice, setAiNotice] = useState<{ kind: 'info' | 'fallback'; title: string; message: string } | null>(null);
  
  // 3D Configurator state
  const [sceneConfig, setSceneConfig] = useState<any>(
    initialData?.sceneConfig ??
      createDefaultSceneConfig(
        initialData?.categoryId || 'doors',
        defaultDimensions.widthMm,
        defaultDimensions.heightMm
      )
  );
  const [show3DConfigurator, setShow3DConfigurator] = useState(false);
  const [compiledParams, setCompiledParams] = useState<ProductParams | null>(initialData?.productParams ?? null);
  
  // Component picker state
  const [componentPickerOpen, setComponentPickerOpen] = useState(false);
  const [assignedComponents, setAssignedComponents] = useState<any[]>([]);
  const [loadingAssignedComponents, setLoadingAssignedComponents] = useState(false);

  // Re-initialize modal state when opening a different option.
  useEffect(() => {
    if (!isOpen) return;
    const key = initialData ? `${initialData.categoryId}:${initialData.typeIdx}:${initialData.optionId}` : 'none';
    if (lastInitKeyRef.current === key) return;
    lastInitKeyRef.current = key;

    setActiveTab('overview');
    setOptionLabel(initialData?.label || '');
    setOptionDescription(initialData?.description || '');
    setAiDescription('');
    setAiImage(null);
    setAiImagePreview(null);
    setProductPlan(null);
    setPlanVariables({});
    setAiNotice(null);
    setShow3DConfigurator(false);
    setCompiledParams(initialData?.productParams ?? null);
    setSceneConfig(
      initialData?.sceneConfig ??
        createDefaultSceneConfig(
          initialData?.categoryId || 'doors',
          defaultDimensions.widthMm,
          defaultDimensions.heightMm
        )
    );
    setAssignedComponents([]);
  }, [isOpen, initialData, defaultDimensions.widthMm, defaultDimensions.heightMm]);

  const loadAssignedComponentsForOption = useCallback(async (optionId: string) => {
    setLoadingAssignedComponents(true);
    try {
      const rows = await apiFetch<any[]>(`/components?productType=${encodeURIComponent(optionId)}`);
      setAssignedComponents(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('[ProductTypeEditModal] Failed to load assigned components', err);
      setAssignedComponents([]);
    } finally {
      setLoadingAssignedComponents(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const optionId = initialData?.optionId;
    if (!optionId) return;
    void loadAssignedComponentsForOption(optionId);
  }, [isOpen, initialData?.optionId, loadAssignedComponentsForOption]);

  const handleAiImageUpload = (file: File) => {
    setAiImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAiImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAIEstimate = async () => {
    if (!aiDescription && !aiImage) {
      toast({
        title: 'Input required',
        description: 'Please provide a description or upload an image',
        variant: 'destructive',
      });
      return;
    }

    setIsEstimating(true);
    try {
      // Use backend /ai endpoint so it runs where OPENAI_API_KEY is configured in production.
      const category = initialData?.categoryId || 'doors';
      const defaultDepth = category === 'windows' ? 80 : 45;

      const plan = await apiFetch<ProductPlanV1>('/ai/generate-product-plan', {
        method: 'POST',
        json: {
          description: aiDescription || 'Product from image',
          image: aiImagePreview || undefined,
          existingProductType: {
            category: category,
            type: initialData?.type || 'timber',
          },
          existingDims: {
            widthMm: defaultDimensions.widthMm,
            heightMm: defaultDimensions.heightMm,
            depthMm: defaultDepth,
          },
        },
      });

      const isFallback = plan?.detected?.confidence != null && plan.detected.confidence <= 0.21 && String(plan?.rationale || '').startsWith('Fallback:');
      const fallbackReason = isFallback
        ? (String(plan?.rationale || '').match(/\(reason: ([^)]+)\)/)?.[1] ?? null)
        : null;

      console.log('[AI2SCENE] Generated ProductPlan:', plan);
      
      setProductPlan(plan);
      setAiNotice(
        isFallback
          ? {
              kind: 'fallback',
              title: 'Using fallback plan',
              message: `AI generation fell back${fallbackReason ? ` (${fallbackReason})` : ''}. You can still edit/compile this plan.`,
            }
          : null
      );
      // Initialize plan variables
      const vars: Record<string, number> = {};
      for (const [key, variable] of Object.entries(plan.variables)) {
        vars[key] = variable.defaultValue;
      }
      setPlanVariables(vars);
      
      setActiveTab('plan');
      toast({
        title: isFallback ? 'Generated fallback plan' : 'ProductPlan Generated',
        description: isFallback
          ? `AI fell back (${fallbackReason || 'unknown'}). Generated ${plan.components.length} default components.`
          : `Detected: ${plan.detected.type} (${plan.detected.option || 'auto'}) - ${plan.components.length} components`,
        variant: undefined,
      });
    } catch (error: any) {
      console.error('AI estimation error:', error);

      // UI should still be usable even if the API errors/500s.
      // Create a deterministic fallback plan client-side and show a clear in-modal notice.
      const category = initialData?.categoryId || 'doors';
      const defaultDepth = category === 'windows' ? 80 : 45;
      const reason = (error?.message ? String(error.message) : 'AI endpoint failed').slice(0, 200);
      const baseFallback =
        category === 'windows'
          ? createFallbackWindowPlan()
          : createFallbackDoorPlan();

      const fallback: ProductPlanV1 = {
        ...baseFallback,
        dimensions: {
          widthMm: defaultDimensions.widthMm,
          heightMm: defaultDimensions.heightMm,
          depthMm: defaultDepth,
        },
        variables: {
          ...baseFallback.variables,
          pw: { ...(baseFallback.variables.pw as any), defaultValue: defaultDimensions.widthMm },
          ph: { ...(baseFallback.variables.ph as any), defaultValue: defaultDimensions.heightMm },
          sd: { ...(baseFallback.variables.sd as any), defaultValue: defaultDepth },
        },
        rationale: `Fallback: ${baseFallback.rationale} (reason: ${reason})`,
        detected: {
          ...baseFallback.detected,
          confidence: Math.min(baseFallback.detected.confidence ?? 0.2, 0.2),
        },
      };

      setProductPlan(fallback);
      setAiNotice({
        kind: 'fallback',
        title: 'AI endpoint failed — using fallback plan',
        message: `Couldn’t reach the AI service (${reason}). A default plan was generated so you can continue.`,
      });

      const vars: Record<string, number> = {};
      for (const [key, variable] of Object.entries(fallback.variables)) {
        vars[key] = variable.defaultValue;
      }
      setPlanVariables(vars);
      setActiveTab('plan');

      toast({
        title: 'Used fallback plan',
        description: 'AI generation failed; a default plan was created so you can continue.',
      });
    } finally {
      setIsEstimating(false);
    }
  };

  const handleComponentSelected = async (component: any) => {
    const optionId = initialData?.optionId;
    if (!optionId) return;

    try {
      const current = Array.isArray(component.productTypes) ? component.productTypes : [];
      if (current.includes(optionId)) {
        toast({ title: 'Already assigned', description: `${component.code} is already linked to this product type.` });
        return;
      }
      const next = [...current, optionId];
      await apiFetch(`/components/${encodeURIComponent(component.id)}`, {
        method: 'PUT',
        json: { productTypes: next },
      });
      toast({ title: 'Assigned', description: `Linked ${component.code} to this product type` });
      await loadAssignedComponentsForOption(optionId);
    } catch (err: any) {
      toast({ title: 'Assign failed', description: err?.message || 'Could not assign component', variant: 'destructive' });
    }
  };

  const handleRemoveComponent = async (componentId: string) => {
    const optionId = initialData?.optionId;
    if (!optionId) return;

    try {
      const comp = await apiFetch<any>(`/components/${encodeURIComponent(componentId)}`);
      const current = Array.isArray(comp?.productTypes) ? comp.productTypes : [];
      if (!current.includes(optionId)) return;
      const next = current.filter((pt: string) => pt !== optionId);
      await apiFetch(`/components/${encodeURIComponent(comp.id)}`, {
        method: 'PUT',
        json: { productTypes: next },
      });
      toast({ title: 'Removed', description: `Unlinked ${comp.code} from this product type` });
      await loadAssignedComponentsForOption(optionId);
    } catch (err: any) {
      toast({ title: 'Remove failed', description: err?.message || 'Could not unlink component', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (!optionLabel.trim()) {
      toast({
        title: 'Validation error',
        description: 'Please enter an option label',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        optionId: initialData?.optionId,
        label: optionLabel,
        description: optionDescription,
        sceneConfig,
        productParams: compiledParams,
      });

      toast({
        title: 'Product type saved!',
        description: 'Your components and configuration are now ready to use',
      });

      onClose();
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: 'Save failed',
        description: error.message || 'Could not save product type',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Product Type Configuration</DialogTitle>
          <DialogDescription>
            Configure product types, generate with AI, set up component plans, and manage components
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="generate">Generate with AI</TabsTrigger>
            <TabsTrigger value="plan">Component Plan</TabsTrigger>
            <TabsTrigger value="components">Components</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="flex-1 overflow-y-auto space-y-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Option Label</label>
                <Input
                  value={optionLabel}
                  onChange={(e) => setOptionLabel(e.target.value)}
                  placeholder="e.g., Single Panel, Double Hung, 4-Panel Bifold"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  value={optionDescription}
                  onChange={(e) => setOptionDescription(e.target.value)}
                  placeholder="Describe this product option (optional)"
                  rows={4}
                />
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Workflow:</strong>
                </p>
                <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                  <li>First, create components in Settings → Components (stiles, rails, panels, etc.)</li>
                  <li>Each component includes 3D model, profile, dimensions, pricing</li>
                  <li>Use "Generate with AI" to get component suggestions from images</li>
                  <li>Select components from catalog in the "Components" tab</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* Generate with AI Tab */}
          <TabsContent value="generate" className="flex-1 overflow-y-auto space-y-4">
            <div className="space-y-4">
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

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description (Optional if image provided)
                </label>
                <Textarea
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  placeholder="e.g., Six panel traditional door with raised panels, or Double hung sash window with 2x2 muntins..."
                  rows={4}
                />
              </div>

              <Button
                onClick={handleAIEstimate}
                disabled={isEstimating || (!aiDescription && !aiImage)}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {isEstimating ? (
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
          </TabsContent>

          {/* ProductPlan Tab - Component Schedule & Configuration */}
          <TabsContent value="plan" className="flex-1 overflow-y-auto space-y-4">
            {!productPlan ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Generate a plan using AI first</p>
              </div>
            ) : (
              <div className="space-y-4">
                {aiNotice && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-700 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900">{aiNotice.title}</p>
                        <p className="text-sm text-blue-800 mt-1">{aiNotice.message}</p>
                      </div>
                    </div>
                  </div>
                )}
                {/* Detection summary */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Detected Category</p>
                      <p className="font-semibold text-sm">{productPlan.detected.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Type</p>
                      <p className="font-semibold text-sm">{productPlan.detected.type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Confidence</p>
                      <p className="font-semibold text-sm">{(productPlan.detected.confidence * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Components</p>
                      <p className="font-semibold text-sm">{productPlan.components.length} pieces</p>
                    </div>
                  </div>
                  <p className="text-xs mt-3 text-gray-700">{productPlan.rationale}</p>
                </div>

                {/* Variables editor */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Box className="h-4 w-4" />
                    Parametric Variables
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(productPlan.variables).map(([key, variable]) => (
                      <div key={key} className="space-y-1">
                        <label className="text-xs font-medium">{key} ({variable.unit})</label>
                        <Input
                          type="number"
                          value={planVariables[key] || variable.defaultValue}
                          onChange={(e) => {
                            setPlanVariables({
                              ...planVariables,
                              [key]: parseFloat(e.target.value) || variable.defaultValue
                            });
                          }}
                        />
                        {variable.description && (
                          <p className="text-xs text-muted-foreground">{variable.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Component Schedule */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Component Schedule ({productPlan.components.length} items)
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-3 py-2 text-left">ID</th>
                          <th className="px-3 py-2 text-left">Role</th>
                          <th className="px-3 py-2 text-left">Geometry</th>
                          <th className="px-3 py-2 text-left">Material Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {productPlan.components.map((comp) => (
                          <tr key={comp.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono text-xs">{comp.id}</td>
                            <td className="px-3 py-2 text-blue-700">{comp.role}</td>
                            <td className="px-3 py-2 text-amber-700">{comp.geometry.type}</td>
                            <td className="px-3 py-2 text-green-700">{comp.materialRole}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Profile slots */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Profile Slots</h4>
                  <div className="space-y-2">
                    {Object.entries(productPlan.profileSlots).map(([slot, info]) => (
                      <div key={slot} className="p-3 border rounded-lg bg-slate-50 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-mono font-semibold text-slate-700">{slot}</p>
                            <p className="text-xs text-muted-foreground">
                              {info.source === 'uploaded' ? '✓ Uploaded' : '○ Estimated: ' + info.profileHint}
                            </p>
                          </div>
                        </div>
                        {info.source === 'estimated' && (
                          <div className="text-xs text-orange-700 flex items-start gap-2 p-2 bg-orange-50 rounded">
                            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span>Paste SVG profile text below to replace estimated geometry</span>
                          </div>
                        )}
                        <Textarea
                          placeholder="Paste SVG path data here..."
                          className="text-xs font-mono h-20"
                          defaultValue={info.uploadedSvg || ''}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={() => {
                    if (productPlan) {
                      const params = compileProductPlanToProductParams(productPlan, {
                        source: 'estimate'
                      });
                      console.log('[AI2SCENE] Compiled params:', params);
                      const config = parametricToSceneConfig({
                        tenantId: 'settings',
                        entityType: 'productTemplate',
                        entityId: initialData?.optionId || 'preview',
                        productParams: params,
                      });
                      
                      if (!config) {
                        console.error('[ProductTypeEditModal] Failed to generate scene config from params');
                        toast({
                          title: 'Error',
                          description: 'Failed to compile 3D model from description. Check console for details.',
                          variant: 'destructive'
                        });
                        return;
                      }
                      
                      setCompiledParams(params);
                      setSceneConfig(config);
                      setActiveTab('components');
                      toast({
                        title: 'Plan compiled',
                        description: '3D preview is ready to edit'
                      });
                    }
                  }}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Compile Plan & Continue
                </Button>
              </div>
            )}
          </TabsContent>
          <TabsContent value="components" className="flex-1 flex flex-col min-h-0 space-y-4">
            {compiledParams && (
              <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <span>Parametric model compiled. Open the 3D builder to refine layout and materials.</span>
                  <Button size="sm" onClick={() => setShow3DConfigurator(true)}>
                    Open 3D Builder
                  </Button>
                </div>
              </div>
            )}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Component-Based Configuration:</strong> Select components from your catalog (Settings → Components).
                Components include 3D models, profiles, pricing, and parametric dimensions.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Selected Components</h4>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setComponentPickerOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Component from Catalog
                </Button>
              </div>

              {/* Component list */}
                  {loadingAssignedComponents ? (
                    <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
                      <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
                      <p className="font-medium">Loading components…</p>
                    </div>
                  ) : assignedComponents.length === 0 ? (
                <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p className="font-medium mb-1">No components added yet</p>
                  <p className="text-xs">Components are managed in Settings → Components</p>
                  <p className="text-xs mt-2">Each component includes:</p>
                  <ul className="text-xs mt-2 space-y-1">
                    <li>✓ 3D Model (GLB/GLTF)</li>
                    <li>✓ Profile (SVG/DXF) for extrusion</li>
                    <li>✓ Parametric dimensions</li>
                    <li>✓ Pricing & variants</li>
                    <li>✓ Supplier & lead time</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-2">
                  {assignedComponents.map((component) => (
                    <div
                      key={component.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-slate-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium text-slate-700">
                            {component.componentType}
                          </span>
                          <span className="font-mono text-sm font-semibold">
                            {component.code}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{component.name}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveComponent(component.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-auto p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-900">
                <strong>Next Update:</strong> Component picker will allow you to select from your catalog and configure quantities/positions.
                For now, manage components in Settings → Components, then create product types that reference them.
              </p>
            </div>
          </TabsContent>
        </Tabs>

      <DialogFooter className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !optionLabel.trim()}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Product Type'
            )}
          </Button>
      </DialogFooter>
      </DialogContent>
    </Dialog>
    {/* 3D Configurator Modal */}
    {show3DConfigurator && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl overflow-hidden h-[90vh] flex flex-col min-h-0">
          <ProductConfigurator3D
            tenantId="settings"
            entityType="productTemplate"
            entityId={initialData?.optionId || 'preview'}
            initialConfig={sceneConfig}
            productType={{
              category: initialData?.categoryId || 'doors',
              type: initialData?.type || 'standard',
              option: initialData?.optionId || 'E01',
            }}
            onChange={(config) => setSceneConfig(config)}
            height="calc(90vh - 40px)"
            onClose={() => setShow3DConfigurator(false)}
            renderQuality="low"
          />
        </div>
      </div>
    )}

    {/* Component Picker Dialog */}
    <ComponentPickerDialog
      isOpen={componentPickerOpen}
      onClose={() => setComponentPickerOpen(false)}
      onSelect={handleComponentSelected}
      productTypeId={initialData?.optionId ?? ''}
    />
    </>
  );
}
