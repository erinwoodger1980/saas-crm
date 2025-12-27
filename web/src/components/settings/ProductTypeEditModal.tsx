'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Sparkles, Image as ImageIcon, Trash2, Plus, Box, Package } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ProductConfigurator3D } from '@/components/configurator/ProductConfigurator3D';
import { createDefaultSceneConfig } from '@/lib/scene/config-validation';

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
      // Get tenant ID from settings
      const settingsRes = await fetch('/api/tenant/settings', { credentials: 'include' });
      if (!settingsRes.ok) {
        throw new Error('Failed to get tenant settings');
      }
      const settingsData = await settingsRes.json();
      const tenantId = settingsData.tenantId;

      if (!tenantId) {
        throw new Error('No tenant ID found');
      }

      const response = await fetch('/api/ai/estimate-components', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId,
          description: aiDescription || 'Product from image',
          productType: initialData?.categoryId || 'doors',
          existingDimensions: {
            widthMm: defaultDimensions.widthMm,
            heightMm: defaultDimensions.heightMm,
            thicknessMm: 45,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API error:', errorText);
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('AI estimation result:', result);
      
      // The new API returns suggestedParamsPatch and suggestedAddedParts
      // For now, just show success and switch to the 3D tab
      // The user can manually configure the product
      setActiveTab('components');
      toast({
        title: 'AI Analysis Complete',
        description: result.rationale || 'AI has analyzed your product. You can now configure it in the 3D editor.',
      });
    } catch (error: any) {
      console.error('AI estimation error:', error);
      toast({
        title: 'Estimation failed',
        description: error.message || 'Could not estimate components',
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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="generate">Generate with AI</TabsTrigger>
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

          {/* 3D Components Tab - Now uses catalog components */}
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
