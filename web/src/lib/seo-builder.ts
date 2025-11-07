/**
 * SEO Data Builder
 * 
 * Generates comprehensive SEO metadata including:
 * - Title, description, keywords
 * - Canonical URLs
 * - Schema.org JSON-LD (LocalBusiness, Product, FAQPage, Organization)
 * - Open Graph tags
 * 
 * Usage:
 * const seoData = buildSeoData(tenant, 'Kent', 'sash-windows');
 */

interface Tenant {
  id: string;
  name: string;
  slug: string;
  phone?: string;
  email?: string;
  address?: string;
  homeUrl?: string;
  logoUrl?: string;
  brandColor?: string;
  serviceAreas?: string[];
  keywords?: string[];
  targetCPL?: number;
  reviews?: Array<{
    quote: string;
    author: string;
    location?: string;
    stars: number;
  }>;
  images?: Array<{
    src: string;
    alt?: string;
  }>;
}

interface SeoData {
  title: string;
  description: string;
  keywords: string[];
  canonical: string;
  schema: any;
}

export function buildSeoData(
  tenant: Tenant,
  location: string,
  locationSlug: string
): SeoData {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://joineryai.app';
  const canonical = `${baseUrl}/${tenant.slug}/${locationSlug}`;
  
  // Determine if location is a keyword or area
  const isKeyword = tenant.keywords?.some(
    k => k.toLowerCase() === location.toLowerCase()
  );
  
  // Build title (max 60 chars for Google)
  const title = isKeyword
    ? `${location} in ${tenant.serviceAreas?.[0] || 'Your Area'} | ${tenant.name}`
    : `${tenant.name} - Joinery Services in ${location}`;
  
  // Build meta description (max 160 chars)
  const description = isKeyword
    ? `Looking for ${location.toLowerCase()}? ${tenant.name} provides expert ${location.toLowerCase()} services in ${location} and surrounding areas. Get a free quote today!`
    : `${tenant.name} provides professional joinery services in ${location}. Sash windows, casement windows, doors & more. Quality craftsmanship with transparent pricing.`;
  
  // Build keywords array
  const keywords: string[] = [
    tenant.name,
    location,
    ...(tenant.keywords || []).slice(0, 10),
    ...(tenant.serviceAreas || []),
    'joinery',
    'windows',
    'doors',
    'timber',
    'bespoke',
    'craftsman'
  ].filter(Boolean);
  
  // Calculate aggregate rating
  const avgRating = tenant.reviews && tenant.reviews.length > 0
    ? tenant.reviews.reduce((sum, r) => sum + (r.stars || 5), 0) / tenant.reviews.length
    : undefined;
  
  // Build Schema.org JSON-LD
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      // LocalBusiness schema
      {
        '@type': 'LocalBusiness',
        '@id': `${canonical}#business`,
        name: tenant.name,
        url: canonical,
        logo: tenant.logoUrl ? `${baseUrl}${tenant.logoUrl}` : undefined,
        image: tenant.images?.map(img => `${baseUrl}${img.src}`),
        telephone: tenant.phone,
        email: tenant.email,
        address: tenant.address ? {
          '@type': 'PostalAddress',
          addressLocality: location,
          addressRegion: tenant.serviceAreas?.[0],
          addressCountry: 'GB'
        } : undefined,
        areaServed: tenant.serviceAreas?.map(area => ({
          '@type': 'City',
          name: area
        })),
        priceRange: '££-£££',
        aggregateRating: avgRating ? {
          '@type': 'AggregateRating',
          ratingValue: avgRating.toFixed(1),
          reviewCount: tenant.reviews!.length,
          bestRating: '5',
          worstRating: '1'
        } : undefined,
        review: tenant.reviews?.slice(0, 5).map(review => ({
          '@type': 'Review',
          author: {
            '@type': 'Person',
            name: review.author
          },
          reviewRating: {
            '@type': 'Rating',
            ratingValue: review.stars.toString(),
            bestRating: '5',
            worstRating: '1'
          },
          reviewBody: review.quote,
          datePublished: new Date().toISOString() // Ideally from DB
        })),
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Joinery Services',
          itemListElement: [
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'Sash Windows',
                description: 'Bespoke timber sash windows with traditional craftsmanship',
                areaServed: {
                  '@type': 'City',
                  name: location
                }
              }
            },
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'Casement Windows',
                description: 'Custom casement windows in timber or Accoya',
                areaServed: {
                  '@type': 'City',
                  name: location
                }
              }
            },
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'Timber Doors',
                description: 'Front doors, bi-fold doors, and internal doors',
                areaServed: {
                  '@type': 'City',
                  name: location
                }
              }
            }
          ]
        }
      },
      
      // WebPage schema
      {
        '@type': 'WebPage',
        '@id': canonical,
        url: canonical,
        name: title,
        description: description,
        inLanguage: 'en-GB',
        isPartOf: {
          '@type': 'WebSite',
          '@id': `${baseUrl}#website`,
          name: 'Joinery AI',
          url: baseUrl
        },
        about: {
          '@id': `${canonical}#business`
        },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: baseUrl
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: tenant.name,
              item: `${baseUrl}/${tenant.slug}`
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: location,
              item: canonical
            }
          ]
        }
      },
      
      // Product schemas for key services
      {
        '@type': 'Product',
        name: `Sash Windows - ${location}`,
        description: `Professional sash window installation and restoration in ${location}`,
        brand: {
          '@type': 'Brand',
          name: tenant.name
        },
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'GBP',
          lowPrice: '850',
          highPrice: '2500',
          offerCount: '1',
          availability: 'https://schema.org/InStock',
          areaServed: {
            '@type': 'City',
            name: location
          }
        },
        aggregateRating: avgRating ? {
          '@type': 'AggregateRating',
          ratingValue: avgRating.toFixed(1),
          reviewCount: tenant.reviews!.length
        } : undefined
      },
      
      // FAQ schema (improves rich snippets)
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `How much do sash windows cost in ${location}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Sash window prices in ${location} typically start from £850 per window for standard sizes. Full house installations range from £8,500-£25,000 depending on the number of windows and specifications. ${tenant.name} provides free, no-obligation quotes.`
            }
          },
          {
            '@type': 'Question',
            name: `Does ${tenant.name} serve ${location}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Yes, ${tenant.name} provides professional joinery services throughout ${location} and surrounding areas including ${tenant.serviceAreas?.slice(0, 3).join(', ')}.`
            }
          },
          {
            '@type': 'Question',
            name: 'How long does installation take?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Most window installations take 1-3 days depending on the project size. We provide a clear timeline with your quote and work to minimize disruption to your home.'
            }
          },
          {
            '@type': 'Question',
            name: 'What areas do you cover?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: `We serve ${tenant.serviceAreas?.join(', ') || location} and surrounding areas. Contact us to confirm service availability for your location.`
            }
          }
        ]
      }
    ]
  };
  
  return {
    title,
    description,
    keywords,
    canonical,
    schema
  };
}

/**
 * Generate SEO-friendly URL slug from text
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/--+/g, '-') // Replace multiple hyphens
    .trim();
}

/**
 * Generate all SEO URL variations for a tenant
 */
export function generateTenantUrls(tenant: Tenant): string[] {
  const urls: string[] = [];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://joineryai.app';
  
  // Service area pages
  tenant.serviceAreas?.forEach(area => {
    urls.push(`${baseUrl}/${tenant.slug}/${slugify(area)}`);
  });
  
  // Keyword pages (top 10)
  tenant.keywords?.slice(0, 10).forEach(keyword => {
    urls.push(`${baseUrl}/${tenant.slug}/${slugify(keyword)}`);
  });
  
  // Base landing page
  urls.push(`${baseUrl}/${tenant.slug}/${slugify(tenant.serviceAreas?.[0] || 'local')}`);
  
  return urls;
}
