# AI-Powered Follow-up System - Implementation Summary

## ✅ What's Been Built

### 1. Database Schema (Prisma)

Added three new models to track AI-powered follow-ups:

#### **FollowUpRule**
Defines automated triggers for creating follow-up tasks:
- Supports triggers: questionnaire_sent, quote_sent, lead_created, opportunity_stalled
- Configurable delay (days before follow-up)
- Custom task title and email subject templates
- Priority and auto-schedule settings
- Active/inactive toggle per rule

#### **FollowUpHistory**
Tracks sent emails and learning data:
- AI-generated vs final email (subject + body)
- Recipient email and timestamps
- Response tracking (responded, response time, converted)
- Edit tracking (did user edit AI draft, how much changed)
- Linked to task and user for analytics

#### **EmailConversation**
Stores complete email threads per task:
- Message ID and thread ID for reply matching
- From/to addresses
- Subject and body (text + HTML)
- Direction (SENT or RECEIVED)
- Timestamp and reply chain (inReplyTo, references)

### 2. Email Provider Abstraction (`emailProvider.ts`)

Unified interface for Gmail and MS365:

```typescript
interface EmailProvider {
  send(message: EmailMessage): Promise<SentEmailResult>;
  fetchReplies(threadId: string): Promise<any[]>;
}
```

**Features:**
- Auto-detects which provider user has connected (prefers Gmail)
- Handles RFC822 formatting for Gmail
- Handles Graph API formatting for MS365
- Returns messageId and threadId for tracking
- Supports CC, BCC, HTML bodies, reply threading

**Enhanced Functions:**
- `getEmailProviderForUser(userId)` - Get provider instance
- `enhancedSendViaUserGmail()` - Send + get messageId/threadId
- `enhancedSendViaUserMs365()` - Send + get messageId/conversationId

### 3. AI Email Draft Generation (`aiEmailDrafter.ts`)

Uses OpenAI GPT-4o to generate contextual follow-up emails:

**Supported Purposes:**
- `follow_up_quote` - Quote sent but no response
- `follow_up_questionnaire` - Questionnaire sent but not completed
- `initial_contact` - First contact after lead created
- `check_in` - Project gone quiet
- `custom` - User-defined context

**Context Parameters:**
```typescript
{
  recipientName?: string;
  recipientEmail: string;
  companyName?: string;
  daysSince?: number;
  quoteValue?: number;
  quoteSentDate?: string;
  questionnaireSentDate?: string;
  previousInteraction?: string;
  purpose: "follow_up_quote" | ...;
  tone?: "professional" | "friendly" | "formal";
  customContext?: string;
}
```

**Output:**
```typescript
{
  subject: string;        // Engaging, specific subject line
  body: string;           // 2-3 paragraph email with clear CTA
  confidence: number;     // AI confidence (0-1)
  reasoning?: string;     // Explanation of approach
}
```

**Learning Features:**
- `recordUserEdits()` - Tracks how users modify AI drafts
- `analyzeUserStyle()` - Learns user's email style from past sends
- Stores edit distance for ML improvement

### 4. Follow-up Trigger Engine (`followUpTriggerEngine.ts`)

Automated background scanner that creates follow-up tasks:

**How It Works:**
1. Runs every 30 minutes (configurable)
2. For each tenant, checks active FollowUpRules
3. Scans database for trigger conditions
4. Creates FOLLOW_UP tasks with AI-generated email draft

**Trigger Checks:**

**Questionnaire Sent:**
- Finds questionnaires sent N days ago
- Not completed yet
- Has valid lead email
- Creates task with context about questionnaire

**Quote Sent:**
- Finds quotes sent N days ago
- Status not WON or LOST
- Has valid lead email
- Supports multiple follow-ups (3-day, 7-day rules)
- Creates task with quote value and context

**Lead Created:**
- Finds leads created N days ago
- Still in NEW status
- Has valid email
- Creates initial contact task

**Opportunity Stalled:**
- Finds opportunities with no activity in N days
- Not WON or LOST
- Has valid lead email
- Creates check-in task

**Task Creation:**
Each task includes:
- Title (with name substitution)
- AI-generated email draft in `meta.aiDraft`
- Recipient email and name in meta
- Trigger metadata for tracking
- Due date (immediate for review)
- Auto-created flag (based on rule settings)

### 5. Default Follow-up Rules

Five pre-configured rules auto-created for new tenants:

| Trigger | Delay | Priority | Auto-Schedule | Purpose |
|---------|-------|----------|---------------|---------|
| questionnaire_sent | 3 days | MEDIUM | Yes | Gentle reminder |
| quote_sent | 3 days | HIGH | Yes | Initial follow-up |
| quote_sent | 7 days | HIGH | Yes | Second follow-up |
| lead_created | 1 day | HIGH | Yes | Welcome email |
| opportunity_stalled | 7 days | MEDIUM | No | Check-in (user approval) |

### 6. API Endpoints (Tasks Route)

#### `POST /tasks/:id/generate-draft`
Generate AI email draft for a task:

**Request:**
```json
{
  "recipientEmail": "customer@example.com",
  "recipientName": "John Smith",
  "purpose": "follow_up_quote",
  "tone": "professional",
  "context": "Custom context..."
}
```

**Response:**
```json
{
  "ok": true,
  "draft": {
    "subject": "Following up on your bespoke joinery quote",
    "body": "Hi John,\n\nI wanted to follow up...",
    "confidence": 0.87
  }
}
```

Updates task.meta with `aiDraft` field.

#### `POST /tasks/:id/send-email`
Send email from task using user's connected provider:

**Request:**
```json
{
  "subject": "Following up on your quote",
  "body": "Hi John,\n\n...",
  "to": "customer@example.com",
  "cc": "sales@company.com",  // optional
  "bcc": "archive@company.com"  // optional
}
```

**What It Does:**
1. Gets user's email provider (Gmail or MS365)
2. Sends email via their account
3. Records in FollowUpHistory (tracks AI draft vs final)
4. Creates EmailConversation record
5. Updates task status to IN_PROGRESS
6. Stores messageId for reply tracking

**Response:**
```json
{
  "ok": true,
  "messageId": "1894abc..."
}
```

#### `GET /tasks/:id/conversation`
Get full email conversation for a task:

**Response:**
```json
{
  "ok": true,
  "conversation": [
    {
      "id": "abc123",
      "messageId": "...",
      "direction": "SENT",
      "fromAddress": "you@company.com",
      "toAddress": "customer@example.com",
      "subject": "Following up on your quote",
      "body": "Hi John...",
      "timestamp": "2025-11-27T10:30:00Z"
    },
    {
      "direction": "RECEIVED",
      // ...reply details
    }
  ]
}
```

### 7. Server Integration

Added to `server.ts`:

```typescript
import { scanForFollowUpTriggers } from "./services/followUpTriggerEngine";

function startFollowUpEngine() {
  // Run immediately on startup
  scanForFollowUpTriggers().catch(...);
  
  // Then every 30 minutes
  setInterval(() => {
    scanForFollowUpTriggers().catch(...);
  }, 30 * 60 * 1000);
}

startFollowUpEngine();
```

## 🔄 Complete User Flow

### Automatic Flow (Background)

1. **Trigger Event** - Quote sent, questionnaire sent, lead created, etc.
2. **Scanner Detects** (30min intervals) - Follow-up trigger engine finds eligible events
3. **AI Generates Draft** - OpenAI creates contextual email based on situation
4. **Task Created** - FOLLOW_UP task appears with AI draft ready
5. **User Notification** - Task shows in TaskCenter with priority

### Manual Flow (User Action)

1. **User Opens Task** - Sees AI-drafted email with subject and body
2. **Review/Edit** - User can accept as-is or modify (edits tracked)
3. **Send Email** - Click "Send" → email goes from user's Gmail/M365
4. **Tracking Starts** - MessageId stored, awaiting reply
5. **Reply Received** (future) - Auto-detected, shown in conversation
6. **Task Updates** - Status changes based on reply (positive/negative/question)

## 📊 Learning & Analytics

The system learns from:

1. **User Edits** - What changes users make to AI drafts
2. **Response Rates** - Which emails get replies
3. **Response Time** - How quickly customers reply
4. **Conversion** - Which follow-ups lead to sales
5. **User Style** - Email length, tone, punctuation preferences

This data feeds back into AI draft generation for continuous improvement.

## 🛠️ Next Steps

### Phase 1: Reply Ingestion (In Progress)
- Gmail webhook setup (Pub/Sub)
- MS365 webhook setup (Graph API notifications)
- Reply matching by messageId/threadId
- Auto-update task status based on reply sentiment
- Suggested next actions from AI

### Phase 2: UI Implementation
- Task details view with AI draft display
- Edit/approve workflow
- Email conversation thread UI
- Send button with confirmation
- Status indicators (sent, awaiting reply, replied)

### Phase 3: Settings & Configuration
- Follow-up rules editor
- Enable/disable specific triggers
- Adjust delays and priorities
- Email account management UI
- Analytics dashboard

### Phase 4: Advanced Features
- A/B testing different email styles
- Optimal send time recommendations
- Auto-scheduling phone calls (not just emails)
- Lead scoring based on engagement
- ML model for predicting conversion

## 📁 Files Created/Modified

### New Files:
- `api/src/services/emailProvider.ts` - Unified email abstraction
- `api/src/services/aiEmailDrafter.ts` - AI draft generation
- `api/src/services/followUpTriggerEngine.ts` - Automated scanner
- `AI_FOLLOW_UP_SYSTEM.md` - This summary document

### Modified Files:
- `api/prisma/schema.prisma` - Added 3 new models + relations
- `api/src/routes/tasks.ts` - Added 3 new endpoints
- `api/src/server.ts` - Added trigger engine startup
- `api/src/services/user-email.ts` - Already had Gmail/M365 functions
- `api/src/routes/gmail.ts` - Already had OAuth and send
- `api/src/routes/ms365.ts` - Already had OAuth and send

## 🧪 Testing

### Manual Testing Steps:

1. **Create Default Rules:**
```typescript
import { initializeDefaultRules } from "./services/followUpTriggerEngine";
await initializeDefaultRules("your-tenant-id");
```

2. **Create Test Quote:**
- Create a quote 4 days ago
- Set status to DRAFT (not WON/LOST)
- Ensure lead has valid email
- Wait for next scan (or trigger manually)

3. **Verify Task Created:**
- Check TaskCenter for new FOLLOW_UP task
- Verify meta.aiDraft contains subject and body
- Verify meta.recipientEmail is set

4. **Test Email Sending:**
- Connect Gmail or MS365 in settings
- Open follow-up task
- Call POST /tasks/:id/send-email
- Check FollowUpHistory for record
- Verify email sent from your account

## 🔐 Security Considerations

- All emails sent from user's own Gmail/MS365 account (not spoofed)
- Refresh tokens stored securely in database
- User must explicitly approve each email send
- AI drafts are suggestions only, never sent without review
- Message IDs tracked for reply attribution
- All operations scoped to tenant for isolation

## 🚀 Deployment

Already deployed to development:
- Database tables created (via Prisma)
- Prisma client regenerated
- API server restarted with new code
- Trigger engine running every 30 minutes
- Ready for testing with real data

## 💡 Key Benefits

1. **Never Miss a Follow-up** - Automated scanning ensures nothing falls through cracks
2. **AI-Powered Emails** - Contextual, professional drafts save time
3. **Learns Over Time** - Gets better as it learns your style and what works
4. **Multi-Provider** - Works with Gmail or MS365, whichever user prefers
5. **Full Tracking** - Complete email history per lead/opportunity
6. **Tenant-Isolated** - Each business has own rules and learning data
7. **Developer-Friendly** - Well-structured, documented, extensible code

## 📞 Support

For questions or issues:
1. Check logs: `tail -f /tmp/api.log`
2. Check trigger engine: Look for `[followUpTriggerEngine]` logs
3. Check Prisma queries: Enable `prisma:query` logs
4. Test AI drafts: Call `/tasks/:id/generate-draft` directly
5. Verify email provider: Check user has Gmail or MS365 connected

---

**Built with:** TypeScript, Prisma, OpenAI GPT-4o, Gmail API, Microsoft Graph API
**Status:** ✅ Core system complete, ready for UI integration and reply ingestion
