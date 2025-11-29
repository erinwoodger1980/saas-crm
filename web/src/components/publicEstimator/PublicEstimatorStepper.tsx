/**
 * Main public estimator stepper component.
 * Manages multi-step flow with state persistence and live pricing.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { parseUtmParams, emitPublicAnalyticsEvent } from '@/lib/analytics';
import { usePublicEstimator } from '@/lib/publicEstimator/usePublicEstimator';
import { ProgressBar } from './ProgressBar';
import { WelcomeStep } from './steps/WelcomeStep';
import { PropertyBasicsStep } from './steps/PropertyBasicsStep';
import { OpeningDetailsStep } from './steps/OpeningDetailsStep';
import { SocialProofPanel } from './SocialProofPanel';
import { GlobalSpecsStep } from './steps/GlobalSpecsStep';
import { EstimateSummaryStep } from './steps/EstimateSummaryStep';
import { ContactConversionStep } from './steps/ContactConversionStep';
import { EstimatePreviewCard } from './EstimatePreviewCard';
import { DecisionStep } from './steps/DecisionStep';
import { Button } from '@/components/ui/button';

interface PublicEstimatorStepperProps {
  tenantSlug: string;
  onComplete?: () => void;
}

const STEP_LABELS = [
  'Welcome',
  'Property basics',
  'Opening details',
  'Specifications',
  'Your estimate',
  'Contact details',
  'Next steps',
];

export function PublicEstimatorStepper({
  tenantSlug,
  onComplete,
}: PublicEstimatorStepperProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const startedRef = useRef(false);
  const landingRef = useRef(false);

  const tenantId = (() => {
    if (typeof window === 'undefined') return 'demo';
    const sp = new URLSearchParams(window.location.search);
    return sp.get('tenantId') || localStorage.getItem('tenantId') || 'demo';
  })();

  // Emit landing once
  useEffect(() => {
    if (landingRef.current) return;
    landingRef.current = true;
    if (typeof window !== 'undefined') {
      const utm = parseUtmParams(window.location.search);
      const source = (utm.utm_source as any) || 'other';
      emitPublicAnalyticsEvent({ tenantId, type: 'landing', source, utm });
    }
  }, [tenantId]);
  
  // Use the hook for state management, auto-save, and pricing
  const {
    branding,
    data,
    estimatePreview,
    entryContext,
    clientFields,
    publicFields,
    isLoadingFields,
    isLoadingBranding,
    isLoadingEstimate,
    isSaving,
    updateData,
    toggleFavourite,
    trackInteraction,
    saveProject,
  } = usePublicEstimator({
    tenantSlug,
    onError: (error) => console.error('Estimator error:', error),
  });

  const isInviteMode = entryContext?.entryMode === 'INVITE';

  // Handle item removal from estimate summary
  const handleRemoveItem = (itemId: string) => {
    const updated = data.openingDetails?.filter(item => item.id !== itemId) || [];
    updateData({ openingDetails: updated });
    trackInteraction('ITEM_REMOVED', { itemId, remainingCount: updated.length });
  };

  // Handle editing item (go back to step 3)
  const handleEditItem = (itemId: string) => {
    setCurrentStep(3);
    trackInteraction('ITEM_EDITED', { itemId, fromStep: currentStep });
    // TODO: Scroll to specific item
  };

  // Wrap toggle favourite to add tracking
  const handleToggleFavourite = (itemId: string) => {
    const wasFavourite = data.favouriteItemIds?.includes(itemId);
    toggleFavourite(itemId);
    trackInteraction('ESTIMATE_FAVOURITED', { 
      itemId, 
      action: wasFavourite ? 'removed' : 'added',
      totalFavourites: wasFavourite 
        ? (data.favouriteItemIds?.length || 1) - 1 
        : (data.favouriteItemIds?.length || 0) + 1
    });
  };

  // Wrap updateData to add tracking for specific updates
  const handleUpdateData = (updates: any) => {
    // Track when items are added/updated
    if (updates.openingDetails) {
      const oldCount = data.openingDetails?.length || 0;
      const newCount = updates.openingDetails.length;
      
      if (newCount > oldCount) {
        trackInteraction('ITEM_ADDED', { 
          itemCount: newCount,
          step: currentStep 
        });
      } else if (newCount === oldCount) {
        trackInteraction('ITEM_UPDATED', { 
          itemCount: newCount,
          step: currentStep 
        });
      }
    }
    
    // Track spec selections
    if (updates.globalSpecs) {
      const specs = updates.globalSpecs;
      const specCount = Object.keys(specs).filter(k => specs[k]).length;
      trackInteraction('SPECS_UPDATED', { 
        specCount,
        hasTimber: !!specs.timberType,
        hasGlass: !!specs.glassType,
        hasFinish: !!specs.finish,
        step: currentStep
      });
    }
    
    updateData(updates);
  };

  // Handle final submission
  const handleFinalSubmit = async () => {
    try {
      // Save final project state
      await saveProject();
      setHasSubmitted(true);
      
      // Track completion
      await trackInteraction('QUESTIONNAIRE_COMPLETED');

      // Emit estimator_complete
      if (typeof window !== 'undefined') {
        const utm = parseUtmParams(window.location.search);
        const source = (utm.utm_source as any) || 'other';
        emitPublicAnalyticsEvent({ tenantId, type: 'estimator_complete', source, utm });
      }
      
      // Advance to decision step
      setCurrentStep(7);
      // Call parent completion handler
      onComplete?.();
    } catch (error) {
      console.error('Submission error:', error);
      throw error;
    }
  };

  // Handle share functionality using Web Share API
  const handleShare = async () => {
    if (!estimatePreview || !branding) return;
    // Ensure project persisted before sharing so link is resumable
    const id = await saveProject();
    let shareUrl = window.location.href;
    if (id) {
      const url = new URL(window.location.href);
      url.searchParams.set('projectId', id);
      url.searchParams.set('tenant', branding.slug);
      shareUrl = url.toString();
      // Update current history to reflect canonical share URL
      window.history.replaceState({}, '', shareUrl);
    }

    const safe = (v: number | undefined | null) => Number.isFinite(v as number) ? Number(v).toFixed(2) : '0.00';
    const shareText = (entryContext?.entryMode === 'INVITE')
      ? `My joinery estimate: £${safe(estimatePreview.totalGross)} for ${estimatePreview.items.length} items`
      : `My joinery estimate for ${estimatePreview.items.length} items`;
    const shareData = {
      title: `${branding.name} - Estimate`,
      text: shareText,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        trackInteraction('ESTIMATE_SHARED', { method: 'native', hasProjectId: Boolean(id) });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied to clipboard!');
        trackInteraction('ESTIMATE_SHARED', { method: 'clipboard', hasProjectId: Boolean(id) });
      }
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  // Track when user starts the questionnaire
  useEffect(() => {
    if (currentStep === 1 && branding) {
      trackInteraction('QUESTIONNAIRE_STARTED');
    }
  }, [currentStep, branding, trackInteraction]);

  // Track step progression
  useEffect(() => {
    if (currentStep > 1 && branding) {
      const stepName = STEP_LABELS[currentStep - 1];
      trackInteraction('STEP_VIEWED', { 
        step: currentStep, 
        stepName,
        totalSteps: STEP_LABELS.length 
      });
    }
  }, [currentStep, branding, trackInteraction]);

  // Track when estimate is first previewed
  useEffect(() => {
    if (estimatePreview && estimatePreview.items.length > 0) {
      trackInteraction('ESTIMATE_PREVIEWED', {
        itemCount: estimatePreview.items.length,
        totalGross: estimatePreview.totalGross,
        step: currentStep,
      });
    }
  }, [estimatePreview?.items.length]); // Only track when item count changes

  const handleNext = () => {
    if (currentStep < STEP_LABELS.length) {
      const fromStep = currentStep;
      const fromStepName = STEP_LABELS[fromStep - 1];
      const nextStep = fromStep + 1;
      
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Track progression
      trackInteraction('STEP_COMPLETED', { 
        step: fromStep, 
        stepName: fromStepName 
      });

      // Emit estimator_start when leaving welcome step first time
      if (!startedRef.current && fromStep === 1) {
        startedRef.current = true;
        if (typeof window !== 'undefined') {
          const utm = parseUtmParams(window.location.search);
          const source = (utm.utm_source as any) || 'other';
          emitPublicAnalyticsEvent({ tenantId, type: 'estimator_start', source, utm });
        }
      }

      // Emit consolidated estimator_step event on step transition (after welcome)
      if (typeof window !== 'undefined' && fromStep >= 1) {
        try {
          const utm = parseUtmParams(window.location.search);
          const source = (utm.utm_source as any) || 'other';
          emitPublicAnalyticsEvent({ tenantId, type: 'estimator_step', source, utm, stepIndex: nextStep });
        } catch {}
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Show loading state while branding loads
  if (isLoadingBranding) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900 mx-auto" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!branding) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4">
        <div className="text-center">
          <p className="text-slate-600">Unable to load estimator. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen px-4 py-6 lg:max-w-7xl">
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        {/* Main content area */}
        <div className="lg:col-span-7">
          {/* Progress indicator */}
          {currentStep > 1 && (
            <div className="mb-6">
              <ProgressBar
                currentStep={currentStep - 1}
                totalSteps={STEP_LABELS.length - 1}
                stepLabels={STEP_LABELS.slice(1)}
                brandColor={branding.primaryColor}
              />
            </div>
          )}

          {/* Step content */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg md:p-8">
        {currentStep === 1 && (
          <WelcomeStep
            brandName={branding.name}
            brandLogo={branding.logoUrl}
            heroImage={branding.heroImageUrl}
            reviewScore={branding.reviewScore}
            reviewCount={branding.reviewCount}
            reviewSource={branding.reviewSourceLabel}
            testimonials={branding.testimonials?.map(t => ({
              name: t.author,
              quote: t.text,
            }))}
            primaryColor={branding.primaryColor}
            onNext={handleNext}
          />
        )}

        {currentStep === 2 && (
          <PropertyBasicsStep
            propertyType={data.propertyType}
            itemCount={data.itemCount}
            timeframe={data.timeframe}
            budget={data.budget}
            primaryColor={branding.primaryColor}
            onChange={handleUpdateData}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep === 3 && (
          <OpeningDetailsStep
            items={data.openingDetails}
            primaryColor={branding.primaryColor}
            onChange={handleUpdateData}
            onNext={handleNext}
            onBack={handleBack}
            inspirationImages={data.inspirationImages || []}
            onInspirationChange={(images) => handleUpdateData({ inspirationImages: images })}
          />
        )}

        {currentStep === 4 && (
          <GlobalSpecsStep
            globalSpecs={data.globalSpecs}
            primaryColor={branding.primaryColor}
            fields={publicFields}
            isLoadingFields={isLoadingFields}
            onChange={handleUpdateData}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep === 5 && (
          <EstimateSummaryStep
            estimate={estimatePreview}
            // Treat null estimate WITH items as loading to prevent confusing "No items" flash
            isLoading={isLoadingEstimate || (!isLoadingEstimate && !estimatePreview && (data.openingDetails?.length || 0) > 0)}
            favouriteItemIds={data.favouriteItemIds}
            onToggleFavourite={handleToggleFavourite}
            onEditItem={handleEditItem}
            onRemoveItem={handleRemoveItem}
            primaryColor={branding.primaryColor}
            companyName={branding.name}
            onNext={handleNext}
            onBack={handleBack}
            openingDetails={data.openingDetails}
            onUpdateOpening={(id, updates) => {
              const updated = data.openingDetails?.map((item) =>
                item.id === id ? { ...item, ...updates } : item
              );
              handleUpdateData({ openingDetails: updated });
            }}
            onTrackInteraction={trackInteraction}
            hidePrices={!isInviteMode}
          />
        )}

        {currentStep === 6 && (
          <ContactConversionStep
            contactDetails={data.contactDetails}
            entryMode={entryContext?.entryMode}
            isInviteMode={entryContext?.entryMode === 'INVITE'}
            primaryColor={branding.primaryColor}
            companyName={branding.name}
            fields={clientFields}
            isLoadingFields={isLoadingFields}
            onChange={handleUpdateData}
            onSubmit={handleFinalSubmit}
            onBack={handleBack}
          />
        )}

        {currentStep === 7 && (
          isInviteMode ? (
            <DecisionStep
              totalGross={estimatePreview?.totalGross}
              primaryColor={branding.primaryColor}
              companyName={branding.name}
              onDoOwnQuote={() => {
                trackInteraction('DECISION_SELF_QUOTE');
                alert('Download starting… (stub)');
              }}
              onSendMlEstimate={async () => {
                try {
                  trackInteraction('DECISION_SEND_ML_ESTIMATE');
                  await saveProject();
                  alert('Estimate sent to company (stub).');
                } catch (e) {
                  console.error(e);
                }
              }}
              onFinish={() => {
                trackInteraction('DECISION_FINISH');
                window.location.href = `/q/thank-you?tenant=${branding.slug}`;
              }}
            />
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div
                  className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-opacity-10"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  {/* Sparkles icon substitute to avoid extra import here */}
                  <span className="text-xl" style={{ color: branding.primaryColor }}>✨</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Thanks — request received!</h2>
                <p className="mt-2 text-slate-600">
                  Our joiner will confirm your measurements and finalize your quote. We’ll email your confirmed price and next steps shortly.
                </p>
              </div>

              <div className="rounded-2xl border-2 border-slate-200 bg-white p-5">
                <h3 className="text-lg font-semibold text-slate-900">What happens now?</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>1) We review your selections and photos</li>
                  <li>2) If needed, we’ll arrange a quick call/site check</li>
                  <li>3) We send your confirmed, itemized quote by email</li>
                </ul>
              </div>

              <div className="flex justify-center pt-2">
                <Button
                  onClick={() => {
                    trackInteraction('DECISION_FINISH');
                    window.location.href = `/q/thank-you?tenant=${branding.slug}`;
                  }}
                  className="rounded-2xl text-white"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  Finish
                </Button>
              </div>
            </div>
          )
        )}
          </div>
        </div>

        {/* Estimate preview - sticky on desktop, below on mobile */}
        {currentStep >= 3 && (
          <div className="lg:col-span-5">
            <div className="mt-6 lg:sticky lg:top-6 lg:mt-0">
                  <EstimatePreviewCard
                    estimate={estimatePreview}
                    // Only show loading if no estimate yet (prevent flicker during refresh)
                    isLoading={(!estimatePreview) && isLoadingEstimate}
                    favouriteItemIds={data.favouriteItemIds}
                    onToggleFavourite={handleToggleFavourite}
                    onShare={handleShare}
                    primaryColor={branding.primaryColor}
                    companyName={branding.name}
                    hidePrices={!isInviteMode}
                  />
              {/* Social Proof */}
              <div className="mt-4">
                <SocialProofPanel branding={branding} primaryColor={branding.primaryColor} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
