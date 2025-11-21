/**
 * Demo page for the new public estimator stepper.
 * Access at /estimate-demo
 */

'use client';

import { PublicEstimatorStepper } from '@/components/publicEstimator/PublicEstimatorStepper';

export default function EstimateDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <PublicEstimatorStepper
        tenantSlug="wealden-joinery"
        onComplete={() => {
          console.log('Estimator completed!');
        }}
      />
    </div>
  );
}
