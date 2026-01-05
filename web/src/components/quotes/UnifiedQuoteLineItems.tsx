'use client';

import { useState, useCallback, useRef, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Upload, Wand2, Package, Box } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Standard dropdowns
const TIMBER_OPTIONS = [
  'Oak', 'Sapele', 'Accoya', 'Iroko', 'Pine', 'Hemlock', 'MDF', 'Other'
];

const FINISH_OPTIONS = [
  'Raw', 'Primed', 'Painted', 'Stained', 'Natural', 'Other'
];

const IRONMONGERY_OPTIONS = [
  'Brass', 'Stainless Steel', 'Chrome', 'Satin Chrome', 'Black', 'None', 'Other'
];

const GLAZING_OPTIONS = [
  'None', 'Clear', 'Obscure', 'Double Glazed', 'Fire Rated', 'Georgian', 'Leaded'
];

export type QuoteLineItem = {
  id?: string;
  description: string;
  qty: number;
  widthMm?: number;
  heightMm?: number;
  timber?: string;
  finish?: string;
  ironmongery?: string;
  glazing?: string;
  unitPrice?: number;
  sellUnit?: number;
  sellTotal?: number;
  productOptionId?: string;
  photoUrl?: string;
};

interface UnifiedQuoteLineItemsProps {
  lines: QuoteLineItem[];
  productCategories?: any[];
  onAddLine: (line: QuoteLineItem) => Promise<void>;
  onUpdateLine: (lineId: string, updates: Partial<QuoteLineItem>) => Promise<void>;
  onDeleteLine: (lineId: string) => Promise<void>;
  onPhotoUpload?: (file: File, lineId?: string) => Promise<void>;
  onAIGenerate?: (description: string, dimensions: { widthMm: number; heightMm: number }) => Promise<void>;
  onPreview3d?: (lineId?: string, productOptionId?: string) => Promise<void>;
  currency?: string;
  isLoading?: boolean;
}

export function UnifiedQuoteLineItems({
  lines,
  productCategories = [],
  onAddLine,
  onUpdateLine,
  onDeleteLine,
  onPhotoUpload,
  onAIGenerate,
  onPreview3d,
  currency = 'GBP',
  isLoading = false,
}: UnifiedQuoteLineItemsProps) {
  const [newLine, setNewLine] = useState<QuoteLineItem>({
    description: '',
    qty: 1,
    widthMm: 900,
    heightMm: 2100,
    timber: undefined,
    finish: undefined,
    ironmongery: undefined,
    glazing: undefined,
    productOptionId: undefined,
    photoUrl: undefined,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLine, setEditingLine] = useState<QuoteLineItem | null>(null);
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [photoUploadingFor, setPhotoUploadingFor] = useState<string | null>(null);
  const [pendingPhotoLineId, setPendingPhotoLineId] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [lineProductTypes, setLineProductTypes] = useState<Record<string, string | undefined>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAddLine = useCallback(async () => {
    if (!newLine.description.trim()) {
      alert('Please enter a description');
      return;
    }
    try {
      await onAddLine(newLine);
      setNewLine({ description: '', qty: 1, widthMm: 900, heightMm: 2100, timber: undefined, finish: undefined, ironmongery: undefined, glazing: undefined, productOptionId: undefined, photoUrl: undefined });
      setIsAddingLine(false);
    } catch (error) {
      console.error('Failed to add line:', error);
      alert('Failed to add line item');
    }
  }, [newLine, onAddLine]);

  const handleUpdateLine = useCallback(async () => {
    if (!editingId || !editingLine) return;
    try {
      await onUpdateLine(editingId, editingLine);
      setEditingId(null);
      setEditingLine(null);
    } catch (error) {
      console.error('Failed to update line:', error);
      alert('Failed to update line item');
    }
  }, [editingId, editingLine, onUpdateLine]);

  const handleDeleteLine = useCallback(async (lineId: string) => {
    if (!confirm('Delete this line item?')) return;
    try {
      await onDeleteLine(lineId);
    } catch (error) {
      console.error('Failed to delete line:', error);
      alert('Failed to delete line item');
    }
  }, [onDeleteLine]);

  const handleTriggerPhotoUpload = useCallback((lineId?: string) => {
    if (!onPhotoUpload) return;
    setPendingPhotoLineId(lineId ?? null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, [onPhotoUpload]);

  const handlePhotoSelected = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    if (!onPhotoUpload) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const targetLineId = pendingPhotoLineId || undefined;
    setPhotoUploadingFor(targetLineId ?? 'new');
    try {
      await onPhotoUpload(file, targetLineId);
    } catch (error) {
      console.error('Failed to upload photo:', error);
      alert('Failed to upload photo');
    } finally {
      setPhotoUploadingFor(null);
      setPendingPhotoLineId(null);
      event.target.value = '';
    }
  }, [onPhotoUpload, pendingPhotoLineId]);

  const handlePreview3d = useCallback(async (lineId?: string, productOptionId?: string) => {
    if (!onPreview3d) return;
    try {
      await onPreview3d(lineId, productOptionId);
    } catch (error) {
      console.error('Failed to open preview:', error);
      alert('Failed to open preview');
    }
  }, [onPreview3d]);

  const formatCurrency = (amount?: number) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const numberInputClass = 'text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoSelected}
      />
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Line Items</h3>
        <div className="flex flex-wrap gap-2 justify-end">
          {onPreview3d && (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => handlePreview3d()}>
              <Box className="h-4 w-4" />
              3D Preview
            </Button>
          )}
          {onPhotoUpload && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => handleTriggerPhotoUpload()}
              disabled={!!photoUploadingFor}
            >
              <Upload className="h-4 w-4" />
              {photoUploadingFor ? 'Uploading…' : 'Upload Photo'}
            </Button>
          )}
          {onAIGenerate && (
            <Button size="sm" variant="outline" className="gap-2">
              <Wand2 className="h-4 w-4" />
              AI Generate
            </Button>
          )}
          <Button size="sm" onClick={() => setIsAddingLine(true)} className="gap-2" disabled={isLoading || isAddingLine}>
            <Plus className="h-4 w-4" />
            Add Line Item
          </Button>
        </div>
      </div>

      {/* Lines Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 border-b">
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Description</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Photo</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Qty</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Width (mm)</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Height (mm)</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Timber</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Finish</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Ironmongery</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Glazing</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Product Type</th>
              <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Price</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((line, idx) => (
              <tr key={line.id || idx} className="hover:bg-slate-50">
                <td className="px-4 py-3 max-w-xs truncate">{line.description}</td>
                <td className="px-4 py-3 text-center">
                  {line.photoUrl ? (
                    <img src={line.photoUrl} alt="photo" className="h-10 w-10 rounded object-cover mx-auto" />
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">{line.qty}</td>
                <td className="px-4 py-3 text-center">{line.widthMm || '—'}</td>
                <td className="px-4 py-3 text-center">{line.heightMm || '—'}</td>
                <td className="px-4 py-3 text-center text-sm">{line.timber || '—'}</td>
                <td className="px-4 py-3 text-center text-sm">{line.finish || '—'}</td>
                <td className="px-4 py-3 text-center text-sm">{line.ironmongery || '—'}</td>
                <td className="px-4 py-3 text-center text-sm">{line.glazing || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <select
                    className="text-sm px-2 py-1 rounded border border-input bg-white"
                    value={lineProductTypes[line.id || idx.toString()] || line.productOptionId || ''}
                    onChange={(e) => {
                      const newValue = e.target.value || undefined;
                      setLineProductTypes(prev => ({
                        ...prev,
                        [line.id || idx.toString()]: newValue
                      }));
                      if (line.id) {
                        onUpdateLine(line.id, { productOptionId: newValue });
                      }
                    }}
                  >
                    <option value="">— Select —</option>
                    {productCategories.map((cat: any) => {
                      if (!cat.types || !Array.isArray(cat.types)) return null;
                      return cat.types.map((type: any) => {
                        if (!type.options || !Array.isArray(type.options)) return null;
                        return type.options.map((opt: any) => (
                          <option key={opt.id} value={opt.id}>
                            {cat.label} › {type.label} › {opt.label}
                          </option>
                        ));
                      });
                    })}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">{formatCurrency(line.sellTotal || line.sellUnit)}</td>
                <td className="px-4 py-3 text-center space-x-2">
                  {onPhotoUpload && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTriggerPhotoUpload(line.id || idx.toString())}
                      disabled={photoUploadingFor === (line.id || idx.toString())}
                      title="Upload photo for this line"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  )}
                  {onPreview3d && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handlePreview3d(line.id || idx.toString(), lineProductTypes[line.id || idx.toString()] || line.productOptionId)}
                      title="3D preview"
                    >
                      <Box className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(line.id || idx.toString());
                      setEditingLine(line);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteLine(line.id || idx.toString())}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}

            {/* New Line Input Row */}
            {isAddingLine && (
              <tr className="bg-blue-50 border-2 border-blue-200">
                <td className="px-4 py-3">
                  <Textarea
                    placeholder="e.g., Oak door"
                    value={newLine.description}
                    onChange={(e) => setNewLine({ ...newLine, description: e.target.value })}
                    className="text-sm min-h-[60px]"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  {onPhotoUpload && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPendingPhotoLineId('new');
                        setPhotoUploadingFor('new');
                        fileInputRef.current?.click();
                      }}
                      disabled={photoUploadingFor === 'new'}
                      title="Upload photo"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="number"
                    min="1"
                    value={newLine.qty}
                    onChange={(e) => setNewLine({ ...newLine, qty: Number(e.target.value) })}
                    className={numberInputClass}
                  />
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="number"
                    value={newLine.widthMm || ''}
                    onChange={(e) => setNewLine({ ...newLine, widthMm: Number(e.target.value) })}
                    className={numberInputClass}
                  />
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="number"
                    value={newLine.heightMm || ''}
                    onChange={(e) => setNewLine({ ...newLine, heightMm: Number(e.target.value) })}
                    className={numberInputClass}
                  />
                </td>
                <td className="px-4 py-3">
                  <Select value={newLine.timber || ''} onValueChange={(v) => setNewLine({ ...newLine, timber: v })}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMBER_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Select value={newLine.finish || ''} onValueChange={(v) => setNewLine({ ...newLine, finish: v })}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {FINISH_OPTIONS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={newLine.ironmongery || ''}
                    onValueChange={(v) => setNewLine({ ...newLine, ironmongery: v })}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {IRONMONGERY_OPTIONS.map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Select value={newLine.glazing || ''} onValueChange={(v) => setNewLine({ ...newLine, glazing: v })}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {GLAZING_OPTIONS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3 text-center">
                  <select
                    className="text-sm px-2 py-1 rounded border border-input bg-white"
                    value={newLine.productOptionId || ''}
                    onChange={(e) => {
                      const newValue = e.target.value || undefined;
                      setNewLine({ ...newLine, productOptionId: newValue });
                    }}
                  >
                    <option value="">— Select —</option>
                    {productCategories.map((cat: any) => {
                      if (!cat.types || !Array.isArray(cat.types)) return null;
                      return cat.types.map((type: any) => {
                        if (!type.options || !Array.isArray(type.options)) return null;
                        return type.options.map((opt: any) => (
                          <option key={opt.id} value={opt.id}>
                            {cat.label} › {type.label} › {opt.label}
                          </option>
                        ));
                      });
                    })}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newLine.sellUnit || ''}
                    onChange={(e) => setNewLine({ ...newLine, sellUnit: Number(e.target.value) })}
                    className={numberInputClass}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-center">
                    <Button
                      size="sm"
                      onClick={handleAddLine}
                      disabled={isLoading}
                      className="text-xs"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsAddingLine(false);
                        setNewLine({ description: '', qty: 1, widthMm: 900, heightMm: 2100, timber: undefined, finish: undefined, ironmongery: undefined, glazing: undefined, productOptionId: undefined, photoUrl: undefined });
                      }}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Dialog */}
      {editingId && editingLine && (
        <Dialog open={!!editingId} onOpenChange={() => setEditingId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Line Item</DialogTitle>
              <DialogDescription>
                Update description, dimensions, materials, and product type.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editingLine.description}
                  onChange={(e) => setEditingLine({ ...editingLine, description: e.target.value })}
                  className="min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Qty</label>
                  <Input
                    type="number"
                    value={editingLine.qty}
                    onChange={(e) => setEditingLine({ ...editingLine, qty: Number(e.target.value) })}
                    className={numberInputClass}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Unit Price</label>
                  <Input
                    type="number"
                    value={editingLine.sellUnit || ''}
                    onChange={(e) => setEditingLine({ ...editingLine, sellUnit: Number(e.target.value) })}
                    className={numberInputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Width (mm)</label>
                  <Input
                    type="number"
                    value={editingLine.widthMm || ''}
                    onChange={(e) => setEditingLine({ ...editingLine, widthMm: Number(e.target.value) })}
                    className={numberInputClass}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Height (mm)</label>
                  <Input
                    type="number"
                    value={editingLine.heightMm || ''}
                    onChange={(e) => setEditingLine({ ...editingLine, heightMm: Number(e.target.value) })}
                    className={numberInputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Timber</label>
                  <Select value={editingLine.timber || ''} onValueChange={(v) => setEditingLine({ ...editingLine, timber: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMBER_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Finish</label>
                  <Select value={editingLine.finish || ''} onValueChange={(v) => setEditingLine({ ...editingLine, finish: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {FINISH_OPTIONS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Ironmongery</label>
                  <Select
                    value={editingLine.ironmongery || ''}
                    onValueChange={(v) => setEditingLine({ ...editingLine, ironmongery: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {IRONMONGERY_OPTIONS.map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Glazing</label>
                  <Select value={editingLine.glazing || ''} onValueChange={(v) => setEditingLine({ ...editingLine, glazing: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {GLAZING_OPTIONS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateLine} disabled={isLoading}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Empty state */}
      {lines.length === 0 && !isAddingLine && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No line items yet</p>
            <p className="text-sm mt-1">Add a line item to begin building your quote</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
