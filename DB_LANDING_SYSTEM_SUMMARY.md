# Multi-Tenant Landing Page System - Implementation Summary

## ✅ Implementation Status

### Phase 1: Database & Infrastructure (COMPLETE)
- ✅ Prisma models added (LandingTenant, LandingTenantContent, LandingTenantImage, LandingTenantReview)
- ✅ Storage abstraction layer (S3 or local filesystem)
- ✅ OG tag scraping & image crawling utilities
- ✅ Bootstrap CLI script for automated tenant onboarding

### Phase 2: API Layer (COMPLETE)
- ✅ REST API CRUD endpoints for tenants, content, images, reviews
- ✅ Admin authentication middleware (x-admin-key)
- ✅ Image upload with multipart/form-data support
- ✅ Published/draft content filtering

### Phase 3: Web Frontend (PARTIAL)
- ✅ Updated landing page with DB-first data fetching
- ✅ JSON fallback for graceful degradation
- ✅ API client helper with authentication
- ⏳ WYSIWYG editor (pending - see instructions below)

---

## 📁 Files Created/Modified

### API (`/api`)

**New Files:**
1. `src/lib/storage.ts` (103 lines)
   - S3 or local filesystem abstraction
   - `putObject()` - stores images with automatic path generation
   - Supports both cloud (S3) and local (`web/public/tenants/`) storage

2. `src/lib/og.ts` (154 lines)
   - `fetchOG()` - scrapes Open Graph tags, theme colors, contact info
   - `crawlImages()` - finds prominent images from homepage (skips icons/SVGs)
   - 6-second timeout with graceful fallback

3. `scripts/bootstrap_tenant_from_url.ts` (197 lines)
   - CLI tool for automated tenant bootstrapping
   - Fetches OG data, downloads images, processes with Sharp
   - Creates DB records + fallback JSON files
   - Usage: `pnpm images:bootstrap -- --slug wealden --url https://wealdenjoinery.com --limit 12`

4. `src/routes/landing-tenants.ts` (312 lines)
   - GET `/landing-tenants/:slug` - fetch tenant with content (public)
   - PUT `/landing-tenants/:slug/content` - upsert content (admin)
   - POST `/landing-tenants/:slug/images/upload` - upload image (admin)
   - PATCH `/landing-tenants/:slug/images/:id` - update image metadata (admin)
   - DELETE `/landing-tenants/:slug/images/:id` - delete image (admin)
   - POST/PATCH/DELETE `/landing-tenants/:slug/reviews` - CRUD reviews (admin)

**Modified Files:**
1. `prisma/schema.prisma`
   - Added 4 new models: LandingTenant, LandingTenantContent, LandingTenantImage, LandingTenantReview
   - Separate namespace from existing Tenant model (avoids conflicts)

2. `src/server.ts`
   - Added `landingTenantsRouter` import and route registration
   - Endpoint: `/landing-tenants/*` (no requireAuth - uses x-admin-key instead)

3. `package.json`
   - Added script: `"images:bootstrap": "tsx scripts/bootstrap_tenant_from_url.ts"`

**Dependencies Added:**
- `cheerio` - HTML parsing for OG tags
- `sharp` - Image processing (resize, optimize, WebP conversion)
- `minimist` - CLI argument parsing
- `undici` - Modern fetch implementation
- `@aws-sdk/client-s3` - S3 storage (optional)
- `tsx` - TypeScript execution for scripts

---

### Web (`/web`)

**New Files:**
1. `src/lib/landing-api.ts` (147 lines)
   - API client helper with x-admin-key authentication
   - `fetchTenantFromDB()` - fetch published or draft content
   - `updateTenantContent()` - save content
   - `uploadTenantImage()` - multipart upload
   - CRUD helpers for images and reviews

**Modified Files:**
1. `src/app/tenant/[slug]/landing/page.tsx`
   - **Data Loading Priority:**
     1. Try DB (published content) via API
     2. Fallback to static JSON + OG enrichment
   - Transforms DB response to TenantData format
   - Maintains all existing CRO features (A/B testing, tracking, Schema.org)

**Dependencies Added:**
- `react-hook-form` - Form state management
- `zod` - Schema validation
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm` - WYSIWYG editor
- `lucide-react` - Icon library
- `react-dropzone` - File upload component

---

## 🔧 Environment Variables

### API (`.env` in `/api`)

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Admin Authentication
ADMIN_KEY=supersecret  # Change in production!

# Storage Mode 1: S3 (recommended for production)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
S3_BUCKET=joineryai-assets
PUBLIC_BASE_URL=https://cdn.joineryai.app  # CDN URL for S3 files

# Storage Mode 2: Local Filesystem (development)
LOCAL_ASSET_DIR=../web/public/tenants  # Relative to api/ directory
```

### Web (`.env.local` in `/web`)

```bash
# API Base URL
NEXT_PUBLIC_API_BASE=http://localhost:4000  # or https://api.joineryai.app

# Admin Key (dev only - replace with real auth in production)
NEXT_PUBLIC_ADMIN_KEY=supersecret

# Existing variables
NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/yourcompany
NEXT_PUBLIC_WHATSAPP=+441234567890
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
NEXT_PUBLIC_FB_PIXEL_ID=XXXXXXXXXX
```

---

## 🚀 Getting Started

### 1. Database Setup

```bash
cd api

# Generate Prisma client
pnpm prisma generate

# Run migration (requires DATABASE_URL)
pnpm prisma migrate dev --name landing_tenants_content
```

### 2. Bootstrap a Tenant

```bash
cd api

# Example: Wealden Joinery
pnpm images:bootstrap -- --slug wealden --url https://wealdenjoinery.com --limit 12

# This will:
# - Create LandingTenant in DB
# - Download & process 12 images
# - Create LandingTenantImage records
# - Write fallback JSON files to web/src/data/tenants/
```

### 3. Start Development Servers

```bash
# Terminal 1: API
cd api
pnpm dev  # Runs on :4000

# Terminal 2: Web
cd web
pnpm dev  # Runs on :3000
```

### 4. View Landing Page

```bash
# Public landing page (uses published DB content or JSON fallback)
open http://localhost:3000/tenant/wealden/landing
```

---

## 📝 Next Steps (WYSIWYG Editor)

The editor is NOT yet implemented but all the API infrastructure is ready. Here's what's needed:

### Create: `web/src/app/admin/tenants/[slug]/landing-editor/page.tsx`

**Structure:**
```tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { fetchTenantFromDB, updateTenantContent } from '@/lib/landing-api';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// TipTap editor for rich text
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

// Tabs for different sections
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Components (to create):
import { EditorForm } from './components/EditorForm';
import { LivePreview } from './components/LivePreview';
import { GalleryManager } from './components/GalleryManager';
import { ReviewsManager } from './components/ReviewsManager';

export default function LandingEditorPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [tenantData, setTenantData] = useState(null);
  const [draft Content, setDraftContent] = useState(null);

  // Load draft content from DB
  useEffect(() => {
    async function load() {
      const data = await fetchTenantFromDB(slug, true); // draft=true
      setTenantData(data);
      setDraftContent(data.content);
    }
    load();
  }, [slug]);

  // Split-pane layout: Editor (left) + Preview (right)
  return (
    <div className="flex h-screen">
      {/* Left Pane: Editor */}
      <div className="w-1/2 overflow-y-auto p-6 border-r">
        <EditorForm 
          slug={slug}
          tenantData={tenantData}
          onSave={(data) => updateTenantContent(slug, data)}
        />
      </div>

      {/* Right Pane: Live Preview */}
      <div className="w-1/2 overflow-y-auto bg-gray-50">
        <LivePreview tenantData={tenantData} draftContent={draftContent} />
      </div>
    </div>
  );
}
```

**Components to Create:**

1. **EditorForm** - React Hook Form with tabs:
   - Brand & Contact (name, phone, email, logo upload, brand colors)
   - Hero & Hooks (headline with A/B variants, subhead with TipTap)
   - Pricing & Urgency (priceFromText, priceRange, urgency banner)
   - Guarantees (bullet list + risk reversal)
   - FAQ (array of Q&As with TipTap for answers)
   - Lead Magnet (title, CTA, PDF upload)
   - Publish (toggle + save button)

2. **GalleryManager** - Drag-drop images:
   - Use `react-dropzone` for uploads
   - Call `uploadTenantImage()` on drop
   - Display grid with reorder (drag handles)
   - Inline edit for alt/caption

3. **ReviewsManager** - CRUD interface:
   - Add review button → modal with form
   - Edit/delete existing reviews
   - Star rating picker (1-5 stars)
   - Sortable list

4. **LivePreview** - Wraps existing landing component:
   - Import `TenantLandingPage` from `../../[slug]/landing/page`
   - Pass in-memory draft data as props
   - Disable tracking/forms in preview mode

---

## 🔒 Production Hardening

### Security
1. **Replace x-admin-key with JWT auth:**
   ```typescript
   // Integrate with existing auth system
   import { requireAuth } from './middleware/auth';
   router.put('/:slug/content', requireAuth, async (req, res) => {
     // Check if user.role === 'admin' or user.tenantId === tenant.id
   });
   ```

2. **Rate limiting:**
   ```bash
   pnpm add express-rate-limit
   ```

3. **Input validation:**
   - Add Zod schemas for all request bodies
   - Sanitize user inputs (prevent XSS)

### Performance
1. **CDN for assets:**
   - Upload to S3 + CloudFront
   - Set `PUBLIC_BASE_URL=https://cdn.joineryai.app`

2. **Image optimization:**
   - Sharp already converts to WebP
   - Consider adding blurhash placeholders

3. **Caching:**
   - Redis cache for published tenant data (TTL: 5 minutes)
   - Invalidate on content.published = true

### Monitoring
1. **Logging:**
   - Add structured logging (Winston/Pino)
   - Log all admin actions (audit trail)

2. **Error tracking:**
   - Sentry for API errors
   - Track failed uploads, DB errors

---

## 📊 Database Schema

### LandingTenant
- `id` (cuid)
- `slug` (unique) - URL slug for tenant
- `name` - Business name
- `homeUrl` - Original website
- `email`, `phone`, `address` - Contact info
- `brandColor` (hex) - Primary brand color
- `logoUrl` - Logo image URL
- `createdAt`, `updatedAt`

### LandingTenantContent
- `id` (cuid)
- `tenantId` (unique, foreign key)
- `headline`, `subhead` - Hero section
- `priceFromText`, `priceRange` - Pricing
- `guarantees` (JSON) - `{ bullets:[], riskReversal:"" }`
- `urgency` (JSON) - `{ text:"", sub:"" }`
- `faqJson` (JSON) - Array of `{ q:"", a:"" }`
- `leadMagnet` (JSON) - `{ title:"", cta:"", url:"" }`
- `serviceAreas` (JSON) - Array of strings
- `published` (boolean) - Draft vs. live
- `updatedAt`

### LandingTenantImage
- `id` (cuid)
- `tenantId` (foreign key)
- `src` - Image URL (S3 or /public path)
- `alt`, `caption` - Metadata
- `sortOrder` - Display order
- `createdAt`

### LandingTenantReview
- `id` (cuid)
- `tenantId` (foreign key)
- `quote` - Review text
- `author`, `location` - Attribution
- `stars` (1-5)
- `sortOrder` - Display order
- `createdAt`

---

## 🎯 Benefits of This Architecture

### For Developers
- ✅ **Single source of truth:** DB is authoritative, JSON is fallback
- ✅ **Type safety:** Prisma generates TypeScript types
- ✅ **Reusable:** Storage/OG libs can be used elsewhere
- ✅ **Testable:** API routes can be unit tested

### For Content Editors
- ✅ **No-code editing:** WYSIWYG editor (when built)
- ✅ **Draft/publish workflow:** Safe previews before going live
- ✅ **Instant updates:** No Git commits or redeployments

### For Tenants
- ✅ **Fast onboarding:** Bootstrap CLI takes <2 minutes
- ✅ **SEO optimized:** Schema.org markup, semantic HTML
- ✅ **Performance:** WebP images, lazy loading, CDN-ready

---

## 📖 Example Workflows

### Onboard New Tenant
```bash
# 1. Bootstrap from website
cd api
pnpm images:bootstrap -- --slug acme-windows --url https://acmewindows.com --limit 10

# 2. Open editor (once implemented)
open http://localhost:3000/admin/tenants/acme-windows/landing-editor

# 3. Edit content, add reviews, upload more images

# 4. Click "Publish"

# 5. View public page
open http://localhost:3000/tenant/acme-windows/landing
```

### Update Existing Tenant Content
```bash
# Option 1: Use editor UI (recommended)
open http://localhost:3000/admin/tenants/wealden/landing-editor

# Option 2: API directly
curl -X PUT http://localhost:4000/landing-tenants/wealden/content \
  -H "x-admin-key: supersecret" \
  -H "Content-Type: application/json" \
  -d '{
    "headline": "New Headline",
    "published": true
  }'
```

### Revert to JSON Fallback (Testing)
```bash
# Stop API server
pkill -f "pnpm dev"

# Landing page automatically falls back to JSON files
open http://localhost:3000/tenant/wealden/landing
```

---

## 🐛 Troubleshooting

### "Property 'landingTenant' does not exist on type 'PrismaClient'"
**Cause:** Prisma client not regenerated after schema changes

**Fix:**
```bash
cd api
pnpm prisma generate
```

### "Database error: Environment variable not found: DATABASE_URL"
**Cause:** Missing `.env` file

**Fix:**
```bash
cd api
cp .env.example .env  # If exists
# Edit .env and add DATABASE_URL
```

### "401 Unauthorized" on API requests from editor
**Cause:** Missing or incorrect `x-admin-key` header

**Fix:**
1. Check `ADMIN_KEY` in `api/.env`
2. Check `NEXT_PUBLIC_ADMIN_KEY` in `web/.env.local`
3. Ensure they match

### Images not uploading
**Cause:** Storage not configured

**Fix (Local):**
```bash
# In api/.env
LOCAL_ASSET_DIR=../web/public/tenants

# Create directory
mkdir -p web/public/tenants
```

**Fix (S3):**
```bash
# In api/.env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET=your-bucket
PUBLIC_BASE_URL=https://your-cdn.com
```

---

## ✅ Verification Checklist

- [ ] Prisma migration ran successfully
- [ ] Bootstrap CLI creates tenant + images in DB
- [ ] JSON fallback files created in `web/src/data/tenants/`
- [ ] API routes respond (test with curl/Postman)
- [ ] Landing page loads from DB (check Network tab for API call)
- [ ] Landing page falls back to JSON when API is down
- [ ] All CRO features still work (tracking, Schema.org, forms)

---

## 📚 Related Documentation

- `TENANT_ONBOARDING_GUIDE.md` - Manual tenant setup (JSON-based)
- `MULTI_TENANT_LANDING_SUMMARY.md` - Original multi-tenant implementation
- `MULTI_TENANT_QUICK_REF.md` - Quick reference guide

---

**Status:** API Layer Complete ✅ | Web Data Fetching Complete ✅ | Editor Pending ⏳

**Next Immediate Steps:**
1. Set up DATABASE_URL and run migrations
2. Test bootstrap CLI with a real website
3. Implement WYSIWYG editor (see instructions above)
4. Replace x-admin-key with real authentication

**Estimated Time to Complete Editor:** 4-6 hours

---

Last Updated: November 7, 2025
Version: 2.0.0
