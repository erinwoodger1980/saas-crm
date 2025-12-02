# Timesheets UX Improvements Summary

## Completed Features ✅

### 1. Monday-Sunday Week Display
**Status:** ✅ Complete

- Week now always starts on Monday at 00:00:00 and ends on Sunday at 23:59:59
- Date calculations updated in both initial load and "Go to Today" function
- Applies to both Overview and Team Activity views

**Implementation:**
```typescript
// Calculate Monday of current week
const day = today.getDay();
const monday = new Date(today);
monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
monday.setHours(0, 0, 0, 0);

// Calculate Sunday of current week
const sunday = new Date(today);
sunday.setDate(today.getDate() + (day === 0 ? 0 : 7 - day));
sunday.setHours(23, 59, 59, 999);
```

### 2. Active Timer Green Dot Indicators
**Status:** ✅ Complete

- Green dot appears next to users who currently have a timer running
- Shows in Overview grid (8px dot)
- Shows in User Detail header (larger 4px dot)
- Positioned top-right of avatar with white border
- Includes "Timer running" tooltip on hover

**Backend:**
- New endpoint: `GET /workshop/timers/active` returns all active timer user IDs
- Frontend fetches active timers alongside user activity data
- State tracked in `activeTimers` Record<string, boolean>

**UI:**
```tsx
{ua.hasActiveTimer && (
  <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" title="Timer running" />
)}
```

### 3. Profile Picture Upload
**Status:** ✅ Complete

**Schema Changes:**
- Added `profilePictureUrl String?` field to User model
- Migration applied via `prisma db push`

**Backend:**
- New endpoint: `PATCH /workshop/users/:userId/profile-picture`
- Accepts `{ profilePictureUrl: string }` in body
- Stores data URLs or external URLs
- Returns updated user with profile picture

**Frontend:**
- Hover over avatar in User Detail view to see upload icon
- Click to select image file
- Converts to data URL and uploads
- Automatically refreshes to show new picture
- Falls back to colored circle with initial if no picture set

**Display Locations:**
- Overview grid: 32px rounded circle
- User Detail header: 64px rounded square
- Projects view: (could be added if needed)

### 4. Beautiful UI Styling
**Status:** ✅ Complete

Applied consistent design patterns from dashboard to timesheets:

**Page Background:**
- Gradient background: `bg-gradient-to-br from-slate-50 to-blue-50`
- Full page coverage with `min-h-screen`

**Header:**
- Gradient text for title: `bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent`
- Icon in gradient box: `bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-xl text-white`
- Improved subtitle color: `text-slate-600`

**Tabs:**
- White glassmorphic background: `bg-white/80 border border-indigo-200/70 shadow-sm rounded-xl`
- Active tab gradient: `data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500`
- Active tab white text: `data-[state=active]:text-white`
- Rounded corners on individual tabs: `rounded-lg`

**Cards:**
- Glassmorphic effect: `bg-white/80 border-indigo-200/70 shadow-lg rounded-xl backdrop-blur-sm`
- Consistent across User Detail header and all cards

**Tables:**
- Container styling: `bg-white/80 rounded-xl shadow-lg border border-indigo-200/70 backdrop-blur-sm`
- Applied to Overview grid, User Detail grid, Projects grid

**Buttons:**
- Gradient hover: `hover:bg-gradient-to-r hover:from-blue-500 hover:to-purple-500 hover:text-white`
- Transition: `transition-all`
- Border: `border-indigo-200/70`
- Background: `bg-white/80`

## Technical Architecture

### Database Schema
```prisma
model User {
  id                String  @id @default(cuid())
  profilePictureUrl String?
  // ... other fields
}
```

### API Endpoints

**GET /workshop/timers/active**
- Returns: `{ ok: true, timers: Array<{ userId: string }> }`
- Purpose: Identify which users currently have active timers
- Used by: Frontend to show green dots

**PATCH /workshop/users/:userId/profile-picture**
- Body: `{ profilePictureUrl: string }`
- Returns: `{ ok: true, user: { id, name, email, profilePictureUrl } }`
- Purpose: Update user's profile picture
- Validation: Requires valid tenant match

**GET /workshop/team-activity?from=YYYY-MM-DD&to=YYYY-MM-DD**
- Modified to include `profilePictureUrl` in user data
- Returns: `{ users: Array<UserActivity> }`

### Frontend State
```typescript
const [activeTimers, setActiveTimers] = useState<Record<string, boolean>>({});
const [userActivity, setUserActivity] = useState<UserActivity[]>([]);

type UserActivity = {
  user: {
    id: string;
    name: string;
    email: string;
    workshopColor: string | null;
    profilePictureUrl: string | null;
  };
  hasActiveTimer: boolean;
  days: Record<string, TimeEntry[]>;
};
```

## Testing Checklist

- [x] Week correctly starts on Monday for current week
- [x] Week correctly starts on Monday when navigating weeks
- [x] "Go to Today" button correctly jumps to current Monday-Sunday week
- [x] Green dot appears for users with active timers
- [x] Green dot disappears when timer is stopped
- [x] Profile picture upload works via hover + click
- [x] Profile pictures display correctly in Overview grid
- [x] Profile pictures display correctly in User Detail header
- [x] Fallback to colored circle with initial works when no picture
- [x] Gradient styling applied consistently across all views
- [x] Tables have glassmorphic card styling
- [x] Tabs have gradient active state
- [x] Buttons have gradient hover effects
- [x] Background gradient renders correctly
- [x] Build passes all checks
- [x] Migration applied successfully

## Files Modified

1. **api/prisma/schema.prisma**
   - Added `profilePictureUrl String?` to User model

2. **api/src/routes/workshop.ts**
   - Added `GET /timers/active` endpoint
   - Added `PATCH /users/:userId/profile-picture` endpoint
   - Modified `GET /team-activity` to include profilePictureUrl

3. **web/src/app/timesheets/page.tsx**
   - Updated UserActivity type with profilePictureUrl and hasActiveTimer
   - Modified week calculation to Monday-Sunday
   - Added activeTimers state tracking
   - Added uploadProfilePicture function
   - Modified loadTeamActivity to fetch active timers
   - Updated goToToday to calculate Monday-Sunday
   - Added profile picture display in Overview grid
   - Added profile picture display in User Detail header
   - Added upload UI with hover overlay
   - Added green dot indicators for active timers
   - Applied gradient and glassmorphic styling throughout
   - Added Upload icon import from lucide-react

## Deployment

**Commit:** `6f9c7858`
**Branch:** `main`
**Status:** Pushed to GitHub ✅

All changes successfully deployed and ready for use in production.

## Future Enhancements (Optional)

- [ ] Add profile picture upload in user settings page
- [ ] Add profile pictures to Projects and Project Detail views
- [ ] Support S3/cloud storage instead of data URLs for better performance
- [ ] Add image cropping/resizing before upload
- [ ] Add profile picture to team member list/directory
- [ ] Add animation to green dot (pulse effect)
- [ ] Add timer duration next to green dot on hover
