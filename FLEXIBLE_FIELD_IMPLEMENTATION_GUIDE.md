/**
 * Flexible Field System Implementation Guide
 * Complete documentation for using and extending the field system
 */

# Flexible Field System - Implementation Guide

## Overview

The flexible field system enables users to create and manage custom fields across multiple scopes (clients, leads, line items, etc.) without requiring code changes. It includes field rendering, validation, caching, and ML training support.

## Architecture

### Core Components

1. **Database Models** (`/api/prisma/schema.prisma`)
   - `QuestionnaireField`: Field definitions with 24+ configuration properties
   - `LookupTable`: Reference data for SELECT fields
   - `FieldDisplayContext`: Control field visibility per UI context
   - `MLTrainingEvent`: Track field values for pricing predictions

2. **API Endpoints** (`/api/src/routes/flexible-fields.ts`)
   - Field CRUD: `GET/POST/PATCH/DELETE /api/flexible-fields`
   - Display Contexts: `GET/POST/PATCH /api/flexible-fields/display-contexts`
   - Lookup Tables: `GET/POST /api/flexible-fields/lookup-tables`
   - Evaluation: `POST /api/flexible-fields/evaluate-field` (formulas, lookups)

3. **Frontend Components**
   - `FieldRenderer`: Renders single field
   - `FieldForm`: Multi-field form with scope grouping
   - `FieldManager`: Create/edit field dialog
   - `CustomFieldsPanel`: Reusable panel for any entity

4. **Hooks**
   - `useFields`: Fetch fields with caching (5-min TTL)
   - `useLookupTable`: Fetch lookup table data
   - `useFieldValue`: Manage individual field state with validation
   - `useFieldEvaluation`: Evaluate formulas and lookups

## Usage Guide

### 1. Adding Custom Fields to a Page

**Step 1: Import components and hooks**
```tsx
import { CustomFieldsPanel } from '@/components/fields/CustomFieldsPanel';
import { useFields } from '@/hooks/useFields';
```

**Step 2: Display fields on a page**
```tsx
export function MyPage() {
  return (
    <div>
      {/* Your existing content */}
      
      {/* Add custom fields section */}
      <CustomFieldsPanel 
        entityType="client"
        entityId={clientId}
        onSave={() => refetchClient()}
      />
    </div>
  );
}
```

**Step 3: For more control, use hooks directly**
```tsx
export function DetailedFieldEditor() {
  const [values, setValues] = useState({});
  const { fields } = useFields({ 
    scope: 'client',
    context: 'client_detail' 
  });

  return (
    <FieldForm 
      fields={fields}
      values={values}
      onChange={setValues}
    />
  );
}
```

### 2. Field Scopes

Fields are organized by scope - where they're used:

| Scope | Purpose | Example Usage |
|-------|---------|----------------|
| `client` | Client information | Client detail page |
| `lead` | Lead/opportunity details | Lead modal |
| `line_item` | Quote line item properties | Quote line editor |
| `manufacturing` | Production specs | Manufacturing dashboard |
| `fire_door_project` | Fire door project data | Fire door scheduler |
| `fire_door_line_item` | Fire door line specs | Fire door quote |

### 3. Display Contexts

Control field visibility in different UI locations:

- `client_detail`: Client detail page
- `client_list`: Client list view
- `client_modal`: Client creation/edit modal
- `lead_detail`: Lead detail page
- `lead_modal_details`: Lead modal details tab
- `lead_list`: Lead list
- `quote_form`: Quote editor
- `quote_line_editor`: Line item editor
- `line_item_grid`: Line item grid display
- `fire_door_modal`: Fire door modal
- `fire_door_schedule`: Schedule view

Manage visibility at `/settings/display-contexts` (admin only).

### 4. Field Types

| Type | Input | Description |
|------|-------|-------------|
| `TEXT` | Text input | Short text, names, codes |
| `NUMBER` | Number input | Quantities, dimensions, prices |
| `SELECT` | Dropdown | Choose from predefined options |
| `BOOLEAN` | Checkbox | Yes/no, enabled/disabled |
| `TEXTAREA` | Multi-line text | Long form content, notes |
| `DATE` | Date picker | Calendar dates |

### 5. Creating Fields Programmatically

**Create field via API (useful for seed data):**
```typescript
await fetch('/api/flexible-fields', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    key: 'preferred_material',
    label: 'Preferred Material',
    type: 'SELECT',
    scope: 'client',
    helpText: 'Client\'s preferred door material',
    options: [
      { value: 'timber', label: 'Timber' },
      { value: 'composite', label: 'Composite' },
      { value: 'aluminium', label: 'Aluminium' },
    ],
    displayContexts: ['client_detail', 'client_modal'],
    required: false,
  }),
});
```

### 6. Field Evaluation & Formulas

**For calculated fields:**
```typescript
import { useFieldEvaluation } from '@/hooks/useFieldEvaluation';

function PricingCalculator() {
  const { evaluate } = useFieldEvaluation({ tenantId });
  
  const calculateTotal = async () => {
    const result = await evaluate('total_price', {
      quantity: 5,
      unit_price: 100,
    });
    // result = 500 (from formula: quantity * unit_price)
  };
}
```

**Formula syntax:**
- Use field keys in formulas: `quantity * unit_price`
- Supports math operators: `+`, `-`, `*`, `/`, `(`, `)`
- Example: `(width_mm / 1000) * depth_mm * thickness_mm * density`

### 7. Lookup Tables

**For reference data (pricing, materials, etc.):**
```typescript
// Pre-seeded lookup tables
const lookupTables = {
  'timber-pricing': [
    { grade: 'A', price_per_m2: 120, availability: 'high' },
    { grade: 'B', price_per_m2: 85, availability: 'high' },
  ],
  'hardware-options': [
    { type: 'hinges', brand: 'Hager', stock: 50 },
    { type: 'locks', brand: 'Abloy', stock: 30 },
  ],
};
```

**Use in field evaluation:**
```typescript
const result = await evaluate('material_cost', {
  timber_grade: 'A',
  lookup_table: 'timber-pricing',
});
```

## Admin Tasks

### Create Custom Field
1. Go to `/settings/fields`
2. Click "Create Field"
3. Fill in key, label, type, scope
4. Add help text (optional)
5. Configure options for SELECT fields
6. Save

### Manage Field Visibility
1. Go to `/settings/display-contexts`
2. Select a field
3. Toggle visibility for each context
4. Changes apply immediately

### View All Fields
Go to `/settings/fields` to:
- See all standard and custom fields
- Filter by scope
- Edit/delete custom fields
- See field usage

## Integration Examples

### Example 1: Client with Custom Fields
```tsx
// /web/src/app/clients/[id]/page.tsx
import { CustomFieldsPanel } from '@/components/fields/CustomFieldsPanel';

export default function ClientDetail() {
  return (
    <DeskSurface>
      {/* Existing content */}
      <CustomFieldsPanel 
        entityType="client"
        entityId={clientId}
        onSave={loadClient}
      />
    </DeskSurface>
  );
}
```

### Example 2: Lead Modal with Fields
```tsx
// /web/src/app/leads/LeadModal.tsx
import { CustomFieldsPanel } from '@/components/fields/CustomFieldsPanel';

export function LeadDetails() {
  return (
    <div>
      {/* Existing lead fields */}
      <CustomFieldsPanel 
        entityType="lead"
        entityId={leadId}
        readOnly={!isEditing}
      />
    </div>
  );
}
```

### Example 3: Quote Line Editor
```tsx
// /web/src/app/quotes/LineItemEditor.tsx
export function LineItemEditor({ lineItemId }) {
  return (
    <div>
      {/* Existing line item fields */}
      <CustomFieldsPanel 
        entityType="line_item"
        entityId={lineItemId}
      />
    </div>
  );
}
```

## ML Training Integration

Track custom fields for machine learning predictions:

1. **Enable ML Training on Field**
   - Create or edit field at `/settings/fields`
   - Check "Use for ML Training"
   - Set feature weight (1.0 = normal importance, >1.0 = higher priority)

2. **Log Training Events**
   ```typescript
   await fetch('/api/flexible-fields/ml-training-events', {
     method: 'POST',
     body: JSON.stringify({
       leadId: 'lead-123',
       fieldKey: 'customer_type',
       fieldValue: 'commercial',
       prediction: 'high-value',
       actualOutcome: 'won',
     }),
   });
   ```

3. **Use for Pricing Predictions**
   - System learns patterns from field values
   - Predicts outcomes and pricing
   - Improves over time with more data

## Performance Considerations

### Caching
- Fields cached for 5 minutes
- Lookup tables cached for 5 minutes
- Use `refetch()` to invalidate immediately

```typescript
const { fields, refetch } = useFields();
// After creating new field:
await refetch();
```

### Database Queries
- Custom field values stored in `Entity.custom` JSONB column
- No separate tables for custom values
- Single UPDATE query to save all custom fields

### API Calls
- Fields endpoint paginated (optional)
- Use `scope` and `context` filters in queries
- Display context queries are lightweight

## Troubleshooting

### Fields Not Appearing
1. Check field is active at `/settings/fields`
2. Verify scope matches entity type
3. Check display context visibility at `/settings/display-contexts`
4. Clear browser cache or hard refresh (Ctrl+F5)

### Values Not Saving
1. Verify API endpoint accepts custom field saves
2. Check authentication headers (`x-user-id`, `x-tenant-id`)
3. Look for errors in browser console
4. Check backend logs for validation errors

### Performance Issues
1. Clear field cache: `useFields({ scope }).refetch()`
2. Reduce number of fields displayed per context
3. Use pagination if displaying many fields
4. Cache lookup tables on client side

## Advanced Features

### Custom Validation
```typescript
// Can be added to FieldRenderer component
function validateField(field: QuestionnaireField, value: any): string | null {
  if (field.type === 'NUMBER' && field.minValue && value < field.minValue) {
    return `Must be at least ${field.minValue}`;
  }
  return null;
}
```

### Custom Display Logic
```typescript
// Use displayContexts to customize rendering
function shouldShowField(field: QuestionnaireField, context: string): boolean {
  return field.displayContexts?.includes(context) ?? true;
}
```

### Field Dependencies
```typescript
// Calculate value based on other fields
function evaluateDependent(field: QuestionnaireField, allValues: Record<string, any>) {
  if (field.calculationFormula) {
    return evaluateFormula(field.calculationFormula, allValues);
  }
}
```

## API Reference

### GET /api/flexible-fields
Fetch fields with filtering
```
Query Parameters:
- scope?: string (filter by scope)
- context?: string (filter by display context)
- isActive?: boolean (filter by active status)
```

### POST /api/flexible-fields
Create field
```
Body:
{
  key: string,
  label: string,
  type: 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN' | 'TEXTAREA' | 'DATE',
  scope: string,
  helpText?: string,
  options?: { value: string; label: string }[],
  required?: boolean,
  ...
}
```

### POST /api/flexible-fields/evaluate-field
Evaluate formula or lookup
```
Body:
{
  fieldId: string,
  inputs: Record<string, any>,
  context?: string
}
Returns: { result: any, field: {...} }
```

## Future Enhancements

- [ ] Conditional field visibility based on other field values
- [ ] Multi-select fields (select multiple options)
- [ ] File upload fields
- [ ] Rich text editor fields
- [ ] Field groups/sections for better UI organization
- [ ] Import/export fields configuration
- [ ] Field versioning and audit logs
- [ ] Advanced formula builder UI
- [ ] Field usage analytics
- [ ] Batch field operations

## Support

For issues or questions:
1. Check this guide
2. Review field logs at `/settings/fields`
3. Test field evaluation at `/api/flexible-fields/evaluate-field`
4. Check browser console for client-side errors
5. Check server logs for API errors
