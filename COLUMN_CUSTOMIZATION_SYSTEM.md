# Column Customization System for Leads & Opportunities

## ✅ Completed Components

### 1. `useColumnConfig` Hook (`web/src/lib/use-column-config.ts`)
Manages column configuration with localStorage persistence per status tab:
- Column visibility toggle
- Fixed/frozen column support  
- Column reordering
- Width management
- Per-status configuration (saved as `leads-column-config-NEW_ENQUIRY`, etc.)
- Default column sets for leads and opportunities

### 2. `CustomizableGrid` Component (`web/src/components/CustomizableGrid.tsx`)
Spreadsheet-style grid with:
- Fixed/frozen columns that stay visible during horizontal scroll
- Horizontal scrolling for wide tables
- Row click handling
- Cell editing with dropdown support
- Multiple field types: text, date, dropdown, number, email, phone, currency, boolean
- Dropdown fields with color coding

### 3. `ColumnConfigModal` Component (`web/src/components/ColumnConfigModal.tsx`)
Already existed! Modal for column configuration:
- Drag-and-drop column reordering
- Toggle visibility
- Toggle frozen/pinned status
- Search available fields
- Add/remove columns

## 🔧 Integration Steps

### Step 1: Define Available Fields for Leads

Create a constant in `/web/src/app/leads/page.tsx` with all fields from LeadModal:

```typescript
const AVAILABLE_LEAD_FIELDS = [
  // Basic fields
  { field: 'contactName', label: 'Contact Name', type: 'text' },
  { field: 'email', label: 'Email', type: 'email' },
  { field: 'phone', label: 'Phone', type: 'phone' },
  { field: 'companyName', label: 'Company', type: 'text' },
  { field: 'source', label: 'Source', type: 'text' },
  
  // Status with dropdown
  {
    field: 'status',
    label: 'Status',
    type: 'dropdown',
    dropdownOptions: ['NEW_ENQUIRY', 'INFO_REQUESTED', 'READY_TO_QUOTE', 'QUOTE_SENT'],
    dropdownColors: {
      'NEW_ENQUIRY': 'bg-blue-100 text-blue-700',
      'INFO_REQUESTED': 'bg-orange-100 text-orange-700',
      'READY_TO_QUOTE': 'bg-purple-100 text-purple-700',
      'QUOTE_SENT': 'bg-green-100 text-green-700',
    }
  },
  
  // Actions
  { field: 'nextAction', label: 'Next Action', type: 'text' },
  { field: 'nextActionAt', label: 'Next Action Date', type: 'date' },
  
  // Address fields
  { field: 'address', label: 'Address', type: 'text' },
  { field: 'city', label: 'City', type: 'text' },
  { field: 'postcode', label: 'Postcode', type: 'text' },
  
  // Custom fields - add dynamically based on tenant configuration
  { field: 'custom.projectType', label: 'Project Type', type: 'text' },
  { field: 'custom.budget', label: 'Budget', type: 'currency' },
  
  // Add more fields from LeadModal tabs...
];
```

### Step 2: Update Leads Page Component

In `/web/src/app/leads/page.tsx`, replace the current card-based UI with CustomizableGrid:

```typescript
import { CustomizableGrid } from "@/components/CustomizableGrid";
import { ColumnConfigModal } from "@/components/ColumnConfigModal";
import { useState } from "react";

// Inside your component:
const [showColumnConfig, setShowColumnConfig] = useState(false);
const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>([]);

// Load config from localStorage for current tab
useEffect(() => {
  const saved = localStorage.getItem(`leads-column-config-${tab}`);
  if (saved) {
    setColumnConfig(JSON.parse(saved));
  } else {
    // Use default config
    setColumnConfig(DEFAULT_COLUMNS.leads);
  }
}, [tab]);

// Save config
const handleSaveColumnConfig = (newConfig: ColumnConfig[]) => {
  localStorage.setItem(`leads-column-config-${tab}`, JSON.stringify(newConfig));
  setColumnConfig(newConfig);
};

// Render:
<Button onClick={() => setShowColumnConfig(true)}>
  Customize Columns
</Button>

<CustomizableGrid
  data={rows}
  columns={columnConfig}
  onRowClick={(lead) => {
    setSelected(lead);
    setOpen(true);
  }}
  onCellChange={async (leadId, field, value) => {
    // Update lead field via API
    await apiFetch(`/leads/${leadId}`, {
      method: 'PATCH',
      body: { [field]: value }
    });
    // Reload data
    load();
  }}
/>

<ColumnConfigModal
  open={showColumnConfig}
  onClose={() => setShowColumnConfig(false)}
  availableFields={AVAILABLE_LEAD_FIELDS}
  currentConfig={columnConfig}
  onSave={handleSaveColumnConfig}
  tabName={STATUS_LABELS[tab]}
/>
```

### Step 3: Update Opportunities Page

Similar integration in `/web/src/app/opportunities/page.tsx` with opportunity-specific fields.

## 📋 TODO: Complete Integration

1. **Define all available fields** from LeadModal tabs (overview, details, questionnaire, tasks, follow-up)
2. **Replace card-based UI** in leads page with CustomizableGrid
3. **Add "Customize Columns" button** to each status tab
4. **Handle cell editing** for dropdown fields to update lead status
5. **Test horizontal scrolling** with many columns
6. **Test frozen columns** work correctly during scroll
7. **Repeat for opportunities** page

## 🎨 UI Improvements to Consider

- Add column width resizing by dragging column borders
- Add column sorting (click header to sort)
- Add bulk actions (select multiple rows)
- Add export to CSV functionality
- Add saved column presets ("Sales View", "Admin View", etc.)
- Add inline filters per column

## 📝 Notes

- Column configs are stored per status tab, so NEW_ENQUIRY can have different columns than QUOTE_SENT
- Frozen columns stay visible on the left during horizontal scroll (like Excel)
- Dropdown fields automatically render as selects with color coding
- The system supports nested fields (e.g., `custom.projectType`)  
