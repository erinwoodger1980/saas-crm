/**
 * Type extensions for ComponentNode to support render tags
 * Add this to types/scene-config.ts
 */

declare module '@/types/scene-config' {
  interface ComponentNode {
    tags?: string[]; // e.g., ['glass', 'panelFace', 'profileOverlay', 'stainedGlassImagePlane', 'decal']
  }
}

export {};
