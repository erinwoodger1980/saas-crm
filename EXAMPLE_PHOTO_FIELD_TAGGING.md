# Example Photo Gallery - Complete Field Tagging System

## Overview

Example photos can now be tagged with answers to **ALL 30+ standard questionnaire fields**, enabling precise matching, filtering, and auto-filling for customer quotes.

## Architecture

### Database Models

**ExamplePhoto** (main photo record)
- Image data: `imageUrl`, `thumbnailUrl`
- Metadata: `title`, `description`, `tags[]`, `productType`
- Legacy quick-access fields: `widthMm`, `heightMm`, `timberSpecies`, etc.
- Analytics: `viewCount`, `selectionCount`

**ExamplePhotoFieldAnswer** (links to questionnaire fields)
- `examplePhotoId` → FK to ExamplePhoto
- `fieldId` → FK to QuestionnaireField
- `fieldKey` → Denormalized for quick lookup
- `value` → Stored as string, typed by field definition

### Benefits of Complete Field Tagging

1. **Precise Filtering**: Match examples by ANY questionnaire criteria
   - "Show me Premium Oak doors with double glazing"
   - "Find examples with curves and custom finish"
   
2. **Complete Auto-fill**: When customer selects example, ALL fields populate
   - Not just dimensions and species
   - Full context: grade, complexity, timeline, features
   
3. **Better ML Training**: Examples become complete training samples
   - Every field answered = better feature correlation
   - Real-world complete specifications
   
4. **Smart Matching**: Algorithm can find "most similar" examples
   - Compare customer's partial answers to tagged examples
   - Suggest closest matches

## API Endpoints

### Upload with Field Answers

```http
POST /example-photos/:tenantId/upload
Content-Type: multipart/form-data

{
  "image": <file>,
  "metadata": {
    "title": "Premium Oak Entrance Door",
    "description": "Solid oak with glazed panels",
    "tags": ["entrance", "external", "glazed"],
    "productType": "door",
    "priceGBP": 3500,
    
    // Complete questionnaire field answers
    "fieldAnswers": {
      "area_m2": "2.5",
      "materials_grade": "Premium",
      "project_type": "Doors",
      "door_type": "External Front Door",
      "door_height_mm": "2100",
      "door_width_mm": "900",
      "door_thickness_mm": "54",
      "num_doors": "1",
      "glazing_type": "Double Glazed",
      "timber_species": "Oak",
      "premium_hardware": "true",
      "custom_finish": "true",
      "has_curves": "false",
      "fire_rating": "None",
      "location_type": "External",
      "property_type": "Residential",
      "project_complexity": "Standard",
      "installation_required": "true",
      "timeline": "1-2 months",
      "budget_range": "£5,000 - £15,000"
      // ... any other standard fields
    }
  }
}
```

### Update Field Answers

```http
PATCH /example-photos/:photoId
Content-Type: application/json

{
  "title": "Updated title",
  "fieldAnswers": {
    "area_m2": "3.0",
    "materials_grade": "Standard"
    // Updates replace ALL existing answers
  }
}
```

### Get Field Answers

```http
GET /example-photos/:photoId/field-answers

Response:
{
  "area_m2": {
    "value": "2.5",
    "field": {
      "key": "area_m2",
      "label": "Project Area (m²)",
      "type": "NUMBER",
      "group": "Project Details"
    }
  },
  "materials_grade": {
    "value": "Premium",
    "field": {
      "key": "materials_grade",
      "label": "Materials Grade",
      "type": "SELECT",
      "options": ["Premium", "Standard", "Basic"],
      "group": "Project Details"
    }
  },
  // ... all other answered fields
}
```

### Select Example (Returns Complete Data)

```http
POST /example-photos/public/:photoId/select

Response:
{
  "success": true,
  "specifications": {
    // Legacy fields (backwards compatibility)
    "widthMm": 900,
    "heightMm": 2100,
    "timberSpecies": "Oak",
    "glassType": "Double Glazed",
    
    // Complete questionnaire answers
    "questionnaireAnswers": {
      "area_m2": {
        "value": "2.5",
        "label": "Project Area (m²)",
        "type": "NUMBER"
      },
      "materials_grade": {
        "value": "Premium",
        "label": "Materials Grade",
        "type": "SELECT"
      },
      // ... all 30+ fields
    }
  }
}
```

## Admin UI Usage

### Upload Form

1. Navigate to `/admin/example-photos`
2. Fill basic metadata (title, description, tags)
3. **Scroll to "Complete Questionnaire Answers" section**
4. Fill ANY/ALL of the 30+ standard fields
5. Upload photo

**Field Types Rendered:**
- `SELECT` → Dropdown with options
- `NUMBER` → Number input
- `BOOLEAN` → Checkbox
- `TEXT/TEXTAREA` → Text input

### Viewing Field Answers

Each photo card shows:
- Title, description, tags
- Dimensions and specs (if filled)
- Price
- View/selection analytics

Click "Edit" to see/modify complete field answers.

### Tips for Best Results

**Minimum Recommended Fields:**
- `project_type` (Doors, Windows, etc.)
- `materials_grade` (Premium, Standard, Basic)
- `area_m2` OR specific dimensions
- Primary feature fields (glazing_type, timber_species, etc.)
- `budget_range` (helps customers find relevant examples)

**Optional but Valuable:**
- `project_complexity` (helps filter by skill level)
- `timeline` (shows realistic expectations)
- `installation_required` (important cost factor)
- `location_type` (Internal/External affects pricing)

## Frontend Integration

### Pre-fill Questionnaire from Selected Example

```typescript
// When customer selects example photo
async function handleExampleSelect(photoId: string) {
  const resp = await fetch(`/example-photos/public/${photoId}/select`, {
    method: "POST"
  });
  
  const { specifications } = await resp.json();
  
  // Apply legacy fields
  if (specifications.widthMm) {
    setFormField("door_width_mm", specifications.widthMm.toString());
  }
  
  // Apply ALL questionnaire answers
  if (specifications.questionnaireAnswers) {
    Object.entries(specifications.questionnaireAnswers).forEach(([key, answer]) => {
      setFormField(key, answer.value);
    });
  }
  
  // Show confirmation
  alert(`Applied "${specifications.title}" specifications!`);
}
```

### Smart Filtering (Advanced)

```typescript
// Show examples matching customer's partial answers
async function findSimilarExamples(customerAnswers: Record<string, any>) {
  // Build query params from answered fields
  const params = new URLSearchParams();
  params.set("tags", customerAnswers.project_type?.toLowerCase() || "");
  params.set("productType", customerAnswers.project_type || "");
  
  const resp = await fetch(`/example-photos/public/${tenantId}?${params}`);
  const photos = await resp.json();
  
  // Client-side similarity scoring (future: move to API)
  const scored = photos.map(photo => {
    let score = 0;
    
    // Load photo's field answers
    const photoAnswers = await fetch(`/example-photos/${photo.id}/field-answers`);
    const photoFields = await photoAnswers.json();
    
    // Score by matching fields
    Object.keys(customerAnswers).forEach(key => {
      if (photoFields[key]?.value === customerAnswers[key]) {
        score += 1;
      }
    });
    
    return { ...photo, similarityScore: score };
  });
  
  // Sort by similarity
  return scored.sort((a, b) => b.similarityScore - a.similarityScore);
}
```

## Use Cases

### Use Case 1: Complete Training Set
Upload 50 completed jobs with FULL questionnaire answers → ML model learns from complete feature sets

### Use Case 2: Customer Inspiration
Customer browses gallery → finds example they like → ONE CLICK pre-fills entire form

### Use Case 3: Smart Recommendations
Customer answers 3 questions → system shows 5 most similar examples → customer refines or selects one

### Use Case 4: Budget Filtering
Customer enters budget range → only show examples in that range with similar specs

### Use Case 5: Timeline Expectations
Customer selects "ASAP" timeline → show examples tagged with "ASAP" to set realistic expectations

## Migration from Legacy Fields

Legacy direct fields (widthMm, timberSpecies, etc.) are still supported for:
- Backwards compatibility
- Quick display in lists
- Simple filtering

But new uploads SHOULD use field answers for:
- Consistency with questionnaire system
- Flexibility (can add new fields without schema changes)
- Complete feature coverage

## Performance Considerations

**Indexes:**
- `ExamplePhotoFieldAnswer.examplePhotoId` → Fast lookup of photo's answers
- `ExamplePhotoFieldAnswer.fieldKey` → Fast filtering by field
- `ExamplePhotoFieldAnswer.examplePhotoId_fieldId` → Unique constraint

**Caching:**
- Consider caching popular photo's field answers
- Cache questionnaire field definitions (rarely change)

**Lazy Loading:**
- Initial gallery view: show thumbnail + title only
- On selection: load complete field answers
- On admin edit: load field answers on demand

## Future Enhancements

1. **Similarity Search API**
   ```http
   POST /example-photos/public/:tenantId/find-similar
   { "customerAnswers": { ... } }
   → Returns sorted by similarity score
   ```

2. **Bulk Import from Completed Quotes**
   - Script to convert approved quotes → example photos
   - Auto-tag with QuestionnaireResponse answers
   
3. **AI-Generated Descriptions**
   - Use field answers to generate rich descriptions
   - "Premium Oak external door, 900x2100mm, double glazed, custom lacquer finish"

4. **Field Coverage Analytics**
   - Show which fields are most/least populated
   - Prompt admins to fill missing high-value fields

5. **Dynamic Field Filtering**
   - Multi-select filters in gallery
   - "Show Premium + Double Glazed + Curves"

---

**Summary**: Example photos are now FULLY tagged with complete questionnaire data, enabling precise matching, comprehensive auto-fill, and better ML training. This transforms the gallery from simple image browsing to an intelligent specification matching system.
