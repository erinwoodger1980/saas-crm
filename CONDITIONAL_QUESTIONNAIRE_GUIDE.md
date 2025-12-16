# Conditional Questionnaire Guide

## Overview
The system now supports conditional questionnaire fields that are shown/hidden based on the product types selected in quote line items. This allows you to ask product-specific questions only when relevant.

## How It Works

### 1. Product Type Selection
When users create quote line items, they select a product type through the TypeSelectorModal:
- **Category**: doors or windows
- **Type**: entrance, bifold, sliding, french (doors) or sash-cord, sash-spring, casement, stormproof, alu-clad (windows)
- **Option**: specific configuration (e.g., "2 Panel", "Single Hung")

The selected product type is stored in the quote item with the format: `{category}-{type}` (e.g., "doors-bifold", "windows-casement")

### 2. Linking Questions to Product Types
In the admin questionnaire editor (`/admin/questionnaire-fields`):
1. Create or edit a questionnaire field
2. Click the "Product Types" button in the row
3. Select which product types the question applies to using the hierarchical selector:
   - Check/uncheck entire categories (Doors, Windows)
   - Check/uncheck specific product types (Bi-fold, Casement, etc.)
4. Save your selection

### 3. Dynamic Filtering
When viewing/editing a lead/quote:
- Questions are filtered based on selected products in the Quote Line Items
- Only questions matching at least one selected product type are displayed
- Questions with no product types specified appear for all products
- If no products are selected yet, product-specific questions are hidden

### 4. Product Type Format
Product types use the format: `{category}-{type}`
- Example: `doors-bifold` matches Bi-fold Doors
- Example: `windows-casement` matches Casement Windows

## Use Cases

### Example 1: Door-Specific Questions
Ask about frame material only for doors:
- Create field: "Frame Material" (type: select)
- Link to product types: doors-entrance, doors-bifold, doors-sliding, doors-french
- Result: Only shown when door products are selected

### Example 2: Window-Specific Questions  
Ask about glazing type only for windows:
- Create field: "Glazing Type" (type: select)
- Link to product types: windows-sash-cord, windows-sash-spring, windows-casement, windows-stormproof, windows-alu-clad
- Result: Only shown when window products are selected

### Example 3: Product-Specific Questions
Ask about tilt-and-turn mechanism only for specific window types:
- Create field: "Tilt & Turn Handle Position" (type: select)
- Link to product types: windows-alu-clad
- Result: Only shown when alu-clad windows are selected

### Example 4: Universal Questions
Ask about installation preferences for all products:
- Create field: "Installation Date Preference" (type: date)
- Don't link to any product types (leave empty)
- Result: Always shown regardless of product selection

## Technical Implementation

### Database Schema
- **QuestionnaireField** model has `productTypes` field (String[])
- Product types are stored as an array of IDs like ["doors-bifold", "windows-casement"]

### Frontend Components
- **ProductTypeSelector** (`/web/src/components/questionnaire/ProductTypeSelector.tsx`): 
  - Hierarchical product type selector UI
  - Loads product catalog from tenant settings
  - Manages selection state with category/type checkboxes

- **LeadModal** (`/web/src/app/leads/LeadModal.tsx`):
  - Extracts selected product types from quote items
  - Filters questionnaire fields based on selection
  - Applies filtering to both workspace fields and quote detail fields

### API Endpoints
- `POST /questionnaire-fields` - Create field with productTypes
- `PUT /questionnaire-fields/:id` - Update field productTypes

## Configuration

### Adding New Product Categories
To add new product categories (beyond doors/windows):
1. Update tenant settings product catalog (`/settings`)
2. Add product types in the format `{category}-{type}`
3. Update TypeSelectorModal if needed for new category UI

### Adding New Product Types
To add new types within existing categories:
1. Update tenant settings product catalog
2. Product types will automatically appear in ProductTypeSelector
3. No code changes needed

## Benefits

1. **Cleaner User Experience**: Users only see relevant questions
2. **Reduced Errors**: No confusion about which questions apply to which products
3. **Flexible Configuration**: Admin can easily configure question visibility
4. **Smart Filtering**: Automatically adapts as products are added/removed from quotes
5. **Backward Compatible**: Existing questions without product types work as before

## Migration Notes

- Existing questionnaire fields will continue to work (shown for all products)
- No data migration required
- Admin can optionally link existing fields to product types over time
- Changes take effect immediately when product types are updated
