# Unified Task System - Implementation Plan

## Overview
Transform the task system into a unified activity hub that integrates tasks, communications, follow-ups, scheduled tasks, and digital forms into a single cohesive system.

---

## Phase 1: Database Schema Changes

### Task Model Enhancements
```prisma
model Task {
  // Existing fields
  id                String    @id @default(cuid())
  tenantId          String
  title             String
  description       String?
  status            TaskStatus // OPEN, IN_PROGRESS, COMPLETED, CANCELLED
  priority          TaskPriority?
  dueAt             DateTime?
  completedAt       DateTime?
  
  // NEW: Task Type System
  taskType          TaskType @default(MANUAL) // MANUAL, COMMUNICATION, FOLLOW_UP, SCHEDULED, FORM, CHECKLIST
  
  // NEW: Communication Integration
  communicationType CommunicationType? // EMAIL, PHONE, MEETING, SMS
  communicationData Json? // Store email/call details
  emailMessageId    String? // Link to EmailMessage if applicable
  
  // NEW: Scheduled/Recurring Tasks
  isRecurring       Boolean @default(false)
  recurrencePattern RecurrencePattern? // DAILY, WEEKLY, MONTHLY, YEARLY, CUSTOM
  recurrenceData    Json? // { interval, dayOfWeek, dayOfMonth, monthOfYear, etc }
  templateId        String? // Link to TaskTemplate
  nextOccurrence    DateTime? // When to generate next task
  
  // NEW: Form/Checklist System
  formTemplateId    String? // Link to FormTemplate
  formData          Json? // Completed form fields
  formSignature     String? // Digital signature data
  formSignedAt      DateTime?
  formSignedBy      String? // User who signed
  
  // NEW: Auto-completion
  autoCompleted     Boolean @default(false) // True for logged communications
  
  // Relations
  template          TaskTemplate? @relation(fields: [templateId], references: [id])
  formTemplate      FormTemplate? @relation(fields: [formTemplateId], references: [id])
  emailMessage      EmailMessage? @relation(fields: [emailMessageId], references: [id])
}

enum TaskType {
  MANUAL          // User-created task
  COMMUNICATION   // Logged email/call/meeting
  FOLLOW_UP       // Follow-up reminder
  SCHEDULED       // Recurring scheduled task (insurance, etc)
  FORM            // Digital form to complete
  CHECKLIST       // Checklist to complete
}

enum CommunicationType {
  EMAIL
  PHONE
  MEETING
  SMS
  OTHER
}

enum RecurrencePattern {
  DAILY
  WEEKLY
  MONTHLY
  YEARLY
  CUSTOM
}

// NEW: Task Templates for recurring tasks
model TaskTemplate {
  id                String    @id @default(cuid())
  tenantId          String
  name              String // "Insurance Renewal", "Weekly Safety Meeting"
  description       String?
  taskType          TaskType
  priority          TaskPriority?
  
  // Recurrence settings
  isRecurring       Boolean @default(false)
  recurrencePattern RecurrencePattern?
  recurrenceData    Json? // Detailed recurrence config
  
  // Assignment
  assignToRole      String? // "admin", "workshop", etc
  assignToUserId    String? // Specific user
  
  // Form template link
  formTemplateId    String?
  
  // Generated tasks
  tasks             Task[]
  formTemplate      FormTemplate? @relation(fields: [formTemplateId], references: [id])
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

// NEW: Digital Form Templates
model FormTemplate {
  id                String    @id @default(cuid())
  tenantId          String
  name              String // "Forklift Checklist", "Toolbox Talk", "Meeting Agenda"
  description       String?
  category          String? // "SAFETY", "EQUIPMENT", "MEETING", "COMPLIANCE"
  
  // Form structure
  fields            Json // Array of field definitions
  // Example: [
  //   { type: "text", label: "Equipment ID", required: true },
  //   { type: "checkbox", label: "Brakes working", required: true },
  //   { type: "signature", label: "Inspector signature", required: true }
  // ]
  
  requiresSignature Boolean @default(false)
  
  // Relations
  taskTemplates     TaskTemplate[]
  tasks             Task[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

---

## Phase 2: Data Migration

### Migration Script: `migrate_communications_to_tasks.ts`
1. Convert existing `LeadInteraction` records to tasks
2. Convert `FollowUpLog` entries to tasks
3. Mark all historical communications as completed tasks
4. Preserve all data in `communicationData` JSON field
5. Create task links to existing email messages

### Migration Steps:
```typescript
// 1. LeadInteraction → Task (COMMUNICATION type)
// 2. FollowUpLog → Task (FOLLOW_UP type)
// 3. Link EmailMessage records to tasks
// 4. Set autoCompleted = true for historical data
// 5. Set completedAt to interaction timestamp
```

---

## Phase 3: Backend API Updates

### New Endpoints

#### Task Management
- `POST /tasks` - Create manual task
- `POST /tasks/log-communication` - Log email/call (auto-completes)
- `POST /tasks/schedule` - Create scheduled/recurring task
- `PATCH /tasks/:id/complete` - Complete task
- `PATCH /tasks/:id/form-submit` - Submit form data
- `GET /tasks` - List tasks (filtered by type, status, user)

#### Task Templates
- `GET /tasks/templates` - List all templates
- `POST /tasks/templates` - Create template
- `PATCH /tasks/templates/:id` - Update template
- `DELETE /tasks/templates/:id` - Delete template
- `POST /tasks/templates/:id/generate` - Manually generate task from template

#### Form Templates
- `GET /forms/templates` - List form templates
- `POST /forms/templates` - Create form template
- `PATCH /forms/templates/:id` - Update form template
- `DELETE /forms/templates/:id` - Delete form template

#### Recurring Task Processor
- Background job: `processRecurringTasks()` - Runs daily/hourly
- Checks `nextOccurrence` for all templates
- Generates new tasks when due
- Updates `nextOccurrence` based on recurrence pattern

---

## Phase 4: Frontend Components

### 1. Unified Task Center (`/tasks` page)
**Replace existing TasksDrawer with full-page experience**

Sections:
- **My Tasks** (assigned to me, not completed)
- **Today** (due today)
- **Upcoming** (next 7 days)
- **Completed** (historical record)
- **All Team Tasks** (if admin)

Filters:
- Task Type (Manual, Communication, Follow-up, Scheduled, Form)
- Status (Open, In Progress, Completed)
- Priority
- Date range
- Assigned user

### 2. Task Creation Modal
**Smart task creation based on type**

- Quick log: "Log a call" → Creates completed COMMUNICATION task
- Follow-up: "Schedule follow-up" → Creates FOLLOW_UP task
- Manual: "Add task" → Creates MANUAL task
- Form: "Complete checklist" → Opens form template picker

### 3. Form Builder (`/settings/forms`)
**Visual form builder for creating templates**

Features:
- Drag-drop field builder
- Field types: text, textarea, number, date, checkbox, radio, select, signature
- Mark fields as required
- Preview mode
- Save as template

### 4. Task Template Manager (`/settings/task-templates`)
**Configure recurring tasks**

Features:
- Create template
- Set recurrence pattern (visual picker)
- Assign to user/role
- Link to form template (optional)
- Enable/disable templates
- View generated tasks

### 5. LeadModal Integration
**Replace "Activities" tab with unified task view**

Shows all tasks related to lead:
- Communications (emails, calls)
- Follow-ups
- Manual tasks
- Forms completed

Actions:
- "Log call" → Creates completed COMMUNICATION task
- "Send email" → Creates COMMUNICATION task + sends email
- "Schedule follow-up" → Creates FOLLOW_UP task
- "Add task" → Creates MANUAL task

### 6. Email Integration
**Auto-create tasks from emails**

- Inbound email → Creates COMMUNICATION task (auto-completed)
- Outbound email → Creates COMMUNICATION task (auto-completed)
- Email with follow-up → Creates FOLLOW_UP task
- Stores email content in `communicationData`
- Links to `EmailMessage` record

---

## Phase 5: Business Logic

### Communication Logging
```typescript
async function logCommunication(data: {
  tenantId: string
  userId: string
  relatedType: 'LEAD' | 'OPPORTUNITY'
  relatedId: string
  communicationType: CommunicationType
  title: string
  description: string
  emailMessageId?: string
}) {
  return prisma.task.create({
    data: {
      ...data,
      taskType: 'COMMUNICATION',
      status: 'COMPLETED',
      completedAt: new Date(),
      autoCompleted: true,
      communicationData: {
        type: data.communicationType,
        timestamp: new Date(),
        content: data.description
      }
    }
  })
}
```

### Recurring Task Generator
```typescript
async function processRecurringTasks() {
  const templates = await prisma.taskTemplate.findMany({
    where: {
      isRecurring: true,
      nextOccurrence: { lte: new Date() }
    }
  })
  
  for (const template of templates) {
    // Generate task from template
    await createTaskFromTemplate(template)
    
    // Calculate next occurrence
    const next = calculateNextOccurrence(
      template.recurrencePattern,
      template.recurrenceData
    )
    
    // Update template
    await prisma.taskTemplate.update({
      where: { id: template.id },
      data: { nextOccurrence: next }
    })
  }
}
```

### Form Submission
```typescript
async function submitForm(taskId: string, formData: any, signature: string, userId: string) {
  return prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      formData,
      formSignature: signature,
      formSignedAt: new Date(),
      formSignedBy: userId
    }
  })
}
```

---

## Phase 6: Settings UI

### Task Templates Settings
Location: `/settings/task-templates`

Features:
- List all templates
- Create new template
- Edit template
- Enable/disable
- View history of generated tasks
- Manual trigger (generate task now)

### Form Templates Settings
Location: `/settings/forms`

Features:
- List all form templates
- Create/edit form builder interface
- Preview forms
- Duplicate templates
- View completed forms

---

## Implementation Order

### Week 1: Foundation
1. ✅ Update Prisma schema
2. ✅ Create migration script
3. ✅ Run migration on dev database
4. ✅ Test data integrity

### Week 2: Backend
5. ✅ Create new API endpoints
6. ✅ Implement recurring task processor
7. ✅ Add background job scheduler
8. ✅ Update email ingest to create tasks

### Week 3: Core UI
9. ✅ Build unified Task Center page
10. ✅ Create task creation modal (all types)
11. ✅ Update LeadModal to use tasks
12. ✅ Migrate TasksDrawer to new system

### Week 4: Advanced Features
13. ✅ Build form template builder
14. ✅ Build form completion UI
15. ✅ Digital signature component
16. ✅ Task template manager

### Week 5: Polish
17. ✅ Settings pages for templates
18. ✅ Dashboard widgets
19. ✅ Notifications
20. ✅ Testing & bug fixes

---

## Breaking Changes

### Removed/Deprecated:
- ❌ `LeadInteraction` model (migrated to Task)
- ❌ `FollowUpLog` model (migrated to Task)
- ❌ Separate "Activities" tab in LeadModal
- ❌ Old TasksDrawer component

### New/Changed:
- ✅ Task model expanded significantly
- ✅ New TaskTemplate and FormTemplate models
- ✅ Task types and statuses
- ✅ Unified task view in LeadModal
- ✅ Settings pages for templates

---

## Benefits

1. **Single Source of Truth**: All activities in one place
2. **Better Tracking**: Complete history of all interactions
3. **Automation**: Recurring tasks auto-generate
4. **Compliance**: Digital forms with signatures
5. **Simplicity**: One system instead of three separate ones
6. **Flexibility**: Template system allows customization
7. **Searchability**: All tasks searchable and filterable
8. **Reporting**: Easy to generate activity reports

---

## Risks & Mitigation

### Risk: Data Loss During Migration
**Mitigation**: 
- Backup database before migration
- Keep old tables temporarily
- Run migration on staging first
- Verify data integrity

### Risk: User Confusion
**Mitigation**:
- Clear UI labels and help text
- Training documentation
- Gradual rollout
- Keep interface familiar

### Risk: Performance Issues
**Mitigation**:
- Index taskType, status, assignedTo
- Paginate task lists
- Background job for recurring tasks
- Cache template data

---

## Success Metrics

- [ ] All historical communications migrated
- [ ] Zero data loss
- [ ] Task creation time < 2 seconds
- [ ] Form completion time < 30 seconds
- [ ] Recurring tasks generate on schedule
- [ ] User adoption > 80%
- [ ] Reduced time tracking activities

---

## Example Use Cases

### 1. Insurance Renewal
- Admin creates recurring task template
- Set to yearly on Jan 1st
- Assigned to finance user
- Task auto-generates each year
- User completes task when renewed

### 2. Daily Forklift Check
- Create form template with checklist
- Create recurring task (daily)
- Assigned to warehouse role
- User completes checklist
- Signs digitally
- Forms stored for compliance

### 3. Client Call
- User clicks "Log call" in lead
- Fills in notes
- Task created as completed
- Shows in activity timeline
- Searchable and reportable

### 4. Weekly Team Meeting
- Create form template (agenda)
- Create recurring task (weekly)
- Assigned to manager
- Manager fills agenda
- Team signs attendance
- Meeting notes stored

---

## Next Steps

1. Review and approve plan
2. Create feature branch
3. Start Phase 1: Schema updates
4. Build incrementally, testing each phase
5. Deploy to staging for testing
6. Production deployment with monitoring

