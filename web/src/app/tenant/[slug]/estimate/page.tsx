import { Metadata } from 'next';
import { PublicEstimatorStepper } from '@/components/publicEstimator/PublicEstimatorStepper';

export const metadata: Metadata = {
  title: 'Get Your Estimate | Joinery Services',
  description:
    'Get a detailed estimate for custom joinery. Submit your project details and receive a quote within 24 hours.',
  keywords: [
    'estimate',
    'quote',
    'windows',
    'doors',
    'custom joinery',
  ],
};

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    leadId?: string;
    token?: string;
  }>;
}

export default async function TenantEstimatePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { leadId, token } = await searchParams;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <PublicEstimatorStepper tenantSlug={slug} />
    </div>
  );
}
