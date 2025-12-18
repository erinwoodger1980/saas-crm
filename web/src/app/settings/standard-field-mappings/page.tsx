'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Trash2, Save, X, Search, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';

interface ProductType {
  id: string;
  code: string;
  name: string;
}

interface StandardFieldMapping {
  id: string;
  tenantId: string;
  productTypeId: string;
  standardField: string;
  questionCode: string | null;
  attributeCode: string | null;
  transformExpression: string | null;
  isActive: boolean;
  metadata: any;
  createdAt: string;
  updatedAt: string;
  productType: ProductType;
}

const STANDARD_FIELDS = [
  { value: 'widthMm', label: 'Width (mm)' },
  { value: 'heightMm', label: 'Height (mm)' },
  { value: 'timber', label: 'Timber Type' },
  { value: 'finish', label: 'Finish' },
  { value: 'ironmongery', label: 'Ironmongery' },
  { value: 'glazing', label: 'Glazing' },
  { value: 'description', label: 'Description' },
  { value: 'photoInsideFileId', label: 'Photo Inside' },
  { value: 'photoOutsideFileId', label: 'Photo Outside' },
];

interface FormData {
  productTypeId: string;
  standardField: string;
  questionCode: string;
  attributeCode: string;
  transformExpression: string;
  isActive: boolean;
}

const emptyFormData: FormData = {
  productTypeId: '',
  standardField: '',
  questionCode: '',
  attributeCode: '',
  transformExpression: '',
  isActive: true,
};

export default function StandardFieldMappingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mappings, setMappings] = useState<StandardFieldMapping[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState<StandardFieldMapping | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProductType, setFilterProductType] = useState<string>('');

  useEffect(() => {
    loadMappings();
    loadProductTypes();
  }, []);

  const loadMappings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterProductType) params.append('productTypeId', filterProductType);
      if (searchQuery) params.append('search', searchQuery);

      const data = await apiFetch<StandardFieldMapping[]>(`/standard-field-mappings?${params.toString()}`);
      setMappings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading mappings:', error);
      setMappings([]);
      toast({
        title: 'Error',
        description: 'Failed to load mappings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProductTypes = async () => {
    try {
      const data = await apiFetch<{ productTypes?: Array<{ id: string; name: string; types: any[] }> }>('/tenant/settings');
      const types: ProductType[] = [];
      if (data.productTypes && Array.isArray(data.productTypes)) {
        data.productTypes.forEach(category => {
          if (category.types && Array.isArray(category.types)) {
            category.types.forEach(type => {
              if (type.options && Array.isArray(type.options)) {
                type.options.forEach((option: any) => {
                  types.push({ id: option.id, code: option.id, name: option.label });
                });
              }
            });
          }
        });
      }
      setProductTypes(types);
    } catch (error) {
      console.error('Error loading product types:', error);
      setProductTypes([]);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadMappings();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, filterProductType]);

  const handleAdd = () => {
    setEditingMapping(null);
    setFormData(emptyFormData);
    setShowModal(true);
  };

  const handleEdit = (mapping: StandardFieldMapping) => {
    setEditingMapping(mapping);
    setFormData({
      productTypeId: mapping.productTypeId,
      standardField: mapping.standardField,
      questionCode: mapping.questionCode || '',
      attributeCode: mapping.attributeCode || '',
      transformExpression: mapping.transformExpression || '',
      isActive: mapping.isActive,
    });
    setShowModal(true);
  };

  const handleDelete = async (mapping: StandardFieldMapping) => {
    if (!confirm(`Are you sure you want to delete this mapping?`)) return;

    try {
      await apiFetch(`/standard-field-mappings/${mapping.id}`, {
        method: 'DELETE'
      });

      toast({
        title: 'Success',
        description: 'Mapping deleted successfully'
      });

      loadMappings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete mapping',
        variant: 'destructive'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.productTypeId || !formData.standardField) {
      toast({
        title: 'Validation Error',
        description: 'Product type and standard field are required',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.questionCode && !formData.attributeCode) {
      toast({
        title: 'Validation Error',
        description: 'Either question code or attribute code must be specified',
        variant: 'destructive'
      });
      return;
    }

    try {
      const payload = {
        productTypeId: formData.productTypeId,
        standardField: formData.standardField,
        questionCode: formData.questionCode || null,
        attributeCode: formData.attributeCode || null,
        transformExpression: formData.transformExpression || null,
        isActive: formData.isActive,
      };

      if (editingMapping) {
        await apiFetch(`/standard-field-mappings/${editingMapping.id}`, {
          method: 'PATCH',
          json: payload
        });

        toast({
          title: 'Success',
          description: 'Mapping updated successfully'
        });
      } else {
        await apiFetch('/standard-field-mappings', {
          method: 'POST',
          json: payload
        });

        toast({
          title: 'Success',
          description: 'Mapping created successfully'
        });
      }

      setShowModal(false);
      loadMappings();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save mapping',
        variant: 'destructive'
      });
    }
  };

  const groupedMappings = mappings.reduce((acc, mapping) => {
    if (!acc[mapping.productTypeId]) {
      acc[mapping.productTypeId] = [];
    }
    acc[mapping.productTypeId].push(mapping);
    return {};
  }, {} as Record<string, StandardFieldMapping[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Standard Field Mappings</h1>
            <p className="mt-2 text-sm text-slate-600">
              Configure how product type questions/attributes map to standard line-item fields
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Mapping
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search mappings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <select
              value={filterProductType}
              onChange={(e) => setFilterProductType(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Product Types</option>
              {productTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 text-sm text-slate-600">
              <LinkIcon className="h-4 w-4" />
              <span className="font-medium">{mappings.length}</span>
              <span>mappings</span>
            </div>
          </div>
        </div>

        {/* Mappings List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
              <p className="mt-3 text-sm text-slate-600">Loading mappings...</p>
            </div>
          </div>
        ) : mappings.length === 0 ? (
          <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
            <LinkIcon className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No mappings found</h3>
            <p className="mt-2 text-sm text-slate-600">
              {searchQuery || filterProductType ? 'Try adjusting your filters' : 'Get started by adding your first mapping'}
            </p>
            {!searchQuery && !filterProductType && (
              <Button onClick={handleAdd} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Add Mapping
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs font-medium text-slate-600">
                    <th className="px-6 py-3">Product Type</th>
                    <th className="px-6 py-3">Standard Field</th>
                    <th className="px-6 py-3">Question Code</th>
                    <th className="px-6 py-3">Attribute Code</th>
                    <th className="px-6 py-3">Transform</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mappings.map((mapping) => (
                    <tr key={mapping.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {mapping.productType.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {STANDARD_FIELDS.find(f => f.value === mapping.standardField)?.label || mapping.standardField}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {mapping.questionCode ? (
                          <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-700">
                            {mapping.questionCode}
                          </code>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {mapping.attributeCode ? (
                          <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-700">
                            {mapping.attributeCode}
                          </code>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-600">
                        {mapping.transformExpression || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        {mapping.isActive ? (
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
                            onClick={() => handleEdit(mapping)}
                            className="rounded p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(mapping)}
                            className="rounded p-1.5 text-slate-600 hover:bg-red-50 hover:text-red-600"
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
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingMapping ? 'Edit Mapping' : 'Add Mapping'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                {/* Product Type */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Product Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.productTypeId}
                    onChange={(e) => setFormData({ ...formData, productTypeId: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                    disabled={!!editingMapping}
                  >
                    <option value="">Select product type...</option>
                    {productTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                  {editingMapping && (
                    <p className="mt-1 text-xs text-slate-500">Product type cannot be changed after creation</p>
                  )}
                </div>

                {/* Standard Field */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Standard Field <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.standardField}
                    onChange={(e) => setFormData({ ...formData, standardField: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                    disabled={!!editingMapping}
                  >
                    <option value="">Select field...</option>
                    {STANDARD_FIELDS.map(field => (
                      <option key={field.value} value={field.value}>{field.label}</option>
                    ))}
                  </select>
                  {editingMapping && (
                    <p className="mt-1 text-xs text-slate-500">Standard field cannot be changed after creation</p>
                  )}
                </div>

                {/* Question Code */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Question Code
                  </label>
                  <input
                    type="text"
                    value={formData.questionCode}
                    onChange={(e) => setFormData({ ...formData, questionCode: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="e.g., DOOR_WIDTH"
                  />
                  <p className="mt-1 text-xs text-slate-500">Reference to Question.attributeCode for override source</p>
                </div>

                {/* Attribute Code */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Attribute Code
                  </label>
                  <input
                    type="text"
                    value={formData.attributeCode}
                    onChange={(e) => setFormData({ ...formData, attributeCode: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="e.g., ATTR_WIDTH"
                  />
                  <p className="mt-1 text-xs text-slate-500">Alternative: reference to Attribute.code for override source</p>
                </div>

                {/* Transform Expression */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Transform Expression
                  </label>
                  <textarea
                    value={formData.transformExpression}
                    onChange={(e) => setFormData({ ...formData, transformExpression: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    rows={2}
                    placeholder="e.g., value * 1000 or value.toUpperCase()"
                  />
                  <p className="mt-1 text-xs text-slate-500">Optional JavaScript expression to transform value before applying</p>
                </div>

                {/* Active Status */}
                <div>
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
                <Button type="button" onClick={() => setShowModal(false)} variant="outline">
                  Cancel
                </Button>
                <Button type="submit">
                  <Save className="mr-2 h-4 w-4" />
                  {editingMapping ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
