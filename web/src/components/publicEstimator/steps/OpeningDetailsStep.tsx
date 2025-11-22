/**
 * OpeningDetailsStep - Per-item capture with photos, measurements, and specs
 * Mobile-first design for capturing door/window details
 */

'use client';

import { useState } from 'react';
import { inferFromImage } from '@/lib/publicEstimator/inferFromImage';
import { inferOpeningFromImage } from '@/lib/publicEstimator/aiImageInference';
import { Plus, X, Camera, Ruler, MapPin, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OpeningItem {
  id: string;
  type: string;
  location?: string;
  width?: number;
  height?: number;
  images?: string[];
  notes?: string;
}

interface OpeningDetailsStepProps {
  items?: OpeningItem[];
  primaryColor?: string;
  onChange: (data: { openingDetails: OpeningItem[] }) => void;
  onNext: () => void;
  onBack: () => void;
  inspirationImages?: string[];
  onInspirationChange?: (images: string[]) => void;
}

const OPENING_TYPES = [
  { value: 'external_door', label: 'External Door', icon: '🚪' },
  { value: 'internal_door', label: 'Internal Door', icon: '🚪' },
  { value: 'window', label: 'Window', icon: '🪟' },
  { value: 'bifold', label: 'Bi-fold Doors', icon: '🚪' },
  { value: 'french_doors', label: 'French Doors', icon: '🚪' },
  { value: 'patio_doors', label: 'Patio Doors', icon: '🚪' },
  { value: 'other', label: 'Other', icon: '📐' },
];

export function OpeningDetailsStep({
  items = [],
  primaryColor = '#3b82f6',
  onChange,
  onNext,
  onBack,
  inspirationImages = [],
  onInspirationChange,
}: OpeningDetailsStepProps) {
  // Initialize with one default opening if none exist
  const [currentItems, setCurrentItems] = useState<OpeningItem[]>(() => {
    if (items.length > 0) return items;
    const defaultOpening: OpeningItem = {
      id: `item-${Date.now()}`,
      type: 'external_door',
    };
    // Immediately persist so estimate can start calculating
    setTimeout(() => onChange({ openingDetails: [defaultOpening] }), 0);
    return [defaultOpening];
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleAddItem = () => {
    const newItem: OpeningItem = {
      id: `item-${Date.now()}`,
      type: 'external_door',
    };
    const next = [...currentItems, newItem];
    setCurrentItems(next);
    // Persist immediately so upstream preview + autosave can react
    onChange({ openingDetails: next });
    setEditingId(newItem.id);
    setErrors({});
  };

  const handleUpdateItem = (id: string, updates: Partial<OpeningItem>) => {
    const updated = currentItems.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    setCurrentItems(updated);
    onChange({ openingDetails: updated });
  };

  const handleRemoveItem = (id: string) => {
    const filtered = currentItems.filter(item => item.id !== id);
    setCurrentItems(filtered);
    onChange({ openingDetails: filtered });
    if (editingId === id) {
      setEditingId(null);
    }
  };

  const handleImageUpload = async (id: string, files: FileList | File[]) => {
    const list = Array.from(files);
    for (const file of list) {
      const localUrl = URL.createObjectURL(file);
      const item = currentItems.find(i => i.id === id);
      const images = item?.images || [];
      // Perform heuristic inference (non-blocking UI)
      handleUpdateItem(id, { images: [...images, localUrl] });
      try {
        const baseLabel = file.name.split('.')[0];
        // Fast heuristic first (non-blocking, immediate UX)
        const heuristic = await inferFromImage(localUrl, baseLabel);
        const freshItem1 = currentItems.find(i => i.id === id);
        if (freshItem1) {
          const hUpdates: Partial<OpeningItem> = {};
          if (!freshItem1.width && heuristic.widthMm) hUpdates.width = heuristic.widthMm;
          if (!freshItem1.height && heuristic.heightMm) hUpdates.height = heuristic.heightMm;
          if (!freshItem1.notes && heuristic.description) hUpdates.notes = heuristic.description;
          if (Object.keys(hUpdates).length) handleUpdateItem(id, hUpdates);
        }
        // AI refinement (may override heuristic if higher confidence)
        const freshItem2 = currentItems.find(i => i.id === id);
        const ai = await inferOpeningFromImage(file, { openingType: freshItem2?.type });
        if (ai && freshItem2) {
          const aiUpdates: Partial<OpeningItem> = {};
          if (!freshItem2.width && ai.width_mm) aiUpdates.width = ai.width_mm;
          if (!freshItem2.height && ai.height_mm) aiUpdates.height = ai.height_mm;
          if (!freshItem2.notes && ai.description) aiUpdates.notes = ai.description;
          if (Object.keys(aiUpdates).length) handleUpdateItem(id, aiUpdates);
        }
      } catch {}
    }
  };

  const handleInspirationUpload = (files: FileList | null) => {
    if (!files || !files.length) return;
    const existing = inspirationImages.slice();
    const next: string[] = [];
    Array.from(files).forEach(f => {
      try {
        const url = URL.createObjectURL(f);
        next.push(url);
      } catch {}
    });
    const merged = [...existing, ...next];
    onInspirationChange?.(merged);
  };

  const removeInspiration = (index: number) => {
    const copy = inspirationImages.slice();
    copy.splice(index, 1);
    onInspirationChange?.(copy);
  };

  const handleRemoveImage = (itemId: string, imageIndex: number) => {
    const item = currentItems.find(i => i.id === itemId);
    if (item?.images) {
      const updated = [...item.images];
      updated.splice(imageIndex, 1);
      handleUpdateItem(itemId, { images: updated });
    }
  };

  const validateAndNext = () => {
    const newErrors: Record<string, string> = {};

    if (currentItems.length === 0) {
      newErrors.general = 'Please add at least one opening';
    }

    currentItems.forEach(item => {
      if (!item.type) {
        newErrors[`${item.id}-type`] = 'Opening type is required';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onChange({ openingDetails: currentItems });
    // Optional: ensure immediate preview without waiting for debounce
    // (Hook will ignore if preview already queued)
    // This avoids a momentary "No items" flash on next step.
    onNext();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Tell us about your openings</h2>
        <p className="mt-2 text-slate-600">
          Add details for each door or window. The more info you provide, the more accurate your estimate.
        </p>
      </div>

      {/* Error message */}
      {errors.general && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
          <p className="text-sm text-red-800">{errors.general}</p>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-4">
        {currentItems.map((item, index) => (
          <div
            key={item.id}
            className="rounded-3xl border-2 border-slate-200 bg-white p-6 transition hover:border-slate-300"
          >
            {/* Item header */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                Opening {index + 1}
              </h3>
              <button
                onClick={() => handleRemoveItem(item.id)}
                className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-red-50"
                title="Remove"
              >
                <X className="h-4 w-4 text-red-600" />
              </button>
            </div>

            {/* Type selector */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Type of opening <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {OPENING_TYPES.map(type => (
                  <button
                    key={type.value}
                    onClick={() => handleUpdateItem(item.id, { type: type.value })}
                    className={`rounded-2xl border-2 p-3 text-left transition ${
                      item.type === type.value
                        ? 'border-current bg-opacity-5'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    style={
                      item.type === type.value
                        ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` }
                        : {}
                    }
                  >
                    <div className="text-2xl mb-1">{type.icon}</div>
                    <div className="text-sm font-medium text-slate-900">{type.label}</div>
                  </button>
                ))}
              </div>
              {errors[`${item.id}-type`] && (
                <p className="mt-1 text-sm text-red-600">{errors[`${item.id}-type`]}</p>
              )}
            </div>

            {/* Location */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                <MapPin className="mb-1 inline h-4 w-4" /> Location (optional)
              </label>
              <input
                type="text"
                value={item.location || ''}
                onChange={e => handleUpdateItem(item.id, { location: e.target.value })}
                placeholder="e.g., Front entrance, Kitchen, Bedroom 2"
                className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 transition focus:border-slate-400 focus:outline-none"
              />
            </div>

            {/* Measurements */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                <Ruler className="mb-1 inline h-4 w-4" /> Approximate measurements (optional)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="number"
                    value={item.width || ''}
                    onChange={e => handleUpdateItem(item.id, { width: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Width (mm)"
                    className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 transition focus:border-slate-400 focus:outline-none"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    value={item.height || ''}
                    onChange={e => handleUpdateItem(item.id, { height: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Height (mm)"
                    className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 transition focus:border-slate-400 focus:outline-none"
                  />
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Don't worry if you're not sure - we'll measure accurately during our site visit
              </p>
            </div>

            {/* Photo upload */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                <Camera className="mb-1 inline h-4 w-4" /> Photos (optional)
              </label>
              
              {/* Uploaded images */}
              {item.images && item.images.length > 0 && (
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {item.images.map((image, imgIndex) => (
                    <div key={imgIndex} className="relative aspect-square overflow-hidden rounded-xl">
                      <img
                        src={image}
                        alt={`Opening ${index + 1} photo ${imgIndex + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        onClick={() => handleRemoveImage(item.id, imgIndex)}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button */}
              <label
                className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 transition hover:border-slate-400 hover:bg-slate-100"
              >
                <Camera className="h-5 w-5 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">
                  {item.images?.length ? 'Add more photos' : 'Take or upload photos'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={e => {
                    const files = e.target.files;
                    if (files && files.length) handleImageUpload(item.id, files);
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Additional notes (optional)
              </label>
              <textarea
                value={item.notes || ''}
                onChange={e => handleUpdateItem(item.id, { notes: e.target.value })}
                placeholder="Any specific requirements or details..."
                rows={3}
                className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 transition focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Add item button */}
      <button
        onClick={handleAddItem}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-4 font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
      >
        <Plus className="h-5 w-5" />
        Add another opening
      </button>

      {/* Inspiration images section */}
      <div className="pt-6 space-y-4">
        <h3 className="text-xl font-semibold text-slate-900">Inspiration photos (optional)</h3>
        <p className="text-sm text-slate-600">Show styles you like. This helps us tailor the specification and finish.</p>

        {inspirationImages.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {inspirationImages.map((src, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-xl border">
                <img src={src} alt={`Inspiration ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  onClick={() => removeInspiration(i)}
                  className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/70"
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-6 text-center text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-100">
          <span>Upload inspiration photos</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={e => handleInspirationUpload(e.target.files)}
            className="hidden"
          />
        </label>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <Button
          onClick={onBack}
          variant="outline"
          className="flex-1 rounded-2xl border-2 py-6 text-base"
        >
          Back
        </Button>
        <Button
          onClick={validateAndNext}
          className="flex-1 rounded-2xl py-6 text-base text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
