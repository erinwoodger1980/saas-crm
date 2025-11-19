/**
 * AnnotationBoxEditor Component
 * 
 * Floating editor that appears when creating or editing an annotation box
 * Allows setting the label and rowId for grouping related boxes
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { X } from 'lucide-react';
import type { AnnotationLabel } from '@/types/pdfAnnotations';
import { LABEL_DISPLAY_NAMES } from '@/types/pdfAnnotations';

interface AnnotationBoxEditorProps {
  boxId: string;
  initialLabel?: AnnotationLabel;
  initialRowId?: string;
  position: { x: number; y: number }; // Screen coordinates
  onSave: (label: AnnotationLabel, rowId?: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function AnnotationBoxEditor({
  boxId,
  initialLabel = 'description',
  initialRowId = '',
  position,
  onSave,
  onDelete,
  onCancel,
}: AnnotationBoxEditorProps) {
  const [label, setLabel] = useState<AnnotationLabel>(initialLabel);
  const [rowId, setRowId] = useState<string>(initialRowId);

  useEffect(() => {
    setLabel(initialLabel);
    setRowId(initialRowId);
  }, [initialLabel, initialRowId]);

  const handleSave = () => {
    onSave(label, rowId || undefined);
  };

  const labels: AnnotationLabel[] = [
    'joinery_image',
    'description',
    'qty',
    'unit_cost',
    'line_total',
    'delivery_row',
    'header_logo',
    'ignore',
  ];

  return (
    <Card
      className="absolute z-50 p-4 shadow-lg min-w-[280px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Edit Annotation</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        {/* Label selector */}
        <div className="space-y-2">
          <Label htmlFor="label">Label</Label>
          <Select value={label} onValueChange={(val) => setLabel(val as AnnotationLabel)}>
            <SelectTrigger id="label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {labels.map((labelOption) => (
                <SelectItem key={labelOption} value={labelOption}>
                  {LABEL_DISPLAY_NAMES[labelOption]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Row ID input */}
        <div className="space-y-2">
          <Label htmlFor="rowId">
            Row ID <span className="text-xs text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="rowId"
            value={rowId}
            onChange={(e) => setRowId(e.target.value)}
            placeholder="e.g., line1, line2..."
          />
          <p className="text-xs text-muted-foreground">
            Group related boxes (e.g., description + qty + price) with the same row ID
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button onClick={handleSave} size="sm" className="flex-1">
            Save
          </Button>
          <Button onClick={onDelete} variant="destructive" size="sm">
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}
