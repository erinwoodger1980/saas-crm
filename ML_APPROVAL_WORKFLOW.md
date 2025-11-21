# ML Training Sample Approval Workflow

## Overview

Quality control system for ML training data collected from emails. Prevents low-quality or incorrect quotes from being used in model training.

## Problem Solved

When the email collection system finds quotes in Gmail, some may be:
- Incomplete/partial quotes
- Incorrectly identified PDFs
- Poor quality scans
- Non-quote documents (invoices, receipts, etc.)

Without approval, these would pollute the ML training dataset and degrade model accuracy.

## How It Works

### 1. Sample Status Lifecycle

```
Email Collection → PENDING → (Manual Review) → APPROVED/REJECTED
                                                       ↓
                                                 ML Training
```

All samples collected from emails default to `PENDING` status and require manual approval before being used for training.

### 2. Database Schema

```prisma
enum MLSampleStatus {
  PENDING  // Awaiting review
  APPROVED // Ready for training
  REJECTED // Not suitable for training
}

model MLTrainingSample {
  id           String         @id @default(cuid())
  status       MLSampleStatus @default(PENDING)
  // ... other fields
  @@index([tenantId, status])
}
```

### 3. Approval UI

Location: `/dev/ml` (Development dashboard)

**Features:**
- Lists all pending samples with metadata
- View PDF button to inspect quote
- Approve/Reject buttons
- Shows collection timestamp and email info

**Sample Card Layout:**
```
┌─────────────────────────────────────────────────┐
│ [Message ID snippet]  [Date]                    │
│ Attachment: [attachment ID]                     │
│ Added: [timestamp]                              │
│                                                  │
│ [View PDF] [✓ Approve] [✗ Reject]              │
└─────────────────────────────────────────────────┘
```

### 4. API Endpoints

#### GET /internal/ml/samples
Lists all training samples (any status)
```typescript
Response: {
  ok: true,
  items: [
    {
      id: string,
      status: 'PENDING' | 'APPROVED' | 'REJECTED',
      messageId: string,
      url: string,
      // ... other fields
    }
  ]
}
```

#### PATCH /internal/ml/samples/:id/status
Update sample approval status
```typescript
Request: { status: 'APPROVED' | 'REJECTED' | 'PENDING' }
Response: { ok: true, sample: { ... } }
```

### 5. Training Filter

The `/ml/train` endpoint only includes APPROVED samples:

```typescript
const recentSamples = await prisma.mLTrainingSample.findMany({
  where: {
    tenantId,
    status: "APPROVED", // Filter for approved only
    // ... other filters
  }
});
```

## Workflow Process

### For Developers (Using Dev Dashboard)

1. Navigate to `/dev/ml`
2. View "Pending Quote Samples" section
3. For each sample:
   - Click "View PDF" to inspect the quote
   - Verify it's a valid, complete quote
   - Click "✓ Approve" if good quality
   - Click "✗ Reject" if poor quality/wrong document
4. Approved samples automatically included in next training run

### For Automated Collection

When email collection runs (`/internal/ml/ingest-gmail`):
1. Finds PDFs in sent emails
2. Creates `MLTrainingSample` records with `status=PENDING`
3. Waits for manual approval
4. Training skips PENDING/REJECTED samples

## Quality Control Guidelines

### Approve if:
- Complete line-item breakdown visible
- Clear pricing information
- Professional quote format
- Readable text (not blurry scan)
- Correct document type (not invoice/receipt)

### Reject if:
- Partial/incomplete quote
- Poor scan quality
- Wrong document type
- Missing critical information
- Corrupt PDF

## Integration Points

### Email Collection
- `api/src/routes/ml-internal.ts` - Creates samples with default PENDING status
- No code changes needed (defaults work automatically)

### Training Pipeline
- `api/src/routes/ml.ts` - Filters for APPROVED samples
- Python ML service receives only approved data

### Manual Upload
- `api/src/routes/ml-training-upload.ts` - Direct uploads (trusted) could auto-approve
- Currently creates PENDING samples for consistency

## Future Enhancements

### Auto-Approval Confidence
Could add ML-based pre-screening:
```typescript
if (confidence > 0.9 && hasLineItems && hasPricing) {
  status = 'APPROVED'
} else {
  status = 'PENDING'  // Requires human review
}
```

### Bulk Actions
Add UI for:
- Approve all visible
- Reject all visible
- Filter by date/source

### Status Dashboard
Show metrics:
- Pending count (needs attention)
- Approval rate
- Average review time
- Training dataset size

## Migration Notes

Existing samples (pre-approval system) default to PENDING:
```sql
ALTER TABLE "MLTrainingSample" 
ADD COLUMN "status" "MLSampleStatus" NOT NULL DEFAULT 'PENDING';
```

To bulk-approve all existing samples:
```sql
UPDATE "MLTrainingSample" 
SET status = 'APPROVED' 
WHERE "createdAt" < '2025-01-21'  -- Before approval system deployed
  AND status = 'PENDING';
```

## Testing

Test approval workflow:
1. Trigger email collection: POST `/dev/ml/train/:tenantId`
2. Check `/dev/ml` for pending samples
3. Approve/reject samples
4. Verify training only uses approved samples

## Related Files

- `api/prisma/schema.prisma` - Status enum and model
- `api/src/routes/ml-samples.ts` - Sample management endpoints
- `api/src/routes/ml.ts` - Training endpoint with filter
- `web/src/app/dev/ml/[[...id]]/page.tsx` - Approval UI
- `api/prisma/migrations/*/add_ml_sample_status/` - Schema migration
