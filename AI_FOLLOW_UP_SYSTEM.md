# AI-Powered Follow-up System Implementation Plan

## Overview
Automated, intelligent email follow-up system that learns from user behavior and outcomes to optimize communication timing, content, and cadence.

## System Components

### 1. Follow-up Trigger Engine
**Location**: `api/src/services/followupEngine.ts`

**Triggers**:
- **Questionnaire Sent** → 3 days no completion → "Gentle reminder about questionnaire"
- **Quote Sent** → 3 days no response → "Following up on your quote"
- **Quote Sent** → 7 days no decision → "Any questions about the quote?"
- **Lead Created** → 1 day no contact → "Introduction email"
- **Opportunity Stalled** → 7 days no activity → "Checking in"

**Data Structure**:
```typescript
type FollowUpRule = {
  trigger: "questionnaire_sent" | "quote_sent" | "lead_created" | "opportunity_stalled";
  delayDays: number;
  condition: string; // SQL-like condition
  taskTitle: string;
  emailSubject: string;
  context: string; // Context for AI
  priority: "LOW" | "MEDIUM" | "HIGH";
  autoSchedule: boolean; // If true, auto-creates task
};
```

### 2. AI Email Generator
**Location**: `api/src/services/aiEmailDrafter.ts`

**ML Integration**:
- POST to ML service: `/api/draft-email`
- Payload:
  ```json
  {
    "context": {
      "recipientName": "John Smith",
      "companyName": "Acme Ltd",
      "previousInteraction": "Sent quote for oak doors",
      "daysSince": 3,
      "quoteValue": 5000,
      "userHistory": ["previous emails from this user"]
    },
    "tone": "professional",
    "purpose": "follow_up_quote",
    "userStyle": "analyzed from past emails"
  }
  ```
- Response: AI-generated email draft

**Learning Data**:
- Track which emails get responses
- Track time-to-response
- Track conversion rates
- User edits to AI drafts (style learning)

### 3. Task Creation with AI Draft
**Location**: `api/src/routes/tasks.ts` (extend)

**New Task Type Enhancement**:
```typescript
type FollowUpTask = {
  taskType: "FOLLOW_UP";
  aiDraft?: {
    subject: string;
    body: string;
    generatedAt: string;
    confidence: number; // ML confidence score
  };
  userEdits?: {
    originalDraft: string;
    finalVersion: string;
    editedAt: string;
  };
  emailMetadata?: {
    sentAt?: string;
    messageId?: string;
    threadId?: string;
    recipientEmail: string;
  };
  conversation?: Array<{
    from: string;
    to: string;
    subject: string;
    body: string;
    timestamp: string;
    messageId: string;
  }>;
};
```

### 4. Email Sending Service
**Location**: `api/src/services/gmailSender.ts`

**Features**:
- Send via user's Gmail (using their refresh token)
- Proper email threading (In-Reply-To, References headers)
- Track message ID for reply matching
- HTML + plain text support

**API Endpoint**:
```
POST /tasks/:taskId/send-email
Body: {
  subject: string;
  body: string;
  to: string;
}
```

### 5. Reply Ingestion System
**Location**: `api/src/services/gmailInbox.ts`

**Methods**:
1. **Gmail Push Notifications** (Pub/Sub)
   - Subscribe to user's Gmail updates
   - Webhook receives notification of new emails
   - Fetch and process reply

2. **Polling Fallback**
   - Cron job every 5 minutes
   - Check for new messages in threads we're tracking
   - Match by Message-ID and References headers

**Processing**:
- Extract reply from thread
- Find associated task by messageId
- Update task with reply
- Optionally auto-complete task if positive response
- Create new task if action required

### 6. Conversation View Component
**Location**: `web/src/components/tasks/EmailConversationView.tsx`

**Features**:
- Shows full email thread
- Highlights AI-suggested responses
- Inline reply composer
- Status indicators (sent, delivered, read, replied)

## Database Schema Changes

### New Tables:

```sql
-- Follow-up rules configuration
CREATE TABLE FollowUpRule (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  trigger TEXT NOT NULL,
  delayDays INTEGER NOT NULL,
  condition TEXT,
  taskTitle TEXT NOT NULL,
  emailSubject TEXT NOT NULL,
  contextTemplate TEXT NOT NULL,
  priority TEXT NOT NULL,
  autoSchedule BOOLEAN DEFAULT false,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Follow-up task history and learning data
CREATE TABLE FollowUpHistory (
  id TEXT PRIMARY KEY,
  taskId TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  userId TEXT NOT NULL,
  aiDraftSubject TEXT,
  aiDraftBody TEXT,
  finalSubject TEXT,
  finalBody TEXT,
  sentAt TIMESTAMP,
  messageId TEXT,
  threadId TEXT,
  recipientEmail TEXT NOT NULL,
  responded BOOLEAN DEFAULT false,
  respondedAt TIMESTAMP,
  responseTime INTEGER, -- minutes to response
  converted BOOLEAN DEFAULT false, -- led to sale/action
  userEdited BOOLEAN DEFAULT false,
  editDistance INTEGER, -- how much user changed AI draft
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email conversation thread
CREATE TABLE EmailThread (
  id TEXT PRIMARY KEY,
  taskId TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  messageId TEXT NOT NULL UNIQUE,
  threadId TEXT,
  fromAddress TEXT NOT NULL,
  toAddress TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  htmlBody TEXT,
  direction TEXT NOT NULL, -- "SENT" or "RECEIVED"
  timestamp TIMESTAMP NOT NULL,
  inReplyTo TEXT,
  references TEXT[],
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Extend Existing Tables:

```sql
-- Add to Task table
ALTER TABLE Task ADD COLUMN aiDraft JSONB;
ALTER TABLE Task ADD COLUMN userEdits JSONB;
ALTER TABLE Task ADD COLUMN emailMetadata JSONB;
ALTER TABLE Task ADD COLUMN conversationThreadId TEXT;

-- Add to Lead table
ALTER TABLE Lead ADD COLUMN lastFollowUpAt TIMESTAMP;
ALTER TABLE Lead ADD COLUMN followUpCount INTEGER DEFAULT 0;

-- Add to Opportunity table
ALTER TABLE Opportunity ADD COLUMN lastFollowUpAt TIMESTAMP;
ALTER TABLE Opportunity ADD COLUMN followUpCount INTEGER DEFAULT 0;
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Database schema updates
- [ ] Follow-up trigger engine (cron job)
- [ ] Basic task creation for follow-ups
- [ ] Gmail sending service (use existing connection)

### Phase 2: AI Integration (Week 3-4)
- [ ] ML service endpoint for email drafting
- [ ] AI draft generation in task creation
- [ ] User edit tracking for learning
- [ ] Email template library

### Phase 3: Reply Ingestion (Week 5-6)
- [ ] Gmail webhook setup (Pub/Sub)
- [ ] Reply matching algorithm
- [ ] Conversation threading
- [ ] Task auto-updates based on replies

### Phase 4: Learning & Optimization (Week 7-8)
- [ ] ML training pipeline
- [ ] A/B testing framework
- [ ] Success metrics dashboard
- [ ] Automatic timing optimization

### Phase 5: UI/UX (Week 9-10)
- [ ] Email conversation view
- [ ] AI draft approval workflow
- [ ] Follow-up calendar view
- [ ] Analytics dashboard

## Default Follow-up Rules

```typescript
const DEFAULT_RULES: FollowUpRule[] = [
  {
    trigger: "questionnaire_sent",
    delayDays: 3,
    condition: "status != 'COMPLETED'",
    taskTitle: "Follow up on questionnaire with {leadName}",
    emailSubject: "Quick reminder about your project questionnaire",
    contextTemplate: "Questionnaire sent {daysSince} days ago. No completion yet. Be friendly and helpful.",
    priority: "MEDIUM",
    autoSchedule: true
  },
  {
    trigger: "quote_sent",
    delayDays: 3,
    condition: "status NOT IN ('WON', 'LOST')",
    taskTitle: "Follow up on quote for {companyName}",
    emailSubject: "Following up on your quote for {projectDescription}",
    contextTemplate: "Quote value £{quoteValue} sent {daysSince} days ago. Check if they have questions.",
    priority: "HIGH",
    autoSchedule: true
  },
  {
    trigger: "quote_sent",
    delayDays: 7,
    condition: "status NOT IN ('WON', 'LOST') AND followUpCount < 2",
    taskTitle: "Second follow-up on quote for {companyName}",
    emailSubject: "Any questions about your quote?",
    contextTemplate: "Second follow-up. Quote value £{quoteValue}. Be helpful, offer to discuss.",
    priority: "HIGH",
    autoSchedule: true
  },
  {
    trigger: "lead_created",
    delayDays: 1,
    condition: "status = 'NEW'",
    taskTitle: "Initial contact with {leadName}",
    emailSubject: "Thank you for your enquiry",
    contextTemplate: "First contact. Warm welcome, set expectations, offer help.",
    priority: "HIGH",
    autoSchedule: true
  },
  {
    trigger: "opportunity_stalled",
    delayDays: 7,
    condition: "lastActivityAt < NOW() - INTERVAL '7 days'",
    taskTitle: "Check in with {companyName}",
    emailSubject: "Checking in on your {projectType} project",
    contextTemplate: "No activity for 7 days. Gentle check-in, offer assistance.",
    priority: "MEDIUM",
    autoSchedule: false // User should decide
  }
];
```

## ML Features for Email Optimization

### Training Data Collection:
1. **Response Rates** by:
   - Time of day sent
   - Day of week
   - Subject line length
   - Email length
   - Tone/formality
   - Follow-up sequence position

2. **Conversion Tracking**:
   - Which emails led to quote acceptance
   - Which got positive replies
   - Which got ignored

3. **User Style Analysis**:
   - Average email length
   - Vocabulary preferences
   - Greeting/closing styles
   - Formality level

### ML Model Outputs:
- **Optimal Send Time**: Best time to send for this recipient
- **Email Content**: AI-drafted email body
- **Subject Line**: Optimized for open rates
- **Confidence Score**: How confident the AI is
- **Next Best Action**: When to send next follow-up or suggest phone call

## User Experience Flow

### For User:
1. **Morning Review**: User opens app, sees 3 AI-suggested follow-up tasks
2. **Task Details**: Clicks task, sees:
   - Context: "Quote sent 3 days ago, £5,000 value, no response"
   - AI Draft Email (with confidence: 87%)
   - Edit button
   - Send button
3. **Review & Edit**: User reads draft, makes minor edits
4. **Send**: Clicks send, email goes out from their Gmail
5. **Tracking**: Task shows "Email sent", awaits reply
6. **Reply Received**: Task updates with reply, shows conversation
7. **Next Action**: AI suggests "They asked about lead time - create follow-up task in 2 days"

### Automation:
- Tasks auto-created based on triggers
- AI drafts pre-generated
- User only needs to approve/edit/send
- Replies auto-ingested and displayed
- Learning happens in background

## API Endpoints Needed

```typescript
// Follow-up management
POST   /api/follow-up-rules          // Create custom rule
GET    /api/follow-up-rules          // List tenant rules
PATCH  /api/follow-up-rules/:id      // Update rule
DELETE /api/follow-up-rules/:id      // Delete rule

// AI email drafting
POST   /api/tasks/:id/generate-draft // Generate AI email draft
POST   /api/tasks/:id/send-email     // Send email from task
GET    /api/tasks/:id/conversation   // Get email thread

// Learning & analytics
GET    /api/follow-ups/analytics     // Response rates, best times, etc.
GET    /api/follow-ups/performance   // ML performance metrics
POST   /api/follow-ups/feedback      // User feedback on AI drafts

// Gmail integration (extend existing)
POST   /api/gmail/webhook            // Receive push notifications
GET    /api/gmail/threads/:id        // Get conversation thread
```

## Configuration UI

### Settings Page: Follow-up Automation
- Enable/disable auto-scheduling
- Edit default rules (timing, triggers)
- Customize email templates
- Set AI tone preferences
- View analytics
- Configure notification preferences

## Security & Privacy

- User's Gmail token stays server-side (never client)
- Emails sent via user's account (not spoofed)
- ML training data anonymized
- Option to disable AI suggestions
- All emails logged for audit

## Success Metrics

- **Response Rate**: % of follow-ups that get replies
- **Conversion Rate**: % that lead to sales
- **Time Saved**: Hours saved vs manual follow-up
- **AI Accuracy**: % of drafts sent without edits
- **Optimal Timing**: Average time-to-response by send time
- **User Adoption**: % of suggested emails sent

## Next Steps

1. Review and approve this architecture
2. Set up ML service endpoint for email drafting
3. Implement Phase 1 (Foundation)
4. Create cron job for trigger scanning
5. Build email sending service
6. Test with real data

This system will transform follow-ups from manual work to intelligent, automated, and continuously improving communication.
