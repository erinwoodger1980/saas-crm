# Grid Color Customization Implementation

## Overview
Added comprehensive color picking and dropdown option editing capabilities to the leads grid view, matching the functionality available in the fire door schedule.

## What Was Implemented

### 1. CustomizableGrid Component Enhanced
**File:** `web/src/components/CustomizableGrid.tsx`

**New Features:**
- Added settings gear icon to all dropdown column headers (both frozen and scrollable)
- Icon appears only for dropdown-type columns when edit functionality is enabled
- Added support for custom colors via `customColors` prop
- Added support for custom dropdown options via `customDropdownOptions` prop
- Color rendering priority: custom colors → column-defined colors → default gray

**New Props:**
```typescript
interface CustomizableGridProps {
  // ... existing props
  onEditColumnOptions?: (field: string) => void;
  customColors?: Record<string, { bg: string; text: string }>;
  customDropdownOptions?: Record<string, string[]>;
}
```

**Key Implementation Details:**
- Custom color keys use format: `"fieldName:value"` (e.g., `"status:QUOTE_SENT"`)
- Dropdown cells apply custom colors when available
- Settings icon triggers callback with field name for parent to handle editing
- Custom dropdown options override column-defined options when provided

### 2. DropdownOptionsEditor Modal Component
**File:** `web/src/components/DropdownOptionsEditor.tsx`

**Features:**
- Add/remove dropdown options for any field
- 18 preset color choices (Tailwind color palette)
- Color picker appears below option when "Color" button clicked
- Real-time preview of colors on option badges
- localStorage persistence handled by parent component

**Preset Colors Include:**
- Gray, Red, Orange, Amber, Yellow, Lime, Green, Emerald, Teal
- Cyan, Sky, Blue, Indigo, Violet, Purple, Fuchsia, Pink, Rose

**Props:**
```typescript
interface DropdownOptionsEditorProps {
  isOpen: boolean;
  onClose: () => void;
  fieldName: string;
  fieldLabel: string;
  currentOptions: string[];
  currentColors: Record<string, { bg: string; text: string }>;
  onSave: (options: string[], colors: Record<string, { bg: string; text: string }>) => void;
}
```

### 3. Leads Page Integration
**File:** `web/src/app/leads/page.tsx`

**State Management Added:**
```typescript
// Custom colors for dropdown values
const [customColors, setCustomColors] = useState<Record<string, { bg: string; text: string }>>(() => {
  const saved = localStorage.getItem('leads-custom-colors');
  return saved ? JSON.parse(saved) : {};
});

// Custom dropdown options per field
const [dropdownOptions, setDropdownOptions] = useState<Record<string, string[]>>(() => {
  const saved = localStorage.getItem('leads-dropdown-options');
  return saved ? JSON.parse(saved) : {};
});

// Track which field is being edited
const [editingField, setEditingField] = useState<string | null>(null);
```

**Handler Function:**
```typescript
function handleSaveDropdownOptions(field: string, options: string[], colors: Record<string, { bg: string; text: string }>) {
  // Save dropdown options
  const newOptions = { ...dropdownOptions, [field]: options };
  setDropdownOptions(newOptions);
  localStorage.setItem('leads-dropdown-options', JSON.stringify(newOptions));

  // Save custom colors
  setCustomColors(colors);
  localStorage.setItem('leads-custom-colors', JSON.stringify(colors));

  toast({ title: "Options updated", description: `Dropdown options and colors saved for ${field}` });
}
```

**CustomizableGrid Integration:**
```tsx
<CustomizableGrid
  data={rows}
  columns={columnConfig}
  onRowClick={openLead}
  onCellChange={handleCellChange}
  customColors={customColors}
  customDropdownOptions={dropdownOptions}
  onEditColumnOptions={(field) => setEditingField(field)}
/>
```

**Modal Integration:**
```tsx
{editingField && (
  <DropdownOptionsEditor
    isOpen={!!editingField}
    onClose={() => setEditingField(null)}
    fieldName={editingField}
    fieldLabel={columnConfig.find(c => c.field === editingField)?.label || editingField}
    currentOptions={dropdownOptions[editingField] || columnConfig.find(c => c.field === editingField)?.dropdownOptions || []}
    currentColors={customColors}
    onSave={(options, colors) => handleSaveDropdownOptions(editingField, options, colors)}
  />
)}
```

## User Workflow

### How to Use:
1. **Switch to grid view:** Click the grid icon in leads page
2. **Open editor:** Click the gear icon ⚙️ on any dropdown column header
3. **Add options:** Type new option name and click "Add"
4. **Set colors:** Click "Color" button on any option to show color palette
5. **Choose color:** Click a color swatch to apply it
6. **Remove options:** Click "Remove" button to delete an option
7. **Save changes:** Click "Save Changes" to persist to localStorage

### What Gets Saved:
- Custom dropdown options: `localStorage.getItem('leads-custom-colors')`
- Custom colors: `localStorage.getItem('leads-dropdown-options')`
- Format: `{ "fieldName:value": { bg: "bg-blue-100", text: "text-blue-700" } }`

## LocalStorage Keys
- **Leads custom colors:** `leads-custom-colors`
- **Leads dropdown options:** `leads-dropdown-options`
- **Leads view mode:** `leads-view-mode` (existing)
- **Leads column config:** `leads-column-config-{tab}` (existing)

## Technical Notes

### Color Format
Colors use Tailwind CSS utility classes:
```typescript
{
  bg: "bg-blue-100",  // Background color
  text: "text-blue-700" // Text color
}
```

### Custom Color Key Format
```typescript
// Format: "fieldName:fieldValue"
const key = `${fieldName}:${value}`;
// Example: "status:QUOTE_SENT"
```

### Dropdown Options Priority
1. Custom dropdown options from localStorage (highest priority)
2. Column-defined dropdown options from config
3. Empty array (fallback)

### Color Application Priority
1. Custom colors from localStorage (highest priority)
2. Column-defined dropdown colors
3. Default gray (fallback)

## Future Enhancements

### Opportunities Page
The opportunities page currently uses a card-based layout, not CustomizableGrid. To add the same functionality:
1. Either add grid view mode to opportunities
2. Or implement color customization in card view dropdowns

### Additional Features to Consider
- Export/import color schemes
- Share color schemes across pages
- Reset to defaults button
- Color scheme templates
- Bulk color application
- Search/filter options in editor
- Drag-to-reorder options

## Testing Checklist
- ✅ Settings icon appears on dropdown column headers
- ✅ Modal opens when clicking settings icon
- ✅ Can add new dropdown options
- ✅ Can remove dropdown options
- ✅ Can set colors for options
- ✅ Colors persist in localStorage
- ✅ Custom options persist in localStorage
- ✅ Colors apply correctly in grid cells
- ✅ Custom options apply correctly in dropdowns
- ✅ Build succeeds without errors
- [ ] Verify color picker positioning works in all browsers
- [ ] Test with many options (scrolling behavior)
- [ ] Test with very long option names

## Files Modified
1. `web/src/components/CustomizableGrid.tsx` - Added color/options customization support
2. `web/src/components/DropdownOptionsEditor.tsx` - NEW: Modal for editing options and colors
3. `web/src/app/leads/page.tsx` - Integrated customization state and modal

## References
- Fire door schedule implementation: `web/src/app/fire-door-schedule/page.tsx`
- ColoredSelect component: `web/src/components/ColoredSelect.tsx`
