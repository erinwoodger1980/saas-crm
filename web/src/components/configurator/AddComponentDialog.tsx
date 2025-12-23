'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ComponentNode } from '@/types/scene-config';

export const COMPONENT_TYPES = [
  { id: 'rail', label: 'Rail', defaultDims: [2000, 50, 50], hint: 'Horizontal or vertical rail' },
  { id: 'frame', label: 'Frame', defaultDims: [800, 1800, 50], hint: 'Door or window frame' },
  { id: 'panel', label: 'Panel', defaultDims: [800, 1800, 20], hint: 'Door or panel filling' },
  { id: 'hinge', label: 'Hinge', defaultDims: [50, 100, 50], hint: 'Door hinge' },
  { id: 'handle', label: 'Handle', defaultDims: [100, 50, 30], hint: 'Door or window handle' },
  { id: 'lock', label: 'Lock', defaultDims: [100, 100, 50], hint: 'Door lock mechanism' },
  { id: 'glass', label: 'Glass Pane', defaultDims: [700, 900, 5], hint: 'Glass or transparent pane' },
  { id: 'custom', label: 'Custom Box', defaultDims: [100, 100, 100], hint: 'Generic box component' },
];

interface AddComponentDialogProps {
  materials: Array<{ id: string; name: string }>;
  onAdd: (component: ComponentNode) => void;
  productWidth?: number;
  productHeight?: number;
  existingComponents?: ComponentNode[];
}

export function AddComponentDialog({
  materials,
  onAdd,
  productWidth = 800,
  productHeight = 2000,
  existingComponents = [],
}: AddComponentDialogProps) {
  const [open, setOpen] = useState(false);
  const [componentType, setComponentType] = useState<string>('');
  const [name, setName] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState(materials[0]?.id || 'default');

  const typeConfig = COMPONENT_TYPES.find(t => t.id === componentType);

  const handleCreate = () => {
    if (!componentType || !name.trim()) {
      alert('Please select a type and enter a name');
      return;
    }

    const config = COMPONENT_TYPES.find(t => t.id === componentType);
    if (!config) return;

    // Smart positioning based on component type
    let position: [number, number, number] = [0, 0, 0];
    
    switch (componentType) {
      case 'rail':
        // Rails typically go at top or sides
        position = [0, productHeight * 0.4, 0];
        break;
      case 'frame':
        // Frames centered
        position = [0, productHeight / 2, 0];
        break;
      case 'panel':
        // Panels centered slightly forward
        position = [0, productHeight / 2, 100];
        break;
      case 'hinge':
        // Hinges on the side
        position = [-(productWidth / 2 - 50), productHeight / 2, 0];
        break;
      case 'handle':
        // Handles centered horizontally, upper third
        position = [productWidth / 2 - 50, productHeight * 0.65, 50];
        break;
      case 'lock':
        // Locks centered, middle-lower
        position = [productWidth / 2 - 50, productHeight * 0.35, 50];
        break;
      case 'glass':
        // Glass panes offset forward
        position = [0, productHeight / 2, 50];
        break;
      default:
        position = [0, 200, 0];
    }

    const newComponent: ComponentNode = {
      id: `component_${Date.now()}`,
      name: name.trim(),
      type: componentType as any,
      visible: true,
      position,
      rotation: [0, 0, 0],
      geometry: {
        type: 'box',
        dimensions: config.defaultDims as [number, number, number],
        position: [0, 0, 0],
      },
      materialId: selectedMaterialId,
    };

    onAdd(newComponent);
    setOpen(false);
    setComponentType('');
    setName('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" size="sm">
          Add Component
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Component</DialogTitle>
          <DialogDescription>
            Select the type and customize the new component
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Component Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Component Type</Label>
            <Select value={componentType} onValueChange={setComponentType}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Select component type..." />
              </SelectTrigger>
              <SelectContent>
                {COMPONENT_TYPES.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-muted-foreground">{type.hint}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Component Name</Label>
            <Input
              id="name"
              placeholder="e.g., Left Door Rail"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Material */}
          <div className="space-y-2">
            <Label htmlFor="material">Material</Label>
            <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId}>
              <SelectTrigger id="material">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {materials.map(mat => (
                  <SelectItem key={mat.id} value={mat.id}>
                    {mat.name || mat.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type info */}
          {typeConfig && (
            <div className="text-sm bg-muted p-2 rounded">
              <p className="font-medium">{typeConfig.label}</p>
              <p className="text-xs text-muted-foreground">{typeConfig.hint}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Default size: {typeConfig.defaultDims[0]} × {typeConfig.defaultDims[1]} × {typeConfig.defaultDims[2]} mm
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!componentType || !name.trim()}>
            Create Component
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
