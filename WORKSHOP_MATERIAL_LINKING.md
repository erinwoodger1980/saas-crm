# Workshop Material Linking Feature

## Overview
Links workshop tasks to material orders (timber, glass, ironmongery, paint) to streamline material tracking and automate received date updates.

## User Workflows

### 1. Link a Task to Material Order
**From Tasks Tab:**
1. Navigate to Workshop → My Tasks
2. Find the task you want to link
3. Click "Link Material" button
4. Select material type (Timber/Glass/Ironmongery/Paint)
5. Select the project/opportunity
6. Click "Link Material"

**Result:** Task card shows "🔗 [material type]" indicator

### 2. Complete Task with Material Update
**When marking task as done:**
1. Click "Mark Done" on a linked task
2. Dialog appears: "Material Received?"
3. **Option A - Material Received:**
   - Confirm received date (defaults to today)
   - Add optional notes about delivery
   - Click "Yes, Mark Received"
   - ✅ Task marked complete AND material received date updated
   
4. **Option B - Not Yet Received:**
   - Click "No, Not Yet"
   - ✅ Only task marked complete, material stays pending

### 3. View Material-Task Links
**In Project Details Modal:**
- Open any project from workshop calendar/timeline
- Scroll to "Material Status" section
- Linked materials show "🔗 Linked to task" indicator

## Technical Implementation

### API Endpoints

#### Link Task to Material
```http
PATCH /tasks/:taskId/link-material
Content-Type: application/json

{
  "materialType": "timber" | "glass" | "ironmongery" | "paint",
  "opportunityId": "project-uuid"
}
```

**Response:**
```json
{
  "ok": true,
  "task": { ... }
}
```

#### Mark Material Received
```http
PATCH /materials/:opportunityId/received
Content-Type: application/json

{
  "materialType": "timber" | "glass" | "ironmongery" | "paint",
  "receivedDate": "2025-12-02",
  "notes": "Delivered by ABC Supply"
}
```

**Updates corresponding field:**
- `timber` → `timberReceivedAt`
- `glass` → `glassReceivedAt`
- `ironmongery` → `ironmongeryReceivedAt`
- `paint` → `paintReceivedAt`

#### Get Workshop Tasks
```http
GET /tasks/workshop?status=open,in_progress,done
```

**Response:**
```json
{
  "ok": true,
  "tasks": [
    {
      "id": "task-uuid",
      "title": "Order timber for Oak doors",
      "status": "OPEN",
      "priority": "HIGH",
      "dueAt": "2025-12-05T00:00:00Z",
      "relatedId": "project-uuid",
      "relatedType": "WORKSHOP",
      "meta": {
        "linkedMaterialType": "timber",
        "linkedOpportunityId": "project-uuid"
      }
    }
  ]
}
```

### Data Model

**Task.meta JSON structure:**
```typescript
{
  linkedMaterialType?: 'timber' | 'glass' | 'ironmongery' | 'paint';
  linkedOpportunityId?: string; // UUID of the project
}
```

**Opportunity material fields:**
```typescript
{
  timberOrderedAt?: Date;
  timberExpectedAt?: Date;
  timberReceivedAt?: Date;
  timberNotApplicable?: boolean;
  
  // Same pattern for glass, ironmongery, paint
  glassOrderedAt?: Date;
  // ...
}
```

## Components

### MaterialLinkDialog
**Purpose:** Link a task to a material order

**Props:**
- `taskId: string` - ID of task to link
- `taskTitle: string` - Display name
- `projects: Array<{id, name}>` - Available projects
- `onLink: (materialType, opportunityId) => Promise<void>`
- `onCancel: () => void`

**Features:**
- Material type dropdown (Timber/Glass/Ironmongery/Paint)
- Project selection dropdown
- Validation (both fields required)
- Loading state during API call

### MaterialReceivedDialog
**Purpose:** Prompt user if material has been received when completing linked task

**Props:**
- `taskTitle: string` - Display name
- `linkedMaterialType?: string` - Type of linked material
- `onConfirmReceived: (receivedDate, notes) => Promise<void>`
- `onSkip: () => void`

**Features:**
- Date picker (defaults to today)
- Optional notes textarea
- Two-button choice: "Yes, Mark Received" or "No, Not Yet"
- Shows different UI if task isn't linked to materials

## Benefits

1. **Automation:** Automatically updates material received dates when tasks completed
2. **Visibility:** Clear indicators showing which materials are linked to tasks
3. **Flexibility:** Can skip material update if not applicable
4. **Documentation:** Optional notes field for delivery information
5. **Tracking:** Easy to see material status from project details modal

## Future Enhancements (Optional)

- Auto-link tasks when creating material orders in production modal
- Bulk link multiple tasks to same material order
- Material order history/audit log
- Email notifications when linked materials are marked received
- Dashboard widget showing pending material deliveries
