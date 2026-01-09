# Workshop Task-Timer Integration Plan

## Overview
Deep integration between workshop tasks and the timer system to make task management intuitive and seamless for workshop users on mobile devices.

## Key Features

### 1. Task Count Badge on My Tasks Button ✓
- Display number of tasks due today on the "My Tasks" pill
- Visual indicator for overdue tasks (red dot/number)
- Real-time update when tasks are completed

### 2. Enhanced Timer Start Modal
**Tasks Due Today Section (Top of Modal)**
- Show all tasks due today at the top of the modal
- Quick-start buttons next to each task
- Visual indicators for late tasks (red highlight + ⚠️ icon)
- One-click to start timer for a task's linked project/process

**Late Task Reminders**
- Every time the modal opens, check for overdue tasks
- Show prominent banner at top: "⚠️ You have [N] overdue tasks"
- Click to view overdue tasks inline

### 3. Task-Timer Integration
**Starting Timer from Task**
- Tasks can be linked to projects (already supported via relatedType/relatedId)
- When starting timer from a task:
  - Auto-select the linked project
  - Auto-select the process code from task metadata
  - Pre-fill notes with task title
  - Track taskId in timer metadata

**Swapping to Task**
- Add "Start from Task" option in swap timer modal
- List of available tasks with their linked projects
- Seamlessly transition to task-based time tracking

**Stopping Timer + Completing Task**
- When stopping timer with a linked task:
  - Show option: "Mark '[Task Title]' as complete?"
  - If task is FORM type, show form inline before completion
  - Allocate timer hours to the linked project
  - Update task status to DONE
  - Record time entry with taskId reference

### 4. Simplified Task UI (Type-Based Display)
**FORM Tasks**
- Show only the form (full screen on mobile)
- Hide description, notes, assignees
- Timer integration at bottom
- Signature pad if required
- "Save" completes the task

**COMMUNICATION Tasks**
- Show communication type/channel/direction fields
- Quick log interface (minimal fields)
- Auto-complete on save

**MANUAL/CHECKLIST Tasks**
- Show standard task interface
- For CHECKLIST: show items with checkboxes
- Progress indicator

**Edit Mode**
- Small "Edit" button to expand full task editor
- Change type, add features, modify metadata
- Collapsible sections to keep UI clean

### 5. Mobile-First Design
**Touch-Friendly Controls**
- Minimum 44px touch targets
- Large buttons for primary actions
- Swipe gestures for task actions (complete, defer, view details)
- Bottom sheet modals for forms/details
- Sticky action buttons at bottom
- Reduced tap precision requirements

**Layout Optimization**
- Single column on mobile
- Collapsible sections
- Focus on one action at a time
- Minimal scrolling within modals
- Quick actions always visible

### 6. Project-Task-Time Allocation
**Data Flow**
1. Task linked to project (via relatedId when relatedType=PROJECT)
2. User starts timer for task → auto-selects project
3. Time accrues while timer runs
4. On stop → time entry created with:
   - projectId (from task.relatedId)
   - process (from task.meta.processCode)
   - hours (calculated from timer duration)
   - taskId (reference to task)
5. Task can be marked complete
6. Time appears in workshop schedule/reports

## API Changes Needed

### Task Endpoints (Already Exist)
- GET /tasks/workshop - List tasks for user ✓
- GET /tasks/stats - Get task counts ✓
- POST /tasks/:id/complete - Mark complete ✓
- POST /tasks/:id/start - Mark started ✓

### Timer Endpoints Updates Needed
- POST /workshop/timer/start - Add taskId parameter
- POST /workshop/timer/stop - Return task info if linked
- GET /workshop/timer - Include linked task in response

### New/Enhanced Fields
**TimeEntry**
- Add taskId reference (optional foreign key)

**Timer (session)**
- Add taskId to meta or as field
- Track which task is being worked on

**Task**
- Ensure meta can store processCode
- Support relatedType=PROJECT with relatedId=opportunityId

## Implementation Priority

1. **Phase 1: Core Integration (This Session)**
   - Task count badge on My Tasks button
   - Show tasks in timer start modal
   - Link timer to task on start
   - Allocate time to project on stop

2. **Phase 2: Task Completion Flow**
   - Stop timer + complete task workflow
   - FORM task inline display
   - Mobile-optimized task modals

3. **Phase 3: UI Refinement**
   - Type-based task display logic
   - Edit mode for tasks
   - Mobile gesture support
   - Performance optimization

## File Changes Required

### Backend
- `api/src/routes/workshop.ts` - Update timer endpoints
- `api/src/routes/tasks.ts` - Enhance workshop task endpoints
- `api/prisma/schema.prisma` - Add TimeEntry.taskId field

### Frontend
- `web/src/app/workshop/page.tsx` - Add task count, integrate modals
- `web/src/components/workshop/WorkshopTimer.tsx` - Task integration
- NEW: `web/src/components/workshop/TaskListModal.tsx` - Task list for workshop
- NEW: `web/src/components/workshop/TaskTimerCard.tsx` - Task card with timer integration
- NEW: `web/src/components/workshop/FormTaskModal.tsx` - Simplified form task UI

## Success Metrics
- Reduced clicks to start timer for a task (from ~5 to 1-2)
- Easier to track which tasks have been worked on
- Time automatically allocated to correct projects
- Mobile usability score improvement
- Workshop user adoption of task system
