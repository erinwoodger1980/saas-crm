'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, AlertCircle, Upload } from 'lucide-react';
import { LineItemData } from '../PublicEstimatorWizard';

type ProductOption = {
  id: string;
  label: string;
};

type ProductType = {
  type: string;
  label: string;
  options: ProductOption[];
};

type ProductCategory = {
  id: string;
  label: string;
  types: ProductType[];
};

interface LineItemsStepProps {
  projectType: string;
  items: LineItemData[];
  productTypes?: ProductCategory[];
  onNext: (items: LineItemData[]) => void;
  onBack: () => void;
}

export default function LineItemsStep({ projectType, items, productTypes, onNext, onBack }: LineItemsStepProps) {
  const hasTenantProductTypes = Array.isArray(productTypes) && productTypes.length > 0;

  const eligibleTenantCategories = useMemo(() => {
    const cats = Array.isArray(productTypes) ? productTypes : [];
    if (!hasTenantProductTypes) return [];

    const wantDoors = projectType === 'doors';
    const wantWindows = projectType === 'windows';
    if (!wantDoors && !wantWindows) return cats;

    const targetId = wantDoors ? 'doors' : 'windows';
    const filtered = cats.filter((c) => c?.id === targetId);
    return filtered.length ? filtered : cats;
  }, [hasTenantProductTypes, productTypes, projectType]);

  const tenantTypeOptions = useMemo(() => {
    if (!hasTenantProductTypes) return [] as Array<{ value: string; label: string }>;

    const out: Array<{ value: string; label: string }> = [];
    eligibleTenantCategories.forEach((cat) => {
      (Array.isArray(cat.types) ? cat.types : []).forEach((t) => {
        const value = `${cat.id}-${t.type}`;
        const label = `${cat.label} · ${t.label}`;
        out.push({ value, label });
      });
    });
    return out;
  }, [eligibleTenantCategories, hasTenantProductTypes]);

  const defaultTenantTypeValue = useMemo(() => {
    if (!hasTenantProductTypes) return undefined;
    const first = tenantTypeOptions[0];
    return first?.value;
  }, [hasTenantProductTypes, tenantTypeOptions]);

  const [lineItems, setLineItems] = useState<LineItemData[]>(
    items.length > 0 ? items : [generateNewItem()]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function generateNewItem(): LineItemData {
    return {
      id: Math.random().toString(36).substr(2, 9),
      description: '',
      quantity: 1,
      productType: hasTenantProductTypes
        ? defaultTenantTypeValue
        : projectType === 'doors'
          ? 'doors'
          : projectType === 'windows'
            ? 'windows'
            : undefined,
    };
  }

  // If tenant product types load after mount, set a sensible default for any blank items.
  useEffect(() => {
    if (!hasTenantProductTypes) return;
    if (!defaultTenantTypeValue) return;

    setLineItems((prev) => {
      let changed = false;
      const next = prev.map((it) => {
        if (it.productType) return it;
        changed = true;
        return { ...it, productType: defaultTenantTypeValue };
      });
      return changed ? next : prev;
    });
  }, [defaultTenantTypeValue, hasTenantProductTypes]);

  const validateItems = (): boolean => {
    const newErrors: Record<string, string> = {};

    lineItems.forEach((item, idx) => {
      if (!item.description.trim()) {
        newErrors[`desc_${idx}`] = 'Description is required';
      }
      if (!item.productType) {
        newErrors[`type_${idx}`] = 'Product type is required';
      }
      if (item.widthMm && (item.widthMm < 400 || item.widthMm > 4000)) {
        newErrors[`width_${idx}`] = 'Width must be between 400-4000mm';
      }
      if (item.heightMm && (item.heightMm < 400 || item.heightMm > 3000)) {
        newErrors[`height_${idx}`] = 'Height must be between 400-3000mm';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddItem = useCallback(() => {
    setLineItems(prev => [...prev, generateNewItem()]);
  }, []);

  const handleRemoveItem = useCallback((id: string) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const handleItemChange = useCallback(
    (id: string, field: keyof LineItemData, value: any) => {
      setLineItems(prev =>
        prev.map(item =>
          item.id === id ? { ...item, [field]: value } : item
        )
      );
    },
    []
  );

  const handlePhotoUpload = useCallback((id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const photoUrl = e.target?.result as string;
      handleItemChange(id, 'photoUrl', photoUrl);

      // In production, this would analyze the photo to extract dimensions
      // For now, show a toast or message that dimensions can be extracted
      console.log('[LineItemsStep] Photo uploaded for item:', id);
    };
    reader.readAsDataURL(file);
  }, [handleItemChange]);

  const handleSubmit = () => {
    if (validateItems() && lineItems.length > 0) {
      onNext(lineItems);
    }
  };

  const canAddMore = lineItems.length < 20; // Reasonable limit

  return (
    <div className="space-y-6">
      <div>
        <p className="text-gray-600 mb-2">
          Add the items you need. For each item, provide details including dimensions and material preferences.
        </p>
        <p className="text-sm text-gray-500">
          Tip: Upload a photo of the opening to help us calculate dimensions accurately.
        </p>
      </div>

      {lineItems.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Add at least one item to continue</AlertDescription>
        </Alert>
      )}

      {/* Line Items */}
      <div className="space-y-4">
        {lineItems.map((item, idx) => (
          <Card key={item.id} className="p-4 border">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-semibold text-lg">Item {idx + 1}</h3>
              <Button
                onClick={() => handleRemoveItem(item.id)}
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Description */}
              <div>
                <Label htmlFor={`desc_${idx}`} className="font-semibold mb-2 block">
                  Description *
                </Label>
                <Textarea
                  id={`desc_${idx}`}
                  value={item.description}
                  onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                  placeholder="E.g., Victorian sash window, period features, etc."
                  rows={3}
                  className={errors[`desc_${idx}`] ? 'border-red-500' : ''}
                />
                {errors[`desc_${idx}`] && (
                  <p className="text-red-600 text-sm mt-1">{errors[`desc_${idx}`]}</p>
                )}
              </div>

              {/* Photo Upload */}
              <div>
                <Label className="font-semibold mb-2 block">Photo (Optional)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handlePhotoUpload(item.id, e)}
                    className="hidden"
                    id={`photo_${idx}`}
                  />
                  <label htmlFor={`photo_${idx}`} className="cursor-pointer block">
                    <Upload className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm font-medium">Click to upload photo</p>
                    <p className="text-xs text-gray-500">We'll analyze it to extract dimensions</p>
                  </label>
                </div>
                {item.photoUrl && (
                  <div className="mt-2 relative w-32 h-32 rounded-lg overflow-hidden">
                    <img src={item.photoUrl} alt="Uploaded" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`qty_${idx}`} className="font-semibold mb-2 block">
                    Quantity
                  </Label>
                  <Input
                    id={`qty_${idx}`}
                    type="number"
                    min="1"
                    max="100"
                    value={item.quantity}
                    onChange={e => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              {/* Product Type */}
              <div>
                <Label htmlFor={`type_${idx}`} className="font-semibold mb-2 block">
                  Product Type *
                </Label>
                <Select value={item.productType || ''} onValueChange={v => handleItemChange(item.id, 'productType', v)}>
                  <SelectTrigger id={`type_${idx}`} className={errors[`type_${idx}`] ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select product type" />
                  </SelectTrigger>
                  <SelectContent>
                    {hasTenantProductTypes ? (
                      tenantTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        {(projectType === 'doors' || projectType === 'both') && (
                          <SelectItem value="doors">Doors</SelectItem>
                        )}
                        {(projectType === 'windows' || projectType === 'both') && (
                          <SelectItem value="windows">Windows</SelectItem>
                        )}
                      </>
                    )}
                  </SelectContent>
                </Select>
                {errors[`type_${idx}`] && (
                  <p className="text-red-600 text-sm mt-1">{errors[`type_${idx}`]}</p>
                )}
              </div>

              {/* Dimensions */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`width_${idx}`} className="font-semibold mb-2 block">
                    Width (mm)
                  </Label>
                  <Input
                    id={`width_${idx}`}
                    type="number"
                    value={item.widthMm || ''}
                    onChange={e => handleItemChange(item.id, 'widthMm', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="400-4000"
                    className={errors[`width_${idx}`] ? 'border-red-500' : ''}
                  />
                  {errors[`width_${idx}`] && (
                    <p className="text-red-600 text-sm mt-1">{errors[`width_${idx}`]}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor={`height_${idx}`} className="font-semibold mb-2 block">
                    Height (mm)
                  </Label>
                  <Input
                    id={`height_${idx}`}
                    type="number"
                    value={item.heightMm || ''}
                    onChange={e => handleItemChange(item.id, 'heightMm', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="400-3000"
                    className={errors[`height_${idx}`] ? 'border-red-500' : ''}
                  />
                  {errors[`height_${idx}`] && (
                    <p className="text-red-600 text-sm mt-1">{errors[`height_${idx}`]}</p>
                  )}
                </div>
              </div>

              {/* Materials */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor={`timber_${idx}`} className="font-semibold mb-2 block">
                    Timber Type
                  </Label>
                  <Select value={item.timber || ''} onValueChange={v => handleItemChange(item.id, 'timber', v)}>
                    <SelectTrigger id={`timber_${idx}`}>
                      <SelectValue placeholder="Select timber" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="softwood">Softwood</SelectItem>
                      <SelectItem value="hardwood">Hardwood</SelectItem>
                      <SelectItem value="oak">Oak</SelectItem>
                      <SelectItem value="walnut">Walnut</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor={`ironmongery_${idx}`} className="font-semibold mb-2 block">
                    Ironmongery
                  </Label>
                  <Select value={item.ironmongery || ''} onValueChange={v => handleItemChange(item.id, 'ironmongery', v)}>
                    <SelectTrigger id={`ironmongery_${idx}`}>
                      <SelectValue placeholder="Select ironmongery" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="black">Black</SelectItem>
                      <SelectItem value="chrome">Chrome</SelectItem>
                      <SelectItem value="brass">Brass</SelectItem>
                      <SelectItem value="stainless">Stainless Steel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor={`glazing_${idx}`} className="font-semibold mb-2 block">
                    Glazing
                  </Label>
                  <Select value={item.glazing || ''} onValueChange={v => handleItemChange(item.id, 'glazing', v)}>
                    <SelectTrigger id={`glazing_${idx}`}>
                      <SelectValue placeholder="Select glazing" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="double">Double</SelectItem>
                      <SelectItem value="triple">Triple</SelectItem>
                      <SelectItem value="secondary">Secondary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Item Button */}
      {canAddMore && (
        <Button onClick={handleAddItem} variant="outline" className="w-full" size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Add Another Item
        </Button>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        <Button onClick={onBack} variant="outline" size="lg">
          Back
        </Button>
        <Button onClick={handleSubmit} size="lg" className="bg-blue-600 hover:bg-blue-700">
          Review & Submit
        </Button>
      </div>
    </div>
  );
}
