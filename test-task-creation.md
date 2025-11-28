# Task Creation Testing Checklist

## Test Date: 28 November 2025

### ✅ Setup
- [x] Favicon added to resolve 404
- [x] Dev server running on http://localhost:3000
- [x] Code compiles without errors

### 🧪 Test Scenarios

#### 1. Task Creation from Lead Context
**Test Steps:**
1. Navigate to Leads page
2. Open a lead modal
3. Look for TaskCenter embedded view
4. Click "New" button in the embedded toolbar
5. Create a task (any type)
6. Verify:
   - Task is automatically related to the lead (relatedType: LEAD, relatedId: <leadId>)
   - Task appears in "My Tasks" immediately
   - Task is assigned to current user (OWNER role)

**Expected Result:**
- New task shows in the lead's task list
- Task shows in global "My Tasks" filter
- No need to manually set context or assignee

#### 2. Form Task with Signature
**Test Steps:**
1. Click "New" → Select "Form"
2. Set title: "Site Safety Inspection"
3. Add fields:
   - Field 1: "Inspector Name" (text)
   - Field 2: "Safety Rating" (select: Excellent, Good, Fair, Poor)
   - Field 3: "Notes" (textarea)
4. Check "Require signature" checkbox
5. Set optional due date
6. Click "Create Form Task"
7. Open the created task in TaskModal
8. Verify:
   - Form editor shows all fields
   - "Requires signature" badge or indicator visible
   - Can submit form data

**Expected Result:**
- Task created with taskType: FORM
- requiresSignature: true in task data
- Form fields editable in modal

#### 3. Scheduled Form (Recurring)
**Test Steps:**
1. Click "New" → Select "Form"
2. Set title: "Weekly Equipment Check"
3. Add fields:
   - Field 1: "Equipment ID" (text)
   - Field 2: "Condition" (select: Good, Needs Repair, Critical)
4. Check "Schedule this form" checkbox
5. Set recurrence:
   - Pattern: WEEKLY
   - Interval: 1
   - Start: (set to next Monday at 9:00 AM)
6. Check "Require signature"
7. Click "Create Scheduled Form"
8. Verify:
   - Task created with taskType: SCHEDULED
   - recurrencePattern: WEEKLY
   - recurrenceInterval: 1
   - formSchema with fields present
   - requiresSignature: true

**Expected Result:**
- Scheduled form task created
- Shows recurrence info in TaskCenter card
- Form fields available when opened
- Signature requirement visible

#### 4. Desktop Toolbar Position
**Test Steps:**
1. Navigate to standalone Task Center page
2. Verify toolbar layout:
   - Search input on left
   - "My Tasks" / "All Tasks" filter button
   - "Expand All" button
   - "New" button on right
3. All buttons should be in a single horizontal toolbar above task list

**Expected Result:**
- Toolbar is clean and consolidated
- "New" button is adjacent to filters, not in page header
- Mobile view: embedded toolbar in lead modal works same way

#### 5. Related Context Propagation
**Test Steps:**
1. From a lead modal, create each task type:
   - Basic Task (MANUAL)
   - Communication
   - Follow-up
   - Checklist
   - Form
   - Scheduled
2. Check the API payload (browser dev tools → Network tab)
3. Verify each includes:
   ```json
   {
     "relatedType": "LEAD",
     "relatedId": "<actual-lead-id>",
     "assignees": [{ "userId": "<current-user-id>", "role": "OWNER" }]
   }
   ```

**Expected Result:**
- All task types carry forward the context
- All tasks auto-assigned to creator
- Tasks visible in both global list and lead-specific view

### 📊 Results Summary
- [ ] All tests passing
- [ ] Ready to commit and push

### 🐛 Issues Found
(Document any issues here)

### ✨ Enhancements Noted
(Document any UX improvements needed)
