# Quote Builder Tabbed Interface - Implementation Plan

## Overview
Refactor the quote builder from a single long page to a tabbed interface with 6 distinct tabs, making the workflow clearer and more intuitive.

## Current Issues
1. ❌ Parsed lines section only works for supplier quotes (should be universal)
2. ❌ Questions mapped per-line (should be global/multi-line mapping)
3. ❌ No visibility of images tagged to lines
4. ❌ Can't easily add delivery lines or adjust markup globally
5. ❌ "Render proposal" button buried at bottom
6. ❌ Everything on one confusing long scrolling page

## Proposed Tab Structure

### Tab 1: **Details** 📋
**Purpose:** Client information and project requirements

**Content:**
- Lead details (name, email, phone, address, job number)
- Questionnaire answers (full form, editable)
- Client-uploaded files (specs, drawings, photos)
- Lead notes and history
- **Action:** Update questionnaire answers inline

**Components:**
- `<LeadDetailsCard>` - existing
- `<QuestionnaireForm>` - existing, make editable
- File list with thumbnails

---

### Tab 2: **Supplier Quote** 📤
**Purpose:** Import pricing from supplier PDFs

**Content:**
- Upload supplier PDF button
- List of uploaded supplier files
- Parse status for each file
- Raw parse results (collapsible)
- Warnings/errors from parsing

**Actions:**
- Upload new supplier PDF
- Re-parse existing file
- View raw parse output
- Delete supplier file

**Components:**
- `<SupplierFilesCard>` - existing
- Upload button
- Parse status indicators

---

### Tab 3: **Joinerysoft Quote** 🏗️
**Purpose:** Import from Joinerysoft system

**Content:**
- Joinerysoft connection status
- Import from Joinerysoft button
- List of imported Joinerysoft quotes
- Sync status

**Actions:**
- Connect to Joinerysoft
- Import quote
- Sync updates

**Status:** Coming soon (placeholder for now)

---

### Tab 4: **ML Estimate** 🤖
**Purpose:** AI-generated estimate from questionnaire

**Content:**
- "Generate ML Estimate" button
- Estimated total with confidence score
- ML-generated line items preview
- Pricing breakdown
- Model version and latency info

**Actions:**
- Generate estimate from questionnaire
- View detailed breakdown
- Use estimate as starting point for quote lines

**Components:**
- ML estimate card with confidence indicator
- Pricing breakdown dialog
- "Use these lines" button to populate Quote Lines tab

---

### Tab 5: **Quote Lines** ✏️ **[MOST IMPORTANT]**
**Purpose:** Universal line editor for ALL sources

**Key Features:**
- ✅ Shows lines from ANY source (supplier/joinerysoft/ML/manual)
- ✅ Each line displays thumbnail image if available
- ✅ Edit quantities, descriptions, unit prices
- ✅ Add custom lines (e.g., delivery, survey fee)
- ✅ Adjust markup % globally or per-line
- ✅ Real-time total calculation
- ✅ **NO per-line question mapping** (questions are project-level, not line-level)
- ✅ Visual image tags (joinery product images from supplier quotes)

**Actions:**
- Add new line
- Delete line
- Adjust quantity
- Change unit price
- Set global markup %
- Add delivery charge
- Recalculate totals
- View/download as CSV

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ [Image] │ Description          │ Qty │ Cost │ Markup │ Total│
├─────────────────────────────────────────────────────────────┤
│  [🖼️]   │ BRIO bifold door    │  1  │ 4321 │  20%   │ 5185│
│  [🖼️]   │ Delivery London     │  1  │  990 │  10%   │ 1089│
│  [ + ]  │ [Add custom line...] │     │      │        │     │
├─────────────────────────────────────────────────────────────┤
│                            Subtotal: £6,274  VAT: £1,255    │
│                                      Total: £7,529          │
└─────────────────────────────────────────────────────────────┘
```

**Components:**
- Enhanced `<ParsedLinesTable>` with:
  - Image column (thumbnail if imageFileId exists)
  - Inline editing
  - Add line button
  - Global markup controls
  - Real-time totals

**API Endpoints Needed:**
- `POST /quotes/:id/lines` - Add custom line
- `DELETE /quotes/:id/lines/:lineId` - Delete line
- `PATCH /quotes/:id/lines/:lineId` - Update line
- `POST /quotes/:id/lines/recalculate` - Recalculate with new markup

---

### Tab 6: **Preview** 👁️
**Purpose:** Render and review final proposal

**Content:**
- Render proposal button (prominent)
- PDF preview iframe
- Download PDF button
- Send to client button
- Proposal status (draft/sent/accepted)

**Actions:**
- Render proposal PDF
- Preview in browser
- Download PDF
- Send via email
- Mark as sent

**Components:**
- Render button with loading state
- PDF preview (`<iframe>` or `<embed>`)
- Action buttons

---

## Implementation Steps

### Phase 1: Tabs Infrastructure ✅
1. Install/verify shadcn Tabs component
2. Add `activeTab` state to page
3. Create TabsList with 6 tabs
4. Add icons to each tab
5. Wrap existing content in TabsContent components

### Phase 2: Reorganize Existing Content
6. Move Details content to Tab 1
7. Move Supplier upload/parse to Tab 2
8. Move ML estimate UI to Tab 4
9. Move render proposal to Tab 6
10. Create placeholder for Tab 3 (Joinerysoft)

### Phase 3: Universal Quote Lines Tab ⭐
11. Create enhanced line table component
12. Add image column with thumbnail display
13. Fetch signed URLs for imageFileId
14. Add "Add Line" functionality
15. Add inline editing for qty/price
16. Add global markup controls
17. Add real-time total calculation
18. Remove per-line question mapping UI

### Phase 4: Image Display
19. Update line fetching to include imageFileId
20. Generate signed URLs for images
21. Display thumbnails in table
22. Add lightbox/zoom on click
23. Handle missing images gracefully

### Phase 5: Line Management
24. Add custom line endpoint
25. Delete line functionality
26. Bulk operations (delete multiple)
27. Reorder lines (drag & drop)
28. Duplicate line feature

### Phase 6: Markup & Pricing
29. Global markup % control
30. Per-line markup override
31. Delivery line special handling
32. VAT calculation
33. Real-time total updates

### Phase 7: Preview & Render
34. Move render button to Preview tab
35. Add PDF preview iframe
36. Implement download/send actions
37. Add proposal status tracking

---

## Key Technical Changes

### Remove Question Mapping Per Line
**Current:** Each line has a `questionKey` in meta, mapped in UI
**New:** Questions are project-level only (Details tab), not line-level

**Changes needed:**
- Remove mapping UI from ParsedLinesTable
- Remove `MAP TO QUESTION` column
- Remove `saveQuoteMappings` calls
- Keep questions in Details tab only

### Universal Line Source
**Current:** Lines come from supplier parsing only
**New:** Lines can come from:
- Supplier PDF parsing
- Joinerysoft import
- ML estimate generation
- Manual entry

**Schema:** Already supports this - `meta.source` can indicate origin

### Image Display
**Current:** Images extracted but not displayed
**New:** Show thumbnail in line table

**Implementation:**
```typescript
// In line table, add image column:
{lines.map(line => {
  const imageFileId = line.meta?.imageFileId;
  const imageUrl = imageFileId ? imageUrlMap[imageFileId] : null;
  
  return (
    <tr key={line.id}>
      <td>
        {imageUrl ? (
          <img src={imageUrl} className="w-12 h-12 object-cover rounded" />
        ) : (
          <div className="w-12 h-12 bg-gray-100 rounded" />
        )}
      </td>
      <td>{line.description}</td>
      ...
    </tr>
  );
})}
```

---

## File Changes Required

### `/web/src/app/quotes/[id]/page.tsx`
- Add Tabs import
- Add activeTab state
- Wrap content in TabsList and TabsContent
- Reorganize existing sections into tabs
- Remove question mapping UI
- Add image display logic

### `/web/src/components/quotes/ParsedLinesTable.tsx`
- Remove MAP TO QUESTION column
- Add IMAGE column
- Add inline editing for qty/price
- Add "Add Line" row
- Add global markup controls
- Add real-time totals
- Remove mapping-related props

### `/web/src/components/quotes/UniversalQuoteLinesEditor.tsx` (NEW)
- Comprehensive line editor
- Image thumbnails
- Add/edit/delete lines
- Markup controls
- Total calculation

### `/api/src/routes/quotes.ts`
- Add `POST /quotes/:id/lines` - Create custom line
- Add `DELETE /quotes/:id/lines/:lineId` - Delete line
- Ensure `PATCH /quotes/:id/lines/:lineId` works for all fields

---

## Benefits

✅ **Clearer workflow** - Each step has its own space
✅ **Universal line editor** - All lines in one place regardless of source
✅ **Visual feedback** - Images show what products actually look like
✅ **Flexible pricing** - Easy to adjust markup and add custom lines
✅ **Better UX** - No more endless scrolling
✅ **Logical progression** - Details → Import → Edit → Preview
✅ **Scalable** - Easy to add new sources (Joinerysoft, manual, etc.)

---

## Next Steps

1. **Review this plan** - Confirm tab structure and approach
2. **Start implementation** - Begin with Phase 1 (Tabs infrastructure)
3. **Iterative development** - Build and test each tab
4. **Focus on Tab 5** - Universal Quote Lines is the most critical

Would you like me to start implementing this plan step by step?
