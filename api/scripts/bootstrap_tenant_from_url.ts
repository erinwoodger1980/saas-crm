#!/usr/bin/env tsx
/**
 * Bootstrap a tenant from a website URL
 * 
 * Usage:
 * pnpm images:bootstrap -- --slug wealden --url https://wealdenjoinery.com --limit 12
 */

import minimist from 'minimist';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { fetchOG, crawlImages } from '../lib/og';
import { putObject } from '../lib/storage';
import sharp from 'sharp';
import { fetch } from 'undici';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
});

interface Args {
  slug: string;
  url: string;
  limit: number;
}

async function main() {
  const argv = minimist(process.argv.slice(2));
  
  if (!argv.slug || !argv.url) {
    console.error('Usage: tsx bootstrap_tenant_from_url.ts --slug <slug> --url <url> [--limit 12]');
    process.exit(1);
  }

  const args: Args = {
    slug: argv.slug,
    url: argv.url,
    limit: argv.limit || 12,
  };

  console.log(`\n🚀 Bootstrapping tenant: ${args.slug}`);
  console.log(`📍 Source URL: ${args.url}`);
  console.log(`🖼️  Image limit: ${args.limit}\n`);

  // Step 1: Fetch OG data
  console.log('📊 Fetching Open Graph data...');
  const ogData = await fetchOG(args.url);
  console.log('   Found:', {
    siteName: ogData.siteName || ogData.title,
    ogImage: ogData.ogImage ? '✓' : '✗',
    themeColor: ogData.themeColor || '✗',
    phone: ogData.phone || '✗',
    email: ogData.email || '✗',
  });

  // Step 2: Create or update tenant in DB
  console.log('\n💾 Creating/updating tenant in database...');
  const tenant = await prisma.landingTenant.upsert({
    where: { slug: args.slug },
    create: {
      slug: args.slug,
      name: ogData.siteName || ogData.title || args.slug,
      homeUrl: args.url,
      phone: ogData.phone,
      email: ogData.email,
      brandColor: ogData.themeColor,
      logoUrl: ogData.ogImage,
    },
    update: {
      homeUrl: args.url,
      phone: ogData.phone || undefined,
      email: ogData.email || undefined,
      brandColor: ogData.themeColor || undefined,
      updatedAt: new Date(),
    },
  });
  console.log(`   Tenant ID: ${tenant.id}`);

  // Step 3: Crawl images
  console.log('\n🖼️  Crawling images from homepage...');
  const imageUrls = await crawlImages(args.url, args.limit);
  console.log(`   Found ${imageUrls.length} images`);

  // Step 4: Download, process, and store images
  console.log('\n⬇️  Downloading and processing images...');
  const processedImages: Array<{ src: string; alt: string }> = [];
  
  for (let i = 0; i < imageUrls.length; i++) {
    const imgUrl = imageUrls[i];
    try {
      console.log(`   [${i + 1}/${imageUrls.length}] ${imgUrl.substring(0, 60)}...`);

      // Fetch image
      const response = await fetch(imgUrl);
      if (!response.ok) {
        console.log(`      ✗ Failed to fetch (${response.status})`);
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        console.log(`      ✗ Not an image (${contentType})`);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Check size (skip if > 5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        console.log(`      ✗ Too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
        continue;
      }

      // Process with Sharp (resize, optimize, convert to WebP)
      const processed = await sharp(buffer)
        .resize(1600, 1200, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();

      // Store via storage.ts
      const { publicUrl } = await putObject({
        tenantSlug: args.slug,
        buffer: processed,
        ext: 'webp',
      });

      // Create DB record
      const alt = imgUrl.split('/').pop()?.split('.')[0] || 'Image';
      await prisma.landingTenantImage.create({
        data: {
          landingTenantId: tenant.id,
          url: publicUrl,
          altText: alt,
          order: i,
        },
      });

      processedImages.push({ src: publicUrl, alt });
      console.log(`      ✓ Stored: ${publicUrl}`);
    } catch (error: any) {
      console.log(`      ✗ Error: ${error.message}`);
    }
  }

  console.log(`\n✅ Processed ${processedImages.length} images`);

  // Step 5: Write fallback JSON files
  console.log('\n📝 Writing fallback JSON files...');
  const webDataDir = join(process.cwd(), '../web/src/data/tenants');
  mkdirSync(webDataDir, { recursive: true });

  const tenantJson = {
    name: tenant.name,
    slug: tenant.slug,
    phone: tenant.phone || '',
    email: tenant.email || '',
    address: '',
    homeUrl: tenant.homeUrl || '',
    logo: tenant.logoUrl || '',
    brand: {
      primary: tenant.brandColor || '#18332F',
      accent: '#C9A14A',
    },
    gallery: [],
    reviews: [],
    serviceAreas: [],
    priceAnchor: {},
    guarantees: {
      bullets: [],
    },
  };

  const tenantJsonPath = join(webDataDir, `${args.slug}.json`);
  writeFileSync(tenantJsonPath, JSON.stringify(tenantJson, null, 2));
  console.log(`   ✓ ${tenantJsonPath}`);

  const galleryJson = processedImages.map(img => ({
    src: img.src,
    alt: img.alt,
  }));

  const galleryJsonPath = join(webDataDir, `${args.slug}_gallery.json`);
  writeFileSync(galleryJsonPath, JSON.stringify(galleryJson, null, 2));
  console.log(`   ✓ ${galleryJsonPath}`);

  // Step 6: Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ Bootstrap complete!');
  console.log('='.repeat(60));
  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`Images: ${processedImages.length} stored`);
  console.log(`Database: LandingTenant + ${processedImages.length} LandingTenantImage records`);
  console.log(`Fallback JSONs: ${tenantJsonPath}, ${galleryJsonPath}`);
  console.log('\nNext steps:');
  console.log(`1. Visit: http://localhost:3000/admin/tenants/${args.slug}/landing-editor`);
  console.log(`2. Edit content, add reviews, set pricing`);
  console.log(`3. Publish`);
  console.log(`4. View: http://localhost:3000/tenant/${args.slug}/landing\n`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error('\n❌ Error:', error);
  prisma.$disconnect().finally(() => pool.end());
  process.exit(1);
});
