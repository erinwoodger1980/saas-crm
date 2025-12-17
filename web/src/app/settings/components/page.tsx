'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Search, Filter, Upload, Download, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';

interface Supplier {
  id: string;
  name: string;
  leadTimeDays: number | null;
}

interface Component {
  id: string;
  code: string;
  name: string;
  description: string | null;
  componentType: string;
  productTypes: string[];
  unitOfMeasure: string;
  basePrice: number;
  leadTimeDays: number;
  supplierId: string | null;
  isActive: boolean;
  metadata: any;
  supplier: Supplier | null;
  createdAt: string;
  updatedAt: string;
}

interface ComponentFormData {
  code: string;
  name: string;
  description: string;
  componentType: string;
  productTypes: string[];
  unitOfMeasure: string;
  basePrice: string;
  leadTimeDays: string;
  supplierId: string;
  isActive: boolean;
}

const UNIT_OPTIONS = ['EA', 'M', 'M2', 'M3', 'KG', 'L', 'SET', 'PAIR', 'BOX'];

const COMPONENT_TYPE_LABELS: Record<string, string> = {
  LIPPING: 'Lipping',
  INTUMESCENT_STRIP: 'Intumescent Strip',
  SMOKE_SEAL: 'Smoke Seal',
  HINGE: 'Hinge',
  LOCK: 'Lock',
  DOOR_CLOSER: 'Door Closer',
  VISION_PANEL: 'Vision Panel',
  GLAZING_BEAD: 'Glazing Bead',
  DOOR_BLANK: 'Door Blank',
  FACING: 'Facing Material',
  FRAME: 'Frame',
  THRESHOLD: 'Threshold',
  PAINT_FINISH: 'Paint/Finish'
};

const emptyFormData: ComponentFormData = {
  code: '',
  name: '',
  description: '',
  componentType: '',
  productTypes: [],
  unitOfMeasure: 'EA',
  basePrice: '0',
  leadTimeDays: '0',
  supplierId: '',
  isActive: true
};

export default function ComponentsPage() {
  const { toast } = useToast();
  const [components, setComponents] = useState<Component[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [formData, setFormData] = useState<ComponentFormData>(emptyFormData);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('active');
  const [componentTypes, setComponentTypes] = useState<string[]>([]);

  useEffect(() => {
    loadComponents();
    loadSuppliers();
    loadComponentTypes();
  }, []);

  const loadComponents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType) params.append('componentType', filterType);
      if (filterActive === 'active') params.append('isActive', 'true');
      if (filterActive === 'inactive') params.append('isActive', 'false');
      if (searchQuery) params.append('search', searchQuery);

      const data = await apiFetch<Component[]>(`/components?${params.toString()}`);
      setComponents(data);
    } catch (error) {
      console.error('Error loading components:', error);
      toast({
        title: 'Error',
        description: 'Failed to load components',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await apiFetch<Supplier[]>('/suppliers');
      setSuppliers(data);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const loadComponentTypes = async () => {
    try {
      const types = await apiFetch<string[]>('/components/types/all');
      setComponentTypes(types);
    } catch (error) {
      console.error('Error loading component types:', error);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadComponents();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, filterType, filterActive]);

  const handleAdd = () => {
    setEditingComponent(null);
    setFormData(emptyFormData);
    setShowModal(true);
  };

  const handleEdit = (component: Component) => {
    setEditingComponent(component);
    setFormData({
      code: component.code,
      name: component.name,
      description: component.description || '',
      componentType: component.componentType,
      productTypes: Array.isArray(component.productTypes) ? component.productTypes : [],
      unitOfMeasure: component.unitOfMeasure,
      basePrice: component.basePrice.toString(),
      leadTimeDays: component.leadTimeDays.toString(),
      supplierId: component.supplierId || '',
      isActive: component.isActive
    });
    setShowModal(true);
  };

  const handleDelete = async (component: Component) => {
    if (!confirm(`Are you sure you want to delete ${component.name}?`)) return;

    try {
      await apiFetch(`/components/${component.id}`, {
        method: 'DELETE'
      });

      toast({
        title: 'Success',
        description: 'Component deleted successfully'
      });

      loadComponents();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete component',
        variant: 'destructive'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || !formData.name || !formData.componentType) {
      toast({
        title: 'Validation Error',
        description: 'Code, name, and component type are required',
        variant: 'destructive'
      });
      return;
    }

    try {
      const payload = {
        code: formData.code,
        name: formData.name,
        description: formData.description || null,
        componentType: formData.componentType,
        productTypes: formData.productTypes,
        unitOfMeasure: formData.unitOfMeasure,
        basePrice: parseFloat(formData.basePrice) || 0,
        leadTimeDays: parseInt(formData.leadTimeDays) || 0,
        supplierId: formData.supplierId || null,
        isActive: formData.isActive
      };

      if (editingComponent) {
        await apiFetch(`/components/${editingComponent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        toast({
          title: 'Success',
          description: 'Component updated successfully'
        });
      } else {
        await apiFetch('/components', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        toast({
          title: 'Success',
          description: 'Component created successfully'
        });
      }

      setShowModal(false);
      loadComponents();
      loadComponentTypes();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save component',
        variant: 'destructive'
      });
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Code',
      'Name',
      'Type',
      'Product Types',
      'Unit',
      'Base Price',
      'Lead Time (Days)',
      'Supplier',
      'Active',
      'Description'
    ];

    const rows = components.map(c => [
      c.code,
      c.name,
      c.componentType,
      (Array.isArray(c.productTypes) ? c.productTypes : []).join(';'),
      c.unitOfMeasure,
      c.basePrice,
      c.leadTimeDays,
      c.supplier?.name || '',
      c.isActive ? 'Yes' : 'No',
      c.description || ''
    ]);

    const csv = [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `components-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Success',
      description: `Exported ${components.length} components`
    });
  };

  const toggleProductType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      productTypes: prev.productTypes.includes(type)
        ? prev.productTypes.filter(t => t !== type)
        : [...prev.productTypes, type]
    }));
  };

  const groupedComponents = components.reduce((acc, comp) => {
    if (!acc[comp.componentType]) {
      acc[comp.componentType] = [];
    }
    acc[comp.componentType].push(comp);
    return acc;
  }, {} as Record<string, Component[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Component Catalog</h1>
            <p className="mt-2 text-sm text-slate-600">
              Manage components for all your product types. Components can be used across fire doors, windows, conservatories, and more.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleExportCSV}
              variant="outline"
              disabled={components.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Component
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search components..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Component Types</option>
              {componentTypes.map(type => (
                <option key={type} value={type}>
                  {COMPONENT_TYPE_LABELS[type] || type}
                </option>
              ))}
            </select>

            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Package className="h-4 w-4" />
              <span className="font-medium">{components.length}</span>
              <span>components</span>
            </div>
          </div>
        </div>

        {/* Components List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
              <p className="mt-3 text-sm text-slate-600">Loading components...</p>
            </div>
          </div>
        ) : components.length === 0 ? (
          <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
            <Package className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No components found</h3>
            <p className="mt-2 text-sm text-slate-600">
              {searchQuery || filterType ? 'Try adjusting your filters' : 'Get started by adding your first component'}
            </p>
            {!searchQuery && !filterType && (
              <Button onClick={handleAdd} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Add Component
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedComponents).map(([type, comps]) => (
              <div key={type} className="rounded-xl border bg-white shadow-sm">
                <div className="border-b bg-slate-50 px-6 py-3">
                  <h3 className="font-semibold text-slate-900">
                    {COMPONENT_TYPE_LABELS[type] || type}
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      ({comps.length})
                    </span>
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-slate-50/50 text-left text-xs font-medium text-slate-600">
                        <th className="px-6 py-3">Code</th>
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Description</th>
                        <th className="px-6 py-3">Unit</th>
                        <th className="px-6 py-3 text-right">Base Price</th>
                        <th className="px-6 py-3">Lead Time</th>
                        <th className="px-6 py-3">Supplier</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {comps.map((component) => (
                        <tr 
                          key={component.id} 
                          onClick={() => router.push(`/settings/components/${component.id}`)}
                          className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-700">
                              {component.code}
                            </code>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-900">{component.name}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {component.description ? (
                              <span className="line-clamp-2">{component.description}</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{component.unitOfMeasure}</td>
                          <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                            £{component.basePrice.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {component.leadTimeDays} days
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {component.supplier?.name || <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-6 py-4">
                            {component.isActive ? (
                              <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(component);
                                }}
                                className="rounded p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                                title="Edit"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(component.id);
                                }}
                                className="rounded p-1.5 text-slate-600 hover:bg-red-50 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingComponent ? 'Edit Component' : 'Add Component'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Code */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="e.g., HNG-BT-SS"
                    required
                  />
                </div>

                {/* Component Type */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Component Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.componentType}
                    onChange={(e) => setFormData({ ...formData, componentType: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  >
                    <option value="">Select type...</option>
                    {Object.entries(COMPONENT_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Name */}
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="e.g., Butt Hinge - Stainless Steel"
                    required
                  />
                </div>

                {/* Description */}
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    rows={2}
                    placeholder="Detailed description..."
                  />
                </div>

                {/* Product Types */}
                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Product Types
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['FIRE_DOOR', 'FIRE_DOOR_SET', 'WINDOW', 'CONSERVATORY', 'BIFOLD_DOOR'].map(type => (
                      <label key={type} className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.productTypes.includes(type)}
                          onChange={() => toggleProductType(type)}
                          className="mr-2 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                        />
                        <span className="text-sm text-slate-700">{type.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Unit of Measure */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Unit of Measure
                  </label>
                  <select
                    value={formData.unitOfMeasure}
                    onChange={(e) => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {UNIT_OPTIONS.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                {/* Base Price */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Base Price (£)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.basePrice}
                    onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Lead Time */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Lead Time (Days)
                  </label>
                  <input
                    type="number"
                    value={formData.leadTimeDays}
                    onChange={(e) => setFormData({ ...formData, leadTimeDays: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Supplier */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Supplier
                  </label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">None</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                </div>

                {/* Active Status */}
                <div className="col-span-2">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="mr-2 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                    />
                    <span className="text-sm font-medium text-slate-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  onClick={() => setShowModal(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button type="submit">
                  <Save className="mr-2 h-4 w-4" />
                  {editingComponent ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
