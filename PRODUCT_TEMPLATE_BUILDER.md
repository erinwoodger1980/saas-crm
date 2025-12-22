# Product Template 3D Component Builder

## Overview

The Settings → Product Types section now includes a full 3D component builder, allowing you to create default product templates with customized components that will be used when creating quotes.

## Features Added

### 1. Component Building in Settings
- Each product option (e.g., "Single Door", "Double Casement") can now have a saved 3D configuration
- Click **"Build 3D Components"** to open the full configurator
- Build custom arrangements of rails, stiles, panels, glass, and other components
- Changes are automatically saved to the product template

### 2. Visual Indicators
- Products with saved 3D configurations show a **"✓ 3D Config"** badge
- Button text changes from "Build 3D Components" to "Edit 3D Components" when config exists

### 3. Template Persistence
- 3D configurations are saved to `ProductOption.sceneConfig`
- Stored in tenant settings alongside product catalog
- Automatically loaded when the configurator is opened
- Used as default when creating new quotes with this product type

## Usage Workflow

### Creating a Product Template

1. **Navigate to Settings → Product Types**
2. **Expand a Category** (e.g., Doors, Windows)
3. **Expand a Type** (e.g., Entrance Door, Casement)
4. **Find the Option** you want to configure (e.g., "Single Door")
5. **Click "Build 3D Components"**

### In the Component Builder

The full configurator opens with these features:

- **Component Inspector Panel** (right sidebar)
  - View and edit properties of selected components
  - Adjust dimensions, materials, positions
  - Modify curves for custom profiles

- **3D Canvas** (main area)
  - Rotate and zoom the camera
  - Click components to select them
  - See real-time updates as you make changes

- **Component List** (left sidebar)
  - See all components in the product
  - Toggle visibility
  - Select components for editing

- **Auto-Save**
  - Changes are automatically saved to the product template
  - No need to manually save after each edit

### Using Templates in Quotes

When you select a product type that has a saved 3D configuration:
1. The configurator automatically loads the template
2. All components are pre-configured with the default setup
3. You can further customize for the specific quote
4. Template remains unchanged for future use

## Technical Implementation

### Files Modified

**`web/src/components/settings/ProductTypesSection.tsx`**
- Added `sceneConfig?: any` to `ProductOption` type
- Added `initialConfig` support to pass saved configs to configurator
- Modified configurator modal to enable component editing (`heroMode={false}`)
- Added auto-save on `onChange` callback
- Added visual badge for products with 3D configs

**`web/src/components/configurator/ProductConfigurator3D.tsx`**
- Added `initialConfig?: SceneConfig` prop
- Load initialConfig before attempting database load
- Allows passing pre-built configurations directly

### Data Flow

```
Settings Page (ProductTypesSection)
  ↓ Opens Configurator with initialConfig
ProductConfigurator3D
  ↓ Loads initialConfig or builds new scene
User Edits Components
  ↓ onChange callback triggered
Settings Page updates products state
  ↓ User clicks "Save Products"
Backend saves to tenant.settings.productTypes
  ↓ Product templates persist
Quote Creation loads templates as defaults
```

### Scene Config Structure

```typescript
{
  version: '1.0.0',
  dimensions: { width, height, depth },
  components: [
    {
      id: 'rail-top',
      type: 'Box',
      geometry: { width, height, depth },
      material: { materialId },
      transform: { position, rotation }
    },
    // ... more components
  ],
  materials: { ... },
  camera: { ... },
  lighting: { ... },
  customData: ProductParams
}
```

## Benefits

1. **Consistency**: Default component layouts ensure quotes start with approved designs
2. **Efficiency**: No need to rebuild common configurations for every quote
3. **Customization**: Each product type can have unique default components
4. **Flexibility**: Templates can be edited at any time
5. **Quality**: 3D preview ensures components are positioned correctly

## Example Use Cases

### Standard Entrance Door Template
- Top rail at 200mm from top
- Bottom rail at 200mm from bottom
- Two intermediate rails dividing height
- Full-width stiles on left and right
- Central glass panel with 50mm margin

### Bay Window Template
- Pre-configured with 3 casement sections
- Angled frame components
- Mullions at correct spacing
- Glass panes in each section

### Fire Door Template
- Intumescent strips pre-positioned
- Certified component spacing
- Required hardware mounting points
- Compliance-ready layout

## Future Enhancements

- [ ] Import/export templates between tenants
- [ ] Template versioning and history
- [ ] Template library with industry standards
- [ ] AI-suggested component layouts based on dimensions
- [ ] Template categories (residential, commercial, heritage)
