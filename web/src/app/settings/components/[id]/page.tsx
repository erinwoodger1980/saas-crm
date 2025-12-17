'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Edit2, Trash2, Package, DollarSign, Tag, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';

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
  supplier: {
    id: string;
    name: string;
  } | null;
}

interface ComponentVariant {
  id: string;
  variantCode: string;
  variantName: string;
  attributeValues: Record<string, any>;
  dimensionFormulas: Record<string, any> | null;
  priceModifier: number;
  unitPrice: number | null;
  supplierId: string | null;
  supplierSKU: string | null;
  leadTimeDays: number | null;
  isActive: boolean;
  isStocked: boolean;
  stockLevel: number | null;
  supplier: {
    id: string;
    name: string;
  } | null;
}

interface ComponentAttribute {
  id: string;
  componentType: string;
  attributeName: string;
  attributeType: string;
  displayOrder: number;
  isRequired: boolean;
  options: any;
  calculationFormula: string | null;
  calculationUnit: string | null;
  affectsPrice: boolean;
  affectsBOM: boolean;
}

export default function ComponentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [component, setComponent] = useState<Component | null>(null);
  const [variants, setVariants] = useState<ComponentVariant[]>([]);
  const [attributes, setAttributes] = useState<ComponentAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'variants' | 'attributes'>('overview');

  useEffect(() => {
    loadComponent();
    loadVariants();
    loadAttributes();
  }, [params.id]);

  const loadComponent = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<Component>(`/components/${params.id}`);
      setComponent(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load component',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadVariants = async () => {
    try {
      const data = await apiFetch<ComponentVariant[]>(`/component-variants?componentLookupId=${params.id}`);
      setVariants(data);
    } catch (error) {
      console.error('Error loading variants:', error);
    }
  };

  const loadAttributes = async () => {
    try {
      if (!component) return;
      const data = await apiFetch<ComponentAttribute[]>(`/component-attributes?componentType=${component.componentType}`);
      setAttributes(data);
    } catch (error) {
      console.error('Error loading attributes:', error);
    }
  };

  useEffect(() => {
    if (component) {
      loadAttributes();
    }
  }, [component]);

  const formatAttributeValue = (value: any, attribute: ComponentAttribute): string => {
    if (attribute.attributeType === 'SELECT' && attribute.options) {
      const options = JSON.parse(attribute.options);
      const option = options.find((o: any) => o.value === value);
      return option?.label || value;
    }
    return String(value);
  };

  const calculateFinalPrice = (variant: ComponentVariant): number => {
    if (variant.unitPrice !== null) {
      return variant.unitPrice;
    }
    return (component?.basePrice || 0) + variant.priceModifier;
  };

  if (loading || !component) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-3 text-sm text-slate-600">Loading component...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Components
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900">{component.name}</h1>
                  <p className="mt-1 text-sm text-slate-600">
                    <code className="rounded bg-slate-100 px-2 py-1 font-mono text-xs">{component.code}</code>
                    <span className="mx-2">•</span>
                    {component.componentType.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={() => router.push(`/settings/components`)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit Component
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-slate-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('variants')}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === 'variants'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Variants ({variants.length})
            </button>
            <button
              onClick={() => setActiveTab('attributes')}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === 'attributes'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Attributes ({attributes.length})
            </button>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm text-slate-600">Base Price</p>
                    <p className="text-2xl font-bold text-slate-900">£{component.basePrice.toFixed(2)}</p>
                    <p className="text-xs text-slate-500">per {component.unitOfMeasure}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <Tag className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-slate-600">Lead Time</p>
                    <p className="text-2xl font-bold text-slate-900">{component.leadTimeDays}</p>
                    <p className="text-xs text-slate-500">days</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <Layers className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm text-slate-600">Variants</p>
                    <p className="text-2xl font-bold text-slate-900">{variants.length}</p>
                    <p className="text-xs text-slate-500">
                      {variants.filter(v => v.isActive).length} active
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {component.description && (
              <div className="rounded-xl border bg-white p-6 shadow-sm">
                <h3 className="mb-2 font-semibold text-slate-900">Description</h3>
                <p className="text-sm text-slate-600">{component.description}</p>
              </div>
            )}

            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-slate-900">Details</h3>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-slate-600">Component Type</dt>
                  <dd className="mt-1 font-medium text-slate-900">{component.componentType.replace(/_/g, ' ')}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-600">Unit of Measure</dt>
                  <dd className="mt-1 font-medium text-slate-900">{component.unitOfMeasure}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-600">Supplier</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {component.supplier?.name || <span className="text-slate-400">None</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-600">Status</dt>
                  <dd className="mt-1">
                    {component.isActive ? (
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        Inactive
                      </span>
                    )}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-sm text-slate-600">Product Types</dt>
                  <dd className="mt-1 flex flex-wrap gap-2">
                    {component.productTypes.length > 0 ? (
                      component.productTypes.map(type => (
                        <span key={type} className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                          {type.replace(/_/g, ' ')}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">None</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Variants Tab */}
        {activeTab === 'variants' && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <p className="text-sm text-slate-600">
                {variants.length} variant{variants.length !== 1 ? 's' : ''} available
              </p>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Variant
              </Button>
            </div>

            {variants.length === 0 ? (
              <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
                <Layers className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No variants yet</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Create variants to define specific configurations like timber types, dimensions, and pricing
                </p>
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Variant
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-slate-50/50 text-left text-xs font-medium text-slate-600">
                        <th className="px-6 py-3">Variant Code</th>
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Attributes</th>
                        <th className="px-6 py-3 text-right">Price</th>
                        <th className="px-6 py-3">Supplier SKU</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {variants.map((variant) => (
                        <tr key={variant.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4">
                            <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-700">
                              {variant.variantCode}
                            </code>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-900">{variant.variantName}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(variant.attributeValues).map(([key, value]) => {
                                const attr = attributes.find(a => a.attributeName === key);
                                return (
                                  <span key={key} className="inline-flex rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                    {key}: {attr ? formatAttributeValue(value, attr) : String(value)}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="text-sm font-medium text-slate-900">
                              £{calculateFinalPrice(variant).toFixed(2)}
                            </div>
                            {variant.priceModifier !== 0 && (
                              <div className="text-xs text-slate-500">
                                ({variant.priceModifier > 0 ? '+' : ''}£{variant.priceModifier.toFixed(2)})
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {variant.supplierSKU || <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-6 py-4">
                            {variant.isActive ? (
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
                              <button className="rounded p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-600">
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button className="rounded p-1.5 text-slate-600 hover:bg-red-50 hover:text-red-600">
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
        )}

        {/* Attributes Tab */}
        {activeTab === 'attributes' && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <p className="text-sm text-slate-600">
                {attributes.length} attribute{attributes.length !== 1 ? 's' : ''} defined for {component.componentType.replace(/_/g, ' ')}
              </p>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Attribute
              </Button>
            </div>

            {attributes.length === 0 ? (
              <div className="rounded-xl border bg-white p-12 text-center shadow-sm">
                <Tag className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No attributes defined</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Define attributes like timber types, dimensions, finishes to create component variants
                </p>
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Define First Attribute
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {attributes.map((attr) => (
                  <div key={attr.id} className="rounded-xl border bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{attr.attributeName}</h3>
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {attr.attributeType}
                          </span>
                          {attr.isRequired && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                              Required
                            </span>
                          )}
                          {attr.affectsPrice && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              Affects Price
                            </span>
                          )}
                        </div>

                        {attr.attributeType === 'SELECT' && attr.options && (
                          <div className="mt-3">
                            <p className="text-xs text-slate-600">Options:</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {JSON.parse(attr.options).map((option: any, idx: number) => (
                                <span key={idx} className="inline-flex rounded-lg border bg-slate-50 px-3 py-1.5 text-sm">
                                  <span className="font-medium">{option.label}</span>
                                  {option.priceModifier && (
                                    <span className="ml-2 text-slate-600">
                                      ({option.priceModifier > 0 ? '+' : ''}£{option.priceModifier.toFixed(2)})
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {attr.attributeType === 'CALCULATED' && attr.calculationFormula && (
                          <div className="mt-3">
                            <p className="text-xs text-slate-600">Formula:</p>
                            <code className="mt-1 block rounded bg-slate-100 px-3 py-2 text-xs font-mono text-slate-800">
                              {attr.calculationFormula}
                            </code>
                            {attr.calculationUnit && (
                              <p className="mt-1 text-xs text-slate-500">Unit: {attr.calculationUnit}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button className="rounded p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-600">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button className="rounded p-1.5 text-slate-600 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
