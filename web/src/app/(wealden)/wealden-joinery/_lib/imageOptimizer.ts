/**
 * Image Optimization Utility
 * 
 * Automatically compresses images to < 1MB while preserving visual quality.
 * Uses progressive quality reduction and smart sizing for web delivery.
 */

export interface OptimizeOptions {
  /** Maximum edge dimension in pixels (default: 2000) */
  maxEdgePx?: number;
  /** Target file size in bytes (default: 1MB) */
  targetBytes?: number;
  /** Image quality starting point (0-1, default: 0.86) */
  initialQuality?: number;
  /** Quality reduction step (default: 0.04) */
  qualityStep?: number;
  /** Minimum acceptable quality (default: 0.6) */
  minQuality?: number;
}

export interface OptimizeResult {
  file: File;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  dimensions: { width: number; height: number };
  wasCached?: boolean;
}

/**
 * Optimizes an image file to meet size and dimension constraints
 * 
 * @param file - The original image file
 * @param options - Optimization parameters
 * @returns Promise resolving to optimized file and metadata
 */
export async function optimizeImageFile(
  file: File,
  options: OptimizeOptions = {}
): Promise<OptimizeResult> {
  const {
    maxEdgePx = 2000,
    targetBytes = 1_000_000, // 1MB
    initialQuality = 0.86,
    qualityStep = 0.04,
    minQuality = 0.6,
  } = options;

  // Validate input
  if (!file.type.startsWith('image/')) {
    throw new Error(`Invalid file type: ${file.type}. Only image files are supported.`);
  }

  const originalSize = file.size;

  // If already under target and reasonable dimensions, return as-is
  if (originalSize < targetBytes && maxEdgePx >= 2400) {
    console.log(`[Image Optimizer] File already optimized: ${(originalSize / 1024).toFixed(1)}KB`);
    return {
      file,
      originalSize,
      optimizedSize: originalSize,
      compressionRatio: 1,
      dimensions: await getImageDimensions(file),
      wasCached: true,
    };
  }

  try {
    // Load image
    const img = await loadImage(file);
    const { width, height } = img;

    // Calculate target dimensions
    const { width: targetWidth, height: targetHeight } = calculateTargetDimensions(
      width,
      height,
      maxEdgePx
    );

    console.log(
      `[Image Optimizer] Original: ${width}x${height} (${(originalSize / 1024).toFixed(1)}KB) → Target: ${targetWidth}x${targetHeight}`
    );

    // Create canvas for resizing
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { alpha: false });

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Use high-quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw resized image
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // Determine output format (prefer JPEG for photos, keep PNG if transparency needed)
    const outputFormat = file.type === 'image/png' && hasTransparency(ctx, targetWidth, targetHeight)
      ? 'image/png'
      : 'image/jpeg';

    console.log(`[Image Optimizer] Output format: ${outputFormat}`);

    // Progressive quality compression
    let quality = initialQuality;
    let optimizedBlob: Blob | null = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (quality >= minQuality && attempts < maxAttempts) {
      optimizedBlob = await canvasToBlob(canvas, outputFormat, quality);
      attempts++;

      console.log(
        `[Image Optimizer] Attempt ${attempts}: quality=${quality.toFixed(2)}, size=${(optimizedBlob.size / 1024).toFixed(1)}KB`
      );

      if (optimizedBlob.size < targetBytes) {
        break;
      }

      quality -= qualityStep;
    }

    if (!optimizedBlob) {
      throw new Error('Failed to generate optimized image');
    }

    // Warn if still over target
    if (optimizedBlob.size >= targetBytes) {
      console.warn(
        `[Image Optimizer] Could not compress below ${(targetBytes / 1024).toFixed(0)}KB. Final size: ${(optimizedBlob.size / 1024).toFixed(1)}KB at quality ${quality.toFixed(2)}`
      );
    }

    // Create optimized file
    const optimizedFile = new File(
      [optimizedBlob],
      file.name.replace(/\.[^.]+$/, outputFormat === 'image/jpeg' ? '.jpg' : '.png'),
      { type: outputFormat }
    );

    const compressionRatio = originalSize / optimizedBlob.size;

    console.log(
      `[Image Optimizer] ✓ Optimized: ${(originalSize / 1024).toFixed(1)}KB → ${(optimizedBlob.size / 1024).toFixed(1)}KB (${compressionRatio.toFixed(2)}x compression)`
    );

    return {
      file: optimizedFile,
      originalSize,
      optimizedSize: optimizedBlob.size,
      compressionRatio,
      dimensions: { width: targetWidth, height: targetHeight },
    };
  } catch (error) {
    console.error('[Image Optimizer] Optimization failed:', error);
    // Fallback to original file
    return {
      file,
      originalSize,
      optimizedSize: originalSize,
      compressionRatio: 1,
      dimensions: await getImageDimensions(file),
    };
  }
}

/**
 * Load image from file
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Get image dimensions without loading full image
 */
async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  try {
    const img = await loadImage(file);
    return { width: img.width, height: img.height };
  } catch {
    return { width: 0, height: 0 };
  }
}

/**
 * Calculate target dimensions maintaining aspect ratio
 */
function calculateTargetDimensions(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number } {
  const maxDimension = Math.max(width, height);

  if (maxDimension <= maxEdge) {
    return { width, height };
  }

  const scale = maxEdge / maxDimension;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Check if image has transparency (for PNG detection)
 */
function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    // Sample a few pixels to check for alpha < 255
    const imageData = ctx.getImageData(0, 0, Math.min(width, 100), Math.min(height, 100));
    const data = imageData.data;

    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        return true;
      }
    }
    return false;
  } catch {
    // If we can't check, assume no transparency
    return false;
  }
}

/**
 * Convert canvas to blob with specified format and quality
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      },
      type,
      quality
    );
  });
}

/**
 * Get recommended max edge size based on image context
 */
export function getRecommendedMaxEdge(context: 'hero' | 'card' | 'thumbnail' | 'default'): number {
  switch (context) {
    case 'hero':
      return 2400;
    case 'card':
      return 1600;
    case 'thumbnail':
      return 800;
    default:
      return 2000;
  }
}
