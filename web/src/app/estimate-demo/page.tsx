/**
 * Demo page for the new public estimator stepper.
 * Access at /estimate-demo
 */

'use client';

import { PublicEstimatorStepper, type BrandingData } from '@/components/publicEstimator/PublicEstimatorStepper';

const DEMO_BRANDING: BrandingData = {
  brandName: 'Wealden Joinery',
  logoUrl: null,
  primaryColor: '#0ea5e9',
  secondaryColor: '#e0f2fe',
  heroImageUrl: null,
  reviewScore: 4.9,
  reviewCount: 128,
  reviewSourceLabel: 'Google Reviews',
  testimonials: [
    {
      name: 'Mr & Mrs Smith',
      location: 'Tunbridge Wells',
      quote: 'The quality of the windows exceeded our expectations. The team was professional throughout and the installation was seamless.',
    },
  ],
};

export default function EstimateDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <PublicEstimatorStepper
        branding={DEMO_BRANDING}
        onSave={(data) => {
          console.log('Auto-save:', data);
        }}
        onComplete={(data) => {
          console.log('Completed:', data);
        }}
      />
    </div>
  );
}
