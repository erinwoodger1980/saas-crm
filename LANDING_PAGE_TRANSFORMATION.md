# Landing Page Transformation Summary

## Overview
Transformed `/web/src/app/tenant/[slug]/landing/page.tsx` from an internal dashboard view to a high-converting, public marketing landing page optimized for Google Ads and SEO.

## Architecture Changes

### Before
- Single client component with `'use client'`
- Client-side data fetching with `useState`/`useEffect`
- CSS modules for styling
- Limited SEO capabilities

### After
- **Server Component** (`page.tsx`): SEO-optimized, server-side data fetching
- **Client Component** (`client.tsx`): Interactive features (forms, modals, tracking)
- **Tailwind CSS**: Modern utility-first styling
- **Dynamic Metadata**: Per-keyword, per-location SEO

## Files Created/Modified

### 1. `/web/src/app/tenant/[slug]/landing/page.tsx` (156 lines)
**Purpose**: Server component for SEO and data loading

**Key Features**:
- `generateMetadata()` - Dynamic SEO for each keyword/location
- Server-side data fetching with `fetchTenantFromDB()`
- Error handling and loading states
- Transforms DB data to component-friendly format
- Parses JSON fields with fallbacks

**SEO Metadata**:
- Page title: `${keyword} in ${location} | ${tenant.name}`
- Meta description with keyword and location
- Open Graph tags for social sharing
- Twitter Card tags
- Dynamic based on URL parameters

### 2. `/web/src/app/tenant/[slug]/landing/client.tsx` (850+ lines)
**Purpose**: Client component with interactive features

**Sections Implemented**:
1. **Sticky Header**
   - Scroll detection (changes at 50px)
   - Logo + phone number + CTA button
   - Mobile-responsive with floating phone icon

2. **Hero Section**
   - Full-screen with background image
   - Dynamic headline with keyword insertion
   - Dual CTAs (form scroll + phone call)
   - Trust indicators (rating, service areas)
   - Animated scroll indicator

3. **Urgency Banner**
   - Conditional display based on tenant settings
   - Red background for attention
   - Configurable text + subtext

4. **Trust Strip**
   - FENSA, PAS 24, Accoya badges
   - 50-year guarantee highlight
   - Horizontal scroll on mobile

5. **Reviews Section**
   - Grid layout (3 columns on desktop)
   - Star ratings display
   - Customer quotes with names/locations
   - First 6 reviews shown

6. **Gallery Section**
   - Grid layout with aspect ratio preservation
   - Lightbox modal on click
   - First 6 images shown
   - Next.js Image optimization

7. **Guarantees & Pricing**
   - Two-column layout
   - Checkmark list of guarantees
   - Risk reversal statement
   - Price anchoring (from price + range)
   - Transparency messaging

8. **Lead Form**
   - Green gradient background
   - White card with shadow
   - Fields: name, email, phone, postcode, interest, details
   - GDPR consent checkbox
   - Form submission tracking
   - Validation (HTML5 required)

9. **FAQ Section**
   - Accordion component (Radix UI)
   - 4 common questions
   - Collapsible answers
   - Schema.org markup for Google

10. **Footer**
    - Company info with address
    - Service areas list
    - Quick links
    - Copyright notice

**Interactive Features**:
- **Exit Intent Modal**: Triggers on mouse leave from top
- **Image Lightbox**: Full-screen image viewer
- **Scroll-to-form**: Smooth scrolling on CTA clicks
- **Sticky Mobile Dock**: Call + Quote buttons at bottom
- **WhatsApp Button**: Floating action button (if tenant has WhatsApp)

**Analytics Tracking**:
- Form interactions: `select_content`
- Phone clicks: `click_contact_phone`
- Form submissions: `generate_lead`
- Exit intent: `view_item_list`
- WhatsApp clicks: `click_whatsapp`

**Schema.org Markup**:
- `LocalBusiness`: Name, phone, email, address, hours
- `AggregateRating`: Average rating + review count
- `FAQPage`: All FAQ questions/answers

### 3. `/web/src/components/ui/accordion.tsx`
**Purpose**: shadcn/ui Accordion component for FAQ section

**Features**:
- Built on Radix UI primitives
- Animated open/close
- Keyboard accessible
- Chevron rotation indicator

### 4. `/web/globals.css`
**Purpose**: Global styles and animations

**Animations Added**:
- `animate-fade-in`: Fade in with translate up (0.8s)
- `animate-scale-in`: Scale in with fade (0.3s)

### 5. `/web/tailwind.config.ts`
**Purpose**: Tailwind configuration

**Updates**:
- Added `./src/**/*.{js,ts,jsx,tsx}` to content paths
- Added `accordion-down` keyframe
- Added `accordion-up` keyframe
- Added corresponding animations

## Dependencies Installed
```bash
pnpm add @radix-ui/react-accordion
```

## Data Structure Expected

### Tenant Object (from DB)
```typescript
{
  name: string;
  slug: string;
  phone: string;
  email: string;
  address?: string;
  logoUrl?: string;
  brandColor?: string;
  whatsapp?: string;
  images: Array<{ url: string; altText?: string }>;
  reviews: Array<{ quote: string; author: string; location?: string; rating: number }>;
  content: {
    serviceAreas: string[];  // e.g., ["Tonbridge", "Tunbridge Wells", "Sevenoaks"]
    headline?: string;
    subhead?: string;
    guarantees: string | {  // JSON string or object
      bullets: string[];
      riskReversal: string;
    };
    urgency: string | {  // JSON string or object
      text: string;
      sub?: string;
    };
    leadMagnet: string | {  // JSON string or object
      title: string;
      description: string;
    };
  };
}
```

### URL Parameters
- `kw`: Keyword for dynamic content (e.g., "Sash Windows")
- Example: `/tenant/wealden-joinery/landing?kw=Sash%20Windows`

## SEO Optimizations

### Title Formula
- With keyword: `${keyword} in ${location} | ${tenant.name}`
- Without: `${tenant.name} - Beautifully Crafted Timber Windows & Doors`

### Description Formula
- With keyword: `Expert ${keyword.toLowerCase()} services in ${location}. ${tenant.name} provides heritage quality with modern performance. Get your free quote today!`
- Without: `${tenant.name} provides bespoke timber windows and doors in ${location}. PAS 24 certified, 50-year guarantee. Serving ${serviceAreas.join(', ')}.`

### Open Graph & Twitter
- Uses first tenant image as social card
- Dynamic title/description per page
- `summary_large_image` card type

### Schema.org
- **LocalBusiness**: 
  - Business details
  - Service areas
  - Contact info
  - Opening hours
- **AggregateRating**: Average star rating
- **FAQPage**: FAQ structured data for rich snippets

## Performance Considerations

1. **Server-Side Rendering**:
   - Data fetched at build/request time
   - No client-side waterfall requests
   - Faster initial page load

2. **Image Optimization**:
   - Next.js `<Image>` component
   - Automatic WebP conversion
   - Lazy loading below fold

3. **Code Splitting**:
   - Client component loaded separately
   - Suspense boundary for progressive hydration

4. **CSS**:
   - Tailwind purges unused classes
   - No CSS modules overhead
   - Minimal custom CSS

## Conversion Optimization

### Multiple CTAs
1. Hero: "Get My Free Quote" + "Call [phone]"
2. Header: "Get Free Quote" button
3. Mobile sticky dock: "Call Now" + "Get Quote"
4. WhatsApp button (if available)
5. Footer: Contact info

### Trust Signals
- Star ratings + review count
- Trust badges (FENSA, PAS 24, Accoya)
- 50-year guarantee highlight
- Customer testimonials
- Service areas listed

### Urgency
- Configurable urgency banner
- Limited slots messaging
- Seasonal promotions

### Lead Magnets
- Exit intent modal
- Free guide download
- No obligation messaging

## Mobile Responsiveness

- Sticky header with mobile phone icon
- Mobile menu (hidden on desktop)
- Bottom sticky dock (mobile only)
- Responsive grid layouts (1 col mobile → 3 cols desktop)
- Touch-friendly button sizes
- Optimized image sizes

## Testing Checklist

### Functionality
- [ ] Form submission works
- [ ] Phone links dial correctly
- [ ] WhatsApp button opens app/web
- [ ] Exit intent triggers on mouse leave
- [ ] Lightbox opens/closes
- [ ] Accordion expands/collapses
- [ ] Scroll-to-form smooth scrolls
- [ ] Analytics events fire

### SEO
- [ ] Title tag correct
- [ ] Meta description present
- [ ] OG tags populated
- [ ] Twitter Card tags present
- [ ] Schema.org markup validates
- [ ] Canonical URL set

### Performance
- [ ] LCP < 2.5s (target < 1s)
- [ ] FID < 100ms
- [ ] CLS < 0.1
- [ ] Images lazy load
- [ ] Above-fold content prioritized

### Cross-Browser
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari (iOS)
- [ ] Chrome (Android)

## Production Deployment

### Before Launch
1. Replace placeholder trust badge images in `/web/public/`:
   - `trust-fensa.png`
   - `trust-pas24.png`
   - `trust-accoya.png`

2. Configure Google Analytics:
   - Add GA4 tracking code
   - Test event tracking

3. Configure Meta Pixel:
   - Add Facebook Pixel code
   - Test conversion events

4. Test with real tenant data:
   - Ensure DB has published content
   - Verify images load correctly
   - Test all service areas

### After Launch
1. Monitor analytics events
2. Check Google Search Console for errors
3. Validate structured data with Google's tool
4. Test conversion funnel end-to-end
5. Monitor page load speed in PageSpeed Insights

## Next Steps

1. **Add Trust Badges**: Create/upload actual badge images
2. **GA4/Pixel Setup**: Add tracking scripts to `<head>`
3. **Form Handler**: Connect form to lead creation endpoint
4. **A/B Testing**: Test different headlines/CTAs
5. **Conversion Tracking**: Set up Google Ads conversion tracking
6. **Mobile Testing**: Test on real devices
7. **Performance Audit**: Run Lighthouse audit

## Notes

- All sections use Tailwind CSS (no CSS modules)
- Client component handles ALL interactivity
- Server component handles ALL data fetching
- Exit intent only triggers once per session
- Form validation is HTML5 (can add custom validation later)
- Schema markup is generated dynamically per tenant
- Trust badges need real images (currently placeholders)
- FAQ content is hardcoded (can be made dynamic later)

## File Sizes (Approximate)

- `page.tsx`: 156 lines (~5 KB)
- `client.tsx`: 850 lines (~35 KB)
- `accordion.tsx`: 65 lines (~2 KB)

## Dependencies

- `lucide-react`: Icons
- `@radix-ui/react-accordion`: Accordion primitive
- `next/image`: Image optimization
- `tailwindcss`: Styling

## Breaking Changes

- Removed dependency on CSS modules
- Removed client-side data fetching
- Changed component API (now takes server-fetched data)
- Removed old TenantData interface

## Migration Path for Existing Tenants

All tenants will automatically use the new landing page. Ensure:
1. `LandingTenant.content` field has required structure
2. Images uploaded to `LandingTenant.images`
3. Reviews added to `LandingTenant.reviews`
4. Service areas configured in `content.serviceAreas`
