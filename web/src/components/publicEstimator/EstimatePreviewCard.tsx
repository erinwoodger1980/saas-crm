/**
 * EstimatePreviewCard - Live pricing display with favourites and sharing
 * Sticky/floating card that shows real-time estimate as user progresses through questionnaire
 */

'use client';

import { useState } from 'react';
import { Heart, Share2, ChevronUp, ChevronDown, Sparkles, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EstimatePreview } from '@/lib/publicEstimator/usePublicEstimator';

interface EstimatePreviewCardProps {
  estimate: EstimatePreview | null;
  isLoading: boolean;
  favouriteItemIds?: string[];
  onToggleFavourite?: (itemId: string) => void;
  onShare?: () => void;
  primaryColor?: string;
  companyName?: string;
  className?: string;
}

export function EstimatePreviewCard({
  estimate,
  isLoading,
  favouriteItemIds = [],
  onToggleFavourite,
  onShare,
  primaryColor = '#3b82f6',
  companyName = 'Us',
  className = '',
}: EstimatePreviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAllItems, setShowAllItems] = useState(false);

  // Show loading state
  if (isLoading) {
    return (
      <div className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-lg ${className}`}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200" style={{ borderTopColor: primaryColor }} />
          <div>
            <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
            <div className="mt-1 h-4 w-48 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  // Show empty state if no estimate yet
  if (!estimate) {
    return (
      <div className={`rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-lg ${className}`}>
        <div className="text-center">
          <div 
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-opacity-10"
            style={{ backgroundColor: primaryColor }}
          >
            <Sparkles className="h-6 w-6" style={{ color: primaryColor }} />
          </div>
          <h3 className="font-semibold text-slate-900">Your estimate will appear here</h3>
          <p className="mt-1 text-sm text-slate-600">
            Add your first opening to see live pricing
          </p>
        </div>
      </div>
    );
  }

  const visibleItems = showAllItems ? estimate.items : estimate.items.slice(0, 3);
  const hasMoreItems = estimate.items.length > 3;
  const favouritesCount = favouriteItemIds.length;

  return (
    <div className={`rounded-3xl border border-slate-200 bg-white shadow-xl ${className}`}>
      {/* Header */}
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="flex h-8 w-8 items-center justify-center rounded-full bg-opacity-10"
              style={{ backgroundColor: primaryColor }}
            >
              <Sparkles className="h-4 w-4" style={{ color: primaryColor }} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Your Estimate</h3>
              <p className="text-xs text-slate-500">{estimate.items.length} items</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onShare && (
              <button
                onClick={onShare}
                className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-slate-100"
                title="Share estimate"
              >
                <Share2 className="h-4 w-4 text-slate-600" />
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-slate-100"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-slate-600" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <>
          {/* Items list */}
          <div className="max-h-80 overflow-y-auto p-4">
            <div className="space-y-2">
              {visibleItems.map((item) => {
                const isFavourite = favouriteItemIds.includes(item.id);
                
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 transition hover:border-slate-200"
                  >
                    {onToggleFavourite && (
                      <button
                        onClick={() => onToggleFavourite(item.id)}
                        className="mt-0.5 flex-shrink-0 transition hover:scale-110"
                        title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
                      >
                        <Heart
                          className={`h-5 w-5 ${
                            isFavourite ? 'fill-current' : ''
                          }`}
                          style={{ color: isFavourite ? primaryColor : '#94a3b8' }}
                        />
                      </button>
                    )}
                    
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 line-clamp-2">
                        {item.description}
                      </p>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-sm text-slate-500">
                          Net: £{item.netGBP.toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-400">
                          +VAT £{item.vatGBP.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0 text-right">
                      <p className="font-semibold text-slate-900">
                        £{item.totalGBP.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500">inc. VAT</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMoreItems && !showAllItems && (
              <button
                onClick={() => setShowAllItems(true)}
                className="mt-3 w-full rounded-2xl border-2 border-slate-200 bg-white py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
              >
                Show {estimate.items.length - 3} more items
              </button>
            )}

            {showAllItems && hasMoreItems && (
              <button
                onClick={() => setShowAllItems(false)}
                className="mt-3 w-full rounded-2xl border-2 border-slate-200 bg-white py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
              >
                Show less
              </button>
            )}
          </div>

          {/* Favourites indicator */}
          {favouritesCount > 0 && (
            <div className="border-t border-slate-100 px-4 py-2">
              <div className="flex items-center gap-2 text-sm">
                <Heart className="h-4 w-4 fill-current" style={{ color: primaryColor }} />
                <span className="text-slate-600">
                  {favouritesCount} item{favouritesCount !== 1 ? 's' : ''} saved to favourites
                </span>
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="border-t border-slate-200 bg-slate-50 p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Net total</span>
                <span className="font-medium text-slate-900">
                  £{estimate.totalNet.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">VAT (20%)</span>
                <span className="font-medium text-slate-900">
                  £{estimate.totalVat.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="font-semibold text-slate-900">Total</span>
                <span 
                  className="text-2xl font-bold"
                  style={{ color: primaryColor }}
                >
                  £{estimate.totalGross.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          {estimate.disclaimer && (
            <div className="border-t border-slate-100 p-4">
              <div className="flex gap-2">
                <Info className="h-4 w-4 flex-shrink-0 text-slate-400 mt-0.5" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  {estimate.disclaimer}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Collapsed summary */}
      {!isExpanded && (
        <div className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">
              {estimate.items.length} items
              {favouritesCount > 0 && ` • ${favouritesCount} favourites`}
            </span>
            <span 
              className="text-xl font-bold"
              style={{ color: primaryColor }}
            >
              £{estimate.totalGross.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
