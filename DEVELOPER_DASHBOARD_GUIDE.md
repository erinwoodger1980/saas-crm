# Developer Dashboard Setup Guide

## Overview
A comprehensive developer dashboard system has been implemented to help you manage all tenants, review feedback, track development tasks, monitor ML training, and perform administrative operations.

## Features Implemented

### 1. Developer Role & Access Control
- Added `isDeveloper` boolean field to User model
- Developer-only middleware on all `/dev/*` routes
- Automatically shows "Developer" section in app shell when user has developer access
- All database migrations now require developer role

### 2. Enhanced Feedback System
- **New Fields:**
  - `priority` (LOW, MEDIUM, HIGH, CRITICAL)
  - `category` (UI, Feature, Bug, Performance, etc.)
  - `devNotes` (internal developer notes)
  - `linkedTaskId` (link to DevTask)
- **Expanded Statuses:**
  - OPEN, IN_REVIEW, PLANNED, IN_PROGRESS, COMPLETED, WONT_FIX, DUPLICATE

### 3. Development Task Management
- New `DevTask` model with fields:
  - Title, description, status, priority, category
  - Sprint identifier, estimated/actual hours
  - Assignee, related feedback IDs, tenant IDs
  - Internal notes
- **Statuses:** BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, TESTING, DONE, BLOCKED

### 4. Developer Dashboard Pages

#### `/dev` - Main Dashboard
- System-wide statistics (tenants, users, leads, opportunities, feedback, tasks)
- Quick links to all dev tools
- List of all tenants with metrics

#### `/dev/tenants` - Tenant Management
- View all tenants with user/lead/opportunity counts
- Click to view detailed tenant information
- See subscription status and plan

#### `/dev/tenants/[id]` - Tenant Details
- Full tenant profile with all statistics
- User list with roles and signup status
- Quick actions (view ML status, view feedback)

#### `/dev/feedback` - Feedback Management
- Cross-tenant feedback review
- Filter by status, priority, category, tenant
- Edit feedback: update status, priority, add dev notes
- Link feedback to development tasks
- Color-coded priority and status badges

#### `/dev/tasks` - Development Task Board
- Kanban-style board with 7 columns (Backlog → Done)
- Create new tasks with all details
- Drag or use dropdown to change task status
- Priority-based border colors
- Delete tasks when complete

#### `/dev/ml/[[...id]]` - ML Training Status
- View ML training status for all tenants or specific tenant
- Data statistics (lead count, email count)
- Latest training insights with accuracy metrics
- Recent training events timeline
- Trigger training button for any tenant

## Database Setup

### Run Migration (Production)
```bash
cd api
./migrate-live.sh
```

Or manually:
```bash
cd api
npx prisma migrate deploy
```

### Enable Developer Access for Your Account

Option 1: Direct Database Update
```sql
UPDATE "User" SET "isDeveloper" = true WHERE email = 'your-email@example.com';
```

Option 2: Use Prisma Studio
```bash
cd api
npx prisma studio
```
Then navigate to the User table and set `isDeveloper` to `true` for your account.

Option 3: Via API (if you have access)
Update your user record through the database or create a temporary endpoint.

## API Endpoints

All developer endpoints require authentication + `isDeveloper = true`:

### Tenants
- `GET /dev/tenants` - List all tenants with counts
- `GET /dev/tenants/:id` - Get tenant details

### Feedback
- `GET /dev/feedback?status=OPEN&priority=HIGH&category=Bug&tenantId=xxx` - List feedback (all filters optional)
- `PATCH /dev/feedback/:id` - Update feedback (status, priority, category, devNotes, linkedTaskId)

### Dev Tasks
- `GET /dev/tasks?status=IN_PROGRESS&sprint=2025-W46&priority=HIGH` - List tasks (all filters optional)
- `POST /dev/tasks` - Create task
- `PATCH /dev/tasks/:id` - Update task
- `DELETE /dev/tasks/:id` - Delete task

### ML Status
- `GET /dev/ml/status` - Get ML training status for all tenants
- `GET /dev/ml/status/:tenantId` - Get detailed ML status for specific tenant
- `POST /dev/ml/train/:tenantId` - Trigger ML training

### System
- `GET /dev/stats` - System-wide statistics

### Database (moved from users page)
- `POST /dev/db/migrate` - Information about running migrations (developer only)
- `POST /admin/run-migrations` - Legacy endpoint (now requires developer role)

## How to Use

### 1. Enable Developer Access
First, set your user account's `isDeveloper` flag to `true` in the database.

### 2. Access Developer Dashboard
- Log in to your account
- You'll see a "Developer" section appear in the left sidebar
- Click "Dev Dashboard" to access `/dev`

### 3. Review User Feedback
- Navigate to `/dev/feedback`
- Use filters to find specific feedback
- Click "Edit" on any feedback item
- Update status (e.g., OPEN → PLANNED → IN_PROGRESS → COMPLETED)
- Set priority (CRITICAL for urgent issues)
- Add category tags
- Write developer notes
- Link to a development task

### 4. Manage Development Tasks
- Navigate to `/dev/tasks`
- Click "New Task" to create a task
- Tasks appear in kanban columns by status
- Use dropdown on each card to move between statuses
- Link related feedback IDs when creating tasks
- Track estimated vs actual hours

### 5. Monitor ML Training
- Navigate to `/dev/ml`
- View training status for all tenants
- Click "Trigger Training" to run training manually
- Review accuracy metrics and error logs

### 6. Manage Tenants
- Navigate to `/dev/tenants`
- Click any tenant to view details
- See user list, subscription status, data counts
- Quick links to tenant-specific feedback and ML status

## Security Notes

- All `/dev/*` routes are protected by `requireDeveloper` middleware
- Regular users cannot access developer features even if they know the URLs
- Database migrations removed from regular settings pages
- Only developers can run sensitive operations

## Next Steps

1. **Set isDeveloper flag** for your account
2. **Run the migration** to create DevTask table and update Feedback columns
3. **Access /dev** to test the dashboard
4. **Start managing feedback** - review existing feedback and categorize it
5. **Create dev tasks** for upcoming features
6. **Monitor ML training** across all tenants

## Troubleshooting

### "Access Denied" or "Developer access required"
- Verify your user account has `isDeveloper = true` in database
- Check that you're logged in with the correct account

### DevTask table doesn't exist
- Run `npx prisma migrate deploy` or `./migrate-live.sh` in the api folder

### Feedback priority/category fields missing
- Run database migration to add new columns to Feedback table

### Developer section not showing in sidebar
- Clear browser cache and reload
- Check browser console for API errors
- Verify `/dev/stats` endpoint returns 200 (not 403)

## Future Enhancements (Optional)

- Tenant impersonation (switch tenantId context)
- Real-time notifications for new feedback
- Sprint planning with drag-drop
- GitHub integration for tasks
- Automated deployment triggers
- Performance monitoring dashboard
- Error log aggregation
- Customer support ticket system
