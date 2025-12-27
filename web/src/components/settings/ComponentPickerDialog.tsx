'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';

interface Component {
  id: string;
  code: string;
  name: string;
  description?: string;
  componentType: string;
  basePrice: number;
  unitOfMeasure: string;
  supplier?: { name: string };
}

interface ComponentPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (component: Component) => void;
  productTypeId: string;
}

const COMPONENT_TYPES = [
  'LIPPING',
  'INTUMESCENT_STRIP',
  'SMOKE_SEAL',
  'HINGE',
  'LOCK',
  'DOOR_CLOSER',
  'VISION_PANEL',
  'GLAZING_BEAD',
  'DOOR_BLANK',
  'FACING',
  'FRAME',
  'THRESHOLD',
  'PAINT_FINISH',
  'RAIL',
  'STILE',
  'PANEL',
  'MUNTIN',
];

export function ComponentPickerDialog({ isOpen, onClose, onSelect, productTypeId }: ComponentPickerDialogProps) {
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // New component form
  const [newComponent, setNewComponent] = useState({
    code: '',
    name: '',
    description: '',
    componentType: '',
    basePrice: '0',
    unitOfMeasure: 'EA',
    supplierId: '',
  });

  useEffect(() => {
    if (isOpen && mode === 'search') {
      loadComponents();
    }
  }, [isOpen, mode, searchQuery, filterType]);

  const loadComponents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filterType && filterType !== 'all') params.set('componentType', filterType);
      
      const data = await apiFetch<Component[]>(`/components?${params.toString()}`);
      setComponents(data);
    } catch (error) {
      console.error('Failed to load components:', error);
      toast({
        title: 'Load failed',
        description: 'Could not load components',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateComponent = async () => {
    if (!newComponent.code || !newComponent.name || !newComponent.componentType) {
      toast({
        title: 'Validation error',
        description: 'Code, name, and type are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCreating(true);
      const created = await apiFetch<Component>('/components', {
        method: 'POST',
        json: {
          ...newComponent,
          basePrice: parseFloat(newComponent.basePrice) || 0,
          leadTimeDays: 0,
          isActive: true,
        },
      });

      toast({
        title: 'Component created',
        description: `${created.code} created successfully`,
      });

      onSelect(created);
      handleClose();
    } catch (error: any) {
      toast({
        title: 'Create failed',
        description: error?.message || 'Could not create component',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setMode('search');
    setSearchQuery('');
    setFilterType('all');
    setNewComponent({
      code: '',
      name: '',
      description: '',
      componentType: '',
      basePrice: '0',
      unitOfMeasure: 'EA',
      supplierId: '',
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Component to Product Type</DialogTitle>
          <DialogDescription>
            Search for an existing component or create a new one
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 border-b pb-3">
          <Button
            variant={mode === 'search' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('search')}
          >
            <Search className="h-4 w-4 mr-2" />
            Search Existing
          </Button>
          <Button
            variant={mode === 'create' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('create')}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New
          </Button>
        </div>

        {mode === 'search' ? (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Search by code or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {COMPONENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 overflow-y-auto border rounded-lg">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : components.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-500">
                  No components found. Try a different search or create a new component.
                </div>
              ) : (
                <div className="divide-y">
                  {components.map((component) => (
                    <div
                      key={component.id}
                      className="p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => {
                        onSelect(component);
                        handleClose();
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              {component.componentType}
                            </Badge>
                            <span className="font-mono text-sm font-semibold">
                              {component.code}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-slate-900">
                            {component.name}
                          </div>
                          {component.description && (
                            <div className="text-xs text-slate-600 mt-1 line-clamp-2">
                              {component.description}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                            <span>£{component.basePrice.toFixed(2)} / {component.unitOfMeasure}</span>
                            {component.supplier && (
                              <span>• {component.supplier.name}</span>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          Select
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Component Code*</Label>
                <Input
                  placeholder="e.g., HNG-BT-SS"
                  value={newComponent.code}
                  onChange={(e) =>
                    setNewComponent({ ...newComponent, code: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div>
                <Label>Component Type*</Label>
                <Select
                  value={newComponent.componentType}
                  onValueChange={(value) =>
                    setNewComponent({ ...newComponent, componentType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPONENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Name*</Label>
              <Input
                placeholder="e.g., Butt Hinge - Stainless Steel"
                value={newComponent.name}
                onChange={(e) => setNewComponent({ ...newComponent, name: e.target.value })}
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description..."
                value={newComponent.description}
                onChange={(e) =>
                  setNewComponent({ ...newComponent, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Base Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newComponent.basePrice}
                  onChange={(e) =>
                    setNewComponent({ ...newComponent, basePrice: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select
                  value={newComponent.unitOfMeasure}
                  onValueChange={(value) =>
                    setNewComponent({ ...newComponent, unitOfMeasure: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EA">Each (EA)</SelectItem>
                    <SelectItem value="M">Meter (M)</SelectItem>
                    <SelectItem value="M2">Square Meter (M2)</SelectItem>
                    <SelectItem value="KG">Kilogram (KG)</SelectItem>
                    <SelectItem value="L">Liter (L)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleCreateComponent} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create & Add
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
