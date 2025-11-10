import { Suspense } from 'react';
import { Metadata } from 'next';
import { fetchTenantFromDB } from '@/lib/landing-api';
import { PublicLandingClient } from './client';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ kw?: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { kw: keyword } = await searchParams;
  
  try {
    const tenant = await fetchTenantFromDB(slug, false);
    
    if (!tenant) {
      return { title: 'Tenant Not Found' };
    }

    const location = tenant.content?.serviceAreas?.[0] || 'Your Area';
    const title = keyword 
      ? `${keyword} in ${location} | ${tenant.name}`
      : `${tenant.name} - Beautifully Crafted Timber Windows & Doors`;
    
    const description = keyword
      ? `Expert ${keyword.toLowerCase()} services in ${location}. ${tenant.name} provides heritage quality with modern performance. Get your free quote today!`
      : `${tenant.name} provides bespoke timber windows and doors in ${location}. PAS 24 certified, 50-year guarantee. Serving ${tenant.content?.serviceAreas?.slice(0, 3).join(', ') || location}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: tenant.images?.[0]?.url ? [{ url: tenant.images[0].url }] : [],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: tenant.images?.[0]?.url ? [tenant.images[0].url] : [],
      },
    };
  } catch {
    return { title: 'Landing Page' };
  }
}

export default async function TenantLandingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { kw: keyword } = await searchParams;

  let tenant;
  try {
    tenant = await fetchTenantFromDB(slug, false);
  } catch (error) {
    console.error('Failed to load tenant:', error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Tenant Not Found</h1>
          <p className="text-gray-600">The landing page for &quot;{slug}&quot; could not be loaded.</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Tenant Not Found</h1>
          <p className="text-gray-600">The landing page for &quot;{slug}&quot; could not be loaded.</p>
        </div>
      </div>
    );
  }

  // Transform DB data to component-friendly format
  const location = tenant.content?.serviceAreas?.[0] || 'Your Area';
  const serviceAreas = tenant.content?.serviceAreas || [];
  const images = tenant.images || [];
  const reviews = tenant.reviews || [];
  
  // Safe JSON parser helper
  function safeJsonParse<T>(value: unknown, fallback: T): T {
    try {
      if (value == null) return fallback;
      if (typeof value === 'string') return JSON.parse(value) as T;
      if (typeof value === 'object') return value as T;
      return fallback;
    } catch {
      return fallback;
    }
  }
  
  // Parse JSON fields if they're strings
  const guarantees = safeJsonParse(tenant.content?.guarantees, {
    bullets: [
      '50-year anti-rot guarantee on Accoya timber',
      'PAS 24 security certification',
      'FENSA approved installation',
      'Insurance-backed warranty',
      'Free design consultation',
    ],
    riskReversal: 'If you\'re not 100% satisfied with your quote, we\'ll refund your deposit.',
  });
      
  const urgency = safeJsonParse(tenant.content?.urgency, {
    text: '🔥 Book a survey in January and save 10%',
    sub: 'Limited slots available',
  });
      
  const leadMagnet = safeJsonParse(tenant.content?.leadMagnet, {
    title: '10 Questions to Ask Before Choosing Windows',
    description: 'Free guide to making the right choice for your home',
  });

  const headline = keyword
    ? `Expert ${keyword} in ${location}`
    : tenant.content?.headline || `Beautifully Crafted Timber Windows & Doors in ${location}`;
    
  const subheadline = keyword
    ? `Heritage quality meets modern performance — made by ${tenant.name}`
    : tenant.content?.subhead || `Heritage quality meets modern performance — made by ${tenant.name}`;

  return (
    <Suspense fallback={<LoadingState />}>
      <PublicLandingClient
        tenant={tenant}
        headline={headline}
        subheadline={subheadline}
        keyword={keyword}
        location={location}
        serviceAreas={serviceAreas}
        images={images}
        reviews={reviews}
        guarantees={guarantees}
        urgency={urgency}
        leadMagnet={leadMagnet}
      />
    </Suspense>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

