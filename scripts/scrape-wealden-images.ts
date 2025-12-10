import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';

const TARGET_PAGES = [
  'https://www.wealdenjoinery.com/',
  'https://www.wealdenjoinery.com/gallery/',
  'https://www.wealdenjoinery.com/projects/',
];

const IMAGE_DIR = path.join(process.cwd(), 'public', 'wealden-scraped');
const IMAGE_MAP_PATH = path.join(process.cwd(), 'scripts', 'wealden-image-map.json');
const DOWNLOAD_DELAY_MS = 200;

const VALID_HOST = 'www.wealdenjoinery.com';
const VALID_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

type ScrapedImage = {
  originalUrl: string;
  alt?: string;
  page: string;
};

type ImageMapEntry = {
  originalUrl: string;
  localPath: string;
  alt: string;
  page?: string;
};

function sleep(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

function hasValidExtension(url: URL) {
  const lowerPath = url.pathname.toLowerCase();
  return VALID_EXTENSIONS.some((ext) => lowerPath.endsWith(ext));
}

function normalizeUrl(rawUrl: string, baseUrl: string): string | null {
  try {
    const url = new URL(rawUrl, baseUrl);
    if (url.hostname !== VALID_HOST) return null;
    if (!hasValidExtension(url)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function extractImagesFromHtml(html: string, pageUrl: string): ScrapedImage[] {
  const $ = cheerio.load(html);
  const results: ScrapedImage[] = [];

  $('img').each((_, element) => {
    const rawSrc = $(element).attr('src') || $(element).attr('data-src');
    if (!rawSrc) return;

    const normalized = normalizeUrl(rawSrc, pageUrl);
    if (!normalized) return;

    results.push({ originalUrl: normalized, alt: $(element).attr('alt') ?? undefined, page: pageUrl });
  });

  return results;
}

function filenameFromUrl(urlString: string) {
  try {
    const url = new URL(urlString);
    const base = path.basename(url.pathname);
    return base || 'image.jpg';
  } catch {
    return 'image.jpg';
  }
}

function slugifyAlt(text: string) {
  return text
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function fetchHtml(url: string) {
  try {
    const response = await axios.get<string>(url, { responseType: 'text', validateStatus: () => true });
    if (response.status >= 400) {
      console.warn(`Skipping ${url} – status ${response.status}`);
      return '';
    }
    return response.data;
  } catch (error) {
    console.warn(`Failed to fetch ${url}: ${(error as Error).message}`);
    return '';
  }
}

async function downloadImage(url: string, destination: string) {
  try {
    const response = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', validateStatus: () => true });
    if (response.status >= 400) {
      console.warn(`Failed to download ${url} – status ${response.status}`);
      return false;
    }

    await fs.writeFile(destination, Buffer.from(response.data));
    return true;
  } catch (error) {
    console.warn(`Error downloading ${url}: ${(error as Error).message}`);
    return false;
  }
}

async function run() {
  const collectedImages = new Map<string, ScrapedImage>();
  let crawledPages = 0;

  for (const page of TARGET_PAGES) {
    const html = await fetchHtml(page);
    if (!html) continue;

    crawledPages += 1;
    const images = extractImagesFromHtml(html, page);
    for (const image of images) {
      if (!collectedImages.has(image.originalUrl)) {
        collectedImages.set(image.originalUrl, image);
      }
    }
  }

  console.log(`Pages crawled: ${crawledPages}`);
  console.log(`Images found: ${collectedImages.size}`);

  await ensureDir(IMAGE_DIR);

  const usedFilenames = new Map<string, number>();
  const downloaded: ImageMapEntry[] = [];

  for (const image of collectedImages.values()) {
    const baseName = filenameFromUrl(image.originalUrl);
    const { name, ext } = path.parse(baseName);
    const count = usedFilenames.get(baseName) || 0;
    const filename = count === 0 ? baseName : `${name}-${count}${ext}`;
    usedFilenames.set(baseName, count + 1);

    const localPath = path.join(IMAGE_DIR, filename);
    const saved = await downloadImage(image.originalUrl, localPath);
    await sleep(DOWNLOAD_DELAY_MS);
    if (!saved) continue;

    const altText = image.alt && image.alt.trim().length > 0 ? image.alt : slugifyAlt(filename);
    downloaded.push({
      originalUrl: image.originalUrl,
      localPath: `/wealden-scraped/${filename}`,
      alt: altText || 'wealden joinery project image',
      page: image.page,
    });
  }

  await fs.writeFile(IMAGE_MAP_PATH, JSON.stringify({ images: downloaded }, null, 2));

  console.log(`Images downloaded: ${downloaded.length}`);
  console.log(`Image map saved to ${IMAGE_MAP_PATH}`);
}

run();
