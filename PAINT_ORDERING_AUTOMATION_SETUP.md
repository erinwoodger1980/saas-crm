# Paint Ordering Automation Setup Guide

## Overview
This guide shows you how to set up automatic task creation for paint ordering that's fully integrated with material tracking.

## Step 1: Create Field Link (Do This First!)

1. Go to **Settings → Automation**
2. Scroll to **"Field ↔ Task Links"** section
3. Click **"+ New Link"**
4. Configure:
   - **Model**: Opportunity
   - **Field Path**: `paintOrderedAt`
   - **Label**: "Paint Ordered" (optional friendly name)
   
5. **Task Completion Condition** (when does the field mark task complete):
   - **Condition**: "Field is a date" (or "Field is set")
   - This means: When `paintOrderedAt` has a date, the task is automatically marked complete

6. **Field Update Action** (what happens when task is completed):
   - **Action**: "Set to current date"
   - This means: When user marks task complete, `paintOrderedAt` gets set to today

7. Click **"Create Link"**

## Step 2: Create Automation Rule

1. Still in **Settings → Automation**
2. In **"Automation Rules"** section, click **"+ New Rule"**
3. Configure:

### Basic Info
- **Rule Name**: "Create Paint Order Task"
- **Enabled**: ✅ Check this box

### Trigger Section
- **Entity Type**: Opportunity
- **Trigger Type**: Field Updated
- **Field Name**: deliveryDate

### Action Section
- **Task Title**: "Order Paint"
- **Task Type**: Manual Task (or whichever type you prefer)
- **Description**: "Order paint for this project before delivery date"
- **Priority**: Medium (or High if urgent)
- **Assign To**: [Select the employee who orders paint]

### Due Date Calculation
- **Calculate From**: deliveryDate
- **Offset (days)**: -20 (means 20 days BEFORE delivery)
- **Auto-reschedule if date changes**: ✅ Check this

### Link Task to Field
- **Field Link**: Select "Paint Ordered" (the link you created in Step 1)

4. Click **"Save Rule"**

## How It Works

### When Delivery Date is Set:
1. System creates "Order Paint" task
2. Task is assigned to chosen employee
3. Due date is automatically 20 days before delivery
4. Task is linked to `paintOrderedAt` field

### When Employee Completes Task:
1. Employee marks task as "Done"
2. System automatically sets `paintOrderedAt` to today's date
3. Employee can then fill in:
   - **Expected Date** (`paintExpectedAt`)
   - **Received Date** (`paintReceivedAt`)

### When Paint Ordered Date is Filled In:
1. If someone enters a date in `paintOrderedAt` field (in Lead/Opportunity)
2. Task is automatically marked complete
3. Works both ways!

### If Delivery Date Changes:
- Because "Auto-reschedule" is enabled
- Task due date automatically updates
- Stays 20 days before new delivery date

## Where to View/Edit Material Dates

### Option 1: In Lead Modal
1. Open a Lead/Opportunity
2. Go to **"Project"** tab
3. Scroll to **"Materials"** section
4. You'll see:
   - Paint Ordered: [date field]
   - Paint Expected: [date field]
   - Paint Received: [date field]

### Option 2: In Workshop View
1. Go to **Workshop** page
2. Find the project
3. Material status shows in project cards

### Option 3: In Tasks View
1. Workshop user sees "Order Paint" in their task list
2. When they complete it, can link to material
3. Mark when material received

## Example Timeline

**Day 1**: Sales person wins deal, sets delivery date to March 15
- ✅ System creates "Order Paint" task due Feb 23 (20 days before)
- ✅ Task assigned to workshop manager

**Day 5** (Feb 23): Workshop manager sees task
- ✅ Opens task, marks complete
- ✅ System sets `paintOrderedAt` to Feb 23
- ✅ Manager fills in `paintExpectedAt` = March 1

**Day 12** (March 1): Paint arrives
- ✅ Manager updates `paintReceivedAt` to March 1
- ✅ Paint is ready for manufacturing

## Customization Options

### Change Who Gets the Task
Edit automation rule → Change **"Assign To"** dropdown

### Change How Many Days Before
Edit automation rule → Change **"Offset (days)"** (negative = before, positive = after)

### Add More Material Types
Repeat Steps 1-2 for:
- Timber: `timberOrderedAt`, `timberExpectedAt`, `timberReceivedAt`
- Glass: `glassOrderedAt`, `glassExpectedAt`, `glassReceivedAt`
- Ironmongery: `ironmongeryOrderedAt`, `ironmongeryExpectedAt`, `ironmongeryReceivedAt`

### Multiple Tasks from Same Trigger
You can create multiple rules triggered by `deliveryDate`:
- One for timber (due -25 days)
- One for glass (due -22 days)
- One for paint (due -20 days)
- One for ironmongery (due -18 days)

## Testing the Setup

1. Create a test opportunity
2. Set a delivery date
3. Check that task appears in assigned user's task list
4. Mark task complete
5. Verify `paintOrderedAt` is filled in automatically
6. Try changing delivery date - task due date should update

## Troubleshooting

**Task not created?**
- Check automation rule is enabled
- Verify deliveryDate field was actually updated
- Check browser console for errors

**Task created but not linked?**
- Make sure you selected the field link in automation rule setup
- Verify field link exists and is configured correctly

**Completing task doesn't update field?**
- Check field link action is set to "Set to current date"
- Verify field path matches exactly: `paintOrderedAt`

**Updating field doesn't complete task?**
- Check field link condition is "Field is a date" or "Field is set"
- Make sure you're updating the correct field (`paintOrderedAt`)

## Benefits

✅ **No manual task creation** - Happens automatically when delivery date set
✅ **No forgetting** - Task appears with proper due date
✅ **Two-way sync** - Update either place, both stay in sync
✅ **Audit trail** - See exactly when materials ordered/received
✅ **Rescheduling** - Tasks update if delivery date changes
✅ **Workshop visibility** - Tasks appear in workshop user's list
✅ **Notifications** - User gets notified when task assigned (if notifications enabled)
