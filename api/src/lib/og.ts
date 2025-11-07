import { fetch } from 'undici';
import * as cheerio from 'cheerio';

interface OGData {
  ogImage?: string;
  twitterImage?: string;
  siteName?: string;
  themeColor?: string;
  phone?: string;
  email?: string;
  title?: string;
}

/**
 * Fetch and parse Open Graph and meta tags from a URL
 * Returns partial data - caller should handle missing fields
 */
export async function fetchOG(url: string): Promise<Partial<OGData>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TenantBootstrapBot/1.0)',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status}`);
      return {};
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const data: Partial<OGData> = {};

    // OG Image
    const ogImageMeta = $('meta[property="og:image"]').attr('content');
    if (ogImageMeta) {
      data.ogImage = new URL(ogImageMeta, url).href;
    }

    // Twitter Image (fallback)
    if (!data.ogImage) {
      const twitterImageMeta = $('meta[name="twitter:image"]').attr('content');
      if (twitterImageMeta) {
        data.twitterImage = new URL(twitterImageMeta, url).href;
      }
    }

    // Site Name
    const siteNameMeta = $('meta[property="og:site_name"]').attr('content');
    if (siteNameMeta) {
      data.siteName = siteNameMeta;
    }

    // Theme Color
    const themeColorMeta = $('meta[name="theme-color"]').attr('content');
    if (themeColorMeta) {
      data.themeColor = themeColorMeta;
    }

    // Title (fallback for siteName)
    if (!data.siteName) {
      const title = $('title').text().trim();
      if (title) {
        data.title = title;
      }
    }

    // Phone (best effort - look for tel: links)
    const telLink = $('a[href^="tel:"]').first().attr('href');
    if (telLink) {
      data.phone = telLink.replace('tel:', '').trim();
    }

    // Email (best effort - look for mailto: links)
    const mailtoLink = $('a[href^="mailto:"]').first().attr('href');
    if (mailtoLink) {
      data.email = mailtoLink.replace('mailto:', '').trim();
    }

    return data;
  } catch (error: any) {
    console.warn(`Error fetching OG data from ${url}:`, error.message);
    return {};
  }
}

/**
 * Crawl homepage for prominent images
 * Returns array of absolute URLs
 */
export async function crawlImages(url: string, limit: number = 12): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TenantBootstrapBot/1.0)',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const imageUrls: string[] = [];
    const seenUrls = new Set<string>();

    // Get OG image first (highest priority)
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      const absolute = new URL(ogImage, url).href;
      if (!seenUrls.has(absolute)) {
        imageUrls.push(absolute);
        seenUrls.add(absolute);
      }
    }

    // Get prominent <img> sources
    $('img').each((_, el) => {
      if (imageUrls.length >= limit) return false;

      const src = $(el).attr('src') || $(el).attr('data-src');
      if (!src) return;

      // Skip small images, icons, SVGs
      if (
        src.includes('icon') ||
        src.includes('logo') ||
        src.endsWith('.svg') ||
        src.includes('data:image')
      ) {
        return;
      }

      try {
        const absolute = new URL(src, url).href;
        if (!seenUrls.has(absolute)) {
          imageUrls.push(absolute);
          seenUrls.add(absolute);
        }
      } catch (e) {
        // Invalid URL, skip
      }
    });

    return imageUrls.slice(0, limit);
  } catch (error: any) {
    console.warn(`Error crawling images from ${url}:`, error.message);
    return [];
  }
}
