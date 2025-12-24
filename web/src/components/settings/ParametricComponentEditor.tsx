'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calculator, Box, Palette, Ruler, Info } from 'lucide-react';

interface Material {
  id: string;
  code: string;
  name: string;
  color?: string;
}

interface Profile {
  id: string;
  code: string;
  name: string;
  profileType: string;
}

interface ComponentData {
  id?: string;
  code: string;
  name: string;
  description?: string;
  componentType: string;
  basePrice: number;
  unitOfMeasure: string;
  // Formula fields for parametric positioning
  positionXFormula?: string;
  positionYFormula?: string;
  positionZFormula?: string;
  // Formula fields for parametric sizing
  widthFormula?: string;
  heightFormula?: string;
  depthFormula?: string;
  // Material and profiles
  materialId?: string;
  bodyProfileId?: string;
  startEndProfileId?: string;
  endEndProfileId?: string;
}

interface ParametricComponentEditorProps {
  component?: ComponentData;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function ParametricComponentEditor({
  component,
  isOpen,
  onClose,
  onSave,
}: ParametricComponentEditorProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  const [formData, setFormData] = useState<ComponentData>({
    code: '',
    name: '',
    description: '',
    componentType: '',
    basePrice: 0,
    unitOfMeasure: 'EA',
    positionXFormula: '',
    positionYFormula: '',
    positionZFormula: '',
    widthFormula: '',
    heightFormula: '',
    depthFormula: '',
    materialId: undefined,
    bodyProfileId: undefined,
    startEndProfileId: undefined,
    endEndProfileId: undefined,
  });

  useEffect(() => {
    if (component) {
      setFormData({
        ...component,
        // Ensure formula fields exist even if undefined
        positionXFormula: component.positionXFormula || '',
        positionYFormula: component.positionYFormula || '',
        positionZFormula: component.positionZFormula || '',
        widthFormula: component.widthFormula || '',
        heightFormula: component.heightFormula || '',
        depthFormula: component.depthFormula || '',
      });
    }
  }, [component]);

  useEffect(() => {
    if (isOpen) {
      loadMaterials();
      loadProfiles();
    }
  }, [isOpen]);

  const loadMaterials = async () => {
    try {
      const res = await fetch('/api/materials', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
      }
    } catch (error) {
      console.error('Failed to load materials:', error);
    }
  };

  const loadProfiles = async () => {
    try {
      const res = await fetch('/api/profiles', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      }
    } catch (error) {
      console.error('Failed to load profiles:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = component?.id
        ? `/api/components/${component.id}`
        : '/api/components';
      
      const method = component?.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          // Convert empty strings to null for optional fields
          positionXFormula: formData.positionXFormula || null,
          positionYFormula: formData.positionYFormula || null,
          positionZFormula: formData.positionZFormula || null,
          widthFormula: formData.widthFormula || null,
          heightFormula: formData.heightFormula || null,
          depthFormula: formData.depthFormula || null,
          materialId: formData.materialId || null,
          bodyProfileId: formData.bodyProfileId || null,
          startEndProfileId: formData.startEndProfileId || null,
          endEndProfileId: formData.endEndProfileId || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save component');
      }

      toast({
        title: component?.id ? 'Component updated' : 'Component created',
        description: `${formData.name} saved successfully`,
      });

      onSave();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {component?.id ? 'Edit' : 'Create'} Parametric Component
          </DialogTitle>
          <DialogDescription>
            Define formulas for position and dimensions. Reference other components, product dimensions, and variables.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">
                <Box className="w-4 h-4 mr-2" />
                Basic Info
              </TabsTrigger>
              <TabsTrigger value="position">
                <Ruler className="w-4 h-4 mr-2" />
                Position
              </TabsTrigger>
              <TabsTrigger value="dimensions">
                <Calculator className="w-4 h-4 mr-2" />
                Dimensions
              </TabsTrigger>
              <TabsTrigger value="materials">
                <Palette className="w-4 h-4 mr-2" />
                Material & Profiles
              </TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., FRAME_LEFT"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Left Frame Rail"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="componentType">Component Type *</Label>
                  <Input
                    id="componentType"
                    value={formData.componentType}
                    onChange={(e) => setFormData({ ...formData, componentType: e.target.value })}
                    placeholder="e.g., FRAME_RAIL, STILE, PANEL"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unitOfMeasure">Unit of Measure</Label>
                  <Select
                    value={formData.unitOfMeasure}
                    onValueChange={(value) => setFormData({ ...formData, unitOfMeasure: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EA">Each (EA)</SelectItem>
                      <SelectItem value="M">Meters (M)</SelectItem>
                      <SelectItem value="MM">Millimeters (MM)</SelectItem>
                      <SelectItem value="KG">Kilograms (KG)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="basePrice">Base Price</Label>
                  <Input
                    id="basePrice"
                    type="number"
                    step="0.01"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description of the component..."
                  rows={3}
                />
              </div>
            </TabsContent>

            {/* Position Formulas Tab */}
            <TabsContent value="position" className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Formula Syntax:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><code>product.width</code>, <code>product.height</code>, <code>product.depth</code> - Product dimensions</li>
                      <li><code>COMPONENT_CODE.width</code> - Reference other component dimensions</li>
                      <li><code>frameWidth</code>, <code>gap</code>, <code>rebate</code> - Variables</li>
                      <li>Math: <code>+</code>, <code>-</code>, <code>*</code>, <code>/</code>, <code>()</code>, <code>abs()</code>, <code>min()</code>, <code>max()</code></li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="positionXFormula">Position X Formula</Label>
                  <Input
                    id="positionXFormula"
                    value={formData.positionXFormula || ''}
                    onChange={(e) => setFormData({ ...formData, positionXFormula: e.target.value })}
                    placeholder="e.g., 0 or frameWidth + gap"
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="positionYFormula">Position Y Formula</Label>
                  <Input
                    id="positionYFormula"
                    value={formData.positionYFormula || ''}
                    onChange={(e) => setFormData({ ...formData, positionYFormula: e.target.value })}
                    placeholder="e.g., 0"
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="positionZFormula">Position Z Formula</Label>
                  <Input
                    id="positionZFormula"
                    value={formData.positionZFormula || ''}
                    onChange={(e) => setFormData({ ...formData, positionZFormula: e.target.value })}
                    placeholder="e.g., product.height - railHeight - gap"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Dimension Formulas Tab */}
            <TabsContent value="dimensions" className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="text-sm text-green-900">
                    <p className="font-semibold mb-1">Example Formula:</p>
                    <p className="font-mono text-xs bg-white px-2 py-1 rounded mt-2">
                      product.width - frameWidth * 2 - STILE_LEFT.width - STILE_RIGHT.width + tennonLength * 2
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="widthFormula">Width Formula</Label>
                  <Input
                    id="widthFormula"
                    value={formData.widthFormula || ''}
                    onChange={(e) => setFormData({ ...formData, widthFormula: e.target.value })}
                    placeholder="e.g., product.width - frameWidth * 2"
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="heightFormula">Height Formula</Label>
                  <Input
                    id="heightFormula"
                    value={formData.heightFormula || ''}
                    onChange={(e) => setFormData({ ...formData, heightFormula: e.target.value })}
                    placeholder="e.g., railHeight"
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="depthFormula">Depth Formula</Label>
                  <Input
                    id="depthFormula"
                    value={formData.depthFormula || ''}
                    onChange={(e) => setFormData({ ...formData, depthFormula: e.target.value })}
                    placeholder="e.g., doorThickness"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Material & Profiles Tab */}
            <TabsContent value="materials" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="materialId">Material (for rendering)</Label>
                  <Select
                    value={formData.materialId || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, materialId: value === 'none' ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select material..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Material</SelectItem>
                      {materials.map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          <div className="flex items-center gap-2">
                            {material.color && (
                              <div
                                className="w-4 h-4 rounded border"
                                style={{ backgroundColor: material.color }}
                              />
                            )}
                            {material.name} ({material.code})
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="bodyProfileId">Body Profile (main shape)</Label>
                  <Select
                    value={formData.bodyProfileId || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, bodyProfileId: value === 'none' ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select profile..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Profile</SelectItem>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} ({profile.profileType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startEndProfileId">Start End Profile (tenon/shoulder)</Label>
                  <Select
                    value={formData.startEndProfileId || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, startEndProfileId: value === 'none' ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select end profile..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No End Profile</SelectItem>
                      {profiles.filter(p => ['TENON', 'SHOULDER', 'REBATE'].includes(p.profileType)).map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} ({profile.profileType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endEndProfileId">End End Profile (tenon/shoulder)</Label>
                  <Select
                    value={formData.endEndProfileId || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, endEndProfileId: value === 'none' ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select end profile..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No End Profile</SelectItem>
                      {profiles.filter(p => ['TENON', 'SHOULDER', 'REBATE'].includes(p.profileType)).map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} ({profile.profileType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : component?.id ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
