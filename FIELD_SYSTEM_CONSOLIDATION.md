# Field System Consolidation Plan

## Current State Analysis

### Existing Field Categories (Scattered)

Currently, fields are defined in multiple places with overlapping purposes:

1. **Client/Contact Info** - Name, email, phone, address
   - Location: Lead model, custom fields, questionnaire
   - Issue: Sometimes in Lead table, sometimes in custom JSON

2. **Public Questionnaire Fields** - What customers fill in the estimator
   - Location: TenantSettings.questionnaire array
   - Issue: Not using QuestionnaireField table, disconnected from ML

3. **Internal/CRM Fields** - Source, quote value, notes, status tracking
   - Location: Scattered in Lead.custom, some in settings
   - Issue: No consistent schema, hard to query

4. **Post-Won/Manufacturing Fields** - Final measurements, specs for production
   - Location: QuestionnaireField with `visibleAfterOrder` flag
   - Issue: Not well integrated, unclear when they show

5. **ML Training Fields** - Standard fields for AI estimator
   - Location: QuestionnaireField with `isStandard` flag
   - Status: ✅ WORKING - This is the RIGHT approach

### Database Schema (CORRECT Foundation)

```prisma
model QuestionnaireField {
  // Core
  id String @id
  tenantId String
  questionnaireId String
  key String @unique
  label String
  type QuestionnaireFieldType
  
  // Configuration
  options Json?
  required Boolean @default(false)
  placeholder String?
  helpText String?
  config Json?
  
  // Ordering
  sortOrder Int @default(0)
  
  // ML & Costing
  isStandard Boolean @default(false)        // ✅ System field for ML
  costingInputKey String?                   // ✅ Maps to pricing engine
  requiredForCosting Boolean @default(false)
  
  // Visibility & Scope
  scope String? @default("item")            // ✅ "client", "item", "internal"
  isActive Boolean @default(true)
  isHidden Boolean @default(false)
  
  // Legacy (to be removed)
  order Int @default(0)                     // ❌ Duplicate of sortOrder
}
```

**The schema is PERFECT** - we just need to use it consistently!

---

## Unified Field System Design

### Field Scopes (Primary Classification)

All fields belong to ONE of these scopes:

#### 1. **`scope: "client"`** - Client Contact Information
Standard contact fields that identify WHO the customer is:
- `contact_name` (always required)
- `email` (always required)
- `phone`
- `address`
- `company`

**Shown in:**
- ✅ Public estimator (Contact step)
- ✅ LeadModal (Details tab)
- ✅ Lead list
- ❌ NOT in item-level questionnaire

#### 2. **`scope: "public"`** - Public Questionnaire Fields
Questions shown to customers in the public estimator:
- Configurable by tenant in Settings
- Can be global (once per quote) or per-item
- Examples: timber type, glass spec, finish, door style, hardware
- Uses `costingInputKey` to feed ML estimator

**Shown in:**
- ✅ Public estimator (Global specs & item details)
- ✅ LeadModal (Questionnaire tab)
- ❌ NOT in internal CRM views

#### 3. **`scope: "internal"`** - Internal CRM Fields
Business tracking fields NOT shown to customers:
- Lead source / campaign
- Estimated value
- Quoted value
- Date quote sent
- Internal notes
- Sales stage
- Lost reason

**Shown in:**
- ✅ LeadModal (Details tab - internal section)
- ✅ Quote builder (internal notes)
- ❌ NOT in public estimator

#### 4. **`scope: "manufacturing"`** - Post-Won Fields
Final specs needed AFTER winning the job:
- Final measurements (after site visit)
- Production notes
- Installation date
- Specific manufacturing tolerances
- Compliance certifications needed

**Shown in:**
- ✅ LeadModal (Manufacturing tab - only when status = WON)
- ✅ Project/Workshop view
- ❌ NOT shown before job is won

### Field Flags (Secondary Attributes)

These flags work WITH scope to control behavior:

- **`isStandard`** - System-defined ML training field (cannot be deleted)
- **`isActive`** - Field is enabled (soft delete)
- **`isHidden`** - Hide from forms but keep data
- **`required`** - Must be filled before submission
- **`costingInputKey`** - Maps to ML estimator input (e.g., "timber_species", "width", "height")
- **`requiredForCosting`** - Must be filled to get estimate

---

## Migration Plan

### Phase 1: Standardize Scope Values ✅

Update all existing fields to use the new scope system:

```ts
// api/src/lib/standardQuestionnaireFields.ts

export const STANDARD_FIELDS = [
  // CLIENT SCOPE
  { key: "contact_name", label: "Contact Name", type: "TEXT", scope: "client", required: true, sortOrder: 1 },
  { key: "email", label: "Email", type: "TEXT", scope: "client", required: true, sortOrder: 2 },
  { key: "phone", label: "Phone", type: "TEXT", scope: "client", sortOrder: 3 },
  { key: "address", label: "Address", type: "TEXTAREA", scope: "client", sortOrder: 4 },
  { key: "company", label: "Company", type: "TEXT", scope: "client", sortOrder: 5 },
  
  // PUBLIC SCOPE (ML Training Fields)
  { key: "timber_species", label: "Timber Species", type: "SELECT", scope: "public", costingInputKey: "timber_species", isStandard: true, sortOrder: 100 },
  { key: "door_style", label: "Door Style", type: "SELECT", scope: "public", costingInputKey: "door_style", isStandard: true, sortOrder: 101 },
  { key: "glass_type", label: "Glass Type", type: "SELECT", scope: "public", costingInputKey: "glass_type", isStandard: true, sortOrder: 102 },
  { key: "finish", label: "Finish", type: "SELECT", scope: "public", costingInputKey: "finish", isStandard: true, sortOrder: 103 },
  { key: "hardware", label: "Hardware", type: "SELECT", scope: "public", costingInputKey: "hardware", isStandard: true, sortOrder: 104 },
  { key: "width", label: "Width (mm)", type: "NUMBER", scope: "public", costingInputKey: "width", required: true, requiredForCosting: true, sortOrder: 105 },
  { key: "height", label: "Height (mm)", type: "NUMBER", scope: "public", costingInputKey: "height", required: true, requiredForCosting: true, sortOrder: 106 },
  { key: "quantity", label: "Quantity", type: "NUMBER", scope: "public", costingInputKey: "quantity", required: true, requiredForCosting: true, sortOrder: 107 },
  
  // INTERNAL SCOPE
  { key: "lead_source", label: "Lead Source", type: "SELECT", scope: "internal", options: ["Website", "Google Ads", "Referral", "Social Media", "Direct"], sortOrder: 200 },
  { key: "estimated_value", label: "Estimated Value", type: "NUMBER", scope: "internal", sortOrder: 201 },
  { key: "quoted_value", label: "Quoted Value", type: "NUMBER", scope: "internal", sortOrder: 202 },
  { key: "internal_notes", label: "Internal Notes", type: "TEXTAREA", scope: "internal", sortOrder: 203 },
  { key: "sales_stage", label: "Sales Stage", type: "SELECT", scope: "internal", sortOrder: 204 },
  
  // MANUFACTURING SCOPE
  { key: "final_width", label: "Final Width (mm)", type: "NUMBER", scope: "manufacturing", sortOrder: 300 },
  { key: "final_height", label: "Final Height (mm)", type: "NUMBER", scope: "manufacturing", sortOrder: 301 },
  { key: "installation_date", label: "Installation Date", type: "DATE", scope: "manufacturing", sortOrder: 302 },
  { key: "production_notes", label: "Production Notes", type: "TEXTAREA", scope: "manufacturing", sortOrder: 303 },
];
```

### Phase 2: Update Settings UI

**`web/src/app/settings/page.tsx`**

Replace the old questionnaire section with scope-based tabs:

```tsx
<Tabs defaultValue="public">
  <TabsList>
    <TabsTrigger value="client">Client Info</TabsTrigger>
    <TabsTrigger value="public">Public Questionnaire</TabsTrigger>
    <TabsTrigger value="internal">Internal Fields</TabsTrigger>
    <TabsTrigger value="manufacturing">Manufacturing</TabsTrigger>
  </TabsList>
  
  <TabsContent value="public">
    <AdminQuestionnaireFieldsTable scope="public" />
  </TabsContent>
  
  <TabsContent value="internal">
    <AdminQuestionnaireFieldsTable scope="internal" />
  </TabsContent>
  
  {/* etc */}
</Tabs>
```

### Phase 3: Update Public Estimator

**Use QuestionnaireField table instead of settings.questionnaire**

```tsx
// web/src/components/publicEstimator/steps/GlobalSpecsStep.tsx

const { data: fields } = useSWR(`/questionnaire-fields?scope=public&global=true`);

// Render fields from QuestionnaireField table
fields?.map(field => (
  <FormField
    key={field.id}
    field={field}
    value={formData[field.key]}
    onChange={(value) => setFormData(prev => ({ ...prev, [field.key]: value }))}
  />
))
```

### Phase 4: Update LeadModal

**Show fields based on scope and stage:**

```tsx
// web/src/app/leads/LeadModal.tsx

// CLIENT INFO (always visible)
<Section title="Contact Details">
  {clientFields.map(field => <FieldRenderer field={field} />)}
</Section>

// PUBLIC QUESTIONNAIRE (tab)
{stage === 'questionnaire' && (
  <Section title="Quote Details">
    {publicFields.map(field => <FieldRenderer field={field} />)}
  </Section>
)}

// INTERNAL (always visible to staff)
<Section title="Internal" collapsed>
  {internalFields.map(field => <FieldRenderer field={field} />)}
</Section>

// MANUFACTURING (only when status === 'WON')
{lead.status === 'WON' && (
  <Section title="Manufacturing">
    {manufacturingFields.map(field => <FieldRenderer field={field} />)}
  </Section>
)}
```

### Phase 5: Create Reusable Field Renderer

**`web/src/components/fields/UnifiedFieldRenderer.tsx`**

```tsx
export function UnifiedFieldRenderer({ 
  field, 
  value, 
  onChange, 
  readonly = false 
}: {
  field: QuestionnaireField;
  value: any;
  onChange: (value: any) => void;
  readonly?: boolean;
}) {
  switch (field.type) {
    case 'TEXT':
      return <Input 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        disabled={readonly}
        required={field.required}
      />;
    
    case 'NUMBER':
      return <Input 
        type="number"
        value={value || ''} 
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={field.placeholder}
        disabled={readonly}
        required={field.required}
      />;
    
    case 'SELECT':
      return <Select 
        value={value || ''} 
        onValueChange={onChange}
        disabled={readonly}
        required={field.required}
      >
        {field.options?.map(opt => (
          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
        ))}
      </Select>;
    
    case 'TEXTAREA':
      return <Textarea 
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        disabled={readonly}
        required={field.required}
      />;
    
    case 'DATE':
      return <Input 
        type="date"
        value={value || ''} 
        onChange={(e) => onChange(e.target.value)}
        disabled={readonly}
        required={field.required}
      />;
    
    default:
      return <span>Unsupported field type: {field.type}</span>;
  }
}
```

---

## Implementation Checklist

### Database Migration
- [x] Schema already correct - no changes needed!
- [ ] Update existing fields to use new scope values
- [ ] Remove legacy `order` column (use `sortOrder` only)

### Backend API
- [ ] Update `/questionnaire-fields` to filter by scope
- [ ] Ensure scope is saved/updated correctly
- [ ] Add endpoint: `GET /questionnaire-fields/by-scope/:scope`

### Settings UI
- [ ] Replace old questionnaire table with scope-based tabs
- [ ] Update AdminQuestionnaireFieldsTable to accept scope filter
- [ ] Add scope selector when creating new fields

### Public Estimator
- [ ] Replace settings.questionnaire with QuestionnaireField queries
- [ ] Contact step: scope="client"
- [ ] Global specs: scope="public" + global flag
- [ ] Item details: scope="public" + per-item

### LeadModal
- [ ] Show client fields in Details tab
- [ ] Show public fields in Questionnaire tab
- [ ] Show internal fields in Details tab (collapsed section)
- [ ] Show manufacturing fields only when status=WON

### Quote Builder
- [ ] Use UnifiedFieldRenderer for questionnaire answers
- [ ] Respect scope visibility rules

---

## Benefits of This Approach

### ✅ Single Source of Truth
- All fields defined in `QuestionnaireField` table
- No more scattered definitions in settings JSON
- Easy to query, filter, and manage

### ✅ Clear Separation of Concerns
- `scope` makes it obvious where each field belongs
- No confusion about "should this show in estimator?"
- Easy to add new fields with correct visibility

### ✅ ML Training Continuity
- `isStandard` + `costingInputKey` preserved
- Existing ML pipeline unchanged
- New custom fields can also feed ML if needed

### ✅ Flexible & Extensible
- Tenants can add custom fields to any scope
- Standard fields cannot be deleted (isStandard)
- Easy to add new scopes in future (e.g., "legal", "compliance")

### ✅ Better UX
- Right fields in right place
- No clutter from irrelevant fields
- Manufacturing fields hidden until needed

---

## Migration Script

```ts
// api/scripts/migrateFieldScopes.ts

import { prisma } from '../src/prisma';
import { STANDARD_FIELDS } from '../src/lib/standardQuestionnaireFields';

async function migrateFieldScopes() {
  console.log('🔄 Migrating field scopes...');
  
  // Map old flags to new scopes
  const scopeMap: Record<string, string> = {
    // Contact fields
    'contact_name': 'client',
    'email': 'client',
    'phone': 'client',
    'address': 'client',
    'company': 'client',
    
    // Internal tracking
    'lead_source': 'internal',
    'estimated_value': 'internal',
    'quoted_value': 'internal',
    'internal_notes': 'internal',
    
    // Manufacturing
    'final_width': 'manufacturing',
    'final_height': 'manufacturing',
    'installation_date': 'manufacturing',
    'production_notes': 'manufacturing',
  };
  
  // All other fields default to "public"
  const allFields = await prisma.questionnaireField.findMany();
  
  for (const field of allFields) {
    const newScope = scopeMap[field.key] || 'public';
    
    await prisma.questionnaireField.update({
      where: { id: field.id },
      data: { scope: newScope }
    });
    
    console.log(`  ✓ ${field.key} → ${newScope}`);
  }
  
  console.log('✅ Migration complete!');
}

migrateFieldScopes();
```

---

## Next Steps

1. **Run migration script** to update existing field scopes
2. **Update settings UI** to use scope-based organization
3. **Refactor public estimator** to query QuestionnaireField table
4. **Update LeadModal** to show fields by scope
5. **Remove legacy questionnaire array** from TenantSettings
6. **Test thoroughly** across all contexts

This consolidation will make the system much clearer and easier to maintain!
