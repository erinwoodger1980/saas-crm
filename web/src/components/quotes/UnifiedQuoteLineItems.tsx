'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Upload, Wand2, Package } from 'lucide-react';
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
};

interface UnifiedQuoteLineItemsProps {
  lines: QuoteLineItem[];
  onAddLine: (line: QuoteLineItem) => Promise<void>;
  onUpdateLine: (lineId: string, updates: Partial<QuoteLineItem>) => Promise<void>;
  onDeleteLine: (lineId: string) => Promise<void>;
  onPhotoUpload?: (file: File, lineId?: string) => Promise<void>;
  onAIGenerate?: (description: string, dimensions: { widthMm: number; heightMm: number }) => Promise<void>;
  onSelectProductType?: (productTypeId: string) => Promise<void>;
  currency?: string;
  isLoading?: boolean;
}

export function UnifiedQuoteLineItems({
  lines,
  onAddLine,
  onUpdateLine,
  onDeleteLine,
  onPhotoUpload,
  onAIGenerate,
  onSelectProductType,
  currency = 'GBP',
  isLoading = false,
}: UnifiedQuoteLineItemsProps) {
  const [newLine, setNewLine] = useState<QuoteLineItem>({
    description: '',
    qty: 1,
    widthMm: 900,
    heightMm: 2100,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLine, setEditingLine] = useState<QuoteLineItem | null>(null);
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [photoUploadingFor, setPhotoUploadingFor] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);

  const handleAddLine = useCallback(async () => {
    if (!newLine.description.trim()) {
      alert('Please enter a description');
      return;
    }
    try {
      await onAddLine(newLine);
      setNewLine({ description: '', qty: 1, widthMm: 900, heightMm: 2100 });
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

  const formatCurrency = (amount?: number) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Line Items</h3>
        <div className="flex gap-2">
          {onSelectProductType && (
            <Button size="sm" variant="outline" className="gap-2">
              <Package className="h-4 w-4" />
              Select Product Type
            </Button>
          )}
          {onPhotoUpload && (
            <Button size="sm" variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload Photo
            </Button>
          )}
          {onAIGenerate && (
            <Button size="sm" variant="outline" className="gap-2">
              <Wand2 className="h-4 w-4" />
              AI Generate
            </Button>
          )}
          <Button size="sm" onClick={() => setIsAddingLine(true)} className="gap-2">
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
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Qty</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Width (mm)</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Height (mm)</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Timber</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Finish</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Ironmongery</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Glazing</th>
              <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Price</th>
              <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((line, idx) => (
              <tr key={line.id || idx} className="hover:bg-slate-50">
                <td className="px-4 py-3 max-w-xs truncate">{line.description}</td>
                <td className="px-4 py-3 text-center">{line.qty}</td>
                <td className="px-4 py-3 text-center">{line.widthMm || '—'}</td>
                <td className="px-4 py-3 text-center">{line.heightMm || '—'}</td>
                <td className="px-4 py-3 text-center text-sm">{line.timber || '—'}</td>
                <td className="px-4 py-3 text-center text-sm">{line.finish || '—'}</td>
                <td className="px-4 py-3 text-center text-sm">{line.ironmongery || '—'}</td>
                <td className="px-4 py-3 text-center text-sm">{line.glazing || '—'}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(line.sellTotal || line.sellUnit)}</td>
                <td className="px-4 py-3 text-center space-x-2">
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
                  <Input
                    placeholder="e.g., Oak door"
                    value={newLine.description}
                    onChange={(e) => setNewLine({ ...newLine, description: e.target.value })}
                    className="text-sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="number"
                    min="1"
                    value={newLine.qty}
                    onChange={(e) => setNewLine({ ...newLine, qty: Number(e.target.value) })}
                    className="text-sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="number"
                    value={newLine.widthMm || ''}
                    onChange={(e) => setNewLine({ ...newLine, widthMm: Number(e.target.value) })}
                    className="text-sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="number"
                    value={newLine.heightMm || ''}
                    onChange={(e) => setNewLine({ ...newLine, heightMm: Number(e.target.value) })}
                    className="text-sm"
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
                <td className="px-4 py-3 text-right">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newLine.sellUnit || ''}
                    onChange={(e) => setNewLine({ ...newLine, sellUnit: Number(e.target.value) })}
                    className="text-sm"
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
                        setNewLine({ description: '', qty: 1, widthMm: 900, heightMm: 2100 });
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
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={editingLine.description}
                  onChange={(e) => setEditingLine({ ...editingLine, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Qty</label>
                  <Input
                    type="number"
                    value={editingLine.qty}
                    onChange={(e) => setEditingLine({ ...editingLine, qty: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Unit Price</label>
                  <Input
                    type="number"
                    value={editingLine.sellUnit || ''}
                    onChange={(e) => setEditingLine({ ...editingLine, sellUnit: Number(e.target.value) })}
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
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Height (mm)</label>
                  <Input
                    type="number"
                    value={editingLine.heightMm || ''}
                    onChange={(e) => setEditingLine({ ...editingLine, heightMm: Number(e.target.value) })}
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
