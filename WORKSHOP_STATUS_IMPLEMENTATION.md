# Workshop Process Status Tracking - Implementation Guide

## Completed ✅

### Database Schema
- Added `status` field to `ProjectProcessAssignment` (pending, in_progress, completed)
- Added `completionComments` field for process completion notes
- Added `isLastManufacturing` and `isLastInstallation` flags to `WorkshopProcessDefinition`
- Migration created and applied

### Backend API
- Timer start automatically marks process as "in_progress"
- Manual hour logging marks process as "in_progress" 
- New endpoint: `PATCH /workshop/process-status` for manual status updates
- Process completion checks for last manufacturing/installation flags
- Auto-updates project status to `complete_not_installed` or `complete`
- Backend includes new fields in workshop-processes CRUD operations

### Settings UI
- Added "Last Mfg" checkbox column
- Added "Last Install" checkbox column
- Updated grid layout to accommodate new fields
- Create and update functions include new fields

## TODO 🚧

### Timer/Hours UI - Completion Prompts
1. **When stopping timer** (WorkshopTimer.tsx `stopTimer`):
   - Show dialog: "Is this process complete?"
   - If YES: Ask for completion comments (optional textarea)
   - Call `PATCH /workshop/process-status` with status='completed'
   - If process is last mfg/install, show additional message about project completion

2. **When swapping timer** (WorkshopTimer.tsx `swapTimer`):
   - Same flow as stopping timer
   - Mark old process as completed before starting new one

3. **When manually logging hours** (workshop page.tsx log hours modal):
   - Add checkbox "Mark this process as complete"
   - If checked, show comments field
   - Pass `markComplete: true` and `completionComments` to backend

### Workshop Tasks Tab
1. **Add "Tasks" tab** to workshop page (next to Schedule, Calendar):
   - List all workshop tasks for current user
   - Filter by status (Open, In Progress, Done)
   - Show task title, project, due date, priority

2. **Link tasks to material ordering**:
   - Add "Link to Task" dropdown in production modal ordering section
   - When task is signed off, auto-fill:
     - `orderedDate` - when task marked done
     - `expectedDate` - from task metadata or manual entry
     - `receivedDate` - needs separate "Mark Received" action

3. **Task completion flow**:
   - Mark task as "Done" button
   - If linked to materials, prompt: "Has material been received?"
   - Update receivedDate if YES
   - Otherwise just mark task complete

### TypeScript Types to Add
```typescript
interface ProcessAssignment {
  id: string;
  processCode: string;
  processName: string;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt?: string | null;
  completionComments?: string | null;
  isLastManufacturing?: boolean;
  isLastInstallation?: boolean;
}
```

### Dialog/Modal Components Needed
```typescript
<ProcessCompletionDialog
  processName={string}
  onComplete={(comments: string) => void}
  onSkip={() => void}
  isLastProcess={boolean} // Show special message if true
/>

<TaskMaterialLinkDialog
  taskId={string}
  onLink={(materialId: string) => void}
/>
```

### API Endpoints to Create
```typescript
// Get tasks for workshop user
GET /tasks/workshop?userId=xxx&status=open,in_progress

// Link task to material
PATCH /tasks/:taskId/link-material
Body: { materialId, orderType: 'door' | 'ironmongery' | 'glazing' }

// Mark material received
PATCH /materials/:materialId/received
Body: { receivedDate, notes }
```

## Implementation Order

1. ✅ Database & backend API (DONE)
2. ✅ Settings UI (DONE)
3. Add completion dialogs to WorkshopTimer component
4. Update manual hours logging modal
5. Create Tasks tab in workshop page
6. Add material linking functionality
7. Test full workflow

## Testing Checklist

- [ ] Start timer → marks process as in_progress
- [ ] Stop timer → prompts for completion → marks as completed
- [ ] Swap timer → completes old process, starts new one
- [ ] Log hours → marks process as in_progress
- [ ] Log hours with complete checkbox → marks as completed
- [ ] Complete last manufacturing process → project status = complete_not_installed
- [ ] Complete last installation process → project status = complete
- [ ] Tasks tab shows user's workshop tasks
- [ ] Can link task to material order
- [ ] Task completion updates order dates
