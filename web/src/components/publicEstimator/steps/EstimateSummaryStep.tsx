/**
 * EstimateSummaryStep - Review estimate with favourites, totals, and edit options
 * Final review before providing contact details
 */

'use client';

import { Heart, ChevronRight, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ItemEditCard } from './ItemEditCard';
import type { EstimatePreview } from '@/lib/publicEstimator/usePublicEstimator';

interface OpeningItem {
  id: string;
  type: string;
  location?: string;
  width?: number;
  height?: number;
  images?: string[];
  notes?: string;
}

interface EstimateSummaryStepProps {
  estimate: EstimatePreview | null;
  isLoading: boolean;
  favouriteItemIds?: string[];
  onToggleFavourite?: (itemId: string) => void;
  onEditItem?: (itemId: string) => void;
  onRemoveItem?: (itemId: string) => void;
  primaryColor?: string;
  companyName?: string;
  onNext: () => void;
  onBack: () => void;
  openingDetails?: OpeningItem[]; // Source data for inline editing
  onUpdateOpening?: (id: string, updates: Partial<OpeningItem>) => void;
  onTrackInteraction?: (type: string, metadata?: Record<string, any>) => void;
}

export function EstimateSummaryStep({
  estimate,
  isLoading,
  favouriteItemIds = [],
  onToggleFavourite,
  onEditItem,
  onRemoveItem,
  primaryColor = '#3b82f6',
  companyName = 'us',
  onNext,
  onBack,
  openingDetails = [],
  onUpdateOpening,
  onTrackInteraction,
}: EstimateSummaryStepProps) {
  const favouritedItems = estimate?.items.filter(item => 
    favouriteItemIds.includes(item.id)
  ) || [];
  
  const otherItems = estimate?.items.filter(item => 
    !favouriteItemIds.includes(item.id)
  ) || [];

  const favouritesTotal = favouritedItems.reduce((sum, item) => sum + item.totalGBP, 0);
  const othersTotal = otherItems.reduce((sum, item) => sum + item.totalGBP, 0);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Your estimate</h2>
          <p className="mt-2 text-slate-600">Loading your estimate...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200" style={{ borderTopColor: primaryColor }} />
        </div>
      </div>
    );
  }

  // No estimate yet
  if (!estimate || estimate.items.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Your estimate</h2>
          <p className="mt-2 text-slate-600">Review your selections and pricing</p>
        </div>
        
        <div className="rounded-3xl border-2 border-slate-200 bg-slate-50 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-4 font-semibold text-slate-900">No items added yet</h3>
          <p className="mt-2 text-sm text-slate-600">
            Go back and add some openings to see your estimate
          </p>
          <Button
            onClick={onBack}
            variant="outline"
            className="mt-6 rounded-2xl border-2"
          >
            Back to add items
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Your estimate</h2>
        <p className="mt-2 text-slate-600">
          Review your selections and pricing. You can edit or remove items before proceeding.
        </p>
      </div>

      {/* Favourites section */}
      {favouritedItems.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Heart className="h-5 w-5 fill-current" style={{ color: primaryColor }} />
            <h3 className="text-lg font-semibold text-slate-900">
              Your Favourites ({favouritedItems.length})
            </h3>
          </div>
          
          <div className="space-y-3">
            {favouritedItems.map((item) => (
              <ItemEditCard
                key={item.id}
                item={item}
                opening={openingDetails.find((o) => o.id === item.id)}
                isFavourite={true}
                primaryColor={primaryColor}
                onToggleFavourite={onToggleFavourite}
                onRemove={onRemoveItem}
                onUpdateOpening={onUpdateOpening}
                onTrackInteraction={onTrackInteraction}
              />
            ))}
          </div>
          
          {/* Favourites subtotal */}
          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700">Favourites subtotal</span>
              <span className="text-xl font-bold" style={{ color: primaryColor }}>
                £{favouritesTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Other items section */}
      {otherItems.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">
              {favouritedItems.length > 0 ? 'Other Items' : 'All Items'} ({otherItems.length})
            </h3>
          </div>
          
          <div className="space-y-3">
            {otherItems.map((item) => (
              <ItemEditCard
                key={item.id}
                item={item}
                opening={openingDetails.find((o) => o.id === item.id)}
                isFavourite={false}
                primaryColor={primaryColor}
                onToggleFavourite={onToggleFavourite}
                onRemove={onRemoveItem}
                onUpdateOpening={onUpdateOpening}
                onTrackInteraction={onTrackInteraction}
              />
            ))}
          </div>
          
          {favouritedItems.length > 0 && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">Other items subtotal</span>
                <span className="text-xl font-bold text-slate-900">
                  £{othersTotal.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Total section */}
      <div className="rounded-3xl border-2 p-6" style={{ borderColor: primaryColor, backgroundColor: `${primaryColor}05` }}>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-slate-700">
            <span>Net total</span>
            <span className="font-medium">£{estimate.totalNet.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-700">
            <span>VAT (20%)</span>
            <span className="font-medium">£{estimate.totalVat.toFixed(2)}</span>
          </div>
          <div className="border-t-2 border-slate-200 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-slate-900">Total estimate</span>
              <span className="text-3xl font-bold" style={{ color: primaryColor }}>
                £{estimate.totalGross.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      {estimate.disclaimer && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            <Sparkles className="mb-1 inline h-4 w-4" style={{ color: primaryColor }} />
            {' '}{estimate.disclaimer}
          </p>
        </div>
      )}

      {/* Next steps message */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-6">
        <h4 className="font-semibold text-slate-900">What happens next?</h4>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li className="flex gap-2">
            <ChevronRight className="h-5 w-5 flex-shrink-0" style={{ color: primaryColor }} />
            <span>We'll arrange a free site survey to confirm measurements</span>
          </li>
          <li className="flex gap-2">
            <ChevronRight className="h-5 w-5 flex-shrink-0" style={{ color: primaryColor }} />
            <span>We'll provide a detailed, itemized quote</span>
          </li>
          <li className="flex gap-2">
            <ChevronRight className="h-5 w-5 flex-shrink-0" style={{ color: primaryColor }} />
            <span>No obligation - you're free to compare quotes</span>
          </li>
        </ul>
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
          onClick={onNext}
          className="flex-1 rounded-2xl py-6 text-base text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Get your quote
        </Button>
      </div>
    </div>
  );
}
