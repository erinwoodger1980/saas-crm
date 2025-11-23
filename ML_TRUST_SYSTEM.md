# ML Trust and Training System

## Overview

This system builds trust in ML pricing by requiring manual approval, tracking accuracy metrics, and providing training interfaces to continuously improve the model.

## Key Components

### 1. Quote Approval Workflow

**Schema Changes:**
- Added fields to `Quote` model:
  - `mlEstimatedPrice`: ML's predicted price
  - `mlConfidence`: Confidence score (0-1)
  - `mlModelVersion`: Model version that generated the estimate
  - `approvalStatus`: pending | approved | rejected | needs_review
  - `approvedPrice`: Final human-approved price
  - `approvedById`: User who reviewed
  - `approvedAt`: Approval timestamp
  - `priceVariancePercent`: (approved - ml) / ml * 100
  - `isTrainingExample`: Flag for ML training
  - `trainingNotes`: Notes about this example

**API Endpoints:**
- `GET /quote-approval/:tenantId/pending` - List quotes awaiting approval
- `POST /quote-approval/:quoteId/approve` - Approve with final price
- `POST /quote-approval/:quoteId/reject` - Reject and flag for manual quote
- `GET /quote-approval/:tenantId/metrics` - Get ML accuracy metrics
- `POST /quote-approval/:quoteId/mark-training` - Mark as training example

**Workflow:**
1. Public user completes questionnaire
2. ML generates estimate (stored in `mlEstimatedPrice`, NOT shown to customer)
3. Quote appears in tenant's approval dashboard with status "pending"
4. Tenant reviews quote and enters actual price
5. System calculates variance and updates trust metrics
6. Approved quote can be sent to customer

### 2. ML Accuracy Tracking

**Model:** `MLAccuracyMetric`
- Tracks accuracy over time periods
- Metrics include:
  - Total quotes processed
  - Count within 10% accuracy
  - Count within 20% accuracy
  - Average variance %
  - Median variance %
  - Average ML confidence

**Trust Score:**
- Calculated as: (quotes within 10% / total quotes) × 100
- Displayed to users to build confidence in ML
- Updated automatically as quotes are approved

### 3. Questionnaire Data Extraction from PDFs

**Script:** `scripts/extract-questionnaire-from-pdfs.js`

Analyzes existing parsed PDF data to extract standard questionnaire answers:
- Dimensions (width, height, thickness)
- Quantities
- Materials (timber species, glass type)
- Fire ratings
- Finish types
- Pricing data

**Usage:**
```bash
node scripts/extract-questionnaire-from-pdfs.js <tenantId>
```

**How it works:**
1. Finds quotes with `QuoteQuestionnaireMatch` or `ParsedSupplierLine` data
2. Applies extraction rules to identify field values
3. Creates `QuestionnaireResponse` records with extracted answers
4. Enables historical data to be used for ML training

**Extraction Mappings:**
- `door_width_mm` - From `widthMm` or regex parse
- `door_height_mm` - From `heightMm` or regex parse
- `thickness_mm` - From `thicknessMm` or "XX mm thick"
- `quantity` - From qty/quantity fields
- `timber_species` - Pattern matching: oak, pine, ash, etc.
- `glass_type` - Pattern matching: double glazed, clear, toughened
- `fire_rating` - Pattern matching: FD30, FD60, FD90
- `finish_type` - Pattern matching: stained, painted, lacquered
- `unit_price_gbp` - From unitPrice/costUnit
- `line_total_gbp` - From lineTotal

### 4. Example Photo Gallery System

**Purpose:** Allow customers to browse real examples with specifications and pricing to improve estimate accuracy and provide visual reference points.

**Database Models:**

`ExamplePhoto`:
- Image storage: `imageUrl`, `thumbnailUrl` (400x300px auto-generated)
- Metadata: `title`, `description`, `tags[]`
- Classification: `productType` (door type, etc.)
- Legacy fields: `widthMm`, `heightMm`, `thicknessMm`, `timberSpecies`, `glassType`, `finishType`, `fireRating`
- Pricing: `priceGBP`, `priceDate`, `supplierName`
- Analytics: `viewCount`, `selectionCount`, `displayOrder`

`ExamplePhotoFieldAnswer`:
- Links `ExamplePhoto` to `QuestionnaireField` answers
- Stores complete answers to ALL standard questionnaire fields
- Enables precise matching and filtering
- Fields: `examplePhotoId`, `fieldId`, `fieldKey`, `value`

**API Endpoints:**

*Public (no auth):*
- `GET /example-photos/public/:tenantId` - Browse examples by tags/productType
- `POST /example-photos/public/:photoId/view` - Track view
- `POST /example-photos/public/:photoId/select` - Track selection, return specs to pre-fill questionnaire

*Admin (auth required):*
- `GET /example-photos/:tenantId` - List all examples
- `POST /example-photos/:tenantId/upload` - Upload new example with metadata
- `PATCH /example-photos/:photoId` - Update example
- `DELETE /example-photos/:photoId` - Delete example
- `POST /example-photos/reorder` - Update display order
- `GET /example-photos/:tenantId/analytics` - View/selection analytics

**Admin UI:** `/admin/example-photos`
- Upload form with metadata entry (title, description, tags, dimensions, specs, price)
- **Complete questionnaire field answers** (all 30+ standard fields)
- Photo grid with thumbnails
- View/selection analytics dashboard
- Edit/delete management
- Field answer viewer per photo

**Public Gallery Component:** `ExamplePhotoGallery`
- Swipeable interface with arrow navigation
- Filter by tags/productType
- Photo counter (1 / 10)
- Info overlay with full specs
- "Use This Example" button → pre-fills questionnaire fields
- Tracks views automatically, selections on use

**Integration with Questionnaire:**
1. Customer selects product type (e.g., "entrance door")
2. Gallery shows tagged examples matching that type
3. Customer swipes through options
4. Clicking "Use This Example" calls `/select` endpoint
5. API returns specifications object including:
   - Legacy fields (widthMm, heightMm, timberSpecies, etc.)
   - **Complete questionnaire answers** (all 30+ fields if tagged)
6. Questionnaire form auto-fills ALL matching fields
7. ML estimate uses complete, accurate pre-filled values
8. Analytics track which examples customers prefer

**Example Selection Response:**
```json
{
  "specifications": {
    "widthMm": 900,
    "heightMm": 2100,
    "timberSpecies": "Oak",
    "questionnaireAnswers": {
      "area_m2": { "value": "2.5", "label": "Project Area (m²)", "type": "NUMBER" },
      "materials_grade": { "value": "Premium", "label": "Materials Grade", "type": "SELECT" },
      "project_type": { "value": "Doors", "label": "Project Type", "type": "SELECT" },
      "door_type": { "value": "External Front Door", "label": "Door Type", "type": "SELECT" },
      "door_height_mm": { "value": "2100", "label": "Door Height (mm)", "type": "NUMBER" },
      "door_width_mm": { "value": "900", "label": "Door Width (mm)", "type": "NUMBER" },
      "glazing_type": { "value": "Double Glazed", "label": "Glazing Type", "type": "SELECT" },
      "premium_hardware": { "value": "true", "label": "Premium Hardware", "type": "BOOLEAN" },
      // ... all other standard fields
    }
  }
}
```

**Benefits:**
- Visual reference reduces uncertainty
- Real pricing data improves ML accuracy
- Customer engagement increases (browsing examples)
- Tenant insights: which styles/specs are most popular
- Pre-filling reduces customer effort and errors

### 5. ML Training Interface

**Page:** `/ml-training`

Interactive interface for supervised ML training:

**Features:**
1. **Fill Questionnaire Manually**
   - All standard questionnaire fields
   - Progress tracking
   - Real-time validation

2. **Upload Project Photos**
   - Multiple photo upload
   - Photos stored with training example
   - Used for visual ML features

3. **Get ML Prediction**
   - Request ML estimate based on current answers
   - Shows predicted price and confidence
   - Non-blocking - can be requested any time

4. **Upload Supplier Quote PDF**
   - Actual supplier quote document
   - Automatically parsed for additional data
   - Linked to training example

5. **Compare ML vs Actual**
   - Enter real supplier price
   - Calculates variance percentage
   - Color-coded accuracy indicator:
     - Green: ≤10% variance (excellent)
     - Amber: 10-20% variance (acceptable)
     - Red: >20% variance (needs improvement)

6. **Submit Training Example**
   - Creates new quote marked as `isTrainingExample`
   - Stores all data for future training
   - Updates trust metrics
   - Provides feedback to ML system

**Trust Score Display:**
- Shows current ML performance metrics
- Updates in real-time as examples are submitted
- Builds confidence in the system

### 5. Public Estimator Changes

**Current Behavior:**
- User completes questionnaire
- Answers saved to database
- ML estimate generated in background (NOT shown to user)
- Quote flagged as "pending" for tenant review

**User Experience:**
- "Thank you for submitting your project details"
- "We'll review your requirements and send you a detailed quote within 24 hours"
- No instant pricing shown (builds trust through human validation)

### 6. Approval Dashboard (To Be Built)

**Recommended Location:** `/quotes/pending-approval`

**Should Display:**
- List of pending quotes with ML estimates
- Quick approve/reject actions
- Variance indicators
- Trust score prominently displayed
- Filter by variance range
- Bulk approval for high-confidence estimates

**UI Mockup:**
```
┌─────────────────────────────────────────┐
│ Pending Quote Approval                  │
│ Trust Score: 87% (34/39 within 10%)     │
├─────────────────────────────────────────┤
│ □ Quote #1234                           │
│   Customer: John Smith                   │
│   ML Est: £2,450 (92% confident)         │
│   [Enter Actual] [Approve] [Reject]      │
├─────────────────────────────────────────┤
│ □ Quote #1235                           │
│   Customer: Jane Doe                     │
│   ML Est: £3,100 (78% confident)         │
│   [Enter Actual] [Approve] [Reject]      │
└─────────────────────────────────────────┘
```

## Database Migration

Run the migration to add new fields:

```bash
cd api
npx prisma generate
npx prisma migrate deploy
```

The migration file is located at:
`api/prisma/migrations/20251123_add_ml_trust_fields/migration.sql`

## Workflow Examples

### Example 1: New Public Quote Submission
1. Customer fills questionnaire at `/questionnaire/demo`
2. On submit:
   - Creates `Quote` with `approvalStatus: "pending"`
   - Calls ML to get estimate
   - Stores `mlEstimatedPrice` and `mlConfidence` (hidden from customer)
   - Shows "Thank you" message to customer
3. Tenant sees quote in approval dashboard
4. Tenant reviews and approves with actual price
5. System calculates variance and updates metrics
6. Quote sent to customer

### Example 2: Training the ML
1. User goes to `/ml-training`
2. Fills questionnaire (e.g., oak door, 2100x900mm, painted)
3. Clicks "Get ML Estimate" → ML predicts £1,850 (85% confidence)
4. Uploads photo of similar door
5. Uploads supplier quote PDF showing actual price £1,950
6. Enters actual price £1,950
7. System shows variance: +5.4% (excellent accuracy)
8. Submits training example
9. Trust metrics update (this example was within 10%)

### Example 3: Extracting Historical Data
1. Tenant has 50 parsed PDF quotes in system
2. Run extraction script:
   ```bash
   node scripts/extract-questionnaire-from-pdfs.js tenant-abc-123
   ```
3. Script analyzes all `ParsedSupplierLine` records
4. Extracts dimensions, materials, quantities, prices
5. Creates `QuestionnaireResponse` records for each quote
6. Historical data now available for ML training

## Benefits

1. **Builds Trust**: Gradual trust building through transparent accuracy metrics
2. **Human Oversight**: All quotes reviewed before customer sees price
3. **Continuous Improvement**: Every approval improves ML training data
4. **Visibility**: Clear metrics show ML performance over time
5. **Safety Net**: High-variance quotes flagged for manual review
6. **Training Mode**: Dedicated interface for supervised learning
7. **Historical Data**: Leverage existing parsed PDFs for training

## Trust Score Interpretation

- **0-50%**: ML needs more training, rely on manual quoting
- **50-70%**: ML improving, review all quotes carefully
- **70-85%**: ML reliable, spot-check high-value quotes
- **85-95%**: ML very accurate, review only high-variance quotes
- **95%+**: ML highly trusted, quick-approve low-variance quotes

## Next Steps

1. **Build Approval Dashboard UI** - Create React component for `/quotes/pending-approval`
2. **Email Notifications** - Alert tenant when new quotes need approval
3. **Bulk Approval** - Allow approving multiple high-confidence quotes at once
4. **Auto-Approval Rules** - Automatically approve quotes within X% variance after trust score reaches threshold
5. **A/B Testing** - Gradually roll out instant pricing for specific customer segments once trust is established
6. **ML Retraining Pipeline** - Automated retraining when new training examples reach threshold
7. **Customer Feedback Loop** - Track conversion rates by variance to optimize pricing strategy

## Files Modified/Created

### Database
- `api/prisma/schema.prisma` - Added Quote fields, MLAccuracyMetric model
- `api/prisma/migrations/20251123_add_ml_trust_fields/migration.sql` - Migration

### Backend API
- `api/src/routes/quote-approval.ts` - Approval workflow endpoints
- `api/src/routes/ml-training.ts` - Training example submission
- `api/src/server.ts` - Route registration

### Scripts
- `scripts/extract-questionnaire-from-pdfs.js` - Historical data extraction

### Frontend
- `web/src/app/ml-training/page.tsx` - ML training interface
- `web/src/app/questionnaire/demo/page.tsx` - Public estimator (no pricing shown)

## API Documentation

### Get Pending Quotes
```http
GET /quote-approval/:tenantId/pending?limit=50&offset=0
Authorization: Bearer <token>

Response:
{
  "quotes": [{
    "id": "quote123",
    "title": "John Smith - Oak Doors",
    "mlEstimatedPrice": 2450.00,
    "mlConfidence": 0.92,
    "createdAt": "2025-11-23T10:00:00Z",
    "lead": {
      "contactName": "John Smith",
      "email": "john@example.com"
    },
    "questionnaireResponse": { ... }
  }],
  "total": 12,
  "limit": 50,
  "offset": 0
}
```

### Approve Quote
```http
POST /quote-approval/:quoteId/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "approvedPrice": 2500.00,
  "userId": "user123",
  "notes": "Added £50 for site visit"
}

Response:
{
  "id": "quote123",
  "approvalStatus": "approved",
  "approvedPrice": 2500.00,
  "mlEstimatedPrice": 2450.00,
  "priceVariancePercent": 2.04,
  "approvedAt": "2025-11-23T10:30:00Z",
  "approvedBy": { ... }
}
```

### Get Accuracy Metrics
```http
GET /quote-approval/:tenantId/metrics?days=30
Authorization: Bearer <token>

Response:
{
  "totalQuotes": 39,
  "accurateWithin10Pct": 34,
  "accurateWithin20Pct": 37,
  "accurateWithin10PctPercent": 87.18,
  "accurateWithin20PctPercent": 94.87,
  "averageVariancePct": 6.2,
  "medianVariancePct": 4.8,
  "confidenceAvg": 0.86,
  "trustScore": 87.18,
  "period": {
    "start": "2025-10-24T00:00:00Z",
    "end": "2025-11-23T00:00:00Z",
    "days": 30
  }
}
```

### Submit Training Example
```http
POST /ml/training-example
Content-Type: multipart/form-data

Fields:
- answers: JSON string of questionnaire answers
- actualPrice: number
- mlEstimatedPrice: number (optional)
- mlConfidence: number (optional)
- variance: number (optional)
- photo_0, photo_1, etc: image files
- supplierQuote: PDF file

Response:
{
  "success": true,
  "quoteId": "quote456",
  "responseId": "resp789",
  "answersCount": 12,
  "filesUploaded": 4,
  "variance": 5.4,
  "message": "Training example submitted successfully"
}
```

## Configuration

No environment variables required - uses existing database connection.

## Testing

1. **Test Public Estimator** (no pricing shown):
   ```
   Visit: /questionnaire/demo
   Fill questionnaire → Submit → See "thank you" message
   ```

2. **Test ML Training**:
   ```
   Visit: /ml-training
   Fill questionnaire → Get ML estimate → Enter actual price → Submit
   ```

3. **Test Approval API**:
   ```bash
   # Get pending quotes
   curl -H "Authorization: Bearer <token>" \
     http://localhost:4567/quote-approval/demo-tenant-id/pending

   # Approve a quote
   curl -X POST -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"approvedPrice": 2500, "userId": "user123"}' \
     http://localhost:4567/quote-approval/quote-id/approve
   ```

4. **Test PDF Extraction**:
   ```bash
   node scripts/extract-questionnaire-from-pdfs.js demo-tenant-id
   ```

## Support

For issues or questions, check:
1. Database schema matches migration
2. API routes registered in server.ts
3. Frontend environment variables set
4. Authentication tokens valid
