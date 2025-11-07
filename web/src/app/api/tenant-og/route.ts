import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

/**
 * Lightweight website enrichment via OG/meta tags
 * GET /api/tenant-og?url=https://example.com
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    // Validate URL
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 });
    }

    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TenantEnrichmentBot/1.0)',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({}, { status: 200 }); // Graceful fallback
    }

    const html = await response.text();

    // Parse meta tags (simple regex for speed)
    const enrichment: Record<string, string> = {};

    // OG Image
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogImageMatch) {
      const ogImage = ogImageMatch[1];
      enrichment.ogImage = ogImage.startsWith('http') ? ogImage : new URL(ogImage, url).href;
    }

    // Twitter Image (fallback)
    if (!enrichment.ogImage) {
      const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
      if (twitterImageMatch) {
        const twitterImage = twitterImageMatch[1];
        enrichment.ogImage = twitterImage.startsWith('http') ? twitterImage : new URL(twitterImage, url).href;
      }
    }

    // Site Name
    const siteNameMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
    if (siteNameMatch) {
      enrichment.siteName = siteNameMatch[1];
    }

    // Theme Color
    const themeColorMatch = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i);
    if (themeColorMatch) {
      enrichment.themeColor = themeColorMatch[1];
    }

    // Optional: Phone (microdata)
    const phoneMatch = html.match(/tel:(\+?[\d\s()-]+)/i);
    if (phoneMatch) {
      enrichment.phone = phoneMatch[1].trim();
    }

    // Optional: Email (microdata)
    const emailMatch = html.match(/mailto:([\w.-]+@[\w.-]+\.\w+)/i);
    if (emailMatch) {
      enrichment.email = emailMatch[1];
    }

    return NextResponse.json(enrichment);
  } catch (error: any) {
    console.error('Tenant OG enrichment error:', error.message);
    // Graceful fallback - return empty object
    return NextResponse.json({}, { status: 200 });
  }
}
