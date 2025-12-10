/**
 * Wealden AI Images Helper
 * 
 * Provides type-safe access to AI-processed and generated images
 * for the Wealden Joinery website.
 */

import manifest from "@/scripts/wealden-ai-images.json";

export interface WealdenImage {
  id: string;
  publicPath: string;
  caption: string;
  tags: string[];
  placementHints: string[];
  sourceKind: "local-enhanced" | "ai-generated";
  width: number;
  height: number;
}

interface Manifest {
  version: string;
  generatedAt: string;
  totalImages: number;
  images: WealdenImage[];
}

const imageManifest = manifest as unknown as Manifest;

/**
 * Get the hero image (best quality image for homepage hero)
 */
export function getHeroImage(): WealdenImage | null {
  const heroImages = imageManifest.images.filter((img) => 
    img.placementHints.includes("hero")
  );
  
  // Prefer local-enhanced over AI-generated
  const local = heroImages.find((img) => img.sourceKind === "local-enhanced");
  return local || heroImages[0] || null;
}

/**
 * Get images by placement hint
 */
export function getImagesByHint(hint: string, limit?: number): WealdenImage[] {
  const filtered = imageManifest.images.filter((img) =>
    img.placementHints.includes(hint)
  );
  
  // Sort: local-enhanced first, then by ID
  const sorted = filtered.sort((a, b) => {
    if (a.sourceKind === "local-enhanced" && b.sourceKind === "ai-generated") return -1;
    if (a.sourceKind === "ai-generated" && b.sourceKind === "local-enhanced") return 1;
    return a.id.localeCompare(b.id);
  });
  
  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Get images by tag
 */
export function getImagesByTag(tag: string, limit?: number): WealdenImage[] {
  const filtered = imageManifest.images.filter((img) =>
    img.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase()))
  );
  
  const sorted = filtered.sort((a, b) => {
    if (a.sourceKind === "local-enhanced" && b.sourceKind === "ai-generated") return -1;
    if (a.sourceKind === "ai-generated" && b.sourceKind === "local-enhanced") return 1;
    return a.id.localeCompare(b.id);
  });
  
  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Get images by multiple criteria
 */
export function getImages(criteria: {
  hints?: string[];
  tags?: string[];
  sourceKind?: "local-enhanced" | "ai-generated";
  limit?: number;
}): WealdenImage[] {
  let filtered = imageManifest.images;
  
  if (criteria.hints && criteria.hints.length > 0) {
    filtered = filtered.filter((img) =>
      criteria.hints!.some((hint) => img.placementHints.includes(hint))
    );
  }
  
  if (criteria.tags && criteria.tags.length > 0) {
    filtered = filtered.filter((img) =>
      criteria.tags!.some((tag) =>
        img.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase()))
      )
    );
  }
  
  if (criteria.sourceKind) {
    filtered = filtered.filter((img) => img.sourceKind === criteria.sourceKind);
  }
  
  // Sort: local-enhanced first
  const sorted = filtered.sort((a, b) => {
    if (a.sourceKind === "local-enhanced" && b.sourceKind === "ai-generated") return -1;
    if (a.sourceKind === "ai-generated" && b.sourceKind === "local-enhanced") return 1;
    return a.id.localeCompare(b.id);
  });
  
  return criteria.limit ? sorted.slice(0, criteria.limit) : sorted;
}

/**
 * Get fallback images (any images that aren't already used)
 */
export function getFallbackImages(count: number): WealdenImage[] {
  return imageManifest.images
    .sort((a, b) => {
      if (a.sourceKind === "local-enhanced" && b.sourceKind === "ai-generated") return -1;
      if (a.sourceKind === "ai-generated" && b.sourceKind === "local-enhanced") return 1;
      return a.id.localeCompare(b.id);
    })
    .slice(0, count);
}

/**
 * Get random image from a category (for variety)
 */
export function getRandomImage(hint?: string): WealdenImage | null {
  const pool = hint 
    ? imageManifest.images.filter((img) => img.placementHints.includes(hint))
    : imageManifest.images;
  
  if (pool.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex] || null;
}

/**
 * Get total image count
 */
export function getTotalImageCount(): number {
  return imageManifest.totalImages;
}

/**
 * Get all available placement hints
 */
export function getAllPlacementHints(): string[] {
  const hints = new Set<string>();
  imageManifest.images.forEach((img) => {
    img.placementHints.forEach((hint) => hints.add(hint));
  });
  return Array.from(hints).sort();
}

/**
 * Get all available tags
 */
export function getAllTags(): string[] {
  const tags = new Set<string>();
  imageManifest.images.forEach((img) => {
    img.tags.forEach((tag) => tags.add(tag));
  });
  return Array.from(tags).sort();
}

/**
 * Debug: get manifest stats
 */
export function getManifestStats() {
  const byHint: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  
  imageManifest.images.forEach((img) => {
    img.placementHints.forEach((hint) => {
      byHint[hint] = (byHint[hint] || 0) + 1;
    });
    bySource[img.sourceKind] = (bySource[img.sourceKind] || 0) + 1;
  });
  
  return {
    total: imageManifest.totalImages,
    generatedAt: imageManifest.generatedAt,
    byHint,
    bySource,
    allHints: getAllPlacementHints(),
    allTags: getAllTags(),
  };
}
