'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Trash2, Save, X, Search, Filter, Upload, Download, Package, ChevronDown, Layers, Tag, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import ComponentAttributeModal from '@/components/ComponentAttributeModal';
import ComponentVariantModal from '@/components/ComponentVariantModal';

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

// Optional labels for known types; users can add new types dynamically
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
  const router = useRouter();
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
  const [typeLabels, setTypeLabels] = useState<Record<string, string>>({});
  const [manageTypesOpen, setManageTypesOpen] = useState(false);
  const [productTypeOptions, setProductTypeOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [productTypesDropdownOpen, setProductTypesDropdownOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'details' | 'variants' | 'attributes' | 'processes'>('details');
  const [variants, setVariants] = useState<any[]>([]);
  const [attributes, setAttributes] = useState<any[]>([]);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<any>(null);
  const [editingAttribute, setEditingAttribute] = useState<any>(null);

  useEffect(() => {
    loadComponents();
    loadSuppliers();
    loadComponentTypes();
    loadProductTypes();
    loadComponentTypeLabels();
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
      
      // Normalize data shape - handle array, object with items, or fallback to empty
      const items = Array.isArray(data) 
        ? data 
        : Array.isArray((data as any)?.items) 
        ? (data as any).items 
        : [];
      
      // Ensure each component has valid productTypes array
      const safeComponents = items.map((c: Component) => ({
        ...c,
        productTypes: Array.isArray(c.productTypes) ? c.productTypes : []
      }));
      
      setComponents(safeComponents);
    } catch (error) {
      console.error('Error loading components:', error);
      // Don't crash - set empty array and show toast
      setComponents([]);
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
      const data = await apiFetch<{ ok?: boolean; items?: Supplier[] } | Supplier[]>('/suppliers');
      // Handle both { ok: true, items: [...] } and direct array responses
      const items = Array.isArray(data) 
        ? data 
        : (data as any)?.items && Array.isArray((data as any).items)
        ? (data as any).items
        : [];
      setSuppliers(items);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      setSuppliers([]);
    }
  };

  const loadProductTypes = async () => {
    try {
      const data = await apiFetch<{ productTypes?: Array<{ id: string; label: string; types: any[] }> }>('/tenant/settings');
      if (data.productTypes && Array.isArray(data.productTypes)) {
        // Flatten all product types from all categories
        const allTypes: Array<{ id: string; label: string }> = [];
        data.productTypes.forEach(category => {
          if (category.types && Array.isArray(category.types)) {
            category.types.forEach(type => {
              if (type.options && Array.isArray(type.options)) {
                type.options.forEach((option: any) => {
                  allTypes.push({ id: option.id, label: option.label });
                });
              }
            });
          }
        });
        setProductTypeOptions(allTypes);
      }
    } catch (error) {
      console.error('Error loading product types:', error);
      // Fallback to default types if loading fails
      setProductTypeOptions([
        { id: 'FIRE_DOOR', label: 'Fire Door' },
        { id: 'FIRE_DOOR_SET', label: 'Fire Door Set' },
        { id: 'WINDOW', label: 'Window' },
        { id: 'CONSERVATORY', label: 'Conservatory' },
        { id: 'BIFOLD_DOOR', label: 'Bifold Door' }
      ]);
    }
  };

  const loadComponentTypes = async () => {
    try {
      const types = await apiFetch<string[]>('/components/types/all');
      const items = Array.isArray(types) ? types : [];
      setComponentTypes(items);
    } catch (error) {
      console.error('Error loading component types:', error);
      setComponentTypes([]);
    }
  };

  const loadComponentTypeLabels = async () => {
    try {
      const data = await apiFetch<Record<string, string>>('/components/type-labels');
      setTypeLabels(data || {});
    } catch (error) {
      console.error('Error loading component type labels:', error);
      setTypeLabels({});
    }
  };

  const resolvedTypeLabel = (code: string) => typeLabels[code] || COMPONENT_TYPE_LABELS[code] || code;
  
  const persistTypeLabels = async (next: Record<string, string>) => {
    setTypeLabels(next);
    try {
      await apiFetch('/components/type-labels', {
        method: 'PATCH',
        json: { labels: next }
      });
    } catch (error) {
      console.error('Error persisting component type labels:', error);
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
    setModalTab('details');
    setShowModal(true);
  };

  const handleViewDetails = async (component: Component) => {
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
    setModalTab('details');
    setShowModal(true);
    
    // Load variants and attributes in parallel
    try {
      const [variantsData, attributesData] = await Promise.all([
        apiFetch<any[]>(`/component-variants?componentLookupId=${component.id}`),
        apiFetch<any[]>(`/component-attributes?componentType=${component.componentType}`)
      ]);
      setVariants(variantsData);
      setAttributes(attributesData);
    } catch (error) {
      console.error('Error loading component details:', error);
    }
  };

  const handleVariantSaved = () => {
    if (editingComponent) {
      apiFetch<any[]>(`/component-variants?componentLookupId=${editingComponent.id}`)
        .then(setVariants)
        .catch(console.error);
    }
    setShowVariantModal(false);
    setEditingVariant(null);
  };

  const handleAttributeSaved = () => {
    if (editingComponent) {
      apiFetch<any[]>(`/component-attributes?componentType=${editingComponent.componentType}`)
        .then(setAttributes)
        .catch(console.error);
    }
    setShowAttributeModal(false);
    setEditingAttribute(null);
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
              Manage components for all your product types. Click any component row to create variants, define attributes, and manage processes.
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
                  {resolvedTypeLabel(type)}
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

        {/* Manage Types */}
        <div className="mb-3 flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setManageTypesOpen(v => !v)}>
            {manageTypesOpen ? 'Close Types' : 'Manage Type Labels'}
          </Button>
        </div>
        {manageTypesOpen && (
          <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold mb-3">Component Type Labels</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {componentTypes.map((code) => (
                <div key={code} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-48">{code}</span>
                  <input
                    type="text"
                    value={typeLabels[code] ?? ''}
                    onChange={(e) => {
                      const next = { ...typeLabels, [code]: e.target.value };
                      persistTypeLabels(next);
                    }}
                    placeholder={`Label for ${code}`}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

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
                          onClick={() => handleViewDetails(component)}
                          className="cursor-pointer hover:bg-blue-50/30 transition-colors group"
                          title="Click to view variants, attributes, and processes"
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
                                  handleViewDetails(component);
                                }}
                                className="rounded px-2 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200"
                                title="View variants, attributes, and processes"
                              >
                                View Details
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(component);
                                }}
                                className="rounded p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                                title="Quick edit basic details"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(component);
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
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingComponent ? formData.name : 'Add Component'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setModalTab('details');
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tab Navigation */}
            {editingComponent && (
              <div className="flex gap-1 border-b px-6 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setModalTab('details')}
                  className={`px-4 py-3 text-sm font-medium transition-colors ${
                    modalTab === 'details'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Package className="inline-block h-4 w-4 mr-2" />
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('variants')}
                  className={`px-4 py-3 text-sm font-medium transition-colors ${
                    modalTab === 'variants'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="inline-block h-4 w-4 mr-2" />
                  Variants ({variants.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('attributes')}
                  className={`px-4 py-3 text-sm font-medium transition-colors ${
                    modalTab === 'attributes'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Tag className="inline-block h-4 w-4 mr-2" />
                  Attributes ({attributes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('processes')}
                  className={`px-4 py-3 text-sm font-medium transition-colors ${
                    modalTab === 'processes'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock className="inline-block h-4 w-4 mr-2" />
                  Processes
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {modalTab === 'details' && (
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
                  <div className="flex gap-2">
                    <select
                      value={formData.componentType}
                      onChange={(e) => setFormData({ ...formData, componentType: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      required
                    >
                      <option value="">Select type...</option>
                      {componentTypes.map((t) => (
                        <option key={t} value={t}>{resolvedTypeLabel(t)}</option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const val = window.prompt('Enter new component type code (e.g., HINGE, LOCK, CUSTOM_PART):');
                        if (!val) return;
                        const code = val.trim().toUpperCase();
                        if (!code) return;
                        if (!componentTypes.includes(code)) {
                          setComponentTypes((prev) => [...prev, code].sort());
                        }
                        setFormData((prev) => ({ ...prev, componentType: code }));
                      }}
                    >
                      Add Type
                    </Button>
                  </div>
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
                <div className="col-span-2 relative">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Product Types
                  </label>
                  <button
                    type="button"
                    onClick={() => setProductTypesDropdownOpen(!productTypesDropdownOpen)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {formData.productTypes.length === 0 ? (
                      <span className="text-slate-400">Select product types...</span>
                    ) : (
                      <span className="text-slate-700">
                        {formData.productTypes.length} selected
                        {formData.productTypes.length <= 3 && (
                          <span className="text-slate-500 ml-1">
                            ({formData.productTypes.map(id => productTypeOptions.find(opt => opt.id === id)?.label).filter(Boolean).join(', ')})
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                  {productTypesDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-64 overflow-y-auto">
                      {productTypeOptions.length > 0 ? (
                        <div className="p-2 space-y-1">
                          {productTypeOptions.map(type => (
                            <label
                              key={type.id}
                              className="flex items-center px-3 py-2 hover:bg-slate-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={formData.productTypes.includes(type.id)}
                                onChange={() => toggleProductType(type.id)}
                                className="mr-2 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                              />
                              <span className="text-sm text-slate-700">{type.label}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-sm text-slate-500">Loading product types...</div>
                      )}
                    </div>
                  )}
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
                  onClick={() => {
                    setShowModal(false);
                    setModalTab('details');
                  }}
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
              )}

              {/* Variants Tab */}
              {modalTab === 'variants' && editingComponent && (
                <div className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Component Variants</h3>
                      <p className="text-sm text-slate-600">
                        Define specific variations of this component with different attributes and pricing
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        setEditingVariant(null);
                        setShowVariantModal(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Variant
                    </Button>
                  </div>

                  {variants.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-lg">
                      <Layers className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm text-slate-600 mb-4">No variants yet</p>
                      <Button
                        onClick={() => {
                          setEditingVariant(null);
                          setShowVariantModal(true);
                        }}
                        size="sm"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create First Variant
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {variants.map((variant) => (
                        <div
                          key={variant.id}
                          className="flex items-start justify-between rounded-lg border border-slate-200 p-4 hover:border-blue-300 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-700">
                                {variant.variantCode}
                              </code>
                              <span className="font-medium text-slate-900">{variant.variantName}</span>
                              {variant.isStocked && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                  Stocked
                                </span>
                              )}
                              {!variant.isActive && (
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                  Inactive
                                </span>
                              )}
                            </div>
                            {Object.keys(variant.attributeValues || {}).length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {Object.entries(variant.attributeValues).map(([key, value]) => (
                                  <span key={key} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                    {key}: {String(value)}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-sm text-slate-600">
                              <span className="font-medium text-slate-900">
                                £{(variant.unitPrice || ((editingComponent.basePrice || 0) + variant.priceModifier)).toFixed(2)}
                              </span>
                              {variant.supplier && (
                                <span>Supplier: {variant.supplier.name}</span>
                              )}
                              {variant.leadTimeDays && (
                                <span>Lead: {variant.leadTimeDays}d</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingVariant(variant);
                                setShowVariantModal(true);
                              }}
                              className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Attributes Tab */}
              {modalTab === 'attributes' && editingComponent && (
                <div className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Component Attributes</h3>
                      <p className="text-sm text-slate-600">
                        Define attributes that can vary across component variants
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        setEditingAttribute(null);
                        setShowAttributeModal(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Attribute
                    </Button>
                  </div>

                  {attributes.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-lg">
                      <Tag className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm text-slate-600 mb-4">No attributes defined yet</p>
                      <Button
                        onClick={() => {
                          setEditingAttribute(null);
                          setShowAttributeModal(true);
                        }}
                        size="sm"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create First Attribute
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {attributes.map((attr) => (
                        <div
                          key={attr.id}
                          className="flex items-start justify-between rounded-lg border border-slate-200 p-4"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-slate-900">{attr.attributeName}</span>
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                {attr.attributeType}
                              </span>
                              {attr.isRequired && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                                  Required
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                              {attr.affectsPrice && (
                                <span className="bg-green-50 text-green-700 px-2 py-1 rounded">Affects Price</span>
                              )}
                              {attr.affectsBOM && (
                                <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded">Affects BOM</span>
                              )}
                              {attr.calculationFormula && (
                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">Calculated</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setEditingAttribute(attr);
                              setShowAttributeModal(true);
                            }}
                            className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Processes Tab */}
              {modalTab === 'processes' && editingComponent && (
                <div className="p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Process & Timing</h3>
                    <p className="text-sm text-slate-600">
                      Define manufacturing processes and lead times for this component
                    </p>
                  </div>
                  <div className="text-center py-12 bg-slate-50 rounded-lg">
                    <Clock className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-sm text-slate-600">Process management coming soon</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Variant Modal */}
      {showVariantModal && editingComponent && (
        <ComponentVariantModal
          isOpen={showVariantModal}
          component={editingComponent}
          variant={editingVariant}
          attributes={attributes}
          suppliers={suppliers}
          onClose={() => {
            setShowVariantModal(false);
            setEditingVariant(null);
          }}
          onSave={handleVariantSaved}
        />
      )}

      {/* Attribute Modal */}
      {showAttributeModal && editingComponent && (
        <ComponentAttributeModal
          isOpen={showAttributeModal}
          componentType={editingComponent.componentType}
          attribute={editingAttribute}
          onClose={() => {
            setShowAttributeModal(false);
            setEditingAttribute(null);
          }}
          onSave={handleAttributeSaved}
        />
      )}
    </div>
  );
}
