/**
 * Main public estimator stepper component.
 * Manages multi-step flow with state persistence and live pricing.
 */

'use client';

import { useState, useEffect } from 'react';
import { usePublicEstimator } from '@/lib/publicEstimator/usePublicEstimator';
import { ProgressBar } from './ProgressBar';
import { WelcomeStep } from './steps/WelcomeStep';
import { PropertyBasicsStep } from './steps/PropertyBasicsStep';
import { OpeningDetailsStep } from './steps/OpeningDetailsStep';
import { GlobalSpecsStep } from './steps/GlobalSpecsStep';
import { EstimateSummaryStep } from './steps/EstimateSummaryStep';
import { ContactConversionStep } from './steps/ContactConversionStep';
import { EstimatePreviewCard } from './EstimatePreviewCard';

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
];

export function PublicEstimatorStepper({
  tenantSlug,
  onComplete,
}: PublicEstimatorStepperProps) {
  const [currentStep, setCurrentStep] = useState(1);
  
  // Use the hook for state management, auto-save, and pricing
  const {
    branding,
    data,
    estimatePreview,
    entryContext,
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
      
      // Track completion
      await trackInteraction('QUESTIONNAIRE_COMPLETED');
      
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

    const shareData = {
      title: `${branding.name} - Estimate`,
      text: `My joinery estimate: £${estimatePreview.totalGross.toFixed(2)} for ${estimatePreview.items.length} items`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        trackInteraction('ESTIMATE_SHARED', { method: 'native' });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
        trackInteraction('ESTIMATE_SHARED', { method: 'clipboard' });
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
      
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Track progression
      trackInteraction('STEP_COMPLETED', { 
        step: fromStep, 
        stepName: fromStepName 
      });
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
          />
        )}

        {currentStep === 4 && (
          <GlobalSpecsStep
            globalSpecs={data.globalSpecs}
            primaryColor={branding.primaryColor}
            onChange={handleUpdateData}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep === 5 && (
          <EstimateSummaryStep
            estimate={estimatePreview}
            isLoading={isLoadingEstimate}
            favouriteItemIds={data.favouriteItemIds}
            onToggleFavourite={handleToggleFavourite}
            onEditItem={handleEditItem}
            onRemoveItem={handleRemoveItem}
            primaryColor={branding.primaryColor}
            companyName={branding.name}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep === 6 && (
          <ContactConversionStep
            contactDetails={data.contactDetails}
            entryMode={entryContext?.entryMode}
            isInviteMode={entryContext?.entryMode === 'INVITE'}
            primaryColor={branding.primaryColor}
            companyName={branding.name}
            onChange={handleUpdateData}
            onSubmit={handleFinalSubmit}
            onBack={handleBack}
          />
        )}
          </div>
        </div>

        {/* Estimate preview - sticky on desktop, below on mobile */}
        {currentStep >= 3 && (
          <div className="lg:col-span-5">
            <div className="mt-6 lg:sticky lg:top-6 lg:mt-0">
              <EstimatePreviewCard
                estimate={estimatePreview}
                isLoading={isLoadingEstimate}
                favouriteItemIds={data.favouriteItemIds}
                onToggleFavourite={handleToggleFavourite}
                onShare={handleShare}
                primaryColor={branding.primaryColor}
                companyName={branding.name}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
