# AI Training System - Complete Guide

## Overview

The AI Training system enables continuous improvement of ML models through both **automated email ingestion** and **manual PDF uploads**. Training examples are stored in the database for future model retraining.

## Architecture

### Database Tables

1. **ml_training_data** - Stores all training examples
   - `tenant_id` - Multi-tenancy isolation
   - `parsed_data` - JSONB field with extracted quote data
   - `quote_type` - 'supplier' or 'client'
   - `confidence` - Parser confidence score (0-1)
   - `estimated_total` - Total value extracted from quote
   - `project_type` - Classification (e.g., 'windows', 'doors')
   - `quoted_price` - Validated price from quote
   - `source_email_id` - Link to email (if from email ingestion)
   - `source_file_id` - Link to uploaded file (if manual upload)

2. **ml_training_history** - Tracks training sessions
   - `tenant_id` - Which tenant ran training
   - `training_type` - 'email_ingestion', 'manual_upload', 'full_retrain'
   - `quotes_processed` - Number of quotes in this session
   - `training_records_created` - Records saved to ml_training_data
   - `duration_seconds` - How long training took
   - `status` - 'completed', 'failed', 'partial'
   - `error_message` - Details if failed

3. **ml_models** - Model version tracking (future use)
   - Stores trained model artifacts
   - Version history and performance metrics

### API Endpoints

#### 1. `/ml/train-supplier-quotes` (NEW)
**Purpose**: Train on all uploaded supplier files from Quote Builder

**Flow**:
1. Fetches all `SUPPLIER_QUOTE` files from last 90 days
2. Limits to 100 most recent files
3. Generates signed URLs for each file
4. Calls ML service `/train` endpoint with batch
5. Returns: `parsed_ok`, `training_records_saved`, `failed`

**Usage**:
```typescript
const response = await apiFetch('/ml/train-supplier-quotes', {
  method: 'POST',
  json: {}
});
// Returns: { parsed_ok: 47, training_records_saved: 47, failed: 0, ... }
```

#### 2. `/ml/start-email-training`
**Purpose**: Scan Gmail/M365 for client quotes and train

**Flow**:
1. Connects to email provider (Gmail or Microsoft 365)
2. Searches for keywords: "estimate", "quotation", "proposal", etc.
3. Filters for sent emails with PDF attachments
4. Extracts text, parses as client quotes
5. Stores in ml_training_data with email metadata

**Usage**:
```typescript
const response = await apiFetch('/ml/start-email-training', {
  method: 'POST',
  json: {
    emailProvider: 'gmail', // or 'ms365'
    daysBack: 30,
    credentials: {} // Uses stored OAuth tokens
  }
});
```

#### 3. `/ml/train-client-quotes`
**Purpose**: Retrain models using stored client quote data

**Note**: Currently a placeholder - stores examples but doesn't retrain models yet.

#### 4. `/ml/upload-quote-training`
**Purpose**: Single file upload with base64 encoding

**Usage**: For drag-and-drop individual PDFs in UI.

### ML Service Endpoints

#### `/train` (ML Service)
**Core training logic** - processes PDFs and stores training data.

**Request**:
```json
{
  "tenantId": "tenant_abc123",
  "model": "supplier_parser",
  "items": [
    {
      "url": "https://signed-url.com/file.pdf",
      "filename": "supplier_quote_001.pdf",
      "quotedAt": "2024-01-15T10:30:00Z",
      "sourceType": "supplier_quote",
      "fileId": "file_xyz",
      "quoteId": "quote_456"
    }
  ]
}
```

**Processing**:
1. Downloads PDF from signed URL
2. Extracts text with `extract_text_from_pdf_bytes`
3. Classifies as supplier or client with `determine_quote_type`
4. Parses with appropriate parser:
   - Supplier: `parse_quote_lines_from_text` → extracts line items, prices
   - Client: `parse_client_quote_from_text` → extracts project details, confidence
5. Creates training record with parsed_data (JSON), confidence, estimated_total
6. Batch saves to database via `db_manager.save_training_data`
7. Logs session to ml_training_history

**Response**:
```json
{
  "ok": true,
  "received_items": 47,
  "parsed_ok": 47,
  "failed": 0,
  "training_records_saved": 47,
  "avg_estimated_total": 12450.50,
  "samples": [
    {
      "filename": "supplier_quote_001.pdf",
      "quote_type": "supplier",
      "confidence": 0.95,
      "estimated_total": 15670.00,
      "line_count": 23
    }
  ]
}
```

## Frontend: AI Training Hub

Located at: `/settings/ai-training`

### Two Training Workflows

#### 1. Email Quote Discovery (Green Section)
**For client quotes** - automatically finds quotes you've sent to clients.

**Features**:
- Preview mode: Scan without saving
- Training mode: Extract and save to database
- Provider selection: Gmail or Microsoft 365
- Date range: Last 7, 30, 60, or 90 days
- Progress tracking: Shows quotes found, records saved

**Buttons**:
- **Preview Quotes**: Scan emails and show what would be extracted
- **Start Training**: Actually save quotes to database
- **Train Models**: Retrain ML models with stored data (future feature)

#### 2. Manual Quote Training (Purple Section)
**For supplier quotes** - upload PDFs directly from your computer.

**Features**:
- Drag-and-drop PDF uploads
- File type validation (PDF only)
- Upload queue with progress bars
- Per-file results: confidence, quote type, records saved
- Batch training button

**Buttons**:
- **Train on All Uploaded Files** (NEW): Processes all supplier files uploaded through Quote Builder
  - Fetches from database, not just current session
  - Processes last 90 days of uploads
  - Shows: quotes processed, training records saved

**Quote Type Selector**:
- 🏭 **Supplier Quote**: Received from contractors/suppliers
- 👤 **Client Quote**: Sent to your clients/customers

## Training Data Flow

### Supplier Quote Training Flow
```
Quote Builder Upload
   ↓
Stored in database (uploadedFile.kind = SUPPLIER_QUOTE)
   ↓
User clicks "Train on All Uploaded Files"
   ↓
API: /ml/train-supplier-quotes
   ↓
Fetches files, generates signed URLs
   ↓
ML Service: /train endpoint
   ↓
Downloads PDFs, extracts text, parses
   ↓
Saves to ml_training_data
   ↓
Logs session to ml_training_history
   ↓
Returns results to UI
```

### Email Training Flow (Client Quotes)
```
User clicks "Start Training"
   ↓
API: /ml/start-email-training
   ↓
ML Service: EmailTrainingWorkflow
   ↓
Connect to Gmail/M365
   ↓
Search: has:attachment filename:pdf "estimate OR quotation"
   ↓
Download PDFs, extract text
   ↓
Parse as client quotes
   ↓
Save to ml_training_data with email metadata
   ↓
Log session to ml_training_history
   ↓
Return: quotes found, records saved
```

### Manual Upload Flow (Individual Files)
```
User drags PDF to upload zone
   ↓
Convert to base64
   ↓
API: /ml/upload-quote-training
   ↓
ML Service validates and parses
   ↓
Saves to ml_training_data
   ↓
Returns: confidence, quote_type, training_records_saved
   ↓
UI shows success with details
```

## Training Statistics

**Available via**: `db_manager.get_training_stats(tenantId)`

Returns:
- `total_examples`: Total training records for tenant
- `unique_types`: Count of distinct quote types
- `avg_confidence`: Average parser confidence
- `last_trained`: Timestamp of most recent training session

**Future enhancement**: Display these stats in the AI Training Hub UI.

## Database Manager (`ml/db_config.py`)

### Key Methods

#### `save_training_data(records: List[Dict])`
Batch insert training records.

**Example**:
```python
records = [
    {
        'tenant_id': 'abc123',
        'parsed_data': json.dumps(parsed_result),
        'quote_type': 'supplier',
        'confidence': 0.95,
        'estimated_total': 15670.00,
        'project_type': 'windows',
        'source_file_id': 'file_xyz'
    }
]
db_manager.save_training_data(records)
```

#### `log_training_session(...)`
Log a training session to history.

**Example**:
```python
db_manager.log_training_session(
    tenant_id='abc123',
    training_type='manual_upload',
    quotes_processed=47,
    training_records_created=47,
    duration_seconds=12.5,
    status='completed'
)
```

#### `get_training_stats(tenant_id)`
Get aggregated statistics.

**Returns**:
```python
{
    'total_examples': 347,
    'unique_types': 2,  # supplier, client
    'avg_confidence': 0.87,
    'last_trained': '2024-01-15T14:32:00Z'
}
```

## Configuration

### Environment Variables

#### API Service (`api/.env`)
```bash
ML_URL=https://ml-service.onrender.com
ML_TIMEOUT_MS=120000  # 2 minutes default, 5 minutes for batch training
```

#### ML Service (`ml/.env`)
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
EMAIL_TRAINING_AVAILABLE=true  # Enable email features

# Email OAuth (optional)
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
MS365_CLIENT_ID=...
MS365_CLIENT_SECRET=...
```

### Feature Flags

**Early Access Required**: AI Training Hub only visible to users with `isEarlyAdopter=true`.

**Email Training**: Only enabled if `EMAIL_TRAINING_AVAILABLE=true` and database connection succeeds.

## Testing the System

### 1. Test Supplier Training

1. Go to Quote Builder, upload supplier PDFs
2. Go to Settings → AI Training
3. Select "🏭 Supplier Quote" type
4. Click "🚀 Train on All Uploaded Files"
5. Watch progress: "Training on uploaded supplier quotes..."
6. Success shows: "Processed 47 supplier quotes, created 47 training records"

### 2. Test Email Training

1. Go to Settings → AI Training
2. Email Quote Discovery section (green)
3. Select provider: Gmail or Microsoft 365
4. Set days back: 30
5. Click "🔍 Preview Quotes" to test (doesn't save)
6. Click "🚀 Start Training" to actually save
7. Success shows: "Found 12 quotes, created 12 training records"

### 3. Test Manual Upload

1. Go to Settings → AI Training
2. Manual Quote Training section (purple)
3. Select quote type: Supplier or Client
4. Drag a PDF into the upload zone
5. Watch upload progress bar
6. Success shows: ✅ Confidence: 95% • supplier quote • 1 training record saved

### 4. Verify Database

```sql
-- Check training data
SELECT COUNT(*), quote_type, AVG(confidence)
FROM ml_training_data
WHERE tenant_id = 'your_tenant_id'
GROUP BY quote_type;

-- Check training history
SELECT * FROM ml_training_history
WHERE tenant_id = 'your_tenant_id'
ORDER BY created_at DESC
LIMIT 10;
```

## Troubleshooting

### "ML service unavailable"
- Check ML_URL is set correctly
- Verify ML service is running on Render
- Check logs: `render logs ml-service`

### "No supplier files found to train on"
- Upload some PDFs in Quote Builder first
- Ensure files have `kind=SUPPLIER_QUOTE`
- Check date range (only last 90 days)

### "Email training failed"
- Verify EMAIL_TRAINING_AVAILABLE=true in ML service
- Check database connection
- Ensure OAuth tokens are valid
- Check email provider credentials

### Training records not saved
- Check ML service logs for database errors
- Verify DATABASE_URL is correct
- Ensure ml_training_data table exists
- Check psycopg connection pool status

### Low confidence scores
- May indicate poor quality PDF scans
- Check PDF text extraction quality
- Try re-scanning documents at higher resolution
- Add more training examples to improve accuracy

## Future Enhancements

### Phase 1: Data Collection (DONE ✅)
- ✅ Store training examples in database
- ✅ Email ingestion for client quotes
- ✅ Manual upload for supplier quotes
- ✅ Training session tracking

### Phase 2: Model Retraining (DONE ✅)
- ✅ Load training data from ml_training_data table
- ✅ Extract features: area_m2, materials_grade, project_type, confidence
- ✅ Train RandomForest price prediction model
- ✅ Train RandomForest win probability model  
- ✅ Validate with train/test split (80/20)
- ✅ Calculate metrics: MAE (Mean Absolute Error), R² score
- ✅ Save models to models/price_model.joblib and models/win_model.joblib
- ✅ Save feature metadata with training statistics
- ✅ Reload models globally for immediate use
- ✅ Minimum 10 training samples required (configurable)

**How it works:**
1. Click "🎯 Train Models" in AI Training Hub
2. System loads all stored training data from database
3. Extracts features and prepares training dataset
4. Trains two RandomForest models (price + win probability)
5. Validates performance on test set
6. Saves models to disk for persistence
7. Reloads models immediately for predictions
8. Shows metrics: "Price MAE: £450 | R²: 0.92 | 47 training samples"

**Training Data Requirements:**
- Minimum 10 samples (can be configured with `minSamples` parameter)
- Must have `estimated_total > 0`
- Must have `confidence > 0.3` (filters out low-quality parses)
- Automatically handles missing features with sensible defaults

**Model Performance:**
- **Price MAE**: How far predictions are from actual prices (lower is better)
  - £200-500: Excellent
  - £500-1000: Good  
  - £1000+: Needs more training data
- **R² Score**: How well model explains variance (0-1, higher is better)
  - 0.9+: Excellent fit
  - 0.7-0.9: Good fit
  - <0.7: Needs improvement

### Phase 3: UI Improvements (IN PROGRESS �)
- Display training statistics in dashboard
- Show training history timeline
- Add "Recent Training Sessions" list
- Progress bars for batch operations
- Export training data as CSV

### Phase 4: Advanced Features (FUTURE 🚀)
- Active learning: Flag low-confidence predictions for review
- A/B testing: Compare model versions
- Performance metrics: Accuracy, precision, recall over time
- Automated retraining: Trigger when new data threshold reached
- Training data quality checks: Detect outliers, duplicates

## Summary

The AI Training system is now fully functional with:

✅ **Supplier quote training** from uploaded files  
✅ **Email ingestion** for client quotes  
✅ **Database storage** for all training examples  
✅ **Session tracking** for audit and monitoring  
✅ **Batch processing** for efficiency  
✅ **Actual model retraining** from stored data  
✅ **sklearn RandomForest models** for price and win prediction  
✅ **Model validation** with MAE and R² metrics  
✅ **Graceful fallbacks** for development without database  

### Complete Training Workflow

**Step 1: Collect Training Data**
- Upload supplier PDFs in Quote Builder (stored as SUPPLIER_QUOTE files)
- Scan Gmail/M365 for client quotes (Email Quote Discovery)
- Manually upload PDFs (drag-and-drop in AI Training Hub)
- All stored in `ml_training_data` table with metadata

**Step 2: Train Models** 
- Click "🎯 Train Models" in AI Training Hub
- System loads stored training data from database
- Extracts features (area, materials, project type)
- Trains RandomForest models (price + win probability)
- Validates on test set (80/20 split)
- Saves models to disk: `models/price_model.joblib`, `models/win_model.joblib`
- Shows metrics: MAE, R², training samples count

**Step 3: Get Predictions**
- Click "Generate ML estimate" in Quote Builder
- System checks for trained models
- If models exist: uses trained RandomForest predictions ✅
- If no models: uses training data statistics (fallback)
- If no data: uses simple area-based formula (last resort)
- Returns: predicted price, win probability, confidence

### Model Training Algorithm

The retraining process:

1. **Load Data**: Query `ml_training_data` WHERE `estimated_total > 0` AND `confidence > 0.3`
2. **Extract Features**: 
   - `area_m2` from questionnaire or parsed data (default: 30.0)
   - `materials_grade`: Premium/Standard/Basic (default: Standard)
   - `project_type`: windows/doors/other
   - `confidence`: parser confidence score
3. **Encode Categoricals**:
   - One-hot encode materials_grade (3 binary features)
   - Binary encode project_type (windows, doors flags)
4. **Prepare Targets**:
   - `y_price`: quoted_price or estimated_total
   - `y_win`: estimated win probability based on confidence + price range
5. **Train/Test Split**: 80% train, 20% test (random_state=42)
6. **Train Models**:
   - **Price Model**: RandomForestRegressor(n_estimators=100, max_depth=10)
   - **Win Model**: RandomForestRegressor(n_estimators=100, max_depth=8)
7. **Validate**: Calculate MAE and R² on test set
8. **Save**: joblib.dump() to models/ directory
9. **Reload**: Update global price_model and win_model variables

### Feature Engineering

Current features (v1.0):
- `area_m2`: Project area in square meters
- `materials_grade_Premium`: 1 if Premium, else 0
- `materials_grade_Standard`: 1 if Standard, else 0
- `materials_grade_Basic`: 1 if Basic, else 0
- `project_type_windows`: 1 if contains "window", else 0
- `project_type_doors`: 1 if contains "door", else 0
- `confidence`: Parser confidence (0-1)

Future enhancements:
- Lead source (referral, website, etc.)
- Region/location
- Number of windows/doors
- Timber species
- Glazing type (double/triple)
- Compliance requirements (building regs, etc.)

The foundation is in place for continuous model improvement. As you collect more training examples, the ML models will become more accurate at predicting prices and win probabilities.

**Next step**: Add UI to display model version, last trained date, and performance metrics in the dashboard.
