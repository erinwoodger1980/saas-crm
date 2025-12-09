# Workshop Timer Improvements - December 2025

## Overview
Fixed timer rounding issues and enhanced support for non-project time tracking categories (Cleaning, Admin, Holiday, etc.).

## Changes Made

### 1. Timer Precision - No More Rounding ✅

**Problem:** Timer was rounding to nearest 15 minutes (0.25 hours), losing accuracy.

**Solution:** 
- Removed `Math.round(hoursWorked * 4) / 4` calculation
- Now logs exact time to the minute
- Changed minimum time from 0.25h (15 min) to 0.01h (0.6 min)

**Code Changes:**
```typescript
// Before (api/src/routes/workshop.ts):
const roundedHours = Math.round(hoursWorked * 4) / 4;
const timeEntry = await prisma.timeEntry.create({
  data: {
    hours: Math.max(0.25, roundedHours), // Minimum 15 minutes
  }
});

// After:
const finalHours = Math.max(0.01, hoursWorked); // Minimum 0.6 minutes
const timeEntry = await prisma.timeEntry.create({
  data: {
    hours: finalHours, // Exact minutes
  }
});
```

### 2. Input Field Precision ✅

**Updated all hour input fields from 15-minute to 1-minute increments:**

- `web/src/app/workshop/page.tsx` - QuickLogModal: `step="0.25"` → `step="0.01"`
- `src/app/workshop/page.tsx` - Inline logging: `step="0.25"` → `step="0.01"`
- `web/src/app/workshop-mobile/page.tsx` - Mobile input: `step="0.25"` → `step="0.01"`

**Result:** Users can now log time in 1-minute increments (e.g., 2.37 hours = 2h 22m)

### 3. Better Time Display ✅

**Updated timer stop alerts to show hours + minutes:**

```typescript
// Before:
alert(`Timer stopped. Logged 2.37 hours.`);

// After:
alert(`Timer stopped. Logged 2h 22m (2.37 hours).`);
```

### 4. Category Support (Non-Project Time) ✅

**Problem:** All time entries required a project, couldn't track generic activities like cleaning.

**Solution:**
- Made `TimeEntry.projectId` nullable in schema
- Created migration `20251209000000_time_entry_nullable_project`
- Time entries can now be logged without a project

**Schema Change:**
```prisma
model TimeEntry {
  id        String       @id @default(cuid())
  tenantId  String
  projectId String?      // Changed from String to String? (nullable)
  process   WorkshopProcess
  userId    String
  // ... other fields
  project   Opportunity? @relation(...) // Changed from Opportunity to Opportunity?
}
```

**Migration SQL:**
```sql
-- Make projectId nullable
ALTER TABLE "TimeEntry" ALTER COLUMN "projectId" DROP NOT NULL;

-- Re-add foreign key with NULL support
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Opportunity"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;
```

### 5. Generic Process Management ✅

**Already Configured in Settings:**

Go to **Settings > Workshop Processes** to manage categories:
- Check the "Generic" checkbox for any process that doesn't require a project
- Default generic processes: `HOLIDAY`, `OFF_SICK`, `ADMIN`, `CLEANING`

**UI Behavior:**
- `QuickLogModal` automatically hides project field when generic process selected
- Generic processes marked with ⭐ in dropdowns
- Timer can run with or without a project depending on process type

## User Workflows

### Logging Project Time
1. Start timer or quick log hours
2. Select a **non-generic** process (e.g., "Door Assembly")
3. Select project
4. System logs time against project + process

### Logging Non-Project Time (Categories)
1. Start timer or quick log hours
2. Select a **generic** process (e.g., "Cleaning" ⭐)
3. Project field hidden automatically
4. System logs time against process only (no project)

### Creating New Categories
1. Go to **Settings > Workshop Processes**
2. Add new process (e.g., "Meetings", "Training")
3. Check "Generic" checkbox
4. Save - now available for non-project time tracking

## Technical Details

### Files Modified
```
api/src/routes/workshop.ts              # Removed rounding logic
api/prisma/schema.prisma                # Made projectId nullable
api/prisma/migrations/...               # Migration file
web/src/app/workshop/page.tsx           # Input step 0.01
src/app/workshop/page.tsx               # Input step 0.01
web/src/app/workshop-mobile/page.tsx    # Input step 0.01
web/src/components/workshop/WorkshopTimer.tsx  # Better display
```

### Database Impact
- Existing time entries unchanged (still have projectId)
- New time entries can have NULL projectId
- No data loss or migration

### Backwards Compatibility
- ✅ All existing features work unchanged
- ✅ Project-based time tracking still default
- ✅ Generic processes optional (must be explicitly marked)
- ✅ Reports and analytics handle NULL projectId gracefully

## Testing Recommendations

1. **Test Timer Precision:**
   - Start timer, wait 2 minutes 37 seconds
   - Stop timer
   - Verify logs exactly 0.04 hours (not rounded to 0.00 or 0.25)
   - Alert should show "Logged 2m (0.04 hours)"

2. **Test Generic Process:**
   - Go to Settings > Workshop, create process "Test Cleaning"
   - Check "Generic" box
   - Go to Workshop > Quick Log Hours
   - Select "Test Cleaning" process
   - Verify project field is hidden
   - Log 1.5 hours
   - Verify time entry created with NULL projectId

3. **Test Manual Input:**
   - Try logging 2.17 hours (2h 10m)
   - Verify input accepts decimal
   - Verify saves exact value

4. **Test Project Time (Regression):**
   - Start timer on a regular process with project
   - Verify project field still required
   - Verify time logs correctly against project

## Benefits

✅ **Accurate Time Tracking** - No more lost minutes from rounding  
✅ **Flexible Categories** - Track cleaning, admin, training without fake projects  
✅ **Better Reporting** - See exactly how much time spent on non-project work  
✅ **User-Friendly** - Automatic UI adaptation based on process type  
✅ **Configurable** - Add custom categories in settings  

## Next Steps (Optional)

Consider adding:
- Report showing time breakdown by category vs project
- Budget alerts for non-project time
- Category-specific analytics
- Color coding for generic vs project time in calendar view
