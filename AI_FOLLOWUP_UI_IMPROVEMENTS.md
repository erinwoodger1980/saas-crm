# AI Follow-up UI Improvements - Complete ✅

## Summary
Improved the AI follow-up system based on user feedback to better display task types, show email context by default, and ensure emails are sent from the brand/sales team name rather than individual user names.

## Issues Addressed

### 1. ✅ Email Context Always Visible
**Problem**: Users couldn't see email conversation history without clicking to expand it  
**Solution**: Changed `showConversation` default from `false` to `true`

**Changes**:
- `web/src/components/follow-up/FollowUpTaskPanel.tsx`:
  - Line 65: `useState(true)` instead of `useState(false)`
  - Lines 299-318: Improved layout with border-top separator
  - Button text changed to "Email History" for clarity

**Impact**: Users immediately see email thread context when opening a follow-up task

---

### 2. ✅ Email Sender Shows Brand Name
**Problem**: Emails sent from follow-up tasks showed user's personal email name instead of brand/company name  
**Solution**: Updated email provider to support `fromName` field and fetch brand name from tenant settings

**Changes**:

**Backend - Email Provider** (`api/src/services/emailProvider.ts`):
- Added `fromName?: string` to `EmailMessage` interface
- **Gmail Provider**: Format `From` header as `"Brand Name" <email@example.com>` when fromName provided
- **MS365 Provider**: Set `message.from.emailAddress.name` field with brand name

**Backend - Send Email Endpoint** (`api/src/routes/tasks.ts`):
- Line 1493-1497: Fetch tenant settings to get `brandName`
- Line 1504: Pass `fromName: brandName` to email provider
- Defaults to "Sales Team" if brandName not configured

**Result**: 
```
Before: From: john.smith@company.com
After:  From: "Acme Joinery" <john.smith@company.com>
```

---

### 3. ✅ Better Task Type Display
**Problem**: All tasks showed generic "AI Follow-Up" label, making it hard to distinguish task purposes  
**Solution**: Display specific task types based on `taskType` and `trigger` metadata

**Changes** (`web/src/components/follow-up/FollowUpTaskPanel.tsx` lines 196-201):

```tsx
// Before
<Badge className="bg-indigo-600 text-white">
  <Sparkles className="h-3 w-3 mr-1" />
  AI Follow-Up
</Badge>

// After
<Badge className="bg-indigo-600 text-white">
  <Sparkles className="h-3 w-3 mr-1" />
  {task.taskType === 'FOLLOW_UP' ? 'Email Follow-up' : 
   meta.trigger === 'quote_sent' ? 'Quote Follow-up' :
   meta.trigger === 'lead_created' ? 'New Lead Response' :
   'AI Follow-Up'}
</Badge>
```

**Also added** (line 210-213):
- Shows trigger context: "Triggered by: Lead Created", "Triggered by: Quote Sent", etc.
- Text displayed in indigo color below task title

**Task Type Examples**:
- `taskType: 'FOLLOW_UP'` → "Email Follow-up"
- `trigger: 'quote_sent'` → "Quote Follow-up"
- `trigger: 'lead_created'` → "New Lead Response"
- Generic fallback → "AI Follow-Up"

---

### 4. ✅ Verified Modal Usage
**Finding**: Opportunities page (`web/src/app/opportunities/page.tsx`) dynamically imports LeadModal  
**Implementation**: Uses `dynamic()` with SSR disabled and fallback error UI  
**Status**: This is intentional - both leads and opportunities share the same modal component

---

## Technical Details

### Email Flow with Brand Name

1. **User clicks "Send" in FollowUpTaskPanel**
2. Frontend calls `POST /tasks/:id/send-email` with subject, body, to
3. Backend fetches tenant settings: `prisma.settings.findUnique({ where: { tenantId }})`
4. Gets `brandName` (e.g., "Acme Joinery") or defaults to "Sales Team"
5. Calls email provider with `fromName: brandName`
6. Gmail/MS365 formats email with brand name in From field
7. Recipient sees: **"Acme Joinery" <salesperson@company.com>** instead of just email address

### Task Type Detection Logic

Priority order for badge display:
1. Check `task.taskType === 'FOLLOW_UP'` → "Email Follow-up"
2. Check `meta.trigger === 'quote_sent'` → "Quote Follow-up"
3. Check `meta.trigger === 'lead_created'` → "New Lead Response"
4. Fallback → "AI Follow-Up"

Trigger display:
- Converts underscore to space: `lead_created` → `Lead Created`
- Title cases: `quote sent` → `Quote Sent`
- Shows in indigo text below main title

### Email Conversation Visibility

**Old behavior**:
- Conversation hidden by default
- User clicks "Show Email Thread" to expand
- Context not immediately visible

**New behavior**:
- Conversation visible by default on task open
- Shows full email history immediately
- User can click "Hide Email History" if needed
- Better context for follow-up decisions

---

## Files Modified

1. **web/src/components/follow-up/FollowUpTaskPanel.tsx**
   - Email conversation default state
   - Task type badge display logic
   - Trigger context display

2. **api/src/routes/tasks.ts**
   - Fetch tenant settings for brand name
   - Pass fromName to email provider

3. **api/src/services/emailProvider.ts**
   - Added fromName to EmailMessage interface
   - Gmail: Format From header with brand name
   - MS365: Set from.emailAddress.name field

---

## Benefits

✅ **Better Context**: Users see email history immediately without extra clicks  
✅ **Professional Branding**: Emails appear from company/brand, not individuals  
✅ **Clear Task Types**: Easy to distinguish quote follow-ups from new lead responses  
✅ **Improved UX**: Less cognitive load, clearer information hierarchy  

---

## Testing Checklist

- [x] TypeScript compilation passes
- [x] No new compile errors
- [ ] Test email sending shows brand name in From field
- [ ] Verify email conversation visible on task open
- [ ] Check task type badges display correctly
- [ ] Test with different trigger types (quote_sent, lead_created)
- [ ] Verify both Gmail and MS365 providers work

---

**Status**: ✅ Complete - Ready for testing  
**Related Docs**: 
- AI_FOLLOWUP_UI_CONSOLIDATION.md (tab consolidation)
- AI_FOLLOWUP_FRONTEND_COMPLETE.md (initial integration)
- AI_FOLLOW_UP_SYSTEM.md (backend architecture)
