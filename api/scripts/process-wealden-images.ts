#!/usr/bin/env tsx
/**
 * Complete AI Image Pipeline for Wealden Joinery
 * 
 * This script:
 * 1. Loads all images from ~/Desktop/Web Images
 * 2. Enhances them with AI (color correction, clarity)
 * 3. Analyzes each with GPT-4 Vision (caption, tags, placement hints)
 * 4. Generates missing category images with Replicate FLUX
 * 5. Saves everything to /public/wealden-ai/
 * 6. Creates manifest: /scripts/wealden-ai-images.json
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";
import OpenAI from "openai";
import Replicate from "replicate";
import { createHash } from "crypto";
import dotenv from "dotenv";

// Load environment variables from api/.env
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const SOURCE_DIR = path.join(process.env.HOME || "", "Desktop", "Web Images");
const OUTPUT_DIR = path.join(__dirname, "..", "..", "web", "public", "wealden-ai");
const MANIFEST_PATH = path.join(__dirname, "..", "..", "scripts", "wealden-ai-images.json");

// Required image counts per category
const MIN_COUNTS = {
  hero: 1,
  "range-windows": 3,
  "range-doors": 3,
  "alu-clad": 2,
  "case-study": 4,
  workshop: 2,
  detail: 3,
  lifestyle: 3,
  team: 1,
};

interface ImageMetadata {
  id: string;
  publicPath: string;
  caption: string;
  tags: string[];
  placementHints: string[];
  sourceKind: "local-enhanced" | "ai-generated";
  width: number;
  height: number;
}

interface VisionAnalysis {
  caption: string;
  tags: string[];
  placementHints: string[];
  confidence: number;
}

// Initialize APIs
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || "",
});

/**
 * Enhance image with Sharp (color correction, sharpening, resize)
 */
async function enhanceImage(inputPath: string, outputPath: string): Promise<{ width: number; height: number }> {
  console.log(`  Enhancing: ${path.basename(inputPath)}`);
  
  const metadata = await sharp(inputPath)
    .normalize() // Auto color balance
    .modulate({ brightness: 1.05, saturation: 1.1 }) // Enhance colors
    .sharpen({ sigma: 2.0 }) // More clarity
    .resize(3200, 2400, { // Larger max dimensions for better quality
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 95, mozjpeg: true })
    .toFile(outputPath);

  return { width: metadata.width, height: metadata.height };
}

/**
 * Analyze image with GPT-4 Vision
 */
async function analyzeImageWithVision(imagePath: string): Promise<VisionAnalysis> {
  console.log(`  Analyzing: ${path.basename(imagePath)}`);
  
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are analyzing images for a premium timber windows and doors company based in Sussex, UK called Wealden Joinery.
          
Analyze this image and provide:
1. A clean, professional alt text caption (max 120 characters)
2. Relevant tags (timber, oak, sash, casement, door, window, workshop, detail, heritage, contemporary, etc.)
3. Placement hints from: hero, range-windows, range-doors, alu-clad, case-study, workshop, detail, lifestyle, team

Respond in JSON format:
{
  "caption": "string",
  "tags": ["string"],
  "placementHints": ["string"],
  "confidence": 0.0-1.0
}`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || "{}";
    
    // Remove markdown code fences if present
    const cleanContent = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const analysis = JSON.parse(cleanContent);
    
    return {
      caption: analysis.caption || "Wealden Joinery timber windows and doors",
      tags: Array.isArray(analysis.tags) ? analysis.tags : [],
      placementHints: Array.isArray(analysis.placementHints) ? analysis.placementHints : [],
      confidence: analysis.confidence || 0.5,
    };
  } catch (error) {
    console.error(`  Vision analysis failed:`, error);
    return {
      caption: "Wealden Joinery craftsmanship",
      tags: ["timber", "joinery"],
      placementHints: [],
      confidence: 0.3,
    };
  }
}

/**
 * Generate missing images with Replicate FLUX
 */
async function generateImage(category: string, index: number): Promise<string | null> {
  console.log(`  Generating ${category} image ${index}...`);

  const prompts: Record<string, string> = {
    hero: `Professional architectural photography of a beautiful Sussex heritage home with timber sash windows, warm afternoon light, no people, photorealistic, 8k quality, cinematic`,
    "range-windows": `Professional product photography of traditional timber sash windows on a Georgian brick home, heritage green paint, brass hardware, soft natural light, photorealistic`,
    "range-doors": `Professional architectural photography of an oak entrance door with sidelights on a Kent period home, warm wood tones, brass knocker, no people, photorealistic`,
    "alu-clad": `Contemporary timber-aluminium windows on modern extension, clean lines, large glazing, slate grey frames, architectural photography, photorealistic`,
    "case-study": `Before and after: period home with newly installed timber windows, Sussex countryside setting, warm light, no identifiable people, photorealistic architectural photography`,
    workshop: `Joinery workshop interior with timber window frames being crafted, tools and benches, natural light, craftsman working (back view or blurred), photorealistic`,
    detail: `Extreme close-up of timber window joinery detail, mortise and tenon joint, glazing bars, smooth oak grain, professional macro photography`,
    lifestyle: `Interior view looking through timber sash windows to garden, warm afternoon light streaming in, cozy living room blur in foreground, photorealistic`,
    team: `Group of craftsmen in joinery workshop, back views or side profiles, no clear faces, working on timber windows, natural workshop lighting, photorealistic`,
  };

  const prompt = prompts[category] || prompts.hero;

  try {
    const output = await replicate.run(
      "black-forest-labs/flux-1.1-pro" as any,
      {
        input: {
          prompt: prompt,
          aspect_ratio: "3:2",
          output_format: "jpg",
          output_quality: 90,
        },
      }
    );

    // Download generated image
    if (typeof output === "string") {
      const response = await fetch(output);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const fileName = `gen-${category}-${index}-${Date.now()}.jpg`;
      const outputPath = path.join(OUTPUT_DIR, fileName);
      fs.writeFileSync(outputPath, buffer);

      console.log(`  ✓ Generated: ${fileName}`);
      return fileName;
    }

    return null;
  } catch (error) {
    console.error(`  Failed to generate ${category} image:`, error);
    return null;
  }
}

/**
 * Process a single local image
 */
async function processLocalImage(filePath: string, index: number): Promise<ImageMetadata | null> {
  try {
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName).toLowerCase();
    
    // Skip non-image files
    if (![".jpg", ".jpeg", ".png"].includes(ext)) {
      return null;
    }

    // Generate unique ID
    const fileHash = createHash("md5").update(fs.readFileSync(filePath)).digest("hex").slice(0, 8);
    const id = `local-${index}-${fileHash}`;
    const outputFileName = `${id}.jpg`;
    const outputPath = path.join(OUTPUT_DIR, outputFileName);

    // Enhance image
    const { width, height } = await enhanceImage(filePath, outputPath);

    // Analyze with Vision
    const analysis = await analyzeImageWithVision(outputPath);

    return {
      id,
      publicPath: `/wealden-ai/${outputFileName}`,
      caption: analysis.caption,
      tags: analysis.tags,
      placementHints: analysis.placementHints,
      sourceKind: "local-enhanced",
      width,
      height,
    };
  } catch (error) {
    console.error(`Failed to process ${filePath}:`, error);
    return null;
  }
}

/**
 * Main pipeline
 */
async function main() {
  console.log("🚀 Wealden Joinery AI Image Pipeline\n");

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Step 1: Process local images
  console.log("📸 Step 1: Processing local images from", SOURCE_DIR);
  const localFiles = fs.readdirSync(SOURCE_DIR)
    .filter(f => [".jpg", ".jpeg", ".png"].includes(path.extname(f).toLowerCase()))
    .map(f => path.join(SOURCE_DIR, f));

  console.log(`Found ${localFiles.length} images\n`);

  const processedImages: ImageMetadata[] = [];
  
  for (let i = 0; i < localFiles.length; i++) {
    console.log(`[${i + 1}/${localFiles.length}]`);
    const metadata = await processLocalImage(localFiles[i], i);
    if (metadata) {
      processedImages.push(metadata);
    }
  }

  console.log(`\n✓ Processed ${processedImages.length} local images\n`);

  // Step 2: Check category counts
  console.log("🔍 Step 2: Checking category coverage");
  const categoryCounts: Record<string, number> = {};
  
  for (const img of processedImages) {
    for (const hint of img.placementHints) {
      categoryCounts[hint] = (categoryCounts[hint] || 0) + 1;
    }
  }

  console.log("Current counts:", categoryCounts);
  console.log();

  // Step 3: Generate missing images
  console.log("🎨 Step 3: Generating missing category images");
  
  for (const [category, minCount] of Object.entries(MIN_COUNTS)) {
    const currentCount = categoryCounts[category] || 0;
    const needed = Math.max(0, minCount - currentCount);

    if (needed > 0) {
      console.log(`\nCategory "${category}": need ${needed} more images`);
      
      for (let i = 0; i < needed; i++) {
        const fileName = await generateImage(category, i);
        
        if (fileName) {
          const filePath = path.join(OUTPUT_DIR, fileName);
          const stats = fs.statSync(filePath);
          const metadata: ImageMetadata = {
            id: fileName.replace(".jpg", ""),
            publicPath: `/wealden-ai/${fileName}`,
            caption: `Professional ${category.replace("-", " ")} for Wealden Joinery`,
            tags: [category, "ai-generated", "timber", "joinery"],
            placementHints: [category],
            sourceKind: "ai-generated",
            width: 1800,
            height: 1200,
          };
          processedImages.push(metadata);
        }
      }
    } else {
      console.log(`✓ Category "${category}": ${currentCount}/${minCount} images available`);
    }
  }

  // Step 4: Save manifest
  console.log("\n💾 Step 4: Saving manifest");
  const manifest = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    totalImages: processedImages.length,
    images: processedImages,
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`✓ Saved manifest to ${MANIFEST_PATH}`);

  // Summary
  console.log("\n✅ Pipeline Complete!");
  console.log(`   Total images: ${processedImages.length}`);
  console.log(`   Local enhanced: ${processedImages.filter(i => i.sourceKind === "local-enhanced").length}`);
  console.log(`   AI generated: ${processedImages.filter(i => i.sourceKind === "ai-generated").length}`);
  console.log(`   Output directory: ${OUTPUT_DIR}`);
}

// Check for API keys
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY not found in environment");
  console.error("   Add it to your .env.local file");
  process.exit(1);
}

if (!process.env.REPLICATE_API_TOKEN) {
  console.warn("⚠️  REPLICATE_API_TOKEN not found - image generation will be skipped");
}

// Run
main().catch(console.error);
