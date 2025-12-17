# Global Component System Architecture

## Overview

A completely tenant-agnostic component management system that works for ANY product type - fire doors, standard doors, windows, conservatories, garage doors, or any custom product a tenant wants to manufacture.

## Key Features

### 1. **Tenant Flexibility**
- No hardcoded product types or component types
- Tenants define their own product categories as strings
- Component types are flexible strings (e.g., "LIPPING", "HINGE", "GLASS_PANEL", "VINYL_FRAME")
- One system works for joiners, window manufacturers, garage door companies, etc.

### 2. **Universal Project System**
- `Project` model wraps ANY project type (Quote, Opportunity, FireDoorScheduleProject, custom jobs)
- Polymorphic relations allow linking to existing project records
- BOM generation works the same regardless of project type
- Easy to add new project types in the future

### 3. **Component Lookup System**
- `ComponentLookup`: Single source of truth for all components across all products
- Components can be shared across multiple product types
- Each component has: code, name, pricing, supplier, lead time, specifications
- Metadata field stores component-specific data (dimensions, materials, etc.)

### 4. **Database Schema**

```prisma
// Universal component that works for any product
model ComponentLookup {
  id                 String        @id @default(cuid())
  tenantId           String
  productTypes       String[]      // e.g., ["FIRE_DOOR", "STANDARD_DOOR"]
  componentType      String        // e.g., "LIPPING", "HINGE", tenant custom
  code               String        // Unique code like "LIPT25"
  name               String        // Display name
  description        String?
  unitOfMeasure      String        // EA, M, MM, KG, L
  basePrice          Float
  leadTimeDays       Int
  supplierId         String?       // Links to Supplier
  isActive           Boolean
  metadata           Json?         // Flexible component data
  
  tenant             Tenant
  supplier           Supplier?
  profile            ComponentProfile?
  bomLineItems       BOMLineItem[]
}

// Defines which components appear for each product type
model ProductTypeComponent {
  id                 String   @id
  tenantId           String
  productType        String   // e.g., "FIRE_DOOR", "CONSERVATORY"
  componentType      String   // e.g., "LIPPING", "GLASS_PANEL"
  displayName        String   // How to label in UI
  isRequired         Boolean
  defaultCode        String?  // Default component to pre-select
  sortOrder          Int
  formulaEnabled     Boolean  // Can use calculated fields?
  formulaExpression  String?  // JavaScript expression
  
  tenant             Tenant
}

// 3D profile data for components
model ComponentProfile {
  id                 String   @id
  componentLookupId  String   @unique
  profileType        String   // RECTANGULAR, L_SHAPE, etc.
  dimensions         Json     // {width, height, depth}
  geometry           Json?    // 3D geometry data
  materialProperties Json?    // Density, grain, etc.
  
  component          ComponentLookup
}

// Universal project wrapper
model Project {
  id                 String    @id
  tenantId           String
  projectType        String    // "FIRE_DOOR_SCHEDULE", "QUOTE", etc.
  projectName        String?
  referenceNumber    String?
  
  // Polymorphic links to actual projects
  fireDoorScheduleId String?   @unique
  quoteId            String?   @unique
  opportunityId      String?   @unique
  
  status             String?
  startDate          DateTime?
  completionDate     DateTime?
  metadata           Json?
  
  tenant             Tenant
  fireDoorSchedule   FireDoorScheduleProject?
  quote              Quote?
  opportunity        Opportunity?
  bomLineItems       BOMLineItem[]
}

// Bill of Materials line items
model BOMLineItem {
  id                 String    @id
  projectId          String
  componentLookupId  String
  componentType      String
  quantity           Float
  unitPrice          Float
  totalPrice         Float
  supplierId         String?
  status             BOMStatus // DRAFT, ORDERED, RECEIVED, etc.
  dateOrdered        DateTime?
  dateReceived       DateTime?
  notes              String?
  metadata           Json?
  
  project            Project
  component          ComponentLookup
  supplier           Supplier?
}

// Extended Supplier model
model Supplier {
  // ...existing fields...
  leadTimeDays       Int?      // Added for components
  preferredForTypes  String[]  // Component types this supplier prefers
  contactInfo        Json?     // Structured contact data
  
  components         ComponentLookup[]
  bomLineItems       BOMLineItem[]
}
```

## 5. **Usage Examples**

### Fire Door Manufacturer
```typescript
// Product types: "FIRE_DOOR", "FIRE_DOOR_SET", "ACOUSTIC_DOOR"
// Component types: "LIPPING", "INTUMESCENT_STRIP", "HINGE", "LOCK", "SEAL"

// Define lipping for fire doors
ComponentLookup.create({
  productTypes: ["FIRE_DOOR", "FIRE_DOOR_SET"],
  componentType: "LIPPING",
  code: "LIPT25",
  name: "Top Lipping 25mm",
  unitOfMeasure: "M",
  basePrice: 12.50,
  metadata: {
    thicknessMm: 25,
    material: "Hardwood",
    fireRated: true
  }
});

// Configure what components fire doors need
ProductTypeComponent.create({
  productType: "FIRE_DOOR",
  componentType: "LIPPING",
  displayName: "Door Lipping",
  isRequired: true,
  formulaEnabled: true,
  formulaExpression: "doorHeight * 2 + doorWidth * 2" // Calculate perimeter
});
```

### Window Manufacturer
```typescript
// Product types: "CASEMENT_WINDOW", "SASH_WINDOW", "TILT_TURN"
// Component types: "VINYL_FRAME", "GLASS_PANEL", "HARDWARE_KIT", "SEAL_STRIP"

ComponentLookup.create({
  productTypes: ["CASEMENT_WINDOW", "TILT_TURN"],
  componentType: "VINYL_FRAME",
  code: "VF70-WHITE",
  name: "70mm White Vinyl Frame",
  unitOfMeasure: "M",
  basePrice: 18.75,
  metadata: {
    profileWidth: 70,
    color: "White",
    chambers: 5,
    glazingDepth: 24
  }
});

ProductTypeComponent.create({
  productType: "CASEMENT_WINDOW",
  componentType: "GLASS_PANEL",
  displayName: "Glazing Unit",
  isRequired: true,
  formulaEnabled: true,
  formulaExpression: "windowWidth * windowHeight / 1000000" // Square meters
});
```

### Conservatory Manufacturer
```typescript
// Product types: "LEAN_TO", "VICTORIAN", "EDWARDIAN"
// Component types: "ROOF_PANEL", "BASE_RAIL", "GUTTER", "DOWNPIPE"

ComponentLookup.create({
  productTypes: ["LEAN_TO", "VICTORIAN", "EDWARDIAN"],
  componentType: "ROOF_PANEL",
  code: "RP16-POLY",
  name: "16mm Polycarbonate Roof Panel",
  unitOfMeasure: "M2",
  basePrice: 42.00,
  metadata: {
    thickness: 16,
    material: "Polycarbonate",
    uValue: 1.9,
    lightTransmission: "80%"
  }
});
```

## 6. **API Endpoints**

### Component Management
```
GET    /api/components                    # List all components for tenant
POST   /api/components                    # Create new component
GET    /api/components/:id                # Get component details
PUT    /api/components/:id                # Update component
DELETE /api/components/:id                # Delete component
GET    /api/components/by-product/:type   # Get components for product type
```

### Product Type Configuration
```
GET    /api/product-type-components              # List all configurations
POST   /api/product-type-components              # Create new configuration
PUT    /api/product-type-components/:id          # Update configuration
DELETE /api/product-type-components/:id          # Delete configuration
GET    /api/product-type-components/:productType # Get config for product type
```

### Project & BOM Management
```
POST   /api/projects                      # Create project wrapper
GET    /api/projects/:id/bom              # Get BOM for project
POST   /api/projects/:id/bom/generate     # Auto-generate BOM from project data
PUT    /api/bom-line-items/:id            # Update BOM line item
POST   /api/bom-line-items/:id/order      # Mark as ordered
POST   /api/bom-line-items/:id/receive    # Mark as received
```

### Supplier Management
```
GET    /api/suppliers/components/:componentType  # Get suppliers for component type
PUT    /api/suppliers/:id/preferences            # Update preferred component types
```

## 7. **UI Components**

### Component Selector
```typescript
// Reusable component selector that works for any product
<ComponentSelector
  productType="FIRE_DOOR"           // or "CASEMENT_WINDOW", "LEAN_TO", etc.
  componentType="LIPPING"            // or "VINYL_FRAME", "ROOF_PANEL", etc.
  selectedCode={formData.lippingCode}
  onChange={(component) => {
    setFormData({
      ...formData,
      lippingCode: component.code,
      lippingPrice: component.basePrice
    });
  }}
/>
```

### BOM Generator
```typescript
// Auto-generate BOM from project data
<BOMGenerator
  projectId={project.id}
  onGenerate={(bomItems) => {
    // BOM items automatically include:
    // - All required components from ProductTypeComponent
    // - Calculated quantities from formula expressions
    // - Current pricing from ComponentLookup
    // - Preferred suppliers
  }}
/>
```

### Component Library Manager
```typescript
// Settings page for managing component library
<ComponentLibrary
  productTypes={tenant.productTypes} // Tenant's custom product types
  onAddComponent={(component) => {
    // Add new component with metadata
  }}
  onImportCSV={(file) => {
    // Bulk import components
  }}
/>
```

## 8. **Migration Path**

### Phase 1: Foundation ✅ COMPLETE
- [x] Create ComponentLookup, ProductTypeComponent, ComponentProfile models
- [x] Create Project model for universal project wrapping
- [x] Create BOMLineItem model
- [x] Extend Supplier model
- [x] Create migration

### Phase 2: Migrate Existing Data
- [ ] Migrate LippingLookup entries to ComponentLookup
  ```sql
  INSERT INTO "ComponentLookup" (
    "id", "tenantId", "productTypes", "componentType", "code", 
    "name", "metadata", ...
  )
  SELECT 
    gen_random_uuid(), "tenantId", 
    ARRAY['FIRE_DOOR']::TEXT[], 
    'LIPPING',
    'LIP-' || "doorsetType",
    "doorsetType" || ' Lipping',
    jsonb_build_object(
      'topMm', "topMm",
      'bottomMm', "bottomMm",
      'hingeMm', "hingeMm",
      'lockMm', "lockMm"
    ),
    ...
  FROM "LippingLookup"
  WHERE "isActive" = true;
  ```

- [ ] Create ProductTypeComponent configs for fire doors
  ```typescript
  await prisma.productTypeComponent.createMany({
    data: [
      {
        productType: 'FIRE_DOOR',
        componentType: 'LIPPING',
        displayName: 'Door Lipping',
        isRequired: true,
        sortOrder: 1
      },
      {
        productType: 'FIRE_DOOR',
        componentType: 'INTUMESCENT_STRIP',
        displayName: 'Intumescent Strip',
        isRequired: true,
        sortOrder: 2
      }
    ]
  });
  ```

### Phase 3: Update Fire Door Schedule
- [ ] Add component selection dropdowns using ComponentLookup
- [ ] Replace hardcoded lipping calculations with formula system
- [ ] Add BOM generation button to create BOMLineItems
- [ ] Show BOM tab with ordering/receiving workflow

### Phase 4: Consolidate Material System
- [ ] Migrate Material table entries to ComponentLookup
- [ ] Update material cost imports to use ComponentLookup
- [ ] Consolidate door production material references

### Phase 5: Quote Integration
- [ ] Link Quote to Project model
- [ ] Generate BOM from quote line items
- [ ] Component-based pricing for quotes

### Phase 6: 3D & Cut Lists
- [ ] Populate ComponentProfile for shaped components
- [ ] Generate cut lists from BOM
- [ ] 3D model data for visualization

## 9. **Benefits**

### For Fire Door Manufacturers
- Unified component library across all door types
- Auto-calculate lipping, seals, hardware quantities
- Track component ordering and receiving by project
- Generate purchase orders grouped by supplier

### For Window Manufacturers
- Manage vinyl profiles, glass units, hardware
- Calculate frame lengths and glass areas automatically
- Track supplier lead times for glass and hardware
- Generate cut lists for profile cutting

### For Conservatory Builders
- Manage roof panels, guttering, base rails
- Calculate roof areas and panel quantities
- Track supplier orders for bespoke items
- Generate assembly BOMs with all components

### Universal Features
- **One codebase** serves all product types
- **Tenant customization** without code changes
- **Scalable** - add new product types via UI
- **Consistent** - same workflow for all products
- **Extensible** - metadata field for product-specific data

## 10. **Future Enhancements**

- Component templates for common product configurations
- Component kits (e.g., "Standard Door Hardware Kit")
- Multi-currency component pricing
- Component substitute recommendations
- Automated reordering based on stock levels
- Component usage analytics and reporting
- Integration with supplier catalogs via API
- Component lifecycle management (discontinued, superseded)
- Bulk pricing tiers based on quantity
- Component compatibility rules and validation
