'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { apiFetch } from '@/lib/api';
import { AlertCircle, Loader2 } from 'lucide-react';

interface ProductTypeOption {
  id: string;
  code: string;
  name: string;
}

interface TemplateFieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required: boolean;
  lookupTableId?: string;
  lookupOptions?: Array<{ value: string; label: string }>;
}

interface BOMLineItem {
  id: string;
  componentName: string;
  componentCode: string;
  materialName: string;
  materialCode: string;
  quantity: number;
  quantityUnit: string;
  costPerUnit: number;
  markup: number;
  totalCost: number;
}

interface GeneratedBOM {
  productTypeId: string;
  lineItems: BOMLineItem[];
  totalMaterialCost: number;
  totalMarkup: number;
  totalPrice: number;
}

export interface TemplateProductGeneratorProps {
  onBOMGenerated?: (bom: GeneratedBOM) => void;
  defaultProductTypeId?: string;
  readOnly?: boolean;
}

/**
 * Template Product Generator Component
 *
 * Allows users to:
 * 1. Select a ProductType (e.g., "FD30 Single Door")
 * 2. Enter field values (dimensions, materials, etc.)
 * 3. Preview the generated BOM
 * 4. Generate the final BOM for quoting
 */
export const TemplateProductGenerator: React.FC<TemplateProductGeneratorProps> = ({
  onBOMGenerated,
  defaultProductTypeId,
  readOnly = false,
}) => {
  const [selectedProductType, setSelectedProductType] = useState<string>(
    defaultProductTypeId || ''
  );
  const [fieldValues, setFieldValues] = useState<Record<string, string | number>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generatedBOM, setGeneratedBOM] = useState<GeneratedBOM | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [errors, setErrors] = useState<{ preview?: string; generate?: string }>({});

  // Fetch available product types using SWR
  const { data: productTypes = [], isLoading: typesLoading } = useSWR(
    '/product-types',
    (url) => apiFetch<ProductTypeOption[]>(url),
    { revalidateOnFocus: false }
  );

  // Fetch templates for selected product type
  const { data: templates = [] } = useSWR(
    selectedProductType ? `/templates/${selectedProductType}` : null,
    (url) => apiFetch(url),
    { revalidateOnFocus: false }
  );

  // Generate BOM preview
  const handlePreview = async () => {
    try {
      setPreviewLoading(true);
      setErrors((prev) => ({ ...prev, preview: undefined }));
      const bom = await apiFetch<GeneratedBOM>('/templates/preview', {
        method: 'POST',
        body: JSON.stringify({
          productTypeId: selectedProductType,
          fieldValues,
        }),
      });
      setGeneratedBOM(bom);
      setPreviewOpen(true);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        preview: 'Failed to preview BOM. Please check your input values.',
      }));
    } finally {
      setPreviewLoading(false);
    }
  };

  // Generate final BOM
  const handleGenerate = async () => {
    try {
      setGenerateLoading(true);
      setErrors((prev) => ({ ...prev, generate: undefined }));
      const bom = await apiFetch<GeneratedBOM>('/templates/generate', {
        method: 'POST',
        body: JSON.stringify({
          productTypeId: selectedProductType,
          fieldValues,
        }),
      });
      setGeneratedBOM(bom);
      onBOMGenerated?.(bom);
      setPreviewOpen(false);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        generate: 'Failed to generate BOM. Please try again.',
      }));
    } finally {
      setGenerateLoading(false);
    }
  };

  // Extract field definitions from templates
  const fieldDefinitions = extractFieldDefinitions(templates);

  const handleFieldChange = (fieldName: string, value: string | number) => {
    setFieldValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const canPreview =
    selectedProductType &&
    fieldDefinitions.every(
      (field) => !field.required || fieldValues[field.name]
    );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate Product from Template</CardTitle>
          <CardDescription>
            Select a standard product configuration and customize it with your materials and dimensions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Product Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Product Type *</label>
            <Select value={selectedProductType} onValueChange={setSelectedProductType}>
              <SelectTrigger disabled={readOnly || typesLoading}>
                <SelectValue placeholder="Select a product type..." />
              </SelectTrigger>
              <SelectContent>
                {productTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.code} - {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Field Value Inputs */}
          {fieldDefinitions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fieldDefinitions.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <label className="text-sm font-medium">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {field.type === 'select' ? (
                      <Select
                        value={String(fieldValues[field.name] || '')}
                        onValueChange={(val) => handleFieldChange(field.name, val)}
                      >
                        <SelectTrigger disabled={readOnly}>
                          <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.lookupOptions?.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={field.type}
                        placeholder={field.label}
                        value={fieldValues[field.name] || ''}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        disabled={readOnly}
                        step={field.type === 'number' ? '0.01' : undefined}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Messages */}
          {errors.preview && (
            <div className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">{errors.preview}</div>
            </div>
          )}
          {errors.generate && (
            <div className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">{errors.generate}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={!canPreview || readOnly || previewLoading}
            >
              {previewLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Preview BOM
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!canPreview || readOnly || generateLoading}
            >
              {generateLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate BOM
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* BOM Preview Dialog */}
      <BOMPreviewDialog
        open={previewOpen}
        bom={generatedBOM}
        onClose={() => setPreviewOpen(false)}
        onConfirm={handleGenerate}
        isLoading={generateLoading}
      />
    </div>
  );
};

/**
 * BOM Preview Dialog
 *
 * Shows the generated bill of materials before confirming
 */
interface BOMPreviewDialogProps {
  open: boolean;
  bom: GeneratedBOM | null;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

const BOMPreviewDialog: React.FC<BOMPreviewDialogProps> = ({
  open,
  bom,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  if (!bom) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bill of Materials Preview</DialogTitle>
          <DialogDescription>
            Review the components and costs before generating the final BOM
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 border rounded-lg">
              <div className="text-xs text-gray-600 font-medium">Items</div>
              <div className="text-xl font-bold">{bom.lineItems.length}</div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-xs text-gray-600 font-medium">Material Cost</div>
              <div className="text-xl font-bold">£{bom.totalMaterialCost.toFixed(2)}</div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-xs text-gray-600 font-medium">Markup</div>
              <div className="text-xl font-bold">£{bom.totalMarkup.toFixed(2)}</div>
            </div>
            <div className="p-3 border rounded-lg bg-green-50">
              <div className="text-xs text-gray-600 font-medium">Total Price</div>
              <div className="text-xl font-bold text-green-700">£{bom.totalPrice.toFixed(2)}</div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Component</TableHead>
                  <TableHead className="font-semibold">Material</TableHead>
                  <TableHead className="font-semibold text-right">Qty</TableHead>
                  <TableHead className="font-semibold">Unit</TableHead>
                  <TableHead className="font-semibold text-right">Cost/Unit</TableHead>
                  <TableHead className="font-semibold text-right">Markup %</TableHead>
                  <TableHead className="font-semibold text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bom.lineItems.map((item, idx) => (
                  <TableRow key={item.id || idx} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="font-medium">{item.componentCode}</div>
                      <div className="text-xs text-gray-600">{item.componentName}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.materialCode}</div>
                      <div className="text-xs text-gray-600">{item.materialName}</div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity.toFixed(2)}</TableCell>
                    <TableCell>{item.quantityUnit}</TableCell>
                    <TableCell className="text-right">£{item.costPerUnit.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{item.markup.toFixed(0)}%</TableCell>
                    <TableCell className="text-right font-bold">
                      £{item.totalCost.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create BOM
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Helper: Extract field definitions from templates
 *
 * Analyzes templates to determine what fields need to be filled in
 * and whether they have predefined options (from lookup tables)
 */
function extractFieldDefinitions(templates: any[]): TemplateFieldDefinition[] {
  const fields: Map<string, TemplateFieldDefinition> = new Map();

  for (const template of templates) {
    if (!template.fieldMappings) continue;

    for (const [fieldName, mappingValue] of Object.entries(
      template.fieldMappings as Record<string, any>
    )) {
      if (fields.has(fieldName)) continue;

      // Determine field type and options
      let fieldType: 'text' | 'number' | 'select' = 'text';
      let lookupOptions: Array<{ value: string; label: string }> | undefined;

      // If this template has a lookup table for this field
      if (template.lookupFieldName === fieldName && template.lookupTable) {
        fieldType = 'select';
        lookupOptions = template.lookupTable.rows.map((row: any) => ({
          value: row.value,
          label: row.label || row.value,
        }));
      }

      // Infer type from field name
      if (
        fieldName.toLowerCase().includes('height') ||
        fieldName.toLowerCase().includes('width') ||
        fieldName.toLowerCase().includes('depth') ||
        fieldName.toLowerCase().includes('qty')
      ) {
        fieldType = 'number';
      }

      fields.set(fieldName, {
        name: fieldName,
        label: fieldName
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase()),
        type: fieldType,
        required: true,
        lookupTableId: template.lookupTableId,
        lookupOptions,
      });
    }
  }

  return Array.from(fields.values());
}

export default TemplateProductGenerator;
