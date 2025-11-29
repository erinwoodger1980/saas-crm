/**
 * OpeningDetailsStep - Per-item capture with photos, measurements, and specs
 * Mobile-first design for capturing door/window details
 */

'use client';

import { useState } from 'react';
import ExamplePhotoGallery from '@/components/example-photo-gallery';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { QuestionnaireField } from '@/lib/questionnaireFields';
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
  inferenceSource?: 'heuristic' | 'ai' | 'depth';
  inferenceConfidence?: number;
}

interface OpeningDetailsStepProps {
  items?: OpeningItem[];
  primaryColor?: string;
  onChange: (data: { openingDetails: OpeningItem[] }) => void;
  onNext: () => void;
  onBack: () => void;
  inspirationImages?: string[];
  onInspirationChange?: (images: string[]) => void;
  tenantId?: string;
  onPrefillGlobalSpecs?: (specs: Record<string, any>) => void;
  publicFields?: QuestionnaireField[];
  onTrackInteraction?: (event: string, metadata?: Record<string, any>) => void;
  currentGlobalSpecs?: Record<string, any>;
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
  tenantId,
  onPrefillGlobalSpecs,
  publicFields = [],
  onTrackInteraction,
  currentGlobalSpecs = {},
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
  const [showGallery, setShowGallery] = useState(false);
  const [specConflict, setSpecConflict] = useState<string[] | null>(null);
  const [lastExamplePrice, setLastExamplePrice] = useState<number | null>(null);
  const [pendingExampleSpecs, setPendingExampleSpecs] = useState<any | null>(null);
  const [pendingExamplePhoto, setPendingExamplePhoto] = useState<any | null>(null);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [applyTargetId, setApplyTargetId] = useState<string | null>(null);
  const [applyOptions, setApplyOptions] = useState({
    width: true,
    height: true,
    thickness: true,
    notes: true,
    globalSpecs: true,
    inspirationImage: true,
    price: true,
  });
  const [previousGlobalSpecs, setPreviousGlobalSpecs] = useState<Record<string, any> | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const toggleApplyOption = (key: keyof typeof applyOptions) => {
    setApplyOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const applyExampleSelection = () => {
    if (!pendingExampleSpecs || !pendingExamplePhoto) return;
    const targetId = applyTargetId || currentItems[0]?.id;
    if (targetId) {
      const target = currentItems.find(i => i.id === targetId);
      if (target) {
        const updates: Partial<OpeningItem> = {};
        if (applyOptions.width && !target.width && pendingExampleSpecs.widthMm) updates.width = pendingExampleSpecs.widthMm;
        if (applyOptions.height && !target.height && pendingExampleSpecs.heightMm) updates.height = pendingExampleSpecs.heightMm;
        if (applyOptions.notes && !target.notes && pendingExampleSpecs.tags) updates.notes = `Inspired by: ${pendingExampleSpecs.tags.join(', ')}`;
        handleUpdateItem(targetId, updates);
      }
    }
    if (applyOptions.globalSpecs && onPrefillGlobalSpecs) {
      const mapped: Record<string, any> = {};
      if (pendingExampleSpecs.timberSpecies) mapped.timberType = pendingExampleSpecs.timberSpecies;
      if (pendingExampleSpecs.glassType) mapped.glassType = pendingExampleSpecs.glassType;
      if (pendingExampleSpecs.finishType) mapped.finish = pendingExampleSpecs.finishType;
      const answers = pendingExampleSpecs.questionnaireAnswers || {};
      const validKeys = new Set(publicFields.map(f => f.key));
      Object.keys(answers).forEach(k => { if (validKeys.has(k)) mapped[k] = answers[k]?.value; });
      mapped.inspirationExampleId = pendingExamplePhoto.id;
      if (applyOptions.price && pendingExamplePhoto.priceGBP) {
        mapped.inspirationExamplePrice = pendingExamplePhoto.priceGBP;
        setLastExamplePrice(pendingExamplePhoto.priceGBP);
      }
      // Conflict detection vs existing specs
      const overridden: string[] = [];
      Object.keys(mapped).forEach(k => {
        if (currentGlobalSpecs && k in currentGlobalSpecs && currentGlobalSpecs[k] !== mapped[k]) {
          overridden.push(k);
        }
      });
      setPreviousGlobalSpecs(currentGlobalSpecs); // snapshot for revert
      onPrefillGlobalSpecs(mapped);
      const populatedKeys = Object.keys(mapped);
      if (populatedKeys.length) {
        setSpecConflict(overridden.length ? overridden : populatedKeys);
        setTimeout(() => setSpecConflict(null), 5000);
      }
    }
    if (applyOptions.inspirationImage && pendingExamplePhoto.imageUrl) {
      onInspirationChange?.([...inspirationImages, pendingExamplePhoto.imageUrl]);
    }
    onTrackInteraction?.('EXAMPLE_APPLY_CONFIRMED', {
      photoId: pendingExamplePhoto.id,
      targetOpeningId: targetId,
      options: applyOptions,
    });
    setShowApplyDialog(false);
    setPendingExampleSpecs(null);
    setPendingExamplePhoto(null);
  };

  const revertExampleApply = () => {
    if (!previousGlobalSpecs || !onPrefillGlobalSpecs) return;
    onPrefillGlobalSpecs(previousGlobalSpecs);
    onTrackInteraction?.('EXAMPLE_APPLY_REVERTED', { previousKeys: Object.keys(previousGlobalSpecs) });
    setPreviousGlobalSpecs(null);
  };

  const handleAddItem = () => {
    const newItem: OpeningItem = {
      id: `item-${Date.now()}`,
      type: 'external_door',
    };
    const next = [...currentItems, newItem];
    setCurrentItems(next);
    // Persist immediately so upstream preview + autosave can react
    onChange({ openingDetails: next });
            <ExamplePhotoGallery
              tenantId={tenantId}
              onSelect={({ specifications, photo }) => {
                setPendingExampleSpecs(specifications);
                setPendingExamplePhoto(photo);
                setApplyTargetId(currentItems[0]?.id || null);
                setShowApplyDialog(true);
                onTrackInteraction?.('EXAMPLE_SELECTED', {
                  photoId: photo.id,
                  hasWidth: Boolean(specifications.widthMm),
                  hasHeight: Boolean(specifications.heightMm),
                  tagCount: Array.isArray(specifications.tags) ? specifications.tags.length : 0,
                  questionnaireAnswerCount: specifications.questionnaireAnswers ? Object.keys(specifications.questionnaireAnswers).length : 0,
                });
              }}
              onClose={() => setShowGallery(false)}
            />
      } catch {}
    });
    const merged = [...existing, ...next];
    onInspirationChange?.(merged);
      {/* Apply Example Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="max-w-lg">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Apply Example</h3>
            {pendingExamplePhoto && (
              <div className="flex items-center gap-3">
                <img src={pendingExamplePhoto.thumbnailUrl || pendingExamplePhoto.imageUrl} alt={pendingExamplePhoto.title} className="h-16 w-16 rounded-lg object-cover" />
                <div className="text-sm">
                  <div className="font-medium">{pendingExamplePhoto.title}</div>
                  {pendingExamplePhoto.priceGBP && (
                    <div className="text-slate-600">Approx £{pendingExamplePhoto.priceGBP.toFixed(2)}</div>
                  )}
                </div>
              </div>
            )}
            {/* Target opening */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Target opening</label>
              <div className="space-y-2">
                {currentItems.map(it => (
                  <label key={it.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="applyOpening"
                      checked={applyTargetId === it.id}
                      onChange={() => setApplyTargetId(it.id)}
                    />
                    <span>Opening {currentItems.indexOf(it)+1} ({it.type.replace(/_/g,' ')})</span>
                  </label>
                ))}
              </div>
            </div>
            {/* Options */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {Object.entries(applyOptions).map(([key,val]) => (
                <label key={key} className="flex items-center gap-2">
                  <input type="checkbox" checked={val} onChange={() => toggleApplyOption(key as keyof typeof applyOptions)} />
                  <span className="capitalize">Apply {key}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={applyExampleSelection}
                className="flex-1"
                style={{ backgroundColor: primaryColor }}
              >
                Apply Example
              </Button>
              <Button variant="outline" onClick={() => { setShowApplyDialog(false); setPendingExamplePhoto(null); setPendingExampleSpecs(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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

            {/* Measurements + Confidence */}
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
              {item.inferenceConfidence !== undefined && (
                <div className="mt-2 text-xs inline-flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full font-medium ${item.inferenceConfidence >= 0.7 ? 'bg-green-100 text-green-700' : item.inferenceConfidence >= 0.4 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}
                        title={`Source: ${item.inferenceSource || 'unknown'} | ${(item.inferenceConfidence*100).toFixed(0)}% confidence`}>
                    {(item.inferenceConfidence*100).toFixed(0)}% confidence
                  </span>
                  <span className="text-slate-500">{item.inferenceSource === 'ai' ? 'AI inferred' : 'Heuristic estimate'}</span>
                </div>
              )}
              <p className="mt-1 text-xs text-slate-500">
                Don't worry if you're not sure - we'll measure accurately during our site visit
              </p>
              {/* Depth / LiDAR stub trigger */}
              <div className="mt-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      // Mock planar point cloud (units arbitrary; server heuristic scales)
                      const pts = [
                        { x: 0, y: 0, z: 0 },
                        { x: 1, y: 0, z: 0 },
                        { x: 1, y: 2, z: 0 },
                        { x: 0, y: 2, z: 0 }
                      ];
                      const resp = await fetch(`/api/public/vision/depth-analyze`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ points: pts, openingType: item.type })
                      });
                      if (resp.ok) {
                        const d = await resp.json();
                        handleUpdateItem(item.id, {
                          width: item.width || d.width_mm || undefined,
                          height: item.height || d.height_mm || undefined,
                          notes: !item.notes ? d.description : item.notes,
                          inferenceSource: 'depth',
                          inferenceConfidence: d.confidence ?? item.inferenceConfidence,
                        });
                      }
                    } catch {}
                  }}
                  className="text-xs px-3 py-1 rounded-full border border-slate-300 bg-white hover:bg-slate-50"
                >Use Depth Stub</button>
              </div>
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

          {/* Browse curated examples */}
          {tenantId && (
            <div>
              <Button
                type="button"
                onClick={() => {
                  setShowGallery(true);
                  onTrackInteraction?.('GALLERY_OPENED', { openingCount: currentItems.length });
                }}
                className="rounded-2xl mb-4"
                style={{ backgroundColor: primaryColor }}
              >
                Browse inspiration gallery
              </Button>
              <p className="text-xs text-slate-500 mb-2">Choose a curated example to pre-fill measurements and spec preferences.</p>
            </div>
          )}

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

        {/* Example gallery dialog */}
        <Dialog open={showGallery} onOpenChange={setShowGallery}>
          <DialogContent className="max-w-xl">
            {tenantId && (
              <ExamplePhotoGallery
                tenantId={tenantId}
                onSelect={({ specifications, photo }) => {
                  try {
                    // Apply width/height/thickness to first opening lacking them
                    const targetId = currentItems[0]?.id;
                    if (targetId && specifications) {
                      const target = currentItems.find(i => i.id === targetId);
                      if (target) {
                        const updates: Partial<OpeningItem> = {};
                        if (!target.width && specifications.widthMm) updates.width = specifications.widthMm;
                        if (!target.height && specifications.heightMm) updates.height = specifications.heightMm;
                        if (!target.notes && specifications.tags) updates.notes = `Inspired by: ${specifications.tags.join(', ')}`;
                        handleUpdateItem(targetId, updates);
                      }
                    }
                    // Prefill global specs and dynamic questionnaire answers if callback provided
                    if (onPrefillGlobalSpecs && specifications) {
                      const mapped: Record<string, any> = {};
                      if (specifications.timberSpecies) mapped.timberType = specifications.timberSpecies;
                      if (specifications.glassType) mapped.glassType = specifications.glassType;
                      if (specifications.finishType) mapped.finish = specifications.finishType;
                      const answers = specifications.questionnaireAnswers || {};
                      const validKeys = new Set(publicFields.map(f => f.key));
                      Object.keys(answers).forEach(k => {
                        if (validKeys.has(k)) mapped[k] = answers[k]?.value;
                      });
                      mapped.inspirationExampleId = photo.id;
                      if (photo.priceGBP) {
                        mapped.inspirationExamplePrice = photo.priceGBP;
                        setLastExamplePrice(photo.priceGBP);
                      }
                      // Detect conflicts (existing different values)
                      const existingKeys = Object.keys(mapped).filter(k => (mapped[k] != null));
                      const conflicts = existingKeys.filter(k => {
                        // @ts-ignore parent global specs not accessible here directly; rely on callback consumer
                        return false; // conflict detection delegated below
                      });
                      onPrefillGlobalSpecs(mapped);
                      if (existingKeys.length) {
                        // Show banner listing populated keys rather than true conflicts (simplified for public UX)
                        setSpecConflict(existingKeys);
                        setTimeout(() => setSpecConflict(null), 4000);
                      }
                    }
                    // Add image to inspiration list if available
                    if (photo?.imageUrl) {
                      onInspirationChange?.([...inspirationImages, photo.imageUrl]);
                    }
                    onTrackInteraction?.('EXAMPLE_SELECTED', {
                      photoId: photo.id,
                      hasWidth: Boolean(specifications.widthMm),
                      hasHeight: Boolean(specifications.heightMm),
                      tagCount: Array.isArray(specifications.tags) ? specifications.tags.length : 0,
                      questionnaireAnswerCount: specifications.questionnaireAnswers ? Object.keys(specifications.questionnaireAnswers).length : 0,
                    });
                  } catch (e) {
                    console.error('Failed applying example selection', e);
                  } finally {
                    setShowGallery(false);
                  }
                }}
                onClose={() => setShowGallery(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
        {specConflict && (
          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
            {previousGlobalSpecs ? 'Overrode: ' : 'Prefilled: '} {specConflict.join(', ')} {lastExamplePrice ? `(Example approx £${lastExamplePrice.toFixed(2)})` : ''}
            <div className="mt-2 flex gap-2">
              {previousGlobalSpecs && (
                <button
                  onClick={revertExampleApply}
                  className="text-xs px-2 py-1 rounded-full border border-amber-300 bg-white hover:bg-amber-100"
                >Undo</button>
              )}
              {pendingExamplePhoto && (
                <button
                  onClick={() => setShowDetailsDialog(true)}
                  className="text-xs px-2 py-1 rounded-full border border-amber-300 bg-white hover:bg-amber-100"
                >Details</button>
              )}
            </div>
          </div>
        )}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-lg">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Example Specification</h3>
              {pendingExamplePhoto && (
                <div className="flex items-center gap-3">
                  <img src={pendingExamplePhoto.thumbnailUrl || pendingExamplePhoto.imageUrl} alt={pendingExamplePhoto.title} className="h-16 w-16 rounded-lg object-cover" />
                  <div className="text-sm">
                    <div className="font-medium">{pendingExamplePhoto.title}</div>
                    {pendingExamplePhoto.priceGBP && <div className="text-slate-600">Approx £{pendingExamplePhoto.priceGBP.toFixed(2)}</div>}
                  </div>
                </div>
              )}
              {pendingExampleSpecs && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {['widthMm','heightMm','thicknessMm','timberSpecies','glassType','finishType','fireRating','productType'].map(key => (
                    pendingExampleSpecs[key] ? (
                      <div key={key} className="flex flex-col">
                        <span className="text-slate-500">{key.replace(/Mm/g,' (mm)').replace(/([A-Z])/g,' $1')}</span>
                        <span className="font-medium text-slate-700 break-all">{pendingExampleSpecs[key]}</span>
                      </div>
                    ) : null
                  ))}
                </div>
              )}
              {pendingExampleSpecs?.questionnaireAnswers && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2">Questionnaire Answers</h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {Object.entries(pendingExampleSpecs.questionnaireAnswers).map(([k,v]: any) => (
                      <div key={k} className="text-xs flex justify-between gap-2 border-b border-slate-100 py-1">
                        <span className="text-slate-500">{v.label || k}</span>
                        <span className="font-medium text-slate-700">{String(v.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>Close</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
