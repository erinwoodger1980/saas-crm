/**
 * ItemEditCard - Expandable item card with inline editing
 */

'use client';

import { useState } from 'react';
import { Heart, Edit2, Trash2, Save, X, Ruler, MapPin } from 'lucide-react';

interface OpeningItem {
  id: string;
  type: string;
  location?: string;
  width?: number;
  height?: number;
  images?: string[];
  notes?: string;
}

interface ItemEditCardProps {
  item: {
    id: string;
    description: string;
    netGBP: number;
    vatGBP: number;
    totalGBP: number;
  };
  opening?: OpeningItem;
  isFavourite: boolean;
  primaryColor: string;
  onToggleFavourite?: (id: string) => void;
  onRemove?: (id: string) => void;
  onUpdateOpening?: (id: string, updates: Partial<OpeningItem>) => void;
  onTrackInteraction?: (type: string, metadata?: Record<string, any>) => void;
}

export function ItemEditCard({
  item,
  opening,
  isFavourite,
  primaryColor,
  onToggleFavourite,
  onRemove,
  onUpdateOpening,
  onTrackInteraction,
}: ItemEditCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<OpeningItem>>({});

  const handleStartEdit = () => {
    if (opening) {
      setEditForm({ ...opening });
      setIsEditing(true);
      setIsExpanded(true);
    }
  };

  const handleSaveEdit = () => {
    if (onUpdateOpening && opening) {
      onUpdateOpening(opening.id, editForm);
      onTrackInteraction?.('ITEM_UPDATED', { itemId: opening.id, fromStep: 5 });
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };

  return (
    <div
      className={`rounded-3xl border-2 bg-white transition ${
        isFavourite ? '' : 'hover:border-slate-300'
      }`}
      style={isFavourite ? { borderColor: `${primaryColor}40` } : {}}
    >
      {/* Main item row */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Favourite toggle */}
          {onToggleFavourite && (
            <button
              onClick={() => onToggleFavourite(item.id)}
              className="mt-1 flex-shrink-0 transition hover:scale-110"
            >
              <Heart
                className={`h-6 w-6 ${isFavourite ? 'fill-current' : 'text-slate-300 hover:text-slate-400'}`}
                style={isFavourite ? { color: primaryColor } : {}}
              />
            </button>
          )}

          {/* Item details */}
          <div className="min-w-0 flex-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-left w-full hover:opacity-80"
            >
              <p className="font-medium text-slate-900">{item.description}</p>
              {opening && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {opening.location && (
                    <span>
                      <MapPin className="inline h-3 w-3" /> {opening.location}
                    </span>
                  )}
                  {(opening.width || opening.height) && (
                    <span>
                      <Ruler className="inline h-3 w-3" />{' '}
                      {opening.width || '?'}×{opening.height || '?'}mm
                    </span>
                  )}
                </div>
              )}
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>Net: £{item.netGBP.toFixed(2)}</span>
              <span>•</span>
              <span>VAT: £{item.vatGBP.toFixed(2)}</span>
            </div>
          </div>

          {/* Price and actions */}
          <div className="flex flex-shrink-0 flex-col items-end gap-2">
            <p
              className="text-lg font-bold"
              style={isFavourite ? { color: primaryColor } : {}}
            >
              £{item.totalGBP.toFixed(2)}
            </p>
            <div className="flex gap-1">
              {opening && onUpdateOpening && !isEditing && (
                <button
                  onClick={handleStartEdit}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-slate-100"
                  title="Edit details"
                >
                  <Edit2 className="h-4 w-4 text-slate-600" />
                </button>
              )}
              {onRemove && (
                <button
                  onClick={() => onRemove(item.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-red-50"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded edit form */}
      {isExpanded && opening && isEditing && (
        <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Width (mm)
              </label>
              <input
                type="number"
                value={editForm.width ?? ''}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    width: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Height (mm)
              </label>
              <input
                type="number"
                value={editForm.height ?? ''}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    height: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Location
            </label>
            <input
              type="text"
              value={editForm.location ?? ''}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, location: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Notes
            </label>
            <textarea
              value={editForm.notes ?? ''}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={2}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              className="flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <Save className="h-4 w-4" /> Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
