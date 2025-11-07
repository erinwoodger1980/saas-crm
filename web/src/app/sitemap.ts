import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://joineryai.app';
  
  try {
    // Fetch all published tenants
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/landing-tenants/published`, {
      next: { revalidate: 86400 } // Cache for 1 day
    });
    
    if (!res.ok) {
      console.error('Failed to fetch tenants for sitemap');
      return [];
    }
    
    const data = await res.json();
    const tenants = data.tenants || [];
    
    const sitemapEntries: MetadataRoute.Sitemap = [];
    
    // Static pages
    sitemapEntries.push({
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0
    });
    
    sitemapEntries.push({
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9
    });
    
    // Generate entries for each tenant/location combination
    for (const tenant of tenants) {
      // Service area pages
      if (tenant.serviceAreas && Array.isArray(tenant.serviceAreas)) {
        for (const area of tenant.serviceAreas) {
          const locationSlug = area.toLowerCase().replace(/\s+/g, '-');
          sitemapEntries.push({
            url: `${baseUrl}/${tenant.slug}/${locationSlug}`,
            lastModified: new Date(tenant.updatedAt),
            changeFrequency: 'weekly',
            priority: 0.8
          });
        }
      }
      
      // Top keyword pages (top 10 for SEO focus)
      if (tenant.keywords && Array.isArray(tenant.keywords)) {
        for (const keyword of tenant.keywords.slice(0, 10)) {
          const keywordSlug = keyword.toLowerCase().replace(/\s+/g, '-');
          sitemapEntries.push({
            url: `${baseUrl}/${tenant.slug}/${keywordSlug}`,
            lastModified: new Date(tenant.updatedAt),
            changeFrequency: 'weekly',
            priority: 0.7
          });
        }
      }
      
      // Base tenant page (using first service area)
      const defaultLocation = tenant.serviceAreas?.[0]?.toLowerCase().replace(/\s+/g, '-') || 'local';
      sitemapEntries.push({
        url: `${baseUrl}/${tenant.slug}/${defaultLocation}`,
        lastModified: new Date(tenant.updatedAt),
        changeFrequency: 'weekly',
        priority: 0.9 // Higher priority for main tenant page
      });
    }
    
    return sitemapEntries;
  } catch (error) {
    console.error('Sitemap generation error:', error);
    return [{
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0
    }];
  }
}

// Revalidate sitemap daily
export const revalidate = 86400;
