# Per-Line Pricing Implementation Plan

## Current Problem
The system only predicts **overall quote total** and then scales all lines proportionally:
```python
# Current approach (WRONG):
predicted_total = £15,000
cost_sum = £10,000
scale = 15000 / 10000 = 1.5
# All lines get same 1.5x multiplier regardless of what they are!
```

This doesn't work because:
- ❌ Installation costs don't scale linearly with materials
- ❌ Delivery is often fixed cost, not % of materials  
- ❌ Hardware markup is different from timber markup
- ❌ Custom items have different margins than standard items

## New Approach: Per-Line Pricing Model

### 1. Extract Line-Level Features
For each line item in a supplier quote:
```python
{
  "description": "Oak casement window 1200x1800mm",
  "qty": 2,
  "supplier_unit_price": 850.00,
  "supplier_total": 1700.00,
  
  # Extract these features:
  "line_features": {
    "item_type": "window",  # window, door, hardware, installation, delivery
    "material": "oak",  # oak, pine, accoya, upvc, aluminium
    "dimensions_w": 1200,  # width in mm
    "dimensions_h": 1800,  # height in mm
    "area_m2": 2.16,  # calculated from dimensions
    "is_custom_size": true,  # vs standard size
    "has_glazing": true,
    "is_installation": false,
    "is_delivery": false,
    "is_hardware": false,
    "description_length": 35,  # character count
    "technical_complexity": 0.7  # 0-1 score
  },
  
  # Target (what we want to learn):
  "client_unit_price": 1150.00,  # What was actually quoted to client
  "markup_percent": 35.3,  # Calculated: (1150-850)/850
  "markup_absolute": 300.00  # 1150 - 850
}
```

### 2. Train Per-Line Model
Instead of predicting quote totals, predict **markup per line**:

```python
# Model input: line features
X = [
    item_type (categorical),
    material (categorical),
    area_m2 (numeric),
    is_custom_size (binary),
    has_glazing (binary),
    is_installation (binary),
    is_delivery (binary),
    supplier_unit_price (numeric),
    description_length (numeric),
    technical_complexity (numeric)
]

# Model output: markup
y = markup_percent  # or markup_absolute

# Model learns patterns like:
# - Windows: 30-40% markup
# - Doors: 25-35% markup  
# - Installation: 50-70% markup (more labor intensive)
# - Delivery: Fixed £200-400 (not percentage based!)
# - Hardware: 40-60% markup (small items, higher margin)
# - Custom sizes: +5-10% extra markup
# - Oak material: +5% vs pine
```

### 3. Database Schema Changes

```sql
-- New table for line-level training data
CREATE TABLE ml_line_training_data (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(255),
    quote_id VARCHAR(255),  -- Reference to parent quote
    line_index INT,  -- Position in quote
    
    -- Line characteristics
    description TEXT,
    qty DECIMAL,
    supplier_unit_price DECIMAL,
    supplier_total DECIMAL,
    client_unit_price DECIMAL,  -- Target to predict
    client_total DECIMAL,
    
    -- Extracted features (JSONB for flexibility)
    line_features JSONB,  -- All the feature extraction
    
    -- Metadata
    confidence DECIMAL,
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_tenant (tenant_id),
    INDEX idx_features (line_features)  -- GIN index for JSONB queries
);
```

### 4. Feature Extraction Function

```python
def extract_line_features(line_dict: dict) -> dict:
    """
    Extract ML features from a single line item.
    Returns dict with all engineered features.
    """
    desc = line_dict.get("description", "").lower()
    qty = float(line_dict.get("qty", 1))
    unit_price = float(line_dict.get("unit_price", 0))
    
    features = {}
    
    # Item type classification
    if any(kw in desc for kw in ["window", "casement", "sash"]):
        features["item_type"] = "window"
    elif any(kw in desc for kw in ["door", "entrance", "french"]):
        features["item_type"] = "door"
    elif any(kw in desc for kw in ["install", "fitting", "labour", "labor"]):
        features["item_type"] = "installation"
    elif any(kw in desc for kw in ["delivery", "shipping", "freight", "transport"]):
        features["item_type"] = "delivery"
    elif any(kw in desc for kw in ["handle", "lock", "hinge", "hardware"]):
        features["item_type"] = "hardware"
    elif any(kw in desc for kw in ["glass", "glazing", "pane"]):
        features["item_type"] = "glazing"
    else:
        features["item_type"] = "other"
    
    # Material detection
    if "oak" in desc:
        features["material"] = "oak"
    elif "accoya" in desc:
        features["material"] = "accoya"
    elif "pine" in desc:
        features["material"] = "pine"
    elif "upvc" in desc or "pvc" in desc:
        features["material"] = "upvc"
    elif "aluminium" in desc or "aluminum" in desc:
        features["material"] = "aluminium"
    else:
        features["material"] = "unknown"
    
    # Dimensions extraction (1200x1800, 2.4m x 3.0m, etc.)
    dim_patterns = [
        r'(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)\s*mm',  # 1200x1800mm
        r'(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)\s*m',   # 2.4x3.0m
        r'(\d{3,4})[xX×](\d{3,4})',  # 1200x1800 (assume mm)
    ]
    
    width_mm, height_mm = None, None
    for pattern in dim_patterns:
        match = re.search(pattern, desc)
        if match:
            w, h = float(match.group(1)), float(match.group(2))
            if 'm' in pattern:  # meters, convert to mm
                w, h = w * 1000, h * 1000
            width_mm, height_mm = w, h
            break
    
    features["width_mm"] = width_mm or 0
    features["height_mm"] = height_mm or 0
    features["area_m2"] = (width_mm * height_mm / 1000000) if (width_mm and height_mm) else 0
    
    # Size classification
    if features["area_m2"] > 0:
        # Standard UK window sizes
        standard_sizes = [
            (600, 900), (900, 1200), (1200, 1200), (1200, 1350),
            (1200, 1800), (1500, 1200), (1800, 1200)
        ]
        is_standard = any(
            abs(width_mm - sw) < 50 and abs(height_mm - sh) < 50
            for sw, sh in standard_sizes
        ) if (width_mm and height_mm) else False
        features["is_custom_size"] = not is_standard
    else:
        features["is_custom_size"] = False
    
    # Feature flags
    features["has_glazing"] = any(kw in desc for kw in ["glazing", "glass", "pane", "double", "triple"])
    features["is_installation"] = features["item_type"] == "installation"
    features["is_delivery"] = features["item_type"] == "delivery"
    features["is_hardware"] = features["item_type"] == "hardware"
    
    # Complexity indicators
    features["description_length"] = len(desc)
    features["has_arch"] = any(kw in desc for kw in ["arch", "curved", "radius"])
    features["has_color"] = any(kw in desc for kw in ["colour", "color", "painted", "stained"])
    
    # Calculate technical complexity score (0-1)
    complexity = 0.0
    if features["is_custom_size"]: complexity += 0.2
    if features["has_arch"]: complexity += 0.3
    if features["has_glazing"]: complexity += 0.1
    if features["material"] in ["oak", "accoya"]: complexity += 0.2
    if features["description_length"] > 50: complexity += 0.2
    features["technical_complexity"] = min(1.0, complexity)
    
    # Pricing context
    features["supplier_unit_price"] = unit_price
    features["qty"] = qty
    features["total_value"] = unit_price * qty
    
    return features


def store_line_training_data(
    db_manager,
    tenant_id: str,
    quote_id: str,
    supplier_lines: list,
    client_lines: list
):
    """
    Store line-by-line training data by matching supplier and client lines.
    """
    training_records = []
    
    for i, (supp_line, client_line) in enumerate(zip(supplier_lines, client_lines)):
        features = extract_line_features(supp_line)
        
        supplier_unit = float(supp_line.get("unit_price", 0))
        client_unit = float(client_line.get("unit_price", 0))
        
        if supplier_unit > 0 and client_unit > 0:
            markup_percent = ((client_unit - supplier_unit) / supplier_unit) * 100
            markup_absolute = client_unit - supplier_unit
            
            record = {
                'tenant_id': tenant_id,
                'quote_id': quote_id,
                'line_index': i,
                'description': supp_line.get("description"),
                'qty': float(supp_line.get("qty", 1)),
                'supplier_unit_price': supplier_unit,
                'supplier_total': supplier_unit * float(supp_line.get("qty", 1)),
                'client_unit_price': client_unit,
                'client_total': client_unit * float(client_line.get("qty", 1)),
                'line_features': json.dumps(features),
                'markup_percent': markup_percent,
                'markup_absolute': markup_absolute,
                'confidence': 0.8  # High confidence for matched lines
            }
            training_records.append(record)
    
    # Save to database
    if training_records:
        db_manager.save_line_training_data(training_records)
    
    return len(training_records)
```

### 5. Per-Line Prediction Endpoint

```python
@app.post("/predict-lines")
async def predict_lines(req: Request):
    """
    Predict client pricing for each line item in a quote.
    Returns per-line unit prices with markup applied.
    """
    payload = await req.json()
    lines = payload.get("lines", [])
    
    if not line_price_model:
        # Fallback to rule-based markup
        return apply_rule_based_markup(lines)
    
    predicted_lines = []
    for line in lines:
        # Extract features
        features = extract_line_features(line)
        
        # Build feature vector
        X = build_line_feature_vector(features)
        
        # Predict markup
        predicted_markup_percent = line_price_model.predict(X)[0]
        
        # Apply to supplier price
        supplier_unit = float(line.get("unit_price", 0))
        client_unit = supplier_unit * (1 + predicted_markup_percent / 100)
        
        predicted_lines.append({
            "description": line.get("description"),
            "qty": line.get("qty"),
            "supplier_unit_price": supplier_unit,
            "predicted_client_unit_price": round(client_unit, 2),
            "predicted_markup_percent": round(predicted_markup_percent, 1),
            "features_used": features
        })
    
    return {
        "lines": predicted_lines,
        "model_status": "active",
        "total_predicted": sum(l["predicted_client_unit_price"] * l["qty"] for l in predicted_lines)
    }


def apply_rule_based_markup(lines: list) -> dict:
    """
    Fallback: Apply sensible rule-based markup when model isn't trained.
    """
    predicted_lines = []
    
    for line in lines:
        desc = line.get("description", "").lower()
        supplier_unit = float(line.get("unit_price", 0))
        
        # Rule-based markup by item type
        if any(kw in desc for kw in ["install", "fitting", "labour"]):
            markup = 70  # 70% markup on installation (more labor)
        elif any(kw in desc for kw in ["delivery", "shipping"]):
            markup = 0  # Pass through delivery costs
            # Or add fixed amount: client_unit = supplier_unit + 50
        elif any(kw in desc for kw in ["handle", "lock", "hinge", "hardware"]):
            markup = 50  # 50% markup on small hardware
        elif any(kw in desc for kw in ["window", "door"]):
            if "oak" in desc or "accoya" in desc:
                markup = 35  # Premium materials
            else:
                markup = 28  # Standard markup
        else:
            markup = 30  # Default 30%
        
        client_unit = supplier_unit * (1 + markup / 100)
        
        predicted_lines.append({
            "description": line.get("description"),
            "qty": line.get("qty"),
            "supplier_unit_price": supplier_unit,
            "predicted_client_unit_price": round(client_unit, 2),
            "predicted_markup_percent": markup,
            "method": "rule_based"
        })
    
    return {
        "lines": predicted_lines,
        "model_status": "fallback_rules",
        "total_predicted": sum(l["predicted_client_unit_price"] * l["qty"] for l in predicted_lines)
    }
```

## Expected Improvements

### Current Approach (Proportional Scaling):
```
Supplier Line 1: Oak window £850 → Scale 1.5x → Client £1,275
Supplier Line 2: Installation £200 → Scale 1.5x → Client £300
Supplier Line 3: Delivery £150 → Scale 1.5x → Client £225
Total: £1,200 → £1,800

Problems:
❌ Installation should be 70% markup, not 50%
❌ Delivery should be pass-through or fixed, not 50%
❌ Window markup varies by material
```

### New Approach (Per-Line Prediction):
```
Supplier Line 1: Oak window £850 → Predict 35% markup → Client £1,148
Supplier Line 2: Installation £200 → Predict 70% markup → Client £340
Supplier Line 3: Delivery £150 → Predict 0% markup → Client £150
Total: £1,200 → £1,638

Benefits:
✅ Realistic margins per item type
✅ Learns from historical quotes
✅ Captures business logic (delivery, installation, etc.)
✅ More accurate overall total
```

## Implementation Priority

**Phase 1** (Do this now):
1. Add `extract_line_features()` function
2. Create `/predict-lines` endpoint with rule-based fallback
3. Update backend `/quotes/:id/price` to call `/predict-lines`
4. Test with existing quotes

**Phase 2** (After more training data):
5. Create `ml_line_training_data` table
6. Store line-level data during training
7. Train per-line pricing model
8. Replace rule-based fallback with model predictions

Want me to implement Phase 1 now?
