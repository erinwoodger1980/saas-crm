# Custom Questionnaire System - Implementation Guide

## Overview

The custom questionnaire system allows tenants to define dynamic quote form fields and map them to a costing engine. No hardcoded fields required - all configuration is stored in the database.

## Architecture

### Database Models

- **QuestionnaireField** - Tenant-defined field definitions
  - Field metadata (key, label, type, validation)
  - Costing input mapping via `costingInputKey`
  - Active status and sort order

- **QuestionnaireResponse** - Bound to a specific quote
  - One response per quote
  - Tracks completion status

- **QuestionnaireAnswer** - Individual field answers
  - Stores values as strings (type conversion handled by field definition)
  - Unique constraint per (response, field)

### API Routes

#### Questionnaire Fields (Admin)
- `GET /questionnaire-fields` - List all fields
- `POST /questionnaire-fields` - Create new field
- `PUT /questionnaire-fields/:id` - Update field
- `DELETE /questionnaire-fields/:id` - Delete field (soft or hard)
- `POST /questionnaire-fields/reorder` - Batch reorder

#### Questionnaire Responses (Quote-specific)
- `GET /questionnaire-responses/quote/:quoteId` - Get answers for quote
- `POST /questionnaire-responses/quote/:quoteId` - Save/update answers
- `DELETE /questionnaire-responses/quote/:quoteId` - Delete response

### Costing Helper

Located at `api/src/lib/questionnaire/costing.ts`:

```typescript
import { buildCostingInputs, calculateCost } from "@/lib/questionnaire/costing";

// Extract costing inputs from questionnaire answers
const inputs = await buildCostingInputs(quoteId, tenantId);
// => { height_mm: 2100, width_mm: 900, quantity: 2 }

// Run costing calculation
const result = await calculateCost(inputs, tenantId);
// => { estimatedCost: 3200, breakdown: {...}, confidence: 0.85 }
```

## Usage Examples

### 1. Admin: Define Custom Fields

```typescript
import QuestionnaireFieldEditor from "@/components/questionnaire/QuestionnaireFieldEditor";

export default function SettingsPage() {
  return <QuestionnaireFieldEditor />;
}
```

### 2. Quote Form: Dynamic Field Rendering

```typescript
import DynamicQuoteForm from "@/components/questionnaire/DynamicQuoteForm";

export default function QuotePage({ quoteId }: { quoteId: string }) {
  return (
    <DynamicQuoteForm
      quoteId={quoteId}
      onSave={(answers) => console.log("Saved:", answers)}
      onComplete={() => router.push(`/quotes/${quoteId}/review`)}
    />
  );
}
```

### 3. Backend: Extract Costing Inputs

```typescript
// In your quote pricing endpoint
router.post("/quotes/:id/calculate-price", requireAuth, async (req, res) => {
  const { tenantId } = req.auth;
  const quoteId = req.params.id;

  // Build typed costing inputs from questionnaire answers
  const inputs = await buildCostingInputs(quoteId, tenantId);

  // Validate required inputs
  const required = ["height_mm", "width_mm", "quantity"];
  const missing = validateCostingInputs(inputs, required);
  if (missing.length > 0) {
    return res.status(400).json({ error: "missing_inputs", missing });
  }

  // Run your costing engine
  const result = await calculateCost(inputs, tenantId);

  // Save estimate to quote
  await prisma.quote.update({
    where: { id: quoteId },
    data: { totalGBP: result.estimatedCost },
  });

  return res.json(result);
});
```

### 4. Field Configuration Examples

#### Text Field
```json
{
  "key": "customer_name",
  "label": "Customer Name",
  "type": "text",
  "required": true,
  "placeholder": "Enter full name",
  "helpText": "Primary contact for this project"
}
```

#### Number Field with Costing Mapping
```json
{
  "key": "height_mm",
  "label": "Height (mm)",
  "type": "number",
  "required": true,
  "placeholder": "2100",
  "costingInputKey": "height_mm",
  "helpText": "Standard height is 2100mm"
}
```

#### Select Field
```json
{
  "key": "timber_species",
  "label": "Timber Species",
  "type": "select",
  "required": true,
  "config": {
    "options": ["Oak", "Sapele", "Accoya", "Iroko"]
  },
  "costingInputKey": "timber_type"
}
```

#### Boolean Field
```json
{
  "key": "triple_glazing",
  "label": "Upgrade to Triple Glazing",
  "type": "boolean",
  "required": false,
  "costingInputKey": "triple_glazing_enabled",
  "helpText": "Better thermal performance (additional cost)"
}
```

## Costing Input Keys

Costing input keys are stable identifiers that map questionnaire answers to your pricing logic:

- `height_mm` - Height in millimeters
- `width_mm` - Width in millimeters  
- `quantity` - Number of units
- `timber_type` - Selected timber species
- `glazing_type` - Glazing specification
- `triple_glazing_enabled` - Boolean upgrade flag

Define these based on your costing engine's requirements.

## Migration

To apply the schema changes:

```bash
cd api
npx prisma generate
npx prisma migrate deploy
# Or if you're using the custom migration:
psql $DATABASE_URL -f prisma/migrations/add_questionnaire_system/migration.sql
```

## Type Safety

The costing helper automatically converts answer strings to appropriate types:

- `number` fields → `number`
- `boolean` fields → `boolean`
- `date` fields → ISO date string
- All others → `string`

```typescript
const inputs = await buildCostingInputs(quoteId, tenantId);
// Type-safe: inputs is CostingInput
// => { [key: string]: string | number | boolean | null }
```

## Best Practices

1. **Use Stable Keys** - Field keys should not change once in use
2. **Map Costing Inputs** - Set `costingInputKey` only for fields used in pricing
3. **Validate Required Inputs** - Use `validateCostingInputs()` before pricing
4. **Soft Delete** - Prefer `isActive: false` over hard deletes to preserve data
5. **Sort Order** - Use drag-and-drop reordering for UX consistency

## Security Notes

- All endpoints use `requireAuth` middleware
- Tenant isolation enforced via `tenantId` checks
- Field keys are validated on creation (unique per tenant)
- Cascade deletes protect data integrity

## Future Enhancements

- Conditional field visibility (show field X if field Y = "value")
- Field validation rules (min/max, regex patterns)
- Multi-step forms with sections
- File upload fields
- Calculated fields (auto-compute from other fields)

## Support

For questions or issues:
- Check API error responses for detailed messages
- Verify Prisma client is regenerated after schema changes
- Ensure migration is applied to production database
