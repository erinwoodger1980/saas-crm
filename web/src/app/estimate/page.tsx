import { Metadata } from 'next';
import PublicEstimatorWizard from '@/components/publicEstimator/PublicEstimatorWizard';

export const metadata: Metadata = {
  title: 'Get Your Estimate | Sash Windows & Doors',
  description:
    'Get a detailed estimate for custom sash windows and doors. Submit your project details and receive a quote within 24 hours.',
  keywords: [
    'estimate',
    'quote',
    'sash windows',
    'doors',
    'custom joinery',
  ],
};

export default function EstimatePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <PublicEstimatorWizard />
    </div>
  );
}
