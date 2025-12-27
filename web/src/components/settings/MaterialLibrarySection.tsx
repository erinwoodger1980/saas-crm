'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { asArray } from '@/lib/utils/array-parsing';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Edit, Trash2, Copy, Palette, Search, Plus } from 'lucide-react';

interface Material {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  supplierId?: string;
  supplier?: {
    id: string;
    name: string;
    code?: string;
  };
  unitCost: number;
  currency: string;
  unit: string;
  thickness?: number;
  species?: string;
  grade?: string;
  finish?: string;
  color?: string;
  colorName?: string;
  textureUrl?: string;
  textureType?: string;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  isActive: boolean;
}

const MATERIAL_CATEGORIES = [
  { value: 'TIMBER_HARDWOOD', label: 'Timber - Hardwood' },
  { value: 'TIMBER_SOFTWOOD', label: 'Timber - Softwood' },
  { value: 'BOARD_MDF', label: 'Board - MDF' },
  { value: 'BOARD_PLYWOOD', label: 'Board - Plywood' },
  { value: 'MOULDING_BEAD', label: 'Moulding - Bead' },
  { value: 'MOULDING_GROOVE', label: 'Moulding - Groove' },
  { value: 'RAISED_PANEL', label: 'Raised Panel' },
  { value: 'VENEER_SHEET', label: 'Veneer Sheet' },
];

export function MaterialLibrarySection() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    loadMaterials();
    loadSuppliers();
  }, []);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/materials', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load materials');
      const data = await response.json();
      // Ensure data is an array and normalize unitCost to number
      if (Array.isArray(data)) {
        const normalized = data.map(m => ({
          ...m,
          unitCost: typeof m.unitCost === 'number' ? m.unitCost : parseFloat(m.unitCost) || 0,
        }));
        setMaterials(normalized);
      } else {
        console.error('Materials API returned non-array:', data);
        setMaterials([]);
      }
    } catch (error) {
      console.error('Failed to load material library:', error);
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  // Normalize suppliers response to always return an array
  function normalizeSuppliers(res: any): any[] {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    if (Array.isArray(res?.suppliers)) return res.suppliers;
    if (Array.isArray(res?.data?.suppliers)) return res.data.suppliers;
    
    if (process.env.NODE_ENV === 'development') {
      console.warn('[MaterialLibrary] Unexpected suppliers response format, returning empty array');
    }
    return [];
  }

  const loadSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        const suppliers = normalizeSuppliers(data);
        setSuppliers(suppliers);
        if (process.env.NODE_ENV === 'development') {
          console.log('[MaterialLibrary] Loaded suppliers:', suppliers.length);
        }
      }
    } catch (error) {
      console.error('Failed to load suppliers:', error);
      setSuppliers([]);
    }
  };

  const handleSave = async (material: Partial<Material>) => {
    try {
      const url = material.id ? `/api/materials/${material.id}` : '/api/materials';
      const method = material.id ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(material),
      });

      if (!response.ok) throw new Error('Failed to save material');
      await loadMaterials();
      setEditDialogOpen(false);
      setCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to save material:', error);
      alert('Failed to save material');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this material?')) return;

    try {
      const response = await fetch(`/api/materials/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete material');
      await loadMaterials();
    } catch (error) {
      console.error('Failed to delete material:', error);
      alert('Failed to delete material');
    }
  };

  const handleDuplicate = async (material: Material) => {
    try {
      const response = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...material,
          id: undefined,
          code: `${material.code}_COPY`,
          name: `${material.name} (Copy)`,
        }),
      });
      if (!response.ok) throw new Error('Failed to duplicate material');
      await loadMaterials();
    } catch (error) {
      console.error('Failed to duplicate material:', error);
      alert('Failed to duplicate material');
    }
  };

  // Filter and search
  const filteredMaterials = materials.filter(mat => {
    const matchesSearch =
      searchTerm === '' ||
      mat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mat.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mat.species?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = !filterCategory || mat.category === filterCategory;
    const matchesColor = !filterColor || mat.colorName === filterColor;

    return matchesSearch && matchesCategory && matchesColor;
  });

  const uniqueColors = Array.from(
    new Set(materials.map(m => m.colorName).filter(Boolean))
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Material Library</h3>
        <div className="text-sm text-muted-foreground">Loading materials...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Material Library</h3>
          <p className="text-sm text-muted-foreground">
            Materials with textures, colors, and costs for 3D rendering and costing
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Material
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search materials..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory || 'all'} onValueChange={v => setFilterCategory(v === 'all' ? null : v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {MATERIAL_CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterColor || 'all'} onValueChange={v => setFilterColor(v === 'all' ? null : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Color" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Colors</SelectItem>
            {uniqueColors.map(color => (
              <SelectItem key={color} value={color!}>
                {color}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Materials Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Color</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Species</TableHead>
              <TableHead>Finish</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMaterials.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No materials found. AI estimation creates materials automatically.
                </TableCell>
              </TableRow>
            )}
            {filteredMaterials.map(mat => (
              <TableRow key={mat.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {mat.color && (
                      <div
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: mat.color }}
                        title={mat.colorName || mat.color}
                      />
                    )}
                    <span className="text-xs text-muted-foreground">{mat.colorName}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{mat.code}</TableCell>
                <TableCell>{mat.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {MATERIAL_CATEGORIES.find(c => c.value === mat.category)?.label || mat.category}
                  </Badge>
                </TableCell>
                <TableCell>{mat.species || '-'}</TableCell>
                <TableCell>{mat.finish || '-'}</TableCell>
                <TableCell>
                  {mat.currency} {typeof mat.unitCost === 'number' ? mat.unitCost.toFixed(2) : (parseFloat(String(mat.unitCost)) || 0).toFixed(2)}/{mat.unit}
                </TableCell>
                <TableCell>
                  {mat.supplier ? (
                    <span className="text-sm">{mat.supplier.name}</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setSelectedMaterial(mat);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleDuplicate(mat)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => handleDelete(mat.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit/Create Dialog */}
      <MaterialDialog
        open={editDialogOpen || createDialogOpen}
        onOpenChange={open => {
          setEditDialogOpen(open);
          setCreateDialogOpen(open);
        }}
        material={editDialogOpen ? selectedMaterial : null}
        suppliers={suppliers}
        onSave={handleSave}
      />
    </div>
  );
}

interface MaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: Material | null;
  suppliers: any[];
  onSave: (material: Partial<Material>) => void;
}

function MaterialDialog({ open, onOpenChange, material, suppliers, onSave }: MaterialDialogProps) {
  const [formData, setFormData] = useState<Partial<Material>>({});

  useEffect(() => {
    if (material) {
      setFormData(material);
    } else {
      setFormData({
        category: 'TIMBER_HARDWOOD',
        unitCost: 0,
        currency: 'GBP',
        unit: 'm',
        roughness: 0.7,
        metalness: 0,
        opacity: 1,
        isActive: true,
      });
    }
  }, [material]);

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{material ? 'Edit Material' : 'Create Material'}</DialogTitle>
          <DialogDescription>
            Configure material properties for 3D rendering and costing
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Code *</Label>
              <Input
                value={formData.code || ''}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
                placeholder="OAK_NATURAL"
              />
            </div>
            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name || ''}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Oak Natural"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category *</Label>
              <Select
                value={formData.category}
                onValueChange={v => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Supplier</Label>
              <Select
                value={formData.supplierId || 'none'}
                onValueChange={v => setFormData({ ...formData, supplierId: v === 'none' ? undefined : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {suppliers.map(sup => (
                    <SelectItem key={sup.id} value={sup.id}>
                      {sup.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Species</Label>
              <Input
                value={formData.species || ''}
                onChange={e => setFormData({ ...formData, species: e.target.value })}
                placeholder="Oak"
              />
            </div>
            <div>
              <Label>Finish</Label>
              <Input
                value={formData.finish || ''}
                onChange={e => setFormData({ ...formData, finish: e.target.value })}
                placeholder="Natural"
              />
            </div>
            <div>
              <Label>Thickness (mm)</Label>
              <Input
                type="number"
                value={formData.thickness || ''}
                onChange={e => setFormData({ ...formData, thickness: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">3D Rendering Properties</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Color (Hex)</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.color || ''}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#8B4513"
                  />
                  {formData.color && (
                    <div
                      className="w-10 h-10 rounded border"
                      style={{ backgroundColor: formData.color }}
                    />
                  )}
                </div>
              </div>
              <div>
                <Label>Color Name</Label>
                <Input
                  value={formData.colorName || ''}
                  onChange={e => setFormData({ ...formData, colorName: e.target.value })}
                  placeholder="Natural Oak"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <Label>Roughness (0-1)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.roughness || 0.5}
                  onChange={e => setFormData({ ...formData, roughness: parseFloat(e.target.value) })}
                />
                <span className="text-xs text-muted-foreground">0=Glossy, 1=Matte</span>
              </div>
              <div>
                <Label>Metalness (0-1)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.metalness || 0}
                  onChange={e => setFormData({ ...formData, metalness: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Opacity (0-1)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.opacity || 1}
                  onChange={e => setFormData({ ...formData, opacity: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="mt-4">
              <Label>Texture URL</Label>
              <Input
                value={formData.textureUrl || ''}
                onChange={e => setFormData({ ...formData, textureUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Pricing</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Unit Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.unitCost || 0}
                  onChange={e => setFormData({ ...formData, unitCost: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Input
                  value={formData.currency || 'GBP'}
                  onChange={e => setFormData({ ...formData, currency: e.target.value })}
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Input
                  value={formData.unit || 'm'}
                  onChange={e => setFormData({ ...formData, unit: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Save Material</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
