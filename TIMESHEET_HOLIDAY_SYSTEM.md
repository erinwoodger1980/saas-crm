# Timesheet & Holiday Management Implementation

## Overview
Added personal timesheet view and holiday request management system to the workshop page, allowing users to track their hours and request time off.

## Features Implemented

### 1. My Timesheet Tab

**Location**: Workshop page, next to QR Code button

**Features**:
- **Weekly View**: Shows hours logged by project and process for the current week
- **Week Navigation**: Previous/Next week buttons + "This Week" button to jump to current week
- **Auto-defaults to current week** (Monday-Sunday)
- **Table Layout**: Matches screenshot design with:
  - Project name and process (e.g., "JACK RAFTER - assembly")
  - Daily hours (M, T, W, T, F, S, S columns)
  - Total hours for each project/process
  - Week total displayed prominently at top

**Implementation**:
- Component: `web/src/components/workshop/MyTimesheetView.tsx`
- API: `GET /workshop/my-timesheet?userId=X&from=YYYY-MM-DD&to=YYYY-MM-DD`
- Shows project number + name (e.g., "123 - Project Name")
- Green highlighting for days with logged hours
- Handles non-assigned hours (generic time entries)

### 2. Holiday Request System

**User Features**:
- **Holidays Button**: Opens modal for requesting time off
- **Request Form**:
  - Start date picker
  - End date picker
  - Reason field (optional)
  - Automatic validation (end date must be after start date)
  - Automatic calculation of number of days

**Admin Features** (To be added):
- View all holiday requests
- Approve or deny requests with optional admin notes
- Delete requests

**Holiday Balance Tracking**:
- Each user has annual holiday allowance (configurable, default 20 days)
- System tracks approved holidays for current year
- Calculates remaining days: `allowance - used = remaining`

**Implementation**:
- Modal: Integrated into workshop page
- Backend APIs:
  - `POST /workshop/holiday-requests` - Create request (auto status: pending)
  - `GET /workshop/holiday-requests` - List requests (users see own, admins see all)
  - `PATCH /workshop/holiday-requests/:id` - Approve/deny (admin only)
  - `DELETE /workshop/holiday-requests/:id` - Delete request
  - `GET /workshop/holiday-balance` - Get user's remaining days

### 3. Holiday Allowance Settings

**Location**: Settings > Users

**Features**:
- New editable field: "Holiday allowance (days/year)"
- Inline editing similar to "Workshop hrs/day"
- Default: 20 days per year
- Updates via: `PATCH /workshop/users/:id/holiday-allowance`

## Database Schema

### User Model Updates
```prisma
model User {
  holidayAllowance  Int?  @default(20)
  holidayRequests   HolidayRequest[]
}
```

### New HolidayRequest Model
```prisma
model HolidayRequest {
  id          String    @id @default(cuid())
  tenantId    String
  userId      String
  startDate   DateTime
  endDate     DateTime
  days        Int       // Number of days requested
  reason      String?
  status      String    @default("pending") // pending | approved | denied
  adminNotes  String?
  approvedAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  tenant      Tenant    @relation(...)
  user        User      @relation(...)
}
```

**Indexes**:
- `tenantId, userId` - User's requests
- `tenantId, status` - Filter by status
- `userId, status` - User's requests by status

## User Workflow

### Viewing Timesheet
1. Click "📊 My Timesheet" button in workshop
2. See current week's hours by default
3. Use < > buttons to navigate weeks or click "This Week" to return
4. View hours broken down by project and process
5. See daily totals and week total

### Requesting Holiday
1. Click "🏖️ Holidays" button in workshop
2. Fill in holiday request form:
   - Select start date
   - Select end date
   - Optionally add reason
3. Submit request (status: pending)
4. Admin will approve or deny

### Admin Configuring Allowances
1. Go to Settings > Users
2. Find user in list
3. Click "Edit" next to "Holiday allowance (days/year)"
4. Enter number of days (e.g., 25, 30)
5. Click "Save"

## API Endpoints Summary

### Timesheet
- `GET /workshop/my-timesheet` - Get user's time entries for date range

### Holiday Requests
- `GET /workshop/holiday-requests` - List requests (filtered by role)
- `POST /workshop/holiday-requests` - Create new request
- `PATCH /workshop/holiday-requests/:id` - Approve/deny (admin)
- `DELETE /workshop/holiday-requests/:id` - Delete request
- `GET /workshop/holiday-balance` - Get remaining holiday days

### User Settings
- `PATCH /workshop/users/:id/holiday-allowance` - Update user's annual allowance

## Files Modified/Created

### Created
1. `web/src/components/workshop/MyTimesheetView.tsx` - Timesheet display component
2. `api/prisma/migrations/20260106000000_add_holiday_requests/migration.sql` - Database migration

### Modified
1. `web/src/app/workshop/page.tsx` - Added timesheet tab and holidays modal
2. `api/src/routes/workshop.ts` - Added 6 new endpoints
3. `api/prisma/schema.prisma` - Added HolidayRequest model and holidayAllowance field
4. `web/src/app/settings/users/page.tsx` - Added holiday allowance editing

## Next Steps (Admin Holiday Management)

To complete the admin holiday approval interface:

1. **Add Holiday Requests Tab** in Settings or Workshop admin view
2. **Show pending requests** with user info, dates, reason
3. **Approve/Deny buttons** with optional admin notes
4. **Display holiday balance** for each user
5. **Calendar view** showing approved holidays across team

## Technical Notes

- Holiday days calculation includes both start and end dates: `ceil((end - start) / 86400000) + 1`
- Non-admins can only see/delete their own pending requests
- Admins can approve/deny any request and delete any request
- Holiday balance only counts approved requests in current calendar year
- Timesheet data comes from existing `WorkshopTime` table
- Default week starts Monday, ends Sunday (standard business week)
