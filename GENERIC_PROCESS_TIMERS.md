# Generic Process Timers Implementation

## Overview
Added support for time tracking on generic processes (HOLIDAY, OFF_SICK, ADMIN, CLEANING) without requiring a project attachment.

## Changes Made

### Backend Changes

#### 1. Database Schema (`api/prisma/schema.prisma`)
- Made `WorkshopTimer.projectId` nullable: `String?`
- Made `WorkshopTimer.project` relation optional: `Opportunity?`
- Allows timers to exist without an associated project

#### 2. Timer Start Endpoint (`api/src/routes/workshop.ts`)
- Updated `POST /workshop/timer/start` to accept optional `projectId`
- Conditional validation: only validates project if `projectId` is provided
- Supports starting timers with just a process code for generic processes

#### 3. Database Migration
Created manual migration SQL due to shadow DB issues:
```sql
-- api/prisma/migrations/20251201133244_optional_project_timer/migration.sql
ALTER TABLE "WorkshopTimer" ALTER COLUMN "projectId" DROP NOT NULL;
```

### Frontend Changes

#### 1. WorkshopTimer Component (`web/src/components/workshop/WorkshopTimer.tsx`)
**Added Features:**
- `GENERIC_PROCESSES` constant: `['HOLIDAY', 'OFF_SICK', 'ADMIN', 'CLEANING']`
- Separate UI flows:
  - **Start Project Timer**: Requires project + process selection
  - **Start Generic Timer**: Only requires process selection (no project)
- Updated `Timer` interface to support nullable `projectId`
- Conditional project display: only shows project info if timer has one
- Generic timer indicator: "Generic time entry (no project)"

**Updated Functions:**
- `startTimer()`: Conditionally includes `projectId` based on process type
- `swapTimer()`: Supports swapping to/from generic processes

**UI Changes:**
- Idle state shows two buttons:
  - "Start Project Timer" (blue)
  - "Start Generic Timer" (purple)
- Generic timer form only shows:
  - Process dropdown (filtered to generic processes)
  - Notes field (optional)

#### 2. Workshop Page (`web/src/app/workshop/page.tsx`)
**Quick Log Modal:**
- Updated `GENERIC_PROCESSES` constant to match timer component
- Conditional project field: hidden when generic process selected
- Validation: requires project only for non-generic processes

**Project Modal Swap:**
- Reordered form: Process selection first, then project (if needed)
- Conditional project field and search
- Updated validation and payload construction
- Supports swapping from project timer to generic timer and vice versa

## Generic Processes Supported
1. **HOLIDAY** - Holiday/vacation time
2. **OFF_SICK** - Sick leave
3. **ADMIN** - Administrative tasks
4. **CLEANING** - Workshop cleaning/maintenance

These processes must be defined in Settings > Workshop with matching codes.

## User Flows

### Starting a Generic Timer
1. Click "Start Generic Timer" button
2. Select a generic process (HOLIDAY, OFF_SICK, ADMIN, CLEANING)
3. Optionally add notes
4. Click "Start Timer"
5. Timer runs without project attachment

### Quick Logging Generic Hours
1. Click "Quick Log Hours"
2. Select user
3. Select a generic process
4. Project field is hidden (automatically set to null)
5. Enter hours and optional notes
6. Click "Log Hours"

### Swapping Timers
- Can swap from project timer to generic timer
- Can swap from generic timer to project timer
- Process selection determines if project field appears

## Database Impact
- `WorkshopTimer` table: `projectId` column is now nullable
- `TimeEntry` table: Already supported nullable `projectId`
- Existing timers with projects are unaffected

## Migration Status
- ✅ Schema updated
- ✅ Migration SQL created
- ⏳ Migration will be applied on next Render deployment
- No data migration needed (existing records stay unchanged)

## Testing Checklist
- [ ] Start generic timer (HOLIDAY) without project
- [ ] Stop generic timer, verify TimeEntry created with null projectId
- [ ] Swap from project timer to generic timer
- [ ] Swap from generic timer to project timer
- [ ] Quick log hours for generic process
- [ ] Verify project field hidden for generic processes in all forms
- [ ] Check timer display shows "Generic time entry (no project)"

## Notes
- Generic processes are hardcoded in both components for consistency
- Process definitions still come from Settings > Workshop
- Backend validates that process code exists but doesn't enforce project requirement
- Mobile workshop timer (`/workshop-mobile`) may need similar updates in future
