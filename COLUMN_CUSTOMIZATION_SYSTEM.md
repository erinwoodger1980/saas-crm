# Column Customization System for Leads & Opportunities

## Overview
Upgrade leads and opportunities pages with customizable column views similar to the fire door schedule system.

## Features
- **Column Selection Modal**: Choose which fields to display per status tab
- **Per-Status Configuration**: Different column sets for each status (NEW_ENQUIRY, INFO_REQUESTED, etc.)
- **Fixed Columns**: Pin columns to the left (like fire door schedule)
- **Dropdown Fields**: Configure dropdown options with colors
- **Horizontal Scrolling**: Support wide tables with fixed columns
- **Field Sources**: All fields from LeadModal tabs (overview, details, questionnaire, tasks, follow-up)

## Implementation Plan

### 1. Column Configuration Storage
```typescript
interface ColumnConfig {
  field: string;          // Field key
  label: string;          // Display label
  visible: boolean;       // Show/hide
  fixed: boolean;         // Pin to left
  width: number;          // Column width
  type: 'text' | 'date' | 'dropdown' | 'number' | 'email' | 'phone';
  dropdownOptions?: string[];
  dropdownColors?: Record<string, string>;
  order: number;          // Display order
}

interface StatusColumnConfig {
  status: string;
  columns: ColumnConfig[];
}
```

### 2. Available Fields (from LeadModal)
- **Overview**: contactName, email, phone, status, source, nextAction, nextActionAt
- **Details**: companyName, address, city, postcode, customFields
- **Questionnaire**: All questionnaire responses
- **Tasks**: taskCount, completedTasks, upcomingTasks
- **Follow-up**: lastFollowUp, nextFollowUp, followUpCount

### 3. Components to Create
- `ColumnConfigModal.tsx` - Modal for selecting and configuring columns
- `CustomizableGrid.tsx` - Grid component with fixed columns and horizontal scroll
- `ColumnPresetManager.tsx` - Save/load column presets
- `useColumnConfig.ts` - Hook for managing column configuration

### 4. UI Flow
1. User clicks "Customize Columns" button on leads/opportunities page
2. Modal opens showing all available fields
3. User selects fields, sets fixed columns, configures dropdowns
4. Configuration saved per status tab in localStorage
5. Grid updates with selected columns

## Next Steps
1. Create column configuration components
2. Update leads page with customizable grid
3. Update opportunities page with customizable grid
4. Add column preset system for quick switching
