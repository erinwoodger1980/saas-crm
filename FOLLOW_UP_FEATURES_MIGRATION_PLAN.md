# Follow-Up Features Migration Plan

## Status: Disabled - Requires Schema Updates

The following features were temporarily disabled to allow CI/deployment to pass. They need schema updates before re-enabling.

**Last CI Status Check:** November 27, 2025 - Files confirmed disabled, triggering new build to verify.

## Disabled Files

1. `api/src/routes/follow-up-rules.ts.disabled`
2. `api/src/services/conversationalFollowUp.ts.disabled`
3. `api/src/services/followUpTriggerEngine.ts.disabled`

## Required Schema Changes

### 1. FollowUpRule Model (✅ EXISTS - needs field update)

**Current schema** has these fields, but code expects:
- `emailBodyTemplate` field (code uses this, but schema has `contextTemplate`)

**Fix**: Add migration to add `emailBodyTemplate` field:
```prisma
model FollowUpRule {
  // ... existing fields
  emailBodyTemplate String?  @db.Text  // ADD THIS
  // ... rest
}
```

### 2. FollowUpHistory Model (✅ EXISTS - needs field update)

**Issue**: Code uses `ruleId` field in groupBy query, but field doesn't exist in schema.

**Fix**: Add `ruleId` field if needed, or update code to use different grouping strategy.

### 3. NotificationType Enum (❌ INCOMPLETE)

**Current enum:**
```prisma
enum NotificationType {
  TASK_ASSIGNED
  TASK_DUE_SOON
  TASK_OVERDUE
  MENTION
  STREAK
  SUMMARY
}
```

**Missing values needed by code:**
- `LEAD_SUGGESTION` (used in conversationalFollowUp.ts:71)
- `QUOTE_FOLLOWUP_SCHEDULED` (used in conversationalFollowUp.ts:163)
- `QUESTIONNAIRE_FOLLOWUP_SCHEDULED` (used in conversationalFollowUp.ts:240)
- `FOLLOW_UP_REPLY` (used in conversationalFollowUp.ts:370)

**Fix**: Add migration:
```prisma
enum NotificationType {
  TASK_ASSIGNED
  TASK_DUE_SOON
  TASK_OVERDUE
  MENTION
  STREAK
  SUMMARY
  LEAD_SUGGESTION                    // ADD
  QUOTE_FOLLOWUP_SCHEDULED          // ADD
  QUESTIONNAIRE_FOLLOWUP_SCHEDULED  // ADD
  FOLLOW_UP_REPLY                   // ADD
}
```

### 4. RelatedType Enum (❌ INCOMPLETE)

**Current enum:**
```prisma
enum RelatedType {
  LEAD
  PROJECT
  QUOTE
  EMAIL
  QUESTIONNAIRE
  WORKSHOP
  OTHER
}
```

**Missing value:**
- `OPPORTUNITY` (used in followUpTriggerEngine.ts:349, 413)

**Fix**: Add migration:
```prisma
enum RelatedType {
  LEAD
  PROJECT
  QUOTE
  EMAIL
  QUESTIONNAIRE
  WORKSHOP
  OPPORTUNITY  // ADD
  OTHER
}
```

### 5. TaskStatus Enum (❌ INCOMPLETE)

**Current enum:**
```prisma
enum TaskStatus {
  OPEN
  IN_PROGRESS
  BLOCKED
  DONE
  CANCELLED
}
```

**Issue**: Code uses `"COMPLETED"` which doesn't exist (should be `"DONE"`)

**Fix**: Update code to use `"DONE"` instead of `"COMPLETED"` in these files:
- `followUpTriggerEngine.ts:123, 203, 357`

### 6. Task Model - Missing Relations

**Issue**: Code tries to include `task.assignees.user` but the relation might not be properly defined.

**Current schema check needed**: Verify `TaskAssignee` model has proper `user` relation.

### 7. QuestionnaireResponse Model - Missing Fields

**Issues in followUpTriggerEngine.ts:**
- Tries to filter by `sentAt` field (line 87)
- Tries to include `lead` relation (line 93)
- References `q.sentAt` (lines 139-140)

**Fix**: Either:
- Add these fields to QuestionnaireResponse model, OR
- Update code to use existing fields

### 8. Quote Model - Missing Relations/Fields

**Issues:**
- Code expects `quote.lead` relation to be included
- Uses status values `"WON"` and `"LOST"` which may not exist in QuoteStatus enum

**Fix**: Verify QuoteStatus enum and update code accordingly.

### 9. Opportunity Model - Missing Field

**Issue**: Code references `opp.updatedAt` field (lines 324, 373-374)

**Fix**: Add `updatedAt` field to Opportunity model:
```prisma
model Opportunity {
  // ... existing fields
  updatedAt  DateTime @updatedAt  // ADD
  // ... rest
}
```

## Migration Steps

### Phase 1: Schema Updates (Prisma Migration)

1. Create new migration file:
```bash
cd api
pnpm prisma migrate dev --name add_follow_up_feature_fields
```

2. Add the following to migration SQL:
```sql
-- Add missing enum values
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEAD_SUGGESTION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'QUOTE_FOLLOWUP_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'QUESTIONNAIRE_FOLLOWUP_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FOLLOW_UP_REPLY';

ALTER TYPE "RelatedType" ADD VALUE IF NOT EXISTS 'OPPORTUNITY';

-- Add missing fields
ALTER TABLE "FollowUpRule" ADD COLUMN IF NOT EXISTS "emailBodyTemplate" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add field to QuestionnaireResponse if needed
ALTER TABLE "QuestionnaireResponse" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
```

3. Update `schema.prisma` with the new enums and fields

### Phase 2: Code Fixes

1. Fix `followUpTriggerEngine.ts`:
   - Replace all `"COMPLETED"` with `"DONE"`
   - Update QuestionnaireResponse queries to match actual schema
   - Update Quote queries to match actual schema
   - Add proper error handling for missing relations

2. Fix `conversationalFollowUp.ts`:
   - Verify all notification types are now valid
   - Update task assignee includes to match schema

3. Fix `follow-up-rules.ts`:
   - Update FollowUpHistory groupBy to use valid field or different approach
   - Handle null checks properly

### Phase 3: Testing

1. Run TypeScript build: `cd api && pnpm run build`
2. Run tests if available
3. Test API endpoints manually:
   - GET `/follow-up-rules`
   - POST `/follow-up-rules`
   - Test trigger engine functions

### Phase 4: Re-enable

1. Rename files:
```bash
cd api/src
mv routes/follow-up-rules.ts.disabled routes/follow-up-rules.ts
mv services/conversationalFollowUp.ts.disabled services/conversationalFollowUp.ts
mv services/followUpTriggerEngine.ts.disabled services/followUpTriggerEngine.ts
```

2. Uncomment imports/routes in `api/src/server.ts`

3. Push and verify CI passes

## Estimated Effort

- Schema migration: 1-2 hours
- Code fixes: 2-3 hours
- Testing: 1 hour
- **Total: 4-6 hours**

## Alternative: Simplify Features

If full migration is too complex, consider:
1. Remove advanced features that don't match current schema
2. Focus on core follow-up functionality that works with existing Task/Notification models
3. Build new simpler implementation that matches current schema

## Notes

- The features were likely written for an earlier version of the schema
- Many assumptions about model relations don't match current schema
- Consider whether full restoration is needed vs. building new simplified version
