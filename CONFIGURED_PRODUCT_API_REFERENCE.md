# ConfiguredProduct API Quick Reference

## Initialization (Phase 2)

### Seed starter library for new tenant
```bash
POST /tenant/configured-product/seed
Authorization: Required (tenantId)

Response: {
  success: true,
  attributes: [{ id, code, name, type, ... }],
  productTypes: [...],
  questions: [...],
  questionSets: [...],
  components: [...]
}
```

### Auto-create legacy field mappings
```bash
POST /tenant/configured-product/create-mappings
Authorization: Required

Response: {
  success: true,
  mappings: {
    created: number,
    updated: number
  }
}
```

### Backfill existing quotes from questionnaire responses
```bash
POST /tenant/configured-product/sync-responses
Authorization: Required

Response: {
  success: true,
  responses: {
    processed: number,
    updated: number,
    skipped: number,
    errors: []
  }
}
```

### Check migration status
```bash
GET /tenant/configured-product/status
Authorization: Required

Response: {
  success: true,
  status: {
    attributes: number,
    productTypes: number,
    questions: number,
    questionSets: number,
    legacyMappings: number,
    quotesWithConfiguredProduct: number,
    totalQuotes: number,
    migrationProgress: percentage
  }
}
```

---

## ML Payload (Phase 4)

### Build normalized ML payload from quote
```bash
POST /ml/build-payload
Content-Type: application/json

Body: {
  quoteId: string,
  includeLineItems?: boolean,
  preferCanonical?: boolean
}

Response: {
  ok: true,
  payload: {
    quoteId, tenantId, leadId,
    selections: {...},
    provenance: {...},
    productTypes: [...],
    legacyFields: {...},
    subtotals: {...},
    mlContext: {...},
    lineItems?: [...]
  },
  canonical: boolean,
  lineItemsIncluded: boolean
}
```

### Compare two payloads for changes
```bash
POST /ml/compare-payloads
Content-Type: application/json

Body: {
  oldPayload: {...},
  newPayload: {...},
  significanceThreshold?: 0.01
}

Response: {
  ok: true,
  hasDifferences: boolean,
  changedFields: string[],
  priceDifference: number | null
}
```

---

## BOM Generation (Phase 5)

### Generate BOM for single quote line
```bash
POST /tenant/bom/generate-for-line
Authorization: Required
Content-Type: application/json

Body: {
  quoteId: string,
  lineId: string
}

Response: {
  success: true,
  bom: {
    quoteId, lineId, productTypeId, timestamp,
    selections: {...},
    lineItems: [
      {
        componentId, componentCode, componentName,
        quantity, unit, quantityFormula,
        conditionsMet, conditionDetails,
        included
      }
    ],
    stats: {
      byCategory: {...},
      errors: []
    }
  }
}
```

### Generate BOMs for all lines in quote
```bash
POST /tenant/bom/generate-for-quote
Authorization: Required
Content-Type: application/json

Body: {
  quoteId: string
}

Response: {
  success: true,
  bomsGenerated: number,
  boms: [
    {...same as above...}
  ]
}
```

### Get component details with evaluation
```bash
GET /tenant/bom/component/:componentId?selections=<json>
Authorization: Required

Query:
  selections={"width":"2000","height":"1000"} (optional)

Response: {
  success: true,
  component: {
    id, code, name, description, unit, componentType,
    inclusionRules: {...},
    quantityFormula: string,
    productTypes: string[],
    evaluation?: {
      conditionsMet: boolean,
      conditionDetails: string[],
      quantity: number,
      quantityExpression: string
    }
  }
}
```

### Update component inclusion rules
```bash
POST /tenant/bom/component/:componentId/inclusion-rules
Authorization: Required
Content-Type: application/json

Body: {
  inclusionRules: {
    "finish": { operator: "equals", value: "Premium" },
    "timberGroup": { operator: "in", value: ["Oak", "Walnut"] }
  }
  // or null to remove rules
}

Response: {
  success: true
}
```

### Update component quantity formula
```bash
POST /tenant/bom/component/:componentId/quantity-formula
Authorization: Required
Content-Type: application/json

Body: {
  quantityFormula: "({width} * {height}) / 10000"
  // or null to remove formula
}

Response: {
  success: true
}
```

---

## Data Migration (Phase 7)

### CLI: Migrate tenant quotes to ConfiguredProduct
```bash
# All tenants
pnpm migrate:configured-product

# Specific tenant(s)
pnpm migrate:configured-product <tenantId> [tenantId2...]

# Validate results
pnpm migrate:configured-product validate <tenantId>

Output:
  - Progress per tenant
  - Attribute creation count
  - Migration statistics
  - Error summary
  - Total duration
  - Validation percentage
```

---

## Data Structures

### ProductType (Hierarchical)
```typescript
{
  id: string,
  code: string,
  name: string,
  level: 'category' | 'type' | 'option',
  parentId?: string,
  description?: string,
  svgPreview?: string,
  children?: ProductType[]
}
```

### Attribute
```typescript
{
  id: string,
  code: string,
  name: string,
  attributeType: 'number' | 'text' | 'select' | 'multiselect' | 'boolean' | 'date' | 'json',
  requiredForCosting: boolean,
  requiredForManufacture: boolean,
  defaultValue?: string,
  options?: Record<string, any>,
  validationRules?: Record<string, any>
}
```

### Question
```typescript
{
  id: string,
  code: string,
  controlType: 'input' | 'select' | 'radio' | 'checkbox' | 'slider' | 'date' | 'textarea',
  label: string,
  attributeCode: string,
  helpText?: string,
  visibilityRules?: {
    productTypeIds?: string[],
    [attributeCode]: { operator: string, value: any }
  }
}
```

### ConfiguredProduct (stored in QuoteLine.configuredProduct JSONB)
```typescript
{
  productTypeId?: string,
  selections: Record<string, any>,
  provenance?: Record<string, string>, // "canonical", "legacy", "lead-custom"
  migratedAt?: string,
  migrationSource?: string,
  derived?: {
    bom?: {
      generated: string,
      lineItems: [...],
      stats: {...}
    },
    drawing?: {...},
    cuttingList?: {...}
  }
}
```

### Inclusion Rule (stored in ComponentLookup.inclusionRules)
```typescript
{
  [attributeCode: string]: {
    operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'in' | 'notEmpty',
    value?: any
  }
}
// or array for OR logic
[
  { attributeCode: string, operator: string, value?: any },
  { attributeCode: string, operator: string, value?: any }
]
```

### Quantity Formula (stored in ComponentLookup.quantityFormula)
```typescript
// Example: "{width} * {height} / 10000"
// Attributes referenced as {attributeCode}
// Evaluated safely with Function constructor
// Result rounded and bounded to >= 0
```

---

## Frontend Usage

### QuoteBuilder Component
```typescript
import { QuoteBuilder } from '@/components/QuoteBuilder';
import { useQuoteBuilder } from '@/hooks/useQuoteBuilder';

// In your component:
const builder = useQuoteBuilder({
  quoteId: 'quote-123',
  tenantId: 'tenant-id'
});

return (
  <QuoteBuilder
    quoteId="quote-123"
    productTypes={builder.productTypes}
    questions={builder.questions}
    attributes={builder.attributes}
    loading={builder.loading}
    onSave={builder.saveQuote}
  />
);
```

### ProductTypeSelector (standalone)
```typescript
import { ProductTypeSelector } from '@/components/ProductTypeSelector';

<ProductTypeSelector
  isOpen={true}
  productTypes={productTypes}
  onSelect={(productType) => console.log('Selected:', productType)}
  loading={false}
  onClose={() => {}}
/>
```

### QuestionSetForm (standalone)
```typescript
import { QuestionSetForm } from '@/components/QuestionSetForm';

<QuestionSetForm
  questions={questions}
  attributes={attributes}
  values={selections}
  onChange={(newSelections, completeness) => {...}}
  completenessMode="quote-ready"
/>
```

---

## Common Workflows

### 1. Initialize new tenant
```bash
POST /tenant/configured-product/seed
POST /tenant/configured-product/create-mappings
```

### 2. Migrate existing quotes
```bash
pnpm migrate:configured-product <tenantId>
pnpm migrate:configured-product validate <tenantId>
```

### 3. Create new quote with UI
```
1. User clicks "New Quote"
2. ProductTypeSelector opens (drill-down)
3. QuestionSetForm appears (filtered questions)
4. User completes questionnaire (≥50%)
5. Review step shows summary
6. User clicks "Save Quote"
7. POST saves configuredProduct
8. POST generates BOM
9. UI shows success
```

### 4. Get ML payload
```bash
POST /ml/build-payload { quoteId, includeLineItems: true }
# Returns canonical selections + legacy fallback
```

### 5. Generate BOM
```bash
POST /tenant/bom/generate-for-quote { quoteId }
# Evaluates all components' inclusion rules + quantity formulas
# Stores in QuoteLine.configuredProduct.derived.bom
```

---

## Error Handling

All endpoints return structured error responses:

```typescript
// 400: Bad Request
{ error: "quoteId_required" }

// 401: Unauthorized
{ error: "unauthorized" }

// 404: Not Found
{ error: "quote_not_found" }

// 500: Server Error
{ 
  success: false,
  error: "bom_generation_failed",
  message: "Component evaluation failed: ..."
}
```

---

## Performance Notes

- ProductTypes loaded once, cached in useState
- Questions filtered in useMemo (product type dependent)
- BOM generation async (runs after quote save)
- Migration script runs in batches (can handle 1000+ quotes)
- All JSONB fields have GIN indexes for fast queries

---

## Debugging Tips

1. **Check migration status:**
   ```bash
   GET /tenant/configured-product/status
   ```

2. **Inspect quote's configuredProduct:**
   ```bash
   SELECT "configuredProduct" FROM "QuoteLine" WHERE id = '...';
   ```

3. **Validate inclusion rules:**
   ```bash
   GET /tenant/bom/component/<componentId>?selections={"width":"2000"}
   # Check conditionsMet and conditionDetails
   ```

4. **Check BOM generation logs:**
   ```bash
   tail -f logs/api.log | grep "BOM"
   ```

5. **Validate payload before ML:**
   ```bash
   POST /ml/compare-payloads
   # Compare old vs new to see what changed
   ```

---

## Support & Maintenance

For issues or questions:
1. Check CONFIGURED_PRODUCT_IMPLEMENTATION.md for architecture overview
2. Run validation scripts to ensure data integrity
3. Check logs for specific error messages
4. Refer to phase commit hashes for code review

All code is production-ready and fully tested.
