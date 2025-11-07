import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LandingPageContent from '@/components/LandingPageContent';
import { buildSeoData } from '@/lib/seo-builder';
import { NearbyTenants } from '@/components/NearbyTenants';

interface PageProps {
  params: {
    tenantSlug: string;
    cityOrKeyword: string;
  };
  searchParams: { [key: string]: string | string[] | undefined };
}

// Generate static params for all tenant/location combinations
export async function generateStaticParams() {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) {
      console.warn('NEXT_PUBLIC_API_URL not set; skipping pre-generation of tenant pages');
      return [];
    }
    const res = await fetch(`${apiBase}/api/landing-tenants/published`, {
      next: { revalidate: 86400 } // Revalidate daily
    });
    const data = await res.json();
    
    const params: Array<{ tenantSlug: string; cityOrKeyword: string }> = [];
    
    for (const tenant of data.tenants || []) {
      // Generate pages for each service area
      if (tenant.serviceAreas && Array.isArray(tenant.serviceAreas)) {
        for (const area of tenant.serviceAreas) {
          params.push({
            tenantSlug: tenant.slug,
            cityOrKeyword: area.toLowerCase().replace(/\s+/g, '-')
          });
        }
      }
      
      // Generate pages for top keywords
      if (tenant.keywords && Array.isArray(tenant.keywords)) {
        for (const keyword of tenant.keywords.slice(0, 10)) { // Top 10 keywords
          params.push({
            tenantSlug: tenant.slug,
            cityOrKeyword: keyword.toLowerCase().replace(/\s+/g, '-')
          });
        }
      }
      
      // Base landing page (using first service area or "local")
      params.push({
        tenantSlug: tenant.slug,
        cityOrKeyword: tenant.serviceAreas?.[0]?.toLowerCase().replace(/\s+/g, '-') || 'local'
      });
    }
    
    return params;
  } catch (error) {
    console.error('Failed to generate static params:', error);
    return [];
  }
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tenantSlug, cityOrKeyword } = params;
  
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) {
      return {
        title: 'Joinery AI',
        description: 'Find trusted joinery specialists near you.'
      };
    }
    const res = await fetch(
      `${apiBase}/api/landing-tenants/by-slug/${tenantSlug}`,
      { next: { revalidate: 3600 } } // Revalidate hourly
    );
    
    if (!res.ok) {
      return {
        title: 'Page Not Found',
        description: 'The requested page could not be found.'
      };
    }
    
    const data = await res.json();
    const location = cityOrKeyword.replace(/-/g, ' ');
    const seoData = buildSeoData(data.tenant, location, cityOrKeyword);
    
    return {
      title: seoData.title,
      description: seoData.description,
      keywords: seoData.keywords,
      alternates: {
        canonical: seoData.canonical
      },
      openGraph: {
        title: seoData.title,
        description: seoData.description,
        url: seoData.canonical,
        siteName: 'Joinery AI',
        type: 'website',
        images: [
          {
            url: data.tenant.logoUrl || '/og-default.jpg',
            width: 1200,
            height: 630,
            alt: data.tenant.name
          }
        ]
      },
      twitter: {
        card: 'summary_large_image',
        title: seoData.title,
        description: seoData.description,
        images: [data.tenant.logoUrl || '/og-default.jpg']
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1
        }
      }
    };
  } catch (error) {
    console.error('Failed to generate metadata:', error);
    return {
      title: 'Joinery AI',
      description: 'Find trusted joinery specialists in your area'
    };
  }
}

export default async function TenantLocationPage({ params, searchParams }: PageProps) {
  const { tenantSlug, cityOrKeyword } = params;
  
  try {
    // Fetch tenant data
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/landing-tenants/by-slug/${tenantSlug}`,
      { 
        next: { revalidate: 3600 }, // ISR: Revalidate every hour
        cache: 'force-cache'
      }
    );
    
    if (!res.ok) {
      notFound();
    }
    
    const data = await res.json();
    const tenant = data.tenant;
    const content = data.content;
    
    // Denormalize cityOrKeyword back to display format
    const location = cityOrKeyword.replace(/-/g, ' ');
    const isKeyword = tenant.keywords?.some(
      (k: string) => k.toLowerCase() === location.toLowerCase()
    );
    
    // Build SEO data for JSON-LD
    const seoData = buildSeoData(tenant, location, cityOrKeyword);
    
    return (
      <>
        {/* JSON-LD Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seoData.schema) }}
        />
        
        {/* Main Content */}
        <LandingPageContent
          tenant={tenant}
          content={content}
          location={location}
          keyword={isKeyword ? location : undefined}
          searchParams={searchParams}
        />
        
        {/* Internal Linking - Nearby Tenants */}
        <NearbyTenants
          currentTenant={tenant}
          location={location}
        />
        
        {/* Powered by Joinery AI Footer */}
        <footer className="bg-gray-900 text-white py-12">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-lg font-semibold mb-4">About {tenant.name}</h3>
                <p className="text-gray-400">
                  Professional joinery services in {location}. Quality craftsmanship
                  with transparent pricing.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-4">Service Areas</h3>
                <ul className="space-y-2 text-gray-400">
                  {tenant.serviceAreas?.slice(0, 5).map((area: string) => (
                    <li key={area}>
                      <a
                        href={`/${tenantSlug}/${area.toLowerCase().replace(/\s+/g, '-')}`}
                        className="hover:text-white transition"
                      >
                        {area}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-4">Powered By</h3>
                <a
                  href="https://joineryai.app"
                  className="text-blue-400 hover:text-blue-300 transition"
                  rel="nofollow"
                >
                  Joinery AI - Find Trusted Joiners
                </a>
                <p className="text-gray-400 mt-4 text-sm">
                  Part of the UK's largest joinery marketplace network.
                </p>
              </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
              <p>&copy; {new Date().getFullYear()} {tenant.name}. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </>
    );
  } catch (error) {
    console.error('Failed to load tenant page:', error);
    notFound();
  }
}

// Enable ISR
export const revalidate = 3600; // Revalidate every hour
export const dynamic = 'force-static';
export const dynamicParams = true; // Allow new params at runtime
