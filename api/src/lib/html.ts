import * as cheerio from "cheerio";

export interface ImageCandidate {
  url: string;
  alt?: string;
  caption?: string;
  context?: string;
}

export function extractOgImages(html: string, baseUrl: string): ImageCandidate[] {
  const $ = cheerio.load(html);
  const images: ImageCandidate[] = [];
  
  // Open Graph images
  $('meta[property="og:image"], meta[property="og:image:url"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) {
      images.push({
        url: resolveUrl(content, baseUrl),
        alt: $('meta[property="og:title"]').attr("content") || "",
        context: "og:image",
      });
    }
  });
  
  // Twitter images
  $('meta[name="twitter:image"], meta[name="twitter:image:src"]').each((_, el) => {
    const content = $(el).attr("content");
    if (content) {
      images.push({
        url: resolveUrl(content, baseUrl),
        alt: $('meta[name="twitter:title"]').attr("content") || "",
        context: "twitter:image",
      });
    }
  });
  
  // Legacy image_src
  $('link[rel="image_src"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      images.push({
        url: resolveUrl(href, baseUrl),
        context: "image_src",
      });
    }
  });
  
  return images;
}

export function extractPageImages(html: string, baseUrl: string): ImageCandidate[] {
  const $ = cheerio.load(html);
  const images: ImageCandidate[] = [];
  const seenUrls = new Set<string>();
  
  $("img").each((_, el) => {
    const $img = $(el);
    const src = $img.attr("src");
    const srcset = $img.attr("srcset");
    const alt = $img.attr("alt") || "";
    const title = $img.attr("title") || "";
    
    // Extract from src
    if (src) {
      const url = resolveUrl(src, baseUrl);
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        
        // Try to find nearby figcaption
        const $figure = $img.closest("figure");
        const caption = $figure.find("figcaption").text().trim() || title;
        
        images.push({
          url,
          alt: alt || caption,
          caption: caption || undefined,
        });
      }
    }
    
    // Extract from srcset
    if (srcset) {
      const srcsetUrls = parseSrcset(srcset);
      for (const srcsetUrl of srcsetUrls) {
        const url = resolveUrl(srcsetUrl, baseUrl);
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          images.push({
            url,
            alt: alt || title,
          });
        }
      }
    }
  });
  
  // Also check <source> elements in <picture>
  $("picture source").each((_, el) => {
    const srcset = $(el).attr("srcset");
    if (srcset) {
      const srcsetUrls = parseSrcset(srcset);
      for (const srcsetUrl of srcsetUrls) {
        const url = resolveUrl(srcsetUrl, baseUrl);
        if (!seenUrls.has(url)) {
          seenUrls.add(url);
          images.push({ url });
        }
      }
    }
  });
  
  return images;
}

export function extractLikelyGalleryLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  const seenUrls = new Set<string>();
  
  const galleryKeywords = [
    "gallery",
    "portfolio",
    "project",
    "projects",
    "windows",
    "doors",
    "case-study",
    "case-studies",
    "work",
    "showcase",
  ];
  
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    
    const url = resolveUrl(href, baseUrl);
    const parsedUrl = new URL(url);
    
    // Must be same origin
    if (parsedUrl.origin !== new URL(baseUrl).origin) return;
    
    // Skip anchors, query strings with common pagination
    if (href.startsWith("#")) return;
    
    const lowercaseHref = href.toLowerCase();
    const lowercaseText = $(el).text().trim().toLowerCase();
    
    // Check if URL or link text contains gallery keywords
    const isGalleryLink = galleryKeywords.some(
      (keyword) =>
        lowercaseHref.includes(keyword) || lowercaseText.includes(keyword)
    );
    
    if (isGalleryLink && !seenUrls.has(url)) {
      seenUrls.add(url);
      links.push(url);
    }
  });
  
  return links;
}

function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

function parseSrcset(srcset: string): string[] {
  return srcset
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

export function generateAltText(
  filename: string,
  pageTitle: string,
  caption?: string
): string {
  if (caption) return caption;
  
  // Clean filename: remove extension, replace separators with spaces
  const cleaned = filename
    .replace(/\.(jpg|jpeg|png|webp|gif)$/i, "")
    .replace(/[_-]/g, " ")
    .replace(/\d{8,}/g, "") // Remove long number sequences
    .trim();
  
  // Combine with page title
  const parts = [cleaned, pageTitle].filter(Boolean);
  
  // Sentence case
  return parts
    .join(" – ")
    .split(" ")
    .map((word, i) =>
      i === 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase()
    )
    .join(" ")
    .slice(0, 150);
}
