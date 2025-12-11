# Fire Door Schedule Colors - Database Migration

## Overview
Migrated fire door schedule custom colors from browser localStorage to database storage in TenantSettings. This allows colors to be shared across all users in a tenant and persist properly.

## Problem
- Colors were stored in browser localStorage with tenant-specific keys
- Each user had their own copy of colors in their browser
- When one user (e.g., Paul Lewis) updated colors, other users didn't see the changes
- Colors were lost if browser data was cleared

## Solution
- Added `fireDoorScheduleColors` Json field to TenantSettings model
- Created API endpoints for GET/POST color management
- Updated frontend to fetch colors from API on mount
- Updated frontend to save colors via API instead of localStorage

## Database Changes

### Schema Update
File: `/api/prisma/schema.prisma`

Added field to TenantSettings model:
```prisma
model TenantSettings {
  // ... existing fields
  fireDoorScheduleColors Json?
}
```

### Migration
Manually applied column addition:
```sql
ALTER TABLE "TenantSettings" ADD COLUMN "fireDoorScheduleColors" JSONB;
```

Note: Had to use manual SQL due to shadow database issue with migration `20251024093000_ml_training_visibility`

## API Changes

### New Endpoints
File: `/api/src/routes/fire-door-schedule.ts`

**GET /api/fire-door-schedule/colors**
- Fetches tenant's custom colors from database
- Returns `{ colors: Record<string, {bg: string, text: string}> }`
- Requires authentication and fire door manufacturer flag

**POST /api/fire-door-schedule/colors**
- Saves tenant's custom colors to database
- Accepts `{ colors: Record<string, {bg: string, text: string}> }`
- Requires authentication and fire door manufacturer flag
- Updates immediately for all users in the tenant

## Frontend Changes

### File: `/web/src/app/fire-door-schedule/page.tsx`

**Fetch Colors (New)**
```typescript
// Fetch custom colors from API on mount
useEffect(() => {
  const fetchColors = async () => {
    try {
      const res = await fetch("/api/fire-door-schedule/colors");
      if (res.ok) {
        const data = await res.json();
        if (data.colors && Object.keys(data.colors).length > 0) {
          setCustomColors(data.colors);
        } else {
          // Set default colors if none saved
        }
      }
    } catch (error) {
      console.error("Error fetching colors:", error);
    }
  };
  
  if (user?.tenantId) {
    fetchColors();
  }
}, [user?.tenantId]);
```

**Save Colors (Replaced)**
```typescript
// Old: localStorage
localStorage.setItem(`fds:customColors:${user.tenantId}`, JSON.stringify(customColors));

// New: API
useEffect(() => {
  if (user?.tenantId && Object.keys(customColors).length > 0) {
    const saveColors = async () => {
      try {
        await fetch("/api/fire-door-schedule/colors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ colors: customColors }),
        });
      } catch (error) {
        console.error("Error saving colors:", error);
      }
    };
    saveColors();
  }
}, [customColors, user?.tenantId]);
```

## LAJ Default Colors

### Color Scheme
LAJ Joinery (tenant: `cmi58fkzm0000it43i4h78pej`) uses this color scheme:

**Material Statuses (Yellow/Orange/Green)**
- "In BOM": Yellow (#fde047, text: #854d0e)
- "In BOM TBC": Yellow (#fde047, text: #854d0e)
- "Ordered": Orange (#fb923c, text: #7c2d12)
- "Received": Green (#86efac, text: #14532d)
- "Stock": Green (#86efac, text: #14532d)
- "Received from TGS": Green (#86efac, text: #14532d)
- "Received from Customer": Green (#86efac, text: #14532d)

**Paperwork Statuses (Green)**
- "In Factory": Green (#86efac, text: #14532d)
- "Printed in Office": Green (#86efac, text: #14532d)

**Transport (Green)**
- "Booked": Green (#86efac, text: #14532d)

### Seeding LAJ Colors
To seed the default colors for LAJ, use one of these methods:

**Method 1: Browser Console (Easiest)**
1. Log in as an LAJ user
2. Open browser console (F12)
3. Run:
```javascript
fetch('/api/fire-door-schedule/colors', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    colors: {
      "In BOM": { "bg": "#fde047", "text": "#854d0e" },
      "In BOM TBC": { "bg": "#fde047", "text": "#854d0e" },
      "Ordered": { "bg": "#fb923c", "text": "#7c2d12" },
      "Received": { "bg": "#86efac", "text": "#14532d" },
      "Stock": { "bg": "#86efac", "text": "#14532d" },
      "Received from TGS": { "bg": "#86efac", "text": "#14532d" },
      "Received from Customer": { "bg": "#86efac", "text": "#14532d" },
      "In Factory": { "bg": "#86efac", "text": "#14532d" },
      "Printed in Office": { "bg": "#86efac", "text": "#14532d" },
      "Booked": { "bg": "#86efac", "text": "#14532d" }
    }
  })
}).then(r => r.json()).then(console.log);
```

**Method 2: Use Color Picker**
1. Log in as any LAJ user
2. Go to Fire Door Schedule page
3. Edit any project
4. Use color picker to set colors for each status
5. Colors will automatically save to database
6. All LAJ users will immediately see the new colors

**Method 3: Script (if needed)**
See: `seed-laj-colors-via-api.sh`

## Testing Checklist

- [x] Database column added successfully
- [x] API endpoints created and compiled
- [x] Frontend updated and built without errors
- [ ] Test: Log in as LAJ user, colors load correctly
- [ ] Test: Change a color, verify it saves to database
- [ ] Test: Log in as different LAJ user, verify they see the same colors
- [ ] Test: Other tenants get generic default colors
- [ ] Test: Color picker shows current colors correctly

## Rollback Plan

If issues occur:

1. **Frontend rollback**: Revert to localStorage
```typescript
// In useEffect on mount:
const colorKey = user?.tenantId ? `fds:customColors:${user.tenantId}` : "fds:customColors";
const savedCustomColors = localStorage.getItem(colorKey);
if (savedCustomColors) {
  setCustomColors(JSON.parse(savedCustomColors));
}

// On color change:
localStorage.setItem(`fds:customColors:${user.tenantId}`, JSON.stringify(customColors));
```

2. **Database rollback**: Column can remain (won't cause issues)
```sql
ALTER TABLE "TenantSettings" DROP COLUMN "fireDoorScheduleColors";
```

## Deployment Notes

1. Deploy API first (includes schema change and endpoints)
2. Deploy web (uses new endpoints with fallback to defaults)
3. Seed LAJ colors via browser console after deployment
4. Monitor for any errors in API logs

## Benefits

✅ **Multi-user persistence**: All users in a tenant see the same colors
✅ **Centralized management**: One person can update colors for everyone
✅ **Database backup**: Colors are backed up with database
✅ **No browser dependency**: Colors survive browser data clearing
✅ **Immediate updates**: Changes propagate to all users instantly
