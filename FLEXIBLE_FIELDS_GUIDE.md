# Flexible Fields System - Complete Implementation Guide

## Overview

The Flexible Fields System is a comprehensive, FileMaker-like architecture that enables users to create and manage custom fields across multiple scopes in the CRM. Fields support calculations, lookups, ML training, and display context management.

## Architecture

### Database Schema

#### QuestionnaireField Model (Expanded)

Base columns (existing):
- `id`: Unique identifier
- `key`: Field key (unique per scope)
- `label`: Display label
- `type`: Field type (TEXT, NUMBER, SELECT, BOOLEAN, TEXTAREA, DATE)
- `questionnaireId`: Optional questionnaire reference
- `isStandard`: Whether field is standard (read-only)
- `isActive`: Whether field is currently in use

New columns (flexible fields):
- `scope`: Field scope (client, lead, line_item, manufacturing, fire_door_project, fire_door_line_item)
- `displayContexts`: JSON array of display context IDs where this field should appear
- `helpText`: Help/tooltip text
- `component`: Optional custom component type (e.g., "datesRangeSelector")
- `componentAttributes`: JSON configuration for custom component
- `placeholder`: Input placeholder
- `unit`: Unit display (e.g., "mm", "£")
- `required`: Whether field is mandatory
- `readOnly`: Whether field is read-only
- `minValue`/`maxValue`/`minLength`/`maxLength`: Validation constraints
- `defaultValue`: Default value
- `options`: JSON array of {value, label} for SELECT fields
- `calculationFormula`: Formula for calculated fields (e.g., "width * height")
- `calculationInputFields`: Array of field IDs used in calculation
- `lookupTableId`: Reference to lookup table for lookup fields
- `lookupInputFields`: Array of input field keys for lookup matching
- `lookupOutputField`: Output field from lookup table
- `mlTrainingEnabled`: Whether field captures ML training events
- `mlFeatureWeight`: Weight in ML model (0-1)
- `showInFilters`: Display in filter UI
- `showInGrid`: Display in grid columns
- `order`: Display order in forms

#### New Models

**LookupTable**
```
- id: String (primary)
- tenantId: String (required)
- name: String (required)
- key: String (required)
- isStandard: Boolean
- columns: String[] (JSON)
- rows: JSON[]
- createdAt: DateTime
- updatedAt: DateTime
```

**FieldDisplayContext**
```
- id: String (primary)
- tenantId: String (required)
- name: String (required) - e.g., "client_detail", "client_list_filter"
- description: String
- scope: String (required) - Which scope this context applies to
- createdAt: DateTime
- updatedAt: DateTime

Relations:
- fields: QuestionnaireField[] (back-reference via displayContexts)
```

**MLTrainingEvent**
```
- id: String (primary)
- tenantId: String (required)
- fieldId: String (required)
- entityId: String (required) - e.g., clientId
- entityType: String (required) - e.g., "client"
- predictedValue: String (the AI prediction)
- actualValue: String (what user entered)
- feedback: "correct" | "incorrect" | "partial"
- confidence: Float (0-1)
- createdAt: DateTime

Relations:
- field: QuestionnaireField
```

#### Client Model Enhancement

Added column:
- `custom`: JSON field storing custom field values as `{[fieldKey]: value}`

### Field Scopes

Six primary scopes for different entity types:

1. **client** - Client/company information
2. **lead** - Sales lead data
3. **line_item** - Quote/order line items
4. **manufacturing** - Manufacturing specifications
5. **fire_door_project** - Fire door project data
6. **fire_door_line_item** - Fire door specific line items

### Display Contexts

UI contexts where fields can be displayed:

- `client_detail` - Client detail page main section
- `client_detail_tab_custom` - Custom fields tab
- `client_list_filter` - Client list filter sidebar
- `lead_modal_basic` - Lead creation modal basic info
- `lead_modal_advanced` - Lead creation modal advanced tab
- `quote_line_item` - Quote line item inline editor
- `quote_line_item_modal` - Quote line item detail modal
- `quote_filter` - Quote list filter
- `manufacturing_specification` - Manufacturing UI
- `fire_door_calculator` - Fire door calculator
- `fire_door_project_detail` - Fire door project page
- `fire_door_line_item` - Fire door line item
- Additional contexts added per feature requirements

## API Endpoints

### Fields

**GET /api/flexible-fields**
```
Query: scope?, context?, isActive?
Returns: QuestionnaireField[]
```

**GET /api/flexible-fields/:id**
```
Returns: QuestionnaireField
```

**POST /api/flexible-fields**
```
Body: {
  key: string
  label: string
  type: "TEXT" | "NUMBER" | "SELECT" | "BOOLEAN" | "TEXTAREA" | "DATE"
  scope: string
  displayContexts?: string[]
  helpText?: string
  component?: string
  componentAttributes?: Record<string, any>
  placeholder?: string
  unit?: string
  required?: boolean
  readOnly?: boolean
  minValue?: number
  maxValue?: number
  minLength?: number
  maxLength?: number
  defaultValue?: any
  options?: Array<{value: string, label: string}>
  calculationFormula?: string
  calculationInputFields?: string[]
  lookupTableId?: string
  lookupInputFields?: string[]
  lookupOutputField?: string
  mlTrainingEnabled?: boolean
  mlFeatureWeight?: number
  showInFilters?: boolean
  showInGrid?: boolean
  order?: number
}
Returns: QuestionnaireField
```

**PATCH /api/flexible-fields/:id**
```
Body: Partial of POST body
Returns: QuestionnaireField
```

**DELETE /api/flexible-fields/:id**
```
Returns: { success: boolean }
```

### Display Contexts

**GET /api/flexible-fields/display-contexts**
```
Returns: FieldDisplayContext[]
```

**POST /api/flexible-fields/display-contexts**
```
Body: {
  name: string
  description?: string
  scope: string
}
Returns: FieldDisplayContext
```

**PATCH /api/flexible-fields/display-contexts/:id**
```
Body: Partial
Returns: FieldDisplayContext
```

**DELETE /api/flexible-fields/display-contexts/:id**
```
Returns: { success: boolean }
```

### Lookup Tables

**GET /api/flexible-fields/lookup-tables**
```
Returns: LookupTable[]
```

**POST /api/flexible-fields/lookup-tables**
```
Body: {
  name: string
  key: string
  columns: string[]
  rows: Record<string, any>[]
  isStandard?: boolean
}
Returns: LookupTable
```

**PATCH /api/flexible-fields/lookup-tables/:id**
```
Body: Partial
Returns: LookupTable
```

**DELETE /api/flexible-fields/lookup-tables/:id**
```
Returns: { success: boolean }
```

### Evaluation

**POST /api/flexible-fields/evaluate-field**
```
Body: {
  fieldId: string
  inputs: Record<string, any>
  context?: string
}
Returns: {
  result: any
  field: {
    id: string
    key: string
    label: string
  }
}
```

Supports both calculation and lookup evaluation.

### ML Training

**POST /api/flexible-fields/ml-training-events**
```
Body: {
  fieldId: string
  entityId: string
  entityType: string
  predictedValue: string
  actualValue: string
  feedback: "correct" | "incorrect" | "partial"
  confidence: number
}
Returns: MLTrainingEvent
```

**GET /api/flexible-fields/ml-training-events**
```
Query: fieldId?, limit?, offset?
Returns: MLTrainingEvent[]
```

## Frontend Components

### FieldRenderer Component

Single field rendering component supporting all field types.

```tsx
import { FieldRenderer } from '@/components/fields/FieldRenderer';

<FieldRenderer
  field={{
    id: "field_1",
    key: "company_size",
    label: "Company Size",
    type: "SELECT",
    options: [{value: "small", label: "Small"}],
    required: true
  }}
  value="small"
  onChange={(value) => console.log(value)}
  readOnly={false}
  error="This field is required"
/>
```

### FieldForm Component

Multi-field form with automatic layout.

```tsx
import { FieldForm } from '@/components/fields/FieldRenderer';

<FieldForm
  fields={[field1, field2, field3]}
  values={{field1_key: "value1"}}
  onChange={(values) => console.log(values)}
  readOnly={false}
  columns={2}
/>
```

### InlineFieldEditor Component

Quick edit mode for single fields.

```tsx
import { InlineFieldEditor } from '@/components/fields/FieldRenderer';

<InlineFieldEditor
  field={field}
  value={currentValue}
  onSave={(value) => handleSave(value)}
  onCancel={() => console.log('cancelled')}
/>
```

### FieldManager Component

Admin dialog for creating/editing fields.

```tsx
import { FieldManager } from '@/components/fields/FieldManager';

<FieldManager
  field={existingField}
  defaultScope="client"
  onSave={() => console.log('saved')}
  onClose={() => console.log('closed')}
/>
```

## Custom Hooks

### useFields Hook

Fetch fields with caching and filtering.

```tsx
const { fields, isLoading, error } = useFields({
  scope: 'client',
  context: 'client_detail',
  isActive: true
});
```

Features:
- Automatic caching (5-minute TTL)
- Scope and context filtering
- Error handling
- Global cache management

### useLookupTable Hook

Fetch lookup table data.

```tsx
const { rows, isLoading, error } = useLookupTable('timber_pricing');
```

### useFieldValue Hook

Manage individual field state with validation.

```tsx
const { value, setValue, error, isValid } = useFieldValue({
  fieldId: 'field_1',
  initialValue: '10',
  validate: (val) => val > 0
});
```

### useFieldEvaluation Hook

Evaluate calculated fields and lookups.

```tsx
const { evaluate, results, loading } = useFieldEvaluation({
  tenantId: 'tenant_1'
});

const result = await evaluate('field_1', {width: 100, height: 200});
```

## Integration Points

### Client Detail Page

Fields appear in "Custom Fields" section:

```tsx
import { useFields } from '@/hooks/useFields';
import { FieldForm } from '@/components/fields/FieldRenderer';

const { fields } = useFields({scope: 'client', context: 'client_detail'});

<FieldForm
  fields={fields}
  values={client.custom}
  onChange={setCustomValues}
/>
```

### Field Management Admin

Access at `/settings/fields`:

- View all fields by scope
- Create new custom fields
- Edit/delete custom fields
- Configure display contexts
- Set up calculations and lookups

### Standard Field Definitions

20 client fields predefined:

**Contact Information:**
- Phone Ext
- Assistant Name
- Birthday
- Last Contact Date
- Preferred Contact Method

**Company Information:**
- Number of Employees
- Industry Vertical
- Parent Company
- Stock Symbol
- Annual Revenue

**Account Information:**
- Account Manager
- Account Status
- Last Review Date
- Rating
- Risk Level

**Legal/Tax:**
- Legal Entity Name
- Tax ID
- Year Founded
- Ownership Type

## Field Types Supported

| Type | Input | Validation | Example |
|------|-------|-----------|---------|
| **TEXT** | Text input | minLength, maxLength, pattern | "John Smith" |
| **NUMBER** | Number input | minValue, maxValue | 123.45 |
| **SELECT** | Dropdown | options[] | "Small", "Medium", "Large" |
| **BOOLEAN** | Checkbox | - | true/false |
| **TEXTAREA** | Multi-line text | minLength, maxLength | Long descriptions |
| **DATE** | Date picker | minValue, maxValue | 2024-01-15 |

## Calculation Engine

### Formula Syntax

Simple mathematical expressions with field references:

```
width * height
(length + width) * 2
base_price * (1 + tax_rate)
```

### Lookup Matching

Matches criteria against lookup table rows:

```
Lookup: timber_pricing
Input: {species: "Oak", thickness: "50mm"}
Output: price
Result: Retrieves price for Oak 50mm from table
```

## ML Training System

Captures user feedback on AI predictions:

1. System makes prediction (via API)
2. User enters actual value
3. Event captured with feedback
4. Model retrained on new data

Uses field's `mlFeatureWeight` in training pipeline.

## Standard Lookup Tables

### Timber Pricing
- Columns: species, thickness, finish, price_gbp
- 6 species × 3 thicknesses = 18 rows

### Hardware Options
- Columns: type, description, code, cost_gbp
- 8 hardware types

### Finish Options
- Columns: code, name, color_code, premium_cost
- 5 finish options

### Material Options
- Columns: code, name, density_kg_m3, cost_per_kg
- 4 material options

### Labour Rates
- Columns: operation, hourly_rate_gbp, setup_time_minutes
- 5 operations

## Database Migration

Migration: `20251219120000_flexible_field_system`

- Creates new models
- Adds QuestionnaireField columns
- Adds Client.custom field
- Safe for rollback

## Deployment Steps

1. **Prepare**
   ```bash
   # Backup production database
   ```

2. **Deploy API**
   ```bash
   pnpm -w --filter api build
   # Deploy to Render
   ```

3. **Deploy Database**
   ```bash
   # Apply migrations
   npx prisma migrate deploy
   ```

4. **Deploy Frontend**
   ```bash
   pnpm -w --filter web build
   # Deploy to Render
   ```

5. **Seed Data**
   ```bash
   npx ts-node /api/scripts/seed-standard-fields.ts
   npx ts-node /api/scripts/seed-lookup-tables.ts
   ```

## Common Use Cases

### 1. Adding Company Size Field

```tsx
// Admin creates via /settings/fields
{
  label: "Company Size",
  key: "company_size",
  type: "SELECT",
  scope: "client",
  options: [
    {value: "1-10", label: "1-10 employees"},
    {value: "11-50", label: "11-50 employees"},
    {value: "50+", label: "50+ employees"}
  ],
  displayContexts: ["client_detail"],
  required: true
}
```

### 2. Calculating Door Area

```tsx
{
  label: "Door Area (mm²)",
  key: "door_area",
  type: "NUMBER",
  scope: "manufacturing",
  calculationFormula: "width * height",
  calculationInputFields: ["width", "height"],
  readOnly: true,  // auto-calculated
  showInGrid: true
}
```

### 3. Looking Up Timber Price

```tsx
{
  label: "Timber Price (£)",
  key: "timber_price",
  type: "NUMBER",
  lookupTableId: "timber_pricing",
  lookupInputFields: ["timber_species", "thickness"],
  lookupOutputField: "price_gbp",
  readOnly: true  // populated from lookup
}
```

### 4. ML-Trained Estimation Field

```tsx
{
  label: "Estimated Lead Value (£)",
  key: "estimated_value",
  type: "NUMBER",
  mlTrainingEnabled: true,
  mlFeatureWeight: 0.8,  // 80% influence in model
  scope: "lead"
}
```

## Troubleshooting

### Fields not appearing on page
- Check field's `isActive` status
- Verify field's `displayContexts` includes current context
- Ensure `scope` matches page scope

### Calculations not working
- Verify input field keys in `calculationInputFields`
- Check formula syntax (use field keys, not labels)
- Ensure input fields have values

### Lookup returning null
- Verify lookup table exists and has rows
- Check `lookupInputFields` match column names
- Ensure lookup row values match case-sensitively

### ML training not capturing
- Verify `mlTrainingEnabled: true`
- Check events posted to `/api/flexible-fields/ml-training-events`
- Confirm `entityType` and `entityId` are valid

## Future Enhancements

- [ ] Conditional visibility (show field if other field = X)
- [ ] Custom validation functions
- [ ] Field dependency chains
- [ ] Bulk field import/export
- [ ] Field usage analytics
- [ ] A/B testing different field labels
- [ ] Automatic field suggestions based on ML
- [ ] Formula builder UI
- [ ] Lookup table editor UI
- [ ] Field permission system

## API Authentication

All endpoints require:
```
headers: {
  'x-user-id': string
  'x-tenant-id': string
}
```

Typically set from JWT via:
```tsx
const auth = getAuthIdsFromJwt();
const headers = {
  'x-user-id': auth.userId,
  'x-tenant-id': auth.tenantId
};
```

## Performance Considerations

- **Caching**: Fields cached for 5 minutes by default
- **Pagination**: Lookup tables support pagination
- **Indexes**: `(tenantId, scope)` indexed on QuestionnaireField
- **Batch**: Use `batchEvaluateFields` for multiple field evaluations
- **Lazy Loading**: Use `isActive` to hide unused fields

