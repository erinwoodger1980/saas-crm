export interface GalleryImage {
  src: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
}

export async function getTenantGallery(slug: string): Promise<GalleryImage[]> {
  try {
    const gallery = await import(`./${slug}_gallery.json`);
    return gallery.default || [];
  } catch (error) {
    console.warn(`Gallery not found for tenant: ${slug}`);
    return [];
  }
}
