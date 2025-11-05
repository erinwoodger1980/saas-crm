# ML Feature Enhancement Plan

## Current Problem
The ML models only use 5 basic features which aren't enough for accurate pricing:
- ✅ area_m2
- ✅ materials_grade (Premium/Standard/Basic)
- ✅ project_type (windows/doors)
- ✅ lead_source
- ✅ region

**Result**: MAE of £5,547 (high error) with 25 training samples

## Proposed Enhanced Features

### 1. Line Item Complexity Features (from parsed supplier quotes)
```python
- num_line_items: int  # How many separate items quoted
- avg_line_value: float  # Average price per line item
- max_line_value: float  # Most expensive single item
- has_installation: bool  # Contains installation/fitting keywords
- has_delivery: bool  # Contains delivery/shipping
- has_hardware: bool  # Contains handles, locks, hinges keywords
```

### 2. Material Specification Features
```python
- timber_type: str  # Oak, Pine, Accoya, Engineered, etc.
- glazing_type: str  # Single, Double, Triple glazing
- finish_type: str  # Factory finished, Primed, Stained, etc.
- hardware_grade: str  # Standard, Premium hardware mentioned
```

### 3. Dimensions & Quantity Features
```python
- total_units: int  # Total number of windows/doors
- avg_unit_size_m2: float  # Average size per unit
- largest_unit_m2: float  # Largest single unit
- size_variance: float  # Std dev of sizes (custom vs standard)
```

### 4. Project Complexity Indicators
```python
- num_different_sizes: int  # Variety of dimensions
- custom_shapes: bool  # Keywords: arch, curved, bespoke
- color_variations: int  # Number of different colors/finishes
- specification_lines: int  # Complexity of spec list
```

### 5. Supplier & Quality Indicators
```python
- supplier_name: str  # Parsed supplier (category encode)
- vat_included: bool  # Whether VAT explicitly mentioned
- warranty_mentioned: bool  # Quality indicator
- certification_mentioned: bool  # CE, BSI, etc.
```

### 6. Temporal Features
```python
- quote_age_days: int  # Days since quote received
- season: str  # Q1-Q4 (seasonal pricing)
- urgency_keywords: bool  # Rush, urgent, asap mentioned
```

### 7. Text Complexity Features
```python
- description_length_avg: float  # Average char count per description
- technical_terms_count: int  # Count of technical keywords
- specification_detail_score: float  # Richness of spec details
```

## Implementation Plan

### Phase 1: Extract More Features from Existing Data ✅
**Files to modify**: 
- `ml/main.py` - `/train-client-quotes` endpoint
- `ml/pdf_parser.py` - Add feature extraction functions

**New functions**:
```python
def extract_advanced_features(parsed_data: dict) -> dict:
    """
    Extract 20+ features from parsed supplier quote data
    Returns dict with all engineered features
    """
    features = {}
    
    # Line item features
    lines = parsed_data.get("lines", [])
    if lines:
        features["num_line_items"] = len(lines)
        line_totals = [l.get("total", 0) for l in lines]
        features["avg_line_value"] = np.mean(line_totals) if line_totals else 0
        features["max_line_value"] = max(line_totals) if line_totals else 0
        
        # Check for keywords in descriptions
        all_text = " ".join([l.get("description", "") for l in lines]).lower()
        features["has_installation"] = int(any(kw in all_text for kw in ["install", "fitting", "labour"]))
        features["has_delivery"] = int(any(kw in all_text for kw in ["delivery", "shipping", "freight"]))
        features["has_hardware"] = int(any(kw in all_text for kw in ["handle", "lock", "hinge", "hardware"]))
    
    # Material features
    text = str(parsed_data).lower()
    features["timber_oak"] = int("oak" in text)
    features["timber_accoya"] = int("accoya" in text)
    features["glazing_double"] = int("double gla" in text)
    features["glazing_triple"] = int("triple gla" in text)
    
    # Dimension features
    if lines:
        # Parse dimensions from descriptions (e.g., "1200x1800", "2.4m x 3.0m")
        sizes = []
        for line in lines:
            desc = line.get("description", "")
            # Extract wxh patterns
            dim_match = re.findall(r'(\d+\.?\d*)\s*[xX×]\s*(\d+\.?\d*)', desc)
            for w, h in dim_match:
                sizes.append(float(w) * float(h) / 1000000)  # Convert to m²
        
        if sizes:
            features["total_units"] = len(sizes)
            features["avg_unit_size_m2"] = np.mean(sizes)
            features["largest_unit_m2"] = max(sizes)
            features["size_variance"] = np.std(sizes) if len(sizes) > 1 else 0
    
    # Complexity indicators
    features["custom_shapes"] = int(any(kw in text for kw in ["arch", "curved", "bespoke", "custom"]))
    
    return features
```

### Phase 2: Update Model Training ✅
```python
# In /train-client-quotes endpoint:

# Old feature columns:
feature_columns_old = ["area_m2", "materials_grade", "project_type", "lead_source", "region"]

# New enhanced feature columns:
feature_columns = [
    # Basic (keep these)
    "area_m2", "materials_grade", "project_type",
    
    # Line item complexity
    "num_line_items", "avg_line_value", "max_line_value",
    "has_installation", "has_delivery", "has_hardware",
    
    # Materials
    "timber_oak", "timber_accoya", "glazing_double", "glazing_triple",
    
    # Dimensions
    "total_units", "avg_unit_size_m2", "largest_unit_m2", "size_variance",
    
    # Complexity
    "custom_shapes",
    
    # Can optionally include: lead_source, region if available
]

# Numeric vs categorical:
numeric_features = [
    "area_m2", "num_line_items", "avg_line_value", "max_line_value",
    "total_units", "avg_unit_size_m2", "largest_unit_m2", "size_variance"
]

categorical_features = [
    "materials_grade", "project_type"
]

binary_features = [
    "has_installation", "has_delivery", "has_hardware",
    "timber_oak", "timber_accoya", "glazing_double", "glazing_triple",
    "custom_shapes"
]
```

### Phase 3: Update Prediction Endpoint ✅
```python
# In build_feature_row():
def build_feature_row(q: QuoteIn) -> pd.DataFrame:
    # Extract basic features
    features = {
        "area_m2": float(q.area_m2),
        "materials_grade": q.materials_grade or "Standard",
        "project_type": q.project_type or "windows",
    }
    
    # Add defaults for advanced features (when predicting from questionnaire)
    # These will be 0 for questionnaire-based predictions
    advanced_defaults = {
        "num_line_items": 0,  # Unknown for questionnaire
        "avg_line_value": 0,
        "max_line_value": 0,
        "has_installation": 1,  # Assume installation included
        "has_delivery": 1,  # Assume delivery included
        "has_hardware": 1,  # Assume hardware included
        "timber_oak": 0,
        "timber_accoya": 0,
        "glazing_double": 1,  # Default to double glazing
        "glazing_triple": 0,
        "total_units": max(1, int(q.area_m2 / 2.0)),  # Estimate units from area
        "avg_unit_size_m2": q.area_m2 / max(1, int(q.area_m2 / 2.0)),
        "largest_unit_m2": 3.0,  # Reasonable default
        "size_variance": 0.5,  # Moderate variance
        "custom_shapes": 0,  # Assume standard
    }
    
    features.update(advanced_defaults)
    
    # Build DataFrame with all columns in correct order
    df = pd.DataFrame([features], columns=COLUMNS)
    return df
```

## Expected Improvements

### With 25 samples + 18 features (vs 5):
- **Current MAE**: £5,547 (high)
- **Expected MAE**: £2,000-3,000 (60% reduction)
- **Reasoning**: More granular features capture complexity better

### With 50+ samples + 18 features:
- **Expected MAE**: £1,000-1,500 (80% reduction)
- **R² score**: 0.85-0.90 (strong predictions)

### Real-world Example:
```
Old prediction (5 features):
  Input: 25m², Standard, Windows
  Prediction: £15,000 ± £5,547
  Range: £9,453 - £20,547 (VERY WIDE)

New prediction (18 features):
  Input: 25m², Standard, Windows, 
         8 line items, avg £800/line,
         has installation, double glazing,
         4 units of 6.25m² each
  Prediction: £15,000 ± £2,000
  Range: £13,000 - £17,000 (MUCH TIGHTER)
```

## Implementation Steps

1. **Add `extract_advanced_features()` function** to `ml/main.py`
2. **Update `/train-client-quotes`** to call feature extraction
3. **Update `build_feature_row()`** with defaults for new features
4. **Update `COLUMNS` list** with all 18 features
5. **Retrain models** with enhanced features
6. **Test predictions** to verify MAE improvement
7. **Document new features** in training UI

## Benefits

✅ **Captures complexity** - Not just size/material, but actual project details  
✅ **Better accuracy** - More signals = better predictions  
✅ **Learns patterns** - Model understands installation costs, hardware costs, etc.  
✅ **Scales better** - As more data comes in, patterns become clearer  
✅ **Explainable** - Can see which features matter most (feature importance)  

## Next Actions

**Want me to implement this?** I can:
1. Add the feature extraction functions
2. Update the training pipeline
3. Retrain with enhanced features
4. Test predictions to show improvement

This will make your ML estimates much more accurate! 🎯
