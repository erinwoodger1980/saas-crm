# Manual Task ↔ Field Linking

## Overview
Tasks can now be manually linked to fields for bidirectional updates, independent of how the task was created.

## Key Changes

### TaskModal UI Enhancement
**File**: `web/src/components/tasks/TaskModal.tsx`

Added a new "Field Link" section in the task editor that allows:
- **Viewing** existing field link connections
- **Creating** new field links for any task
- **Unlinking** tasks from fields

### Features

#### 1. Field Link Display (Linked Tasks)
When a task is already linked to a field:
- Shows the field link label or `model.fieldPath`
- Shows the record ID
- Provides "Unlink" button to remove the connection
- Explains bidirectional behavior

#### 2. Field Link Selector (Unlinked Tasks)
When a task is NOT linked:
- **Field Link Dropdown**: Shows all available TaskFieldLink records for the tenant
  - Displays label or `model.fieldPath` for each option
- **Record ID Input**: Allows specifying which record instance
  - Pre-fills with task's `relatedId` as placeholder
  - Quick-fill button if task has `relatedId` (e.g., PROJECT task → use project ID)
- **Link Button**: Creates the connection when both fields are filled

#### 3. Auto-Loading
- Field links load automatically when modal opens
- If task already has `meta.linkedField`, pre-populates the form

### Data Flow

#### Creating a Link
1. User selects a field link from dropdown (e.g., "Fire Door Blanks Ordered Date")
2. User enters or auto-fills record ID (e.g., project ID)
3. Clicks "Link Task to Field"
4. Updates task's `meta.linkedField`:
   ```json
   {
     "type": "fieldLink",
     "linkId": "clxxx123...",
     "recordId": "project-abc-123"
   }
   ```

#### Unlinking
1. User clicks "Unlink" button
2. Removes `meta.linkedField` from task
3. Clears local state

### Bidirectional Behavior

Once linked, the task and field update each other:

#### Field → Task
- When the linked field changes (e.g., date set)
- `completeTasksOnRecordChangeByLinks()` finds tasks by `linkId` + `recordId`
- Checks if field value meets `completionCondition` (NON_NULL, DATE_SET, EQUALS, etc.)
- Auto-completes matching tasks

#### Task → Field  
- When the task is marked complete
- `applyFieldLinkOnTaskComplete()` reads `linkId` from `meta.linkedField`
- Applies `onTaskComplete` action (SET_NOW, SET_VALUE, SET_TRUE, etc.)
- Updates the linked field

### Use Cases

#### Example 1: Automation Rule + Manual Linking
1. Automation rule creates task when project WON: "Order fire door blanks"
2. User opens task, navigates to Field Link section
3. Selects "Fire Door Blanks Ordered Date" field link
4. Uses project ID from task's relatedId
5. Links the task
6. **Result**: When field changes → task auto-completes; when task completes → field updates

#### Example 2: Manual Task + Field Tracking
1. User creates manual task: "Review material specs"
2. Opens task editor, scrolls to Field Link section
3. Selects appropriate field link from dropdown
4. Enters the opportunity/project record ID manually
5. Links the task
6. **Result**: Task now tracks field changes and updates field on completion

### Technical Details

#### API Endpoint
- **GET** `/automation/field-links`
  - Returns all TaskFieldLink records for tenant
  - Used to populate dropdown

#### State Management
```typescript
const [fieldLinks, setFieldLinks] = useState<Array<{ 
  id: string; 
  model: string; 
  fieldPath: string; 
  label?: string 
}>>([]);
const [selectedLinkId, setSelectedLinkId] = useState<string>("");
const [linkedRecordId, setLinkedRecordId] = useState<string>("");
```

#### Key Functions
- `linkToField()`: Updates task meta with linkedField structure
- `unlinkFromField()`: Removes linkedField from task meta
- Both use existing `update()` function to persist changes

### UI Styling
- **Emerald theme**: Matches field/data tracking semantics
- **Rounded cards**: Consistent with rest of TaskModal
- **Conditional rendering**: Only shows on existing tasks (not new tasks)
- **Helper text**: Explains bidirectional behavior

## Benefits

### Separation of Concerns
- **Automation Rules**: Create tasks on triggers (e.g., project WON)
- **Field Links**: Provide bidirectional field-task updates
- **Manual Linking**: Connect any task to any field after creation

### Flexibility
- Tasks created by automation can be linked to fields
- Tasks created manually can be linked to fields
- Tasks created by field links can still be manually linked to OTHER fields
- No restrictions on linking method

### User Control
- Users decide which tasks should track which fields
- Can link/unlink at any time
- Visual feedback shows connection status
- Quick-fill from task's related record ID

## Future Enhancements

Potential improvements:
- Multi-field linking (one task → multiple fields)
- Field link templates/presets
- Bulk linking for multiple tasks
- Field link suggestions based on task title/type
- Activity log showing when links created/removed
