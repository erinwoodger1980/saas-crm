# Questionnaire & Photo System Implementation Plan

## Executive Summary

This document outlines the complete implementation to:
1. **Fix supplier template saves** - Debug and verify PDF template persistence
2. **Expose material costs** - Make MaterialItem costs visible in UI/API
3. **Add photo upload system** - Questionnaire photos with ML pricing metadata
4. **Wire up UI components** - LeadModal, Settings, Public Questionnaire, Quote Builder

## Current State Analysis

### ✅ What EXISTS and WORKS

**Prisma Schema (api/prisma/schema.prisma)**:
- `QuestionnaireField` - Template field definitions with:
  - `isStandard` flag for ML training fields
  - `costingInputKey` for pricing engine mapping
  - `isHidden`, `isActive` flags
  - `sortOrder` for display ordering
- `QuestionnaireResponse` - Links to Quote
- `QuestionnaireAnswer` - Stores field values as JSON
- `ExamplePhoto` - Photo gallery with specs and pricing
- `ExamplePhotoFieldAnswer` - Tags photos with questionnaire answers
- `MaterialItem` - Has `cost` field (Decimal)

**API Routes**:
- `/questionnaire-fields` - CRUD for field templates (working)
- `/questionnaire-responses/quote/:quoteId` - GET/POST answers (working)
- `/pdf-templates` - POST/PATCH/DELETE with upsert logic (appears functional)

**Frontend**:
- `LeadModal.tsx` - Comprehensive lead management (4718 lines)
- `PdfTemplatesSection.tsx` - Read-only template viewer (working)
- `PdfTrainerClient.tsx` - Annotation tool with save (line 218-256)

### ❌ What's MISSING or BROKEN

**1. Photo Upload for Questionnaires**:
- No API route for uploading photos linked to questions
- No frontend component for photo upload in questionnaires
- No way to associate photos with specific line items
- No UI to view/manage photos in LeadModal or Quote Builder

**2. Material Cost Visibility**:
- MaterialItem.cost exists but not included in API select statements
- Not exposed in door pricing breakdown responses
- No UI to view/debug material costs
- Purchase order and shopping list queries may not include cost

**3. Supplier Template Saves**:
- User reports templates don't persist despite save appearing to work
- Need better error logging in save flow
- Need to verify database persistence after save
- Need UI feedback on actual persistence status

**4. Questionnaire UI Integration**:
- LeadModal doesn't show questionnaire answers
- No Settings UI to manage questionnaire fields
- Public questionnaire doesn't support photo uploads
- Quote Builder doesn't display questionnaire data

## Implementation Plan

### Phase 1: Material Cost Exposure (CRITICAL - Foundation)

**Files to update**:
1. `api/src/lib/door-pricing-engine.ts`
   - Update `PricedMaterialRequirement` interface to include `materialItem` object
   - Return full material details in `priceMaterialRequirementsForTenant()`
   
2. `api/src/routes/quote-pricing.ts`
   - Ensure material costs included in pricing responses
   - Add debug endpoint `GET /pricing/materials` to list all materials with costs

3. `web/src/components/MaterialCostDebugPanel.tsx` **(NEW)**
   - Display all MaterialItems for tenant with costs
   - Search/filter by code, category
   - Highlight missing costs (cost = 0)

**Acceptance Criteria**:
- [ ] Browser Network tab shows `cost` field in material responses
- [ ] Debug panel displays all materials with costs
- [ ] Door pricing breakdown includes material costs per line

### Phase 2: Photo Upload System

**API Changes**:

1. Create `api/src/routes/questionnaire-photos.ts` **(NEW)**:
```typescript
POST /questionnaire-photos
  - Upload photo (multipart/form-data)
  - Body: { quoteId, fieldId, lineItemId?, tags[], description, estimatedCost }
  - Returns: { id, url, thumbnailUrl }
  
GET /questionnaire-photos/quote/:quoteId
  - List all photos for quote
  - Filter by fieldId, lineItemId
  - Include field and line item details

PATCH /questionnaire-photos/:id
  - Update tags, description, estimatedCost
  
DELETE /questionnaire-photos/:id
  - Remove photo
```

2. Add Prisma model `QuestionnairePhoto`:
```prisma
model QuestionnairePhoto {
  id              String   @id @default(cuid())
  tenantId        String
  quoteId         String
  responseId      String?  // Link to QuestionnaireResponse
  fieldId         String   // Which question
  lineItemId      String?  // If per-line-item question
  
  imageUrl        String   // Full size
  thumbnailUrl    String?  // Optimized
  
  tags            String[] @default([])
  description     String?
  estimatedCost   Decimal? // For ML learning
  
  polishStatus    String   @default("pending") // pending, processing, complete, failed
  polishJobId     String?  // Track enhancement job
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  quote           Quote    @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  response        QuestionnaireResponse? @relation(fields: [responseId], references: [id])
  field           QuestionnaireField @relation(fields: [fieldId], references: [id])
  lineItem        QuoteLine? @relation(fields: [lineItemId], references: [id])
  
  @@index([tenantId, quoteId])
  @@index([fieldId])
  @@index([lineItemId])
}
```

**Frontend Components**:

3. `web/src/components/questionnaire/PhotoUploadInput.tsx` **(NEW)**:
   - Drag-and-drop file input
   - Image preview
   - Tag input
   - Cost estimate input (internal only)
   - Upload progress

4. `web/src/components/questionnaire/PhotoGallery.tsx` **(NEW)**:
   - Grid display of photos
   - Filter by question/line item
   - Click to view full size
   - Edit metadata (internal)
   - Delete option

### Phase 3: LeadModal Questionnaire Integration

**Update `web/src/app/leads/LeadModal.tsx`**:

Add new tab "Questionnaire" after "Details" tab:

```tsx
// Around line 1500 (after Details tab content)
{selectedTab === "questionnaire" && (
  <QuestionnaireTab
    quoteId={quoteId}
    tenantId={tenantId}
    readonly={false}
  />
)}
```

Create `web/src/components/leads/QuestionnaireTab.tsx` **(NEW)**:
```tsx
- Fetch QuestionnaireResponse for quote
- Display all answers grouped by:
  - Global/lead-level questions (top)
  - Per-line-item questions (grouped by line)
- Show associated photos with thumbnails
- Allow editing answers (if not readonly)
- Photo gallery with upload option
```

**Acceptance Criteria**:
- [ ] Lead Modal has "Questionnaire" tab
- [ ] Displays all answered questions
- [ ] Shows photos linked to questions
- [ ] Click photo opens full-size viewer
- [ ] Can edit answers and upload new photos

### Phase 4: Settings Questionnaire Configuration

**Update `web/src/app/settings/page.tsx`**:

Add new section "Questionnaire Fields" (tab or accordion):

```tsx
<QuestionnaireFieldsSection />
```

Create `web/src/components/settings/QuestionnaireFieldsSection.tsx` **(NEW)**:
```tsx
- List all QuestionnaireFields
- Table columns:
  - Key | Label | Type | Scope (Global/Per-Item) | Photos | ML | Active | Actions
- Create new field modal
- Edit field modal
- Toggle active/hidden
- Reorder (drag-drop or up/down buttons)
- Delete (soft by default)
```

**Acceptance Criteria**:
- [ ] Settings has visible Questionnaire Fields section
- [ ] Can view all fields with their properties
- [ ] Can create new custom fields
- [ ] Can edit field properties
- [ ] Can enable/disable fields
- [ ] Can reorder fields

### Phase 5: Public Questionnaire Photo Upload

**Update `web/src/app/[tenantSlug]/questionnaire/page.tsx`** (or similar):

For each field with `supportsPhotos` flag (add to schema if missing):

```tsx
{field.supportsPhotos && (
  <PhotoUploadInput
    fieldId={field.id}
    lineItemIndex={currentLineItemIndex}
    onUpload={(photo) => {
      setPhotos([...photos, photo]);
    }}
  />
)}
```

On form submit:
```tsx
// 1. Save questionnaire answers
await apiFetch(`/questionnaire-responses/quote/${quoteId}`, {
  method: 'POST',
  json: { answers, completed: true }
});

// 2. Upload all photos
for (const photo of photos) {
  const formData = new FormData();
  formData.append('file', photo.file);
  formData.append('quoteId', quoteId);
  formData.append('fieldId', photo.fieldId);
  if (photo.lineItemId) formData.append('lineItemId', photo.lineItemId);
  
  await apiFetch('/questionnaire-photos', {
    method: 'POST',
    body: formData
  });
}
```

**Acceptance Criteria**:
- [ ] Public questionnaire shows photo upload for relevant fields
- [ ] Can upload multiple photos
- [ ] Photos tagged with correct question and line item
- [ ] Photos visible in LeadModal after submission

### Phase 6: Quote Builder Integration

**Update quote builder component** (find existing quote builder):

For each line item, show:
```tsx
<div className="line-item-questionnaire-data">
  <h4>Specifications</h4>
  {lineItem.questionnaireAnswers.map(answer => (
    <div key={answer.fieldId}>
      <strong>{answer.field.label}:</strong> {answer.value}
    </div>
  ))}
  
  <h4>Photos</h4>
  <PhotoGallery
    photos={lineItem.photos}
    onUpdateCost={(photoId, cost) => {
      // Update photo estimated cost for ML
      await apiFetch(`/questionnaire-photos/${photoId}`, {
        method: 'PATCH',
        json: { estimatedCost: cost }
      });
    }}
  />
</div>
```

Add pricing metadata section:
```tsx
<div className="ml-pricing-metadata">
  <Label>ML Cost Estimate</Label>
  <p>Based on {lineItem.photos.length} photos and specifications</p>
  <Input
    type="number"
    value={lineItem.mlEstimatedCost}
    onChange={(e) => updateLineItemMlCost(lineItem.id, e.target.value)}
  />
</div>
```

**Acceptance Criteria**:
- [ ] Quote builder shows questionnaire answers per line
- [ ] Displays photos for each line item
- [ ] Can edit photo cost estimates
- [ ] ML metadata visible and editable

### Phase 7: Fix Supplier Template Saves

**Debug Steps**:

1. Add comprehensive logging to `api/src/routes/pdf-templates.ts`:
```typescript
// After line 236 (successful create)
console.log("[POST /pdf-templates] Template created successfully:", {
  id: template.id,
  name: template.name,
  supplierProfileId: template.supplierProfileId,
  annotationCount: template.annotations?.length
});

// Verify it's actually in database
const verify = await prisma.pdfLayoutTemplate.findUnique({
  where: { id: template.id }
});
console.log("[POST /pdf-templates] Database verification:", {
  found: !!verify,
  id: verify?.id
});
```

2. Update `web/src/app/pdf-trainer/PdfTrainerClient.tsx`:
```typescript
// After line 239 (successful save)
const result = await apiFetch('/pdf-templates', {
  method: 'POST',
  json: {
    name: templateName,
    description: `Annotated template for ${profileName}`,
    supplierProfileId: supplierProfile,
    pageCount: totalPages,
    annotations,
  },
});

console.log('[PdfTrainer] Save result:', result);

// Verify template exists
const verify = await apiFetch(`/pdf-templates/${result.item.id}`);
console.log('[PdfTrainer] Verification fetch:', verify);

toast({
  title: 'Template saved',
  description: `Saved ${annotations.length} annotations. ID: ${result.item.id}`,
});
```

3. Add database query debug endpoint:
```typescript
// api/src/routes/pdf-templates.ts
router.get("/debug/:supplierProfileId", async (req, res) => {
  const { supplierProfileId } = req.params;
  const template = await prisma.pdfLayoutTemplate.findUnique({
    where: { supplierProfileId },
    include: { annotations: true }
  });
  res.json({ found: !!template, template });
});
```

**Test Script**:
1. Open PDF Trainer
2. Upload supplier PDF
3. Create 3+ annotations
4. Click Save
5. Check browser console for save result and verification
6. Check server logs for database verification
7. Refresh Settings > PDF Templates page
8. Verify template appears in list
9. Click View to see annotations
10. Hit GET `/pdf-templates/debug/:supplierProfileId` in browser
11. Confirm template exists in database

**Acceptance Criteria**:
- [ ] Save completes without errors
- [ ] Console shows verification fetch succeeds
- [ ] Server logs confirm database persistence
- [ ] Template appears in Settings list immediately
- [ ] Debug endpoint returns template with annotations
- [ ] Template survives server restart

## File Change Summary

### New Files Created:
1. `api/prisma/migrations/XXXXXX_add_questionnaire_photos/migration.sql`
2. `api/src/routes/questionnaire-photos.ts`
3. `web/src/components/MaterialCostDebugPanel.tsx`
4. `web/src/components/questionnaire/PhotoUploadInput.tsx`
5. `web/src/components/questionnaire/PhotoGallery.tsx`
6. `web/src/components/leads/QuestionnaireTab.tsx`
7. `web/src/components/settings/QuestionnaireFieldsSection.tsx`

### Files Modified:
1. `api/prisma/schema.prisma` - Add QuestionnairePhoto model
2. `api/src/server.ts` - Register questionnaire-photos route
3. `api/src/lib/door-pricing-engine.ts` - Include cost in responses
4. `api/src/routes/quote-pricing.ts` - Expose material costs
5. `api/src/routes/pdf-templates.ts` - Add debug logging
6. `web/src/app/leads/LeadModal.tsx` - Add Questionnaire tab
7. `web/src/app/settings/page.tsx` - Add QuestionnaireFieldsSection
8. `web/src/app/[tenantSlug]/questionnaire/page.tsx` - Add photo upload
9. Quote builder component - Add questionnaire data display
10. `web/src/app/pdf-trainer/PdfTrainerClient.tsx` - Add verification logging

## Manual Test Script

### 1. Material Cost Visibility Test
```
1. Open Settings > Material Cost Debug (new section)
2. Verify all MaterialItems displayed with costs
3. Open browser DevTools > Network tab
4. Create/edit a quote with door pricing
5. Inspect pricing API response
6. Verify "cost" field present for each material
7. Check Quote Builder shows material costs
```

### 2. Supplier Template Save Test
```
1. Open PDF Trainer at /pdf-trainer
2. Upload a supplier PDF (any multi-page PDF)
3. Select a supplier profile
4. Draw 3 annotation boxes (description, qty, price)
5. Click "Save Template"
6. Open DevTools Console
7. Verify "Template saved" toast appears
8. Check console logs show save result with ID
9. Navigate to Settings > PDF Templates
10. Verify new template appears in list
11. Click "View" icon
12. Verify annotations displayed
13. Restart API server
14. Refresh Settings > PDF Templates
15. Verify template still exists
```

### 3. Photo Upload Test
```
1. Open public questionnaire (tenant-specific URL)
2. Fill in contact details (global questions)
3. Add a line item (e.g., door)
4. For dimension field, see photo upload option
5. Upload a photo of existing door
6. Add tags: "oak", "internal", "glazed"
7. Submit questionnaire
8. Open internal app > Leads
9. Find the new lead
10. Click to open LeadModal
11. Click "Questionnaire" tab
12. Verify answers displayed
13. Verify photo thumbnail visible
14. Click photo to view full size
15. Verify tags displayed
```

### 4. Questionnaire Configuration Test
```
1. Open Settings > Questionnaire Fields
2. Verify list of standard fields displayed
3. Verify each shows: Type, Scope, Active status
4. Click "Create Field"
5. Enter: key="custom_finish", label="Finish Type"
6. Set type=SELECT, options=["Painted","Stained","Clear"]
7. Set scope="Per Line Item"
8. Enable "Supports Photos"
9. Save
10. Verify new field appears in list
11. Open public questionnaire
12. Verify new field appears in line item section
13. Verify photo upload appears for that field
```

### 5. Quote Builder Integration Test
```
1. Create a quote with questionnaire data
2. Open Quote Builder
3. Select a line item
4. Verify "Specifications" section shows answers
5. Verify "Photos" section shows thumbnails
6. Click photo - opens full size
7. Edit photo "Estimated Cost" field
8. Save
9. Verify cost saved (refresh and check)
10. Verify cost used in ML price suggestions
```

## Acceptance Checklist

### Material Costs
- [ ] Cost field visible in all MaterialItem API responses
- [ ] Debug panel shows all materials with costs
- [ ] Door pricing breakdown includes cost per material
- [ ] Shopping list shows material costs
- [ ] Purchase orders include unit costs

### Photo System
- [ ] Can upload photos in public questionnaire
- [ ] Photos tagged with question and line item
- [ ] Photos visible in LeadModal Questionnaire tab
- [ ] Photos visible in Quote Builder
- [ ] Can edit photo metadata (tags, cost)
- [ ] Can delete photos
- [ ] Full-size viewer works
- [ ] Thumbnails generated

### Questionnaire UI
- [ ] LeadModal has Questionnaire tab
- [ ] Shows global questions at top
- [ ] Shows per-line questions grouped by item
- [ ] Settings has Questionnaire Fields section
- [ ] Can create/edit/delete fields
- [ ] Can reorder fields
- [ ] Public questionnaire renders all fields
- [ ] Field types work correctly (text, select, number, etc.)

### Supplier Templates
- [ ] Save completes without errors
- [ ] Template persists to database
- [ ] Template visible in Settings list
- [ ] Template survives server restart
- [ ] Annotations preserved correctly
- [ ] Can view template details
- [ ] Can delete templates

### Quote Builder
- [ ] Displays questionnaire answers per line
- [ ] Shows associated photos
- [ ] Can edit photo cost estimates
- [ ] ML metadata visible

## Next Steps After Implementation

1. **Photo Polishing Pipeline**
   - Integrate with image enhancement API (e.g., Remove.bg, Cloudinary)
   - Queue background jobs for polishing
   - Update polishStatus as jobs complete

2. **ML Training Integration**
   - Export questionnaire answers + photos + costs to ML training data
   - Build feature vectors from photo tags and specifications
   - Train model to predict costs from questionnaire data

3. **Advanced Photo Features**
   - Bulk upload
   - Drag-and-drop reordering
   - Photo comparison (side-by-side)
   - Auto-tagging with vision AI
   - Duplicate detection

4. **Questionnaire Enhancements**
   - Conditional fields (show field X if answer Y)
   - Field dependencies (disable if...)
   - Custom validation rules
   - Multi-page questionnaires
   - Save draft / resume later

## Known Limitations

1. **Photo Polishing**: Currently stubbed - requires external API integration
2. **ML Cost Prediction**: Manual estimates only - ML model training separate phase
3. **Photo Storage**: Uses default upload path - may need CDN for production
4. **File Size**: No client-side compression - may timeout on large uploads
5. **Concurrent Edits**: No websocket sync - last write wins

## Troubleshooting

### "Template not found after save"
- Check server logs for database errors
- Verify Prisma schema has all columns
- Run `npx prisma migrate deploy`
- Check `supplierProfileId` uniqueness

### "Photos not uploading"
- Check file size limits (default 10MB)
- Verify multer middleware configured
- Check upload directory permissions
- Inspect Network tab for error responses

### "Material costs showing 0"
- Run seed script: `npm run seed:materials`
- Check MaterialItem table has data
- Verify tenantId matches
- Check isActive flag is true

### "Questionnaire not showing"
- Verify QuestionnaireResponse exists for quote
- Check fieldId references are valid
- Ensure isActive and !isHidden on fields
- Check sortOrder for ordering issues

