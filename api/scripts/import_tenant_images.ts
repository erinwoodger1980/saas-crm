#!/usr/bin/env node
import minimist from "minimist";
import { chromium } from "playwright";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import { fetchText, fetchBuffer, headRequest } from "../src/lib/http";
import { checkRobotsTxt } from "../src/lib/robots";
import {
  extractOgImages,
  extractPageImages,
  extractLikelyGalleryLinks,
  generateAltText,
  ImageCandidate,
} from "../src/lib/html";
import { computePerceptualHash, isDuplicate } from "../src/lib/pHash";

const MAX_IMAGES = parseInt(process.env.IMPORT_MAX_IMAGES || "12", 10);
const MAX_PAGES = parseInt(process.env.IMPORT_MAX_PAGES || "4", 10);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;

interface ProcessedImage {
  src: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
}

async function main() {
  // Filter out the "--" that pnpm adds
  const args = process.argv.slice(2).filter(arg => arg !== "--");
  const argv = minimist(args);
  const slug = argv.slug;
  const url = argv.url;
  const limit = parseInt(argv.limit || MAX_IMAGES, 10);

  if (!slug || !url) {
    console.error("Usage: pnpm images:import -- --slug <slug> --url <url> [--limit 12]");
    process.exit(1);
  }

  console.log(`🎨 Importing images for tenant: ${slug}`);
  console.log(`   Source: ${url}`);
  console.log(`   Limit: ${limit} images\n`);

  // Check robots.txt
  const baseUrl = new URL(url).origin;
  const allowed = await checkRobotsTxt(baseUrl, "/");
  if (!allowed) {
    console.error("❌ robots.txt disallows crawling this site.");
    process.exit(1);
  }
  console.log("✅ robots.txt allows crawling\n");

  // Setup directories
  const webRoot = path.resolve(__dirname, "../../web");
  const rawDir = path.join(webRoot, "public/tenants", slug, "raw");
  const outputDir = path.join(webRoot, "public/tenants", slug);
  const dataDir = path.join(webRoot, "src/data/tenants");

  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  // Collect candidate images
  console.log("🔍 Discovering images...");
  const candidates: ImageCandidate[] = [];

  // 1. Fetch homepage and extract OG/Twitter images
  try {
    const homepageHtml = await fetchText(url);
    const ogImages = extractOgImages(homepageHtml, url);
    candidates.push(...ogImages);
    console.log(`   Found ${ogImages.length} OG/Twitter images`);

    // 2. Discover gallery/portfolio links
    const galleryLinks = extractLikelyGalleryLinks(homepageHtml, url);
    const selectedLinks = [url, ...galleryLinks.slice(0, MAX_PAGES - 1)];
    console.log(`   Found ${galleryLinks.length} potential gallery pages, using ${selectedLinks.length}\n`);

    // 3. Use Playwright to extract images from selected pages
    const browser = await chromium.launch({ headless: true });
    
    for (const pageUrl of selectedLinks) {
      try {
        console.log(`   Scanning: ${pageUrl}`);
        const page = await browser.newPage();
        await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 10000 });
        
        const html = await page.content();
        const pageImages = extractPageImages(html, pageUrl);
        candidates.push(...pageImages);
        console.log(`     → ${pageImages.length} images found`);
        
        await page.close();
      } catch (error: any) {
        console.warn(`     ⚠️  Failed to scan ${pageUrl}: ${error.message}`);
      }
    }
    
    await browser.close();
  } catch (error: any) {
    console.error(`❌ Failed to fetch homepage: ${error.message}`);
    process.exit(1);
  }

  console.log(`\n📊 Total candidates: ${candidates.length}`);
  console.log("🔬 Filtering and downloading...\n");

  // 4. Filter and download
  const downloaded: Array<{ path: string; candidate: ImageCandidate }> = [];
  const seenUrls = new Set<string>();

  for (const candidate of candidates) {
    if (downloaded.length >= limit) break;
    if (seenUrls.has(candidate.url)) continue;
    seenUrls.add(candidate.url);

    // Check file extension and HEAD request
    const urlLower = candidate.url.toLowerCase();
    if (
      urlLower.endsWith(".svg") ||
      urlLower.endsWith(".ico") ||
      urlLower.endsWith(".heic") ||
      urlLower.includes("sprite") ||
      urlLower.includes("icon")
    ) {
      console.log(`   ❌ Skipped (format): ${candidate.url}`);
      continue;
    }

    const { contentType, contentLength } = await headRequest(candidate.url);
    
    if (contentType && !contentType.startsWith("image/")) {
      console.log(`   ❌ Skipped (not image): ${candidate.url}`);
      continue;
    }

    if (contentLength && contentLength > MAX_FILE_SIZE) {
      console.log(`   ❌ Skipped (too large: ${(contentLength / 1024 / 1024).toFixed(1)}MB): ${candidate.url}`);
      continue;
    }

    // Download
    try {
      const buffer = await fetchBuffer(candidate.url);
      const metadata = await sharp(buffer).metadata();

      if (!metadata.width || !metadata.height) {
        console.log(`   ❌ Skipped (no dimensions): ${candidate.url}`);
        continue;
      }

      if (metadata.width < MIN_WIDTH || metadata.height < MIN_HEIGHT) {
        console.log(`   ❌ Skipped (too small: ${metadata.width}×${metadata.height}): ${candidate.url}`);
        continue;
      }

      // Save to raw directory
      const ext = path.extname(new URL(candidate.url).pathname) || ".jpg";
      const filename = `raw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`;
      const rawPath = path.join(rawDir, filename);
      fs.writeFileSync(rawPath, buffer);

      downloaded.push({ path: rawPath, candidate });
      console.log(`   ✅ Downloaded (${metadata.width}×${metadata.height}): ${path.basename(rawPath)}`);
    } catch (error: any) {
      console.log(`   ❌ Failed to download: ${candidate.url} - ${error.message}`);
    }
  }

  console.log(`\n✨ Downloaded ${downloaded.length} images`);
  console.log("🎨 Processing and deduplicating...\n");

  // 5. Compute perceptual hashes and dedupe
  const hashes: string[] = [];
  const processedImages: ProcessedImage[] = [];

  for (let i = 0; i < downloaded.length; i++) {
    const { path: rawPath, candidate } = downloaded[i];

    try {
      const hash = await computePerceptualHash(rawPath);
      
      if (isDuplicate(hash, hashes, 5)) {
        console.log(`   🔄 Duplicate detected: ${path.basename(rawPath)}`);
        fs.unlinkSync(rawPath);
        continue;
      }

      hashes.push(hash);

      // Generate optimized versions
      const baseName = `${slug}-${String(processedImages.length + 1).padStart(3, "0")}`;
      const metadata = await sharp(rawPath).metadata();

      // 1600w JPG (85% quality)
      await sharp(rawPath)
        .resize(1600, undefined, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(path.join(outputDir, `${baseName}_1600.jpg`));

      // 1600w WebP
      await sharp(rawPath)
        .resize(1600, undefined, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(path.join(outputDir, `${baseName}_1600.webp`));

      // 800w WebP
      await sharp(rawPath)
        .resize(800, undefined, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(path.join(outputDir, `${baseName}_800.webp`));

      // Generate alt text
      const filename = path.basename(candidate.url);
      const pageTitle = ""; // Could extract from page <title> if needed
      const alt = generateAltText(filename, pageTitle, candidate.caption || candidate.alt);

      processedImages.push({
        src: `/tenants/${slug}/${baseName}_1600.jpg`,
        alt,
        caption: candidate.caption,
        width: metadata.width || 1600,
        height: metadata.height || 1200,
      });

      console.log(`   ✅ Processed: ${baseName}`);
    } catch (error: any) {
      console.log(`   ❌ Failed to process ${path.basename(rawPath)}: ${error.message}`);
    }
  }

  // 6. Write manifest
  const manifestPath = path.join(dataDir, `${slug}_gallery.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(processedImages, null, 2));
  console.log(`\n📝 Manifest written: ${manifestPath}`);

  // 7. Summary
  console.log(`\n🎉 Complete!`);
  console.log(`   ${processedImages.length} images saved to /tenants/${slug}/`);
  console.log(`   View at: http://localhost:3000/wealden-landing\n`);
}

main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
