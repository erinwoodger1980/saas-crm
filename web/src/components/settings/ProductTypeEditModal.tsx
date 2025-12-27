'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Sparkles, Image as ImageIcon, Trash2, Plus, Box, Package, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ProductConfigurator3D } from '@/components/configurator/ProductConfigurator3D';
import { createDefaultSceneConfig } from '@/lib/scene/config-validation';
import { ProductPlanV1 } from '@/types/product-plan';
import { compileProductPlanToProductParams } from '@/lib/scene/plan-compiler';

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
  
  // Overview tab state
  const [optionLabel, setOptionLabel] = useState(initialData?.label || '');
  const [optionDescription, setOptionDescription] = useState('');
  
  // AI Generation tab state
  const [aiDescription, setAiDescription] = useState('');
  const [aiImage, setAiImage] = useState<File | null>(null);
  const [aiImagePreview, setAiImagePreview] = useState<string | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  
  // ProductPlan state (new)
  const [productPlan, setProductPlan] = useState<ProductPlanV1 | null>(null);
  const [planVariables, setPlanVariables] = useState<Record<string, number>>({});
  
  // 3D Configurator state
  const [sceneConfig, setSceneConfig] = useState<any>(
    createDefaultSceneConfig(
      initialData?.categoryId || 'doors',
      defaultDimensions.widthMm,
      defaultDimensions.heightMm
    )
  );
  const [show3DConfigurator, setShow3DConfigurator] = useState(false);

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
      // NEW: Call generate-product-plan instead of estimate-components
      const response = await fetch('/api/ai/generate-product-plan', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: aiDescription || 'Product from image',
          image: aiImagePreview || undefined,
          existingProductType: {
            category: initialData?.categoryId || 'door',
            type: initialData?.type || 'timber'
          },
          existingDims: {
            widthMm: defaultDimensions.widthMm,
            heightMm: defaultDimensions.heightMm,
            depthMm: 45,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API error:', errorText);
        throw new Error(`API error: ${response.statusText}`);
      }

      const plan = (await response.json()) as ProductPlanV1;
      console.log('[AI2SCENE] Generated ProductPlan:', plan);
      
      setProductPlan(plan);
      // Initialize plan variables
      const vars: Record<string, number> = {};
      for (const [key, variable] of Object.entries(plan.variables)) {
        vars[key] = variable.defaultValue;
      }
      setPlanVariables(vars);
      
      setActiveTab('plan');
      toast({
        title: 'ProductPlan Generated',
        description: `Detected: ${plan.detected.type} (${plan.detected.option || 'auto'}) - ${plan.components.length} components`,
      });
    } catch (error: any) {
      console.error('AI estimation error:', error);
      toast({
        title: 'Generation failed',
        description: error.message || 'Could not generate product plan',
        variant: 'destructive',
      });
    } finally {
      setIsEstimating(false);
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Product Type Configuration</DialogTitle>
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
                      setActiveTab('components');
                      toast({
                        title: 'Plan compiled',
                        description: 'Ready to proceed with component configuration'
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
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Component-Based Configuration:</strong> Select components from your catalog (Settings → Components).
                Components include 3D models, profiles, pricing, and parametric dimensions.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Selected Components</h4>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Component from Catalog
                </Button>
              </div>

              {/* Component list placeholder */}
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
  );
}
