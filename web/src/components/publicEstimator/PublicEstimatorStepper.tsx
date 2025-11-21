/**
 * Main public estimator stepper component.
 * Manages multi-step flow with state persistence and live pricing.
 */

'use client';

import { useState } from 'react';
import { ProgressBar } from './ProgressBar';
import { WelcomeStep } from './steps/WelcomeStep';
import { PropertyBasicsStep } from './steps/PropertyBasicsStep';

export interface BrandingData {
  brandName: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  heroImageUrl?: string;
  galleryImageUrls?: string[];
  reviewScore?: number;
  reviewCount?: number;
  reviewSourceLabel?: string;
  testimonials?: Array<{
    name: string;
    location?: string;
    quote: string;
  }>;
}

export interface EstimatorData {
  propertyType?: string;
  itemCount?: number;
  timeframe?: string;
  budget?: string;
  items?: Array<Record<string, any>>;
  globalSpecs?: {
    timber?: string;
    glass?: string;
    ironmongery?: string;
    finish?: string;
  };
}

interface PublicEstimatorStepperProps {
  branding: BrandingData;
  initialData?: EstimatorData;
  onSave?: (data: EstimatorData) => void;
  onComplete?: (data: EstimatorData) => void;
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
  branding,
  initialData = {},
  onSave,
  onComplete,
}: PublicEstimatorStepperProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<EstimatorData>(initialData);

  const handleDataChange = (updates: Partial<EstimatorData>) => {
    const newData = { ...data, ...updates };
    setData(newData);
    onSave?.(newData);
  };

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

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-6">
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
            brandName={branding.brandName}
            brandLogo={branding.logoUrl}
            heroImage={branding.heroImageUrl}
            reviewScore={branding.reviewScore}
            reviewCount={branding.reviewCount}
            reviewSource={branding.reviewSourceLabel}
            testimonials={branding.testimonials}
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
            onChange={handleDataChange}
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
  );
}
