# Wealden Joinery Image Upload System - Smoke Test Checklist

## Test Image Recommendations

Upload these test images to verify compression:
- **Small image** (< 500KB): Should upload quickly, minimal/no compression
- **Medium image** (1-3MB): Should compress to < 1MB
- **Large image** (5-10MB): Should compress significantly to < 1MB

## Page-by-Page Smoke Tests

### ✅ Home Page (`/wealden-joinery`)

**Image Slots to Test:**
1. Hero image (portrait, xl) - `home-hero`
2. Product cards (3x, portrait, lg) - `home-product-0/1/2`
3. Lifestyle image (wide, xl) - `home-lifestyle`
4. Case study cards (3x, landscape) - `home-case-study-0/1/2`

**Test Steps:**
- [ ] Navigate around the page - all areas clickable except upload buttons
- [ ] Click "Upload" button on hero image - file picker opens, NO navigation
- [ ] Upload 5MB image - shows "Optimizing..." then "Optimized ✓"
- [ ] Verify compressed size < 1MB in console logs
- [ ] Image preview updates immediately with good quality
- [ ] Click product card title - navigates to product page
- [ ] Click "Upload" on product card image - file picker opens, NO navigation
- [ ] Repeat for all 7 image slots
- [ ] Refresh page - uploaded images persist via localStorage
- [ ] Upload invalid file type (.pdf) - shows error message

---

### ✅ Windows Page (`/wealden-joinery/windows`)

**Image Slots to Test:**
1. Hero image (portrait, xl) - `windows-hero`
2. Heritage windows (2x, portrait, lg) - `windows-heritage-0/1`
3. Contemporary windows (2x, portrait, lg) - `windows-contemporary-0/1`
4. Detail images (3x, square, md) - `windows-detail-0/1/2`
5. Context image (wide, xl) - `windows-context`

**Test Steps:**
- [ ] Upload to hero image - NO navigation interference
- [ ] Test heritage window images - upload works independently
- [ ] Test contemporary window images - upload works independently  
- [ ] Upload to detail images - all 3 work correctly
- [ ] Upload large image (8MB) to context image - compresses to < 1MB
- [ ] Verify compression quality remains high
- [ ] Click CTA buttons - navigate correctly
- [ ] All 9 image slots work without navigation conflicts

---

### ✅ Doors Page (`/wealden-joinery/doors`)

**Image Slots to Test:**
1. Hero image - `doors-hero`
2. Door type cards (3x) - `doors-type-0/1/2`
3. Gallery images (6x) - `doors-gallery-0` through `5`
4. Features image - `doors-features`
5. Lifestyle image - `doors-lifestyle`

**Test Steps:**
- [ ] Hero upload works correctly
- [ ] Each door type card uploads independently
- [ ] Gallery grid - all 6 slots upload without navigation
- [ ] Features and lifestyle images work
- [ ] Total 13 image slots all functional
- [ ] Compression works on larger images
- [ ] No navigation conflicts anywhere

---

### ✅ Alu-Clad Page (`/wealden-joinery/alu-clad`)

**Image Slots to Test:**
1. Hero image - `alu-clad-hero`
2. Benefits images (2x) - `alu-clad-benefit-0/1`
3. Gallery images (3x) - `alu-clad-gallery-0/1/2`

**Test Steps:**
- [ ] All 6 image slots upload correctly
- [ ] No navigation interference
- [ ] Compression works
- [ ] Images persist on refresh

---

### ✅ Projects Page (`/wealden-joinery/projects`)

**Image Slots to Test:**
1. Project cards (5x, landscape, lg) - `projects-card-0` through `4`
2. Gallery images (9x) - `projects-gallery-0` through `8`

**Test Steps:**
- [ ] Filter projects - cards display correctly
- [ ] Upload to project card images - NO navigation
- [ ] Gallery section - all 9 uploads work independently
- [ ] Each project card text/link navigates correctly
- [ ] Upload buttons never trigger navigation
- [ ] Total 14 image slots all functional

---

### ✅ Choices Page (`/wealden-joinery/choices`)

**Image Slots to Test:**
1. Hero image - `choices-hero`
2. Color category images (5x) - `choices-colour-0` through `4`
3. Lifestyle image - `choices-lifestyle`
4. Glazing option images (4x) - `choices-glazing-0` through `3`
5. Glazing detail images (4x) - `choices-glazing-detail-0` through `3`
6. Hardware images (2x) - `choices-hardware-handles/hinges`
7. Handle and hinge detail images (2x) - `choices-handle-closeup`, `choices-hinge-lock`
8. Ironmongery samples (3x) - `choices-ironmongery-0/1/2`
9. Bar diagrams (multiple) - `choices-bar-0` through `N`

**Test Steps:**
- [ ] Sticky nav scrolls correctly
- [ ] Section navigation works
- [ ] Hero and color category uploads work
- [ ] Glazing options - all uploads independent
- [ ] Hardware section uploads work
- [ ] Ironmongery finish samples upload correctly
- [ ] Bar diagram uploads all work
- [ ] Compression handles detailed technical diagrams well
- [ ] ~25+ image slots all functional

---

### ✅ Showrooms Page (`/wealden-joinery/showrooms`)

**Image Slots to Test:**
1. Hero image - `showrooms-hero`
2. Showroom cards (5x) - `showrooms-crowborough/london/tunbridge-wells/brighton/sevenoaks`
3. Manufacturing image - `showrooms-manufacturing`

**Test Steps:**
- [ ] Search and filter showrooms
- [ ] Hero upload works
- [ ] Each showroom card image uploads independently
- [ ] Showroom details expand/collapse correctly
- [ ] Map interactions work (if implemented)
- [ ] Manufacturing section image uploads
- [ ] Total 7 image slots functional

---

### ✅ About Page (`/wealden-joinery/about`)

**Image Slots to Test:**
1. Hero image - `about-hero`
2. Crowborough facility - `about-crowborough-facility`
3. Craft detail - `about-craft-detail`
4. Finished install - `about-finished-install`
5. Values image - `about-values`
6. Showroom interior - `about-showroom`
7. Accreditation logos (6x) - `about-accreditation-0` through `5`

**Test Steps:**
- [ ] Hero and story images upload correctly
- [ ] Timeline animation works (if implemented)
- [ ] Values section image uploads
- [ ] Showroom network links work
- [ ] Accreditation logos - all 6 upload independently
- [ ] Total 12 image slots functional

---

### ✅ Contact Page (`/wealden-joinery/contact`)

**Image Slots to Test:**
1. Hero image - `contact-hero`

**Test Steps:**
- [ ] Hero image uploads correctly
- [ ] Contact form works independently
- [ ] Customer photo uploads (separate system) work
- [ ] Form submission works
- [ ] Map displays correctly
- [ ] Email/phone links work

---

## Cross-Page Tests

### Navigation Integrity
- [ ] Click every navigation link - all pages load correctly
- [ ] Breadcrumbs work (if implemented)
- [ ] Back button works correctly
- [ ] Deep links work

### Upload System Integrity
- [ ] Upload same image to different slots - each independent
- [ ] Replace image - shows "Replace" button, file picker opens
- [ ] Clear localStorage - images reset correctly
- [ ] Upload very small image (< 100KB) - no compression needed
- [ ] Upload edge case (2400×1600px, 1.1MB) - compresses slightly

### Compression Quality Tests
- [ ] Portrait photo (person) - faces remain clear
- [ ] Landscape photo (building) - details preserved
- [ ] Architectural detail (joinery) - edges remain sharp
- [ ] Color accuracy - finishes/swatches look correct
- [ ] No visible artifacts or pixelation
- [ ] Console logs show compression ratios

### Performance
- [ ] Page loads quickly (< 3s)
- [ ] Images load/render smoothly
- [ ] No layout shift during upload
- [ ] Compression completes in < 2s for 5MB image
- [ ] localStorage under quota (check browser devtools)

### Error Handling
- [ ] Upload .txt file - shows error
- [ ] Upload .pdf file - shows error
- [ ] Upload 50MB image - compression works or size warning
- [ ] Disconnect internet mid-upload - handles gracefully
- [ ] Full localStorage - shows helpful error

---

## Console Log Verification

Check browser console for:
```
[Image Optimizer] Original: 4032x3024 (3.2MB) → Target: 2400x1800
[Image Optimizer] Attempt 1: quality=0.86, size=892KB
[Image Optimizer] ✓ Optimized: 3276KB → 892KB (3.67x compression)
[ImageSlot home-hero] Optimized: 3276KB → 892KB
```

---

## Browser Compatibility

Test in:
- [ ] Chrome/Edge (latest)
- [ ] Safari (latest)
- [ ] Firefox (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

---

## Known Limitations

1. **localStorage limit**: ~5-10MB total across all slots (browser dependent)
2. **Image formats**: JPEG, PNG, WEBP, HEIC supported
3. **Max dimensions**: 2400px (hero), 1600px (cards), 800px (thumbnails)
4. **Compression**: May not reach < 1MB for very complex images
5. **Preview only**: Images stored in browser, not uploaded to server

---

## Quick Regression Test (5 minutes)

1. Go to home page
2. Upload 5MB photo to hero → verify < 1MB compressed
3. Click product card title → verify navigation works
4. Click Upload on product card → verify file picker, NO navigation
5. Go to projects page
6. Upload to project card → verify works
7. Go to choices page
8. Upload to multiple slots → all independent
9. Refresh browser → all images persist
10. Clear localStorage → all images reset

**If all pass: ✅ System working correctly**

---

## Issue Reporting Template

```
Page: [e.g., /wealden-joinery/windows]
Image Slot: [e.g., windows-hero]
Issue: [e.g., Upload button triggers navigation]
Steps to Reproduce:
1. 
2. 
3. 
Expected: [e.g., File picker opens]
Actual: [e.g., Page navigates to /contact]
Browser: [e.g., Chrome 120]
Console Errors: [paste any errors]
```
