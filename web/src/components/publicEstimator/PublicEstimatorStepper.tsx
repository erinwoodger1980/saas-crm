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
    isLoadingBranding,
    isLoadingEstimate,
    isSaving,
    updateData,
    toggleFavourite,
    trackInteraction,
  } = usePublicEstimator({
    tenantSlug,
    onError: (error) => console.error('Estimator error:', error),
  });

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

  const handleNext = () => {
    if (currentStep < STEP_LABELS.length) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
            onChange={updateData}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Opening details</h2>
            <p className="text-slate-600">
              Coming soon: Per-item capture with photos, measurements, and specs
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleBack}
                className="flex-1 rounded-2xl border-2 border-slate-200 px-6 py-3 font-medium transition hover:border-slate-300"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="flex-1 rounded-2xl px-6 py-3 font-medium text-white transition"
                style={{ backgroundColor: branding.primaryColor || '#3b82f6' }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {currentStep > 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">
              Step {currentStep}: {STEP_LABELS[currentStep - 1]}
            </h2>
            <p className="text-slate-600">Additional steps coming soon...</p>
            <button
              onClick={handleBack}
              className="w-full rounded-2xl border-2 border-slate-200 px-6 py-3 font-medium transition hover:border-slate-300"
            >
              Back
            </button>
          </div>
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
                onToggleFavourite={toggleFavourite}
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
