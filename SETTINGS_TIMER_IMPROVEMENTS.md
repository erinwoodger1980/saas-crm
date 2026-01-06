# Settings & Timer Process Filtering Implementation

## Overview
Improved the user settings UI and implemented process-based filtering for the workshop timer based on user permissions.

## Changes Implemented

### 1. Enhanced Settings/Users Process Selection UI

**File**: `web/src/app/settings/users/page.tsx`

**Improvements**:
- **Better Visual Design**: Process selection now uses a modern card-based layout with clear visual feedback
- **Improved Edit Mode**: 
  - Larger, more prominent checkboxes with blue highlighting for selected processes
  - 3-4 column responsive grid layout (adapts to screen size)
  - White cards with blue borders for selected processes
  - Hover states for better interactivity
- **Enhanced Display Mode**:
  - Selected processes shown as blue badges
  - "All processes allowed" message when no specific processes are selected
  - Clean badge layout with proper spacing
- **Additional Controls**:
  - "Clear All (Allow All)" button to quickly reset to all processes
  - Better organized Save/Cancel buttons with visual separation
  - "Edit Processes" button moved to header for better layout

**UI Features**:
- Selected processes: Blue background (`bg-blue-50`), blue border (`border-blue-500`), shadow
- Unselected processes: White background, gray border, hover effect
- Display badges: Blue theme (`bg-blue-100`, `text-blue-900`, `border-blue-200`)
- Edit panel: Light gray background (`bg-slate-50`) with proper padding and rounded corners

### 2. Added User Type Support for Process Codes

**File**: `web/src/lib/use-current-user.ts`

**Changes**:
- Added `workshopProcessCodes?: string[]` to `CurrentUser` type
- This field stores the list of process codes a user is allowed to work on
- Empty array or undefined means the user can work on all processes

### 3. Implemented Timer Process Filtering

**File**: `web/src/components/workshop/WorkshopTimer.tsx`

**Changes**:
- Added `currentUser` prop to `WorkshopTimerProps` interface
- Implemented `allowedProcesses` filter logic:
  ```typescript
  const allowedProcesses = processes.filter(p => {
    const userProcessCodes = currentUser?.workshopProcessCodes;
    // If no restrictions (empty array or undefined), show all processes
    if (!userProcessCodes || userProcessCodes.length === 0) {
      return true;
    }
    // Otherwise, only show processes the user is allowed to work on
    return userProcessCodes.includes(p.code);
  });
  ```
- Updated all process dropdown lists to use `allowedProcesses` instead of `processes`
- Updated all `processes.find()` calls to use `allowedProcesses.find()`
- Applies to:
  - Start timer dialog
  - Swap timer dialog
  - Active timer display

**File**: `web/src/app/workshop/page.tsx`

**Changes**:
- Passed `currentUser={user}` to `WorkshopTimer` component
- Timer now filters processes based on logged-in user's permissions

## Behavior

### Process Filtering Logic

1. **When user has specific processes assigned**:
   - Timer only shows processes in their `workshopProcessCodes` array
   - Other processes are hidden from dropdown
   - Example: User has `["FRAME_MAKING", "ASSEMBLY"]` → only sees Frame Making and Assembly options

2. **When user has no processes assigned** (empty array or null):
   - Timer shows ALL available processes
   - No filtering applied
   - Example: Admin users or users without restrictions see all processes

### Settings UI Workflow

1. **View Mode**:
   - Click "Edit Processes" to enter edit mode
   - Shows selected processes as blue badges
   - Shows "All processes allowed" if none selected

2. **Edit Mode**:
   - Click checkboxes to select/deselect processes
   - Selected processes highlighted with blue background
   - Click "Clear All (Allow All)" to remove all selections
   - Click "Save Changes" to persist changes
   - Click "Cancel" to discard changes

## Benefits

1. **Better UX**: Modern, intuitive UI for managing user process permissions
2. **Access Control**: Users only see processes they're allowed to work on
3. **Flexibility**: Empty permissions = all processes (good for admins)
4. **Visual Clarity**: Clear indication of selected vs available processes
5. **Consistency**: Filtering applies everywhere timer is used

## Files Modified

1. `web/src/app/settings/users/page.tsx` - Enhanced process selection UI
2. `web/src/lib/use-current-user.ts` - Added workshopProcessCodes to User type
3. `web/src/components/workshop/WorkshopTimer.tsx` - Implemented process filtering
4. `web/src/app/workshop/page.tsx` - Passed currentUser to timer component

## Testing Notes

- Build successful with no errors
- Process filtering automatically applies to all timer interactions:
  - Starting new timer
  - Swapping between processes
  - Viewing active timer process name
- Admin users (no specific processes assigned) see all processes
- Workshop users with assigned processes only see their allowed processes
