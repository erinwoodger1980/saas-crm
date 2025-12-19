# Flexible Field System - Integration Checklist

Use this checklist when integrating custom fields into a new page or feature.

## Pre-Integration (5 minutes)

- [ ] Review CustomFieldsPanel component location: `/web/src/components/fields/CustomFieldsPanel.tsx`
- [ ] Identify entity type (client, lead, line_item, opportunity, manufacturing, fire_door_project)
- [ ] Determine if you need read-only mode
- [ ] Plan where on page/modal fields will appear

## Implementation (10 minutes)

### Step 1: Import Component
```tsx
import { CustomFieldsPanel } from '@/components/fields/CustomFieldsPanel';
```

### Step 2: Add to JSX
```tsx
<CustomFieldsPanel 
  entityType="client"           // Entity type (required)
  entityId={clientId}            // Entity ID (required)
  onSave={refetchClient}         // Callback after save (optional)
  readOnly={!isEditing}          // Read-only mode (optional)
/>
```

### Step 3: Verify Entity API
Ensure the entity API endpoint supports PATCH with custom field updates:
```tsx
PATCH /{entities}/{id}
{
  custom: { fieldKey: value, ... }
}
```

## Manual Integration (20 minutes, if needed)

If CustomFieldsPanel doesn't fit your use case:

### Step 1: Import Hooks
```tsx
import { useFields } from '@/hooks/useFields';
import { FieldForm } from '@/components/fields/FieldRenderer';
```

### Step 2: Fetch Fields
```tsx
const { fields } = useFields({
  scope: 'client',              // Entity scope
  context: 'client_detail'      // Display context
});
```

### Step 3: Manage State
```tsx
const [values, setValues] = useState<Record<string, any>>({});
```

### Step 4: Render Form
```tsx
<FieldForm 
  fields={fields}
  values={values}
  onChange={setValues}
  disabled={!isEditing}
/>
```

### Step 5: Save Values
```tsx
await apiFetch(`/clients/${id}`, {
  method: 'PATCH',
  json: { custom: values }
});
```

## Testing (10 minutes)

- [ ] Create a test field at `/settings/fields`
  - Key: `test_field`
  - Type: `TEXT`
  - Scope: Match your entity type
  - Help text: "Test field"

- [ ] Set visibility at `/settings/display-contexts`
  - Select your test field
  - Enable for relevant display contexts

- [ ] Test on your page
  - [ ] Field appears in correct location
  - [ ] Can enter value
  - [ ] Value saves to database
  - [ ] Value persists on reload
  - [ ] Field shows in read-only mode

- [ ] Run diagnostic test
  - Go to `/settings/field-system-test`
  - Click "Run Test Suite"
  - Verify all tests pass

## Integration Patterns

### Pattern 1: Simple Page Integration
**Location:** Client detail, lead detail, etc.

```tsx
export default function DetailPage() {
  return (
    <div>
      {/* Existing content */}
      <CustomFieldsPanel 
        entityType="client"
        entityId={id}
        onSave={refetch}
      />
    </div>
  );
}
```

### Pattern 2: Modal Integration
**Location:** Lead modal, client modal, etc.

```tsx
export function DetailModal() {
  const [isEditing, setIsEditing] = useState(false);
  
  return (
    <Dialog>
      <DialogContent>
        {/* Existing fields */}
        <CustomFieldsPanel 
          entityType="lead"
          entityId={id}
          readOnly={!isEditing}
          onSave={refetch}
        />
      </DialogContent>
    </Dialog>
  );
}
```

### Pattern 3: Conditional Display
**Location:** Any page with optional sections

```tsx
export function DetailPage() {
  const [showCustomFields, setShowCustomFields] = useState(false);
  
  return (
    <div>
      <button onClick={() => setShowCustomFields(!showCustomFields)}>
        {showCustomFields ? 'Hide' : 'Show'} Custom Fields
      </button>
      
      {showCustomFields && (
        <CustomFieldsPanel 
          entityType="client"
          entityId={id}
        />
      )}
    </div>
  );
}
```

### Pattern 4: Tab-Based
**Location:** Pages with multiple tabs/sections

```tsx
export function DetailPage() {
  const [activeTab, setActiveTab] = useState('details');
  
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsContent value="details">
        {/* Standard fields */}
      </TabsContent>
      
      <TabsContent value="custom">
        <CustomFieldsPanel 
          entityType="client"
          entityId={id}
        />
      </TabsContent>
    </Tabs>
  );
}
```

## Troubleshooting

### Fields Not Showing
1. Check field is active: `/settings/fields`
2. Check scope matches entity type
3. Check display context visibility: `/settings/display-contexts`
4. Clear browser cache: Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
5. Hard refresh: Ctrl+F5 (or Cmd+Shift+R on Mac)

### Values Not Saving
1. Open browser dev tools: F12
2. Check Network tab for failed requests
3. Look for error messages in Console tab
4. Verify entity API endpoint accepts `custom` field
5. Check authentication headers are sent

### Performance Issues
1. Reduce number of fields displayed
2. Use `context` filter to show only relevant fields
3. Check browser dev tools Performance tab
4. Clear field cache: Hard refresh

### Need Custom Field Type
1. File feature request with requirements
2. Current types: TEXT, NUMBER, SELECT, BOOLEAN, TEXTAREA, DATE
3. Future: Multi-select, file upload, rich text

## API Reference (Quick)

### Fetch Fields
```tsx
const fields = await apiFetch('/api/flexible-fields?scope=client');
```

### Create Field
```tsx
await apiFetch('/api/flexible-fields', {
  method: 'POST',
  json: {
    key: 'my_field',
    label: 'My Field',
    type: 'TEXT',
    scope: 'client'
  }
});
```

### Evaluate Formula
```tsx
const result = await apiFetch('/api/flexible-fields/evaluate-field', {
  method: 'POST',
  json: {
    fieldId: 'field-123',
    inputs: { quantity: 5, price: 10 }
  }
});
```

### Get Field Visibility
```tsx
const contexts = await apiFetch(
  '/api/flexible-fields/display-contexts?fieldId=field-123'
);
```

## Support

**Documentation:** `/FLEXIBLE_FIELD_IMPLEMENTATION_GUIDE.md`

**Test Suite:** `/settings/field-system-test`

**Admin Tools:**
- Field Management: `/settings/fields`
- Display Contexts: `/settings/display-contexts`

**Questions:**
- Review guide for common issues
- Check test suite for diagnostics
- Review implementation examples in guide

---

**Happy integrating! The field system is designed to be easy to use.** 🚀
