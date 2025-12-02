# Automatic Task Creation on Import

## Problem
When importing leads/opportunities with date fields (like delivery dates), automation rules weren't being triggered. Users had to manually edit each record to trigger the automation rules and create scheduled tasks.

## Solution
Modified the lead import process to automatically evaluate automation rules after creating opportunities, ensuring that any scheduled tasks (like material ordering) are created immediately upon import.

## Changes Made

### 1. Updated `/api/src/routes/leads.ts`

#### Added Import
```typescript
import { evaluateAutomationRules } from "./automation-rules";
```

#### Modified Opportunity Creation During Import
- Previously: Opportunity was created but automation rules were not evaluated
- Now: After creating opportunity, automation rules are triggered for all date fields

**What happens now:**
1. CSV row is imported and opportunity is created with fields:
   - `startDate`
   - `deliveryDate`
   - `installationStartDate`
   - `installationEndDate`

2. Automation rules are evaluated with these fields marked as "changed"

3. Any automation rules with triggers like:
   - "When deliveryDate is updated on OPPORTUNITY"
   - "When installationStartDate is set on OPPORTUNITY"
   
   Will immediately create their scheduled tasks

4. Tasks are created with due dates calculated relative to the imported date fields

## How It Works

### Automation Rule Example
```json
{
  "name": "Order Paint Before Delivery",
  "trigger": {
    "type": "FIELD_UPDATED",
    "entityType": "OPPORTUNITY",
    "fieldName": "deliveryDate"
  },
  "actions": [{
    "type": "CREATE_TASK",
    "taskTitle": "Order Paint",
    "dueAtCalculation": {
      "type": "RELATIVE_TO_FIELD",
      "fieldName": "deliveryDate",
      "offsetDays": -20
    },
    "rescheduleOnTriggerChange": true,
    "taskInstanceKey": "order_paint_{opportunityId}"
  }]
}
```

### Import Behavior

#### Before Fix
1. User imports CSV with opportunity that has `deliveryDate = 2025-01-15`
2. Opportunity is created with deliveryDate
3. ❌ No tasks are created
4. User has to manually edit the deliveryDate field (even to the same value)
5. ✅ Task "Order Paint" is created with due date 2024-12-26

#### After Fix
1. User imports CSV with opportunity that has `deliveryDate = 2025-01-15`
2. Opportunity is created with deliveryDate
3. ✅ Automation rules evaluate immediately
4. ✅ Task "Order Paint" is created with due date 2024-12-26
5. No manual intervention needed!

## Technical Details

### Fields Tracked for Automation
During import, the following fields are marked as "changed" and trigger automation:
- `startDate` - Project start date
- `deliveryDate` - When materials/products should be delivered
- `installationStartDate` - When installation begins on-site
- `installationEndDate` - When installation is complete

### Automation Evaluation
```typescript
await evaluateAutomationRules({
  tenantId,
  entityType: 'OPPORTUNITY',
  entityId: opportunity.id,
  entity: opportunity,
  changedFields: ['deliveryDate', 'installationStartDate', ...],
  userId,
});
```

This function:
1. Fetches all enabled automation rules for the tenant
2. Filters rules matching `OPPORTUNITY` entity type
3. Checks if trigger matches any of the changed fields
4. Evaluates any conditions on the rule
5. Executes actions (creates tasks with calculated due dates)
6. Prevents duplicate tasks using `taskInstanceKey`
7. Supports rescheduling if dates change later

### Task Instance Keys
Each automated task has a unique instance key to prevent duplicates:
- Format: `auto_OPPORTUNITY_{opportunityId}_{taskTitle}`
- Or custom: `order_paint_{opportunityId}`, `order_timber_{opportunityId}`

If the same task already exists (and isn't cancelled), it won't be recreated. If `rescheduleOnTriggerChange: true`, updating the trigger field will reschedule the existing task instead of creating a new one.

## Example Use Cases

### Material Ordering Tasks
Import CSV with columns:
- MJS Number: `MJS-12345`
- Delivery Date: `15/01/2025`
- Installation Date: `20/01/2025`

Automation rules create:
- "Order Timber" task due 25 days before delivery (21/12/2024)
- "Order Glass" task due 20 days before delivery (26/12/2024)
- "Order Paint" task due 20 days before delivery (26/12/2024)
- "Schedule Pre-Installation Meeting" due 3 days before install (17/01/2025)

### Workshop Production Tasks
Import CSV with columns:
- Job Name: `Sash Windows - 123 Main St`
- Start Date: `10/01/2025`
- Delivery Date: `25/01/2025`

Automation rules create:
- "Prepare Workshop Schedule" due 14 days before start (27/12/2024)
- "Quality Check" due 1 day before delivery (24/01/2025)
- "Arrange Transport" due 2 days before delivery (23/01/2025)

## Benefits

### For Users
- ✅ Import once, tasks created automatically
- ✅ No need to "refresh" dates by editing them
- ✅ Faster onboarding with bulk data import
- ✅ Consistent task creation across all imports

### For Workflow
- ✅ Material ordering reminders set immediately
- ✅ Production deadlines tracked from day one
- ✅ No missed tasks due to forgotten manual trigger
- ✅ Bulk import becomes truly "set and forget"

## Error Handling

If automation evaluation fails during import:
- ❌ Automation error is logged
- ✅ Import continues successfully
- ✅ Lead/opportunity is still created
- ✅ Other rows in CSV are not affected

This ensures that import robustness is maintained even if automation has issues.

## Testing Checklist

- [ ] Import CSV with deliveryDate - verify "Order Materials" tasks created
- [ ] Import CSV with multiple date fields - verify all relevant tasks created
- [ ] Import same opportunity twice - verify tasks not duplicated (instance key works)
- [ ] Update deliveryDate after import - verify task is rescheduled (not duplicated)
- [ ] Import with automation rule disabled - verify no tasks created
- [ ] Import with no matching automation rules - verify import succeeds without errors
- [ ] Import with invalid date formats - verify error handling works correctly

## Future Enhancements

### Potential Improvements
- [ ] Add import preview showing which tasks will be created
- [ ] Allow users to disable automation during import (skip automation)
- [ ] Batch automation evaluation for better performance on large imports
- [ ] Show task creation count in import results
- [ ] Log which automation rules were triggered per import

### Status Field Support
Currently focuses on date field triggers. Could be extended to support:
- Status change triggers during import
- Record creation triggers
- Custom field update triggers
- Conditional logic based on imported values

## Related Files

- `/api/src/routes/leads.ts` - Lead import with automation trigger
- `/api/src/routes/automation-rules.ts` - Automation evaluation logic
- `/api/src/routes/opportunities.ts` - Opportunity PATCH already has automation
- `/web/src/app/leads/page.tsx` - Lead import UI (unchanged)

## Migration Notes

No database migration required - this is a behavior change in existing endpoints.

Existing automation rules will automatically work with imports after this update.

Users who have been manually "refreshing" date fields after import can now skip that step.
