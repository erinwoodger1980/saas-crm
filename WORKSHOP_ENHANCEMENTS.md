# Workshop Schedule Enhancements

## Issues to Fix

### 1. User Assignment Error
**Problem:** "Failed to fetch" error when assigning users to workshop processes in the lead modal.
**Root Cause:** Frontend error handling not catching API errors properly.
**Solution:** Add better error handling and display in LeadModal.tsx

### 2. Missing valueGBP Field
**Problem:** No way to manually set project value in opportunities.
**Solution:** Add valueGBP input field to opportunity details section

### 3. User Color Coding
**Problem:** No visual distinction between users in the schedule.
**Solution:** 
- Add `workshopColor` field to User model
- Add UI in Settings to assign colors per user
- Display colored bars in schedule based on assigned user

### 4. Clickable Project Details
**Problem:** Clicking projects in schedule only opens hours modal, doesn't show full details.
**Solution:** Create a ProjectDetailsModal showing:
- Project name, dates, value
- All process assignments with assigned users
- Hours logged per process
- Progress indicators

## Implementation Plan

1. Add workshopColor to User schema (migration)
2. Update LeadModal error handling for workshop assignments
3. Add valueGBP field to OpportunityModal
4. Add color picker to Settings → Users
5. Create ProjectDetailsModal component
6. Update schedule onClick to show ProjectDetailsModal
7. Update schedule bars to use user colors

## Files to Modify

- `api/prisma/schema.prisma` - Add workshopColor to User
- `api/prisma/migrations/...` - Migration for new field
- `web/src/app/leads/LeadModal.tsx` - Better error handling
- `web/src/app/opportunities/OpportunityModal.tsx` - Add valueGBP field
- `web/src/app/settings/users/page.tsx` - Add color picker
- `web/src/app/workshop/page.tsx` - Add ProjectDetailsModal, use colors
- `api/src/routes/workshop.ts` - Add endpoint for project details
