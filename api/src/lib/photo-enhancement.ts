/**
 * AI Photo Enhancement Service
 * Uses Replicate API to enhance product photos
 */

import Replicate from "replicate";
import sharp from "sharp";
import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export interface EnhanceOptions {
  // Enhancement type
  type?: "upscale" | "denoise" | "professional" | "all";
  // Target resolution for upscaling
  scale?: 2 | 4;
  // Remove background
  removeBackground?: boolean;
  // Auto color correction
  autoColor?: boolean;
  // Sharpen
  sharpen?: boolean;
}

/**
 * Enhance a photo using AI
 * Returns path to enhanced image
 */
export async function enhancePhoto(
  inputPath: string,
  options: EnhanceOptions = {}
): Promise<string> {
  const {
    type = "professional",
    scale = 2,
    removeBackground = false,
    autoColor = true,
    sharpen = true,
  } = options;

  try {
    // Read input image as base64
    const imageBuffer = await fs.readFile(inputPath);
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;

    let enhancedUrl: string;

    if (type === "professional" || type === "all") {
      // Use Real-ESRGAN for upscaling + enhancement
      const output = await replicate.run(
        "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
        {
          input: {
            image: base64Image,
            scale: scale,
            face_enhance: false, // Don't enhance faces for product photos
          },
        }
      ) as any;

      enhancedUrl = Array.isArray(output) ? output[0] : output;
    } else if (type === "upscale") {
      // Simple upscaling
      const output = await replicate.run(
        "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
        {
          input: {
            image: base64Image,
            scale: scale,
          },
        }
      ) as any;

      enhancedUrl = Array.isArray(output) ? output[0] : output;
    } else if (type === "denoise") {
      // Denoising model
      const output = await replicate.run(
        "google-research/maxim:53b06c6d0bc3a1789bad0ec6a09e8f48d6f6b6fb0db5f6349edb7e69b6624846",
        {
          input: {
            image: base64Image,
            task: "Denoising",
          },
        }
      ) as any;

      enhancedUrl = Array.isArray(output) ? output[0] : output;
    } else {
      throw new Error(`Unknown enhancement type: ${type}`);
    }

    // Download enhanced image
    const response = await fetch(enhancedUrl);
    if (!response.ok) {
      throw new Error("Failed to download enhanced image");
    }

    const enhancedBuffer = Buffer.from(await response.arrayBuffer());

    // Apply additional processing with Sharp
    let processor = sharp(enhancedBuffer);

    // Auto color correction
    if (autoColor) {
      processor = processor.normalize();
    }

    // Sharpen
    if (sharpen) {
      processor = processor.sharpen();
    }

    // Remove background if requested
    if (removeBackground) {
      // Use background removal model
      const bgRemovalOutput = await replicate.run(
        "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
        {
          input: {
            image: base64Image,
          },
        }
      ) as any;

      const bgRemovedUrl = Array.isArray(bgRemovalOutput) ? bgRemovalOutput[0] : bgRemovalOutput;
      const bgResponse = await fetch(bgRemovedUrl);
      const bgBuffer = Buffer.from(await bgResponse.arrayBuffer());
      
      processor = sharp(bgBuffer);
    }

    // Save enhanced image
    const outputPath = inputPath.replace(
      path.extname(inputPath),
      `_enhanced${path.extname(inputPath)}`
    );

    await processor.jpeg({ quality: 95 }).toFile(outputPath);

    return outputPath;
  } catch (error: any) {
    console.error("Photo enhancement failed:", error);
    throw new Error(`Enhancement failed: ${error.message}`);
  }
}

/**
 * Fallback enhancement using Sharp only (no AI)
 * For when API is unavailable or quota exceeded
 */
export async function basicEnhancement(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace(
    path.extname(inputPath),
    `_enhanced${path.extname(inputPath)}`
  );

  await sharp(inputPath)
    .normalize() // Auto levels
    .sharpen() // Sharpen edges
    .modulate({
      brightness: 1.05, // Slight brightness boost
      saturation: 1.1, // Slight saturation boost
    })
    .jpeg({ quality: 95 })
    .toFile(outputPath);

  return outputPath;
}

/**
 * Check if AI enhancement is available
 */
export function isAIEnhancementAvailable(): boolean {
  return !!process.env.REPLICATE_API_TOKEN;
}
