# Landing Page Quick Reference

## 🚀 Production Launch Checklist

### 1. Trust Badge Images (REQUIRED)
Add these images to `/web/public/`:
- `trust-fensa.png` - FENSA certification logo
- `trust-pas24.png` - PAS 24 security logo
- `trust-accoya.png` - Accoya wood logo

Recommended size: 200x100px, transparent PNG

### 2. Analytics Setup
Add to `/web/src/app/layout.tsx` or landing page head:

```typescript
// Google Analytics 4
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script dangerouslySetInnerHTML={{
  __html: `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-XXXXXXXXXX');
  `
}} />

// Meta Pixel
<script dangerouslySetInnerHTML={{
  __html: `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', 'YOUR_PIXEL_ID');
    fbq('track', 'PageView');
  `
}} />
```

### 3. Form Handler Connection
Update form submission in `client.tsx`:

```typescript
// Replace alert() with actual API call
const response = await fetch('/api/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(formData),
});
```

### 4. Test with Real Data
Ensure tenant has:
- ✅ `name`, `slug`, `phone`, `email`, `address`
- ✅ At least 1 image in `images` array
- ✅ At least 3 reviews in `reviews` array
- ✅ Service areas in `content.serviceAreas`

## 📊 URL Parameters

### Keyword Parameter
```
/tenant/wealden-joinery/landing?kw=Sash%20Windows
```
- Updates headline: "Expert Sash Windows in Tonbridge"
- Updates meta title/description
- Tracks keyword in analytics

### Examples
- `/tenant/wealden-joinery/landing` - Generic page
- `/tenant/wealden-joinery/landing?kw=Sash%20Windows` - Sash windows specific
- `/tenant/wealden-joinery/landing?kw=Front%20Doors` - Front doors specific

## 🎨 Customization Points

### Colors
Currently uses:
- Primary CTA: `bg-green-600 hover:bg-green-700`
- Header: `bg-white`
- Hero gradient: `from-gray-900 via-gray-800 to-gray-900`

Change in `client.tsx` by searching for these Tailwind classes.

### Content Defaults
If tenant doesn't have content, defaults to:
- Headline: "Beautifully Crafted Timber Windows & Doors in [Location]"
- Guarantees: Standard 5-point list
- Urgency: "Book a survey in January and save 10%"
- Lead magnet: "10 Questions to Ask Before Choosing Windows"

Update defaults in `page.tsx` lines 94-125.

### Trust Badges
Currently shows 4 badges in trust strip:
1. FENSA Approved
2. PAS 24 Certified
3. 50 Year Guarantee (text)
4. Accoya Wood

Add/remove in `client.tsx` around line 180-190.

## 📱 Mobile Behavior

### Sticky Elements
- **Header**: Always visible at top
- **Mobile Dock**: Shows at bottom on mobile only (< 768px)
- **WhatsApp Button**: Floating at bottom-right (if configured)

### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🔍 SEO Features

### Automatically Generated
- Page title with keyword + location
- Meta description with USPs
- Open Graph tags (Facebook, LinkedIn)
- Twitter Card tags
- Schema.org LocalBusiness JSON-LD
- Schema.org FAQPage JSON-LD
- Schema.org AggregateRating JSON-LD

### Validate
- Google Rich Results Test: https://search.google.com/test/rich-results
- Facebook Debugger: https://developers.facebook.com/tools/debug/
- Twitter Card Validator: https://cards-dev.twitter.com/validator

## 📈 Analytics Events

### Tracked Events
| Event | Trigger | Purpose |
|-------|---------|---------|
| `select_content` | CTA button click | Track which CTAs work |
| `click_contact_phone` | Phone link click | Track call intent |
| `generate_lead` | Form submit | Track conversions |
| `view_item_list` | Exit intent modal | Track exit intent views |
| `click_whatsapp` | WhatsApp button | Track WhatsApp usage |

### Custom Parameters
All events include:
- `tenant_slug`: Which tenant's page
- `location`: For phone clicks (header, hero, mobile_sticky)
- `method`: For lead generation (quote_form, exit_intent_download)

## 🛠️ Debugging

### Check Server-Side Rendering
```bash
curl https://your-domain.com/tenant/wealden-joinery/landing | grep "Wealden"
```
Should return HTML with tenant name.

### Check Metadata
View page source and look for:
```html
<title>Expert Sash Windows in Tonbridge | Wealden Joinery</title>
<meta name="description" content="...">
<script type="application/ld+json">{"@context":"https://schema.org"...</script>
```

### Test Form Submission
1. Open browser dev tools → Network tab
2. Fill out form and submit
3. Check network request
4. Verify analytics event fires

### Check Exit Intent
1. Move mouse to top of browser window
2. Exit browser window area
3. Modal should appear

## ⚡ Performance Tips

### Image Optimization
- Use WebP format
- Max width: 1920px
- Compress before upload
- Use Next.js `<Image>` component (already implemented)

### LCP Target: < 1s
- Hero image should be < 200KB
- Use `priority` prop on hero image (already implemented)
- Ensure good server response time

### CLS Target: < 0.1
- Reserve space for images (already implemented with aspect ratios)
- Avoid layout shifts on load

## 🐛 Common Issues

### Images Not Loading
- Check image URLs are absolute
- Verify images exist in DB
- Check browser console for CORS errors

### Form Not Submitting
- Check browser console for errors
- Verify all required fields filled
- Test with network tab open

### Exit Intent Not Working
- Only triggers once per session
- Must move mouse to very top of window
- Check browser console for errors

### Accordion Not Opening
- Verify @radix-ui/react-accordion installed
- Check for TypeScript errors
- Test in incognito mode

## 📞 Support Contacts

- **Technical Issues**: Check browser console first
- **Analytics**: Verify GA4/Pixel IDs configured
- **SEO**: Use Google Search Console to check indexing
- **Forms**: Test with real email address

## 🎯 Conversion Rate Benchmarks

Target benchmarks for landing pages:
- **Bounce Rate**: < 60%
- **Time on Page**: > 2 minutes
- **Form Conversion**: 3-10%
- **Phone Call Rate**: 1-5%

Monitor in Google Analytics under:
- Behavior → Landing Pages
- Conversions → Goals

## 🔄 Updating Content

### Via Database
Update `LandingTenant` records:
```sql
UPDATE "LandingTenant" 
SET content = jsonb_set(
  content, 
  '{headline}', 
  '"New Headline Here"'
)
WHERE slug = 'wealden-joinery';
```

### Via WYSIWYG Editor
Use the tenant admin interface:
1. Log in to dashboard
2. Navigate to Landing Page Editor
3. Click "Edit Content"
4. Make changes
5. Click "Publish"

## 📁 File Structure
```
web/src/app/tenant/[slug]/landing/
├── page.tsx          # Server component (SEO, data fetching)
├── client.tsx        # Client component (interactivity)
└── page.module.css   # Old CSS (can be deleted)

web/src/components/ui/
└── accordion.tsx     # Accordion component

web/public/
├── trust-fensa.png   # FENSA badge (ADD THIS)
├── trust-pas24.png   # PAS 24 badge (ADD THIS)
└── trust-accoya.png  # Accoya badge (ADD THIS)
```

## 🚢 Deployment

Changes auto-deploy to Render when pushed to GitHub.

Check deployment status:
```bash
# View recent deployments
curl https://api.render.com/v1/services/{service-id}/deploys
```

Or check Render dashboard: https://dashboard.render.com/

## ✅ Pre-Launch Validation

Run through this checklist:

- [ ] Trust badge images uploaded
- [ ] GA4 tracking code added
- [ ] Meta Pixel added (if using Facebook Ads)
- [ ] Form submission connected to API
- [ ] Test form submission end-to-end
- [ ] Test phone links on mobile
- [ ] Test on Chrome, Safari, Firefox
- [ ] Run Lighthouse audit (target: 90+ performance score)
- [ ] Validate Schema.org markup
- [ ] Test with real tenant data
- [ ] Check mobile sticky dock works
- [ ] Verify exit intent triggers
- [ ] Test WhatsApp button (if applicable)
- [ ] Check all images load
- [ ] Verify service areas display correctly

## 📖 Related Documentation

- Full transformation details: `LANDING_PAGE_TRANSFORMATION.md`
- Email ingest system: `DB_LANDING_SYSTEM_SUMMARY.md`
- Multi-tenant architecture: `MULTI_TENANT_LANDING_SUMMARY.md`
- WYSIWYG editor: `WYSIWYG_EDITOR_PLAN.md`
