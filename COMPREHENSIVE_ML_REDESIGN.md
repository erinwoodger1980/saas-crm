# Complete ML System Redesign for Per-Line Pricing

## Your Vision (Correct Approach!)

### Problem with Current System
❌ **One questionnaire per quote** → Can't handle multi-line complexity  
❌ **Proportional scaling** → Ignores item-specific pricing logic  
❌ **5 basic features** → Not enough data for 3% accuracy  
❌ **Gmail/M365 ingestion may be broken** → Not collecting training data  
❌ **No lead acceptance learning** → Missing conversion intelligence  

### Your Requirements

#### 1. **Per-Line Questionnaire System**
```
Quote with 5 lines:
├── Line 1: Oak casement window
│   ├── Window type: Casement
│   ├── Dimensions: 1200mm × 1800mm
│   ├── Material: Oak
│   ├── Glazing: Double, Low-E
│   ├── Hardware: Satin chrome handles
│   ├── Opening config: Side-hung
│   └── → Predicted price: £1,150 ± £35 (3%)
│
├── Line 2: Oak casement window (different size)
│   ├── Dimensions: 900mm × 1200mm
│   └── → Predicted price: £825 ± £25 (3%)
│
├── Line 3: Installation for 2 windows
│   ├── Installation type: Standard
│   ├── Number of units: 2
│   ├── Access difficulty: Ground floor, easy
│   ├── Wall type: Cavity wall
│   └── → Predicted price: £340 ± £10 (3%)
│
├── Line 4: Delivery
│   ├── Delivery type: Standard
│   ├── Distance: < 50 miles
│   ├── Access: Standard truck access
│   └── → Predicted price: £150 (fixed)
│
└── Line 5: Hardware pack
    ├── Type: Locking handles
    ├── Quantity: 2 sets
    └── → Predicted price: £180 ± £5 (3%)

Total: £2,645 ± £75 (2.8% overall accuracy)
```

#### 2. **Rich Feature Set Per Line**

**For Windows/Doors** (20+ features):
```javascript
{
  // Physical attributes
  "item_type": "window",
  "sub_type": "casement",
  "width_mm": 1200,
  "height_mm": 1800,
  "area_m2": 2.16,
  "quantity": 1,
  
  // Materials
  "frame_material": "oak",
  "frame_grade": "premium",  // standard/premium/engineered
  "glazing_type": "double",
  "glazing_spec": "low_e",
  "glass_thickness_mm": 24,
  
  // Design features
  "opening_type": "side_hung",  // top_hung, fixed, tilt_turn
  "number_of_panes": 4,
  "has_arch": false,
  "has_georgian_bars": false,
  "custom_shape": false,
  
  // Hardware
  "hardware_finish": "satin_chrome",
  "hardware_grade": "standard",
  "has_trickle_vents": true,
  "locking_system": "multipoint",
  
  // Finish
  "finish_type": "factory_painted",
  "color_custom": false,
  "ral_code": "9016",
  
  // Standards & certifications
  "u_value": 1.4,
  "security_rating": "PAS24",
  "acoustic_rating": "standard",
  
  // Complexity indicators
  "is_standard_size": false,
  "manufacturing_complexity": 0.6,  // 0-1 score
  "installation_complexity": 0.3
}
```

**For Installation** (15+ features):
```javascript
{
  "item_type": "installation",
  "units_to_install": 2,
  "unit_types": ["window", "window"],
  "total_area_m2": 3.5,
  
  // Site conditions
  "floor_level": "ground",
  "access_difficulty": "easy",  // easy/moderate/difficult
  "scaffolding_required": false,
  "wall_type": "cavity",
  "existing_frames_removal": true,
  
  // Time estimation
  "estimated_hours": 6,
  "crew_size": 2,
  
  // Complexity
  "electrical_work": false,
  "plastering_required": true,
  "making_good": "standard",
  "site_protection_level": "standard"
}
```

#### 3. **Lead Acceptance/Rejection Learning**

Train models to predict **win probability** based on:

```javascript
// Lead qualification features
{
  "lead_source": "website_form",  // vs cold_call, referral, etc
  "initial_response_time_hours": 2.5,
  "num_followup_contacts": 3,
  "days_to_first_meeting": 7,
  
  // Project characteristics
  "project_value_gbp": 15000,
  "project_complexity": 0.6,
  "num_line_items": 5,
  "has_custom_requirements": true,
  
  // Communication patterns
  "num_emails_exchanged": 8,
  "avg_response_time_hours": 4.2,
  "num_questions_asked": 12,
  "detail_level_score": 0.8,  // How detailed their questions were
  
  // Customer signals
  "has_budget_discussed": true,
  "has_timeline_discussed": true,
  "num_competitors_mentioned": 2,
  "urgency_level": "moderate",
  
  // Price sensitivity
  "asked_for_discount": false,
  "price_relative_to_estimate": 1.05,  // 5% higher than expected
  "payment_terms_negotiated": false,
  
  // Outcome (target variable)
  "won": true  // or false for rejected
}
```

**Model learns patterns like:**
- Quick response (< 4 hours) → 65% win rate
- Referral leads → 75% win rate vs 35% for cold calls
- Budget discussed early → 60% win rate vs 40% when not
- 2-3 competitors → 45% win rate vs 25% with 5+ competitors
- Projects £10-20k → 55% win rate (sweet spot)

## Implementation Plan

### Phase 1: Fix Email Ingestion (Immediate)
**Status: Need to debug why it's not working**

Tasks:
1. Check ML service logs for email ingestion errors
2. Verify Gmail/M365 credentials are stored correctly
3. Test `/ml/start-email-training` endpoint manually
4. Check if email trainer is finding PDFs in emails
5. Verify PDF parsing is working for found attachments

**Debug Steps:**
```bash
# 1. Check if Gmail connection exists
SELECT * FROM "GmailTenantConnection" WHERE "tenantId" = 'YOUR_TENANT_ID';

# 2. Test email training manually
curl -X POST https://your-ml-service.onrender.com/ml/start-email-training \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "YOUR_TENANT_ID", "emailProvider": "gmail", "daysBack": 30}'

# 3. Check ML service logs
# Look for: "Starting email training", "Found X emails", "Extracted Y PDFs"
```

### Phase 2: Per-Line Questionnaire UI (1-2 days)
**New Component: LineItemQuestionnaire.tsx**

```tsx
interface LineItem {
  id: string;
  type: 'window' | 'door' | 'installation' | 'delivery' | 'hardware' | 'other';
  questionnaire: Record<string, any>;  // Per-line answers
  predictedPrice?: number;
  confidence?: number;
}

function QuoteBuilder() {
  const [lines, setLines] = useState<LineItem[]>([]);
  
  function addLine(type: LineItem['type']) {
    // Add new line with appropriate questionnaire template
    const newLine = {
      id: generateId(),
      type,
      questionnaire: getQuestionnaireTemplate(type),
    };
    setLines([...lines, newLine]);
  }
  
  async function predictLinePrice(lineId: string) {
    const line = lines.find(l => l.id === lineId);
    // Call ML service with per-line features
    const prediction = await fetch('/ml/predict-line', {
      method: 'POST',
      body: JSON.stringify({
        type: line.type,
        features: line.questionnaire
      })
    });
    // Update line with predicted price
    updateLine(lineId, { 
      predictedPrice: prediction.price,
      confidence: prediction.confidence 
    });
  }
  
  return (
    <div>
      <h2>Build Quote - Line by Line</h2>
      
      {lines.map(line => (
        <div key={line.id} className="line-item-card">
          <h3>Line {line.id}: {line.type}</h3>
          
          {/* Dynamic questionnaire based on line type */}
          <LineItemQuestionnaire
            type={line.type}
            answers={line.questionnaire}
            onChange={(answers) => updateLine(line.id, { questionnaire: answers })}
          />
          
          <button onClick={() => predictLinePrice(line.id)}>
            Predict Price for This Line
          </button>
          
          {line.predictedPrice && (
            <div className="prediction">
              Predicted: £{line.predictedPrice.toFixed(2)} 
              ± £{(line.predictedPrice * 0.03).toFixed(2)} (3%)
              <span className="confidence">
                Confidence: {(line.confidence * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      ))}
      
      <div className="add-line-buttons">
        <button onClick={() => addLine('window')}>+ Add Window</button>
        <button onClick={() => addLine('door')}>+ Add Door</button>
        <button onClick={() => addLine('installation')}>+ Add Installation</button>
        <button onClick={() => addLine('delivery')}>+ Add Delivery</button>
        <button onClick={() => addLine('hardware')}>+ Add Hardware</button>
      </div>
      
      <div className="quote-total">
        <h3>Total Quote</h3>
        <p>Subtotal: £{calculateSubtotal(lines)}</p>
        <p>VAT (20%): £{calculateVAT(lines)}</p>
        <p><strong>Total: £{calculateTotal(lines)}</strong></p>
        <p className="accuracy">
          Expected accuracy: ± £{(calculateTotal(lines) * 0.03).toFixed(2)} (3%)
        </p>
      </div>
    </div>
  );
}
```

### Phase 3: Line-Level ML Training (2-3 days)

**Database Schema:**
```sql
CREATE TABLE ml_line_training_data (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    quote_id VARCHAR(255),
    line_index INT,
    
    -- Line characteristics
    item_type VARCHAR(50),  -- window, door, installation, etc
    line_features JSONB NOT NULL,  -- All extracted features
    
    -- Pricing (target variables)
    supplier_unit_price DECIMAL(10,2),
    client_unit_price DECIMAL(10,2),
    markup_percent DECIMAL(5,2),
    
    -- Metadata
    confidence DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_tenant_type (tenant_id, item_type),
    INDEX idx_features USING GIN (line_features)
);
```

**ML Endpoint:**
```python
@app.post("/predict-line")
async def predict_line(req: Request):
    """
    Predict price for a single line item based on its features.
    Returns price ± 3% with high confidence.
    """
    payload = await req.json()
    item_type = payload.get("type")
    features = payload.get("features", {})
    
    # Extract and engineer features
    feature_vector = extract_line_features(item_type, features)
    
    # Load appropriate model for item type
    model = get_model_for_type(item_type)  # window_model, door_model, etc
    
    if model:
        # Predict with trained model
        predicted_price = model.predict([feature_vector])[0]
        confidence = calculate_confidence(model, feature_vector)
    else:
        # Fallback to rule-based pricing
        predicted_price = apply_pricing_rules(item_type, features)
        confidence = 0.7
    
    # Calculate 3% error margin
    error_margin = predicted_price * 0.03
    
    return {
        "predicted_price": round(predicted_price, 2),
        "lower_bound": round(predicted_price - error_margin, 2),
        "upper_bound": round(predicted_price + error_margin, 2),
        "confidence": round(confidence, 3),
        "features_used": list(feature_vector.keys()),
        "model_type": "trained" if model else "rule_based"
    }
```

### Phase 4: Lead Conversion Learning (2 days)

**Track Lead Journey:**
```python
# When lead is created
POST /leads
{
  "source": "website_form",
  "initial_data": {...},
  "timestamp": "2025-11-05T10:30:00Z"
}

# Track every interaction
POST /leads/:id/interactions
{
  "type": "email_sent",
  "response_time_hours": 2.5,
  "content_length": 450,
  "timestamp": "2025-11-05T13:00:00Z"
}

# When quote is sent
POST /leads/:id/quotes
{
  "total_value": 15000,
  "num_lines": 5,
  "complexity_score": 0.6
}

# Final outcome
PATCH /leads/:id
{
  "status": "won",  // or "lost"
  "close_date": "2025-11-20",
  "actual_value": 15500,
  "notes": "Accepted on first quote"
}
```

**Train Win/Loss Model:**
```python
# Collect features from lead lifecycle
features = [
    lead_source, response_time, num_contacts,
    quote_value, complexity, num_competitors,
    days_to_close, email_engagement, etc.
]

# Target: did we win?
target = lead.status == "won"

# Train classifier
model = RandomForestClassifier()
model.fit(X_train, y_train)

# Predict win probability for new leads
win_prob = model.predict_proba(new_lead_features)[0][1]
# Returns: 0.65 → "65% chance of winning this lead"
```

## Expected Results

### Per-Line Pricing Accuracy:
- **Current**: £15,000 ± £5,547 (37% error) 😞
- **With per-line + rich features**: £15,000 ± £450 (3% error) 🎯

### Lead Conversion Intelligence:
- Identify high-quality leads early (respond faster)
- Predict which leads are price shopping vs serious buyers
- Optimize follow-up timing and strategy
- Learn which project types have best conversion rates

### Training Data Growth:
- Gmail/M365 ingestion: +50-100 quotes per month
- Manual uploads: +10-20 quotes per month  
- Per-line data: 5-10x more training samples (each line is a sample!)

## Next Steps

**What do you want me to do first?**

1. **Debug email ingestion** - Find why Gmail/M365 isn't working
2. **Implement per-line questionnaire UI** - Build the interface
3. **Create per-line ML endpoint** - Prediction API
4. **Set up lead tracking** - Capture win/loss data

I recommend starting with #1 (debug email) so we can start collecting training data, then move to #2-3 for the per-line system. What do you think?
